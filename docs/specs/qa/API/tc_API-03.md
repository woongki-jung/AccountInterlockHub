# 완료 콜백 API 테스트 케이스 정의 (API-03)

## 개요

- **검증 목적**: 수신처(B)가 정보연계 처리를 완료하고 전달받은 연동 추적 키 기준으로 완료를 허브에 통지하는 서버 대면 콜백 API 가 — API 인증(수신처 자격·주체 분리), 요청 제한, 입력 검증, 추적 키 스코프의 미수신 최신 이력 1건 완료 기록, 재통지·동시 콜백 멱등 성공, 대상 미특정 단일 404, 처리상태(ENT-004) 4항목 불변경을 정확히 수행하는지 검증한다. `#214` 로 대상 특정 스코프를 구 {연동 구성 식별자 + 사용자 키값}에서 **연동 추적 키 단독(MDL-305=trackingKey 단독)**으로 전환했다.
- **관련 PRD 요구사항**: [`../../../prd/PRD.md`](../../../prd/PRD.md) §수행 범위 6 "수신처가 정보연계 완료를 전달받은 추적 키 기준으로 허브에 통지(콜백)하는 API". 검증 대상 PROC-303(내부 PROC-403, SVC-009). 엔드포인트 `POST /api/interlock/callback`.
- **공통 판정 기준**: [spec-qa.md §7](../spec-qa.md).
- **전 TC 공통 전제**: 시드 = 연동이력(콜백 미수신 신규·수신 완료·미수신 복수)·서비스 대면 API 자격(수신처/발송처 각 유효/무효) [SQL·환경]. 인증 수단(API Key/HMAC)은 spec 확정 기본값(구체 알고리즘 build, BLK-05). 추적 키 단독 스코프·재통지 멱등은 확정 기본안(BLK-16).

---

### API-03_001 완료 기록 성공
- **유형/우선순위/자동화**: Positive · 높음 · 자동 | **PROC/분기**: PROC-303 / BR-303(미수신 존재)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /api/interlock/callback | 유효 수신처 자격·MDL-305{trackingKey}(스코프 미수신 이력 존재) | 인증·제한·형식 통과 | B1~B3 |
| 2 | 완료 기록(내부 PROC-403 → FN-018) | — | 미수신 최신 1건 UPDATE callback_received=true·callback_received_at=now, 200 {success:true} | B4 (BR-303) |

- **데이터 검증**: 대상 ENT-007 행 callback_received false→true·callback_received_at 기록(surrogate id + WHERE callback_received=false 가드). CALLBACK_RECORDED(SUCCESS, 추적 키 마스킹) 감사. 처리상태(ENT-004) 무변경(BIZ-004-11).

### API-03_002 재통지 멱등 성공
- **유형/우선순위/자동화**: 상태전이 · 높음 · 자동 | **PROC/분기**: PROC-303 / BR-303(재통지)
- **정책 근거**: 스코프 내 미수신 없고 완료 이력만 존재 = 재통지 멱등 성공(EXC-BIZ-10).

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /callback | 스코프 내 완료(수신) 이력만 존재(미수신 없음) | 200 {success:true}, 상태 변경 없음 | B4 (target=null·anyInScope=true) |

- **데이터 검증**: 이력 무갱신(callback_received_at 최초 값 불변). CALLBACK_IDEMPOTENT(INFO) 감사. 404 아님(대상 미특정과 구별).

### API-03_003 동시 콜백 멱등(조건절 가드)
- **유형/우선순위/자동화**: 상태전이 · 보통 · 반자동 | **PROC/분기**: PROC-303 / BR-303(ROW_COUNT=0)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /callback 2건 동시(동일 대상) | 미수신 최신 1건 대상 | 1건 UPDATE 성공(n=1)·나머지 n=0 멱등 성공, 둘 다 200 | B4 (WHERE callback_received=false 가드) |

- **데이터 검증**: callback_received 최초 1회만 반영(이중 기록 없음). n=0 경로 CALLBACK_IDEMPOTENT(INFO) 감사. 별도 락 미사용(원자적 조건부 UPDATE).

### API-03_004 스코프 미수신 최신 1건 특정(추적 키 재사용)
- **유형/우선순위/자동화**: Boundary · 보통 · 자동 | **PROC/분기**: PROC-303 / BIZ-004-09·EXC-BIZ-12

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /callback | 동일 trackingKey 로 미수신 복수 이력(요청 일시 상이) | 최신(requested_at DESC) 1건만 UPDATE, 직전 미수신 건 불변 | B4 (IX_HISTORY_TRACKING, pendingOnly) |

- **데이터 검증**: 미수신 여러 건 중 최신 1건만 callback_received=true. 나머지 미수신 유지(후속 콜백 대상). 추적 키 단독 스코프·요청 일시 tiebreaker(EXC-BIZ-12).

