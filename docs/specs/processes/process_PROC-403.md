# 연동이력 기록 기능 정의

## 개요

- **정의 대상**: 연동이력(ENT-007)의 생성·완료 기록을 담당하는 내부 데이터 처리 프로세스. **복호화 성공 후**(PROC-203)에 연동 추적 키·구성 참조·연동 요청 일시로 이력 1건을 생성(FN-016)하고, 완료 콜백(PROC-303)에서 연동 추적 키 스코프의 미수신 최신 이력 1건에 완료 콜백 수신 여부·수신 일시를 기록(FN-018)한다. 저장 항목을 연동 추적 키·구성 참조·연동 요청 일시·완료 콜백 수신 여부·수신 일시 5항목으로 한정하고, 처리 상태(ENT-004) 4항목은 어떤 경우에도 변경하지 않는다. 조회 키는 tracking_key(비유니크)이며 내부 surrogate uuid `id` 를 PK 로 둔다. 독립 엔드포인트가 없는 종착(persistence) 프로세스다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 8 "연동이력 저장: 연동 추적 키 기준으로 연동 요청~완료 콜백까지의 이력을 저장하고, 6의 API 제공 근거 데이터로 사용".

> **2026-07-11 `#214` 개정**: 생성 시점이 진입 시(구 PROC-201)에서 **복호화 성공 후(PROC-203)**로 이동했고, 저장 키가 구 {요청 키값·지정 사용자 키값 원문}에서 **연동 추적 키 단독**으로 전환됐다 — 회원 키·복호화 원문은 저장하지 않는다(6항목→5항목). 지정 파라미터 값 누락 거부(구 EX-BIZ-007)·미지정 구성 null 분기(구 BR-203)는 폐기됐다(추적 키 완결성은 복호화 단계 FN-020/EX-BIZ-008 에서 검증). 완료 콜백 대상 특정 스코프도 {구성+키값}에서 연동 추적 키 단독으로 전환됐다.

---

## PROC-403 연동이력 기록

### 기본 정보

| 항목 | 내용 |
|------|------|
| 프로세스명 | 연동이력 기록(생성·완료 기록) |
| 분류 | EVT |
| 그룹 | 상태 저장 |
| 트리거 유형 | 시스템 이벤트(PROC-203 복호화 후 생성 호출·PROC-303 완료 콜백 기록 호출) |
| 처리 방식 | 동기 |
| 우선순위 | 높음 |
| 관련 IA 항목 | BAT-03 |

### 관련 사양 코드

| 구분 | 코드 | 관계 설명 |
|------|------|----------|
| 서비스(SVC) | SVC-005(생성)·SVC-009(완료 기록) | 이력 생성·완료 기록 서비스 시나리오 |
| 정책(policy) | BIZ-004·DATA-005·DATA-002·DATA-001·SEC-005 | 기록·완료 판정·항목 상한·추적 키 불투명·마스킹 |
| 공통 기능(FN) | FN-016(연동이력 생성)·FN-018(완료 콜백 대상 특정·완료 기록)·FN-019(스코프 조회, FN-018 내부) | 호출 단위 로직(생성·완료 두 진입) |
| 데이터 모델(MDL) | MDL-303(연동이력)·MDL-202(연동 추적 키 — 생성)·MDL-305(완료 콜백 요청, 완료 기록) | 도메인·입력 모델 |
| DB 엔터티(ENT) | ENT-007(연동이력 — 생성 INSERT·완료 기록 UPDATE) | 저장·갱신 대상 |
| 화면(SCR) | (없음 — 내부 데이터 처리) | 대면 화면·엔드포인트 없음 |

### 진입점 및 진입 조건

- **진입점**: PROC-203 복호화 성공 후 생성 호출(`FN-016_createInterlockHistory`, 수신처 전달에 앞서) · PROC-303 완료 콜백 시 완료 기록 호출(`FN-018_recordCompletionCallback`, 콜백 대상 특정 후). 독립 엔드포인트 아님.
- **진입 조건**: 생성=복호화 성공으로 연동 추적 키 확보(FN-020) / 완료 기록=인증·검증 통과한 완료 콜백 수신.
- **사전 검증**: 생성 시 저장 항목 5종 상한·개인식별 컬럼 부재 보장(DATA-005-05/06) — 추적 키 완결성(비공백)은 FN-020 이 선검증(누락·공백 시 EX-BIZ-008 로 이미 거부). 완료 기록 시 대상 스코프 해석·미수신 최신 1건 특정(FN-018→FN-019).

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 설명 |
|------|--------|------------|------|------|
| 입력(생성) | trackingKey | string | Y | 복호화된 X 에서 추출·검증된 연동 추적 키(FN-020, MDL-202) |
| 입력(생성) | config | MDL-101 | Y | 활성 구성(접근 주소 참조 — config.id) |
| 입력(생성) | now | DateTime | Y | 연동 요청 일시(복호화 성공 시각, requested_at) |
| 입력(완료 기록) | callback | MDL-305 | Y | { trackingKey } — 대상 특정 조건(단독) |
| 입력(완료 기록) | now | DateTime | Y | 완료 콜백 수신 일시(callback_received_at) |
| 출력(생성) | history | MDL-303 | - | 생성 이력(내부 surrogate id 미노출) |
| 출력(완료 기록) | (void) | - | - | 완료 기록·멱등 성공 |

