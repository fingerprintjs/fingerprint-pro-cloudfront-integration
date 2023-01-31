import { CloudFrontHeaders, CloudFrontRequest } from 'aws-lambda'
import { IncomingHttpHeaders, OutgoingHttpHeaders } from 'http'
import { adjustCookies, filterCookie } from './cookie'
import { updateCacheControlHeader } from './cache-control'
import { CustomerVariables } from './customer-variables/customer-variables'
import { getPreSharedSecret } from './customer-variables/selectors'

const BLACKLISTED_HEADERS = new Set([
  'connection',
  'expect',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
  'trailer',
  'upgrade',
  'x-accel-buffering',
  'x-accel-charset',
  'x-accel-limit-rate',
  'x-accel-redirect',
  'x-amzn-auth',
  'x-amzn-cf-billing',
  'x-amzn-cf-id',
  'x-amzn-cf-xff',
  'x-amzn-errortype',
  'x-amzn-fle-profile',
  'x-amzn-header-count',
  'x-amzn-header-order',
  'x-amzn-lambda-integration-tag',
  'x-amzn-requestid',
  'x-cache',
  'x-forwarded-proto',
  'x-real-ip',
])

const BLACKLISTED_HEADERS_PREFIXES = ['x-edge-', 'x-amz-cf-']

const READ_ONLY_RESPONSE_HEADERS = new Set([
  'accept-encoding',
  'content-length',
  'if-modified-since',
  'if-none-match',
  'if-range',
  'if-unmodified-since',
  'transfer-encoding',
  'via',
])

const READ_ONLY_REQUEST_HEADERS = new Set(['content-length', 'host', 'transfer-encoding', 'via'])

const COOKIE_HEADER_NAME = 'set-cookie'
const CACHE_CONTROL_HEADER_NAME = 'cache-control'

export async function prepareHeadersForIngressAPI(
  request: CloudFrontRequest,
  variables: CustomerVariables,
): Promise<OutgoingHttpHeaders> {
  const headers = filterRequestHeaders(request)

  headers['fpjs-proxy-client-ip'] = request.clientIp
  const preSharedSecret = await getPreSharedSecret(variables)
  if (preSharedSecret) {
    headers['fpjs-proxy-secret'] = preSharedSecret
  }

  return headers
}

export const getHost = (request: CloudFrontRequest) => request.headers['host'][0].value

export function filterRequestHeaders(request: CloudFrontRequest): OutgoingHttpHeaders {
  return Object.entries(request.headers).reduce((result: { [key: string]: string }, [name, value]) => {
    const headerName = name.toLowerCase()
    // Lambda@Edge function can't add read-only headers from a client request to Ingress API request
    if (isHeaderAllowedForRequest(headerName)) {
      let headerValue = value[0].value
      if (headerName === 'cookie') {
        headerValue = headerValue.split(/; */).join('; ')
        headerValue = filterCookie(headerValue, (key) => key === '_iidt')
      }

      result[headerName] = headerValue
    }
    return result
  }, {})
}

export function updateResponseHeaders(headers: IncomingHttpHeaders, domain: string): CloudFrontHeaders {
  const resultHeaders: CloudFrontHeaders = {}

  for (const [key, value] of Object.entries(headers)) {
    // Lambda@Edge function can't add read-only headers to response to CloudFront
    // So, such headers from IngressAPI response are filtered out before return the response to CloudFront
    if (!isHeaderAllowedForResponse(key)) {
      continue
    }

    if (key === COOKIE_HEADER_NAME && value !== undefined && Array.isArray(value)) {
      resultHeaders[COOKIE_HEADER_NAME] = [
        {
          key: COOKIE_HEADER_NAME,
          value: adjustCookies(value, domain),
        },
      ]
    } else if (key == CACHE_CONTROL_HEADER_NAME && typeof value === 'string') {
      resultHeaders[CACHE_CONTROL_HEADER_NAME] = [
        {
          key: CACHE_CONTROL_HEADER_NAME,
          value: updateCacheControlHeader(value),
        },
      ]
    } else if (value) {
      resultHeaders[key] = [
        {
          key: key,
          value: value.toString(),
        },
      ]
    }
  }

  return resultHeaders
}

function isHeaderAllowedForRequest(headerName: string) {
  if (READ_ONLY_REQUEST_HEADERS.has(headerName) || BLACKLISTED_HEADERS.has(headerName)) {
    return false
  }
  for (let i = 0; i < BLACKLISTED_HEADERS_PREFIXES.length; i++) {
    if (headerName.startsWith(BLACKLISTED_HEADERS_PREFIXES[i])) {
      return false
    }
  }
  return true
}

function isHeaderAllowedForResponse(headerName: string) {
  if (READ_ONLY_RESPONSE_HEADERS.has(headerName) || BLACKLISTED_HEADERS.has(headerName)) {
    return false
  }
  for (let i = 0; i < BLACKLISTED_HEADERS_PREFIXES.length; i++) {
    if (headerName.startsWith(BLACKLISTED_HEADERS_PREFIXES[i])) {
      return false
    }
  }
  return true
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
