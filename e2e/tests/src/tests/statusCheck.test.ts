import { expect } from '@playwright/test'
import { cloudfrontTest as test } from '../cloudfrontTest'
import { waitForCloudfront } from '../utils/cloudfront'

test.describe('Status check', () => {
  test.beforeEach(async () => {
    await waitForCloudfront()
  })
  
  test('should return correct status info', async ({ page }) => {
    await page.goto('/fpjs/status', {
      waitUntil: 'networkidle',
    })

    await expect(page.waitForSelector('text="✅ All environment variables are set"')).resolves.not.toThrow()
  })
})
