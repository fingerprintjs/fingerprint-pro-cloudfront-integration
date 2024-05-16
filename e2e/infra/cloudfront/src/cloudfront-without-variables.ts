import { getStackOutput } from '../../utils/getStackOutput'
import * as path from 'path'
import * as aws from '@pulumi/aws'
import { resource } from '../../utils/resource'
import { s3OriginId, websiteBucket } from './s3'
import { lambdaCachePolicy, lambdaOriginPolicy } from './lambda'

const { lambdaArn } = getStackOutput<{ lambdaArn: string }>(path.resolve(__dirname, '../../lambda'))

const cloudfrontDistro = new aws.cloudfront.Distribution(resource('website-without-variables'), {
  origins: [
    {
      domainName: websiteBucket.bucketRegionalDomainName,
      originId: s3OriginId,
      customHeaders: [
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
  comment: 'CloudFront for lambda e2e tests without configured customer variables',
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

export const cloudfrontWithoutVariables = cloudfrontDistro.domainName
