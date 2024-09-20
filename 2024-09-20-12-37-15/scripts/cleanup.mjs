import { DeleteFunctionCommand, LambdaClient, paginateListFunctions } from '@aws-sdk/client-lambda'
import { SecretsManagerClient, paginateListSecrets, DeleteSecretCommand } from '@aws-sdk/client-secrets-manager'
import {
  CloudFrontClient,
  DeleteCachePolicyCommand,
  DeleteOriginRequestPolicyCommand,
  GetCachePolicyCommand,
  GetOriginRequestPolicyCommand,
  ListCachePoliciesCommand,
  ListOriginRequestPoliciesCommand,
} from '@aws-sdk/client-cloudfront'
import {
  DeleteBucketCommand,
  DeleteObjectsCommand,
  ListBucketsCommand,
  paginateListObjectsV2,
  S3Client,
} from '@aws-sdk/client-s3'

const lambda = new LambdaClient()
const secretsManager = new SecretsManagerClient()
const cloudFront = new CloudFrontClient()
const s3 = new S3Client()

const RESOURCE_PREFIX = 'fpjs-dev-e2e-cloudfront'

const cleanupFns = [
  cleanupLambdas,
  cleanupSecrets,
  cleanupCloudFrontCachePolicies,
  cleanupCloudFrontOriginPolicies,
  cleanupS3Buckets,
]

async function main() {
  for (const cleanupFn of cleanupFns) {
    await cleanupFn()
  }
}

async function cleanupLambdas() {
  for await (const lambdaFunction of listLambdas()) {
    try {
      const deleteFunctionCommand = new DeleteFunctionCommand({ FunctionName: lambdaFunction.FunctionName })
      await lambda.send(deleteFunctionCommand)

      console.info(`Deleted Lambda function ${lambdaFunction.FunctionName}`)
    } catch (error) {
      console.error(`Failed to delete function ${lambdaFunction.FunctionName}`, error)
    }
  }
}

async function cleanupSecrets() {
  for await (const secret of listSecrets()) {
    try {
      const deleteSecretCommand = new DeleteSecretCommand({ SecretId: secret.ARN })
      await secretsManager.send(deleteSecretCommand)

      console.info(`Deleted secret ${secret.ARN}`)
    } catch (error) {
      console.error(`Failed to delete secret ${secret.ARN}`, error)
    }
  }
}

async function cleanupCloudFrontCachePolicies() {
  for await (const policy of listCloudFrontCachePolicies()) {
    try {
      const getCachePolicyCommand = new GetCachePolicyCommand({ Id: policy.CachePolicy.Id })
      const getResponse = await cloudFront.send(getCachePolicyCommand)
      const deleteCachePolicyCommand = new DeleteCachePolicyCommand({
        Id: policy.CachePolicy.Id,
        IfMatch: getResponse.ETag,
      })
      await cloudFront.send(deleteCachePolicyCommand)
      console.info(`Deleted Cache Policy ${policy.CachePolicy.CachePolicyConfig.Name}`)
    } catch (error) {
      console.error(`Failed to delete Cache Policy ${policy.CachePolicy.CachePolicyConfig.Name}`, error)
    }
  }
}

async function cleanupCloudFrontOriginPolicies() {
  for await (const policy of listCloudFrontOriginPolicies()) {
    try {
      const getOriginRequestPolicyCommand = new GetOriginRequestPolicyCommand({ Id: policy.OriginRequestPolicy.Id })
      const getResponse = await cloudFront.send(getOriginRequestPolicyCommand)
      const deleteOriginRequestPolicyCommand = new DeleteOriginRequestPolicyCommand({
        Id: policy.OriginRequestPolicy.Id,
        IfMatch: getResponse.ETag,
      })
      await cloudFront.send(deleteOriginRequestPolicyCommand)
      console.info(`Deleted Origin Request Policy ${policy.OriginRequestPolicy.OriginRequestPolicyConfig.Name}`)
    } catch (error) {
      console.error(
        `Failed to delete Origin Request Policy ${policy.OriginRequestPolicy.OriginRequestPolicyConfig.Name}`,
        error
      )
    }
  }
}

async function cleanupS3Buckets() {
  for await (const bucket of listS3Buckets()) {
    try {
      await emptyS3Bucket(bucket.Name)
      const deleteBucketCommand = new DeleteBucketCommand({ Bucket: bucket.Name })
      await s3.send(deleteBucketCommand)
      console.info(`Deleted S3 bucket: ${bucket.Name}`)
    } catch (error) {
      console.error(`Failed to delete S3 bucket ${bucket.Name}`, error)
    }
  }
}

async function* listLambdas() {
  const paginator = paginateListFunctions({ client: lambda }, {})

  for await (const page of paginator) {
    for (const lambdaFunction of page.Functions ?? []) {
      if (lambdaFunction.FunctionName?.startsWith(RESOURCE_PREFIX)) {
        yield lambdaFunction
      }
    }
  }
}

async function* listSecrets() {
  const paginator = paginateListSecrets(
    { client: secretsManager },
    {
      Filters: [
        {
          Key: 'name',
          Values: [RESOURCE_PREFIX],
        },
      ],
    }
  )

  for await (const page of paginator) {
    for (const secret of page.SecretList ?? []) {
      yield secret
    }
  }
}

async function* listCloudFrontCachePolicies() {
  let nextMarker

  do {
    const listCachePoliciesCommand = new ListCachePoliciesCommand({
      Marker: nextMarker,
    })
    const listResponse = await cloudFront.send(listCachePoliciesCommand)
    const policies = listResponse?.CachePolicyList?.Items ?? []

    for (const policy of policies) {
      if (policy.CachePolicy?.CachePolicyConfig?.Name?.startsWith(RESOURCE_PREFIX)) {
        yield policy
      }
    }

    nextMarker = listResponse.CachePolicyList?.NextMarker
  } while (nextMarker)
}

async function* listCloudFrontOriginPolicies() {
  let nextMarker

  do {
    const listOriginRequestPoliciesCommand = new ListOriginRequestPoliciesCommand({
      Marker: nextMarker,
    })
    const listResponse = await cloudFront.send(listOriginRequestPoliciesCommand)
    const policies = listResponse?.OriginRequestPolicyList?.Items ?? []

    for (const policy of policies) {
      if (policy.OriginRequestPolicy?.OriginRequestPolicyConfig?.Name?.startsWith(RESOURCE_PREFIX)) {
        yield policy
      }
    }

    nextMarker = listResponse.OriginRequestPolicyList?.NextMarker
  } while (nextMarker)
}

async function* listS3Buckets() {
  const listBucketsCommand = new ListBucketsCommand({})
  const listBuckets = await s3.send(listBucketsCommand)
  const buckets = listBuckets.Buckets ?? []
  for (const bucket of buckets) {
    if (bucket.Name.startsWith(RESOURCE_PREFIX)) {
      yield bucket
    }
  }
}

async function emptyS3Bucket(bucketName) {
  const paginator = paginateListObjectsV2({ client: s3 }, { Bucket: bucketName })
  for await (const page of paginator) {
    if (page?.KeyCount > 0) {
      const deleteParams = {
        Bucket: bucketName,
        Delete: { Objects: page.Contents.map(({ Key }) => ({ Key })) },
      }
      console.info(`Removing objects from S3 bucket: ${JSON.stringify(deleteParams)}. `)

      const deleteObjectsCommand = new DeleteObjectsCommand(deleteParams)
      await s3.send(deleteObjectsCommand)
    }
  }
}

main().catch((error) => {
  console.error(error)

  process.exit(1)
})
