import { ResultOptions } from '../model'
import { CloudFrontResultResponse } from 'aws-lambda'
import https from 'https'

import { updateResponseHeaders, addTrafficMonitoringSearchParamsForVisitorIdRequest } from '../utils'

export function handleResult(options: ResultOptions): Promise<CloudFrontResultResponse> {
  return new Promise((resolve) => {
    const data: any[] = []

    const url = new URL(getIngressAPIHost(options.region))
    options.querystring.split('&').forEach((it) => {
      const kv = it.split('=')
      url.searchParams.append(kv[0], kv[1])
    })
    addTrafficMonitoringSearchParamsForVisitorIdRequest(url)
    const request = https.request(
      url,
      {
        method: options.method,
        headers: options.headers,
      },
      (response) => {
        response.on('data', (chunk) => data.push(chunk))

        response.on('end', () => {
          const payload = Buffer.concat(data)
          resolve({
            status: response.statusCode ? response.statusCode.toString() : '500',
            statusDescription: response.statusMessage,
            headers: updateResponseHeaders(response.headers, options.domain),
            bodyEncoding: 'base64',
            body: payload.toString('base64'),
          })
        })
      },
    )

    request.write(Buffer.from(options.body, 'base64'))

    request.on('error', (e) => {
      console.error(`unable to handle result ${e}`)
      resolve({
        status: '500',
        statusDescription: 'Bad request',
        headers: {},
        bodyEncoding: 'text',
        body: generateErrorResponse(e),
      })
    })

    request.end()
  })
}

function generateErrorResponse(err: Error): string {
  const body = {
    v: '2',
    error: {
      code: 'Failed',
      message: `An error occured with Fingerprint Pro Lambda function. Reason ${err}`,
    },
    requestId: generateRequestId,
    products: {},
  }
  return JSON.stringify(body)
}

function generateRequestId(): string {
  const uniqueId = generateRequestUniqueId()
  const now = new Date().getTime()
  return `${now}.aws-${uniqueId}`
}

function generateRandomString(length: number): string {
  let result = ''
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length))
  }
  return result
}

function generateRequestUniqueId(): string {
  return generateRandomString(2)
}

function getIngressAPIHost(region: string): string {
  const prefix = region === 'us' ? '' : `${region}.`
  return `https://${prefix}__INGRESS_API__`
}
