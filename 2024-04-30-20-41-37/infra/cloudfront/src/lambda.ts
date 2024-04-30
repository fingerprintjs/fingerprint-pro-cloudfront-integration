import * as aws from '@pulumi/aws'
import { resource } from '../../utils/resource'

export const lambdaCachePolicy = new aws.cloudfront.CachePolicy(resource('lambda-cache-policy'), {
  minTtl: 0,
  maxTtl: 180,
  defaultTtl: 180,
  parametersInCacheKeyAndForwardedToOrigin: {
    headersConfig: {
      headerBehavior: 'none',
    },
    cookiesConfig: {
      cookieBehavior: 'none',
    },
    queryStringsConfig: {
      queryStringBehavior: 'allExcept',
      queryStrings: {
        items: ['version', 'loaderVersion', 'q'],
      },
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
