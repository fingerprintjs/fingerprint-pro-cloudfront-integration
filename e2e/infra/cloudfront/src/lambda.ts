import * as aws from '@pulumi/aws'
import { resource } from '../../utils/resource'

export const lambdaCachePolicy = new aws.cloudfront.CachePolicy(resource('lambda-cache-policy'), {
  minTtl: 0,
  maxTtl: 0,
  defaultTtl: 0,
  parametersInCacheKeyAndForwardedToOrigin: {
    headersConfig: {
      headerBehavior: 'none',
    },
    cookiesConfig: {
      cookieBehavior: 'none',
    },
    queryStringsConfig: {
      queryStringBehavior: 'none',
    },
  },
})

export const lambdaOriginPolicy = '216adef6-5c7f-47e4-b989-5492eafa07d3' // default AllViewer policy
