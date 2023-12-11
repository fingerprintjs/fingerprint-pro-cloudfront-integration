import type { DeploymentSettings } from '../model/DeploymentSettings'
import { LambdaClient, GetFunctionCommand } from '@aws-sdk/client-lambda'

export async function handleStatus(settings: DeploymentSettings) {
  const client = new LambdaClient({})
  const command = new GetFunctionCommand({ FunctionName: settings.LambdaFunctionName })
  const functionResult = await client.send(command)

  return {
    status: '200',
    body: functionResult,
    headers: {
      'content-type': 'application/json',
    },
  }
}
