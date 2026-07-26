// 일시 → ISO 8601 + 오프셋 문자열 변환(model_MDL-011-015.md MDL-012·MDL-013 §속성 정의
// "datetime → ISO 8601 + 오프셋"). `Date.prototype.toISOString()` 은 항상 UTC 'Z' 오프셋 표기로
// 직렬화한다 — 'Z' 는 ISO 8601 이 정의하는 유효한 오프셋 표기(= +00:00)이므로 별도 변환 없이
// 그대로 쓴다. pg 드라이버가 TIMESTAMPTZ(OID 1184) 컬럼을 이미 JS `Date` 로 반환하므로(재정의
// 없음 — database/pg-type-parsers.ts 는 DATE·BIGINT 만 보정한다) 추가 파싱이 필요 없다.

/** `at` 이 `null` 이면 `null` 을 그대로 돌려준다 — MDL-012·MDL-013 의 "미확정이면 null" 규칙. */
export function toIsoOrNull(at: Date | null): string | null {
  return at === null ? null : at.toISOString();
}
