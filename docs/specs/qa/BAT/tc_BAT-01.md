# 처리상태 저장·결과확인 갱신 테스트 케이스 정의 (BAT-01)

## 개요

- **검증 목적**: 처리 상태(ENT-004)의 저장·결과 확인 갱신 종착 프로세스가 — 전달 성공·실패·거부 모두 상태 1건 생성, 개인식별 컬럼 원천 배제, CHECK 정합(결과 확인 여부↔일시), 최초 조회 시 멱등 갱신을 정확히 수행하는지 검증한다.
- **관련 PRD 요구사항**: [`../../../prd/PRD.md`](../../../prd/PRD.md) §시스템 제약사항 "요청 키값별 상태만 저장". 검증 대상 PROC-401(SVC-005·BAT-01). PROC-203 저장·PROC-301 갱신이 위임 호출(독립 엔드포인트 없음).
- **공통 판정 기준**: [spec-qa.md §7](../spec-qa.md).
- **전 TC 공통 전제**: 시드 = 연동 구성(활성)·동의 완료/거부 컨텍스트·처리상태(미확인) [SQL]. 저장 트리거는 PROC-203/202, 갱신 트리거는 PROC-301.

---

### BAT-01_001 상태 저장(전달 성공)
- **유형/우선순위/자동화**: Positive · 높음 · 자동 | **PROC/분기**: PROC-401 (호출 PROC-203)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | FN-009_saveStatus | {requestKey,configId,isSuccess:true,processedAt} | ENT-004 1건 INSERT | B1 |

- **데이터 검증**: `SELECT` 1건 — is_success=1·is_result_confirmed=0·result_confirmed_at=NULL·processed_at 기록·created_at 자동(DATA-003-01/02).

### BAT-01_002 상태 저장(거부)
- **유형/우선순위/자동화**: Positive · 높음 · 자동 | **PROC/분기**: PROC-401 (호출 PROC-202 거부)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | FN-009_saveStatus | isSuccess:false(거부) | ENT-004 1건(is_success=0) | B1 (EXC-DATA-03) |

- **데이터 검증**: 거부도 상태 생략 없이 1건 저장.

### BAT-01_003 상태 저장(전달 실패)
- **유형/우선순위/자동화**: Positive · 높음 · 자동 | **PROC/분기**: PROC-401 (호출 PROC-203 실패)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | FN-009_saveStatus | isSuccess:false(전달 실패) | ENT-004 1건(is_success=0) | B1 (EXC-BIZ-06) |

- **데이터 검증**: 전달 실패(502)여도 상태 1건 반드시 저장됨.

### BAT-01_004 개인식별 컬럼 배제
- **유형/우선순위/자동화**: Positive(DATA) · 높음 · 자동 | **PROC/분기**: PROC-401 / DATA-001-02

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | 스키마·저장 검증 | 저장 요청 | ENT-004 컬럼 = 요청 키값·구성 참조·상태 4항목·created_at 뿐 | B1 assert |

- **데이터 검증**: 회원 키·개인정보 컬럼 부재(원천 배제). config_id·created_at 은 비개인 운영 컬럼(EXC-DATA-06 허용).

### BAT-01_005 CHECK 정합 경계
- **유형/우선순위/자동화**: Boundary · 높음 · 자동 | **PROC/분기**: PROC-401 / ENT-004 CHECK

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | INSERT | is_result_confirmed=0 AND result_confirmed_at=NULL | 통과(정합) | B1 |
| 2 | INSERT | is_result_confirmed=1 AND result_confirmed_at=NULL(위반) | DB CHECK 거부 | B1 |
| 3 | UPDATE | is_result_confirmed=1 AND result_confirmed_at=값 | 통과 | B2 |

### BAT-01_006 PK 중복 저장 방지
- **유형/우선순위/자동화**: Negative · 보통 · 자동 | **PROC/분기**: PROC-401 / PK_PROCESS_STATUS

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | INSERT | 동일 request_key 2회 | 2회째 PK 유니크 위반(중복 방지) | B1 |

### BAT-01_007 결과 확인 최초 갱신
- **유형/우선순위/자동화**: Positive · 높음 · 자동 | **PROC/분기**: PROC-401 / BR-301(최초, 호출 PROC-301)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | FN-009_confirmResult | 미확인 상태·now | is_result_confirmed 0→1·result_confirmed_at=now | B2 |

- **데이터 검증**: `WHERE request_key=? AND is_result_confirmed=0` 멱등 가드로 1회만 반영.

### BAT-01_008 재확인 무갱신(멱등)
- **유형/우선순위/자동화**: 상태전이 · 보통 · 자동 | **PROC/분기**: PROC-401 / BR-301(재실행)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | FN-009_confirmResult | 이미 is_result_confirmed=1 | UPDATE 미반영(멱등, result_confirmed_at 불변) | B2 |

### BAT-01_009 INSERT·UPDATE 오류
- **유형/우선순위/자동화**: 시스템예외 · 보통 · 반자동 | **PROC/분기**: PROC-401 / EX-FN-999

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | 저장·갱신 (DB 오류 주입) | — | 500 EX-FN-999, 트랜잭션 롤백 | B1·B2 |
