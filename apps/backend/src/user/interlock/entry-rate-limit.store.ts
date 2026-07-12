import { Injectable, OnModuleDestroy } from '@nestjs/common';

interface WindowCounter {
  count: number;
  windowStart: number; // epoch ms — 분당 고정 윈도우 시작
}

/**
 * 진입 요청 제한 카운터(FN-014) — 출발지 IP 기준 분당 요청 수를 세는 인메모리 고정 윈도우 카운터.
 * 단일 App Service 기준 싱글턴(스케일아웃 시 공유 캐시 전환 여지 — OPS-001 구현 가이드).
 * provider 로 등록해 미들웨어가 주입받으며, 카운터 상태가 요청 간 안정적으로 유지된다.
 *
 * 만료 회수: GET /api/consent/:accessAddressId·POST /api/interlock/approve 는 Public 인터넷 대면이라
 * 출발지 IP(스코프별 `consent:${ip}`·`approve:${ip}`, `#214` P5 로 재배치)가 무한 유입될 수 있다. hit()
 * 만으로는 재방문 없는 IP 의 만료 엔트리가 영구 잔존(누수)하므로, 윈도우 주기마다 setInterval 로 만료
 * 엔트리를 상시 회수해 Map 크기를 유계로 만든다(unref + OnModuleDestroy 정리 규율). 타이머는 프로세스
 * 종료를 붙잡지 않도록 unref 한다.
 */
@Injectable()
export class EntryRateLimitStore implements OnModuleDestroy {
  private readonly counters = new Map<string, WindowCounter>();
  private readonly windowMs = 60_000; // 1분 윈도우
  private readonly sweepTimer: NodeJS.Timeout;

  constructor() {
    // 윈도우 주기마다 만료 엔트리 회수(누수 방지). unref 로 정상 종료·테스트 정합 유지.
    this.sweepTimer = setInterval(() => this.sweepExpired(Date.now()), this.windowMs);
    if (typeof this.sweepTimer.unref === 'function') {
      this.sweepTimer.unref();
    }
  }

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

  /**
   * 만료 윈도우(now - windowStart >= windowMs) 엔트리를 회수한다. 만료 엔트리는 다음 hit() 이
   * 어차피 리셋할 대상이므로 삭제해도 요청제한 판정에 영향이 없다(재방문 시 새 윈도우로 통과).
   */
  private sweepExpired(now: number): void {
    for (const [subject, counter] of this.counters) {
      if (now - counter.windowStart >= this.windowMs) {
        this.counters.delete(subject);
      }
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.sweepTimer);
    this.counters.clear();
  }
}
