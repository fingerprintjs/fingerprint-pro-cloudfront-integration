import {
  addTrafficMonitoringSearchParamsForProCDN,
  addTrafficMonitoringSearchParamsForVisitorIdRequest,
} from '../../utils/traffic'

describe('test procdn call', () => {
  test('test', () => {
    const url = new URL('https://fpjs.sh/agent?smth')
    addTrafficMonitoringSearchParamsForProCDN(url)

    const param = url.searchParams.get('ii')
    expect(param).toBe('fingerprintjs-pro-cloudfront/__lambda_func_version__/procdn')
  })
})

describe('test visitor call', () => {
  test('test', () => {
    const url = new URL('https://fpjs.sh/visitorId?smth')
    addTrafficMonitoringSearchParamsForVisitorIdRequest(url)

    const param = url.searchParams.get('ii')
    expect(param).toBe('fingerprintjs-pro-cloudfront/__lambda_func_version__/ingress')
  })
})
