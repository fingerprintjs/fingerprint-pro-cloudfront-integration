import { expect, Page } from '@playwright/test'
import { waitForCloudfront } from '../cloudfront'
import { isRequestIdValid } from '../utils/areVisitorIdAndRequestIdValid'
import { cloudfrontTest } from '../cloudfrontTest'
import { trackRequests } from '../utils/playwright'
import { version } from '../../../../package.json'

async function checkResponse(page: Page) {
  const response = await page.waitForSelector('#response pre').then((element) => element.textContent())

  expect(response).toBeTruthy()

  const json = JSON.parse(response as string)

  expect(isRequestIdValid(json.requestId)).toBeTruthy()
}

cloudfrontTest.describe('visitorId', () => {
  cloudfrontTest.beforeEach(async () => {
    await waitForCloudfront()
  })

  cloudfrontTest('should return 404 if customer variables are missing', async ({ page, urlType }) => {
    if (urlType !== 'cloudfrontWithoutVariables') {
      cloudfrontTest.skip()
    }

    const { getRequests } = trackRequests(page)

    await page.goto('/', {
      waitUntil: 'networkidle',
    })

    await page.click('#getData')

    await page.waitForResponse(/fpjs\/visitorId/)

    const requests = getRequests()
    expect(requests).toHaveLength(5)

    const [, , agentRequest, , apiRequest] = requests

    const agentResponse = await agentRequest.response()
    const apiRequestResponse = await apiRequest.response()

    expect(agentResponse?.status()).toBe(200)
    expect(apiRequestResponse?.status()).toBe(404)
  })

  cloudfrontTest('should show correct visitorId using lambda endpoints', async ({ page, urlType, baseURL }) => {
    if (urlType === 'cloudfrontWithoutVariables') {
      cloudfrontTest.skip()
    }

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
    expect(apiRequestUrl.searchParams.get('ii')).toEqual(`fingerprintjs-pro-cloudfront/${version}/procdn`)
  })
})
