# 연동 구성 삭제(소프트) 기능 정의

## 개요

- **정의 대상**: 연동 관리자가 등록된 연동 구성을 소프트 삭제(deleted_at 설정)하는 프로세스. SVC-002·SCR-002/004 가 PROC-102 로 느슨히 인용했으나 단일 책임·트리거 원칙에 따라 별도 채번한다. 물리 삭제는 하지 않으며 삭제 이벤트를 감사한다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 "관리자 — 연동 구성 관리".

---

## PROC-106 연동 구성 삭제(소프트)

### 기본 정보

| 항목 | 내용 |
|------|------|
| 프로세스명 | 연동 구성 삭제(소프트) |
| 분류 | RR |
| 그룹 | 관리자 / 연동 구성 관리 |
| 트리거 유형 | 사용자 액션(SCR-002·004 삭제 확정) |
| 처리 방식 | 동기 |
| 우선순위 | 높음 |
| 관련 IA 항목 | ADM-02 |

### 관련 사양 코드

| 구분 | 코드 | 관계 설명 |
|------|------|----------|
| 서비스(SVC) | SVC-002 | 활성/삭제(BR-104) |
| 정책(policy) | SEC-001·AUTH-001/002·OPS-002 | IP·세션·삭제 감사 |
| 공통 기능(FN) | FN-003(세션)·FN-013(감사)·FN-015(엔벨로프) | 호출 단위 로직 |
| 데이터 모델(MDL) | MDL-101(연동 구성) | 도메인 참조 |
| DB 엔터티(ENT) | ENT-001·ENT-006 | 소프트 삭제·감사 대상 |
| 화면(SCR) | SCR-002·SCR-004 | 삭제 확인 Modal 확정 트리거 |

### 진입점 및 진입 조건

- **진입점**: `DELETE /api/admin/configs/:id`. SCR-002·004 삭제 확인 `Modal` 확정 클릭.
- **진입 조건**: PROC-104 IP 게이트 통과 + FN-003 유효 세션.
- **사전 검증**: id UUID 형식, 대상 구성 존재·미삭제(deleted_at IS NULL).

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 설명 |
|------|--------|------------|------|------|
| 입력 | id | string(UUID) | Y | 삭제 대상 구성 |
| 출력 | result | { id, deleted:true } | - | 삭제 결과 |

### 연관 데이터 및 외부 호출

- **호출 API**: 외부 호출 없음.
- **데이터 조회 대상**: ENT-001(대상 존재 확인).
- **데이터 변경 대상(CRUD)**: ENT-001 UPDATE(deleted_at 설정, 소프트 삭제), ENT-006 INSERT(감사). 자식(동의 항목 ENT-002)은 부모 소프트 삭제로 유효 종료(물리 삭제 아님). `#214` 로 전달 파라미터(구 ENT-003) 자식은 폐기됐다.

### 실행 제약사항

- **트랜잭션 경계**: 단건 UPDATE 트랜잭션(소프트 삭제).
- **동시성 제어**: id 행 단위 UPDATE. 멱등(이미 삭제된 대상 재요청 시 "대상 없음"). config_code 는 소프트 삭제 후 부분 유니크로 재사용 허용(BIZ-001-03·EXC-BIZ-02).
- **성능 요구**: 관리자 저빈도 단건. 별도 임계치 없음.
- **보안 요구**: IP+세션, 삭제 감사(OPS-002, 되돌릴 수 없어 추적 필수). 처리 상태(ENT-004)는 독립 생명주기로 연쇄 삭제하지 않는다(CASCADE 금지).

### 로직 실행 순서

#### FE 측 처리 (의사코드)

```
F1. 삭제 확정 트리거 → 요청   (SCR-002/004)
  진입 트리거: 삭제 버튼 클릭 → 삭제 확인 Modal 열기 → [확정] 클릭
  사용 상태/폼: target = { id, configName }, confirmModalOpen = true
  검증 로직: 확인 Modal 강제(되돌릴 수 없음). 확정 전까지 요청 없음
  호출 수단: mutation → DELETE /api/admin/configs/:id
  진행 중 UI: Modal 확정 버튼 Spinner + disabled

F2. 응답 수신 → 캐시 갱신 → UI 전이
  onSuccess(res→{ data:{ id, deleted:true } }):
    캐시 무효화(["admin","configs","list"]) 및 ["admin","configs",id] 제거
    성공 Toast("삭제했습니다.")
    SCR-002 → 행 제거 / SCR-004 → navigate SCR-002 목록
  onError(err):
    if (err.code=='EX-AUTH-002') → redirect SCR-001(?expired=1)
    else → 실패 Toast("삭제에 실패했습니다.")
  정책 적용 지점: 삭제 확인 Modal 강제(OPS-002 감사 대상), 세션 만료 재인증 유도
```

#### BE 측 처리 (의사코드)

