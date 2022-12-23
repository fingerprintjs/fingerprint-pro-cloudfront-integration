import { expect } from '@playwright/test'
import { waitForCloudfront } from '../cloudfront'
import { isRequestIdValid } from '../utils/areVisitorIdAndRequestIdValid'
import { cloudfrontTest } from '../cloudfrontTest'

cloudfrontTest.describe('visitorId', () => {
  cloudfrontTest.beforeEach(async () => {
    await waitForCloudfront()
  })

  cloudfrontTest(`should show correct visitorId`, async ({ page }) => {
    await page.goto('/', {
      waitUntil: 'networkidle',
    })

    await page.click('#getData')

    const response = await page.waitForSelector('#response pre').then((element) => element.textContent())

    expect(response).toBeTruthy()

    const json = JSON.parse(response as string)

    expect(isRequestIdValid(json.requestId)).toBeTruthy()
  })
})
