import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../../common/audit/audit.service';
import { ActorType, AuditEventType, AuditResult } from '../../common/audit/audit.constants';
import { maskToken } from '../../common/audit/masking.util';
import { AppException } from '../../common/envelope/app.exception';
import { ServiceActor, ServiceApiMetadata, ServiceCaller } from './service-api.types';

/**
 * 서비스 대면 API 인증(FN-004 / SEC-003) — 사전 발급 API 키(주체 식별) + HMAC-SHA256 서명 검증.
 *
 * 인증 스킴(계약 — .env.example 에도 동일 문서화):
 *   요청 헤더 3종
 *     - X-Api-Key   : 호출 주체 키 ID(서비스 A 또는 B 식별).
 *     - X-Timestamp : unix epoch seconds(정수 문자열). 재전송 방지 시간창 검증용.
 *     - X-Signature : hex 인코딩 HMAC-SHA256. 아래 canonical string 을 주체의 공유 비밀로 서명한 값.
 *   Canonical string = `${METHOD}\n${path}\n${timestamp}\n${bodyHashHex}`
 *     - METHOD      : HTTP 메서드 대문자(GET·POST).
 *     - path        : 쿼리 문자열 제외 요청 경로(예 `/api/status/<uuid>`, `/api/interlock/completion`).
 *     - timestamp   : X-Timestamp 원문(문자열 그대로).
 *     - bodyHashHex : hex(sha256(rawBody)). 본문 없으면 빈 바이트의 sha256(= 빈 문자열의 sha256).
 *   GET 은 본문이 없어 path 에 실린 requestKey 가 서명 대상에 포함되어 보호된다.
 *
 * 검증 절차(의사코드 정합):
 *   ① 헤더 3종 누락 → 실패
 *   ② X-Api-Key 로 주체 조회(구성된 A/B 키 ID 매칭). 미매칭 → 실패
 *   ③ 라우트 기대 주체(expectedActor)와 주체 일치 확인 → 불일치 시 실패(detail 'wrong actor for <scope>', SEC-003-03)
 *   ④ 시간창: abs(now - timestamp) <= 300s 초과 → 실패(재전송 방지)
 *   ⑤ 기대 서명 계산 후 상수시간 비교(timingSafeEqual — 길이 다르면 즉시 실패) → 불일치 시 실패
 *   ⑥ 통과 시 ServiceCaller { actor, id } 반환
 *
 * 실패 처리(어느 단계든): API_AUTH_FAIL 감사(SERVICE·FAIL, target=마스킹된 requestKey 또는 caller id,
 *   detail 에 사유) 후 401 EX-SEC-003. 자격값·서명 원문·타임스탬프 원문은 감사·로그에 남기지 않는다(SEC-005).
 *
 * 비밀 자격 출처: 운영 구성값(환경변수, ENT 아님). SERVICE_A/B_API_KEY·SERVICE_A/B_API_SECRET.
 *   미설정(dev) 시 해당 주체 인증은 fail-closed(401)로 동작한다(자격 미구성 → 조회 미매칭).
 */

// 인증 헤더 이름(소문자 — Express 는 헤더명을 소문자로 보관한다).
export const API_KEY_HEADER = 'x-api-key';
export const TIMESTAMP_HEADER = 'x-timestamp';
export const SIGNATURE_HEADER = 'x-signature';

// 재전송 방지 시간창(초) — abs(now - X-Timestamp) 허용 폭.
const CLOCK_SKEW_TOLERANCE_SEC = 300;

// 인증 입력(가드가 요청에서 추출해 전달).
export interface ServiceApiAuthInput {
  method: string; // HTTP 메서드
  path: string; // 쿼리 제외 요청 경로
  rawBody: Buffer; // 원문 본문(없으면 빈 Buffer)
  headers: {
    apiKey?: string;
    timestamp?: string;
    signature?: string;
  };
  requestKey?: string | null; // 실패 감사 마스킹 대상(있으면 — 예: /api/status/:requestKey)
  now: Date;
}

// 구성된 주체 자격(환경변수에서 해석).
interface ResolvedCredential {
  actor: ServiceActor;
  id: string; // API 키 ID(X-Api-Key 값)
  secret: string; // HMAC 공유 비밀
}

