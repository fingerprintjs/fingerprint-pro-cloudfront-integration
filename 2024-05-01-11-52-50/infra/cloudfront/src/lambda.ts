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

export const lambdaOriginPolicy = new aws.cloudfront.OriginRequestPolicy(resource('lambda-origin-policy'), {
  headersConfig: {
    headerBehavior: 'allViewer',
  },
  cookiesConfig: {
    cookieBehavior: 'all',
  },
  queryStringsConfig: {
    queryStringBehavior: 'all',
  },
})
