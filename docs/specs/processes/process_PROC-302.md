# 연동 완료 확인 API 기능 정의

## 개요

- **정의 대상**: 서비스 A 가 {연동 구성 식별자 + 사용자 키값} 기준으로 서비스 B 의 정보연계 처리완료 여부를 확인하는 서버 대면 API 프로세스. 인증·요청 제한·입력 검증을 진입 가드로 선수행한 뒤, 완료 판정 단위 로직(FN-017)에 위임해 스코프 최신 이력 1건의 완료 콜백 수신 여부로 처리완료를 판정한다. 응답에는 완료 판정 3항목만 담고 지정 사용자 키값 원문·전달 파라미터는 포함하지 않으며, 연동이력·처리상태를 갱신하지 않는 읽기 전용 프로세스다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 6 "서비스 A가 그 키값 기준으로 서비스 B의 처리완료 여부를 확인하는 API" · [`../../prd/devspec/external-apis.md`](../../prd/devspec/external-apis.md) §4 연동 완료 확인 API. 2026-07-06 요구 추가(`accountinterlockhub#33`).

---

## PROC-302 연동 완료 확인 API

### 기본 정보

| 항목 | 내용 |
|------|------|
| 프로세스명 | 연동 완료 확인 API |
| 분류 | RR |
| 그룹 | 서비스 연동 API |
| 트리거 유형 | API 호출(서비스 A 서버) |
| 처리 방식 | 동기 |
| 우선순위 | 높음 |
| 관련 IA 항목 | API-02 |

### 관련 사양 코드

| 구분 | 코드 | 관계 설명 |
|------|------|----------|
| 서비스(SVC) | SVC-008 | 연동 완료 확인 API |
| 정책(policy) | SEC-003·OPS-001·SEC-004·BIZ-004·DATA-006·SEC-005 | API 인증(주체 분리)·요청 제한·입력 검증·완료 판정·삭제분 정합·응답 마스킹 |
| 공통 기능(FN) | FN-004(API 인증)·FN-014(요청 제한)·FN-005(입력 검증)·FN-017(완료 확인 판정)·FN-019(스코프 조회, FN-017 내부)·FN-010(감사 마스킹, FN-017 내부)·FN-013(감사, FN-017 내부)·FN-015(엔벨로프) | 호출 단위 로직 |
| 데이터 모델(MDL) | 요청 {configCode·userKey}(MDL 미채번 — MDL-305 와 동형)·MDL-303(연동이력 도메인)·MDL-304(완료 확인 응답) | 요청·도메인·응답 모델 |
| DB 엔터티(ENT) | ENT-007(연동이력)·ENT-001(구성 실재·지정 여부 사전 검증, FN-019 내부)·ENT-006(인증 실패 감사) | 조회·감사 대상(무갱신) |
| 화면(SCR) | (없음 — 서비스 A 서버 호출) | 대면 화면 없음 |

### 진입점 및 진입 조건

- **진입점**: `POST /api/interlock/completion`. 서비스 A 서버가 사전 공유 인증 수단으로 호출(지정 사용자 키값을 요청 본문에 담아 질의 문자열 로깅 노출을 피함 — SEC-005-01).
- **진입 조건**: FN-004 API 인증 통과(API 키 또는 서명 헤더, HTTPS 전제) + 인증 주체가 서비스 A 자격(SEC-003-03, 서비스 B 자격 거부).
- **사전 검증**: 인증(FN-004), 주체 구분(SEC-003-03), 요청 제한(FN-014 분당 60회, 인증 주체 기준), 조회 조건 필수·형식·크기·주입(FN-005 — configCode NotBlank·MaxLength(64), userKey NotBlank·MaxLength(512)).

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 설명 |
|------|--------|------------|------|------|
| 입력 | credential | string | Y | Authorization/API-Key 헤더 또는 서명(로그 배제) |
| 입력 | configCode | string | Y | 조회 조건 — 연동 구성 식별자(진입 계약과 동일 값) |
| 입력 | userKey | string | Y | 조회 조건 — 서비스 A 가 전달했던 지정 사용자 키값 |
| 출력 | response | MDL-304 | - | 완료 판정 3항목(isCompleted·callbackReceivedAt·requestedAt), 키값 원문·전달 파라미터 배제 |

