/**
 * Fingerprint Pro CloudFront Lambda function v2.0.2 - Copyright (c) FingerprintJS, Inc, 2024 (https://fingerprint.com)
 * Licensed under the MIT (http://www.opensource.org/licenses/mit-license.php) license.
 */

import { CloudFrontResultResponse, CloudFrontRequestEvent } from 'aws-lambda';
import { CloudFrontRequest } from 'aws-lambda/common/cloudfront';

declare enum CustomerVariableType {
    GetResultPath = "fpjs_get_result_path",
    PreSharedSecret = "fpjs_pre_shared_secret",
    AgentDownloadPath = "fpjs_agent_download_path",
    FpCdnUrl = "fpjs_cdn_url",
    FpIngressBaseHost = "fpjs_ingress_base_host"
}
type CustomerVariableValue = string | null | undefined;
interface CustomerVariableProvider {
    readonly name: string;
    getVariable: (variable: CustomerVariableType) => Promise<CustomerVariableValue>;
}

interface GetVariableResult {
    value: CustomerVariableValue;
    resolvedBy: string | null;
}
/**
 * Allows access to customer defined variables using multiple providers.
 * Variables will be resolved in order in which providers are set.
 * */
declare class CustomerVariables {
    private readonly providers;
    constructor(providers: CustomerVariableProvider[]);
    /**
     * Attempts to resolve customer variable using providers.
     * If no provider can resolve the variable, the default value is returned.
     * */
    getVariable(variable: CustomerVariableType): Promise<GetVariableResult>;
    private getValueFromProviders;
}

type Route = {
    pathPattern: RegExp;
    handler: (request: CloudFrontRequest, customerVariables: CustomerVariables, routeMatchArray: RegExpMatchArray | undefined) => Promise<CloudFrontResultResponse>;
};
declare const handler: (event: CloudFrontRequestEvent) => Promise<CloudFrontResultResponse>;
declare function handleRequestWithRoutes(request: CloudFrontRequest, customerVariables: CustomerVariables, routes: Route[]): Promise<CloudFrontResultResponse>;

export { type Route, handleRequestWithRoutes, handler };
