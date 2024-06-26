import { getStackOutput } from '../../utils/getStackOutput'
import * as path from 'path'
import * as aws from '@pulumi/aws'
import { resource } from '../../utils/resource'
import { s3OriginId, websiteBucket } from './s3'
import { lambdaCachePolicy, lambdaOriginPolicy } from './lambda'

const { lambdaArn } = getStackOutput<{ lambdaArn: string }>(path.resolve(__dirname, '../../lambda'))

const cloudfrontDistro = new aws.cloudfront.Distribution(resource('website-with-headers'), {
  origins: [
    {
      domainName: websiteBucket.bucketRegionalDomainName,
      originId: s3OriginId,
      customHeaders: [
        {
          name: 'FPJS_GET_RESULT_PATH',
          value: process.env.FPJS_GET_RESULT_PATH ?? 'visitorId',
        },
        {
          name: 'FPJS_PRE_SHARED_SECRET',
          value: process.env.FPJS_PRE_SHARED_SECRET ?? '',
        },
        {
          name: 'FPJS_AGENT_DOWNLOAD_PATH',
          value: process.env.FPJS_AGENT_DOWNLOAD_PATH ?? 'agent',
        },
        {
          name: 'FPJS_BEHAVIOR_PATH',
          value: process.env.FPJS_BEHAVIOR_PATH ?? 'fpjs',
        },
        {
          name: 'FPJS_DEBUG',
          value: 'true',
        },
      ],
      customOriginConfig: {
        httpPort: 80,
        httpsPort: 443,
        originKeepaliveTimeout: 5,
        originProtocolPolicy: 'https-only',
        originReadTimeout: 30,
        originSslProtocols: ['TLSv1.2'],
      },
    },
  ],
  enabled: true,
  priceClass: 'PriceClass_100',
  defaultRootObject: 'index.html',
  defaultCacheBehavior: {
    allowedMethods: ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT'],
    cachedMethods: ['GET', 'HEAD'],
    targetOriginId: s3OriginId,
    forwardedValues: {
      queryString: true,
      cookies: {
        forward: 'all',
      },
    },
    viewerProtocolPolicy: 'allow-all',
    minTtl: 0,
    defaultTtl: 3600,
    maxTtl: 86400,
  },
  comment: 'CloudFront for lambda e2e tests with customer variables stored in headers',
  orderedCacheBehaviors: [
    {
      pathPattern: 'fpjs/*',
      viewerProtocolPolicy: 'redirect-to-https',
      cachePolicyId: lambdaCachePolicy.id,
      originRequestPolicyId: lambdaOriginPolicy,
      allowedMethods: ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT'],
      cachedMethods: ['GET', 'HEAD'],
      targetOriginId: s3OriginId,
      lambdaFunctionAssociations: [
        {
          lambdaArn,
          eventType: 'origin-request',
          includeBody: true,
        },
      ],
    },
  ],
  restrictions: {
    geoRestriction: {
      restrictionType: 'none',
    },
  },
  viewerCertificate: {
    cloudfrontDefaultCertificate: true,
  },
})

export const cloudfrontWithHeadersUrl = cloudfrontDistro.domainName
