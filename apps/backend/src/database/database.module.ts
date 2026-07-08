import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

// 애플리케이션 런타임 DB 연결. 접속 값은 환경변수(.env, git 비관리)에서 읽는다.
// synchronize/migrationsRun 은 false — 스키마 반영은 마이그레이션 스크립트로만 수행한다(무결성 정확 재현).
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DB_HOST', 'localhost'),
        port: Number(config.get('DB_PORT', 5432)),
        database: config.get<string>('DB_NAME', 'accountinterlockhub'),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD'),
        synchronize: false,
        migrationsRun: false,
        autoLoadEntities: true,
        logging: ['error', 'warn'],
      }),
    }),
  ],
})
export class DatabaseModule {}
