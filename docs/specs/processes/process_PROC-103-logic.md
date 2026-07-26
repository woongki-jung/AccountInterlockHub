# 동의·승인 제출 — 로직 실행 순서

정본은 [`process_PROC-103.md`](process_PROC-103.md).

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

F2. 동의 선택 → 승인 버튼 활성 판정 — POL BIZ-003-01 · BIZ-003-03 (validate) · BR-004

  onToggle(code): agreed 에 code 를 넣거나 뺀다
  canApprove = consent.items.filter(i => i.required).every(i => agreed.has(i.code))
  승인 버튼 활성 = canApprove       // 화면 게이팅 = 1차 방어. 판정 근거는 서버 재검증이다
  // 거부 버튼을 두지 않는다 — 거부를 제출하는 인터페이스가 없다 (POL BIZ-003-03)
  // 동의하지 않으려는 사용자의 종료 수단은 창을 닫는 것이다 (서버는 그 사실을 알지 못한다)

F3. 승인 제출 — POL BIZ-003-01 (validate) · BR-004

  진입 트리거: [동의하고 연동하기] click
  게이팅 (제출 전 · 1차 방어):
    if (NOT canApprove)
        유효성 안내를 노출하고 첫 미충족 항목에 포커스한다 · 단계 유지 · 요청을 보내지 않는다
        // 문구·표시 위치는 SCR-002 가 정본이다 — 본 사양은 문구를 복제하지 않는다
        // 결과 단계로 보내지 않는다 (POL BIZ-003-03) · 결과 미확정으로 남는다
        → 제출을 중단한다
  요청 DTO 변환:
    payload = { encX: encPair.encX, encY: encPair.encY, birthDate: form.birthDate,
                agreedItemCodes: Array.from(agreed) }
    // 진행 의사 필드를 싣지 않는다 — 제출 자체가 승인 의사다 (MDL-007)
  호출: 변경 호출(mutation) → POST <INTERLOCK_ENTRY_PATH>/approve (payload)
  진행 중 UI: 카드 내용을 SCR-003 진행 화면으로 교체 (PROC-104 F1 이 이어받는다)
  중복 발신 차단: 요청은 한 번만 보낸다. 화면이 자동으로 다시 보내지 않는다

F5. 응답 처리 → 단계 전이                          // F4 는 결번 (§단계명 매핑)

  onSuccess(res): 단계 전이 → SCR-004 (resultPath · isReAnnouncement · returnUrl 을 그대로 전달)
  onError(err):                                 // err.code = 오류 응답 엔벨로프의 code
    // 갈래는 아래 순서로 배타적이다 — 먼저 성립한 갈래에서 끝나고 뒤 갈래로 흘러가지 않는다
    // 응답 미수신은 이 자리로 오지 않는다 — PROC-104 F2 가 SCR-003 Unconfirmed 로 받는다
    if      (err.code == 'EX-BIZ-001')  유효성 안내 + 첫 미충족 항목 포커스 · 단계 유지
                                        // 화면 게이팅을 우회해 도달한 제출이다 (POL BIZ-003-02)
    else if (err.code == 'EX-BIZ-003')  재시도 안내 · 버튼 재활성 · 단계 유지
    else if (err.code in ['EX-AUTH-001','EX-AUTH-002'])  단계 전이 → SCR-001 (재입력 안내)
    else if (err.code == 'EX-BIZ-002')  단계 전이 → SCR-004 결과 경로 ③ (정상 종료다)
    else if (err.code in ['EX-SEC-001','EX-SEC-002'])    단계 전이 → SCR-004 결과 경로 ②
    else                                // 그 밖의 코드 — 위 다섯 갈래에 없는 code (대표: EX-OPS-002)
        단계 전이를 하지 않는다 · SCR-003 에 머문 채 상태 = Unconfirmed (재진입 안내 — 근거는 §구현 가이드)
  본인확인으로 되돌아가면 agreed 를 비운다 — 승인은 제출 시점의 명시적 행위다
