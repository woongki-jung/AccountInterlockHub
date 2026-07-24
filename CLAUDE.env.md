# 프로젝트 환경 값 (경로·제품 명칭)

이 워크스페이스가 다루는 **현재 프로젝트**의 경로·제품 식별자 값을 단일 관리한다(비밀 아님·git 관리). 에이전트·전략 문서는 플레이스홀더(`<INSTALL_ROOT>` 등)만 사용하고, 그 실제 값은 본 파일에서 정의한다 — 전 문서는 플레이스홀더로만 참조하므로 본 파일 갱신으로 정합이 유지된다. **프로젝트가 바뀌면 프로젝트 부트스트랩 절차([`project-bootstrap.md`](project-bootstrap.md))에 따라 본 파일을 갱신한다.** 비밀 값(토큰·키)은 본 파일이 아니라 [`CLAUDE.local.md`](CLAUDE.local.md) 에 보관한다.

> 플레이스홀더 표기·해석의 강제 규칙은 [`document-master-guide.md`](document-master-guide.md) §경로·이름 표기. 경로·이름을 다루는 모든 세션은 사용 전 본 파일을 읽는다(CLAUDE.env.md 는 CLAUDE.md 와 달리 자동 로드되지 않음). 본 파일의 위치·역할과 환경변수 키 목록(Redmine 등)은 CLAUDE.md §환경 구성.

> ⚠️ 부트스트랩 시점에는 기본 골격만 갖는다. 구체 프로그램 구성 변수(설치 경로·실행 파일·소스 프로젝트명 등)는 프로젝트 초기 설정(directing) 과정에서 프로그램 구성표·개발사양 확정에 맞춰 추가·갱신한다([`stages/directing.md`](ai/strategies/stages/directing.md) §산출물).

## 경로·제품 명칭 변수

| 변수            | 값                              | 설명                              |
| ------------- | ------------------------------ | ------------------------------- |
| `<WORK_ROOT>` | `/Volumes/D/Work/ai-workgroup` | 제품 소스·자동화 작업 저장소 루트 (설치 루트와 별개) |
- **인프라 구성 정보** (directing 확정 — 상세 [`docs/prd/devspec/infra.md`](docs/prd/devspec/infra.md))
	- 개발: 로컬 개발환경
		- 별도 구축 PostgreSQL 서버 사용(Azure 미사용). 애플리케이션(NestJS+React) 로컬 기동. 구체 접속값은 build 시점 확정.
	- 테스트: 테스트 서버
		- 구성항목 미정. 필요 시 갱신.
	- 운영: 운영 서버
		- Azure App Service 단일 인스턴스(NestJS가 API+React 정적 서빙) + Azure PostgreSQL 서비스(Azure Database for PostgreSQL). 구체 App Service·DB 식별자는 build/배포 준비 시 추가.

- **QA 실행 스크립트 루트**: `<WORK_ROOT>/tests/automation/` — UI 자동화 스크립트(`*.ps1`·`*.py`)·UI 트리 덤프 위치.

## 소스·빌드·탐지 명칭 변수 (제품 식별자)

| 변수          | 값                     | 용도                |
| ----------- | --------------------- | ----------------- |
| `<PROJECT>` | `AccountInterlockHub` | 워크스페이스 전역 프로젝트명.  |

## 연동 구성 상수

이 서비스의 연동 구성은 **배포 시점 상수**이며 본 절이 단일 출처다([`docs/prd/PRD.md`](docs/prd/PRD.md) §시스템 제약사항). 값은 배포 시 애플리케이션 설정으로 주입되고, 변경은 재배포로만 반영된다([`docs/prd/devspec/infra.md`](docs/prd/devspec/infra.md) §연동 구성 상수 주입). 연동은 **하나의 발송처 ↔ 하나의 수신처 1:1 고정**이므로 각 값은 하나씩만 존재한다.

### 허브 애플리케이션 주입 값

배포 시 허브 애플리케이션 설정으로 주입되는 값이다.

