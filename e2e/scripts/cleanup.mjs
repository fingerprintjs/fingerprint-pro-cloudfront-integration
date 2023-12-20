import SDK from 'aws-sdk'

const lambda = new SDK.Lambda()
const secretsManager = new SDK.SecretsManager()
const cloudFront = new SDK.CloudFront()
const s3 = new SDK.S3()

const RESOURCE_PREFIX = 'fpjs-dev-e2e-cloudfront'

const cleanupFns = [
  cleanupLambdas,
  cleanupSecrets,
  cleanupCloudFrontCachePolicies,
  cleanupCloudFrontOriginPolicies,
  cleanupS3Buckets
]

async function main() {
  for (const cleanupFn of cleanupFns) {
    await cleanupFn()
  }
}

async function cleanupLambdas() {
  for await (const lambdaFunction of listLambdas()) {
    try {
      await lambda.deleteFunction({ FunctionName: lambdaFunction.FunctionName }).promise()

      console.info(`Deleted Lambda function ${lambdaFunction.FunctionName}`)
    } catch (error) {
      console.error(`Failed to delete function ${lambdaFunction.FunctionName}`, error)
    }
  }
}

async function cleanupSecrets() {
  for await (const secret of listSecrets()) {
    try {
      await secretsManager.deleteSecret({ SecretId: secret.ARN }).promise()

      console.info(`Deleted secret ${secret.ARN}`)
    } catch (error) {
      console.error(`Failed to delete secret ${secret.ARN}`, error)
    }
  }
}

async function cleanupCloudFrontCachePolicies() {
  for await(const policy of listCloudFrontCachePolicies()) {
    try {
      const getResponse = await cloudFront.getCachePolicy({ Id: policy.CachePolicy.Id }).promise()
      await cloudFront.deleteCachePolicy({ Id: policy.CachePolicy.Id, IfMatch: getResponse.ETag }).promise()
      console.info(`Deleted Cache Policy ${policy.CachePolicy.CachePolicyConfig.Name}`)
    } catch (error) {
      console.error(`Failed to delete Cache Policy ${policy.CachePolicy.CachePolicyConfig.Name}`, error)
    }
  }
}

async function cleanupCloudFrontOriginPolicies() {
  for await(const policy of listCloudFrontOriginPolicies()) {
    try {
      const getResponse = await cloudFront.getOriginRequestPolicy({ Id: policy.OriginRequestPolicy.Id }).promise()
      await cloudFront.deleteOriginRequestPolicy({ Id: policy.OriginRequestPolicy.Id, IfMatch: getResponse.ETag }).promise()
      console.info(`Deleted Origin Request Policy ${policy.OriginRequestPolicy.OriginRequestPolicyConfig.Name}`)
    } catch (error) {
      console.error(`Failed to delete Origin Request Policy ${policy.OriginRequestPolicy.OriginRequestPolicyConfig.Name}`, error)
    }
  }
}

async function cleanupS3Buckets() {
  for await(const bucket of listS3Buckets()) {
    try {
      await emptyS3Bucket(bucket.Name)
      await s3.deleteBucket({ Bucket: bucket.Name }).promise()
      console.info(`Deleted S3 bucket: ${bucket.Name}`)
    } catch (error) {
      console.error(`Failed to delete S3 bucket ${bucket.Name}`, error)
    }
  }
}

async function* listLambdas() {
  let nextMarker

  do {
    const response = await lambda.listFunctions({ Marker: nextMarker }).promise()

    for (const lambdaFunction of response.Functions ?? []) {
      if (lambdaFunction.FunctionName?.startsWith(RESOURCE_PREFIX)) {
        yield lambdaFunction
      }
    }

    nextMarker = response.NextMarker
  } while (nextMarker)
}

async function* listSecrets() {
  let nextToken

  do {
    const response = await secretsManager
      .listSecrets({
        Filters: [
          {
            Key: 'name',
            Values: [RESOURCE_PREFIX],
          },
        ],
        NextToken: nextToken,
      })
      .promise()

    for (const secret of response.SecretList ?? []) {
      yield secret
    }

    nextToken = response.NextToken
  } while (nextToken)
}

async function* listCloudFrontCachePolicies() {
  let nextMarker

  do {
    const listResponse = await cloudFront.listCachePolicies({ Marker: nextMarker }).promise()
    const policies = listResponse.CachePolicyList.Items

    for (const policy of policies) {
      if (policy.CachePolicy.CachePolicyConfig.Name.startsWith(RESOURCE_PREFIX)) {
        yield policy
      }
    }

    nextMarker = listResponse.CachePolicyList.NextMarker
  } while (nextMarker)
}

async function* listCloudFrontOriginPolicies() {
  let nextMarker

  do {
    const listResponse = await cloudFront.listOriginRequestPolicies({ Marker: nextMarker }).promise()
    const policies = listResponse.OriginRequestPolicyList.Items

    for (const policy of policies) {
      if (policy.OriginRequestPolicy.OriginRequestPolicyConfig.Name.startsWith(RESOURCE_PREFIX)) {
        yield policy
      }
    }

    nextMarker = listResponse.OriginRequestPolicyList.NextMarker
  } while (nextMarker)
}

async function* listS3Buckets() {
  const listBuckets = await s3.listBuckets().promise()
  const buckets = listBuckets.Buckets
  for (const bucket of buckets) {
    if (bucket.Name.startsWith(RESOURCE_PREFIX)) {
      yield bucket
    }
  }
}

async function emptyS3Bucket(bucketName) {
  const listedObjects = await s3.listObjectsV2({ Bucket: bucketName }).promise()

  if (listedObjects.Contents.length === 0) {
    return
  }

  const deleteParams = {
    Bucket: bucketName,
    Delete: { Objects: listedObjects.Contents.map(({ Key }) => ({ Key })) },
  }

  console.info(`Removing objects from S3 bucket: ${JSON.stringify(deleteParams)}. `);

  await s3.deleteObjects(deleteParams).promise()

  if (listedObjects.IsTruncated) {
    await emptyS3Bucket(bucketName)
  }
}

main().catch((error) => {
  console.error(error)

  process.exit(1)
})
