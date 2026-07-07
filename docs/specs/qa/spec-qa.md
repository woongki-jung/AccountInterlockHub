# 검증 TC 정의서 — AccountInterlockHub

본 문서는 AccountInterlockHub 전체 제품의 품질 검증 TC(테스트 케이스) 정의 개요와 하위 문서 목록을 정의한다. spec 단계 산출물(도메인 7순위·마지막)이며, 방향 근거는 [`../../prd/PRD.md`](../../prd/PRD.md), 정보 구조는 [`../../prd/ia/IA.md`](../../prd/ia/IA.md), 선행 도메인은 정책·서비스·데이터·기능·화면·프로세스 사양 전체다. 검증 환경 구성·실행·평가는 qa 단계 소관이며 본 문서는 **TC 사양 정의**에 한정한다.

용어 약어 — TC 테스트 케이스, SVC 서비스 시나리오, FN 공통 기능, SCR 화면, ENT DB 엔터티, MDL 데이터 모델, POL 정책, PROC 기능구현 프로세스, BR 분기 코드, EX 예외 코드.

## 1. 테스트 전략 요약

### 1-1. 테스트 범위·유형

| 유형 | 약어 | 대상 | 자동화 기대 |
|------|------|------|------------|
| 단위 | UNIT | FN 단위 로직(검증·발급·마스킹·해시) | 자동 |
| 통합 | INTG | API 엔드포인트 요청/응답·DB 연동·서비스 B 외부 연동 | 자동(외부는 목) |
| E2E | E2E | 화면 흐름 전체·노드 간 사용자 여정 | 반자동(UI 자동화) |
| 데이터 정합 | DATA | ENT 제약·생명주기·CHECK·무저장 | 자동(DB 조회) |
| 정책 준수 | POL | 접근 제어·입력 검증·비즈니스 규칙 위반 처리 | 자동/반자동 |
| UI/UX | UI | 레이아웃·상태 표시·접근성·디자인 시스템 | 수동/반자동 |

### 1-2. 우선순위·접근

- 핵심 Happy Path(등록→진입→동의→전달→조회) → 정책 위반 → 예외/에러 → 경계값 순으로 우선한다.
- 외부 연동(서비스 B)·서비스 A 진입은 **목(mock)** 으로 대체하고 실제 수신·상태 반영을 확인한다.
- PROC 의사코드의 모든 BR-/EX- 코드에 대응 TC 를 1개 이상 둔다(PROC ↔ TC 양방향 추적, §5).

### 1-3. 데이터 이관 범위

- **이관 범위 없음(그린필드)**. 기존 시스템 → 새 시스템 데이터 이관이 사업 범위에 없으므로 §4-2 이관 TC(MIG_)는 생략한다.

## 2. 테스트 환경 요약

- **애플리케이션**: 단일 App Service(NestJS TypeScript). NestJS 가 API + React(TS) 정적 빌드 서빙 + 스케줄 배치를 함께 제공한다. 실행 절차·환경변수는 [`../../prd/devspec/infra.md`](../../prd/devspec/infra.md) 원본 참조(민감값 미기재).
- **DB**: PostgreSQL. 개발·로컬은 별도 PostgreSQL 서버. 초기화 = 마이그레이션(테이블·인덱스·CHECK) + 시드 스크립트(§3) 투입.
- **외부 시스템 모킹**: 서비스 B 전달 대상은 목 엔드포인트(200 성공 / 5xx 실패 / 타임아웃)로 구성한다. 서비스 A 진입(`/interlock/entry`)은 목 클라이언트로 요청 키값 발급을 유발한다.
- **관리자 IP 게이트**: 허용/차단 IP 쌍을 운영 구성값으로 주입해 통과·차단을 검증한다(dev 비활성 시에도 로그인 인증 유지).
- **판정 전제**: 결과 판정 5종(🟢 Pass / 🔵 Pass-Mock / 🟣 Pass-Static / 🔴 Fail / 🟠 Block)은 [`../../strategies/qa-execution.md`](../../strategies/qa-execution.md) 정본을 따른다. 본 TC 사양은 그 기대값을 정의한다.

