import { expect, Page } from '@playwright/test'
import { waitForCloudfront } from '../utils/cloudfront'
import { isRequestIdValid } from '../utils/areVisitorIdAndRequestIdValid'
import { cloudfrontTest as test } from '../cloudfrontTest'
import { trackRequests } from '../utils/playwright'

async function checkResponse(page: Page) {
  const response = await page.waitForSelector('#response pre').then((element) => element.textContent())

  expect(response).toBeTruthy()

  const json = JSON.parse(response as string)

  expect(isRequestIdValid(json.requestId)).toBeTruthy()
}

test.describe('visitorId', () => {
  test.beforeEach(async () => {
    await waitForCloudfront()
  })

  test('should show correct visitorId using lambda endpoints', async ({ page, baseURL }) => {
    const rootUrl = new URL(baseURL as string)

    const { getRequests } = trackRequests(page)

    await page.goto('/', {
      waitUntil: 'networkidle',
    })

    await page.click('#getData')

    await checkResponse(page)

    const requests = getRequests()
    expect(requests).toHaveLength(5)

    const [, , agentRequest, , apiRequest] = requests

    const agentRequestUrl = new URL(agentRequest.url())
    expect(agentRequestUrl.hostname).toBe(rootUrl.hostname)

    const apiRequestUrl = new URL(apiRequest.url())
    expect(apiRequestUrl.hostname).toBe(rootUrl.hostname)
    expect(apiRequestUrl.searchParams.get('ii')).toContain(`fingerprintjs-pro-cloudfront/`)
    expect(apiRequestUrl.searchParams.get('ii')).toContain(`/procdn`)
  })
})
