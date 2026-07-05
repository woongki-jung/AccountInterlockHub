# 연동 구성 조회·목록·활성/삭제 테스트 케이스 정의 (ADM-02)

## 개요

- **검증 목적**: 연동 구성의 목록(MDL-102)·상세(MDL-101) read-only 조회, 활성/비활성 전환(PROC-105), 소프트 삭제(PROC-106)가 정확히 동작하고, 삭제된 구성 제외·config_code 재사용·감사 기록이 정책대로 처리되는지 검증한다.
- **관련 PRD 요구사항**: [`../../../prd/PRD.md`](../../../prd/PRD.md) §수행 범위·§성과 지표 "활성 연동 구성 수". 검증 대상 PROC-102·105·106(SVC-002).
- **공통 판정 기준**: [spec-qa.md §7](../spec-qa.md).
- **전 TC 공통 전제**: PROC-104 IP 게이트 통과 + FN-003 유효 세션. 시드 = 연동 구성(활성·비활성·삭제됨) [SQL].

---

### ADM-02_001 목록 조회 정상
- **유형/우선순위/자동화**: Positive · 높음 · 자동 | **PROC/분기**: PROC-102 (GET /api/admin/configs)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | SCR-002 mount | filter 기본 | GET 요청(active·keyword) | F1 |
| 2 | GET /configs | — | 200 MDL-102[] (config_code·활성 Badge·동의항목 수·생성일시), 생성일 DESC | B2 |

- **데이터 검증**: 응답에 deleted_at NOT NULL 구성 제외, consent_item_count 집계 정확.

### ADM-02_002 상세 조회 정상(자식 포함)
- **유형/우선순위/자동화**: Positive · 높음 · 자동 | **PROC/분기**: PROC-102 (GET /configs/:id)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /configs/:id | 유효 id | 200 MDL-101(A/B 주소·method·동의항목·파라미터 display_order 정렬) | B3 |

- **화면 검증**: SCR-004 Card 렌더. 서비스 A/B URL 마스킹 없음(EXC-SEC-05), 회원 키·처리 상태 미표시.

### ADM-02_003 목록 0건 EmptyState
- **유형/우선순위/자동화**: Positive · 보통 · 자동 | **PROC/분기**: PROC-102 (분기 목록 0건)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /configs | 결과 없는 필터 | 200 빈 배열, FE EmptyState + 등록 CTA | B2·F2 |

### ADM-02_004 상세 대상 없음(오류 아님)
- **유형/우선순위/자동화**: Negative · 보통 · 자동 | **PROC/분기**: PROC-102 (분기 상세 없음)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /configs/:id | 삭제됨·부재 id | 200 `{data:null}` (오류 아님), FE "대상 없음" | B3 |

### ADM-02_005 조회 조건 주입·허용 문자 위반
- **유형/우선순위/자동화**: Negative · 높음 · 자동 | **PROC/분기**: PROC-102 / EX-SEC-004

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /configs?keyword= | 주입 패턴·허용 문자 위반 | 400 EX-SEC-004 | B1 (SEC-004-01) |

### ADM-02_006 활성 전환 정상
- **유형/우선순위/자동화**: Positive · 높음 · 자동 | **PROC/분기**: PROC-105 / BR-103(활성)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | SCR-002/004 활성 Toggle | isActive=true | PATCH 요청 | F1 |
| 2 | PATCH /configs/:id/active | {isActive:true} | 200 {id,isActive}, Toast | B2·B3 |

- **데이터 검증**: ENT-001 is_active=1·updated_at/by 갱신 + ENT-006 CONFIG_ACTIVATE 감사.

### ADM-02_007 비활성 전환·진입 제외
- **유형/우선순위/자동화**: 상태전이 · 높음 · 자동 | **PROC/분기**: PROC-105 / BR-103(비활성)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | PATCH /configs/:id/active | {isActive:false} | 200, CONFIG_DEACTIVATE 감사 | B2·B3 |
| 2 | 이후 서비스 A 진입(PROC-201) | 해당 config_code | 유효 활성 구성 아님 → 400 EX-SEC-004(is_active=1 조건 배제) | (연계) |

- **비고**: 활성 기본값·상태 모델 확정 대기(BLK-11).

