# 설치·빌드·기동 절차서

`apps/` 하위 제품 프로그램의 **배포 산출물을 만들고 기동하는 절차**다. qa 단계가 같은 환경을 재현할 수 있도록 순서와 사전 조건을 고정한다. 배포 형태·환경 구분의 정본은 [`../docs/prd/devspec/infra.md`](../docs/prd/devspec/infra.md), 경로·상수 값의 정본은 [`../CLAUDE.env.md`](../CLAUDE.env.md) 다.

> 비밀 값(데이터베이스 접속 값)은 본 문서에 적지 않는다 — **키 이름만** 적고 실제 값은 [`../CLAUDE.local.md`](../CLAUDE.local.md)(git 비관리)를 출처로 삼는다.

## 프로그램 구성

배포 단위는 둘이고, 그 안에 논리 프로그램 셋이 들어간다([`../docs/prd/devspec/infra.md`](../docs/prd/devspec/infra.md) §애플리케이션 구성).

1. **허브 애플리케이션** (배포 단위 1개)
	1. 사용자 웹 — `apps/frontend` (React·Vite). 정적 빌드 산출물로 만들어진다.
	2. 백엔드 API — `apps/backend` (NestJS). 위 정적 산출물을 함께 서빙한다.
	3. 보관 배치 — `apps/backend` 안의 별도 실행 진입점(상시 기동 프로세스의 스케줄 + 수동 실행 명령).