## 3. 시드 데이터 카탈로그

TC 가 요구하는 사전 데이터다. 시드 수단 4종: **SQL**(대량·상태 조작) / **UI**(등록 흐름 자체가 TC) / **API**(외부·발급 상태) / **파일**(대량 등록). 민감값(회원 키·비밀번호 평문·API 자격 원문)은 **직접 기재하지 않는다**.

| 항목 | 최소 수량 | 저장 위치 | 시드 수단 | 확인 방법(재검증) | 비고(검증 TC) |
|------|:--:|------|------|------|------|
| 관리자 계정(활성) | 1 | TBL_ADMIN_ACCOUNT | SQL/운영 스크립트 | `SELECT username,is_active,failed_login_count,locked_until` → is_active=true·count=0·locked_until NULL | ADM-03_001 |
| 관리자 계정(잠금) | 1 | TBL_ADMIN_ACCOUNT | SQL | failed_login_count=5·locked_until>now 확인 | ADM-03_005 |
| 연동 구성(활성+동의항목+파라미터) | 1 | TBL_INTERLOCK_CONFIG(+002·003) | UI(등록 TC)/SQL | is_active=true·deleted_at NULL, 자식 COUNT(동의≥1·파라미터≥1) | ADM-01·USR-01 |
| 연동 구성(사용자 키값 파라미터 지정) | 1 | TBL_INTERLOCK_CONFIG(+003) | SQL/UI | user_key_param_id NOT NULL(ENT-003.id 참조) | ADM-01_017·BAT-03_001·API-02·API-03 |
| 연동 구성(미지정) | 1 | TBL_INTERLOCK_CONFIG | SQL/UI | user_key_param_id IS NULL | ADM-01_020·BAT-03_002·API-02_006·API-03_007 |
| 연동 구성(비활성) | 1 | TBL_INTERLOCK_CONFIG | SQL | is_active=false·deleted_at NULL | ADM-02_007·USR-01_003 |
| 연동 구성(삭제됨) | 1 | TBL_INTERLOCK_CONFIG | SQL | deleted_at NOT NULL, 목록·상세 제외 | ADM-02_004·012 |
| 처리상태(완료·신규) | 1 | TBL_INTERLOCK_PROCESS_STATUS | SQL/API | is_result_confirmed=true·result_confirmed_at 최근·CHECK 정합 | API-01_002 |
| 처리상태(완료·90일 경과) | 1 | 〃 | SQL | is_result_confirmed=true AND result_confirmed_at < now-90d | BAT-02_001·003 |
| 처리상태(미완료·신규) | 1 | 〃 | SQL/API | is_result_confirmed=false·result_confirmed_at NULL·processed_at 최근 | API-01_001·BAT-02 |
| 처리상태(미완료·90일 경과) | 1 | 〃 | SQL | is_result_confirmed=false AND processed_at < now-90d | BAT-02_002·004 |
| 처리상태(90일 경과·대량) | 청크 크기 초과(기본 5,000행+1 이상, ENT-004) | 〃 | SQL | 경과 조건 COUNT(*) > 청크 크기 확인(2청크 이상 분량) | BAT-02_010 |
| 연동이력(콜백 수신·신규) | 1 | TBL_INTERLOCK_HISTORY | SQL/API | callback_received=true·callback_received_at 최근·수신 CHECK 정합 | API-02_001·BAT-02_011 |
| 연동이력(콜백 미수신·신규) | 1 | 〃 | SQL/API | callback_received=false·callback_received_at NULL·requested_at 최근 | API-02_002·API-03_001·BAT-02_012 |
| 연동이력(스코프 복수 건) | 2 이상 | 〃 | SQL | 동일 config_id+user_key, requested_at 상이(최신/직전) | API-02_003·API-03_004 |
| 연동이력(완료 이력만·재통지) | 1 | 〃 | SQL | 스코프 내 callback_received=true 만 존재(미수신 0건) | API-03_002 |
| 연동이력(수신·90일 경과) | 1 | 〃 | SQL | callback_received=true AND callback_received_at < now-90d | BAT-02_011·013 |
| 연동이력(미수신·90일 경과) | 1 | 〃 | SQL | callback_received=false AND requested_at < now-90d | BAT-02_012·014 |
| 연동이력(90일 경과·대량) | 청크 크기 초과(기본 5,000행+1 이상, ENT-007) | 〃 | SQL | 경과 조건 COUNT(*) > 청크 크기 확인(2청크 이상 분량) | BAT-02_015 |
| 서비스 A 진입 목 | 1 | 외부(목 클라이언트) | API/파일 | `/interlock/entry` 200 + requestKey UUID v4 발급 | USR-01_001·BAT-03_001 |
| 서비스 B 목(200 성공) | 1 | 외부 목 서버 | API | 목 수신 로그에 전달 페이로드 200 수신 기록 | USR-02_001·006 |
| 서비스 B 목(실패/타임아웃) | 1 | 외부 목 서버 | API | 5xx 반환 또는 타임아웃 재현 | USR-02_003·005 |
| 허용 IP 설정(허용/차단 쌍) | 2 | 운영 구성값 | 파일/환경 | 허용 IP→통과, 차단 IP→403 EX-SEC-001 | ADM-03_011·012 |
| 서비스 대면 API 자격(서비스 A/B 각 유효/무효) | 4 | 운영 시크릿 | 환경 | 유효 자격→통과, 무효·주체 불일치→401 EX-SEC-003 (원문 미기재, SEC-003-03 주체 분리) | API-01_001·003·API-02_001·007·API-03_001·008 |
| 미존재 요청 키값 | — | (데이터 없음) | — | 임의 UUID v4 조회 → 404 EX-DATA-003 | API-01_005 |

