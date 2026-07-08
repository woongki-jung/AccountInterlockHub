import { Module } from '@nestjs/common';
import { EntryContextModule } from '../entry-context/entry-context.module';
import { ConsentController } from './consent.controller';
import { ConsentService } from './consent.service';

/**
 * 이용 동의 화면 데이터 모듈 — SVC-004 / PROC-201 B1b / USR-01.
 * 진입 컨텍스트 스토어(EntryContextModule)를 진입 모듈과 공유 주입받아 요청 키값으로 구성을 특정한다.
 */
@Module({
  imports: [EntryContextModule],
  controllers: [ConsentController],
  providers: [ConsentService],
})
export class ConsentModule {}
