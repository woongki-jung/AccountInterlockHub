// PROC-204 B6 응답 본문 — MDL-015(model_MDL-011-015.md §MDL-015). 부적합 판정도 HTTP 200 이다
// (판정이 정상 수행된 결과이지 요청 오류가 아니다) — 이 모델 하나로 적합·부적합 두 경우를 모두
// 표현한다(실패 판정을 나타내는 별도 필드가 없다 — reasonCode 가 null 이면 적합, 값이 있으면
// 그 EX 코드가 부적합 사유다). 복호화 원문·키·중간 값·판정 단계 번호를 담을 속성이 애초에 없다
// (SEC-003-03·SEC-002-05·DATA-001-04 §1차 방어).
export interface SelfcheckResponseBody {
  /** 규약 적합 판정 결과(BR-013). */
  readonly isConform: boolean;
  /**
   * 부적합 사유 — 정책 예외 코드 카탈로그의 값을 그대로 쓴다(연동 라이브러리 오류 사유 코드와
   * 같은 값 체계, SVC-013 F-007). 적합이면 `null`. 새 코드·별칭을 만들지 않는다.
   */
  readonly reasonCode: string | null;
  /** 허브가 구현한 규약 버전 `<MAJOR>.<MINOR>`(SEC-001-11) — 발송처가 라이브러리 공개 상수와 대조한다(BR-017). */
  readonly protocolVersion: string;
}