2. **연동 라이브러리** — `<LIB_SRC_DIR>` (C# · `<LIB_TARGET_FRAMEWORK>`). 허브와 배포 주기·경로가 분리된 별도 단위다.

## 사전 조건 (PC 도구)

| 도구 | 용도 | 확인 방법 |
|---|---|---|
| Node.js · npm | 허브 애플리케이션 설치·빌드·기동 | `node --version` · `npm --version` |
| `csc.exe` (.NET Framework 4.8 런타임 동봉) | 연동 라이브러리 빌드 | `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe` 존재 확인 |
| PostgreSQL 16 접속 | 마이그레이션·저장/조회 동작 | 아래 §데이터베이스 참조 |

- 연동 라이브러리는 원래 MSBuild(Visual Studio Build Tools)로 빌드하는 것이 기준이나([`../docs/prd/devspec/infra.md`](../docs/prd/devspec/infra.md) §연동 라이브러리 배포), **MSBuild·dotnet CLI·타게팅 팩이 없는 PC** 에서도 산출물을 만들 수 있도록 `csc.exe` 를 직접 호출하는 빌드 스크립트를 함께 둔다. 같은 폴더의 `.csproj` 3종은 발송처의 Visual Studio 참조·열람용이며 이 스크립트가 사용하지 않는다.

## 1. 의존 패키지 설치

저장소 루트에서 실행한다. 락파일이 있으므로 재현 설치(`npm ci`)를 기본으로 한다.

1. `npm ci --prefix apps/backend`
2. `npm ci --prefix apps/frontend`

루트 [`../package.json`](../package.json) 의 `install:apps` 스크립트도 같은 일을 하지만 `npm install`(락파일 갱신 가능)이므로, qa 환경 재현에는 위의 `npm ci` 를 쓴다.

## 2. 허브 애플리케이션 빌드

**프런트엔드를 먼저 빌드한다.** 백엔드가 프런트엔드 빌드 산출물 폴더를 정적 콘텐츠로 서빙하므로, 순서를 바꾸면 화면이 서빙되지 않는다.

1. `npm run build:frontend` — 산출물 `apps/frontend/dist/`
2. `npm run build:backend` — 산출물 `apps/backend/dist/`

루트 `npm run build` 가 위 둘을 이 순서로 실행한다.

## 3. 연동 라이브러리 빌드·패키징

`<LIB_SRC_DIR>` 에서 아래 순서로 실행한다. 순서를 지켜야 한다 — 각 단계가 앞 단계 산출물을 입력으로 받는다.

1. `powershell -File build.ps1` — 라이브러리(`<LIB_BIN>`)와 검증 하네스를 `bin/` 에 낸다.
2. `powershell -File generate-vectors.ps1` — 규약 테스트 벡터(`protocol-test-vectors.json`)를 재생성한다. 같은 소스에서는 같은 바이트가 나온다(결정적).
3. `powershell -File package.ps1` — 발송처 전달용 배포 패키지를 `dist-package/` 에 조립한다(구성 5종 — 라이브러리·호출 샘플·사용 안내·테스트 벡터·체크섬).

## 4. 환경 설정

허브 애플리케이션은 기동 시 **연동 구성 상수의 존재·형식을 검증**하고, 하나라도 미충족이면 어떤 표면도 열지 않고 중단한다. 그러므로 기동 전에 설정을 채워야 한다.

1. [`backend/.env.example`](backend/.env.example) 를 `apps/backend/.env` 로 복사한다. 이 파일은 커밋 대상이 아니다(루트 `.gitignore` 가 차단).
2. **연동 구성 상수**(필수 8종 + 선택 1종 + 포트)를 채운다 — 값의 단일 출처는 [`../CLAUDE.env.md`](../CLAUDE.env.md) §연동 구성 상수다. 잠정값이 섞여 있으나 형식이 실제 값과 같아 개발·검증 환경 기동을 막지 않는다(운영 배포 전에는 실제 값으로 교체한다).
3. **데이터베이스 접속 값** 5종(`DB_HOST`·`DB_PORT`·`DB_NAME`·`DB_USER`·`DB_PASSWORD`)을 채운다 — 값의 출처는 [`../CLAUDE.local.md`](../CLAUDE.local.md) §임시 PostgreSQL 이다.

`.env` 는 실행 디렉터리 기준으로 읽히므로, 아래 기동 명령을 모두 루트 [`../package.json`](../package.json) 스크립트로 실행하면(내부에서 `apps/backend` 로 이동한다) 위치가 어긋나지 않는다.

### 설정 미충족 시의 동작

두 검증은 실패 경로가 서로 다르다. qa 가 판정할 때 구분해서 읽는다.

- **연동 구성 상수 미충족** — 표준 출력에 `[PROC-901] 기동 중단 — 필수 연동 구성 상수 누락/형식 위반: <상수명 나열>` 한 줄을 남기고 종료 코드 1 로 끝난다. HTTP 포트를 열지 않는다. 값은 로그에 남기지 않고 **키 이름만** 남긴다.
- **데이터베이스 접속 값 미충족** — 애플리케이션 구성 요소를 만드는 중에 실패해 종료 코드 1 로 끝난다(오류 추적 정보가 함께 출력된다). 이 경우에도 HTTP 포트는 열리지 않으며, 오류 메시지에는 누락된 **키 이름만** 담기고 값은 담기지 않는다.

## 5. 데이터베이스

PostgreSQL 16 이 필요하다. 접속 값은 §4-3 의 키로 주입한다.

1. `npm run migration:run` — `apps/backend/migrations/` 의 스키마를 적용한다. 되돌리기는 `npm run migration:revert`.
2. 모든 스키마 변경문이 "있으면 건너뛰기" 형태로 작성돼 있어 **여러 번 실행해도 안전**하다(별도 적용 이력 테이블을 두지 않는다).

## 6. 기동

1. `npm run start` — 빌드 산출물로 기동한다(운영·검증 기준 실행 방식).
2. 기동에 성공하면 표준 출력 마지막에 `[PROC-901] 기동 완료 — 포트 <포트> · 동의 항목 버전 <식별자>` 가 나온다.
3. 개발 중 자동 재시작이 필요하면 `npm run start:dev` 를 쓴다(검증 기준 실행 방식은 아니다).

기본 포트는 `3000` 이며 `.env` 의 `PORT` 로 바꾼다. 기준 URL 값은 [`../CLAUDE.env.md`](../CLAUDE.env.md) §발송처 호출 입력 값의 `<HUB_BASE_URL_DEV>` 다.

### 보관 배치 실행

- **자동** — 허브 애플리케이션이 상시 기동 중이면 매일 00:10(한국 시간)에 스스로 실행된다.
- **수동** — `npm --prefix apps/backend run retention:run`. 표준 출력 마지막 줄에 처리 요약이 한 줄(JSON)로 나오고, 종료 코드 0 이 성공·0 이외가 실패다. **요약 줄이 아예 없으면 기동 실패로 읽는다.**
- 데이터베이스에 닿지 못하는 환경에서는 삭제 시도 2건이 각각 접속 대기 시간을 소진한 뒤 실패 사유가 담긴 요약을 내고 종료 코드 1 로 끝난다 — 진행이 멈춘 것이 아니라 대기 중이므로, 실행 시간을 넉넉히 두고 판정한다.

## 7. 기동 확인 (동작 점검)

데이터베이스 없이도 확인 가능한 항목과, 데이터베이스가 있어야 확인 가능한 항목이 나뉜다.

**데이터베이스 없이 확인 가능**

1. **진입 화면 서빙** — `<INTERLOCK_ENTRY_PATH>` 에 GET 하면 200 과 함께 화면 문서가 온다.
2. **정적 자원 서빙** — 위 문서가 참조하는 자원 경로(`/assets/…`)가 200 으로 온다.
3. **연동 규약 자가진단** — `<SELFCHECK_PATH>` 에 POST 하면 판정 결과가 온다. 이 접점은 데이터베이스를 쓰지 않는다. 입력은 `encX`·`encY`·`birthDate` 셋이며, `<LIB_SRC_DIR>` 의 규약 테스트 벡터를 그대로 넣으면 적합 판정이 나와야 한다.
4. **연동 라이브러리 ↔ 허브 대칭** — `<LIB_SRC_DIR>` 에서 `node verify-roundtrip.js` 를 실행하면 라이브러리가 만든 암호값을 허브 쪽 복호화 판정에 넣어 원래 값으로 복원되는지 확인한다(백엔드가 먼저 빌드돼 있어야 한다).
5. **라이브러리 자체 검증** — `bin\AccountInterlockHub.SenderSdk.Harness.exe --vectors protocol-test-vectors.json` 이 전건 일치를 보고해야 한다.

**데이터베이스가 있어야 확인 가능**

6. 본인확인·승인 제출 접점과 서버 대면 API 3종은 추적 레코드를 읽고 쓰므로 데이터베이스가 필요하다. 접속하지 못하면 애플리케이션이 죽지 않고 각 요청을 분류된 오류로 응답한다.
7. 사용자 흐름 전체(진입 → 본인확인 → 동의·승인 → 결과)의 저장↔조회 정합 확인도 여기에 속한다.

## 8. 산출물 위치

| 산출물 | 경로 | 비고 |
|---|---|---|
| 사용자 웹 정적 빌드 | `apps/frontend/dist/` | git 비관리 |
| 백엔드 API·보관 배치 실행본 | `apps/backend/dist/` | git 비관리 |
| 연동 라이브러리·검증 하네스 | `<LIB_SRC_DIR>bin/` | git 비관리 |
| 연동 라이브러리 배포 패키지 | `<LIB_SRC_DIR>dist-package/` | git 비관리 · 발송처 전달본 |
| 규약 테스트 벡터 | `<LIB_SRC_DIR>protocol-test-vectors.json` | git 관리 · 재생성해도 같은 바이트 |

빌드 산출물과 `.env` 는 모두 저장소에 커밋하지 않는다(루트 `.gitignore`).
