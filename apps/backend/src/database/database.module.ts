import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

/**
 * PostgreSQL 접근 모듈. P02(당초 작성 Phase)는 스키마·마이그레이션·저장 도메인 모델까지가
 * 범위라 이 모듈을 AppModule 에 등록하지 않았었다 — 런타임 조회·갱신이 필요한 첫 Phase
 * (PROC-301~303, P04·P06)가 AppModule.imports 에 추가하는 설계였다.
 * **실제로는 P04(accountinterlockhub#481, FN-007~013 구현)가 실 DB 동시성 재현 검증을 위해
 * 이 모듈을 선점 등록했다(app.module.ts 실측 확인 — P06 이 새로 배선할 필요가 없었다).**
 */
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
