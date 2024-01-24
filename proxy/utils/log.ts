import { CloudFrontRequest } from 'aws-lambda'
import { getHeaderValue } from './headers'

export function setLogLevel(request?: CloudFrontRequest) {
  const debugValue = request ? getHeaderValue(request, 'fpjs_debug') : undefined
  const level = debugValue === 'true' ? 'DEBUG' : 'ERROR'
  process.env.AWS_LAMBDA_LOG_LEVEL = level
}
