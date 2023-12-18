import { mockClient } from 'aws-sdk-client-mock'
import {
  LambdaClient,
  GetFunctionCommand,
  GetFunctionResponse,
  ListVersionsByFunctionCommand,
  ListVersionsByFunctionResponse,
  UpdateFunctionCodeCommand,
} from '@aws-sdk/client-lambda'
import {
  CloudFrontClient,
  CreateInvalidationCommand,
  CreateInvalidationCommandInput,
  GetDistributionConfigCommand,
  GetDistributionConfigResult,
  UpdateDistributionCommand,
  UpdateDistributionCommandInput,
} from '@aws-sdk/client-cloudfront'
import { handleUpdate } from '../../handlers/updateHandler'
import type { DeploymentSettings } from '../../model/DeploymentSettings'
import 'aws-sdk-client-mock-jest'

const lambdaMock = mockClient(LambdaClient)
const lambdaClient = new LambdaClient({ region: 'us-east-1' })
const cloudFrontMock = mockClient(CloudFrontClient)
const cloudFrontClient = new CloudFrontClient({ region: 'us-east-1' })
const settings: DeploymentSettings = {
  CFDistributionId: 'ABCDEF123456',
  LambdaFunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function',
  LambdaFunctionName: 'fingerprint-pro-lambda-function',
}

const existingLambdaVersions: ListVersionsByFunctionResponse = {
  Versions: [
    {
      FunctionName: 'fingerprint-pro-lambda-function',
      FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function:2',
      Version: '2',
    },
    {
      FunctionName: 'fingerprint-pro-lambda-function',
      FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function:1',
      Version: '1',
    },
  ],
}

const functionInfo: GetFunctionResponse = {
  Configuration: {
    FunctionName: 'fingerprint-pro-lambda-function',
    FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function',
    Version: '$LATEST',
  },
}

const cloudFrontConfigBeforeUpdate: GetDistributionConfigResult = {
  ETag: 'ABCDEF123456',
  DistributionConfig: {
    CallerReference: 'fccd3c1c-9e1b-4d4e-ae07-d3970f9e7e58',
    Origins: {
      Quantity: 1,
      Items: [
        {
          Id: 'fpcdn.io',
          DomainName: 'fpcdn.io',
        },
      ],
    },
    DefaultCacheBehavior: {
      TargetOriginId: 'fpcdn.io',
      ViewerProtocolPolicy: 'https-only',
    },
    CacheBehaviors: {
      Quantity: 1,
      Items: [
        {
          PathPattern: 'fpjs/*',
          TargetOriginId: 'fpcdn.io',
          ViewerProtocolPolicy: 'https-only',
          LambdaFunctionAssociations: {
            Quantity: 1,
            Items: [
              {
                LambdaFunctionARN: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function',
                EventType: 'origin-request',
                IncludeBody: true,
              },
            ],
          },
        },
      ],
    },
    Enabled: true,
    Comment: '',
  },
}

const updatedCloudFrontConfig: UpdateDistributionCommandInput = {
  DistributionConfig: {
    CallerReference: 'fccd3c1c-9e1b-4d4e-ae07-d3970f9e7e58',
    Origins: {
      Quantity: 1,
      Items: [
        {
          Id: 'fpcdn.io',
          DomainName: 'fpcdn.io',
        },
      ],
    },
    DefaultCacheBehavior: {
      TargetOriginId: 'fpcdn.io',
      ViewerProtocolPolicy: 'https-only',
    },
    CacheBehaviors: {
      Quantity: 1,
      Items: [
        {
          PathPattern: '/fpjs/*',
          TargetOriginId: 'fpcdn.io',
          ViewerProtocolPolicy: 'https-only',
          LambdaFunctionAssociations: {
            Quantity: 1,
            Items: [
              {
                LambdaFunctionARN: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function:3',
                EventType: 'origin-request',
                IncludeBody: true,
              },
            ],
          },
        },
      ],
    },
    Enabled: true,
    Comment: '',
  },
  Id: 'ABCDEF123456',
  IfMatch: 'ABCDEF123456',
}

