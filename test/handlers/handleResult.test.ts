import { CloudFrontRequest, CloudFrontRequestEvent } from 'aws-lambda'
import { handler } from '../../src/app'
import * as handlers from '../../src/handlers'
import { handleResult } from '../../src/handlers'
import https, { Agent } from 'https'
import { ClientRequest, IncomingMessage } from 'http'
import { Socket } from 'net'
import { EventEmitter } from 'events'

const mockRequest = (uri: string) => {
  return {
    clientIp: '1.1.1.1',
    method: 'GET',
    uri,
    querystring: 'apiKey=ujKG34hUYKLJKJ1F&version=3&loaderVersion=3.6.2',
    headers: {
      host: [
        {
          key: 'host',
          value: 'adewe.cloudfront.net',
        },
      ],
      cookie: [
        {
          key: 'cookie',
          value: '',
        },
      ],
    },
    origin: {
      s3: {
        domainName: 'adewe.cloudfront.net',
        path: '/',
        region: 'us',
        authMethod: 'none',
        customHeaders: {
          fpjs_pre_shared_secret: [
            {
              key: 'fpjs_pre_shared_secret',
              value: 'qwertyuio1356767',
            },
          ],
          fpjs_agent_download_path: [
            {
              key: 'fpjs_agent_download_path',
              value: 'greiodsfkljlds',
            },
          ],
          fpjs_behavior_path: [
            {
              key: 'fpjs_behavior_path',
              value: 'behavior',
            },
          ],
          fpjs_get_result_path: [
            {
              key: 'fpjs_get_result_path',
              value: 'result',
            },
          ],
        },
      },
    },
  } satisfies CloudFrontRequest
}

const mockEvent = (request: CloudFrontRequest): CloudFrontRequestEvent => {
  return {
    Records: [
      {
        cf: {
          request,
          config: {
            eventType: 'origin-request',
            requestId: 'fake-id',
            distributionId: 'fake-id',
            distributionDomainName: 'fake-domain.tld',
          },
        },
      },
    ],
  }
}

