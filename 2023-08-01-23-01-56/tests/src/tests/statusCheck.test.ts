import { expect } from '@playwright/test'
import { cloudfrontTest } from '../cloudfrontTest'

cloudfrontTest.describe('Status check', () => {
  cloudfrontTest('should return correct status info', async ({ page, urlType }) => {
    await page.goto('/fpjs/status', {
      waitUntil: 'networkidle',
    })

    if (urlType === 'cloudfrontWithoutVariables') {
      // Assert that there are warnings for every missing variable (should be 4 of them)
      const envItems = await page.$$('.env-info-item')

      expect(envItems).toHaveLength(4)
    } else {
      await expect(page.waitForSelector('text="✅ All environment variables are set"')).resolves.not.toThrow()
    }
  })
})
