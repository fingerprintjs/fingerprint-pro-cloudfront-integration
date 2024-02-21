import { handler } from '../../app'
import * as handlers from '../../handlers'
import { handleResult } from '../../handlers'
import https, { Agent } from 'https'
import { ClientRequest, IncomingMessage } from 'http'
import { Socket } from 'net'
import { EventEmitter } from 'events'
import { mockEvent, mockRequest } from '../aws'

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
      expect.anything()
    )
  })

  test('Call with wrong region', async () => {
    const queryString = 'apiKey=ujKG34hUYKLJKJ1F&version=3&loaderVersion=3.6.2'
    const request = mockRequest('/behavior/result', queryString)
    request.querystring = `${request.querystring}&region=bar.baz/foo`
    const event = mockEvent(request)

    await handler(event)

    expect(handleResult).toHaveBeenCalledTimes(1)
    expect(https.request).toHaveBeenCalledWith(
      new URL(`https://${origin}/${queryStringWithRegion('us')}`),
      expect.anything(),
      expect.anything()
    )
  })

  test('Invalid query parameters', async () => {
    const queryString = 'apiKey=foo.bar/baz&version=bar.foo/baz&loaderVersion=baz.bar/foo'
    const queryStringWithUSRegion =
      '?apiKey=foo.bar%2Fbaz&version=bar.foo%2Fbaz&loaderVersion=baz.bar%2Ffoo&ii=fingerprintjs-pro-cloudfront%2F__lambda_func_version__%2Fingress'
    const request = mockRequest('/behavior/result', queryString)
    request.querystring = `${request.querystring}`
    const event = mockEvent(request)

    await handler(event)

    expect(handleResult).toHaveBeenCalledTimes(1)
    expect(https.request).toHaveBeenCalledWith(
      new URL(`https://${origin}/${queryStringWithUSRegion}`),
      expect.anything(),
      expect.anything()
    )
  })

  test('Suffix with dot', async () => {
    const suffix = '.suffix/more/path'
    const iiParam = 'ii=fingerprintjs-pro-cloudfront%2F__lambda_func_version__%2Fingress'
    const request = mockRequest(`/behavior/result/${suffix}`, '')
    const event = mockEvent(request)

    await handler(event)

    expect(handleResult).toHaveBeenCalledTimes(1)
    expect(https.request).toHaveBeenCalledWith(
      new URL(`https://${origin}/${suffix}?${iiParam}`),
      expect.anything(),
      expect.anything()
    )
  })

  test('Invalid query parameters, GET request', async () => {
    const queryString = 'apiKey=foo.bar/baz&version=bar.foo/baz&loaderVersion=baz.bar/foo'
    const queryStringWithUSRegion =
      '?apiKey=foo.bar%2Fbaz&version=bar.foo%2Fbaz&loaderVersion=baz.bar%2Ffoo&ii=fingerprintjs-pro-cloudfront%2F__lambda_func_version__%2Fingress'
    const request = mockRequest('/behavior/result', queryString, 'GET')
    request.querystring = `${request.querystring}`
    const event = mockEvent(request)

    await handler(event)

    expect(handleResult).toHaveBeenCalledTimes(1)
    expect(https.request).toHaveBeenCalledWith(
      new URL(`https://${origin}/${queryStringWithUSRegion}`),
      expect.anything(),
      expect.anything()
    )
  })

  test('Suffix with dot, GET request', async () => {
    const suffix = '.suffix/more/path'
    const iiParam = 'ii=fingerprintjs-pro-cloudfront%2F__lambda_func_version__%2Fingress'
    const request = mockRequest(`/behavior/result/${suffix}`, '', 'GET')
    const event = mockEvent(request)

    await handler(event)

    expect(handleResult).toHaveBeenCalledTimes(1)
    expect(https.request).toHaveBeenCalledWith(
      new URL(`https://${origin}/${suffix}?${iiParam}`),
      expect.anything(),
      expect.anything()
    )
  })

  test('Call without suffix', async () => {
    const event = mockEvent(mockRequest('/behavior/result'))
    await handler(event)
    expect(handleResult).toHaveBeenCalledTimes(1)
    expect(https.request).toHaveBeenCalledWith(
      new URL(`https://${origin}/${queryString}`),
      expect.anything(),
      expect.anything()
    )
  })

  test('Call with suffix', async () => {
    const event = mockEvent(mockRequest('/behavior/result/with/suffix'))
    await handler(event)
    expect(handleResult).toHaveBeenCalledTimes(1)
    expect(https.request).toHaveBeenCalledWith(
      new URL(`https://${origin}/with/suffix${queryString}`),
      expect.anything(),
      expect.anything()
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
      expect.anything()
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
      cookie: '',
      'fpjs-proxy-secret': request.origin.s3.customHeaders.fpjs_pre_shared_secret[0].value,
      'fpjs-proxy-client-ip': request.clientIp,
      'fpjs-proxy-forwarded-host': request.headers['host'][0].value,
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
      '_iidt=GlMQaHMfzYvomxCuA7Uymy7ArmjH04jPkT+enN7j/Xk8tJG+UYcQV+Qw60Ry4huw9bmDoO/smyjQp5vLCuSf8t4Jow=='
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

  test('Response cookies are the same, strict-transport-security is removed', async () => {
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
            '_iidt=GlMQaHMfzYvomxCuA7Uymy7ArmjH04jPkT+enN7j/Xk8tJG+UYcQV+Qw60Ry4huw9bmDoO/smyjQp5vLCuSf8t4Jow==; Path=/; Domain=fpjs.io; Expires=Fri, 19 Jan 2024 08:54:36 GMT; HttpOnly; Secure; SameSite=None, anotherCookie=anotherValue; Domain=fpjs.io;',
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
