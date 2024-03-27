import { mockClient } from 'aws-sdk-client-mock'
import { LambdaClient, GetFunctionCommand } from '@aws-sdk/client-lambda'
import type { DeploymentSettings } from '../../model/DeploymentSettings'
import { handleStatus } from '../../handlers/statusHandler'
import 'aws-sdk-client-mock-jest'
import { CloudFrontClient, GetDistributionCommand } from '@aws-sdk/client-cloudfront'
import { IntegrationStatus } from '../../model/IntegrationStatus'

const lambdaMock = mockClient(LambdaClient)
const cloudFrontMock = mockClient(CloudFrontClient)
const lambdaClient = new LambdaClient({ region: 'us-east-1' })
const cloudFrontClient = new CloudFrontClient({ region: 'us-east-1' })
const options: DeploymentSettings = {
  CFDistributionId: 'ABCDEF123456',
  LambdaFunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function:1',
  LambdaFunctionName: 'fingerprint-pro-lambda-function',
}

describe('Handle mgmt-status', () => {
  beforeEach(() => {
    jest.resetModules()
    lambdaMock.reset()
  })

  it('check correct output', async () => {
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

    cloudFrontMock
      .on(GetDistributionCommand, {
        Id: options.CFDistributionId,
      })
      .resolves({
        Distribution: {
          Id: 'ABCDEF123456',
          ARN: 'arn:aws:cloudfront:ABCDEF123456',
          LastModifiedTime: new Date(),
          InProgressInvalidationBatches: 0,
          DomainName: undefined,
          DistributionConfig: {
            CallerReference: undefined,
            Enabled: true,
            Comment: 'none',
            Origins: {
              Quantity: 1,
              Items: [
                {
                  Id: 'fpcdn.io',
                  DomainName: 'fpcdn.io',
                  OriginPath: '',
                  CustomHeaders: {
                    Quantity: 0,
                    Items: [],
                  },
                  S3OriginConfig: {
                    OriginAccessIdentity: undefined,
                  },
                  CustomOriginConfig: {
                    HTTPPort: undefined,
                    HTTPSPort: 443,
                    OriginProtocolPolicy: undefined,
                    OriginSslProtocols: {
                      Quantity: 1,
                      Items: ['TLSv1.2'],
                    },
                    OriginReadTimeout: 100,
                    OriginKeepaliveTimeout: 100,
                  },
                  ConnectionAttempts: 5,
                  ConnectionTimeout: 100,
                  OriginShield: {
                    Enabled: false,
                    OriginShieldRegion: 'us-east-1',
                  },
                  OriginAccessControlId: 'no-id',
                },
              ],
            },
            DefaultCacheBehavior: {
              TargetOriginId: undefined,
              ViewerProtocolPolicy: undefined,
              AllowedMethods: {
                Quantity: 2,
                Items: ['GET', 'POST'],
              },
              SmoothStreaming: false,
              Compress: true,
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
              FunctionAssociations: {
                Quantity: 0,
                Items: [],
              },
              MinTTL: 0,
              DefaultTTL: 180,
              MaxTTL: 180,
            },
          },
          AliasICPRecordals: [],
          Status: 'Deployed',
        },
        ETag: 'ABCDEF123456',
      })

    const status = await handleStatus(lambdaClient, cloudFrontClient, options)
    expect(status.statusCode).toBe(200)

    const result = JSON.parse(status.body) as IntegrationStatus

    expect(result.lambdaFunction?.functionName).toBe('fingerprint-pro-lambda-function')
    expect(result.cloudFrontDistribution?.id).toBe('ABCDEF123456')

    expect(lambdaMock).toHaveReceivedCommandWith(GetFunctionCommand, {
      FunctionName: options.LambdaFunctionName,
    })
    expect(lambdaMock).toHaveReceivedCommandTimes(GetFunctionCommand, 1)
  }),
    it('error while communicating with AWS', async () => {
      lambdaMock
        .on(GetFunctionCommand, {
          FunctionName: options.LambdaFunctionName,
        })
        .rejects()

      cloudFrontMock
        .on(GetDistributionCommand, {
          Id: options.CFDistributionId,
        })
        .rejects()

      const status = await handleStatus(lambdaClient, cloudFrontClient, options)
      expect(status.statusCode).toBe(500)
    })
})
