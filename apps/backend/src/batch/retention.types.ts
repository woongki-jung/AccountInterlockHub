/**
 * 배치 실행 결과(MDL-402, BatchRunResult) — 처리상태·연동이력을 각각 집계한다(status/history 4필드 분리).
 * 별도 상태 테이블에 저장하지 않고 감사 로그(ENT-006) detail 로만 요약 기록한다(OPS-003-03).
 * 대상 건수(target)는 선정 즉시 삭제하므로 삭제 건수(deleted)와 항상 같다(target=deleted).
 *
 * `#214`(P10) fallback two-pass — 두 갈래(확인/수신 90일·생성 절대 상한 180일) 합을 각각 집계한다
 * (process_PROC-402.md B4).
 */
export interface BatchRunResult {
  /** 처리상태 삭제 대상 건수(DATA-004 확인 90일 갈래 + 절대 상한 180일 갈래 합). */
  statusTargetCount: number;
  /** 처리상태 실제 삭제 건수. */
  statusDeletedCount: number;
  /** 연동이력 삭제 대상 건수(DATA-006 수신 90일 갈래 + 절대 상한 180일 갈래 합). */
  historyTargetCount: number;
  /** 연동이력 실제 삭제 건수. */
  historyDeletedCount: number;
  /** 소요 시간(ms). */
  elapsedMs: number;
  /** 배치 실행 시각(ISO8601). */
  runAt: string;
}
