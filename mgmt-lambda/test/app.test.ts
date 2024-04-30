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
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import { APIGatewayProxyEventV2WithRequestContext, APIGatewayEventRequestContextV2 } from 'aws-lambda'
import { handler } from '../app'
import 'aws-sdk-client-mock-jest'
import {
  AccessDenied,
  CloudFrontClient,
  CreateInvalidationCommand,
  CreateInvalidationCommandInput,
  GetDistributionCommand,
  GetDistributionConfigCommand,
  GetDistributionConfigResult,
  GetDistributionResult,
  UpdateDistributionCommand,
  UpdateDistributionCommandInput,
} from '@aws-sdk/client-cloudfront'
import { ErrorCode } from '../exceptions'

const lambdaMock = mockClient(LambdaClient)
const cloudFrontMock = mockClient(CloudFrontClient)
const secretMock = mockClient(SecretsManagerClient)
const secretName = 'fingerprint-mgmt-lambda-auth-settings'

const correctToken = 'qazwsx123edc456'
const wrongToken = 'wrong-token'

const OLD_ENV = process.env

function setSecretEnv() {
  process.env.SettingsSecretName = secretName
}

function setConfigEnv() {
  process.env.CFDistributionId = 'ABCDEF123456'
  process.env.LambdaFunctionArn = 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function'
  process.env.LambdaFunctionName = 'fingerprint-pro-lambda-function'
}

function mockSecret(tokenValue: string) {
  secretMock
    .on(GetSecretValueCommand, {
      SecretId: secretName,
    })
    .resolves({
      SecretString: `{"token": "${tokenValue}"}`,
    })
}

const existingLambda: GetFunctionResponse = {
  Configuration: {
    FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function',
    LastModified: '2024-03-13T19:48:15.722+0000',
    LastUpdateStatus: 'Successful',
    Runtime: 'nodejs20.x',
    Version: '$LATEST',
    Handler: 'fingerprintjs-pro-cloudfront-lambda-function.handler',
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

const existingNonActiveLambdaAfterUpdate: GetFunctionResponse = {
  Configuration: {
    FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function',
    LastModified: '2024-03-13T19:48:15.722+0000',
    LastUpdateStatus: 'Successful',
    Runtime: 'nodejs20.x',
    Version: '$LATEST',
    Handler: 'fingerprintjs-pro-cloudfront-lambda-function.handler',
    RevisionId: 'b4b060ce-0554-49cb-9639-69c2b5eeef11',
    State: State.Pending,
    CodeSha256: 'W28rD7QNIwBRTR4+dVKv3H1h1p4Hqfw2b5epWPuoNqA=',
  },
}

const lambdaVersionsBeforeUpdate: ListVersionsByFunctionResponse = {
  Versions: [
    {
      FunctionName: 'fingerprint-pro-lambda-function',
      FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function',
      Version: '1',
      LastModified: '2024-01-12T09:47:00.123+0200',
      State: State.Active,
      RevisionId: '4a847a75-4dc6-4c7c-971b-459c89be333f',
    },
  ],
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
    },
    {
      FunctionName: 'fingerprint-pro-lambda-function',
      FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function',
      Version: '2',
      LastModified: '2024-03-13T10:47:00.123+0200',
      State: State.Active,
      RevisionId: 'b4b060ce-0554-49cb-9639-69c2b5eeef11',
    },
  ],
}

