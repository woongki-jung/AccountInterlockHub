# 발송처 접근 주소 구성 등록·편집 테스트 케이스 정의 (ADM-01)

## 개요

- **검증 목적**: 연동 관리자가 화면 구성만으로 발송처 접근 주소 구성 1건을 등록·편집하고, 서버 재검증 통과 후 ENT-001(+자식 ENT-002 동의 항목)이 단일 트랜잭션으로 원자적 영속화되는지, 정책 위반이 정확한 EX 코드로 차단되는지 검증한다. `#214` 로 전달 파라미터 정의(구 ENT-003)·사용자 키값 파라미터 exactly-one 지정(구 `#33`)·발송처 진입 URL·개인정보 파라미터 경고가 폐기되어 구성 항목이 접근 주소 고유 ID·수신처 B 전달 주소·전달 방식·활성 여부·동의 항목으로 한정됐다.
- **관련 PRD 요구사항**: [`../../../prd/PRD.md`](../../../prd/PRD.md) §수행 범위 1 "관리자 — 발송처 접근 주소 구성". 검증 대상 PROC-101(SVC-001).
- **공통 판정 기준**: [spec-qa.md §7](../spec-qa.md) 참조. 검증 PROC 는 전 TC PROC-101, 엔드포인트 `POST/PUT /api/admin/configs[/:id]`.
- **전 TC 공통 전제**: PROC-104 IP 게이트 통과(허용 IP) + FN-003 유효 세션. 시드 = 관리자 계정(활성)·접근 주소 구성(활성) [SQL]. 별도 명시 시 예외.

---

### ADM-01_001 신규 등록 정상
- **유형/우선순위/자동화**: Positive · 높음 · 자동(INTG)
- **검증 대상**: SVC-001·FN-005·FN-006·ENT-001/002·SCR-003 | **PROC/분기**: PROC-101 / BR-101(CREATE)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | SCR-003 신규 폼 저장 제출 | 유효 config(고유 ID·구성명·수신처 B URL·method·동의항목1) | FE 검증 통과·요청 DTO 변환 | F1 |
| 2 | POST /api/admin/configs | MDL-101 | 200 `{success:true,data:MDL-101}` id 포함 | B1~B4 |
| 3 | 응답 처리 | — | Toast·SCR-004 이동, 캐시 무효화 | F2 |

- **데이터 검증**: `SELECT` ENT-001 1건(config_code 일치·is_active·created_by=세션) + ENT-002 ≥1행(config_id FK) + ENT-006 CONFIG_CREATE 감사 1건. ENT-001 에 발송처키·암호값(encX·encY)·전달 파라미터·회원 키 컬럼 부재(설정 데이터, EXC-BIZ-14).

### ADM-01_002 편집 정상(config_code 불변·자식 교체)
- **유형/우선순위/자동화**: Positive · 높음 · 자동(INTG)
- **검증 대상**: SVC-001·FN-006·ENT-001/002 | **PROC/분기**: PROC-101 / BR-101(EDIT)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | 기존 구성 편집 진입 | :id | 상세 프리필(PROC-102) | F1 |
| 2 | PUT /api/admin/configs/:id | config_name·수신처 B URL·자식 변경(config_code 동일) | 200, updated_at/by 갱신 | B1~B4 |

- **데이터 검증**: ENT-001 config_code 불변·updated_at NOT NULL, 자식 ENT-002 교체(이전 행 제거·신규 삽입) 확인(순환 FK 제거로 지정 참조 정합 순서 불요). ENT-006 CONFIG_UPDATE 감사.

### ADM-01_003 필수 항목 누락 거부(수신처 B 주소·동의 항목)
- **유형/우선순위/자동화**: Negative · 높음 · 자동 | **PROC/분기**: PROC-101 / EX-BIZ-001

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /configs | serviceBDeliveryUrl 공란(필수 누락) | 422 EX-BIZ-001, details 필드 오류 | B2 (BIZ-001-08) |

- **에러 케이스**: 저장 거부·트랜잭션 미진입, ENT-001 INSERT 0건. FE 는 필드 인라인 에러 매핑.

### ADM-01_004 수신처 B URL 형식 오류 거부
- **유형/우선순위/자동화**: Negative · 높음 · 자동 | **PROC/분기**: PROC-101 / EX-BIZ-001

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /configs | serviceBDeliveryUrl='ftp://x' (http/https 아님) | 422 EX-BIZ-001 | B2 (BIZ-001-09) |

### ADM-01_005 동의 항목 0개 거부
- **유형/우선순위/자동화**: Negative · 높음 · 자동 | **PROC/분기**: PROC-101 / EX-BIZ-001

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /configs | consentItems=[] | 422 EX-BIZ-001 | B2 (BIZ-001-04) |

### ADM-01_006 접근 주소 고유 ID 중복 거부
- **유형/우선순위/자동화**: Negative · 높음 · 자동 | **PROC/분기**: PROC-101 / BR-101·EX-BIZ-002

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /configs | 기존 유효 구성과 동일 config_code(고유 ID) | 409 EX-BIZ-002, 롤백 | B2 (BIZ-001-10) |

- **데이터 검증**: 중복 config_code(deleted_at IS NULL) 존재 시 신규 INSERT 미발생. 부분 유니크 UQ_CONFIG_CODE 최종 방어.

