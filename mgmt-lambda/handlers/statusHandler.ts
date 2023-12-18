import { APIGatewayProxyResult } from 'aws-lambda'
import type { DeploymentSettings } from '../model/DeploymentSettings'
import { LambdaClient, GetFunctionCommand } from '@aws-sdk/client-lambda'

export async function handleStatus(
  lambdaClient: LambdaClient,
  settings: DeploymentSettings,
): Promise<APIGatewayProxyResult> {
  const command = new GetFunctionCommand({ FunctionName: settings.LambdaFunctionName })
  const functionResult = await lambdaClient.send(command)

  return {
    statusCode: 200,
    body: JSON.stringify(functionResult),
    headers: {
      'content-type': 'application/json',
    },
  }
}