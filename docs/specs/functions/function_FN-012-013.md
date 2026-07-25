# 증적·집계 기록 기능 정의 (FN-012 ~ FN-013)

정본 목록은 [`spec-functions.md`](spec-functions.md). 용어는 [`../../../wiki/WIKI.md`](../../../wiki/WIKI.md).

## 개요

- **기능 목적**: 추적 레코드 밖의 두 저장 대상에 기록하는 기능이다 — **동의 증적**(사후 입증)과 **연동 지표 집계**(삭제 이후에도 남는 건수). 둘 다 추적 레코드와 같은 처리 경계에서 갱신돼야 정합이 유지된다.
- **관련 PRD 요구사항**:
	- [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 10 — "**동의 증적 기록**: 사용자가 **어느 시점의 어떤 동의 항목에 동의했는지**를 개인정보 없이 남긴다."
	- [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 11 — "**연동 지표 집계**: 일자 단위 요청·성공·거부·실패 건수만 누적한다."

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
  submission: MDL-007,      // 동의·승인 제출·필수(decision = APPROVE 여야 한다)
  consent: MDL-008,         // 기동 시 파싱한 동의 항목 구성·필수
  at: datetime,             // 승인 확정 시각·필수
): MDL-002
  throws ConsentProofWriteError { code: EX-BIZ-003, http: 500 }
```

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | trackingKey | string | Y | 1~255자 | 증적과 사용자를 잇는 유일한 값 |
| 입력 | submission.decision | string | Y | `APPROVE` 만 허용 | 거부는 증적을 만들지 않는다(`BIZ-003-03`) |
| 입력 | submission.agreedItemCodes | string[] | Y | 각 코드가 `consent.items[].code` 에 존재 | 선택 항목의 동의 여부도 이 목록으로 남는다 |
| 입력 | consent.version | string(64) | Y | `^[0-9a-f]{64}$` | 기동 시 산출된 값을 그대로 쓴다 |
| 입력 | consent.notice · consent.items | — | Y | 상수 파싱 결과 | 스냅샷의 출처 |
| 출력 | proof | MDL-002 | - | 생성 후 불변 | 기록된 동의 증적 |

### 처리 흐름 (의사코드)

```
1. 계기 검증 — POL DATA-003-04 (validate)
   if (submission.decision != 'APPROVE')                → throw EX-BIZ-003 (500)

2. 동의 항목 정합 검증 — ENT-002 §구현 가이드 (validate)
   for each code in submission.agreedItemCodes:
       if (code 가 consent.items 의 항목 코드에 없다)     → throw EX-BIZ-003 (500)

3. 스냅샷 구성 — POL DATA-003-02 · DATA-003-05 (transform)
   snapshot.notice = consent.notice                     // 값이 없으면 빈 문자열
   snapshot.items  = SORT_BY_CODE_ASC(consent.items)    // 화면 노출과 같은 내용·같은 순서

4. 증적 1건 기록 — POL DATA-003-04 (승인 확정과 같은 트랜잭션 경계)
   INSERT INTO tbl_consent_proof
       (tracking_key, consented_at, consent_version, consent_snapshot, agreed_item_codes)
   VALUES
       (:trackingKey, :at, :consent.version, :snapshot, :submission.agreedItemCodes);
   // 실패 시                                            → throw EX-BIZ-003 (500)

5. 도메인 변환·반환 — ENT-002 행 → MDL-002
   return { consentProofId: 생성된 행.consent_proof_id, trackingKey, consentedAt: at,
            consentVersion: consent.version, consentSnapshot: snapshot,
            agreedItemCodes: submission.agreedItemCodes }
```

### API 인터페이스

해당 없음 — 동의·승인 제출 접점이 승인 확정 시점에 호출한다([`spec-functions-api-user.md`](spec-functions-api-user.md) §동의·승인 제출).

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| 500 | `EX-BIZ-003` | 계기가 승인이 아님·동의 항목 정합 위반·증적 저장 실패 | "처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요." | **결과를 확정하지 않고 수신처 전달도 수행하지 않는다**(`BIZ-003-04`). 사용자는 다시 시도할 수 있다 |

- **필수 동의 미충족**은 이 기능에 도달하기 전에 걸러진다 — 승인 제출 접점이 서버 재검증에서 400 `EX-BIZ-001` 로 종료한다(`BIZ-003-02`).

### 의존 기능

없음.

### 구현 가이드

- **증적 기록과 승인 확정을 같은 처리 경계에 둔다**(`BIZ-003-04`). 증적 없는 승인이나 승인 없는 증적이 생기지 않게 한다. 같은 추적 키의 동시 승인은 추적 레코드 행을 잠근 상태에서 처리해 중복 증적을 막는다([`data_ENT-002.md`](../datas/data_ENT-002.md) §구현 가이드).
- **버전 식별자를 기록 시점에 다시 계산하지 않는다.** 기동 시 산출된 값을 그대로 쓴다(`MDL-002` 구현 가이드).
- **스냅샷은 화면이 실제로 노출한 내용과 같아야 한다**(`DATA-003-05`). 노출과 스냅샷이 같은 구성 모델(`MDL-008`)에서 나오게 한다.
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
): void
  throws MetricWriteError { code: EX-BIZ-003, http: 500 }
```

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | event.kind | string | Y | `REQUEST`·`UNIDENTIFIED_FAILURE`·`RESULT` | 계수 계기의 종류 |
| 입력 | event.resultCode | string | N | `kind = RESULT` 일 때만 필수·`BIZ-001-01` 4종 | 갱신할 결과 카운터 선택 |
| 입력 | event.at | datetime | Y | 시간대 유지 | 일자 산출 기준 |
| 출력 | — | — | - | - | 반환값 없음 |

### 처리 흐름 (의사코드)

```
1. 계기 검증 — POL BIZ-005-02 (validate)
   if (event.kind not in ['REQUEST','UNIDENTIFIED_FAILURE','RESULT'])  → throw EX-BIZ-003 (500)
   if (event.kind == 'RESULT' AND event.resultCode 가 4종에 없다)       → throw EX-BIZ-003 (500)

2. 일자 산출 — ENT-003 §일자 경계 기준 (transform)
   metricDate = DATE_IN_TIMEZONE(event.at, 'Asia/Seoul')

3. 갱신 대상 결정 — POL BIZ-005-02 · BIZ-005-04 (transform)
   if (event.kind == 'REQUEST')                columns = [request_count]
   if (event.kind == 'UNIDENTIFIED_FAILURE')   columns = [request_count, decrypt_failed_count]
   if (event.kind == 'RESULT')                 columns = [ 아래 대응표의 컬럼 1개 ]
       SUCCESS → success_count · USER_DENIED → user_denied_count
       DECRYPT_FAILED → decrypt_failed_count · DELIVERY_FAILED → delivery_failed_count

4. 원자적 UPSERT (삽입과 증가를 한 문장으로)
   INSERT INTO tbl_interlock_metric_daily (metric_date, <columns>)
   VALUES (:metricDate, 1 …)
   ON CONFLICT (metric_date)
   DO UPDATE SET <각 column> = tbl_interlock_metric_daily.<column> + 1;
   // 실패 시                                                          → throw EX-BIZ-003 (500)

5. 종료 (감산·이동이 없다 — POL BIZ-005-04)
   return
```

### API 인터페이스

해당 없음 — 조회 화면·조회 API 를 두지 않는다. 지표 산출은 저장분을 직접 확인해 수행한다(`SVC-016` 사용자 정의).

### 계수 계기 대응 (확정)

| 계기 | 호출 지점 | `kind` | 근거 |
|---|---|---|---|
| 추적 레코드 최초 생성 | FN-008 단계 5 | `REQUEST` | `BIZ-005-02` ① |
| 진입 단계 구조 위반으로 종료 | PROC-101 | `UNIDENTIFIED_FAILURE` | `BIZ-005-02` ② |
| 복호화 판정 3·4단계 실패로 종료 | PROC-102 · PROC-104 | `UNIDENTIFIED_FAILURE` | `BIZ-005-02` ② (추적 키 미확보) |
| 결과 구분 확정 | FN-009 단계 3 | `RESULT` | `BIZ-005-04` |
| 재진입 · 본인확인 재시도 · 확정 결과 재안내 | — | 호출하지 않는다 | `BIZ-005-03` |
| 자가진단 호출 | — | 호출하지 않는다 | EXC-BIZ-11 · `SEC-003-03` |

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| 500 | `EX-BIZ-003` | 계기 값 위반·카운터 갱신 실패 | "처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요." | 같은 트랜잭션의 레코드 기록과 함께 되돌린다. 결과를 확정하지 않는다 |

### 의존 기능

없음.

### 구현 가이드

- **삽입과 증가를 한 문장으로 처리한다**([`data_ENT-003.md`](../datas/data_ENT-003.md) §구현 가이드). 조회 후 분기하면 동시 요청에서 계수가 유실된다.
- **레코드 기록과 같은 트랜잭션 경계에 둔다**(`SVC-014` F-008). 한쪽이 실패하면 함께 되돌린다.
- **일자 산출 시 시간대를 명시적으로 지정한다.** 서버·세션 기본 시간대에 의존하면 배포 환경에 따라 경계가 달라진다.
- **파생 비율을 저장하지 않는다**(`BIZ-005-01`). 성공률은 읽는 시점에 계산하며, 어느 정의를 목표치 판정에 쓸지는 담당자 이월 사항이다(`BIZ-005-06`). 목표 수치는 [`../../prd/PRD.md`](../../prd/PRD.md) §성과 지표를 참조하고 본 사양에 옮겨 적지 않는다.
- **추적 키를 알 수 없는 실패는 시도마다 계수된다.** 같은 요청인지 판정할 수단이 없어 생기는 중복이며 수용 한계다(`BIZ-005-05`) — 검증에서 결함으로 올리지 않는다.
