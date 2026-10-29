import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { headersFile, SECURITY_HEADERS } from './security-headers.ts';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'cloudflare-headers',
      apply: 'build',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: '_headers',
          source: headersFile(SECURITY_HEADERS),
        });
      },
    },
  ],
  preview: { headers: SECURITY_HEADERS },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
