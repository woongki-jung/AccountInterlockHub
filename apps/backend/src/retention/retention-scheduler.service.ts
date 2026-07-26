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

    // 표준 출력 관측 계약(마지막 줄 요약 JSON 1줄)은 CLI(§명령 진입점)가 관측 지점으로 삼는
    // 대상이다(PRD §프로그램 구성 "인앱 스케줄 작업이라 명령 실행·종료 코드로 관측할 수 없다" —
    // 그래서 수동 실행 진입점을 별도로 둔 것이 이 기능의 요구사항 자체다). 스케줄 경로는 같은
    // 요약 형상을 값으로 계산할 뿐(DATA-002-04), 그 값을 stdout 계약으로 내보낼 필요가 없다 —
    // 여기서는 운영 가시성을 위해 Nest Logger 로만 남긴다.
    if (summary.failureReason === null) {
      this.logger.log(`PROC-304 스케줄 실행 완료 — ${buildRetentionSummaryLine(summary)}`);
    } else {
      this.logger.error(`PROC-304 스케줄 실행 실패 — ${buildRetentionSummaryLine(summary)}`);
    }
  }
}
