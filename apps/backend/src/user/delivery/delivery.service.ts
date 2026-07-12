import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ActorType, AuditEventType, AuditResult } from '../../common/audit/audit.constants';
import { maskToken } from '../../common/audit/masking.util';
import { AppException } from '../../common/envelope/app.exception';
import { ProcessStatusService } from '../status/process-status.service';

/**
 * 수신처 B 서버-서버 전달 서비스 — FN-012_deliverToServiceB / PROC-203 B4 / SVC-005.
 *
 * PROC-203(연동 실행) 내부에서 호출된다(독립 엔드포인트 아님). 허브 복호화(FN-020)로 확보한 복호화 원문
 * X 를 접근 주소 구성의 수신처(B) 전달 주소로 **서버-서버 POST** 로 중개한다. X 는 원본 무변형으로 전달
 * 페이로드에만 실어 보내고 저장·해석하지 않으며(SEC-002-03), 브라우저를 경유하지 않는다(SEC-007-01).
 * 전달 실패 시 최대 2회 재시도(최초 포함 3회) 후 실패로 확정한다(BR-202). 전달 결과(성공·실패)는 처리
 * 상태 1건으로 반드시 저장한다(EXC-BIZ-06·EXC-BIZ-11 — 연동이력은 전달 이전에 이미 생성돼 유지된다).
 * 외부 호출은 BE 를 경유한다(Node 전역 fetch).
 *
 * `#214` 로 입력이 회원 키 + 리매핑 파라미터(구 ENT-003)에서 **복호화 원문 X 무변형**으로 바뀌었다 —
 * 파라미터 정의 조회(TBL_INTERLOCK_PARAMETER)가 사라져 DataSource 의존도 제거됐다. 사전 조건 검증
 * (BIZ-003-06/07 미승인·역전이 차단)은 본 서비스가 오직 PROC-203 내부(복호화·이력 생성 성공 후)에서만
 * 호출되는 제어 흐름으로 구조적으로 보장돼(trackingKey 는 복호화 성공 시에만 존재) 별도 런타임 assert 를
 * 두지 않는다 — 구 ctx.consentConfirmed 플래그 가드는 대응 개념 자체가 없어져 폐기됐다.
 *
 * ⚠ 사양 미결(완료 보고 WARN, P2 부터 이월): 수신처 B 전달의 인증·서명(HMAC 등) 계약이 참조 사양(FN-012·
 *   PROC-203·SEC-002·external-apis §미결)에 정의되어 있지 않다. 임의 서명을 발명하지 않고 평문 BE 경유
 *   HTTP 전달로 구현한다.
 *
 * DB 접근 없음(상태 저장은 ProcessStatusService 위임). 회원 키·연동 추적 키는 로그 노출 시에도 원문을
 * 남기지 않는다(마스킹, SEC-005-04).
 */

// 승인 게이팅 통과 후 재조회한 전달 대상 구성(활성). MDL-101 부분집합.
export interface DeliveryConfig {
  id: string; // 연동 구성 참조(ENT-001.id) — 상태 저장 키
  serviceBDeliveryUrl: string; // 전달 대상 주소(구성 외 주소 금지, BIZ-003-02)
  serviceBHttpMethod: string; // 전달 방식(GET/POST/PUT/PATCH)
}

