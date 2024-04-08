/**
 * FingerprintJS Pro CloudFront Lambda function v2.1.0-rc.2 - Copyright (c) FingerprintJS, Inc, 2024 (https://fingerprint.com)
 * Licensed under the MIT (http://www.opensource.org/licenses/mit-license.php) license.
 */

import { CloudFrontRequestEvent, CloudFrontResultResponse } from 'aws-lambda';

declare const handler: (event: CloudFrontRequestEvent) => Promise<CloudFrontResultResponse>;

export { handler };
