// FN-015 민감값 제거·기록 통제(function_FN-014-015.md §FN-015). 응답 본문·로그 레코드·예외
// 메시지 컨텍스트 등 "내보내기 직전의 값"에서 금지 항목을 속성째 제거한 사본을 만든다.

/**
 * §금지 항목 표 중 **키 이름으로 안전하게 식별 가능한 항목**만 담는다.
 *
 * - `encX`·`encY` — 암호값 쌍(`DATA-001-02`·`DATA-001-04`).
 * - `birthDate` — 사용자가 입력한 생년월일(`DATA-001-02`).
 * - `senderKey` — 발송처키(`DATA-001-02`). 허브는 발송처키를 갖지 않아(`EXC-SEC-04`) 런타임에
 *   실제로 이 키가 실리는 경우는 없지만, 로그·응답 컨텍스트에 실수로 흘러들 경우를 대비한
 *   2차 방어로 유지한다.
 * - `stack` — 내부 스택(`SEC-002-05` "내부 스택을 응답과 로그에 담지 않는다").
 *
 * **의도적으로 담지 않는 항목**: 복호화 원문 X 의 개별 업무 필드(발송처가 자유롭게 정의하는
 * 열린 스키마라 안전한 키 이름을 고정할 수 없다 — `trackingKey` 를 뺀 "X 의 나머지 전부"를
 * 이름 기반으로 가려내려 하면 `MDL-012`/`MDL-013`(정상 응답이 `trackingKey` 와 다른 필드를
 * 함께 갖는 모델) 같은 무관한 값까지 오삭제할 위험이 크다) · 정규화 키·초기화 벡터·복호화
 * 중간 값(크립토 모듈 안의 지역 변수로만 존재하고 어떤 객체에도 실리지 않는다 — `DATA-001-03`
 * ·`decryption-judgment.ts` 자체 문서화, 1차 방어) · 자가진단 경로 값·연동 요청 URL 전체
 * (특정 키가 아니라 "값의 출처"로 식별되는 항목이라 `value: any` 하나만 받는 이 함수의
 * 시그니처로는 판별할 수 없다 — SEC-003-01·SEC-003-02·FN-015 구현 가이드가 요구하는 대로
 * "애초에 그런 객체를 만들지 않는" 1차 방어로 다룬다). 이 경계는 FN-015 §구현 가이드의
 * "1차 방어는 담는 모델에 애초에 속성을 두지 않는 것, 본 기능은 2차 방어"를 그대로 따른다.
 */
const FORBIDDEN_KEYS: ReadonlySet<string> = new Set(['encX', 'encY', 'birthDate', 'senderKey', 'stack']);

/**
 * FN-015 — `value` 에서 금지 항목을 속성째 제거한 **사본**을 반환한다. 원본은 바꾸지 않는다.
 * 예외를 던지지 않는다(§에러 처리 "제거 실패가 응답을 막으면 안 된다") — 해석할 수 없는
 * 구조(순환 참조 등)는 안전한 쪽으로 실패해 `undefined` 로 대체한다.
 *
 * 부분 마스킹·길이 노출을 하지 않는다 — 앞뒤 몇 자만 남기는 마스킹은 노출된 일부가 오프라인
 * 전수대입의 탐색 공간을 좁힌다(`OPS-002-01`). 연동 추적 키(`trackingKey`)·복귀 주소
 * (`returnUrl`)는 금지 항목이 아니므로 그대로 통과한다(§금지 항목 표의 예외 — `DATA-004-01`
 * · `BIZ-001-06`) — 이 함수는 이 둘을 이름으로 지목해 보존하지 않는다. 애초에 금지 목록에
 * 없기 때문이다.
 */
export function sanitizeValue<T>(value: T): T {
  try {
    return sanitizeInternal(value, new Set<unknown>()) as T;
  } catch {
    // 해석할 수 없는 구조 — 통째로 버린다(안전한 쪽으로 실패, FN-015 §에러 처리).
    return undefined as unknown as T;
  }
}

function sanitizeInternal(value: unknown, ancestors: Set<unknown>): unknown {
  if (value === null || typeof value !== 'object') {
    return value; // 원시값(string·number·boolean·undefined)·함수는 그대로 통과한다.
  }

  // Buffer·TypedArray — 복호화 중간 값·키 바이트열이 여기 담길 위험이 가장 큰 형태다. 원소를
  // 순회하면 바이트가 인덱스 속성으로 그대로 드러나므로(예: {0:12,1:34,...}) 통째로 불투명하게
  // 다룬다 — "속성째 제거"와 같은 취급이다.
  if (ArrayBuffer.isView(value)) {
    return undefined;
  }

  if (ancestors.has(value)) {
    return undefined; // 순환 참조 — 무한 재귀 대신 안전한 쪽으로 실패.
  }

  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item) => sanitizeInternal(item, ancestors));
    }

    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source)) {
      if (FORBIDDEN_KEYS.has(key)) continue; // 부분 마스킹 없이 속성째 제거.
      result[key] = sanitizeInternal(source[key], ancestors);
    }
    return result;
  } finally {
    ancestors.delete(value); // 형제 가지에서 같은 참조를 다시 만나도(순환이 아니라면) 정상 처리되도록 되돌린다.
  }
}
