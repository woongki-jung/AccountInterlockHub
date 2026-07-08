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
    // dev 서버에서 same-origin 상대 경로(/api·/interlock)를 백엔드로 프록시한다(세션 쿠키 포함).
    proxy: {
      '/api': { target: BACKEND_ORIGIN, changeOrigin: true },
      '/interlock': { target: BACKEND_ORIGIN, changeOrigin: true },
    },
  },
});
