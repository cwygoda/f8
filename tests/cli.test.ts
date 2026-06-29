import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
    expect(messages.join('\n')).toContain(
      'complete buildable f8 SvelteKit project'
    );
    expect(messages.join('\n')).not.toContain('index <image-dir>');
  });

  it('initializes a complete project in the current directory', () => {
    const cwd = fixtureDir();

    const result = initProject({ cwd, force: false });

    expect(result.projectRoot).toBe(cwd);
    expect(result.projectPath).toBe('.');
    expect(result.created).toEqual(
      expect.arrayContaining([
        cwd,
        join(cwd, 'package.json'),
        join(cwd, '.f8.toml'),
        join(cwd, 'svelte.config.js'),
        join(cwd, 'vite.config.ts'),
        join(cwd, 'tsconfig.json'),
        join(cwd, 'src', 'app.html'),
        join(cwd, 'src', 'routes', '+layout.ts'),
        join(cwd, 'src', 'routes', '[...slug]', '+page.server.ts'),
        join(cwd, 'src', 'routes', '[...slug]', '+page.svelte'),
        join(cwd, 'content', 'index.md')
      ])
    );
    expect(existsSync(join(cwd, 'package.json'))).toBe(true);
    expect(readFileSync(join(cwd, 'package.json'), 'utf8')).toContain(
      '"build": "svelte-kit sync && vite build"'
    );
    expect(readFileSync(join(cwd, 'vite.config.ts'), 'utf8')).toContain(
      "from '@cwygoda/f8/sveltekit'"
    );
    expect(readFileSync(join(cwd, 'content', 'index.md'), 'utf8')).toContain(
      'Welcome to f8'
    );
  });

  it('initializes a complete project in the provided directory', () => {
    const cwd = fixtureDir();
    const project = join(cwd, 'my-site');

    const result = initProject({ cwd, force: false, projectDir: 'my-site' });

    expect(result.projectRoot).toBe(project);
    expect(result.projectPath).toBe('my-site');
    expect(result.created).toEqual(
      expect.arrayContaining([
        project,
        join(project, 'package.json'),
        join(project, 'content', 'index.md')
      ])
    );
    expect(readFileSync(join(project, 'package.json'), 'utf8')).toContain(
      '"name": "my-site"'
    );
    expect(readFileSync(join(project, '.f8.toml'), 'utf8')).toContain(
      'contentDir = "content"'
    );
  });

  it('moves existing contents of the provided directory into content', () => {
    const cwd = fixtureDir();
    const project = join(cwd, 'photos');
    mkdirSync(join(project, 'album'), { recursive: true });
    writeFileSync(join(project, 'photo.jpg'), 'fake photo', 'utf8');
    writeFileSync(join(project, 'album', 'note.md'), 'nested note', 'utf8');
    writeFileSync(
      join(project, 'album', 'nested photo.png'),
      'fake nested photo',
      'utf8'
    );
    writeFileSync(join(project, 'index.md'), '# Existing photos', 'utf8');

    const result = initProject({ cwd, force: false, projectDir: 'photos' });

    expect(result.moved).toEqual(
      expect.arrayContaining([
        join(project, 'content', 'photo.jpg'),
        join(project, 'content', 'album'),
        join(project, 'content', 'index.md')
      ])
    );
    expect(existsSync(join(project, 'photo.jpg'))).toBe(false);
    expect(existsSync(join(project, 'content', 'photo.jpg'))).toBe(true);
    expect(existsSync(join(project, 'content', 'album', 'note.md'))).toBe(true);
    expect(
      existsSync(join(project, 'content', 'album', 'nested photo.png'))
    ).toBe(true);
    expect(result.updated).toContain(join(project, 'content', 'index.md'));
    const indexMarkdown = readFileSync(
      join(project, 'content', 'index.md'),
      'utf8'
    );
    expect(indexMarkdown).toContain('# Existing photos');
    expect(indexMarkdown).toContain('![photo](./photo.jpg)');
    expect(indexMarkdown).toContain(
      '![nested photo](./album/nested%20photo.png)'
    );
    expect(result.skipped).toContain(join(project, 'content', 'index.md'));
  });

  it('creates the provided project directory when it does not exist', async () => {
    const messages: string[] = [];
    const cwd = fixtureDir();

    const exitCode = await main(['init', 'photos'], {
      cwd,
      stdout: (message) => messages.push(message)
    });

    expect(exitCode).toBe(0);
    expect(messages.join('\n')).toContain('Initialized f8 project');
    expect(messages.join('\n')).toContain('  cd photos');
    expect(messages.join('\n')).not.toContain(`  cd ${join(cwd, 'photos')}`);
    expect(existsSync(join(cwd, 'photos', 'package.json'))).toBe(true);
    expect(existsSync(join(cwd, 'photos', 'content', 'index.md'))).toBe(true);
  });

  it('does not overwrite existing starter files unless forced', () => {
    const cwd = fixtureDir();
    initProject({ cwd, force: false });

    const result = initProject({ cwd, force: false });

    expect(result.skipped).toEqual(
      expect.arrayContaining([
        join(cwd, 'package.json'),
        join(cwd, '.f8.toml'),
        join(cwd, 'content', 'index.md')
      ])
    );
  });
});
