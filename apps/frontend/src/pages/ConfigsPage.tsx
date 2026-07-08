/*
 * SCR-002 연동 구성 목록 — 스텁(플레이스홀더).
 * 로그인 성공 후 이동 대상(POST_LOGIN_PATH)을 확보하기 위한 최소 화면이다.
 * 실제 목록·상세·AdminNav·인증 가드는 후속 Phase(ADM-P7)에서 구현한다.
 */
export function ConfigsPage() {
  return (
    <main style={{ maxWidth: 1120, margin: '0 auto', padding: 24 }}>
      <h1>연동 구성 목록</h1>
      <p>로그인에 성공했습니다. 연동 구성 목록 화면(SCR-002)은 후속 단계에서 구현됩니다.</p>
    </main>
  );
}

export default ConfigsPage;