| 변수 | 값 | 확정 시점 | 설명 |
| ---- | -- | ------ | ---- |
| `<INTERLOCK_ENTRY_PATH>` | TBD | spec 진입 전 | 사용자 진입 경로. 발송처가 이 경로에 `encX`·`encY`를 붙여 사용자를 유도한다 |
| `<RECEIVER_DELIVERY_URL>` | TBD | build 착수 전 (수신처 협의) | 수신처(서비스 B) 전달 주소. 승인·복호화 완료 시 전달 데이터(X)를 보내는 대상 |
| `<CONSENT_ITEMS>` | TBD | **spec 진입 전** | 사용자에게 노출할 동의 항목 목록. 항목마다 항목명·필수 여부·설명을 갖는 **여러 건**이라 값의 주입 형식(구조화 문자열·별도 설정 파일 등)을 함께 정한다. 화면 사양의 직접 입력이다 |
| `<CONSENT_NOTICE>` | TBD | **spec 진입 전** | 동의 대상 설명 문구(사용자 화면 상단 안내). 미설정 시 미표시. 화면 사양의 직접 입력이다 |
| `<RETENTION_MONTHS>` | `3` | 확정 | 추적 레코드 보관 기간(개월). 결과 확인 완료 기준 |
| `<RETENTION_MAX_MONTHS>` | `6` | 담당자 확인 대기 | 추적 레코드 생성 기준 절대 보관 상한(개월). 결과 확인이 오지 않은 레코드도 이 시점에 삭제된다 |

### 발송처 호출 입력 값

허브에 주입되는 값이 아니라, 발송처가 **연동 라이브러리를 호출할 때 인자로 넘기는** 값이다([`docs/prd/devspec/external-apis.md`](docs/prd/devspec/external-apis.md) §연동 라이브러리). 발송처가 자기 환경에 맞는 값을 고르므로 소유 주체가 위 표와 다르다.

| 변수 | 값 | 확정 시점 | 설명 |
| ---- | -- | ------ | ---- |
| `<HUB_BASE_URL_PROD>` | TBD | 배포 준비 시 | 운영 환경 허브 기준 URL |
| `<HUB_BASE_URL_DEV>` | TBD | build 착수 전 | 개발·로컬 환경 허브 기준 URL |

> 발송처키는 **비밀 값**이므로 본 파일에 두지 않는다([`document-master-guide.md`](ai/strategies/document-master-guide.md) §경로·이름 표기 — 비밀 값 제외). 위치 확정은 담당자 대기 항목이다([`docs/prd/PRD.md`](docs/prd/PRD.md) §미결·확인 필요). 서버 대면 API 의 인증 자격을 두기로 하면 그 값도 같은 이유로 본 파일 대상이 아니다.

## 연동 라이브러리 식별자

발송처에 제공하는 암호화·요청 URL 생성 라이브러리의 소스·산출물 값이다([`docs/prd/devspec/infra.md`](docs/prd/devspec/infra.md) §연동 라이브러리 배포). 구현 기술스택 확정 후 채운다.

| 변수 | 값 | 용도 |
| ---- | -- | ---- |
| `<LIB_SRC_DIR>` | TBD | 연동 라이브러리 소스 경로 |
| `<LIB_BIN>` | TBD | 배포 산출물(라이브러리 파일)명 |

## 관리 도구 식별자

| 변수                  | 값                          | 용도                                                                                                                                                     |
| ------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `<REDMINE_PROJECT>` | `accountinterlockhub`      | 제품 작업 티켓을 관리하는 Redmine 프로젝트 식별자                                                                                                                        |
| `<QA_TOOLS_HOME>`   | `<WORK_ROOT>/test/qa-tool` | TC 실행 검증 도구(MCP 서버) 설치 루트 — pywinauto-mcp 저장소·venv 위치 ([`tools-setup.md`](ai/strategies/qa-execution/tools-setup.md)). ⚠️ PC 로컬 경로 — PC 가 바뀌면 본 값만 갱신. |
