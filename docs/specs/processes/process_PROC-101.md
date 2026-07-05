# 연동 구성 등록·편집 기능 정의

## 개요

- **정의 대상**: 연동 관리자가 서비스 A↔서비스 B 연동 1건을 화면 구성만으로 등록·편집하고, 서버 재검증 후 연동 구성(ENT-001)과 자식(동의 항목 ENT-002·전달 파라미터 ENT-003)을 단일 트랜잭션으로 영속화하는 프로세스.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 "관리자 — 연동 구성 관리: 서비스 A의 호출 주소·전달 파라미터, 사용자 노출 동의 항목, 완료 시 서비스 B로 전달할 주소값 설정".

---

## PROC-101 연동 구성 등록·편집

### 기본 정보

| 항목 | 내용 |
|------|------|
| 프로세스명 | 연동 구성 등록·편집 |
| 분류 | RR |
| 그룹 | 관리자 / 연동 구성 관리 |
| 트리거 유형 | 사용자 액션(SCR-003 저장 제출) |
| 처리 방식 | 동기 |
| 우선순위 | 높음 |
| 관련 IA 항목 | ADM-01 |

### 관련 사양 코드

| 구분 | 코드 | 관계 설명 |
|------|------|----------|
| 서비스(SVC) | SVC-001 | 구현 대상 서비스 시나리오 |
| 정책(policy) | SEC-001·AUTH-001/002·BIZ-001·SEC-004·DATA-001·OPS-002 | IP·세션·구성 검증·주입 방어·무저장·감사 |
| 공통 기능(FN) | FN-003(세션)·FN-005(입력 검증)·FN-006(구성 검증·고유성)·FN-013(감사)·FN-015(엔벨로프) | 호출 단위 로직 |
| 데이터 모델(MDL) | MDL-101(연동 구성) | 요청·응답·도메인 겸용 |
| DB 엔터티(ENT) | ENT-001·ENT-002·ENT-003·ENT-006 | 영속화·자식·감사 대상 |
| 화면(SCR) | SCR-003 | 등록·편집 폼 |

### 진입점 및 진입 조건

- **진입점**: `POST /api/admin/configs`(등록) · `PUT /api/admin/configs/:id`(편집). SCR-003 [저장] 버튼 제출.
- **진입 조건**: PROC-104 IP 게이트 통과 + FN-003 유효 세션. 미인증 시 401 EX-AUTH-001, 유휴 만료 시 401 EX-AUTH-002.
- **사전 검증**: 본문 크기 ≤1MB(FN-005 SEC-004-03), 허용 문자·주입 방어(FN-005 SEC-004-01/02), MDL-101 스키마(필수·길이·URL 형식·동의 항목 1개 이상).

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 설명 |
|------|--------|------------|------|------|
| 입력 | mode | 'CREATE'/'EDIT' | Y | 경로·메서드로 결정(신규 POST / :id PUT) |
| 입력 | config | MDL-101 | Y | configCode·configName·serviceAEntryUrl·serviceBDeliveryUrl·serviceBHttpMethod·isActive·consentItems[]·parameters[] |
| 입력 | selfId | string(UUID) | N | EDIT 시 대상 id(고유성 자기 제외) |
| 출력 | result | MDL-101 | - | 저장된 구성(id 포함) |

### 연관 데이터 및 외부 호출

- **호출 API**: 외부 호출 없음(내부 영속화만).
- **데이터 조회 대상**: ENT-001 고유성 사전 조회(config_code, deleted_at IS NULL).
- **데이터 변경 대상(CRUD)**: ENT-001 INSERT/UPDATE, ENT-002·ENT-003 INSERT(편집 시 교체), ENT-006 INSERT(감사).

### 실행 제약사항

- **트랜잭션 경계**: 단일 트랜잭션 — 부모 ENT-001 + 자식 ENT-002·ENT-003 를 원자적으로 커밋. 실패 시 전체 롤백.
- **동시성 제어**: 고유성 사전 조회 후 INSERT 사이 경합은 UQ_CONFIG_CODE 필터 유니크가 최종 방어(중복 시 409 EX-BIZ-002). 편집은 대상 행 UPDATE.
- **성능 요구**: 관리자 저빈도 요청, 단건 트랜잭션. 별도 임계치 없음.
- **보안 요구**: IP+세션 인증, 입력 재검증(화면 검증 비의존), 등록·수정·삭제 감사(OPS-002). 회원 키·처리 상태 컬럼 부재(설정 데이터).

