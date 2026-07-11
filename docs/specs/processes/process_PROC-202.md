# 동의·거부 처리 기능 정의

## 개요

- **정의 대상**: 최종 사용자의 승인(AGREE)/거부(REJECT) 결과를 구성 매칭 근거로 검증·게이팅하는 프로세스. 승인(필수 동의 충족) 시 접근 컨텍스트(encX·encY·생년월일)를 담아 연동 실행(PROC-203)을 동기 호출해 허브 복호화·수신처 전달을 개시하고, 거부·필수 미충족 시 복호화를 수행하지 않고 200 정상 종료한다. 복호화 이전이라 연동 추적 키가 없어 거부 경로는 처리 상태·연동이력을 남기지 않는다(감사만).
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 3 "사용자 — 접근·동의·승인 페이지: … 동의 체크 후 연동 승인" · §수행 범위 4 "승인 시 허브가 생년월일로 복호화".

> **2026-07-11 `#214` 개정**: 진입점을 `POST /api/consent/:requestKey`(요청 키값)에서 **`POST /api/interlock/approve`(접근 컨텍스트 본문 수신)**로 바꾸고, 요청 키값 진입 컨텍스트 조회(구 EX-DATA-002)를 폐기했다. 승인 본문은 동의 결과(MDL-203)에 접근 컨텍스트(MDL-201: encX·encY·생년월일)를 함께 담는다. **거부 시 처리 상태 저장(구 PROC-401 호출)을 폐기**했다 — 복호화 이전이라 추적 키가 없어 상태·이력을 남기지 않는다(감사만).

---

## PROC-202 동의·거부 처리

### 기본 정보

| 항목 | 내용 |
|------|------|
| 프로세스명 | 동의·거부 처리(승인 게이팅) |
| 분류 | RR |
| 그룹 | 사용자 연동 |
| 트리거 유형 | 사용자 액션(SCR-005 승인/거부 제출) |
| 처리 방식 | 동기(승인 시 복호화·외부 전달 포함) |
| 우선순위 | 높음 |
| 관련 IA 항목 | USR-01 |

### 관련 사양 코드

| 구분 | 코드 | 관계 설명 |
|------|------|----------|
| 서비스(SVC) | SVC-004 | 동의/거부·승인 게이팅(BR-201) |
| 정책(policy) | OPS-001·SEC-004·BIZ-002·AUTH-004·DATA-001 | 요청 제한·입력 검증·동의 게이팅·생년월일 성격·무저장 |
| 공통 기능(FN) | FN-014(요청 제한)·FN-005(입력 검증)·FN-008(동의 처리·게이팅)·FN-013(감사)·FN-015(엔벨로프) | 호출 단위 로직(승인 시 PROC-203 이 FN-020·016·012·009 오케스트레이션) |
| 데이터 모델(MDL) | MDL-203(동의 결과)·MDL-201(접근 컨텍스트) | 요청 모델(무저장) |
| DB 엔터티(ENT) | ENT-001(활성 구성 조회). ENT-004·ENT-007 은 승인 경로의 PROC-203/401·403 이 처리 | 조회 대상 |
| 화면(SCR) | SCR-005·SCR-006(결과) | 제출·결과 표시 |

### 진입점 및 진입 조건

- **진입점**: `POST /api/interlock/approve`. SCR-005 [승인](AGREE)/[거부](REJECT) 버튼 제출.
- **진입 조건**: Public(발송처 진입 흐름). 승인 본문에 접근 컨텍스트(encX·encY·생년월일)·동의 결과(decision·accessAddressId·requiredConsentMet) 포함.
- **사전 검증**: 요청 제한(FN-014), MDL-203+MDL-201 스키마(decision enum·accessAddressId·encX·encY·birthDate)(FN-005), 접근 주소 고유 ID 로 활성 구성 매칭, 필수 동의 충족 서버 재검증(FN-008).

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 설명 |
|------|--------|------------|------|------|
| 입력 | decision | 'AGREE'/'REJECT' | Y | 승인/거부 결정 |
| 입력 | accessAddressId | string | Y | 접근 주소 고유 ID(구성 매칭 근거) |
| 입력 | requiredConsentMet | boolean | Y | 필수 동의 충족(FE 파생, 서버 재검증) |
| 입력 | encX, encY, birthDate | string | Y(AGREE) | 접근 컨텍스트(복호화 요소·무저장, MDL-201) |
| 출력 | result | { result } | - | COMPLETED(승인·전달 성공) / REJECTED(거부·미충족) |

