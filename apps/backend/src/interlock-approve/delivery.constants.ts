// BIZ-004-02 수신처 전달 즉시 재시도 확정값(policy_BIZ.md §BIZ-004 수신처 전달·재시도) —
// 배포 환경마다 달라지지 않는 정책 고정 수치다. CLAUDE.env.md §연동 구성 상수의 "(잠정)" 표기
// 대상이 아니다(그 표에 이 값들이 없다 — 잠정값은 <RECEIVER_DELIVERY_URL> 등 다섯 항목뿐이고,
// 이 재시도 수치는 정책이 이미 확정한 값이다). crypto/crypto.constants.ts(SEC-001 §규약
// 확정값)와 같은 근거로 여기 상수로 둔다 — 설정 주입 대상이 아니라 정책이 못박은 확정값이다.

/** 총 시도 횟수(최초 1회 + 재시도 2회) — BIZ-004-02. */
export const DELIVERY_TOTAL_ATTEMPTS = 3;

/**
 * 재시도 대기 간격(밀리초) — BIZ-004-02 "재시도 간격 1초·2초". 인덱스 0 = 1차 시도 실패 후
 * 대기(1초), 인덱스 1 = 2차 시도 실패 후 대기(2초). 길이는 `DELIVERY_TOTAL_ATTEMPTS - 1` 과
 * 같다 — 마지막 시도 실패 후에는 대기하지 않는다(재시도가 없으므로).
 */
export const DELIVERY_RETRY_INTERVALS_MS: readonly number[] = [1000, 2000];

/** 회당 응답 대기 상한(밀리초) — BIZ-004-02 "회당 응답 대기 상한 5초". */
export const DELIVERY_PER_ATTEMPT_TIMEOUT_MS = 5000;

/**
 * 총 소요 상한(밀리초) — BIZ-004-02 "총 소요는 20초를 넘지 않는다". 코드가 강제하지는 않는다
 * (3 × 5초 + 1초 + 2초 = 18초로 구성 자체가 이미 상한 안에 들어온다 — PROC-104 §구현 가이드
 * "회당 대기 상한 × 시도 횟수 + 간격 합이 총 상한을 넘지 않게 구성한다"). 문서화 목적으로만 둔다.
 */
export const DELIVERY_TOTAL_BUDGET_MS = 20000;