```

#### BE 측 처리 (의사코드)

```
B1. POST <INTERLOCK_ENTRY_PATH>/approve 진입

  인증·인가 검증: 인증 없음 — AUTH-001 인용 (401·403 미정의)
  요청 제한: 미적용 — 수용 리스크 (OPS-002-03)
  입력 DTO 재검증 (형상만 — 값 판정은 뒤 단계):
    if (agreedItemCodes 가 문자열 배열이 아니다) → 400 FN-014('EX-BIZ-001')  // 부재 포함
    본문 해석 불가                               → 400 FN-014('EX-BIZ-001')
    // 진행 의사 필드를 읽지 않는다 — 계약에 없다 (MDL-007 · POL BIZ-003-03)

B2. 복호화 구간 호출 — PROC-104 B1·B2 (동기)

  gate = PROC-104.복호화구간({ encX, encY, birthDate })
      // B1 FN-005 형식 검증 → 위반 400 EX-AUTH-001
      // B2 FN-004 재복호화  → 1·2단계 실패 400 EX-AUTH-002 (본인확인 재입력으로 되돌린다)
      //                      3·4단계 실패 400 EX-SEC-002 + PROC-303 UNIDENTIFIED_FAILURE
  결과: gate.trackingKey · gate.payload(MDL-005 · 메모리 전용)
  정책 적용 지점: BIZ-002-06 — 본인확인 때의 원문을 재사용하지 않고 다시 복원한다

B3. 추적 레코드 확보 — PROC-301 호출 · POL BIZ-002-03 (트랜잭션)

  BEGIN ISOLATION LEVEL READ COMMITTED;          // 경계를 여는 자리는 여기다 — 충돌 재조회의 성립 전제
    secured = PROC-301({ kind: 'SECURE', trackingKey: gate.trackingKey, at: NOW(), exec })
        // exec = 여기서 연 커넥션·실행자 그대로(참여의 성립 조건) · 이미 있으면 이어쓰기(OPEN)라 요청 수는 다시 오르지 않는다
  COMMIT;                                        // 실패 → 500 EX-BIZ-003

B4. 확정 결과 재안내 분기 — POL BIZ-002-04 (validate)

  if (secured.branch == 'FIXED')
      gate.payload 를 폐기한다
      resultInfo = PROC-105({ source: 'RECORD', record: secured.record, isReAnnouncement: true })
      return 200 resultInfo                       // MDL-009 그대로 — returnUrl 은 경로 ① 에만 실려 나간다
      // 동봉 여부를 여기서 다시 판정하지 않는다 (POL BIZ-001-06 — 판정은 PROC-105 B3 한 곳)
      // 갱신·계수·증적·전달 어느 것도 수행하지 않는다
      // 이 자리의 재안내 경로는 ①·③ 뿐이다 (POL BIZ-002-04 ③ · EXC-BIZ-14)

