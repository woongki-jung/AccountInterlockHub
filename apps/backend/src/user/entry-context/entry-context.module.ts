import { Module } from '@nestjs/common';
import { EntryContextStore } from './entry-context.store';

/**
 * 진입 컨텍스트 스토어 공유 모듈 — 진입(interlock)·동의 항목 조회(consent) 도메인이
 * 동일한 인메모리 스토어 싱글턴을 주입받도록 provider 를 export 한다.
 * (provider 는 모듈 싱글턴이라 본 모듈을 import 하는 두 도메인이 같은 인스턴스를 공유한다.)
 */
@Module({
  providers: [EntryContextStore],
  exports: [EntryContextStore],
})
export class EntryContextModule {}
