import { Module } from '@nestjs/common';
import { EntryContextModule } from '../entry-context/entry-context.module';
import { DeliveryService } from '../delivery/delivery.service';
import { ProcessStatusService } from '../status/process-status.service';
import { ConsentController } from './consent.controller';
import { ConsentService } from './consent.service';

/**
 * 이용 동의 모듈 — SVC-004/SVC-005 / PROC-201 B1b·PROC-202·PROC-203·PROC-401 / USR-01·USR-02·BAT-01.
 *
 * 진입 컨텍스트 스토어(EntryContextModule)를 진입 모듈과 공유 주입받아 요청 키값으로 구성을 특정한다.
 * 동의(AGREE) 경로의 서비스 B 전달(DeliveryService)·처리상태 저장(ProcessStatusService)을 계층 분리해 함께 등록한다.
 * AuditService(@Global AuditModule)·DataSource(전역 TypeOrmModule)는 주입으로 쓴다.
 */
@Module({
  imports: [EntryContextModule],
  controllers: [ConsentController],
  providers: [ConsentService, DeliveryService, ProcessStatusService],
})
export class ConsentModule {}
