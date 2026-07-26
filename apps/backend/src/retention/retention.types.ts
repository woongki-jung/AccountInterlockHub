// PROC-304 보관정책 배치 — 실행 결과 요약(MDL-021, model_MDL-019-022.md)의 내부(도메인) 표현.
// 표준 출력에 실제로 나가는 JSON 형태(baseAt 이 ISO 8601 + 오프셋 문자열인 형태)는
// retention-output.ts 의 buildRetentionSummaryLine() 이 이 타입에서 변환해 만든다 — 이 타입
// 자신은 baseAt 을 Date 로 들고 있어 스케줄러(Nest Logger 로 그대로 로깅) · CLI(JSON 직렬화)
// 양쪽이 같은 값을 각자의 방식으로 소비할 수 있게 한다.

/**
 * MDL-021 보관 배치 실행 결과 요약. 4키 고정 · 순서 불변(§출력 스키마) — 이 인터페이스의 속성
 * 선언 순서가 곧 JSON 직렬화 순서와 같다(retention-output.ts 가 이 순서 그대로 객체 리터럴을 만든다).
 * 매핑 엔터티 없음(비저장) — 어디에도 기록되지 않는다(model_MDL-019-022.md §엔터티 매핑).
 */
export interface RetentionBatchSummary {
  /** 삭제 대상 산정의 기준 일시 — 실행 시점에 산정한 값(PROC-304 B2). */
  readonly baseAt: Date;
  /** 삭제한 연동 추적 레코드(ENT-001) 건수. 0 이상. */
  readonly trackingDeletedCount: number;
  /** 삭제한 동의 증적(ENT-002) 건수. 0 이상. */
  readonly consentProofDeletedCount: number;
  /** 실패 사유. 성공이면 null — 종료 코드는 성공·실패만 구분하므로 세부는 여기 담는다. */
  readonly failureReason: string | null;
}