const functionInfo: GetFunctionResponse = {
  Configuration: {
    FunctionName: 'fingerprint-pro-lambda-function',
    FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function',
    Version: '$LATEST',
    RevisionId: '4a847a75-4dc6-4c7c-971b-459c89be333f',
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

const getCloudFrontInfo: GetDistributionResult = {
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

describe('Basic test', () => {
  beforeEach(() => {
    jest.resetModules()
    lambdaMock.reset()
    secretMock.reset()
    cloudFrontMock.reset()
    process.env = { ...OLD_ENV }
  })

  test('basic auth test', async () => {
    setSecretEnv()
    setConfigEnv()
    mockSecret(correctToken)

    lambdaMock
      .on(GetFunctionCommand, {
        FunctionName: process.env.LambdaFunctionName,
      })
      .resolves(existingLambda)

    cloudFrontMock
      .on(GetDistributionCommand, {
        Id: process.env.CFDistributionId,
      })
      .resolves(getCloudFrontInfo)

    const event = generateStatusRequest(correctToken)

    const result = await handler(event)
    expect(result.statusCode).toBe(200)
  })

  test('wrong auth token', async () => {
    setSecretEnv()
    setConfigEnv()
    mockSecret(correctToken)

    const event = generateStatusRequest(wrongToken)

    const result = await handler(event)
    expect(result.statusCode).toBe(401)
  })

  test('no update configuration env vars', async () => {
    setSecretEnv()
    mockSecret(correctToken)

    const event = generateStatusRequest(correctToken)

    const result = await handler(event)
    expect(result.statusCode).toBe(500)
  })

  test('status endpoint with POST', async () => {
    setSecretEnv()
    setConfigEnv()
    mockSecret(correctToken)

    const event = generateStatusRequest(correctToken, 'POST')

    const result = await handler(event)
    expect(result.statusCode).toBe(404)
  })

  test('wrong endpoint', async () => {
    setSecretEnv()
    setConfigEnv()
    mockSecret(correctToken)

    const event = generateStatusRequest(correctToken, 'PUT', 'fsdkjlkj')

    const result = await handler(event)
    expect(result.statusCode).toBe(404)
  })

  test('endpoint with leading slashes', async () => {
    setSecretEnv()
    setConfigEnv()
    mockSecret(correctToken)

    const event = generateStatusRequest(correctToken, 'GET', '///status')

    const result = await handler(event)
    expect(result.statusCode).toBe(200)
  })

  test('endpoint with trailing slashes', async () => {
    setSecretEnv()
    setConfigEnv()
    mockSecret(correctToken)

    const event = generateStatusRequest(correctToken, 'GET', 'status/')

    const result = await handler(event)
    expect(result.statusCode).toBe(200)
  })

  test('endpoint with leading and trailing slashes', async () => {
    setSecretEnv()
    setConfigEnv()
    mockSecret(correctToken)

    const event = generateStatusRequest(correctToken, 'GET', '//status/')

    const result = await handler(event)
    expect(result.statusCode).toBe(200)
  })

  test('status endpoint with additional path', async () => {
    setSecretEnv()
    setConfigEnv()
    mockSecret(correctToken)

    const event = generateStatusRequest(correctToken, 'GET', '//status/something')

    const result = await handler(event)
    expect(result.statusCode).toBe(404)
  })

  test('wrong endpoint', async () => {
    setSecretEnv()
    setConfigEnv()
    mockSecret(correctToken)

    const event = generateStatusRequest(correctToken, 'GET', '//statuss')

    const result = await handler(event)
    expect(result.statusCode).toBe(404)
  })
})

describe('Check environment', () => {
  beforeEach(() => {
    jest.resetModules()
    lambdaMock.reset()
    secretMock.reset()
    cloudFrontMock.reset()
    process.env = { ...OLD_ENV }
  })

  test('no secret env var', async () => {
    const event = generateStatusRequest(correctToken)

    const result = await handler(event)
    expect(result.statusCode).toBe(500)
  })

  test('no deployment config', async () => {
    setSecretEnv()
    mockSecret(correctToken)

    const event = generateStatusRequest(correctToken)

    const result = await handler(event)
    expect(result.statusCode).toBe(500)
    const response = JSON.parse(result.body)
    expect(response.status).toBe(
      'Wrong function configuration. Check environment variables for Lambda@Edge function and CloudFront Distribution id'
    )
    expect(response.error).toBe(
      'environment variables not found: CFDistributionId, LambdaFunctionName, LambdaFunctionArn'
    )
  })

  test('CFDistributionConfig is not defined', async () => {
    setSecretEnv()
    process.env.LambdaFunctionArn = 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function'
    process.env.LambdaFunctionName = 'fingerprint-pro-lambda-function'
    mockSecret(correctToken)

    const event = generateStatusRequest(correctToken)

    const result = await handler(event)
    expect(result.statusCode).toBe(500)
    const response = JSON.parse(result.body)
    expect(response.status).toBe(
      'Wrong function configuration. Check environment variables for Lambda@Edge function and CloudFront Distribution id'
    )
    expect(response.error).toBe('environment variables not found: CFDistributionId')
  })

  test('CFDistributionConfig is defined, but empty', async () => {
    setSecretEnv()
    process.env.CFDistributionId = ''
    process.env.LambdaFunctionArn = 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function'
    process.env.LambdaFunctionName = 'fingerprint-pro-lambda-function'
    mockSecret(correctToken)

    const event = generateStatusRequest(correctToken)

    const result = await handler(event)
    expect(result.statusCode).toBe(500)
    const response = JSON.parse(result.body)
    expect(response.status).toBe(
      'Wrong function configuration. Check environment variables for Lambda@Edge function and CloudFront Distribution id'
    )
    expect(response.error).toBe('environment variables not found: CFDistributionId')
  })
})

describe('Update endpoint', () => {
  beforeEach(() => {
    jest.resetModules()
    lambdaMock.reset()
    secretMock.reset()
    cloudFrontMock.reset()
    process.env = { ...OLD_ENV }
  })

  test('handle update', async () => {
    setSecretEnv()
    process.env.CFDistributionId = 'ABCDEF123456'
    process.env.LambdaFunctionArn = 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function'
    process.env.LambdaFunctionName = 'fingerprint-pro-lambda-function'
    mockSecret(correctToken)
    lambdaMock
      .on(GetFunctionCommand, {
        FunctionName: process.env.LambdaFunctionName,
      })
      .resolvesOnce(existingLambda)
      .resolvesOnce(existingLambdaAfterUpdate)

    lambdaMock
      .on(UpdateFunctionCodeCommand, {
        S3Bucket: 'fingerprint-pro-cloudfront-integration',
        S3Key: 'v2/lambda_latest.zip',
        FunctionName: 'fingerprint-pro-lambda-function',
        Publish: true,
      })
      .resolves({
        FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function:3',
        RevisionId: 'b4b060ce-0554-49cb-9639-69c2b5eeef11',
      })

    lambdaMock
      .on(ListVersionsByFunctionCommand, {
        FunctionName: process.env.LambdaFunctionName,
      })
      .resolvesOnce(lambdaVersionsAfterUpdate)

    cloudFrontMock.on(GetDistributionConfigCommand, { Id: 'ABCDEF123456' }).resolves(cloudFrontConfigBeforeUpdate)

    cloudFrontMock.on(CreateInvalidationCommand, createInvalidation).resolves({})

    cloudFrontMock.on(UpdateDistributionCommand, updatedCloudFrontConfig).resolves({})

    const event = generateUpdateRequest(correctToken)

    const result = await handler(event)
    expect(result.statusCode).toBe(200)
  })

  test('expect errorCode to be FunctionARNNotFound', async () => {
    setSecretEnv()
    process.env.CFDistributionId = 'ABCDEF123456'
    process.env.LambdaFunctionArn = 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function'
    process.env.LambdaFunctionName = 'fingerprint-pro-lambda-function'
    mockSecret(correctToken)
    lambdaMock
      .on(GetFunctionCommand, {
        FunctionName: process.env.LambdaFunctionName,
      })
      .resolves(existingLambda)

    lambdaMock
      .on(GetFunctionCommand, {
        FunctionName: process.env.LambdaFunctionName,
      })
      .resolves(functionInfo)

    lambdaMock
      .on(UpdateFunctionCodeCommand, {
        S3Bucket: 'fingerprint-pro-cloudfront-integration',
        S3Key: 'v2/lambda_latest.zip',
        FunctionName: 'incorrect',
        Publish: true,
      })
      .resolves({
        FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function:3',
      })

    lambdaMock
      .on(ListVersionsByFunctionCommand, {
        FunctionName: process.env.LambdaFunctionName,
      })
      .resolvesOnce(lambdaVersionsAfterUpdate)

    cloudFrontMock.on(GetDistributionConfigCommand, { Id: 'ABCDEF123456' }).resolves(cloudFrontConfigBeforeUpdate)

    cloudFrontMock.on(CreateInvalidationCommand, createInvalidation).resolves({})

    cloudFrontMock.on(UpdateDistributionCommand, updatedCloudFrontConfig).resolves({})

    const event = generateUpdateRequest(correctToken)

    const result = await handler(event)
    console.info({ result })
    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body).errorCode).toBe(ErrorCode.LambdaFunctionARNNotFound)
  })

  test('expect errorCode to be AWSResourceNotFound', async () => {
    setSecretEnv()
    process.env.CFDistributionId = 'ABCDEF123456'
    process.env.LambdaFunctionArn = 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function'
    process.env.LambdaFunctionName = 'fingerprint-pro-lambda-function'
    mockSecret(correctToken)
    lambdaMock
      .on(GetFunctionCommand, {
        FunctionName: process.env.LambdaFunctionName,
      })
      .rejects(new ResourceNotFoundException({ $metadata: { httpStatusCode: 404 }, message: 'Resource not found' }))

    const event = generateUpdateRequest(correctToken)

    const result = await handler(event)
    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body).errorCode).toBe(ErrorCode.AWSResourceNotFound)
  })

  test('expect errorCode to be AWSAccessDenied', async () => {
    setSecretEnv()
    process.env.CFDistributionId = 'ABCDEF123456'
    process.env.LambdaFunctionName = 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function'
    process.env.LambdaFunctionArn = 'fingerprint-pro-lambda-function'
    mockSecret(correctToken)
    lambdaMock
      .on(GetFunctionCommand, {
        FunctionName: process.env.LambdaFunctionName,
      })
      .rejects(new AccessDenied({ $metadata: { httpStatusCode: 403 }, message: 'AccessDenied' }))

    const event = generateUpdateRequest(correctToken)

    const result = await handler(event)
    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body).errorCode).toBe(ErrorCode.AWSAccessDenied)
  })

  test('expect errorCode to be Cloudfront Distribution not found', async () => {
    setSecretEnv()
    process.env.CFDistributionId = 'ABCDEF123456'
    process.env.LambdaFunctionArn = 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function'
    process.env.LambdaFunctionName = 'fingerprint-pro-lambda-function'
    mockSecret(correctToken)
    lambdaMock
      .on(GetFunctionCommand, {
        FunctionName: process.env.LambdaFunctionName,
      })
      .resolvesOnce(existingLambda)
      .resolvesOnce(existingLambdaAfterUpdate)

    lambdaMock
      .on(ListVersionsByFunctionCommand, {
        FunctionName: process.env.LambdaFunctionName,
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

    cloudFrontMock.on(CreateInvalidationCommand, createInvalidation).resolves({})

    cloudFrontMock.on(UpdateDistributionCommand, updatedCloudFrontConfig).resolves({})

    const event = generateUpdateRequest(correctToken)

    const result = await handler(event)
    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body).errorCode).toBe(ErrorCode.CloudFrontDistributionNotFound)
  })

  test('expect errorCode to be Cache Behavior Pattern not defined', async () => {
    setSecretEnv()
    process.env.CFDistributionId = 'ABCDEF123456'
    process.env.LambdaFunctionArn = 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function'
    process.env.LambdaFunctionName = 'fingerprint-pro-lambda-function'
    mockSecret(correctToken)
    lambdaMock
      .on(GetFunctionCommand, {
        FunctionName: process.env.LambdaFunctionName,
      })
      .resolvesOnce(existingLambda)
      .resolvesOnce(existingLambdaAfterUpdate)

    lambdaMock
      .on(UpdateFunctionCodeCommand, {
        S3Bucket: 'fingerprint-pro-cloudfront-integration',
        S3Key: 'v2/lambda_latest.zip',
        FunctionName: 'fingerprint-pro-lambda-function',
        RevisionId: '4a847a75-4dc6-4c7c-971b-459c89be333f',
        Publish: true,
      })
      .resolvesOnce({
        FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function:3',
        RevisionId: 'b4b060ce-0554-49cb-9639-69c2b5eeef11',
      })

    lambdaMock.on(ListVersionsByFunctionCommand).resolvesOnce(lambdaVersionsAfterUpdate)

    cloudFrontMock.on(GetDistributionConfigCommand, { Id: 'ABCDEF123456' }).resolves({
      ...cloudFrontConfigBeforeUpdate,
      DistributionConfig: {
        ...cloudFrontConfigBeforeUpdate.DistributionConfig,
        CallerReference: undefined,
        Origins: undefined,
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

    const event = generateUpdateRequest(correctToken)

    const result = await handler(event)
    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body).errorCode).toBe(ErrorCode.CacheBehaviorPatternNotDefined)
  })

  test('expect errorCode to be Lambda Function ARN not found', async () => {
    setSecretEnv()
    process.env.CFDistributionId = 'ABCDEF123456'
    process.env.LambdaFunctionArn = 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function'
    process.env.LambdaFunctionName = 'fingerprint-pro-lambda-function'
    mockSecret(correctToken)
    lambdaMock
      .on(GetFunctionCommand, {
        FunctionName: process.env.LambdaFunctionName,
      })
      .resolvesOnce(existingLambda)
      .resolvesOnce(existingLambdaAfterUpdate)

    lambdaMock
      .on(UpdateFunctionCodeCommand, {
        S3Bucket: 'fingerprint-pro-cloudfront-integration',
        S3Key: 'v2/lambda_latest.zip',
        FunctionName: 'fingerprint-pro-lambda-function',
        RevisionId: '4a847a75-4dc6-4c7c-971b-459c89be333f',
        Publish: true,
      })
      .resolves({
        RevisionId: 'b4b060ce-0554-49cb-9639-69c2b5eeef11',
      })

    const event = generateUpdateRequest(correctToken)

    const result = await handler(event)
    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body).errorCode).toBe(ErrorCode.LambdaFunctionARNNotFound)
  })

  test('expect errorCode to be Lambda Function Revision ID not found', async () => {
    setSecretEnv()
    process.env.CFDistributionId = 'ABCDEF123456'
    process.env.LambdaFunctionArn = 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function'
    process.env.LambdaFunctionName = 'fingerprint-pro-lambda-function'
    mockSecret(correctToken)
    lambdaMock
      .on(GetFunctionCommand, {
        FunctionName: process.env.LambdaFunctionName,
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
      .resolves({
        FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function:3',
      })

    const event = generateUpdateRequest(correctToken)

    const result = await handler(event)
    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body).errorCode).toBe(ErrorCode.LambdaFunctionUpdateRevisionNotCreated)
  })

  test('expect errorCode to be latest version not in active state', async () => {
    setSecretEnv()
    process.env.CFDistributionId = 'ABCDEF123456'
    process.env.LambdaFunctionName = 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function'
    process.env.LambdaFunctionArn = 'fingerprint-pro-lambda-function'
    mockSecret(correctToken)
    lambdaMock
      .on(GetFunctionCommand, {
        FunctionName: process.env.LambdaFunctionName,
      })
      .resolvesOnce(existingLambda)
      .resolvesOnce(existingNonActiveLambdaAfterUpdate)

    lambdaMock
      .on(UpdateFunctionCodeCommand, {
        S3Bucket: 'fingerprint-pro-cloudfront-integration',
        S3Key: 'v2/lambda_latest.zip',
        FunctionName: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function',
        RevisionId: '4a847a75-4dc6-4c7c-971b-459c89be333f',
        Publish: true,
      })
      .resolves({
        FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function:3',
        RevisionId: 'b4b060ce-0554-49cb-9639-69c2b5eeef11',
      })

    lambdaMock
      .on(ListVersionsByFunctionCommand, {
        FunctionName: process.env.LambdaFunctionName,
      })
      .resolvesOnce({
        Versions: [
          {
            FunctionName: 'fingerprint-pro-lambda-function',
            FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function',
            Version: '1',
            LastModified: '2024-01-12T09:47:00.123+0200',
            RevisionId: '4a847a75-4dc6-4c7c-971b-459c89be333f',
          },
          {
            FunctionName: 'fingerprint-pro-lambda-function',
            FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function',
            Version: '2',
            LastModified: '2024-03-13T10:47:00.123+0200',
            RevisionId: 'b4b060ce-0554-49cb-9639-69c2b5eeef11',
          },
        ],
      })

    cloudFrontMock.on(GetDistributionConfigCommand, { Id: 'ABCDEF123456' }).resolves(cloudFrontConfigBeforeUpdate)

    cloudFrontMock.on(CreateInvalidationCommand, createInvalidation).resolves({})

    cloudFrontMock.on(UpdateDistributionCommand, updatedCloudFrontConfig).resolves({})

    const event = generateUpdateRequest(correctToken)

    const result = await handler(event)
    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body).errorCode).toBe(ErrorCode.LambdaFunctionNewVersionNotActive)
  })

  test('expect errorCode to be latest version not present', async () => {
    setSecretEnv()
    process.env.CFDistributionId = 'ABCDEF123456'
    process.env.LambdaFunctionName = 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function'
    process.env.LambdaFunctionArn = 'fingerprint-pro-lambda-function'
    mockSecret(correctToken)
    lambdaMock
      .on(GetFunctionCommand, {
        FunctionName: process.env.LambdaFunctionName,
      })
      .resolvesOnce(existingLambda)
      .resolvesOnce(existingLambdaAfterUpdate)

    lambdaMock
      .on(UpdateFunctionCodeCommand, {
        S3Bucket: 'fingerprint-pro-cloudfront-integration',
        S3Key: 'v2/lambda_latest.zip',
        FunctionName: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function',
        RevisionId: '4a847a75-4dc6-4c7c-971b-459c89be333f',
        Publish: true,
      })
      .resolves({
        FunctionArn: 'arn:aws:lambda:us-east-1:1234567890:function:fingerprint-pro-lambda-function:3',
        RevisionId: 'b4b060ce-0554-49cb-9639-69c2b5eeef11',
      })

    lambdaMock
      .on(ListVersionsByFunctionCommand, {
        FunctionName: process.env.LambdaFunctionName,
      })
      .resolvesOnce(lambdaVersionsBeforeUpdate)

    cloudFrontMock.on(GetDistributionConfigCommand, { Id: 'ABCDEF123456' }).resolves(cloudFrontConfigBeforeUpdate)

    cloudFrontMock.on(CreateInvalidationCommand, createInvalidation).resolves({})

    cloudFrontMock.on(UpdateDistributionCommand, updatedCloudFrontConfig).resolves({})

    const event = generateUpdateRequest(correctToken)

    const result = await handler(event)
    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body).errorCode).toBe(ErrorCode.LambdaFunctionWrongNewVersionsCount)
  })
})

