import SDK from 'aws-sdk'

const lambda = new SDK.Lambda()

async function main() {
  for await (const lambdaFunction of listLambdas()) {
    try {
      await lambda.deleteFunction({ FunctionName: lambdaFunction.FunctionName }).promise()

      console.info(`Deleted Lambda function ${lambdaFunction.FunctionName}`)
    } catch (error) {
      console.error(`Failed to delete function ${lambdaFunction.FunctionName}`, error)
    }
  }
}

const LAMBDA_PREFIX = 'fpjs-dev-e2e-cloudfront'

async function* listLambdas() {
  let nextMarker

  do {
    const response = await lambda.listFunctions({ Marker: nextMarker }).promise()

    for (const lambdaFunction of response.Functions ?? []) {
      if (lambdaFunction.FunctionName?.startsWith(LAMBDA_PREFIX)) {
        yield lambdaFunction
      }
    }

    nextMarker = response.NextMarker
  } while (nextMarker)
}

main().catch((error) => {
  console.error(error)

  process.exit(1)
})
