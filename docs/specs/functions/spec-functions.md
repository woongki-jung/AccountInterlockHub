# 공통 기능 정의서 — AccountInterlockHub

본 문서는 AccountInterlockHub 전체 공통 기능(FN)·API 인터페이스 정의의 개요와 하위 문서 목록을 정의한다. spec 단계 산출물(도메인 4순위)이며, 방향 근거는 [`../../prd/PRD.md`](../../prd/PRD.md), 정보 구조는 [`../../prd/ia/IA.md`](../../prd/ia/IA.md), 선행 도메인은 정책 [`../policies/spec-policies.md`](../policies/spec-policies.md)·서비스 [`../services/spec-services.md`](../services/spec-services.md)·데이터 [`../datas/spec-datas.md`](../datas/spec-datas.md)·모델 [`../datas/spec-models.md`](../datas/spec-models.md)다. 후행 도메인(프로세스 PROC·화면·QA)이 FN 코드로 본 문서군을 인용한다.

## 공통 기능 설계 원칙·기본 방향

- **재사용 우선**: FN 은 2개 이상 서비스(SVC)에서 재사용되거나 정책(POL) 규칙을 구현하는 단위 로직만 채번한다. 단일 SVC 전용 흐름은 해당 SVC·PROC 에 둔다.
- **PROC 호출 계약**: PROC 의사코드는 본 문서의 FN 시그니처로 단위 로직을 호출한다. FN 이 throw 하는 EX 코드는 호출 PROC 의 예외 표에 등재된다.
- **정책 매핑 완결**: 정책 정의서의 17개 정책(AUTH·DATA·BIZ·SEC·OPS) 모든 규칙이 하나 이상의 POL 분류 FN 으로 구현된다(§정책→FN 매핑).
- **무저장·최소 노출 관철**: 회원 키·개인정보는 어떤 FN 에서도 영속 저장하지 않는다(DATA-001). 진입~전달 구간은 메모리 경유, 로그·응답은 마스킹·필드 선별을 거친다.
- **외부 호출 BE 경유**: 서비스 B 등 외부 호출은 반드시 백엔드(NestJS)를 경유한다(FN-012). 특정 라이브러리를 강제하지 않는다.
- **스택 정합**: 단일 App Service(NestJS)가 API + React 정적 서빙 + 배치 스케줄을 함께 제공한다. FN 은 이 단일 애플리케이션 내 서비스·가드·미들웨어 계층으로 구현된다.

## 코드 체계

- **기능 코드**: `FN-<순번 3자리>` (예: `FN-001`). 하나의 공통 기능 단위.
- **분류**: POL(정책 구현) · DAT(데이터 처리) · EXT(외부 연동) · CRS(횡단 관심사) 중 1개.
- **에러 코드**: `EX-<도메인>-<순번>`. 정책·서비스 정의서의 위반 처리 코드를 그대로 인용하고, FN 고유 신규 코드는 `EX-FN-<순번>` 로 채번한다(본 문서는 `EX-FN-999` 1건 신규).
- **호출 PROC**: 각 FN 을 호출하는 PROC 코드(후행 도메인 예약 채번, [spec-policies §예약 인용 PROC](../policies/spec-policies.md)).

## 공통 기능 목록 (분류별)

