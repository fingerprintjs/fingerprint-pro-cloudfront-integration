import * as aws from '@pulumi/aws'
import { resource } from '../../utils/resource'
import * as pulumi from '@pulumi/pulumi'
import * as path from 'path'

function publicReadPolicyForBucket(bucketName: string) {
  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: '*',
        Action: ['s3:GetObject'],
        Resource: [
          `arn:aws:s3:::${bucketName}/*`, // policy refers to bucket name explicitly
        ],
      },
    ],
  })
}

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

export const websiteBucket = new aws.s3.Bucket(resource('website-bucket'), {
  website: {
    indexDocument: 'index.html',
  },
})

const accessBlock = new aws.s3.BucketPublicAccessBlock(resource('website-bucket-access-block'), {
  bucket: websiteBucket.id,
  blockPublicAcls: false,
  blockPublicPolicy: false,
})

export const websiteBucketUrl = websiteBucket.websiteEndpoint

/*
new aws.s3.BucketAclV2(resource('website-bucket-acl'), {
  bucket: websiteBucket.id,
  acl: 'public-read',
})
*/

// Upload files into website bucket
bucketFiles.forEach((file) => {
  const key = path.basename(file.path)

  console.info('Adding file to bucket with key:', key)

  new aws.s3.BucketObject(key, {
    key,
    bucket: websiteBucket,
    source: new pulumi.asset.FileAsset(file.path),
    contentType: file.contentType,
  })
})

export const s3OriginId = resource('s3-origin')

/**
 * Policy and ACL for website bucket that allows public access
 * */
new aws.s3.BucketPolicy(
  resource('website-bucket-policy'),
  {
    bucket: websiteBucket as any,
    policy: websiteBucket.bucket.apply(publicReadPolicyForBucket),
  },
  {
    dependsOn: [accessBlock],
  }
)
