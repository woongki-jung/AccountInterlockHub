# scripts-ai-pm-runtime-hardening (2026-07-03)

> 개정한 운영 문서의 변경 경위. 본문 정본은 해당 문서.

- **무엇**:
	- [`ai-pm-session.ps1`](../../../ai/scripts/ai-pm-session.ps1) — ① Slack 런타임(app.js) **워치독** 신설(별도 백그라운드 프로세스, 5초 간격 생존 확인·재기동, 연속 크래시 지수 백오프 최대 60초, `.stop` 감지 자가 종료, 래퍼 종료 시 정리) ② 프로세스 판별을 app.js **절대 경로 기준**으로(동일 PC 복제 워크스페이스 오탐 제거) ③ `runtime.log` append 보존(cmd `>>` 리다이렉션) + 10MB 회전(`.1`) ④ 비대화식 환경에서 `Read-Host` 생략 ⑤ 기동 직후 생존 확인 경고.
	- [`app.js`](../../../ai/bots/ai-pm/_slack/app.js) — ① 봇 멘션 포함 채널 메시지를 `message` 핸들러에서 스킵(`app_mention` 과의 이중 로깅 → 중복 디스패치 위험 제거) ② `auth.test` 실패 시 `process.exit(1)` 로 조기 종료(워치독 재기동 계약).
	- [`.env.example`](../../../ai/bots/ai-pm/_slack/.env.example) — 래퍼가 읽는 선택 키(`REDMINE_BASE_URL`·`REDMINE_API_KEY`) 주석 안내 추가.
	- [`ai-pm.md`](../../../ai/strategies/ai-pm.md) §기동 절차·§런타임 구성 요소 — 워치독 감시·로그 회전 서술 반영.
- **왜**: 표준 템플릿 관점 전수 분석(2026-07-03) — app.js 사망 미감시(주석 계약과 래퍼 동작 불일치)·멘션 이중 로깅·로그 truncate·프로세스 오탐 해소.
- **검증**: `node --check` 통과, PowerShell 파서 오류 0.
- **영향**: 전략 개정과 한 묶음 — [`strategies-template-gap-remediation.md`](strategies-template-gap-remediation.md).
- **관련 일감**: 없음(담당자 직접 요청 세션).