### 연관 데이터 및 외부 호출

- **호출 API**: 수신처 B 전달은 승인 시 PROC-203(내부) → FN-012 가 BE 경유 서버-서버 POST 로 수행.
- **데이터 조회 대상**: ENT-001(활성 구성, config_code=accessAddressId·is_active=true·deleted_at IS NULL).
- **데이터 변경 대상(CRUD)**: 거부 경로=없음(ENT-006 감사만). 승인 경로=PROC-203 이 연동이력(ENT-007, 복호화 후 PROC-403)·처리 상태(ENT-004, 전달 후 PROC-401)를 생성. 처리 후 접근 컨텍스트(encX·encY·생년월일) 메모리 폐기.

### 실행 제약사항

- **트랜잭션 경계**: 거부 경로는 DB 영속화 없음(감사만). 승인 경로는 PROC-203 이 복호화(메모리)·이력 INSERT·전달·상태 저장 경계를 소유한다.
- **동시성 제어**: 접근 컨텍스트가 본문에 실려 오므로 서버 진입 상태 조회가 없다. 승인은 접근 컨텍스트 1회 처리 후 폐기(재제출은 새 컨텍스트로 취급). ENT-004·ENT-007 중복 방지는 PROC-401·403 의 surrogate PK·조건절 가드가 담당.
- **성능 요구**: 승인 시 복호화·서비스 B 전달·재시도 지연 포함(PROC-203). 요청 제한 분당 60회.
- **보안 요구**: 결과 화면 값 단독 신뢰 금지(서버 구성 매칭·필수 동의 재검증), encX·encY·생년월일 무저장(메모리 경유·미기록, DATA-001-04·SEC-005-06), 거부는 200 정상 종료(EX 아님). 생년월일은 인증·세션을 발급하지 않는다(AUTH-004-01).

### 로직 실행 순서

#### FE 측 처리 (의사코드)

```
F1. 승인/거부 제출 트리거 → 요청   (SCR-005)
  진입 트리거: SCR-005 [승인](AGREE) 또는 [거부](REJECT) 버튼 제출
  사용 상태/폼:
    accessAddressId = route.param, encX·encY(메모리), form.birthDate, checked = {order:boolean}, consentItems[]
  검증 로직(승인 시):
    if (!/^\d{6}$/.test(birthDate) || 월/일 범위 위반) → 생년월일 인라인 에러 → 승인 버튼 비활성   // AUTH-004-01
    if (!consentItems.filter(i=>i.required).every(i=>checked[i.order]))
                                                       → "필수 동의 항목에 동의해주세요." → 승인 버튼 비활성
  요청 DTO 변환:
    if (AGREE) payload = { decision:'AGREE', accessAddressId, requiredConsentMet:true,
                           encX, encY, birthDate }        // 접근 컨텍스트 본문 동봉(URL→본문 이동)
    else       payload = { decision:'REJECT', accessAddressId, requiredConsentMet:false }  // 복호화 요소 미포함
  호출 수단: mutation → POST /api/interlock/approve (payload)
  진행 중 UI: Submitting — 버튼 Spinner + 폼 disabled

F2. 응답 수신 → 결과 전이   (→ SCR-006 / 재입력)
  onSuccess(res→{ result:'COMPLETED'|'REJECTED' }):
    navigate → SCR-006 결과(연동 완료 또는 취소 안내)
  onError(err):
    if (err.code=='EX-SEC-006') → 본 화면 유지 + 생년월일 인라인 에러("본인확인 정보가 올바르지 않습니다. 생년월일을 확인 후 다시 시도해주세요.") + 재입력·재제출 허용(하드 잠금 없음)   // BR-204
    else if (err.code=='EX-SEC-007' || err.code=='EX-BIZ-008') → navigate SCR-006(링크 오류 — 발송처 문의, 재입력 불가)
    else if (err.code=='EX-BIZ-004') → navigate SCR-006(전달 실패 — 재시도 안내, 상태·이력 저장됨)
    else if (err.code=='EX-SEC-004') → Banner "요청이 올바르지 않습니다."
    else if (err.code=='EX-OPS-001') → Banner "잠시 후 다시 시도해주세요."
    else → Banner(error)
  정책 적용 지점: 거부는 오류 아닌 정상 종료(EXC-BIZ-03), 복호화 실패는 재입력(AUTH-004-02), decision·필수 충족 서버 재검증(FN-008)
```

