import { CloudFrontRequestEvent, CloudFrontResultResponse } from 'aws-lambda'

import { downloadAgent, handleResult, handleStatus } from './handlers'
import {
  filterRequestHeaders,
  getAgentUri,
  getResultUri,
  getStatusUri,
  prepareHeadersForIngressAPI,
  getRegion,
  getVersion,
  getApiKey,
  getLoaderVersion,
  removeTrailingSlashes,
  setLogLevel,
} from './utils'
import { CustomerVariables } from './utils/customer-variables/customer-variables'
import { HeaderCustomerVariables } from './utils/customer-variables/header-customer-variables'
import { SecretsManagerVariables } from './utils/customer-variables/secrets-manager/secrets-manager-variables'

export const handler = async (event: CloudFrontRequestEvent): Promise<CloudFrontResultResponse> => {
  console.log('test')
  console.log('test2')
  const request = event.Records[0].cf.request
  setLogLevel(request)

  const customerVariables = new CustomerVariables([
    new SecretsManagerVariables(request),
    new HeaderCustomerVariables(request),
  ])

  console.debug('Handling request', request)

  const resultUri = await getResultUri(customerVariables)
  const resultUriRegex = new RegExp(`^${resultUri}(/.*)?$`)

  const pathname = removeTrailingSlashes(request.uri)
  const resultPathMatches = pathname.match(resultUriRegex)
  const agentUri = await getAgentUri(customerVariables)

  if (pathname === agentUri) {
    return downloadAgent({
      apiKey: getApiKey(request),
      version: getVersion(request),
      loaderVersion: getLoaderVersion(request),
      method: request.method,
      headers: filterRequestHeaders(request),
    })
  } else if (resultPathMatches?.length) {
    let suffix = ''
    if (resultPathMatches && resultPathMatches.length >= 1) {
      suffix = resultPathMatches[1] ?? ''
    }
    if (suffix.length > 0 && !suffix.startsWith('/')) {
      suffix = '/' + suffix
    }
    return handleResult({
      region: getRegion(request),
      querystring: request.querystring,
      method: request.method,
      headers: await prepareHeadersForIngressAPI(request, customerVariables),
      body: request.body?.data || '',
      suffix,
    })
  } else {
    const statusUri = await getStatusUri(customerVariables)

    if (pathname === statusUri) {
      return handleStatus(customerVariables)
    }

    return new Promise((resolve) =>
      resolve({
        status: '404',
      })
    )
  }
}
