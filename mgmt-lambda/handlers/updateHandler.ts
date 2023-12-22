import { APIGatewayProxyResult } from 'aws-lambda'
import type { DeploymentSettings } from '../model/DeploymentSettings'
import { defaults } from '../DefaultSettings'
import {
  CloudFrontClient,
  CreateInvalidationCommand,
  CreateInvalidationCommandInput,
  GetDistributionConfigCommand,
  GetDistributionConfigCommandOutput,
  UpdateDistributionCommand,
  UpdateDistributionCommandInput,
} from '@aws-sdk/client-cloudfront'
import {
  LambdaClient,
  GetFunctionCommand,
  UpdateFunctionCodeCommand,
  GetFunctionCommandInput,
  GetFunctionCommandOutput,
} from '@aws-sdk/client-lambda'

export async function handleUpdate(
  lambdaClient: LambdaClient,
  cloudFrontClient: CloudFrontClient,
  settings: DeploymentSettings,
): Promise<APIGatewayProxyResult> {
  console.info(`Going to upgrade Fingerprint Pro function association at CloudFront distbution.`)
  console.info(`Settings: ${settings}`)

  try {
    const isLambdaFunctionExist = await checkLambdaFunctionExistence(lambdaClient, settings.LambdaFunctionName)
    if (!isLambdaFunctionExist) {
      return handleFailure(`Lambda function with name ${settings.LambdaFunctionName} not found`)
    }

    const functionVersionArn = await updateLambdaFunctionCode(lambdaClient, settings.LambdaFunctionName)
    return updateCloudFrontConfig(
      cloudFrontClient,
      settings.CFDistributionId,
      settings.LambdaFunctionName,
      functionVersionArn,
    )
  } catch (error: any) {
    if (error.name === 'ResourceNotFoundException') {
      return handleException('Resource not found', error.message)
    } else if (error.name === 'AccessDeniedException') {
      return handleException('No permission', error.message)
    } else {
      return handleFailure(error)
    }
  }
}

async function updateCloudFrontConfig(
  cloudFrontClient: CloudFrontClient,
  cloudFrontDistributionId: string,
  lambdaFunctionName: string,
  latestFunctionArn: string,
) {
  const configParams = {
    Id: cloudFrontDistributionId,
  }
  const getConfigCommand = new GetDistributionConfigCommand(configParams)
  const cfConfig: GetDistributionConfigCommandOutput = await cloudFrontClient.send(getConfigCommand)

  if (!cfConfig.ETag || !cfConfig.DistributionConfig) {
    return handleFailure('CloudFront distribution not found')
  }

  const cacheBehaviors = cfConfig.DistributionConfig.CacheBehaviors
  const fpCbs = cacheBehaviors?.Items?.filter((it) => it.TargetOriginId === 'fpcdn.io')
  if (!fpCbs || fpCbs?.length === 0) {
    return handleFailure('Cache behavior not found')
  }
  const cacheBehavior = fpCbs[0]
  const lambdas = cacheBehavior.LambdaFunctionAssociations?.Items?.filter(
    (it) => it && it.EventType === 'origin-request' && it.LambdaFunctionARN?.includes(`${lambdaFunctionName}:`),
  )
  if (!lambdas || lambdas?.length === 0) {
    return handleFailure('Lambda function association not found')
  }
  const lambda = lambdas[0]
  lambda.LambdaFunctionARN = latestFunctionArn

  const updateParams: UpdateDistributionCommandInput = {
    DistributionConfig: cfConfig.DistributionConfig,
    Id: cloudFrontDistributionId,
    IfMatch: cfConfig.ETag,
  }

  const updateConfigCommand = new UpdateDistributionCommand(updateParams)
  const updateCFResult = await cloudFrontClient.send(updateConfigCommand)
  console.info(`CloudFront update has finished, ${JSON.stringify(updateCFResult)}`)

  console.info('Going to invalidate routes for upgraded cache behavior')
  if (!cacheBehavior.PathPattern) {
    return handleFailure('Path pattern is not defined')
  }

  let pathPattern = cacheBehavior.PathPattern
  if (!pathPattern.startsWith('/')) {
    pathPattern = '/' + pathPattern
  }

  const invalidationParams: CreateInvalidationCommandInput = {
    DistributionId: cloudFrontDistributionId,
    InvalidationBatch: {
      Paths: {
        Quantity: 1,
        Items: [pathPattern],
      },
      CallerReference: 'fingerprint-pro-management-lambda-function',
    },
  }
  const invalidationCommand = new CreateInvalidationCommand(invalidationParams)
  const invalidationResult = await cloudFrontClient.send(invalidationCommand)
  console.info(`Invalidation has finished, ${JSON.stringify(invalidationResult)}`)
  return handleSuccess()
}

async function updateLambdaFunctionCode(lambdaClient: LambdaClient, functionName: string): Promise<string> {
  console.info('Preparing command to update function code')
  const command = new UpdateFunctionCodeCommand({
    S3Bucket: defaults.LAMBDA_DISTRIBUTION_BUCKET,
    S3Key: defaults.LAMBDA_DISTRIBUTION_BUCKET_KEY,
    FunctionName: functionName,
    Publish: true,
  })
  console.info('Sending update command to Lambda runtime')
  const result = await lambdaClient.send(command)
  console.info(`Got Lambda function update result, functionARN: ${result.FunctionArn}`)

  if (!result.FunctionArn) {
    throw new Error('Function ARN not found after update')
  }

  return result.FunctionArn
}

async function checkLambdaFunctionExistence(client: LambdaClient, functionName: string): Promise<boolean> {
  const params: GetFunctionCommandInput = {
    FunctionName: functionName,
  }
  const command = new GetFunctionCommand(params)
  const result: GetFunctionCommandOutput = await client.send(command)
  if (!result.Configuration?.FunctionArn) {
    return false
  }
  return true
}

async function handleException(status: string, message: string): Promise<APIGatewayProxyResult> {
  const body = {
    status: status,
    error: message,
  }
  return {
    statusCode: 500,
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
    },
  }
}

async function handleFailure(message?: any): Promise<APIGatewayProxyResult> {
  const body = {
    status: 'Update failed',
    error: message,
  }
  return {
    statusCode: 500,
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
    },
  }
}

async function handleSuccess(): Promise<APIGatewayProxyResult> {
  const body = {
    status: 'Update completed',
    error: null,
  }
  return {
    statusCode: 200,
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
    },
  }
}
