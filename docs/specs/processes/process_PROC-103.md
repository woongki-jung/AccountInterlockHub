# 동의·승인 제출 기능 정의

정본 목록은 [`spec-process.md`](spec-process.md). 단계 라벨 체계도 그 문서가 갖는다. 용어는 [`../../../wiki/WIKI.md`](../../../wiki/WIKI.md).

## 개요

- **정의 대상**: 상수로 고정된 동의 항목을 사용자에게 그대로 보여 주고, **승인 또는 거부 제출을 받아 연동을 진행할지 결정**하는 처리다. 승인 제출 하나가 재복호화·증적 기록·수신처 전달·결과 확정을 차례로 발화시키는 **오케스트레이션 지점**이다.
- **관련 PRD 요구사항**:
	- [`../../prd/PRD.md`](../../prd/PRD.md) §제공 가치 — "**동의 기반 투명성**: 사용자가 어떤 항목에 동의하는지 화면에서 확인하고 스스로 승인·거부를 결정한다."
	- [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 4 — "… 상수로 고정된 **동의 항목 노출·동의 후 승인 또는 거부**."

---

## PROC-103 동의·승인 제출

### 기본 정보

| 항목 | 내용 |
|------|------|
| 프로세스명 | 동의·승인 제출 |
| 분류 | RR · WF |
| 그룹 | 사용자 연동 본체 |
| 트리거 유형 | 화면 액션 — `SCR-002` [동의하고 연동하기] · [동의하지 않고 종료] |
| 처리 방식 | 동기 |
| 우선순위 | 높음 |
| 관련 IA 항목 | `USR-04` |

### 관련 사양 코드

| 구분 | 코드 | 관계 설명 |
|------|------|----------|
| 서비스(SVC) | SVC-003 | 본 프로세스가 구현하는 시나리오 |
| 정책(policy) | `BIZ-003-01`(`F1`·`F2`)·`BIZ-003-02`(`B5b`)·`BIZ-003-03`(`B5a`)·`BIZ-003-04`(`B6`) · `DATA-003-01`·`DATA-003-05`(`F1`)·`DATA-003-04`(`B6`) · `BIZ-002-03`·`BIZ-002-04`(`B3`·`B4`) · `BIZ-001-01`·`BIZ-001-04`(`B5a`) · `AUTH-001-02`(`B1`) · `DATA-001-05`(`F1`) | 적용 규칙·지점 |
| 공통 기능(FN) | FN-012(`B6`, PROC-302 경유) · FN-009(`B5a`, PROC-301 경유) · FN-008(`B3`, PROC-301 경유) · FN-013(PROC-303 경유) · FN-014·FN-015(응답) | 호출하는 공통 로직 |
| 데이터 모델(MDL) | [`MDL-007`](../datas/model_MDL-007-010.md) 제출 · [`MDL-008`](../datas/model_MDL-007-010.md) 동의 항목 구성 · [`MDL-004`](../datas/model_MDL-004-006.md)·[`MDL-006`](../datas/model_MDL-004-006.md) 재수신 값 · [`MDL-002`](../datas/model_MDL-002.md) 증적 · [`MDL-009`](../datas/model_MDL-007-010.md) 결과 | 입출력 |
| DB 엔터티(ENT) | [`ENT-001`](../datas/data_ENT-001.md)(R·C·U — PROC-301) · [`ENT-002`](../datas/data_ENT-002.md)(C — PROC-302) · [`ENT-003`](../datas/data_ENT-003.md)(C·U — PROC-303) | 조회·변경 대상 |
| 화면(SCR) | [`SCR-002`](../screens/screen_SCR-002.md) 트리거 · [`SCR-003`](../screens/screen_SCR-003.md) 대기 · [`SCR-001`](../screens/screen_SCR-001.md)·[`SCR-004`](../screens/screen_SCR-004.md) 전이 | 트리거·전이 화면 |

### 진입점 및 진입 조건

- **진입점**: `POST <INTERLOCK_ENTRY_PATH>/approve` — 요청 본문 `{ encX, encY, birthDate, decision, agreedItemCodes }`([`../functions/spec-functions-api-user.md`](../functions/spec-functions-api-user.md) §동의·승인 제출).
- **진입 조건**: **인증 없음 — `AUTH-001` 인용.** 본인확인 통과 사실을 서버가 기억하지 않으므로 **승인 요청이 생년월일과 암호값을 다시 실어 오고, 서버는 매번 처음처럼 검증한다**(§생년월일 재수신 규약).
- **요청 제한**: **미적용 — 수용 리스크**(`OPS-002-03`).
- **사전 검증**: ① `birthDate` 형식(PROC-104 `B1`) ② 재복호화 판정(PROC-104 `B2`) ③ 추적 레코드 확보(PROC-301) ④ 승인일 때만 필수 동의 충족(`B5b`).

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 설명 |
|------|--------|------------|------|------|
| 입력 | `encX`·`encY` | string(Base64URL) | Y | 화면이 URL 쿼리에서 읽어 다시 싣는다 |
| 입력 | `birthDate` | string(6) | Y | **재수신 값**. 서버는 요청 사이에 보관하지 않는다 |
| 입력 | `decision` | string | Y | `APPROVE` · `REJECT` (대소문자 구분·두 값 밖은 400) |
| 입력 | `agreedItemCodes` | string[] | Y | 동의한 항목 코드. 거부면 빈 배열이어도 검증하지 않는다 |
| 출력 | `resultPath` | number | - | `1`·`2`·`4` ([`MDL-009`](../datas/model_MDL-007-010.md)) |
| 출력 | `isReAnnouncement` | boolean | - | 확정 결과 재안내 여부 |

### 연관 데이터 및 외부 호출

- **호출 API**: 없음(직접). 수신처 전달은 **PROC-104 `B4`** 가 수행한다.
- **데이터 조회 대상**: [`ENT-001`](../datas/data_ENT-001.md) 기본 키 단건 조회(PROC-301 `B2`).
- **데이터 변경 대상(CRUD)**: [`ENT-002`](../datas/data_ENT-002.md) INSERT 1건(승인 시) · [`ENT-001`](../datas/data_ENT-001.md) 결과 확정 UPDATE 1건 · [`ENT-003`](../datas/data_ENT-003.md) 결과 카운터 +1.

### 실행 제약사항

- **트랜잭션 경계**: **다중 트랜잭션**이다. ① `B3` 레코드 확보(+요청 수 계수) ② `B5a` 거부 결과 확정(+카운터) ③ `B6` 동의 증적 기록 ④ `B7` 이후 전달 결과 확정(+카운터). **수신처 전달 호출은 어떤 트랜잭션에도 들어가지 않는다** — 재시도 총 소요 상한(`BIZ-004-02`)만큼 연결을 점유시키기 때문이다.
- **동시성 제어**: 같은 추적 키의 동시 승인은 **추적 레코드 행을 잠근 상태에서 처리**해 중복 증적을 막는다([`../datas/data_ENT-002.md`](../datas/data_ENT-002.md) §구현 가이드). 결과 확정은 조건부 UPDATE 로 한 번만 성립한다(`BIZ-001-04`).
- **멱등성**: 같은 승인이 두 번 오면 두 번째는 `FIXED` 분기로 수렴해 **아무것도 갱신하지 않고 확정 결과를 재안내**한다(`BIZ-002-04`).
- **성능 요구**: 사용자가 `SCR-003` 에서 기다리는 구간이다. 전달 재시도 총 소요 상한은 `BIZ-004-02` 가 정한다.
- **보안 요구**: **인증 없음**(`AUTH-001`). 응답·로그에 추적 키·복호화 원문·암호값·생년월일을 담지 않는다(FN-015).
- **보상 처리**: **보상 트랜잭션을 두지 않는다.** 전달 성공 후 결과 확정이 실패하면 허브가 수신처에 취소를 보낼 수단이 없다 — 결과 미확정으로 끝나고 사용자가 다시 시도한다([`process_PROC-104.md`](process_PROC-104.md) §실행 제약사항).

### 로직 실행 순서

#### FE 측 처리 (의사코드)

```
F1. 동의 항목 구성·렌더 — POL DATA-003-01 · DATA-003-05 (mask)

  진입 트리거: PROC-102 F2 가 stage = 'CONSENT' 로 전이시킨 직후 (SCR-002 mount)
  사용 상태:
    consent = 직전 응답의 MDL-008 { version, notice, items[] }   // 가공하지 않는다
    agreed  = 로컬 상태<Set<string>>(초기값 빈 집합)
  렌더 규칙:
    notice 가 빈 문자열이면 안내 영역을 그리지 않는다 (EXC-BIZ-07)
    items 는 응답이 준 순서 그대로 (이미 code 오름차순)
    items[].required == true 이면 `필수` 배지
  표시 금지: consent.version · 추적 키 · 암호값 · 생년월일 (POL DATA-001-04)
  정책 적용 지점: DATA-003-05 — 문구를 자르거나 다시 쓰지 않는다(증적 스냅샷과 어긋난다)

F2. 동의 선택 → 승인 버튼 활성 판정 — POL BIZ-003-01 (validate)

  onToggle(code): agreed 에 code 를 넣거나 뺀다
  canApprove = consent.items.filter(i => i.required).every(i => agreed.has(i.code))
  승인 버튼 활성 = canApprove       // 1차 방어. 판정 근거는 서버 재검증이다
  거부 버튼은 항상 활성

F3. 승인 제출

  진입 트리거: [동의하고 연동하기] click
  요청 DTO 변환:
    payload = { encX: encPair.encX, encY: encPair.encY, birthDate: form.birthDate,
                decision: 'APPROVE', agreedItemCodes: Array.from(agreed) }
    // decision 은 버튼이 확정 값을 보낸다 — 화면이 값을 조합하지 않는다
  호출: 변경 호출(mutation) → POST <INTERLOCK_ENTRY_PATH>/approve (payload)
  진행 중 UI: 카드 내용을 SCR-003 진행 화면으로 교체 (PROC-104 F1 이 이어받는다)
  중복 발신 차단: 요청은 한 번만 보낸다. 화면이 자동으로 다시 보내지 않는다

F4. 거부 제출

  진입 트리거: [동의하지 않고 종료] click
  요청 DTO 변환: payload = { …, decision: 'REJECT', agreedItemCodes: Array.from(agreed) }
  진행 중 UI: 버튼 안 진행 표시 · 목록 잠금 · 단계 유지
             // 진행 화면으로 넘기지 않는다 — 전달·증적이 없어 기다림이 없다 (BIZ-003-03)

F5. 응답 처리 → 단계 전이

  onSuccess(res): 단계 전이 → SCR-004 (resultPath · isReAnnouncement 를 그대로 전달)
  onError(err):
    if (err.code == 'EX-BIZ-001')  알림 "필수 동의 항목에 모두 동의해 주세요."
                                   + 첫 미충족 항목 포커스 · 단계 유지
    if (err.code == 'EX-BIZ-003')  재시도 안내 · 버튼 재활성 · 단계 유지
    if (err.code in ['EX-AUTH-001','EX-AUTH-002'])  단계 전이 → SCR-001 (재입력 안내)
    if (err.code == 'EX-BIZ-002')  단계 전이 → SCR-004 결과 경로 ④ (정상 종료다)
    if (err.code in ['EX-SEC-001','EX-SEC-002'])    단계 전이 → SCR-004 결과 경로 ③
  본인확인으로 되돌아가면 agreed 를 비운다 — 승인은 제출 시점의 명시적 행위다
```

#### BE 측 처리 (의사코드)

```
B1. POST <INTERLOCK_ENTRY_PATH>/approve 진입

  인증·인가 검증: 인증 없음 — AUTH-001 인용 (401·403 미정의)
  요청 제한: 미적용 — 수용 리스크 (OPS-002-03)
  입력 DTO 재검증 (형상만 — 값 판정은 뒤 단계):
    if (decision not in ['APPROVE','REJECT'])   → 400 FN-014('EX-BIZ-001')
    if (agreedItemCodes 가 문자열 배열이 아니다) → 400 FN-014('EX-BIZ-001')
    본문 해석 불가                               → 400 FN-014('EX-BIZ-001')

B2. 복호화 구간 호출 — PROC-104 B1·B2 (동기)

  gate = PROC-104.복호화구간({ encX, encY, birthDate })
      // B1 FN-005 형식 검증 → 위반 400 EX-AUTH-001 (승인·거부 공통)
      // B2 FN-004 재복호화  → 1·2단계 실패 400 EX-AUTH-002 (본인확인 재입력으로 되돌린다)
      //                      3·4단계 실패 400 EX-SEC-002 + PROC-303 UNIDENTIFIED_FAILURE
  결과: gate.trackingKey · gate.payload(MDL-005 · 메모리 전용)
  정책 적용 지점: BIZ-002-06 — 본인확인 때의 원문을 재사용하지 않고 다시 복원한다

B3. 추적 레코드 확보 — PROC-301 호출 · POL BIZ-002-03 (트랜잭션)

  BEGIN;
    secured = PROC-301({ kind: 'SECURE', trackingKey: gate.trackingKey, at: NOW() })
        // 이미 있으면 이어쓰기(OPEN) — 요청 수를 다시 올리지 않는다
  COMMIT;                                        // 실패 → 500 EX-BIZ-003

B4. 확정 결과 재안내 분기 — POL BIZ-002-04 (validate)

  if (secured.branch == 'FIXED')
      gate.payload 를 폐기한다
      resultInfo = PROC-105({ source: 'RECORD', record: secured.record, isReAnnouncement: true })
      return 200 { resultPath: resultInfo.resultPath, isReAnnouncement: true }
      // 갱신·계수·증적·전달 어느 것도 수행하지 않는다

B5a. 거부 처리 — POL BIZ-003-03 (트랜잭션)

  if (decision == 'REJECT')
      gate.payload 를 폐기한다                    // 전달하지 않으므로 즉시 버린다
      BEGIN;
        PROC-301({ kind: 'FIX_RESULT', trackingKey, resultCode: 'USER_DENIED', at: NOW() })
            // 조건부 UPDATE + PROC-303 user_denied_count +1 (같은 트랜잭션)
      COMMIT;                                     // 실패 → 500 EX-BIZ-003
      // 동의 증적을 만들지 않는다 · 수신처 전달을 수행하지 않는다
      → B8 (결과 경로 ②)

B5b. 승인 요청 재검증 — POL BIZ-003-02 (validate)

  consent = PROC-901 이 기동 시 산출한 MDL-008
  if (agreedItemCodes 에 consent.items 의 코드가 아닌 값이 있다) → 400 FN-014('EX-BIZ-001')
  missing = consent.items.filter(i => i.required && !agreedItemCodes.includes(i.code))
  if (LENGTH(missing) > 0)                        → 400 FN-014('EX-BIZ-001')
      // 결과를 확정하지 않고 동의 화면으로 되돌린다. 화면 판단을 신뢰하지 않는다
  // 선택 항목의 체크 여부는 승인을 막지 않는다 (EXC-BIZ-06)

B6. 승인 확정·동의 증적 기록 — PROC-302 호출 · POL BIZ-003-04 (트랜잭션)

  BEGIN;
    -- 같은 추적 키의 동시 승인을 직렬화한다 (ENT-002 §구현 가이드)
    SELECT tracking_key FROM tbl_interlock_tracking
    WHERE tracking_key = :trackingKey
    FOR UPDATE;

    proof = PROC-302({ trackingKey, submission: { decision, agreedItemCodes },
                       consent, at: NOW() })
        // PROC-302 B4: INSERT INTO tbl_consent_proof (…) VALUES (…)
  COMMIT;
  실패 → 500 FN-014('EX-BIZ-003')
         // 결과를 확정하지 않고 수신처 전달도 수행하지 않는다 (BIZ-003-04)
         // 사용자는 다시 시도할 수 있다

B7. 연동 실행 이관 — PROC-104 전달 구간 호출 (동기)

  outcome = PROC-104.전달구간({ trackingKey, payload: gate.payload })
      // B3 전달 페이로드 구성 → B4 수신처 전달 호출 → B5 재시도
      // → B6 결과 확정(PROC-301 + PROC-303) → B7 원문 폐기
  결과: outcome.resultCode = 'SUCCESS' | 'DELIVERY_FAILED'

B8. 결과 안내 이관·응답 — PROC-105 호출 · POL SEC-002-05 (mask)

  resultInfo = PROC-105({ source: 'RESULT_CODE',
                          resultCode: (거부면 'USER_DENIED' 아니면 outcome.resultCode),
                          isReAnnouncement: false })
  if (resultInfo.resultPath == 4)
      return 502 FN-014('EX-BIZ-002')             // 결과 경로 ④ — 정상 종료이며 화면이 code 로 경로를 고른다
  else
      return 200 FN-015({ resultPath: resultInfo.resultPath, isReAnnouncement: false })
  후속 이벤트 발행: 없음. 수신처의 완료 통지는 PROC-203 이 별도로 받는다
```

#### 데이터 변환 흐름

| 변환 지점 | 변환 위치 | 입력 형태 | 출력 형태 | 변환 규칙 요약 |
|----------|----------|----------|----------|--------------|
| FE→요청 | FE `F3`·`F4` | `agreed`(Set) + 보유 값 | 요청 DTO | Set → 배열 · `decision` 은 버튼이 확정 값을 실는다 |
| 요청→도메인 | BE `B1`·`B2` | 요청 DTO | `MDL-007` + `MDL-005` | 형상 검증 → PROC-104 재복호화로 추적 키 복원 |
| 도메인→ENT | BE `B6` (PROC-302) | `MDL-007` + `MDL-008` | `tbl_consent_proof` 행 | 스냅샷 구성(코드 오름차순) · 동의 코드 배열 분리 저장 |
| 도메인→ENT | BE `B5a`·`B7` (PROC-301) | 결과 구분 | `tbl_interlock_tracking` UPDATE | 조건부(`result_code IS NULL`) |
| ENT→도메인 | BE `B3` (PROC-301) | ENT-001 행 | [`MDL-001`](../datas/model_MDL-001.md) | 파생 4종 산출 |
| 도메인→응답 | BE `B8` | 결과 구분 | `MDL-009` | PROC-105 가 경로 번호 산출 · FN-015 정제 |
| 응답→FE | FE `F5` | 응답 DTO 또는 오류 엔벨로프 | 화면 상태 | `resultPath` 로 패널 선택 · `code` 로 되돌아갈 화면 결정 |

#### 단계 통합 흐름

| # | 레이어 | 단계명 | 직전 단계 출력 | 본 단계 처리 요지 | 다음 단계 입력 |
|---|--------|--------|--------------|----------------|---------------|
| 1 | FE `F1`·`F2` | 동의 항목 구성·선택 | `MDL-008` | 상수 그대로 렌더 + 필수 충족 판정 | `agreed` |
| 2 | FE `F3`/`F4` | 승인·거부 제출 | `agreed` | 요청 DTO 구성(암호값·생년월일 재수신) | 요청 DTO |
| 3 | BE `B1` | 제출 수신 | 요청 DTO | 인증 없음 · `decision` 형상 검증 | `MDL-007` |
| 4 | BE `B2` | 복호화 구간 호출 | `MDL-007` | PROC-104 `B1`·`B2` — 추적 키 복원 | `trackingKey`·`MDL-005` |
| 5 | BE `B3` | 추적 레코드 확보 | `trackingKey` | PROC-301 — 생성 또는 이어쓰기 | `MDL-001`·분기 |
| 6 | BE `B4` | 확정 재안내 분기 | 분기 | `FIXED` 면 무갱신 재안내로 종료 | 응답 DTO |
| 7 | BE `B5a` | 거부 처리 | `decision = REJECT` | `USER_DENIED` 확정 · 증적·전달 없음 | 결과 구분 |
| 8 | BE `B5b` | 승인 요청 재검증 | `decision = APPROVE` | 필수 동의 충족 서버 재검증 | 검증 통과 |
| 9 | BE `B6` | 동의 증적 기록 | 검증 통과 | 행 잠금 + PROC-302 INSERT | `MDL-002` |
| 10 | BE `B7` | 연동 실행 이관 | `MDL-005` | PROC-104 전달 구간 — 전달·결과 확정 | 결과 구분 |
| 11 | BE `B8` | 결과 안내 이관·응답 | 결과 구분 | PROC-105 경로 산출 · 200 또는 502 | 응답 DTO |
| 12 | FE `F5` | 응답 처리·전이 | 응답 DTO | 경로별 화면 전이 또는 되돌림 | (다음 프로세스) |

12 단계 — 권장 상한과 같다. 복호화·전달은 PROC-104 로, 기록은 PROC-301·302·303 으로 분해해 이 안에 담았다.

### 단계명 매핑

| 선행 도메인 단계명 | 출처 | 라벨 |
|---|---|---|
| 동의 항목 구성 | SVC-003 Happy Path 1·2 · `DATA-003-01`·`DATA-003-05` | `F1` |
| 동의 항목 구성·승인 버튼 활성 판정 | `BIZ-003-01` | `F1`·`F2` |
| 승인 요청 재검증 | SVC-003 Happy Path 3·4 · `BIZ-003-02` | `B5b` |
| 거부 처리 | `BIZ-003-03` | `B5a` |
| 승인 확정·동의 증적 기록 | SVC-003 Happy Path 5 · `BIZ-003-04`·`DATA-003-04` | `B6` |
| 연동 실행 이관 | SVC-003 Happy Path 6 | `B7` |

### 분기 및 예외 흐름

| 코드 | 발생 조건 | 처리 방향 | 결과 |
|------|----------|----------|------|
| BR-004 | `B5` 제출 의사 | `APPROVE` → `B5b` / `REJECT` → `B5a` | 승인은 전달, 거부는 결과 경로 ② |
| BR-005 | `B5b` 필수 동의 충족 여부 | 충족 → `B6` / 미충족 → 400 `EX-BIZ-001` | 미충족이면 동의 화면 유지 |
| BR-002 | `B3` 사전 조회 3분기 | 없음·미확정 → 진행 / 확정 → `B4` 재안내 | 정상 진행 또는 재안내 |
| BR-022 | `B6` 증적 생성 조건 | 승인 확정 시에만 1건 | 거부·실패에는 증적 없음 |
| `EX-AUTH-001` | `birthDate` 형식 위반(PROC-104 `B1`) | 재복호화 미시도 | 400 · `SCR-001` 로 되돌림 |
| `EX-AUTH-002` | 재복호화 판정 1·2단계 실패 | 결과 미확정 | 400 · `SCR-001` 로 되돌림 |
| `EX-SEC-001`·`EX-SEC-002` | 암호값 구조·규약 위반 | `EX-SEC-002` 는 `DECRYPT_FAILED` 계수 | 400 · 결과 경로 ③ |
| `EX-BIZ-001` | 필수 동의 미충족 · `decision` 값 이탈 · 없는 항목 코드 | 결과 미확정 | 400 · `SCR-002` 유지 |
| `EX-BIZ-002` | 수신처 전달 재시도 소진(PROC-104 `B6`) | `DELIVERY_FAILED` 확정 후 안내 | 502 · 결과 경로 ④ |
| `EX-BIZ-003` | 레코드 확보·증적 기록·계수 실패 | 트랜잭션 되돌림·전달 미수행 | 500 · 재시도 가능 |
| `EX-OPS-002` | 위로 분류되지 않는 내부 실패 | 내부 사유·스택 미포함 | 500 |

### 실행 결과

- **승인 정상 결과**: 200 `{ resultPath: 1, isReAnnouncement: false }`. 영속화 — `ENT-002` 증적 1건 · `ENT-001` `result_code = SUCCESS` · `ENT-003` `success_count` +1.
- **거부 결과**: 200 `{ resultPath: 2 }`. 영속화 — `ENT-001` `result_code = USER_DENIED` · `ENT-003` `user_denied_count` +1. **증적 없음.**
- **전달 실패 결과**: 502 `EX-BIZ-002` + 결과 경로 ④. 영속화 — 증적 1건 · `result_code = DELIVERY_FAILED` · `delivery_failed_count` +1.
- **후속 트리거**: PROC-105(결과 안내) · PROC-203(수신처가 이후 완료를 통지) · PROC-201(발송처가 결과를 조회).

### 의존 프로세스

- **호출 관계**: PROC-104(동기 — 복호화 구간 `B2`, 전달 구간 `B7`) · PROC-301(동기·트랜잭션 — `B3`·`B5a`) · PROC-302(동기·트랜잭션 — `B6`) · PROC-303(PROC-301 경유) · PROC-105(동기 — `B4`·`B8`).
- **선행 관계**: PROC-102(본인확인 성공·레코드 확보) · PROC-901(동의 항목 구성·버전 식별자 산출).
- **이벤트 관계**: 없음. 응답으로 흐름이 끝나고, 수신처 통지는 별도 접점(PROC-203)이 받는다.

### 구현 가이드

- **증적 기록과 전달의 순서를 바꾸지 않는다.** 전달을 먼저 하면 "전달했는데 증적이 없는" 상태가 생기고, 그 상태는 사후 입증이 불가능하다(`BIZ-003-04`).
- **거부 경로에서 재복호화를 건너뛰지 않는다.** 결과를 확정하려면 추적 키가 필요하고, 추적 키는 복호화로만 얻어진다(`BIZ-002-01`).
- **필수 동의 재검증에서 화면이 보낸 목록을 신뢰하지 않는다.** 항목 코드가 상수에 실재하는지까지 확인해야 증적 스냅샷과 동의 목록의 정합이 성립한다([`../datas/data_ENT-002.md`](../datas/data_ENT-002.md) §구현 가이드).
- **`decision` 값의 별칭을 만들지 않는다** — `APPROVE`·`REJECT` 두 값뿐이며 대소문자를 구분한다(`BIZ-001-03` 의 정신).
- **`FOR UPDATE` 는 추적 레코드 행에만 건다.** 증적 테이블에 유일 제약이 없으므로 직렬화 지점을 한 곳으로 모아야 중복 증적이 생기지 않는다.
- **`EX-BIZ-002` 를 오류처럼 다루지 않는다.** 502 이지만 결과가 확정된 정상 종료이며 화면은 결과 경로 ④를 그린다.
