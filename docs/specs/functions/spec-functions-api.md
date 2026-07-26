# 인터페이스 공통 규약·카탈로그

정본 목록은 [`spec-functions.md`](spec-functions.md). 용어는 [`../../../wiki/WIKI.md`](../../../wiki/WIKI.md).

본 문서는 허브의 모든 인터페이스가 공유하는 **규약**과 **전체 카탈로그**를 담는다. 접점별 상세는 [`spec-functions-api-user.md`](spec-functions-api-user.md)(사용자 진입 표면) · [`spec-functions-api-server.md`](spec-functions-api-server.md)(서버 대면·수신처 전달·명령) · [`spec-functions-lib.md`](spec-functions-lib.md)(연동 라이브러리)가 갖는다.

## 표면 구분

허브가 외부와 닿는 자리는 셋이며, 그 밖의 표면을 만들지 않는다([`../../prd/PRD.md`](../../prd/PRD.md) §시스템 제약사항 — 공개 표면).

1. **사용자 진입 표면** — 발송처가 만든 링크로 사용자가 들어오는 경로와, 그 화면이 단계를 진행시키려고 호출하는 접점. 사용자 진입 경로 하나의 안쪽이며 새 외부 표면이 아니다.
2. **서버 대면 API** — 발송처·수신처가 서버에서 직접 호출하는 4종(`API-01`~`API-04`).
3. **명령 진입점** — 배포 단위 안에서 사람이 실행하는 보관 배치 수동 실행(`BAT-02`). HTTP 표면을 늘리지 않는다.

- **허브가 바깥으로 거는 호출은 하나뿐**이다 — 수신처 전달(`USR-02`). 상수로 고정된 주소 하나이므로 대상 선택 로직이 없다(`BIZ-004-01`).
- **연동 라이브러리**는 허브 애플리케이션이 아니라 발송처 프로세스 안에서 실행되는 별도 배포 단위다.

## 인증·요청 제한

