// FN-015 민감값 제거·기록 통제(function_FN-014-015.md §FN-015). 응답 본문·로그 레코드·예외
// 메시지 컨텍스트 등 "내보내기 직전의 값"에서 금지 항목을 속성째 제거한 사본을 만든다.

/**
 * §금지 항목 표 중 **키 이름으로 안전하게 식별 가능한 항목**만 담는다. "안전하게 식별 가능"의
 * 기준은 **허브가 그 이름의 속성을 실제로 보유하는지 여부가 아니라, 그 이름이 등장하면 예외
 * 없이 제거해도 무해한지**다 — 아래 목록은 지금 이 허브 런타임에 실제로 나타날 수 있는 이름과
 * (`selfcheckPath`) 절대 나타나지 않는 이름(`senderKey`)을 **같은 기준으로** 함께 담는다
 * (회귀 1회차 I-2 — 이전 버전은 이 둘에 서로 다른 기준을 거꾸로 적용해 `selfcheckPath` 를
 * 잘못 제외했었다).
 *
 * - `encX`·`encY` — 암호값 쌍(`DATA-001-02`·`DATA-001-04`).
 * - `birthDate` — 사용자가 입력한 생년월일(`DATA-001-02`).
 * - `senderKey` — 발송처키(`DATA-001-02`). 허브는 발송처키를 갖지 않아(`EXC-SEC-04`) 런타임에
 *   실제로 이 키가 실리는 경우는 없지만, 로그·응답 컨텍스트에 실수로 흘러들 경우를 대비한
 *   2차 방어로 유지한다.
 * - `selfcheckPath`·`SELFCHECK_PATH` — 자가진단 경로 값(`SEC-003-01`·`SEC-003-02`). **회귀
 *   1회차 I-2 시정** — 허브는 `InterlockConfig.selfcheckPath`(`interlock-config.types.ts`)·
 *   `InterlockConfigService.selfcheckPath` getter(`interlock-config.service.ts`)로 이 값을
 *   **전역 주입 상태로 실제 보유**한다 — 오류 컨텍스트·로그 객체에 `selfcheckPath` 라는 이름
 *   그대로 실릴 수 있는, 다른 금지 키와 다르지 않은 "이름으로 식별 가능한 항목"이다. 자가진단
 *   경로 비공개는 이 서비스의 유일한 완화 장치라(`OPS-002`) 이름으로 식별되는 이상 반드시
 *   막는다. env 원본 키 이름(`SELFCHECK_PATH`)도 함께 막아 `process.env` 스냅샷이 그대로
 *   실려도 걸리게 한다.
 * - `stack` — 내부 스택(`SEC-002-05` "내부 스택을 응답과 로그에 담지 않는다").
 *
 * **의도적으로 담지 않는 항목**(이름이 아니라 값의 출처로만 식별되거나, 안전한 키 이름을
 * 고정할 수 없는 항목 — 회귀 1회차에서 재확인해도 그대로 유지): 복호화 원문 X 의 개별 업무
 * 필드(발송처가 자유롭게 정의하는 열린 스키마라 안전한 키 이름을 고정할 수 없다 —
 * `trackingKey` 를 뺀 "X 의 나머지 전부"를 이름 기반으로 가려내려 하면 `MDL-012`/`MDL-013`
 * (정상 응답이 `trackingKey` 와 다른 필드를 함께 갖는 모델) 같은 무관한 값까지 오삭제할
 * 위험이 크다) · 정규화 키·초기화 벡터·복호화 중간 값(크립토 모듈 안의 지역 변수로만 존재하고
 * 어떤 객체에도 실리지 않는다 — `DATA-001-03`·`decryption-judgment.ts` 자체 문서화, 1차 방어)
 * · 연동 요청 URL 전체(그 안의 `encX`·`encY` 값 자체는 이미 이름으로 걸리므로, "URL 을
 * 통째로 로그에 남기는 습관"은 접근 로그 미들웨어를 아예 두지 않는 운영 규율로 막는다 —
 * FN-015 §구현 가이드). 이 경계는 FN-015 §구현 가이드의 "1차 방어는 담는 모델에 애초에
 * 속성을 두지 않는 것, 본 기능은 2차 방어"를 그대로 따른다.
 */
const FORBIDDEN_KEYS: ReadonlySet<string> = new Set([
  'encX',
  'encY',
  'birthDate',
  'senderKey',
  'selfcheckPath',
  'SELFCHECK_PATH',
  'stack',
]);

