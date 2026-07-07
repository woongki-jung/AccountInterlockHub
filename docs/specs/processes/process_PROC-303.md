# 완료 콜백 API 기능 정의

## 개요

- **정의 대상**: 서비스 B 가 정보연계 처리를 완료한 뒤 전달받은 키값 기준으로 완료를 허브에 통지(콜백)하는 서버 대면 API 프로세스. 인증·요청 제한·입력 검증을 진입 가드로 선수행한 뒤, 내부 연동이력 기록 프로세스(PROC-403 완료 기록 진입)에 위임해 {연동 구성 식별자 + 사용자 키값} 스코프의 완료 콜백 미수신 최신 이력 1건에 수신 여부=수신·수신 일시를 기록한다. 처리상태(ENT-004) 4항목은 어떤 경우에도 변경하지 않으며, 스코프 내 미수신 이력이 없고 완료 이력만 있는 재통지는 오류가 아니라 멱등 성공으로 처리한다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 6 "서비스 B가 정보연계 처리를 완료하고 전달받은 키값 기준으로 완료를 허브에 통지(콜백)하는 API" · [`../../prd/devspec/external-apis.md`](../../prd/devspec/external-apis.md) §5 완료 콜백 API. 2026-07-06 요구 추가(`accountinterlockhub#33`).

---

## PROC-303 완료 콜백 API

### 기본 정보

| 항목 | 내용 |
|------|------|
| 프로세스명 | 완료 콜백 API |
| 분류 | RR·INT |
| 그룹 | 서비스 연동 API |
| 트리거 유형 | 외부 콜백(서비스 B 서버) |
| 처리 방식 | 동기 |
| 우선순위 | 높음 |
| 관련 IA 항목 | API-03 |

### 관련 사양 코드

| 구분 | 코드 | 관계 설명 |
|------|------|----------|
| 서비스(SVC) | SVC-009 | 완료 콜백 API(연동이력 완료 기록 포함) |
| 정책(policy) | SEC-003·OPS-001·SEC-004·BIZ-004·DATA-005·OPS-002·SEC-005 | API 인증(주체 분리)·요청 제한·입력 검증·대상 특정·완료 기록·감사·마스킹 |
| 공통 기능(FN) | FN-004(API 인증)·FN-014(요청 제한)·FN-005(입력 검증)·FN-018(완료 콜백 대상 특정·완료 기록)·FN-019(스코프 조회, FN-018 내부)·FN-010(감사 마스킹, FN-018 내부)·FN-013(감사, FN-018 내부)·FN-015(엔벨로프) | 호출 단위 로직 |
| 데이터 모델(MDL) | MDL-305(완료 콜백 요청 — configCode·userKey)·MDL-303(연동이력 도메인) | 인바운드·도메인 모델 |
| DB 엔터티(ENT) | ENT-007(연동이력 — 완료 기록 대상)·ENT-001(구성 실재·지정 여부 사전 검증, FN-019 내부)·ENT-006(감사) | 조회·갱신·감사 대상. ENT-004 미변경 |
| 화면(SCR) | (없음 — 서비스 B 서버 콜백) | 대면 화면 없음 |

### 진입점 및 진입 조건

- **진입점**: `POST /api/interlock/callback`. 서비스 B 서버가 사전 공유 인증 수단으로 호출. 요청 본문은 허브→서비스 B 전달 페이로드(MDL-204)로 수령한 구성 식별자와 전달받은 키값을 회신.
- **진입 조건**: FN-004 API 인증 통과(API 키 또는 서명 헤더, HTTPS 전제) + 인증 주체가 서비스 B 자격(SEC-003-03, 서비스 A 자격 거부).
- **사전 검증**: 인증(FN-004), 주체 구분(SEC-003-03), 요청 제한(FN-014 분당 60회, 인증 주체 기준), 콜백 입력 필수·형식·크기·주입(FN-005 — configCode NotBlank·MaxLength(64), userKey NotBlank·MaxLength(512)).

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 설명 |
|------|--------|------------|------|------|
| 입력 | credential | string | Y | Authorization/API-Key 헤더 또는 서명(로그 배제) |
| 입력 | callback | MDL-305 | Y | { configCode, userKey } — 전달 페이로드로 수령한 값 회신 |
| 출력 | (성공 엔벨로프) | - | - | 완료 기록 또는 멱등 성공 시 200 { success:true } |

> 요청 키값은 콜백 계약의 필수 항목이 아니다 — 대상 특정은 {configCode + userKey} 스코프의 미수신 최신 1건 규칙으로 단일화한다(BIZ-004-03, SVC-009 확정).

### 연관 데이터 및 외부 호출

