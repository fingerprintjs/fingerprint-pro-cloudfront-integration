import {
  filterRequestHeaders,
  getHost,
  prepareHeadersForIngressAPI,
  updateResponseHeaders,
  updateResponseHeadersForAgentDownload,
} from '../../utils'
import { CloudFrontHeaders, CloudFrontRequest } from 'aws-lambda'
import { IncomingHttpHeaders } from 'http'
import { CustomerVariables } from '../../utils/customer-variables/customer-variables'
import { HeaderCustomerVariables } from '../../utils/customer-variables/header-customer-variables'

const getCustomerVariables = (request: CloudFrontRequest) =>
  new CustomerVariables([new HeaderCustomerVariables(request)])

describe('test fpjs-headers preparation', () => {
  test('verify existing values', async () => {
    const req: CloudFrontRequest = {
      clientIp: '1.1.1.1',
      method: 'GET',
      uri: 'fpjs/agent',
      querystring: 'apiKey=ujKG34hUYKLJKJ1F&version=3&loaderVersion=3.6.2',
      headers: {
        'content-type': [
          {
            key: 'content-type',
            value: 'application/json',
          },
        ],
        'content-length': [
          {
            key: 'content-length',
            value: '24354',
          },
        ],
        host: [
          {
            key: 'host',
            value: 'foo.bar',
          },
        ],
        'transfer-encoding': [
          {
            key: 'transfer-encoding',
            value: 'br',
          },
        ],
        via: [
          {
            key: 'via',
            value: 'cloudfront.net',
          },
        ],
        cookie: [
          {
            key: 'cookie',
            value: '_iidt=7A03Gwg; _vid_t=gEFRuIQlzYmv692/UL4GLA==',
          },
        ],
        'x-amzn-cf-id': [
          {
            key: 'x-amzn-cf-id',
            value: 'some value',
          },
        ],
        'x-amz-cf-id': [
          {
            key: 'x-amz-cf-id',
            value: 'some value',
          },
        ],
        'x-amz-cf-yyy': [
          {
            key: 'x-amz-cf-yyy',
            value: 'some value',
          },
        ],
        'x-amzn-cf-zzz': [
          {
            key: 'x-amzn-cf-zzz',
            value: 'some-value',
          },
        ],
        'x-custom-header': [
          {
            key: 'x-custom-header',
            value: 'value123899',
          },
        ],
        'x-edge-qqq': [
          {
            key: 'x-edge-qqq',
            value: 'some value',
          },
        ],
        'strict-transport-security': [
          {
            key: 'strict-transport-security',
            value: 'max-age=600',
          },
        ],
      },
      origin: {
        custom: {
          domainName: 'adewe.cloudfront.net',
          keepaliveTimeout: 60,
          path: '/',
          port: 443,
          protocol: 'https',
          readTimeout: 60,
          sslProtocols: ['TLSv2'],
          customHeaders: {
            fpjs_pre_shared_secret: [
              {
                key: 'fpjs_pre_shared_secret',
                value: 'qwertyuio1356767',
              },
            ],
          },
        },
      },
    }
    const headers = await prepareHeadersForIngressAPI(req, getCustomerVariables(req))
    expect(headers['fpjs-proxy-client-ip']).toBe('1.1.1.1')
    expect(headers['fpjs-proxy-secret']).toBe('qwertyuio1356767')
    expect(headers['fpjs-proxy-forwarded-host']).toBe('foo.bar')
  })

  test('secret is not defined', async () => {
    const req: CloudFrontRequest = {
      clientIp: '1.1.1.1',
      method: 'GET',
      uri: 'fpjs/agent',
      querystring: 'apiKey=ujKG34hUYKLJKJ1F&version=3&loaderVersion=3.6.2',
      headers: {
        'content-type': [
          {
            key: 'content-type',
            value: 'application/json',
          },
        ],
        'content-length': [
          {
            key: 'content-length',
            value: '24354',
          },
        ],
        host: [
          {
            key: 'host',
            value: 'foo.bar',
          },
        ],
        'transfer-encoding': [
          {
            key: 'transfer-encoding',
            value: 'br',
          },
        ],
        via: [
          {
            key: 'via',
            value: 'cloudfront.net',
          },
        ],
        cookie: [
          {
            key: 'cookie',
            value: '_iidt=7A03Gwg; _vid_t=gEFRuIQlzYmv692/UL4GLA==',
          },
        ],
        'x-amzn-cf-id': [
          {
            key: 'x-amzn-cf-id',
            value: 'some value',
          },
        ],
        'x-amz-cf-id': [
          {
            key: 'x-amz-cf-id',
            value: 'some value',
          },
        ],
        'x-amz-cf-yyy': [
          {
            key: 'x-amz-cf-yyy',
            value: 'some value',
          },
        ],
        'x-amzn-cf-zzz': [
          {
            key: 'x-amzn-cf-zzz',
            value: 'some-value',
          },
        ],
        'x-custom-header': [
          {
            key: 'x-custom-header',
            value: 'value123899',
          },
        ],
        'x-edge-qqq': [
          {
            key: 'x-edge-qqq',
            value: 'some value',
          },
        ],
        'strict-transport-security': [
          {
            key: 'strict-transport-security',
            value: 'max-age=600',
          },
        ],
      },
      origin: {
        custom: {
          domainName: 'adewe.cloudfront.net',
          keepaliveTimeout: 60,
          path: '/',
          port: 443,
          protocol: 'https',
          readTimeout: 60,
          sslProtocols: ['TLSv2'],
          customHeaders: {},
        },
      },
    }
    const headers = await prepareHeadersForIngressAPI(req, getCustomerVariables(req))
    expect(headers['fpjs-proxy-client-ip']).toBe('1.1.1.1')
    expect(headers.hasOwnProperty('fpjs-proxy-secret')).toBeFalsy()
    expect(headers['fpjs-proxy-forwarded-host']).toBe('foo.bar')
  })
})

