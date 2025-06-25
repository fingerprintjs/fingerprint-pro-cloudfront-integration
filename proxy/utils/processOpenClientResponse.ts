import { plugins } from './registerPlugin'
import { unseal } from './sealedResults'
import { DecryptionAlgorithm } from '@fingerprintjs/fingerprintjs-pro-server-api'
import { CloudFrontResultResponse } from 'aws-lambda'

type FingerprintSealedIngressResponseBody = {
  sealedResult: string
}

export async function processOpenClientResponse(
  bodyBytes: ArrayBuffer,
  response: CloudFrontResultResponse,
  decryptionKey: string
): Promise<void> {
  if (!decryptionKey) {
    throw new Error('decryptionKey cannot be null')
  }

  let responseBody: string | null = null
  try {
    responseBody = new TextDecoder('utf-8').decode(bodyBytes)
  } catch (e) {
    console.log(`Error occurred when decoding response to UTF-8: ${e}.`)
  }

  if (responseBody == null) {
    console.log('responseBody is null. Skipping plugins and returning the response.')
    return
  }

  let parsedText: FingerprintSealedIngressResponseBody
  try {
    parsedText = JSON.parse(responseBody)
  } catch (e) {
    console.log(`Error parsing response body as JSON: ${e}`)
    return
  }
  const event = await unseal(Buffer.from(parsedText.sealedResult, 'base64'), [
    {
      key: Buffer.from(decryptionKey, 'base64'),
      algorithm: DecryptionAlgorithm.Aes256Gcm,
    },
  ])
  const filteredPlugins = plugins.filter((t) => t.type === 'processOpenClientResponse')
  for (const filteredPlugin of filteredPlugins) {
    try {
      // const clonedHttpResponse = cloneFastlyResponse(bodyBytes, response)
      await filteredPlugin.callback({ event, httpResponse: response })
    } catch (e: unknown) {
      console.error(`Plugin[${filteredPlugin.name}]`, e)
    }
  }
}
