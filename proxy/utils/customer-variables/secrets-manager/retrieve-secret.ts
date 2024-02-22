import { CustomerVariablesRecord } from '../types'
import { SecretsManager } from 'aws-sdk'
import { arrayBufferToString } from '../../buffer'
import { normalizeSecret } from './normalize-secret'
import { validateSecret } from './validate-secret'
import { isBlob } from '../../is-blob'
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

async function convertSecretToString(result: SecretsManager.GetSecretValueResponse) {
  if (result.SecretBinary) {
    if (result.SecretBinary instanceof Uint8Array) {
      return arrayBufferToString(result.SecretBinary)
    } else if (isBlob(result.SecretBinary)) {
      return await result.SecretBinary.text()
    } else {
      return result.SecretBinary.toString()
    }
  } else {
    return result.SecretString || ''
  }
}

async function fetchSecret(
  secretsManager: SecretsManager,
  key: string,
  logger: Logger
): Promise<CustomerVariablesRecord | null> {
  try {
    const result = await secretsManager
      .getSecretValue({
        SecretId: key,
      })
      .promise()

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