| FN 코드 | 기능명 | 분류 | 연관 정책 | 호출 PROC(예약) | 사용 SVC | 하위 문서 |
|---------|--------|------|-----------|-----------------|----------|-----------|
| FN-001 | 관리자 IP 접근 제어 | POL | SEC-001 | PROC-104 | SVC-001·002·003 | [function_FN-001.md](function_FN-001.md) |
| FN-002 | 관리자 로그인 인증·계정 잠금 | POL | AUTH-001·003 | PROC-103 | SVC-003 | [function_FN-002.md](function_FN-002.md) |
| FN-003 | 관리자 세션 관리·검증 | POL | AUTH-002 | PROC-103 | SVC-001·002·003 | [function_FN-003.md](function_FN-003.md) |
| FN-004 | 서비스 대면 API 인증 | POL | SEC-003 | PROC-301 | SVC-006 | [function_FN-004.md](function_FN-004.md) |
| FN-005 | 공통 입력 검증·주입 방어 | POL | SEC-004 | PROC-101·102·201·301 | SVC-001·002·004·006 | [function_FN-005.md](function_FN-005.md) |
| FN-006 | 연동 구성 입력 검증·고유성 | POL | BIZ-001 | PROC-101 | SVC-001 | [function_FN-006.md](function_FN-006.md) |
| FN-007 | 요청 키값 발급·검증 | POL | DATA-002 | PROC-201·301 | SVC-004·006 | [function_FN-007.md](function_FN-007.md) |
| FN-008 | 사용자 동의 처리 | POL | BIZ-002 | PROC-201·202 | SVC-004 | [function_FN-008.md](function_FN-008.md) |
| FN-009 | 처리상태 저장·조회·결과확인 갱신 | DAT | DATA-003·001-02 | PROC-401·301 | SVC-004·005·006 | [function_FN-009.md](function_FN-009.md) |
| FN-010 | 민감값 마스킹·응답 필드 선별 | DAT | SEC-005·DATA-001-03 | PROC-102·203·301 | SVC-002·005·006 | [function_FN-010.md](function_FN-010.md) |
| FN-011 | 보관 만료 대상 선정·삭제 배치 | DAT | DATA-004·OPS-003 | PROC-402 | SVC-007 | [function_FN-011.md](function_FN-011.md) |
| FN-012 | 서비스 B 전달 | EXT | BIZ-003·SEC-002·DATA-001-01 | PROC-203 | SVC-005 | [function_FN-012.md](function_FN-012.md) |
| FN-013 | 감사 로그 기록 | CRS | OPS-002 | PROC-101·103·104·105·106·203·301·402 | 전 SVC | [function_FN-013.md](function_FN-013.md) |
| FN-014 | 요청 제한 (Rate Limiting) | CRS | OPS-001 | PROC-201·301 | SVC-004·006 | [function_FN-014.md](function_FN-014.md) |
| FN-015 | 공통 응답·에러 엔벨로프 | CRS | (공통) | 전 API PROC | 전 SVC | [function_FN-015.md](function_FN-015.md) |

## API 인터페이스 목록 (엔드포인트 → PROC → FN)

단일 App Service 가 아래 엔드포인트를 제공한다. 각 엔드포인트는 PROC 로 구현되며, PROC 는 아래 FN 을 호출한다. 인증 열: IP+세션(관리자), Public+요청키(사용자 진입), API키/서명(서비스 대면).

| 엔드포인트 | 메서드 | 인증 | 호출 PROC | 요청/응답 MDL | 주요 호출 FN |
|-----------|--------|------|-----------|----------------|--------------|
| /api/admin/auth/login | POST | IP | PROC-103 | 자격 입력 → MDL-104 | FN-001, FN-002, FN-003, FN-013 |
| /api/admin/auth/logout | POST | IP+세션 | PROC-103 | MDL-104 → 200 | FN-001, FN-003, FN-013 |
| /api/admin/configs | GET | IP+세션 | PROC-102 | 조회조건 → MDL-102[] | FN-001, FN-003, FN-005, FN-010 |
| /api/admin/configs | POST | IP+세션 | PROC-101 | MDL-101 → MDL-101 | FN-001, FN-003, FN-005, FN-006, FN-013 |
| /api/admin/configs/:id | GET | IP+세션 | PROC-102 | id → MDL-101 | FN-001, FN-003, FN-010 |
| /api/admin/configs/:id | PUT | IP+세션 | PROC-101 | MDL-101 → MDL-101 | FN-001, FN-003, FN-005, FN-006, FN-013 |
| /api/admin/configs/:id/active | PATCH | IP+세션 | PROC-105 | isActive → 결과 | FN-001, FN-003, FN-013 |
| /api/admin/configs/:id | DELETE | IP+세션 | PROC-106 | id → 결과 | FN-001, FN-003, FN-013 |
| /interlock/entry | GET | Public(서비스 A 진입) | PROC-201 | MDL-201 → MDL-202 | FN-014, FN-005, FN-007, FN-013 |
| /api/consent/:requestKey | GET | 요청키(진입 컨텍스트) | PROC-201 | requestKey → 동의 항목 | FN-005, FN-007, FN-008 |
| /api/consent/:requestKey | POST | 요청키(진입 컨텍스트) | PROC-202 | MDL-203 → 200 | FN-005, FN-008, FN-012, FN-009, FN-013 |
| /api/status/:requestKey | GET | API키/서명 | PROC-301 | MDL-202 → MDL-302 | FN-004, FN-014, FN-005, FN-007, FN-009, FN-010, FN-013 |
| (배치) 상태 보관 삭제 | 스케줄 | 내부(엔드포인트 없음) | PROC-402 | (없음) → MDL-402 | FN-011, FN-013 |

