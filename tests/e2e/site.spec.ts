import { expect, test } from '@playwright/test';

test.describe('f8 static starter', () => {
  test('renders accessible editorial shell', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('main')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Image-first stories for SvelteKit' })
    ).toBeVisible();
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /static photo essay/
    );
  });

  test('does not expose original image directory from rendered pages', async ({
    page
  }) => {
    await page.goto('/');

    const originalImageReferences = await page
      .locator('img[src^="/images/"], a[href^="/images/"]')
      .count();
    expect(originalImageReferences).toBe(0);
  });
});
