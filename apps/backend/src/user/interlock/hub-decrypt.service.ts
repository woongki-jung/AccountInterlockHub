import { createDecipheriv } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ActorType, AuditEventType, AuditResult } from '../../common/audit/audit.constants';
import { maskToken } from '../../common/audit/masking.util';
import { AppException } from '../../common/envelope/app.exception';

/**
 * FN-020 허브 복호화·연동 추적 키 추출 — SEC-006(이중 암호화·복호화 규약)의 단일 구현.
 *
 * 발송처가 이중 암호화해 전달한 encX(X 암호문)·encY(encX 키 문자열 암호문)를 사용자 생년월일로
 * 순차 복호화한다 — encY→keyXstr 복원(2단계) → encX→X(3단계) → trackingKey 추출·검증(4단계).
 * PROC-203(연동 실행) 내부에서 호출되는 복호화 단위 로직으로 독립 엔드포인트가 없다 — 호출자는
 * (P5·연동 실행 오케스트레이션) 승인 처리 흐름에서 encX·encY·birthDate·accessAddressId 를 직접 넘긴다.
 *
 * 무저장 원칙(DATA-001-04·SEC-005-06): encX·encY·birthDate·keyXstr·복호화 원문 X 는 어떤 저장소·로그·
 * 감사·응답에도 남기지 않는다 — 감사에는 접근 주소 고유 ID·성공 여부·trackingKey(마스킹)만 남긴다.
 * 정적 IV 파생·생년월일 저강도 취약은 알려진 제약으로 수용한다(SEC-008-01·EXC-SEC-06, 본 함수 범위 밖).
 *
 * 참조: docs/specs/functions/function_FN-020.md · docs/specs/policies/policy_SEC-crypto.md(SEC-006)
 *      · docs/prd/devspec/external-apis.md §암호화 연동 규약
 */

const AES_KEY_LEN = 32; // AES-256 키 길이(바이트, SEC-006-02)
const AES_IV_LEN = 16; // CBC IV 길이(바이트, SEC-006-02)
const PAD_BYTE = 0x5f; // '_' 우측 패딩 바이트(SEC-006-02)

// Base64URL 문자셋(패딩 없음 전제 — SEC-006-03 전달 인코딩). '=' 포함 등 이탈 문자는 형식 오류로 판정.
const BASE64URL_CHARSET_RE = /^[A-Za-z0-9_-]+$/;

// FN-020 반환값(MDL-204 payload + MDL-202 연동 추적 키) — 메모리 전용, 무저장(DATA-001-04).
export interface DecryptResult {
  X: Record<string, unknown>; // 복호화 원문(수신처 전달 페이로드) — 무변형, 호출자가 그대로 전달
  trackingKey: string; // X 내부 trackingKey 필드값(불투명 문자열, 해석·변형 금지)
}

@Injectable()
export class HubDecryptService {
  constructor(private readonly auditService: AuditService) {}

