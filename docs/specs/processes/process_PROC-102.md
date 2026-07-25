# 본인확인(복호화 판정) 기능 정의

정본 목록은 [`spec-process.md`](spec-process.md). 단계 라벨 체계도 그 문서가 갖는다. 용어는 [`../../../wiki/WIKI.md`](../../../wiki/WIKI.md).

## 개요

- **정의 대상**: 사용자가 넣은 **생년월일로 전달 데이터가 복원되는지**를 판정하고, 최초 성공 시점에 연동 추적 레코드를 확보하는 처리다. 이 제품의 유일한 신원 확인 수단이며, 허브가 그 연동을 추적 키로 식별하게 되는 최초 시점이다.
- **관련 PRD 요구사항**:
	- [`../../prd/PRD.md`](../../prd/PRD.md) §제공 가치 — "전달 데이터는 이중 암호화(encX/encY)되어 전달되고 **사용자의 생년월일 입력으로만 복원**된다."
	- [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 9 — "연동 추적 키 기준 **단일 추적 레코드**를 **사용자가 진입한 시점에 생성**하고 …"

---

## PROC-102 본인확인(복호화 판정)

### 기본 정보

| 항목 | 내용 |
|------|------|
| 프로세스명 | 본인확인(복호화 판정) |
| 분류 | RR |
| 그룹 | 사용자 연동 본체 |
| 트리거 유형 | 화면 액션 — `SCR-001` [확인] 제출 |
| 처리 방식 | 동기 |
| 우선순위 | 높음 |
| 관련 IA 항목 | `USR-03` |

### 관련 사양 코드

| 구분 | 코드 | 관계 설명 |
|------|------|----------|
| 서비스(SVC) | SVC-002 | 본 프로세스가 구현하는 시나리오 |
| 정책(policy) | `AUTH-002-01`(`B3`)·`AUTH-002-02`(`B2`)·`AUTH-002-03`·`AUTH-002-04`(`B4a`) · `SEC-002-01`(`B3`)·`SEC-002-03`(`B4b`)·`SEC-002-04`(`B4a`)·`SEC-002-05`(`B7`·`B8`) · `SEC-001-01`~`07`(`B3`) · `BIZ-001-05`(`B4a`) · `BIZ-002-01`·`BIZ-002-03`(`B6`)·`BIZ-002-02`(`B4b`)·`BIZ-002-06`(`B5`) · `BIZ-005-02`(`B4b`·`B6`) · `DATA-001-03`(`B3`·`B5`)·`DATA-004-01`(`B5`) · `OPS-002-01`·`OPS-002-03`(위험 수용 확인) | 적용 규칙·지점 |
| 공통 기능(FN) | FN-005(`B2`) · FN-004(`B3`, 내부에서 FN-003·FN-001·FN-006 호출) · FN-008(`B6`) · FN-013(`B4b`·`B6`, PROC-303 경유) · FN-014·FN-015(`B7`·`B8`) | 호출하는 공통 로직 |
| 데이터 모델(MDL) | [`MDL-004`](../datas/model_MDL-004-006.md)·[`MDL-006`](../datas/model_MDL-004-006.md) 입력 · [`MDL-005`](../datas/model_MDL-004-006.md) 복원 원문 · [`MDL-001`](../datas/model_MDL-001.md) 레코드 · [`MDL-008`](../datas/model_MDL-007-010.md) 응답 · [`MDL-009`](../datas/model_MDL-007-010.md) 재안내 | 입출력 |
| DB 엔터티(ENT) | [`ENT-001`](../datas/data_ENT-001.md)(R·C — PROC-301 경유) · [`ENT-003`](../datas/data_ENT-003.md)(C·U — PROC-303 경유) | 조회·변경 대상 |
| 화면(SCR) | [`SCR-001`](../screens/screen_SCR-001.md) 트리거 · [`SCR-002`](../screens/screen_SCR-002.md)·[`SCR-004`](../screens/screen_SCR-004.md) 전이 대상 | 트리거·전이 화면 |

### 진입점 및 진입 조건

- **진입점**: `POST <INTERLOCK_ENTRY_PATH>/verify` — 요청 본문 `{ encX, encY, birthDate }`([`../functions/spec-functions-api-user.md`](../functions/spec-functions-api-user.md) §본인확인 제출).
- **진입 조건**: **인증 없음 — `AUTH-001` 인용.** 앞 단계(PROC-101)의 통과 사실도 신뢰하지 않는다 — 세션이 없으므로 매 요청이 처음처럼 검증된다.
- **요청 제한**: **미적용 — 수용 리스크**(`OPS-002-03`). **재입력 횟수 제한·잠금·지연을 두지 않는다**(`AUTH-002-04`).
- **사전 검증**: ① `birthDate` 형식(FN-005) ② 암호값 구조(FN-003 — FN-004 단계 0) ③ 복호화 판정 4단계(FN-004).

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 설명 |
|------|--------|------------|------|------|
| 입력 | `encX`·`encY` | string(Base64URL) | Y | 화면이 자기 URL 쿼리에서 읽어 다시 실어 온다([`MDL-004`](../datas/model_MDL-004-006.md)) |
| 입력 | `birthDate` | string(6) | Y | `yyMMdd` 숫자 6자리([`MDL-006`](../datas/model_MDL-004-006.md)). 서버가 보관하지 않는다 |
| 출력 | `stage` | string | - | `CONSENT` 또는 `RESULT` |
| 출력 | `consent` | [`MDL-008`](../datas/model_MDL-007-010.md) | N | `stage = CONSENT` 일 때만. 상수 파싱 결과를 그대로 싣는다 |
| 출력 | `resultPath`·`isReAnnouncement` | number·boolean | N | `stage = RESULT`(확정 결과 재안내)일 때만([`MDL-009`](../datas/model_MDL-007-010.md)) |

### 연관 데이터 및 외부 호출

- **호출 API**: 없음. 외부 시스템을 부르지 않는다.
- **데이터 조회 대상**: [`ENT-001`](../datas/data_ENT-001.md) 기본 키 단건 조회 — PROC-301 `B2`(FN-007)가 수행한다.
- **데이터 변경 대상(CRUD)**: [`ENT-001`](../datas/data_ENT-001.md) INSERT 1건(최초 성공 시) · [`ENT-003`](../datas/data_ENT-003.md) 카운터 UPSERT 1건. 둘 다 PROC-301·PROC-303 이 수행하며 **같은 트랜잭션**이다.

### 실행 제약사항

- **트랜잭션 경계**: `B6` 이 **단일 트랜잭션** — 레코드 생성(PROC-301)과 요청 수 계수(PROC-303)를 함께 커밋한다. 한쪽이 실패하면 함께 되돌린다(`SVC-014` F-008). `B2`~`B5` 는 트랜잭션 밖의 순수 계산이다.
- **동시성 제어**: 같은 추적 키의 동시 진입은 **기본 키 충돌을 정상 경로로 흡수**한다(FN-008 단계 4 — 충돌 시 이어쓰기로 수렴). 응용 락을 별도로 잡지 않는다.
- **멱등성**: 같은 요청을 여러 번 보내도 레코드는 하나이고 요청 수도 한 번만 오른다 — 두 번째부터는 `OPEN` 이어쓰기라 `isCreated = false` 다(`BIZ-005-03`).
- **성능 요구**: 복호화 2회(AES-256-CBC)와 단건 조회 1회. 사용자가 화면에서 기다리는 구간이므로 외부 호출을 넣지 않는다.
- **보안 요구**: **인증 없음**(`AUTH-001`). 응답·로그에 추적 키·복호화 원문·암호값·생년월일·정규화 키를 담지 않는다(FN-015). **실패 단계 번호를 응답에 담지 않는다**(`SEC-002-05`).

### 로직 실행 순서

#### FE 측 처리 (의사코드)

```
F1. 제출 트리거 → 화면 검증 → 요청 DTO 변환

  진입 트리거: SCR-001 [확인] 버튼 click 또는 입력 필드 Enter
  사용 상태:
    form.birthDate = 로컬 상태<string>(최대 6자·숫자만)
    encPair        = PROC-101 F2 가 URL 쿼리에서 읽어 보유 중인 { encX, encY }
    alert          = 로컬 상태<{ kind, message } | null>
  검증 (POL AUTH-002-02 — 화면 검증은 편의이고 판정 근거는 서버):
    if (!/^\d{6}$/.test(form.birthDate))
        → alert = { kind: 'FORMAT', message: "생년월일을 여섯 자리 숫자로 입력해 주세요." }
        → 필드 포커스 → 중단
    // 달력 유효성(존재하지 않는 월·일)은 검사하지 않는다 (FN-005 §구현 가이드)
  요청 DTO 변환 (FE 어댑터):
    payload = { encX: encPair.encX, encY: encPair.encY, birthDate: form.birthDate }
    // 트림·포맷 변환을 하지 않는다 — 값을 그대로 싣는다
  호출 수단:
    변경 호출(mutation) → POST <INTERLOCK_ENTRY_PATH>/verify (payload)
    캐시 키를 두지 않는다 — 조회가 아니고 재사용할 응답도 없다
  진행 중 UI:
    확인 버튼에 진행 표시 + 문구 "확인 중" · 입력 필드 잠금 · 중복 클릭·엔터 연타 차단
  정책 적용 지점: DATA-001-02 — birthDate 를 저장소·URL·숨은 필드에 쓰지 않는다

F2. 성공 응답 처리 → 단계 전이

  onSuccess(res):
    if (res.stage == 'CONSENT')
        consent = res.consent                 // MDL-008 을 가공하지 않고 그대로 보관
        단계 전이 → SCR-002 (PROC-103 F1 이 이어받는다)
    if (res.stage == 'RESULT')
        resultInfo = { resultPath: res.resultPath, isReAnnouncement: res.isReAnnouncement }
        단계 전이 → SCR-004 (PROC-105 F1)
  캐시·전역 상태 갱신: 없음 — 전역 store 를 두지 않는다(세션이 없다)
  폼 처리: 생년월일은 페이지 메모리에 그대로 유지한다 — 승인 요청이 다시 실어 온다

F3. 실패 응답 처리

  onError(err):                                 // err.code = 오류 응답 엔벨로프의 code
    if (err.code == 'EX-AUTH-001')  alert = 형식 안내      · 단계 유지 · 필드 포커스
    if (err.code == 'EX-AUTH-002')  alert = 재입력 안내    · 단계 유지 · 값 유지 + 전체 선택
    if (err.code == 'EX-BIZ-003')   alert = 재시도 안내    · 단계 유지 · 버튼 재활성
    if (err.code in ['EX-SEC-001','EX-SEC-002'])
        단계 전이 → SCR-004 결과 경로 ③ (사유 코드로 설명 문구만 고른다)
    if (그 밖)                       단계 전이 → SCR-004 결과 경로 ③
  재시도 정책: 화면이 자동으로 다시 보내지 않는다. 사용자가 다시 누른다
  표시 금지: 시도 횟수·남은 횟수·내부 단계 (POL AUTH-002-04 · SEC-002-05)
```

#### BE 측 처리 (의사코드)

```
B1. POST <INTERLOCK_ENTRY_PATH>/verify 진입

  인증·인가 검증: 인증 없음 — AUTH-001 인용 (401·403 을 정의하지 않는다)
  요청 제한: 미적용 — 수용 리스크 (OPS-002-03)
  본문 해석 불가 → 400 EX-AUTH-001 (입력 부재와 같이 다룬다)

B2. 입력 검증 — FN-005 · POL AUTH-002-02 (validate)

  try  FN-005(body.birthDate)                   // ^[0-9]{6}$
  catch                                         → 400 EX-AUTH-001, 복호화 미시도, 종료
  // FE 검증과 같은 항목을 서버가 다시 본다. 우선순위는 서버 판정이다

B3. 복호화 판정 — FN-004 · POL SEC-002-01 (validate)

  try  payload = FN-004({ encX: body.encX, encY: body.encY }, body.birthDate)
       // 내부: FN-003 구조 판정 → FN-001 키 정규화 → encY 복호화 → encX 복호화
       //       → UTF-8 JSON 파싱 → FN-006 trackingKey 형식 판정
  catch (EX-SEC-001)   → B4b (구조 위반 — 진입 단계 실패와 같은 취급)
  catch (EX-AUTH-002)  → B4a (판정 1·2단계 실패)
  catch (EX-SEC-002)   → B4b (판정 3·4단계 실패)
  정책 적용 지점: DATA-001-03 — 키·초기화 벡터·평문은 지역 값으로만 둔다

B4a. 본인확인 실패 처리 — POL SEC-002-04 · AUTH-002-03 · BIZ-001-05 (validate)

  // 생년월일 불일치와 구별할 수 없으므로 전부 본인확인 실패로 분류한다
  결과 구분을 확정하지 않는다 · 추적 레코드를 만들지 않는다 · 지표를 계수하지 않는다
  return 400 FN-014('EX-AUTH-002')              // 재입력 안내 · 횟수 제한 없음

B4b. 규약 위반·구조 위반 처리 — POL BIZ-002-02 · BIZ-005-02 ② (트랜잭션)

  // 추적 키를 알 수 없다 → 레코드를 만들지 않고 지표만 계수한다
  if (code == 'EX-SEC-002')
      PROC-303({ kind: 'UNIDENTIFIED_FAILURE', at: NOW() })   // 요청 수 +1 · DECRYPT_FAILED +1
  if (code == 'EX-SEC-001')
      // 진입 단계에서 이미 계수됐을 수 있으나 같은 요청인지 판정할 수단이 없다.
      // 시도마다 계수되는 중복은 수용 한계다 (POL BIZ-005-05)
      PROC-303({ kind: 'UNIDENTIFIED_FAILURE', at: NOW() })
  return 400 FN-014(code)                       // 화면은 결과 경로 ③ 으로 간다

B5. 추적 키 추출 → 원문 즉시 폐기 — POL BIZ-002-06 · DATA-004-01 (transform)

  trackingKey = payload.trackingKey             // 무변형 (파싱·정규화하지 않는다)
  payload 를 지역 변수에서 버린다               // 세션·캐시·저장소 어디에도 남기지 않는다
  // 승인 시점에는 PROC-104 B2 가 다시 복호화한다 (요청 간 보존 금지 — DATA-001-03)

B6. 추적 레코드 확보 — PROC-301 호출 · POL BIZ-002-01 · BIZ-002-03 (트랜잭션 시작)

  BEGIN ISOLATION LEVEL READ COMMITTED;
    secured = PROC-301({ kind: 'SECURE', trackingKey, at: NOW() })
        // PROC-301 B2: SELECT … FROM tbl_interlock_tracking WHERE tracking_key = :trackingKey
        // PROC-301 B3: 없으면 INSERT (기본 키 충돌은 이어쓰기로 흡수)
        //              생성 시 PROC-303 B3 이 request_count +1 (같은 트랜잭션)
    // 실패 → ROLLBACK → 500 EX-BIZ-003 (결과 미확정 · 사용자는 다시 시도할 수 있다)
  COMMIT;
  // 결과: secured.branch = 'OPEN' | 'FIXED' · secured.isCreated

B7. 확정 결과 재안내 분기 — POL BIZ-002-03 ③ · BIZ-002-04 (validate)

  if (secured.branch == 'FIXED')
      resultInfo = PROC-105({ source: 'RECORD', record: secured.record, isReAnnouncement: true })
      // 레코드를 갱신하지 않는다 (보관 기산점이 밀리지 않는다)
      // 요청 수를 계수하지 않는다 (POL BIZ-005-03)
      return 200 { stage: 'RESULT', resultPath: resultInfo.resultPath, isReAnnouncement: true }

B8. 동의 항목 구성 응답 (다음 단계 이관) — POL DATA-003-01 · SEC-002-05 (mask)

  consent = PROC-901 이 기동 시 산출한 MDL-008 을 그대로 읽는다 (재파싱하지 않는다)
  body    = { stage: 'CONSENT',
              consent: { version: consent.version, notice: consent.notice, items: consent.items } }
  마스킹: FN-015 — 추적 키·복호화 원문·암호값·생년월일을 담지 않는다
  return 200 body
  후속 이벤트 발행: 없음 (동기 처리로 끝난다)
```

#### 데이터 변환 흐름

| 변환 지점 | 변환 위치 | 입력 형태 | 출력 형태 | 변환 규칙 요약 |
|----------|----------|----------|----------|--------------|
| FE→요청 | FE `F1` | `form.birthDate` + 보유 `encPair` | 요청 DTO `{ encX, encY, birthDate }` | 값 그대로 · 트림·포맷 변환 없음 |
| 요청→도메인 | BE `B2`·`B3` | 요청 DTO | `MDL-005` 전달 데이터 X | FN-005 형식 검증 → FN-004 복호화 판정 4단계 |
| 도메인→도메인 | BE `B5` | `MDL-005` | `trackingKey`(문자열) | 추적 키만 취하고 원문 폐기(`BIZ-002-06`) |
| 도메인→ENT | BE `B6` (PROC-301) | `trackingKey` | `tbl_interlock_tracking` 행 | `tracking_key` 만 채우고 나머지는 기본값 |
| ENT→도메인 | BE `B6` (PROC-301) | ENT-001 행 | [`MDL-001`](../datas/model_MDL-001.md) | 파생 4종 산출(`isResultFixed` 등) |
| 도메인→응답 | BE `B7`·`B8` | `MDL-001` 또는 `MDL-008` | 응답 DTO | 확정이면 `MDL-009` 경로 · 아니면 동의 항목 구성. FN-015 정제 |
| 응답→FE | FE `F2` | 응답 DTO | 화면 상태 | `stage` 로 전이 대상 결정 · `consent` 무가공 보관 |

#### 단계 통합 흐름

| # | 레이어 | 단계명 | 직전 단계 출력 | 본 단계 처리 요지 | 다음 단계 입력 |
|---|--------|--------|--------------|----------------|---------------|
| 1 | FE `F1` | 제출·화면 검증·DTO 변환 | (사용자 입력) | `^\d{6}$` 검증 + 요청 DTO 구성 | 요청 DTO |
| 2 | BE `B1` | 요청 수신 | 요청 DTO | 인증 없음·요청 제한 없음 | 요청 DTO |
| 3 | BE `B2` | 입력 검증 | 요청 DTO | FN-005 — 위반 `EX-AUTH-001` | 검증 통과 값 |
| 4 | BE `B3` | 복호화 판정 | 검증 통과 값 | FN-004 4단계 | `MDL-005` 또는 EX 코드 |
| 5 | BE `B4a`/`B4b` | 실패 분류 | EX 코드 | 1·2단계=재입력 / 3·4단계=계수 후 경로 ③ | 400 응답 |
| 6 | BE `B5` | 추적 키 추출·원문 폐기 | `MDL-005` | 추적 키만 취하고 X 폐기 | `trackingKey` |
| 7 | BE `B6` | 추적 레코드 확보 | `trackingKey` | PROC-301(+PROC-303) 단일 트랜잭션 | `MDL-001`·분기 |
| 8 | BE `B7` | 확정 재안내 분기 | 분기 | `FIXED` 면 PROC-105 로 재안내 | 응답 DTO |
| 9 | BE `B8` | 동의 항목 구성 응답 | `MDL-008` | 상수 파싱 결과 그대로 · FN-015 정제 | 응답 DTO |
| 10 | FE `F2`/`F3` | 응답 처리·전이 | 응답 DTO | `CONSENT`→SCR-002 / `RESULT`→SCR-004 / 오류→안내 | (다음 프로세스) |

10 단계 — 권장 12 단계 이내다.

### 단계명 매핑

| 선행 도메인 단계명 | 출처 | 라벨 |
|---|---|---|
| 입력 검증 | SVC-002 Happy Path · `AUTH-002-02` | `B2` |
| 복호화 판정 | SVC-002 · `SEC-002-01` · `AUTH-002-01` | `B3` |
| 복호화 판정 1·2단계 | `SEC-002-04`·`AUTH-002-03`·`BIZ-001-05` | `B4a` |
| 복호화 판정 3·4단계 | `SEC-002-03`·`BIZ-002-02` | `B4b` |
| 복호화 결과 처리 · 추적 키 추출 | `BIZ-002-06`·`DATA-004-01` | `B5` |
| 본인확인 성공 후 레코드 확보 | `BIZ-002-01` | `B6` |
| 추적 키 기준 사전 조회 | SVC-002 · `BIZ-002-03` | `B6`(PROC-301 `B2`) |
| 요청 수 계수 | SVC-002 · `BIZ-005-02` ① | `B6`(PROC-303 `B3`) |
| 재입력 안내 | `AUTH-002-04` | `B4a` → `F3` |
| 응답 구성 | `SEC-002-05` | `B7`·`B8` |
| 다음 단계 이관 | SVC-002 Happy Path | `B8` → `F2` |

### 분기 및 예외 흐름

| 코드 | 발생 조건 | 처리 방향 | 결과 |
|------|----------|----------|------|
| BR-002 | `B6` 사전 조회 3분기 | 없음 → 생성 / 있고 미확정 → 이어쓰기 / 있고 확정 → `B7` 재안내 | 정상 진행 또는 확정 결과 재안내 |
| BR-003 | `B4a` 본인확인 실패 | 재입력 안내로 되돌린다. **횟수 제한 없음** | `SCR-001` 유지 |
| BR-018 | `B4b`·`B6` 요청 수 계수 시점 | 레코드 최초 생성 / 추적 키 미확보 실패 | 요청 수 +1 |
| `EX-AUTH-001` | `birthDate` 부재·숫자 6자리 아님 | 복호화 미시도·결과 미확정 | 400 · `SCR-001` 유지 |
| `EX-AUTH-002` | 판정 1·2단계 실패 | 재입력 안내·기록 없음 | 400 · `SCR-001` 유지 |
| `EX-SEC-001` | 암호값 구조 위반 | 지표만 계수 | 400 · 결과 경로 ③ |
| `EX-SEC-002` | 판정 3·4단계 실패 | `DECRYPT_FAILED` 계수(레코드 미생성) | 400 · 결과 경로 ③ |
| `EX-BIZ-003` | 레코드 확보·지표 계수 실패 | 트랜잭션 되돌림·결과 미확정 | 500 · 재시도 가능 |
| `EX-OPS-002` | 위로 분류되지 않는 내부 실패 | 내부 사유·스택을 담지 않는다 | 500 |

### 실행 결과

- **정상 결과**: 200 `{ stage: 'CONSENT', consent }`. 영속화 — `ENT-001` 행 1건(최초 성공 시) · `ENT-003` `request_count` +1. 재진입·재시도이면 영속화 없음.
- **확정 재안내 결과**: 200 `{ stage: 'RESULT', resultPath, isReAnnouncement: true }`. **어떤 컬럼도 갱신하지 않고 계수도 하지 않는다.**
- **실패 결과**: 400·500 오류 응답 엔벨로프. `EX-SEC-001`·`EX-SEC-002` 는 지표 계수만 남긴다.
- **후속 트리거**: PROC-103(사용자가 동의·승인을 제출하면) · PROC-105(재안내·경로 ③).

### 의존 프로세스

- **호출 관계**: PROC-301(동기·트랜잭션 참여 — 레코드 확보) · PROC-303(PROC-301 경유 및 실패 계수) · PROC-105(동기 — 결과 경로 산출).
- **선행 관계**: PROC-101(진입 판정 통과) · PROC-901(동의 항목 구성·상수 준비).
- **이벤트 관계**: PROC-103 — 화면이 다음 제출을 수행한다.

### 구현 가이드

- **판정 절차를 자체 구현하지 않는다.** FN-004 하나를 본인확인·연동 실행·자가진단이 공유해야 "자가진단이 통과시킨 값이 연동에서 실패"하는 사고가 생기지 않는다(`SEC-002` 구현 가이드).
- **`EX-AUTH-002` 와 `EX-SEC-002` 의 경계를 코드에서 흐리지 않는다.** 전자는 재입력, 후자는 결과 확정 없는 종료 + 계수다. 두 갈래를 한 catch 로 묶으면 지표가 오염된다.
- **추적 키를 얻은 뒤 원문을 즉시 버린다.** 요청 컨텍스트 저장소·전역 상태에 올려 두면 `DATA-001-03` 위반이다.
- **레코드 확보와 요청 수 계수를 같은 트랜잭션에 둔다.** 경계가 갈리면 요청 수가 실제 레코드 수와 어긋난다.
- **`FIXED` 분기에서 아무것도 쓰지 않는다.** 재안내에서 `result_confirmed_at` 이나 갱신 일시를 건드리면 보관 기산점이 밀린다(`BIZ-002-04`).
