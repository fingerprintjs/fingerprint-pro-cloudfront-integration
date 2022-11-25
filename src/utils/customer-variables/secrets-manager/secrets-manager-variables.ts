import { CustomerVariableProvider, CustomerVariableType, CustomerVariableValue } from '../types'
import { SecretsManager } from 'aws-sdk'
import { CloudFrontRequest } from 'aws-lambda'
import { getHeaderValue } from '../../headers'
import { retrieveSecret } from './retrieve-secret'
import { NonNullableObject } from '../../types'

interface SecretsInfo {
  secretName: string | null
  secretRegion: string | null
}

export class SecretsManagerVariables implements CustomerVariableProvider {
  readonly name = 'SecretsManagerVariables'

  private secretsInfo?: SecretsInfo

  private readonly secretsManager?: SecretsManager

  private headers: Record<keyof SecretsInfo, string> = {
    secretName: 'fpjs_secret_name',
    secretRegion: 'fpjs_secret_region',
  }

  constructor(private readonly request: CloudFrontRequest, SecretsManagerImpl: typeof SecretsManager = SecretsManager) {
    this.readSecretsInfoFromHeaders()

    if (SecretsManagerVariables.isValidSecretInfo(this.secretsInfo)) {
      try {
        this.secretsManager = new SecretsManagerImpl({ region: this.secretsInfo.secretRegion })
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
        secretName: getHeaderValue(this.request, this.headers.secretName),
        secretRegion: getHeaderValue(this.request, this.headers.secretRegion),
      }
    }
  }

  private static isValidSecretInfo(secretsInfo?: SecretsInfo): secretsInfo is NonNullableObject<SecretsInfo> {
    return Boolean(secretsInfo?.secretRegion && secretsInfo?.secretName)
  }
}
