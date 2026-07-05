# 화면 정의서 — AccountInterlockHub

본 문서는 AccountInterlockHub 전체 화면 정의의 개요와 하위 문서 목록을 정의한다. spec 단계 산출물(도메인 5순위)이며, 방향 근거는 [`../../prd/PRD.md`](../../prd/PRD.md), 정보 구조는 [`../../prd/ia/IA.md`](../../prd/ia/IA.md), 선행 도메인은 정책 [`../policies/spec-policies.md`](../policies/spec-policies.md)·서비스 [`../services/spec-services.md`](../services/spec-services.md)·데이터 [`../datas/spec-models.md`](../datas/spec-models.md)·기능 [`../functions/spec-functions.md`](../functions/spec-functions.md)다. 화면의 사용자 인터랙션은 후행 도메인(프로세스 PROC)의 진입 트리거가 되며, PROC 코드로 양방향 추적한다.

## 대상 범위·스택

- **스택**: React(TypeScript) SPA + NestJS 정적 서빙. 관리자 웹·사용자 웹은 단일 App Service 로 배포되며 동일 디자인 시스템을 공유한다([`design-system.md`](design-system.md)).
- **화면 있는 IA**: 관리자(ADM-01·02·03)·사용자 연동(USR-01·02). 서비스 대면 API(API-01)와 배치(BAT-01·02)는 **화면이 없다**(서버 대면·백그라운드).
- **화면 없는 IA 처리**: API-01(처리상태 확인)은 서비스 A 대면 API, BAT-01·02(상태 저장·보관 배치)는 스케줄 백그라운드로, 사용자 접점 화면이 존재하지 않는다.

## 디자인 시스템 요약

정본은 [`design-system.md`](design-system.md). 핵심 결정만 요약한다.

- **토큰**: primary #2563EB, danger #DC2626, success #16A34A / 본문 텍스트 #111827. 간격 4·8·12·16·24·32·48px, 라운딩 4·8·12px. 타이포 display 28 / h1 22 / h2 18 / body 15 / label 14 / caption 13px.
- **공통 컴포넌트**: Button(primary·secondary·danger·ghost) · TextField · Select · Checkbox · Toggle · RepeatableRows(동의 항목·파라미터 반복 입력) · Table · Card · Modal · Toast · Badge · Banner · Spinner/Skeleton · EmptyState · AdminNav.
- **레이아웃**: 관리자=헤더+최대 폭 1120px 컨테이너, 사용자=헤더 없는 중앙 카드(최대 480px). 브레이크포인트 mobile<640 / tablet 640~1024 / desktop>1024.
- **상태 표현**: Initial(Skeleton)·Loading(Spinner+disabled)·Loaded·Empty(EmptyState)·Error(Banner/인라인)·Disabled.
- **접근성**: WCAG AA 대비(4.5:1), 키보드 탐색·포커스 링, 스크린리더(label·role=alert·aria-live), 상태 색+텍스트 병기.

## 화면 코드 체계

- 코드 형식: `SCR-<순번 3자리>` (예: `SCR-001`). 하나의 화면 단위.
- 개별 문서: `screen_SCR-<순번>.md`. 각 화면은 기본 정보·레이아웃·데이터 표시·사용자 인터랙션(트리거 PROC)·화면 상태 전이(PROC 단계 매핑)·입력 폼 유효성·조건부 표시·이동 경로를 담는다.
- 트리거 PROC 는 후행 도메인(prd-to-process)이 채번하는 예약 코드를 인용한다([`../policies/spec-policies.md`](../policies/spec-policies.md) §예약 인용 PROC).

## 화면 목록

