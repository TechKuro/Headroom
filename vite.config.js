import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Pure helpers run in Node — no DOM needed. Co-located *.test.js files.
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
