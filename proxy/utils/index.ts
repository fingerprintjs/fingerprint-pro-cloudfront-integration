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
import {
  removeTrailingSlashesAndMultiSlashes,
  addTrailingWildcard,
  replaceDot,
  createRoute,
  addPathnameMatchBeforeRoute,
  addEndingTrailingSlashToRoute,
} from './routing'
import { setLogLevel } from './log'
import { generateRandom } from './string'
import { base64ToArrayBuffer } from './base64ToArrayBuffer'

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
  removeTrailingSlashesAndMultiSlashes,
  addTrailingWildcard,
  replaceDot,
  createRoute,
  addPathnameMatchBeforeRoute,
  addEndingTrailingSlashToRoute,
  setLogLevel,
  generateRandom,
  base64ToArrayBuffer,
}