@Injectable()
export class ServiceApiAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * FN-004 인증(+ 주체 구분). 통과 시 인증된 호출 주체를, 실패 시 401 EX-SEC-003 을 던진다(내부 감사).
   * @throws AppException EX-SEC-003(자격 누락·미매칭·주체 불일치·시간창 초과·서명 불일치)
   */
  async authenticate(
    input: ServiceApiAuthInput,
    metadata: ServiceApiMetadata,
  ): Promise<ServiceCaller> {
    const { headers, method, path, rawBody, requestKey, now } = input;

    // ① 헤더 3종 존재 확인 — SEC-003-01
    if (!headers.apiKey || !headers.timestamp || !headers.signature) {
      await this.failAudit(requestKey, headers.apiKey ?? null, 'missing auth headers');
      throw new AppException('EX-SEC-003');
    }

    // ② API 키로 주체 조회 — SEC-003-01
    const credential = this.resolveCredential(headers.apiKey);
    if (!credential) {
      await this.failAudit(requestKey, headers.apiKey, 'unknown api key');
      throw new AppException('EX-SEC-003');
    }

    // ③ 기대 주체 일치 확인 — SEC-003-03(서비스 A 자격으로 API-03, 서비스 B 자격으로 API-01/02 차단)
    if (credential.actor !== metadata.actor) {
      await this.failAudit(requestKey, credential.id, `wrong actor for ${metadata.scope}`);
      throw new AppException('EX-SEC-003');
    }

    // ④ 시간창 검증 — 재전송 방지
    const tsSec = Number(headers.timestamp);
    const nowSec = Math.floor(now.getTime() / 1000);
    if (!Number.isInteger(tsSec) || Math.abs(nowSec - tsSec) > CLOCK_SKEW_TOLERANCE_SEC) {
      await this.failAudit(requestKey, credential.id, 'timestamp out of window');
      throw new AppException('EX-SEC-003');
    }

    // ⑤ 서명 검증 — 상수시간 비교(길이 상이 시 즉시 실패)
    const canonical = `${method.toUpperCase()}\n${path}\n${headers.timestamp}\n${sha256Hex(rawBody)}`;
    const expected = createHmac('sha256', credential.secret).update(canonical, 'utf8').digest();
    const provided = decodeHexSignature(headers.signature);
    if (
      !provided ||
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      await this.failAudit(requestKey, credential.id, 'signature mismatch');
      throw new AppException('EX-SEC-003');
    }

    // ⑥ 통과
    return { actor: credential.actor, id: credential.id };
  }

  /**
   * 환경변수에서 API 키 ID → 자격 매핑을 구성한다. 키·비밀이 모두 설정된 주체만 등록되어
   * 미설정 주체는 조회 미매칭(fail-closed)이 된다. ConfigModule(전역)이 .env 를 process.env 로 로드한다.
   */
  private resolveCredential(apiKey: string): ResolvedCredential | null {
    const aKey = this.config.get<string>('SERVICE_A_API_KEY');
    const aSecret = this.config.get<string>('SERVICE_A_API_SECRET');
    if (aKey && aSecret && apiKey === aKey) {
      return { actor: ServiceActor.SERVICE_A, id: aKey, secret: aSecret };
    }
    const bKey = this.config.get<string>('SERVICE_B_API_KEY');
    const bSecret = this.config.get<string>('SERVICE_B_API_SECRET');
    if (bKey && bSecret && apiKey === bKey) {
      return { actor: ServiceActor.SERVICE_B, id: bKey, secret: bSecret };
    }
    return null;
  }

  /**
   * 인증 실패 감사(API_AUTH_FAIL, SEC-003-02). target 은 마스킹된 requestKey(있으면) 또는 마스킹된 caller id.
   * actorId 는 AuditService 가 SERVICE 행위자에 대해 maskToken 으로 마스킹한다. detail 에는 사유만(자격값 배제).
   */
  private async failAudit(
    requestKey: string | null | undefined,
    callerId: string | null,
    detail: string,
  ): Promise<void> {
    const target = requestKey ? maskToken(requestKey) : maskToken(callerId);
    await this.auditService.write({
      eventType: AuditEventType.API_AUTH_FAIL,
      actorType: ActorType.SERVICE,
      actorId: callerId,
      target,
      result: AuditResult.FAIL,
      detail,
    });
  }
}

/** rawBody 의 sha256 hex. 빈 Buffer 는 빈 문자열의 sha256 과 동일하다. */
function sha256Hex(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

/** hex 서명 문자열을 Buffer 로 디코드한다. 비 hex·홀수 길이는 null(→ 서명 불일치 처리). */
function decodeHexSignature(hex: string): Buffer | null {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
    return null;
  }
  return Buffer.from(hex, 'hex');
}
