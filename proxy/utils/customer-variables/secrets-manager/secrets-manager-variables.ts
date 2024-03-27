import { CustomerVariableProvider, CustomerVariableType, CustomerVariableValue } from '../types'
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager'
import { CloudFrontRequest } from 'aws-lambda'
import { getHeaderValue } from '../../headers'
import { retrieveSecret } from './retrieve-secret'
import { NonNullableObject } from '../../types'
import { DEFAULT_REGION, SECRET_NAME_HEADER_KEY } from '../defaults'

interface SecretsInfo {
  secretName: string | null
  secretRegion: string | null
}

export class SecretsManagerVariables implements CustomerVariableProvider {
  readonly name = 'SecretsManagerVariables'

  private secretsInfo?: SecretsInfo

  private readonly secretsManager?: SecretsManagerClient

  constructor(private readonly request: CloudFrontRequest) {
    this.readSecretsInfoFromHeaders()

    if (SecretsManagerVariables.isValidSecretInfo(this.secretsInfo)) {
      try {
        this.secretsManager = new SecretsManagerClient({ region: this.secretsInfo.secretRegion })
      } catch (error) {
        console.error('Failed to create secrets manager', {
          error,
          secretsInfo: this.secretsInfo,
        })
      }
    }
  }

  async getVariable(variable: CustomerVariableType): Promise<CustomerVariableValue> {
    const secretsObject = await this.retrieveSecrets()

    return secretsObject?.[variable] ?? null
  }

  private async retrieveSecrets() {
    if (!this.secretsManager) {
      return null
    }

    try {
      return await retrieveSecret(this.secretsManager, this.secretsInfo!.secretName!)
    } catch (error) {
      console.error('Error retrieving secret from secrets manager', {
        error,
        secretsInfo: this.secretsInfo,
      })

      return null
    }
  }

  private readSecretsInfoFromHeaders() {
    if (!this.secretsInfo) {
      this.secretsInfo = {
        secretName: getHeaderValue(this.request, SECRET_NAME_HEADER_KEY),
        secretRegion: DEFAULT_REGION,
      }
    }
  }

  private static isValidSecretInfo(secretsInfo?: SecretsInfo): secretsInfo is NonNullableObject<SecretsInfo> {
    return Boolean(secretsInfo?.secretRegion && secretsInfo?.secretName)
  }
}
