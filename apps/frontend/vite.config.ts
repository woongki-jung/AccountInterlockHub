import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 정적 빌드 산출물(dist)은 백엔드(NestJS)가 정적 콘텐츠로 서빙한다(devspec/infra.md §애플리케이션 구성).
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
});
