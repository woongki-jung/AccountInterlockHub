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
| 연동 구성(비활성) | 1 | TBL_INTERLOCK_CONFIG | SQL | is_active=false·deleted_at NULL | ADM-02_007·USR-01_003 |
| 연동 구성(삭제됨) | 1 | TBL_INTERLOCK_CONFIG | SQL | deleted_at NOT NULL, 목록·상세 제외 | ADM-02_004·012 |
| 처리상태(완료·신규) | 1 | TBL_INTERLOCK_PROCESS_STATUS | SQL/API | is_result_confirmed=true·result_confirmed_at 최근·CHECK 정합 | API-01_002 |
| 처리상태(완료·90일 경과) | 1 | 〃 | SQL | is_result_confirmed=true AND result_confirmed_at < now-90d | BAT-02_001·003 |
| 처리상태(미완료·신규) | 1 | 〃 | SQL/API | is_result_confirmed=false·result_confirmed_at NULL·processed_at 최근 | API-01_001·BAT-02 |
| 처리상태(미완료·90일 경과) | 1 | 〃 | SQL | is_result_confirmed=false AND processed_at < now-90d | BAT-02_002·004 |
| 처리상태(90일 경과·대량) | 청크 크기 초과(기본 5,000행+1 이상, ENT-004) | 〃 | SQL | 경과 조건 COUNT(*) > 청크 크기 확인(2청크 이상 분량) | BAT-02_010 |
| 서비스 A 진입 목 | 1 | 외부(목 클라이언트) | API/파일 | `/interlock/entry` 200 + requestKey UUID v4 발급 | USR-01_001 |
| 서비스 B 목(200 성공) | 1 | 외부 목 서버 | API | 목 수신 로그에 전달 페이로드 200 수신 기록 | USR-02_001·006 |
| 서비스 B 목(실패/타임아웃) | 1 | 외부 목 서버 | API | 5xx 반환 또는 타임아웃 재현 | USR-02_003·005 |
| 허용 IP 설정(허용/차단 쌍) | 2 | 운영 구성값 | 파일/환경 | 허용 IP→통과, 차단 IP→403 EX-SEC-001 | ADM-03_011·012 |
| 서비스 대면 API 자격(유효/무효) | 2 | 운영 시크릿 | 환경 | 유효 자격→200, 무효→401 EX-SEC-003 (원문 미기재) | API-01_001·003 |
| 미존재 요청 키값 | — | (데이터 없음) | — | 임의 UUID v4 조회 → 404 EX-DATA-003 | API-01_005 |

## 4. 테스트 케이스 코드 체계

- **기능단위 TC**: `{ia-code}_{NNN}` (예: `ADM-01_001`). ia-code 별 001부터 순차. IA 맵이 명명 SSOT.
- **횡단 TC**: 사용 중인 횡단 식별자 = `SCEN_` (E2E 사용자 여정). IA 좌표 `공통`. (이관 `MIG_` 는 이관 범위 없음으로 미사용.)
- **파일 조직**: IA 영역별 `qa/<영역>/tc_<ia-code>.md`, 횡단 `qa/common/tc_<식별자>.md`. 300줄 초과 시 분할.

### 4-1. 하위 문서 목록

| 파일 | 대상 IA | 대상 PROC | SVC | TC 수 |
|------|---------|-----------|-----|:--:|
| [ADM/tc_ADM-01.md](ADM/tc_ADM-01.md) | ADM-01 | PROC-101 | SVC-001 | 16 |
| [ADM/tc_ADM-02.md](ADM/tc_ADM-02.md) | ADM-02 | PROC-102·105·106 | SVC-002 | 16 |
| [ADM/tc_ADM-03.md](ADM/tc_ADM-03.md) | ADM-03 | PROC-103·104 | SVC-003 | 16 |
| [USR/tc_USR-01.md](USR/tc_USR-01.md) | USR-01 | PROC-201·202 | SVC-004 | 20 |
| [USR/tc_USR-02.md](USR/tc_USR-02.md) | USR-02 | PROC-203 | SVC-005 | 12 |
| [API/tc_API-01.md](API/tc_API-01.md) | API-01 | PROC-301 | SVC-006 | 9 |
| [BAT/tc_BAT-01.md](BAT/tc_BAT-01.md) | BAT-01 | PROC-401 | SVC-005 | 9 |
| [BAT/tc_BAT-02.md](BAT/tc_BAT-02.md) | BAT-02 | PROC-402 | SVC-007 | 10 |
| [common/tc_SCEN.md](common/tc_SCEN.md) | 공통 | (횡단) | 전 SVC | 5 |
| **합계** | | | | **113** |

