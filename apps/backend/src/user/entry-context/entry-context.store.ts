import { Injectable, OnModuleDestroy } from '@nestjs/common';

/**
 * 진입 컨텍스트(FN-007) — 서비스 A 진입 시 발급한 요청 키값에 회원 키·전달 파라미터를
 * 비영속으로 연결하는 인메모리 저장 값(MDL-201 경유 필드). 어떤 ENT 에도 저장하지 않는다
 * (DATA-001-01 무저장 — 지정 사용자 키값의 연동이력 저장만 EXC-DATA-07 예외).
 */
export interface EntryContext {
  configCode: string;
  memberKey: string; // 회원 고유 키 — 메모리 전용, 무저장(로그 노출 시 마스킹)
  parameters: Record<string, string>;
  consentConfirmed: boolean; // 동의 완료 표식(PROC-202 동의 처리의 전달 사전 조건)
}

interface StoredEntry {
  context: EntryContext;
  expiresAt: number; // epoch ms — 만료 판정(TTL)
  timer: NodeJS.Timeout; // 만료 자동 폐기 타이머
}

/**
 * 진입 컨텍스트 인메모리 스토어 — 단일 App Service 기준 싱글턴(스케일아웃 시 공유 캐시 전환 여지).
 *
 * - 저장 수단: Map(요청 키값 단위 격리) + 키별 setTimeout 으로 TTL 만료 시 자동 폐기(무저장 정합).
 * - TTL 기본 10분(build 확정 — FN-007/PROC-201 구현 가이드가 build 로 위임). setTtlMs 로 조정 가능(테스트).
 * - DB 영속화 금지(무저장 원칙 DATA-001-01). 회원 키는 본 스토어 밖으로 저장·기록하지 않는다.
 *
 * put/get/remove/setTtlMs 를 노출해 진입(interlock)·동의 항목 조회(consent) 도메인이 공유한다.
 */
@Injectable()
export class EntryContextStore implements OnModuleDestroy {
  private readonly store = new Map<string, StoredEntry>();
  private ttlMs = 10 * 60 * 1000; // 기본 10분(build 확정)

  /** 진입 컨텍스트 저장(요청 키값 키). 동일 키 재저장 시 기존 타이머를 정리하고 갱신한다. */
  put(requestKey: string, context: EntryContext): void {
    this.remove(requestKey); // 기존 항목·타이머 정리(중복 진입 방어)
    const expiresAt = Date.now() + this.ttlMs;
    const timer = setTimeout(() => {
      this.store.delete(requestKey);
    }, this.ttlMs);
    // 타이머가 프로세스 종료를 붙잡지 않도록 unref(테스트·정상 종료 정합).
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
    this.store.set(requestKey, { context, expiresAt, timer });
  }

  /** 진입 컨텍스트 조회. 미존재·만료면 undefined(FN-008 에서 400 EX-DATA-002 로 판정). */
  get(requestKey: string): EntryContext | undefined {
    const entry = this.store.get(requestKey);
    if (!entry) {
      return undefined;
    }
    if (Date.now() >= entry.expiresAt) {
      // 만료(타이머 발화 전 조회 포함) — 즉시 폐기 후 미존재로 응답.
      this.remove(requestKey);
      return undefined;
    }
    return entry.context;
  }

  /** 진입 컨텍스트 폐기(처리 완료·거부·만료). 타이머도 함께 정리한다. */
  remove(requestKey: string): void {
    const entry = this.store.get(requestKey);
    if (entry) {
      clearTimeout(entry.timer);
      this.store.delete(requestKey);
    }
  }

  /** TTL(ms) 조정 — 테스트에서 만료 재현용. 이후 put 부터 적용된다. */
  setTtlMs(ms: number): void {
    this.ttlMs = ms;
  }

  onModuleDestroy(): void {
    for (const entry of this.store.values()) {
      clearTimeout(entry.timer);
    }
    this.store.clear();
  }
}
