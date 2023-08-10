/**
 * FingerprintJS Pro CloudFront Management Lambda function v1.1.3 - Copyright (c) FingerprintJS, Inc, 2023 (https://fingerprint.com)
 * Licensed under the MIT (http://www.opensource.org/licenses/mit-license.php) license.
 */

'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var clientCloudfront = require('@aws-sdk/client-cloudfront');
var clientCodepipeline = require('@aws-sdk/client-codepipeline');
var clientLambda = require('@aws-sdk/client-lambda');

const REGION = 'us-east-1';
async function handler(event, ctx) {
    console.info(JSON.stringify(event));
    const job = event['CodePipeline.job'];
    if (!job) {
        console.error('No job found');
        return;
    }
    const userInput = JSON.parse(job.data.actionConfiguration.configuration.UserParameters);
    const lambdaFunctionName = userInput.LAMBDA_NAME;
    const cloudFrontDistrId = userInput.CF_DISTR_ID;
    console.info(`Going to upgrade Fingerprint Pro function association at CloudFront distbution.`);
    console.info(`Lambda function: ${lambdaFunctionName}. CloudFront ID: ${cloudFrontDistrId}`);
    const latestFunctionArn = await getLambdaLatestVersionArn(lambdaFunctionName);
    if (!latestFunctionArn) {
        return publishJobFailure(ctx, job, 'No lambda versions');
    }
    if (latestFunctionArn.length === 1) {
        console.info('No updates yet');
        return publishJobSuccess(ctx, job);
    }
    const cloudFrontClient = new clientCloudfront.CloudFrontClient({ region: REGION });
    const configParams = {
        Id: cloudFrontDistrId,
    };
    const getConfigCommand = new clientCloudfront.GetDistributionConfigCommand(configParams);
    const cfConfig = await cloudFrontClient.send(getConfigCommand);
    if (!cfConfig.ETag || !cfConfig.DistributionConfig) {
        return publishJobFailure(ctx, job, 'CloudFront distribution not found');
    }
    const cacheBehaviors = cfConfig.DistributionConfig.CacheBehaviors;
    const fpCbs = cacheBehaviors?.Items?.filter((it) => it.TargetOriginId === 'fpcdn.io');
    if (!fpCbs || fpCbs?.length === 0) {
        return publishJobFailure(ctx, job, 'Cache behavior not found');
    }
    const cacheBehavior = fpCbs[0];
    const lambdas = cacheBehavior.LambdaFunctionAssociations?.Items?.filter((it) => it && it.EventType === 'origin-request' && it.LambdaFunctionARN?.includes(lambdaFunctionName));
    if (!lambdas || lambdas?.length === 0) {
        return publishJobFailure(ctx, job, 'Lambda function association not found');
    }
    const lambda = lambdas[0];
    lambda.LambdaFunctionARN = latestFunctionArn;
    const updateParams = {
        DistributionConfig: cfConfig.DistributionConfig,
        Id: cloudFrontDistrId,
        IfMatch: cfConfig.ETag,
    };
    const updateConfigCommand = new clientCloudfront.UpdateDistributionCommand(updateParams);
    const updateCFResult = await cloudFrontClient.send(updateConfigCommand);
    console.info(`CloudFront update has finished, ${JSON.stringify(updateCFResult)}`);
    console.info('Going to invalidate routes for upgraded cache behavior');
    if (!cacheBehavior.PathPattern) {
        return publishJobFailure(ctx, job, 'Path pattern is not defined');
    }
    let pathPattern = cacheBehavior.PathPattern;
    if (!pathPattern.startsWith('/')) {
        pathPattern = '/' + pathPattern;
    }
    const invalidationParams = {
        DistributionId: cloudFrontDistrId,
        InvalidationBatch: {
            Paths: {
                Quantity: 1,
                Items: [pathPattern],
            },
            CallerReference: 'fingerprint-pro-management-lambda-function',
        },
    };
    const invalidationCommand = new clientCloudfront.CreateInvalidationCommand(invalidationParams);
    const invalidationResult = await cloudFrontClient.send(invalidationCommand);
    console.info(`Invalidation has finished, ${JSON.stringify(invalidationResult)}`);
    await publishJobSuccess(ctx, job);
}
async function getLambdaLatestVersionArn(functionName) {
    const client = new clientLambda.LambdaClient({ region: REGION });
    const params = {
        FunctionName: functionName,
    };
    const command = new clientLambda.ListVersionsByFunctionCommand(params);
    const result = await client.send(command);
    if (!result.Versions || result.Versions?.length === 0) {
        return Promise.resolve(undefined);
    }
    const latest = result.Versions.filter((it) => it.Version && Number.isFinite(Number.parseInt(it.Version))).sort((a, b) => Number.parseInt(b.Version) - Number.parseInt(a.Version))[0];
    return Promise.resolve(latest.FunctionArn);
}
function getCodePipelineClient() {
    const config = {
        region: REGION,
        defaultsMode: 'standard',
    };
    return new clientCodepipeline.CodePipelineClient(config);
}
async function publishJobSuccess(ctx, job) {
    const params = {
        jobId: job.id,
    };
    try {
        const command = new clientCodepipeline.PutJobSuccessResultCommand(params);
        const result = await getCodePipelineClient().send(command);
        console.info(`Job successfully finished with ${JSON.stringify(result)}`);
        ctx.succeed();
    }
    catch (err) {
        ctx.fail(err);
    }
}
async function publishJobFailure(ctx, job, message) {
    console.info(`Publishing failure status with message=${message}`);
    const params = {
        jobId: job.id,
        failureDetails: {
            message: message,
            type: clientCodepipeline.FailureType.ConfigurationError,
        },
    };
    try {
        const command = new clientCodepipeline.PutJobFailureResultCommand(params);
        const result = await getCodePipelineClient().send(command);
        console.info(`Job failed with ${JSON.stringify(result)}`);
        ctx.fail(message);
    }
    catch (err) {
        ctx.fail(err);
    }
}

exports.handler = handler;
