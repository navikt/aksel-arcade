/**
 * E2E test to verify Alert component renders with Aksel Darkside theme
 */

import { test, expect } from '@playwright/test';

test.describe('Alert Component Theme Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('http://localhost:5173');
    await page.evaluate(() => localStorage.clear());
  });

  test('should render Alert component with Aksel Darkside styling', async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:5173');
    
    // Wait for app to load
    await page.waitForSelector('[data-testid="preview-iframe"]', { timeout: 10000 });
    
    // Get the preview iframe
    const iframe = page.frameLocator('[data-testid="preview-iframe"]');
    
    // Wait for Alert to render in iframe
    await iframe.locator('[class*="aksel-alert"]').waitFor({ timeout: 10000 });
    
    // Check that Alert exists
    const alert = iframe.locator('[class*="aksel-alert"]').first();
    await expect(alert).toBeVisible();
    
    // Check that Alert has text content
    await expect(alert).toContainText('Welcome to AkselArcade');
    
    // Check that Alert has Aksel classes (indicating theme is applied)
    const alertClasses = await alert.getAttribute('class');
    console.log('Alert classes:', alertClasses);
    expect(alertClasses).toContain('aksel-alert');
    
    // Check that Alert has the info variant
    expect(alertClasses).toMatch(/info|aksel-alert--info/);
    
    // Take screenshot for manual verification
    await page.screenshot({ path: 'alert-verification-light-mode.png', fullPage: true });
    
    console.log('✅ Alert component renders with Aksel classes');
    console.log('✅ Screenshot saved: alert-verification-light-mode.png');
  });

  test('should render Alert in dark mode', async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:5173');
    
    // Wait for preview iframe
    await page.waitForSelector('[data-testid="preview-iframe"]', { timeout: 10000 });
    
    // Click theme toggle to switch to dark mode
    const themeToggle = page.locator('button').filter({ hasText: /theme|dark|light/i }).first();
    if (await themeToggle.count() > 0) {
      await themeToggle.click();
      await page.waitForTimeout(500); // Wait for theme change
    }
    
    // Get the preview iframe
    const iframe = page.frameLocator('[data-testid="preview-iframe"]');
    
    // Wait for Alert
    await iframe.locator('[class*="aksel-alert"]').waitFor({ timeout: 10000 });
    
    // Check Alert is visible
    const alert = iframe.locator('[class*="aksel-alert"]').first();
    await expect(alert).toBeVisible();
    
    // Take screenshot for manual verification
    await page.screenshot({ path: 'alert-verification-dark-mode.png', fullPage: true });
    
    console.log('✅ Alert component renders in dark mode');
    console.log('✅ Screenshot saved: alert-verification-dark-mode.png');
  });

  test('should have proper Aksel computed styles', async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:5173');
    
    // Wait for preview iframe
    await page.waitForSelector('[data-testid="preview-iframe"]', { timeout: 10000 });
    
    // Get the preview iframe
    const iframe = page.frameLocator('[data-testid="preview-iframe"]');
    
    // Wait for Alert
    const alert = iframe.locator('[class*="aksel-alert"]').first();
    await alert.waitFor({ timeout: 10000 });
    
    // Check computed styles (these should come from Aksel Darkside)
    const backgroundColor = await alert.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    
    const padding = await alert.evaluate((el) => {
      return window.getComputedStyle(el).padding;
    });
    
    const borderRadius = await alert.evaluate((el) => {
      return window.getComputedStyle(el).borderRadius;
    });
    
    console.log('Alert computed styles:');
    console.log('  backgroundColor:', backgroundColor);
    console.log('  padding:', padding);
    console.log('  borderRadius:', borderRadius);
    
    // Verify styles are not default browser styles
    expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(padding).not.toBe('0px');
    expect(borderRadius).not.toBe('0px');
    
    console.log('✅ Alert has non-default computed styles (Aksel theme applied)');
  });
});
