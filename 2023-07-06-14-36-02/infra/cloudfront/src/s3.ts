// TODO Create two distributions - one with headers and one with secrets manager

import * as aws from '@pulumi/aws'
import { resource } from '../../utils/resource'
import * as pulumi from '@pulumi/pulumi'
import * as path from 'path'

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

export const websiteBucket = new aws.s3.BucketV2(resource('website-bucket'))

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

export const s3OriginId = resource('s3-origin')
