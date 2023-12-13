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
  removeTrailingSlashes,
} from './utils'
import { getEffectiveTLDPlusOne } from './domain'
import { CustomerVariables } from './utils/customer-variables/customer-variables'
import { HeaderCustomerVariables } from './utils/customer-variables/header-customer-variables'
import { SecretsManagerVariables } from './utils/customer-variables/secrets-manager/secrets-manager-variables'
import { createLogger } from './logger'

export const handler = async (event: CloudFrontRequestEvent): Promise<CloudFrontResultResponse> => {
  const request = event.Records[0].cf.request

  const logger = createLogger(request)

  const customerVariables = new CustomerVariables([
    new SecretsManagerVariables(request),
    new HeaderCustomerVariables(request),
  ])

  logger.debug('Handling request', request)

  const resultUri = await getResultUri(customerVariables)
  const resultUriRegex = new RegExp(`^${resultUri}(/.*)?$`)

  const pathname = removeTrailingSlashes(request.uri)
  const resultPathMatches = pathname.match(resultUriRegex)
  const agentUri = await getAgentUri(customerVariables)

  if (pathname === agentUri) {
    return downloadAgent({
      apiKey: getApiKey(request, logger),
      version: getVersion(request, logger),
      loaderVersion: getLoaderVersion(request, logger),
      method: request.method,
      headers: filterRequestHeaders(request),
      domain: getHost(request),
      logger,
    })
  } else if (resultPathMatches?.length) {
    let suffix = ''
    if (resultPathMatches && resultPathMatches.length >= 1) {
      suffix = resultPathMatches[1] ?? ''
    }
    if (suffix.length > 0 && !suffix.startsWith('/')) {
      suffix = '/' + suffix
    }
    const eTLDPlusOneDomain = getEffectiveTLDPlusOne(getHost(request))
    return handleResult({
      region: getRegion(request, logger),
      querystring: request.querystring,
      method: request.method,
      headers: await prepareHeadersForIngressAPI(request, customerVariables),
      body: request.body?.data || '',
      domain: eTLDPlusOneDomain,
      logger,
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
      }),
    )
  }
}
