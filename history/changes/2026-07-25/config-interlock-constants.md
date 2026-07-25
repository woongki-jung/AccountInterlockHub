# config-interlock-constants (2026-07-25)

> 개정한 운영 문서의 변경 경위. 본문 정본은 해당 문서.

- **무엇**: [`CLAUDE.env.md`](../../../CLAUDE.env.md) 에 **§연동 구성 상수**·**§연동 라이브러리 식별자** 두 절을 신설했다.
	- §연동 구성 상수 — `<INTERLOCK_ENTRY_PATH>`·`<HUB_BASE_URL_PROD>`·`<HUB_BASE_URL_DEV>`·`<RECEIVER_DELIVERY_URL>`·`<CONSENT_ITEMS>`·`<CONSENT_NOTICE>`·`<RETENTION_MONTHS>`. `<RETENTION_MONTHS>` 외 값은 담당자 확정 대기라 `TBD`.
	- §연동 라이브러리 식별자 — `<LIB_SRC_DIR>`·`<LIB_BIN>`. 구현 기술스택 확정 후 채운다.
	- 발송처키는 비밀 값이라 본 파일 대상에서 제외하고 그 위치를 담당자 확정 항목으로 남겼다.
- **왜**: 담당자가 전체 프로젝트 리셋을 지시하며 **"관리자에서 구성되어야 하는 요구사항은 워크스페이스 내 상수로 재정의(`CLAUDE.env.md`)"** 를 4대 요구의 하나로 확정했다(`accountinterlockhub#467` 본문·journal 3109). 관리자 화면·구성 저장소를 두지 않는 대신, 연동 구성의 단일 출처를 본 파일로 옮겨 배포 시점에 주입한다.
- **영향**: 같은 리셋 방향으로 제품 산출물 [`docs/prd/PRD.md`](../../../docs/prd/PRD.md)·[`docs/prd/ia/IA.md`](../../../docs/prd/ia/IA.md)·[`docs/prd/devspec/external-apis.md`](../../../docs/prd/devspec/external-apis.md)·[`database.md`](../../../docs/prd/devspec/database.md)·[`infra.md`](../../../docs/prd/devspec/infra.md) 이 함께 개정됐다(제품 산출물 이력은 [`ia-history.md`](../../../ai/strategies/ia-history.md) 소관 — `history/common.md`). PRD §시스템 제약사항·devspec `infra.md` §연동 구성 상수 주입·`database.md` §데이터 원칙이 본 절을 단일 출처로 참조한다.
- **관련 일감**: `accountinterlockhub#468`(directing 산출) · `accountinterlockhub#467`(작업세션).

## 후속 개정 (같은 날 · 담당자 확정 반영)

- **무엇**: 담당자 확정 회신(`#467` journal 3143·3151)에 따라 두 절의 값·구성을 확정했다.
	- §연동 구성 상수 — `<INTERLOCK_ENTRY_PATH>` 를 `/interlock/entry` 로 확정(1:1 고정이라 발송처 식별 구간 없음), `<SELFCHECK_PATH>`(자가진단 API 비공개 경로)·`<CONSENT_PROOF_RETENTION_MONTHS>`(동의 증적 보존, 잠정 60개월) 신설, `<RETENTION_MAX_MONTHS>` 확정, `<CONSENT_ITEMS>`·`<CONSENT_NOTICE>` 를 표에서 분리해 **§동의 항목 값** 절로 옮기고 JSON 주입 형식·항목 1건(`THIRD_PARTY_PROVISION`)·잠정 안내 문구를 확정했다.
	- §연동 라이브러리 식별자 — 라이브러리가 C# 단독으로 확정돼 `<LIB_SRC_DIR>`·`<LIB_BIN>` 의 `TBD` 를 실값으로 채우고 `<LIB_TARGET_FRAMEWORK>`(.NET Framework 4.8)를 추가했다.
	- 각주 — 발송처키 위치의 "담당자 대기" 표기를 제거하고 상수화 대상 제외를 확정 서술로 바꿨다. 서버 대면 API 에 인증을 두지 않기로 확정돼 인증 자격 값 서술도 함께 정리했다.
- **왜**: 담당자가 잔여 결정(동의 항목·안내 문구·기본안 11건·추적 키 정책)을 회신해 `TBD` 로 남길 이유가 사라졌다. 값이 확정되지 않은 셋(`<SELFCHECK_PATH>`·`<RECEIVER_DELIVERY_URL>`·허브 기준 URL)은 확정 시점을 표에 명시해 남겼다.
- **영향**: 제품 산출물 [`docs/prd/PRD.md`](../../../docs/prd/PRD.md)·[`ia/IA.md`](../../../docs/prd/ia/IA.md)·`devspec/` 3종이 같은 회신으로 함께 개정됐다(제품 이력은 [`history/common.md`](../../common.md)). 용어사전 [`wiki/WIKI.md`](../../../wiki/WIKI.md) 를 신설해 문서들이 참조한다.

## 2회차 평가 반영 (같은 날)

- **무엇**: `prd-reviewer` 2회차 지적에 따라 [`CLAUDE.env.md`](../../../CLAUDE.env.md) 를 세 곳 더 고쳤다.
	- `<LIB_SRC_DIR>` 를 `libs/AccountInterlockHub.SenderSdk/` → **`apps/sender-sdk/`** 로 정정. 저장소 구조 정본([`doc-structure.md`](../../../ai/strategies/doc-structure.md))이 "모든 코드는 `apps/` 하위"라고 규정하므로 루트에 `libs/` 를 새로 만드는 값은 구조 정본과 충돌했다(build 착수 근거가 두 갈래가 됨).
	- `<CONSENT_NOTICE>` 에 **확정 시점**(배포 전 · 개인정보 고지 항목 검토)을 부여하고, §동의 항목 값에 **허용 형태**(최대 400자·3단락·평문)를 규정했다. 화면 사양이 레이아웃을 정하려면 값의 상한이 필요하다.
	- `<WORK_ROOT>` 가 이전 프로젝트의 macOS 경로(`/Volumes/D/Work/ai-workgroup`)로 남아 있어 이 PC 실제 경로(`D:/Work/AccountInterlockHub`)로 갱신했다. `<QA_TOOLS_HOME>`·QA 스크립트 루트가 이 값을 조합해 쓰므로 방치하면 잘못된 경로를 만든다(부트스트랩 잔재 — [`project-bootstrap.md`](../../../ai/strategies/project-bootstrap.md) §2 CLAUDE.env.md 갱신).
- **왜**: 2회차 평가가 `<LIB_SRC_DIR>` 충돌을 directing 완료를 막는 차단 사유로 판정했고, 나머지 둘은 값의 사용처가 불완전해 spec·qa 가 소비할 수 없는 상태였다.
- **영향**: `docs/prd/devspec/infra.md` §연동 라이브러리 배포는 소스 위치를 본 파일 참조로 두므로 문구 변경이 없다.
