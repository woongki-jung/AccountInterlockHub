# 추적 레코드 확보 기능 정의 (FN-007 ~ FN-008)

정본 목록은 [`spec-functions.md`](spec-functions.md). 용어는 [`../../../wiki/WIKI.md`](../../../wiki/WIKI.md).

## 개요

- **기능 목적**: 같은 연동 추적 키가 다시 들어왔을 때 **새로 만들지·이어 쓸지·확정 결과를 그대로 돌려줄지**를 한 곳에서 판정한다. 이 분기가 흩어지면 확정된 결과가 덮여 발송처가 다른 연동의 결과를 보게 된다.
- **관련 PRD 요구사항**:
	- [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 9 — "연동 추적 키 기준 **단일 추적 레코드**를 **사용자가 진입한 시점에 생성**하고 …"
	- [`../../prd/devspec/database.md`](../../prd/devspec/database.md) §추적 키 중복 수신 — "① 같은 키의 레코드가 없다 … ② 결과가 아직 확정되지 않았다 … ③ 결과가 이미 확정됐다."

---

## FN-007 추적 레코드 사전 조회·3분기 판정

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | 추적 레코드 사전 조회·3분기 판정 |
| 분류 | DAT |
| 사용 서비스 | SVC-002 · SVC-010 · SVC-011 · SVC-012 · SVC-014 |
| 호출 PROC | PROC-102 · PROC-201 · PROC-202 · PROC-203 · PROC-301 |
| 연관 정책 | `BIZ-002-03` · `BIZ-002-05` · `BIZ-001-04` · `DATA-002-05` · `DATA-004-01` |
| 참조 데이터 | [`ENT-001`](../datas/data_ENT-001.md) · [`MDL-001`](../datas/model_MDL-001.md) |
| 관련 IA 항목 | `BAT-04` |

### 시그니처

```
function FN-007 (
  trackingKey: string,      // FN-006 판정을 통과한 값·필수
  exec?: TxExecutor,        // 선택 — 호출측이 연 트랜잭션의 실행 문맥(커넥션·실행자).
                            //   주면 그 경계 안에서 조회하고, 없으면 단독 읽기로 실행한다
): TrackingLookup           // { branch: 'NONE' | 'OPEN' | 'FIXED', record: MDL-001 | null }
  throws 없음               // 대상 없음도 정상 판정 결과다
```

- **트랜잭션 안에서 부를 때는 `exec` 를 반드시 넘긴다.** 생략하면 별도 커넥션으로 조회해 **같은 경계의 미커밋 변경이 보이지 않고**, 호출측과 커넥션을 둘 점유한다. 본 기능은 트랜잭션을 열지도 닫지도 않는다.

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | trackingKey | string | Y | 1~255자·공백만 불가 | 조회 조건. 변형하지 않는다 |
| 입력 | exec | TxExecutor | N | 호출측 트랜잭션의 커넥션·실행자 | 트랜잭션 안에서 부를 때 전달한다. 커넥션을 스스로 얻지 않는다 |
| 출력 | branch | string | - | `NONE`·`OPEN`·`FIXED` | 중복 수신 3분기(`BIZ-002-03` ①②③) |
| 출력 | record | MDL-001 \| null | - | `NONE` 이면 null | 파생 4종을 산출한 도메인 모델 |

### 처리 흐름 (의사코드)

```
1. 단건 조회 — ENT-001 기본 키
   SELECT tracking_key, result_code, result_at, result_confirmed_at,
          callback_received_at, created_at
   FROM tbl_interlock_tracking
   WHERE tracking_key = :trackingKey;
   -- exec 가 주어지면 그 실행자 위에서 수행한다 (같은 경계의 변경이 보인다)

2. 없음 판정 — POL BIZ-002-03 ① · BIZ-002-05 (validate)
   if (조회 행 수 == 0)
       return { branch: 'NONE', record: null }
       // 미진입과 보관 만료 삭제를 구별하지 않는다 (POL DATA-002-05)

3. 도메인 변환 — ENT-001 행 → MDL-001 (transform)
   record.trackingKey        = 행.tracking_key            // 무변형 (POL DATA-004-01)
   record.resultCode         = 행.result_code
   record.resultAt           = 행.result_at
   record.resultConfirmedAt  = 행.result_confirmed_at
   record.callbackReceivedAt = 행.callback_received_at
   record.createdAt          = 행.created_at
   record.isResultFixed      = (행.result_code != NULL)
   record.isSuccess          = (행.result_code == NULL ? null : 행.result_code == 'SUCCESS')
   record.isResultConfirmed  = (행.result_confirmed_at != NULL)
   record.isCallbackReceived = (행.callback_received_at != NULL)

4. 확정 여부 판정 — POL BIZ-002-03 ②③ · BIZ-001-04 (validate)
   if (record.isResultFixed)  return { branch: 'FIXED', record }
   else                       return { branch: 'OPEN',  record }
```

### API 인터페이스

해당 없음 — 조회 결과를 소비하는 접점은 [`spec-functions-api-server.md`](spec-functions-api-server.md) §서버 대면 API 3종이 정의한다.

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| — | — | 없음 | — | 본 기능은 예외를 던지지 않는다. `branch = 'NONE'` 을 404 `EX-DATA-001` 로 바꿀지는 호출측(조회·통지 접점)이 정한다(`BIZ-002-05`) |

### 의존 기능

없음.

### 구현 가이드

- **파생 4종은 읽기 전용으로 노출한다**([`model_MDL-001.md`](../datas/model_MDL-001.md) §구현 가이드). 저장 컬럼이 없으므로 쓰기 가능하게 두면 저장 값과 어긋난 상태가 만들어진다.
- **"결과 확정" 판정은 결과 구분 값의 존재 여부로만 한다**(`BIZ-002` 구현 가이드). 처리 일시·결과 확인 여부를 함께 보고 판단하지 않는다.
- 조회는 기본 키 단건 조회 하나뿐이다. 부분 일치·정렬·다건 조회 경로를 만들지 않는다([`spec-datas.md`](../datas/spec-datas.md) §인덱스 전략).
- 조회 자체는 어떤 컬럼도 갱신하지 않는다. 결과 확인 표시는 FN-010 이, 콜백 기록은 FN-011 이 따로 수행한다.
- **커넥션을 스스로 얻지 않는다.** 트랜잭션 안에서 불릴 때 `exec` 를 쓰지 않고 새 커넥션을 잡으면, 같은 경계에서 직전에 넣은 행이 보이지 않아 조회가 빈 결과로 끝나고 호출측 경계와 커넥션을 이중 점유해 풀이 마른다.

---

## FN-008 추적 레코드 확보

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | 추적 레코드 확보(생성·이어쓰기) |
| 분류 | DAT |
| 사용 서비스 | SVC-002 · SVC-014 |
| 호출 PROC | PROC-102 · PROC-301 |
| 연관 정책 | `BIZ-002-01` · `BIZ-002-02` · `BIZ-002-03` · `BIZ-002-04` · `BIZ-005-02` · `DATA-004-02` · `DATA-001-02` |
| 참조 데이터 | [`ENT-001`](../datas/data_ENT-001.md) · [`MDL-001`](../datas/model_MDL-001.md) · [`MDL-003`](../datas/model_MDL-003.md) |
| 관련 IA 항목 | `BAT-04` · `USR-03` |

### 시그니처

```
function FN-008 (
  trackingKey: string,      // 복호화 판정 4단계를 통과해 얻은 추적 키·필수
  at: datetime,             // 계기 발생 시각(지표 일자 산출 기준)·필수
  exec: TxExecutor,         // 호출측이 연 트랜잭션의 실행 문맥(커넥션·실행자)·필수
): TrackingSecureResult     // { branch, record: MDL-001, isCreated: boolean }
  throws RecordWriteError { code: EX-BIZ-003, http: 500 }
```

- **실행 문맥은 호출측이 넘긴다.** 호출측 트랜잭션에 참여하려면 **같은 커넥션·실행자**를 받아야 하므로 `exec` 는 필수 인자다 — 본 기능의 모든 문(INSERT·SELECT)과 하위 호출(FN-007·FN-013)을 이 위에서 실행한다. 스스로 커넥션을 얻으면 호출측 경계 **밖**의 별도 커넥션을 잡아 같은 경계의 변경이 보이지 않고, 요청 하나가 커넥션을 둘 점유해 풀이 마른다.
- **본 기능은 트랜잭션을 열지도 닫지도 않는다.** `BEGIN`·`COMMIT`·`ROLLBACK` 을 수행하지 않으며 커밋·되돌림 권한이 없다([`../processes/process_PROC-301.md`](../processes/process_PROC-301.md) §실행 제약사항). **경계는 호출측이 반드시 연다** — 사용자 제출 접점의 상위 프로세스([`PROC-102`](../processes/process_PROC-102.md) `B6` · [`PROC-103`](../processes/process_PROC-103.md) `B3`)가 그 자리이고 `PROC-301` 은 그 경계에 참여만 한다. 경계 없이 호출되면 레코드 기록과 지표 계수가 각각 커밋돼 `SVC-014` F-008 의 원자성이 깨지므로, **경계 밖 호출은 사양 위반**이다.

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | trackingKey | string | Y | 1~255자 | 본인확인 최초 성공으로 확보한 값 |
| 입력 | at | datetime | Y | 시간대 정보를 유지한다 | 지표 일자 산출 기준(`Asia/Seoul` 변환) |
| 입력 | exec | TxExecutor | Y | 호출측이 연 트랜잭션의 커넥션·실행자 | 커넥션을 스스로 얻지 않는다. 커밋·되돌림을 수행하지 않는다 |
| 출력 | branch | string | - | `OPEN`·`FIXED` | 확보 후 상태. `NONE` 은 반환되지 않는다 |
| 출력 | record | MDL-001 | - | - | 확보된 레코드 |
| 출력 | isCreated | boolean | - | - | 이번 호출에서 새로 만들었는지 여부(요청 수 계수 여부와 같다) |

### 처리 흐름 (의사코드)

```
1. 사전 조회 — FN-007
   lookup = FN-007(trackingKey, exec)

2. 확정 상태면 그대로 반환 — POL BIZ-002-03 ③ · BIZ-002-04 (validate)
   if (lookup.branch == 'FIXED')
       return { branch: 'FIXED', record: lookup.record, isCreated: false }
       // 어떤 컬럼도 갱신하지 않는다 — 보관 기산점이 밀리지 않는다

3. 미확정 레코드가 있으면 이어쓰기 대상으로 반환 — POL BIZ-002-03 ② (validate)
   if (lookup.branch == 'OPEN')
       return { branch: 'OPEN', record: lookup.record, isCreated: false }
       // 새로고침·재진입·본인확인 재시도가 여기로 수렴한다

4. 신규 생성 — POL BIZ-002-01 (호출측 트랜잭션에 참여 — 새로 열지 않는다)
   INSERT INTO tbl_interlock_tracking (tracking_key)
   VALUES (:trackingKey)
   ON CONFLICT (tracking_key) DO NOTHING     -- 기본 키 충돌을 오류로 만들지 않는다
   RETURNING tracking_key;
   -- result_code·result_at·result_confirmed_at·callback_received_at 은 NULL
   -- created_at 은 기본값 now()
   실행 실패(충돌 외의 제약 위반·연결 오류)  → throw EX-BIZ-003 (500)

   inserted = (반환 행 수 == 1)              // isCreated 판정 — 반환 행의 유무가 곧 생성 여부다
   if (!inserted)                            // 반환 행 없음 = 같은 키의 동시 진입(충돌)
       lookup = FN-007(trackingKey, exec)    // 오류가 없어 경계가 살아 있다 — 그대로 이어 조회한다
       return { branch: lookup.branch, record: lookup.record, isCreated: false }

5. 지표 요청 수 계수 — FN-013 · POL BIZ-005-02 ① (같은 트랜잭션 경계)
   FN-013({ kind: 'REQUEST', at })           // exec 와 같은 실행 문맥에서 수행한다
                                             // 실패 시 EX-BIZ-003 전파 → 4단계와 함께 되돌아간다

6. 확보 결과 반환 (커밋하지 않는다 — 경계를 닫는 것은 호출측이다)
   created = FN-007(trackingKey, exec)
   return { branch: 'OPEN', record: created.record, isCreated: inserted }   // 이 경로는 항상 true
```

### API 인터페이스

해당 없음 — 본인확인 제출 접점이 판정 통과 후 호출한다([`spec-functions-api-user.md`](spec-functions-api-user.md) §본인확인 제출).

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| 500 | `EX-BIZ-003` | 레코드 생성 실패·지표 계수 실패 등 내부 저장 오류 (**기본 키 충돌은 여기 해당하지 않는다** — 단계 4 가 정상 경로로 흡수한다) | "처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요." | **결과를 확정하지 않는다.** 본 기능은 되돌리지 않고 예외만 올린다 — **되돌림은 경계를 연 호출측**이 수행하며 같은 경계의 지표 갱신도 함께 취소된다. 사용자는 다시 시도할 수 있다(`BIZ-003-04` 준용) |

### 의존 기능

| FN 코드 | 호출 시점 | 동기/비동기 | 실패 시 처리 |
|---------|----------|------------|--------------|
| FN-007 | 단계 1·4·6 | 동기 | 예외 없음 |
| FN-013 | 단계 5 | 동기 | `EX-BIZ-003` 전파(호출측이 경계를 되돌린다) |

- 두 호출 모두 **`exec` 와 같은 실행 문맥**에서 수행한다. 하나라도 다른 커넥션에서 실행되면 단계 4~5 가 한 경계로 묶이지 않는다.

### 구현 가이드

- **기본 키 충돌을 `ON CONFLICT (tracking_key) DO NOTHING` 으로 흡수한다**([`data_ENT-001.md`](../datas/data_ENT-001.md) §구현 가이드 — 유일 제약은 `tracking_key` 기본 키 하나뿐이다). 충돌이 오류로 올라오지 않아 경계가 살아 있고, **반환 행의 유무가 곧 `isCreated`** 다. 같은 추적 키의 동시 진입은 오류가 아니라 이어쓰기(②)로 수렴한다 — 이 처리가 없으면 정상 재시도가 500 으로 끝난다.
- **충돌을 예외로 잡아 같은 트랜잭션에서 재조회하는 형태를 쓰지 않는다.** 트랜잭션 안에서 문 하나가 오류로 끝나면 그 트랜잭션은 중단 상태가 되어, 되감기 전에는 뒤따르는 조회가 **아예 실행되지 않는다.** `SAVEPOINT` 로 되감는 방식도 쓰지 않는다 — 삽입마다 하위 경계가 하나 더 생겨 호출측 경계와 겹친다. **트랜잭션 밖에서 재조회하는 방식**도 쓰지 않는다 — 레코드 기록과 지표 계수의 원자성이 깨진다(`SVC-014` F-008).
- **충돌 뒤의 재조회는 같은 경계에서 성립한다.** 기본 격리 수준(`READ COMMITTED`)은 문마다 새 스냅샷을 보므로, 먼저 커밋된 상대 요청의 행이 이어지는 조회에 보인다. 격리 수준을 그 위로 올리면 이 재조회가 성립하지 않으므로 올리지 않는다.
- **레코드 생성과 요청 수 계수를 같은 트랜잭션 경계에 둔다**(`SVC-014` F-008). 경계가 갈리면 요청 수가 실제 레코드 수와 어긋난다. **그 경계는 호출측이 열고 닫는다** — 본 기능은 `exec` 로 받은 실행자 위에서 실행만 한다(§시그니처).
- **추적 키를 알 수 없는 실패에는 이 기능을 호출하지 않는다**(`BIZ-002-02`). 진입 단계 구조 위반과 복호화 판정 3·4단계 실패는 레코드를 만들지 않고 지표만 계수한다(FN-013 `UNIDENTIFIED_FAILURE`).
- **보관 기간이 지나 삭제된 뒤 같은 키가 들어오면 새 레코드가 만들어진다**(EXC-BIZ-04). 허브가 유일성을 강제하지 않는다는 전제에서 수용한다(`DATA-004-02`).
- 레코드에 사용자 정보·암호값·복호화 원문을 담지 않는다 — 담을 컬럼이 스키마에 없는 것이 1차 방어다(`DATA-001-02`).
