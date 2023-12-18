import { mockClient } from 'aws-sdk-client-mock'
import { LambdaClient, GetFunctionCommand } from '@aws-sdk/client-lambda'
import type { DeploymentSettings } from '../../model/DeploymentSettings'
import { handleStatus } from '../../handlers/statusHandler'
import 'aws-sdk-client-mock-jest'

const lambdaMock = mockClient(LambdaClient)
const options: DeploymentSettings = {
  CFDistributionId: 'ABCDEF123456',
  LambdaFunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function:1',
  LambdaFunctionName: 'fingerprint-pro-lambda-function',
}

describe('Handle status', () => {
  beforeEach(() => {
    jest.resetModules()
    lambdaMock.reset()
  })

  it('check correct output', async () => {
    const lambdaClient = new LambdaClient({ region: 'us-east-1' })
    lambdaMock
      .on(GetFunctionCommand, {
        FunctionName: options.LambdaFunctionName,
      })
      .resolves({
        Configuration: {
          FunctionName: 'fingerprint-pro-lambda-function',
          FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function',
          Runtime: 'nodejs16.x',
          Role: 'arn:aws:iam::1234567890:role/fingerprint-pro-lambda-role-12345',
          Handler: 'fingerprintjs-pro-cloudfront-lambda-function.handler',
          CodeSize: 216954,
          Description: 'Lambda@Edge function definition',
          Timeout: 3,
          MemorySize: 128,
          LastModified: '2023-12-08T09:59:25.640+0000',
          CodeSha256: 'ClbW2NR9v7AL4TiXaInYX/AdkXEXhlLtdqlUq7FuA28=',
          Version: '$LATEST',
          TracingConfig: {
            Mode: 'PassThrough',
          },
          RevisionId: 'a9771b2b-d5b6-4883-81d7-8b41c7e3657b',
          State: 'Active',
          LastUpdateStatus: 'Successful',
          PackageType: 'Zip',
          Architectures: ['x86_64'],
          EphemeralStorage: {
            Size: 512,
          },
          SnapStart: {
            ApplyOn: 'None',
            OptimizationStatus: 'Off',
          },
          RuntimeVersionConfig: {
            RuntimeVersionArn:
              'arn:aws:lambda:us-east-1::runtime:4e2039583091c0651610076c3dd9a8189c3ed6432409fa99fef039930fafa705',
          },
        },
      })

    const status = await handleStatus(lambdaClient, options)
    expect(status.statusCode).toBe(200)

    const functionInfo = JSON.parse(status.body)
    expect(functionInfo['Configuration']['FunctionName']).toBe('fingerprint-pro-lambda-function')

    expect(lambdaMock).toHaveReceivedCommandWith(GetFunctionCommand, {
      FunctionName: options.LambdaFunctionName,
    })
    expect(lambdaMock).toHaveReceivedCommandTimes(GetFunctionCommand, 1)
  })
})
