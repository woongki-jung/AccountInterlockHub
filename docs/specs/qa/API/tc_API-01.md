# 처리상태 확인 API 테스트 케이스 정의 (API-01)

## 개요

- **검증 목적**: 서비스 A 가 요청 키값으로 처리·결과 확인 상태를 조회하는 서버 대면 API 가 — API 인증, 요청 제한, UUID 형식 검증, 최초 조회 시 결과 확인 여부 멱등 갱신, 응답 4항목만·회원 키/configId 배제·마스킹을 정확히 수행하는지 검증한다.
- **관련 PRD 요구사항**: [`../../../prd/PRD.md`](../../../prd/PRD.md) §수행 범위 "처리상태 확인 API". 검증 대상 PROC-301(SVC-006). 엔드포인트 `GET /api/status/:requestKey`.
- **공통 판정 기준**: [spec-qa.md §7](../spec-qa.md).
- **전 TC 공통 전제**: 시드 = 처리상태(완료·미완료 각 신규)·서비스 대면 API 자격(유효/무효)·미존재 요청 키값 [SQL·환경]. 인증 수단(API 키/서명)은 미확정(BLK-05).

---

### API-01_001 상태 조회 성공·최초 결과 확인 갱신
- **유형/우선순위/자동화**: Positive · 높음 · 자동 | **PROC/분기**: PROC-301 / BR-301(최초)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /api/status/:requestKey | 유효 자격·미확인 상태 requestKey | 인증·제한·형식 통과 | B1~B3 |
| 2 | 상태 조회·갱신 | — | 200 MDL-302(4항목+requestKey 에코) | B4~B6 |

- **데이터 검증**: ENT-004 is_result_confirmed 0→1·result_confirmed_at=now 갱신(WHERE is_result_confirmed=0 멱등 가드). 응답에 회원 키·config_id 부재.

### API-01_002 재조회 무갱신(멱등)
- **유형/우선순위/자동화**: 상태전이 · 높음 · 자동 | **PROC/분기**: PROC-301 / BR-301(재조회)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /api/status/:requestKey | 이미 확인된(is_result_confirmed=1) 상태 | 200, 갱신 없이 현재 상태 | B5 |

- **데이터 검증**: result_confirmed_at 최초 값 불변(재갱신 없음).

### API-01_003 API 인증 실패
- **유형/우선순위/자동화**: 권한/인증 · 높음 · 자동 | **PROC/분기**: PROC-301 / EX-SEC-003

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /api/status/:requestKey | 자격 누락·불일치·서명 오류 | 401 EX-SEC-003 | B1 |

- **데이터 검증**: API_AUTH_FAIL 감사(요청 키값 마스킹, FN-010). 자격 값 로그 미기록.

### API-01_004 요청 키값 UUID 형식 불일치
- **유형/우선순위/자동화**: Negative · 높음 · 자동 | **PROC/분기**: PROC-301 / EX-DATA-002

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /api/status/:requestKey | requestKey 비UUID v4 | 400 EX-DATA-002 "형식이 올바르지 않습니다." | B3 (DATA-002-04) |

### API-01_005 요청 키값 미존재(만료 삭제 포함)
- **유형/우선순위/자동화**: Negative · 높음 · 자동 | **PROC/분기**: PROC-301 / EX-DATA-003

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /api/status/:requestKey | 형식 맞으나 미존재(또는 배치 삭제됨) UUID v4 | 404 EX-DATA-003 | B4 (EXC-DATA-04) |

- **비고**: PROC-402 배치 삭제분과 정합(삭제 사실 미보관).

### API-01_006 요청 제한 초과
- **유형/우선순위/자동화**: Negative · 보통 · 자동 | **PROC/분기**: PROC-301 / EX-OPS-001

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /api/status/:requestKey | 인증 주체 기준 분당 60회 이내 | 통과(경계 내) | B2 |
| 2 | GET /api/status/:requestKey | 61회째(초과) | 429 EX-OPS-001, RATE_LIMIT 감사 | B2 |

- **비고**: 임계치 60/분 기본안(BLK-06).

### API-01_007 응답 4항목·마스킹
- **유형/우선순위/자동화**: Positive(DATA) · 높음 · 자동 | **PROC/분기**: PROC-301 / SEC-005-02

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /api/status/:requestKey | 유효 조회 | 응답 = {requestKey,isSuccess,isResultConfirmed,processedAt,resultConfirmedAt} | B6 |

- **데이터 검증**: 응답 DTO 에 회원 키·config_id·기타 컬럼 부재(MDL-302). processedAt ISO8601·resultConfirmedAt(미확인 시 null).

### API-01_008 크기·주입 위반
- **유형/우선순위/자동화**: Boundary · 보통 · 자동 | **PROC/분기**: PROC-301 / EX-SEC-004·EX-SEC-005

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /api/status/:requestKey | 허용 문자 위반·주입 | 400 EX-SEC-004 | B3 |
| 2 | 〃 | 본문 1MB 초과 | 413 EX-SEC-005 | B3 |

### API-01_009 조회·갱신 오류
- **유형/우선순위/자동화**: 시스템예외 · 보통 · 반자동 | **PROC/분기**: PROC-301 / EX-FN-999

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /api/status/:requestKey (DB 오류 주입) | 유효 요청 | 500 EX-FN-999 | B4·B5 |
