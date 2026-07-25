import { createHash } from 'node:crypto';
import { ConsentItemConfig } from './interlock-config.types';
import { sortConsentItemsByCode } from './interlock-config.validators';

/**
 * 동의 항목 버전 식별자 산출 — data_ENT-002.md §버전 식별자 산출 규칙의 정본 구현(PROC-901 B4 · SVC-018 F-004).
 *
 * 1. 항목을 코드 오름차순으로 정렬한다.
 * 2. 각 항목을 상수표가 정의한 속성 순서(코드·항목명·필수 여부·설명)의 객체로 재구성한다.
 * 3. 공백 없는 JSON 으로 재직렬화한다.
 * 4. 안내 문구는 원문을 쓰되 끝의 공백·개행만 제거한다(값이 없으면 빈 문자열).
 * 5. 3의 결과 + 0x1F(Unit Separator 1바이트) + 4의 결과를 UTF-8 바이트열로 이어 붙인다.
 * 6. 그 바이트열의 SHA-256 다이제스트를 소문자 16진수 64자로 표기한다.
 *
 * 항목·문구가 바뀌면 반드시 값이 바뀌어야 하므로(DATA-003-03) 결정적 해시로만 산출한다 — 수동 채번을 두지 않는다.
 */
export function computeConsentVersion(items: ConsentItemConfig[], notice: string): string {
  const sorted = sortConsentItemsByCode(items);
  const normalizedItems = sorted.map(({ code, label, required, description }) => ({
    code,
    label,
    required,
    description,
  }));
  const itemsJson = JSON.stringify(normalizedItems);
  const normalizedNotice = notice.replace(/\s+$/, '');

  const bytes = Buffer.concat([
    Buffer.from(itemsJson, 'utf8'),
    Buffer.from([0x1f]),
    Buffer.from(normalizedNotice, 'utf8'),
  ]);

  return createHash('sha256').update(bytes).digest('hex');
}
