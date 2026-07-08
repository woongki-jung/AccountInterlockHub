// 서비스 대면 API 공통 가드(FN-004 인증·FN-014 요청제한) 타입 정의.
// API-01(처리상태 확인)·API-02(연동 완료 확인)·API-03(완료 콜백) 횡단.

/**
 * 대면 주체 — 서비스 대면 API 인증 자격은 주체별로 분리 발급·관리한다(SEC-003-03).
 *  - SERVICE_A: 서비스 A 대면 API(API-01 처리상태 확인·API-02 연동 완료 확인) 호출 주체.
 *  - SERVICE_B: 서비스 B 대면 API(API-03 완료 콜백) 호출 주체.
 * 서비스 A 자격으로 API-03 을, 서비스 B 자격으로 API-01/02 를 호출할 수 없다.
 */
export const ServiceActor = {
  SERVICE_A: 'SERVICE_A',
  SERVICE_B: 'SERVICE_B',
} as const;
export type ServiceActor = (typeof ServiceActor)[keyof typeof ServiceActor];

/**
 * 인증 통과 호출 주체(FN-004 반환). 요청 제한(FN-014) 주체 키로 사용한다.
 *  - actor: 검증된 대면 주체(SERVICE_A / SERVICE_B).
 *  - id: 호출 주체 키 ID(X-Api-Key 값). 요청 제한 버킷 키·감사 식별용. 감사·로그 출력 시 반드시 마스킹한다(SEC-005-01).
 */
export interface ServiceCaller {
  actor: ServiceActor;
  id: string;
}

/**
 * 라우트별 가드 메타데이터(@ServiceApi 데코레이터로 전달).
 *  - actor: 라우트가 요구하는 기대 주체(SEC-003-03 주체 검증 기준).
 *  - scope: 요청 제한 스코프('status' · 'completion' · 'callback'). 카운터 키·감사 target 에 쓰인다.
 */
export interface ServiceApiMetadata {
  actor: ServiceActor;
  scope: string;
}

// Express Request 타입 보강(타입 확장) — 원문 본문(HMAC 서명 대상)과 인증 통과 주체를 요청에 싣는다.
//  - rawBody: main.ts 의 body parser verify 콜백이 파싱 전 원문 Buffer 를 보존한다(본문 없으면 undefined).
//  - serviceCaller: ServiceApiGuard 통과 시 부착해 후속 컨트롤러(P2~P4)가 소비한다.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      rawBody?: Buffer;
      serviceCaller?: ServiceCaller;
    }
  }
}
