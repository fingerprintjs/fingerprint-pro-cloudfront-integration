import { CloudFrontRequest } from 'aws-lambda'
import { Region } from '../model'

export const getApiKey = (request: CloudFrontRequest): string | undefined => getQueryParameter(request, 'apiKey')

export const getVersion = (request: CloudFrontRequest): string => {
  const version = getQueryParameter(request, 'version')
  return version === undefined ? '3' : version
}

export const getLoaderVersion = (request: CloudFrontRequest): string | undefined =>
  getQueryParameter(request, 'loaderVersion')

export const getRegion = (request: CloudFrontRequest): Region => {
  const value = getQueryParameter(request, 'region')
  if (!value || !(value in Region)) {
    return Region.us
  }

  return value as Region
}

function getQueryParameter(request: CloudFrontRequest, key: string): string | undefined {
  const params = request.querystring.split('&')

  console.debug(`Attempting to extract ${key} from ${params}. Query string: ${request.querystring}`)

  for (let i = 0; i < params.length; i++) {
    const kv = params[i].split('=')
    if (kv[0] === key) {
      console.debug(`Found ${key} in ${params}: ${kv[1]}`)

      return kv[1]
    }
  }
  return undefined
}
