import { Injectable } from '@nestjs/common';
import type { ConsentConfig, InterlockConfig } from './interlock-config.types';

/**
 * 기동 검증(PROC-901)을 통과한 연동 구성 상수의 런타임 보유소.
 * 기동 시 한 번 주입되고 이후 불변이다(OPS-001-01 — 런타임 변경 수단을 두지 않는다).
 * 후속 처리(PROC-103·PROC-105·PROC-204·PROC-302·PROC-304 등)는 이 서비스를 주입받아 값을 읽는다.
 */
@Injectable()
export class InterlockConfigService {
  constructor(
    private readonly rawConfig: InterlockConfig,
    private readonly consentConfig: ConsentConfig,
  ) {}

  get interlockEntryPath(): string {
    return this.rawConfig.interlockEntryPath;
  }

  /** 자가진단 비공개 경로. 로그·응답·클라이언트 번들 어디에도 담지 않는다(SEC-003-01·SEC-003-02). */
  get selfcheckPath(): string {
    return this.rawConfig.selfcheckPath;
  }

  get receiverDeliveryUrl(): string {
    return this.rawConfig.receiverDeliveryUrl;
  }

  get retentionMonths(): number {
    return this.rawConfig.retentionMonths;
  }

  get retentionMaxMonths(): number {
    return this.rawConfig.retentionMaxMonths;
  }

  get consentProofRetentionMonths(): number {
    return this.rawConfig.consentProofRetentionMonths;
  }

  /** 연동 완료 결과(경로 ①)에만 싣는 사용자 복귀 주소(BIZ-001-06). */
  get completionRedirectUrl(): string {
    return this.rawConfig.completionRedirectUrl;
  }

  /** MDL-008 동의 항목 구성(version·notice·items) — PROC-901 B4 산출물. */
  get consent(): ConsentConfig {
    return this.consentConfig;
  }
}
