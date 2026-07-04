# 로직 실행 순서 — FE/BE 의사코드 템플릿

본 문서는 [prd-to-process.md](prd-to-process.md) §3-2 개별 프로세스 정의 문서의 "로직 실행 순서" 섹션을 작성할 때 따라야 할 상세 형식을 정의한다.
목표는 코드 구현 단계에서 자료 구조·쿼리 형태·트랜잭션 범위 등 추가 설계 판단이 발생하지 않을 만큼 구체적인 의사코드 수준으로 흐름을 펼쳐 작성하는 것이다.
"API 호출", "데이터 조회", "응답 처리" 같은 추상 표기는 사용하지 않는다.

용어 약어 — FE는 프론트엔드(사용자 인터페이스 클라이언트), BE는 백엔드(서버 비즈니스 로직 — 컨트롤러·서비스·리포지토리), DTO는 데이터 전송 객체(Data Transfer Object), ENT는 DB 엔터티 정의서 코드를 의미한다.

아래 예시는 **작성 수준(level of detail)을 보여주기 위한 일반 예시**다. 특정 제품·도메인·프레임워크에 종속되지 않으며, 의사코드 표현(상태 관리·호출 메커니즘·쿼리 문법 등)은 프로젝트가 채택한 스택에 맞춰 옮겨 쓴다. 예시의 라이브러리·문법을 그대로 강제하지 않는다.

# 작성 원칙

- 각 단계는 어느 레이어(FE / API 경계 / BE / DB)에서 실행되는지 반드시 명시한다.
- 단계 사이를 흐르는 데이터의 형태와 변환 내용을 의사코드로 펼쳐 작성한다.
- 외부 시스템 API 호출이 있는 경우, 호출 위치(반드시 BE 경유)와 재시도·실패 정책을 명시한다. FE 직접 호출은 허용되지 않는다.
- DB 쿼리는 대상 ENT, 조건절, 정렬, 페이지, 조인, 락 여부, 트랜잭션 경계까지 SQL 또는 ORM 의사코드로 명시한다.
- 동일 로직이 FE·BE 양측에서 검증되는 경우(예: 입력값 검증), 양측 모두 명시하고 검증 우선순위를 표기한다.

# 섹션 구성

"로직 실행 순서" 섹션 하위에 다음 4개 하위 섹션을 모두 작성한다.

## (1) FE 측 처리 (의사코드)

각 FE 단계마다 아래 11개 항목을 의사코드 수준으로 모두 기술한다.

| 항목 | 작성 내용 |
|------|----------|
| 진입 트리거 | 화면 액션·이벤트명 (예: `SCR-xxx`의 [등록] 버튼 `onClick`, 페이지 mount, query param 변경 등) |
| 사용 상태/폼 | 읽고 쓰는 로컬 상태·form 필드·전역 store 키 |
| 검증 로직 | 필드별 규칙(필수·길이·정규식·범위)과 실패 시 에러 표시 방법(필드 에러·토스트·모달) |
| 요청 DTO 변환 | 입력값 → 요청 본문으로 가공하는 의사코드 (필드 매핑·트림·날짜 포맷·숫자 변환·배열 직렬화) |
| 호출 수단 | 데이터 조회/변경 호출 메커니즘(프레임워크의 query/mutation 훅 또는 동등 수단)·타깃 엔드포인트·HTTP 메서드·캐시 키 |
| 진행 중 UI | 로딩 인디케이터·버튼 디세이블·낙관 업데이트(Optimistic Update) 처리 |
| 응답 처리 | 응답 DTO → FE 도메인 모델 어댑터 변환 의사코드 (필드 리네이밍·타임존·null 처리) |
| 캐시·전역 상태 갱신 | 무효화할 캐시 키·로컬 상태 갱신·전역 store 갱신 등 |
| UI 전이 | 모달 닫기·페이지 이동·토스트 표시·폼 리셋 등 후속 화면 동작 |
| 실패 처리 | 에러 코드별 사용자 메시지·폼 필드 에러 매핑·재시도 정책·복구 가능 여부 |
| 정책 적용 지점 | 적용되는 policy 코드와 적용 위치(검증·가공·표시) |

작성 예시 — 레코드 등록 폼 제출 (도메인·프레임워크 비종속 의사코드):

