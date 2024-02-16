/**
 * FingerprintJS Pro CloudFront Lambda function v1.4.1-rc.1 - Copyright (c) FingerprintJS, Inc, 2024 (https://fingerprint.com)
 * Licensed under the MIT (http://www.opensource.org/licenses/mit-license.php) license.
 */

import { APIGatewayProxyEventV2WithRequestContext, APIGatewayEventRequestContextV2, APIGatewayProxyResult } from 'aws-lambda';

declare function handler(event: APIGatewayProxyEventV2WithRequestContext<APIGatewayEventRequestContextV2>): Promise<APIGatewayProxyResult>;

export { handler };
