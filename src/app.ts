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
import { HeaderCustomerVariables } from './utils/customer-variables/header-customer-variables'
import { SecretsManagerVariables } from './utils/customer-variables/secrets-manager/secrets-manager-variables'

export const handler = async (event: CloudFrontRequestEvent): Promise<CloudFrontResultResponse> => {
  const request = event.Records[0].cf.request

  const customerVariables = new CustomerVariables([
    new SecretsManagerVariables(request),
    new HeaderCustomerVariables(request),
  ])

  const domain = getDomainFromHostname(getHost(request))

  if (request.uri === (await getAgentUri(customerVariables))) {
    const endpoint = `/v3/${getApiKey(request)}/loader_v${getLoaderVersion(request)}.js`
    return downloadAgent({
      path: endpoint,
      method: request.method,
      headers: filterRequestHeaders(request),
      domain: domain,
    })
  } else if (request.uri === (await getResultUri(customerVariables))) {
    return handleResult({
      region: getRegion(request),
      querystring: request.querystring,
      method: request.method,
      headers: await prepareHeadersForIngressAPI(request, customerVariables),
      body: request.body?.data || '',
      domain: domain,
    })
  } else if (request.uri === (await getStatusUri(customerVariables))) {
    return handleStatus()
  } else {
    return new Promise((resolve) =>
      resolve({
        status: '404',
      }),
    )
  }
}
