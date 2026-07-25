# 프로젝트 환경 값 (경로·제품 명칭)

이 워크스페이스가 다루는 **현재 프로젝트**의 경로·제품 식별자 값을 단일 관리한다(비밀 아님·git 관리). 에이전트·전략 문서는 플레이스홀더(`<INSTALL_ROOT>` 등)만 사용하고, 그 실제 값은 본 파일에서 정의한다 — 전 문서는 플레이스홀더로만 참조하므로 본 파일 갱신으로 정합이 유지된다. **프로젝트가 바뀌면 프로젝트 부트스트랩 절차([`project-bootstrap.md`](project-bootstrap.md))에 따라 본 파일을 갱신한다.** 비밀 값(토큰·키)은 본 파일이 아니라 [`CLAUDE.local.md`](CLAUDE.local.md) 에 보관한다.

> 플레이스홀더 표기·해석의 강제 규칙은 [`document-master-guide.md`](document-master-guide.md) §경로·이름 표기. 경로·이름을 다루는 모든 세션은 사용 전 본 파일을 읽는다(CLAUDE.env.md 는 CLAUDE.md 와 달리 자동 로드되지 않음). 본 파일의 위치·역할과 환경변수 키 목록(Redmine 등)은 CLAUDE.md §환경 구성.

> ⚠️ 부트스트랩 시점에는 기본 골격만 갖는다. 구체 프로그램 구성 변수(설치 경로·실행 파일·소스 프로젝트명 등)는 프로젝트 초기 설정(directing) 과정에서 프로그램 구성표·개발사양 확정에 맞춰 추가·갱신한다([`stages/directing.md`](ai/strategies/stages/directing.md) §산출물).

## 경로·제품 명칭 변수

| 변수            | 값                              | 설명                              |
| ------------- | ------------------------------ | ------------------------------- |
| `<WORK_ROOT>` | `D:/Work/AccountInterlockHub` | 제품 소스·자동화 작업 저장소 루트 (설치 루트와 별개). ⚠️ PC 로컬 경로 — PC 가 바뀌면 본 값만 갱신 |
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
| `<INTERLOCK_ENTRY_PATH>` | `/interlock/entry` | 확정 | 사용자 진입 경로. 발송처가 이 경로에 `encX`·`encY`를 붙여 사용자를 유도한다. 연동이 1:1 고정이라 발송처 식별 구간을 두지 않는다 |
| `<SELFCHECK_PATH>` | TBD | build 착수 전 | 연동 규약 자가진단 API 경로([`docs/prd/devspec/external-apis.md`](docs/prd/devspec/external-apis.md) §연동 규약 자가진단 API). 추측하기 어려운 **비공개 경로**로 둔다 |
| `<RECEIVER_DELIVERY_URL>` | TBD | build 착수 전 (수신처 협의) | 수신처(서비스 B) 전달 주소. 승인·복호화 완료 시 전달 데이터(X)를 보내는 대상 |
| `<CONSENT_ITEMS>` | §동의 항목 값 | 확정 | 사용자에게 노출할 동의 항목 목록. 값과 주입 형식은 아래 §동의 항목 값이 정본 |
| `<CONSENT_NOTICE>` | §동의 항목 값 (**잠정**) | 배포 전 (개인정보 고지 항목 검토) | 동의 화면 상단 안내 문구. 미설정 시 미표시. 확정 전까지 잠정 문구로 운영하지 않는다 |
| `<RETENTION_MONTHS>` | `3` | 확정 | 추적 레코드 보관 기간(개월). 결과 확인 완료 기산 |
| `<RETENTION_MAX_MONTHS>` | `6` | 확정 | 추적 레코드 생성 기산 절대 보관 상한(개월). 결과 확인이 오지 않은 레코드도 이 시점에 삭제된다 |
| `<CONSENT_PROOF_RETENTION_MONTHS>` | `60` (**잠정**) | 배포 전 (법령·계약 확인) | 동의 증적 보존 기간(개월). 동의 일시 기산이며 추적 레코드보다 길다 |

### 동의 항목 값

동의 항목은 항목마다 여러 속성을 갖는 목록이라 위 표의 한 칸에 담을 수 없어 여기서 정의한다. 주입 형식은 **JSON 배열 문자열**이며, 애플리케이션이 기동 시 파싱·형식 검증한다([`docs/prd/devspec/infra.md`](docs/prd/devspec/infra.md) §연동 구성 상수 주입).

`<CONSENT_ITEMS>` — 현재 1건이다.