## 4. 테스트 케이스 코드 체계

- **기능단위 TC**: `{ia-code}_{NNN}` (예: `ADM-01_001`). ia-code 별 001부터 순차. IA 맵이 명명 SSOT.
- **횡단 TC**: 사용 중인 횡단 식별자 = `SCEN_` (E2E 사용자 여정). IA 좌표 `공통`. (이관 `MIG_` 는 이관 범위 없음으로 미사용.)
- **파일 조직**: IA 영역별 `qa/<영역>/tc_<ia-code>.md`, 횡단 `qa/common/tc_<식별자>.md`. 300줄 초과 시 분할.

### 4-1. 하위 문서 목록

| 파일 | 대상 IA | 대상 PROC | SVC | TC 수 |
|------|---------|-----------|-----|:--:|
| [ADM/tc_ADM-01.md](ADM/tc_ADM-01.md) | ADM-01 | PROC-101 | SVC-001 | 21 |
| [ADM/tc_ADM-02.md](ADM/tc_ADM-02.md) | ADM-02 | PROC-102·105·106 | SVC-002 | 16 |
| [ADM/tc_ADM-03.md](ADM/tc_ADM-03.md) | ADM-03 | PROC-103·104 | SVC-003 | 16 |
| [USR/tc_USR-01.md](USR/tc_USR-01.md) | USR-01 | PROC-201·202 | SVC-004 | 20 |
| [USR/tc_USR-02.md](USR/tc_USR-02.md) | USR-02 | PROC-203 | SVC-005 | 12 |
| [API/tc_API-01.md](API/tc_API-01.md) | API-01 | PROC-301 | SVC-006 | 9 |
| [API/tc_API-02.md](API/tc_API-02.md) | API-02 | PROC-302 | SVC-008 | 10 |
| [API/tc_API-03.md](API/tc_API-03.md) | API-03 | PROC-303 | SVC-009 | 11 |
| [BAT/tc_BAT-01.md](BAT/tc_BAT-01.md) | BAT-01 | PROC-401 | SVC-005 | 9 |
| [BAT/tc_BAT-02.md](BAT/tc_BAT-02.md) | BAT-02 | PROC-402 | SVC-007 | 17 |
| [BAT/tc_BAT-03.md](BAT/tc_BAT-03.md) | BAT-03 | PROC-201·403 | SVC-004·009 | 10 |
| [common/tc_SCEN.md](common/tc_SCEN.md) | 공통 | (횡단) | 전 SVC | 5 |
| **합계** | | | | **156** |

