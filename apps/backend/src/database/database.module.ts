import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

/**
 * PostgreSQL 접근 모듈. P02(본 Phase)는 스키마·마이그레이션·저장 도메인 모델까지가 범위라
 * 아직 AppModule 에 등록하지 않는다 — 런타임 조회·갱신이 필요한 첫 Phase(PROC-301~303 등, P06)가
 * AppModule.imports 에 추가한다.
 */
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
