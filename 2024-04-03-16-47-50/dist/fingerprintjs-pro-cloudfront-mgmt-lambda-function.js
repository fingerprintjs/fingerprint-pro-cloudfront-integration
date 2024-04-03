/**
 * FingerprintJS Pro CloudFront Lambda function v2.1.0-rc.2 - Copyright (c) FingerprintJS, Inc, 2024 (https://fingerprint.com)
 * Licensed under the MIT (http://www.opensource.org/licenses/mit-license.php) license.
 */

'use strict';

var clientSecretsManager = require('@aws-sdk/client-secrets-manager');
var clientLambda = require('@aws-sdk/client-lambda');
var clientCloudfront = require('@aws-sdk/client-cloudfront');

const MGMT_TOKEN_SCHEME = 'mgmt-token';
const EMPTY_TOKEN = '';
async function getAuthSettings(secretManagerClient) {
    const secretName = process.env.SettingsSecretName;
    if (!secretName) {
        throw new Error('Unable to retrieve secret. Error: environment variable SettingsSecretName not found');
    }
    try {
        const command = new clientSecretsManager.GetSecretValueCommand({
            SecretId: secretName,
        });
        const response = await secretManagerClient.send(command);
        if (response.SecretBinary) {
            return JSON.parse(Buffer.from(response.SecretBinary).toString('utf8'));
        }
        if (response.SecretString) {
            return JSON.parse(response.SecretString);
        }
        throw new Error('secret is empty');
    }
    catch (error) {
        throw new Error(`Unable to retrieve secret. ${error}`);
    }
}
function retrieveAuthToken(event) {
    const authorization = event.headers['authorization'];
    if (!authorization) {
        return EMPTY_TOKEN;
    }
    const [type, token] = authorization.split(' ');
    if (type == MGMT_TOKEN_SCHEME) {
        return token || EMPTY_TOKEN;
    }
    return EMPTY_TOKEN;
}

var ErrorCode;
(function (ErrorCode) {
    ErrorCode["UnknownError"] = "E1000";
    ErrorCode["AWSResourceNotFound"] = "E2100";
    ErrorCode["AWSAccessDenied"] = "E2200";
    ErrorCode["LambdaFunctionNotFound"] = "E3100";
    ErrorCode["CloudFrontDistributionNotFound"] = "E4100";
    ErrorCode["CacheBehaviorNotFound"] = "E5100";
    ErrorCode["CacheBehaviorPatternNotDefined"] = "E5200";
    ErrorCode["LambdaFunctionAssociationNotFound"] = "E6100";
    ErrorCode["LambdaFunctionARNNotFound"] = "E7100";
    ErrorCode["LambdaFunctionWrongNewVersionsCount"] = "E8000";
    ErrorCode["LambdaFunctionNewVersionNotActive"] = "E8100";
    ErrorCode["LambdaFunctionCurrentRevisionNotDefined"] = "E8200";
    ErrorCode["LambdaFunctionUpdateRevisionNotCreated"] = "E8300";
})(ErrorCode || (ErrorCode = {}));
class ApiException extends Error {
    constructor(code = ErrorCode.UnknownError) {
        super();
        this.code = code;
    }
    get name() {
        return this.code;
    }
}

async function handleNoAuthentication() {
    const body = {
        status: 'Token is not specified or not valid',
    };
    return {
        statusCode: 401,
        body: JSON.stringify(body),
        headers: {
            'content-type': 'application/json',
        },
    };
}
async function handleWrongConfiguration(error) {
    const body = {
        status: 'Wrong function configuration. Check environment variables for Lambda@Edge function and CloudFront Distribution id',
        error: error.message || error,
    };
    return {
        statusCode: 500,
        body: JSON.stringify(body),
        headers: {
            'content-type': 'application/json',
        },
    };
}
function handleError(error) {
    if (error.name?.includes('AccessDenied')) {
        error.code = ErrorCode.AWSAccessDenied;
    }
    else if (error.name === clientLambda.ResourceNotFoundException.name) {
        error.code = ErrorCode.AWSResourceNotFound;
    }
    return {
        statusCode: 500,
        body: JSON.stringify({ status: 'Error occurred', errorCode: error.code || ErrorCode.UnknownError }),
        headers: {
            'content-type': 'application/json',
        },
    };
}
async function handleNotFound() {
    const body = {
        status: 'Path not found',
    };
    return {
        statusCode: 404,
        body: JSON.stringify(body),
        headers: {
            'content-type': 'application/json',
        },
    };
}

