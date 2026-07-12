import { Injectable } from '@nestjs/common';
import { ActorType, AuditEventType, AuditResult } from '../../common/audit/audit.constants';
import { AuditService } from '../../common/audit/audit.service';
import { maskToken } from '../../common/audit/masking.util';
import { AppException } from '../../common/envelope/app.exception';
import { HistoryScopeService } from './history-scope.service';

/**
 * 연동 완료 확인 판정 서비스 — PROC-302 B4 / FN-017 / SVC-008 / API-02.
 *
 * 서비스 A 가 **연동 추적 키** 기준으로 서비스 B 의 정보연계 처리완료 여부를 확인하는 API 의 도메인
 * 계층이다. 인증(FN-004)·요청제한(FN-014)·입력 검증(FN-005)은 상위(가드·ValidationPipe)가 선행하고,
 * 본 서비스는 스코프 최신 이력 1건의 완료 콜백 수신 여부로 처리완료를 판정한다.
 *
 *  - 스코프 해석은 FN-019(HistoryScopeService)에 위임한다(build P9 완료 콜백과 공유하는 단일 소스).
 *    스코프 정의를 본 서비스에 중복 구현하지 않는다.
 *  - 스코프 내 이력 없음(보관 만료 삭제·미기록·복호화 이전 종료 포함)은 단일 404 EX-BIZ-005 로 응답한다
 *    (존재 여부 비노출, EXC-DATA-11). `#214` 로 구성 미존재·미지정 구분(구 eligible 판정)은 폐기됐다.
 *  - 응답(MDL-304)에는 완료 판정 3항목만 담고 연동 추적 키 원문·회원 키·구성 내부 식별자 필드를 두지
 *    않는다(SEC-005-05). 감사·오류 로그의 추적 키는 FN-010 마스킹(앞2·뒤2)한다(SEC-005-04).
 *
 * **읽기 전용** — 이력(ENT-007)·처리상태(ENT-004)를 갱신하는 어떤 문장도 두지 않는다(BIZ-004-11 정합,
 * API-01 의 결과 확인 갱신과 대비). 재조회에 제한이 없다(멱등).
 */

/**
 * 완료 확인 응답(MDL-304, CompletionCheckResponse) — 완료 판정 3항목만.
 * 연동 추적 키 원문·회원 키·구성 내부 식별자 필드를 두지 않는다(SEC-005-05). 일시는 ISO8601 문자열,
 * 미완료 시 callbackReceivedAt null.
 */
export interface CompletionCheckResponse {
  isCompleted: boolean;
  callbackReceivedAt: string | null;
  requestedAt: string;
}

@Injectable()
export class CompletionService {
  constructor(
    private readonly historyScopeService: HistoryScopeService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * 연동 완료 확인 판정(FN-017). 스코프 최신 이력 1건의 완료 콜백 수신 여부로 처리완료를 판정한다.
   * @param trackingKey 조회 조건(연동 추적 키) — 형식 검증(FN-005 NotBlank·MaxLength(255)) 통과값.
   * @throws AppException EX-BIZ-005(404) 스코프 내 이력 없음(단일 응답, 존재 여부 비노출).
   */
  async checkCompletion(trackingKey: string): Promise<CompletionCheckResponse> {
    // 1. 스코프 해석(FN-019, pendingOnly=false — 완료 판정은 스코프 전체 최신 1건, BIZ-004-10).
    const res = await this.historyScopeService.resolveHistoryScope(trackingKey, false);
    // 스코프 내 이력 없음 → 단일 404(존재 여부 비노출, EXC-DATA-11).
    if (res.target == null) {
      throw new AppException('EX-BIZ-005');
    }

    // 2. 완료 판정(BR-302) — 수신=완료 / 미수신=미완료(둘 다 200). 읽기 전용(이력·상태 무갱신).
    const target = res.target;
    const response: CompletionCheckResponse = {
      isCompleted: target.callbackReceived,
      callbackReceivedAt: target.callbackReceived ? toIso8601(target.callbackReceivedAt) : null,
      requestedAt: toIso8601(target.requestedAt) as string, // requested_at 은 NOT NULL(ENT-007)
    };

    // 3. 조회 감사(COMPLETION_CHECK) — 추적 키는 FN-010 마스킹, 원문 미기록(SEC-005-04).
    await this.auditService.write({
      eventType: AuditEventType.COMPLETION_CHECK,
      actorType: ActorType.SERVICE,
      target: maskToken(trackingKey),
      result: AuditResult.SUCCESS,
      detail: `completed=${response.isCompleted}`,
    });

    // 4. 응답 반환 — 완료 판정 3항목만(SEC-005-05). 상위 SuccessInterceptor(FN-015)가 { success, data } 로 감싼다.
    return response;
  }
}

/** Date(또는 문자열/null)를 ISO8601 문자열로 직렬화한다. null 은 그대로 null. */
function toIso8601(value: Date | string | null): string | null {
  if (value == null) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
