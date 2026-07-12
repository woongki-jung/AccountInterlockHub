# 연동 완료 확인 API 테스트 케이스 정의 (API-02)

## 개요

- **검증 목적**: 발송처가 연동 추적 키 기준으로 수신처(B)의 정보연계 처리완료 여부를 확인하는 서버 대면 API 가 — API 인증(발송처 자격·주체 분리), 요청 제한, 입력 검증, 추적 키 스코프 최신 이력 1건의 완료 콜백 수신 여부 판정(완료/미완료 둘 다 200), 대상 미특정 단일 404, 응답 3항목·추적 키 원문 배제, 읽기 전용(이력·처리상태 무갱신)을 정확히 수행하는지 검증한다. `#214` 로 판정 스코프를 구 {연동 구성 식별자 + 사용자 키값}에서 **연동 추적 키 단독**으로 전환했다.
- **관련 PRD 요구사항**: [`../../../prd/PRD.md`](../../../prd/PRD.md) §수행 범위 6 "발송처가 연동 추적 키 기준으로 수신처의 처리완료 여부를 확인하는 API". 검증 대상 PROC-302(SVC-008). 엔드포인트 `POST /api/interlock/completion`.
- **공통 판정 기준**: [spec-qa.md §7](../spec-qa.md).
- **전 TC 공통 전제**: 시드 = 연동이력(콜백 수신·미수신 각 신규·추적 키 재사용 복수)·서비스 대면 API 자격(발송처/수신처 각 유효/무효) [SQL·환경]. 인증 수단(API Key/HMAC)은 spec 확정 기본값(구체 알고리즘 build, BLK-05). 단일 404·추적 키 단독 스코프는 확정 기본안(BLK-16).

---

### API-02_001 완료 확인 성공·완료됨(isCompleted=true)
- **유형/우선순위/자동화**: Positive · 높음 · 자동 | **PROC/분기**: PROC-302 / BR-302(수신)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /api/interlock/completion | 유효 발송처 자격·{trackingKey}(스코프 최신 이력 callback_received=true) | 인증·제한·형식 통과 | B1~B3 |
| 2 | 완료 판정(FN-017 위임) | — | 200 MDL-304 {isCompleted:true, callbackReceivedAt:ISO8601, requestedAt:ISO8601} | B4~B5 (BR-302) |

- **데이터 검증**: 판정 대상 = IX_HISTORY_TRACKING 스코프 최신 1건. COMPLETION_CHECK(SUCCESS, 추적 키 마스킹) 감사 1건. 이력(ENT-007)·처리상태(ENT-004) 무갱신.

### API-02_002 완료 확인 성공·미완료(isCompleted=false)
- **유형/우선순위/자동화**: Positive · 높음 · 자동 | **PROC/분기**: PROC-302 / BR-302(미수신)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /completion | 스코프 최신 이력 callback_received=false | 200 {isCompleted:false, callbackReceivedAt:null, requestedAt:ISO8601} | B4~B5 (BR-302) |

- **비고**: 미완료도 200 정상 응답(404 아님). callbackReceivedAt null·requestedAt 정합(ENT-007 수신 CHECK).

### API-02_003 스코프 최신 1건 판정(추적 키 재사용 복수 이력)
- **유형/우선순위/자동화**: Boundary · 보통 · 자동 | **PROC/분기**: PROC-302 / BIZ-004-10·EXC-BIZ-12

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /completion | 동일 trackingKey 로 복수 이력(요청 일시 상이, 최신=미수신·직전=수신) | 200, 판정=최신 1건 기준(isCompleted=false) | B4 (ORDER BY requested_at DESC LIMIT 1) |

- **데이터 검증**: 판정에 직전(수신) 건이 아닌 최신(미수신) 건만 반영. IX_HISTORY_TRACKING 최신 1건 선정(추적 키 단독 스코프·요청 일시 tiebreaker).

### API-02_004 응답 3항목·추적 키 원문/configId 미포함
- **유형/우선순위/자동화**: Positive(DATA) · 높음 · 자동 | **PROC/분기**: PROC-302 / SEC-005-05

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /completion | 유효 조회 | 응답 = {isCompleted, callbackReceivedAt, requestedAt} (MDL-304) | B5 |

- **데이터 검증**: 응답 DTO 에 trackingKey 원문·회원 키·configId 필드 부재(마스킹 이전 필드 자체 배제, SEC-005-05). 감사 detail 의 추적 키는 앞2·뒤2 마스킹(FN-010).