const defaults = {
    AWS_REGION: 'us-east-1',
    LAMBDA_DISTRIBUTION_BUCKET: 'fingerprint-pro-cloudfront-integration-lambda-function',
    LAMBDA_DISTRIBUTION_BUCKET_KEY: 'releaseV2/lambda_latest.zip',
    LAMBDA_HANDLER_NAME: 'fingerprintjs-pro-cloudfront-lambda-function.handler',
    FP_CDN_URL: 'fpcdn.io',
};

async function handleStatus(lambdaClient, cloudFrontClient, settings) {
    const lambdaFunctionInformation = await getLambdaFunctionInformation$1(lambdaClient, settings.LambdaFunctionName);
    const cloudFrontDistributionInformation = await getCloudFrontDistributionInformation(cloudFrontClient, settings.CFDistributionId, settings.LambdaFunctionName);
    const result = {
        lambdaFunction: lambdaFunctionInformation,
        cloudFrontDistribution: cloudFrontDistributionInformation,
    };
    return {
        statusCode: 200,
        body: JSON.stringify(result),
        headers: {
            'content-type': 'application/json',
        },
    };
}
async function getLambdaFunctionInformation$1(lambdaClient, functionName) {
    const command = new clientLambda.GetFunctionCommand({ FunctionName: functionName });
    try {
        const result = await lambdaClient.send(command);
        return {
            functionName: result.Configuration?.FunctionName,
            lastModified: result.Configuration?.LastModified,
            lastUpdateStatus: result.Configuration?.LastUpdateStatus,
            lastUpdateStatusReason: result.Configuration?.LastUpdateStatusReason,
            lastUpdateStatusCode: result.Configuration?.LastUpdateStatusReasonCode,
            runtime: result.Configuration?.Runtime,
            version: result.Configuration?.Version,
            handler: result.Configuration?.Handler,
        };
    }
    catch (error) {
        console.error('Unable to get lambda function information', error);
        return undefined;
    }
}
async function getCloudFrontDistributionInformation(cloudFrontClient, distributionId, functionName) {
    const command = new clientCloudfront.GetDistributionCommand({ Id: distributionId });
    try {
        const result = await cloudFrontClient.send(command);
        let cacheBehaviorsWithFingerprintFunction = 0;
        if (result.Distribution?.DistributionConfig?.DefaultCacheBehavior?.TargetOriginId === defaults.FP_CDN_URL) {
            const lambdas = result.Distribution?.DistributionConfig?.DefaultCacheBehavior.LambdaFunctionAssociations?.Items?.filter((it) => it && it.EventType === 'origin-request' && it.LambdaFunctionARN?.includes(`${functionName}:`));
            if (lambdas) {
                cacheBehaviorsWithFingerprintFunction += lambdas.length;
            }
        }
        const fpCbs = result.Distribution?.DistributionConfig?.CacheBehaviors?.Items?.filter((it) => it.TargetOriginId === defaults.FP_CDN_URL);
        if (fpCbs && fpCbs?.length > 0) {
            fpCbs.forEach((cacheBehavior) => {
                const lambdas = cacheBehavior.LambdaFunctionAssociations?.Items?.filter((it) => it && it.EventType === 'origin-request' && it.LambdaFunctionARN?.includes(`${functionName}:`));
                if (lambdas) {
                    cacheBehaviorsWithFingerprintFunction += lambdas.length;
                }
            });
        }
        return {
            id: result.Distribution?.Id,
            enabled: result.Distribution?.DistributionConfig?.Enabled,
            status: result.Distribution?.Status,
            lastModifiedTime: result.Distribution?.LastModifiedTime,
            inProgressInvalidationBatches: result.Distribution?.InProgressInvalidationBatches,
            cacheBehaviorsWithFingerprintFunction: cacheBehaviorsWithFingerprintFunction,
        };
    }
    catch (error) {
        console.error('Unable to get CloudFront distribution information', error);
        return undefined;
    }
}

