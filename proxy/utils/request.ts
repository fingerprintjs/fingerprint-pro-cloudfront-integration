import { CloudFrontRequest } from 'aws-lambda'
import { Logger } from '../logger'
import { Region } from '../model'

export const getApiKey = (request: CloudFrontRequest, logger: Logger) => getQueryParameter(request, 'apiKey', logger)

export const getVersion = (request: CloudFrontRequest, logger: Logger) => {
  const version = getQueryParameter(request, 'version', logger)
  return version === undefined ? '3' : version
}

export const getLoaderVersion = (request: CloudFrontRequest, logger: Logger) =>
  getQueryParameter(request, 'loaderVersion', logger)

export const getRegion = (request: CloudFrontRequest, logger: Logger) => {
  const value = getQueryParameter(request, 'region', logger)
  if (!value || !(value in Region)) {
    return Region.us
  }

  return value as Region
}

function getQueryParameter(request: CloudFrontRequest, key: string, logger: Logger): string | undefined {
  const params = request.querystring.split('&')

  logger.debug(`Attempting to extract ${key} from ${params}. Query string: ${request.querystring}`)

  for (let i = 0; i < params.length; i++) {
    const kv = params[i].split('=')
    if (kv[0] === key) {
      logger.debug(`Found ${key} in ${params}: ${kv[1]}`)

      return kv[1]
    }
  }
  return undefined
}