## 공통 응답·에러 엔벨로프 (전 API 공통 규칙)

전 API 응답은 아래 엔벨로프를 따른다(FN-015 가 구성). 세부는 [function_FN-015.md](function_FN-015.md).

- **성공(2xx)**: `{ "success": true, "data": <응답 DTO> }`.
- **실패(4xx/5xx)**: `{ "success": false, "error": { "code": "EX-...", "message": "<사용자 메시지>", "details": <필드 오류 배열 | null> } }`.
- **목록**: `data` 는 배열. 페이지네이션·정렬·필터 파라미터 규약은 화면 도메인·build 에서 확정(MVP 는 활성 필터·생성일 정렬 기본, [MDL-102](../datas/model_admin.md)).
- **API 버전**: 경로 프리픽스 미도입(MVP 단일 버전). 도입 시 `/api/v1` 규칙을 build 에서 확정.

## 에러(EX) 코드 카탈로그 (인용·신규)

정책·서비스 정의서의 EX 코드를 그대로 인용하고, 공통 시스템 오류만 신규 채번한다.

| EX 코드 | HTTP | 요지 | 출처 | 주 발생 FN |
|---------|------|------|------|-----------|
| EX-SEC-001 | 403 | 관리자 경로 IP 차단 | SEC-001-01 | FN-001 |
| EX-AUTH-001 | 401 | 미인증 요청 | AUTH-001-01 | FN-003 |
| EX-AUTH-002 | 401 | 세션 유휴 만료 | AUTH-002-01 | FN-003 |
| EX-AUTH-003 | 423 | 로그인 5회 실패 계정 잠금 | AUTH-003-01 | FN-002 |
| EX-AUTH-004 | 422 | 비밀번호 복잡도 미달 | AUTH-001-02 | FN-002 |
| EX-SEC-003 | 401 | 서비스 대면 API 인증 실패 | SEC-003-01 | FN-004 |
| EX-SEC-004 | 400 | 입력 검증·주입 방어 위반 | SEC-004-01/02 | FN-005 |
| EX-SEC-005 | 413 | 요청 본문 1MB 초과 | SEC-004-03 | FN-005 |
| EX-BIZ-001 | 422 | 필수·URL·동의 항목 검증 실패 | BIZ-001-01/02/04 | FN-006 |
| EX-BIZ-002 | 409 | 구성 코드 고유성 중복 | BIZ-001-03 | FN-006 |
| EX-BIZ-004 | 502 | 서비스 B 전달 실패(재시도 후) | BIZ-003-03 | FN-012 |
| EX-DATA-002 | 400 | 요청 키값 형식 불일치 | DATA-002-04 | FN-007 |
| EX-DATA-003 | 404 | 요청 키값 미존재(만료 삭제 포함) | EXC-DATA-02/04 | FN-009 |
| EX-OPS-001 | 429 | 요청 제한(분당 60회) 초과 | OPS-001-01 | FN-014 |
| **EX-FN-999** | 500 | 시스템 내부 오류(공통) | **신규(본 문서)** | 전 FN |

- 사용자 거부(BIZ-002)·세션 만료 유도·배치 실패는 EX 코드가 아니다 — 각각 200 정상 종료, 재인증 유도, 다음 주기 재시도로 처리한다.

## 기능 간 의존관계 요약

호출 방향(→)만 존재하며 역방향·순환은 없다.

- FN-001 → FN-013
- FN-002 → FN-003, FN-010, FN-013
- FN-003 → FN-013
- FN-004 → FN-010, FN-013
- FN-005 → (leaf)
- FN-006 → FN-005, FN-013
- FN-007 → FN-005, FN-013
- FN-008 → FN-005, FN-009, FN-012, FN-013
- FN-009 → (leaf)
- FN-010 → (leaf)
- FN-011 → FN-013
- FN-012 → FN-009, FN-013
- FN-013 → FN-010
- FN-014 → FN-013
- FN-015 → (leaf)

