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
  setLogLevel,
  createRoute,
  generateRandom,
  base64ToArrayBuffer,
} from './utils'
import { CustomerVariables } from './utils/customer-variables/customer-variables'
import { HeaderCustomerVariables } from './utils/customer-variables/header-customer-variables'
import { SecretsManagerVariables } from './utils/customer-variables/secrets-manager/secrets-manager-variables'
import { getFpCdnUrl, getFpIngressBaseHost } from './utils/customer-variables/selectors'
import type { CloudFrontRequest } from 'aws-lambda/common/cloudfront'
import { processOpenClientResponse } from './utils/processOpenClientResponse'
import { CustomerVariableType } from './utils/customer-variables/types'

export type Route = {
  pathPattern: RegExp
  handler: (
    request: CloudFrontRequest,
    customerVariables: CustomerVariables,
    routeMatchArray: RegExpMatchArray | undefined
  ) => Promise<CloudFrontResultResponse>
}

async function createRoutes(customerVariables: CustomerVariables): Promise<Route[]> {
  const routes: Route[] = []
  const downloadScriptRoute: Route = {
    pathPattern: createRoute(await getAgentUri(customerVariables)),
    handler: handleDownloadScript,
  }
  const ingressAPIRoute: Route = {
    pathPattern: createRoute(await getResultUri(customerVariables)),
    handler: handleIngressAPI,
  }
  const statusRoute: Route = {
    pathPattern: createRoute(getStatusUri()),
    handler: (request, env) => handleStatusPage(request, env),
  }
  routes.push(downloadScriptRoute)
  routes.push(ingressAPIRoute)
  routes.push(statusRoute)

  return routes
}

async function handleDownloadScript(
  request: CloudFrontRequest,
  customerVariables: CustomerVariables
): Promise<CloudFrontResultResponse> {
  const fpCdnUrl = await getFpCdnUrl(customerVariables)
  if (!fpCdnUrl) {
    return new Promise((resolve) =>
      resolve({
        status: '500',
      })
    )
  }

  return downloadAgent({
    querystring: request.querystring,
    fpCdnUrl,
    apiKey: getApiKey(request),
    version: getVersion(request),
    loaderVersion: getLoaderVersion(request),
    method: request.method,
    headers: filterRequestHeaders(request, true),
  })
}

async function handleIngressAPI(
  request: CloudFrontRequest,
  customerVariables: CustomerVariables,
  resultPathMatches: RegExpMatchArray | undefined
): Promise<CloudFrontResultResponse> {
  const fpIngressBaseHost = await getFpIngressBaseHost(customerVariables)
  if (!fpIngressBaseHost) {
    return new Promise((resolve) =>
      resolve({
        status: '500',
      })
    )
  }

  let suffix = ''
  if (resultPathMatches && resultPathMatches.length >= 1) {
    suffix = resultPathMatches[1] ?? ''
  }
  if (suffix.length > 0 && !suffix.startsWith('/')) {
    suffix = '/' + suffix
  }
  const isIngressCall = suffix.length === 0

  return handleResult({
    fpIngressBaseHost,
    region: getRegion(request),
    querystring: request.querystring,
    method: request.method,
    headers: await prepareHeadersForIngressAPI(request, customerVariables, isIngressCall),
    body: request.body?.data || '',
    suffix,
  }).then(async (originalResponse) => {
    const decryptionKey = await customerVariables.getVariable(CustomerVariableType.DecryptionKey)
    Promise.resolve().then(() => {
      processOpenClientResponse(
        base64ToArrayBuffer(originalResponse.body as string),
        originalResponse,
        decryptionKey.value as string
      ).catch((e) =>
        console.error(
          'Failed to parse identification response. Make sure Open Client Response is enabled for your Fingerprint workspace: ',
          e
        )
      )
    })

    return originalResponse
  })
}

function handleStatusPage(
  _: CloudFrontRequest,
  customerVariables: CustomerVariables
): Promise<CloudFrontResultResponse> {
  return handleStatus(customerVariables, generateRandom())
}

export const handler = async (event: CloudFrontRequestEvent): Promise<CloudFrontResultResponse> => {
  const request = event.Records[0].cf.request
  setLogLevel(request)

  const customerVariables = new CustomerVariables([
    new SecretsManagerVariables(request),
    new HeaderCustomerVariables(request),
  ])

  console.debug('Handling request', request)

  const routes = await createRoutes(customerVariables)
  return handleRequestWithRoutes(request, customerVariables, routes)
}

export function handleRequestWithRoutes(
  request: CloudFrontRequest,
  customerVariables: CustomerVariables,
  routes: Route[]
): Promise<CloudFrontResultResponse> {
  for (const route of routes) {
    const matches = request.uri.match(route.pathPattern)
    if (matches) {
      return route.handler(request, customerVariables, matches)
    }
  }

  return handleNoMatch()
}

function handleNoMatch(): Promise<CloudFrontResultResponse> {
  return new Promise((resolve) =>
    resolve({
      status: '404',
    })
  )
}
