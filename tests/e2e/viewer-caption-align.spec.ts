import { expect, test } from '@playwright/test';

const visualDiffTolerance = process.env.CI === 'true' ? 0.15 : 0.02;
const captionAlignments = ['left', 'center', 'right'] as const;

test.describe('viewer caption alignment', () => {
  for (const alignment of captionAlignments) {
    test(`matches ${alignment}-aligned caption baseline`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });

      await page.goto(`/visual-captions-${alignment}`);
      await page.waitForLoadState('networkidle');
      await page.locator('a[data-f8-viewer-trigger]').first().click();

      const dialog = page.getByRole('dialog');
      const caption = dialog.locator('.f8-viewer__caption');
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('[data-f8-viewer-image]')).toBeVisible();
      await expect(caption).toBeVisible();
      await expect(caption).toHaveAttribute('data-f8-caption-align', alignment);
      await expect(caption).toHaveClass(
        new RegExp(`f8-viewer__caption--${alignment}`)
      );

      await expect(page).toHaveScreenshot(`viewer-caption-${alignment}.png`, {
        maxDiffPixelRatio: visualDiffTolerance
      });
    });
  }
});