B5b. 승인 요청 재검증 — POL BIZ-003-02 (validate)      // B5a 는 결번 (§단계명 매핑)

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

    proof = PROC-302({ trackingKey, submission: { agreedItemCodes },
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

  resultInfo = PROC-105({ source: 'RESULT_CODE', resultCode: outcome.resultCode,
                          isReAnnouncement: false })
      // 실어 보내는 값은 SUCCESS · DELIVERY_FAILED 뿐이다 — 이 접점이 만드는 경로는 ①·③ 이다
  if (resultInfo.resultPath == 3)
      return 502 FN-014('EX-BIZ-002')             // 경로 ③ — 정상 종료이며 화면이 code 로 경로를 고른다.
                                                  //   엔벨로프에 returnUrl 을 담지 않는다 (POL BIZ-001-06)
  else
      return 200 FN-015(resultInfo)               // MDL-009 그대로 — 경로 ① 이면 returnUrl 이 함께 나간다
  후속 이벤트 발행: 없음. 수신처의 완료 통지는 PROC-203 이 별도로 받는다
```

#### 데이터 변환 흐름

| 변환 지점 | 변환 위치 | 입력 형태 | 출력 형태 | 변환 규칙 요약 |
|----------|----------|----------|----------|--------------|
| FE→요청 | FE `F3` | `agreed`(Set) + 보유 값 | 요청 DTO | Set → 배열. 진행 의사 필드를 만들지 않는다(제출 자체가 승인 의사다) |
| 요청→도메인 | BE `B1`·`B2` | 요청 DTO | `MDL-007` + `MDL-005` | 형상 검증 → PROC-104 재복호화로 추적 키 복원 |
| 도메인→ENT | BE `B6` (PROC-302) | `MDL-007` + `MDL-008` | `tbl_consent_proof` 행 | 스냅샷 구성(항목 순서는 `MDL-008` 결과 그대로) · 동의 코드 배열 분리 저장 |
| 도메인→ENT | BE `B7` (PROC-104→PROC-301) | 결과 구분 | `tbl_interlock_tracking` UPDATE | 조건부(`result_code IS NULL`) |
| ENT→도메인 | BE `B3` (PROC-301) | ENT-001 행 | [`MDL-001`](../datas/model_MDL-001.md) | 파생 4종 산출 |
| 도메인→응답 | BE `B8` | 결과 구분 | `MDL-009` | PROC-105 가 경로 번호 산출 · FN-015 정제 |
| 응답→FE | FE `F5` | 응답 DTO 또는 오류 엔벨로프 | 화면 상태 | `resultPath` 로 패널 선택 · `code` 로 되돌아갈 화면 결정 |

#### 단계 통합 흐름

| # | 레이어 | 단계명 | 직전 단계 출력 | 본 단계 처리 요지 | 다음 단계 입력 |
|---|--------|--------|--------------|----------------|---------------|
| 1 | FE `F1`·`F2` | 동의 항목 구성·선택 | `MDL-008` | 상수 그대로 렌더 + 필수 충족 판정 | `agreed` |
| 2 | FE `F3` | 승인 제출 | `agreed` | 화면 게이팅 통과 후 요청 DTO 구성(암호값·생년월일 재수신) | 요청 DTO |
| 3 | BE `B1` | 제출 수신 | 요청 DTO | 인증 없음 · `agreedItemCodes` 형상 검증 | `MDL-007` |
| 4 | BE `B2` | 복호화 구간 호출 | `MDL-007` | PROC-104 `B1`·`B2` — 추적 키 복원 | `trackingKey`·`MDL-005` |
| 5 | BE `B3` | 추적 레코드 확보 | `trackingKey` | PROC-301 — 생성 또는 이어쓰기 | `MDL-001`·분기 |
| 6 | BE `B4` | 확정 재안내 분기 | 분기 | `FIXED` 면 무갱신 재안내로 종료 | 응답 DTO |
| 7 | BE `B5b` | 승인 요청 재검증 | 미확정 레코드 | 필수 동의 충족 서버 재검증 | 검증 통과 |
| 8 | BE `B6` | 동의 증적 기록 | 검증 통과 | 행 잠금 + PROC-302 INSERT | `MDL-002` |
| 9 | BE `B7` | 연동 실행 이관 | `MDL-005` | PROC-104 전달 구간 — 전달·결과 확정 | 결과 구분 |
| 10 | BE `B8` | 결과 안내 이관·응답 | 결과 구분 | PROC-105 경로 산출 · 200 또는 502 | 응답 DTO |
| 11 | FE `F5` | 응답 처리·전이 | 응답 DTO | 경로별 화면 전이 또는 되돌림 · 미분류 코드는 전이 없이 `SCR-003` `Unconfirmed` | (다음 프로세스) |

11 단계 — 권장 12 단계 이내다(거부 처리 단계가 없어지며 12 → 11). 복호화·전달은 PROC-104 로, 기록은 PROC-301·302·303 으로 분해해 이 안에 담았다.
