import { InterlockJourney } from './flow/InterlockJourney';

// 프런트엔드 셸의 조립 지점 — 디자인 토큰(main.tsx 가 불러오는
// styles/tokens.css·global.css) 위에 단계 상태머신(useInterlockFlow)과
// 공통 컴포넌트 11종을 얹은 참조 조립(InterlockJourney)을 마운트한다.
// 경로가 하나이므로(상위 제약 9) 라우터를 두지 않는다 — 이 컴포넌트
// 아래에는 URL 전환이 없다.
function App() {
  return <InterlockJourney />;
}

export default App;
