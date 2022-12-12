import {
  CloudFrontClient,
  GetDistributionConfigCommand,
  UpdateDistributionCommand,
  UpdateDistributionCommandInput,
  GetDistributionConfigCommandOutput,
} from '@aws-sdk/client-cloudfront'
import {
  CodePipelineClient,
  CodePipelineClientConfig,
  PutJobSuccessResultCommand,
  PutJobFailureResultCommand,
  PutJobSuccessResultCommandInput,
  PutJobFailureResultCommandInput,
  FailureType,
} from '@aws-sdk/client-codepipeline'
import {
  LambdaClient,
  ListVersionsByFunctionCommand,
  ListVersionsByFunctionCommandInput,
  ListVersionsByFunctionCommandOutput,
} from '@aws-sdk/client-lambda'

const REGION = 'us-east-1'

export async function handler(event: any, ctx: any) {
  console.info(JSON.stringify(event))
  
  const job = event['CodePipeline.job']
  if (!job) {
    console.error('No job found')
    return;
  }

  const userInput = JSON.parse(job.data.actionConfiguration.configuration.UserParameters)
  const lambdaFunctionName = userInput.LAMBDA_NAME
  const cloudFrontDistrId = userInput.CF_DISTR_ID

  console.info(`Going to upgrade Fingerprint Pro function association at CloudFront distbution.`)
  console.info(`Lambda function: ${lambdaFunctionName}. CloudFront ID: ${cloudFrontDistrId}`)

  const latestFunctionArn = await getLambdaLatestVersionArn(lambdaFunctionName)
  if (!latestFunctionArn) {
    publishJobFailure(ctx, job, 'No lambda versions')
    return
  }

  const cloudFrontClient = new CloudFrontClient({ region: REGION })

  const configParams = {
    Id: cloudFrontDistrId,
  }
  const getConfigCommand = new GetDistributionConfigCommand(configParams)
  const cfConfig: GetDistributionConfigCommandOutput = await cloudFrontClient.send(getConfigCommand)

  if (!cfConfig.ETag || !cfConfig.DistributionConfig) {
    publishJobFailure(ctx, job, 'CloudFront distribution not found')
    return
  }

  const cacheBehaviors = cfConfig.DistributionConfig.CacheBehaviors
  const fpCbs = cacheBehaviors?.Items?.filter((it) => it.TargetOriginId === 'fpcdn.io')
  if (!fpCbs || fpCbs?.length === 0) {
    publishJobFailure(ctx, job, 'Cache behavior not found')
    return
  }
  const cacheBehavior = fpCbs[0]
  const lambdas = cacheBehavior.LambdaFunctionAssociations?.Items?.filter(
    (it) => it && it.EventType === 'origin-request' && it.LambdaFunctionARN?.includes(lambdaFunctionName),
  )
  if (!lambdas || lambdas?.length === 0) {
    publishJobFailure(ctx, job, 'Lambda function association not found')
    return
  }
  const lambda = lambdas[0]
  lambda.LambdaFunctionARN = latestFunctionArn

  const updateParams: UpdateDistributionCommandInput = {
    DistributionConfig: cfConfig.DistributionConfig,
    Id: cloudFrontDistrId,
    IfMatch: cfConfig.ETag,
  }

  const updateConfigCommand = new UpdateDistributionCommand(updateParams)
  const updateCFResult = await cloudFrontClient.send(updateConfigCommand)
  console.info(`CloudFront update has finished, ${JSON.stringify(updateCFResult)}`)

  publishJobSuccess(ctx, job)
}

async function getLambdaLatestVersionArn(functionName: string): Promise<string | undefined> {
  const client = new LambdaClient({ region: REGION })
  const params: ListVersionsByFunctionCommandInput = {
    FunctionName: functionName,
  }
  const command = new ListVersionsByFunctionCommand(params)
  const result: ListVersionsByFunctionCommandOutput = await client.send(command)
  if (!result.Versions || result.Versions?.length === 0) {
    return Promise.resolve(undefined)
  }

  const latest = result.Versions.filter((it) => it.Version && Number.isFinite(Number.parseInt(it.Version))).sort(
    (a, b) => Number.parseInt(b.Version!!) - Number.parseInt(a.Version!!))[0]
  return Promise.resolve(latest.FunctionArn)
}

function getCodePipelineClient(): CodePipelineClient {
  const config: CodePipelineClientConfig = {
    region: REGION,
    defaultsMode: 'standard',
  }
  const client = new CodePipelineClient(config)
  return client
}

async function publishJobSuccess(ctx: any, job: any) {
  const params: PutJobSuccessResultCommandInput = {
    jobId: job.id,
  }
  try {
    const command = new PutJobSuccessResultCommand(params)
    const result = await getCodePipelineClient().send(command)  
    console.info(`Job successfully finished with ${result}`)
    ctx.succeed()
  } catch (err) {
    ctx.fail(err)
  }
}

async function publishJobFailure(ctx: any, job: any, message: string) {
  const params: PutJobFailureResultCommandInput = {
    jobId: job.id,
    failureDetails: {
      message: message,
      type: FailureType.ConfigurationError,
    },
  }
  try {
    const command = new PutJobFailureResultCommand(params)
    const result = await getCodePipelineClient().send(command)
    console.info(`Job failed with ${result}`)  
    ctx.fail(message)
  } catch (err) {
    ctx.fail(err)
  }
}
