import { APIGatewayProxyEventV2WithRequestContext, APIGatewayEventRequestContextV2 } from 'aws-lambda'
import { SecretsManagerClient, GetSecretValueCommand, GetSecretValueResponse } from '@aws-sdk/client-secrets-manager'
import type { AuthSettings } from './model/AuthSettings'
import type { DeploymentSettings } from './model/DeploymentSettings'
import { handleNoAthentication, handleWrongConfiguration, handleNotFound } from './handlers/errorHandlers'
import { handleStatus } from './handlers/statusHandler'
import { handleUpdate } from './handlers/updateHandler'

export async function handler(event: APIGatewayProxyEventV2WithRequestContext<APIGatewayEventRequestContextV2>) {
  console.info(JSON.stringify(event))

  const authSettings = await getAuthSettings()
  console.info(authSettings)

  const authorization = event.headers['authorization']
  if (authorization !== authSettings.token) {
    return handleNoAthentication()
  }

  let deploymentSettings: DeploymentSettings
  try {
    deploymentSettings = loadDeploymentSettings()
  } catch (error) {
    return handleWrongConfiguration(error)
  }

  const path = event.rawPath
  console.info(`path = ${path}`)
  if (path.startsWith('/update')) {
    return handleUpdate(deploymentSettings)
  } else if (path.startsWith('/status')) {
    return handleStatus(deploymentSettings)
  } else {
    return handleNotFound()
  }
}

async function getAuthSettings(): Promise<AuthSettings> {
  console.info(JSON.stringify(process.env))
  const secretName = process.env.SettingsSecretName
  if (!secretName) {
    throw new Error('Unable to get secret name. ')
  }

  try {
    const client = new SecretsManagerClient({
      region: 'us-east-1',
    })
    const command = new GetSecretValueCommand({
      SecretId: secretName,
    })

    const response: GetSecretValueResponse = await client.send(command)

    if (!response.SecretString) {
      throw new Error('Secret is empty')
    }

    return JSON.parse(response.SecretString)
  } catch (error) {
    throw new Error(`Unable to retrieve secret, ${error}`)
  }
}

function loadDeploymentSettings(): DeploymentSettings {
  const cfDistributionId = process.env.CFDistributionId
  if (!cfDistributionId) {
    throw new Error('No CloudFront distribution Id')
  }
  const lambdaFunctionName = process.env.LambdaFunctionArn
  if (!lambdaFunctionName) {
    throw new Error('No lambda function name')
  }
  const lambdaFunctionArn = process.env.LambdaFunctionArn
  if (!lambdaFunctionArn) {
    throw new Error('No lambda function ARN')
  }

  const settings: DeploymentSettings = {
    CFDistributionId: cfDistributionId,
    LambdaFunctionArn: lambdaFunctionArn,
    LambdaFunctionName: lambdaFunctionName,
  }
  return settings
}
