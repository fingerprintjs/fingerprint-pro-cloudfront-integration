import { mockClient } from 'aws-sdk-client-mock'
import {
  GetFunctionCommand,
  GetFunctionResponse,
  LambdaClient,
  ListVersionsByFunctionCommand,
  ListVersionsByFunctionResponse,
  ResourceNotFoundException,
  State,
  UpdateFunctionCodeCommand,
} from '@aws-sdk/client-lambda'
import {
  AccessDenied,
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
import { ErrorCode } from '../../exceptions'

const lambdaMock = mockClient(LambdaClient)
const lambdaClient = new LambdaClient({ region: 'us-east-1' })
const cloudFrontMock = mockClient(CloudFrontClient)
const cloudFrontClient = new CloudFrontClient({ region: 'us-east-1' })
const settings: DeploymentSettings = {
  CFDistributionId: 'ABCDEF123456',
  LambdaFunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function',
  LambdaFunctionName: 'fingerprint-pro-lambda-function',
}

const existingLambda: GetFunctionResponse = {
  Configuration: {
    FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function',
    RevisionId: '4a847a75-4dc6-4c7c-971b-459c89be333f',
    State: State.Active,
    CodeSha256: 'M51rf9QNIaPQTR5+dVKv3H1h1pdogffdb5epfsaoBoN=',
  },
}

const existingLambdaAfterUpdate: GetFunctionResponse = {
  Configuration: {
    FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function',
    LastModified: '2024-03-13T19:48:15.722+0000',
    LastUpdateStatus: 'Successful',
    Runtime: 'nodejs20.x',
    Version: '$LATEST',
    Handler: 'fingerprintjs-pro-cloudfront-lambda-function.handler',
    RevisionId: 'b4b060ce-0554-49cb-9639-69c2b5eeef11',
    State: State.Active,
    CodeSha256: 'W28rD7QNIwBRTR4+dVKv3H1h1p4Hqfw2b5epWPuoNqA=',
  },
}

const lambdaVersionsAfterUpdate: ListVersionsByFunctionResponse = {
  Versions: [
    {
      FunctionName: 'fingerprint-pro-lambda-function',
      FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function',
      Version: '1',
      LastModified: '2024-01-12T09:47:00.123+0200',
      State: State.Active,
      RevisionId: '4a847a75-4dc6-4c7c-971b-459c89be333f',
      CodeSha256: 'M51rf9QNIaPQTR5+dVKv3H1h1pdogffdb5epfsaoBoN=',
    },
    {
      FunctionName: 'fingerprint-pro-lambda-function',
      FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function',
      Version: '2',
      LastModified: '2024-03-13T10:47:00.123+0200',
      State: State.Active,
      RevisionId: 'b4b060ce-0554-49cb-9639-69c2b5eeef11',
      CodeSha256: 'W28rD7QNIwBRTR4+dVKv3H1h1p4Hqfw2b5epWPuoNqA=',
    },
  ],
}

const lambdaVersionsAfterUpdateWithSameCode: ListVersionsByFunctionResponse = {
  Versions: [
    {
      FunctionName: 'fingerprint-pro-lambda-function',
      FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function',
      Version: '1',
      LastModified: '2024-01-12T09:47:00.123+0200',
      State: State.Active,
      RevisionId: '4a847a75-4dc6-4c7c-971b-459c89be333f',
      CodeSha256: 'M51rf9QNIaPQTR5+dVKv3H1h1pdogffdb5epfsaoBoN=',
    },
    {
      FunctionName: 'fingerprint-pro-lambda-function',
      FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function',
      Version: '2',
      LastModified: '2024-03-13T10:47:00.123+0200',
      State: State.Active,
      RevisionId: 'b4b060ce-0554-49cb-9639-69c2b5eeef11',
      CodeSha256: 'M51rf9QNIaPQTR5+dVKv3H1h1pdogffdb5epfsaoBoN=',
    },
  ],
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
                LambdaFunctionARN: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function:1',
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
      .on(GetFunctionCommand, {
        FunctionName: settings.LambdaFunctionName,
      })
      .resolvesOnce(existingLambda)
      .resolvesOnce(existingLambdaAfterUpdate)

    lambdaMock
      .on(ListVersionsByFunctionCommand, {
        FunctionName: settings.LambdaFunctionName,
      })
      .resolvesOnce(lambdaVersionsAfterUpdate)

    lambdaMock
      .on(UpdateFunctionCodeCommand, {
        S3Bucket: 'fingerprint-pro-cloudfront-integration',
        S3Key: 'v2/lambda_latest.zip',
        FunctionName: 'fingerprint-pro-lambda-function',
        RevisionId: '4a847a75-4dc6-4c7c-971b-459c89be333f',
        Publish: true,
      })
      .resolves({
        FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function:3',
        RevisionId: 'b4b060ce-0554-49cb-9639-69c2b5eeef11',
      })

    cloudFrontMock.on(GetDistributionConfigCommand, { Id: 'ABCDEF123456' }).resolves(cloudFrontConfigBeforeUpdate)

    cloudFrontMock.on(CreateInvalidationCommand, createInvalidation).resolves({})

    cloudFrontMock.on(UpdateDistributionCommand, updatedCloudFrontConfig).resolves({})

    const result = await handleUpdate(lambdaClient, cloudFrontClient, settings)
    expect(result.statusCode).toBe(200)

    expect(lambdaMock).toHaveReceivedCommandTimes(GetFunctionCommand, 1)
    expect(lambdaMock).toHaveReceivedCommandTimes(UpdateFunctionCodeCommand, 1)
    expect(cloudFrontMock).toHaveReceivedCommandTimes(GetDistributionConfigCommand, 1)
    expect(cloudFrontMock).toHaveReceivedCommandTimes(UpdateDistributionCommand, 1)
    expect(cloudFrontMock).toHaveReceivedCommandTimes(CreateInvalidationCommand, 1)
  })

  it('No lambda version', async () => {
    lambdaMock
      .on(GetFunctionCommand, {
        FunctionName: settings.LambdaFunctionName,
      })
      .resolves({})

    await expect(handleUpdate(lambdaClient, cloudFrontClient, settings)).rejects.toThrow(
      expect.objectContaining({
        code: ErrorCode.LambdaFunctionNotFound,
      })
    )

    expect(lambdaMock).toHaveReceivedCommandTimes(GetFunctionCommand, 1)
    expect(lambdaMock).toHaveReceivedCommandTimes(UpdateFunctionCodeCommand, 0)
    expect(cloudFrontMock).toHaveReceivedCommandTimes(GetDistributionConfigCommand, 0)
    expect(cloudFrontMock).toHaveReceivedCommandTimes(UpdateDistributionCommand, 0)
    expect(cloudFrontMock).toHaveReceivedCommandTimes(CreateInvalidationCommand, 0)
  })

  it('update with the same code', async () => {
    lambdaMock
      .on(GetFunctionCommand, {
        FunctionName: settings.LambdaFunctionName,
      })
      .resolvesOnce(existingLambda)

    lambdaMock
      .on(ListVersionsByFunctionCommand, {
        FunctionName: settings.LambdaFunctionName,
      })
      .resolvesOnce(lambdaVersionsAfterUpdateWithSameCode)

    lambdaMock
      .on(UpdateFunctionCodeCommand, {
        S3Bucket: 'fingerprint-pro-cloudfront-integration',
        S3Key: 'v2/lambda_latest.zip',
        FunctionName: 'fingerprint-pro-lambda-function',
        RevisionId: '4a847a75-4dc6-4c7c-971b-459c89be333f',
        Publish: true,
      })
      .resolves({
        FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function:3',
        RevisionId: 'b4b060ce-0554-49cb-9639-69c2b5eeef11',
      })

    const result = await handleUpdate(lambdaClient, cloudFrontClient, settings)
    expect(result.statusCode).toBe(200)

    expect(lambdaMock).toHaveReceivedCommandTimes(GetFunctionCommand, 1)
    expect(lambdaMock).toHaveReceivedCommandTimes(UpdateFunctionCodeCommand, 1)
  })

  it('CloudFront has no fpjs cache behavior', async () => {
    lambdaMock
      .on(GetFunctionCommand, {
        FunctionName: settings.LambdaFunctionName,
      })
      .resolvesOnce(existingLambda)
      .resolvesOnce(existingLambdaAfterUpdate)

    lambdaMock
      .on(ListVersionsByFunctionCommand, {
        FunctionName: settings.LambdaFunctionName,
      })
      .resolvesOnce(lambdaVersionsAfterUpdate)

    lambdaMock
      .on(UpdateFunctionCodeCommand, {
        S3Bucket: 'fingerprint-pro-cloudfront-integration',
        S3Key: 'v2/lambda_latest.zip',
        FunctionName: 'fingerprint-pro-lambda-function',
        RevisionId: '4a847a75-4dc6-4c7c-971b-459c89be333f',
        Publish: true,
      })
      .resolves({
        FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function:3',
        RevisionId: 'b4b060ce-0554-49cb-9639-69c2b5eeef11',
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

    await expect(handleUpdate(lambdaClient, cloudFrontClient, settings)).rejects.toThrow(
      expect.objectContaining({
        code: ErrorCode.CacheBehaviorNotFound,
      })
    )

    expect(lambdaMock).toHaveReceivedCommandTimes(GetFunctionCommand, 1)
    expect(lambdaMock).toHaveReceivedCommandTimes(UpdateFunctionCodeCommand, 1)
    expect(cloudFrontMock).toHaveReceivedCommandTimes(GetDistributionConfigCommand, 1)
    expect(cloudFrontMock).toHaveReceivedCommandTimes(UpdateDistributionCommand, 0)
    expect(cloudFrontMock).toHaveReceivedCommandTimes(CreateInvalidationCommand, 0)
  })

  it('CloudFront cache behavior without lambda association', async () => {
    lambdaMock
      .on(GetFunctionCommand, {
        FunctionName: settings.LambdaFunctionName,
      })
      .resolvesOnce(existingLambda)
      .resolvesOnce(existingLambdaAfterUpdate)

    lambdaMock
      .on(ListVersionsByFunctionCommand, {
        FunctionName: settings.LambdaFunctionName,
      })
      .resolvesOnce(lambdaVersionsAfterUpdate)

    lambdaMock
      .on(UpdateFunctionCodeCommand, {
        S3Bucket: 'fingerprint-pro-cloudfront-integration',
        S3Key: 'v2/lambda_latest.zip',
        FunctionName: 'fingerprint-pro-lambda-function',
        RevisionId: '4a847a75-4dc6-4c7c-971b-459c89be333f',
        Publish: true,
      })
      .resolves({
        FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function:3',
        RevisionId: 'b4b060ce-0554-49cb-9639-69c2b5eeef11',
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

    await expect(handleUpdate(lambdaClient, cloudFrontClient, settings)).rejects.toThrow(
      expect.objectContaining({
        code: ErrorCode.LambdaFunctionAssociationNotFound,
      })
    )

    expect(lambdaMock).toHaveReceivedCommandTimes(GetFunctionCommand, 1)
    expect(lambdaMock).toHaveReceivedCommandTimes(UpdateFunctionCodeCommand, 1)
    expect(cloudFrontMock).toHaveReceivedCommandTimes(GetDistributionConfigCommand, 1)
    expect(cloudFrontMock).toHaveReceivedCommandTimes(UpdateDistributionCommand, 0)
    expect(cloudFrontMock).toHaveReceivedCommandTimes(CreateInvalidationCommand, 0)
  })

  it('AWS Resource not found', async () => {
    lambdaMock
      .on(GetFunctionCommand, {
        FunctionName: settings.LambdaFunctionName,
      })
      .rejects(new ResourceNotFoundException({ $metadata: { httpStatusCode: 404 }, message: 'Resource not found' }))

    await expect(handleUpdate(lambdaClient, cloudFrontClient, settings)).rejects.toThrow(
      expect.objectContaining({
        name: ResourceNotFoundException.name,
      })
    )
  })

  it('AWS AccessDenied', async () => {
    lambdaMock
      .on(GetFunctionCommand, {
        FunctionName: settings.LambdaFunctionName,
      })
      .rejects(new AccessDenied({ $metadata: { httpStatusCode: 403 }, message: 'AccessDenied' }))

    await expect(handleUpdate(lambdaClient, cloudFrontClient, settings)).rejects.toThrow(
      expect.objectContaining({
        name: AccessDenied.name,
      })
    )
  })

  it('Cloudfront Distribution not found', async () => {
    lambdaMock
      .on(GetFunctionCommand, {
        FunctionName: settings.LambdaFunctionName,
      })
      .resolvesOnce(existingLambda)
      .resolvesOnce(existingLambdaAfterUpdate)

    lambdaMock
      .on(ListVersionsByFunctionCommand, {
        FunctionName: settings.LambdaFunctionName,
      })
      .resolvesOnce(lambdaVersionsAfterUpdate)

    lambdaMock
      .on(UpdateFunctionCodeCommand, {
        S3Bucket: 'fingerprint-pro-cloudfront-integration',
        S3Key: 'v2/lambda_latest.zip',
        FunctionName: 'fingerprint-pro-lambda-function',
        RevisionId: '4a847a75-4dc6-4c7c-971b-459c89be333f',
        Publish: true,
      })
      .resolves({
        FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function:3',
        RevisionId: 'b4b060ce-0554-49cb-9639-69c2b5eeef11',
      })

    cloudFrontMock.on(GetDistributionConfigCommand, { Id: 'ABCDEF123456' }).resolves({})

    await expect(handleUpdate(lambdaClient, cloudFrontClient, settings)).rejects.toThrow(
      expect.objectContaining({
        code: ErrorCode.CloudFrontDistributionNotFound,
      })
    )
  })

  it('Cache Behavior Pattern not defined', async () => {
    lambdaMock
      .on(GetFunctionCommand, {
        FunctionName: settings.LambdaFunctionName,
      })
      .resolvesOnce(existingLambda)
      .resolvesOnce(existingLambdaAfterUpdate)

    lambdaMock
      .on(ListVersionsByFunctionCommand, {
        FunctionName: settings.LambdaFunctionName,
      })
      .resolvesOnce(lambdaVersionsAfterUpdate)

    lambdaMock
      .on(UpdateFunctionCodeCommand, {
        S3Bucket: 'fingerprint-pro-cloudfront-integration',
        S3Key: 'v2/lambda_latest.zip',
        FunctionName: 'fingerprint-pro-lambda-function',
        RevisionId: '4a847a75-4dc6-4c7c-971b-459c89be333f',
        Publish: true,
      })
      .resolves({
        FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function:3',
        RevisionId: 'b4b060ce-0554-49cb-9639-69c2b5eeef11',
      })

    cloudFrontMock.on(GetDistributionConfigCommand, { Id: 'ABCDEF123456' }).resolves({
      ...cloudFrontConfigBeforeUpdate,
      DistributionConfig: {
        ...cloudFrontConfigBeforeUpdate.DistributionConfig,
        CallerReference: undefined,
        Origins: {
          Quantity: 1,
          Items: [
            {
              Id: 'fpcdn.io',
              DomainName: 'fpcdn.io',
            },
          ],
        },
        DefaultCacheBehavior: undefined,
        Comment: undefined,
        Enabled: undefined,
        CacheBehaviors: {
          Quantity: 1,
          Items: [
            {
              PathPattern: undefined,
              TargetOriginId: 'fpcdn.io',
              ViewerProtocolPolicy: 'https-only',
              LambdaFunctionAssociations: {
                Quantity: 1,
                Items: [
                  {
                    LambdaFunctionARN: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function:1',
                    EventType: 'origin-request',
                    IncludeBody: true,
                  },
                ],
              },
            },
          ],
        },
      },
    })

    await expect(handleUpdate(lambdaClient, cloudFrontClient, settings)).rejects.toThrow(
      expect.objectContaining({
        code: ErrorCode.CacheBehaviorPatternNotDefined,
      })
    )
  })

  it('Lambda Function ARN not found', async () => {
    lambdaMock
      .on(GetFunctionCommand, {
        FunctionName: settings.LambdaFunctionName,
      })
      .resolvesOnce(existingLambda)

    lambdaMock
      .on(UpdateFunctionCodeCommand, {
        S3Bucket: 'fingerprint-pro-cloudfront-integration',
        S3Key: 'v2/lambda_latest.zip',
        FunctionName: 'fingerprint-pro-lambda-function',
        RevisionId: '4a847a75-4dc6-4c7c-971b-459c89be333f',
        Publish: true,
      })
      .resolves({})

    await expect(handleUpdate(lambdaClient, cloudFrontClient, settings)).rejects.toThrow(
      expect.objectContaining({
        code: ErrorCode.LambdaFunctionARNNotFound,
      })
    )
  })
})
