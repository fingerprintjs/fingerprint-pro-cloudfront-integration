import { CloudFrontRequest } from 'aws-lambda'

import { OutgoingHttpHeaders } from 'http'

export const ALLOWED_RESPONSE_HEADERS = [
  'access-control-allow-credentials',
  'access-control-allow-origin',
  'access-control-expose-headers',
  'cache-control',
  'content-encoding',
  'content-type',
  'cross-origin-resource-policy',
  'etag',
  'set-cookie',
  'vary',
]

export const BLACKLISTED_REQUEST_HEADERS = ['content-length', 'host', 'transfer-encoding', 'via']

export function filterHeaders(request: CloudFrontRequest): OutgoingHttpHeaders {
  return Object.entries(request.headers).reduce((result: { [key: string]: string }, [name, value]) => {
    const headerName = name.toLowerCase()
    if (!BLACKLISTED_REQUEST_HEADERS.includes(headerName)) {
      let headerValue = value[0].value
      if (headerName === 'cookie') {
        headerValue = headerValue.split(/; */).filter(isAllowedCookie).join('; ')
      }

      result[headerName] = headerValue
    }
    return result
  }, {})
}

function isAllowedCookie(cookie: string) {
  cookie
  return true
}