// 외부 호출 단건 타임아웃(ms). build 기본안 — 확정 시 BIZ-003 리비전(FN-012 §구현 가이드).
// 최초 1 + 재시도 2회라 최악 3×타임아웃까지 동기 지연될 수 있다.
const DELIVERY_TIMEOUT_MS = 10_000;
// 재시도 상한(최초 포함 최대 3회 호출 — BR-202). attempt<=MAX_ATTEMPT_INDEX 동안 반복.
const MAX_ATTEMPT_INDEX = 2;

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    private readonly processStatusService: ProcessStatusService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * FN-012_deliverToServiceB(payloadX, trackingKey, config, now) — PROC-203 B4.
   * 복호화 원문 X 를 구성의 수신처 B 주소로 전달하고, 결과(성공·실패)를 처리 상태 1건으로 저장한다.
   * 성공: DELIVERY_SUCCESS 감사 후 반환. 실패(재시도 후): 상태 저장 → DELIVERY_FAIL 감사 → 502 EX-BIZ-004
   * throw(상태는 저장됨, 연동이력도 유지 — EXC-BIZ-06·EXC-BIZ-11).
   */
  async deliverToServiceB(
    payloadX: Record<string, unknown>,
    trackingKey: string,
    config: DeliveryConfig,
    now: Date,
  ): Promise<void> {
    // 전달 대상 결정(BIZ-003-02) — 구성의 수신처 B 주소·메서드로 한정.
    const targetUrl = config.serviceBDeliveryUrl;
    const method = config.serviceBHttpMethod;

    // 전달·재시도(BIZ-003-03·SEC-007-01, BR-202) — payloadX 무변형 전달(SEC-002-03).
    const isSuccess = await this.sendWithRetry(targetUrl, method, payloadX, trackingKey);

    // 처리 상태 저장(무조건 1건 — 성공·실패 모두, 내부 PROC-401·EXC-BIZ-06).
    await this.processStatusService.saveStatus({
      trackingKey,
      configId: config.id,
      isSuccess,
      processedAt: now,
    });

    if (!isSuccess) {
      await this.auditService.write({
        eventType: AuditEventType.DELIVERY_FAIL,
        actorType: ActorType.SERVICE,
        actorId: null,
        target: maskToken(trackingKey),
        result: AuditResult.FAIL,
      });
      throw new AppException('EX-BIZ-004'); // 처리 상태는 이미 저장됨(EXC-BIZ-06), 연동이력 유지(EXC-BIZ-11)
    }

    await this.auditService.write({
      eventType: AuditEventType.DELIVERY_SUCCESS,
      actorType: ActorType.SERVICE,
      actorId: null,
      target: maskToken(trackingKey),
      result: AuditResult.SUCCESS,
    });
  }

  /**
   * 수신처 B 호출·재시도(BR-202). attempt=0 부터 시작해 attempt<=2 동안 반복(최대 3회 호출).
   * 2xx 응답이면 성공 즉시 종료, 비 2xx·타임아웃·네트워크 오류는 실패 시도로 집계(attempt+1)한다.
   * 외부 호출은 Node 전역 fetch + AbortController 타임아웃으로 수행한다(라이브러리 강제 없음).
   */
  private async sendWithRetry(
    targetUrl: string,
    method: string,
    payload: unknown,
    trackingKey: string,
  ): Promise<boolean> {
    const upperMethod = method.toUpperCase();
    // GET/HEAD 는 본문을 가질 수 없다(fetch TypeError 방지). 그 외 메서드에만 JSON 본문을 싣는다.
    const hasBody = upperMethod !== 'GET' && upperMethod !== 'HEAD';

    let attempt = 0;
    let success = false;
    while (attempt <= MAX_ATTEMPT_INDEX && !success) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
      try {
        const resp = await fetch(targetUrl, {
          method: upperMethod,
          headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
          body: hasBody ? JSON.stringify(payload) : undefined,
          signal: controller.signal,
        });
        if (resp.ok) {
          success = true; // 2xx — 성공 확정
        } else {
          attempt += 1; // 비 2xx 응답 — 실패 시도 집계
        }
      } catch {
        // 타임아웃(abort)·네트워크 오류 — 복호화 원문·추적 키 원문 미노출(마스킹 대상). 실패 시도로 집계.
        this.logger.warn(
          `수신처 B 전달 시도 실패(attempt=${attempt}, trackingKey=${maskToken(trackingKey)}) — 재시도 판단`,
        );
        attempt += 1;
      } finally {
        clearTimeout(timer);
      }
    }
    return success;
  }
}