#### BE 측 처리 (의사코드)

```
B1. 진입 → 요청 제한 → 입력 검증
  엔드포인트: POST /api/interlock/approve
  인증: Public(발송처 진입 흐름). 관리자 인증 경로와 분리
  요청 제한: FN-014_checkRateLimit(sourceIp, 'approve', now, 60)   (OPS-001) → 초과 429 EX-OPS-001
  입력 검증: FN-005_validateInput(MDL-203 + MDL-201, approveSchema, rawSize)
        크기>1MB → 413 EX-SEC-005 / 위반 → 400 EX-SEC-004
        // decision enum·accessAddressId NotBlank / AGREE 시 encX·encY·birthDate NotBlank(형식 정오는 복호화가 판정)

B2. 동의 결과 검증·승인 게이팅(위임) — FN-008_processDecision(consentResult, now)   [BR-201]
  consentResult = MDL-203 { decision, accessAddressId, requiredConsentMet }
  outcome = FN-008_processDecision(consentResult, now)   // → { approved: boolean }
    // FN-008 내부(재서술 없이 위임):
    //   config = SELECT id FROM TBL_INTERLOCK_CONFIG WHERE config_code=:accessAddressId AND is_active=true AND deleted_at IS NULL;
    //   requiredItems = SELECT id FROM TBL_INTERLOCK_CONSENT_ITEM WHERE config_id=:config.id AND is_required=true;
    //   serverRequiredMet = (decision=='AGREE') AND allChecked(requiredItems, consentResult)   // 화면 값 단독 신뢰 금지(BIZ-002-06)
    //   if (decision=='REJECT' OR !serverRequiredMet) → CONSENT_REJECT 감사(INFO) → return { approved:false }   // 200 정상 종료
    //   else → CONSENT_AGREE 감사(INFO) → return { approved:true }

B3a. 거부·필수 미충족 경로 — outcome.approved == false (BIZ-002-07)
  // 복호화 미수행 — 연동 추적 키 없어 처리 상태·연동이력 미생성(EXC-DATA-03·EXC-BIZ-11). CONSENT_REJECT 감사는 FN-008 내부 기록
  release(encX, encY, birthDate)                         // 접근 컨텍스트 즉시 폐기(무저장)
  응답: FN-015_ok({ result:'REJECTED' })                 // 200 정상 종료(EXC-BIZ-03)

B3b. 승인 경로 — outcome.approved == true (BIZ-002-06 충족)
  // 연동 실행에 필요한 활성 구성(수신처 B 주소·메서드) 로드
  config = SELECT id, service_b_delivery_url, service_b_http_method FROM TBL_INTERLOCK_CONFIG
           WHERE config_code = :accessAddressId AND is_active = true AND deleted_at IS NULL;   -- UQ_CONFIG_CODE
  if (config is null) → 400 EX-SEC-004 (유효하지 않은 접근 주소 참조)
  status = PROC-203_executeInterlock(config, { encX, encY, birthDate, accessAddressId }, now)   // 내부 호출
      // PROC-203: FN-020 복호화(생년월일→encY→키→encX→X, 추적 키 추출)
      //          → FN-016 연동이력 생성(복호화 후) → FN-012 수신처 B 서버-서버 전달(재시도 2회) → FN-009 처리 상태 저장
      // 전파 예외: EX-SEC-006(복호화 실패·400)·EX-SEC-007(암호 파라미터 형식·400)·EX-BIZ-008(추적 키 필드 누락·400)·EX-BIZ-004(전달 실패·502)
  release(encX, encY, birthDate)                         // 전달 완료 후 접근 컨텍스트 폐기(무저장)
  응답: 성공 → FN-015_ok({ result:'COMPLETED' })          // 200 완료
       / 실패 → 전파 예외(400/502) 그대로 반환(EX-BIZ-004 시 처리 상태·연동이력은 저장됨)
  정책 적용 지점: BIZ-002(동의 검증·게이팅), AUTH-004(생년월일 성격), DATA-001(컨텍스트 폐기·무저장), SEC-006/007(복호화·서버 전달은 PROC-203)
```

