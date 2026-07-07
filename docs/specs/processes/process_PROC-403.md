# 연동이력 기록 기능 정의

## 개요

- **정의 대상**: 연동이력(ENT-007)의 생성·완료 기록을 담당하는 내부 데이터 처리 프로세스. 연동 요청 진입(PROC-201)에서 사용자 키값 파라미터가 지정된 구성의 이력 1건을 생성(FN-016)하고, 완료 콜백(PROC-303)에서 대상 이력 1건에 완료 콜백 수신 여부·수신 일시를 기록(FN-018)한다. 저장 항목을 지정 사용자 키값·구성 참조·요청 키값·연동 요청 일시·완료 콜백 수신 여부·수신 일시 6항목으로 한정하고, 처리상태(ENT-004) 4항목은 어떤 경우에도 변경하지 않는다. 처리상태 저장(PROC-401)과 분리된 저장 흐름으로, 두 추적의 연결은 요청 키값 참조로만 둔다. 독립 엔드포인트가 없는 종착(persistence) 프로세스다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 7 "연동이력 저장: 지정된 사용자 키값 파라미터 값을 기준으로 연동 요청~완료 콜백까지의 이력을 저장하고, 6의 API 제공 근거 데이터로 사용". 2026-07-06 요구 추가(`accountinterlockhub#33`).

---

## PROC-403 연동이력 기록

### 기본 정보

| 항목 | 내용 |
|------|------|
| 프로세스명 | 연동이력 기록(생성·완료 기록) |
| 분류 | EVT |
| 그룹 | 상태 저장 |
| 트리거 유형 | 시스템 이벤트(PROC-201 진입 생성 호출·PROC-303 완료 콜백 기록 호출) |
| 처리 방식 | 동기 |
| 우선순위 | 높음 |
| 관련 IA 항목 | BAT-03 |

### 관련 사양 코드

| 구분 | 코드 | 관계 설명 |
|------|------|----------|
| 서비스(SVC) | SVC-004(생성)·SVC-009(완료 기록) | 이력 생성·완료 기록 서비스 시나리오 |
| 정책(policy) | BIZ-004·DATA-005·DATA-001-01·SEC-005 | 기록·완료 판정·항목 상한·키값 원문 저장 예외·마스킹 |
| 공통 기능(FN) | FN-016(연동이력 생성)·FN-018(완료 콜백 대상 특정·완료 기록) | 호출 단위 로직(생성·완료 두 진입) |
| 데이터 모델(MDL) | MDL-303(연동이력)·MDL-201(진입 요청 — 지정 값 출처, 생성)·MDL-305(완료 콜백 요청, 완료 기록) | 도메인·입력 모델 |
| DB 엔터티(ENT) | ENT-007(연동이력 — 생성 INSERT·완료 기록 UPDATE) | 저장·갱신 대상 |
| 화면(SCR) | (없음 — 내부 데이터 처리) | 대면 화면·엔드포인트 없음 |

### 진입점 및 진입 조건

