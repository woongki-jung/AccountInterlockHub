import { IV_LENGTH_BYTES, KEY_PAD_BYTE, NORMALIZED_KEY_LENGTH_BYTES } from './crypto.constants';

/** FN-001 반환값 — 정규화된 32바이트 키와 그 앞 16바이트로 도출한 초기화 벡터. */
export interface NormalizedKey {
  readonly key: Buffer;
  readonly iv: Buffer;
}

/**
 * FN-001 키 32바이트 정규화·초기화 벡터 도출(`SEC-001-02`~`04`, function_FN-001-003.md §FN-001).
 * 외부에 노출되지 않는 내부 계산 기능이다 — 어떤 길이의 입력도 예외 없이 32바이트로
 * 정규화한다. 절단(32바이트 초과)과 패딩(32바이트 미만)을 같은 함수 안에서 처리해, 두
 * 구현(연동 라이브러리·허브)이 경계값에서 갈리지 않게 한다. 정확히 32바이트인 입력은 그대로
 * 통과한다.
 *
 * @param keySource 이어 붙이기를 이미 마친 키 원문(`SEC-001-05`·`SEC-001-06`)·빈 문자열도
 *   허용한다. `encX` 의 키 원문은 "발송처키+생년월일"을 구분자 없이 이어 붙인 값이지만,
 *   허브는 발송처키를 갖지 않으므로(`EXC-SEC-04`) 이 이어 붙이기를 직접 수행하지 않는다 —
 *   `encY` 를 복호화해 얻은 값을 재정규화 없이 그대로 쓴다(`SEC-001-07`). 그래서 허브
 *   런타임에서 이 함수는 `encY` 의 키(생년월일 6자, `SEC-001-06`)를 만들 때만 호출된다.
 *
 * 반환하는 `key`·`iv` 는 서로 다른 메모리를 갖는 독립 버퍼다(`iv` 는 `key` 의 복사본이지
 * view 가 아니다) — 한쪽을 나중에 바꿔도 다른 쪽이 오염되지 않는다. 반환 객체 자체는
 * freeze 해 호출측이 `key`·`iv` 참조를 다른 값으로 바꿔치기하지 못하게 막는다. ⚠️ `key`·
 * `iv` 버퍼 자체는 freeze 하지 않는다 — Node 는 원소가 있는 TypedArray(Buffer 포함)를
 * freeze 하면 `TypeError: Cannot freeze array buffer views with elements` 를 던진다(자가
 * 점검에서 실측 확인). 바이트 내용의 불변은 "호출측이 변형하지 않는다"는 구현 규약으로
 * 지킨다.
 */
export function normalizeKey(keySource: string): NormalizedKey {
  // 1. 인코딩 변환 — SEC-001-02
  const raw = Buffer.from(keySource, 'utf8');

  // 2. 길이 정규화 — SEC-001-03. 먼저 패딩 바이트로 32바이트를 채운 뒤, 원본 바이트로
  //    앞부분을 덮어쓴다 — 32바이트 초과(절단)·미만(패딩 잔존)·정확히 32(전량 덮어써 패딩
  //    없음) 세 경우가 이 한 절차로 전부 처리된다.
  const key = Buffer.alloc(NORMALIZED_KEY_LENGTH_BYTES, KEY_PAD_BYTE);
  if (raw.length > NORMALIZED_KEY_LENGTH_BYTES) {
    raw.copy(key, 0, 0, NORMALIZED_KEY_LENGTH_BYTES);
  } else {
    raw.copy(key, 0);
  }

  // 3. 초기화 벡터 도출 — SEC-001-04(정규화된 키의 앞 16바이트, 난수 IV 없음). 복사본으로
  //    만들어 key 와 메모리를 공유하지 않게 한다.
  const iv = Buffer.from(key.subarray(0, IV_LENGTH_BYTES));

  return Object.freeze({ key, iv });
}
