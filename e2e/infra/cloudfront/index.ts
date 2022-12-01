import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'
import { resource } from './../utils/resource'
import * as path from 'path'
import { getStackOutput } from '../utils/getStackOutput'

const { lambdaArn } = getStackOutput<{ lambdaArn: string }>(path.resolve(__dirname, '../lambda'))

console.log('Lambda arn:', lambdaArn)

// TODO Create two distributions - one with headers and one with secrets manager
// TODO Split into smaller files

/**
 * List of files that will be uploaded into websiteBucket
 * */
const bucketFiles = [
  {
    path: '../../website/dist/index.html',
    contentType: 'text/html',
  },
  {
    path: '../../website/dist/main.js',
    contentType: 'application/javascript',
  },
]

const websiteBucket = new aws.s3.BucketV2(resource('website-bucket'))

new aws.s3.BucketWebsiteConfigurationV2(resource('website-bucket-configuration'), {
  bucket: websiteBucket.id,
  indexDocument: {
    suffix: 'index.html',
  },
})
/**
 * Policy and ACL for website bucket that allows public access
 * */
new aws.s3.BucketPolicy(resource('website-bucket-policy'), {
  bucket: websiteBucket.id,
  policy: {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'PublicReadGetObject',
        Effect: 'Allow',
        Principal: '*',
        Action: 's3:GetObject',
        Resource: pulumi.interpolate`${websiteBucket.arn}/*`,
      },
    ],
  },
})
new aws.s3.BucketAclV2(resource('website-bucket-acl'), {
  bucket: websiteBucket.id,
  acl: 'public-read',
})

// Upload files into website bucket
bucketFiles.forEach((file) => {
  const key = path.basename(file.path)

  console.info('Adding file to bucket with key:', key)

  new aws.s3.BucketObject(key, {
    acl: 'public-read',
    key: key,
    bucket: websiteBucket.id,
    source: new pulumi.asset.FileAsset(file.path),
    contentType: file.contentType,
  })
})
const s3OriginId = resource('s3-origin')

const lambdaCachePolicy = new aws.cloudfront.CachePolicy(resource('lambda-cache-policy'), {
  minTtl: 1,
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
      queryStringBehavior: 'whitelist',
      queryStrings: {
        items: ['version', 'loaderVersion'],
      },
    },
  },
})
const lambdaOriginPolicy = new aws.cloudfront.OriginRequestPolicy(resource('lambda-origin-policy'), {
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

const cloudfrontDistro = new aws.cloudfront.Distribution(resource('website-distro'), {
  origins: [
    {
      domainName: websiteBucket.bucketRegionalDomainName,
      originId: s3OriginId,
      // TODO Create two lambdas, one that will get data from headers, and second that will get data from secrets manager
      customHeaders: [
        {
          name: 'FPJS_GET_RESULT_PATH',
          value: process.env.visitorId ?? 'visitorId',
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
      ],
    },
  ],
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

export const websiteUrl = cloudfrontDistro.domainName
