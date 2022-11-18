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
import { getDomainFromHostname } from './domain'
import { CustomerVariables } from './utils/customer-variables/customer-variables'

export const handler = async (event: CloudFrontRequestEvent): Promise<CloudFrontResultResponse> => {
  const request = event.Records[0].cf.request

  // @ts-ignore
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const customerVariables = new CustomerVariables([
    // SecretManagerProvider(request)
    // HeaderProvider(request)
  ])

  const domain = getDomainFromHostname(getHost(request))

  /**
   * Later, we can move getAgentUri, getResultUri functions to separate file from headers.ts, and pass to them customerVariables rather than request.
   * There they can call the CustomerVariables to get required values, e.g:
   *  customerVariables.getVariable(CustomerVariableType.AgentDownloadPath)
   * */
  if (request.uri === getAgentUri(request)) {
    const endpoint = `/v3/${getApiKey(request)}/loader_v${getLoaderVersion(request)}.js`
    return downloadAgent({
      path: endpoint,
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
