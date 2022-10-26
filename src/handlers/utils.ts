import { IncomingHttpHeaders } from 'http'
import { CloudFrontHeaders } from 'aws-lambda'
import { ALLOWED_RESPONSE_HEADERS } from '../headers'
import { updateCookie } from '../cookie'

export function updateResponseHeaders(headers: IncomingHttpHeaders, domain: string): CloudFrontHeaders {
  const resultHeaders: CloudFrontHeaders = {}

  for (const name of ALLOWED_RESPONSE_HEADERS) {
    const headerValue = headers[name]

    if (headerValue !== undefined) {
      let value = Array.isArray(headerValue) ? headerValue.join('; ') : headerValue
      if (name === 'set-cookie') {
        value = updateCookie(value, domain)
      }

      resultHeaders[name] = [
        {
          key: name,
          value: value,
        },
      ]
    }
  }

  return resultHeaders
}
