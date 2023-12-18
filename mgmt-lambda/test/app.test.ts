import { mockClient } from 'aws-sdk-client-mock'
import { LambdaClient } from '@aws-sdk/client-lambda'
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import { APIGatewayProxyEventV2WithRequestContext, APIGatewayEventRequestContextV2 } from 'aws-lambda'
import { handler } from '../app'
import 'aws-sdk-client-mock-jest'

const lambdaMock = mockClient(LambdaClient)
const secretMock = mockClient(SecretsManagerClient)
const secretName = 'fingerprint-mgmt-lambda-auth-settings'

const correctToken = 'qazwsx123edc456'
const wrongToken = 'wrong-token'

describe('Basic test', () => {
  const OLD_ENV = process.env
  beforeEach(() => {
    jest.resetModules()
    lambdaMock.reset()
    secretMock.reset()
    process.env = { ...OLD_ENV }
  })

  test('basic auth test', async () => {
    setConfigEnv()
    mockSecret(correctToken)

    const event = generateStatusRequest(correctToken)

    const result = await handler(event)
    expect(result.statusCode).toBe(200)
  })

  test('wrong auth token', async () => {
    const secretName = 'fingerprint-mgmt-lambda-auth-settings'
    process.env.SettingsSecretName = secretName
    setConfigEnv()
    mockSecret(wrongToken)

    const event = generateStatusRequest(correctToken)

    const result = await handler(event)
    expect(result.statusCode).toBe(401)
  })

  test('no secret env var', async () => {
    const event = generateStatusRequest(correctToken)

    const result = await handler(event)
    expect(result.statusCode).toBe(500)
  })

  test('no update configuration env vars', async () => {
    setSecretEnv()
    mockSecret(correctToken)

    const event = generateStatusRequest(correctToken)

    const result = await handler(event)
    expect(result.statusCode).toBe(500)
  })

  test('status endpoint with POST', async () => {
    setSecretEnv()
    setConfigEnv()
    mockSecret(correctToken)

    const event = generateStatusRequest(correctToken, 'POST')

    const result = await handler(event)
    expect(result.statusCode).toBe(404)
  })

  test('wrong endpoint', async () => {
    setSecretEnv()
    setConfigEnv()
    mockSecret(correctToken)

    const event = generateStatusRequest(correctToken, 'PUT', 'fsdkjlkj')

    const result = await handler(event)
    expect(result.statusCode).toBe(404)
  })
})

function setSecretEnv() {
  process.env.SettingsSecretName = secretName
}

function setConfigEnv() {
  process.env.CFDistributionId = 'ABCDEF123456'
  process.env.LambdaFunctionArn = 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function'
  process.env.LambdaFunctionArn = 'fingerprint-pro-lambda-function'
}

function mockSecret(tokenValue: string) {
  secretMock
    .on(GetSecretValueCommand, {
      SecretId: secretName,
    })
    .resolves({
      SecretString: `{"token": "${tokenValue}"}`,
    })
}

function generateStatusRequest(
  token: string,
  method: string = 'GET',
  rawPath = '/status',
): APIGatewayProxyEventV2WithRequestContext<APIGatewayEventRequestContextV2> {
  const requestContext: APIGatewayEventRequestContextV2 = {
    accountId: '1234567890',
    apiId: 'v3',
    domainName: 'aws-lambda.amazonaws.com',
    domainPrefix: 'xyz123-qwerttuii-fsfds',
    http: {
      method: method,
      path: 'status',
      protocol: 'https',
      sourceIp: '192.168.1.2',
      userAgent: 'backend-app',
    },
    requestId: 'a70a6921-959a-40ea-8e2e-f5343b08588a',
    routeKey: '',
    stage: '',
    time: '2023-12-18T15:57:15+0000',
    timeEpoch: 1702915035000,
  }

  const event: APIGatewayProxyEventV2WithRequestContext<APIGatewayEventRequestContextV2> = {
    version: 'v3',
    routeKey: '',
    rawPath: rawPath,
    rawQueryString: '',
    headers: {
      'content-type': 'application/json',
      authorization: token,
    },
    requestContext: requestContext,
    isBase64Encoded: false,
  }
  return event
}