  /**
   * FN-020_decryptInterlock(encX, encY, birthDate, accessAddressId) → { X, trackingKey }
   *
   * @param encX 이중 암호값 1(Base64URL, X 암호문) — 부재(완전 누락)·빈값·형식오류는 EX-SEC-007(#238), 로그·저장 미기록
   * @param encY 이중 암호값 2(Base64URL, encX 키 문자열 암호문) — 부재(완전 누락)·빈값·형식오류는 EX-SEC-007(#238), 로그·저장 미기록
   * @param birthDate 사용자 생년월일(yyMMdd, 복호화 요소) — 로그·저장 미기록. 형식 검증은 승인 처리
   *   진입 단계(consent 제출) 책임이며 본 함수는 값을 그대로 키 유도 원문으로 사용한다(AUTH-004-01).
   * @param accessAddressId 접근 주소 고유 ID(감사 target — 발송처 식별자, 비민감). 유효성은 호출자(PROC-203)
   *   가 이미 구성 조회로 확정한 뒤 넘기는 값이라 본 함수는 재검증하지 않는다(pseudocode 정합).
   * @throws AppException
   *   - EX-SEC-007: encX·encY 부재(완전 누락)·빈값 또는 Base64URL 형식 오류(발송처 링크 오류·재입력 불가)
   *   - EX-SEC-006: 복호화 실패=패딩·키 불일치(생년월일 오류·재입력 가능, 하드 잠금 없음)
   *   - EX-BIZ-008: 복호화된 X 파싱 실패 또는 trackingKey 필드 누락·공백(발송처 데이터 오류·재입력 불가)
   */
  async decryptInterlock(
    encX: string | undefined,
    encY: string | undefined,
    birthDate: string,
    accessAddressId: string,
  ): Promise<DecryptResult> {
    // 1. 암호 파라미터 부재·형식 검증(SEC-006-05). pseudocode 정합 — 본 단계는 감사 미기록(FAIL_DECRYPT·
    //    FAIL_SENDER_DATA 만 감사 대상, function_FN-020.md 의사코드 참조).
    // #238: 필드 자체 부재(완전 누락)도 빈값·공백과 동일한 발송처 링크 오류로 EX-SEC-007 로 통합한다
    //       (승인 DTO 는 부재를 EX-SEC-004 로 선차단하지 않고 본 단계에 위임). null 체크로 이후 string 확정.
    if (encX == null || encY == null || isBlank(encX) || isBlank(encY)) {
      throw new AppException('EX-SEC-007');
    }
    let rawY: Buffer;
    let rawX: Buffer;
    try {
      rawY = base64UrlDecode(encY);
      rawX = base64UrlDecode(encX);
    } catch {
      throw new AppException('EX-SEC-007'); // Base64URL 디코드 실패 — 발송처 링크 구성 오류
    }

    // 2. encY 복호화 → encX 키 문자열(keyXstr) 복원(SEC-006-02/04, 메모리 전용).
    const keyY = normalize32(birthDate);
    const ivY = iv16(birthDate);
    let keyXstr: string;
    try {
      keyXstr = aesCbcDecrypt(rawY, keyY, ivY).toString('utf8');
    } catch {
      await this.auditDecryptFail(accessAddressId); // 패딩 오류·키 불일치 = 잘못된 생년월일
      throw new AppException('EX-SEC-006');
    }

    // 3. encX 복호화 → 전달 데이터 X(JSON 문자열, SEC-006-02/04).
    const keyX = normalize32(keyXstr);
    const ivX = iv16(keyXstr);
    let xJson: string;
    try {
      xJson = aesCbcDecrypt(rawX, keyX, ivX).toString('utf8');
    } catch {
      await this.auditDecryptFail(accessAddressId); // 패딩 오류·키 불일치 = 잘못된 생년월일
      throw new AppException('EX-SEC-006');
    }

    // 4. X 파싱·연동 추적 키 추출·검증(BIZ-004-08·DATA-002-05).
    let parsed: unknown;
    try {
      parsed = JSON.parse(xJson);
    } catch {
      await this.auditSenderDataErr(accessAddressId); // 복호화는 됐으나 X 가 유효 JSON 아님(발송처 데이터 오류)
      throw new AppException('EX-BIZ-008');
    }
    // 규약 고정 필드명 trackingKey(external-apis §암호화 연동 규약). 객체가 아니면 undefined 로 수렴.
    const trackingKeyRaw =
      parsed != null && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)['trackingKey']
        : undefined;
    if (typeof trackingKeyRaw !== 'string' || trackingKeyRaw.trim().length === 0) {
      await this.auditSenderDataErr(accessAddressId); // 추적 키 필드 누락·공백·비문자열
      throw new AppException('EX-BIZ-008');
    }
    const X = parsed as Record<string, unknown>;
    const trackingKey = trackingKeyRaw;

    // 5. 성공 감사(AUTH-004-03·OPS-002-04·SEC-008-01) — 원문 미기록, trackingKey 는 마스킹만(FN-010).
    await this.auditService.write({
      eventType: AuditEventType.DECRYPT_SUCCESS,
      actorType: ActorType.SYSTEM,
      actorId: null,
      target: accessAddressId,
      result: AuditResult.SUCCESS,
      detail: `trackingKey=${maskToken(trackingKey)}`,
    });