```
B1. 진입 가드 → 인증 → 입력 검증   [BR-104]
  엔드포인트: DELETE /api/admin/configs/:id
  인증·인가: (선행) PROC-104 IP 게이트 → FN-003_verifySession(cookie.sessionId, now)
             실패 → 401 EX-AUTH-001 / 유휴 만료 401 EX-AUTH-002
  입력 검증: id UUID 형식 (위반 → 400 EX-SEC-004)

B2. 소프트 삭제 (단건 트랜잭션)
  BEGIN;
    UPDATE TBL_INTERLOCK_CONFIG
      SET deleted_at = now(), updated_at = now(),
          updated_by = :session.username
    WHERE id = :id AND deleted_at IS NULL;   // 물리 삭제 아님, 자식 CASCADE 미발생
    affected = ROW_COUNT;
  COMMIT;
  if (affected == 0) → 200 { data: null } (대상 없음/이미 삭제, 오류 아님)

B3. 커밋 후 감사 → 응답
  FN-013_writeAudit({ eventType:'CONFIG_DELETE', actorType:'ADMIN',
                      actorId:session.username, target: :id, result:'SUCCESS' })   // OPS-002-01
  응답: FN-015_ok({ id, deleted:true })
  정책 적용 지점: OPS-002(삭제 감사·전후 상태), SEC-004(바인딩 전용 쿼리)
```

#### 데이터 변환 흐름

| 변환 지점 | 변환 위치 | 입력 형태 | 출력 형태 | 변환 규칙 |
|----------|----------|----------|----------|-----------|
| FE→요청 | FE 어댑터 | 삭제 확정 | DELETE :id | 경로 파라미터만 |
| 도메인→ENT | BE 리포지토리 | 삭제 명령 | ENT-001 UPDATE | deleted_at·updated_at/by 설정(소프트) |
| 도메인→응답 | BE 컨트롤러 | 삭제 결과 | { id, deleted } | 최소 결과 반환 |
| 응답→FE | FE 어댑터 | 결과 DTO | 행 제거/목록 이동 | 캐시 무효화·Toast |

#### 단계 통합 흐름

| # | 레이어 | 단계명 | 직전 단계 출력 | 본 단계 처리 요지 | 다음 단계 입력 |
|---|--------|--------|--------------|----------------|---------------|
| 1 | FE | 삭제 확정 | (확인 Modal 확정) | DELETE 요청 | DELETE :id |
| 2 | BE | 게이트·인증·검증 | 요청 | PROC-104 + FN-003 + id 검증 | 검증된 명령 |
| 3 | BE | 소프트 삭제 | 검증된 명령 | ENT-001 deleted_at UPDATE | 삭제 결과 |
| 4 | BE | 감사·응답 | 삭제 결과 | FN-013 CONFIG_DELETE + FN-015 | 결과 DTO |
| 5 | FE | 응답 처리 | 결과 DTO | 행 제거/목록 이동·Toast·캐시 무효화 | (UI 갱신) |

### 분기 및 예외 흐름

| 코드 | 발생 조건 | 처리 방향 | 결과 |
|------|----------|----------|------|
| BR-104 | 삭제 대상 존재 / 이미 삭제·부재 | 존재=소프트 삭제·감사, 부재=대상 없음 | 삭제 또는 200 data:null |
| EX-AUTH-001 | 미인증 세션 | 진입 차단, 로그인 유도 | 401 로그인이 필요합니다. |
| EX-AUTH-002 | 세션 유휴 30분 초과 | 세션 만료, 재인증 유도 | 401 다시 로그인해주세요. |
| EX-SEC-004 | id 형식 위반 | 요청 거부 | 400 입력 형식이 올바르지 않습니다. |
| EX-FN-999 | UPDATE·DB 오류 | 롤백, 감사 | 500 잠시 후 다시 시도해주세요. |

> IP 차단(EX-SEC-001)은 선행 PROC-104 게이트에서 처리된다.

### 실행 결과

- **정상 결과**: ENT-001 deleted_at 설정(소프트), CONFIG_DELETE 감사 1건, { id, deleted:true } 응답. 목록·상세 조회(PROC-102)에서 제외, config_code 재사용 허용.
- **실패 결과**: EX-AUTH-001/002·EX-SEC-004·EX-FN-999 엔벨로프. 대상 없음은 200 data:null.
- **후속 트리거**: 없음. 삭제된 구성 참조의 처리 상태(ENT-004)는 독립 유지되며 조회는 PROC-301 이 정합 처리.

### 의존 프로세스

- **호출 관계**: 없음.
- **선행 관계**: PROC-104·PROC-103(세션)·PROC-101(대상 구성 존재).
- **이벤트 관계**: 없음.

### 구현 가이드

- 삭제는 소프트 삭제(deleted_at)로만 수행하고 물리 삭제·자식 CASCADE 를 발생시키지 않는다. 되돌릴 수 없으므로 FE 에서 확인 `Modal` 을 강제한다.
- 소프트 삭제된 config_code 는 부분 유니크(deleted_at IS NULL)로 재사용을 허용한다. 처리 상태(ENT-004)는 배치(PROC-402)가 독립 하드 삭제하므로 본 프로세스가 연쇄 삭제하지 않는다.
- **참조 정합**: SCR-002/004 의 삭제 인터랙션과 SVC-002 BR-104 는 본 PROC-106 을 인용해야 한다(기존 PROC-102 인용 정정 대상).
