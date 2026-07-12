# 처리상태 확인 API 테스트 케이스 정의 (API-01)

## 개요

- **검증 목적**: 발송처가 연동 추적 키로 처리·결과 확인 상태를 조회하는 서버 대면 API 가 — API 인증(발송처 자격), 요청 제한, 추적 키 형식 검증(비공백·255), 최초 조회 시 결과 확인 여부 멱등 갱신, 응답 4항목만·회원 키/configId 배제·마스킹을 정확히 수행하는지 검증한다. `#214` 로 조회 키를 허브 발급 요청 키값(UUID)에서 **연동 추적 키(tracking_key, 불투명·발송처 구성)**로 전환했다 — UUID 형식 강제가 폐지되고 재사용 시 처리 일시 최신 1건을 반환한다.
- **관련 PRD 요구사항**: [`../../../prd/PRD.md`](../../../prd/PRD.md) §수행 범위 5 "처리상태 확인 API: 발송처가 연동 추적 키 기준으로 처리·결과 확인 상태를 조회". 검증 대상 PROC-301(SVC-006). 엔드포인트 `GET /api/status/:trackingKey`.
- **공통 판정 기준**: [spec-qa.md §7](../spec-qa.md).
- **전 TC 공통 전제**: 시드 = 처리상태(완료·미완료 각 신규·추적 키 재사용 복수)·서비스 대면 API 자격(발송처 유효/무효)·미존재 추적 키 [SQL·환경]. 인증 수단(API Key/HMAC)은 spec 확정 기본값(구체 알고리즘 build, BLK-05).

---

### API-01_001 상태 조회 성공·최초 결과 확인 갱신
- **유형/우선순위/자동화**: Positive · 높음 · 자동 | **PROC/분기**: PROC-301 / BR-301(최초)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /api/status/:trackingKey | 유효 발송처 자격·미확인 상태 trackingKey | 인증·제한·형식 통과 | B1~B3 |
| 2 | 상태 조회·갱신 | — | 200 MDL-302(4항목+trackingKey 원문 에코) | B4~B6 |

- **데이터 검증**: ENT-004 is_result_confirmed false→true·result_confirmed_at=now 갱신(surrogate id + WHERE is_result_confirmed=false 멱등 가드). 응답에 회원 키·config_id 부재.

### API-01_002 재조회 무갱신(멱등)
- **유형/우선순위/자동화**: 상태전이 · 높음 · 자동 | **PROC/분기**: PROC-301 / BR-301(재조회)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /api/status/:trackingKey | 이미 확인된(is_result_confirmed=true) 상태 | 200, 갱신 없이 현재 상태 | B5 |

- **데이터 검증**: result_confirmed_at 최초 값 불변(재갱신 없음).

### API-01_003 API 인증 실패
- **유형/우선순위/자동화**: 권한/인증 · 높음 · 자동 | **PROC/분기**: PROC-301 / EX-SEC-003

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /api/status/:trackingKey | 자격 누락·불일치·서명 오류·주체 불일치 | 401 EX-SEC-003 | B1 |

- **데이터 검증**: API_AUTH_FAIL 감사(추적 키 마스킹, FN-010). 자격 값 로그 미기록(상수 시간 비교).

### API-01_004 연동 추적 키 형식 위반(비공백·255)
- **유형/우선순위/자동화**: Negative · 높음 · 자동 | **PROC/분기**: PROC-301 / EX-DATA-002

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /api/status/:trackingKey | trackingKey 공백 | 400 EX-DATA-002 "연동 추적 키 형식이 올바르지 않습니다." | B3 (DATA-002-07) |
| 2 | GET /api/status/:trackingKey | trackingKey 최대 길이 255 초과 | 400 EX-DATA-002 | B3 |

- **비고**: UUID 등 특정 형식 강제 없음(발송처 구성 자유, DATA-002-06). 형식 위반은 비공백·255 초과만.

