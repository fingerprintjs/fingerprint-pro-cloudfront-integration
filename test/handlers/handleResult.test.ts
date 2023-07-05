import { CloudFrontRequest, CloudFrontRequestEvent } from 'aws-lambda'
import { handler } from '../../src/app'
import * as handlers from '../../src/handlers'
import { handleResult } from '../../src/handlers'
import https from 'https'

const mockRequest = (uri: string): CloudFrontRequest => {
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
  }
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
  const origin: string = 'https://__ingress_api__'
  const queryString: string =
    '?apiKey=ujKG34hUYKLJKJ1F&version=3&loaderVersion=3.6.2&ii=fingerprintjs-pro-cloudfront%2F__lambda_func_version__%2Fingress'

  beforeAll(() => {
    jest.spyOn(handlers, 'handleResult')
    jest.spyOn(https, 'request')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('Call without suffix', async () => {
    const event = mockEvent(mockRequest('/behavior/result'))
    await handler(event)
    expect(handleResult).toHaveBeenCalledTimes(1)
    expect(https.request).toHaveBeenCalledWith(
      new URL(`${origin}/${queryString}`),
      expect.anything(),
      expect.anything(),
    )
  })

  test('Call with suffix', async () => {
    const event = mockEvent(mockRequest('/behavior/result/with/suffix'))
    await handler(event)
    expect(handleResult).toHaveBeenCalledTimes(1)
    expect(https.request).toHaveBeenCalledWith(
      new URL(`${origin}/with/suffix${queryString}`),
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
})