const createInvalidation: CreateInvalidationCommandInput = {
  DistributionId: 'ABCDEF123456',
  InvalidationBatch: {
    Paths: {
      Quantity: 1,
      Items: ['fpjs/*'],
    },
    CallerReference: 'fingerprint-pro-management-lambda-function',
  },
}

describe('Handle mgmt-update', () => {
  beforeEach(() => {
    jest.resetModules()
    lambdaMock.reset()
    cloudFrontMock.reset()
  })

  it('basic test', async () => {
    lambdaMock
      .on(ListVersionsByFunctionCommand, {
        FunctionName: settings.LambdaFunctionName,
      })
      .resolves(existingLambdaVersions)

    lambdaMock
      .on(GetFunctionCommand, {
        FunctionName: settings.LambdaFunctionName,
      })
      .resolves(functionInfo)

    lambdaMock
      .on(UpdateFunctionCodeCommand, {
        S3Bucket: 'fingerprint-pro-cloudfront-integration-lambda-function',
        S3Key: 'release/lambda_latest.zip',
        FunctionName: 'fingerprint-pro-lambda-function',
        Publish: true,
      })
      .resolves({
        FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function:3',
      })

    cloudFrontMock.on(GetDistributionConfigCommand, { Id: 'ABCDEF123456' }).resolves(cloudFrontConfigBeforeUpdate)

    cloudFrontMock.on(CreateInvalidationCommand, createInvalidation).resolves({})

    cloudFrontMock.on(UpdateDistributionCommand, updatedCloudFrontConfig).resolves({})

    const result = await handleUpdate(lambdaClient, cloudFrontClient, settings)
    expect(result.statusCode).toBe(200)

    expect(lambdaMock).toHaveReceivedCommandTimes(ListVersionsByFunctionCommand, 1)
    expect(lambdaMock).toHaveReceivedCommandTimes(UpdateFunctionCodeCommand, 1)
    expect(cloudFrontMock).toHaveReceivedCommandTimes(GetDistributionConfigCommand, 1)
    expect(cloudFrontMock).toHaveReceivedCommandTimes(UpdateDistributionCommand, 1)
    expect(cloudFrontMock).toHaveReceivedCommandTimes(CreateInvalidationCommand, 1)
  })

  it('No lambda version', async () => {
    lambdaMock
      .on(ListVersionsByFunctionCommand, {
        FunctionName: settings.LambdaFunctionName,
      })
      .resolves({})

    const result = await handleUpdate(lambdaClient, cloudFrontClient, settings)
    expect(result.statusCode).toBe(500)
    const error = JSON.parse(result.body)['error']
    expect(error).toBe('No lambda version')

    expect(lambdaMock).toHaveReceivedCommandTimes(ListVersionsByFunctionCommand, 1)
    expect(lambdaMock).toHaveReceivedCommandTimes(UpdateFunctionCodeCommand, 0)
    expect(cloudFrontMock).toHaveReceivedCommandTimes(GetDistributionConfigCommand, 0)
    expect(cloudFrontMock).toHaveReceivedCommandTimes(UpdateDistributionCommand, 0)
    expect(cloudFrontMock).toHaveReceivedCommandTimes(CreateInvalidationCommand, 0)
  })

  it('CloudFront has no fpjs cache behavior', async () => {
    lambdaMock
      .on(ListVersionsByFunctionCommand, {
        FunctionName: settings.LambdaFunctionName,
      })
      .resolves(existingLambdaVersions)

    lambdaMock
      .on(GetFunctionCommand, {
        FunctionName: settings.LambdaFunctionName,
      })
      .resolves(functionInfo)

    lambdaMock
      .on(UpdateFunctionCodeCommand, {
        S3Bucket: 'fingerprint-pro-cloudfront-integration-lambda-function',
        S3Key: 'release/lambda_latest.zip',
        FunctionName: 'fingerprint-pro-lambda-function',
        Publish: true,
      })
      .resolves({
        FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function:3',
      })

    cloudFrontMock.on(GetDistributionConfigCommand, { Id: 'ABCDEF123456' }).resolves({
      ETag: 'ABCDEF123456',
      DistributionConfig: {
        CallerReference: 'fccd3c1c-9e1b-4d4e-ae07-d3970f9e7e58',
        Origins: {
          Quantity: 1,
          Items: [
            {
              Id: 'foo.bar',
              DomainName: 'foo.bar',
            },
          ],
        },
        DefaultCacheBehavior: {
          TargetOriginId: 'foo.bar',
          ViewerProtocolPolicy: 'https-only',
        },
        CacheBehaviors: {
          Quantity: 1,
          Items: [
            {
              PathPattern: '*',
              TargetOriginId: 'foo.bar',
              ViewerProtocolPolicy: 'https-only',
              LambdaFunctionAssociations: {
                Quantity: 1,
                Items: [
                  {
                    LambdaFunctionARN: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function',
                    EventType: 'origin-request',
                    IncludeBody: true,
                  },
                ],
              },
            },
          ],
        },
        Enabled: true,
        Comment: '',
      },
    })

    const result = await handleUpdate(lambdaClient, cloudFrontClient, settings)
    expect(result.statusCode).toBe(500)
    const error = JSON.parse(result.body)['error']
    expect(error).toBe('Cache behavior not found')

    expect(lambdaMock).toHaveReceivedCommandTimes(ListVersionsByFunctionCommand, 1)
    expect(lambdaMock).toHaveReceivedCommandTimes(UpdateFunctionCodeCommand, 1)
    expect(cloudFrontMock).toHaveReceivedCommandTimes(GetDistributionConfigCommand, 1)
    expect(cloudFrontMock).toHaveReceivedCommandTimes(UpdateDistributionCommand, 0)
    expect(cloudFrontMock).toHaveReceivedCommandTimes(CreateInvalidationCommand, 0)
  })

  it('CloudFront cache behavior without lambda association', async () => {
    lambdaMock
      .on(ListVersionsByFunctionCommand, {
        FunctionName: settings.LambdaFunctionName,
      })
      .resolves(existingLambdaVersions)

    lambdaMock
      .on(GetFunctionCommand, {
        FunctionName: settings.LambdaFunctionName,
      })
      .resolves(functionInfo)

    lambdaMock
      .on(UpdateFunctionCodeCommand, {
        S3Bucket: 'fingerprint-pro-cloudfront-integration-lambda-function',
        S3Key: 'release/lambda_latest.zip',
        FunctionName: 'fingerprint-pro-lambda-function',
        Publish: true,
      })
      .resolves({
        FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function:3',
      })

    cloudFrontMock.on(GetDistributionConfigCommand, { Id: 'ABCDEF123456' }).resolves({
      ETag: 'ABCDEF123456',
      DistributionConfig: {
        CallerReference: 'fccd3c1c-9e1b-4d4e-ae07-d3970f9e7e58',
        Origins: {
          Quantity: 1,
          Items: [
            {
              Id: 'fpcdn.io',
              DomainName: 'fpcdn.io',
            },
          ],
        },
        DefaultCacheBehavior: {
          TargetOriginId: 'fpcdn.io',
          ViewerProtocolPolicy: 'https-only',
        },
        CacheBehaviors: {
          Quantity: 1,
          Items: [
            {
              PathPattern: 'fpjs/*',
              TargetOriginId: 'fpcdn.io',
              ViewerProtocolPolicy: 'https-only',
            },
          ],
        },
        Enabled: true,
        Comment: '',
      },
    })

    const result = await handleUpdate(lambdaClient, cloudFrontClient, settings)
    expect(result.statusCode).toBe(500)
    const error = JSON.parse(result.body)['error']
    expect(error).toBe('Lambda function association not found')

    expect(lambdaMock).toHaveReceivedCommandTimes(ListVersionsByFunctionCommand, 1)
    expect(lambdaMock).toHaveReceivedCommandTimes(UpdateFunctionCodeCommand, 1)
    expect(cloudFrontMock).toHaveReceivedCommandTimes(GetDistributionConfigCommand, 1)
    expect(cloudFrontMock).toHaveReceivedCommandTimes(UpdateDistributionCommand, 0)
    expect(cloudFrontMock).toHaveReceivedCommandTimes(CreateInvalidationCommand, 0)
  })
})