- **호출 API**: 외부 호출 없음(허브가 콜백 수신 측). 서비스 B→허브 인바운드만.
- **데이터 조회 대상**: ENT-007(IX_HISTORY_SCOPE 로 {config_id, user_key} 스코프의 미수신 최신 1건 — FN-019 pendingOnly=true), ENT-001(config_code→config_id 변환·user_key_param_id 지정 여부 사전 검증 — FN-019 내부).
- **데이터 변경 대상(CRUD)**: ENT-007 UPDATE(대상 이력 callback_received=true·callback_received_at, 내부 PROC-403 완료 기록 진입). ENT-004(처리 상태) 4항목은 어떤 경우에도 변경하지 않는다(BIZ-004-06). ENT-006 INSERT(콜백 수신·대상 미특정·멱등 감사).

### 실행 제약사항

- **트랜잭션 경계**: 완료 기록은 단건 UPDATE 트랜잭션(내부 PROC-403). `WHERE ... AND callback_received=false` 조건절이 곧 동시성 가드 — ROW_COUNT=0 이면 재통지·동시 콜백으로 보고 멱등 성공. 인증·조회 감사는 append-only 별도 기록.
- **동시성 제어**: 대상 특정 후 UPDATE 조건절 가드(callback_received=false)로 재통지·동시 콜백을 멱등하게 흡수한다(BR-303·EXC-BIZ-10). 별도 락 불요(원자적 조건부 UPDATE).
- **성능 요구**: 요청 제한 분당 60회 초과 시 429(FN-014, scope='callback'). 미수신 최신 1건은 IX_HISTORY_SCOPE(config_id, user_key, requested_at DESC)로 획득([ENT-007](../datas/data_ENT-007.md) §인덱스).
- **보안 요구**: API 인증·주체 분리(SEC-003-01/03 — 서비스 A 자격 거부), 감사·오류 로그의 userKey 는 앞2·뒤2 마스킹(SEC-005-01, FN-010). 존재 여부 비노출(구성 미존재·미지정·이력 없음 단일 404 EX-BIZ-006). 처리상태 무변경 경계 유지(BIZ-004-06).

### 로직 실행 순서

#### FE 측 처리 (의사코드)

```
해당 없음 — 서비스 B 서버 대면 콜백 API 로 허브 SPA(FE) 처리 단계가 없다.
호출 주체는 서비스 B 서버이며 사전 공유 인증 수단(API 키/서명)으로 요청한다.
응답 계약(성공 엔벨로프 { success:true } / 실패 { success:false, error })은 FN-015 가 구성한다.
```

#### BE 측 처리 (의사코드)

