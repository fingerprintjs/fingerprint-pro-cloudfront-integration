import {
  filterRequestHeaders,
  updateResponseHeaders,
  updateResponseHeadersForAgentDownload,
  prepareHeadersForIngressAPI,
  getHost,
} from './headers'
import { getApiKey, getLoaderVersion, getVersion, getRegion } from './request'
import {
  addTrafficMonitoringSearchParamsForVisitorIdRequest,
  addTrafficMonitoringSearchParamsForProCDN,
} from './traffic'
import { getAgentUri, getResultUri, getStatusUri } from './customer-variables/selectors'
import { removeTrailingSlashes } from './routing'

export {
  getAgentUri,
  getResultUri,
  getStatusUri,
  filterRequestHeaders,
  updateResponseHeaders,
  updateResponseHeadersForAgentDownload,
  prepareHeadersForIngressAPI,
  getHost,
  getApiKey,
  getLoaderVersion,
  getVersion,
  getRegion,
  addTrafficMonitoringSearchParamsForVisitorIdRequest,
  addTrafficMonitoringSearchParamsForProCDN,
  removeTrailingSlashes,
}
