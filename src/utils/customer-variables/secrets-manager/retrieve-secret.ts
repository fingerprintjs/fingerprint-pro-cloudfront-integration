import { CustomerVariablesRecord } from '../types'
import { GetSecretValueCommand, GetSecretValueResponse, SecretsManager } from '@aws-sdk/client-secrets-manager'
import { arrayBufferToString } from '../../buffer'
import { normalizeSecret } from './normalize-secret'
import { validateSecret } from './validate-secret'
import { Logger } from '../../../logger'

interface CacheEntry {
  value: CustomerVariablesRecord | null
}

/**
 * Global cache for customer variables fetched from Secrets Manager.
 * */
const cache = new Map<string, CacheEntry>()

/**
 * Retrieves a secret from Secrets Manager and caches it or returns it from cache if it's still valid.
 * */
export async function retrieveSecret(secretsManager: SecretsManager, key: string, logger: Logger) {
  if (cache.has(key)) {
    const entry = cache.get(key)!

    return entry.value
  }

  const result = await fetchSecret(secretsManager, key, logger)

  cache.set(key, {
    value: result,
  })

  return result
}

async function convertSecretToString(result: GetSecretValueResponse) {
  if (result.SecretBinary) {
    return arrayBufferToString(result.SecretBinary)
  } else {
    return result.SecretString || ''
  }
}

async function fetchSecret(
  secretsManager: SecretsManager,
  key: string,
  logger: Logger,
): Promise<CustomerVariablesRecord | null> {
  try {
    const result = await secretsManager.send(
      new GetSecretValueCommand({
        SecretId: key,
      }),
    )

    const secretString = await convertSecretToString(result)

    if (!secretString) {
      return null
    }

    const parsedSecret = normalizeSecret(secretString)

    validateSecret(parsedSecret)

    return parsedSecret
  } catch (error) {
    logger.error(`Failed to fetch and parse secret ${key}`, { error })

    return null
  }
}

export function clearSecretsCache() {
  cache.clear()
}
