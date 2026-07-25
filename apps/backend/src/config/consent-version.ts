import { createHash } from 'node:crypto';
import { ConsentItemConfig } from './interlock-config.types';
import { sortConsentItemsByCode } from './interlock-config.validators';

/**
 * `\r\n`·`\r` 을 `\n`(LF) 하나로 바꾼다(data_ENT-002.md §버전 식별자 산출 규칙 2).
 * 해시 입력 계산용 사본에만 적용한다 — 호출측이 보유하는 원문 값 자체는 이 함수가 바꾸지 않는다.
 */
function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n|\r/g, '\n');
}

/**
 * 동의 항목 버전 식별자 산출 — data_ENT-002.md §버전 식별자 산출 규칙(8단계)의 정본 구현(PROC-901 B4 · SVC-018 F-004).
 * 규칙 1(파싱)은 호출측(interlock-config.loader.ts)이 먼저 수행해 이 함수에 결과를 넘긴다.
 *
 * 2. 개행 코드를 정규화한다 — 파싱 결과의 모든 문자열 속성 값과 안내 문구 원문 양쪽에서 `\r\n`·`\r` 을 `\n` 하나로 바꾼다.
 * 3. 항목을 코드 오름차순으로 정렬한다.
 * 4. 각 항목을 상수표가 정의한 속성 순서(코드·항목명·필수 여부·설명)의 객체로 재구성한다.
 * 5. 공백 없는 JSON 으로 재직렬화한다.
 * 6. 안내 문구는 2에서 정규화한 값을 쓰되 끝의 공백·개행만 제거한다(값이 없으면 빈 문자열).
 * 7. 5의 결과 + 0x1F(Unit Separator 1바이트) + 6의 결과를 UTF-8 바이트열로 이어 붙인다.
 * 8. 그 바이트열의 SHA-256 다이제스트를 소문자 16진수 64자로 표기한다.
 *
 * 정규화(2)는 **해시 입력에만** 적용한다 — `consent_snapshot` 은 화면이 노출한 원문을 그대로 보존해야 하므로
 * (§스냅샷 구조 · DATA-003-05) 이 함수는 인자로 받은 items·notice 원본을 변경하지 않고 내부 계산용 사본만 정규화한다.
 * 항목·문구가 바뀌면 반드시 값이 바뀌어야 하므로(DATA-003-03) 결정적 해시로만 산출한다 — 수동 채번을 두지 않는다.
 */
export function computeConsentVersion(items: ConsentItemConfig[], notice: string): string {
  const normalizedItems: ConsentItemConfig[] = items.map(({ code, label, required, description }) => ({
    code: normalizeLineEndings(code),
    label: normalizeLineEndings(label),
    required,
    description: normalizeLineEndings(description),
  }));
  const sorted = sortConsentItemsByCode(normalizedItems);
  const itemsForHash = sorted.map(({ code, label, required, description }) => ({
    code,
    label,
    required,
    description,
  }));
  const itemsJson = JSON.stringify(itemsForHash);
  const normalizedNotice = normalizeLineEndings(notice).replace(/\s+$/, '');

  const bytes = Buffer.concat([
    Buffer.from(itemsJson, 'utf8'),
    Buffer.from([0x1f]),
    Buffer.from(normalizedNotice, 'utf8'),
  ]);

  return createHash('sha256').update(bytes).digest('hex');
}