describe('filterRequestHeaders', () => {
  test('test filtering blackilisted headers', () => {
    const req: CloudFrontRequest = {
      clientIp: '1.1.1.1',
      method: 'GET',
      uri: 'fpjs/agent',
      querystring: 'apiKey=ujKG34hUYKLJKJ1F&version=3&loaderVersion=3.6.2',
      headers: {
        'content-type': [
          {
            key: 'content-type',
            value: 'application/json',
          },
        ],
        'content-length': [
          {
            key: 'content-length',
            value: '24354',
          },
        ],
        host: [
          {
            key: 'host',
            value: 'foo.bar',
          },
        ],
        'transfer-encoding': [
          {
            key: 'transfer-encoding',
            value: 'br',
          },
        ],
        via: [
          {
            key: 'via',
            value: 'cloudfront.net',
          },
        ],
        cookie: [
          {
            key: 'cookie',
            value: '_iidt=7A03Gwg; _vid_t=gEFRuIQlzYmv692/UL4GLA==',
          },
        ],
        'x-amzn-cf-id': [
          {
            key: 'x-amzn-cf-id',
            value: 'some value',
          },
        ],
        'x-amz-cf-id': [
          {
            key: 'x-amz-cf-id',
            value: 'some value',
          },
        ],
        'x-amz-cf-yyy': [
          {
            key: 'x-amz-cf-yyy',
            value: 'some value',
          },
        ],
        'x-amzn-cf-zzz': [
          {
            key: 'x-amzn-cf-zzz',
            value: 'some-value',
          },
        ],
        'x-custom-header': [
          {
            key: 'x-custom-header',
            value: 'value123899',
          },
        ],
        'x-edge-qqq': [
          {
            key: 'x-edge-qqq',
            value: 'some value',
          },
        ],
        'strict-transport-security': [
          {
            key: 'strict-transport-security',
            value: 'max-age=600',
          },
        ],
      },
    }
    const headers = filterRequestHeaders(req)

    expect(headers.hasOwnProperty('content-length')).toBe(false)
    expect(headers.hasOwnProperty('host')).toBe(false)
    expect(headers.hasOwnProperty('transfer-encoding')).toBe(false)
    expect(headers.hasOwnProperty('via')).toBe(false)
    expect(headers['content-type']).toBe('application/json')
    expect(headers['cookie']).toBe('_iidt=7A03Gwg')
    expect(headers['x-custom-header']).toBe('value123899')
    expect(headers['x-amzn-cf-zzz']).toBe('some-value')
    expect(headers.hasOwnProperty('x-amzn-cf-id')).toBe(false)
    expect(headers.hasOwnProperty('x-amz-cf-id')).toBe(false)
    expect(headers.hasOwnProperty('x-amz-cf-yyy')).toBe(false)
    expect(headers.hasOwnProperty('x-edge-qqq')).toBe(false)
    expect(headers.hasOwnProperty('strict-transport-security')).toBe(false)
  })
})

