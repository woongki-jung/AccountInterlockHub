// 본인확인 제출(POST <INTERLOCK_ENTRY_PATH>/verify) 응답 본문 — spec-functions-api-user.md
// §본인확인 제출 §응답 본문. 형상은 apps/frontend/src/api/types.ts `VerifyResponseDto` 와 반드시
// 같아야 한다(entry-initial-state.model.ts 자신의 문서 주석과 같은 계약 — 필드명·구조를 임의로
// 바꾸지 않는다).
import type { ConsentItemConfig } from '../config/interlock-config.types';
import type { ResultInfo } from '../interlock-entry/entry-initial-state.model';

/** B8 이 상수 파싱 결과를 그대로 싣는 동의 항목 구성(MDL-008) — 화면이 문구를 가공하지 않는다. */
export interface ConsentResponseBody {
  readonly version: string;
  readonly notice: string;
  readonly items: ConsentItemConfig[];
}

/**
 * `stage = CONSENT`(B8 — 판정 통과, 동의 단계로 이관) 또는 `stage = RESULT`(B7 — 확정 결과
 * 재안내, `ResultInfo` 를 그대로 스프레드한다). 세 접점(진입·본인확인·승인)이 같은 `ResultInfo`
 * 형상을 공유해 화면 어댑터가 한 규칙만 쓰게 한다(entry-initial-state.model.ts 와 같은 관례).
 */
export type VerifyResponseBody =
  | { readonly stage: 'CONSENT'; readonly consent: ConsentResponseBody }
  | ({ readonly stage: 'RESULT' } & ResultInfo);
