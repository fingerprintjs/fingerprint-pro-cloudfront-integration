import {
  APIGatewayEventRequestContextV2,
  APIGatewayProxyEventV2WithRequestContext,
  APIGatewayProxyResult,
} from 'aws-lambda'
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager'
import { getAuthSettings, retrieveAuthToken } from './auth'
import type { DeploymentSettings } from './model/DeploymentSettings'
import { handleError, handleNoAuthentication, handleNotFound, handleWrongConfiguration } from './handlers/errorHandlers'
import { defaults } from './DefaultSettings'
import { handleStatus } from './handlers/statusHandler'
import { handleUpdate } from './handlers/updateHandler'
import { LambdaClient } from '@aws-sdk/client-lambda'
import { CloudFrontClient } from '@aws-sdk/client-cloudfront'

export async function handler(
  event: APIGatewayProxyEventV2WithRequestContext<APIGatewayEventRequestContextV2>,
): Promise<APIGatewayProxyResult> {
  const secretManagerClient = new SecretsManagerClient({ region: defaults.AWS_REGION })

  try {
    const authSettings = await getAuthSettings(secretManagerClient)
    const authToken = retrieveAuthToken(event)
    if (!authToken || !authSettings.token) {
      return handleNoAuthentication()
    }
    if (authToken !== authSettings.token) {
      return handleNoAuthentication()
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
    try {
      return await handleUpdate(lambdaClient, cloudFrontClient, deploymentSettings)
    } catch (e: any) {
      console.error(e)
      return handleError(e)
    }
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

  return {
    CFDistributionId: cfDistributionId,
    LambdaFunctionArn: lambdaFunctionArn,
    LambdaFunctionName: lambdaFunctionName,
  }
}
