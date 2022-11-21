import {
  filterRequestHeaders,
  getHost,
  prepareHeadersForIngressAPI,
  updateResponseHeaders,
} from '../../src/utils/headers'
import { getDomainFromHostname } from '../../src/domain'
import { CloudFrontHeaders, CloudFrontRequest } from 'aws-lambda'
import { IncomingHttpHeaders } from 'http'
import { CustomerVariables } from '../../src/utils/customer-variables/customer-variables'
import { HeaderCustomerVariables } from '../../src/utils/customer-variables/header-customer-variables'

const getCustomerVariables = (request: CloudFrontRequest) =>
  new CustomerVariables([new HeaderCustomerVariables(request)])

describe('test fpjs-headers preparation', () => {
  test('verify existing values', async () => {
    const req: CloudFrontRequest = {
      clientIp: '1.1.1.1',
      method: 'GET',
      uri: 'fpjs/agent',
      querystring: 'apiKey=ujKG34hUYKLJKJ1F&version=3&loaderVersion=3.6.2',
      headers: {},
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
    expect(headers['fpjs-client-ip']).toBe('1.1.1.1')
    expect(headers['fpjs-proxy-identification']).toBe('qwertyuio1356767')
  })

  test('secret is not defined', async () => {
    const req: CloudFrontRequest = {
      clientIp: '1.1.1.1',
      method: 'GET',
      uri: 'fpjs/agent',
      querystring: 'apiKey=ujKG34hUYKLJKJ1F&version=3&loaderVersion=3.6.2',
      headers: {},
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
    expect(headers['fpjs-client-ip']).toBe('1.1.1.1')
    expect(headers['fpjs-proxy-identification']).toBe('secret-is-not-defined')
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
            value: 'fpjs.sh',
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
    const headers = filterRequestHeaders(req)

    expect(headers.hasOwnProperty('content-length')).toBe(false)
    expect(headers.hasOwnProperty('host')).toBe(false)
    expect(headers.hasOwnProperty('transfer-encoding')).toBe(false)
    expect(headers.hasOwnProperty('via')).toBe(false)
    expect(headers['content-type']).toBe('application/json')
    expect(headers['cookie']).toBe('_iidt,rGjGpiWkgQ,,; _iidt=7A03Gwg==; _vid_t=gEFRuIQlzYmv692/UL4GLA==')
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
      'set-cookie': ['_iidf', 'HttpOnly', 'Domain=cloudfront.net'],
      vary: 'Accept-Encoding',
      'custom-header-1': 'gdfddfd',
    }
    const cfHeaders: CloudFrontHeaders = updateResponseHeaders(headers, 'fpjs.sh')
    expect(cfHeaders.hasOwnProperty('custom-header-1')).toBe(false)
    expect(cfHeaders.hasOwnProperty('content-length')).toBe(false)
    expect(cfHeaders['cache-control'][0].value).toBe('public, max-age=3600, s-maxage=60')
    expect(cfHeaders['set-cookie'][0].value).toBe('_iidf; HttpOnly; Domain=fpjs.sh')
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
      'set-cookie': ['_iidf', 'HttpOnly', 'Domain=cloudfront.net'],
      vary: 'Accept-Encoding',
      'custom-header-1': 'gdfddfd',
    }
    const cfHeaders: CloudFrontHeaders = updateResponseHeaders(headers, 'fpjs.sh')
    expect(cfHeaders.hasOwnProperty('custom-header-1')).toBe(false)
    expect(cfHeaders.hasOwnProperty('content-length')).toBe(false)
    expect(cfHeaders['cache-control'][0].value).toBe('no-cache, max-age=3600, s-maxage=60')
    expect(cfHeaders['set-cookie'][0].value).toBe('_iidf; HttpOnly; Domain=fpjs.sh')
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
            value: 'fpjs.sh',
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

    expect(host).toBe('fpjs.sh')
    expect(getDomainFromHostname(host)).toBe('fpjs.sh')
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
            value: 'anime.fpjs.sh',
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

    expect(host).toBe('anime.fpjs.sh')
    expect(getDomainFromHostname(host)).toBe('fpjs.sh')
  })
})