### API-01_005 연동 추적 키 미존재(만료 삭제 포함)
- **유형/우선순위/자동화**: Negative · 높음 · 자동 | **PROC/분기**: PROC-301 / EX-DATA-003

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /api/status/:trackingKey | 형식 맞으나 미존재(또는 배치 삭제됨) trackingKey | 404 EX-DATA-003 | B4 (EXC-DATA-04) |

- **비고**: PROC-402 배치 삭제분과 정합(삭제 사실 미보관). BAT-02_011 대칭.

### API-01_006 요청 제한 초과
- **유형/우선순위/자동화**: Negative · 보통 · 자동 | **PROC/분기**: PROC-301 / EX-OPS-001

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /api/status/:trackingKey | 인증 주체 기준 분당 60회 이내 | 통과(경계 내) | B2 |
| 2 | GET /api/status/:trackingKey | 61회째(초과) | 429 EX-OPS-001, RATE_LIMIT 감사 | B2 |

- **비고**: 임계치 60/분 기본안(BLK-06).

### API-01_007 응답 4항목·추적 키 원문 에코(로그·감사만 마스킹)
- **유형/우선순위/자동화**: Positive(DATA) · 높음 · 자동 | **PROC/분기**: PROC-301 / SEC-005-02·04
- **정책 근거**: FN-010 이 정본 — 처리상태 조회 응답의 trackingKey 는 발송처 자신의 값이라 **원문 그대로 에코**(신규 유출 아님)하고, 마스킹(앞2·뒤2)은 로그·감사·오류 응답에만 적용한다(SEC-005-04). `#237` spec 자기모순(구 PROC-301/SVC-006 응답 마스킹 기대) 해소.

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /api/status/:trackingKey | 유효 조회 | 응답 = {trackingKey(**원문 에코** — 발송처 자신의 값),isSuccess,isResultConfirmed,processedAt,resultConfirmedAt} | B6 |

- **데이터 검증**: 응답 DTO 에 회원 키·config_id·기타 컬럼 부재(MDL-302). 응답 trackingKey = 조회 키 원문 무변형(FN-010). processedAt ISO8601·resultConfirmedAt(미확인 시 null). 감사 로그(STATUS_CHECK) 의 trackingKey 는 앞2·뒤2 마스킹(SEC-005-04·FN-010).

### API-01_008 크기 초과·주입 무해 통과
- **유형/우선순위/자동화**: Boundary · 보통 · 자동 | **PROC/분기**: PROC-301 / EX-DATA-003·EX-SEC-005
- **정책 근거**: SEC-004-01(허용 문자 화이트리스트·주입 재검증 불요 — 파라미터 바인딩 SEC-004-02 단독 방어). 주입 패턴 trackingKey 는 비매칭 일반값으로 무해 통과해 미존재 404(EX-DATA-003)로 수렴한다(코드가 정책 준수 — `#240` TC 정합).

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /api/status/:trackingKey | 주입 패턴 trackingKey(비공백·255 이내) | 404 EX-DATA-003(파라미터 바인딩 의존·주입 무실행 — 비매칭 일반값 취급, SEC-004-01/02) | B4 |
| 2 | 〃 | 본문 1MB 초과 | 413 EX-SEC-005 | B3 |

### API-01_009 조회·갱신 오류
- **유형/우선순위/자동화**: 시스템예외 · 보통 · 반자동 | **PROC/분기**: PROC-301 / EX-FN-999

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /api/status/:trackingKey (DB 오류 주입) | 유효 요청 | 500 EX-FN-999 | B4·B5 |

### API-01_010 추적 키 재사용 시 처리 일시 최신 1건 조회
- **유형/우선순위/자동화**: Boundary · 보통 · 자동 | **PROC/분기**: PROC-301 / EXC-BIZ-12

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /api/status/:trackingKey | 동일 tracking_key 복수 처리 상태(processed_at 상이) | 200, 처리 일시 최신 1건 반환·갱신(IX_STATUS_TRACKING ORDER BY processed_at DESC LIMIT 1) | B4·B5 |

- **데이터 검증**: 최신 1건만 결과 확인 갱신(직전 건 불변). 추적 키는 발송처 구성이라 유니크 미강제(surrogate id PK, 재사용 수용, EXC-BIZ-12).
