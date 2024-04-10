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
  GetFunctionCommand,
  FunctionConfiguration,
  LambdaClient,
  ListVersionsByFunctionCommand,
  State,
  UpdateFunctionCodeCommand,
} from '@aws-sdk/client-lambda'
import { ApiException, ErrorCode } from '../exceptions'

/**
 * @throws {ApiException}
 * @throws {import('@aws-sdk/client-lambda').LambdaServiceException}
 */
export async function handleUpdate(
  lambdaClient: LambdaClient,
  cloudFrontClient: CloudFrontClient,
  settings: DeploymentSettings
): Promise<APIGatewayProxyResult> {
  console.info(`Going to upgrade Fingerprint Pro function association at CloudFront distribution.`)
  console.info(`Settings: ${JSON.stringify(settings)}`)

  const functionInformationBeforeUpdate = await getLambdaFunctionInformation(lambdaClient, settings.LambdaFunctionName)
  if (!functionInformationBeforeUpdate?.FunctionArn) {
    throw new ApiException(ErrorCode.LambdaFunctionNotFound)
  }
  const currentRevisionId = functionInformationBeforeUpdate?.RevisionId
  if (!currentRevisionId) {
    console.error('Lambda@Edge function expected to have a revision ID of the current deployment')
    throw new ApiException(ErrorCode.LambdaFunctionCurrentRevisionNotDefined)
  }
  const currentCodeSha256 = functionInformationBeforeUpdate.CodeSha256

  const newVersionConfiguration = await updateLambdaFunctionCode(
    lambdaClient,
    settings.LambdaFunctionName,
    currentRevisionId
  )
  const newRevisionId = newVersionConfiguration.RevisionId
  if (!newRevisionId) {
    console.error('New revision for Lambda@Edge function was not created')
    throw new ApiException(ErrorCode.LambdaFunctionUpdateRevisionNotCreated)
  }
  const functionArn = newVersionConfiguration.FunctionArn
  if (!functionArn) {
    console.error('Function ARN for new version is not defined')
    throw new ApiException(ErrorCode.LambdaFunctionARNNotFound)
  }

  const listVersionsAfterUpdate = await listLambdaFunctionVersions(lambdaClient, settings.LambdaFunctionName)
  const newVersions = Array.from(listVersionsAfterUpdate.values()).filter((conf) => conf.RevisionId === newRevisionId)
  if (newVersions.length !== 1) {
    console.error(`Excepted one new version, but found: ${newVersions.length} versions`)
    throw new ApiException(ErrorCode.LambdaFunctionWrongNewVersionsCount)
  }

  const newVersion = newVersions[0]
  const newVersionCodeSha256 = newVersion.CodeSha256

  if (currentCodeSha256 === newVersionCodeSha256) {
    console.info(`New version's code SHA256 is equal to the previous $LATEST code SHA256`)
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'Update is not required' }),
      headers: {
        'content-type': 'application/json',
      },
    }
  } else {
    console.info(
      `New version's SHA256 is not equals to the previous one. Continue with updating CloudFront resources...`
    )
  }

  const functionInformationAfterUpdate = await getLambdaFunctionInformation(lambdaClient, settings.LambdaFunctionName)
  if (functionInformationAfterUpdate?.State !== State.Active) {
    console.error(`New version ${newVersion.Version} is not in ${State.Active} state`)
    throw new ApiException(ErrorCode.LambdaFunctionNewVersionNotActive)
  }

  await updateCloudFrontConfig(cloudFrontClient, settings.CFDistributionId, settings.LambdaFunctionName, functionArn)

  return {
    statusCode: 200,
    body: JSON.stringify({ status: 'Update completed' }),
    headers: {
      'content-type': 'application/json',
    },
  }
}

/**
 * @throws {ApiException}
 */
