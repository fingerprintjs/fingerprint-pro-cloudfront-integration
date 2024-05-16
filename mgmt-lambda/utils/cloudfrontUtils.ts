import { CacheBehavior, DefaultCacheBehavior, DistributionConfig, EventType, Origin } from '@aws-sdk/client-cloudfront'
import { defaults } from '../DefaultSettings'
import { LambdaFunctionAssociation } from '@aws-sdk/client-cloudfront'

export function getFPCDNOrigins(distributionConfig: DistributionConfig | undefined): Origin[] {
  return distributionConfig?.Origins?.Items?.filter((it) => it.DomainName === defaults.FP_CDN_URL) || []
}

export function doesCacheBehaviorUseOrigins(
  cacheBehavior: DefaultCacheBehavior | CacheBehavior | undefined,
  origins: Origin[]
): boolean {
  return origins?.some((origin) => origin.Id === cacheBehavior?.TargetOriginId) || false
}

export function getCacheBehaviorLambdaFunctionAssociations(
  cacheBehavior: DefaultCacheBehavior | CacheBehavior | undefined,
  functionName: string
): LambdaFunctionAssociation[] {
  return (
    cacheBehavior?.LambdaFunctionAssociations?.Items?.filter(
      (it) => it && it.EventType === EventType.origin_request && it.LambdaFunctionARN?.includes(`${functionName}:`)
    ) || []
  )
}