#### 데이터 변환 흐름

| 변환 지점 | 변환 위치 | 입력 형태 | 출력 형태 | 변환 규칙 |
|----------|----------|----------|----------|-----------|
| FE→요청 | FE 어댑터 | SCR-005 결정·체크·접근 컨텍스트 | MDL-203 + MDL-201 DTO | decision·accessAddressId 매핑, AGREE 시 encX·encY·birthDate 본문 동봉 |
| 요청→도메인 | BE 컨트롤러 | MDL-203 + MDL-201 DTO | ConsentResult + 접근 컨텍스트 | FN-005 검증·구성 매칭·필수 동의 재검증 |
| 도메인→응답 | BE 컨트롤러 | 처리 결과 | { result } | 결과 유형만(COMPLETED/REJECTED), 상태 값·추적 키 미노출 |
| 응답→FE | FE 어댑터 | 응답·에러 | SCR-006 상태 | 완료/취소/전달실패/링크오류 유형 매핑 |

#### 단계 통합 흐름

| # | 레이어 | 단계명 | 직전 단계 출력 | 본 단계 처리 요지 | 다음 단계 입력 |
|---|--------|--------|--------------|----------------|---------------|
| 1 | FE | 승인/거부 제출 | (사용자 결정·접근 컨텍스트) | 생년월일 형식·필수 항목 검증 + DTO 변환(접근 컨텍스트 동봉) | MDL-203+MDL-201 DTO |
| 2 | BE | 요청 제한·입력 검증 | DTO | FN-014 + FN-005 재검증 | 검증된 결정·컨텍스트 |
| 3 | BE | 구성 매칭·승인 게이팅 | 검증된 결정 | FN-008 구성 매칭·필수 동의 재검증(BR-201) | 활성 구성·게이팅 결과 |
| 4a | BE | 거부·미충족 처리 | 게이팅 결과 | CONSENT_REJECT 감사·컨텍스트 폐기(복호화 미수행) | 200 REJECTED |
| 4b | BE | 승인 처리 | 활성 구성·접근 컨텍스트 | PROC-203 복호화·이력 생성·전달·상태 저장 호출·컨텍스트 폐기 | COMPLETED / 전파 예외 |
| 5 | FE | 결과 전이 | 응답/에러 | SCR-006 결과 유형 표시 / 복호화 실패는 재입력 | (UI 전이) |

### 분기 및 예외 흐름

| 코드 | 발생 조건 | 처리 방향 | 결과 |
|------|----------|----------|------|
| BR-201 | 승인(AGREE·필수 충족) / 거부(REJECT)·필수 미충족 | AGREE→PROC-203 복호화·전달, REJECT·미충족→복호화 미수행 종료 | 복호화·전달 / 종료(상태·이력 미생성) |
| EX-SEC-004 | 입력 형식 위반·유효하지 않은 접근 주소 | 요청 거부 | 400 요청이 올바르지 않습니다. |
| EX-SEC-005 | 본문 1MB 초과 | 요청 거부 | 413 요청이 너무 큽니다. |
| EX-OPS-001 | 승인·재입력 분당 60회 초과 | 요청 거부 | 429 잠시 후 다시 시도해주세요. |
| EX-SEC-006 | (PROC-203 전파) 복호화 실패(생년월일 불일치·패딩·키 불일치) | SCR-005 유지·생년월일 재입력 재시도(BR-204) | 400 생년월일을 다시 확인해주세요. |
| EX-SEC-007 | (PROC-203 전파) 암호 파라미터 누락·Base64URL 형식 오류 | 링크 오류 종료(발송처 문의, 재입력 불가) | 400 요청이 올바르지 않습니다. |
| EX-BIZ-008 | (PROC-203 전파) 복호화된 X 파싱 실패·추적 키 필드 누락 | 링크 오류 종료(발송처 문의, 재입력 불가) | 400 연동에 필요한 값이 없습니다. |
| EX-BIZ-004 | (PROC-203 전파) 수신처 B 전달 실패(재시도 2회 후) | 502, 처리 상태·연동이력 저장됨 | 502 연동 대상 처리에 실패했습니다. |
| EX-FN-999 | 조회·처리 오류 | 오류 응답 | 500 잠시 후 다시 시도해주세요. |

