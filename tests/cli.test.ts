import { existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { indexImages, initProject, main } from '../src/cli/index.js';

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
  });

  it('initializes starter files', () => {
    const cwd = fixtureDir();

    const result = initProject({ cwd, force: false });

    expect(result.created).toEqual(
      expect.arrayContaining([
        join(cwd, 'content'),
        join(cwd, 'images'),
        join(cwd, '.f8', 'cache'),
        join(cwd, 'f8.config.toml'),
        join(cwd, 'content', 'index.md')
      ])
    );
    expect(existsSync(join(cwd, 'f8.config.toml'))).toBe(true);
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
        join(cwd, 'f8.config.toml'),
        join(cwd, 'content', 'index.md')
      ])
    );
  });

  it('indexes a directory of images into Markdown while preserving prose', async () => {
    const cwd = fixtureDir();
    initProject({ cwd, force: false });
    await sharp({
      create: {
        width: 16,
        height: 8,
        channels: 3,
        background: '#442266'
      }
    })
      .jpeg()
      .toFile(join(cwd, 'images', 'indexed-photo.jpg'));
    const outputPath = join(cwd, 'content', 'story.md');

    const result = indexImages({
      cwd,
      imageDir: 'images',
      outputPath: 'content/story.md'
    });

    expect(result.images).toHaveLength(1);
    expect(readFileSync(outputPath, 'utf8')).toContain('Welcome to f8');
    expect(readFileSync(outputPath, 'utf8')).toContain(
      '<!-- f8:index:start -->'
    );
    expect(readFileSync(outputPath, 'utf8')).toContain(
      '![](../images/indexed-photo.jpg)'
    );
  });

  it('prints index Markdown in dry-run mode', async () => {
    const cwd = fixtureDir();
    initProject({ cwd, force: false });
    await sharp({
      create: {
        width: 16,
        height: 8,
        channels: 3,
        background: '#225544'
      }
    })
      .jpeg()
      .toFile(join(cwd, 'images', 'dry-run.jpg'));
    const messages: string[] = [];

    const exitCode = await main(
      ['index', 'images', 'content/index.md', '--dry-run'],
      {
        cwd,
        stdout: (message) => messages.push(message)
      }
    );

    expect(exitCode).toBe(0);
    expect(messages.join('\n')).toContain('Generated 1 image(s).');
    expect(messages.join('\n')).toContain('![](../images/dry-run.jpg)');
  });

  it('builds images from the CLI', async () => {
    const cwd = fixtureDir();
    initProject({ cwd, force: false });
    await sharp({
      create: {
        width: 16,
        height: 8,
        channels: 3,
        background: '#224466'
      }
    })
      .jpeg()
      .toFile(join(cwd, 'images', 'cli-photo.jpg'));
    const messages: string[] = [];

    const exitCode = await main(['build-images'], {
      cwd,
      stdout: (message) => messages.push(message)
    });

    expect(exitCode).toBe(0);
    expect(messages.join('\n')).toContain('Processed 1 image(s).');
    expect(existsSync(join(cwd, '.f8', 'cache', 'cli-photo'))).toBe(true);
  });
});
