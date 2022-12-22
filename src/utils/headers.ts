import { CloudFrontHeaders, CloudFrontRequest } from 'aws-lambda'
import { IncomingHttpHeaders, OutgoingHttpHeaders } from 'http'
import { adjustCookies } from './cookie'
import { updateCacheControlHeader } from './cache-control'
import { CustomerVariables } from './customer-variables/customer-variables'
import { getPreSharedSecret } from './customer-variables/selectors'

const ALLOWED_RESPONSE_HEADERS = [
  'access-control-allow-credentials',
  'access-control-allow-origin',
  'access-control-expose-headers',
  'content-encoding',
  'content-type',
  'cross-origin-resource-policy',
  'etag',
  'vary',
]

const COOKIE_HEADER_NAME = 'set-cookie'
const CACHE_CONTROL_HEADER_NAME = 'cache-control'

const BLACKLISTED_REQUEST_HEADERS = ['content-length', 'host', 'transfer-encoding', 'via']

export async function prepareHeadersForIngressAPI(
  request: CloudFrontRequest,
  variables: CustomerVariables,
): Promise<OutgoingHttpHeaders> {
  const headers = filterRequestHeaders(request)

  headers['fpjs-client-ip'] = request.clientIp
  const preSharedSecret = await getPreSharedSecret(variables)
  if (preSharedSecret) {
    headers['fpjs-proxy-identification'] = preSharedSecret
  }

  return headers
}

export const getHost = (request: CloudFrontRequest) => request.headers['host'][0].value

export function filterRequestHeaders(request: CloudFrontRequest): OutgoingHttpHeaders {
  return Object.entries(request.headers).reduce((result: { [key: string]: string }, [name, value]) => {
    const headerName = name.toLowerCase()
    if (!BLACKLISTED_REQUEST_HEADERS.includes(headerName)) {
      let headerValue = value[0].value
      if (headerName === 'cookie') {
        headerValue = headerValue.split(/; */).join('; ')
      }

      result[headerName] = headerValue
    }
    return result
  }, {})
}

export function updateResponseHeaders(headers: IncomingHttpHeaders, domain: string): CloudFrontHeaders {
  const resultHeaders: CloudFrontHeaders = {}

  for (const name of ALLOWED_RESPONSE_HEADERS) {
    const headerValue = headers[name]
    if (headerValue) {
      resultHeaders[name] = [
        {
          key: name,
          value: headerValue.toString(),
        }
      ]
    }
  }

  if (headers[COOKIE_HEADER_NAME] !== undefined) {
    resultHeaders[COOKIE_HEADER_NAME] = [
      {
        key: COOKIE_HEADER_NAME,
        value: adjustCookies(headers[COOKIE_HEADER_NAME], domain)
      }
    ]
  }

  if (headers[CACHE_CONTROL_HEADER_NAME] !== undefined) {
    resultHeaders[CACHE_CONTROL_HEADER_NAME] = [
      {
        key: CACHE_CONTROL_HEADER_NAME,
        value: updateCacheControlHeader(headers[CACHE_CONTROL_HEADER_NAME])
      }
    ]
  }

  return resultHeaders
}

export function getOriginForHeaders({ origin }: CloudFrontRequest) {
  if (origin?.s3) {
    return origin.s3
  }

  return origin?.custom
}

export function getHeaderValue(request: CloudFrontRequest, name: string) {
  const origin = getOriginForHeaders(request)
  const headers = origin?.customHeaders

  if (!headers?.[name]) {
    return null
  }
  return headers[name][0].value
}