async function updateCloudFrontConfig(
  cloudFrontClient: CloudFrontClient,
  cloudFrontDistributionId: string,
  lambdaFunctionName: string,
  latestFunctionArn: string
) {
  const configParams = {
    Id: cloudFrontDistributionId,
  }
  const getConfigCommand = new GetDistributionConfigCommand(configParams)
  const cfConfig: GetDistributionConfigCommandOutput = await cloudFrontClient.send(getConfigCommand)

  if (!cfConfig.ETag || !cfConfig.DistributionConfig) {
    throw new ApiException(ErrorCode.CloudFrontDistributionNotFound)
  }

  const distributionConfig = cfConfig.DistributionConfig

  let fpCacheBehaviorsFound = 0
  let fpCacheBehaviorsUpdated = 0
  const pathPatterns = []

  if (distributionConfig.DefaultCacheBehavior?.TargetOriginId === defaults.FP_CDN_URL) {
    fpCacheBehaviorsFound++
    const lambdas = distributionConfig.DefaultCacheBehavior.LambdaFunctionAssociations?.Items?.filter(
      (it) => it && it.EventType === 'origin-request' && it.LambdaFunctionARN?.includes(`${lambdaFunctionName}:`)
    )
    if (lambdas?.length === 1) {
      lambdas[0].LambdaFunctionARN = latestFunctionArn
      fpCacheBehaviorsUpdated++
      pathPatterns.push('/*')
      console.info('Updated Fingerprint Pro Lambda@Edge function association in the default cache behavior')
    } else {
      console.info(
        'The default cache behavior has targeted to FP CDN, but has no Fingerprint Pro Lambda@Edge association'
      )
    }
  }

  const fpCbs = distributionConfig.CacheBehaviors?.Items?.filter((it) => it.TargetOriginId === defaults.FP_CDN_URL)
  if (fpCbs && fpCbs?.length > 0) {
    fpCacheBehaviorsFound += fpCbs.length
    fpCbs.forEach((cacheBehavior) => {
      const lambdas = cacheBehavior.LambdaFunctionAssociations?.Items?.filter(
        (it) => it && it.EventType === 'origin-request' && it.LambdaFunctionARN?.includes(`${lambdaFunctionName}:`)
      )
      if (lambdas?.length === 1) {
        lambdas[0].LambdaFunctionARN = latestFunctionArn
        fpCacheBehaviorsUpdated++
        if (cacheBehavior.PathPattern) {
          let pathPattern = cacheBehavior.PathPattern
          if (!cacheBehavior.PathPattern.startsWith('/')) {
            pathPattern = '/' + pathPattern
          }
          pathPatterns.push(pathPattern)
        } else {
          console.error(`Path pattern is not defined for cache behavior ${JSON.stringify(cacheBehavior)}`)
        }
      } else {
        console.info(
          `Cache behavior ${JSON.stringify(
            cacheBehavior
          )} has targeted to FP CDN, but has no Fingerprint Pro Lambda@Edge association`
        )
      }
    })
  }

  if (fpCacheBehaviorsFound === 0) {
    throw new ApiException(ErrorCode.CacheBehaviorNotFound)
  }
  if (fpCacheBehaviorsUpdated === 0) {
    throw new ApiException(ErrorCode.LambdaFunctionAssociationNotFound)
  }
  if (pathPatterns.length === 0) {
    throw new ApiException(ErrorCode.CacheBehaviorPatternNotDefined)
  }

  const updateParams: UpdateDistributionCommandInput = {
    DistributionConfig: cfConfig.DistributionConfig,
    Id: cloudFrontDistributionId,
    IfMatch: cfConfig.ETag,
  }

  const updateConfigCommand = new UpdateDistributionCommand(updateParams)
  const updateCFResult = await cloudFrontClient.send(updateConfigCommand)
  console.info(`CloudFront update has finished, ${JSON.stringify(updateCFResult)}`)

  console.info('Going to invalidate routes for upgraded cache behavior')
  invalidateFingerprintIntegrationCache(cloudFrontClient, cloudFrontDistributionId, pathPatterns)
}

async function invalidateFingerprintIntegrationCache(
  cloudFrontClient: CloudFrontClient,
  distributionId: string,
  pathPatterns: string[]
) {
  const invalidationParams: CreateInvalidationCommandInput = {
    DistributionId: distributionId,
    InvalidationBatch: {
      Paths: {
        Quantity: 1,
        Items: pathPatterns,
      },
      CallerReference: 'fingerprint-pro-management-lambda-function',
    },
  }
  const invalidationCommand = new CreateInvalidationCommand(invalidationParams)
  const invalidationResult = await cloudFrontClient.send(invalidationCommand)
  console.info(`Invalidation has finished, ${JSON.stringify(invalidationResult)}`)
}

async function getLambdaFunctionInformation(
  lambdaClient: LambdaClient,
  functionName: string
): Promise<FunctionConfiguration | undefined> {
  console.info(`Getting lambda function information for ${functionName}`)
  const command = new GetFunctionCommand({
    FunctionName: functionName,
  })
  console.info(`Sending get command to Lambda runtime with data ${JSON.stringify(command)}`)
  const result = await lambdaClient.send(command)

  console.info(`Got get command result: ${JSON.stringify(result)}`)

  return result.Configuration
}

/**
 * @throws {import('@aws-sdk/client-lambda').LambdaServiceException}
 * @throws {ApiException}
 */
async function updateLambdaFunctionCode(
  lambdaClient: LambdaClient,
  functionName: string,
  revisionId: string
): Promise<FunctionConfiguration> {
  console.info('Preparing command to update function code')
  const command = new UpdateFunctionCodeCommand({
    S3Bucket: defaults.LAMBDA_DISTRIBUTION_BUCKET,
    S3Key: defaults.LAMBDA_DISTRIBUTION_BUCKET_KEY,
    FunctionName: functionName,
    RevisionId: revisionId,
    Publish: true,
  })
  console.info(`Sending update command to Lambda runtime with data ${JSON.stringify(command)}`)
  const result = await lambdaClient.send(command)

  console.info(`Got update command result: ${JSON.stringify(result)}`)

  if (!result) {
    throw new ApiException(ErrorCode.LambdaFunctionARNNotFound)
  }

  if (!result.FunctionArn) {
    throw new ApiException(ErrorCode.LambdaFunctionARNNotFound)
  }

  console.info(`Got Lambda function update result, functionARN: ${result.FunctionArn}`)

  return result
}

async function listLambdaFunctionVersions(
  lambdaClient: LambdaClient,
  functionName: string
): Promise<Map<string | undefined, FunctionConfiguration>> {
  console.info('Getting Lambda function versions')
  const command = new ListVersionsByFunctionCommand({
    FunctionName: functionName,
  })
  console.info(`Sending ListVersionsByFunctionCommand to with data ${JSON.stringify(command)}`)
  const result = await lambdaClient.send(command)

  console.info(`Got ListVersionsByFunctionCommand result: ${JSON.stringify(result)}`)

  if (!result) {
    throw new ApiException(ErrorCode.LambdaFunctionARNNotFound)
  }

  return new Map(result.Versions?.filter((conf) => conf !== undefined).map((conf) => [conf.Version, conf]))
}