### 4-2. 유형 분포 (전 156 TC)

| 유형 | 수 | 비율 | 목표 |
|------|:--:|:--:|:--:|
| Positive | 58 | 37.2% | ~40% |
| Negative | 38 | 24.4% | ~30% |
| Boundary | 19 | 12.2% | ~15%(≤20%) |
| 권한/인증 | 8 | 5.1% | ~5% |
| 상태전이 | 16 | 10.3% | ~5% |
| 시스템예외 | 15 | 9.6% | ~3% |
| 조합경계값 | 2 | 1.3% | ~2% |

- Boundary 는 하드 상한 20% 미만이다(19/156=12.2%). 시스템예외가 목표보다 높은 것은 EX-FN-999(전 PROC) + 외부 연동 실패·타임아웃 + 배치 실패를 흐름별로 각각 정의한 커버리지 강화 결과다(편중 아님).
- 신규 요구 4요소(사용자 키값 지정 검증 ADM-01 +5·완료 확인 API-02 10·완료 콜백 API-03 11·연동이력 저장 BAT-03 10·연동이력 삭제 확대 BAT-02 +7) 증분 43 TC 를 합산해 113→156 으로 재산정했다(각 파일 실제 건수와 1:1 정합).

## 5. 스펙 코드 → TC 매핑

### 5-1. SVC → TC (최소 수량 충족)

| SVC | 복잡도 | 최소 | 실제 | 파일 |
|-----|------|:--:|:--:|------|
| SVC-001 등록·편집(CRUD·키값 지정) | 입력·저장 | 12 | 21 | ADM-01 |
| SVC-002 조회·목록·활성/삭제(CRUD) | 입력·저장 | 12 | 16 | ADM-02 |
| SVC-003 관리자 접근·로그인 | 복합 | 12 | 16 | ADM-03 |
| SVC-004 이용 동의·연동이력 생성 | 복합 | 15 | 30 | USR-01(20)+BAT-03(10) |
| SVC-005 연동 실행·전달·저장 | 복합·외부 | 15 | 21 | USR-02(12)+BAT-01(9) |
| SVC-006 처리상태 API | 조회 | 8 | 9 | API-01 |
| SVC-007 상태·연동이력 보관 배치 | 조회·배치 | 8 | 17 | BAT-02 |
| SVC-008 연동 완료 확인 API | 조회 | 8 | 10 | API-02 |
| SVC-009 완료 콜백 API | 조회·기록(단건 조건부 UPDATE·멱등, API-01 준용) | 8 | 11 | API-03 |

### 5-2. PROC → 검증 TC (양방향 추적)

