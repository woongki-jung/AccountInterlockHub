import { Module } from '@nestjs/common';
import { HubDecryptService } from './hub-decrypt.service';

/**
 * 허브 복호화 모듈(FN-020) — SEC-006 이중 암호화·복호화 규약의 단일 구현(HubDecryptService)을 제공한다.
 * DB·컨트롤러 의존이 없는 순수 암호 유틸 서비스라 AuditService(@Global AuditModule)만 주입받는다.
 *
 * 독립 엔드포인트가 없어(PROC-203 내부 전용, FN-020 §API 인터페이스) InterlockModule(연동 실행
 * 오케스트레이션, POST /api/interlock/approve — PROC-202 AGREE 경로 → PROC-203)이 본 모듈을 import 해
 * HubDecryptService 를 주입받아 소비한다(P5).
 */
@Module({
  providers: [HubDecryptService],
  exports: [HubDecryptService],
})
export class HubDecryptModule {}
