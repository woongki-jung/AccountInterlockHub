# 본인확인(복호화 판정) — 로직 실행 순서

정본은 [`process_PROC-102.md`](process_PROC-102.md).

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
    // 갈래는 아래 순서로 배타적이다 — 먼저 성립한 갈래에서 끝나고 뒤 갈래로 흘러가지 않는다

    if (응답 미수신 — 전송 계층 단절)              // 응답이 없으므로 읽을 err.code 자체가 없다
        alert = 재시도 안내(EX-BIZ-003 과 같은 문구) · 단계 유지 · 버튼 재활성
        return                                     // 여기서 끝난다 — 아래 코드 기반 갈래를 보지 않는다
        // SCR-001 Retryable 이 함께 받는다. 사유를 구분해 알리지 않는다 (POL SEC-002-05)
        // 화면 쪽 요청 타임아웃을 만들지 않는다 (SCR-003 §구현 가이드)

    // 여기부터는 응답을 받은 경우뿐이다 — err.code 가 반드시 있고, 아래 중 하나만 성립한다
    if      (err.code == 'EX-AUTH-001')  alert = 형식 안내      · 단계 유지 · 필드 포커스
    else if (err.code == 'EX-AUTH-002')  alert = 재입력 안내    · 단계 유지 · 값 유지 + 전체 선택
    else if (err.code == 'EX-BIZ-003')   alert = 재시도 안내    · 단계 유지 · 버튼 재활성
    else if (err.code in ['EX-SEC-001','EX-SEC-002'])
        단계 전이 → SCR-004 결과 경로 ② (사유 코드로 설명 문구만 고른다)
    else                             // 그 밖의 코드 — 위 넷에 없는 code
        단계 전이 → SCR-004 결과 경로 ②
        // 응답 미수신은 이 자리로 오지 않는다 — 위에서 이미 끝났다
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
  return 400 FN-014(code)                       // 화면은 결과 경로 ② 로 간다

B5. 추적 키 추출 → 원문 즉시 폐기 — POL BIZ-002-06 · DATA-004-01 (transform)

  trackingKey = payload.trackingKey             // 무변형 (파싱·정규화하지 않는다)
  payload 를 지역 변수에서 버린다               // 세션·캐시·저장소 어디에도 남기지 않는다
  // 승인 시점에는 PROC-104 B2 가 다시 복호화한다 (요청 간 보존 금지 — DATA-001-03)

B6. 추적 레코드 확보 — PROC-301 호출 · POL BIZ-002-01 · BIZ-002-03 (트랜잭션 시작)

  BEGIN ISOLATION LEVEL READ COMMITTED;          // 경계를 여는 자리는 여기다 (하위는 참여만 한다)
    secured = PROC-301({ kind: 'SECURE', trackingKey, at: NOW(), exec })
        // exec = 여기서 연 커넥션·실행자를 그대로 넘긴다 — 이 전달이 참여의 성립 조건이다
        // PROC-301 B2: SELECT … FROM tbl_interlock_tracking WHERE tracking_key = :trackingKey
        // PROC-301 B3: 없으면 INSERT … ON CONFLICT DO NOTHING (충돌은 이어쓰기로 흡수)
        //              생성 시 PROC-303 B3 이 request_count +1 (같은 트랜잭션)
    // 실패 → ROLLBACK → 500 EX-BIZ-003 (결과 미확정 · 사용자는 다시 시도할 수 있다)
  COMMIT;
  // 결과: secured.branch = 'OPEN' | 'FIXED' · secured.isCreated

B7. 확정 결과 재안내 분기 — POL BIZ-002-03 ③ · BIZ-002-04 (validate)

  if (secured.branch == 'FIXED')
      resultInfo = PROC-105({ source: 'RECORD', record: secured.record, isReAnnouncement: true })
      // 레코드를 갱신하지 않는다 (보관 기산점이 밀리지 않는다)
      // 요청 수를 계수하지 않는다 (POL BIZ-005-03)
      return 200 { stage: 'RESULT', ...resultInfo }   // MDL-009 를 그대로 싣는다
      // resultInfo 에 returnUrl 이 있으면(경로 ①) 함께 나가고 없으면(경로 ③) 나가지 않는다.
      //   동봉 여부를 여기서 다시 판정하지 않는다 (POL BIZ-001-06 — 판정은 PROC-105 B3 한 곳)

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
| 5 | BE `B4a`/`B4b` | 실패 분류 | EX 코드 | 1·2단계=재입력 / 3·4단계=계수 후 경로 ② | 400 응답 |
| 6 | BE `B5` | 추적 키 추출·원문 폐기 | `MDL-005` | 추적 키만 취하고 X 폐기 | `trackingKey` |
| 7 | BE `B6` | 추적 레코드 확보 | `trackingKey` | PROC-301(+PROC-303) 단일 트랜잭션 | `MDL-001`·분기 |
| 8 | BE `B7` | 확정 재안내 분기 | 분기 | `FIXED` 면 PROC-105 로 재안내 | 응답 DTO |
| 9 | BE `B8` | 동의 항목 구성 응답 | `MDL-008` | 상수 파싱 결과 그대로 · FN-015 정제 | 응답 DTO |
| 10 | FE `F2`/`F3` | 응답 처리·전이 | 응답 DTO(또는 미수신) | `CONSENT`→SCR-002 / `RESULT`→SCR-004 / 오류→안내 | (다음 프로세스) |

10 단계 — 권장 12 단계 이내다.
