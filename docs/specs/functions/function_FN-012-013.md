# 증적·집계 기록 기능 정의 (FN-012 ~ FN-013)

정본 목록은 [`spec-functions.md`](spec-functions.md). 용어는 [`../../../wiki/WIKI.md`](../../../wiki/WIKI.md).

## 개요

- **기능 목적**: 추적 레코드 밖의 두 저장 대상에 기록하는 기능이다 — **동의 증적**(사후 입증)과 **연동 지표 집계**(삭제 이후에도 남는 건수). 둘 다 추적 레코드와 같은 처리 경계에서 갱신돼야 정합이 유지된다.
- **관련 PRD 요구사항**:
	- [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 10 — "**동의 증적 기록**: 사용자가 **어느 시점의 어떤 동의 항목에 동의했는지**를 개인정보 없이 남긴다."
	- [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 11 — "**연동 지표 집계**: 일자 단위 요청·성공·실패 건수만 누적한다."

---

## FN-012 동의 증적 기록

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | 동의 증적 기록 |
| 분류 | DAT |
| 사용 서비스 | SVC-003 · SVC-015 |
| 호출 PROC | PROC-103 · PROC-302 |
| 연관 정책 | `DATA-003-02` · `DATA-003-03` · `DATA-003-04` · `DATA-003-05` · `BIZ-003-04` · `DATA-004-01` |
| 참조 데이터 | [`ENT-002`](../datas/data_ENT-002.md) · [`MDL-002`](../datas/model_MDL-002.md) · [`MDL-007`](../datas/model_MDL-007-010.md) · [`MDL-008`](../datas/model_MDL-007-010.md) |
| 관련 IA 항목 | `BAT-05` · `USR-04` |

### 시그니처

```
function FN-012 (
  trackingKey: string,      // 확보된 레코드의 추적 키·필수
  submission: MDL-007,      // 동의·승인 제출·필수(속성은 agreedItemCodes 하나뿐)
  consent: MDL-008,         // 기동 시 파싱한 동의 항목 구성·필수
  at: datetime,             // 승인 확정 시각·필수
  exec: TxExecutor,         // 호출측이 연 트랜잭션의 실행 문맥(커넥션·실행자)·필수
): MDL-002
  throws ConsentProofWriteError { code: EX-BIZ-003, http: 500 }
```

- **실행 문맥은 호출측이 넘긴다.** 호출측 트랜잭션에 참여하려면 **같은 커넥션·실행자**를 받아야 하므로 `exec` 는 필수 인자다 — 본 기능의 모든 문(INSERT)을 이 위에서 실행한다. 스스로 커넥션을 얻으면 호출측 경계 **밖**의 별도 커넥션을 잡아 같은 경계의 변경이 보이지 않고, 요청 하나가 커넥션을 둘 점유해 풀이 마른다.
- **본 기능은 트랜잭션을 열지도 닫지도 않는다.** `BEGIN`·`COMMIT`·`ROLLBACK` 을 수행하지 않으며 커밋·되돌림 권한이 없다([`../processes/process_PROC-302.md`](../processes/process_PROC-302.md) §실행 제약사항). **경계는 호출측이 반드시 연다** — 승인 확정의 상위 프로세스([`PROC-103`](../processes/process_PROC-103.md) `B6`)가 그 자리이고 `PROC-302` 는 그 경계에 참여만 한다. 경계 없이 호출되면 증적 기록이 승인 확정과 따로 커밋돼 증적 없는 승인·승인 없는 증적이 생기므로(`BIZ-003-04`), **경계 밖 호출은 사양 위반**이다.

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | trackingKey | string | Y | 1~255자 | 증적과 사용자를 잇는 유일한 값 |
| 입력 | submission.agreedItemCodes | string[] | Y | 각 코드가 `consent.items[].code` 에 존재하고 **필수 항목을 모두 포함** | 선택 항목의 동의 여부도 이 목록으로 남는다. 진행 의사 값을 따로 받지 않는다(`BIZ-003-01`) |
| 입력 | consent.version | string(64) | Y | `^[0-9a-f]{64}$` | 기동 시 산출된 값을 그대로 쓴다 |
| 입력 | consent.notice · consent.items | — | Y | 상수 파싱 결과 — `items` 는 `MDL-008` 이 이미 정렬한 상태다 | 스냅샷의 출처 |
| 입력 | exec | TxExecutor | Y | 호출측이 연 트랜잭션의 커넥션·실행자 | 커넥션을 스스로 얻지 않는다. 커밋·되돌림을 수행하지 않는다 |
| 출력 | proof | MDL-002 | - | 생성 후 불변 | 기록된 동의 증적 |

### 처리 흐름 (의사코드)

```
1. 계기 검증 — POL DATA-003-04 · BIZ-003-01 (validate)
   // 승인 성립 조건은 필수 동의 충족 하나다 — 진행 의사 값을 받지 않는다
   required = consent.items.filter(i => i.required).map(i => i.code)
   if (required 중 submission.agreedItemCodes 에 없는 코드가 있다)
                                                        → throw EX-BIZ-003 (500)

2. 동의 항목 정합 검증 — ENT-002 §구현 가이드 (validate)
   for each code in submission.agreedItemCodes:
       if (code 가 consent.items 의 항목 코드에 없다)     → throw EX-BIZ-003 (500)

3. 스냅샷 구성 — POL DATA-003-02 · DATA-003-05 (transform)
   snapshot.notice = consent.notice          // 값이 없으면 빈 문자열
   snapshot.items  = consent.items           // MDL-008 이 이미 정렬한 결과 그대로 — 재정렬하지 않는다
       // 정렬 주체는 MDL-008 하나뿐이다. 여기서 다시 정렬하면 정본이 둘이 되고,
       //   두 정렬 기준이 갈리는 순간 스냅샷 순서와 해시 입력 순서가 어긋난다
       //   (기준의 정본은 data_ENT-002.md §버전 식별자 산출 규칙 3 — MDL-008 구현 가이드)
       // 화면이 실제로 노출한 내용과 같아야 한다 (POL DATA-003-05)

4. 증적 1건 기록 — POL DATA-003-04 (호출측 트랜잭션에 참여 — 새로 열지 않는다)
   INSERT INTO tbl_consent_proof
       (tracking_key, consented_at, consent_version, consent_snapshot, agreed_item_codes)
   VALUES
       (:trackingKey, :at, :consent.version, :snapshot, :submission.agreedItemCodes);
   // 실패 시                                            → throw EX-BIZ-003 (500)

5. 도메인 변환·반환 — ENT-002 행 → MDL-002 (커밋하지 않는다 — 경계를 닫는 것은 호출측이다)
   return { consentProofId: 생성된 행.consent_proof_id, trackingKey, consentedAt: at,
            consentVersion: consent.version, consentSnapshot: snapshot,
            agreedItemCodes: submission.agreedItemCodes }
```

### API 인터페이스

해당 없음 — 동의·승인 제출 접점이 승인 확정 시점에 호출한다([`spec-functions-api-user.md`](spec-functions-api-user.md) §동의·승인 제출).

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| 500 | `EX-BIZ-003` | 승인이 성립하지 않은 제출(필수 동의 미충족)로 호출됨·동의 항목 정합 위반·증적 저장 실패 | "처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요." | **결과를 확정하지 않고 수신처 전달도 수행하지 않는다**(`BIZ-003-04`). 본 기능은 되돌리지 않고 예외만 올린다 — **되돌림은 경계를 연 호출측**이 수행한다. 사용자는 다시 시도할 수 있다 |

- **필수 동의 미충족**은 이 기능에 도달하기 전에 걸러진다 — 승인 제출 접점이 서버 재검증에서 400 `EX-BIZ-001` 로 종료한다(`BIZ-003-02`). 단계 1 은 그 뒤의 **마지막 방어**이며, 여기까지 온 미충족 제출은 사용자 입력 오류가 아니라 호출측 결함이라 500 으로 다룬다.
- **미동의 이탈에는 이 기능이 호출되지 않는다**(`BIZ-003-03`·`DATA-003-04`). 증적도 결과도 만들지 않고 **결과 미확정**으로 남는다.

### 의존 기능

없음.

### 구현 가이드

- **증적 기록과 승인 확정을 같은 처리 경계에 둔다**(`BIZ-003-04`). 증적 없는 승인이나 승인 없는 증적이 생기지 않게 한다. **그 경계는 호출측이 열고 닫는다** — 본 기능은 `exec` 로 받은 실행자 위에서 실행만 한다(§시그니처). 같은 추적 키의 동시 승인은 추적 레코드 행을 잠근 상태에서 처리해 중복 증적을 막는다([`data_ENT-002.md`](../datas/data_ENT-002.md) §구현 가이드).
- **버전 식별자를 기록 시점에 다시 계산하지 않는다.** 기동 시 산출된 값을 그대로 쓴다(`MDL-002` 구현 가이드).
- **스냅샷은 화면이 실제로 노출한 내용과 같아야 한다**(`DATA-003-05`). 노출과 스냅샷이 같은 구성 모델(`MDL-008`)에서 나오게 한다. **항목 순서도 그 모델이 정한 대로 쓰고 여기서 다시 정렬하지 않는다** — 정렬을 `MDL-008` 에서 한 번만 수행하면 버전 식별자 산출과 스냅샷이 자동으로 같은 순서를 갖는다([`model_MDL-007-010.md`](../datas/model_MDL-007-010.md) §구현 가이드).
- 증적에는 추적 키 외의 어떤 사용자 식별 값도 넣지 않는다(`DATA-003-02`).
- 증적은 **생성 후 불변**이다 — 갱신 경로를 만들지 않는다.

---

## FN-013 지표 카운터 갱신

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | 지표 카운터 갱신 |
| 분류 | DAT |
| 사용 서비스 | SVC-001 · SVC-002 · SVC-003 · SVC-004 · SVC-014 · SVC-016 |
| 호출 PROC | PROC-101 · PROC-102 · PROC-103 · PROC-104 · PROC-301 · PROC-303 |
| 연관 정책 | `BIZ-005-01` · `BIZ-005-02` · `BIZ-005-03` · `BIZ-005-04` · `BIZ-005-05` · `DATA-002-03` · `SEC-003-03` |
| 참조 데이터 | [`ENT-003`](../datas/data_ENT-003.md) · [`MDL-003`](../datas/model_MDL-003.md) |
| 관련 IA 항목 | `BAT-06` |

### 시그니처

```
function FN-013 (
  event: MetricEvent,       // { kind, resultCode?, at } · 필수
  exec?: TxExecutor,        // 선택 — 호출측이 연 트랜잭션의 실행 문맥(커넥션·실행자).
                            //   REQUEST·RESULT 는 반드시 넘기고, UNIDENTIFIED_FAILURE 만 없이 부른다
): void
  throws MetricWriteError { code: EX-BIZ-003, http: 500 }
```

- **`REQUEST`·`RESULT` 계기는 `exec` 를 반드시 넘긴다.** 레코드 기록과 함께 커밋되거나 함께 되돌려져야 하므로 **같은 커넥션·실행자**를 받아야 한다([`../processes/process_PROC-303.md`](../processes/process_PROC-303.md) §실행 제약사항 · `SVC-014` F-008). 생략하면 별도 커넥션에서 갱신돼 **호출측이 되돌려도 계수만 남고**, 요청 하나가 커넥션을 둘 점유해 풀이 마른다.
- **`UNIDENTIFIED_FAILURE` 만 `exec` 없이 부른다.** 그 계기의 호출 지점([`PROC-101`](../processes/process_PROC-101.md) `B5` · [`PROC-102`](../processes/process_PROC-102.md) `B4b` · [`PROC-104`](../processes/process_PROC-104.md) `B2`)은 호출측이 경계를 열지 않는 자리라 넘길 실행 문맥이 없고, 단계 4 의 UPSERT 한 문장이 그 자체로 원자적이다.
- **본 기능은 트랜잭션을 열지도 닫지도 않는다.** `BEGIN`·`COMMIT`·`ROLLBACK` 을 수행하지 않으며 커밋·되돌림 권한이 없다 — 경계를 여닫는 것은 호출측이다.

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | event.kind | string | Y | `REQUEST`·`UNIDENTIFIED_FAILURE`·`RESULT` | 계수 계기의 종류 |
| 입력 | event.resultCode | string | N | `kind = RESULT` 일 때만 필수·`BIZ-001-01` **3종** | 갱신할 결과 카운터 선택 |
| 입력 | event.at | datetime | Y | 시간대 유지 | 일자 산출 기준 |
| 입력 | exec | TxExecutor | N | 호출측이 연 트랜잭션의 커넥션·실행자. **`UNIDENTIFIED_FAILURE` 외 필수** | 커넥션을 스스로 얻지 않는다. 커밋·되돌림을 수행하지 않는다 |
| 출력 | — | — | - | - | 반환값 없음 |

### 처리 흐름 (의사코드)

```
1. 계기 검증 — POL BIZ-005-02 (validate)
   if (event.kind not in ['REQUEST','UNIDENTIFIED_FAILURE','RESULT'])  → throw EX-BIZ-003 (500)
   if (event.kind == 'RESULT' AND event.resultCode 가 3종에 없다)       → throw EX-BIZ-003 (500)

2. 일자 산출 — ENT-003 §일자 경계 기준 (transform)
   metricDate = DATE_IN_TIMEZONE(event.at, 'Asia/Seoul')

3. 갱신 대상 결정 — POL BIZ-005-02 · BIZ-005-04 (transform)
   if (event.kind == 'REQUEST')                columns = [request_count]
   if (event.kind == 'UNIDENTIFIED_FAILURE')   columns = [request_count, decrypt_failed_count]
   if (event.kind == 'RESULT')                 columns = [ 아래 대응표의 컬럼 1개 ]
       SUCCESS → success_count · DECRYPT_FAILED → decrypt_failed_count
       DELIVERY_FAILED → delivery_failed_count
       // 거부 카운터가 없다 — 컬럼은 요청 수 1개 + 결과 구분 3종 = 4개다 (POL BIZ-005-01)

4. 원자적 UPSERT (삽입과 증가를 한 문장으로 · 호출측 트랜잭션에 참여 — 새로 열지 않는다)
   INSERT INTO tbl_interlock_metric_daily (metric_date, <columns>)
   VALUES (:metricDate, 1 …)
   ON CONFLICT (metric_date)
   DO UPDATE SET <각 column> = tbl_interlock_metric_daily.<column> + 1;
   -- exec 가 주어지면 그 실행자 위에서 수행한다 (호출측 경계와 함께 커밋·되돌림된다)
   -- 없으면 단독 갱신이다 — 이 한 문장이 그 자체로 원자적이다 (UNIDENTIFIED_FAILURE 전용)
   // 실패 시                                                          → throw EX-BIZ-003 (500)

5. 종료 (감산·이동이 없다 — POL BIZ-005-04 · 커밋하지 않는다 — 경계를 닫는 것은 호출측이다)
   return
```

### API 인터페이스

해당 없음 — 조회 화면·조회 API 를 두지 않는다. 지표 산출은 저장분을 직접 확인해 수행한다(`SVC-016` 사용자 정의).

### 계수 계기 대응 (확정)

| 계기 | 호출 지점 | `kind` | 근거 |
|---|---|---|---|
| 추적 레코드 최초 생성 | FN-008 단계 5 | `REQUEST` | `BIZ-005-02` ① |
| 진입 단계 구조 위반으로 종료 | PROC-101 · PROC-102(`EX-SEC-001` 경로) | `UNIDENTIFIED_FAILURE` | `BIZ-005-02` ② |
| 복호화 판정 3·4단계 실패로 종료 | PROC-102 · PROC-104 | `UNIDENTIFIED_FAILURE` | `BIZ-005-02` ② (추적 키 미확보) |
| 결과 구분 확정 | FN-009 단계 3 | `RESULT` | `BIZ-005-04` |
| 재진입 · 본인확인 재시도 · 확정 결과 재안내 | — | 호출하지 않는다 | `BIZ-005-03` |
| **결과 미확정 이탈**(미동의 이탈 · 본인확인 미완료 이탈) | — | 호출하지 않는다 | `BIZ-005-04` — **요청 수에만 남고**(레코드 최초 생성 시점에 이미 계수됐다) 어느 결과 구분 카운터에도 계수하지 않는다 |
| 자가진단 호출 | — | 호출하지 않는다 | EXC-BIZ-11 · `SEC-003-03` |

- **`REQUEST`·`RESULT` 는 호출 지점이 연 경계에서 `exec` 를 받아 수행하고, `UNIDENTIFIED_FAILURE` 는 `exec` 없이 단독 갱신한다**(§시그니처).
- **결과 구분 3종의 합은 요청 수보다 작을 수 있다**(`BIZ-005-04`). 결과 미확정으로 끝난 연동과 일자 경계를 걸친 연동 때문이며 결함이 아니다 — 등식 검사를 두지 않는다([`data_ENT-003.md`](../datas/data_ENT-003.md) §행 단위 합계에 제약을 두지 않는 이유).

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| 500 | `EX-BIZ-003` | 계기 값 위반·카운터 갱신 실패 | "처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요." | 본 기능은 되돌리지 않고 예외만 올린다 — **되돌림은 경계를 연 호출측**이 수행하며 같은 경계의 레코드 기록도 함께 취소된다. 결과를 확정하지 않는다. `UNIDENTIFIED_FAILURE` 는 되돌릴 경계가 없어 호출측이 실패 처리를 정한다([`PROC-101`](../processes/process_PROC-101.md) `B5` — 계수 실패가 응답을 막지 않는다) |

### 의존 기능

없음.

### 구현 가이드

- **삽입과 증가를 한 문장으로 처리한다**([`data_ENT-003.md`](../datas/data_ENT-003.md) §구현 가이드). 조회 후 분기하면 동시 요청에서 계수가 유실된다.
- **레코드 기록과 같은 트랜잭션 경계에 둔다**(`SVC-014` F-008). 한쪽이 실패하면 함께 되돌린다. **그 경계는 호출측이 열고 닫는다** — 본 기능은 `exec` 로 받은 실행자 위에서 실행만 한다(§시그니처).
- **일자 산출 시 시간대를 명시적으로 지정한다.** 서버·세션 기본 시간대에 의존하면 배포 환경에 따라 경계가 달라진다.
- **파생 비율을 저장하지 않는다**(`BIZ-005-01`). 성공률은 읽는 시점에 계산하며, 어느 정의를 목표치 판정에 쓸지는 담당자 이월 사항이다(`BIZ-005-06`). 목표 수치는 [`../../prd/PRD.md`](../../prd/PRD.md) §성과 지표를 참조하고 본 사양에 옮겨 적지 않는다.
- **추적 키를 알 수 없는 실패는 시도마다 계수된다.** 같은 요청인지 판정할 수단이 없어 생기는 중복이며 수용 한계다(`BIZ-005-05`) — 검증에서 결함으로 올리지 않는다.
