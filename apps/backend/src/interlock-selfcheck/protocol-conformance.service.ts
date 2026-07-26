// PROC-204 B3~B6 오케스트레이션 — 연동 규약 자가진단(SVC-013). 컨트롤러의 B2(입력 존재 검증,
// selfcheck-request.dto.ts)를 통과한 값을 받아 생년월일 형식 검증(B3) → 복호화 판정(B4) → X
// 평문 크기 상한 검사(B5) → 응답 구성(B6)까지 수행한다. 트랜잭션 경계·사전 조회 쿼리·영속화
// 쿼리가 없다(PROC-204 §실행 제약사항 "트랜잭션 경계: 없음. 영속화가 없는 순수 판정이다") —
// DatabaseModule·RecordsModule 어느 쪽도 주입하지 않는다.
import { Injectable } from '@nestjs/common';
import { validateBirthDateFormat } from '../crypto/birth-date.validator';
import { judgeDecryption } from '../crypto/decryption-judgment';
import { IdentityMismatchError, ProtocolFormatError, ProtocolViolationError } from '../crypto/crypto.errors';
import { PROTOCOL_VERSION, X_PLAINTEXT_MAX_LENGTH_BYTES } from '../crypto/crypto.constants';
import type { MappedExCode } from '../common/errors/ex-catalog';
import { toEncPair } from './selfcheck-request.dto';
import type { SelfcheckRequestBody } from './selfcheck-request.dto';
import type { SelfcheckResponseBody } from './selfcheck-response.model';

/**
 * `B4`·`B5` 가 실제로 채우는 부적합 사유 4종(process_PROC-204.md §분기 및 예외 흐름 —
 * `EX-SEC-001`·`EX-AUTH-002`·`EX-SEC-002`·`EX-SEC-004`). `MappedExCode` 카탈로그 12종
 * 전체가 아니라 이 자리에 실제로 올 수 있는 부분집합으로 좁혀, `EX-OPS-002` 등 다른
 * 카탈로그 코드가 대입 실수로 섞여 드는 것을 컴파일 타임에 막는다(build 회귀 1회차 S-2).
 * `Extract` 로 정의해 네 리터럴이 `MappedExCode` 정본에서 실제로 빠지면(오타·카탈로그 개정)
 * 그 즉시 이 유니온에서도 함께 좁아져 아래 대입문이 타입 오류로 드러난다.
 */
type SelfcheckReasonCode = Extract<MappedExCode, 'EX-SEC-001' | 'EX-AUTH-002' | 'EX-SEC-002' | 'EX-SEC-004'>;

@Injectable()
export class ProtocolConformanceService {
  /**
   * `B3`(FN-005)~`B6`(응답 구성). 인증 없음(`AUTH-001`) — 세션이 없어 요청마다 독립적으로
   * 판정한다.
   *
   * 이 메서드는 **부적합 판정에 대해 예외를 던지지 않는다** — `B4`·`B5` 가 만드는 부적합
   * (`EX-SEC-001`·`EX-AUTH-002`·`EX-SEC-002`·`EX-SEC-004`)은 전부 200 응답 본문으로 흡수한다
   * (SVC-013 §예외 사항 "판정 실패는 결과 구분이 아니다" · 인터페이스 §사유 코드 체계 — 부적합도
   * HTTP 200). `judgeDecryption()`(FN-004, `SVC-002`·`SVC-004` 와 공유하는 같은 판정 함수 —
   * `SEC-002-01`)이 던지는 세 예외 타입만 그렇게 흡수하고, **그 밖의 예외는 그대로 다시 던져**
   * 전역 예외 필터의 마지막 방어(500 `EX-OPS-002`)로 흘려보낸다(`OPS-003-05` — 판정을 수행하지
   * 못한 내부 실패를 부적합 판정으로 위장하지 않는다, tc_API-04.md `API-04_015` ③). `B3`
   * (`validateBirthDateFormat`)이 던지는 `EX-AUTH-001` 도 여기서 잡지 않고 그대로 전파한다 —
   * "요청 자체가 성립하지 않는" 경우라 400 이다(인터페이스 §사유 코드 체계 · `SEC-003-04` 의
   * 경계).
   */
  diagnose(request: SelfcheckRequestBody): SelfcheckResponseBody {
    // B3 — FN-005(AUTH-002-02). 형식 위반은 그대로 전파해 컨트롤러 밖(전역 필터)에서 400
    // EX-AUTH-001 로 응답한다 — 판정을 수행하지 않는다.
    validateBirthDateFormat(request.birthDate);

    let isConform: boolean;
    let reasonCode: SelfcheckReasonCode | null;
    try {
      // B4 — FN-004(연동과 같은 함수 — 시그니처·반환형을 이 Phase 가 바꾸지 않는다). payload
      // (trackingKey 등 X 의 업무 필드)는 자가진단에 필요 없어 애초에 구조 분해하지 않는다 —
      // identity-verification.service.ts 가 반대로 rawPlaintext 를 받지 않는 것과 대칭이다.
      const { rawPlaintext } = judgeDecryption(toEncPair(request), request.birthDate);

      // B5 — X 평문 크기 상한(SEC-001-09). FN-004 는 이 검사를 하지 않는다
      // (function_FN-004.md §판정 경계에 대한 확정 사항 2) — 판정 통과 시에만 이 접점이 별도로
      // 검사한다. rawPlaintext 는 이미 X 의 UTF-8 원본 바이트열(JSON 파싱 이전, 재직렬화 없음)
      // 이라 Buffer.length 가 곧 "UTF8_BYTES(payload 원문 바이트열)"의 길이다.
      if (rawPlaintext.length > X_PLAINTEXT_MAX_LENGTH_BYTES) {
        isConform = false;
        reasonCode = 'EX-SEC-004';
      } else {
        isConform = true;
        reasonCode = null;
      }
      // rawPlaintext 는 이 지역 스코프를 벗어나며 폐기된다 — 별도로 저장·전역화하지 않는다
      // (DATA-001-03). 응답에 담을 속성 자체가 없다(MDL-015).
    } catch (error) {
      if (
        error instanceof ProtocolFormatError ||
        error instanceof IdentityMismatchError ||
        error instanceof ProtocolViolationError
      ) {
        // B4 부적합 — 판정 4단계 중 하나가 실패했다. 사유 코드는 정책 EX 코드 값 그대로 옮긴다
        // (SVC-013 F-007 — 연동 라이브러리 오류 사유 코드와 같은 값 체계).
        isConform = false;
        reasonCode = error.exCode;
      } else {
        // 분류되지 않은 실패(예: 내부 처리 오류) — 부적합으로 위장하지 않고 그대로 다시 던진다.
        throw error;
      }
    }

    // B6 — 응답 구성(SEC-001-11·SEC-002-05·DATA-001-04). 부적합도 200 이다. 기록·전달·계수를
    // 하지 않는다(SEC-003-03·EXC-BIZ-11) — 이 메서드가 그 어떤 저장소·카운터도 건드리지 않는
    // 것 자체가 그 보장이다.
    return { isConform, reasonCode, protocolVersion: PROTOCOL_VERSION };
  }
}