| PROC | 검증 BR/EX | 검증 TC |
|------|-----------|---------|
| PROC-101 | BR-101·102, EX-BIZ-001/002·SEC-004/005·AUTH-001/002·FN-999, BIZ-001-06(선택·비차단)·BIZ-001-07(키값 지정) | ADM-01_001~021 |
| PROC-102 | (분기)목록0·상세없음, EX-SEC-004·AUTH-001/002·FN-999 | ADM-02_001~005·013~016 |
| PROC-103 | BR-105·106, EX-AUTH-001/002/003/004·SEC-004·FN-999 | ADM-03_001~010·014~016 |
| PROC-104 | EX-SEC-001·FN-999, (분기)dev 비활성 | ADM-03_011~013 |
| PROC-105 | BR-103, EX-AUTH-001/002·SEC-004·FN-999 | ADM-02_006~009·015 |
| PROC-106 | BR-104, EX-AUTH-001/002·SEC-004·FN-999 | ADM-02_010~012·015 |
| PROC-201 | BR-203(지정/미지정), EX-OPS-001·SEC-004/005·DATA-002·BIZ-007·FN-999, BIZ-002-05·EXC-BIZ-08 | USR-01_001~007·016~020, BAT-03_001~004·008·009 |
| PROC-202 | BR-201, EX-DATA-002·BIZ-004·SEC-004/005·FN-999 | USR-01_008~016 |
| PROC-203 | BR-202, EX-BIZ-004·FN-999, (내부차단)BIZ-003-01/02/04 | USR-02_001~012 |
| PROC-301 | BR-301, EX-SEC-003·OPS-001·DATA-002/003·SEC-004/005·FN-999 | API-01_001~009 |
| PROC-302 | BR-302(완료/미완료), EX-SEC-003·OPS-001·SEC-004/005·BIZ-005·FN-999, BIZ-004-04/05·SEC-005-03·EXC-DATA-11 | API-02_001~010 |
| PROC-303 | BR-303(완료 기록/재통지 멱등), EX-SEC-003·OPS-001·SEC-004/005·BIZ-006·FN-999, BIZ-004-03/05/06·EXC-BIZ-10 | API-03_001~011 |
| PROC-401 | BR-301, EX-FN-999, CHECK 정합 | BAT-01_001~009 |
| PROC-402 | BR-401·BR-402(연동이력 수신/미수신), (내부)배치 실패, EXC-DATA-04·EXC-DATA-11 정합 | BAT-02_001~017 |
| PROC-403 | BR-203(생성)·BR-303(완료 기록), EX-BIZ-007(생성)·EX-BIZ-006(완료 기록)·FN-999, DATA-005-01~04 | 생성 BAT-03_001~010 · 완료 기록 API-03_001~005·007·011 |

### 5-3. API 엔드포인트별 최소 3케이스(2xx+4xx+5xx/타임아웃)

| 엔드포인트 | PROC | 2xx | 4xx | 5xx/타임아웃 |
|-----------|------|-----|-----|-----|
| POST /api/admin/auth/login | PROC-103 | ADM-03_001 | ADM-03_002(401)/008(400) | ADM-03_014(500) |
| POST /api/admin/auth/logout | PROC-103 | ADM-03_010 | ADM-03_010(미세션 401) | ADM-03_014(500) |
| GET /api/admin/configs | PROC-102 | ADM-02_001 | ADM-02_005(400) | ADM-02_015(500) |
| POST /api/admin/configs | PROC-101 | ADM-01_001 | ADM-01_003(422) | ADM-01_013(500) |
| GET /api/admin/configs/:id | PROC-102 | ADM-02_002 | ADM-02_013(401) | ADM-02_015(500) |
| PUT /api/admin/configs/:id | PROC-101 | ADM-01_002 | ADM-01_012(401) | ADM-01_013(500) |
| PATCH /api/admin/configs/:id/active | PROC-105 | ADM-02_006 | ADM-02_009(400) | ADM-02_015(500) |
| DELETE /api/admin/configs/:id | PROC-106 | ADM-02_010 | ADM-02_013(401) | ADM-02_015(500) |
| GET /interlock/entry | PROC-201 | USR-01_001 | USR-01_005(429)/006(413) | USR-01_016(500) |
| GET /api/consent/:requestKey | PROC-201 | USR-01_002 | USR-01_004(400) | USR-01_016(500) |
| POST /api/consent/:requestKey | PROC-202 | USR-01_008 | USR-01_010(400) | USR-01_012(502)/016(500) |
| GET /api/status/:requestKey | PROC-301 | API-01_001 | API-01_003(401)/005(404) | API-01_009(500) |
| POST /api/interlock/completion | PROC-302 | API-02_001·002 | API-02_007(401)/008(400)/006(404)/009(429) | API-02_010(500) |
| POST /api/interlock/callback | PROC-303 | API-03_001 | API-03_008(401)/009(400)/007(404)/010(429) | API-03_011(500) |