- **진입점**: PROC-201 진입 시 생성 호출(`FN-016_createInterlockHistory`, 지정 구성의 진입 처리 중) · PROC-303 완료 콜백 시 완료 기록 호출(`FN-018_recordCompletionCallback`, 콜백 대상 특정 후). 독립 엔드포인트 아님.
- **진입 조건**: 생성=사용자 키값 파라미터가 지정된 구성의 유효 진입(미지정 구성은 진입하되 이력 미생성) / 완료 기록=인증·검증 통과한 완료 콜백 수신.
- **사전 검증**: 생성 시 지정 파라미터 값 존재·비공백 검증(FN-016, 누락 시 400 EX-BIZ-007), 저장 항목 6종 상한·개인식별 컬럼 부재 보장(DATA-005-01/02). 완료 기록 시 대상 스코프 해석·미수신 최신 1건 특정(FN-018→FN-019).

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 설명 |
|------|--------|------------|------|------|
| 입력(생성) | config | MDL-101 | Y | 활성 구성 — userKeyParamId·parameters 정의 포함 |
| 입력(생성) | ctx | EntryContext | Y | 진입 컨텍스트(configCode·parameters — 지정 값 원천, 메모리 경유) |
| 입력(생성) | requestKey | string(UUID v4) | Y | 진입 시 발급된 요청 키값(이력 PK) |
| 입력(생성) | now | DateTime | Y | 연동 요청 일시(requested_at) |
| 입력(완료 기록) | callback | MDL-305 | Y | { configCode, userKey } — 대상 특정 조건 |
| 입력(완료 기록) | now | DateTime | Y | 완료 콜백 수신 일시(callback_received_at) |
| 출력(생성) | history | MDL-303 \| null | - | 생성 이력(지정 구성) / null(미지정 구성 미기록) |
| 출력(완료 기록) | (void) | - | - | 완료 기록·멱등 성공 |

### 연관 데이터 및 외부 호출

- **호출 API**: 외부 호출 없음(DB 접근만).
- **데이터 조회 대상**: (완료 기록) ENT-007(IX_HISTORY_SCOPE 로 {config_id, user_key} 미수신 최신 1건 — FN-019 pendingOnly=true)·ENT-001(config_code→config_id·user_key_param_id 지정 여부 사전 검증 — FN-019 내부).
- **데이터 변경 대상(CRUD)**: ENT-007 INSERT(생성 — 지정 구성 1건) / UPDATE(완료 기록 — 대상 이력 callback_received·callback_received_at). ENT-004(처리 상태) 미변경(BIZ-004-06). 감사는 각 호출 FN(FN-016·018)이 수행.

### 실행 제약사항

- **트랜잭션 경계**: 생성 INSERT·완료 기록 UPDATE 각각 단건 트랜잭션. 생성 INSERT 는 PK(request_key) 유니크로 연동 요청 1건당 최대 1건 보장(DATA-005-04). 완료 기록 UPDATE 는 `WHERE ... AND callback_received=false` 조건절 가드로 재통지·동시 콜백 멱등 흡수.
- **동시성 제어**: 생성=PK 유니크 충돌 방지(중복 진입은 감사 후 재발급 여부 build 확정). 완료 기록=조건절 가드(callback_received=false) ROW_COUNT 판정으로 최초 1회만 반영, 재통지·동시 콜백은 멱등 성공(BR-303).
- **성능 요구**: 단건 INSERT/UPDATE. 완료 기록 대상 특정은 IX_HISTORY_SCOPE 최신 1건 조회. 별도 임계치 없음.
- **보안 요구**: 지정 사용자 키값 원문 저장의 유일 예외 저장소(DATA-001-01·EXC-DATA-07)로 항목 6종 상한·개인식별 컬럼 원천 배제(DATA-005-01/02). 로그·감사의 userKey 는 앞2·뒤2 마스킹(SEC-005-01, FN-010). 수신 여부·수신 일시 정합은 DB CHECK 로 강제([ENT-007](../datas/data_ENT-007.md)).

### 로직 실행 순서

#### FE 측 처리 (의사코드)

```
해당 없음 — 연동이력 생성·완료 기록의 내부 데이터 처리 유닛으로 FE 처리 단계가 없다.
진입 응답·완료 콜백 응답(엔벨로프)은 호출 PROC(PROC-201·PROC-303)이 구성한다.
```

#### BE 측 처리 (의사코드)