### 연관 데이터 및 외부 호출

- **호출 API**: 외부 호출 없음(조회·판정만).
- **데이터 조회 대상**: ENT-007(IX_HISTORY_SCOPE 로 {config_id, user_key} 스코프 최신 1건 — FN-019 내부), ENT-001(config_code→config_id 변환·user_key_param_id 지정 여부 사전 검증 — FN-019 내부).
- **데이터 변경 대상(CRUD)**: 없음(읽기 전용 — 연동이력·처리상태 무갱신, BIZ-004 API-01 결과 확인 갱신과 다름). ENT-006 INSERT 는 인증 실패 감사(FN-004 내부)·조회 감사(FN-013, FN-017 내부)에 한함.

### 실행 제약사항

- **트랜잭션 경계**: 없음(단일 SELECT 조회·판정만, 영속화 없음). 인증 실패·조회 감사 로그는 append-only 별도 기록.
- **동시성 제어**: 읽기 전용·멱등 — 재조회 제한이 없다(BR-302 완료/미완료 둘 다 200). 동시 조회 간 경합 없음(락 미사용).
- **성능 요구**: 요청 제한 분당 60회 초과 시 429(FN-014, scope='completion'). 스코프 최신 1건은 IX_HISTORY_SCOPE(config_id, user_key, requested_at DESC)로 O(1) 근접 획득([ENT-007](../datas/data_ENT-007.md) §인덱스).
- **보안 요구**: API 인증·주체 분리(SEC-003-01/03), 응답 완료 판정 3항목만·키값 원문 필드 배제(SEC-005-03), 감사·오류 로그의 userKey 는 앞2·뒤2 마스킹(SEC-005-01, FN-010). 존재 여부 비노출(구성 미존재·미지정·이력 없음 단일 404, EXC-DATA-11).

### 로직 실행 순서

#### FE 측 처리 (의사코드)

```
해당 없음 — 서비스 A 서버 대면 API 로 허브 SPA(FE) 처리 단계가 없다.
호출 주체는 서비스 A 서버이며 사전 공유 인증 수단(API 키/서명)으로 요청한다.
응답 계약(성공 엔벨로프 { success, data: MDL-304 } / 실패 { success, error })은
FN-015 가 구성하며, 서비스 A 가 완료 판정 3항목을 소비한다.
```

#### BE 측 처리 (의사코드)