### 로직 실행 순서

#### FE 측 처리 (의사코드)

```
F1. 저장 제출 트리거 → FE 검증 → 요청 DTO 변환   (SCR-003)
  진입 트리거: SCR-003 [저장] 버튼 제출 이벤트
  사용 상태/폼:
    form = { configCode, configName, serviceAEntryUrl, serviceBDeliveryUrl,
             serviceBHttpMethod, isActive, consentItems[], parameters[] }
    mode = route.startsWith('/admin/configs/new') ? 'CREATE' : 'EDIT'
  검증 로직(1차 방어, 서버 재검증 전제):
    if (blank(configCode) || len(configCode) > 64)        → 필드 에러 → 중단
    if (blank(configName) || len(configName) > 100)       → 필드 에러 → 중단
    if (!/^https?:\/\/\S+$/.test(serviceAEntryUrl))        → 필드 에러 → 중단
    if (!/^https?:\/\/\S+$/.test(serviceBDeliveryUrl))     → 필드 에러 → 중단
    if (consentItems.length < 1)                          → 알림 → 중단
    if (parameters.length < 1)                            → 알림 → 중단
  요청 DTO 변환(FE 어댑터):
    payload = {
      configCode: trim(form.configCode), configName: trim(form.configName),
      serviceAEntryUrl: trim(...), serviceBDeliveryUrl: trim(...),
      serviceBHttpMethod: form.serviceBHttpMethod, isActive: form.isActive,
      consentItems: form.consentItems.map((c,i)=>({ label:trim(c.label),
        description:c.description||null, required:!!c.required, order:i })),
      parameters: form.parameters.map((p,i)=>({ name:trim(p.name),
        sourceKeyA:trim(p.sourceKeyA), deliverToB:p.deliverToB!==false,
        required:!!p.required, order:i }))
    }
  호출 수단:
    mutation → mode=='CREATE' ? POST /api/admin/configs
                              : PUT /api/admin/configs/:id   (payload, {onSuccess,onError})
  진행 중 UI: Submitting — 저장 버튼 Spinner + 폼 disabled

F2. 응답 수신 → 캐시 갱신 → UI 전이
  onSuccess(res→FN-015 { success, data:MDL-101 }):
    캐시 무효화(키: ["admin","configs","list"]) 및 ["admin","configs",res.data.id]
    성공 Toast("저장되었습니다.")
    navigate → SCR-004 상세(/admin/configs/{res.data.id})
  onError(err):
    if (err.code=='EX-BIZ-001')  → err.details 를 필드별 인라인 에러 매핑
    else if (err.code=='EX-BIZ-002') → configCode 필드 에러("이미 존재하는 구성입니다.")
    else if (err.code=='EX-SEC-004') → Banner("입력 형식이 올바르지 않습니다.")
    else if (err.code=='EX-SEC-005') → Banner("요청이 너무 큽니다.")
    else if (err.code=='EX-AUTH-002')→ redirect SCR-001(?expired=1)
    else → Banner("잠시 후 다시 시도해주세요.")
  정책 적용 지점: 세션 만료(AUTH-002)는 재인증 유도, 고유성·경고는 서버 전담(FE 미판단)
```

#### BE 측 처리 (의사코드)