| SCR 코드 | 화면명 | 화면 경로 | 접근 권한 | 관련 서비스 | 트리거 PROC | 관련 IA | 하위 문서 |
|----------|--------|-----------|-----------|-------------|-------------|---------|-----------|
| SCR-001 | 관리자 로그인 | `/admin/login` | IP 허용 + 미인증(로그인) | SVC-003 | PROC-103 | ADM-03 | [screen_SCR-001.md](screen_SCR-001.md) |
| SCR-002 | 연동 구성 목록 | `/admin/configs` | IP + 인증 세션 | SVC-002 | PROC-102 | ADM-02 | [screen_SCR-002.md](screen_SCR-002.md) |
| SCR-003 | 연동 구성 등록·편집 폼 | `/admin/configs/new`·`/admin/configs/:id/edit` | IP + 인증 세션 | SVC-001 | PROC-101, PROC-102 | ADM-01 | [screen_SCR-003.md](screen_SCR-003.md) |
| SCR-004 | 연동 구성 상세 | `/admin/configs/:id` | IP + 인증 세션 | SVC-002 | PROC-102 | ADM-02 | [screen_SCR-004.md](screen_SCR-004.md) |
| SCR-005 | 사용자 이용 동의 | `/consent/:requestKey` | Public + 요청 키값 컨텍스트 | SVC-004 | PROC-201, PROC-202 | USR-01 | [screen_SCR-005.md](screen_SCR-005.md) |
| SCR-006 | 동의 결과 | `/consent/:requestKey/result` | Public + 제출 결과 컨텍스트 | SVC-004, SVC-005 | (없음, 결과 표시) | USR-02 | [screen_SCR-006.md](screen_SCR-006.md) |

- IA leaf 커버: ADM-01(SCR-003)·ADM-02(SCR-002·004)·ADM-03(SCR-001)·USR-01(SCR-005)·USR-02(SCR-006) 모두 화면으로 정의됨. API-01·BAT-01·BAT-02 는 화면 없음(서버 대면·배치).

## 인터랙션 → 트리거 PROC 매핑 요약

| SCR | 인터랙션 | 트리거 PROC |
|-----|----------|-------------|
| SCR-001 | 로그인 제출 | PROC-103 |
| SCR-002 | 목록 mount·검색 | PROC-102 |
| SCR-002 | 활성 전환 | PROC-105 |
| SCR-002 | 삭제 | PROC-106 |
| SCR-003 | 등록/편집 제출 | PROC-101 |
| SCR-003 | 편집 진입 상세 로드(mount) | PROC-102 |
| SCR-004 | 상세 mount | PROC-102 |
| SCR-004 | 활성 전환 | PROC-105 |
| SCR-004 | 삭제 | PROC-106 |
| SCR-005 | 진입 mount(동의 항목 조회) | PROC-201 |
| SCR-005 | 동의/거부 제출 | PROC-202(내부 PROC-203 전달 호출) |
| SCR-006 | 결과 표시(mount) | (없음 — PROC-202/203 결과 표시) |

- 한 인터랙션은 1개의 PROC 를 트리거한다. PROC 가 내부에서 다른 PROC·FN 을 호출하는 것은 PROC 내부 관계로 표현한다(예: PROC-202 → 내부 PROC-203/FN-012 전달).
- 예약 PROC 전 노드가 화면 인터랙션에 매핑됨: PROC-101(SCR-003)·102(SCR-002·004·003 편집)·103(SCR-001)·201(SCR-005)·202(SCR-005). PROC-104(IP 가드)는 서버 미들웨어로 관리자 화면 접근을 게이트한다. PROC-203(전달)·301(조회 API)·401·402(배치)는 화면 인터랙션이 아닌 서버·배치 트리거다.

## 네비게이션 흐름 요약

관리자 흐름은 다음 순서로 이동한다.

1. SCR-001 로그인 성공 → SCR-002 목록.
2. SCR-002 목록에서 "등록" → SCR-003(신규), 행 클릭 → SCR-004 상세.
3. SCR-004 상세에서 "편집" → SCR-003(편집), 저장 성공 → SCR-004 로 복귀.
4. SCR-004 상세에서 "삭제" 확정 → SCR-002 목록으로 복귀.
5. 모든 관리자 화면에서 세션 만료(EX-AUTH-002) → SCR-001 로 재인증 유도.

사용자 흐름은 다음 순서로 이동한다.

1. 서비스 A 진입(`/interlock/entry`, PROC-201) → 요청 키값 발급 → SCR-005 이용 동의로 유입.
2. SCR-005 에서 동의/거부 제출(PROC-202) → SCR-006 동의 결과.
3. SCR-006 은 결과(동의 완료·거부·전달 실패)를 표시하고 신규 화면 이동을 강제하지 않는다.

