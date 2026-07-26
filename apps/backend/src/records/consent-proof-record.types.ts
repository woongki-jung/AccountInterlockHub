import type { ConsentSubmission } from '../models/consent-submission.model';

/**
 * MDL-007 동의·승인 제출 — 정식 모델은 `models/consent-submission.model.ts`(P09, #486,
 * PROC-103 구현)가 갖는다. 이 이름(`ConsentSubmissionInput`)은 FN-012 호출부(P06 산출물)가
 * 이미 참조하고 있어 별칭으로 유지한다 — 정의를 두 곳에 두지 않는다.
 */
export type ConsentSubmissionInput = ConsentSubmission;
