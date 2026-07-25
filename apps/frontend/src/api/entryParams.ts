// 암호값 쌍(encX·encY) 판독 — PROC-101 F2, spec-functions-api-user.md
// §생년월일 재수신 규약 3 "화면은 진입 URL 의 쿼리에서 읽어 보유한다".
//
// 진입 응답의 초기 상태에는 암호값이 실리지 않는다(`DATA-001-04`) — 화면이
// 자기 URL 의 쿼리에서 직접 읽는다.

export interface EncPair {
  encX: string;
  encY: string;
}

/**
 * `location.search` 에서 encX·encY 를 읽는다. 대소문자를 구분하며, 값이
 * 없으면 빈 문자열로 둔다 — 구조 판정은 서버(B4)가 이미 진입 응답
 * 시점에 수행했으므로 여기서 다시 검증하지 않는다(읽기만 한다).
 *
 * 호출측은 이 값을 페이지 메모리로만 보유하고 어떤 저장소·화면 요소에도
 * 쓰지 않는다(`DATA-001-02`·`DATA-001-04`).
 */
export function readEncPairFromLocation(): EncPair {
  const params = new URLSearchParams(window.location.search);
  return {
    encX: params.get('encX') ?? '',
    encY: params.get('encY') ?? '',
  };
}
