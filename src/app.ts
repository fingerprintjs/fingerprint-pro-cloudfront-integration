import { Context, CloudFrontRequestEvent, CloudFrontRequest, CloudFrontResultResponse } from 'aws-lambda'

import { OutgoingHttpHeaders } from 'http'

import { downloadAgent, handleResult } from './handlers'
import { filterHeaders } from './headers'


export const handler = async (event: CloudFrontRequestEvent, context: Context): Promise<CloudFrontResultResponse> => {
  console.info(`Config: ${JSON.stringify(event.Records[0].cf.config, null, 2)}`)
  console.info(`Request: ${JSON.stringify(event.Records[0].cf.request, null, 2)}`)
  console.info(`Context: ${JSON.stringify(context, null, 2)}`)

  const request = event.Records[0].cf.request

  console.info(`agent download = ${getAgentDownloadPath(request)}`)
  console.info(`behavior = ${getBehaviorPath(request)}`)
  console.info(`result path = ${getResultPath(request)}`)
  console.info(`pre shared secret = ${getPreSharedSecret(request)}`)

  const agentUri = `/${getBehaviorPath(request)}/${getAgentDownloadPath(request)}`
  const getResultUri = `/${getBehaviorPath(request)}/${getResultPath(request)}`

  console.info(`handle ${request.uri}`)
  if (request.uri === agentUri) {
    const endpoint = `/v3/${getApiKey(request)}/loader_v${getLoaderVersion(request)}.js`
    return downloadAgent({
      host: process.env.FPCDN!!,
      path: endpoint,
      method: request.method,
      headers: filterHeaders(request),
      domain: getHost(request),
    })
  } else if (request.uri === getResultUri) {
    const endpoint = `${getIngressAPIEndpoint(getRegion(request))}?${request.querystring}`
    return handleResult({
      apiEndpoint: endpoint,
      method: request.method,
      headers: prepareHeadersForIngressAPI(request),
      body: request.body?.data || '',
      domain: getHost(request),
    })
  } else {
    return {
      status: '200',
      body: JSON.stringify({
        message: 'hello world',
      }),
    }
  }
}

const getAgentDownloadPath = (request: CloudFrontRequest) => getCustomHeader(request, 'fpjs_agent_download_path')

const getBehaviorPath = (request: CloudFrontRequest) => getCustomHeader(request, 'fpjs_behavior_path')

const getResultPath = (request: CloudFrontRequest) => getCustomHeader(request, 'fpjs_get_result_path')

const getPreSharedSecret = (request: CloudFrontRequest) => getCustomHeader(request, 'fpjs_pre_shared_secret')

function getCustomHeader(request: CloudFrontRequest, headerName: string): string | undefined {
  const headers = request.origin?.custom?.customHeaders
  if (headers === undefined) {
    return undefined
  }
  return headers[headerName][0].value
}

function getHost(request: CloudFrontRequest): string {
  return request.headers['host'][0].value
}

function prepareHeadersForIngressAPI(request: CloudFrontRequest): OutgoingHttpHeaders {
  const headers = filterHeaders(request)

  headers['fpjs-client-ip'] = request.clientIp
  headers['fpjs-proxy-identification'] = getPreSharedSecret(request) || 'secret-is-not-defined'

  return headers
}

const getApiKey = (request: CloudFrontRequest) => getQueryParameter(request, 'apiKey')

const getLoaderVersion = (request: CloudFrontRequest) => getQueryParameter(request, 'loaderVersion')

const getRegion = (request: CloudFrontRequest) => {
  const value = getQueryParameter(request, 'region')
  return value === undefined ? 'us' : value
}

function getQueryParameter(request: CloudFrontRequest, key: string): string | undefined {
  const params = request.querystring.split('&')
  for (let i = 0; i < params.length; i++) {
    const kv = params[i].split('=')
    if (kv[0] === key) {
      return kv[1]
    }
  }
  return undefined
}

function getIngressAPIEndpoint(region: string): string {
  const prefix = region === 'us' ? '' : `${region}.`
  return `https://${prefix}${process.env.INGRESS_API}`
}