### 4-2. 유형 분포 (전 113 TC)

| 유형 | 수 | 비율 | 목표 |
|------|:--:|:--:|:--:|
| Positive | 40 | 35.4% | ~40% |
| Negative | 29 | 25.7% | ~30% |
| Boundary | 14 | 12.4% | ~15%(≤20%) |
| 권한/인증 | 6 | 5.3% | ~5% |
| 상태전이 | 10 | 8.8% | ~5% |
| 시스템예외 | 12 | 10.6% | ~3% |
| 조합경계값 | 2 | 1.8% | ~2% |

- Boundary 는 하드 상한 20% 미만이다. 시스템예외가 목표보다 높은 것은 EX-FN-999(전 PROC) + 외부 연동 실패·타임아웃 + 배치 실패를 흐름별로 각각 정의한 커버리지 강화 결과다(편중 아님).

## 5. 스펙 코드 → TC 매핑

### 5-1. SVC → TC (최소 수량 충족)

| SVC | 복잡도 | 최소 | 실제 | 파일 |
|-----|------|:--:|:--:|------|
| SVC-001 등록·편집(CRUD) | 입력·저장 | 12 | 16 | ADM-01 |
| SVC-002 조회·목록·활성/삭제(CRUD) | 입력·저장 | 12 | 16 | ADM-02 |
| SVC-003 관리자 접근·로그인 | 복합 | 12 | 16 | ADM-03 |
| SVC-004 이용 동의 | 복합 | 15 | 20 | USR-01 |
| SVC-005 연동 실행·전달·저장 | 복합·외부 | 15 | 21 | USR-02(12)+BAT-01(9) |
| SVC-006 처리상태 API | 조회 | 8 | 9 | API-01 |
| SVC-007 상태 보관 배치 | 조회·배치 | 8 | 10 | BAT-02 |

### 5-2. PROC → 검증 TC (양방향 추적)

| PROC | 검증 BR/EX | 검증 TC |
|------|-----------|---------|
| PROC-101 | BR-101·102, EX-BIZ-001/002·SEC-004/005·AUTH-001/002·FN-999, BIZ-001-06(선택·비차단) | ADM-01_001~016 |
| PROC-102 | (분기)목록0·상세없음, EX-SEC-004·AUTH-001/002·FN-999 | ADM-02_001~005·013~016 |
| PROC-103 | BR-105·106, EX-AUTH-001/002/003/004·SEC-004·FN-999 | ADM-03_001~010·014~016 |
| PROC-104 | EX-SEC-001·FN-999, (분기)dev 비활성 | ADM-03_011~013 |
| PROC-105 | BR-103, EX-AUTH-001/002·SEC-004·FN-999 | ADM-02_006~009·015 |
| PROC-106 | BR-104, EX-AUTH-001/002·SEC-004·FN-999 | ADM-02_010~012·015 |
| PROC-201 | EX-OPS-001·SEC-004/005·DATA-002·FN-999, BIZ-002-05·EXC-BIZ-08 | USR-01_001~007·016~020 |
| PROC-202 | BR-201, EX-DATA-002·BIZ-004·SEC-004/005·FN-999 | USR-01_008~016 |
| PROC-203 | BR-202, EX-BIZ-004·FN-999, (내부차단)BIZ-003-01/02/04 | USR-02_001~012 |
| PROC-301 | BR-301, EX-SEC-003·OPS-001·DATA-002/003·SEC-004/005·FN-999 | API-01_001~009 |
| PROC-401 | BR-301, EX-FN-999, CHECK 정합 | BAT-01_001~009 |
| PROC-402 | BR-401, (내부)배치 실패, EXC-DATA-04 정합 | BAT-02_001~010 |

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

