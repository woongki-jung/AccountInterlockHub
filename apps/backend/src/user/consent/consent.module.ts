import { Module } from '@nestjs/common';
import { ConsentController } from './consent.controller';
import { ConsentService } from './consent.service';

/**
 * 이용 동의 모듈 — SVC-004 / PROC-201(조회)·PROC-202 B2(승인 게이팅 로직 소유) / USR-01.
 *
 * `#214` 로 진입 컨텍스트 스토어(구 EntryContextModule) 의존이 사라졌다 — 조회·게이팅 모두 접근 주소
 * 고유 ID(config_code) 기반 무상태 조회로 전환됐다. ConsentService 를 export 해 InterlockModule(승인
 * 오케스트레이션, PROC-202 B3b~PROC-203)이 주입받아 FN-008 게이팅을 재사용한다.
 *
 * AuditService(@Global AuditModule)·DataSource(전역 TypeOrmModule)는 주입으로 쓴다.
 */
@Module({
  controllers: [ConsentController],
  providers: [ConsentService],
  exports: [ConsentService],
})
export class ConsentModule {}
