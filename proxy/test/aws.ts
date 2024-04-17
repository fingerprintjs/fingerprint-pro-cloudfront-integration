import { SecretsManager } from 'aws-sdk'
import { CloudFrontRequest, CloudFrontRequestEvent } from 'aws-lambda'

export function toAwsResponse<T>(value: T) {
  return {
    promise: () => Promise.resolve(value),
  }
}

export function getMockSecretsManager() {
  const getSecretValue = jest.fn()

  const MockSecretsManager = jest.fn(() => ({
    getSecretValue,
  })) as jest.Mock

  const mockSecret = {
    asString: (value: string) => {
      getSecretValue.mockReturnValue(toAwsResponse({ SecretString: value }))
    },
    asBuffer: (value: SecretsManager.SecretBinaryType) => {
      getSecretValue.mockReturnValue(toAwsResponse({ SecretBinary: value }))
    },
    asUndefined: () => {
      getSecretValue.mockReturnValue(
        toAwsResponse({
          SecretString: undefined,
          SecretBinary: undefined,
        }),
      )
    },
    asError: (error: Error) => {
      getSecretValue.mockReturnValueOnce(toAwsResponse(Promise.reject(error)))
    },
  }

  return {
    MockSecretsManager,
    getSecretValue,
    mockSecret,
  }
}

export const mockRequest = (
  uri: string,
  querystring = 'apiKey=ujKG34hUYKLJKJ1F&version=3&loaderVersion=3.6.2',
  method = 'POST',
) => {
  return {
    clientIp: '1.1.1.1',
    method: method,
    uri,
    querystring,
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
export const mockEvent = (request: CloudFrontRequest): CloudFrontRequestEvent => {
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
