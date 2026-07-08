import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SuccessEnvelope } from './envelope.types';

/**
 * 성공 응답 인터셉터(FN-015) — 컨트롤러 핸들러 반환값을 { success: true, data } 로 감싼다.
 * 정적 서빙(serve-static)은 Nest 파이프라인 밖 미들웨어에서 처리되어 본 인터셉터를 거치지 않는다.
 */
@Injectable()
export class SuccessInterceptor<T> implements NestInterceptor<T, SuccessEnvelope<T>> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<SuccessEnvelope<T>> {
    return next.handle().pipe(
      map((data) => ({ success: true as const, data: (data ?? null) as T })),
    );
  }
}
