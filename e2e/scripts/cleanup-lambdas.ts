import { Lambda } from 'aws-sdk'

async function main() {
  //const lambda = new Lambda()

  for await (const lambdaFunction of listLambdas()) {
    try {
      // TODO Uncomment after testing it on AWS side
      //await lambda.deleteFunction({ FunctionName: lambdaFunction.FunctionName }).promise()

      console.info(`Deleted Lambda function ${lambdaFunction.FunctionName}`)
    } catch (error) {
      console.error(`Failed to delete function ${lambdaFunction.FunctionName}`, error)
    }
  }
}

const LAMBDA_PREFIX = 'fpjs-dev-e2e-cloudfront'

async function* listLambdas() {
  const lambda = new Lambda()

  let nextMarker: string | undefined

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