### 연관 데이터 및 외부 호출

- **호출 API**: 외부 호출 없음(DB 접근만).
- **데이터 조회 대상**: (완료 기록) ENT-007(IX_HISTORY_TRACKING 로 tracking_key 스코프 미수신 최신 1건 — FN-019 pendingOnly=true). `#214` 로 구성 실재·지정 여부 사전 검증(구 ENT-001 조회)은 폐기됐다(추적 키 단독 스코프).
- **데이터 변경 대상(CRUD)**: ENT-007 INSERT(생성 — 1건) / UPDATE(완료 기록 — 대상 이력 callback_received·callback_received_at). ENT-004(처리 상태) 미변경(BIZ-004-11). 감사는 각 호출 FN(FN-016·018)이 수행.

### 실행 제약사항

- **트랜잭션 경계**: 생성 INSERT·완료 기록 UPDATE 각각 단건 트랜잭션. 생성 INSERT 는 surrogate uuid PK 로 연동 요청 1건당 1행 저장(추적 키 재사용 수용, DATA-005-08). 완료 기록 UPDATE 는 surrogate `id` 대상 + `AND callback_received=false` 조건절 가드로 재통지·동시 콜백 멱등 흡수.
- **동시성 제어**: 생성=surrogate uuid PK(추적 키 재사용 시 스코프 내 다행 공존 허용). 완료 기록=조건절 가드(callback_received=false) ROW_COUNT 판정으로 최초 1회만 반영, 재통지·동시 콜백은 멱등 성공(BR-303).
- **성능 요구**: 단건 INSERT/UPDATE. 완료 기록 대상 특정은 IX_HISTORY_TRACKING(tracking_key, requested_at DESC) 미수신 최신 1건 조회. 별도 임계치 없음.
- **보안 요구**: 저장 항목 5종 상한·개인식별 컬럼·회원 키·복호화 원문 원천 배제(DATA-005-05/06). 추적 키는 불투명 원문 무변형 저장(DATA-005-07·DATA-002-06). 로그·감사의 추적 키는 앞2·뒤2 마스킹(SEC-005-04, FN-010). 수신 여부·수신 일시 정합은 DB CHECK 로 강제([ENT-007](../datas/data_ENT-007.md)).

### 로직 실행 순서

#### FE 측 처리 (의사코드)

```
해당 없음 — 연동이력 생성·완료 기록의 내부 데이터 처리 유닛으로 FE 처리 단계가 없다.
진입 응답·완료 콜백 응답(엔벨로프)은 호출 PROC(PROC-202→203·PROC-303)이 구성한다.
```

#### BE 측 처리 (의사코드)

