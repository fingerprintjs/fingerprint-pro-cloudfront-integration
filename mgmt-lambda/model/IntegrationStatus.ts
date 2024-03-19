import type { LastUpdateStatusReasonCode } from '@aws-sdk/client-lambda'

export interface IntegrationStatus {
  lambdaFunction: LambdaFunctionInformation | undefined
  cloudFrontDistribution: CloudFrontDistributionInformation | undefined
}

export interface LambdaFunctionInformation {
  functionName: string | undefined
  lastModified: string | undefined
  lastUpdateStatus: string | undefined
  lastUpdateStatusReason: string | undefined
  lastUpdateStatusCode: LastUpdateStatusReasonCode | undefined
  runtime: string | undefined
  version: string | undefined
  handler: string | undefined
}

export interface CloudFrontDistributionInformation {
  id?: string | undefined
  enabled: boolean | undefined
  status: string | undefined
  lastModifiedTime: Date | undefined
  inProgressInvalidationBatches: number | undefined
  cacheBehaviorsWithFingerprintFunction?: number
}