    // 6. 반환(메모리 전용) — 호출자(PROC-203)가 FN-016(이력 생성)→FN-012(전달) 로 이어간다.
    //    encX·encY·birthDate·keyXstr 참조는 본 스코프 종료로 자연 해제된다(별도 zeroing 없음, Node GC 전제).
    return { X, trackingKey };
  }

  /** FAIL_DECRYPT 공통 감사(SEC-006-05·AUTH-004-02) — 원문·생년월일 미기록, 성공 여부만 남긴다. */
  private async auditDecryptFail(accessAddressId: string): Promise<void> {
    await this.auditService.write({
      eventType: AuditEventType.DECRYPT_FAIL,
      actorType: ActorType.SYSTEM,
      actorId: null,
      target: accessAddressId,
      result: AuditResult.FAIL,
    });
  }

  /** FAIL_SENDER_DATA 공통 감사(BIZ-004-08·EXC-BIZ-13). */
  private async auditSenderDataErr(accessAddressId: string): Promise<void> {
    await this.auditService.write({
      eventType: AuditEventType.DECRYPT_SENDER_DATA_ERR,
      actorType: ActorType.SYSTEM,
      actorId: null,
      target: accessAddressId,
      result: AuditResult.FAIL,
    });
  }
}

/** 문자열 공백 판정(NotBlank 위반) — null·undefined·빈 문자열·공백만으로 구성된 문자열. */
function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}

/**
 * AES-256 키 정규화(SEC-006-02) — 키 문자열 UTF-8 바이트가 32 초과 시 앞 32B 절단,
 * 미만 시 0x5F('_') 우측 패딩. 정규화 전 원문(encY 평문 등)이 키 유도 원천이다.
 */
function normalize32(str: string): Buffer {
  return normalizeBytes(str, AES_KEY_LEN);
}

/** CBC IV 정규화(SEC-006-02) — 해당 키 문자열 UTF-8 앞 16B 절단, 부족분 0x5F('_') 우패딩. */
function iv16(str: string): Buffer {
  return normalizeBytes(str, AES_IV_LEN);
}

function normalizeBytes(str: string, targetLen: number): Buffer {
  const bytes = Buffer.from(str, 'utf8');
  if (bytes.length >= targetLen) {
    return bytes.subarray(0, targetLen); // 초과분은 앞에서부터 절단(앞 targetLen 바이트만 사용)
  }
  const result = Buffer.alloc(targetLen, PAD_BYTE); // 0x5F 로 선채움 후 원문을 앞쪽에 덮어써 우패딩 구현
  bytes.copy(result, 0);
  return result;
}

/**
 * Base64URL 디코드(SEC-006-03/05) — 패딩 없는 URL-safe Base64 문자열을 표준 Base64 로 환원해 디코드한다.
 * Node `Buffer.from` 은 base64/base64url 잘못된 입력에도 예외를 던지지 않고 관대하게(best-effort) 디코드하므로
 * (assumes valid input — Node 문서), 문자셋·길이를 사전 검증해 형식 오류를 결정론적으로 판별한다(검증 도구 재현성).
 * 검증 통과분만 `-_`→`+/` 치환 + `=` 패딩 후 디코드한다.
 */
function base64UrlDecode(input: string): Buffer {
  if (!BASE64URL_CHARSET_RE.test(input) || input.length % 4 === 1) {
    throw new Error('invalid base64url format'); // 문자셋 이탈 또는 불가능한 잔여 길이(4n+1)
  }
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

/**
 * AES-256-CBC 복호화(SEC-006-01) — PKCS#7 언패딩은 Node 기본 동작(createDecipheriv 의 setAutoPadding
 * 기본값 true). 패딩 오류·키/IV 불일치·블록 크기 불일치는 `final()` 이 예외로 던지며, 호출부가
 * 이를 "복호화 실패(생년월일 불일치)"로 일괄 처리한다(SEC-006-05).
 */
function aesCbcDecrypt(cipherText: Buffer, key: Buffer, iv: Buffer): Buffer {
  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([decipher.update(cipherText), decipher.final()]);
}