```
H1. 이력 생성 — FN-016_createInterlockHistory(config, ctx, requestKey, now)  (BIZ-004-01/02·DATA-005, BR-203)  [PROC-201 호출]
  1) 지정 여부 확인 (BIZ-004-05·BIZ-001-07):
        if (config.userKeyParamId is null) → return null        // 미지정 구성: 이력 미기록(대상 밖)
  2) 지정 파라미터 값 추출·완결성 검증 (BIZ-004-02):
        designatedParam = config.parameters.find(p => p.id == config.userKeyParamId)   // user_key_param_id 매칭(구성당 정확히 1개 필수)
        userKey = ctx.parameters[designatedParam.name]
        if (userKey is null OR blank(userKey))
             → throw MissingUserKeyValueError (400, EX-BIZ-007)  // 진입 거부(이력 미생성, 부작용 없음)
  3) 이력 레코드 구성 (DATA-005-01/02/03) — 지정 사용자 키값 원문 무변형(해석·해시·암복호화 금지):
        history = { requestKey, configId: config.id, userKey,
                    requestedAt: now, callbackReceived: false, callbackReceivedAt: null }
        // 6항목 상한 — 전달 파라미터 원문·개인식별 컬럼 없음(DATA-005-02)
  4) 영속화 (DATA-005-04):
        BEGIN;
          INSERT INTO TBL_INTERLOCK_HISTORY
            (request_key, config_id, user_key, requested_at, callback_received, callback_received_at, created_at)
          VALUES (:requestKey, :config.id, :userKey, :now, false, null, now());
          // PK(request_key) 로 연동 요청 1건당 최대 1건. CHECK(length(user_key)>0)·수신 정합 CHECK 는 ENT-007
        COMMIT;
  5) 감사 (OPS-002·SEC-005-01):
        FN-013_writeAudit({ eventType:'HISTORY_CREATE', actorType:'SYSTEM', target: requestKey,
                            result:'SUCCESS', detail:'userKey='+FN-010_mask(userKey) })   // 원문 미기록
  6) return history   // 호출 PROC-201 은 진입 처리를 계속(요청 키값 응답 반환)

H2. 완료 기록 — FN-018_recordCompletionCallback(callback, now)  (BIZ-004-03/05/06·DATA-005, BR-303)  [PROC-303 호출]
  1) 스코프 해석(미수신 최신) (BIZ-004-03/05):
        res = FN-019_resolveHistoryScope(callback.configCode, callback.userKey, pendingOnly=true)
        // cfg = SELECT id, user_key_param_id FROM TBL_INTERLOCK_CONFIG WHERE config_code=:configCode AND deleted_at IS NULL;
        // eligible = (cfg != null AND cfg.user_key_param_id IS NOT NULL)
        // target   = SELECT * FROM TBL_INTERLOCK_HISTORY
        //            WHERE config_id=:cfg.id AND user_key=:userKey AND callback_received=false
        //            ORDER BY requested_at DESC LIMIT 1;                 -- IX_HISTORY_SCOPE
        // anyInScope = target ? true : EXISTS(스코프 내 이력)
  2) 대상 분기 (BR-303·EXC-BIZ-10):
        if (!res.eligible)                            // 구성 미존재·미지정
             감사(CALLBACK_TARGET_MISS,FAIL,userKey 마스킹) → throw CallbackTargetNotFoundError(404, EX-BIZ-006)
        if (res.target is null):
             if (res.anyInScope) 감사(CALLBACK_IDEMPOTENT,INFO) → return   // 완료 이력만 존재 = 재통지 멱등 성공(EXC-BIZ-10)
             else                감사(CALLBACK_TARGET_MISS,FAIL) → throw CallbackTargetNotFoundError(404, EX-BIZ-006)
  3) 완료 기록 (BIZ-004-03·DATA-005):
        BEGIN;
          n = UPDATE TBL_INTERLOCK_HISTORY
              SET callback_received=true, callback_received_at=:now
              WHERE request_key=:res.target.requestKey AND callback_received=false;   // 동시성 가드(ROW_COUNT)
        COMMIT;
        if (n = 0) 감사(CALLBACK_IDEMPOTENT,INFO) → return                // 동시 콜백이 먼저 기록 = 멱등 성공
        // 처리상태(ENT-004) 4항목을 변경하는 어떤 문장도 두지 않는다(BIZ-004-06)
  4) 감사 (OPS-002·SEC-005-01):
        FN-013_writeAudit({ eventType:'CALLBACK_RECORDED', actorType:'SERVICE', target: callback.configCode,
                            result:'SUCCESS', detail:'userKey='+FN-010_mask(callback.userKey)+', requestKey='+res.target.requestKey })
  5) return   // 호출 PROC-303 은 성공 엔벨로프 200 응답
  정책 적용 지점: BIZ-004-01/02/03/05/06(생성·값 완결성·대상 특정·지정 여부·처리상태 불변경),
                 DATA-005-01~04(항목 상한·키값 원문·요청 키값 연결), DATA-001-01·EXC-DATA-07(무저장 예외), SEC-005-01(마스킹)
```

