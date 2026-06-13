import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

import { f8Vite } from './src/lib/sveltekit/index.js';

export default defineConfig({
  plugins: [f8Vite(), sveltekit()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/**/*.test.ts'],
          exclude: ['tests/**/*.browser.test.ts']
        }
      },
      {
        extends: true,
        resolve: {
          conditions: ['browser']
        },
        test: {
          name: 'browser',
          environment: 'jsdom',
          include: ['tests/**/*.browser.test.ts']
        }
      }
    ]
  }
});
