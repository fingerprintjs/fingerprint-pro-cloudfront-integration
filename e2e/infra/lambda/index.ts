import { resource } from '../utils/resource'
import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'
import * as fs from 'fs'

export const secretName = resource(`secret-${Date.now()}`)
const secret = new aws.secretsmanager.Secret(secretName, {
  name: secretName,
})
new aws.secretsmanager.SecretVersion(secretName, {
  secretId: secret.id,
  secretString: JSON.stringify({
    fpjs_get_result_path: process.env.FPJS_GET_RESULT_PATH ?? 'visitorId',
    fpjs_pre_shared_secret: process.env.FPJS_PRE_SHARED_SECRET ?? '',
    fpjs_agent_download_path: process.env.FPJS_AGENT_DOWNLOAD_PATH ?? 'agent',
    // Note: `fpjs_behavior_path` is not used since v2.
    // It's a left-over value from v1 to cover migration case and
    // make sure v2 wouldn't fail if unexpected variables are added to the secret
    fpjs_behavior_path: process.env.FPJS_BEHAVIOR_PATH ?? 'fpjs',
  }),
})

const secretPolicy = new aws.iam.Policy(resource('secret-policy'), {
  policy: {
    Version: '2012-10-17',
    Statement: [
      {
        Action: 'secretsmanager:GetSecretValue',
        Effect: 'Allow',
        Resource: [secret.arn],
      },
    ],
  },
})

const lambdaRole = new aws.iam.Role(
  resource('lambda-role'),
  {
    managedPolicyArns: [secretPolicy.arn, aws.iam.ManagedPolicies.AWSLambdaBasicExecutionRole],
    assumeRolePolicy: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
          Principal: {
            Service: ['lambda.amazonaws.com', 'edgelambda.amazonaws.com'],
          },
        },
      ],
    },
  },
  {
    dependsOn: [secretPolicy],
  }
)

const distDir = process.env.DIST_DIR ?? 'dist'

console.info('distDir', distDir)

const lambdaCodePaths = [`../../../${distDir}`, `../../${distDir}`]
const lambdaCodePath = lambdaCodePaths.find((lambdaPath) => fs.existsSync(lambdaPath))

if (!lambdaCodePath) {
  throw new Error('Lambda code path not found')
}

const lambdaFunction = new aws.lambda.Function(
  resource('lambda'),
  {
    runtime: 'nodejs20.x',
    code: new pulumi.asset.FileArchive(lambdaCodePath),
    role: lambdaRole.arn,
    handler: 'fingerprintjs-pro-cloudfront-lambda-function.handler',
    publish: true,
    tags: {
      tag: 'cloudfront-lambda-e2e',
    },
  },
  {
    retainOnDelete: true,
  }
)

new aws.lambda.Permission(resource('lambda-permission'), {
  action: 'lambda:GetFunction',
  function: lambdaFunction,
  principal: 'edgelambda.amazonaws.com',
})

export const lambdaVersion = lambdaFunction.version
export const lambdaArn = pulumi.interpolate`${lambdaFunction.arn}:${lambdaVersion}`