```
F1. 폼 제출 트리거 → 검증 → 요청 DTO 변환

  진입 트리거: SCR-XXX-01 [등록] 버튼 제출 이벤트
  사용 상태:
    form = { code, name, contact, targetDate, targetTime, ownerId, categoryId, ... }
    selectedResource = 로컬 상태<Resource | null>(초기값 null)
  검증:
    if (code 가 공백)                       → 필드 에러("code", "코드를 입력해주세요") → 중단
    if (contact 가 형식 패턴 불일치)        → 필드 에러("contact", "연락처 형식이 올바르지 않습니다") → 중단
    if (targetDate 미입력 또는 targetTime 미입력)
                                            → 알림("대상 일시를 입력해주세요") → 중단
  요청 DTO 변환 (FE 어댑터):
    payload = {
      code:        trim(form.code),
      contact:     숫자만 추출(form.contact),
      target_at:   (form.targetDate + " " + form.targetTime) → ISO8601 문자열,
      owner_id:    form.ownerId,
      category_id: form.categoryId,
    }
  호출:
    변경 호출(mutation) → POST /api/record/create  (payload, { onSuccess, onError })
  진행 중 UI:
    요청 진행 중 → 등록 버튼 비활성 + 진행 인디케이터

F2. 응답 수신 → 캐시 갱신 → UI 전이

  onSuccess(res):
    관련 목록 캐시 무효화(키: ["record", "list", currentScope])
    성공 알림("등록되었습니다.")
    다이얼로그 닫기
    폼 리셋
  onError(err):
    if (err.code == "BIZ-001") → 실패 알림("과거 시점에는 등록할 수 없습니다.")
    else if (err.code == "BIZ-002") → 실패 알림("동일 시점에 이미 항목이 존재합니다.")
    else → 실패 알림("등록 중 오류가 발생했습니다.")
```

## (2) BE 측 처리 (의사코드)

각 BE 단계마다 아래 12개 항목을 의사코드 수준으로 모두 기술한다.

| 항목 | 작성 내용 |
|------|----------|
| 엔드포인트·메서드 | HTTP 메서드와 URL 패턴 |
| 인증·인가 검증 | 확인할 토큰·세션·역할(role) 항목과 실패 응답 코드 |
| 입력 DTO 재검증 | 서버 측 재검증 항목(필수·길이·범위·정규식 — FE 검증과 동일 항목 + 보안 검증) |
| 사전 조회 쿼리 | 대상 ENT, SELECT 컬럼, WHERE 조건, ORDER BY, LIMIT/OFFSET, JOIN, 락(`FOR UPDATE` 등)을 SQL/ORM 의사코드로 명시 |
| 비즈니스 규칙 적용 | 적용 policy 코드와 적용 조건, 분기 진입 임계값·시간 비교 등 |
| 분기/예외 매핑 | 조회 결과 없음·상태 부적합 등 분기 시 `EX-xxx` 코드와 HTTP 상태 |
| 영속화 쿼리 | INSERT/UPDATE/DELETE 대상 ENT, 변경 필드, 조건절을 SQL/ORM 의사코드로 명시 |
| 트랜잭션 경계 | BEGIN·COMMIT·ROLLBACK 시점과 격리 수준(READ COMMITTED·REPEATABLE READ 등) |
| 외부 시스템 호출 | 외부 API 엔드포인트·페이로드·타임아웃·재시도 정책·실패 시 보상 트랜잭션 |
| 후속 이벤트 발행 | 이벤트명·페이로드·발행 시점(트랜잭션 커밋 전/후·도메인 이벤트·메시지 큐) |
| 응답 DTO 변환 | 도메인 모델 → 응답 본문 변환 의사코드(마스킹·필드 선별·계산 필드) |
| 정책 적용 지점 | 적용되는 policy 코드와 적용 위치(검증·가공·마스킹·감사 로그) |

작성 예시 — 레코드 등록 처리 (도메인·프레임워크 비종속 의사코드):

```
B1. POST /api/record/create 진입 → 인증·재검증

  Authorization 토큰 검증 → user_id, org_id 추출 → 실패 시 401 EX-AUTH-001 반환
  RequestDto 재검증:
    code      : NotBlank, MaxLength(20)
    contact   : 형식 패턴 검증
    target_at : ISO8601 형식, NOW + 1분 이상 미래
  실패 → 400 EX-001 "입력값이 올바르지 않습니다." (필드별 errors 배열 포함)

B2. 사전 조회 (FOR UPDATE 락)

  -- 상위 자원 존재 확인
  SELECT id, code, name, status
  FROM TBL_RESOURCE
  WHERE code = :code AND org_id = :org_id
  LIMIT 1
  FOR UPDATE;

  결과 없음 → 404 EX-002 "대상 자원을 찾을 수 없습니다."

  -- 동일 시점 중복 확인
  SELECT id FROM TBL_RECORD
  WHERE resource_id = :resource_id
    AND target_at = :target_at
    AND status IN ('PENDING', 'CONFIRMED')
  LIMIT 1;

  결과 있음 → 409 EX-003 "동일 시점에 이미 항목이 존재합니다."

  policy 적용 — BIZ-001 (과거 시점 불가):
    if (target_at < NOW()) → 422 EX-BIZ-001 "과거 시점에는 등록할 수 없습니다."

B3. 트랜잭션 영속화

  BEGIN ISOLATION LEVEL READ COMMITTED;

    INSERT INTO TBL_RECORD (
      resource_id, target_at, owner_id, category_id, status, created_at, created_by
    ) VALUES (
      :resource_id, :target_at, :owner_id, :category_id, 'PENDING', NOW(), :user_id
    ) RETURNING id, target_at;

    -- 특정 옵션 선택 시 추가 INSERT
    if (option == '<옵션코드>'):
      INSERT INTO TBL_RECORD_OPTION (
        record_id, template_id, status, created_at
      ) VALUES (:record_id, :template_id, 'READY', NOW());

  COMMIT;

  후속 이벤트 발행 (커밋 후):
    publish RecordCreated { record_id, resource_id, target_at }
    → 후속 처리 워커가 구독

  응답 DTO 변환:
    return {
      id:            record.id,
      target_at:     record.target_at → ISO8601 문자열,
      resource_name: resource.name,
    }
```

