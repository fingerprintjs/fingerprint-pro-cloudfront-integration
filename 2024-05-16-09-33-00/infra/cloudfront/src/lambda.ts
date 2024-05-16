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
