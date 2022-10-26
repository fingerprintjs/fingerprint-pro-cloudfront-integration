import { ResultOptions } from '../model'
import { CloudFrontResultResponse } from 'aws-lambda'
import https from 'https'

import { updateResponseHeaders } from './utils'

export function handleResult(options: ResultOptions): Promise<CloudFrontResultResponse> {
  return new Promise((resolve) => {
    const data: any[] = []

    const request = https.request(
      options.apiEndpoint,
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
      console.info(`error ${JSON.stringify(e)}`)
      resolve({
        status: '500',
        statusDescription: 'Bad request',
        headers: {},
        bodyEncoding: 'text',
        body: 'error',
      })
    })

    request.end()
  })
}
