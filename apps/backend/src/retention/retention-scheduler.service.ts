import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RetentionService } from './retention.service';
import { buildRetentionSummaryLine } from './retention-output';

/**
 * PROC-304 C1 스케줄 발화 — "애플리케이션 안의 일 단위 스케줄 작업"(§진입점 및 진입 조건).
 * `RetentionService.run()` 을 그대로 부른다 — CLI(cli/retention.ts)와 같은 함수다(BR-015).
 *
 * **실행 시각을 Asia/Seoul 로 고정한다** — `timeZone` 을 지정하지 않으면 배포 서버 OS 의 로컬
 * 시간대에 따라 "매일 자정 직후"가 환경마다 다른 절대 시각이 되어 "일 단위 배치"의 의미가
 * 배포 환경에 따라 흔들린다(records/metric-date.ts, P06 이 이미 세운 "서버 로컬 시간대 설정과
 * 무관하게 결정적이어야 한다" 원칙을 스케줄 트리거 시각에도 그대로 적용한다). 구체 시각(00:10)은
 * 사양이 못박지 않은 값이다 — PROC-304 는 "애플리케이션 안의 일 단위 스케줄 작업"만 요구하고
 * 특정 시각을 지정하지 않는다. 자정 직후 유휴 시간대를 빌드 결정으로 골랐다(완료 보고에 기록).
 *
 * `waitForCompletion` — 이전 실행이 끝나기 전에 다음 스케줄이 겹치지 않게 한다. PROC-304 자체는
 * 겹쳐도 손상이 없다고 명시하지만(§실행 제약사항 "동시성 제어" — 기준 일시 기반 재산정이라 두
 * 실행이 겹쳐도 손상이 없다), 매일 정확히 한 번만 도는 배치에서 굳이 겹칠 이유가 없어 방어적으로
 * 켜 둔다(사양 요구 사항이 아니라 빌드 결정 — 완료 보고에 기록. 겹쳐도 안전하다는 사양의 전제를
 * 무력화하지 않는다).
 */
@Injectable()
export class RetentionSchedulerService {
  private readonly logger = new Logger('RetentionSchedulerService');

  constructor(private readonly retention: RetentionService) {}

  @Cron('0 10 0 * * *', { timeZone: 'Asia/Seoul', waitForCompletion: true })
  async handleDailyRetention(): Promise<void> {
    const summary = await this.retention.run(new Date());

    // C1 관측 계약 — "결과 요약은 표준 출력으로 나가고, 별도 실행 이력을 남기지 않는다"
    // (PROC-304 §진입점 및 진입 조건 · POL OPS-003-04). 스케줄 경로엔 종료 코드가 없어 이
    // 요약 1줄이 유일한 관측 수단이므로, 성패와 무관하게 표준 출력으로 직접 내보낸다.
    // Nest ConsoleLogger 는 `error` 레벨을 표준 오류로 고정 라우팅한다(@nestjs/common
    // console-logger.service.js printMessages — 'error' → 'stderr') — 요약을 로거 경로에만
    // 실으면 실패 시 표준 출력이 비어 CLI(§명령 진입점)와 스트림 계약이 갈린다. 그래서 로거는
    // 사람이 읽는 진단용 문구로만 병기하고(요약과 중복 출력돼도 무방 — 스트림만 갈리지 않으면
    // 된다), 요약 값 자체는 스트림을 직접 통제해 내보낸다.
    const summaryLine = buildRetentionSummaryLine(summary);
    process.stdout.write(`${summaryLine}\n`);

    if (summary.failureReason === null) {
      this.logger.log(`PROC-304 스케줄 실행 완료 — ${summaryLine}`);
    } else {
      this.logger.error(`PROC-304 스케줄 실행 실패 — ${summaryLine}`);
    }
  }
}