/**
 * FN-015 — `value` 에서 금지 항목을 속성째 제거한 **사본**을 반환한다. 원본은 바꾸지 않는다.
 * 예외를 던지지 않는다(§에러 처리 "제거 실패가 응답을 막으면 안 된다") — 해석할 수 없는
 * 구조(순환 참조 등)는 안전한 쪽으로 실패해 `undefined` 로 대체한다. 반환형이 `T | undefined`
 * 인 것은 이 안전 실패가 실제로 `undefined` 를 낳을 수 있다는 계약을 정직하게 드러낸다(회귀
 * 1회차 S-6 — 이전에는 `T` 로 단언해 이 경로를 타입으로 숨겼다).
 *
 * 부분 마스킹·길이 노출을 하지 않는다 — 앞뒤 몇 자만 남기는 마스킹은 노출된 일부가 오프라인
 * 전수대입의 탐색 공간을 좁힌다(`OPS-002-01`). 연동 추적 키(`trackingKey`)·복귀 주소
 * (`returnUrl`)는 금지 항목이 아니므로 그대로 통과한다(§금지 항목 표의 예외 — `DATA-004-01`
 * · `BIZ-001-06`) — 이 함수는 이 둘을 이름으로 지목해 보존하지 않는다. 애초에 금지 목록에
 * 없기 때문이다.
 *
 * **성능(회귀 1회차 I-4)** — 조상-경로 `Set`(순환 판정)에 **결과 메모 `Map`**(방문 완료 참조
 * 재사용)을 더했다. 메모가 없으면 다이아몬드형 공유 참조(같은 객체를 형제 두 곳 이상에서
 * 참조)를 매 경로마다 처음부터 다시 순회해 깊이에 지수적으로 느려진다(실측 재현 — 깊이 16:
 * 15ms·20:202ms·22:744ms, 깊이가 늘 때마다 약 2배). 메모를 더하면 참조당 정확히 한 번만
 * 계산해 선형 시간이 된다. 순환(자기 자신을 향하는 경로)과 다이아몬드(순환이 아닌 공유
 * 참조)는 다른 것이다 — 조상 `Set` 은 "지금 이 경로에서 내려가는 중인가"(진입 시 add, 이탈
 * 시 delete)만 보고, 메모 `Map` 은 "이 참조를 이미 끝까지 계산해 봤는가"(계산 완료 후 add,
 * 삭제하지 않음)만 본다. 이 둘을 하나의 자료구조로 합치면(예: 전역 `WeakSet` 하나로 "방문함"
 * 을 표시) 다이아몬드의 두 번째 방문이 순환으로 오판정된다 — 두 상태를 반드시 분리해야 한다.
 */
export function sanitizeValue<T>(value: T): T | undefined {
  try {
    return sanitizeInternal(value, new Set<unknown>(), new Map<unknown, unknown>()) as T | undefined;
  } catch {
    // 해석할 수 없는 구조 — 통째로 버린다(안전한 쪽으로 실패, FN-015 §에러 처리).
    return undefined;
  }
}

function sanitizeInternal(value: unknown, ancestors: Set<unknown>, memo: Map<unknown, unknown>): unknown {
  // 함수 값(예: 인스턴스의 toJSON)은 항상 버린다(회귀 1회차 S-1). res.json() 내부의
  // JSON.stringify 는 직렬화 대상에 호출 가능한 toJSON 이 있으면 **그 반환값으로 사본 전체를
  // 대체**한다 — 사본에 원본의 toJSON 함수 참조가 그대로 남아 있으면, 그 함수가 돌려주는
  // 임의의 객체(원본 금지 값을 다시 담을 수 있다)가 이 함수의 검열을 완전히 우회해 응답에
  // 실린다(실측 확인 — `{toJSON:()=>({encX:'...'})}` 를 JSON.stringify 하면 encX 가 그대로
  // 나간다). Buffer/TypedArray 를 불투명 제거한 것과 같은 사고를 함수 값에도 적용한다.
  if (typeof value === 'function') {
    return undefined;
  }
  if (value === null || typeof value !== 'object') {
    return value; // 원시값(string·number·boolean·undefined)은 그대로 통과한다.
  }

  // Buffer·TypedArray — 복호화 중간 값·키 바이트열이 여기 담길 위험이 가장 큰 형태다. 원소를
  // 순회하면 바이트가 인덱스 속성으로 그대로 드러나므로(예: {0:12,1:34,...}) 통째로 불투명하게
  // 다룬다 — "속성째 제거"와 같은 취급이다.
  if (ArrayBuffer.isView(value)) {
    return undefined;
  }

  if (ancestors.has(value)) {
    return undefined; // 진짜 순환(지금 이 경로에서 내려가는 중인 조상을 다시 만남) — 안전 실패.
  }

  if (memo.has(value)) {
    return memo.get(value); // 이미 완전히 계산된 참조 — 다이아몬드 공유분을 재순회하지 않는다.
  }

  if (value instanceof Date) {
    const cloned = new Date(value.getTime());
    memo.set(value, cloned);
    return cloned;
  }

  ancestors.add(value);
  try {
    let result: unknown;
    if (Array.isArray(value)) {
      result = value.map((item) => sanitizeInternal(item, ancestors, memo));
    } else {
      const source = value as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(source)) {
        if (FORBIDDEN_KEYS.has(key)) continue; // 부분 마스킹 없이 속성째 제거.
        const v = source[key];
        if (typeof v === 'function') continue; // toJSON 등 — 위 함수 값 처리와 같은 이유로 속성째 제거.
        out[key] = sanitizeInternal(v, ancestors, memo);
      }
      result = out;
    }
    memo.set(value, result);
    return result;
  } finally {
    ancestors.delete(value); // 형제 가지에서 같은 참조를 다시 만나도(순환이 아니라면) memo 가 처리한다.
  }
}