| 항목 | 확정 | 근거 |
|---|---|---|
| 인증 요구 | **모든 접점 `Public`** — 인증·자격 검증을 두지 않는다. 인증 헤더·서명·API 키를 요구하지도 검증하지도 않으며 자격이 담긴 요청이 와도 무시한다 | `AUTH-001-02` · `AUTH-001-03` |
| 401 · 403 | **정의하지 않는다.** 오류 코드 집합에 넣지 않는다 | `AUTH-001-03` |
| 요청 제한 | **미적용 — 수용 리스크.** 진입 경로·서버 대면 API 어디에도 과부하·반복 시도 제한을 두지 않는다. 이는 누락이 아니라 의도된 결정이다 | `OPS-002-03` · [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 — 제외 |
| 자가진단 경로 | 인증이 아니라 **노출 축소 장치**다. 경로를 아는 요청은 그대로 처리된다 | EXC-AUTH-01 · `SEC-003` |
| IP 기반 접속 제한 | 두지 않는다 | EXC-AUTH-02 |

- 위 결정으로 남는 위험 네 가지(기밀성·무결성/출처·반복 시도·조회로 인한 보관 기산 개시)는 `OPS-002` 가 수용 리스크로 기록한다. 어떤 접점도 완화 장치를 새로 추가하지 않는다.

## 공통 응답 포맷

- **성공** — 접점의 응답 모델을 본문 최상위에 **그대로** 싣는다. 공통 래퍼를 두지 않는다. 성공·실패는 HTTP 상태로 이미 갈린다.
- **실패** — [`function_FN-014-015.md`](function_FN-014-015.md) §FN-014 의 오류 응답 엔벨로프를 쓴다.

	```
	{ "code": "EX-SEC-001", "message": "연동 링크가 올바르지 않습니다.",
	  "details": [ { "field": "encX", "reason": "REQUIRED" } ] }
	```

	- `code` — 정책 예외 코드 카탈로그의 값([`../policies/spec-policies.md`](../policies/spec-policies.md) §예외(EX) 코드 카탈로그).
	- `message` — 한 문장. 기본값은 FN-014 §오류 메시지 기본값 표.
	- `details` — 선택. `{ field, reason }` 목록이며 `reason` 은 `REQUIRED`·`FORMAT`·`LENGTH` 셋 중 하나다. **값 자체를 담지 않는다.** 비어 있으면 필드를 생략한다.
- **본문 형식** — 요청·응답 모두 `application/json; charset=utf-8`. 진입 접점만 `text/html; charset=utf-8` 로 화면 문서를 반환한다.
- **일시 표기** — ISO 8601 확장 형식에 오프셋을 붙인 문자열(예 `2026-07-25T13:05:00+09:00`). 시간대 정보를 잃지 않는다.
- **속성명** — camelCase. 데이터 모델의 속성명을 그대로 쓴다([`spec-models.md`](../datas/spec-models.md) §데이터 모델 설계 원칙 6).
- **캐시** — 모든 응답에 캐시 금지를 지정한다. 진입 응답은 URL 에 암호값을 담고 있고, 조회 응답은 상태를 바꾸는 부작용이 있어 중간 캐시가 개입하면 안 된다.

## 경로·메서드 규약

- **경로 값은 상수에서 온다** — 진입 경로 `<INTERLOCK_ENTRY_PATH>` · 자가진단 경로 `<SELFCHECK_PATH>`([`../../../CLAUDE.env.md`](../../../CLAUDE.env.md) §연동 구성 상수). 본 사양은 값을 복제하지 않는다(`OPS-001-04`).
- **연동이 1:1 고정이므로 경로에 발송처·수신처 식별 구간을 두지 않는다.**
- **정의되지 않은 경로** — 본문 없는 일반 404. EX 코드를 담지 않는다. 자가진단 경로만 특별해 보이지 않게 하기 위한 규칙이다(`SEC-003-02`).
- **메서드 불일치** — 서버 대면 API·사용자 진입 표면은 405(본문 없음). **자가진단 경로는 메서드가 달라도 일반 404** 로 응답해 경로의 존재를 드러내지 않는다.
- **요청 본문을 JSON 으로 해석할 수 없으면** 그 접점의 **입력 부재**와 같이 다룬다 — 추적 키 입력 3종(처리상태 확인 API·연동 완료 확인 API·완료 콜백 API) → `EX-DATA-002`, 연동 규약 자가진단 API → `EX-SEC-003`, 본인확인 제출 → `EX-AUTH-001`, 동의·승인 제출 → `EX-BIZ-001`.
	- 연동 요청 진입은 `GET` 이라 요청 본문이 없어 해당하지 않는다. 접점 정의는 아래 §인터페이스 카탈로그.

## 버전 관리·목록 규약

- **경로에 API 버전 구간을 두지 않는다.** 연동이 1:1 고정이고, 호환 판단 수단으로 **규약 버전**(`SEC-001-11`)이 이미 있다. 경로 버전을 추가하면 두 버전 체계가 생겨 어느 쪽이 정본인지 흔들린다. 규약이 바뀌면 라이브러리와 허브를 함께 배포한다(`SEC-001-12`).
- **페이지네이션·정렬·필터 규약을 두지 않는다.** 목록을 돌려주는 접점이 없다 — 모든 조회는 연동 추적 키 단건이다([`spec-datas.md`](../datas/spec-datas.md) §인덱스 전략).
- **결과 푸시 통지 경로를 두지 않는다.** 발송처는 조회로 결과를 확인한다([`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 — 제외).

## 진입 파라미터 이름 (확정)

연동 요청 URL 의 쿼리 파라미터 이름을 **`encX`·`encY`** 로 확정한다. 이 값은 **연동 라이브러리와 허브가 공유**하며, 라이브러리는 이 이름으로 URL 을 조립하고 허브는 같은 이름으로 읽는다.

| 파라미터 | 값 | 규칙 |
|---|---|---|
| `encX` | 전달 데이터 암호문 | Base64URL(패딩 없음). 퍼센트 인코딩을 겹쳐 적용하지 않는다(`SEC-001-08`) |
| `encY` | 키 암호문 | 위와 같다 |

- **왜 이 이름인가** — 상위 규약([`../../prd/devspec/external-apis.md`](../../prd/devspec/external-apis.md) §암호화 연동 규약)·정책(`SEC-001`)·데이터 모델([`MDL-004`](../datas/model_MDL-004-006.md) 속성명)이 이미 같은 이름을 쓴다. 다른 이름을 만들면 문서가 말하는 값과 URL 에 실리는 이름이 갈린다.
- 대소문자를 구분한다. 같은 이름의 파라미터가 둘 이상 오면 **구조 위반**으로 다룬다(`EX-SEC-001`).
- 두 파라미터 외의 파라미터가 실려 와도 읽지 않고 무시한다. 링크 만료·1회성 표시를 나타내는 파라미터를 두지 않는다(`OPS-002-05`).

## 인터페이스 카탈로그

| 접점 | 경로 | 메서드 | 담당 IA | 호출 PROC | 인증 | 요청 | 응답(성공) |
|---|---|---|---|---|---|---|---|
| 연동 요청 진입 | `<INTERLOCK_ENTRY_PATH>` | GET | `USR-01` | PROC-101 | Public | 쿼리 `encX`·`encY` ([`MDL-004`](../datas/model_MDL-004-006.md)) | 200 `text/html` — 진입 화면 문서 + 초기 상태 |
| 본인확인 제출 | `<INTERLOCK_ENTRY_PATH>/verify` | POST | `USR-03` | PROC-102 · PROC-301 · PROC-303 | Public | [`MDL-004`](../datas/model_MDL-004-006.md) + [`MDL-006`](../datas/model_MDL-004-006.md) | 200 — 다음 단계 상태 + [`MDL-008`](../datas/model_MDL-007-010.md) |
| 동의·승인 제출 | `<INTERLOCK_ENTRY_PATH>/approve` | POST | `USR-04` · `USR-02` · `USR-05` | PROC-103 · PROC-104 · PROC-301 · PROC-302 · PROC-303 | Public | [`MDL-004`](../datas/model_MDL-004-006.md) + [`MDL-006`](../datas/model_MDL-004-006.md) + [`MDL-007`](../datas/model_MDL-007-010.md) | 200 — [`MDL-009`](../datas/model_MDL-007-010.md) |
| 처리상태 확인 API | `/api/interlock/status` | POST | `API-01` | PROC-201 · PROC-301 | Public | [`MDL-011`](../datas/model_MDL-011-015.md) | 200 — [`MDL-012`](../datas/model_MDL-011-015.md) |
| 연동 완료 확인 API | `/api/interlock/completion` | POST | `API-02` | PROC-202 | Public | [`MDL-011`](../datas/model_MDL-011-015.md) | 200 — [`MDL-013`](../datas/model_MDL-011-015.md) |
| 완료 콜백 API | `/api/interlock/callback` | POST | `API-03` | PROC-203 · PROC-301 | Public | [`MDL-011`](../datas/model_MDL-011-015.md) | 200 — [`MDL-013`](../datas/model_MDL-011-015.md) |
| 연동 규약 자가진단 API | `<SELFCHECK_PATH>` | POST | `API-04` | PROC-204 | Public(비공개 경로) | [`MDL-014`](../datas/model_MDL-011-015.md) | 200 — [`MDL-015`](../datas/model_MDL-011-015.md) |
| 수신처 전달 (허브 → 밖) | `<RECEIVER_DELIVERY_URL>` | POST | `USR-02` | PROC-104 | 없음 | [`MDL-005`](../datas/model_MDL-004-006.md) 원문 바이트 | 2xx = 성공 (본문 미사용) |
| 보관 배치 수동 실행 | 명령 진입점 | 명령 실행 | `BAT-02` | PROC-304 | 없음(배포 단위 내부) | 인자 없음 | 표준 출력 요약 [`MDL-021`](../datas/model_MDL-019-022.md) + 종료 코드 |
| 데이터 암호화 | 라이브러리 공개 진입점 | 함수 호출 | `LIB-01` | PROC-401 | 해당 없음 | [`MDL-016`](../datas/model_MDL-016-018.md) | [`MDL-004`](../datas/model_MDL-004-006.md) |
| 연동 요청 URL 생성 | 라이브러리 공개 진입점 | 함수 호출 | `LIB-02` | PROC-402 | 해당 없음 | [`MDL-017`](../datas/model_MDL-016-018.md) | [`MDL-018`](../datas/model_MDL-016-018.md) |

- 서버 대면 조회 2종(`API-01`·`API-02`)에 **POST 를 쓰는 이유**는 [`spec-functions-api-server.md`](spec-functions-api-server.md) §메서드 선택 근거에 있다.
- `LIB-03`(배포 패키지)·`LIB-04`(규약 테스트 벡터)는 호출 가능한 접점이 아니라 **전달 산출물**이라 본 카탈로그에 두지 않는다([`spec-functions-lib.md`](spec-functions-lib.md) §배포 패키지 · §규약 테스트 벡터).

## 잠정값·범위 밖의 취급

- **잠정값** — `<RECEIVER_DELIVERY_URL>`·`<HUB_BASE_URL_PROD>`·`<HUB_BASE_URL_DEV>`·`<SELFCHECK_PATH>`·`<CONSENT_NOTICE>`·`<CONSENT_PROOF_RETENTION_MONTHS>`·`<COMPLETION_REDIRECT_URL>` 는 **상수 주입으로만 참조**하고 값을 본문에 복제하지 않는다. 잠정 상태의 운영 배포 금지는 `OPS-001-03` 이 갖는다.
- **성과 지표 목표치**는 상수가 아니므로 수치를 옮겨 적지 않고 [`../../prd/PRD.md`](../../prd/PRD.md) §성과 지표를 참조한다.
- **범위 밖** — 링크 만료(TTL)·1회성 사용·발송처 서명 검증·요청 제한에 대응하는 파라미터·헤더·응답 필드를 어떤 접점에도 두지 않는다(`OPS-002-05`).
