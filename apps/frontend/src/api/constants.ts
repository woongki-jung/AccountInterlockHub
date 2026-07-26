// 경로·제품 상수 — 단일 출처: CLAUDE.env.md §연동 구성 상수.
// <INTERLOCK_ENTRY_PATH> 는 "확정"(잠정 아님) 값이라 그대로 인용한다.

/** 사용자 진입 경로. 발송처가 이 경로에 encX·encY 를 붙여 사용자를 유도한다. */
export const INTERLOCK_ENTRY_PATH = '/interlock/entry';

/** 본인확인 제출 접점 — spec-functions-api-user.md §본인확인 제출. */
export const VERIFY_PATH = `${INTERLOCK_ENTRY_PATH}/verify`;

/** 동의·승인 제출 접점 — spec-functions-api-user.md §동의·승인 제출. */
export const APPROVE_PATH = `${INTERLOCK_ENTRY_PATH}/approve`;
