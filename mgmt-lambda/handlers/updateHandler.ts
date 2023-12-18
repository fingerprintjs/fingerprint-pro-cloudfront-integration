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
  ListVersionsByFunctionCommand,
  ListVersionsByFunctionCommandInput,
  ListVersionsByFunctionCommandOutput,
  UpdateFunctionCodeCommand,
} from '@aws-sdk/client-lambda'

export async function handleUpdate(
  lambdaClient: LambdaClient,
  cloudFrontClient: CloudFrontClient,
  settings: DeploymentSettings,
): Promise<APIGatewayProxyResult> {
  console.info(`Going to upgrade Fingerprint Pro function association at CloudFront distbution.`)
  console.info(`Settings: ${settings}`)

  const latestFunctionArn = await getLambdaLatestVersionArn(lambdaClient, settings.LambdaFunctionName)
  if (!latestFunctionArn) {
    return handleResult('No lambda version')
  }

  try {
    const functionVersionArn = await updateLambdaFunctionCode(lambdaClient, settings.LambdaFunctionName)
    return updateCloudFrontConfig(
      cloudFrontClient,
      settings.CFDistributionId,
      settings.LambdaFunctionName,
      functionVersionArn,
    )
  } catch (error) {
    return handleResult(error)
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
    return handleResult('CloudFront distribution not found')
  }

  const cacheBehaviors = cfConfig.DistributionConfig.CacheBehaviors
  const fpCbs = cacheBehaviors?.Items?.filter((it) => it.TargetOriginId === 'fpcdn.io')
  if (!fpCbs || fpCbs?.length === 0) {
    return handleResult('Cache behavior not found')
  }
  const cacheBehavior = fpCbs[0]
  const lambdas = cacheBehavior.LambdaFunctionAssociations?.Items?.filter(
    (it) => it && it.EventType === 'origin-request' && it.LambdaFunctionARN?.includes(lambdaFunctionName),
  )
  if (!lambdas || lambdas?.length === 0) {
    return handleResult('Lambda function association not found')
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
    return handleResult('Path pattern is not defined')
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
  return handleResult()
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

async function getLambdaLatestVersionArn(client: LambdaClient, functionName: string): Promise<string | undefined> {
  const params: ListVersionsByFunctionCommandInput = {
    FunctionName: functionName,
  }
  const command = new ListVersionsByFunctionCommand(params)
  const result: ListVersionsByFunctionCommandOutput = await client.send(command)
  if (!result.Versions || result.Versions?.length === 0) {
    return Promise.resolve(undefined)
  }

  const latest = result.Versions.filter((it) => it.Version && Number.isFinite(Number.parseInt(it.Version))).sort(
    (a, b) => Number.parseInt(b.Version!!) - Number.parseInt(a.Version!!),
  )[0]
  return Promise.resolve(latest.FunctionArn)
}

async function handleResult(message?: any): Promise<APIGatewayProxyResult> {
  const body = {
    status: 'Update failed',
    error: message,
  }
  return {
    statusCode: 200,
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
    },
  }
}
