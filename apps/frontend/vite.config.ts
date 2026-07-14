import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 정적 빌드 산출물(dist)은 백엔드(NestJS)가 정적 콘텐츠로 서빙한다(devspec/infra.md §애플리케이션 구성).
// 실 검증 경로는 build 후 백엔드 정적 서빙이며, dev 모드에서는 아래 프록시로 백엔드 API 를 경유한다.
const BACKEND_ORIGIN = process.env.VITE_BACKEND_ORIGIN ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  server: {
    // dev 서버에서 백엔드 API(/api/**)만 백엔드로 프록시한다(세션 쿠키 포함, same-origin 유지).
    // /interlock/*(사용자 이용 동의 진입·결과)는 프론트 SPA 라우트(App.tsx)이므로 프록시하지 않는다 —
    // Vite dev 가 index.html 로 SPA 폴백해야 dev(5173)에서 사용자 페이지가 열린다. 백엔드로 넘기면
    // 빌드 산출물(dist) 미생성 시 index.html 폴백이 404(ENOENT)로 깨진다. 승인 API 는
    // /api/interlock/approve 라서 /api 프록시가 그대로 잡는다(consentApi.ts).
    proxy: {
      '/api': { target: BACKEND_ORIGIN, changeOrigin: true },
    },
  },
});
