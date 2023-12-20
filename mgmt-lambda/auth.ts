import { APIGatewayProxyEventV2WithRequestContext, APIGatewayEventRequestContextV2 } from 'aws-lambda'
import type { AuthSettings } from './model/AuthSettings'
import { SecretsManagerClient, GetSecretValueCommand, GetSecretValueResponse } from '@aws-sdk/client-secrets-manager'

const MGMT_TOKEN_SCHEME = 'mgmt-token'
const EMPTY_TOKEN = ''

export async function getAuthSettings(secretManagerClient: SecretsManagerClient): Promise<AuthSettings> {
  const secretName = process.env.SettingsSecretName
  if (!secretName) {
    throw new Error('Unable to retrieve secret. Error: environment variable SettingsSecretName not found')
  }

  try {
    const command = new GetSecretValueCommand({
      SecretId: secretName,
    })

    const response: GetSecretValueResponse = await secretManagerClient.send(command)

    if (response.SecretBinary) {
      return JSON.parse(Buffer.from(response.SecretBinary).toString('utf8'))
    }
    if (response.SecretString) {
      return JSON.parse(response.SecretString)
    }
    throw new Error('secret is empty')
  } catch (error: any) {
    throw new Error(`Unable to retrieve secret. ${error}`)
  }
}

export function retrieveAuthToken(
  event: APIGatewayProxyEventV2WithRequestContext<APIGatewayEventRequestContextV2>,
): string {
  const authorization = event.headers['authorization']
  if (!authorization) {
    return EMPTY_TOKEN
  }

  const [type, token] = authorization.split(' ')
  if (type == MGMT_TOKEN_SCHEME) {
    return token || EMPTY_TOKEN
  }
  return EMPTY_TOKEN
}
