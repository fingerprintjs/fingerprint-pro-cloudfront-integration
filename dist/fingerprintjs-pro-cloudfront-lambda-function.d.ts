/**
 * FingerprintJS Pro CloudFront Lambda function v0.0.2 - Copyright (c) FingerprintJS, Inc, 2022 (https://fingerprint.com)
 * Licensed under the MIT (http://www.opensource.org/licenses/mit-license.php) license.
 */

import { CloudFrontRequestEvent, CloudFrontResultResponse } from 'aws-lambda';

declare const handler: (event: CloudFrontRequestEvent) => Promise<CloudFrontResultResponse>;

export { handler };