/**
 * @throws {ApiException}
 * @throws {import('@aws-sdk/client-lambda').LambdaServiceException}
 */
async function handleUpdate(lambdaClient, cloudFrontClient, settings) {
    console.info(`Going to upgrade Fingerprint Pro function association at CloudFront distribution.`);
    console.info(`Settings: ${JSON.stringify(settings)}`);
    const functionInformationBeforeUpdate = await getLambdaFunctionInformation(lambdaClient, settings.LambdaFunctionName);
    if (!functionInformationBeforeUpdate?.FunctionArn) {
        throw new ApiException(ErrorCode.LambdaFunctionNotFound);
    }
    const currentRevisionId = functionInformationBeforeUpdate?.RevisionId;
    if (!currentRevisionId) {
        console.error('Lambda@Edge function expected to have a revious ID of the current deployment');
        throw new ApiException(ErrorCode.LambdaFunctionCurrentRevisionNotDefined);
    }
    const newVersionConfiguration = await updateLambdaFunctionCode(lambdaClient, settings.LambdaFunctionName, currentRevisionId);
    const newRevisionId = newVersionConfiguration.RevisionId;
    if (!newRevisionId) {
        console.error('New revision for Lambda@Edge function was not created');
        throw new ApiException(ErrorCode.LambdaFunctionUpdateRevisionNotCreated);
    }
    const functionArn = newVersionConfiguration.FunctionArn;
    if (!functionArn) {
        console.error('Function ARN for new version is not defined');
        throw new ApiException(ErrorCode.LambdaFunctionARNNotFound);
    }
    const listVersionsAfterUpdate = await listLambdaFunctionVersions(lambdaClient, settings.LambdaFunctionName);
    const newVersions = Array.from(listVersionsAfterUpdate.values()).filter((conf) => conf.RevisionId === newRevisionId);
    if (newVersions.length !== 1) {
        console.error(`Excepted one new version, but found: ${newVersions.length} versions`);
        throw new ApiException(ErrorCode.LambdaFunctionWrongNewVersionsCount);
    }
    const newVersion = newVersions[0];
    const functionInformationAfterUpdate = await getLambdaFunctionInformation(lambdaClient, settings.LambdaFunctionName);
    if (functionInformationAfterUpdate?.State !== clientLambda.State.Active) {
        console.error(`New version ${newVersion.Version} is not in ${clientLambda.State.Active} state`);
        throw new ApiException(ErrorCode.LambdaFunctionNewVersionNotActive);
    }
    await updateCloudFrontConfig(cloudFrontClient, settings.CFDistributionId, settings.LambdaFunctionName, functionArn);
    return {
        statusCode: 200,
        body: JSON.stringify({ status: 'Update completed' }),
        headers: {
            'content-type': 'application/json',
        },
    };
}
/**
 * @throws {ApiException}
 */