describe('updateResponseHeaders', () => {
  test('test', () => {
    const headers: IncomingHttpHeaders = {
      'access-control-allow-credentials': 'true',
      'access-control-allow-origin': 'true',
      'access-control-expose-headers': 'true',
      'cache-control': 'public, max-age=40000, s-maxage=40000',
      'content-encoding': 'br',
      'content-length': '73892',
      'content-type': 'application/json',
      'cross-origin-resource-policy': 'cross-origin',
      etag: 'dskjhfadsjk',
      'set-cookie': ['_iidf; HttpOnly; Domain=foo.bar'],
      vary: 'Accept-Encoding',
      'custom-header-1': 'gdfddfd',
      'x-amz-cf-id': 'qwewrwer',
      'x-amz-cf-pop': 'dsjfdsa',
      'x-amzn-cf-id': 'zxcvbn',
      'x-amz-cf-xxx': 'cxc',
      'x-edge-xxx': 'ery8u',
      'strict-transport-security': 'max-age=1000',
    }
    const cfHeaders: CloudFrontHeaders = updateResponseHeaders(headers)
    expect(cfHeaders.hasOwnProperty('custom-header-1')).toBe(true)
    expect(cfHeaders.hasOwnProperty('content-length')).toBe(false)
    expect(cfHeaders.hasOwnProperty('x-amz-cf-id')).toBe(false)
    expect(cfHeaders.hasOwnProperty('x-amzn-cf-id')).toBe(false)
    expect(cfHeaders.hasOwnProperty('x-amz-cf-pop')).toBe(false)
    expect(cfHeaders.hasOwnProperty('x-amz-cf-xxx')).toBe(false)
    expect(cfHeaders.hasOwnProperty('x-edge-xxx')).toBe(false)
    expect(cfHeaders['cache-control'][0].value).toBe('public, max-age=40000, s-maxage=40000')
    expect(cfHeaders['set-cookie'][0].value).toBe('_iidf; HttpOnly; Domain=foo.bar')
    expect(cfHeaders.hasOwnProperty('strict-transport-security')).toBe(false)
  })

  test('update cache policy', () => {
    const headers: IncomingHttpHeaders = {
      'access-control-allow-credentials': 'true',
      'access-control-allow-origin': 'true',
      'access-control-expose-headers': 'true',
      'cache-control': 'no-cache',
      'content-encoding': 'br',
      'content-length': '73892',
      'content-type': 'application/json',
      'cross-origin-resource-policy': 'cross-origin',
      etag: 'dskjhfadsjk',
      'set-cookie': ['_iidf; HttpOnly; Domain=foo.bar'],
      vary: 'Accept-Encoding',
      'custom-header-1': 'gdfddfd',
    }
    const cfHeaders: CloudFrontHeaders = updateResponseHeaders(headers)
    expect(cfHeaders.hasOwnProperty('custom-header-1')).toBe(true)
    expect(cfHeaders.hasOwnProperty('content-length')).toBe(false)
    expect(cfHeaders['cache-control'][0].value).toBe('no-cache')
    expect(cfHeaders['set-cookie'][0].value).toBe('_iidf; HttpOnly; Domain=foo.bar')
  })
})

