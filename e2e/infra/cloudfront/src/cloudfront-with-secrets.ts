import { getStackOutput } from '../../utils/getStackOutput'
import * as path from 'path'
import * as aws from '@pulumi/aws'
import { resource } from '../../utils/resource'
import { s3OriginId, websiteBucket } from './s3'
import { lambdaCachePolicy, lambdaOriginPolicy } from './lambda'

const { lambdaArn } = getStackOutput<{ lambdaArn: string }>(path.resolve(__dirname, '../../lambda'))
const region = aws.config.requireRegion()

const secretName = resource('secret')
const secret = new aws.secretsmanager.Secret(secretName, {
  name: secretName,
})
new aws.secretsmanager.SecretVersion(secretName, {
  secretId: secret.id,
  secretString: JSON.stringify({
    fpjs_behavior_path: process.env.FPJS_BEHAVIOR_PATH ?? 'fpjs',
    fpjs_get_result_path: process.env.FPJS_GET_RESULT_PATH ?? 'visitorId',
    fpjs_pre_shared_secret: process.env.FPJS_PRE_SHARED_SECRET ?? '',
    fpjs_agent_download_path: process.env.FPJS_AGENT_DOWNLOAD_PATH ?? 'agent',
  }),
})

const cloudfrontDistro = new aws.cloudfront.Distribution(resource('website-with-secrets'), {
  origins: [
    {
      domainName: websiteBucket.bucketRegionalDomainName,
      originId: s3OriginId,
      customHeaders: [
        {
          name: 'FPJS_SECRET_NAME',
          value: secret.name,
        },
        {
          name: 'FPJS_SECRET_REGION',
          value: region,
        },
      ],
    },
  ],
  comment: 'With secrets',
  enabled: true,
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
