import { AgentOptions } from '../model'
import { CloudFrontResultResponse } from 'aws-lambda'
import https from 'https'

import { updateResponseHeaders, addTrafficMonitoringSearchParamsForProCDN } from '../utils'

export function downloadAgent(options: AgentOptions): Promise<CloudFrontResultResponse> {
  return new Promise((resolve) => {
    const data: any[] = []

    const url = new URL('https://__FPCDN__')
    url.pathname = options.path
    addTrafficMonitoringSearchParamsForProCDN(url)
    const request = https.request(
      url,
      {
        method: options.method,
        headers: options.headers,
      },
      (response) => {
        let binary = false
        if (response.headers['content-encoding']) {
          binary = true
        }

        response.setEncoding(binary ? 'binary' : 'utf8')

        response.on('data', (chunk) => data.push(Buffer.from(chunk, 'binary')))

        response.on('end', () => {
          const body = Buffer.concat(data)
          resolve({
            status: response.statusCode ? response.statusCode.toString() : '500',
            statusDescription: response.statusMessage,
            headers: updateResponseHeaders(response.headers, options.domain),
            bodyEncoding: 'base64',
            body: body.toString('base64'),
          })
        })
      },
    )

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
