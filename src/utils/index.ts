import {
  getAgentUri,
  getResultUri,
  getStatusUri,
  filterRequestHeaders,
  updateResponseHeaders,
  prepareHeadersForIngressAPI,
  getHost,
} from './headers'
import { getApiKey, getLoaderVersion, getVersion, getRegion } from './request'
import {
  addTrafficMonitoringSearchParamsForVisitorIdRequest,
  addTrafficMonitoringSearchParamsForProCDN,
} from './traffic'
import { getAgentUri, getResultUri, getStatusUri } from './customer-variables/selectors'

export {
  getAgentUri,
  getResultUri,
  getStatusUri,
  filterRequestHeaders,
  updateResponseHeaders,
  prepareHeadersForIngressAPI,
  getHost,
  getApiKey,
  getLoaderVersion,
  getVersion,
  getRegion,
  addTrafficMonitoringSearchParamsForVisitorIdRequest,
  addTrafficMonitoringSearchParamsForProCDN,
}
