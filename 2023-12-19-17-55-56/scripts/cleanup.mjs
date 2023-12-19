import SDK from 'aws-sdk'

const lambda = new SDK.Lambda()
const secretsManager = new SDK.SecretsManager()
const cloudFront = new SDK.CloudFront()

const RESOURCE_PREFIX = 'fpjs-dev-e2e-cloudfront'

const cleanupFns = [cleanupLambdas, cleanupSecrets, cleanupCloudFrontCachePolicies, cleanupCloudFrontOriginPolicies]

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
      console.info('debug', JSON.stringify(getResponse))
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

main().catch((error) => {
  console.error(error)

  process.exit(1)
})
