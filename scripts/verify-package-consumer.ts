import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const root = process.cwd();
const fixture = join(tmpdir(), `f8-consumer-${process.pid}`);
const packageLink = join(fixture, 'node_modules', '@cwygoda', 'f8');

rmSync(fixture, { force: true, recursive: true });
mkdirSync(dirname(packageLink), { recursive: true });
symlinkSync(root, packageLink, 'dir');

writeFileSync(
  join(fixture, 'package.json'),
  JSON.stringify(
    { type: 'module', dependencies: { '@cwygoda/f8': 'file:.' } },
    null,
    2
  ),
  'utf8'
);
writeFileSync(
  join(fixture, 'tsconfig.json'),
  JSON.stringify(
    {
      compilerOptions: {
        strict: true,
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        skipLibCheck: true,
        allowSyntheticDefaultImports: true
      },
      include: ['consumer.ts']
    },
    null,
    2
  ),
  'utf8'
);
writeFileSync(
  join(fixture, 'consumer.ts'),
  `import { F8Gallery, loadConfig, renderMarkdown } from '@cwygoda/f8';
import { f8SvelteKit } from '@cwygoda/f8/sveltekit';
import F8ImageComponent from '@cwygoda/f8/components/F8Image.svelte';
import type { F8ImageMetadata } from '@cwygoda/f8/types';

const image: F8ImageMetadata = {
  id: 'example',
  sourcePath: '/assets/example.jpg',
  relativePath: 'example.jpg',
  width: 1,
  height: 1,
  aspectRatio: 1,
  dominantColors: [],
  variants: []
};

loadConfig({ cwd: '.', env: {} });
renderMarkdown('![Example](./images/example.jpg)', { images: [image] });
f8SvelteKit({ images: [image] });
void F8Gallery;
void F8ImageComponent;
`,
  'utf8'
);

execFileSync(
  resolve(root, 'node_modules', '.bin', 'tsc'),
  ['-p', join(fixture, 'tsconfig.json'), '--noEmit'],
  { stdio: 'inherit' }
);

rmSync(fixture, { force: true, recursive: true });
console.log('Package exports resolve from a separate TypeScript fixture.');