## (3) 데이터 변환 흐름 요약

각 변환 지점의 위치·입출력 형태·변환 규칙을 표로 정리한다. 모든 프로세스가 6개 변환 지점을 갖는 것은 아니므로 해당 프로세스에 적용되는 변환 지점만 작성한다.

| 변환 지점 | 변환 위치 | 입력 형태 | 출력 형태 | 변환 규칙 요약 |
|----------|----------|----------|----------|--------------|
| FE→요청 | FE 어댑터 | UI form/state | 요청 DTO | 트림·날짜 포맷·숫자 변환·배열 직렬화 |
| 요청→도메인 | BE 컨트롤러 | 요청 DTO | 도메인 모델 | 검증·기본값 보충·열거형 매핑 |
| 도메인→ENT | BE 리포지토리 | 도메인 모델 | ENT 행 | 영속화 필드 매핑·계산 필드 산출 |
| ENT→도메인 | BE 리포지토리 | ENT 행 | 도메인 모델 | NULL 처리·관계 로딩·열거형 변환 |
| 도메인→응답 | BE 컨트롤러 | 도메인 모델 | 응답 DTO | 마스킹·필드 선별·계산 필드 |
| 응답→FE | FE 어댑터 | 응답 DTO | FE 도메인 모델 | 타임존·표시값 변환·관계 평탄화 |

## (4) 단계 통합 흐름

위 FE/BE 단계를 시간 순서대로 통합한 흐름을 표로 정리한다 (권장 12 단계 이내, 초과 시 하위 프로세스로 분해 후 호출 관계로 표현).

| # | 레이어 | 단계명 | 직전 단계 출력 | 본 단계 처리 요지 | 다음 단계 입력 |
|---|--------|--------|--------------|----------------|---------------|
| 1 | FE | 폼 제출 | (사용자 입력) | 검증 + 요청 DTO 변환 | 요청 DTO |
| 2 | BE | 컨트롤러 진입 | 요청 DTO | 인증·재검증 | 도메인 모델 |
| 3 | BE | 사전 조회 + 정책 검증 | 도메인 모델 | BIZ-001 적용·중복 검사 | 도메인 모델 |
| 4 | BE | 영속화 트랜잭션 | 도메인 모델 | INSERT + COMMIT | 도메인 모델 |
| 5 | BE | 후속 이벤트 발행 | 도메인 모델 | RecordCreated 이벤트 | (비동기 워커) |
| 6 | BE | 응답 변환 | 도메인 모델 | 응답 DTO 직렬화 | 응답 DTO |
| 7 | FE | 응답 처리 | 응답 DTO | 어댑터 변환 + 캐시 무효화 + 알림 + 폼 리셋 | (UI 갱신) |

# 검증 기준

본 템플릿에 따라 작성된 "로직 실행 순서" 섹션은 다음을 모두 충족해야 한다.

- ⬜ FE 측 처리·BE 측 처리·데이터 변환 흐름·단계 통합 흐름 4개 하위 섹션이 모두 작성되었는가?
- ⬜ "API 호출", "데이터 조회", "응답 처리" 같은 추상 표기 없이 의사코드 수준으로 펼쳐져 있는가?
- ⬜ FE의 사용 상태/폼·검증 규칙·DTO 변환·호출 훅·캐시 갱신·UI 전이·실패 처리가 모두 명시되었는가?
- ⬜ BE의 인증·재검증·사전 조회 쿼리·비즈니스 규칙·영속화 쿼리·트랜잭션 경계·외부 호출·후속 이벤트가 모두 명시되었는가?
- ⬜ 사전 조회·영속화 쿼리에 대상 ENT, 조건절, 정렬, 페이지, 조인, 락 여부가 SQL/ORM 의사코드로 명시되었는가?
- ⬜ 데이터 변환 흐름 표가 단계별 입출력 형태와 변환 규칙을 명시하였는가?
- ⬜ 단계 통합 흐름이 12 단계 이내로 정리되었으며 초과 시 하위 프로세스로 분해되었는가?
- ⬜ 코드 구현 단계에서 자료 구조·쿼리 형태·트랜잭션 범위 등 추가 설계 판단이 발생하지 않을 만큼 구체적인가?
