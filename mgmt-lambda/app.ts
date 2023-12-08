import { APIGatewayProxyEventV2WithRequestContext, APIGatewayEventRequestContextV2, Context } from 'aws-lambda'
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
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import type { AuthSettings } from './model/AuthSettings'
import type { DeploymentSettings } from './model/DeploymentSettings'

const REGION = 'us-east-1'

export async function handler(
  event: APIGatewayProxyEventV2WithRequestContext<APIGatewayEventRequestContextV2>,
  _: Context,
  callback: any,
) {
  console.info(JSON.stringify(event))

  const authSettings = await getAuthSettings()
  console.info(authSettings)

  const authorization = event.headers['authorization']
  if (authorization !== authSettings.token) {
    const notAuthResponse = {
      statusCode: 401,
    }
    callback(null, notAuthResponse)
  }

  let deploymentSettings: DeploymentSettings
  try {
    deploymentSettings = loadDeploymentSettings()
  } catch (error) {
    const wrongEnv = {
      statusCode: 500,
      body: {
        error: error,
      },
    }
    callback(null, wrongEnv)
  }

  const path = event.rawPath
  console.info(`path = ${path}`)
  if (path.startsWith('/update')) {
    handleUpdate(deploymentSettings)
  } else if (path.startsWith('/status')) {
  }

  const okResp = {
    statusCode: 200,
    body: JSON.stringify({
      message: 'OK',
    }),
  }

  callback(null, okResp)
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

    const response = await client.send(command)

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

async function handleUpdate(settings: DeploymentSettings) {
  console.info(`Going to upgrade Fingerprint Pro function association at CloudFront distbution.`)
  console.info(`Settings: ${settings}`)

  const latestFunctionArn = await getLambdaLatestVersionArn(settings.LambdaFunctionName)
  if (!latestFunctionArn) {
    return publishJobFailure('No lambda versions')
  }

  if (latestFunctionArn.length === 1) {
    console.info('No updates yet')
    return publishJobSuccess()
  }

  updateCloudFrontConfig(settings.CFDistributionId, settings.LambdaFunctionName, latestFunctionArn)
}

async function updateCloudFrontConfig(
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
    (it) => it && it.EventType === 'origin-request' && it.LambdaFunctionARN?.includes(lambdaFunctionName)
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
    (a, b) => Number.parseInt(b.Version!!) - Number.parseInt(a.Version!!)
  )[0]
  return Promise.resolve(latest.FunctionArn)
}

async function publishJobSuccess() {
  console.info(`Job successfully finished`)
}

async function publishJobFailure(message: string) {
  console.info(`Job failed with ${message}`)
}
