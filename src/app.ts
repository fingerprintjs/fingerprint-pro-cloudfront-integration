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
  getVersion,
  getApiKey,
  getLoaderVersion,
} from './utils'
import { getDomainFromHostname } from './domain'

export const handler = async (event: CloudFrontRequestEvent): Promise<CloudFrontResultResponse> => {
  const request = event.Records[0].cf.request

  const domain = getDomainFromHostname(getHost(request))

  if (request.uri === getAgentUri(request)) {
    return downloadAgent({
      apiKey: getApiKey(request),
      version: getVersion(request),
      loaderVersion: getLoaderVersion(request),
      method: request.method,
      headers: filterRequestHeaders(request),
      domain: domain,
    })
  } else if (request.uri === getResultUri(request)) {
    return handleResult({
      region: getRegion(request),
      querystring: request.querystring,
      method: request.method,
      headers: prepareHeadersForIngressAPI(request),
      body: request.body?.data || '',
      domain: domain,
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
