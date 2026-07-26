// PROC-105 연동 결과 안내(process_PROC-105.md) — 결과 구분 → 경로 번호 대응·복귀 주소 동봉
// 여부를 **한 곳에만** 두는 자리다("대응을 여러 곳에 두면 화면이 보는 결과와 발송처가 조회하는
// 결과가 갈린다" — 같은 문서 §개요). PROC-101 B6 가 이 프로세스를 호출한다(`source:
// 'ENTRY_FAILURE'`). 다른 세 호출 지점(PROC-101 §진입점 및 진입 조건 표 — PROC-102 B7·B4b ·
// PROC-103 B2·B4·B8)은 아직 배선되지 않은 후속 Phase 소관이나, 이 서비스는 PROC-105 전체를
// 사양대로 구현해 재사용 가능하게 둔다(같은 매핑을 접점마다 다시 구현하지 않는다).
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
