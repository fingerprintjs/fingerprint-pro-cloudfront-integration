import { APIGatewayProxyEventV2WithRequestContext, APIGatewayEventRequestContextV2 } from 'aws-lambda'
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager'
import { getAuthSettings, retrieveAuthToken } from './auth'
import type { DeploymentSettings } from './model/DeploymentSettings'
import { handleNoAthentication, handleWrongConfiguration, handleNotFound } from './handlers/errorHandlers'
import { defaults } from './DefaultSettings'
import { handleStatus } from './handlers/statusHandler'
import { handleUpdate } from './handlers/updateHandler'
import { LambdaClient } from '@aws-sdk/client-lambda'
import { CloudFrontClient } from '@aws-sdk/client-cloudfront'

export async function handler(event: APIGatewayProxyEventV2WithRequestContext<APIGatewayEventRequestContextV2>) {
  const secretManagerClient = new SecretsManagerClient({ region: defaults.AWS_REGION })

  try {
    const authSettings = await getAuthSettings(secretManagerClient)
    const authToken = retrieveAuthToken(event)
    if (authToken !== authSettings.token) {
      return handleNoAthentication()
    }
  } catch (error) {
    return handleWrongConfiguration(error)
  }

  let deploymentSettings: DeploymentSettings
  try {
    deploymentSettings = loadDeploymentSettings()
  } catch (error) {
    return handleWrongConfiguration(error)
  }

  const path = event.rawPath
  const method = event.requestContext.http.method
  const lambdaClient = new LambdaClient({ region: defaults.AWS_REGION })
  const cloudFrontClient = new CloudFrontClient({ region: defaults.AWS_REGION })

  if (path.startsWith('/update') && method === 'POST') {
    return handleUpdate(lambdaClient, cloudFrontClient, deploymentSettings)
  }
  if (path.startsWith('/status') && method === 'GET') {
    return handleStatus(lambdaClient, deploymentSettings)
  }
  return handleNotFound()
}

function loadDeploymentSettings(): DeploymentSettings {
  const missedVariables = []
  const cfDistributionId = process.env.CFDistributionId || ''
  if (cfDistributionId === '') {
    missedVariables.push('CFDistributionId')
  }
  const lambdaFunctionName = process.env.LambdaFunctionName || ''
  if (lambdaFunctionName === '') {
    missedVariables.push('LambdaFunctionName')
  }
  const lambdaFunctionArn = process.env.LambdaFunctionArn || ''
  if (lambdaFunctionArn === '') {
    missedVariables.push('LambdaFunctionArn')
  }

  if (missedVariables.length > 0) {
    const vars = missedVariables.join(', ')
    throw new Error(`environment variables not found: ${vars}`)
  }

  const settings: DeploymentSettings = {
    CFDistributionId: cfDistributionId,
    LambdaFunctionArn: lambdaFunctionArn,
    LambdaFunctionName: lambdaFunctionName,
  }
  return settings
}
