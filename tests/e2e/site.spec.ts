import { expect, test } from '@playwright/test';

const visualDiffTolerance = process.env.CI === 'true' ? 0.15 : 0.02;

test.describe('f8 static starter', () => {
  test('renders accessible editorial shell', async ({ page }) => {
    // Given the starter site has been built
    // When the reader visits /
    await page.goto('/');

    // Then they see the accessible editorial shell, page heading, and SEO description
    await expect(page.getByRole('main')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Image-first stories for SvelteKit' })
    ).toBeVisible();
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /responsive photo essays/
    );
  });

  test('does not expose original image directory from rendered pages', async ({
    page
  }) => {
    // Given Markdown references colocated images
    // When the page is rendered
    await page.goto('/demo');

    // Then original image-directory URLs are not exposed in rendered image links
    const originalImageReferences = await page
      .locator('img[src^="/images/"], a[href^="/images/"]')
      .count();
    expect(originalImageReferences).toBe(0);
  });

  test('renders responsive Markdown galleries with optimized assets', async ({
    page
  }) => {
    // Given Markdown contains consecutive image lines
    // When the reader visits /demo
    await page.goto('/demo');

    // Then f8 renders accessible gallery blocks with optimized /@f8/ assets
    await expect(
      page.getByRole('heading', { name: 'Big markdown demo' })
    ).toBeVisible();
    await expect(
      page.locator('[data-f8-block="gallery"]').first()
    ).toBeVisible();
    await expect(
      page.locator('[data-f8-block="figure"]').first()
    ).toBeVisible();
    await expect(
      page.getByRole('group', { name: /Image gallery with 8 images/ })
    ).toBeVisible();
    await expect(page.locator('img[src^="/@f8/"]').first()).toBeVisible();
  });

  test('opens an immersive viewer from a Markdown image trigger', async ({
    page
  }) => {
    // Given a rendered image gallery
    await page.goto('/demo');
    await page.waitForLoadState('networkidle');

    // When the reader activates an image
    await page.locator('a[data-f8-viewer-trigger]').first().click();

    // Then an accessible fullscreen viewer opens with image information controls
    await expect(page).toHaveURL(/\/demo$/);
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Show image information' })
    ).toBeVisible();
  });

  test('renders SEO frontmatter metadata', async ({ page }) => {
    // Given Markdown frontmatter defines title and description
    // When the page is rendered
    await page.goto('/demo');

    // Then title, description, Open Graph, and Twitter metadata match the page
    await expect(page).toHaveTitle('Big markdown demo');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      'A page with 21 Wikimedia Commons demo images, embedded EXIF, GPS samples, mixed orientations, and panoramic frames.'
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      'content',
      'Big markdown demo'
    );
    await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute(
      'content',
      'Big markdown demo'
    );
  });

  test('matches approved visual baselines for the demo page', async ({
    page
  }) => {
    // Given approved desktop and mobile screenshots exist
    // When Playwright runs visual assertions
    await page.goto('/demo');
    await page
      .locator('img[src^="/@f8/"]')
      .first()
      .waitFor({ state: 'visible' });
    await page.waitForLoadState('networkidle');

    // Then page screenshots must match their baselines within tolerance
    await expect(page).toHaveScreenshot('demo-page.png', {
      maxDiffPixelRatio: visualDiffTolerance
    });
  });

  test('matches approved visual baselines for the viewer', async ({ page }) => {
    // Given approved desktop and mobile viewer screenshots exist
    await page.goto('/demo');
    await page.waitForLoadState('networkidle');

    // When the reader opens the viewer and reveals metadata
    await page.locator('a[data-f8-viewer-trigger]').first().click();
    await page.getByRole('button', { name: 'Show image information' }).click();
    await expect(page).toHaveURL(/\/demo$/);
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
      page.getByRole('complementary', { name: 'Image information' })
    ).toBeVisible();

    // Then viewer screenshots must match their baselines within tolerance
    await expect(page).toHaveScreenshot('demo-viewer.png', {
      maxDiffPixelRatio: visualDiffTolerance
    });
  });
});