#### 데이터 변환 흐름

| 변환 지점 | 변환 위치 | 입력 형태 | 출력 형태 | 변환 규칙 |
|----------|----------|----------|----------|-----------|
| 요청→도메인(생성) | BE(FN-016) | MDL-201 진입 컨텍스트 | userKey(지정 값) | 지정 파라미터 값 원문 추출(해석·변형 금지, DATA-005-03), 완결성 검증 |
| 도메인→ENT(생성) | BE 리포지토리 | MDL-303 | ENT-007 행(INSERT) | requestKey·configId·userKey·requested_at, callback_received=false·callback_received_at=null |
| ENT→도메인(완료 기록) | BE 리포지토리(FN-019) | ENT-007 행(미수신 최신 1건) | MDL-303 | 직접 매핑·NULL 처리 |
| 도메인→ENT(완료 기록) | BE 리포지토리(FN-018) | 대상 이력 + now | ENT-007 UPDATE | callback_received=true·callback_received_at, 조건절 가드(callback_received=false) |

#### 단계 통합 흐름

| # | 레이어 | 단계명 | 직전 단계 출력 | 본 단계 처리 요지 | 다음 단계 입력 |
|---|--------|--------|--------------|----------------|---------------|
| 1 | BE | 이력 생성(호출 PROC-201) | 진입 컨텍스트·요청 키값 | FN-016: 지정 여부·값 완결성 검증 후 INSERT 1건(미지정=null, 값 누락=400 EX-BIZ-007) | 생성된 이력/null |
| 2 | BE | 완료 기록(호출 PROC-303) | 완료 콜백 요청 | FN-018: 미수신 최신 1건 UPDATE(재통지 멱등, 미특정 404 EX-BIZ-006) | 완료 기록/멱등 |

> 두 진입은 서로 다른 호출 PROC(생성=PROC-201, 완료 기록=PROC-303)에서 독립 위임된다. 한 요청에서 생성·완료 기록이 연쇄하지 않는다(생성은 연동 요청 진입 시점, 완료 기록은 이후 콜백 시점). 처리상태 저장(PROC-401)과 분리된 저장 흐름이며 요청 키값 참조로만 연결한다(DATA-005-04·BIZ-004-06).

### 분기 및 예외 흐름

| 코드 | 발생 조건 | 처리 방향 | 결과 |
|------|----------|----------|------|
| BR-203 | (생성) 구성의 사용자 키값 파라미터 지정 / 미지정 | 지정=값 검증·이력 생성, 미지정=null 반환(미기록) | 이력 기록 / 미기록 |
| BR-303 | (완료 기록) 스코프 내 미수신 이력 존재 / 없음(완료 이력만 존재) | 존재=최신 1건 UPDATE, 재통지=상태 변경 없이 멱등 성공 | 완료 기록 / 멱등 성공(EXC-BIZ-10) |
| EX-BIZ-007 | (생성) 지정 구성 진입의 지정 파라미터 값 누락·공백 | 진입 거부(이력 미생성, 부작용 없음) | 400 연동에 필요한 값이 누락되었습니다.(PROC-201 예외 표 등재) |
| EX-BIZ-006 | (완료 기록) 구성 미존재·미지정·스코프 내 이력 없음 | 콜백 실패(단일 응답), 감사 | 404 통지 대상을 찾을 수 없습니다.(PROC-303 예외 표 등재) |
| EX-FN-999 | INSERT·UPDATE·조회 오류 | 롤백, 감사 | 500 잠시 후 다시 시도해주세요. |