- (배치) PROC-402 는 엔드포인트가 없다 — BAT-02 는 스케줄·내부 예외로 검증한다. PROC-403(연동이력 기록)도 독립 엔드포인트가 없다 — 생성은 진입(PROC-201, BAT-03)·완료 기록은 콜백(PROC-303, API-03) 엔드포인트로 검증한다.

### 5-4. 정책(POL) → TC (P0 최소 3: Positive+Negative+경계/권한)

| 정책 | Positive | Negative | 경계/권한 |
|------|----------|----------|-----------|
| AUTH-001 | ADM-03_001 | ADM-03_002·003 | ADM-03_015(복잡도 경계)·ADM-01_011·ADM-02_013(화면별 권한) |
| AUTH-002 | ADM-03_010 | ADM-03_009 | ADM-01_012·ADM-02_013(화면별 세션 만료) |
| AUTH-003 | ADM-03_007 | ADM-03_005 | ADM-03_004·006(5회 경계) |
| SEC-001 | ADM-03_013 | ADM-03_011 | ADM-03_012(CIDR 경계) |
| SEC-002 | USR-02_006 | USR-01_007(전송 검증 유지) | USR-02_010(무저장) |
| SEC-003 | API-01_001·API-02_001·API-03_001 | API-01_003·API-02_007·API-03_008(주체 분리) | API-01_007(마스킹) |
| SEC-004 | (전 저장 TC) | ADM-01_009·ADM-02_005·USR-01_007·API-01_008·API-02_008·API-03_009 | ADM-03_008 |
| SEC-005 | API-01_007·API-02_004(응답 3항목) | USR-02_010(로그 마스킹) | ADM-02_016(설정 마스킹 예외)·BAT-03_010(저장/로그 경계) |
| BIZ-001 | ADM-01_001·015·017(키값 지정) | ADM-01_003·004·005·006·018·019 | ADM-01_007·008·016·020·021(키값 선택·편집 경계) |
| BIZ-002 | USR-01_008·009·018·019 | USR-01_010·011·015·020 | USR-01_002(구성 소속만) |
| BIZ-003 | USR-02_001 | USR-02_003·007·008·009 | USR-02_004(재시도 경계) |
| BIZ-004 | API-03_001·API-02_001·BAT-03_001 | API-02_006·API-03_007·BAT-03_003 | API-02_003·API-03_004(스코프 최신)·API-03_006(처리상태 불변경) |
| DATA-001 | USR-01_017 | — | USR-02_010·BAT-01_004 |
| DATA-002 | USR-01_001 | API-01_004·005 | USR-01_004 |
| DATA-003 | BAT-01_001·002·003 | BAT-01_006 | BAT-01_005(CHECK 경계) |
| DATA-004 | BAT-02_001·002 | BAT-02_009 | BAT-02_003·004(90일 경계)·016(집계) |
| DATA-005 | BAT-03_001·005·006 | BAT-03_003 | BAT-03_004·007(값 완결성·PK 경계) |
| DATA-006 | BAT-02_011·012 | BAT-02_017(삭제분 404) | BAT-02_013·014(수신/미수신 90일 경계) |
| OPS-001 | (제한 내 통과) | USR-01_005·API-01_006·API-02_009·API-03_010 | (60/분 경계) |
| OPS-002 | 전 감사 TC(LOGIN_·CONFIG_·IP_BLOCK·DELIVERY_FAIL·API_AUTH_FAIL·BATCH_RUN·HISTORY_CREATE·COMPLETION_CHECK·CALLBACK_RECORDED/IDEMPOTENT/TARGET_MISS) | — | — |
| OPS-003 | BAT-02_007·016(집계) | BAT-02_008 | BAT-02_005·010·015(멱등·청크 커밋) |

