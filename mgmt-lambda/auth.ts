import type { AuthSettings } from './model/AuthSettings'
import { SecretsManagerClient, GetSecretValueCommand, GetSecretValueResponse } from '@aws-sdk/client-secrets-manager'

export async function getAuthSettings(secretManagerClient: SecretsManagerClient): Promise<AuthSettings> {
  const secretName = process.env.SettingsSecretName
  if (!secretName) {
    throw new Error('Unable to retrieve secret. Error: unable to get secret name')
  }

  try {
    const command = new GetSecretValueCommand({
      SecretId: secretName,
    })

    const response: GetSecretValueResponse = await secretManagerClient.send(command)

    if (response.SecretBinary) {
      return JSON.parse(Buffer.from(response.SecretBinary).toString('utf8'))
    } else if (response.SecretString) {
      return JSON.parse(response.SecretString)
    } else {
      throw new Error('secret is empty')
    }
  } catch (error: any) {
    throw new Error(`Unable to retrieve secret. ${error}`)
  }
}
