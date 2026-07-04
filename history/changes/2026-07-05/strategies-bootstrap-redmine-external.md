# strategies-bootstrap-redmine-external (2026-07-05)

> 개정한 운영 문서의 변경 경위. 본문 정본은 해당 문서.

- **무엇**:
	- [`ai/strategies/project-bootstrap.md`](../../../ai/strategies/project-bootstrap.md) — ① §3 을 "Redmine 구성"(인스턴스 구축·트래커 구성 포함)에서 **"Redmine 연결"** 로 개편: 프로젝트 밖에서 운영 중인 공용 서비스에 접속해 사용하는 모델로 전환(A 접속 정보 확보 → B MCP 서버 등록 → C 프로젝트 생성). 인스턴스 구축(Docker 스택)·트래커 구성 절차 삭제 — 서비스 관리자 소관으로 준비 범위에서 제외. §1 의 Docker Desktop 항목 삭제, §전제에 공용 Redmine 서비스 추가, 절차 요약·준비 체크리스트 양식·§5 문제 해결·§다른 PC 재구성의 관련 표기 갱신. ② §2 "CLAUDE.env.md 전면 갱신"을 **"기본 골격 갱신"** 으로 재정의 — 부트스트랩은 기본 값(`<PROJECT>`·`<WORK_ROOT>` 등)만 채우고, 구체 프로그램 구성 변수(설치 경로·실행 파일·소스 프로젝트명 등)는 프로젝트 초기 설정 과정의 directing 수행 주체가 채워 나간다.
	- [`ai/strategies/stages/directing.md`](../../../ai/strategies/stages/directing.md) — §산출물에 "환경 값 갱신" 신설: 프로그램 구성표·개발사양으로 확정된 구체 구성 값을 directing 수행 주체가 `CLAUDE.env.md` 변수로 추가·갱신.
	- [`ai/strategies/work-tracking.md`](../../../ai/strategies/work-tracking.md)·[`work-tracking-redmine.md`](../../../ai/strategies/work-tracking-redmine.md) — "로컬 Redmine" 표기를 공용 서비스 전제로 갱신, §트래커 구성을 서비스 관리자 1회 작업(준비 범위 밖)으로 명시.
	- [`CLAUDE.md`](../../../CLAUDE.md) — work-tracking 요약·환경변수 키 목록의 "로컬 Redmine" 표기 갱신.
	- [`CLAUDE.env.md`](../../../CLAUDE.env.md) — 서두 주의문을 "기본 골격 + 초기 설정 시 변수 추가" 모델로 교체.
- **왜**: 매 프로젝트마다 Redmine 서버를 새로 구성하는 부담을 제거 — 이미 운영 중인 Redmine 서비스에 접속해 쓰는 형태로 충분하다는 담당자 결정. 또한 CLAUDE.env.md 의 구체 프로그램 구성은 부트스트랩 시점에 알 수 없으므로(프로그램 구성표가 directing 산출), 초기 설정 과정에서 채워 나가는 책임을 directing 에 명시해 플레이스홀더 단일 출처 규칙과 실제 확정 시점을 일치시킴.
- **영향**: 준비 체크리스트에서 인스턴스 구축 항목이 접속 정보 확보로 대체되고 §1 에서 Docker 가 빠짐(로컬 Docker 는 더 이상 준비 요건 아님). `<REDMINE_HOME>` 플레이스홀더 참조가 본문에서 제거됨. 운영 문서가 참조하는 미정의 프로그램 구성 플레이스홀더(`<APP_BIN>`·`<SLN_DIR>` 등)는 directing 의 환경 값 갱신 산출로 정의되는 것이 정상 상태가 됨.
- **관련 일감**: 없음 (Redmine 프로젝트 미생성 상태).
