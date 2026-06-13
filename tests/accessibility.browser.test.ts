import { mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { F8Gallery, F8Viewer } from '../src/lib/index.js';
import type { F8ImageMetadata } from '../src/lib/types.js';

const mounted: unknown[] = [];

afterEach(() => {
  for (const component of mounted.splice(0)) {
    unmount(component as never);
  }
  document.body.innerHTML = '';
  document.body.style.removeProperty('overflow');
});

describe('automated accessibility checks', () => {
  it('renders gallery controls with usable names and image alternatives', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    mounted.push(
      mount(F8Gallery, {
        target,
        props: { images: [imageFixture('one'), imageFixture('two')] }
      })
    );
    await tick();

    expect(collectA11yIssues(target)).toEqual([]);
  });

  it('renders viewer dialog with modal semantics and labelled controls', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    mounted.push(
      mount(F8Viewer, {
        target,
        props: {
          images: [imageFixture('one'), imageFixture('two')],
          open: true
        }
      })
    );
    await tick();

    expect(collectA11yIssues(document.body)).toEqual([]);
  });
});

function collectA11yIssues(root: ParentNode): string[] {
  const issues: string[] = [];

  for (const image of root.querySelectorAll<HTMLImageElement>('img')) {
    if (!image.hasAttribute('alt')) {
      issues.push(`img missing alt: ${image.outerHTML}`);
    }
  }

  for (const button of root.querySelectorAll<HTMLButtonElement>('button')) {
    const name = button.getAttribute('aria-label') ?? button.textContent ?? '';
    if (name.trim().length === 0) {
      issues.push(`button missing accessible name: ${button.outerHTML}`);
    }
  }

  for (const dialog of root.querySelectorAll<HTMLElement>('[role="dialog"]')) {
    if (dialog.getAttribute('aria-modal') !== 'true') {
      issues.push('dialog missing aria-modal=true');
    }
    if (
      !dialog.hasAttribute('aria-label') &&
      !dialog.hasAttribute('aria-labelledby')
    ) {
      issues.push('dialog missing accessible name');
    }
  }

  return issues;
}

function imageFixture(id: 'one' | 'two'): F8ImageMetadata {
  const title = id === 'one' ? 'Alpine lake' : 'Forest path';

  return {
    id,
    sourcePath: `images/${id}.jpg`,
    relativePath: `${id}.jpg`,
    alt: title,
    title,
    description: id === 'one' ? 'A cold morning' : 'Green shade',
    width: id === 'one' ? 1280 : 960,
    height: id === 'one' ? 800 : 1200,
    aspectRatio: id === 'one' ? 1.6 : 0.8,
    dominantColors: id === 'one' ? ['#223344'] : ['#334422'],
    variants: [
      {
        width: 640,
        height: id === 'one' ? 400 : 800,
        format: 'jpeg',
        src: `/assets/${id}-640.jpeg`,
        sizeBytes: 30
      }
    ]
  };
}