> 사용자 거부·필수 동의 미충족은 EX 코드가 아니다 — 200 정상 종료·복호화 미수행, 추적 키가 없어 처리 상태·연동이력을 남기지 않고 결과 코드만 최소 감사한다(EXC-BIZ-03·EXC-DATA-03·EXC-BIZ-11). 복호화 실패(EX-SEC-006)만 사용자 정정(생년월일 재입력) 대상이고, 발송처 데이터 오류(EX-SEC-007·EX-BIZ-008)는 재입력 불가다(EXC-BIZ-13). `#214` 로 요청 키값 컨텍스트 조회(구 EX-DATA-002)는 결번이다.

### 실행 결과

- **정상 결과(승인)**: PROC-203 복호화 성공→연동이력 1건 생성→수신처 B 전달 성공→처리 상태 1건(성공), 200 COMPLETED. SCR-006 "연동이 완료되었습니다."
- **정상 결과(거부·미충족)**: CONSENT_REJECT 감사, 200 REJECTED. 처리 상태·연동이력 미생성. SCR-006 "연동이 취소되었습니다."
- **실패 결과**: EX-SEC-006(400, 재입력)·EX-SEC-007/EX-BIZ-008(400, 링크 오류)·EX-BIZ-004(502, 상태·이력 저장됨). SCR-006 분기 안내.
- **후속 트리거**: 승인 시 PROC-203(내부: FN-020→FN-016(PROC-403)→FN-012(PROC-401)). 저장된 처리 상태·연동이력은 PROC-301·302·303 소비 대상.

### 의존 프로세스

- **호출 관계**: PROC-203(동기, 승인 시 — 복호화·전달 오케스트레이션). `#214` 로 거부 시 처리 상태 저장(구 PROC-401 직접 호출)은 폐기됐다.
- **선행 관계**: PROC-201(접근·동의 화면 표시). 접근 컨텍스트는 본문으로 수신(서버 진입 상태 조회 없음).
- **이벤트 관계**: 승인 결과가 PROC-203 복호화·전달을 트리거한다.

### 구현 가이드

- 동의 결과는 화면 값 단독 신뢰 없이 서버가 접근 주소 고유 ID(구성 매칭 근거)로 활성 구성을 특정하고 필수 동의 충족을 재검증한다(FN-008, BIZ-002-06). 한 인터랙션(승인/거부 제출)=1 PROC(PROC-202)이며, 복호화·전달은 승인 경로의 내부 호출(PROC-203)이다.
- 거부·필수 미충족은 오류가 아닌 200 정상 종료로 처리하고, 복호화를 수행하지 않아 추적 키가 없어 처리 상태·연동이력을 남기지 않는다(감사만, BIZ-002-07). 처리·거부 완료 후 접근 컨텍스트(encX·encY·생년월일)를 메모리에서 폐기한다(무저장·미기록, SEC-006-06).
- 승인 경로의 복호화 실패(EX-SEC-006)는 SCR-005 에 머무르며 생년월일 재입력·재제출을 허용한다(하드 잠금 없음, AUTH-004-02). 재제출은 동일 접근 주소·encX·encY 에 생년월일만 갱신해 다시 POST 한다(암호값 재수신 불요). 남용은 요청 제한(OPS-001)이 1차 억제한다.
- 동의 증빙 원장은 저장하지 않는다(BIZ-002-04, Q3). 결과는 감사 로그(결과 코드)와 승인 시 처리 상태(is_success)에만 반영된다.