| 항목 코드 | 항목명 | 필수 | 설명 |
| ---- | ---- | -- | ---- |
| `THIRD_PARTY_PROVISION` | 개인정보 제3자 제공 동의 | 필수 | 발송처가 보유한 회원 식별 정보를 수신처(서비스 B)에 제공하는 것에 대한 동의 |

```json
[{"code":"THIRD_PARTY_PROVISION","label":"개인정보 제3자 제공 동의","required":true,"description":"발송처가 보유한 회원 식별 정보를 수신처에 제공하는 데 동의합니다."}]
```

`<CONSENT_NOTICE>` — **잠정 문구**다. 실제 문구가 확정되면 이 값만 교체한다(화면 사양은 상수를 참조하므로 사양 개정이 필요하지 않다).

```
아래 항목에 동의하시면 서비스 연동이 진행됩니다. 동의하지 않으시면 연동이 취소됩니다.
```

허용 형태 — 화면 사양이 이 범위를 전제로 레이아웃을 정한다.

- **최대 400자**, **최대 3단락**(단락 구분은 빈 줄). 그 이상이 필요하면 화면 사양을 함께 고쳐야 한다.
- 서식·링크·HTML 태그를 담지 않는다(평문만). 값이 비면 안내 영역을 렌더하지 않는다.

> 동의 항목·안내 문구를 바꾸면 **동의 항목 버전 식별자도 함께 바뀐다** — 동의 증적이 그 시점의 항목 내용을 참조한다([`docs/prd/devspec/database.md`](docs/prd/devspec/database.md) §동의 증적).

### 발송처 호출 입력 값

허브에 주입되는 값이 아니라, 발송처가 **연동 라이브러리를 호출할 때 인자로 넘기는** 값이다([`docs/prd/devspec/external-apis.md`](docs/prd/devspec/external-apis.md) §연동 라이브러리). 발송처가 자기 환경에 맞는 값을 고르므로 소유 주체가 위 표와 다르다.

| 변수 | 값 | 확정 시점 | 설명 |
| ---- | -- | ------ | ---- |
| `<HUB_BASE_URL_PROD>` | TBD | 배포 준비 시 | 운영 환경 허브 기준 URL |
| `<HUB_BASE_URL_DEV>` | TBD | build 착수 전 | 개발·로컬 환경 허브 기준 URL |

> 발송처키는 **비밀 값**이므로 본 파일에 두지 않으며 상수화 대상이 아니다([`document-master-guide.md`](ai/strategies/document-master-guide.md) §경로·이름 표기 — 비밀 값 제외). 발송처키의 생성·보관은 발송처 소관이고, 허브는 복호화에 발송처키를 쓰지 않으므로 보관할 필요도 없다([`docs/prd/devspec/external-apis.md`](docs/prd/devspec/external-apis.md) §암호화 연동 규약). 서버 대면 API 에는 인증을 두지 않으므로 인증 자격 값도 없다.

## 연동 라이브러리 식별자

발송처에 제공하는 암호화·요청 URL 생성 라이브러리의 소스·산출물 값이다([`docs/prd/devspec/infra.md`](docs/prd/devspec/infra.md) §연동 라이브러리 배포).

| 변수 | 값 | 용도 |
| ---- | -- | ---- |
| `<LIB_SRC_DIR>` | `apps/sender-sdk/` | 연동 라이브러리 소스 경로(저장소 루트 기준). 모든 코드는 `apps/` 하위에 둔다([`doc-structure.md`](ai/strategies/doc-structure.md)) |
| `<LIB_BIN>` | `AccountInterlockHub.SenderSdk.dll` | 배포 산출물(라이브러리 파일)명 |
| `<LIB_TARGET_FRAMEWORK>` | `.NET Framework 4.8` | 대상 런타임. 발송처 C# 프로젝트가 참조하는 기준 |

## 관리 도구 식별자

| 변수                  | 값                          | 용도                                                                                                                                                     |
| ------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `<REDMINE_PROJECT>` | `accountinterlockhub`      | 제품 작업 티켓을 관리하는 Redmine 프로젝트 식별자                                                                                                                        |
| `<QA_TOOLS_HOME>`   | `<WORK_ROOT>/test/qa-tool` | TC 실행 검증 도구(MCP 서버) 설치 루트 — pywinauto-mcp 저장소·venv 위치 ([`tools-setup.md`](ai/strategies/qa-execution/tools-setup.md)). ⚠️ PC 로컬 경로 — PC 가 바뀌면 본 값만 갱신. |