### ADM-01_007 접근 주소 고유 ID 길이 경계
- **유형/우선순위/자동화**: Boundary · 보통 · 자동 | **PROC/분기**: PROC-101 / EX-BIZ-001·SEC-004

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /configs | config_code 64자(경계) | 200 저장 성공 | B2·B3 |
| 2 | POST /configs | config_code 65자(초과) | 422 EX-BIZ-001(또는 400 EX-SEC-004) 거부 | B1·B2 |

### ADM-01_008 주입·스크립트 문자 입력 정상 저장(바인딩 단독 방어)
- **유형/우선순위/자동화**: Positive(보안) · 높음 · 자동 | **PROC/분기**: PROC-101 / SEC-004-01(b)·SEC-004-02
- **정책 근거**: SEC-004-01 (b) 파라미터 바인딩 단독 방어 확정(2026-07-09 담당자 결정, qa #54) — 허용 문자·주입 패턴 재검증 미요구. 주입/스크립트 문자는 바인딩으로 무실행 저장되고 출력 이스케이프로 무해하게 표시된다.

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /configs | configName·동의 항목 라벨에 SQL/스크립트 주입 패턴(스키마 길이·형식 통과) | 200 `{success:true}` 저장 성공(거부 없음) | B1~B4 (SEC-004-02 바인딩) |

- **데이터 검증**: payload 원문 그대로 ENT-001(+자식) 영속(무변형)·파라미터 바인딩으로 원시 쿼리 결합 미발생(`DROP TABLE` 미실행·테이블 무손상). 저장형 XSS 는 렌더링 계층 출력 이스케이프(React 기본, SCR-003/004 — `dangerouslySetInnerHTML` 미사용)로 무력화. 형식(타입)·길이 위반은 여전히 거부(ADM-01_007 길이·ADM-01_009 1MB).

### ADM-01_009 본문 1MB 초과 거부
- **유형/우선순위/자동화**: Boundary · 보통 · 자동 | **PROC/분기**: PROC-101 / EX-SEC-005

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /configs | 본문 1MB 초과(대량 동의항목·약관 컨텐츠) | 413 EX-SEC-005 | B1 (SEC-004-03) |

- **비고**: 상한 1MB 는 기본안(BLK-08).

### ADM-01_010 미인증 세션 차단(화면별 권한)
- **유형/우선순위/자동화**: 권한/인증 · 높음 · 자동 | **PROC/분기**: PROC-101 / EX-AUTH-001

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /configs (세션 없음) | 유효 config | 401 EX-AUTH-001 "로그인이 필요합니다." | B1 (AUTH-001-01) |

### ADM-01_011 세션 유휴 만료 차단(편집·PUT)
- **유형/우선순위/자동화**: 권한/인증 · 높음 · 자동 | **PROC/분기**: PROC-101 / EX-AUTH-002

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | PUT /configs/:id (유휴 30분 초과 세션) | config | 401 EX-AUTH-002, FE 는 SCR-001(?expired=1) | B1 (AUTH-002-01) |

- **비고**: 유휴 30분은 기본안(BLK-Q1).

### ADM-01_012 트랜잭션·DB 오류(부분 저장 없음)
- **유형/우선순위/자동화**: 시스템예외 · 높음 · 반자동 | **PROC/분기**: PROC-101 / EX-FN-999

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST/PUT /configs (자식 INSERT 중 DB 오류 주입) | config | 500 EX-FN-999, 전체 롤백 | B3 |

- **데이터 검증**: 롤백으로 부모·자식 부분 저장 0건(원자성). 감사 기록.

### ADM-01_013 편집 시 자기 코드 충돌 아님
- **유형/우선순위/자동화**: Positive · 보통 · 자동 | **PROC/분기**: PROC-101 / BR-101(EDIT·EXC-BIZ-02)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | PUT /configs/:id | 자기 자신 config_code 유지 | 200 저장 성공(고유성 위반 아님) | B2 (selfId 제외) |

### ADM-01_014 동의 항목 약관 컨텐츠 입력·영속화
- **유형/우선순위/자동화**: Positive · 높음 · 자동(INTG)
- **검증 대상**: ENT-002.terms_content·MDL-101.consentItems·SCR-003 | **PROC/분기**: PROC-101 / BIZ-001-06

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | SCR-003 동의 항목 행에 약관 컨텐츠(전체 약관 본문) 입력 후 저장 | consentItems[0].termsContent="본 약관은 …(다행 본문)" | FE 변환·요청 DTO 에 termsContent 포함 | F1 |
| 2 | POST/PUT /api/admin/configs | MDL-101(consentItems 약관 포함) | 200 저장 성공 | B2·B3 |

- **데이터 검증**: `SELECT` ENT-002 해당 행 terms_content 저장 값 == 입력 본문(교체 편집 시에도 재삽입 유지). 다른 항목 terms_content 는 영향 없음.

### ADM-01_015 약관 컨텐츠 미입력 허용(선택)
- **유형/우선순위/자동화**: Positive(경계) · 보통 · 자동 | **PROC/분기**: PROC-101 / BIZ-001-06(선택·비차단)
- **정책 근거**: 약관 컨텐츠는 선택 입력이며 미입력을 허용한다(기본안, EXC-BIZ-07 담당자 확인).

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /configs | consentItems[0].termsContent 미입력(공란/null) | 200 저장 성공(차단 없음) | B2·B3 |

- **데이터 검증**: ENT-002.terms_content NULL 저장. 동의 항목 자체 검증(BIZ-001-04, 1개 이상)은 별개로 통과. USR-01 에서 해당 항목 [상세] 미노출(BIZ-002-05, tc_USR-01_019).
