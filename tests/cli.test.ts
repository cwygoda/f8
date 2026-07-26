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
    // Given an existing f8 starter project
    const cwd = fixtureDir();
    initProject({ cwd, force: false });

    // When the user runs f8 init again
    const result = initProject({ cwd, force: false });

    // Then f8 skips existing starter files instead of overwriting them
    expect(result.skipped).toEqual(
      expect.arrayContaining([
        join(cwd, 'package.json'),
        join(cwd, '.f8.toml'),
        join(cwd, 'content', 'index.md')
      ])
    );
  });

  it('overwrites starter files when forced', () => {
    // Given an existing starter file with local edits
    const cwd = fixtureDir();
    initProject({ cwd, force: false });
    writeFileSync(join(cwd, 'content', 'index.md'), '# Local draft\n', 'utf8');

    // When the user runs f8 init --force
    const result = initProject({ cwd, force: true });

    // Then f8 restores starter contents and reports the file as written
    expect(result.created).toContain(join(cwd, 'content', 'index.md'));
    expect(result.skipped).not.toContain(join(cwd, 'content', 'index.md'));
    expect(readFileSync(join(cwd, 'content', 'index.md'), 'utf8')).toContain(
      'Welcome to f8'
    );
  });

  it('prints resolved configuration as JSON', async () => {
    // Given a project with .f8.toml
    const cwd = fixtureDir();
    mkdirSync(cwd, { recursive: true });
    writeFileSync(
      join(cwd, '.f8.toml'),
      `contentDir = "stories"\n\n[site]\ntitle = "CLI Site"\n`,
      'utf8'
    );
    const messages: string[] = [];

    // When the user runs f8 config
    const exitCode = await main(['config'], {
      cwd,
      stdout: (message) => messages.push(message)
    });

    // Then f8 prints the resolved configuration and source path as JSON
    const output = JSON.parse(messages.join('\n')) as {
      path: string;
      config: { contentDir: string; site: { title: string } };
    };
    expect(exitCode).toBe(0);
    expect(output.path).toBe(join(cwd, '.f8.toml'));
    expect(output.config.contentDir).toBe('stories');
    expect(output.config.site.title).toBe('CLI Site');
  });

  it('returns actionable errors for unknown commands and invalid config', async () => {
    // Given a terminal in an f8 workspace
    const cwd = fixtureDir();
    mkdirSync(cwd, { recursive: true });
    const errors: string[] = [];

    // When the user runs an unknown command
    const unknownExitCode = await main(['publish'], {
      cwd,
      stderr: (message) => errors.push(message)
    });

    // Then f8 exits non-zero and prints supported usage
    expect(unknownExitCode).toBe(1);
    expect(errors.join('\n')).toContain('Unknown command: publish');
    expect(errors.join('\n')).toContain('Usage:');

    // Given invalid project configuration
    writeFileSync(join(cwd, '.f8.toml'), 'unknownKey = true\n', 'utf8');
    errors.length = 0;

    // When the user asks f8 to inspect config
    const configExitCode = await main(['config'], {
      cwd,
      stderr: (message) => errors.push(message)
    });

    // Then f8 exits non-zero and points at configuration validation
    expect(configExitCode).toBe(1);
    expect(errors.join('\n')).toContain('Invalid f8 configuration');
  });
});
