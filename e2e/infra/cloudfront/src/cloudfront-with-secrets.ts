import { getStackOutput } from '../../utils/getStackOutput'
import * as path from 'path'
import * as aws from '@pulumi/aws'
import { resource } from '../../utils/resource'
import { s3OriginId, websiteBucket } from './s3'
import { lambdaCachePolicy, lambdaOriginPolicy } from './lambda'

const { lambdaArn, secretName } = getStackOutput<{ lambdaArn: string; secretName: string }>(
  path.resolve(__dirname, '../../lambda'),
)
const region = aws.config.requireRegion()

const cloudfrontDistro = new aws.cloudfront.Distribution(resource('website-with-secrets'), {
  origins: [
    {
      domainName: websiteBucket.bucketRegionalDomainName,
      originId: s3OriginId,
      customHeaders: [
        {
          name: 'FPJS_SECRET_NAME',
          value: secretName,
        },
        {
          name: 'FPJS_SECRET_REGION',
          value: region,
        },
      ],
    },
  ],
  comment: 'CloudFront for lambda e2e tests with customer variables stored in Secrets Manager',
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
  orderedCacheBehaviors: [
    {
      pathPattern: 'fpjs/*',
      viewerProtocolPolicy: 'redirect-to-https',
      cachePolicyId: lambdaCachePolicy.id,
      originRequestPolicyId: lambdaOriginPolicy.id,
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

export const cloudfrontWithSecretsUrl = cloudfrontDistro.domainName
