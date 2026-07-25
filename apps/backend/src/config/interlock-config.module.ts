import { DynamicModule, Global, Module } from '@nestjs/common';
import { InterlockConfigService } from './interlock-config.service';
import { ConsentConfig, InterlockConfig } from './interlock-config.types';

/**
 * 검증이 끝난 연동 구성 상수를 전역 DI 로 배포하는 모듈.
 * main.ts 가 NestFactory.create() 이전에 이미 검증을 마친 값을 forRoot() 로 주입한다 —
 * 이 모듈 자신은 검증을 수행하지 않는다(검증 실패가 Nest 부트스트랩 내부로 숨는 것을 막기 위함, main.ts 참고).
 */
@Global()
@Module({})
export class InterlockConfigModule {
  static forRoot(config: InterlockConfig, consent: ConsentConfig): DynamicModule {
    return {
      module: InterlockConfigModule,
      providers: [
        {
          provide: InterlockConfigService,
          useValue: new InterlockConfigService(config, consent),
        },
      ],
      exports: [InterlockConfigService],
    };
  }
}
