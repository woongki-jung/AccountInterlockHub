// FN-015 를 성공 응답 본문에도 적용하는 전역 인터셉터(회귀 1회차 I-1 시정). 이전 구현은
// sanitizeValue 를 오류 엔벨로프의 details 화이트리스트 재구성 **뒤**에만 호출해, 실제로
// 제거할 것이 이미 없는 자리에만 걸려 있었다 — 실효 있는 자리(성공 응답 본문)는 비어 있었고,
// 실측으로 {encX,encY,birthDate} 를 그대로 반환하는 컨트롤러의 200 응답에 값이 그대로
// 나가는 것을 확인했다. function_FN-014-015.md §FN-015 API 인터페이스가 "모든 응답·로그의
// 내보내기 직전 지점에서 호출된다"고 명시하므로 — 실패 응답뿐 아니라 **성공 응답**도 그
// "모든 응답"에 포함된다(errors/error-envelope.ts 의 sanitizeValue 호출은 FN-014 §의존
// 기능표를 그대로 반영하기 위해 남겨 두되, 응답 본문 전체에 대한 실질적 방어는 이 인터셉터가
// 수행한다).
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { sanitizeValue } from '../security/sanitize-value';

/**
 * 컨트롤러가 반환한 값(성공 응답 본문이 될 값)을 FN-015 를 적용한 사본으로 치환한다.
 * `next.handle()` 의 Observable 은 컨트롤러가 정상적으로 값을 반환했을 때만 이 파이프라인을
 * 지난다 — 예외가 발생하면 이 인터셉터를 거치지 않고 `GlobalExceptionFilter` 가 대신
 * 처리하므로, 이 인터셉터는 성공 경로만 건드리고 오류 응답 형상에는 관여하지 않는다.
 *
 * **엔벨로프를 씌우지 않는다** — `map(sanitizeValue)` 는 값의 형태를 바꾸지 않고 내용만
 * 정제한다(금지 키가 있던 자리만 사라질 뿐, 새 바깥 껍질을 추가하지 않는다). "성공 응답은
 * 감싸지 않는다"(FN-014 §구현 가이드)는 원칙은 그대로 유지된다 — 이 인터셉터는 FN-014 가
 * 아니라 FN-015 의 적용 지점이다.
 */
@Injectable()
export class SanitizeResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => sanitizeValue(data)));
  }
}
