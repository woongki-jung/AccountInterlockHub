// PROC-105 연동 결과 안내(process_PROC-105.md) — 결과 구분 → 경로 번호 대응·복귀 주소 동봉
// 여부를 **한 곳에만** 두는 자리다("대응을 여러 곳에 두면 화면이 보는 결과와 발송처가 조회하는
// 결과가 갈린다" — 같은 문서 §개요). 이 서비스는 PROC-105 전체(B1~B3)를 사양대로 구현해
// 재사용 가능하게 둔다(같은 매핑을 접점마다 다시 구현하지 않는다).
//
// 실제 호출 지점(P10 커버리지 재확인, 2026-07-26) — PROC-105 §진입점 및 진입 조건 표의 네
// 출처 중 셋이 배선됐다: PROC-101 `B6`(`ENTRY_FAILURE` — entry.controller.ts) ·
// PROC-102 `B7`(`RECORD` — identity-verification.service.ts) · PROC-103 `B4`(`RECORD`)·`B8`
// (`RESULT_CODE` — consent-approval.service.ts). **`REASON_CODE` 출처(표의 "PROC-102 `B4b`
// · PROC-103 `B2`")는 이 빌더를 호출하지 않는다 — 배선 누락이 아니라 설계다.** 두 실패
// 원점 모두 결과를 확정하지 않고 그대로 던져 전역 예외 필터(`GlobalExceptionFilter`)가 만드는
// 순수 FN-014 오류 응답 엔벨로프(`{code, message, details?}` — `resultPath` 필드 자체가 없다)
// 로 응답이 끝나고, 화면(PROC-105 F1)이 `err.code` 로부터 직접 경로를 도출한다(실측:
// process_PROC-102-logic.md B4b `"return 400 FN-014(code) // 화면은 결과 경로 ②로 간다"` ·
// process_PROC-103-logic.md B2 · process_PROC-103.md §호출 관계 "PROC-105(동기 — `B4`·`B8`)"
// — `B2` 가 빠져 있다). `ResultInfoInput` 이 `REASON_CODE` 변형을 여전히 두는 이유는 B1
// 의사코드가 이 출처를 `ENTRY_FAILURE` 와 동일하게(`resultCode = null` → 경로②) 정의해
// PROC-105 자신의 입력 계약을 완비해 두기 위함이다 — 실사용 호출부가 없다고 이 분기를
// 지우지 않는다(대응 표는 이 함수 한 곳에 그대로 둔다는 원칙과 같다).
import { Injectable } from '@nestjs/common';
import { InterlockConfigService } from '../config/interlock-config.service';
import type { ResultCode } from '../entities';
import type { ResultInfo } from './entry-initial-state.model';

/**
 * PROC-105 B1 입력 — §진입점 및 진입 조건 표의 네 출처. `RECORD` 출처는 그 문서가 "resultCode =
 * input.record.resultCode" 로 레코드에서 추출만 하므로, 이 경계에서는 호출측이 이미 추출한
 * `resultCode` 를 받는다(전체 `MDL-001` 객체를 이 함수가 알 필요가 없다 — 계층 분리).
 */
export type ResultInfoInput =
  | { readonly source: 'ENTRY_FAILURE'; readonly reasonCode: string }
  | { readonly source: 'REASON_CODE'; readonly reasonCode: string }
  | { readonly source: 'RESULT_CODE'; readonly resultCode: ResultCode; readonly isReAnnouncement?: boolean }
  | { readonly source: 'RECORD'; readonly resultCode: ResultCode; readonly isReAnnouncement?: boolean };

@Injectable()
export class ResultInfoBuilder {
  constructor(private readonly interlockConfig: InterlockConfigService) {}

  /**
   * B1(결과 확보)~B3(결과 안내 구성)을 한 번에 수행한다. 예외를 던지지 않는다 — process_PROC-105.md
   * §분기 및 예외 흐름 "본 프로세스는 예외를 던지지 않는다. 어떤 입력이 와도 1~3 중 하나로
   * 수렴하며, 판단이 서지 않으면 경로 ②다."
   */
  build(input: ResultInfoInput): ResultInfo {
    // B1. 결과 확보 — 출처별 resultCode 추출(ENTRY_FAILURE·REASON_CODE 는 null 로 취급).
    const resultCode: ResultCode | null =
      input.source === 'RESULT_CODE' || input.source === 'RECORD' ? input.resultCode : null;
    const isReAnnouncement = input.source === 'RESULT_CODE' || input.source === 'RECORD' ? (input.isReAnnouncement ?? false) : false;

    // B2. 결과 경로 선택 — 결과 구분 → 경로 번호 대응은 이 스위치 하나뿐이다(BIZ-001-02·BIZ-001-03).
    const resultPath = this.selectResultPath(resultCode);

    // B3. 결과 안내 구성 — 복귀 주소 동봉 판정(BR-025). 경로 ①(연동 완료) 이고 구성 상수가
    // 절대 URL 일 때만 싣는다. 조건 미달이면 속성 자체를 두지 않는다(빈 문자열·null 로 채우지
    // 않는다 — MDL-009).
    const returnUrl = this.selectReturnUrl(resultPath);

    return returnUrl === undefined ? { resultPath, isReAnnouncement } : { resultPath, isReAnnouncement, returnUrl };
  }

  private selectResultPath(resultCode: ResultCode | null): 1 | 2 | 3 {
    switch (resultCode) {
      case 'SUCCESS':
        return 1;
      case 'DECRYPT_FAILED':
        // 방어적 분기 — 현 설계에서 도달하지 않는다(EXC-BIZ-14, process_PROC-105.md §구현 가이드).
        return 2;
      case 'DELIVERY_FAILED':
        return 3;
      case null:
        // 진입 단계 실패·복호화 실패(추적 레코드 없음) — 매핑되지 않는 상태는 전부 경로 ②다.
        return 2;
      default:
        return 2;
    }
  }

  private selectReturnUrl(resultPath: 1 | 2 | 3): string | undefined {
    if (resultPath !== 1) return undefined; // BR-025 — 대상은 경로 ① 하나뿐이다(BIZ-001-06).
    const url = this.interlockConfig.completionRedirectUrl;
    return url.startsWith('https://') || url.startsWith('http://') ? url : undefined; // SVC-005 F-008.
  }
}
