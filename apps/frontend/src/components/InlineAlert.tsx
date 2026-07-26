import { AlertIcon } from './icons';
import styles from './InlineAlert.module.css';

interface InlineAlertProps {
  message: string;
  id?: string;
}

/**
 * 단계를 바꾸지 않는 알림 — design-system-components.md §InlineAlert.
 * 화면 사양이 고정한 알림 영역 한 곳에만 나타나며(design-system.md
 * §상태 표현), 오류 유형에 따라 자리를 옮기지 않는다. role="status"(공손)
 * 로 알린다 — 경고음처럼 끼어드는 alert 를 쓰지 않는다.
 */
export function InlineAlert({ message, id }: InlineAlertProps) {
  return (
    <div id={id} className={styles.alert} role="status">
      <AlertIcon size={18} className={styles.icon} />
      <span>{message}</span>
    </div>
  );
}
