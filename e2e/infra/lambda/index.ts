import { resource } from '../utils/resource'
import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'

const config = new pulumi.Config()
const org = config.require('org')

console.debug('Org: ', org)

/*const lambdaRole = new aws.iam.Role(resource('lambda-role'), {
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
})*/

const lambdaFunction = new aws.lambda.Function(resource('lambda'), {
  runtime: 'nodejs16.x',
  code: new pulumi.asset.FileArchive('../../../dist'),
  role: 'arn:aws:iam::708050157146:role/fpjs-dev-cloudfront-lambda-e2e-role',
  handler: 'fingerprintjs-pro-cloudfront-lambda-function.handler',
  publish: true,
  tags: {
    tag: 'cloudfront-lambda-e2e',
  },
})

new aws.lambda.Permission(resource('lambda-permission'), {
  action: 'lambda:GetFunction',
  function: lambdaFunction,
  principal: 'edgelambda.amazonaws.com',
})

export const lambdaVersion = lambdaFunction.version
export const lambdaArn = pulumi.interpolate`${lambdaFunction.arn}:${lambdaVersion}`