```
B1. 진입 가드 → 인증 → 입력 재검증
  엔드포인트: POST /api/admin/configs | PUT /api/admin/configs/:id
  인증·인가: (선행) PROC-104 IP 게이트 → FN-003_verifySession(cookie.sessionId, now)
             실패 → 401 EX-AUTH-001 / 유휴 만료 401 EX-AUTH-002
  입력 DTO 재검증: FN-005_validateInput(raw, MDL-101 schema, rawSize)
             rawSize>1MB → 413 EX-SEC-005 / 스키마 위반 → 400 EX-SEC-004(details)
  mode = 메서드(POST=CREATE / PUT=EDIT), selfId = params.id (EDIT)

B2. 구성 검증·고유성 — FN-006_validateConfig(config, mode, selfId)   [BR-101]
  필수(BIZ-001-01)·URL 형식(BIZ-001-02)·동의 항목 개수(BIZ-001-04) 위반 → 422 EX-BIZ-001
  고유성 사전 조회(BIZ-001-03):
    SELECT id FROM TBL_INTERLOCK_CONFIG
    WHERE config_code = :configCode AND deleted_at IS NULL;
    if (row exists AND (mode=='CREATE' OR row.id != :selfId)) → 409 EX-BIZ-002
  개인정보 파라미터 경고(BIZ-001-05, BR-102, 비차단):
    if (parameters 에 개인정보 직접 수신 항목) FN-013_writeAudit(CONFIG_PII_WARN, INFO)

B3. 트랜잭션 영속화   (부모+자식 원자적)
  BEGIN TRAN ISOLATION LEVEL READ COMMITTED;
    if (mode=='CREATE'):
      INSERT INTO TBL_INTERLOCK_CONFIG
        (id, config_code, config_name, service_a_entry_url, service_b_delivery_url,
         service_b_http_method, is_active, created_at, created_by)
      VALUES (NEWID형, :configCode, :configName, :aUrl, :bUrl, :method,
              :isActive, SYSUTCDATETIME(), :session.username)
      → configId = 삽입 id;
    else:  // EDIT
      UPDATE TBL_INTERLOCK_CONFIG
        SET config_name=:configName, service_a_entry_url=:aUrl,
            service_b_delivery_url=:bUrl, service_b_http_method=:method,
            is_active=:isActive, updated_at=SYSUTCDATETIME(), updated_by=:session.username
      WHERE id=:selfId AND deleted_at IS NULL;   // config_code 불변
      → configId = :selfId;
      DELETE FROM TBL_INTERLOCK_CONSENT_ITEM WHERE config_id=:configId;   // 자식 교체
      DELETE FROM TBL_INTERLOCK_PARAMETER    WHERE config_id=:configId;
    for (c in consentItems):
      INSERT INTO TBL_INTERLOCK_CONSENT_ITEM
        (id, config_id, item_label, item_description, is_required, display_order)
      VALUES (NEWID, :configId, :c.label, :c.description, :c.required, :c.order);
    for (p in parameters):
      INSERT INTO TBL_INTERLOCK_PARAMETER
        (id, config_id, param_name, source_key_a, deliver_to_b, is_required, display_order)
      VALUES (NEWID, :configId, :p.name, :p.sourceKeyA, :p.deliverToB, :p.required, :p.order);
  COMMIT;   // 무결성 위반·중복 예외 시 ROLLBACK → 409 EX-BIZ-002 / 500 EX-FN-999

B4. 커밋 후 감사 → 응답 변환
  FN-013_writeAudit({ eventType: mode=='CREATE'?'CONFIG_CREATE':'CONFIG_UPDATE',
                      actorType:'ADMIN', actorId:session.username,
                      target:configCode, result:'SUCCESS' })   // OPS-002-01
  응답 DTO: FN-015_ok( selectConfig(configId) )   // MDL-101 (자식 포함)
  정책 적용 지점: DATA-001(회원 키·상태 컬럼 부재), SEC-004(바인딩 전용 쿼리)
```

#### 데이터 변환 흐름

| 변환 지점 | 변환 위치 | 입력 형태 | 출력 형태 | 변환 규칙 |
|----------|----------|----------|----------|-----------|
| FE→요청 | FE 어댑터 | SCR-003 form/state | MDL-101 요청 DTO | 트림·order 부여·boolean 정규화·배열 직렬화 |
| 요청→도메인 | BE 컨트롤러 | MDL-101 DTO | InterlockConfig 도메인 | FN-005 검증·기본값(method 'POST') 보충 |
| 도메인→ENT | BE 리포지토리 | 도메인 모델 | ENT-001 행 + 자식 N행 | config_id 로 자식 매핑, URL·method 저장 |
| ENT→도메인 | BE 리포지토리 | ENT 행 | 도메인 모델 | 자식 로딩(consentItems·parameters) |
| 도메인→응답 | BE 컨트롤러 | 도메인 모델 | MDL-101 응답 DTO | 필드 그대로(설정 데이터, 마스킹 없음) |
| 응답→FE | FE 어댑터 | MDL-101 DTO | SCR-004 모델 | createdAt ISO8601→지역 포맷(상세 표시) |

