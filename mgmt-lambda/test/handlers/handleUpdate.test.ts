import { mockClient } from 'aws-sdk-client-mock'
import {
  LambdaClient,
  GetFunctionCommand,
  ListVersionsByFunctionCommand,
  UpdateFunctionCodeCommand,
} from '@aws-sdk/client-lambda'
import {
  CloudFrontClient,
  CreateInvalidationCommand,
  GetDistributionConfigCommand,
  UpdateDistributionCommand,
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
  LambdaFunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function:1',
  LambdaFunctionName: 'fingerprint-pro-lambda-function',
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
      .resolves({
        Versions: [
          {
            FunctionName: 'fingerprint-pro-lambda-function',
            FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function:2',
            Runtime: 'nodejs16.x',
            Role: 'arn:aws:iam::1234567890:role/fingerprint-pro-lambda-role-12345',
            Handler: 'fingerprintjs-pro-cloudfront-lambda-function.handler',
            CodeSize: 216954,
            Description: 'Lambda@Edge function definition',
            Timeout: 3,
            MemorySize: 128,
            LastModified: '2023-12-08T09:59:25.640+0000',
            CodeSha256: 'ClbW2NR9v7AL4TiXaInYX/AdkXEXhlLtdqlUq7FuA28=',
            Version: '2',
            RevisionId: 'a9771b2b-d5b6-4883-81d7-8b41c7e3657b',
            PackageType: 'Zip',
            Architectures: ['x86_64'],
            EphemeralStorage: {
              Size: 512,
            },
          },
          {
            FunctionName: 'fingerprint-pro-lambda-function',
            FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function:1',
            Runtime: 'nodejs16.x',
            Role: 'arn:aws:iam::1234567890:role/fingerprint-pro-lambda-role-12345',
            Handler: 'fingerprintjs-pro-cloudfront-lambda-function.handler',
            CodeSize: 216954,
            Description: "Lambda@Edge function's version reference (v1)",
            Timeout: 3,
            MemorySize: 128,
            LastModified: '2023-12-15T10:15:39.241+0000',
            CodeSha256: 'ClbW2NR9v7AL4TiXaInYX/AdkXEXhlLtdqlUq7FuA28=',
            Version: '1',
            RevisionId: 'b0790bb6-3858-488d-af1b-ce789bcce0a5',
            PackageType: 'Zip',
            Architectures: ['x86_64'],
            EphemeralStorage: {
              Size: 512,
            },
          },
        ],
      })

    lambdaMock
      .on(GetFunctionCommand, {
        FunctionName: settings.LambdaFunctionName,
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

    cloudFrontMock
      .on(GetDistributionConfigCommand, {
        Id: 'ABCDEF123456',
      })
      .resolves({
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
      })

    cloudFrontMock
      .on(CreateInvalidationCommand, {
        DistributionId: 'ABCDEF123456',
        InvalidationBatch: {
          Paths: {
            Quantity: 1,
            Items: ['fpjs/*'],
          },
          CallerReference: 'fingerprint-pro-management-lambda-function',
        },
      })
      .resolves({})

    cloudFrontMock.on(UpdateDistributionCommand, {
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
    })

    const result = await handleUpdate(lambdaClient, cloudFrontClient, settings)
    expect(result.statusCode).toBe(200)

    expect(lambdaMock).toHaveReceivedCommandTimes(ListVersionsByFunctionCommand, 1)
    expect(lambdaMock).toHaveReceivedCommandTimes(UpdateFunctionCodeCommand, 1)
    expect(cloudFrontMock).toHaveReceivedCommandTimes(GetDistributionConfigCommand, 1)
    expect(cloudFrontMock).toHaveReceivedCommandTimes(UpdateDistributionCommand, 1)
    expect(cloudFrontMock).toHaveReceivedCommandTimes(CreateInvalidationCommand, 1)
  })
})
