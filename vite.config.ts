import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
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
