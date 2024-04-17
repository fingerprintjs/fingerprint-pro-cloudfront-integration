import SDK from 'aws-sdk'

const lambda = new SDK.Lambda()
const secretsManager = new SDK.SecretsManager()

const RESOURCE_PREFIX = 'fpjs-dev-e2e-cloudfront'

const cleanupFns = [cleanupLambdas, cleanupSecrets]

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

main().catch((error) => {
  console.error(error)

  process.exit(1)
})
