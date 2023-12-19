import { Page, Request } from '@playwright/test'

export function trackRequests(page: Page) {
  const requests: Request[] = []

  page.on('request', (request) => {
    requests.push(request)
  })

  return {
    getRequests: () => {
      return requests as ReadonlyArray<Request>
    },
  }
}
