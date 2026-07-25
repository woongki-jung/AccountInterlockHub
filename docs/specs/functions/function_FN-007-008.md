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
): TrackingLookup           // { branch: 'NONE' | 'OPEN' | 'FIXED', record: MDL-001 | null }
  throws 없음               // 대상 없음도 정상 판정 결과다
```

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | trackingKey | string | Y | 1~255자·공백만 불가 | 조회 조건. 변형하지 않는다 |
| 출력 | branch | string | - | `NONE`·`OPEN`·`FIXED` | 중복 수신 3분기(`BIZ-002-03` ①②③) |
| 출력 | record | MDL-001 \| null | - | `NONE` 이면 null | 파생 4종을 산출한 도메인 모델 |

### 처리 흐름 (의사코드)

```
1. 단건 조회 — ENT-001 기본 키
   SELECT tracking_key, result_code, result_at, result_confirmed_at,
          callback_received_at, created_at
   FROM tbl_interlock_tracking
   WHERE tracking_key = :trackingKey;

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
): TrackingSecureResult     // { branch, record: MDL-001, isCreated: boolean }
  throws RecordWriteError { code: EX-BIZ-003, http: 500 }
```

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | trackingKey | string | Y | 1~255자 | 본인확인 최초 성공으로 확보한 값 |
| 입력 | at | datetime | Y | 시간대 정보를 유지한다 | 지표 일자 산출 기준(`Asia/Seoul` 변환) |
| 출력 | branch | string | - | `OPEN`·`FIXED` | 확보 후 상태. `NONE` 은 반환되지 않는다 |
| 출력 | record | MDL-001 | - | - | 확보된 레코드 |
| 출력 | isCreated | boolean | - | - | 이번 호출에서 새로 만들었는지 여부(요청 수 계수 여부와 같다) |

### 처리 흐름 (의사코드)

```
1. 사전 조회 — FN-007
   lookup = FN-007(trackingKey)

2. 확정 상태면 그대로 반환 — POL BIZ-002-03 ③ · BIZ-002-04 (validate)
   if (lookup.branch == 'FIXED')
       return { branch: 'FIXED', record: lookup.record, isCreated: false }
       // 어떤 컬럼도 갱신하지 않는다 — 보관 기산점이 밀리지 않는다

3. 미확정 레코드가 있으면 이어쓰기 대상으로 반환 — POL BIZ-002-03 ② (validate)
   if (lookup.branch == 'OPEN')
       return { branch: 'OPEN', record: lookup.record, isCreated: false }
       // 새로고침·재진입·본인확인 재시도가 여기로 수렴한다

4. 신규 생성 — POL BIZ-002-01 (트랜잭션 시작)
   try
       INSERT INTO tbl_interlock_tracking (tracking_key) VALUES (:trackingKey);
   catch (기본 키 충돌)                      // 같은 키의 동시 진입
       lookup = FN-007(trackingKey)
       return { branch: lookup.branch, record: lookup.record, isCreated: false }
   catch (그 밖의 저장 실패)                 → throw EX-BIZ-003 (500)

5. 지표 요청 수 계수 — FN-013 · POL BIZ-005-02 ① (같은 트랜잭션 경계)
   FN-013({ kind: 'REQUEST', at })          // 실패 시 EX-BIZ-003 전파 → 4단계와 함께 되돌린다

6. 확보 결과 반환 (트랜잭션 종료)
   created = FN-007(trackingKey)
   return { branch: 'OPEN', record: created.record, isCreated: true }
```

### API 인터페이스

해당 없음 — 본인확인 제출 접점이 판정 통과 후 호출한다([`spec-functions-api-user.md`](spec-functions-api-user.md) §본인확인 제출).

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| 500 | `EX-BIZ-003` | 레코드 생성 실패·지표 계수 실패 등 내부 저장 오류 | "처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요." | **결과를 확정하지 않는다.** 같은 트랜잭션의 지표 갱신도 함께 되돌린다. 사용자는 다시 시도할 수 있다(`BIZ-003-04` 준용) |

### 의존 기능

| FN 코드 | 호출 시점 | 동기/비동기 | 실패 시 처리 |
|---------|----------|------------|--------------|
| FN-007 | 단계 1·4·6 | 동기 | 예외 없음 |
| FN-013 | 단계 5 | 동기 | `EX-BIZ-003` 전파(트랜잭션 되돌림) |

### 구현 가이드

- **기본 키 충돌을 정상 경로로 다룬다**([`data_ENT-001.md`](../datas/data_ENT-001.md) §구현 가이드). 같은 추적 키의 동시 진입에서 한쪽 삽입이 충돌하면 오류가 아니라 이어쓰기(②)로 수렴한다. 이 처리가 없으면 정상 재시도가 500 으로 끝난다.
- **레코드 생성과 요청 수 계수를 같은 트랜잭션 경계에 둔다**(`SVC-014` F-008). 경계가 갈리면 요청 수가 실제 레코드 수와 어긋난다.
- **추적 키를 알 수 없는 실패에는 이 기능을 호출하지 않는다**(`BIZ-002-02`). 진입 단계 구조 위반과 복호화 판정 3·4단계 실패는 레코드를 만들지 않고 지표만 계수한다(FN-013 `UNIDENTIFIED_FAILURE`).
- **보관 기간이 지나 삭제된 뒤 같은 키가 들어오면 새 레코드가 만들어진다**(EXC-BIZ-04). 허브가 유일성을 강제하지 않는다는 전제에서 수용한다(`DATA-004-02`).
- 레코드에 사용자 정보·암호값·복호화 원문을 담지 않는다 — 담을 컬럼이 스키마에 없는 것이 1차 방어다(`DATA-001-02`).
