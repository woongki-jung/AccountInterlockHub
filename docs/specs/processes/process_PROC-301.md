# 연동 추적 기록 기능 정의

정본 목록은 [`spec-process.md`](spec-process.md). 단계 라벨 체계도 그 문서가 갖는다. 용어는 [`../../../wiki/WIKI.md`](../../../wiki/WIKI.md).

## 개요

- **정의 대상**: 연동 1건의 진행과 결과를 **추적 키 기준 단일 레코드 하나에 모으는** 처리다. 조회·확보(생성·이어쓰기)·결과 확정·결과 확인 표시·완료 콜백 기록이라는 **다섯 계기**를 한 프로세스가 받아 트랜잭션 경계와 조건부 갱신 형태를 통일한다.
- **관련 PRD 요구사항**:
	- [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 9 — "연동 추적 키 기준 **단일 추적 레코드**를 사용자가 진입한 시점에 생성하고, 승인·복호화 결과·수신처 전달 결과·결과 확인·완료 콜백을 **같은 레코드에 이어 기록**한다."
	- [`../../prd/devspec/database.md`](../../prd/devspec/database.md) §연동 추적 레코드 · §추적 키 중복 수신.

---

## PROC-301 연동 추적 기록

### 기본 정보

| 항목 | 내용 |
|------|------|
| 프로세스명 | 연동 추적 기록 |
| 분류 | EVT |
| 그룹 | 기록·보관 |
| 트리거 유형 | 상위 프로세스 호출 — PROC-102 · PROC-103 · PROC-104 · PROC-201 · PROC-202 · PROC-203 |
| 처리 방식 | 동기(호출측 트랜잭션에 참여) |
| 우선순위 | 보통 |
| 관련 IA 항목 | `BAT-04` |

### 관련 사양 코드

| 구분 | 코드 | 관계 설명 |
|------|------|----------|
| 서비스(SVC) | SVC-014 (계기 제공 — SVC-002·SVC-003·SVC-004·SVC-010·SVC-012) | 본 프로세스가 구현하는 시나리오 |
| 정책(policy) | `BIZ-002-01`·`BIZ-002-03`(`B2`·`B3`)·`BIZ-002-04`(`B3`) · `BIZ-001-01`·`BIZ-001-04`(`B4`) · `BIZ-005-02` ①(`B3`)·`BIZ-005-04`(`B4`) · `DATA-002-01` ①(`B5`) · `DATA-004-01`(`B3`)·`DATA-004-02`(`B2`) · `DATA-001-01`(`B3`~`B6`) · `DATA-002-05`(`B2`) | 적용 규칙·지점 |
| 공통 기능(FN) | FN-007(`B2`) · FN-008(`B3`) · FN-009(`B4`) · FN-010(`B5`) · FN-011(`B6`) · FN-013(`B3`·`B4`, PROC-303 경유) | 호출하는 공통 로직 |
| 데이터 모델(MDL) | [`MDL-001`](../datas/model_MDL-001.md) 도메인 모델 · [`MDL-003`](../datas/model_MDL-003.md)(PROC-303 경유) | 입출력 |
| DB 엔터티(ENT) | [`ENT-001`](../datas/data_ENT-001.md)(C·R·U) | 조회·변경 대상 |
| 화면(SCR) | 없음 — 내부 기록 기능이다([`../screens/spec-screens.md`](../screens/spec-screens.md) §화면을 갖지 않는 IA 노드) | — |

### 진입점 및 진입 조건

본 프로세스는 외부 표면을 갖지 않는다. **상위 프로세스가 기록 계기(`kind`)를 붙여 호출**한다.

| `kind` | 호출 지점 | 수행 단계 |
|---|---|---|
| `LOOKUP` | PROC-201 `B3` · PROC-202 `B3` · PROC-203 `B3` | `B1` → `B2` → `B7` |
| `SECURE` | PROC-102 `B6` · PROC-103 `B3` | `B1` → `B2` → `B3` → `B7` |
| `FIX_RESULT` | PROC-104 `B6` | `B1` → `B4` → `B7` |
| `CONFIRM_RESULT` | PROC-201 `B5` | `B1` → `B5` → `B7` |
| `RECORD_CALLBACK` | PROC-203 `B4` | `B1` → `B6` → `B7` |

- **`exec` 를 넘기지 않는 계기는 `LOOKUP` 하나뿐이다.** 그 호출 지점(PROC-201 `B3` · PROC-202 `B3` · PROC-203 `B3`)은 호출측이 아직 경계를 열지 않은 자리라 **넘길 실행 문맥이 없다** — 표기 누락이 아니라 사양이며, `exec` 인자를 나중에 채워 넣지 않는다([`../functions/function_FN-007-008.md`](../functions/function_FN-007-008.md) FN-007 §시그니처). 나머지 네 계기는 반대로 **`exec` 전달이 참여의 성립 조건**이다.
- **진입 조건**: **인증 없음 — `AUTH-001` 인용.** 상위 프로세스 안에서 실행되므로 자체 진입 조건이 없다.
- **사전 검증**: 추적 키는 호출 전에 이미 형식 판정을 통과한 값이다(FN-006). 본 프로세스는 형식을 다시 판정하지 않는다.

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 설명 |
|------|--------|------------|------|------|
| 입력 | `kind` | string | Y | 위 다섯 계기 중 하나 |
| 입력 | `trackingKey` | string(1~255) | Y | 대상 레코드. **변형하지 않는다** |
| 입력 | `resultCode` | string | N | `kind = FIX_RESULT` 일 때만. 결과 구분 3종(`BIZ-001-01`) |
| 입력 | `at` | datetime | N | 계기 발생 시각(시간대 유지). `LOOKUP` 외 전부 필수 |
| 입력 | `exec` | TxExecutor | N | 호출측이 연 트랜잭션의 커넥션·실행자. **`LOOKUP` 외 전부 필수** — 본 프로세스의 모든 문과 하위 FN(FN-007~FN-011·FN-013)을 이 실행자 위에서 수행하며 커넥션을 스스로 얻지 않는다. `LOOKUP` 은 주면 그 경계 안에서, 없으면 단독 읽기로 조회한다 |
| 출력 | `branch` | string | - | `NONE`·`OPEN`·`FIXED`(`LOOKUP`·`SECURE`) |
| 출력 | `record` | [`MDL-001`](../datas/model_MDL-001.md) \| null | - | 최신 상태 |
| 출력 | `isCreated` | boolean | - | `SECURE` 에서 이번 호출이 새로 만들었는지 |
| 출력 | `confirmedAt`·`callbackReceivedAt` | datetime \| null | - | 해당 계기의 확정 일시 |

### 연관 데이터 및 외부 호출

- **호출 API**: 없음.
- **데이터 조회 대상**: [`ENT-001`](../datas/data_ENT-001.md) 기본 키 단건 조회.
- **데이터 변경 대상(CRUD)**: [`ENT-001`](../datas/data_ENT-001.md) INSERT 1건(`SECURE`) · 조건부 UPDATE 1건(`FIX_RESULT`·`CONFIRM_RESULT`·`RECORD_CALLBACK`). [`ENT-003`](../datas/data_ENT-003.md) 은 PROC-303 이 같은 트랜잭션에서 갱신한다.

### 실행 제약사항

- **트랜잭션 경계**: **호출측 트랜잭션에 참여**한다. 새 트랜잭션을 열지 않고 상위가 연 경계 안에서 실행돼, 레코드 기록과 지표 계수가 함께 커밋되거나 함께 되돌려진다(`SVC-014` F-008). **참여는 호출측이 넘긴 `exec`(같은 커넥션·실행자) 위에서만 성립한다** — 본 프로세스는 `BEGIN`·`COMMIT`·`ROLLBACK` 을 수행하지 않고 커넥션도 스스로 얻지 않으며, 받은 `exec` 를 하위 FN(FN-007~FN-011)과 PROC-303(`B3`·`B4`)에 그대로 넘긴다. `exec` 없이 불리면 경계 **밖**의 별도 커넥션에서 실행돼 같은 경계의 변경이 보이지 않고 요청 하나가 커넥션을 둘 점유한다. **`LOOKUP` 만 예외로 참여할 경계가 없어 `exec` 없이 단독 읽기로 조회한다**(§진입점 및 진입 조건).
- **동시성 제어**: **모든 갱신이 조건부 UPDATE 다** — "아직 비어 있을 때만 채운다"는 같은 형태라 재요청·중복 통지·동시 요청에서 값이 덮이지 않는다. 생성은 **`ON CONFLICT (tracking_key) DO NOTHING` 으로 기본 키 충돌을 정상 경로로 흡수**한다 — **반환 행의 유무가 곧 `isCreated`** 이고, 충돌이 오류로 올라오지 않으므로 같은 경계가 살아 있는 채로 재조회가 그대로 이어진다.
- **멱등성**: `SECURE` 는 같은 키로 여러 번 불러도 레코드 하나 · 요청 수 1회. `FIX_RESULT`·`CONFIRM_RESULT`·`RECORD_CALLBACK` 은 최초 1회만 성립하고 이후는 기존 값을 반환한다.
- **성능 요구**: 계기당 조회 1회 + 갱신 최대 1회. 목록·범위 조회 경로를 만들지 않는다.
- **보안 요구**: **인증 없음**(`AUTH-001`). 레코드에 사용자 정보·암호값·복호화 원문을 담지 않는다 — **담을 컬럼이 스키마에 없는 것이 1차 방어다**(`DATA-001-02`).

### 로직 실행 순서

#### FE 측 처리 (의사코드)

**사용자 화면이 없다.** 내부 기록 기능이며 조회·조작 표면을 두지 않는다([`../../prd/ia/IA.md`](../../prd/ia/IA.md) `BAT` 영역 주석). FE 자리에는 **호출측(상위 프로세스)** 처리를 `C` 라벨로 적는다.

```
C1. 기록 계기 전달 (상위 프로세스)

  진입 트리거: 상위 프로세스가 기록해야 할 사실을 확정한 시점
  전달 값: { kind, trackingKey, resultCode?, at, exec }
  트랜잭션: 갱신 계기는 상위가 BEGIN 으로 경계를 열고 그 커넥션·실행자를 exec 로 함께 넘긴다
            — 넘기지 않으면 별도 커넥션에서 실행돼 참여가 성립하지 않는다 (LOOKUP 은 경계 없이도 성립한다)
            (SECURE·FIX_RESULT 는 지표 계수와 함께 커밋돼야 한다 — SVC-014 F-008)
  전달 규칙:
    trackingKey 는 복호화로 얻었거나 요청 본문으로 받은 값 그대로다 (POL DATA-004-01)
    at 은 호출측이 정한 계기 시각이다 — 본 프로세스가 시각을 새로 만들지 않는다
              (지표 일자 산출 기준이 호출측 시각과 갈리면 안 된다)

C2. 결과 수령

  branch·record·isCreated·confirmedAt 로 다음 분기를 정한다
  EX-BIZ-003 이 올라오면 상위가 트랜잭션을 되돌리고 500 으로 응답한다
  // 상위는 이 실패를 결과 확정으로 승격시키지 않는다 — 결과 미확정으로 끝난다
```

#### BE 측 처리 (의사코드)

```
B1. 기록 계기 수신

  엔드포인트·메서드: 없음 — 상위 프로세스 안에서 함수로 실행된다
  인증·인가 검증: 인증 없음 — AUTH-001 인용
  입력 재검증:
    if (kind not in ['LOOKUP','SECURE','FIX_RESULT','CONFIRM_RESULT','RECORD_CALLBACK'])
                                                  → throw EX-BIZ-003 (500)
    if (kind == 'FIX_RESULT' AND resultCode 가 3종에 없다)  → throw EX-BIZ-003 (500)
  분기: kind 에 따라 아래 단계 하나로 간다

B2. 추적 키 기준 사전 조회 — FN-007 · POL BIZ-002-03 · DATA-002-05 (validate)

  SELECT tracking_key, result_code, result_at, result_confirmed_at,
         callback_received_at, created_at
  FROM tbl_interlock_tracking
  WHERE tracking_key = :trackingKey;
  -- 기본 키 단건 · ORDER BY·LIMIT·OFFSET·JOIN 없음 · 락 없음(읽기 전용)

  if (조회 행 수 == 0)   return { branch: 'NONE', record: null }
      // 미진입과 보관 만료 삭제를 구별하지 않는다 (POL DATA-002-05)
  record = ENT-001 행 → MDL-001 변환 (파생 4종 산출)
  branch = (record.resultCode != null ? 'FIXED' : 'OPEN')
  // "결과 확정" 판정은 결과 구분 값의 존재 여부로만 한다

B3. 레코드 생성·이어쓰기 — FN-008 · POL BIZ-002-01 · BIZ-002-04 (트랜잭션 참여)

  if (branch == 'FIXED')   return { branch: 'FIXED', record, isCreated: false }
      // 어떤 컬럼도 갱신하지 않는다 — 보관 기산점이 밀리지 않는다 (POL BIZ-002-04)
  if (branch == 'OPEN')    return { branch: 'OPEN',  record, isCreated: false }
      // 새로고침·재진입·본인확인 재시도가 여기로 수렴한다 (POL BIZ-002-03 ②)

  INSERT INTO tbl_interlock_tracking (tracking_key)
  VALUES (:trackingKey)
  ON CONFLICT (tracking_key) DO NOTHING          -- 기본 키 충돌을 오류로 만들지 않는다
  RETURNING tracking_key;                        -- 반환 행의 유무가 곧 isCreated 다
  -- result_code·result_at·result_confirmed_at·callback_received_at 은 NULL
  -- created_at 은 기본값 now()
  실행 실패(충돌 외의 제약 위반·연결 오류)       → throw EX-BIZ-003 (500)

  if (반환 행 수 == 0)                            // 같은 키의 동시 진입 — 충돌
      lookup = B2 재수행                          // 충돌이 오류로 올라오지 않아 경계가 살아 있다
      return { branch: lookup.branch, record: lookup.record, isCreated: false }
      // 오류가 아니라 이어쓰기로 수렴한다 (POL BIZ-002-03 ②)

  PROC-303({ kind: 'REQUEST', at, exec })        // 요청 수 +1 · 같은 트랜잭션
      // exec = 호출측에서 받은 커넥션·실행자를 그대로 넘긴다 — 이 전달이 참여의 성립 조건이다
      //        (경계를 여는 자리는 PROC-102 B6·PROC-103 B3 다 — 본 프로세스는 참여만 한다)
      // 실패 시 EX-BIZ-003 전파 → INSERT 와 함께 되돌린다 (POL BIZ-005-02 ①)
  return { branch: 'OPEN', record: 재조회 결과, isCreated: true }

B4. 결과 확정·기록 — FN-009 · POL BIZ-001-04 · BIZ-004-03 (트랜잭션 참여)

  UPDATE tbl_interlock_tracking
  SET result_code = :resultCode, result_at = :at
  WHERE tracking_key = :trackingKey AND result_code IS NULL;
  -- 조건절이 1회 확정을 강제한다. 조회 후 응용 판정으로 대체하면 동시 요청에서 덮인다
  -- result_code 와 result_at 을 항상 함께 채운다 (테이블 제약 ck_result_pair)

  if (갱신 행 수 == 1)
      PROC-303({ kind: 'RESULT', resultCode, at, exec })  // 해당 카운터 +1 · 같은 트랜잭션
          // exec = 호출측에서 받은 커넥션·실행자를 그대로 넘긴다 — 이 전달이 참여의 성립 조건이다
          //        (경계를 여는 자리는 PROC-104 B6 다 — 본 프로세스는 참여만 한다)
  else
      lookup = B2 재수행
      if (lookup.branch == 'NONE')                → throw EX-BIZ-003 (500)
      // 이미 확정 상태 — 확정 결과를 그대로 두고 계수도 하지 않는다 (POL BIZ-001-04)
  저장 실패 시                                     → throw EX-BIZ-003 (500)
  return { record: B2 재수행 결과 }

B5. 결과 확인 표시 — FN-010 · POL DATA-002-01 ① · BR-010 (트랜잭션 참여)

  UPDATE tbl_interlock_tracking
  SET result_confirmed_at = :at
  WHERE tracking_key = :trackingKey
    AND result_confirmed_at IS NULL
    AND result_code IS NOT NULL;
  -- 세 번째 조건이 "결과를 담아 응답한 경우에만 표시" 규칙이다

  if (갱신 행 수 == 1)  return { confirmedAt: at }        // 보관 기산 개시
  else                  return { confirmedAt: B2 재수행 결과.record.resultConfirmedAt }
  저장 실패 시                                     → throw EX-BIZ-003 (500)

B6. 완료 콜백 기록 — FN-011 · BR-012 · BR-021 (트랜잭션 참여)

  UPDATE tbl_interlock_tracking
  SET callback_received_at = :at
  WHERE tracking_key = :trackingKey AND callback_received_at IS NULL;
  -- result_code 를 건드리지 않는다 (BR-021) — 결과 확정과 완료 통지는 다른 사실이다

  if (갱신 행 수 == 1)  return { callbackReceivedAt: at }
  else
      lookup = B2 재수행
      if (lookup.branch == 'NONE')                → throw EX-BIZ-003 (500)
      return { callbackReceivedAt: lookup.record.callbackReceivedAt }   // 최초 수신 시각 유지
  저장 실패 시                                     → throw EX-BIZ-003 (500)

B7. 기록 결과 반환

  return 계기별 반환 값                            // 상위 프로세스가 응답을 만든다
  후속 이벤트 발행: 없음 — 도메인 이벤트·메시지 큐를 두지 않는다
  // 감사 로그를 남기지 않는다 (POL OPS-003-01)
```

#### 데이터 변환 흐름

| 변환 지점 | 변환 위치 | 입력 형태 | 출력 형태 | 변환 규칙 요약 |
|----------|----------|----------|----------|--------------|
| 요청→도메인 | BE `B1` | `{ kind, trackingKey, resultCode?, at }` | 계기 값 | 열거형 검증 · 추적 키 무변형 |
| ENT→도메인 | BE `B2` | `tbl_interlock_tracking` 행 | [`MDL-001`](../datas/model_MDL-001.md) | 파생 4종 산출 — `isResultFixed`·`isSuccess`·`isResultConfirmed`·`isCallbackReceived` |
| 도메인→ENT | BE `B3` | 추적 키 | INSERT 행 | `tracking_key` 만 채우고 나머지는 NULL·기본값 |
| 도메인→ENT | BE `B4`·`B5`·`B6` | 결과 구분·일시 | 조건부 UPDATE | "비어 있을 때만" 조건절로 1회성 강제 |
| 도메인→응답 | BE `B7` | `MDL-001`·일시 | 계기별 반환 값 | 상위가 응답 DTO 로 다시 변환한다 |

- **파생 속성은 `ENT→도메인` 지점에서만 산출한다** — 저장 컬럼이 없으므로 쓰기 가능하게 두면 저장 값과 어긋난 상태가 만들어진다([`../datas/model_MDL-001.md`](../datas/model_MDL-001.md) §구현 가이드).

#### 단계 통합 흐름

| # | 레이어 | 단계명 | 직전 단계 출력 | 본 단계 처리 요지 | 다음 단계 입력 |
|---|--------|--------|--------------|----------------|---------------|
| 1 | 호출측 `C1` | 기록 계기 전달 | (상위 판단) | `kind`·추적 키·시각·`exec` 전달 · 트랜잭션 공유(`LOOKUP` 은 `exec` 없음) | 계기 |
| 2 | BE `B1` | 기록 계기 수신 | 계기 | 열거형 재검증 · 계기별 분기 | 분기 |
| 3 | BE `B2` | 추적 키 기준 사전 조회 | 추적 키 | 기본 키 단건 조회 → 3분기 판정 | `MDL-001`·`branch` |
| 4 | BE `B3` | 레코드 생성·이어쓰기 | `branch` | 없으면 INSERT(+요청 수 계수) · 충돌은 이어쓰기 | `MDL-001`·`isCreated` |
| 5 | BE `B4` | 결과 확정·기록 | 결과 구분 | 조건부 UPDATE + 결과 카운터 | 갱신 결과 |
| 6 | BE `B5` | 결과 확인 표시 | 응답 시각 | 조건부 UPDATE(결과 확정 행만) | 확인 일시 |
| 7 | BE `B6` | 완료 콜백 기록 | 수신 시각 | 조건부 UPDATE(결과 구분 불변) | 최초 수신 일시 |
| 8 | BE `B7` | 기록 결과 반환 | 계기별 결과 | 상위에 반환(이벤트 발행 없음) | 반환 값 |
| 9 | 호출측 `C2` | 결과 수령 | 반환 값 | 다음 분기 결정 · 실패는 상위가 되돌린다 | (상위 처리) |

9 단계 — 권장 12 단계 이내다. 한 호출은 `B2`~`B6` 중 **하나 또는 둘만** 수행한다(§진입점 표).

### 단계명 매핑

| 선행 도메인 단계명 | 출처 | 라벨 |
|---|---|---|
| 기록 계기 수신 | SVC-014 Happy Path 1 | `B1` |
| 추적 키 기준 사전 조회 | SVC-014 Happy Path 2 · `BIZ-002-03`·`DATA-004-02` | `B2` |
| 레코드 생성·이어쓰기 | SVC-014 Happy Path 3 · `BIZ-002-01` | `B3` |
| 결과 확정·기록 | SVC-014 Happy Path 4 · `BIZ-001-01`·`BIZ-001-04`·`BIZ-004-03` | `B4` |
| 결과 확인 표시 | `DATA-002-01` ① · BR-010 | `B5` |
| 완료 콜백 기록 | SVC-012 Happy Path · BR-012 | `B6` |
| 영속화 | `DATA-001-01`·`DATA-001-02` | `B3`~`B6` |

### 분기 및 예외 흐름

| 코드 | 발생 조건 | 처리 방향 | 결과 |
|------|----------|----------|------|
| BR-002 | `B2` 사전 조회 | 없음 / 있고 미확정 / 있고 확정 | 3분기 판정 |
| BR-021 | `B4`·`B6` 결과 확정 여부 | 미확정 → 결과 확정 / 확정 후 콜백 → 이어쓰기만 | 결과 구분 불변 |
| BR-010 | `B5` 결과 확인 최초 여부 | 비어 있고 결과 확정 → 표시 / 이미 표시 → 유지 | 보관 기산점 결정 |
| BR-012 | `B6` 최초·중복 수신 | 비어 있으면 기록 / 있으면 최초 값 유지 | 멱등 |
| BR-018 | `B3` 최초 생성 여부 | 생성 → 요청 수 +1 / 이어쓰기 → 계수 없음 | 지표 계수 계기 |
| `EX-BIZ-003` | 계기 값 위반 · 저장 실패 · 갱신 대상 소실 | 호출측 트랜잭션과 함께 되돌린다 | 500 (상위가 응답) |

- **본 프로세스는 4xx 를 만들지 않는다.** `branch = 'NONE'` 을 404 로 바꿀지는 호출측이 정한다(`BIZ-002-05`).

### 실행 결과

- **정상 결과**: 계기별 반환 값(`branch`·`record`·`isCreated`·일시). 영속화는 계기당 최대 1행이다.
- **실패 결과**: `EX-BIZ-003` — 호출측 트랜잭션이 되돌려지고 지표 갱신도 함께 취소된다. **결과를 확정하지 않는다.**
- **후속 트리거**: PROC-303(같은 트랜잭션 — 요청 수·결과 카운터) · PROC-304(보관 기산이 시작된 레코드가 삭제 대상이 된다).

### 의존 프로세스

- **호출 관계**: PROC-303(동기·같은 트랜잭션 — `B3`·`B4`).
- **선행 관계**: PROC-901(기동). 각 계기는 상위 프로세스의 판단이 선행한다.
- **이벤트 관계**: PROC-304 — 기록된 일시가 삭제 기준의 기산점이 된다.

### 구현 가이드

- **네 갱신을 모두 조건부 UPDATE 로 만든다.** 조회 후 응용 코드에서 판정하면 같은 추적 키의 동시 요청에서 값이 덮인다([`../datas/data_ENT-001.md`](../datas/data_ENT-001.md) §구현 가이드).
- **기본 키 충돌을 오류로 다루지 않는다.** 정상 재시도가 500 으로 끝나는 대표적 원인이다. **예외로 포착해 같은 트랜잭션에서 재조회하는 형태는 아예 실행되지 않는다** — 문 하나가 오류로 끝나면 그 트랜잭션은 중단 상태가 되어 되감기 전에는 뒤따르는 조회가 실행되지 않기 때문이다([`../functions/function_FN-007-008.md`](../functions/function_FN-007-008.md) FN-008 §구현 가이드).
- **새 트랜잭션을 열지 않는다.** 상위가 연 경계에 참여해야 레코드와 지표가 함께 커밋된다.
- **`at` 을 본 프로세스에서 새로 만들지 않는다.** 호출측이 준 시각을 그대로 써야 지표 일자와 기록 일시가 갈리지 않는다.
- **`branch = 'NONE'` 에 새 레코드를 만들지 않는다** — `SECURE` 계기만 생성 권한을 갖는다(`BIZ-002-03`).
- **조회 경로를 하나로 유지한다.** 부분 일치·정렬·다건 조회를 추가하면 인덱스 전략의 전제가 깨진다([`../datas/spec-datas.md`](../datas/spec-datas.md) §인덱스 전략).