async function updateCloudFrontConfig(cloudFrontClient, cloudFrontDistributionId, lambdaFunctionName, latestFunctionArn) {
    const configParams = {
        Id: cloudFrontDistributionId,
    };
    const getConfigCommand = new clientCloudfront.GetDistributionConfigCommand(configParams);
    const cfConfig = await cloudFrontClient.send(getConfigCommand);
    if (!cfConfig.ETag || !cfConfig.DistributionConfig) {
        throw new ApiException(ErrorCode.CloudFrontDistributionNotFound);
    }
    const distributionConfig = cfConfig.DistributionConfig;
    let fpCacheBehaviorsFound = 0;
    let fpCacheBehaviorsUpdated = 0;
    const pathPatterns = [];
    if (distributionConfig.DefaultCacheBehavior?.TargetOriginId === defaults.FP_CDN_URL) {
        fpCacheBehaviorsFound++;
        const lambdas = distributionConfig.DefaultCacheBehavior.LambdaFunctionAssociations?.Items?.filter((it) => it && it.EventType === 'origin-request' && it.LambdaFunctionARN?.includes(`${lambdaFunctionName}:`));
        if (lambdas?.length === 1) {
            lambdas[0].LambdaFunctionARN = latestFunctionArn;
            fpCacheBehaviorsUpdated++;
            pathPatterns.push('/*');
            console.info('Updated Fingerprint Pro Lambda@Edge function association in the default cache behavior');
        }
        else {
            console.info('The default cache behavior has targeted to FP CDN, but has no Fingerprint Pro Lambda@Edge association');
        }
    }
    const fpCbs = distributionConfig.CacheBehaviors?.Items?.filter((it) => it.TargetOriginId === defaults.FP_CDN_URL);
    if (fpCbs && fpCbs?.length > 0) {
        fpCacheBehaviorsFound += fpCbs.length;
        fpCbs.forEach((cacheBehavior) => {
            const lambdas = cacheBehavior.LambdaFunctionAssociations?.Items?.filter((it) => it && it.EventType === 'origin-request' && it.LambdaFunctionARN?.includes(`${lambdaFunctionName}:`));
            if (lambdas?.length === 1) {
                lambdas[0].LambdaFunctionARN = latestFunctionArn;
                fpCacheBehaviorsUpdated++;
                if (cacheBehavior.PathPattern) {
                    let pathPattern = cacheBehavior.PathPattern;
                    if (!cacheBehavior.PathPattern.startsWith('/')) {
                        pathPattern = '/' + pathPattern;
                    }
                    pathPatterns.push(pathPattern);
                }
                else {
                    console.error(`Path pattern is not defined for cache behavior ${JSON.stringify(cacheBehavior)}`);
                }
            }
            else {
                console.info(`Cache behavior ${JSON.stringify(cacheBehavior)} has targeted to FP CDN, but has no Fingerprint Pro Lambda@Edge association`);
            }
        });
    }
    if (fpCacheBehaviorsFound === 0) {
        throw new ApiException(ErrorCode.CacheBehaviorNotFound);
    }
    if (fpCacheBehaviorsUpdated === 0) {
        throw new ApiException(ErrorCode.LambdaFunctionAssociationNotFound);
    }
    if (pathPatterns.length === 0) {
        throw new ApiException(ErrorCode.CacheBehaviorPatternNotDefined);
    }
    const updateParams = {
        DistributionConfig: cfConfig.DistributionConfig,
        Id: cloudFrontDistributionId,
        IfMatch: cfConfig.ETag,
    };
    const updateConfigCommand = new clientCloudfront.UpdateDistributionCommand(updateParams);
    const updateCFResult = await cloudFrontClient.send(updateConfigCommand);
    console.info(`CloudFront update has finished, ${JSON.stringify(updateCFResult)}`);
    console.info('Going to invalidate routes for upgraded cache behavior');
    invalidateFingerprintIntegrationCache(cloudFrontClient, cloudFrontDistributionId, pathPatterns);
}
async function invalidateFingerprintIntegrationCache(cloudFrontClient, distributionId, pathPatterns) {
    const invalidationParams = {
        DistributionId: distributionId,
        InvalidationBatch: {
            Paths: {
                Quantity: 1,
                Items: pathPatterns,
            },
            CallerReference: 'fingerprint-pro-management-lambda-function',
        },
    };
    const invalidationCommand = new clientCloudfront.CreateInvalidationCommand(invalidationParams);
    const invalidationResult = await cloudFrontClient.send(invalidationCommand);
    console.info(`Invalidation has finished, ${JSON.stringify(invalidationResult)}`);
}
async function getLambdaFunctionInformation(lambdaClient, functionName) {
    console.info(`Getting lambda function information for ${functionName}`);
    const command = new clientLambda.GetFunctionCommand({
        FunctionName: functionName,
    });
    console.info(`Sending get command to Lambda runtime with data ${JSON.stringify(command)}`);
    const result = await lambdaClient.send(command);
    console.info(`Got get command result: ${JSON.stringify(result)}`);
    return result.Configuration;
}
/**
 * @throws {import('@aws-sdk/client-lambda').LambdaServiceException}
 * @throws {ApiException}
 */
