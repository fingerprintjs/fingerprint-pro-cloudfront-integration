import { mockClient } from 'aws-sdk-client-mock'
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import { getAuthSettings } from '../auth'
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
