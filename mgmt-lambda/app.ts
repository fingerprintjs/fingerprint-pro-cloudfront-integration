import { APIGatewayProxyEventV2WithRequestContext, APIGatewayEventRequestContextV2 } from 'aws-lambda'
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager'
import { getAuthSettings } from './auth'
import type { DeploymentSettings } from './model/DeploymentSettings'
import { handleNoAthentication, handleWrongConfiguration, handleNotFound } from './handlers/errorHandlers'
import { defaults } from './DefaultSettings'
import { handleStatus } from './handlers/statusHandler'
import { handleUpdate } from './handlers/updateHandler'
import { LambdaClient } from '@aws-sdk/client-lambda'
import { CloudFrontClient } from '@aws-sdk/client-cloudfront'

export async function handler(event: APIGatewayProxyEventV2WithRequestContext<APIGatewayEventRequestContextV2>) {
  console.info(JSON.stringify(event))

  const secretManagerClient = new SecretsManagerClient({ region: defaults.AWS_REGION })
  const authSettings = await getAuthSettings(secretManagerClient)
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

  const lambdaClient = new LambdaClient({ region: defaults.AWS_REGION })
  const cloudFrontClient = new CloudFrontClient({ region: defaults.AWS_REGION })

  if (path.startsWith('/update')) {
    return handleUpdate(lambdaClient, cloudFrontClient, deploymentSettings)
  } else if (path.startsWith('/status')) {
    return handleStatus(lambdaClient, deploymentSettings)
  } else {
    return handleNotFound()
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
