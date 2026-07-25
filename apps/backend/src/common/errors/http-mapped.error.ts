// 전역 예외 필터가 "분류된 도메인 예외"로 인식하는 형태의 계약.
import type { FieldReason } from './field-reason';

/**
 * `exCode`(정책 예외 코드 카탈로그의 값)를 가진 예외는 전역 예외 필터가 FN-014 엔벨로프로
 * 자동 변환한다. 기존 크립토·레코드 예외 클래스(`crypto/crypto.errors.ts` 의
 * `ProtocolFormatError` 등, `records/records.errors.ts` 의 `RecordWriteError`)는 이미 이 형태를
 * **구조적으로** 만족하므로(덕 타이핑) 이 인터페이스를 상속하도록 고칠 필요가 없다 — 그
 * 파일들은 이 Phase 의 읽기 전용 영역이기도 하다.
 *
 * `httpStatus` 를 이 계약에 넣지 않는다 — 실제 응답 상태 코드는 항상 `exCode` → 카탈로그
 * (`ex-catalog.ts`)로 다시 계산한다(단일 출처). 예외 클래스 자신이 들고 있는 `httpStatus` 값은
 * (있다면) 참고용일 뿐 전역 필터가 신뢰하지 않는다.
 */
export interface HttpMappedError {
  readonly exCode: string;
  readonly details?: FieldReason[];
}

/** `error` 가 {@link HttpMappedError} 형태를 만족하는지 런타임에 판정한다(덕 타이핑). */
export function isHttpMappedError(error: unknown): error is HttpMappedError {
  if (typeof error !== 'object' || error === null) return false;
  const exCode = (error as Record<string, unknown>).exCode;
  return typeof exCode === 'string' && exCode.length > 0;
}

/**
 * 향후 Phase(접점 컨트롤러)가 `details`(`FieldReason[]`)를 실어 예외를 던질 때 바로 쓸 수 있는
 * 범용 클래스 — 검증 실패마다 전용 Error 서브클래스를 새로 만들 필요를 없앤다. 기존 예외
 * 클래스들과 병행 사용 가능하며 상속 관계를 강제하지 않는다.
 */
export class HttpMappedException extends Error implements HttpMappedError {
  readonly exCode: string;
  readonly details?: FieldReason[];

  constructor(exCode: string, message: string, details?: FieldReason[]) {
    super(message);
    this.name = 'HttpMappedException';
    this.exCode = exCode;
    this.details = details;
  }
}
