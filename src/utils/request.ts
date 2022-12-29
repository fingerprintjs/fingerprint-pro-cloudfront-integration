import { CloudFrontRequest } from 'aws-lambda'

export const getApiKey = (request: CloudFrontRequest) => getQueryParameter(request, 'apiKey')

export const getVersion = (request: CloudFrontRequest) => {
  const version = getQueryParameter(request, 'version')
  return version === undefined ? '3' : version
}

export const getLoaderVersion = (request: CloudFrontRequest) => getQueryParameter(request, 'loaderVersion')

export const getRegion = (request: CloudFrontRequest) => {
  const value = getQueryParameter(request, 'region')
  return value === undefined ? 'us' : value
}

function getQueryParameter(request: CloudFrontRequest, key: string): string | undefined {
  const params = request.querystring.split('&')

  console.info(`Attempting to extract ${key} from ${params}. Query string: ${request.querystring}`)

  for (let i = 0; i < params.length; i++) {
    const kv = params[i].split('=')
    if (kv[0] === key) {
      console.info(`Found ${key} in ${params}: ${kv[1]}`)

      return kv[1]
    }
  }
  return undefined
}