### API-02_005 읽기 전용·무갱신(멱등 재조회)
- **유형/우선순위/자동화**: 상태전이 · 높음 · 자동 | **PROC/분기**: PROC-302 / 읽기 전용

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | 조회 전 스냅샷 | 이력·처리상태 컬럼 캡처 | 기준값 | — |
| 2 | POST /completion 2회 연속 | 동일 조회 | 200 동일 응답(재조회 제한 없음) | B4~B5 |
| 3 | 조회 후 스냅샷 비교 | — | ENT-007(callback_received 등)·ENT-004 불변 | B4 |

- **데이터 검증**: API-01(최초 조회 시 결과 확인 갱신)과 대비 — 본 API 는 어떤 컬럼도 갱신하지 않음(읽기 전용).

### API-02_006 대상 없음 단일 404
- **유형/우선순위/자동화**: Negative · 높음 · 자동 | **PROC/분기**: PROC-302 / EX-BIZ-005
- **정책 근거**: 추적 키 스코프 내 이력 없음(미존재·배치 삭제·미기록·복호화 이전 종료)을 구별하지 않는 단일 404(존재 여부 비노출, EXC-DATA-11·BLK-16).

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /completion | (a) 미존재 trackingKey | 404 EX-BIZ-005 "확인 대상을 찾을 수 없습니다." | B4 (target=null) |
| 2 | POST /completion | (b) 배치 삭제된 스코프 | 404 EX-BIZ-005(동일 응답) | B4 (EXC-DATA-11) |
| 3 | POST /completion | (c) 복호화 이전 종료(거부·복호화 실패)로 이력 미기록 | 404 EX-BIZ-005(동일 응답) | B4 (target=null) |

- **데이터 검증**: 세 입력 모두 동일 status·메시지(응답 차이로 존재 여부 유추 불가). PROC-402 삭제분 정합(BAT-02_017).

### API-02_007 인증 실패·주체 불일치
- **유형/우선순위/자동화**: 권한/인증 · 높음 · 자동 | **PROC/분기**: PROC-302 / EX-SEC-003

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /completion | 자격 누락·불일치·서명 오류 | 401 EX-SEC-003 "인증에 실패했습니다." | B1 (SEC-003-01) |
| 2 | POST /completion | 수신처(B) 자격으로 호출(주체 불일치) | 401 EX-SEC-003(발송처 자격만 통과) | B1 (SEC-003-03) |

- **데이터 검증**: API_AUTH_FAIL 감사(추적 키 마스킹). 자격 값 로그 미기록. 인증 수단 spec 확정·구체 알고리즘 build(BLK-05).

### API-02_008 입력 검증·크기 초과·주입 무해 통과
- **유형/우선순위/자동화**: Negative · 보통 · 자동 | **PROC/분기**: PROC-302 / EX-SEC-004·EX-BIZ-005·EX-SEC-005
- **정책 근거**: SEC-004-01(허용 문자 화이트리스트·주입 재검증 불요 — 파라미터 바인딩 SEC-004-02 단독 방어). 공란·255 초과는 DTO(NotBlank·MaxLength) 400 EX-SEC-004, 주입 패턴은 비매칭 일반값으로 통과해 스코프 이력 없음 단일 404 EX-BIZ-005 로 수렴한다(코드가 정책 준수 — `#240` TC 정합).

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /completion | trackingKey 공란(필수 누락) | 400 EX-SEC-004 "요청이 올바르지 않습니다." | B3 |
| 2 | POST /completion | 255 초과(MaxLength) | 400 EX-SEC-004 | B3 |
| 3 | POST /completion | 주입 패턴 trackingKey(비공백·255 이내) | 404 EX-BIZ-005(파라미터 바인딩 의존·주입 무실행 — 비매칭 일반값, SEC-004-01/02) | B4 |
| 4 | POST /completion | 본문 1MB 초과 | 413 EX-SEC-005 | B3 |

- **비고**: trackingKey NotBlank·MaxLength(255). 상한 1MB 기본안(BLK-08). 주입 안전성은 파라미터 바인딩(SEC-004-02) 단독 방어.

### API-02_009 요청 제한 초과
- **유형/우선순위/자동화**: Negative · 보통 · 자동 | **PROC/분기**: PROC-302 / EX-OPS-001

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /completion | 인증 주체 기준 분당 60회 이내 | 통과(경계 내) | B2 |
| 2 | POST /completion | 61회째(초과) | 429 EX-OPS-001, RATE_LIMIT 감사(scope='completion') | B2 |

- **비고**: 임계치 60/분 기본안(BLK-06).

### API-02_010 조회·판정 오류
- **유형/우선순위/자동화**: 시스템예외 · 보통 · 반자동 | **PROC/분기**: PROC-302 / EX-FN-999

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /completion (DB 조회 오류 주입) | 유효 요청 | 500 EX-FN-999 "잠시 후 다시 시도해주세요." | B4 |

- **데이터 검증**: 읽기 전용이라 롤백 대상 없음(무갱신). 감사 기록.