describe('Result Endpoint', function () {
  const origin: string = '__ingress_api__'
  const queryString: string =
    '?apiKey=ujKG34hUYKLJKJ1F&version=3&loaderVersion=3.6.2&ii=fingerprintjs-pro-cloudfront%2F__lambda_func_version__%2Fingress'

  const queryStringWithRegion = (region: string) =>
    `?apiKey=ujKG34hUYKLJKJ1F&version=3&loaderVersion=3.6.2&region=${region}&ii=fingerprintjs-pro-cloudfront%2F__lambda_func_version__%2Fingress`

  let requestSpy: jest.SpyInstance

  beforeAll(() => {
    jest.spyOn(handlers, 'handleResult')
    requestSpy = jest.spyOn(https, 'request')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('Call with region', async () => {
    const request = mockRequest('/behavior/result')
    request.querystring = `${request.querystring}&region=eu`
    const event = mockEvent(request)

    await handler(event)

    expect(handleResult).toHaveBeenCalledTimes(1)
    expect(https.request).toHaveBeenCalledWith(
      new URL(`https://eu.${origin}/${queryStringWithRegion('eu')}`),
      expect.anything(),
      expect.anything(),
    )
  })

  test('Call without suffix', async () => {
    const event = mockEvent(mockRequest('/behavior/result'))
    await handler(event)
    expect(handleResult).toHaveBeenCalledTimes(1)
    expect(https.request).toHaveBeenCalledWith(
      new URL(`https://${origin}/${queryString}`),
      expect.anything(),
      expect.anything(),
    )
  })

  test('Call with suffix', async () => {
    const event = mockEvent(mockRequest('/behavior/result/with/suffix'))
    await handler(event)
    expect(handleResult).toHaveBeenCalledTimes(1)
    expect(https.request).toHaveBeenCalledWith(
      new URL(`https://${origin}/with/suffix${queryString}`),
      expect.anything(),
      expect.anything(),
    )
  })

  test('Call with suffix and region', async () => {
    const request = mockRequest('/behavior/result/with/suffix')
    const event = mockEvent(request)

    request.querystring = `${request.querystring}&region=eu`

    await handler(event)

    expect(handleResult).toHaveBeenCalledTimes(1)
    expect(https.request).toHaveBeenCalledWith(
      new URL(`https://eu.${origin}/with/suffix${queryStringWithRegion('eu')}`),
      expect.anything(),
      expect.anything(),
    )
  })

  test('Call with bad suffix', async () => {
    const event = mockEvent(mockRequest('/behavior/resultwith/bad/suffix'))
    await handler(event)
    expect(handleResult).toHaveBeenCalledTimes(0)
    expect(https.request).toHaveBeenCalledTimes(0)
  })

  test('Traffic monitoring', async () => {
    const event = mockEvent(mockRequest('/behavior/result'))
    await handler(event)
    expect(handleResult).toHaveBeenCalledTimes(1)

    const url = requestSpy.mock.calls[0][0]
    const iiParam = url.searchParams.get('ii')

    expect(iiParam).toEqual('fingerprintjs-pro-cloudfront/__lambda_func_version__/ingress')
  })

  test('Headers with proxy secret', async () => {
    const request = mockRequest('/behavior/result')
    const event = mockEvent(request)
    await handler(event)
    expect(handleResult).toHaveBeenCalledTimes(1)

    const options = requestSpy.mock.calls[0][1]

    expect(options.headers).toEqual({
      'fpjs-proxy-secret': request.origin.s3.customHeaders.fpjs_pre_shared_secret[0].value,
      'fpjs-proxy-client-ip': request.clientIp,
    })
  })

  test('Includes only _iidt in cookies', async () => {
    const request = mockRequest('/behavior/result')

    request.headers.cookie[0].value =
      '_iidt=GlMQaHMfzYvomxCuA7Uymy7ArmjH04jPkT+enN7j/Xk8tJG+UYcQV+Qw60Ry4huw9bmDoO/smyjQp5vLCuSf8t4Jow==; auth_token=123456'

    const event = mockEvent(request)
    await handler(event)
    expect(handleResult).toHaveBeenCalledTimes(1)

    const options = requestSpy.mock.calls[0][1]
    expect(options.headers.cookie).toEqual(
      '_iidt=GlMQaHMfzYvomxCuA7Uymy7ArmjH04jPkT+enN7j/Xk8tJG+UYcQV+Qw60Ry4huw9bmDoO/smyjQp5vLCuSf8t4Jow==',
    )
  })

  test('Request body is not modified', async () => {
    requestSpy.mockImplementation((_url: any, _options: any, callback) => {
      const emitter = new EventEmitter()

      Object.assign(emitter, {
        statusCode: 200,
        headers: {
          'access-control-allow-credentials': ['true'],
          'access-control-expose-headers': ['Retry-After'],
          'content-type': ['text/plain'],
        },
      })

      callback(emitter)

      emitter.emit('data', Buffer.from('data'))

      emitter.emit('end')
    })

    const request = mockRequest('/behavior/result')

    const event = mockEvent(request)
    const response = await handler(event)
    expect(handleResult).toHaveBeenCalledTimes(1)

    const body = Buffer.from(response.body as string, 'base64').toString('utf-8')

    expect(body).toEqual('data')

    expect(response.headers).toEqual({
      'access-control-allow-credentials': [
        {
          key: 'access-control-allow-credentials',
          value: 'true',
        },
      ],
      'access-control-expose-headers': [
        {
          key: 'access-control-expose-headers',
          value: 'Retry-After',
        },
      ],
      'content-type': [
        {
          key: 'content-type',
          value: 'text/plain',
        },
      ],
    })
  })

  test('Request body is not modified on error', async () => {
    requestSpy.mockImplementation((_url: any, _options: any, callback) => {
      const emitter = new EventEmitter()

      Object.assign(emitter, {
        statusCode: 500,
        headers: {
          'access-control-allow-credentials': ['true'],
          'access-control-expose-headers': ['Retry-After'],
          'content-type': ['text/plain'],
        },
      })

      callback(emitter)

      emitter.emit('data', Buffer.from('error'))

      emitter.emit('end')
    })

    const request = mockRequest('/behavior/result')

    const event = mockEvent(request)
    const response = await handler(event)
    expect(handleResult).toHaveBeenCalledTimes(1)

    const body = Buffer.from(response.body as string, 'base64').toString('utf-8')

    expect(body).toEqual('error')

    expect(response.headers).toEqual({
      'access-control-allow-credentials': [
        {
          key: 'access-control-allow-credentials',
          value: 'true',
        },
      ],
      'access-control-expose-headers': [
        {
          key: 'access-control-expose-headers',
          value: 'Retry-After',
        },
      ],
      'content-type': [
        {
          key: 'content-type',
          value: 'text/plain',
        },
      ],
    })
  })

  test('Returns error response on lambda error', async () => {
    requestSpy.mockImplementation(() => {
      const emitter = new EventEmitter()

      Object.assign(emitter, {
        write: jest.fn(),
        end: jest.fn(),
      })

      setTimeout(() => {
        emitter.emit('error', new Error('Request timeout'))
      }, 1)

      return emitter
    })

    const request = mockRequest('/behavior/result')

    const event = mockEvent(request)
    const response = await handler(event)
    expect(handleResult).toHaveBeenCalledTimes(1)

    expect(response.status).toEqual('500')
    expect(JSON.parse(response.body as string)).toEqual({
      v: '2',
      error: {
        code: 'Failed',
        message: 'An error occured with Fingerprint Pro Lambda function. Reason Error: Request timeout',
      },
      products: {},
    })
  })

  test('Response cookies are the same except the domain, strict-transport-security is removed', async () => {
    requestSpy.mockImplementation((_url: any, _options: any, callback) => {
      const emitter = new EventEmitter()

      Object.assign(emitter, {
        statusCode: 200,
        headers: {
          'set-cookie': [
            '_iidt=GlMQaHMfzYvomxCuA7Uymy7ArmjH04jPkT+enN7j/Xk8tJG+UYcQV+Qw60Ry4huw9bmDoO/smyjQp5vLCuSf8t4Jow==; Path=/; Domain=fpjs.io; Expires=Fri, 19 Jan 2024 08:54:36 GMT; HttpOnly; Secure; SameSite=None, anotherCookie=anotherValue; Domain=fpjs.io;',
          ],
          'strict-transport-security': ['max-age=63072000'],
          'access-control-allow-credentials': ['true'],
          'access-control-expose-headers': ['Retry-After'],
        },
      })

      callback(emitter)

      emitter.emit('data', Buffer.from('data'))

      emitter.emit('end')
    })

    const request = mockRequest('/behavior/result')

    const event = mockEvent(request)
    const response = await handler(event)
    expect(handleResult).toHaveBeenCalledTimes(1)

    expect(response.headers).toEqual({
      'set-cookie': [
        {
          key: 'set-cookie',
          value:
            '_iidt=GlMQaHMfzYvomxCuA7Uymy7ArmjH04jPkT+enN7j/Xk8tJG+UYcQV+Qw60Ry4huw9bmDoO/smyjQp5vLCuSf8t4Jow==; Path=/; Domain=adewe.cloudfront.net; Expires=Fri, 19 Jan 2024 08:54:36 GMT; HttpOnly; Secure; SameSite=None, anotherCookie=anotherValue; Domain=adewe.cloudfront.net;',
        },
      ],
      'access-control-allow-credentials': [
        {
          key: 'access-control-allow-credentials',
          value: 'true',
        },
      ],
      'access-control-expose-headers': [
        {
          key: 'access-control-expose-headers',
          value: 'Retry-After',
        },
      ],
    })
  })

  test('cookies are first party for the req url whose TLD has wildcard, the domain is derived from the req url (not origin header)', async () => {
    requestSpy.mockImplementation((_url: any, _options: any, callback) => {
      const emitter = new EventEmitter()

      Object.assign(emitter, {
        statusCode: 200,
        headers: {
          'set-cookie': [
            '_iidt=GlMQaHMfzYvomxCuA7Uymy7ArmjH04jPkT+enN7j/Xk8tJG+UYcQV+Qw60Ry4huw9bmDoO/smyjQp5vLCuSf8t4Jow==; Path=/; Domain=fpjs.io; Expires=Fri, 19 Jan 2024 08:54:36 GMT; HttpOnly; Secure; SameSite=None, anotherCookie=anotherValue; Domain=fpjs.io;',
          ],
          origin: ['https://some-other.com'],
        },
      })

      callback(emitter)

      emitter.emit('data', Buffer.from('data'))

      emitter.emit('end')
    })

    const request = mockRequest('/behavior/result')

    request.headers.host[0].value = 'sub2.sub1.some.alces.network'

    const event = mockEvent(request)
    const response = await handler(event)
    expect(handleResult).toHaveBeenCalledTimes(1)

    expect(response.headers).toEqual({
      origin: [
        {
          key: 'origin',
          value: 'https://some-other.com',
        },
      ],
      'set-cookie': [
        {
          key: 'set-cookie',
          value:
            '_iidt=GlMQaHMfzYvomxCuA7Uymy7ArmjH04jPkT+enN7j/Xk8tJG+UYcQV+Qw60Ry4huw9bmDoO/smyjQp5vLCuSf8t4Jow==; Path=/; Domain=sub1.some.alces.network; Expires=Fri, 19 Jan 2024 08:54:36 GMT; HttpOnly; Secure; SameSite=None, anotherCookie=anotherValue; Domain=sub1.some.alces.network;',
        },
      ],
    })
  })

  test('cookies are first party for the req url whose TLD has exception, the domain is derived from the req url (not origin header)', async () => {
    requestSpy.mockImplementation((_url: any, _options: any, callback) => {
      const emitter = new EventEmitter()

      Object.assign(emitter, {
        statusCode: 200,
        headers: {
          'set-cookie': [
            '_iidt=GlMQaHMfzYvomxCuA7Uymy7ArmjH04jPkT+enN7j/Xk8tJG+UYcQV+Qw60Ry4huw9bmDoO/smyjQp5vLCuSf8t4Jow==; Path=/; Domain=fpjs.io; Expires=Fri, 19 Jan 2024 08:54:36 GMT; HttpOnly; Secure; SameSite=None, anotherCookie=anotherValue; Domain=fpjs.io;',
          ],
          origin: ['https://some-other.com'],
        },
      })

      callback(emitter)

      emitter.emit('data', Buffer.from('data'))

      emitter.emit('end')
    })

    const request = mockRequest('/behavior/result')

    request.headers.host[0].value = 'city.kawasaki.jp'

    const event = mockEvent(request)
    const response = await handler(event)
    expect(handleResult).toHaveBeenCalledTimes(1)

    expect(response.headers).toEqual({
      origin: [
        {
          key: 'origin',
          value: 'https://some-other.com',
        },
      ],
      'set-cookie': [
        {
          key: 'set-cookie',
          value:
            '_iidt=GlMQaHMfzYvomxCuA7Uymy7ArmjH04jPkT+enN7j/Xk8tJG+UYcQV+Qw60Ry4huw9bmDoO/smyjQp5vLCuSf8t4Jow==; Path=/; Domain=city.kawasaki.jp; Expires=Fri, 19 Jan 2024 08:54:36 GMT; HttpOnly; Secure; SameSite=None, anotherCookie=anotherValue; Domain=city.kawasaki.jp;',
        },
      ],
    })
  })
})

describe('Browser caching endpoint', () => {
  let requestSpy: jest.MockInstance<ClientRequest, any>

  beforeAll(() => {
    requestSpy = jest.spyOn(https, 'request')
  })

  afterAll(() => {
    requestSpy.mockRestore()
  })

  test('cache-control header is returned as is', async () => {
    const cacheControlValue = 'max-age=31536000, immutable, private'
    requestSpy.mockImplementationOnce((...args) => {
      const [, options, cb] = args
      options.agent = new Agent()
      const responseStream = new IncomingMessage(new Socket())
      cb(responseStream)
      responseStream.headers['cache-control'] = cacheControlValue
      responseStream.emit('end')
      return Reflect.construct(ClientRequest, args)
    })
    const reqEvent = mockEvent(mockRequest('/behavior/result/some/suffix'))
    const response = await handler(reqEvent)
    expect(response?.headers?.['cache-control']?.[0]?.['value']).toBe(cacheControlValue)
  })
})
