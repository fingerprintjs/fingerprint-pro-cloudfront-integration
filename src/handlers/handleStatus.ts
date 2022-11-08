import { CloudFrontResultResponse } from 'aws-lambda'

export function handleStatus(): Promise<CloudFrontResultResponse> {
  return new Promise((resolve) => {
    //todo add content (version, internal settings verification)
    const body = {
      version: '__lambda_func_version__',
    }
    resolve({
      status: '200',
      body: JSON.stringify(body),
    })
  })
}