async function updateLambdaFunctionCode(lambdaClient, functionName, revisionId) {
    console.info('Preparing command to update function code');
    const command = new clientLambda.UpdateFunctionCodeCommand({
        S3Bucket: defaults.LAMBDA_DISTRIBUTION_BUCKET,
        S3Key: defaults.LAMBDA_DISTRIBUTION_BUCKET_KEY,
        FunctionName: functionName,
        RevisionId: revisionId,
        Publish: true,
    });
    console.info(`Sending update command to Lambda runtime with data ${JSON.stringify(command)}`);
    const result = await lambdaClient.send(command);
    console.info(`Got update command result: ${JSON.stringify(result)}`);
    if (!result) {
        throw new ApiException(ErrorCode.LambdaFunctionARNNotFound);
    }
    if (!result.FunctionArn) {
        throw new ApiException(ErrorCode.LambdaFunctionARNNotFound);
    }
    console.info(`Got Lambda function update result, functionARN: ${result.FunctionArn}`);
    return result;
}
async function listLambdaFunctionVersions(lambdaClient, functionName) {
    console.info('Getting Lambda function versions');
    const command = new clientLambda.ListVersionsByFunctionCommand({
        FunctionName: functionName,
    });
    console.info(`Sending ListVersionsByFunctionCommand to with data ${JSON.stringify(command)}`);
    const result = await lambdaClient.send(command);
    console.info(`Got ListVersionsByFunctionCommand result: ${JSON.stringify(result)}`);
    if (!result) {
        throw new ApiException(ErrorCode.LambdaFunctionARNNotFound);
    }
    return new Map(result.Versions?.filter((conf) => conf !== undefined).map((conf) => [conf.Version, conf]));
}

function removeLeadingAndTrailingSlashes(value) {
    return value.replace(/\/+$/, '').replace(/^\/+/g, '');
}

async function handler(event) {
    const secretManagerClient = new clientSecretsManager.SecretsManagerClient({ region: defaults.AWS_REGION });
    try {
        const authSettings = await getAuthSettings(secretManagerClient);
        const authToken = retrieveAuthToken(event);
        if (!authToken || !authSettings.token) {
            return handleNoAuthentication();
        }
        if (authToken !== authSettings.token) {
            return handleNoAuthentication();
        }
    }
    catch (error) {
        return handleWrongConfiguration(error);
    }
    let deploymentSettings;
    try {
        deploymentSettings = loadDeploymentSettings();
    }
    catch (error) {
        return handleWrongConfiguration(error);
    }
    const method = event.requestContext.http.method;
    const lambdaClient = new clientLambda.LambdaClient({ region: defaults.AWS_REGION });
    const cloudFrontClient = new clientCloudfront.CloudFrontClient({ region: defaults.AWS_REGION });
    const path = removeLeadingAndTrailingSlashes(event.rawPath);
    if (path === 'update' && method === 'POST') {
        try {
            return await handleUpdate(lambdaClient, cloudFrontClient, deploymentSettings);
        }
        catch (e) {
            console.error(e);
            return handleError(e);
        }
    }
    if (path === 'status' && method === 'GET') {
        return handleStatus(lambdaClient, cloudFrontClient, deploymentSettings);
    }
    return handleNotFound();
}
function loadDeploymentSettings() {
    const missedVariables = [];
    const cfDistributionId = process.env.CFDistributionId || '';
    if (cfDistributionId === '') {
        missedVariables.push('CFDistributionId');
    }
    const lambdaFunctionName = process.env.LambdaFunctionName || '';
    if (lambdaFunctionName === '') {
        missedVariables.push('LambdaFunctionName');
    }
    const lambdaFunctionArn = process.env.LambdaFunctionArn || '';
    if (lambdaFunctionArn === '') {
        missedVariables.push('LambdaFunctionArn');
    }
    if (missedVariables.length > 0) {
        const vars = missedVariables.join(', ');
        throw new Error(`environment variables not found: ${vars}`);
    }
    return {
        CFDistributionId: cfDistributionId,
        LambdaFunctionArn: lambdaFunctionArn,
        LambdaFunctionName: lambdaFunctionName,
    };
}

exports.handler = handler;
//# sourceMappingURL=fingerprintjs-pro-cloudfront-mgmt-lambda-function.js.map
