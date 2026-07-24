/*
 * 사용자 표면(SCR-005·006) 전용 컴포넌트 배럴. 관리자 공통 컴포넌트(`components/index.ts`)와 분리한다
 * (design-system.md §사용자 표면 확장 — 관리자 렌더 불변 보장을 위해 시각 규격이 다른 변형을 별도 파일로 둠).
 */
export { UserButton } from './UserButton';
export type { UserButtonProps } from './UserButton';
export { BirthDateField } from './BirthDateField';
export type { BirthDateFieldProps } from './BirthDateField';
export { ConsentItemRow } from './ConsentItemRow';
export type { ConsentItemRowProps } from './ConsentItemRow';
export { UserBanner } from './UserBanner';
export type { UserBannerProps } from './UserBanner';
export { UserBadge } from './UserBadge';
export type { UserBadgeProps, UserBadgeVariant } from './UserBadge';
export { ResultIcon } from './ResultIcon';
export type { ResultIconProps, ResultIconVariant } from './ResultIcon';