- **위상 순서**(피호출 → 호출): FN-005·009·010·015(leaf) → FN-013 → FN-001·002·003·004·006·007·011·012·014 → FN-008. 순환 없음.
- FN-013(감사)은 기록 직전 FN-010(마스킹)만 호출하는 leaf 방향 의존으로, 다수 FN 이 FN-013 을 호출해도 순환이 생기지 않는다.

## 정책(POL) → 공통 기능(FN) 매핑 요약

| 정책 코드 | 구현 FN | 정책 코드 | 구현 FN |
|-----------|---------|-----------|---------|
| AUTH-001 | FN-002 | SEC-001 | FN-001 |
| AUTH-002 | FN-003 | SEC-002 | FN-012 |
| AUTH-003 | FN-002 | SEC-003 | FN-004 |
| DATA-001 | FN-007·009·010·012 | SEC-004 | FN-005 |
| DATA-002 | FN-007 | SEC-005 | FN-010 |
| DATA-003 | FN-009 | OPS-001 | FN-014 |
| DATA-004 | FN-011 | OPS-002 | FN-013 |
| BIZ-001 | FN-006 | OPS-003 | FN-011 |
| BIZ-002 | FN-008 | | |
| BIZ-003 | FN-012 | | |

- 정책 17종 전부가 하나 이상의 FN 으로 구현됨(누락 0건). DATA-001(무저장)은 4개 FN 에 횡단 적용된다.

## 참조 데이터(MDL/ENT) 요약

FN 이 입력/출력으로 인용하는 서비스 모델(MDL)·엔터티(ENT)다. 스키마·속성 상세는 데이터 도메인([`../datas/spec-datas.md`](../datas/spec-datas.md)·[`../datas/spec-models.md`](../datas/spec-models.md))이 정본이다.

- **MDL**: 101 연동 구성 / 102 목록 요약 / 103 관리자 계정 / 104 관리자 세션 / 201 진입 요청 / 202 요청 키값 / 203 동의 결과 / 204 서비스 B 전달 페이로드 / 301 처리 상태 / 302 조회 응답 / 401 감사 로그 / 402 배치 결과.
- **ENT**: 001 연동 구성 / 002 동의 항목 / 003 전달 파라미터 / 004 처리 상태 / 005 관리자 계정 / 006 감사 로그.

## 담당자 확정 대기·보류 항목

정책·서비스·데이터 정의서의 확정 기본안을 승계하며, 본 도메인에서 추가로 도출한 해석 항목을 포함한다(승인 전 잠정).

- **Q1 관리자 인증**: IP 제한 + 로그인 인증 병행(FN-001·002·003). 잠금 임계치(5회)·잠금 시간(10분)·세션 유휴(30분)·비밀번호 복잡도(8자·4종)는 기본안 수치.
- **Q2 요청 키값**: 허브 발급 불투명 UUID v4(FN-007). 회원 키 무저장(전달 시 메모리만).
- **Q3 동의 기록**: 동의 증빙 원장 MVP 제외, 동의/거부 결과만 처리 상태(is_success) 반영(FN-008).
- **Q4 보관 정리**: 완료 후 90일 + 미완료 처리 일시 90일 경과 삭제(FN-011). 90일 기준·일 배치 주기는 기본안.
- **[신규 해석] 진입 컨텍스트 일시 저장**: 요청 키값에 연결된 진입 컨텍스트(MDL-201: 구성 참조·회원 키·파라미터)는 처리 완료까지 **비영속 메모리(세션/캐시)에서만** 유지한다(DATA-001-01 무저장 정합). 저장 수단(단일/공유)·TTL 은 build 확정 — [function_FN-007.md](function_FN-007.md)·[function_FN-008.md](function_FN-008.md).
- **기타 수치**: 서비스 대면 API 인증 수단(FN-004, API 키/서명), 요청 제한 임계치(FN-014, 분당 60회), 재시도 횟수(FN-012, 2회), 본문 상한(FN-005, 1MB), 감사 로그 보존(FN-013, 1년)은 기본안 값이며 확정 시 관련 정책·FN 을 리비전한다.