```
B1. API 인증·주체 구분 — FN-004_authenticateServiceApi(credential, requestBody, requestKey=null, now)  (SEC-003-01/03)
  엔드포인트: POST /api/interlock/completion (인증 가드 선적용)
  if (자격 누락·불일치·서명 불일치·시간창 초과):
        // 인증 실패 감사(API_AUTH_FAIL)는 FN-004 내부에서 기록(요청 키값 없음 → target 마스킹 대상 없음)
        → 401 EX-SEC-003
  caller = 인증된 호출 주체(요청 제한 주체 키)
  if (caller.actor != SERVICE_A):                    // 서비스 B 자격으로 API-02 호출 차단(SEC-003-03)
        FN-013_writeAudit({ eventType:'API_AUTH_FAIL', actorType:'SERVICE',
                            target: caller.id, result:'FAIL', detail:'wrong actor for completion' })
        → 401 EX-SEC-003

B2. 요청 제한 — FN-014_checkRateLimit(caller, 'completion', now, 60)  (OPS-001)
  초과 → 감사(RATE_LIMIT, BLOCKED) → 429 EX-OPS-001

B3. 입력 검증 — FN-005_validateInput(raw{configCode,userKey}, completionSchema, rawSize)  (SEC-004)
  본문 크기 > 1MB → 413 EX-SEC-005
  configCode: NotBlank, MaxLength(64) / userKey: NotBlank, MaxLength(512), 허용 문자·주입 패턴 위반 → 400 EX-SEC-004
  → dto = { configCode, userKey }

B4. 완료 판정(위임) — FN-017_checkCompletion(dto.configCode, dto.userKey)  (BIZ-004-04/05·BR-302, 읽기 전용)
  // FN-017 내부 구성(재서술 없이 위임):
  //   ① FN-019_resolveHistoryScope(configCode, userKey, pendingOnly=false)
  //        cfg = SELECT id, user_key_param_id FROM TBL_INTERLOCK_CONFIG
  //              WHERE config_code=:configCode AND deleted_at IS NULL;   -- 유효 구성만(UQ_CONFIG_CODE 부분)
  //        if (cfg is null OR cfg.user_key_param_id IS NULL) → eligible=false (미존재·미지정)
  //        target = SELECT * FROM TBL_INTERLOCK_HISTORY
  //                 WHERE config_id=:cfg.id AND user_key=:userKey
  //                 ORDER BY requested_at DESC LIMIT 1;                  -- IX_HISTORY_SCOPE
  //   ② if (!res.eligible OR res.target is null) → throw HistoryNotFoundError(404, EX-BIZ-005)  // 세 경우 단일화(EXC-DATA-11)
  //   ③ response = { isCompleted: target.callbackReceived,
  //                  callbackReceivedAt: target.callbackReceived ? iso8601(target.callbackReceivedAt) : null,
  //                  requestedAt: iso8601(target.requestedAt) }         // 수신=완료 / 미수신=미완료 둘 다 200(BR-302)
  //   ④ FN-013_writeAudit({ eventType:'COMPLETION_CHECK', actorType:'SERVICE', target: configCode,
  //                         result:'SUCCESS', detail:'userKey='+FN-010_mask(userKey)+', completed='+response.isCompleted })
  //   ⑤ return response(MDL-304)   // 지정 사용자 키값 원문·전달 파라미터·구성 내부 식별자 미포함(SEC-005-03)
  // 이력(ENT-007)·처리상태(ENT-004) 어떤 문장도 갱신하지 않는다(BIZ-004-06 정합, 읽기 전용)

B5. 응답 변환 — FN-015_ok(response)  (엔벨로프)
  응답: { success:true, data: response }   // MDL-304
  정책 적용 지점: SEC-003(인증·주체), OPS-001(제한), SEC-004(형식), BIZ-004-04/05(판정·지정 여부),
                 DATA-006/EXC-DATA-11(삭제·미기록 단일 404), SEC-005-03(응답 3항목)
```

#### 데이터 변환 흐름

| 변환 지점 | 변환 위치 | 입력 형태 | 출력 형태 | 변환 규칙 |
|----------|----------|----------|----------|-----------|
| 요청→도메인 | BE 컨트롤러 | 헤더 + {configCode,userKey} | 인증 주체·조회 스코프 | FN-004 인증·SEC-003-03 주체 검증·FN-005 형식 검증 |
| ENT→도메인 | BE 리포지토리(FN-019) | ENT-007 행(최신 1건) | MDL-303 | 직접 매핑·NULL(callback_received_at) 처리 |
| 도메인→응답 | BE(FN-017) | MDL-303 | MDL-304 | 완료 판정 3항목 선별·userKey·configId 배제·ISO8601 직렬화 |

> ENT→도메인·요청→도메인 외 변환 지점은 본 프로세스에 없다(무저장·무갱신, FE 미대면).

#### 단계 통합 흐름

| # | 레이어 | 단계명 | 직전 단계 출력 | 본 단계 처리 요지 | 다음 단계 입력 |
|---|--------|--------|--------------|----------------|---------------|
| 1 | BE | API 인증·주체 구분 | (서비스 A 호출) | FN-004 자격·서명 검증 + SEC-003-03 서비스 A 자격 확인 | 인증 주체 |
| 2 | BE | 요청 제한 | 인증 주체 | FN-014 분당 60회 검사(scope='completion') | 통과 |
| 3 | BE | 입력 검증 | 통과 | FN-005 configCode·userKey 필수·형식·크기·주입 | 조회 스코프 |
| 4 | BE | 완료 판정(위임) | 조회 스코프 | FN-017 스코프 최신 1건 판정(내부 FN-019·FN-010·FN-013), 미특정 404 | MDL-304 |
| 5 | BE | 응답 변환 | MDL-304 | FN-015 성공 엔벨로프 | 응답 |

### 분기 및 예외 흐름

