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
  UpdateFunctionCodeCommand,
  UpdateFunctionCodeCommandOutput,
} from '@aws-sdk/client-lambda'
import { ApiException, ErrorCode } from '../exceptions'
import { delay } from '../utils/delay'
import {
  doesCacheBehaviorUseOrigins,
  getCacheBehaviorLambdaFunctionAssociations,
  getFPCDNOrigins,
} from '../utils/cloudfrontUtils'

const CLOUDFRONT_CONFIG_UPDATE_ATTEMPT_COUNT = 5
const CLOUDFRONT_CONFIG_UPDATE_ATTEMPT_DELAY = 3000 // Milliseconds

/**
 * @throws {ApiException}
 * @throws {import("@aws-sdk/client-lambda").LambdaServiceException}
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
  const newVersions = listVersionsAfterUpdate.filter((conf) => conf?.RevisionId === newRevisionId)
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

  const { DefaultCacheBehavior, CacheBehaviors } = distributionConfig

  let fpCacheBehaviorsFound = 0
  let fpCacheBehaviorsUpdated = 0
  const invalidationPathPatterns: string[] = []
  const fpCDNOrigins = getFPCDNOrigins(distributionConfig)
  console.log('fpCDNOrigins.length', fpCDNOrigins?.length)

  if (doesCacheBehaviorUseOrigins(DefaultCacheBehavior, fpCDNOrigins)) {
    fpCacheBehaviorsFound++
    const lambdaAssocList = getCacheBehaviorLambdaFunctionAssociations(DefaultCacheBehavior, lambdaFunctionName)
    if (lambdaAssocList.length === 1) {
      lambdaAssocList[0].LambdaFunctionARN = latestFunctionArn
      fpCacheBehaviorsUpdated++
      invalidationPathPatterns.push('/*')
      console.info('Updated Fingerprint Pro Lambda@Edge function association in the default cache behavior')
    } else {
      console.info(
        'The default cache behavior has targeted to FP CDN, but has no Fingerprint Pro Lambda@Edge association'
      )
    }
  }

  for (const cacheBehavior of CacheBehaviors?.Items || []) {
    if (!doesCacheBehaviorUseOrigins(cacheBehavior, fpCDNOrigins)) {
      continue
    }

    fpCacheBehaviorsFound++
    const lambdaAssocList = getCacheBehaviorLambdaFunctionAssociations(cacheBehavior, lambdaFunctionName)
    if (lambdaAssocList?.length === 1) {
      lambdaAssocList[0].LambdaFunctionARN = latestFunctionArn
      fpCacheBehaviorsUpdated++
      if (cacheBehavior.PathPattern) {
        let pathPattern = cacheBehavior.PathPattern
        if (!cacheBehavior.PathPattern.startsWith('/')) {
          pathPattern = '/' + pathPattern
        }
        invalidationPathPatterns.push(pathPattern)
        console.info(
          `Updated Fingerprint Pro Lambda@Edge function association in the cache behavior with path ${cacheBehavior.PathPattern}`
        )
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
  }

  if (fpCacheBehaviorsFound === 0) {
    throw new ApiException(ErrorCode.CacheBehaviorNotFound)
  }
  if (fpCacheBehaviorsUpdated === 0) {
    throw new ApiException(ErrorCode.LambdaFunctionAssociationNotFound)
  }
  if (invalidationPathPatterns.length === 0) {
    throw new ApiException(ErrorCode.CacheBehaviorPatternNotDefined)
  }

  const updateParams: UpdateDistributionCommandInput = {
    DistributionConfig: cfConfig.DistributionConfig,
    Id: cloudFrontDistributionId,
    IfMatch: cfConfig.ETag,
  }

  const updateConfigCommand = new UpdateDistributionCommand(updateParams)
  let updateCFResult: UpdateFunctionCodeCommandOutput

  let triedAttempts = 0
  while (triedAttempts < CLOUDFRONT_CONFIG_UPDATE_ATTEMPT_COUNT) {
    console.info(
      `Attempt ${triedAttempts + 1}/${CLOUDFRONT_CONFIG_UPDATE_ATTEMPT_COUNT} started to update CloudFront config`
    )
    try {
      updateCFResult = await cloudFrontClient.send(updateConfigCommand)
      console.info(
        `CloudFront config updated successfully on attempt ${triedAttempts + 1}/${CLOUDFRONT_CONFIG_UPDATE_ATTEMPT_COUNT}`
      )
      console.info(`CloudFront update has finished, ${JSON.stringify(updateCFResult)}`)
      console.info('Going to invalidate routes for upgraded cache behavior')
      invalidateFingerprintIntegrationCache(cloudFrontClient, cloudFrontDistributionId, invalidationPathPatterns).catch(
        (e) => {
          console.info(`Cache invalidation has failed: ${e.message}`)
        }
      )
      return
    } catch (e) {
      console.error(
        `Attempt ${triedAttempts + 1}/${CLOUDFRONT_CONFIG_UPDATE_ATTEMPT_COUNT} failed for updating CloudFront config`,
        e
      )
      if (triedAttempts + 1 === CLOUDFRONT_CONFIG_UPDATE_ATTEMPT_COUNT) {
        throw e
      }
      await delay(CLOUDFRONT_CONFIG_UPDATE_ATTEMPT_DELAY)
    }
    triedAttempts++
  }
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
 * @throws {import("@aws-sdk/client-lambda").LambdaServiceException}
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
  let result: FunctionConfiguration
  try {
    result = await lambdaClient.send(command)
  } catch (e) {
    console.error(`Lambda function update has failed. Error: ${e}`)
    throw new ApiException(ErrorCode.LambdaFunctionUpdateFailed)
  }

  console.info(`Got update command result: ${JSON.stringify(result)}`)

  if (!result?.FunctionArn) {
    throw new ApiException(ErrorCode.LambdaFunctionARNNotFound)
  }

  console.info(`Got Lambda function update result, functionARN: ${result.FunctionArn}`)

  return result
}

async function listLambdaFunctionVersions(
  lambdaClient: LambdaClient,
  functionName: string
): Promise<FunctionConfiguration[]> {
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

  return result.Versions || []
}
