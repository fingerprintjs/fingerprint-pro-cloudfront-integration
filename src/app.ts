import { CloudFrontRequestEvent, CloudFrontResultResponse } from 'aws-lambda'

import { downloadAgent, handleResult, handleStatus } from './handlers'
import {
  filterRequestHeaders,
  getAgentUri,
  getResultUri,
  getStatusUri,
  prepareHeadersForIngressAPI,
  getHost,
  getRegion,
  getApiKey,
  getLoaderVersion,
} from './utils'

export const handler = async (event: CloudFrontRequestEvent): Promise<CloudFrontResultResponse> => {
  const request = event.Records[0].cf.request

  if (request.uri === getAgentUri(request)) {
    const endpoint = `/v3/${getApiKey(request)}/loader_v${getLoaderVersion(request)}.js`
    return downloadAgent({
      path: endpoint,
      method: request.method,
      headers: filterRequestHeaders(request),
      domain: getHost(request),
    })
  } else if (request.uri === getResultUri(request)) {
    return handleResult({
      region: getRegion(request),
      querystring: request.querystring,
      method: request.method,
      headers: prepareHeadersForIngressAPI(request),
      body: request.body?.data || '',
      domain: getHost(request),
    })
  } else if (request.uri === getStatusUri(request)) {
    return handleStatus()
  } else {
    return new Promise((resolve) =>
      resolve({
        status: '404',
      }),
    )
  }
}