> 미지정 구성(BR-203)은 예외가 아니라 null 반환(정상 진입, 이력 미기록)이다. 재통지(BR-303)는 오류가 아니라 멱등 성공이다. EX-BIZ-007·EX-BIZ-006 은 각각 호출 PROC(PROC-201·PROC-303)의 예외 표로 전파되어 HTTP 응답이 된다 — 본 PROC 은 엔드포인트가 없다.

### 실행 결과

- **정상 결과(생성)**: 지정 구성 이력 1건 INSERT(callback_received=false·callback_received_at=null). HISTORY_CREATE 감사(userKey 마스킹). 호출 PROC-201 로 이력/null 반환. 미지정 구성은 null(미기록).
- **정상 결과(완료 기록)**: 미수신 최신 1건 UPDATE(callback_received=true·callback_received_at) 또는 재통지 멱등 성공. CALLBACK_RECORDED/CALLBACK_IDEMPOTENT 감사. 처리상태(ENT-004) 무변경.
- **실패 결과**: EX-BIZ-007(생성 값 누락)·EX-BIZ-006(완료 기록 대상 미특정)은 호출 PROC 로 전파, EX-FN-999(INSERT·UPDATE·조회 오류)는 트랜잭션 롤백.
- **후속 트리거**: 없음(종착 프로세스). 생성·완료 기록된 이력은 PROC-302 완료 확인 조회·PROC-402 보관 삭제 대상이 된다.

### 의존 프로세스

- **호출 관계**: 없음(FN-016·018·019·010·013 단위 로직만 수행). 어떤 PROC 도 호출하지 않는 종착 프로세스(순환 없음).
- **선행 관계**: 생성=PROC-201(지정 구성의 유효 진입·요청 키값 발급) / 완료 기록=PROC-303(인증·검증 통과한 완료 콜백)·생성 진입(대상 이력 존재).
- **이벤트 관계**: 없음(호출 PROC 가 응답을 구성). 완료 기록 결과는 PROC-302 완료 확인 판정에 소비된다.

### 구현 가이드

- 이력 생성은 처리상태 저장(PROC-401)과 분리된 저장 흐름으로 수행하고, 두 추적의 연결은 요청 키값 참조로만 둔다(DATA-005-04·BIZ-004-06). 처리상태(ENT-004)는 본 PROC 에서 생성·변경하지 않는다.
- 지정 사용자 키값은 지정 파라미터의 값을 원문 그대로 저장한다(해석·정규화·해시·암복호화 금지 — DATA-005-03·SEC-002). 값의 크기·형식·주입 방어는 진입 검증(FN-005 SEC-004)이 선행하며, 본 흐름은 완결성(존재·비공백)만 추가 검증한다.
- 완료 기록 UPDATE 는 `WHERE ... AND callback_received=false` 로 동시성 가드를 두어 재통지·동시 콜백을 멱등하게 흡수한다(ROW_COUNT=0 → 멱등 성공). 처리상태를 갱신하는 어떤 문장도 두지 않는다(BIZ-004-06).
- request_key 는 진입 시 발급된 UUID v4 값을 그대로 PK 로 쓴다(DB 기본값 미설정, ENT-004 와 동일). user_key 길이 상한(512)·수신 정합 CHECK 등 스키마 상세는 [ENT-007](../datas/data_ENT-007.md) 이 확정한다.
