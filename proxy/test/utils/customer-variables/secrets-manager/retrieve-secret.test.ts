import { mockClient } from 'aws-sdk-client-mock'
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import { clearSecretsCache, retrieveSecret } from '../../../../utils/customer-variables/secrets-manager/retrieve-secret'
import { createLogger } from '../../../../logger'
import 'aws-sdk-client-mock-jest'

const logger = createLogger()
const secretName = 'test'
const mock = mockClient(SecretsManagerClient)
const client = new SecretsManagerClient({})

describe('retrieve secret', () => {
  beforeEach(() => {
    clearSecretsCache()

    mock.reset()
  })

  it('caches result even if it is null', async () => {
    mock
      .on(GetSecretValueCommand, {
        SecretId: secretName,
      })
      .resolves({})

    await retrieveSecret(client, secretName, logger)
    await retrieveSecret(client, secretName, logger)

    expect(mock).toHaveReceivedCommandTimes(GetSecretValueCommand, 1)
  })

  it('caches result even if it secrets manager throws', async () => {
    mock
      .on(GetSecretValueCommand, {
        SecretId: secretName,
      })
      .rejects('mocked rejection')

    await retrieveSecret(client, secretName, logger)
    await retrieveSecret(client, secretName, logger)

    expect(mock).toHaveReceivedCommandTimes(GetSecretValueCommand, 1)
  })
})