```
H1. 이력 생성 — FN-016_createInterlockHistory(trackingKey, config, now)  (BIZ-004-07·DATA-005)  [PROC-203 호출, 복호화 성공 후]
  // 사전: 복호화 성공·추적 키 완결성(비공백)은 FN-020 이 완료(누락·공백 시 EX-BIZ-008 로 이미 거부)
  1) 이력 레코드 구성 (DATA-005-05/06/07) — 추적 키 원문 무변형(해석·해시·암복호화 금지):
        history = { trackingKey, configId: config.id, requestedAt: now,
                    callbackReceived: false, callbackReceivedAt: null }
        // 5항목 상한 — 회원 키·복호화 원문(X 내용)·개인식별 컬럼 없음(DATA-005-06)
  2) 영속화 (DATA-005-05/08):
        BEGIN;
          INSERT INTO TBL_INTERLOCK_HISTORY
            (id, tracking_key, config_id, requested_at, callback_received, callback_received_at, created_at)
          VALUES (gen_random_uuid(), :trackingKey, :config.id, :now, false, null, now());
          // surrogate uuid PK(id) — tracking_key 비유니크 조회 인덱스(IX_HISTORY_TRACKING). 연동 요청 1건당 1건. 수신 정합 CHECK 는 ENT-007
        COMMIT;
  3) 감사 (OPS-002·SEC-005-04):
        FN-013_writeAudit({ eventType:'HISTORY_CREATE', actorType:'SYSTEM',
                            target: FN-010_mask(trackingKey), result:'SUCCESS' })   // 추적 키 앞2·뒤2 마스킹
  4) return history   // 호출 PROC-203 은 수신처 전달(FN-012)로 계속 — 이력은 전달에 앞서 생성됨(BIZ-004-07)

H2. 완료 기록 — FN-018_recordCompletionCallback(callback, now)  (BIZ-004-09/11·DATA-005, BR-303)  [PROC-303 호출]
  1) 스코프 해석(미수신 최신) (BIZ-004-09):
        res = FN-019_resolveHistoryScope(callback.trackingKey, pendingOnly=true)
        // target = SELECT * FROM TBL_INTERLOCK_HISTORY
        //          WHERE tracking_key=:trackingKey AND callback_received=false
        //          ORDER BY requested_at DESC LIMIT 1;                 -- IX_HISTORY_TRACKING(미수신 최신)
        // anyInScope = target ? true : EXISTS(WHERE tracking_key=:trackingKey)   -- 재통지 멱등 판정용
  2) 대상 분기 (BR-303·EXC-BIZ-10):
        if (res.target is null):
             if (res.anyInScope) 감사(CALLBACK_IDEMPOTENT,INFO,추적 키 마스킹) → return   // 완료 이력만 존재 = 재통지 멱등 성공(EXC-BIZ-10)
             else                감사(CALLBACK_TARGET_MISS,FAIL,추적 키 마스킹) → throw CallbackTargetNotFoundError(404, EX-BIZ-006)
  3) 완료 기록 (BIZ-004-09·DATA-005):
        BEGIN;
          n = UPDATE TBL_INTERLOCK_HISTORY
              SET callback_received=true, callback_received_at=:now
              WHERE id=:res.target.id AND callback_received=false;   // surrogate id 대상·동시성 가드(ROW_COUNT)
        COMMIT;
        if (n = 0) 감사(CALLBACK_IDEMPOTENT,INFO) → return           // 동시 콜백이 먼저 기록 = 멱등 성공
        // 처리 상태(ENT-004) 4항목을 변경하는 어떤 문장도 두지 않는다(BIZ-004-11)
  4) 감사 (OPS-002·SEC-005-04):
        FN-013_writeAudit({ eventType:'CALLBACK_RECORDED', actorType:'SERVICE',
                            target: FN-010_mask(callback.trackingKey), result:'SUCCESS' })
  5) return   // 호출 PROC-303 은 성공 엔벨로프 200 응답
  정책 적용 지점: BIZ-004-07/09/11(생성·대상 특정·처리 상태 불변경), DATA-005-05~08(항목 상한·추적 키 원문·처리 상태 연결),
                 DATA-001-05(무저장 경계), DATA-002-06(불투명), SEC-005-04(마스킹)
```

#### 데이터 변환 흐름

| 변환 지점 | 변환 위치 | 입력 형태 | 출력 형태 | 변환 규칙 |
|----------|----------|----------|----------|-----------|
| 도메인→ENT(생성) | BE 리포지토리 | 추적 키·구성 참조 | ENT-007 행(INSERT) | id gen_random_uuid()·trackingKey 무변형·configId·requested_at, callback_received=false·callback_received_at=null |
| ENT→도메인(완료 기록) | BE 리포지토리(FN-019) | ENT-007 행(미수신 최신 1건) | MDL-303 | 직접 매핑·NULL 처리 |
| 도메인→ENT(완료 기록) | BE 리포지토리(FN-018) | 대상 이력 + now | ENT-007 UPDATE | callback_received=true·callback_received_at, surrogate id 대상·조건절 가드(callback_received=false) |

#### 단계 통합 흐름

| # | 레이어 | 단계명 | 직전 단계 출력 | 본 단계 처리 요지 | 다음 단계 입력 |
|---|--------|--------|--------------|----------------|---------------|
| 1 | BE | 이력 생성(호출 PROC-203) | 추적 키·구성 참조 | FN-016: INSERT 1건(복호화 후·전달에 앞서, surrogate PK·5항목) | 생성된 이력 |
| 2 | BE | 완료 기록(호출 PROC-303) | 완료 콜백 요청 | FN-018: 미수신 최신 1건 UPDATE(재통지 멱등, 미특정 404 EX-BIZ-006) | 완료 기록/멱등 |

> 두 진입은 서로 다른 호출 PROC(생성=PROC-203, 완료 기록=PROC-303)에서 독립 위임된다. 한 요청에서 생성·완료 기록이 연쇄하지 않는다(생성은 복호화 성공 시점, 완료 기록은 이후 콜백 시점). 처리 상태 저장(PROC-401)과 분리된 저장 흐름이며 연동 추적 키로만 연결한다(DATA-005-08·BIZ-004-11).

