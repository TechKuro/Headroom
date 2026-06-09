import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Pure helpers run in Node — no DOM needed. Co-located *.test.js files
    // under src/ (app utils) and api/ (serverless helpers).
    environment: 'node',
    include: ['src/**/*.test.js', 'api/**/*.test.js'],
  },
});
