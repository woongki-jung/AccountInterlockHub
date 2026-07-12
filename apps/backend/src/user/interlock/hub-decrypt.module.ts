import { Module } from '@nestjs/common';
import { HubDecryptService } from './hub-decrypt.service';

/**
 * 허브 복호화 모듈(FN-020) — SEC-006 이중 암호화·복호화 규약의 단일 구현(HubDecryptService)을 제공한다.
 * DB·컨트롤러 의존이 없는 순수 암호 유틸 서비스라 AuditService(@Global AuditModule)만 주입받는다.
 *
 * 독립 엔드포인트가 없어(PROC-203 내부 전용, FN-020 §API 인터페이스) 현재는 app.module 등록만으로
 * DI 그래프에 존재한다 — 연동 실행 오케스트레이션(P5·PROC-203 AGREE 경로, 승인 처리 흐름)이 본 모듈을
 * import 해 HubDecryptService 를 주입받아 소비할 예정이다(EntryContextModule 의 다중 도메인 공유 패턴과 동일).
 */
@Module({
  providers: [HubDecryptService],
  exports: [HubDecryptService],
})
export class HubDecryptModule {}