### API-03_005 전달 실패 건 콜백 완료 기록
- **유형/우선순위/자동화**: Positive · 보통 · 자동 | **PROC/분기**: PROC-303 / BR-303(미수신 존재)·EXC-BIZ-11
- **정책 근거**: 복호화 성공 후 전달 실패 건 이력도 생성·미수신 유지되어 콜백 대상(EXC-BIZ-11). 복호화 이전 거부·복호화 실패는 이력 미생성이라 콜백 대상 아님.

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /callback | 전달 실패(처리상태=실패)로 미수신 유지된 이력 | 200, 해당 이력 완료 기록(callback_received=true) | B4 |

- **데이터 검증**: 이력은 처리상태 성공/실패와 독립(추적 키 참조로만 연결). 처리상태 4항목 무변경(BIZ-004-11). [tc_USR-02_016](../USR/tc_USR-02.md) 전달 실패 이력 유지와 정합.

### API-03_006 처리상태 4항목 불변경
- **유형/우선순위/자동화**: Positive(DATA) · 높음 · 자동 | **PROC/분기**: PROC-303 / BIZ-004-11

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | 콜백 전 ENT-004 스냅샷 | is_success·is_result_confirmed·processed_at·result_confirmed_at 캡처 | 기준값 | — |
| 2 | POST /callback | 완료 기록 | 200, 연동이력만 갱신 | B4 |
| 3 | 콜백 후 ENT-004 비교 | — | 4항목 전부 불변 | B4 |

- **데이터 검증**: 완료 콜백 수신(처리완료)은 연동이력에만 반영 — API-01 의 처리 성공(전달 성공)과 의미 분리, 두 추적은 연동 추적 키 참조로만 연결(DATA-005-08).

### API-03_007 대상 미특정 단일 404
- **유형/우선순위/자동화**: Negative · 높음 · 자동 | **PROC/분기**: PROC-303 / EX-BIZ-006
- **정책 근거**: 스코프 내 이력 자체 없음(미존재·배치 삭제·미기록)을 구별하지 않는 단일 404(존재 여부 비노출).

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /callback | (a) 미존재 trackingKey | 404 EX-BIZ-006 "통지 대상을 찾을 수 없습니다." | B4 (target=null·anyInScope=false) |
| 2 | POST /callback | (b) 배치 삭제된 스코프 | 404 EX-BIZ-006(동일) | B4 (EXC-DATA-11) |
| 3 | POST /callback | (c) 복호화 이전 종료로 이력 미기록 | 404 EX-BIZ-006(동일) | B4 (anyInScope=false) |

- **데이터 검증**: 세 경우 동일 응답. CALLBACK_TARGET_MISS(FAIL, 추적 키 마스킹) 감사. 재통지(완료 이력만 존재, API-03_002)와 구별.

### API-03_008 인증 실패·주체 불일치
- **유형/우선순위/자동화**: 권한/인증 · 높음 · 자동 | **PROC/분기**: PROC-303 / EX-SEC-003

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /callback | 자격 누락·불일치·서명 오류 | 401 EX-SEC-003 "인증에 실패했습니다." | B1 (SEC-003-01) |
| 2 | POST /callback | 발송처(A) 자격으로 호출(주체 불일치) | 401 EX-SEC-003(수신처 자격만 통과) | B1 (SEC-003-03) |

- **데이터 검증**: API_AUTH_FAIL 감사(추적 키 마스킹). 자격 값 로그 미기록. 인증 수단 spec 확정·구체 알고리즘 build(BLK-05).

### API-03_009 입력 검증·크기 위반
- **유형/우선순위/자동화**: Negative · 보통 · 자동 | **PROC/분기**: PROC-303 / EX-SEC-004·EX-SEC-005

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /callback | trackingKey 공란(필수 누락) | 400 EX-SEC-004 "요청이 올바르지 않습니다." | B3 |
| 2 | POST /callback | 허용 문자 위반·주입 패턴·255 초과 | 400 EX-SEC-004 | B3 |
| 3 | POST /callback | 본문 1MB 초과 | 413 EX-SEC-005 | B3 |

- **비고**: MDL-305 = trackingKey 단독(NotBlank·MaxLength(255)). 구 configCode·userKey 2항목 회신 폐기.

### API-03_010 요청 제한 초과
- **유형/우선순위/자동화**: Negative · 보통 · 자동 | **PROC/분기**: PROC-303 / EX-OPS-001

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /callback | 분당 60회 이내 | 통과(경계 내) | B2 |
| 2 | POST /callback | 61회째(초과) | 429 EX-OPS-001, RATE_LIMIT 감사(scope='callback') | B2 |

- **비고**: 임계치 60/분 기본안(BLK-06).

### API-03_011 특정·기록 오류
- **유형/우선순위/자동화**: 시스템예외 · 보통 · 반자동 | **PROC/분기**: PROC-303 / EX-FN-999

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /callback (UPDATE·조회 오류 주입) | 유효 요청 | 500 EX-FN-999 "잠시 후 다시 시도해주세요.", 진행 UPDATE 롤백 | B4 |

- **데이터 검증**: 트랜잭션 롤백으로 부분 기록 없음. 감사 기록.
