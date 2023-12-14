import {
  addTrafficMonitoringSearchParamsForProCDN,
  addTrafficMonitoringSearchParamsForVisitorIdRequest,
} from '../../utils/traffic'

describe('test procdn call', () => {
  test('test', () => {
    const url = new URL('https://foo.bar/agent?smth')
    addTrafficMonitoringSearchParamsForProCDN(url)

    const param = url.searchParams.get('ii')
    expect(param).toBe('fingerprintjs-pro-cloudfront/__lambda_func_version__/procdn')
  })
})

describe('test visitor call', () => {
  test('test', () => {
    const url = new URL('https://foo.bar/visitorId?smth')
    addTrafficMonitoringSearchParamsForVisitorIdRequest(url)

    const param = url.searchParams.get('ii')
    expect(param).toBe('fingerprintjs-pro-cloudfront/__lambda_func_version__/ingress')
  })
})
