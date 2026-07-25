# IA: LIB-02 — 요청 URL 생성

> 본 IA 노드와 연관된 작업의 시계열 이력(최신순). 정책: ai/strategies/ia-history.md

| 일시 (KST) | 단계 | 산출물·결과 | 관련 일감 | 상태 |
|---|---|---|---|---|
| 2026-07-25 13:35 | spec ⓒ | (공통 반영) 데이터 도메인 신규 작성 — `docs/specs/datas/` **엔터티 3건**(ENT-001~003 = 저장 대상 셋)·**데이터 모델 22종**(MDL-001~022 확정 — 예약 대비 통합·추가·재배치 0)·인덱스 5·물리 FK 0·소프트 삭제 미도입 — common.md | `accountinterlockhub#472`·`#469` | ℹ️ |
| 2026-07-25 13:05 | spec | `service_SVC-007.md` 신규 — **SVC-007 연동 요청 URL 생성**(매핑 PROC-402). Happy Path 5단계(호출 준비→경로 결합→파라미터 결합→길이 판정→결과 반환), 입력 MDL-017+MDL-004 → 출력 MDL-018. BR-023 = URL 길이 상한 판정(초과 시 URL 미반환), BR-020 인용. 예외 `EX-SEC-004`. **허브 기준 URL 은 호출 인자**(라이브러리 미내장·환경별 상이)이며 진입 경로는 상수 `<INTERLOCK_ENTRY_PATH>` 참조. Base64URL 값에 퍼센트 인코딩을 겹치지 않는다(이중 인코딩이 진입 디코드 실패의 대표 원인). 파라미터 이름은 허브 진입 파싱과 동일 값 — 기능·API 도메인 확정 | `accountinterlockhub#471`·`#469` | 🚧 |
| 2026-07-25 13:05 | spec ⓒ | (공통 반영) 서비스 도메인 신규 작성 — `docs/specs/services/` **서비스 18건**(SVC-001~018)·사용자 역할 4종·분기 `BR-001`~`BR-024`·MDL 22종/SCR 4종 예약 채번·`PROC-403`·`PROC-404` 추가 채번 — common.md | `accountinterlockhub#471`·`#469` | ℹ️ |
| 2026-07-25 12:28 | spec ⓒ | (공통 반영) 정책 도메인 신규 작성 — `docs/specs/policies/` 정책 17건·규칙 86건·EX 코드 12종(암호화 연동 규약·복호화 판정 4단계·결과 구분 4종·추적 레코드 생성 시점·보관·무저장·동의 증적·인증 부재·수용 리스크) — common.md | `accountinterlockhub#470`·`#469` | ℹ️ |
| 2026-07-25 11:25 | directing ⓒ | (공통 반영) 값 확정 대기 잠정값 설정 — 라이브러리 호출 입력값인 허브 기준 URL 2종에 잠정값 적용(`<HUB_BASE_URL_PROD>` = App Service 기본 도메인 형태 · `<HUB_BASE_URL_DEV>` = `http://localhost:3000`) — common.md | `accountinterlockhub#468`·`#467` | ℹ️ |
| 2026-07-25 10:05 | directing ⓒ | (공통 반영) 리셋 방향 담당자 확정분 반영 — 연동 요청 URL 생성 기능 **신설**. 허브 기준 URL 은 호출 입력값(발송처 소유) — common.md | `accountinterlockhub#468`·`#467` | ℹ️ |
