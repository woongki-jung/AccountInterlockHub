import { Injectable } from '@nestjs/common';

interface WindowCounter {
  count: number;
  windowStart: number; // epoch ms — 분당 고정 윈도우 시작
}

/**
 * 진입 요청 제한 카운터(FN-014) — 출발지 IP 기준 분당 요청 수를 세는 인메모리 고정 윈도우 카운터.
 * 단일 App Service 기준 싱글턴(스케일아웃 시 공유 캐시 전환 여지 — OPS-001 구현 가이드).
 * provider 로 등록해 미들웨어가 주입받으며, 카운터 상태가 요청 간 안정적으로 유지된다.
 */
@Injectable()
export class EntryRateLimitStore {
  private readonly counters = new Map<string, WindowCounter>();
  private readonly windowMs = 60_000; // 1분 윈도우

  /**
   * 요청 1건을 카운트하고 임계치 이내면 true(통과), 초과면 false(거부)를 반환한다.
   * 윈도우(1분)가 지났으면 카운터를 리셋한다.
   */
  hit(subject: string, limitPerMin: number, now: number = Date.now()): boolean {
    const counter = this.counters.get(subject);
    if (!counter || now - counter.windowStart >= this.windowMs) {
      this.counters.set(subject, { count: 1, windowStart: now });
      return true;
    }
    counter.count += 1;
    return counter.count <= limitPerMin;
  }
}