## 6. 사양 미해소 항목(Block 예정) 카탈로그

기대 결과가 기획에서 미확정인 항목이다. Q1~Q4·신규 요구(`#33`) 계열(BLK-13~18)은 확정 기본안으로 TC 기대값을 기술하되 **확정 대기**로 등재한다(추측 아님, 각 행에 근거 명시). 해소 시 행 삭제 없이 "해소 상태"에 일자·근거를 추가한다. 본 카탈로그는 qa 단계 [`../../agents/workflow-qa/test-planner.md`] 의 "Block 예정" 인계 입력이다.

| ID | 위치·문서 | 영향 IA·TC수 | 미충족 카테고리 | 요약 | 담당 | 해소 상태 |
|----|-----------|-------------|----------------|------|------|-----------|
| BLK-Q1 | policy_AUTH·PROC-103 | ADM-03(6): 004·005·006·007·009·015 | 기대값 확정 대기 | 관리자 인증 수치(잠금 5회/10분·유휴 30분·복잡도 8자·4종)는 기본안 | 담당자 | 미해소 |
| BLK-Q2 | policy_DATA·PROC-201/301 | USR-01·API-01(2): USR-01_001·API-01_004 | 기대값 확정 대기 | 요청 키값=허브 발급 불투명 UUID v4·회원 키 무저장(기본안) | 담당자 | 미해소 |
| BLK-Q3 | policy_BIZ·PROC-202 | USR-01(2): 009·017 | 범위 확정 대기 | 동의 증빙 원장 MVP 미저장·결과만 반영(기본안) | 담당자 | 미해소 |
| BLK-Q4 | policy_DATA·PROC-402 | BAT-02(4): 001·002·003·004 | 기대값 확정 대기 | 보관 삭제=완료 후 90일+미완료 처리일시 90일(기본안·미완료 기준 도입 여부 대기) | 담당자 | 미해소 |
| BLK-05 | SEC-003·FN-004·PROC-301 | API-01(2): 001·003 | 인증 수단 미확정 | 서비스 대면 API 인증 수단(API 키/서명 알고리즘) 구체안 미정 | 담당자 | 미해소 |
| BLK-06 | OPS-001·FN-014 | USR-01·API-01(2): USR-01_005·API-01_006 | 임계치 확정 대기 | 요청 제한 분당 60회는 기본안 | 담당자 | 미해소 |
| BLK-07 | BIZ-003·FN-012·PROC-203 | USR-02(2): 003·004 | 임계치 확정 대기 | 서비스 B 전달 재시도 2회·타임아웃 값 기본안 | 담당자 | 미해소 |
| BLK-08 | SEC-004·FN-005 | 다수(4): ADM-01_010·USR-01_006·013·API-01_008 | 임계치 확정 대기 | 요청 본문 상한 1MB 기본안 | 담당자 | 미해소 |
| BLK-09 | OPS-002·FN-013 | 공통(감사 TC 전반) | 보존 기간 확정 대기 | 감사 로그 보존 1년 기본안 | 담당자 | 미해소 |
| BLK-10 | FN-007·PROC-201 | USR-01(전반) | 저장 수단·TTL 미확정 | 진입 컨텍스트(회원 키 포함) 비영속 저장 수단·TTL build 확정 | build | 미해소 |
| BLK-11 | SVC-002·ENT-001 | ADM-02(2): 006·007 | 상태 모델 확정 대기 | 활성/비활성 기본값·전환 규칙 확정 대기 | 담당자 | 미해소 |
| BLK-12 | policy_BIZ·EXC-BIZ-07 | ADM-01·USR-01(2): ADM-01_016·USR-01_020 | 필수/선택 확정 대기 | 약관 컨텐츠(BIZ-001-06)는 선택 입력·미설정 항목 [상세] 미노출(기본안, '필수' 전환 여부 대기) | 담당자 | 미해소 |
| BLK-13 | policy_BIZ·EXC-BIZ-09·BIZ-001-07(`#33`) | ADM-01·BAT-03(3): ADM-01_017·020·BAT-03_002 | 선택/필수 확정 대기 | 사용자 키값 파라미터 지정은 선택 입력·미지정 허용, 미지정 구성은 연동이력·API-02/03 대상 밖(기본안 — 근거: PRD 능력 서술·기존 구성 호환·무저장 기본값). '필수' 전환 여부 대기 | 담당자 | 미해소 |
| BLK-14 | policy_DATA·EXC-DATA-10·DATA-006(`#33`) | BAT-02(2): BAT-02_013·014 | 기산·보관 확정 대기 | 연동이력 보관 90일·기산 이원화(수신 건=수신 일시·미수신 건=연동 요청 일시)는 처리상태 규칙 준용 기본안. 장기 통계 보관 여부 포함 대기 | 담당자 | 미해소 |
| BLK-15 | policy_BIZ·EXC-BIZ-12·BIZ-004-03/04(`#33`) | API-02·API-03(2): API-02_003·API-03_004 | 판정 단위 확정 대기 | 완료 판정·콜백 특정 스코프를 {연동 구성 식별자+사용자 키값} 복합·최신 건으로 두는 안(기본안 — 사용자 키값 단독은 판정 대상 비유일). 담당자 이견 시 리비전 | 담당자 | 미해소 |
| BLK-16 | policy_DATA·EXC-DATA-11·SVC-008/009 | API-02·BAT-02(2): API-02_006·BAT-02_017 | 응답 정책 확정 대기 | 구성 미존재·미지정·이력 없음(삭제·미기록)을 구별하지 않는 단일 404(존재 여부 비노출) 기본안 | 담당자 | 미해소 |
| BLK-17 | policy_BIZ·BIZ-004-02·FN-016(`#33`) | BAT-03·USR-01(2): BAT-03_003·004 | 기대값 확정 대기 | 지정 구성 진입의 지정 파라미터 값 누락·공백 시 진입 거부(400 EX-BIZ-007) 기본안 — 근거 데이터 완결성 보장(EXC-DATA-09 계열) | 담당자 | 미해소 |
| BLK-18 | policy_DATA·EXC-DATA-09·DATA-005-03(`#33`) | BAT-03(2): BAT-03_005·006 | 기대값 확정 대기 | 지정 사용자 키값을 서비스 A 전달 원문 그대로 저장(무해석·무변형·무해시)하는 안(기본안, 무저장 원칙의 PRD 확정 예외 EXC-DATA-07) | 담당자 | 미해소 |

## 7. 공통 판정 기준

전 TC 공통(개별 파일에서 반복하지 않는다):

- **Pass**: 모든 테스트 단계의 기대 결과가 일치.
- **Fail**: 하나 이상의 기대 결과 불일치(불일치 항목 기록).
- **Block**: 전제 조건(프로그램 기동·시드·목 서버) 미충족으로 실행 불가(사유 기록). 미해소 정책(§6) 종속 TC 는 확정 전까지 🟠 Block 후보다.
- 실행 세분 판정 5종은 [`../../strategies/qa-execution.md`](../../strategies/qa-execution.md) 정본을 따른다.

> 변경 이력은 본문에 두지 않는다 — 영향 IA 노드 이력([`../../strategies/ia-history.md`](../../strategies/ia-history.md))으로 위임한다.
