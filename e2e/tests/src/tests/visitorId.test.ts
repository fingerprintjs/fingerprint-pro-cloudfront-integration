import { expect, test } from '@playwright/test'
import { getCloudfrontUrls, waitForCloudfront } from '../cloudfront'
import { isRequestIdValid } from '../utils/areVisitorIdAndRequestIdValid'

test.describe('visitorId', () => {
  test.beforeEach(async () => {
    await waitForCloudfront()
  })

  Object.entries(getCloudfrontUrls()).forEach(([key, url]) => {
    test(`should show correct visitorId - ${key}`, async ({ page }) => {
      await page.goto(url, {
        waitUntil: 'networkidle',
      })

      await page.click('#getData')

      const response = await page.waitForSelector('#response pre').then((element) => element.textContent())

      expect(response).toBeTruthy()

      const json = JSON.parse(response as string)

      expect(isRequestIdValid(json.requestId)).toBeTruthy()
    })
  })
})