#### 단계 통합 흐름

| # | 레이어 | 단계명 | 직전 단계 출력 | 본 단계 처리 요지 | 다음 단계 입력 |
|---|--------|--------|--------------|----------------|---------------|
| 1 | FE | 저장 제출 | (사용자 입력) | FE 검증 + 요청 DTO 변환 | MDL-101 요청 DTO |
| 2 | BE | 게이트·인증·재검증 | 요청 DTO | PROC-104 IP + FN-003 세션 + FN-005 | 검증된 DTO |
| 3 | BE | 구성 검증·고유성 | 검증된 DTO | FN-006 필수·URL·개수·고유성(BR-101) | 도메인 모델 |
| 4 | BE | 트랜잭션 영속화 | 도메인 모델 | 부모+자식 INSERT/UPDATE + COMMIT | 저장 결과 |
| 5 | BE | 감사·응답 변환 | 저장 결과 | FN-013 감사 + FN-015 응답 | MDL-101 응답 |
| 6 | FE | 응답 처리 | MDL-101 응답 | 캐시 무효화 + Toast + SCR-004 이동 | (UI 갱신) |

### 분기 및 예외 흐름

| 코드 | 발생 조건 | 처리 방향 | 결과 |
|------|----------|----------|------|
| BR-101 | 구성 코드 신규(CREATE) / 기존(EDIT) | CREATE=고유성 신규 검증, EDIT=selfId 제외 검증·config_code 불변 | 등록 또는 수정 경로 |
| BR-102 | 개인정보 직접 수신 파라미터 포함 | 저장 차단 없이 CONFIG_PII_WARN 감사 기록 | 경고 후 저장 진행 |
| EX-AUTH-001 | 미인증 세션 | 진입 차단, 로그인 유도 | 401 로그인이 필요합니다. |
| EX-AUTH-002 | 세션 유휴 30분 초과 | 세션 만료, 재인증 유도 | 401 다시 로그인해주세요. |
| EX-BIZ-001 | 필수 누락·URL 오류·동의 항목 0개 | 저장 거부, details 필드 오류 | 422 입력 값을 확인해주세요. |
| EX-BIZ-002 | 구성 코드 중복(유효 구성 간) | 저장 거부(롤백) | 409 이미 존재하는 구성입니다. |
| EX-SEC-004 | 허용 문자 위반·주입 패턴 | 저장 거부 | 400 입력 형식이 올바르지 않습니다. |
| EX-SEC-005 | 본문 1MB 초과 | 요청 거부 | 413 요청이 너무 큽니다. |
| EX-FN-999 | 트랜잭션·DB 오류 | 롤백, 감사 | 500 잠시 후 다시 시도해주세요. |

> IP 차단(EX-SEC-001)은 선행 PROC-104 게이트에서 처리된다(본 PROC 진입 전).

### 실행 결과

- **정상 결과**: ENT-001(+자식) 1건 등록/수정, ENT-006 감사 1건, MDL-101 응답. FE 는 SCR-004 상세로 이동.
- **실패 결과**: EX-BIZ-001/002·EX-SEC-004/005·EX-FN-999 엔벨로프. 트랜잭션 롤백으로 부분 저장 없음.
- **후속 트리거**: 없음(동기 완결). 저장된 활성 구성은 PROC-201·PROC-203 이 소비.

### 의존 프로세스

- **호출 관계**: 없음(FN 단위 로직만 호출).
- **선행 관계**: PROC-104(IP 게이트) · PROC-103(세션 발급) 완료 상태 전제.
- **이벤트 관계**: 없음.

### 구현 가이드

- 부모·자식은 반드시 하나의 트랜잭션에서 처리하고, 편집은 자식 전량 교체(delete-and-reinsert) 또는 증분 갱신 중 build 택일하되 부모 updated_at/by 를 함께 갱신한다.
- config_code 는 편집 시 변경을 막아 고유성·참조 안정성을 지킨다. 고유성은 저장 직전 조회 + 필터 유니크 이중 방어로 확인한다.
- 모든 검증은 FE 에 의존하지 않고 FN-005·FN-006 로 서버 재수행한다. DB 접근은 파라미터 바인딩만 사용한다(SEC-004-02).
