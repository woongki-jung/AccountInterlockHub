import styles from './NoticeBlock.module.css';

interface NoticeBlockProps {
  /** <CONSENT_NOTICE> 상수 파싱 결과(MDL-008 notice). 빈 값이면 영역 자체를 렌더하지 않는다. */
  notice: string;
}

/**
 * 동의 안내 문구 표시 — design-system-components.md §NoticeBlock.
 * 값이 비면 제목·구분선·여백까지 포함해 렌더하지 않는다(EXC-BIZ-07).
 * 문구를 자르거나 접거나 요약하지 않는다 — 단락(빈 줄 구분)만 문단으로
 * 나누고 그 밖의 서식·링크·HTML 은 해석하지 않는다(`DATA-003-05`).
 */
export function NoticeBlock({ notice }: NoticeBlockProps) {
  const paragraphs = notice
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (paragraphs.length === 0) return null;

  return (
    <div className={styles.block}>
      {paragraphs.map((paragraph, index) => (
        // 상수 배포 시점에 고정되는 정적 목록이라 인덱스 키가 안전하다.
        // eslint-disable-next-line react/no-array-index-key
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  );
}
