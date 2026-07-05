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
		- 별도 구축 MSSQL 서버 사용(Azure 미사용). 애플리케이션(NestJS+React) 로컬 기동. 구체 접속값은 build 시점 확정.
	- 테스트: 테스트 서버
		- 구성항목 미정. 필요 시 갱신.
	- 운영: 운영 서버
		- Azure App Service 단일 인스턴스(NestJS가 API+React 정적 서빙) + Azure MSSQL 서비스. 구체 App Service·DB 식별자는 build/배포 준비 시 추가.

- **QA 실행 스크립트 루트**: `<WORK_ROOT>/tests/automation/` — UI 자동화 스크립트(`*.ps1`·`*.py`)·UI 트리 덤프 위치.

## 소스·빌드·탐지 명칭 변수 (제품 식별자)

| 변수          | 값                     | 용도                |
| ----------- | --------------------- | ----------------- |
| `<PROJECT>` | `AccountInterlockHub` | 워크스페이스 전역 프로젝트명.  |

## 관리 도구 식별자

| 변수                  | 값                          | 용도                                                                                                                                                     |
| ------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `<REDMINE_PROJECT>` | `accountinterlockhub`      | 제품 작업 티켓을 관리하는 Redmine 프로젝트 식별자                                                                                                                        |
| `<QA_TOOLS_HOME>`   | `<WORK_ROOT>/test/qa-tool` | TC 실행 검증 도구(MCP 서버) 설치 루트 — pywinauto-mcp 저장소·venv 위치 ([`tools-setup.md`](ai/strategies/qa-execution/tools-setup.md)). ⚠️ PC 로컬 경로 — PC 가 바뀌면 본 값만 갱신. |
