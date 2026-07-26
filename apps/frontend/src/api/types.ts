// 세 접점(진입 · 본인확인 제출 · 동의·승인 제출)의 요청·응답 계약.
// 정본: docs/specs/functions/spec-functions-api-user.md,
//       docs/specs/datas/model_MDL-004-006.md · model_MDL-007-010.md.
// 값은 이 타입 정의가 아니라 위 문서가 정본이다 — 필드명·형태를 임의로
// 바꾸지 않는다.

/** 결과 3경로 번호 — ① 완료 ② 링크·복호화 오류 ③ 전달 실패(BIZ-001-02, MDL-009). */
export type ResultPath = 1 | 2 | 3;

/**
 * 경로 값 정규화 — 1~3 밖이거나 없으면 경로 ②로 그린다(screen_SCR-004.md
 * §구현 가이드 "경로 값이 1~3 밖이거나 없으면 경로 ②로 그린다" · SVC-005
 * F-003 미매핑 catch-all). `resultPath` 가 `SCR-004` 화면 상태로 흘러
 * 들어가는 지점 전부가 이 함수 하나만 거치게 해 판정을 중복 구현하지
 * 않는다 — 진입 초기 상태 수화(api/hydration.ts `readInitialState`) ·
 * 단계 상태머신의 세 함수(stage/transitions.ts `initialViewFromEntryState`
 * · `viewAfterVerify` 성공 분기 · `viewAfterApprove` 성공 분기) ·
 * ResultPanel(components, 조회 직전 최종 관문). 값이 `JSON.parse` 결과나
 * HTTP 응답 캐스팅(api/client.ts 의 `data as TResponse`)을 거쳐 오므로,
 * 정적 타입이 `ResultPath` 라고 말해도 런타임에 실제로 그렇다는 보장이
 * 없어 항상 실행한다. **새 지점이 `SCR-004` 결과를 만들면 이 목록에
 * 추가하고 반드시 정규화를 거치게 한다** — 회귀 2회차 S-1 은 이 목록이
 * 실제 코드와 어긋난 채(verify·approve 성공 분기 누락) 방치됐던 것을
 * 시정한 것이다.
 */
export function normalizeResultPath(value: unknown): ResultPath {
  if (value === 1 || value === 2 || value === 3) return value;
  return 2;
}

/** MDL-008 동의 항목 구성의 항목 하나. */
export interface ConsentItemDto {
  code: string;
  label: string;
  required: boolean;
  description: string;
}

/** MDL-008 동의 항목 구성 — 본인확인 응답이 실어 준다. */
export interface ConsentConfigDto {
  version: string;
  notice: string;
  items: ConsentItemDto[];
}

/**
 * MDL-009 연동 결과 안내 정보를 세 접점 공통으로 다루는 형태.
 * `returnUrl` 은 **선택 필드** — 존재 여부만이 복귀 이동의 유일한 신호다
 * (spec-functions-api-user.md §복귀 주소 응답 규약). 빈 문자열로 채우지
 * 않는다.
 */
export interface ResultDto {
  resultPath: ResultPath;
  isReAnnouncement: boolean;
  returnUrl?: string;
}

/** 진입 응답(GET)이 화면 문서에 실어 주는 초기 상태. */
export type EntryInitialStateDto =
  | { stage: 'IDENTITY' }
  | ({ stage: 'RESULT'; reasonCode?: string } & ResultDto);

/** 본인확인 제출(POST .../verify) 응답 본문. */
export type VerifyResponseDto =
  | { stage: 'CONSENT'; consent: ConsentConfigDto }
  | ({ stage: 'RESULT' } & ResultDto);

/** 동의·승인 제출(POST .../approve) 응답 본문 — 결과 경로 ①·③ 뿐이다. */
export type ApproveResponseDto = ResultDto;

/** FN-014 오류 응답 엔벨로프 — spec-functions-api.md §공통 응답 포맷. */
export interface ErrorResponseDto {
  code: string;
  message: string;
  details?: { field: string; reason: 'REQUIRED' | 'FORMAT' | 'LENGTH' }[];
}
