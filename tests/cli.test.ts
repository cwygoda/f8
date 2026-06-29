import { existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { initProject, main } from '../src/cli/index.js';

function fixtureDir(): string {
  return join(tmpdir(), `f8-cli-${randomUUID()}`);
}

describe('f8 CLI', () => {
  it('prints help', async () => {
    const messages: string[] = [];

    const exitCode = await main(['--help'], {
      cwd: fixtureDir(),
      stdout: (message) => messages.push(message)
    });

    expect(exitCode).toBe(0);
    expect(messages.join('\n')).toContain('Usage:');
    expect(messages.join('\n')).not.toContain('index <image-dir>');
  });

  it('initializes starter files', () => {
    const cwd = fixtureDir();

    const result = initProject({ cwd, force: false });

    expect(result.created).toEqual(
      expect.arrayContaining([
        join(cwd, 'content'),
        join(cwd, '.f8.toml'),
        join(cwd, 'content', 'index.md')
      ])
    );
    expect(result.created).not.toContain(join(cwd, 'images'));
    expect(existsSync(join(cwd, '.f8.toml'))).toBe(true);
    expect(readFileSync(join(cwd, 'content', 'index.md'), 'utf8')).toContain(
      'Welcome to f8'
    );
  });

  it('does not overwrite existing starter files unless forced', () => {
    const cwd = fixtureDir();
    initProject({ cwd, force: false });

    const result = initProject({ cwd, force: false });

    expect(result.skipped).toEqual(
      expect.arrayContaining([
        join(cwd, '.f8.toml'),
        join(cwd, 'content', 'index.md')
      ])
    );
  });
});