| 코드 | 발생 조건 | 처리 방향 | 결과 |
|------|----------|----------|------|
| BR-302 | 스코프 최신 이력의 완료 콜백 수신 / 미수신 | 수신=처리완료(수신 일시 포함), 미수신=미완료 | 완료 또는 미완료 응답(둘 다 200) |
| EX-SEC-003 | 인증 실패·서명 불일치·서비스 B 자격 사용 | 응답 차단, 감사(주체 구분) | 401 인증에 실패했습니다. |
| EX-OPS-001 | 분당 60회 초과 | 요청 거부, 감사 | 429 잠시 후 다시 시도해주세요. |
| EX-SEC-004 | 필수 조건 누락·허용 문자 위반·주입 패턴 | 조회 거부 | 400 요청이 올바르지 않습니다. |
| EX-SEC-005 | 요청 본문 1MB 초과 | 요청 거부 | 413 요청이 너무 큽니다. |
| EX-BIZ-005 | 구성 미존재·사용자 키값 파라미터 미지정 구성·스코프 내 이력 없음(보관 만료 삭제·미기록 포함) | 조회 실패 — 세 경우 구별 없이 단일 응답(존재 여부 비노출) | 404 확인 대상을 찾을 수 없습니다. |
| EX-FN-999 | 조회·판정 오류 | 오류 응답, 감사 | 500 잠시 후 다시 시도해주세요. |

> 완료(isCompleted=true)와 미완료(false)는 모두 200 정상 응답이다(BR-302). 404(EX-BIZ-005)는 판정 대상 이력을 특정할 수 없을 때만 반환한다. 본 조회는 읽기 전용·멱등으로 재조회 제한이 없다.

### 실행 결과

- **정상 결과**: MDL-304 완료 판정 3항목(isCompleted·callbackReceivedAt·requestedAt) 응답. 연동이력·처리상태 영속화 무변경(읽기 전용). 조회 감사(COMPLETION_CHECK, SUCCESS, userKey 마스킹) 1건.
- **실패 결과**: EX-SEC-003(401)·EX-OPS-001(429)·EX-SEC-004(400)·EX-SEC-005(413)·EX-BIZ-005(404) 엔벨로프. 인증 실패·주체 불일치는 감사 기록.
- **후속 트리거**: 없음(읽기 전용 종단). 완료 판정 값의 기록원은 PROC-303(완료 콜백)이다.

### 의존 프로세스

- **호출 관계**: 없음(FN-004·014·005·017 단위 로직만 호출 — FN-017 이 내부에서 FN-019·010·013 을 조합). 어떤 PROC 도 호출하지 않는다.
- **선행 관계**: PROC-101(사용자 키값 파라미터 지정 활성 구성)·PROC-403 생성 진입(판정 대상 연동이력 존재)·PROC-303(완료 기록으로 isCompleted=true 값 확정).
- **이벤트 관계**: 없음.

### 구현 가이드

- 완료 판정 스코프({연동 구성 식별자 + 사용자 키값}·최신 건)는 콜백 대상 특정(PROC-303/FN-018)과 동일 정의를 FN-019 로 공유한다(BIZ-004 구현 가이드). 본 PROC 은 스코프 정의를 중복 구현하지 않고 FN-017 위임으로만 판정한다.
- 응답 DTO(MDL-304)에 userKey·parameters·configId 필드를 두지 않는다 — 마스킹 이전에 필드 자체를 배제한다(SEC-005-03). 감사·오류 로그의 키값은 FN-010 마스킹(앞2·뒤2)한다.
- 본 조회는 읽기 전용이다 — 이력·처리상태를 갱신하는 어떤 문장도 두지 않는다(API-01 의 결과 확인 갱신과 대비). 삭제된(또는 미기록) 이력의 조회는 404 로 응답하고 삭제 사실을 별도 보관하지 않는다(EXC-DATA-11).
- 인증 자격은 대면 주체별 분리 발급을 전제로 서비스 A 자격만 통과시킨다(SEC-003-03). 서비스 대면 API 인증 수단(API 키/서명 알고리즘)은 담당자 확정 대기이며 확정 시 SEC-003·FN-004 를 리비전한다. 자격 값은 상수 시간 비교로 검증하고 로그에 남기지 않는다.