- (배치) PROC-402 는 엔드포인트가 없다 — BAT-02 는 스케줄·내부 예외로 검증한다.

### 5-4. 정책(POL) → TC (P0 최소 3: Positive+Negative+경계/권한)

| 정책 | Positive | Negative | 경계/권한 |
|------|----------|----------|-----------|
| AUTH-001 | ADM-03_001 | ADM-03_002·003 | ADM-03_015(복잡도 경계)·ADM-01_011·ADM-02_013(화면별 권한) |
| AUTH-002 | ADM-03_010 | ADM-03_009 | ADM-01_012·ADM-02_013(화면별 세션 만료) |
| AUTH-003 | ADM-03_007 | ADM-03_005 | ADM-03_004·006(5회 경계) |
| SEC-001 | ADM-03_013 | ADM-03_011 | ADM-03_012(CIDR 경계) |
| SEC-002 | USR-02_006 | USR-01_007(전송 검증 유지) | USR-02_010(무저장) |
| SEC-003 | API-01_001 | API-01_003 | API-01_007(마스킹) |
| SEC-004 | (전 저장 TC) | ADM-01_009·ADM-02_005·USR-01_007·API-01_008 | ADM-03_008 |
| SEC-005 | API-01_007 | USR-02_010(로그 마스킹) | ADM-02_016(설정 마스킹 예외) |
| BIZ-001 | ADM-01_001·015 | ADM-01_003·004·005·006 | ADM-01_007·008·016(약관 선택 경계) |
| BIZ-002 | USR-01_008·009·018·019 | USR-01_010·011·015·020 | USR-01_002(구성 소속만) |
| BIZ-003 | USR-02_001 | USR-02_003·007·008·009 | USR-02_004(재시도 경계) |
| DATA-001 | USR-01_017 | — | USR-02_010·BAT-01_004 |
| DATA-002 | USR-01_001 | API-01_004·005 | USR-01_004 |
| DATA-003 | BAT-01_001·002·003 | BAT-01_006 | BAT-01_005(CHECK 경계) |
| DATA-004 | BAT-02_001·002 | BAT-02_009 | BAT-02_003·004(90일 경계) |
| OPS-001 | (제한 내 통과) | USR-01_005·API-01_006 | (60/분 경계) |
| OPS-002 | 전 감사 TC(LOGIN_·CONFIG_·IP_BLOCK·DELIVERY_FAIL·API_AUTH_FAIL·BATCH_RUN) | — | — |
| OPS-003 | BAT-02_007 | BAT-02_008 | BAT-02_005·010(멱등·청크 커밋) |

## 6. 사양 미해소 항목(Block 예정) 카탈로그

기대 결과가 기획에서 미확정인 항목이다. Q1~Q4 는 확정 기본안으로 TC 기대값을 기술하되 **확정 대기**로 등재한다(추측 아님, 근거 명시). 해소 시 행 삭제 없이 "해소 상태"에 일자·근거를 추가한다. 본 카탈로그는 qa 단계 [`../../agents/workflow-qa/test-planner.md`] 의 "Block 예정" 인계 입력이다.

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

## 7. 공통 판정 기준

전 TC 공통(개별 파일에서 반복하지 않는다):

- **Pass**: 모든 테스트 단계의 기대 결과가 일치.
- **Fail**: 하나 이상의 기대 결과 불일치(불일치 항목 기록).
- **Block**: 전제 조건(프로그램 기동·시드·목 서버) 미충족으로 실행 불가(사유 기록). 미해소 정책(§6) 종속 TC 는 확정 전까지 🟠 Block 후보다.
- 실행 세분 판정 5종은 [`../../strategies/qa-execution.md`](../../strategies/qa-execution.md) 정본을 따른다.

> 변경 이력은 본문에 두지 않는다 — 영향 IA 노드 이력([`../../strategies/ia-history.md`](../../strategies/ia-history.md))으로 위임한다.