### 분기 및 예외 흐름

| 코드 | 발생 조건 | 처리 방향 | 결과 |
|------|----------|----------|------|
| BR-303 | (완료 기록) 스코프 내 미수신 이력 존재 / 없음(완료 이력만 존재) | 존재=최신 1건 UPDATE, 재통지=상태 변경 없이 멱등 성공 | 완료 기록 / 멱등 성공(EXC-BIZ-10) |
| EX-BIZ-006 | (완료 기록) 스코프 내 이력 없음 | 콜백 실패(단일 응답), 감사 | 404 통지 대상을 찾을 수 없습니다.(PROC-303 예외 표 등재) |
| EX-FN-999 | INSERT·UPDATE·조회 오류 | 롤백, 감사 | 500 잠시 후 다시 시도해주세요. |

> 재통지(BR-303, 완료 이력만 존재)는 오류가 아니라 멱등 성공이다. EX-BIZ-006 은 호출 PROC(PROC-303)의 예외 표로 전파되어 HTTP 응답이 된다 — 본 PROC 은 엔드포인트가 없다. `#214` 로 생성 단계의 지정 파라미터 값 누락 거부(구 EX-BIZ-007)·미지정 구성 null 분기(구 BR-203)는 결번이다(추적 키 완결성은 FN-020/EX-BIZ-008 검증).

### 실행 결과

- **정상 결과(생성)**: 이력 1건 INSERT(surrogate PK·tracking_key·callback_received=false·callback_received_at=null). HISTORY_CREATE 감사(추적 키 마스킹). 호출 PROC-203 로 이력 반환.
- **정상 결과(완료 기록)**: 미수신 최신 1건 UPDATE(callback_received=true·callback_received_at) 또는 재통지 멱등 성공. CALLBACK_RECORDED/CALLBACK_IDEMPOTENT 감사. 처리 상태(ENT-004) 무변경.
- **실패 결과**: EX-BIZ-006(완료 기록 대상 미특정)은 호출 PROC 로 전파, EX-FN-999(INSERT·UPDATE·조회 오류)는 트랜잭션 롤백.
- **후속 트리거**: 없음(종착 프로세스). 생성·완료 기록된 이력은 PROC-302 완료 확인 조회·PROC-402 보관 삭제 대상이 된다.

### 의존 프로세스

- **호출 관계**: 없음(FN-016·018·019·010·013 단위 로직만 수행). 어떤 PROC 도 호출하지 않는 종착 프로세스(순환 없음).
- **선행 관계**: 생성=PROC-203(복호화 성공·연동 추적 키 확보) / 완료 기록=PROC-303(인증·검증 통과한 완료 콜백)·생성 진입(대상 이력 존재).
- **이벤트 관계**: 없음(호출 PROC 가 응답을 구성). 완료 기록 결과는 PROC-302 완료 확인 판정에 소비된다.

### 구현 가이드

- 이력 생성은 처리 상태 저장(PROC-401)과 분리된 저장 흐름으로 수행하고, 두 추적의 연결은 연동 추적 키 공유로만 둔다(DATA-005-08·BIZ-004-11). 처리 상태(ENT-004)는 본 PROC 에서 생성·변경하지 않는다.
- 연동 추적 키는 복호화된 X 의 지정 필드에서 추출(FN-020)한 값을 원문 그대로 저장한다(해석·정규화·해시·암복호화 금지 — DATA-005-07·SEC-002). 값의 크기·형식은 진입 검증(FN-005)·복호화 완결성(FN-020)이 선행하며, 본 흐름은 추가 검증을 두지 않는다(정상 경로는 항상 유효 추적 키로 진입).
- 완료 기록 UPDATE 는 surrogate `id` 대상 + `AND callback_received=false` 로 동시성 가드를 두어 재통지·동시 콜백을 멱등하게 흡수한다(ROW_COUNT=0 → 멱등 성공). 처리 상태를 갱신하는 어떤 문장도 두지 않는다(BIZ-004-11).
- 연동 추적 키는 발송처 구성 값이라 유니크를 강제할 수 없어 내부 surrogate uuid `id` 를 PK 로, tracking_key 를 비유니크 조회 인덱스로 둔다 — 재사용 시 완료 판정·콜백 특정은 연동 요청 일시 최신 1건 규칙(EXC-BIZ-12)으로 단일화한다(FN-019). 전달 실패 건의 이력도 삭제하지 않고 미수신 상태로 남겨 보관 배치가 정리한다(EXC-BIZ-11). tracking_key 길이 상한(255)·수신 정합 CHECK 등 스키마 상세는 [ENT-007](../datas/data_ENT-007.md) 이 확정한다.