function generateUpdateRequest(
  token: string,
  method: string = 'POST',
  rawPath: string = '/update'
): APIGatewayProxyEventV2WithRequestContext<APIGatewayEventRequestContextV2> {
  const requestContext: APIGatewayEventRequestContextV2 = {
    accountId: '1234567890',
    apiId: 'v3',
    domainName: 'aws-lambda.amazonaws.com',
    domainPrefix: 'xyz123-qwerttuii-fsfds',
    http: {
      method: method,
      path: 'status',
      protocol: 'https',
      sourceIp: '192.168.1.2',
      userAgent: 'backend-app',
    },
    requestId: 'a70a6921-959a-40ea-8e2e-f5343b08588a',
    routeKey: '',
    stage: '',
    time: '2023-12-18T15:57:15+0000',
    timeEpoch: 1702915035000,
  }

  const event: APIGatewayProxyEventV2WithRequestContext<APIGatewayEventRequestContextV2> = {
    version: 'v3',
    routeKey: '',
    rawPath: rawPath,
    rawQueryString: '',
    headers: {
      'content-type': 'application/json',
      authorization: `mgmt-token ${token}`,
    },
    requestContext: requestContext,
    isBase64Encoded: false,
  }
  return event
}

function generateStatusRequest(
  token: string,
  method: string = 'GET',
  rawPath = '/status'
): APIGatewayProxyEventV2WithRequestContext<APIGatewayEventRequestContextV2> {
  const requestContext: APIGatewayEventRequestContextV2 = {
    accountId: '1234567890',
    apiId: 'v3',
    domainName: 'aws-lambda.amazonaws.com',
    domainPrefix: 'xyz123-qwerttuii-fsfds',
    http: {
      method: method,
      path: 'status',
      protocol: 'https',
      sourceIp: '192.168.1.2',
      userAgent: 'backend-app',
    },
    requestId: 'a70a6921-959a-40ea-8e2e-f5343b08588a',
    routeKey: '',
    stage: '',
    time: '2023-12-18T15:57:15+0000',
    timeEpoch: 1702915035000,
  }

  const event: APIGatewayProxyEventV2WithRequestContext<APIGatewayEventRequestContextV2> = {
    version: 'v3',
    routeKey: '',
    rawPath: rawPath,
    rawQueryString: '',
    headers: {
      'content-type': 'application/json',
      authorization: `mgmt-token ${token}`,
    },
    requestContext: requestContext,
    isBase64Encoded: false,
  }
  return event
}
