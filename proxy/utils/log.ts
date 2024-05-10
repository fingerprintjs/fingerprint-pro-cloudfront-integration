import { CloudFrontRequest } from 'aws-lambda'
import { getHeaderValue } from './headers'

/**
 * This function depends on 'fpjs_debug' boolean value, determining whether debug logs are going to be logged or not.
 * @param request {CloudFrontRequest}
 */
export function setLogLevel(request?: CloudFrontRequest) {
  const debugValue = request ? getHeaderValue(request, 'fpjs_debug') : undefined
  if (debugValue === 'true') {
    return
  }
  console.debug = () => null
}
