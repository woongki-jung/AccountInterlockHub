/**
 * PostgreSQL SQLSTATE 23505(unique_violation) 판정. 지정한 제약명과 일치할 때만 true 를 반환한다
 * — 테이블에 다른 유일 제약이 늘어나도 "기본 키 충돌"과 혼동하지 않도록 판정을 명시적으로
 * 좁혀 둔다(data_ENT-001.md §구현 가이드 "기본 키 충돌을 정상 경로로 다룬다"의 대상은 정확히
 * `pk_interlock_tracking` 하나뿐이다).
 */
export function isUniqueViolation(error: unknown, constraintName: string): boolean {
  const pgError = error as { code?: string; constraint?: string } | null | undefined;
  return pgError?.code === '23505' && pgError.constraint === constraintName;
}