## 역할별 화면 접근 권한 매트릭스

| SCR | 연동 관리자 | 최종 사용자 | 서비스 A | 비고 |
|-----|-------------|-------------|----------|------|
| SCR-001 관리자 로그인 | ○(IP 허용 내 미인증 접근) | ✕ | ✕ | 인증 관문. IP 차단 시 접근 불가(SEC-001) |
| SCR-002 목록 | ○(IP+세션) | ✕ | ✕ | 인증 세션 필수(AUTH-001) |
| SCR-003 등록·편집 | ○(IP+세션) | ✕ | ✕ | 인증 세션 필수 |
| SCR-004 상세 | ○(IP+세션) | ✕ | ✕ | 인증 세션 필수 |
| SCR-005 이용 동의 | ✕ | ○(요청 키값 컨텍스트) | △(진입 유발) | Public 경로, 요청 키값 유효 시 |
| SCR-006 동의 결과 | ✕ | ○(제출 결과 컨텍스트) | ✕ | 결과 표시 전용 |

- ○ 접근 가능 · △ 흐름 유발(직접 화면 조작 아님) · ✕ 접근 불가.
- 관리자 경로(SCR-001~004)는 IP 허용 목록(SEC-001) + 로그인 인증(AUTH-001) 이중 방어. 사용자 경로(SCR-005~006)는 관리자 인증과 분리되며 요청 키값 진입 컨텍스트로 접근한다.

## 데이터·마스킹 요약

- 관리자 화면(SCR-002·003·004)은 설정 데이터(MDL-101·102)만 표시하며 회원 키·처리 상태를 포함하지 않는다. 서비스 A/B 주소는 마스킹 대상이 아니다(EXC-SEC-05).
- 사용자 화면(SCR-005·006)은 회원 키·요청 키값·처리 상태 값을 표시하지 않는다(DATA-001 무저장·최소 노출). 동의 화면은 구성 소속 동의 항목만 노출한다(BIZ-002-01).
- 민감값 마스킹(SEC-005)이 화면에 직접 적용되는 지점은 없다(회원 키 표시 화면 부재). 마스킹은 로그·감사·API 응답 계층에서 처리된다.

## 담당자 확정 대기·보류 항목

선행 도메인의 확정 기본안을 승계하며, 화면 도메인에서 추가로 도출한 해석 항목을 포함한다(승인 전 잠정).

- **Q1 관리자 인증**: IP 제한 + 로그인 화면(SCR-001) 병행은 확정 기본안. 로그인 화면 도입 자체가 이 결정에 종속된다.
- **Q2 요청 키값**: 허브 발급 불투명 UUID v4. 사용자에게는 화면에 비노출(경로 컨텍스트로만 사용), 서비스 A 반환.
- **Q3 동의 증빙**: 동의 증빙 미저장·결과만 반영(SCR-005 는 증빙 원장 화면 없음).
- **[신규 해석] 사용자 진입→동의 화면 유입 방식**: `/interlock/entry`(PROC-201) 진입 후 요청 키값 기반 `/consent/:requestKey` 로 사용자 브라우저를 유입시키는 흐름을 기본안으로 정의했다. 리다이렉트/토큰 전달 구체 방식은 build 확정.
- **[신규 해석] SCR-006 결과 전달 방식**: 결과를 SCR-005 제출 응답의 클라이언트 상태로 전달(추가 API 없음)하는 안. 새로고침·직접 진입 시 Fallback 안내. 결과 재조회 API 필요 여부는 담당자 확정 대기.
- **[신규 해석] 구성 코드 편집 잠금**: 편집 시 구성 코드를 읽기전용으로 두는 안(고유성·참조 안정성). 변경 허용 여부는 담당자 확정 대기.
- **[신규 해석] 목록 페이지네이션·정렬 UI**: MVP 는 활성 필터·생성일 정렬 기본. 페이지네이션 규약은 build·[FN-015](../functions/function_FN-015.md) 확정.
- **활성/비활성 전환**: SVC-002 파생 운영 기능. 목록·상세 양쪽에서 전환 가능하도록 화면 배치했으며 기본 활성 여부·상태 모델은 확정 대기.