```
B1. API 인증·주체 구분 — FN-004_authenticateServiceApi(credential, requestBody, requestKey=null, now)  (SEC-003-01/03)
  엔드포인트: POST /api/interlock/callback (인증 가드 선적용)
  if (자격 누락·불일치·서명 불일치·시간창 초과):
        // 인증 실패 감사(API_AUTH_FAIL)는 FN-004 내부에서 기록
        → 401 EX-SEC-003
  caller = 인증된 호출 주체(요청 제한 주체 키)
  if (caller.actor != SERVICE_B):                    // 서비스 A 자격으로 API-03 호출 차단(SEC-003-03)
        FN-013_writeAudit({ eventType:'API_AUTH_FAIL', actorType:'SERVICE',
                            target: caller.id, result:'FAIL', detail:'wrong actor for callback' })
        → 401 EX-SEC-003

B2. 요청 제한 — FN-014_checkRateLimit(caller, 'callback', now, 60)  (OPS-001)
  초과 → 감사(RATE_LIMIT, BLOCKED) → 429 EX-OPS-001

B3. 입력 검증 — FN-005_validateInput(raw{configCode,userKey}, callbackSchema, rawSize)  (SEC-004)
  본문 크기 > 1MB → 413 EX-SEC-005
  configCode: NotBlank, MaxLength(64) / userKey: NotBlank, MaxLength(512), 허용 문자·주입 패턴 위반 → 400 EX-SEC-004
  → callback = MDL-305 { configCode, userKey }

B4. 완료 기록(위임) — 내부 PROC-403 완료 기록 진입: FN-018_recordCompletionCallback(callback, now)  (BIZ-004-03/05/06·BR-303)
  // PROC-403(완료 기록) → FN-018 내부 구성(재서술 없이 위임):
  //   ① res = FN-019_resolveHistoryScope(callback.configCode, callback.userKey, pendingOnly=true)
  //        cfg = SELECT id, user_key_param_id FROM TBL_INTERLOCK_CONFIG
  //              WHERE config_code=:configCode AND deleted_at IS NULL;
  //        if (cfg is null OR cfg.user_key_param_id IS NULL) → eligible=false
  //        target = SELECT * FROM TBL_INTERLOCK_HISTORY
  //                 WHERE config_id=:cfg.id AND user_key=:userKey AND callback_received=false
  //                 ORDER BY requested_at DESC LIMIT 1;                   -- IX_HISTORY_SCOPE(미수신 최신)
  //        anyInScope = target ? true : EXISTS(스코프 내 이력)            -- 재통지 멱등 판정용
  //   ② if (!res.eligible)                          → 감사(CALLBACK_TARGET_MISS,FAIL) → throw 404 EX-BIZ-006
  //   ③ if (res.target is null):
  //        if (res.anyInScope) → 감사(CALLBACK_IDEMPOTENT,INFO) → return   // 완료 이력만 존재 = 재통지 멱등 성공(EXC-BIZ-10)
  //        else                → 감사(CALLBACK_TARGET_MISS,FAIL) → throw 404 EX-BIZ-006
  //   ④ 완료 기록(내부 PROC-403 트랜잭션):
  //        BEGIN;
  //          n = UPDATE TBL_INTERLOCK_HISTORY
  //              SET callback_received=true, callback_received_at=:now
  //              WHERE request_key=:res.target.requestKey AND callback_received=false;   -- 동시성 가드(ROW_COUNT)
  //        COMMIT;
  //        if (n = 0) → 감사(CALLBACK_IDEMPOTENT,INFO) → return           // 동시 콜백이 먼저 기록 = 멱등 성공
  //        // 처리상태(ENT-004) 4항목을 변경하는 어떤 문장도 두지 않는다(BIZ-004-06)
  //   ⑤ FN-013_writeAudit({ eventType:'CALLBACK_RECORDED', actorType:'SERVICE', target: configCode,
  //                         result:'SUCCESS', detail:'userKey='+FN-010_mask(userKey)+', requestKey='+res.target.requestKey })
  //   ⑥ return (void)

B5. 응답 변환 — FN-015_ok()  (엔벨로프)
  응답: { success:true }   // 완료 기록 또는 멱등 성공 모두 200
  정책 적용 지점: SEC-003(인증·주체), OPS-001(제한), SEC-004(형식), BIZ-004-03/05(대상 특정·지정 여부),
                 BIZ-004-06(처리상태 불변경), EXC-BIZ-10(재통지 멱등), OPS-002·SEC-005-01(감사·마스킹)
```

#### 데이터 변환 흐름

| 변환 지점 | 변환 위치 | 입력 형태 | 출력 형태 | 변환 규칙 |
|----------|----------|----------|----------|-----------|
| 요청→도메인 | BE 컨트롤러 | 헤더 + MDL-305{configCode,userKey} | 인증 주체·대상 특정 조건 | FN-004 인증·SEC-003-03 주체 검증·FN-005 형식 검증(저장 아님) |
| ENT→도메인 | BE 리포지토리(FN-019) | ENT-007 행(미수신 최신 1건) | MDL-303 | 직접 매핑·NULL(callback_received_at) 처리 |
| 도메인→ENT | BE(FN-018, 내부 PROC-403) | 대상 이력 + now | ENT-007 UPDATE | callback_received=true·callback_received_at, 조건절 가드(callback_received=false) |

> 응답→FE·도메인→응답 변환 지점은 본 프로세스에 없다(성공/실패 엔벨로프만, 데이터 페이로드 없음).

#### 단계 통합 흐름

| # | 레이어 | 단계명 | 직전 단계 출력 | 본 단계 처리 요지 | 다음 단계 입력 |
|---|--------|--------|--------------|----------------|---------------|
| 1 | BE | API 인증·주체 구분 | (서비스 B 콜백) | FN-004 자격·서명 검증 + SEC-003-03 서비스 B 자격 확인 | 인증 주체 |
| 2 | BE | 요청 제한 | 인증 주체 | FN-014 분당 60회 검사(scope='callback') | 통과 |
| 3 | BE | 입력 검증 | 통과 | FN-005 configCode·userKey 필수·형식·크기·주입 | MDL-305 |
| 4 | BE | 완료 기록(위임) | MDL-305 | 내부 PROC-403 완료 기록(FN-018): 미수신 최신 1건 UPDATE·재통지 멱등·미특정 404(BR-303) | 기록 결과 |
| 5 | BE | 응답 변환 | 기록 결과 | FN-015 성공 엔벨로프(완료/멱등 모두 200) | 응답 |

### 분기 및 예외 흐름

