import { createDecipheriv } from 'crypto'
import { promisify } from 'util'
import { inflateRaw } from 'zlib'
import { Buffer } from 'buffer'
import {
  DecryptionAlgorithm,
  EventsGetResponse,
  UnsealAggregateError,
  UnsealError,
} from '@fingerprintjs/fingerprintjs-pro-server-api'

const asyncInflateRaw = promisify(inflateRaw)

export interface DecryptionKey {
  key: Buffer
  algorithm: DecryptionAlgorithm
}

const SEALED_HEADER = Buffer.from([0x9e, 0x85, 0xdc, 0xed])

export async function unseal(sealedData: Buffer, decryptionKeys: DecryptionKey[]): Promise<EventsGetResponse> {
  if (sealedData.subarray(0, SEALED_HEADER.length).toString('hex') !== SEALED_HEADER.toString('hex')) {
    throw new Error('Invalid sealed data header')
  }

  const errors = new UnsealAggregateError([])

  for (const decryptionKey of decryptionKeys) {
    switch (decryptionKey.algorithm) {
      case DecryptionAlgorithm.Aes256Gcm:
        try {
          const unsealed = await unsealAes256Gcm(sealedData, decryptionKey.key)
          return JSON.parse(unsealed) as EventsGetResponse
        } catch (e) {
          errors.addError(new UnsealError(decryptionKey, e as Error))
          continue
        }

      default:
        throw new Error(`Unsupported decryption algorithm: ${decryptionKey.algorithm}`)
    }
  }

  throw errors
}

async function unsealAes256Gcm(sealedData: Buffer, decryptionKey: Buffer) {
  const nonceLength = 12
  const nonce = sealedData.subarray(SEALED_HEADER.length, SEALED_HEADER.length + nonceLength)

  const authTagLength = 16
  const authTag = sealedData.subarray(-authTagLength)

  const ciphertext = sealedData.subarray(SEALED_HEADER.length + nonceLength, -authTagLength)

  const decipher = createDecipheriv('aes-256-gcm', decryptionKey, nonce).setAuthTag(authTag)
  const compressed = Buffer.concat([decipher.update(ciphertext), decipher.final()])

  const payload = await asyncInflateRaw(compressed)

  return payload.toString()
}
