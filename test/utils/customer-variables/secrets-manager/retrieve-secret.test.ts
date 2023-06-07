import { getMockSecretsManager } from '../../../aws'
import {
  clearSecretsCache,
  retrieveSecret,
} from '../../../../src/utils/customer-variables/secrets-manager/retrieve-secret'
import { createLogger } from '../../../../src/logger'

const { mockSecret, MockSecretsManager, send } = getMockSecretsManager()

const logger = createLogger()

describe('retrieve secret', () => {
  beforeEach(() => {
    clearSecretsCache()

    MockSecretsManager.mockClear()
    send.mockClear()
  })

  it('caches result even if it is null', async () => {
    mockSecret.asUndefined()

    await retrieveSecret(new MockSecretsManager() as any, 'test', logger)
    await retrieveSecret(new MockSecretsManager() as any, 'test', logger)

    expect(send).toHaveBeenCalledTimes(1)
  })

  it('caches result even if it secrets manager throws', async () => {
    mockSecret.asError(new Error('error'))

    await retrieveSecret(new MockSecretsManager() as any, 'test', logger)
    await retrieveSecret(new MockSecretsManager() as any, 'test', logger)

    expect(send).toHaveBeenCalledTimes(1)
  })
})
