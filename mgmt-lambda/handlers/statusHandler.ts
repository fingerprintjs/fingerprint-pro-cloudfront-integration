import { APIGatewayProxyResult } from 'aws-lambda'
import type { DeploymentSettings } from '../model/DeploymentSettings'
import { LambdaClient, GetFunctionCommand } from '@aws-sdk/client-lambda'
import { CloudFrontClient, GetDistributionCommand } from '@aws-sdk/client-cloudfront'
import { defaults } from '../DefaultSettings'
import type {
  IntegrationStatus,
  LambdaFunctionInformation,
  CloudFrontDistributionInformation,
} from '../model/IntegrationStatus'

export async function handleStatus(
  lambdaClient: LambdaClient,
  cloudFrontClient: CloudFrontClient,
  settings: DeploymentSettings
): Promise<APIGatewayProxyResult> {
  const lambdaFunctionInformation = await getLambdaFunctionInformation(lambdaClient, settings.LambdaFunctionName)
  const cloudFrontDistributionInformation = await getCloudFrontDistributionInformation(
    cloudFrontClient,
    settings.CFDistributionId,
    settings.LambdaFunctionName
  )
  const result: IntegrationStatus = {
    lambdaFunction: lambdaFunctionInformation,
    cloudFrontDistribution: cloudFrontDistributionInformation,
  }

  const statusCode = lambdaFunctionInformation && cloudFrontDistributionInformation ? 200 : 500

  return {
    statusCode: statusCode,
    body: JSON.stringify(result),
    headers: {
      'content-type': 'application/json',
    },
  }
}

async function getLambdaFunctionInformation(
  lambdaClient: LambdaClient,
  functionName: string
): Promise<LambdaFunctionInformation | undefined> {
  const command = new GetFunctionCommand({ FunctionName: functionName })
  try {
    const result = await lambdaClient.send(command)
    return {
      functionName: result.Configuration?.FunctionName,
      lastModified: result.Configuration?.LastModified,
      lastUpdateStatus: result.Configuration?.LastUpdateStatus,
      lastUpdateStatusReason: result.Configuration?.LastUpdateStatusReason,
      lastUpdateStatusCode: result.Configuration?.LastUpdateStatusReasonCode,
      runtime: result.Configuration?.Runtime,
      version: result.Configuration?.Version,
      handler: result.Configuration?.Handler,
    }
  } catch (error) {
    console.error('Unable to get lambda function information', error)
    return undefined
  }
}

async function getCloudFrontDistributionInformation(
  cloudFrontClient: CloudFrontClient,
  distributionId: string,
  functionName: string
): Promise<CloudFrontDistributionInformation | undefined> {
  const command = new GetDistributionCommand({ Id: distributionId })
  try {
    const result = await cloudFrontClient.send(command)

    let cacheBehaviorsWithFingerprintFunction = 0
    if (result.Distribution?.DistributionConfig?.DefaultCacheBehavior?.TargetOriginId === defaults.FP_CDN_URL) {
      const lambdas =
        result.Distribution?.DistributionConfig?.DefaultCacheBehavior.LambdaFunctionAssociations?.Items?.filter(
          (it) => it && it.EventType === 'origin-request' && it.LambdaFunctionARN?.includes(`${functionName}:`)
        )
      if (lambdas) {
        cacheBehaviorsWithFingerprintFunction += lambdas.length
      }
    }

    const fpCbs = result.Distribution?.DistributionConfig?.CacheBehaviors?.Items?.filter(
      (it) => it.TargetOriginId === defaults.FP_CDN_URL
    )
    if (fpCbs && fpCbs?.length > 0) {
      fpCbs.forEach((cacheBehavior) => {
        const lambdas = cacheBehavior.LambdaFunctionAssociations?.Items?.filter(
          (it) => it && it.EventType === 'origin-request' && it.LambdaFunctionARN?.includes(`${functionName}:`)
        )
        if (lambdas) {
          cacheBehaviorsWithFingerprintFunction += lambdas.length
        }
      })
    }

    return {
      id: result.Distribution?.Id,
      enabled: result.Distribution?.DistributionConfig?.Enabled,
      status: result.Distribution?.Status,
      lastModifiedTime: result.Distribution?.LastModifiedTime,
      inProgressInvalidationBatches: result.Distribution?.InProgressInvalidationBatches,
      cacheBehaviorsWithFingerprintFunction: cacheBehaviorsWithFingerprintFunction,
    }
  } catch (error) {
    console.error('Unable to get CloudFront distribution information', error)
    return undefined
  }
}
