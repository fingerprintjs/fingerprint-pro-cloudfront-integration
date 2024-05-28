import { ResultOptions } from '../model'
import { CloudFrontResultResponse } from 'aws-lambda'
import https from 'https'
import { Region } from '../model'

import { updateResponseHeaders, addTrafficMonitoringSearchParamsForVisitorIdRequest } from '../utils'

export function handleResult(options: ResultOptions): Promise<CloudFrontResultResponse> {
  return new Promise((resolve) => {
    console.debug('Handling result:', { options })

    const data: any[] = []

    const url = new URL(getIngressAPIHost(options.region, options.fpIngressBaseHost) + options.suffix)
    decodeURIComponent(options.querystring)
      .split('&')
      .filter((it) => it.includes('='))
      .forEach((it) => {
        const kv = it.split('=')
        if (kv[0] === 'region') {
          kv[1] = options.region
        }
        url.searchParams.append(kv[0], kv[1])
      })
    if (options.method === 'POST') {
      addTrafficMonitoringSearchParamsForVisitorIdRequest(url)
    }

    console.debug(`Performing request: ${url.toString()}`)

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

          console.debug('Response from Ingress API', {
            statusCode: response.statusCode,
            payload: payload.toString('utf-8'),
          })

          resolve({
            status: response.statusCode ? response.statusCode.toString() : '500',
            statusDescription: response.statusMessage,
            headers: updateResponseHeaders(response.headers),
            bodyEncoding: 'base64',
            body: payload.toString('base64'),
          })
        })
      }
    )

    request.write(Buffer.from(options.body, 'base64'))

    request.on('error', (error) => {
      console.error('unable to handle result', { error })
      resolve({
        status: '500',
        statusDescription: 'Bad request',
        headers: {},
        bodyEncoding: 'text',
        body: generateErrorResponse(error),
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
      message: `An error occurred with Fingerprint Pro Lambda function. Reason ${err}`,
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

function getIngressAPIHost(region: Region, baseHost: string): string {
  const prefix = region === Region.us ? '' : `${region}.`
  return `https://${prefix}${baseHost}`
}
