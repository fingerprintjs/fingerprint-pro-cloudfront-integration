import { filterRequestHeaders, updateResponseHeaders, prepareHeadersForIngressAPI, getHost } from './headers'
import { getApiKey, getLoaderVersion, getRegion } from './request'
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
  getRegion,
  addTrafficMonitoringSearchParamsForVisitorIdRequest,
  addTrafficMonitoringSearchParamsForProCDN,
}
