# 처리상태 저장·결과확인 갱신 테스트 케이스 정의 (BAT-01)

## 개요

- **검증 목적**: 처리 상태(ENT-004)의 저장·결과 확인 갱신 종착 프로세스가 — 복호화 성공 후 전달 성공·실패 모두 상태 1건 생성, 개인식별 컬럼 원천 배제, CHECK 정합(결과 확인 여부↔일시), 최초 조회 시 멱등 갱신을 정확히 수행하는지 검증한다. `#214` 로 조회 키를 허브 발급 요청 키값(UUID PK)에서 **연동 추적 키(tracking_key)**로 전환하고, tracking_key 는 발송처 구성이라 유니크 강제 불가로 내부 surrogate uuid `id` 를 PK·tracking_key 를 비유니크 조회 인덱스로 둔다. 거부 경로의 상태 저장(구 PROC-202 거부→PROC-401)은 폐기됐다 — 복호화 이전 거부·복호화 실패는 추적 키가 없어 상태를 저장하지 않는다(감사만).
- **관련 PRD 요구사항**: [`../../../prd/PRD.md`](../../../prd/PRD.md) §시스템 제약사항 "연동 추적 키별 상태만 저장". 검증 대상 PROC-401(SVC-005·BAT-01). PROC-203 저장·PROC-301 갱신이 위임 호출(독립 엔드포인트 없음).
- **공통 판정 기준**: [spec-qa.md §7](../spec-qa.md).
- **전 TC 공통 전제**: 시드 = 접근 주소 구성(활성)·복호화 성공 컨텍스트·처리상태(미확인·추적 키 재사용) [SQL]. 저장 트리거는 PROC-203(FN-012 경유), 갱신 트리거는 PROC-301.

---

### BAT-01_001 상태 저장(전달 성공)
- **유형/우선순위/자동화**: Positive · 높음 · 자동 | **PROC/분기**: PROC-401 (호출 PROC-203)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | FN-009_saveStatus | {trackingKey,configId,isSuccess:true,processedAt} | ENT-004 1건 INSERT(surrogate id PK) | B1 |

- **데이터 검증**: `SELECT` 1건 — tracking_key(X 추출값)·is_success=true·is_result_confirmed=false·result_confirmed_at=NULL·processed_at 기록·created_at 자동(DATA-003-05/06).

### BAT-01_002 상태 저장(전달 실패)
- **유형/우선순위/자동화**: Positive · 높음 · 자동 | **PROC/분기**: PROC-401 (호출 PROC-203 실패)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | FN-009_saveStatus | isSuccess:false(전달 실패, 재시도 2회 후) | ENT-004 1건(is_success=false) | B1 (EXC-BIZ-06) |

- **데이터 검증**: 복호화 성공 이후의 전달 실패(502)여도 상태 1건 반드시 저장. 복호화 이전 거부·복호화 실패는 추적 키 없어 미저장(감사만, tc_USR-01_007·tc_USR-02_003).

### BAT-01_003 개인식별 컬럼 배제
- **유형/우선순위/자동화**: Positive(DATA) · 높음 · 자동 | **PROC/분기**: PROC-401 / DATA-001-05·DATA-003-04

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | 스키마·저장 검증 | 저장 요청 | ENT-004 컬럼 = tracking_key·config_id·상태 4항목·id·created_at 뿐 | B1 assert |

- **데이터 검증**: 회원 키·복호화 원문·암호값·생년월일 컬럼 부재(원천 배제). id·config_id·created_at 은 비개인 운영 컬럼(EXC-DATA-06 허용).

### BAT-01_004 CHECK 정합 경계
- **유형/우선순위/자동화**: Boundary · 높음 · 자동 | **PROC/분기**: PROC-401 / ENT-004 CHECK

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | INSERT | is_result_confirmed=false AND result_confirmed_at=NULL | 통과(정합) | B1 |
| 2 | INSERT | is_result_confirmed=true AND result_confirmed_at=NULL(위반) | DB CHECK 거부 | B1 |
| 3 | UPDATE | is_result_confirmed=true AND result_confirmed_at=값 | 통과 | B2 |

### BAT-01_005 surrogate PK·추적 키 재사용 시 요청별 1행 저장
- **유형/우선순위/자동화**: Positive(DATA) · 보통 · 자동 | **PROC/분기**: PROC-401 / PK_PROCESS_STATUS·DATA-002

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | INSERT | 동일 tracking_key 2회(재사용) | surrogate id 로 2행 안정 저장(PK 위반 아님, 재사용 수용) | B1 |

- **데이터 검증**: tracking_key 는 비유니크 조회 인덱스(IX_STATUS_TRACKING), id 는 uuid PK. 발송처 구성 값이라 허브가 유니크를 강제하지 않는다(EXC-BIZ-12). 조회는 처리 일시 최신 1건(BAT-01_008).

### BAT-01_006 결과 확인 최초 갱신
- **유형/우선순위/자동화**: Positive · 높음 · 자동 | **PROC/분기**: PROC-401 / BR-301(최초, 호출 PROC-301)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | FN-009_confirmResult | 미확인 상태·now | is_result_confirmed false→true·result_confirmed_at=now | B2 |

- **데이터 검증**: `WHERE id=? AND is_result_confirmed=false` surrogate id 멱등 가드로 1회만 반영.

### BAT-01_007 재확인 무갱신(멱등)
- **유형/우선순위/자동화**: 상태전이 · 보통 · 자동 | **PROC/분기**: PROC-401 / BR-301(재실행)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | FN-009_confirmResult | 이미 is_result_confirmed=true | UPDATE 미반영(멱등, result_confirmed_at 불변) | B2 |

### BAT-01_008 추적 키 재사용 시 처리 일시 최신 1건 갱신
- **유형/우선순위/자동화**: Boundary · 보통 · 자동 | **PROC/분기**: PROC-401 / EXC-BIZ-12

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | FN-009_confirmResult | 동일 tracking_key 복수 상태(processed_at 상이) | (tracking_key, processed_at DESC) 최신 1건만 갱신, 직전 건 불변 | B2 |

- **데이터 검증**: IX_STATUS_TRACKING 최신 1건 선정(EXC-BIZ-12). PROC-301 조회와 동일 규칙.

### BAT-01_009 INSERT·UPDATE 오류
- **유형/우선순위/자동화**: 시스템예외 · 보통 · 반자동 | **PROC/분기**: PROC-401 / EX-FN-999

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | 저장·갱신 (DB 오류 주입) | — | 500 EX-FN-999, 트랜잭션 롤백 | B1·B2 |
