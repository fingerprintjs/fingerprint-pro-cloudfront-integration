import { mockClient } from 'aws-sdk-client-mock'
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import {
  APIGatewayProxyEventV2WithRequestContext,
  APIGatewayEventRequestContextV2,
  APIGatewayProxyEventHeaders,
} from 'aws-lambda'
import { getAuthSettings, retrieveAuthToken } from '../auth'
import 'aws-sdk-client-mock-jest'

const secretMock = mockClient(SecretsManagerClient)
const secretManagerClient = new SecretsManagerClient({})

describe('auth test', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    jest.resetModules()
    secretMock.reset()
    process.env = { ...OLD_ENV }
  })

  it('AWS Secret is available (string)', async () => {
    const secretName = 'fingerprint-mgmt-lambda-auth-settings'
    process.env.SettingsSecretName = secretName
    secretMock
      .on(GetSecretValueCommand, {
        SecretId: secretName,
      })
      .resolves({
        SecretString: '{"token": "4uxgk6nlew"}',
      })

    const settings = await getAuthSettings(secretManagerClient)
    expect(settings.token).toBe('4uxgk6nlew')
    expect(secretMock).toHaveReceivedCommandTimes(GetSecretValueCommand, 1)
  })

  it('AWS Secret is available (byte array)', async () => {
    const secretName = 'fingerprint-mgmt-lambda-auth-settings'
    process.env.SettingsSecretName = secretName
    secretMock
      .on(GetSecretValueCommand, {
        SecretId: secretName,
      })
      .resolves({
        SecretBinary: Buffer.from('{"token": "4uxgk6nlew"}'),
      })

    const settings = await getAuthSettings(secretManagerClient)
    expect(settings.token).toBe('4uxgk6nlew')
    expect(secretMock).toHaveReceivedCommandTimes(GetSecretValueCommand, 1)
  })

  it('AWS Secret is available, but empty', async () => {
    const secretName = 'fingerprint-mgmt-lambda-auth-settings'
    process.env.SettingsSecretName = secretName
    secretMock
      .on(GetSecretValueCommand, {
        SecretId: secretName,
      })
      .resolves({})

    try {
      await getAuthSettings(secretManagerClient)
    } catch (error: any) {
      expect(error.message).toBe('Unable to retrieve secret. Error: secret is empty')
    }
  })

  it('No env var with secret name', async () => {
    const secretName = 'fingerprint-mgmt-lambda-auth-settings'
    secretMock
      .on(GetSecretValueCommand, {
        SecretId: secretName,
      })
      .resolves({})

    try {
      await getAuthSettings(secretManagerClient)
    } catch (error: any) {
      expect(error.message).toBe('Unable to retrieve secret. Error: environment variable SettingsSecretName not found')
    }
  })
})

describe('test token retrieving', () => {
  it('corrent scheme', () => {
    const event = generateRequestEvent({
      authorization: 'mgmt-token token-value',
    })

    const token = retrieveAuthToken(event)
    expect(token).toBe('token-value')
  })

  it('corrent scheme without value', () => {
    const event = generateRequestEvent({
      authorization: 'mgmt-token',
    })

    const token = retrieveAuthToken(event)
    expect(token).toBe('')
  })

  it('wrong scheme', () => {
    const event = generateRequestEvent({
      authorization: 'basic token-value',
    })

    const token = retrieveAuthToken(event)
    expect(token).toBe('')
  })

  it('no scheme', () => {
    const event = generateRequestEvent({
      authorization: 'some-string',
    })

    const token = retrieveAuthToken(event)
    expect(token).toBe('')
  })

  it('no header', () => {
    const event = generateRequestEvent({})

    const token = retrieveAuthToken(event)
    expect(token).toBe('')
  })
})

function generateRequestEvent(
  headers: APIGatewayProxyEventHeaders,
): APIGatewayProxyEventV2WithRequestContext<APIGatewayEventRequestContextV2> {
  const requestContext: APIGatewayEventRequestContextV2 = {
    accountId: '1234567890',
    apiId: 'v3',
    domainName: 'aws-lambda.amazonaws.com',
    domainPrefix: 'xyz123-qwerttuii-fsfds',
    http: {
      method: 'GET',
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

  return {
    version: 'v2',
    routeKey: '',
    rawPath: '',
    rawQueryString: '',
    headers: headers,
    requestContext: requestContext,
    isBase64Encoded: false,
  }
}
