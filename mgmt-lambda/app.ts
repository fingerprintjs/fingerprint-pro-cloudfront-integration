import { APIGatewayProxyEvent, Context } from 'aws-lambda'
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
} from '@aws-sdk/client-lambda'

const REGION = 'us-east-1'

export async function handler(event: APIGatewayProxyEvent, ctx: Context) {
  console.info(JSON.stringify(event))

  //TODO load data from AWS Secret
  const userInput = {
    LAMBDA_NAME: '',
    CF_DISTR_ID: '',
  }
  const lambdaFunctionName = userInput.LAMBDA_NAME
  const cloudFrontDistrId = userInput.CF_DISTR_ID

  console.info(`Going to upgrade Fingerprint Pro function association at CloudFront distbution.`)
  console.info(`Lambda function: ${lambdaFunctionName}. CloudFront ID: ${cloudFrontDistrId}`)

  const latestFunctionArn = await getLambdaLatestVersionArn(lambdaFunctionName)
  if (!latestFunctionArn) {
    return publishJobFailure('No lambda versions')
  }

  if (latestFunctionArn.length === 1) {
    console.info('No updates yet')
    return publishJobSuccess()
  }

  updateCloudFrontConfig(ctx, cloudFrontDistrId, lambdaFunctionName, latestFunctionArn)

  await publishJobSuccess()
}

async function updateCloudFrontConfig(
  ctx: any,
  cloudFrontDistributionId: string,
  lambdaFunctionName: string,
  latestFunctionArn: string,
) {
  const cloudFrontClient = new CloudFrontClient({ region: REGION })

  const configParams = {
    Id: cloudFrontDistributionId,
  }
  const getConfigCommand = new GetDistributionConfigCommand(configParams)
  const cfConfig: GetDistributionConfigCommandOutput = await cloudFrontClient.send(getConfigCommand)

  if (!cfConfig.ETag || !cfConfig.DistributionConfig) {
    return publishJobFailure('CloudFront distribution not found')
  }

  const cacheBehaviors = cfConfig.DistributionConfig.CacheBehaviors
  const fpCbs = cacheBehaviors?.Items?.filter((it) => it.TargetOriginId === 'fpcdn.io')
  if (!fpCbs || fpCbs?.length === 0) {
    return publishJobFailure('Cache behavior not found')
  }
  const cacheBehavior = fpCbs[0]
  const lambdas = cacheBehavior.LambdaFunctionAssociations?.Items?.filter(
    (it) => it && it.EventType === 'origin-request' && it.LambdaFunctionARN?.includes(lambdaFunctionName),
  )
  if (!lambdas || lambdas?.length === 0) {
    return publishJobFailure('Lambda function association not found')
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
    return publishJobFailure('Path pattern is not defined')
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
}

async function getLambdaLatestVersionArn(functionName: string): Promise<string | undefined> {
  const client = new LambdaClient({ region: REGION })
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

async function publishJobSuccess() {
  console.info(`Job successfully finished`)
}

async function publishJobFailure(message: string) {
  console.info(`Job failed with ${message}`)
}
