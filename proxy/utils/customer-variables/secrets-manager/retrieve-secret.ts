import { CustomerVariablesRecord } from '../types'
import {
  SecretsManagerClient,
  GetSecretValueCommand,
  GetSecretValueCommandOutput,
} from '@aws-sdk/client-secrets-manager'
import { arrayBufferToString } from '../../buffer'
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
export async function retrieveSecret(secretsManager: SecretsManagerClient, key: string, logger: Logger) {
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

function convertSecretToString(result: GetSecretValueCommandOutput): string {
  if (result.SecretBinary) {
    return arrayBufferToString(result.SecretBinary)
  } else {
    return result.SecretString || ''
  }
}

async function fetchSecret(
  secretsManager: SecretsManagerClient,
  key: string,
  logger: Logger
): Promise<CustomerVariablesRecord | null> {
  try {
    const command = new GetSecretValueCommand({
      SecretId: key,
    })
    const result = await secretsManager.send(command)

    const secretString = convertSecretToString(result)

    if (!secretString) {
      return null
    }

    const parsedSecret: CustomerVariablesRecord = JSON.parse(secretString)
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