| 코드 | 발생 조건 | 처리 방향 | 결과 |
|------|----------|----------|------|
| BR-303 | 스코프 내 미수신 이력 존재 / 없음(완료 이력만 존재 — 재통지) | 존재 시 최신 1건에 완료 기록, 재통지는 상태 변경 없이 성공(멱등)·감사 | 완료 기록 / 멱등 성공(EXC-BIZ-10) |
| EX-SEC-003 | 인증 실패·서명 불일치·서비스 A 자격 사용 | 응답 차단, 감사(주체 구분) | 401 인증에 실패했습니다. |
| EX-OPS-001 | 분당 60회 초과 | 요청 거부, 감사 | 429 잠시 후 다시 시도해주세요. |
| EX-SEC-004 | 필수 항목 누락·허용 문자 위반·주입 패턴 | 콜백 거부 | 400 요청이 올바르지 않습니다. |
| EX-SEC-005 | 요청 본문 1MB 초과 | 요청 거부 | 413 요청이 너무 큽니다. |
| EX-BIZ-006 | 구성 미존재·사용자 키값 파라미터 미지정 구성·스코프 내 이력 없음(보관 만료 삭제·미기록 포함) | 콜백 실패 — 세 경우 구별 없이 단일 응답(존재 여부 비노출), 감사 | 404 통지 대상을 찾을 수 없습니다. |
| EX-FN-999 | 특정·기록 오류 | 롤백(진행 UPDATE), 오류 응답, 감사 | 500 잠시 후 다시 시도해주세요. |

> 재통지 콜백(스코프 내 미수신 이력 없음·완료 이력만 존재)은 오류(404)가 아니라 멱등 성공(200)으로 처리한다(BR-303·EXC-BIZ-10). 대상 미특정(구성 미존재·미지정·스코프 내 이력 자체 없음)만 404(EX-BIZ-006)다. 완료 콜백 수신은 연동이력에만 반영하고 처리상태 4항목을 변경하지 않는다(BIZ-004-06).

### 실행 결과

- **정상 결과(완료 기록)**: 대상 연동이력 1건 UPDATE(callback_received=true·callback_received_at). 콜백 수신 감사(CALLBACK_RECORDED, SUCCESS, userKey 마스킹). 200 성공 엔벨로프. 처리상태(ENT-004) 무변경.
- **정상 결과(재통지 멱등)**: 상태 변경 없이 200 성공. 멱등 감사(CALLBACK_IDEMPOTENT, INFO).
- **실패 결과**: EX-SEC-003(401)·EX-OPS-001(429)·EX-SEC-004(400)·EX-SEC-005(413)·EX-BIZ-006(404) 엔벨로프. 대상 미특정·인증 실패는 감사 기록.
- **후속 트리거**: 없음. 본 기록은 PROC-302(완료 확인)의 완료 판정 근거가 된다(후행 소비).

### 의존 프로세스

- **호출 관계**: PROC-403(동기, 완료 기록 진입 — FN-018_recordCompletionCallback). PROC-403 이 종착(persistence)이라 순환 없음.
- **선행 관계**: PROC-403 생성 진입(대상 연동이력 존재, PROC-201 진입 시 생성)·PROC-203(서비스 B 전달 페이로드로 구성 식별자·키값 회신 값 발신).
- **이벤트 관계**: 완료 기록 결과가 PROC-302 완료 확인 판정에 소비된다(요청 키값·스코프 참조로 연결).

### 구현 가이드

- 대상 특정 스코프({연동 구성 식별자 + 사용자 키값}·미수신 최신 건)는 완료 판정(PROC-302/FN-017)과 동일 정의를 FN-019 로 공유한다(BIZ-004 구현 가이드). 본 PROC 은 스코프 정의를 중복 구현하지 않고 내부 PROC-403(FN-018) 위임으로만 기록한다.
- 완료 기록은 연동이력 기록(PROC-403) 흐름으로 수행하고 처리상태 저장(PROC-401) 흐름과 분리를 유지한다 — 두 추적의 연결은 이력의 요청 키값 참조(DATA-005-04)만 사용하며, 처리상태 4항목을 갱신하는 어떤 문장도 두지 않는다(BIZ-004-06).
- 완료 기록 UPDATE 는 `WHERE ... AND callback_received=false` 로 동시성 가드를 두어 재통지·동시 콜백을 멱등하게 흡수한다(ROW_COUNT=0 → 멱등 성공). 감사·오류 응답에 전달받은 키값 원문을 남기지 않는다(SEC-005-01 마스킹). 인증은 서비스 B 자격만 통과시킨다(SEC-003-03 — 서비스 A 자격 거부).
- 콜백 미수신 건의 정리는 보관 배치(PROC-402/FN-011)의 연동 요청 일시 기산 삭제(DATA-006-02)로 처리하며, 별도 콜백 대기 타임아웃 정책은 MVP 범위 밖이다.
