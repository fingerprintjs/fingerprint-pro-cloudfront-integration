import { expect, test } from '@playwright/test'
import { waitForCloudfront } from '../cloudfront'
import { isRequestIdValid } from '../utils/areVisitorIdAndRequestIdValid'

test.describe('visitorId', () => {
  test.beforeEach(async () => {
    await waitForCloudfront()
  })

  test(`should show correct visitorId`, async ({ page }) => {
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