### ADM-02_008 활성 전환 대상 없음
- **유형/우선순위/자동화**: Negative · 보통 · 자동 | **PROC/분기**: PROC-105 (분기 대상 없음)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | PATCH /configs/:id/active | 삭제됨·부재 id | 200 `{data:null}` (affected=0) | B2 |

### ADM-02_009 활성 전환 형식 위반
- **유형/우선순위/자동화**: Negative · 보통 · 자동 | **PROC/분기**: PROC-105 / EX-SEC-004

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | PATCH /configs/:id/active | isActive 비boolean·id 비UUID | 400 EX-SEC-004 | B1 |

### ADM-02_010 소프트 삭제 정상
- **유형/우선순위/자동화**: Positive · 높음 · 자동 | **PROC/분기**: PROC-106 / BR-104(존재)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | SCR-002/004 삭제 확인 Modal 확정 | id | DELETE 요청 | F1 |
| 2 | DELETE /configs/:id | — | 200 {id,deleted:true}, 목록 행 제거 | B2·B3 |

- **데이터 검증**: ENT-001 deleted_at 설정(물리 삭제 아님)·자식 CASCADE 미발생 + CONFIG_DELETE 감사. 처리 상태(ENT-004) 연쇄 삭제 없음.

### ADM-02_011 삭제 후 config_code 재사용
- **유형/우선순위/자동화**: 상태전이 · 보통 · 자동 | **PROC/분기**: PROC-106→PROC-101 / EXC-BIZ-02

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | DELETE /configs/:id | 대상 삭제 | deleted_at 설정 | PROC-106 B2 |
| 2 | POST /configs | 동일 config_code 신규 등록 | 200 성공(필터 유니크로 재사용 허용) | PROC-101 B2 |

### ADM-02_012 이미 삭제 대상 재삭제(멱등)
- **유형/우선순위/자동화**: Negative · 보통 · 자동 | **PROC/분기**: PROC-106 / BR-104(부재)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | DELETE /configs/:id | 이미 삭제된 id | 200 `{data:null}` (멱등, 오류 아님) | B2 |

### ADM-02_013 미인증·세션 만료 차단(화면별 권한)
- **유형/우선순위/자동화**: 권한/인증 · 높음 · 자동 | **PROC/분기**: PROC-102 / EX-AUTH-001·002

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /configs (세션 없음) | — | 401 EX-AUTH-001 | B1 |
| 2 | GET /configs/:id (유휴 만료 세션) | — | 401 EX-AUTH-002, SCR-001 재인증 | B1 |

### ADM-02_014 검색어 길이 경계
- **유형/우선순위/자동화**: Boundary · 낮음 · 자동 | **PROC/분기**: PROC-102 / EX-SEC-004

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /configs?keyword= | 100자(경계) | 200 정상 조회 | B1·B2 |
| 2 | GET /configs?keyword= | 101자(초과) | 400 EX-SEC-004 | B1 |

### ADM-02_015 조회·전환·삭제 DB 오류
- **유형/우선순위/자동화**: 시스템예외 · 보통 · 반자동 | **PROC/분기**: PROC-102·105·106 / EX-FN-999

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET/PATCH/DELETE (DB 오류 주입) | — | 500 EX-FN-999 | 각 PROC B단계 |

- **비고**: 활성 전환·삭제는 UPDATE 오류 시 롤백. 조회는 감사 없이 오류 응답.

### ADM-02_016 SCR-002/004 설정 데이터 표시·마스킹 예외
- **유형/우선순위/자동화**: Positive(UI) · 보통 · 수동 | **PROC/분기**: PROC-102 / SEC-005·EXC-SEC-05

| 검증 항목 | 화면(SCR) | 검증 내용 | 기대 결과 |
|--|--|--|--|
| 데이터 노출 | SCR-002·004 | 설정 데이터만(MDL-101/102) | 회원 키·처리 상태 필드 부재 |
| 마스킹 예외 | SCR-004 | 서비스 A/B URL 표시 | 마스킹 없음(설정 데이터, EXC-SEC-05) |
| 접근성 | SCR-002 | 활성 Badge 색+텍스트 병기 | WCAG AA(4.5:1)·상태 텍스트 병기 |
| 반응형 | SCR-002 | mobile<640/desktop>1024 | 레이아웃 정상 전환(컨테이너 1120px) |
