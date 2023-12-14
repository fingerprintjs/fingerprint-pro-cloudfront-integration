/**
 * FingerprintJS Pro CloudFront Lambda function v1.3.3 - Copyright (c) FingerprintJS, Inc, 2023 (https://fingerprint.com)
 * Licensed under the MIT (http://www.opensource.org/licenses/mit-license.php) license.
 */

import * as aws_lambda from 'aws-lambda';
import { APIGatewayProxyEventV2WithRequestContext, APIGatewayEventRequestContextV2 } from 'aws-lambda';

declare function handler(event: APIGatewayProxyEventV2WithRequestContext<APIGatewayEventRequestContextV2>): Promise<aws_lambda.APIGatewayProxyResult>;

export { handler };