describe('updateResponseHeadersForAgentDownload', () => {
  test('test', () => {
    const headers: IncomingHttpHeaders = {
      'access-control-allow-credentials': 'true',
      'access-control-allow-origin': 'true',
      'access-control-expose-headers': 'true',
      'cache-control': 'public, max-age=40000, s-maxage=40000',
      'content-encoding': 'br',
      'content-length': '73892',
      'content-type': 'application/json',
      'cross-origin-resource-policy': 'cross-origin',
      etag: 'dskjhfadsjk',
      'set-cookie': ['_iidf; HttpOnly; Domain=foo.bar'],
      vary: 'Accept-Encoding',
      'custom-header-1': 'gdfddfd',
      'x-amz-cf-id': 'qwewrwer',
      'x-amz-cf-pop': 'dsjfdsa',
      'x-amzn-cf-id': 'zxcvbn',
      'x-amz-cf-xxx': 'cxc',
      'x-edge-xxx': 'ery8u',
      'strict-transport-security': 'max-age=1000',
    }
    const cfHeaders: CloudFrontHeaders = updateResponseHeadersForAgentDownload(headers)
    expect(cfHeaders.hasOwnProperty('custom-header-1')).toBe(true)
    expect(cfHeaders.hasOwnProperty('content-length')).toBe(false)
    expect(cfHeaders.hasOwnProperty('x-amz-cf-id')).toBe(false)
    expect(cfHeaders.hasOwnProperty('x-amzn-cf-id')).toBe(false)
    expect(cfHeaders.hasOwnProperty('x-amz-cf-pop')).toBe(false)
    expect(cfHeaders.hasOwnProperty('x-amz-cf-xxx')).toBe(false)
    expect(cfHeaders.hasOwnProperty('x-edge-xxx')).toBe(false)
    expect(cfHeaders['cache-control'][0].value).toBe('public, max-age=3600, s-maxage=60')
    expect(cfHeaders['set-cookie'][0].value).toBe('_iidf; HttpOnly; Domain=foo.bar')
    expect(cfHeaders.hasOwnProperty('strict-transport-security')).toBe(false)
  })

  test('update cache policy', () => {
    const headers: IncomingHttpHeaders = {
      'access-control-allow-credentials': 'true',
      'access-control-allow-origin': 'true',
      'access-control-expose-headers': 'true',
      'cache-control': 'no-cache',
      'content-encoding': 'br',
      'content-length': '73892',
      'content-type': 'application/json',
      'cross-origin-resource-policy': 'cross-origin',
      etag: 'dskjhfadsjk',
      'set-cookie': ['_iidf; HttpOnly; Domain=foo.bar'],
      vary: 'Accept-Encoding',
      'custom-header-1': 'gdfddfd',
    }
    const cfHeaders: CloudFrontHeaders = updateResponseHeadersForAgentDownload(headers)
    expect(cfHeaders.hasOwnProperty('custom-header-1')).toBe(true)
    expect(cfHeaders.hasOwnProperty('content-length')).toBe(false)
    expect(cfHeaders['cache-control'][0].value).toBe('no-cache, max-age=3600, s-maxage=60')
    expect(cfHeaders['set-cookie'][0].value).toBe('_iidf; HttpOnly; Domain=foo.bar')
  })
})

describe('checkHostValues', () => {
  test('second-level domain', () => {
    const req: CloudFrontRequest = {
      clientIp: '1.1.1.1',
      method: 'GET',
      uri: 'fpjs/agent',
      querystring: 'apiKey=ujKG34hUYKLJKJ1F&version=3&loaderVersion=3.6.2',
      headers: {
        'content-type': [
          {
            key: 'content-type',
            value: 'application/json',
          },
        ],
        'content-length': [
          {
            key: 'content-length',
            value: '24354',
          },
        ],
        host: [
          {
            key: 'host',
            value: 'foo.bar',
          },
        ],
        'transfer-encoding': [
          {
            key: 'transfer-encoding',
            value: 'br',
          },
        ],
        via: [
          {
            key: 'via',
            value: 'cloudfront.net',
          },
        ],
        cookie: [
          {
            key: 'cookie',
            value: '_iidt,rGjGpiWkgQ,,;_iidt=7A03Gwg==;_vid_t=gEFRuIQlzYmv692/UL4GLA==',
          },
        ],
      },
    }
    const host = getHost(req)

    expect(host).toBe('foo.bar')
  })

  test('third-level domain', () => {
    const req: CloudFrontRequest = {
      clientIp: '1.1.1.1',
      method: 'GET',
      uri: 'fpjs/agent',
      querystring: 'apiKey=ujKG34hUYKLJKJ1F&version=3&loaderVersion=3.6.2',
      headers: {
        'content-type': [
          {
            key: 'content-type',
            value: 'application/json',
          },
        ],
        'content-length': [
          {
            key: 'content-length',
            value: '24354',
          },
        ],
        host: [
          {
            key: 'host',
            value: 'anime.foo.bar',
          },
        ],
        'transfer-encoding': [
          {
            key: 'transfer-encoding',
            value: 'br',
          },
        ],
        via: [
          {
            key: 'via',
            value: 'cloudfront.net',
          },
        ],
        cookie: [
          {
            key: 'cookie',
            value: '_iidt,rGjGpiWkgQ,,;_iidt=7A03Gwg==;_vid_t=gEFRuIQlzYmv692/UL4GLA==',
          },
        ],
      },
    }
    const host = getHost(req)

    expect(host).toBe('anime.foo.bar')
  })
})
