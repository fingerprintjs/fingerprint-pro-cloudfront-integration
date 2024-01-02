/**
 * FingerprintJS Pro CloudFront Lambda function v1.4.1-rc.1 - Copyright (c) FingerprintJS, Inc, 2024 (https://fingerprint.com)
 * Licensed under the MIT (http://www.opensource.org/licenses/mit-license.php) license.
 */

import * as aws_lambda from 'aws-lambda';
import { APIGatewayProxyEventV2WithRequestContext, APIGatewayEventRequestContextV2 } from 'aws-lambda';

declare function handler(event: APIGatewayProxyEventV2WithRequestContext<APIGatewayEventRequestContextV2>): Promise<aws_lambda.APIGatewayProxyResult>;

export { handler };
