/**
 * FingerprintJS Pro CloudFront Lambda function v1.0.3 - Copyright (c) FingerprintJS, Inc, 2023 (https://fingerprint.com)
 * Licensed under the MIT (http://www.opensource.org/licenses/mit-license.php) license.
 */

'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var https = require('https');
var require$$0$2 = require('util');
var require$$0$1 = require('os');
var require$$0$3 = require('stream');
var require$$0$4 = require('buffer');
var require$$0$5 = require('events');
var require$$0$6 = require('fs');
var require$$1$1 = require('path');
var require$$3 = require('zlib');
var require$$1 = require('tty');
var require$$0$7 = require('http');
var clientSecretsManager = require('@aws-sdk/client-secrets-manager');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var https__default = /*#__PURE__*/_interopDefaultLegacy(https);
var require$$0__default$1 = /*#__PURE__*/_interopDefaultLegacy(require$$0$2);
var require$$0__default = /*#__PURE__*/_interopDefaultLegacy(require$$0$1);
var require$$0__default$2 = /*#__PURE__*/_interopDefaultLegacy(require$$0$3);
var require$$0__default$3 = /*#__PURE__*/_interopDefaultLegacy(require$$0$4);
var require$$0__default$4 = /*#__PURE__*/_interopDefaultLegacy(require$$0$5);
var require$$0__default$5 = /*#__PURE__*/_interopDefaultLegacy(require$$0$6);
var require$$1__default$1 = /*#__PURE__*/_interopDefaultLegacy(require$$1$1);
var require$$3__default = /*#__PURE__*/_interopDefaultLegacy(require$$3);
var require$$1__default = /*#__PURE__*/_interopDefaultLegacy(require$$1);
var require$$0__default$6 = /*#__PURE__*/_interopDefaultLegacy(require$$0$7);

function adjustCookies(cookies, domainName) {
    const newCookies = [];
    cookies.forEach((it) => {
        const parts = it.split(';');
        parts.map((v) => {
            const s = v.trim();
            const ind = s.indexOf('=');
            if (ind !== -1) {
                const key = s.substring(0, ind);
                let value = s.substring(ind + 1);
                if (key.toLowerCase() === 'domain') {
                    value = domainName;
                }
                newCookies.push(`${key}=${value}`);
            }
            else {
                newCookies.push(s);
            }
        });
    });
    return newCookies.join('; ').trim();
}
function filterCookie(cookie, filterPredicate) {
    const newCookie = [];
    const parts = cookie.split(';');
    parts.forEach((it) => {
        const s = it.trim();
        const ind = s.indexOf('=');
        if (ind !== -1) {
            const key = s.substring(0, ind);
            const value = s.substring(ind + 1);
            if (filterPredicate(key)) {
                newCookie.push(`${key}=${value}`);
            }
        }
    });
    return newCookie.join('; ').trim();
}

const CACHE_MAX_AGE = 3600;
const SHARED_CACHE_MAX_AGE = 60;
function updateCacheControlHeader(headerValue) {
    headerValue = updateCacheControlAge(headerValue, 'max-age', CACHE_MAX_AGE);
    headerValue = updateCacheControlAge(headerValue, 's-maxage', SHARED_CACHE_MAX_AGE);
    return headerValue;
}
function updateCacheControlAge(headerValue, type, cacheMaxAge) {
    const cacheControlDirectives = headerValue.split(', ');
    const maxAgeIndex = cacheControlDirectives.findIndex((directive) => directive.split('=')[0].trim().toLowerCase() === type);
    if (maxAgeIndex === -1) {
        cacheControlDirectives.push(`${type}=${cacheMaxAge}`);
    }
    else {
        const oldMaxAge = Number(cacheControlDirectives[maxAgeIndex].split('=')[1]);
        const newMaxAge = Math.min(cacheMaxAge, oldMaxAge);
        cacheControlDirectives[maxAgeIndex] = `${type}=${newMaxAge}`;
    }
    return cacheControlDirectives.join(', ');
}

var CustomerVariableType;
(function (CustomerVariableType) {
    CustomerVariableType["BehaviourPath"] = "fpjs_behavior_path";
    CustomerVariableType["GetResultPath"] = "fpjs_get_result_path";
    CustomerVariableType["PreSharedSecret"] = "fpjs_pre_shared_secret";
    CustomerVariableType["AgentDownloadPath"] = "fpjs_agent_download_path";
})(CustomerVariableType || (CustomerVariableType = {}));

const extractVariable = (result) => result.value;
const getAgentUri = async (variables) => `/${await getBehaviorPath(variables)}/${await getAgentDownloadPath(variables)}`;
const getResultUri = async (variables) => `/${await getBehaviorPath(variables)}/${await getResultPath(variables)}`;
const getStatusUri = async (variables) => `/${await getBehaviorPath(variables)}/status`;
const getAgentDownloadPath = async (variables) => variables.getVariable(CustomerVariableType.AgentDownloadPath).then(extractVariable);
const getBehaviorPath = async (variables) => variables.getVariable(CustomerVariableType.BehaviourPath).then(extractVariable);
const getResultPath = async (variables) => variables.getVariable(CustomerVariableType.GetResultPath).then(extractVariable);
const getPreSharedSecret = async (variables) => variables.getVariable(CustomerVariableType.PreSharedSecret).then(extractVariable);

const BLACKLISTED_HEADERS = new Set([
    'connection',
    'expect',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'proxy-connection',
    'trailer',
    'upgrade',
    'x-accel-buffering',
    'x-accel-charset',
    'x-accel-limit-rate',
    'x-accel-redirect',
    'x-amzn-auth',
    'x-amzn-cf-billing',
    'x-amzn-cf-id',
    'x-amzn-cf-xff',
    'x-amzn-errortype',
    'x-amzn-fle-profile',
    'x-amzn-header-count',
    'x-amzn-header-order',
    'x-amzn-lambda-integration-tag',
    'x-amzn-requestid',
    'x-cache',
    'x-forwarded-proto',
    'x-real-ip',
    'strict-transport-security',
]);
const BLACKLISTED_HEADERS_PREFIXES = ['x-edge-', 'x-amz-cf-'];
const READ_ONLY_RESPONSE_HEADERS = new Set([
    'accept-encoding',
    'content-length',
    'if-modified-since',
    'if-none-match',
    'if-range',
    'if-unmodified-since',
    'transfer-encoding',
    'via',
]);
const READ_ONLY_REQUEST_HEADERS = new Set(['content-length', 'host', 'transfer-encoding', 'via']);
const COOKIE_HEADER_NAME = 'set-cookie';
const CACHE_CONTROL_HEADER_NAME = 'cache-control';
async function prepareHeadersForIngressAPI(request, variables) {
    const headers = filterRequestHeaders(request);
    headers['fpjs-proxy-client-ip'] = request.clientIp;
    const preSharedSecret = await getPreSharedSecret(variables);
    if (preSharedSecret) {
        headers['fpjs-proxy-secret'] = preSharedSecret;
    }
    return headers;
}
const getHost = (request) => request.headers['host'][0].value;
function filterRequestHeaders(request) {
    return Object.entries(request.headers).reduce((result, [name, value]) => {
        const headerName = name.toLowerCase();
        // Lambda@Edge function can't add read-only headers from a client request to Ingress API request
        if (isHeaderAllowedForRequest(headerName)) {
            let headerValue = value[0].value;
            if (headerName === 'cookie') {
                headerValue = headerValue.split(/; */).join('; ');
                headerValue = filterCookie(headerValue, (key) => key === '_iidt');
            }
            result[headerName] = headerValue;
        }
        return result;
    }, {});
}
function updateResponseHeaders(headers, domain) {
    const resultHeaders = {};
    for (const [key, value] of Object.entries(headers)) {
        // Lambda@Edge function can't add read-only headers to response to CloudFront
        // So, such headers from IngressAPI response are filtered out before return the response to CloudFront
        if (!isHeaderAllowedForResponse(key)) {
            continue;
        }
        if (key === COOKIE_HEADER_NAME && value !== undefined && Array.isArray(value)) {
            resultHeaders[COOKIE_HEADER_NAME] = [
                {
                    key: COOKIE_HEADER_NAME,
                    value: adjustCookies(value, domain),
                },
            ];
        }
        else if (key == CACHE_CONTROL_HEADER_NAME && typeof value === 'string') {
            resultHeaders[CACHE_CONTROL_HEADER_NAME] = [
                {
                    key: CACHE_CONTROL_HEADER_NAME,
                    value: updateCacheControlHeader(value),
                },
            ];
        }
        else if (value) {
            resultHeaders[key] = [
                {
                    key: key,
                    value: value.toString(),
                },
            ];
        }
    }
    return resultHeaders;
}
function isHeaderAllowedForRequest(headerName) {
    if (READ_ONLY_REQUEST_HEADERS.has(headerName) || BLACKLISTED_HEADERS.has(headerName)) {
        return false;
    }
    for (let i = 0; i < BLACKLISTED_HEADERS_PREFIXES.length; i++) {
        if (headerName.startsWith(BLACKLISTED_HEADERS_PREFIXES[i])) {
            return false;
        }
    }
    return true;
}
function isHeaderAllowedForResponse(headerName) {
    if (READ_ONLY_RESPONSE_HEADERS.has(headerName) || BLACKLISTED_HEADERS.has(headerName)) {
        return false;
    }
    for (let i = 0; i < BLACKLISTED_HEADERS_PREFIXES.length; i++) {
        if (headerName.startsWith(BLACKLISTED_HEADERS_PREFIXES[i])) {
            return false;
        }
    }
    return true;
}
function getOriginForHeaders({ origin }) {
    if (origin?.s3) {
        return origin.s3;
    }
    return origin?.custom;
}
function getHeaderValue(request, name) {
    const origin = getOriginForHeaders(request);
    const headers = origin?.customHeaders;
    if (!headers?.[name]) {
        return null;
    }
    return headers[name][0].value;
}

const getApiKey = (request, logger) => getQueryParameter(request, 'apiKey', logger);
const getVersion = (request, logger) => {
    const version = getQueryParameter(request, 'version', logger);
    return version === undefined ? '3' : version;
};
const getLoaderVersion = (request, logger) => getQueryParameter(request, 'loaderVersion', logger);
const getRegion = (request, logger) => {
    const value = getQueryParameter(request, 'region', logger);
    return value === undefined ? 'us' : value;
};
function getQueryParameter(request, key, logger) {
    const params = request.querystring.split('&');
    logger.debug(`Attempting to extract ${key} from ${params}. Query string: ${request.querystring}`);
    for (let i = 0; i < params.length; i++) {
        const kv = params[i].split('=');
        if (kv[0] === key) {
            logger.debug(`Found ${key} in ${params}: ${kv[1]}`);
            return kv[1];
        }
    }
    return undefined;
}

const LAMBDA_FUNC_VERSION = '1.0.3';
const PARAM_NAME = 'ii';
function addTrafficMonitoringSearchParamsForProCDN(url) {
    url.searchParams.append(PARAM_NAME, getTrafficMonitoringValue('procdn'));
}
function addTrafficMonitoringSearchParamsForVisitorIdRequest(url) {
    url.searchParams.append(PARAM_NAME, getTrafficMonitoringValue('ingress'));
}
function getTrafficMonitoringValue(type) {
    return `fingerprintjs-pro-cloudfront/${LAMBDA_FUNC_VERSION}/${type}`;
}

function removeTrailingSlashes(str) {
    return str.replace(/\/+$/, '');
}

function downloadAgent(options) {
    return new Promise((resolve) => {
        const data = [];
        const url = new URL('https://procdn.fpjs.sh');
        url.pathname = getEndpoint(options.apiKey, options.version, options.loaderVersion);
        addTrafficMonitoringSearchParamsForProCDN(url);
        options.logger.debug('Downloading agent from', url.toString());
        const request = https__default["default"].request(url, {
            method: options.method,
            headers: options.headers,
        }, (response) => {
            let binary = false;
            if (response.headers['content-encoding']) {
                binary = true;
            }
            response.setEncoding(binary ? 'binary' : 'utf8');
            response.on('data', (chunk) => data.push(Buffer.from(chunk, 'binary')));
            response.on('end', () => {
                const body = Buffer.concat(data);
                resolve({
                    status: response.statusCode ? response.statusCode.toString() : '500',
                    statusDescription: response.statusMessage,
                    headers: updateResponseHeaders(response.headers, options.domain),
                    bodyEncoding: 'base64',
                    body: body.toString('base64'),
                });
            });
        });
        request.on('error', (error) => {
            options.logger.error('unable to download agent', { error });
            resolve({
                status: '500',
                statusDescription: 'Bad request',
                headers: {},
                bodyEncoding: 'text',
                body: 'error',
            });
        });
        request.end();
    });
}
function getEndpoint(apiKey, version, loaderVersion) {
    const lv = loaderVersion !== undefined && loaderVersion !== '' ? `/loader_v${loaderVersion}.js` : '';
    return `/v${version}/${apiKey}${lv}`;
}

function handleResult(options) {
    return new Promise((resolve) => {
        options.logger.debug('Handling result:', options);
        const data = [];
        const url = new URL(getIngressAPIHost(options.region));
        decodeURIComponent(options.querystring)
            .split('&')
            .forEach((it) => {
            const kv = it.split('=');
            url.searchParams.append(kv[0], kv[1]);
        });
        addTrafficMonitoringSearchParamsForVisitorIdRequest(url);
        options.logger.debug('Performing request', url.toString());
        const request = https__default["default"].request(url, {
            method: options.method,
            headers: options.headers,
        }, (response) => {
            response.on('data', (chunk) => data.push(chunk));
            response.on('end', () => {
                const payload = Buffer.concat(data);
                options.logger.debug('Response from Ingress API', response.statusCode, payload.toString('utf-8'));
                resolve({
                    status: response.statusCode ? response.statusCode.toString() : '500',
                    statusDescription: response.statusMessage,
                    headers: updateResponseHeaders(response.headers, options.domain),
                    bodyEncoding: 'base64',
                    body: payload.toString('base64'),
                });
            });
        });
        request.write(Buffer.from(options.body, 'base64'));
        request.on('error', (error) => {
            options.logger.error('unable to handle result', { error });
            resolve({
                status: '500',
                statusDescription: 'Bad request',
                headers: {},
                bodyEncoding: 'text',
                body: generateErrorResponse(error),
            });
        });
        request.end();
    });
}
function generateErrorResponse(err) {
    const body = {
        v: '2',
        error: {
            code: 'Failed',
            message: `An error occured with Fingerprint Pro Lambda function. Reason ${err}`,
        },
        requestId: generateRequestId,
        products: {},
    };
    return JSON.stringify(body);
}
function generateRequestId() {
    const uniqueId = generateRequestUniqueId();
    const now = new Date().getTime();
    return `${now}.aws-${uniqueId}`;
}
function generateRandomString(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}
function generateRequestUniqueId() {
    return generateRandomString(2);
}
function getIngressAPIHost(region) {
    const prefix = region === 'us' ? '' : `${region}.`;
    return `https://${prefix}apiv2.fpjs.sh`;
}

const OBFUSCATED_VALUE = '********';
async function maybeObfuscateVariable(customerVariables, variable) {
    const result = await customerVariables.getVariable(variable);
    if (variable === CustomerVariableType.PreSharedSecret && result.value) {
        result.value = OBFUSCATED_VALUE;
    }
    return result;
}

async function getEnvInfo(customerVariables) {
    const infoArray = await Promise.all(Object.values(CustomerVariableType).map(async (variable) => {
        const value = await maybeObfuscateVariable(customerVariables, variable);
        return {
            envVarName: variable,
            value: value.value,
            isSet: Boolean(value.value),
            resolvedBy: value.resolvedBy,
        };
    }));
    return infoArray;
}
function renderEnvInfo(envInfo) {
    const isAlSet = envInfo.every((info) => info.isSet && info.resolvedBy);
    if (isAlSet) {
        return `
      <div>
        ✅ All environment variables are set
      </div>
    `;
    }
    const children = envInfo
        .filter((info) => !info.isSet || !info.resolvedBy)
        .map((info) => `
        <div class="env-info-item">
            ⚠️ <strong>${info.envVarName} </strong> is not defined${info.isSet ? ' and uses default value' : ''}
        </div>`);
    return `
    <div class="env-info">
      ${children.join('')}
    </div>
  `;
}
function renderHtml({ version, envInfo }) {
    return `
    <html lang="en-US">
      <head>
        <title>CloudFront integration status</title>
        <meta charset="utf-8">
        <style>
          body, .env-info {
            display: flex;
          }
          
          body {
            flex-direction: column;
            align-items: center;
          }
          
          body > * {
            margin-bottom: 1em;
          }
        </style>
      </head>
      <body>
        <h1>CloudFront integration status</h1>
        <div>
          Lambda function version: ${version}
        </div>
        ${renderEnvInfo(envInfo)}
          <span>
            Please reach out our support via <a href="mailto:support@fingerprint.com">support@fingerprint.com</a> if you have any issues
          </span>
      </body>
    </html>
  `;
}
async function getStatusInfo(customerVariables) {
    return {
        version: '1.0.3',
        envInfo: await getEnvInfo(customerVariables),
    };
}
async function handleStatus(customerVariables) {
    const body = await getStatusInfo(customerVariables);
    return {
        status: '200',
        body: renderHtml(body).trim(),
        headers: {
            'content-type': [{ key: 'Content-Type', value: 'text/html' }],
        },
    };
}

var domainSuffixListReversed = [
	{
		suffix: "ac",
		reversed: "ca"
	},
	{
		suffix: "com.ac",
		reversed: "ca.moc"
	},
	{
		suffix: "edu.ac",
		reversed: "ca.ude"
	},
	{
		suffix: "gov.ac",
		reversed: "ca.vog"
	},
	{
		suffix: "net.ac",
		reversed: "ca.ten"
	},
	{
		suffix: "mil.ac",
		reversed: "ca.lim"
	},
	{
		suffix: "org.ac",
		reversed: "ca.gro"
	},
	{
		suffix: "ad",
		reversed: "da"
	},
	{
		suffix: "nom.ad",
		reversed: "da.mon"
	},
	{
		suffix: "ae",
		reversed: "ea"
	},
	{
		suffix: "co.ae",
		reversed: "ea.oc"
	},
	{
		suffix: "net.ae",
		reversed: "ea.ten"
	},
	{
		suffix: "org.ae",
		reversed: "ea.gro"
	},
	{
		suffix: "sch.ae",
		reversed: "ea.hcs"
	},
	{
		suffix: "ac.ae",
		reversed: "ea.ca"
	},
	{
		suffix: "gov.ae",
		reversed: "ea.vog"
	},
	{
		suffix: "mil.ae",
		reversed: "ea.lim"
	},
	{
		suffix: "aero",
		reversed: "orea"
	},
	{
		suffix: "accident-investigation.aero",
		reversed: "orea.noitagitsevni-tnedicca"
	},
	{
		suffix: "accident-prevention.aero",
		reversed: "orea.noitneverp-tnedicca"
	},
	{
		suffix: "aerobatic.aero",
		reversed: "orea.citaborea"
	},
	{
		suffix: "aeroclub.aero",
		reversed: "orea.bulcorea"
	},
	{
		suffix: "aerodrome.aero",
		reversed: "orea.emordorea"
	},
	{
		suffix: "agents.aero",
		reversed: "orea.stnega"
	},
	{
		suffix: "aircraft.aero",
		reversed: "orea.tfarcria"
	},
	{
		suffix: "airline.aero",
		reversed: "orea.enilria"
	},
	{
		suffix: "airport.aero",
		reversed: "orea.tropria"
	},
	{
		suffix: "air-surveillance.aero",
		reversed: "orea.ecnallievrus-ria"
	},
	{
		suffix: "airtraffic.aero",
		reversed: "orea.ciffartria"
	},
	{
		suffix: "air-traffic-control.aero",
		reversed: "orea.lortnoc-ciffart-ria"
	},
	{
		suffix: "ambulance.aero",
		reversed: "orea.ecnalubma"
	},
	{
		suffix: "amusement.aero",
		reversed: "orea.tnemesuma"
	},
	{
		suffix: "association.aero",
		reversed: "orea.noitaicossa"
	},
	{
		suffix: "author.aero",
		reversed: "orea.rohtua"
	},
	{
		suffix: "ballooning.aero",
		reversed: "orea.gninoollab"
	},
	{
		suffix: "broker.aero",
		reversed: "orea.rekorb"
	},
	{
		suffix: "caa.aero",
		reversed: "orea.aac"
	},
	{
		suffix: "cargo.aero",
		reversed: "orea.ograc"
	},
	{
		suffix: "catering.aero",
		reversed: "orea.gniretac"
	},
	{
		suffix: "certification.aero",
		reversed: "orea.noitacifitrec"
	},
	{
		suffix: "championship.aero",
		reversed: "orea.pihsnoipmahc"
	},
	{
		suffix: "charter.aero",
		reversed: "orea.retrahc"
	},
	{
		suffix: "civilaviation.aero",
		reversed: "orea.noitaivalivic"
	},
	{
		suffix: "club.aero",
		reversed: "orea.bulc"
	},
	{
		suffix: "conference.aero",
		reversed: "orea.ecnerefnoc"
	},
	{
		suffix: "consultant.aero",
		reversed: "orea.tnatlusnoc"
	},
	{
		suffix: "consulting.aero",
		reversed: "orea.gnitlusnoc"
	},
	{
		suffix: "control.aero",
		reversed: "orea.lortnoc"
	},
	{
		suffix: "council.aero",
		reversed: "orea.licnuoc"
	},
	{
		suffix: "crew.aero",
		reversed: "orea.werc"
	},
	{
		suffix: "design.aero",
		reversed: "orea.ngised"
	},
	{
		suffix: "dgca.aero",
		reversed: "orea.acgd"
	},
	{
		suffix: "educator.aero",
		reversed: "orea.rotacude"
	},
	{
		suffix: "emergency.aero",
		reversed: "orea.ycnegreme"
	},
	{
		suffix: "engine.aero",
		reversed: "orea.enigne"
	},
	{
		suffix: "engineer.aero",
		reversed: "orea.reenigne"
	},
	{
		suffix: "entertainment.aero",
		reversed: "orea.tnemniatretne"
	},
	{
		suffix: "equipment.aero",
		reversed: "orea.tnempiuqe"
	},
	{
		suffix: "exchange.aero",
		reversed: "orea.egnahcxe"
	},
	{
		suffix: "express.aero",
		reversed: "orea.sserpxe"
	},
	{
		suffix: "federation.aero",
		reversed: "orea.noitaredef"
	},
	{
		suffix: "flight.aero",
		reversed: "orea.thgilf"
	},
	{
		suffix: "fuel.aero",
		reversed: "orea.leuf"
	},
	{
		suffix: "gliding.aero",
		reversed: "orea.gnidilg"
	},
	{
		suffix: "government.aero",
		reversed: "orea.tnemnrevog"
	},
	{
		suffix: "groundhandling.aero",
		reversed: "orea.gnildnahdnuorg"
	},
	{
		suffix: "group.aero",
		reversed: "orea.puorg"
	},
	{
		suffix: "hanggliding.aero",
		reversed: "orea.gnidilggnah"
	},
	{
		suffix: "homebuilt.aero",
		reversed: "orea.tliubemoh"
	},
	{
		suffix: "insurance.aero",
		reversed: "orea.ecnarusni"
	},
	{
		suffix: "journal.aero",
		reversed: "orea.lanruoj"
	},
	{
		suffix: "journalist.aero",
		reversed: "orea.tsilanruoj"
	},
	{
		suffix: "leasing.aero",
		reversed: "orea.gnisael"
	},
	{
		suffix: "logistics.aero",
		reversed: "orea.scitsigol"
	},
	{
		suffix: "magazine.aero",
		reversed: "orea.enizagam"
	},
	{
		suffix: "maintenance.aero",
		reversed: "orea.ecnanetniam"
	},
	{
		suffix: "media.aero",
		reversed: "orea.aidem"
	},
	{
		suffix: "microlight.aero",
		reversed: "orea.thgilorcim"
	},
	{
		suffix: "modelling.aero",
		reversed: "orea.gnilledom"
	},
	{
		suffix: "navigation.aero",
		reversed: "orea.noitagivan"
	},
	{
		suffix: "parachuting.aero",
		reversed: "orea.gnituhcarap"
	},
	{
		suffix: "paragliding.aero",
		reversed: "orea.gnidilgarap"
	},
	{
		suffix: "passenger-association.aero",
		reversed: "orea.noitaicossa-regnessap"
	},
	{
		suffix: "pilot.aero",
		reversed: "orea.tolip"
	},
	{
		suffix: "press.aero",
		reversed: "orea.sserp"
	},
	{
		suffix: "production.aero",
		reversed: "orea.noitcudorp"
	},
	{
		suffix: "recreation.aero",
		reversed: "orea.noitaercer"
	},
	{
		suffix: "repbody.aero",
		reversed: "orea.ydobper"
	},
	{
		suffix: "res.aero",
		reversed: "orea.ser"
	},
	{
		suffix: "research.aero",
		reversed: "orea.hcraeser"
	},
	{
		suffix: "rotorcraft.aero",
		reversed: "orea.tfarcrotor"
	},
	{
		suffix: "safety.aero",
		reversed: "orea.ytefas"
	},
	{
		suffix: "scientist.aero",
		reversed: "orea.tsitneics"
	},
	{
		suffix: "services.aero",
		reversed: "orea.secivres"
	},
	{
		suffix: "show.aero",
		reversed: "orea.wohs"
	},
	{
		suffix: "skydiving.aero",
		reversed: "orea.gnividyks"
	},
	{
		suffix: "software.aero",
		reversed: "orea.erawtfos"
	},
	{
		suffix: "student.aero",
		reversed: "orea.tneduts"
	},
	{
		suffix: "trader.aero",
		reversed: "orea.redart"
	},
	{
		suffix: "trading.aero",
		reversed: "orea.gnidart"
	},
	{
		suffix: "trainer.aero",
		reversed: "orea.reniart"
	},
	{
		suffix: "union.aero",
		reversed: "orea.noinu"
	},
	{
		suffix: "workinggroup.aero",
		reversed: "orea.puorggnikrow"
	},
	{
		suffix: "works.aero",
		reversed: "orea.skrow"
	},
	{
		suffix: "af",
		reversed: "fa"
	},
	{
		suffix: "gov.af",
		reversed: "fa.vog"
	},
	{
		suffix: "com.af",
		reversed: "fa.moc"
	},
	{
		suffix: "org.af",
		reversed: "fa.gro"
	},
	{
		suffix: "net.af",
		reversed: "fa.ten"
	},
	{
		suffix: "edu.af",
		reversed: "fa.ude"
	},
	{
		suffix: "ag",
		reversed: "ga"
	},
	{
		suffix: "com.ag",
		reversed: "ga.moc"
	},
	{
		suffix: "org.ag",
		reversed: "ga.gro"
	},
	{
		suffix: "net.ag",
		reversed: "ga.ten"
	},
	{
		suffix: "co.ag",
		reversed: "ga.oc"
	},
	{
		suffix: "nom.ag",
		reversed: "ga.mon"
	},
	{
		suffix: "ai",
		reversed: "ia"
	},
	{
		suffix: "off.ai",
		reversed: "ia.ffo"
	},
	{
		suffix: "com.ai",
		reversed: "ia.moc"
	},
	{
		suffix: "net.ai",
		reversed: "ia.ten"
	},
	{
		suffix: "org.ai",
		reversed: "ia.gro"
	},
	{
		suffix: "al",
		reversed: "la"
	},
	{
		suffix: "com.al",
		reversed: "la.moc"
	},
	{
		suffix: "edu.al",
		reversed: "la.ude"
	},
	{
		suffix: "gov.al",
		reversed: "la.vog"
	},
	{
		suffix: "mil.al",
		reversed: "la.lim"
	},
	{
		suffix: "net.al",
		reversed: "la.ten"
	},
	{
		suffix: "org.al",
		reversed: "la.gro"
	},
	{
		suffix: "am",
		reversed: "ma"
	},
	{
		suffix: "co.am",
		reversed: "ma.oc"
	},
	{
		suffix: "com.am",
		reversed: "ma.moc"
	},
	{
		suffix: "commune.am",
		reversed: "ma.enummoc"
	},
	{
		suffix: "net.am",
		reversed: "ma.ten"
	},
	{
		suffix: "org.am",
		reversed: "ma.gro"
	},
	{
		suffix: "ao",
		reversed: "oa"
	},
	{
		suffix: "ed.ao",
		reversed: "oa.de"
	},
	{
		suffix: "gv.ao",
		reversed: "oa.vg"
	},
	{
		suffix: "og.ao",
		reversed: "oa.go"
	},
	{
		suffix: "co.ao",
		reversed: "oa.oc"
	},
	{
		suffix: "pb.ao",
		reversed: "oa.bp"
	},
	{
		suffix: "it.ao",
		reversed: "oa.ti"
	},
	{
		suffix: "aq",
		reversed: "qa"
	},
	{
		suffix: "ar",
		reversed: "ra"
	},
	{
		suffix: "bet.ar",
		reversed: "ra.teb"
	},
	{
		suffix: "com.ar",
		reversed: "ra.moc"
	},
	{
		suffix: "coop.ar",
		reversed: "ra.pooc"
	},
	{
		suffix: "edu.ar",
		reversed: "ra.ude"
	},
	{
		suffix: "gob.ar",
		reversed: "ra.bog"
	},
	{
		suffix: "gov.ar",
		reversed: "ra.vog"
	},
	{
		suffix: "int.ar",
		reversed: "ra.tni"
	},
	{
		suffix: "mil.ar",
		reversed: "ra.lim"
	},
	{
		suffix: "musica.ar",
		reversed: "ra.acisum"
	},
	{
		suffix: "mutual.ar",
		reversed: "ra.lautum"
	},
	{
		suffix: "net.ar",
		reversed: "ra.ten"
	},
	{
		suffix: "org.ar",
		reversed: "ra.gro"
	},
	{
		suffix: "senasa.ar",
		reversed: "ra.asanes"
	},
	{
		suffix: "tur.ar",
		reversed: "ra.rut"
	},
	{
		suffix: "arpa",
		reversed: "apra"
	},
	{
		suffix: "e164.arpa",
		reversed: "apra.461e"
	},
	{
		suffix: "in-addr.arpa",
		reversed: "apra.rdda-ni"
	},
	{
		suffix: "ip6.arpa",
		reversed: "apra.6pi"
	},
	{
		suffix: "iris.arpa",
		reversed: "apra.siri"
	},
	{
		suffix: "uri.arpa",
		reversed: "apra.iru"
	},
	{
		suffix: "urn.arpa",
		reversed: "apra.nru"
	},
	{
		suffix: "as",
		reversed: "sa"
	},
	{
		suffix: "gov.as",
		reversed: "sa.vog"
	},
	{
		suffix: "asia",
		reversed: "aisa"
	},
	{
		suffix: "at",
		reversed: "ta"
	},
	{
		suffix: "ac.at",
		reversed: "ta.ca"
	},
	{
		suffix: "co.at",
		reversed: "ta.oc"
	},
	{
		suffix: "gv.at",
		reversed: "ta.vg"
	},
	{
		suffix: "or.at",
		reversed: "ta.ro"
	},
	{
		suffix: "sth.ac.at",
		reversed: "ta.ca.hts"
	},
	{
		suffix: "au",
		reversed: "ua"
	},
	{
		suffix: "com.au",
		reversed: "ua.moc"
	},
	{
		suffix: "net.au",
		reversed: "ua.ten"
	},
	{
		suffix: "org.au",
		reversed: "ua.gro"
	},
	{
		suffix: "edu.au",
		reversed: "ua.ude"
	},
	{
		suffix: "gov.au",
		reversed: "ua.vog"
	},
	{
		suffix: "asn.au",
		reversed: "ua.nsa"
	},
	{
		suffix: "id.au",
		reversed: "ua.di"
	},
	{
		suffix: "info.au",
		reversed: "ua.ofni"
	},
	{
		suffix: "conf.au",
		reversed: "ua.fnoc"
	},
	{
		suffix: "oz.au",
		reversed: "ua.zo"
	},
	{
		suffix: "act.au",
		reversed: "ua.tca"
	},
	{
		suffix: "nsw.au",
		reversed: "ua.wsn"
	},
	{
		suffix: "nt.au",
		reversed: "ua.tn"
	},
	{
		suffix: "qld.au",
		reversed: "ua.dlq"
	},
	{
		suffix: "sa.au",
		reversed: "ua.as"
	},
	{
		suffix: "tas.au",
		reversed: "ua.sat"
	},
	{
		suffix: "vic.au",
		reversed: "ua.civ"
	},
	{
		suffix: "wa.au",
		reversed: "ua.aw"
	},
	{
		suffix: "act.edu.au",
		reversed: "ua.ude.tca"
	},
	{
		suffix: "catholic.edu.au",
		reversed: "ua.ude.cilohtac"
	},
	{
		suffix: "nsw.edu.au",
		reversed: "ua.ude.wsn"
	},
	{
		suffix: "nt.edu.au",
		reversed: "ua.ude.tn"
	},
	{
		suffix: "qld.edu.au",
		reversed: "ua.ude.dlq"
	},
	{
		suffix: "sa.edu.au",
		reversed: "ua.ude.as"
	},
	{
		suffix: "tas.edu.au",
		reversed: "ua.ude.sat"
	},
	{
		suffix: "vic.edu.au",
		reversed: "ua.ude.civ"
	},
	{
		suffix: "wa.edu.au",
		reversed: "ua.ude.aw"
	},
	{
		suffix: "qld.gov.au",
		reversed: "ua.vog.dlq"
	},
	{
		suffix: "sa.gov.au",
		reversed: "ua.vog.as"
	},
	{
		suffix: "tas.gov.au",
		reversed: "ua.vog.sat"
	},
	{
		suffix: "vic.gov.au",
		reversed: "ua.vog.civ"
	},
	{
		suffix: "wa.gov.au",
		reversed: "ua.vog.aw"
	},
	{
		suffix: "schools.nsw.edu.au",
		reversed: "ua.ude.wsn.sloohcs"
	},
	{
		suffix: "aw",
		reversed: "wa"
	},
	{
		suffix: "com.aw",
		reversed: "wa.moc"
	},
	{
		suffix: "ax",
		reversed: "xa"
	},
	{
		suffix: "az",
		reversed: "za"
	},
	{
		suffix: "com.az",
		reversed: "za.moc"
	},
	{
		suffix: "net.az",
		reversed: "za.ten"
	},
	{
		suffix: "int.az",
		reversed: "za.tni"
	},
	{
		suffix: "gov.az",
		reversed: "za.vog"
	},
	{
		suffix: "org.az",
		reversed: "za.gro"
	},
	{
		suffix: "edu.az",
		reversed: "za.ude"
	},
	{
		suffix: "info.az",
		reversed: "za.ofni"
	},
	{
		suffix: "pp.az",
		reversed: "za.pp"
	},
	{
		suffix: "mil.az",
		reversed: "za.lim"
	},
	{
		suffix: "name.az",
		reversed: "za.eman"
	},
	{
		suffix: "pro.az",
		reversed: "za.orp"
	},
	{
		suffix: "biz.az",
		reversed: "za.zib"
	},
	{
		suffix: "ba",
		reversed: "ab"
	},
	{
		suffix: "com.ba",
		reversed: "ab.moc"
	},
	{
		suffix: "edu.ba",
		reversed: "ab.ude"
	},
	{
		suffix: "gov.ba",
		reversed: "ab.vog"
	},
	{
		suffix: "mil.ba",
		reversed: "ab.lim"
	},
	{
		suffix: "net.ba",
		reversed: "ab.ten"
	},
	{
		suffix: "org.ba",
		reversed: "ab.gro"
	},
	{
		suffix: "bb",
		reversed: "bb"
	},
	{
		suffix: "biz.bb",
		reversed: "bb.zib"
	},
	{
		suffix: "co.bb",
		reversed: "bb.oc"
	},
	{
		suffix: "com.bb",
		reversed: "bb.moc"
	},
	{
		suffix: "edu.bb",
		reversed: "bb.ude"
	},
	{
		suffix: "gov.bb",
		reversed: "bb.vog"
	},
	{
		suffix: "info.bb",
		reversed: "bb.ofni"
	},
	{
		suffix: "net.bb",
		reversed: "bb.ten"
	},
	{
		suffix: "org.bb",
		reversed: "bb.gro"
	},
	{
		suffix: "store.bb",
		reversed: "bb.erots"
	},
	{
		suffix: "tv.bb",
		reversed: "bb.vt"
	},
	{
		suffix: "*.bd",
		reversed: "db"
	},
	{
		suffix: "be",
		reversed: "eb"
	},
	{
		suffix: "ac.be",
		reversed: "eb.ca"
	},
	{
		suffix: "bf",
		reversed: "fb"
	},
	{
		suffix: "gov.bf",
		reversed: "fb.vog"
	},
	{
		suffix: "bg",
		reversed: "gb"
	},
	{
		suffix: "a.bg",
		reversed: "gb.a"
	},
	{
		suffix: "b.bg",
		reversed: "gb.b"
	},
	{
		suffix: "c.bg",
		reversed: "gb.c"
	},
	{
		suffix: "d.bg",
		reversed: "gb.d"
	},
	{
		suffix: "e.bg",
		reversed: "gb.e"
	},
	{
		suffix: "f.bg",
		reversed: "gb.f"
	},
	{
		suffix: "g.bg",
		reversed: "gb.g"
	},
	{
		suffix: "h.bg",
		reversed: "gb.h"
	},
	{
		suffix: "i.bg",
		reversed: "gb.i"
	},
	{
		suffix: "j.bg",
		reversed: "gb.j"
	},
	{
		suffix: "k.bg",
		reversed: "gb.k"
	},
	{
		suffix: "l.bg",
		reversed: "gb.l"
	},
	{
		suffix: "m.bg",
		reversed: "gb.m"
	},
	{
		suffix: "n.bg",
		reversed: "gb.n"
	},
	{
		suffix: "o.bg",
		reversed: "gb.o"
	},
	{
		suffix: "p.bg",
		reversed: "gb.p"
	},
	{
		suffix: "q.bg",
		reversed: "gb.q"
	},
	{
		suffix: "r.bg",
		reversed: "gb.r"
	},
	{
		suffix: "s.bg",
		reversed: "gb.s"
	},
	{
		suffix: "t.bg",
		reversed: "gb.t"
	},
	{
		suffix: "u.bg",
		reversed: "gb.u"
	},
	{
		suffix: "v.bg",
		reversed: "gb.v"
	},
	{
		suffix: "w.bg",
		reversed: "gb.w"
	},
	{
		suffix: "x.bg",
		reversed: "gb.x"
	},
	{
		suffix: "y.bg",
		reversed: "gb.y"
	},
	{
		suffix: "z.bg",
		reversed: "gb.z"
	},
	{
		suffix: "0.bg",
		reversed: "gb.0"
	},
	{
		suffix: "1.bg",
		reversed: "gb.1"
	},
	{
		suffix: "2.bg",
		reversed: "gb.2"
	},
	{
		suffix: "3.bg",
		reversed: "gb.3"
	},
	{
		suffix: "4.bg",
		reversed: "gb.4"
	},
	{
		suffix: "5.bg",
		reversed: "gb.5"
	},
	{
		suffix: "6.bg",
		reversed: "gb.6"
	},
	{
		suffix: "7.bg",
		reversed: "gb.7"
	},
	{
		suffix: "8.bg",
		reversed: "gb.8"
	},
	{
		suffix: "9.bg",
		reversed: "gb.9"
	},
	{
		suffix: "bh",
		reversed: "hb"
	},
	{
		suffix: "com.bh",
		reversed: "hb.moc"
	},
	{
		suffix: "edu.bh",
		reversed: "hb.ude"
	},
	{
		suffix: "net.bh",
		reversed: "hb.ten"
	},
	{
		suffix: "org.bh",
		reversed: "hb.gro"
	},
	{
		suffix: "gov.bh",
		reversed: "hb.vog"
	},
	{
		suffix: "bi",
		reversed: "ib"
	},
	{
		suffix: "co.bi",
		reversed: "ib.oc"
	},
	{
		suffix: "com.bi",
		reversed: "ib.moc"
	},
	{
		suffix: "edu.bi",
		reversed: "ib.ude"
	},
	{
		suffix: "or.bi",
		reversed: "ib.ro"
	},
	{
		suffix: "org.bi",
		reversed: "ib.gro"
	},
	{
		suffix: "biz",
		reversed: "zib"
	},
	{
		suffix: "bj",
		reversed: "jb"
	},
	{
		suffix: "africa.bj",
		reversed: "jb.acirfa"
	},
	{
		suffix: "agro.bj",
		reversed: "jb.orga"
	},
	{
		suffix: "architectes.bj",
		reversed: "jb.setcetihcra"
	},
	{
		suffix: "assur.bj",
		reversed: "jb.russa"
	},
	{
		suffix: "avocats.bj",
		reversed: "jb.stacova"
	},
	{
		suffix: "co.bj",
		reversed: "jb.oc"
	},
	{
		suffix: "com.bj",
		reversed: "jb.moc"
	},
	{
		suffix: "eco.bj",
		reversed: "jb.oce"
	},
	{
		suffix: "econo.bj",
		reversed: "jb.onoce"
	},
	{
		suffix: "edu.bj",
		reversed: "jb.ude"
	},
	{
		suffix: "info.bj",
		reversed: "jb.ofni"
	},
	{
		suffix: "loisirs.bj",
		reversed: "jb.srisiol"
	},
	{
		suffix: "money.bj",
		reversed: "jb.yenom"
	},
	{
		suffix: "net.bj",
		reversed: "jb.ten"
	},
	{
		suffix: "org.bj",
		reversed: "jb.gro"
	},
	{
		suffix: "ote.bj",
		reversed: "jb.eto"
	},
	{
		suffix: "resto.bj",
		reversed: "jb.otser"
	},
	{
		suffix: "restaurant.bj",
		reversed: "jb.tnaruatser"
	},
	{
		suffix: "tourism.bj",
		reversed: "jb.msiruot"
	},
	{
		suffix: "univ.bj",
		reversed: "jb.vinu"
	},
	{
		suffix: "bm",
		reversed: "mb"
	},
	{
		suffix: "com.bm",
		reversed: "mb.moc"
	},
	{
		suffix: "edu.bm",
		reversed: "mb.ude"
	},
	{
		suffix: "gov.bm",
		reversed: "mb.vog"
	},
	{
		suffix: "net.bm",
		reversed: "mb.ten"
	},
	{
		suffix: "org.bm",
		reversed: "mb.gro"
	},
	{
		suffix: "bn",
		reversed: "nb"
	},
	{
		suffix: "com.bn",
		reversed: "nb.moc"
	},
	{
		suffix: "edu.bn",
		reversed: "nb.ude"
	},
	{
		suffix: "gov.bn",
		reversed: "nb.vog"
	},
	{
		suffix: "net.bn",
		reversed: "nb.ten"
	},
	{
		suffix: "org.bn",
		reversed: "nb.gro"
	},
	{
		suffix: "bo",
		reversed: "ob"
	},
	{
		suffix: "com.bo",
		reversed: "ob.moc"
	},
	{
		suffix: "edu.bo",
		reversed: "ob.ude"
	},
	{
		suffix: "gob.bo",
		reversed: "ob.bog"
	},
	{
		suffix: "int.bo",
		reversed: "ob.tni"
	},
	{
		suffix: "org.bo",
		reversed: "ob.gro"
	},
	{
		suffix: "net.bo",
		reversed: "ob.ten"
	},
	{
		suffix: "mil.bo",
		reversed: "ob.lim"
	},
	{
		suffix: "tv.bo",
		reversed: "ob.vt"
	},
	{
		suffix: "web.bo",
		reversed: "ob.bew"
	},
	{
		suffix: "academia.bo",
		reversed: "ob.aimedaca"
	},
	{
		suffix: "agro.bo",
		reversed: "ob.orga"
	},
	{
		suffix: "arte.bo",
		reversed: "ob.etra"
	},
	{
		suffix: "blog.bo",
		reversed: "ob.golb"
	},
	{
		suffix: "bolivia.bo",
		reversed: "ob.aivilob"
	},
	{
		suffix: "ciencia.bo",
		reversed: "ob.aicneic"
	},
	{
		suffix: "cooperativa.bo",
		reversed: "ob.avitarepooc"
	},
	{
		suffix: "democracia.bo",
		reversed: "ob.aicarcomed"
	},
	{
		suffix: "deporte.bo",
		reversed: "ob.etroped"
	},
	{
		suffix: "ecologia.bo",
		reversed: "ob.aigoloce"
	},
	{
		suffix: "economia.bo",
		reversed: "ob.aimonoce"
	},
	{
		suffix: "empresa.bo",
		reversed: "ob.aserpme"
	},
	{
		suffix: "indigena.bo",
		reversed: "ob.anegidni"
	},
	{
		suffix: "industria.bo",
		reversed: "ob.airtsudni"
	},
	{
		suffix: "info.bo",
		reversed: "ob.ofni"
	},
	{
		suffix: "medicina.bo",
		reversed: "ob.anicidem"
	},
	{
		suffix: "movimiento.bo",
		reversed: "ob.otneimivom"
	},
	{
		suffix: "musica.bo",
		reversed: "ob.acisum"
	},
	{
		suffix: "natural.bo",
		reversed: "ob.larutan"
	},
	{
		suffix: "nombre.bo",
		reversed: "ob.erbmon"
	},
	{
		suffix: "noticias.bo",
		reversed: "ob.saiciton"
	},
	{
		suffix: "patria.bo",
		reversed: "ob.airtap"
	},
	{
		suffix: "politica.bo",
		reversed: "ob.acitilop"
	},
	{
		suffix: "profesional.bo",
		reversed: "ob.lanoiseforp"
	},
	{
		suffix: "plurinacional.bo",
		reversed: "ob.lanoicanirulp"
	},
	{
		suffix: "pueblo.bo",
		reversed: "ob.olbeup"
	},
	{
		suffix: "revista.bo",
		reversed: "ob.atsiver"
	},
	{
		suffix: "salud.bo",
		reversed: "ob.dulas"
	},
	{
		suffix: "tecnologia.bo",
		reversed: "ob.aigoloncet"
	},
	{
		suffix: "tksat.bo",
		reversed: "ob.taskt"
	},
	{
		suffix: "transporte.bo",
		reversed: "ob.etropsnart"
	},
	{
		suffix: "wiki.bo",
		reversed: "ob.ikiw"
	},
	{
		suffix: "br",
		reversed: "rb"
	},
	{
		suffix: "9guacu.br",
		reversed: "rb.ucaug9"
	},
	{
		suffix: "abc.br",
		reversed: "rb.cba"
	},
	{
		suffix: "adm.br",
		reversed: "rb.mda"
	},
	{
		suffix: "adv.br",
		reversed: "rb.vda"
	},
	{
		suffix: "agr.br",
		reversed: "rb.rga"
	},
	{
		suffix: "aju.br",
		reversed: "rb.uja"
	},
	{
		suffix: "am.br",
		reversed: "rb.ma"
	},
	{
		suffix: "anani.br",
		reversed: "rb.inana"
	},
	{
		suffix: "aparecida.br",
		reversed: "rb.adicerapa"
	},
	{
		suffix: "app.br",
		reversed: "rb.ppa"
	},
	{
		suffix: "arq.br",
		reversed: "rb.qra"
	},
	{
		suffix: "art.br",
		reversed: "rb.tra"
	},
	{
		suffix: "ato.br",
		reversed: "rb.ota"
	},
	{
		suffix: "b.br",
		reversed: "rb.b"
	},
	{
		suffix: "barueri.br",
		reversed: "rb.ireurab"
	},
	{
		suffix: "belem.br",
		reversed: "rb.meleb"
	},
	{
		suffix: "bhz.br",
		reversed: "rb.zhb"
	},
	{
		suffix: "bib.br",
		reversed: "rb.bib"
	},
	{
		suffix: "bio.br",
		reversed: "rb.oib"
	},
	{
		suffix: "blog.br",
		reversed: "rb.golb"
	},
	{
		suffix: "bmd.br",
		reversed: "rb.dmb"
	},
	{
		suffix: "boavista.br",
		reversed: "rb.atsivaob"
	},
	{
		suffix: "bsb.br",
		reversed: "rb.bsb"
	},
	{
		suffix: "campinagrande.br",
		reversed: "rb.ednarganipmac"
	},
	{
		suffix: "campinas.br",
		reversed: "rb.sanipmac"
	},
	{
		suffix: "caxias.br",
		reversed: "rb.saixac"
	},
	{
		suffix: "cim.br",
		reversed: "rb.mic"
	},
	{
		suffix: "cng.br",
		reversed: "rb.gnc"
	},
	{
		suffix: "cnt.br",
		reversed: "rb.tnc"
	},
	{
		suffix: "com.br",
		reversed: "rb.moc"
	},
	{
		suffix: "contagem.br",
		reversed: "rb.megatnoc"
	},
	{
		suffix: "coop.br",
		reversed: "rb.pooc"
	},
	{
		suffix: "coz.br",
		reversed: "rb.zoc"
	},
	{
		suffix: "cri.br",
		reversed: "rb.irc"
	},
	{
		suffix: "cuiaba.br",
		reversed: "rb.abaiuc"
	},
	{
		suffix: "curitiba.br",
		reversed: "rb.abitiruc"
	},
	{
		suffix: "def.br",
		reversed: "rb.fed"
	},
	{
		suffix: "des.br",
		reversed: "rb.sed"
	},
	{
		suffix: "det.br",
		reversed: "rb.ted"
	},
	{
		suffix: "dev.br",
		reversed: "rb.ved"
	},
	{
		suffix: "ecn.br",
		reversed: "rb.nce"
	},
	{
		suffix: "eco.br",
		reversed: "rb.oce"
	},
	{
		suffix: "edu.br",
		reversed: "rb.ude"
	},
	{
		suffix: "emp.br",
		reversed: "rb.pme"
	},
	{
		suffix: "enf.br",
		reversed: "rb.fne"
	},
	{
		suffix: "eng.br",
		reversed: "rb.gne"
	},
	{
		suffix: "esp.br",
		reversed: "rb.pse"
	},
	{
		suffix: "etc.br",
		reversed: "rb.cte"
	},
	{
		suffix: "eti.br",
		reversed: "rb.ite"
	},
	{
		suffix: "far.br",
		reversed: "rb.raf"
	},
	{
		suffix: "feira.br",
		reversed: "rb.arief"
	},
	{
		suffix: "flog.br",
		reversed: "rb.golf"
	},
	{
		suffix: "floripa.br",
		reversed: "rb.apirolf"
	},
	{
		suffix: "fm.br",
		reversed: "rb.mf"
	},
	{
		suffix: "fnd.br",
		reversed: "rb.dnf"
	},
	{
		suffix: "fortal.br",
		reversed: "rb.latrof"
	},
	{
		suffix: "fot.br",
		reversed: "rb.tof"
	},
	{
		suffix: "foz.br",
		reversed: "rb.zof"
	},
	{
		suffix: "fst.br",
		reversed: "rb.tsf"
	},
	{
		suffix: "g12.br",
		reversed: "rb.21g"
	},
	{
		suffix: "geo.br",
		reversed: "rb.oeg"
	},
	{
		suffix: "ggf.br",
		reversed: "rb.fgg"
	},
	{
		suffix: "goiania.br",
		reversed: "rb.ainaiog"
	},
	{
		suffix: "gov.br",
		reversed: "rb.vog"
	},
	{
		suffix: "ac.gov.br",
		reversed: "rb.vog.ca"
	},
	{
		suffix: "al.gov.br",
		reversed: "rb.vog.la"
	},
	{
		suffix: "am.gov.br",
		reversed: "rb.vog.ma"
	},
	{
		suffix: "ap.gov.br",
		reversed: "rb.vog.pa"
	},
	{
		suffix: "ba.gov.br",
		reversed: "rb.vog.ab"
	},
	{
		suffix: "ce.gov.br",
		reversed: "rb.vog.ec"
	},
	{
		suffix: "df.gov.br",
		reversed: "rb.vog.fd"
	},
	{
		suffix: "es.gov.br",
		reversed: "rb.vog.se"
	},
	{
		suffix: "go.gov.br",
		reversed: "rb.vog.og"
	},
	{
		suffix: "ma.gov.br",
		reversed: "rb.vog.am"
	},
	{
		suffix: "mg.gov.br",
		reversed: "rb.vog.gm"
	},
	{
		suffix: "ms.gov.br",
		reversed: "rb.vog.sm"
	},
	{
		suffix: "mt.gov.br",
		reversed: "rb.vog.tm"
	},
	{
		suffix: "pa.gov.br",
		reversed: "rb.vog.ap"
	},
	{
		suffix: "pb.gov.br",
		reversed: "rb.vog.bp"
	},
	{
		suffix: "pe.gov.br",
		reversed: "rb.vog.ep"
	},
	{
		suffix: "pi.gov.br",
		reversed: "rb.vog.ip"
	},
	{
		suffix: "pr.gov.br",
		reversed: "rb.vog.rp"
	},
	{
		suffix: "rj.gov.br",
		reversed: "rb.vog.jr"
	},
	{
		suffix: "rn.gov.br",
		reversed: "rb.vog.nr"
	},
	{
		suffix: "ro.gov.br",
		reversed: "rb.vog.or"
	},
	{
		suffix: "rr.gov.br",
		reversed: "rb.vog.rr"
	},
	{
		suffix: "rs.gov.br",
		reversed: "rb.vog.sr"
	},
	{
		suffix: "sc.gov.br",
		reversed: "rb.vog.cs"
	},
	{
		suffix: "se.gov.br",
		reversed: "rb.vog.es"
	},
	{
		suffix: "sp.gov.br",
		reversed: "rb.vog.ps"
	},
	{
		suffix: "to.gov.br",
		reversed: "rb.vog.ot"
	},
	{
		suffix: "gru.br",
		reversed: "rb.urg"
	},
	{
		suffix: "imb.br",
		reversed: "rb.bmi"
	},
	{
		suffix: "ind.br",
		reversed: "rb.dni"
	},
	{
		suffix: "inf.br",
		reversed: "rb.fni"
	},
	{
		suffix: "jab.br",
		reversed: "rb.baj"
	},
	{
		suffix: "jampa.br",
		reversed: "rb.apmaj"
	},
	{
		suffix: "jdf.br",
		reversed: "rb.fdj"
	},
	{
		suffix: "joinville.br",
		reversed: "rb.ellivnioj"
	},
	{
		suffix: "jor.br",
		reversed: "rb.roj"
	},
	{
		suffix: "jus.br",
		reversed: "rb.suj"
	},
	{
		suffix: "leg.br",
		reversed: "rb.gel"
	},
	{
		suffix: "lel.br",
		reversed: "rb.lel"
	},
	{
		suffix: "log.br",
		reversed: "rb.gol"
	},
	{
		suffix: "londrina.br",
		reversed: "rb.anirdnol"
	},
	{
		suffix: "macapa.br",
		reversed: "rb.apacam"
	},
	{
		suffix: "maceio.br",
		reversed: "rb.oiecam"
	},
	{
		suffix: "manaus.br",
		reversed: "rb.suanam"
	},
	{
		suffix: "maringa.br",
		reversed: "rb.agniram"
	},
	{
		suffix: "mat.br",
		reversed: "rb.tam"
	},
	{
		suffix: "med.br",
		reversed: "rb.dem"
	},
	{
		suffix: "mil.br",
		reversed: "rb.lim"
	},
	{
		suffix: "morena.br",
		reversed: "rb.anerom"
	},
	{
		suffix: "mp.br",
		reversed: "rb.pm"
	},
	{
		suffix: "mus.br",
		reversed: "rb.sum"
	},
	{
		suffix: "natal.br",
		reversed: "rb.latan"
	},
	{
		suffix: "net.br",
		reversed: "rb.ten"
	},
	{
		suffix: "niteroi.br",
		reversed: "rb.ioretin"
	},
	{
		suffix: "*.nom.br",
		reversed: "rb.mon"
	},
	{
		suffix: "not.br",
		reversed: "rb.ton"
	},
	{
		suffix: "ntr.br",
		reversed: "rb.rtn"
	},
	{
		suffix: "odo.br",
		reversed: "rb.odo"
	},
	{
		suffix: "ong.br",
		reversed: "rb.gno"
	},
	{
		suffix: "org.br",
		reversed: "rb.gro"
	},
	{
		suffix: "osasco.br",
		reversed: "rb.ocsaso"
	},
	{
		suffix: "palmas.br",
		reversed: "rb.samlap"
	},
	{
		suffix: "poa.br",
		reversed: "rb.aop"
	},
	{
		suffix: "ppg.br",
		reversed: "rb.gpp"
	},
	{
		suffix: "pro.br",
		reversed: "rb.orp"
	},
	{
		suffix: "psc.br",
		reversed: "rb.csp"
	},
	{
		suffix: "psi.br",
		reversed: "rb.isp"
	},
	{
		suffix: "pvh.br",
		reversed: "rb.hvp"
	},
	{
		suffix: "qsl.br",
		reversed: "rb.lsq"
	},
	{
		suffix: "radio.br",
		reversed: "rb.oidar"
	},
	{
		suffix: "rec.br",
		reversed: "rb.cer"
	},
	{
		suffix: "recife.br",
		reversed: "rb.eficer"
	},
	{
		suffix: "rep.br",
		reversed: "rb.per"
	},
	{
		suffix: "ribeirao.br",
		reversed: "rb.oariebir"
	},
	{
		suffix: "rio.br",
		reversed: "rb.oir"
	},
	{
		suffix: "riobranco.br",
		reversed: "rb.ocnarboir"
	},
	{
		suffix: "riopreto.br",
		reversed: "rb.oterpoir"
	},
	{
		suffix: "salvador.br",
		reversed: "rb.rodavlas"
	},
	{
		suffix: "sampa.br",
		reversed: "rb.apmas"
	},
	{
		suffix: "santamaria.br",
		reversed: "rb.airamatnas"
	},
	{
		suffix: "santoandre.br",
		reversed: "rb.erdnaotnas"
	},
	{
		suffix: "saobernardo.br",
		reversed: "rb.odranreboas"
	},
	{
		suffix: "saogonca.br",
		reversed: "rb.acnogoas"
	},
	{
		suffix: "seg.br",
		reversed: "rb.ges"
	},
	{
		suffix: "sjc.br",
		reversed: "rb.cjs"
	},
	{
		suffix: "slg.br",
		reversed: "rb.gls"
	},
	{
		suffix: "slz.br",
		reversed: "rb.zls"
	},
	{
		suffix: "sorocaba.br",
		reversed: "rb.abacoros"
	},
	{
		suffix: "srv.br",
		reversed: "rb.vrs"
	},
	{
		suffix: "taxi.br",
		reversed: "rb.ixat"
	},
	{
		suffix: "tc.br",
		reversed: "rb.ct"
	},
	{
		suffix: "tec.br",
		reversed: "rb.cet"
	},
	{
		suffix: "teo.br",
		reversed: "rb.oet"
	},
	{
		suffix: "the.br",
		reversed: "rb.eht"
	},
	{
		suffix: "tmp.br",
		reversed: "rb.pmt"
	},
	{
		suffix: "trd.br",
		reversed: "rb.drt"
	},
	{
		suffix: "tur.br",
		reversed: "rb.rut"
	},
	{
		suffix: "tv.br",
		reversed: "rb.vt"
	},
	{
		suffix: "udi.br",
		reversed: "rb.idu"
	},
	{
		suffix: "vet.br",
		reversed: "rb.tev"
	},
	{
		suffix: "vix.br",
		reversed: "rb.xiv"
	},
	{
		suffix: "vlog.br",
		reversed: "rb.golv"
	},
	{
		suffix: "wiki.br",
		reversed: "rb.ikiw"
	},
	{
		suffix: "zlg.br",
		reversed: "rb.glz"
	},
	{
		suffix: "bs",
		reversed: "sb"
	},
	{
		suffix: "com.bs",
		reversed: "sb.moc"
	},
	{
		suffix: "net.bs",
		reversed: "sb.ten"
	},
	{
		suffix: "org.bs",
		reversed: "sb.gro"
	},
	{
		suffix: "edu.bs",
		reversed: "sb.ude"
	},
	{
		suffix: "gov.bs",
		reversed: "sb.vog"
	},
	{
		suffix: "bt",
		reversed: "tb"
	},
	{
		suffix: "com.bt",
		reversed: "tb.moc"
	},
	{
		suffix: "edu.bt",
		reversed: "tb.ude"
	},
	{
		suffix: "gov.bt",
		reversed: "tb.vog"
	},
	{
		suffix: "net.bt",
		reversed: "tb.ten"
	},
	{
		suffix: "org.bt",
		reversed: "tb.gro"
	},
	{
		suffix: "bv",
		reversed: "vb"
	},
	{
		suffix: "bw",
		reversed: "wb"
	},
	{
		suffix: "co.bw",
		reversed: "wb.oc"
	},
	{
		suffix: "org.bw",
		reversed: "wb.gro"
	},
	{
		suffix: "by",
		reversed: "yb"
	},
	{
		suffix: "gov.by",
		reversed: "yb.vog"
	},
	{
		suffix: "mil.by",
		reversed: "yb.lim"
	},
	{
		suffix: "com.by",
		reversed: "yb.moc"
	},
	{
		suffix: "of.by",
		reversed: "yb.fo"
	},
	{
		suffix: "bz",
		reversed: "zb"
	},
	{
		suffix: "com.bz",
		reversed: "zb.moc"
	},
	{
		suffix: "net.bz",
		reversed: "zb.ten"
	},
	{
		suffix: "org.bz",
		reversed: "zb.gro"
	},
	{
		suffix: "edu.bz",
		reversed: "zb.ude"
	},
	{
		suffix: "gov.bz",
		reversed: "zb.vog"
	},
	{
		suffix: "ca",
		reversed: "ac"
	},
	{
		suffix: "ab.ca",
		reversed: "ac.ba"
	},
	{
		suffix: "bc.ca",
		reversed: "ac.cb"
	},
	{
		suffix: "mb.ca",
		reversed: "ac.bm"
	},
	{
		suffix: "nb.ca",
		reversed: "ac.bn"
	},
	{
		suffix: "nf.ca",
		reversed: "ac.fn"
	},
	{
		suffix: "nl.ca",
		reversed: "ac.ln"
	},
	{
		suffix: "ns.ca",
		reversed: "ac.sn"
	},
	{
		suffix: "nt.ca",
		reversed: "ac.tn"
	},
	{
		suffix: "nu.ca",
		reversed: "ac.un"
	},
	{
		suffix: "on.ca",
		reversed: "ac.no"
	},
	{
		suffix: "pe.ca",
		reversed: "ac.ep"
	},
	{
		suffix: "qc.ca",
		reversed: "ac.cq"
	},
	{
		suffix: "sk.ca",
		reversed: "ac.ks"
	},
	{
		suffix: "yk.ca",
		reversed: "ac.ky"
	},
	{
		suffix: "gc.ca",
		reversed: "ac.cg"
	},
	{
		suffix: "cat",
		reversed: "tac"
	},
	{
		suffix: "cc",
		reversed: "cc"
	},
	{
		suffix: "cd",
		reversed: "dc"
	},
	{
		suffix: "gov.cd",
		reversed: "dc.vog"
	},
	{
		suffix: "cf",
		reversed: "fc"
	},
	{
		suffix: "cg",
		reversed: "gc"
	},
	{
		suffix: "ch",
		reversed: "hc"
	},
	{
		suffix: "ci",
		reversed: "ic"
	},
	{
		suffix: "org.ci",
		reversed: "ic.gro"
	},
	{
		suffix: "or.ci",
		reversed: "ic.ro"
	},
	{
		suffix: "com.ci",
		reversed: "ic.moc"
	},
	{
		suffix: "co.ci",
		reversed: "ic.oc"
	},
	{
		suffix: "edu.ci",
		reversed: "ic.ude"
	},
	{
		suffix: "ed.ci",
		reversed: "ic.de"
	},
	{
		suffix: "ac.ci",
		reversed: "ic.ca"
	},
	{
		suffix: "net.ci",
		reversed: "ic.ten"
	},
	{
		suffix: "go.ci",
		reversed: "ic.og"
	},
	{
		suffix: "asso.ci",
		reversed: "ic.ossa"
	},
	{
		suffix: "aéroport.ci",
		reversed: "ic.ayb-tropora--nx"
	},
	{
		suffix: "int.ci",
		reversed: "ic.tni"
	},
	{
		suffix: "presse.ci",
		reversed: "ic.esserp"
	},
	{
		suffix: "md.ci",
		reversed: "ic.dm"
	},
	{
		suffix: "gouv.ci",
		reversed: "ic.vuog"
	},
	{
		suffix: "*.ck",
		reversed: "kc"
	},
	{
		suffix: "!www.ck",
		reversed: "kc.www"
	},
	{
		suffix: "cl",
		reversed: "lc"
	},
	{
		suffix: "co.cl",
		reversed: "lc.oc"
	},
	{
		suffix: "gob.cl",
		reversed: "lc.bog"
	},
	{
		suffix: "gov.cl",
		reversed: "lc.vog"
	},
	{
		suffix: "mil.cl",
		reversed: "lc.lim"
	},
	{
		suffix: "cm",
		reversed: "mc"
	},
	{
		suffix: "co.cm",
		reversed: "mc.oc"
	},
	{
		suffix: "com.cm",
		reversed: "mc.moc"
	},
	{
		suffix: "gov.cm",
		reversed: "mc.vog"
	},
	{
		suffix: "net.cm",
		reversed: "mc.ten"
	},
	{
		suffix: "cn",
		reversed: "nc"
	},
	{
		suffix: "ac.cn",
		reversed: "nc.ca"
	},
	{
		suffix: "com.cn",
		reversed: "nc.moc"
	},
	{
		suffix: "edu.cn",
		reversed: "nc.ude"
	},
	{
		suffix: "gov.cn",
		reversed: "nc.vog"
	},
	{
		suffix: "net.cn",
		reversed: "nc.ten"
	},
	{
		suffix: "org.cn",
		reversed: "nc.gro"
	},
	{
		suffix: "mil.cn",
		reversed: "nc.lim"
	},
	{
		suffix: "公司.cn",
		reversed: "nc.d5xq55--nx"
	},
	{
		suffix: "网络.cn",
		reversed: "nc.i7a0oi--nx"
	},
	{
		suffix: "網絡.cn",
		reversed: "nc.gla0do--nx"
	},
	{
		suffix: "ah.cn",
		reversed: "nc.ha"
	},
	{
		suffix: "bj.cn",
		reversed: "nc.jb"
	},
	{
		suffix: "cq.cn",
		reversed: "nc.qc"
	},
	{
		suffix: "fj.cn",
		reversed: "nc.jf"
	},
	{
		suffix: "gd.cn",
		reversed: "nc.dg"
	},
	{
		suffix: "gs.cn",
		reversed: "nc.sg"
	},
	{
		suffix: "gz.cn",
		reversed: "nc.zg"
	},
	{
		suffix: "gx.cn",
		reversed: "nc.xg"
	},
	{
		suffix: "ha.cn",
		reversed: "nc.ah"
	},
	{
		suffix: "hb.cn",
		reversed: "nc.bh"
	},
	{
		suffix: "he.cn",
		reversed: "nc.eh"
	},
	{
		suffix: "hi.cn",
		reversed: "nc.ih"
	},
	{
		suffix: "hl.cn",
		reversed: "nc.lh"
	},
	{
		suffix: "hn.cn",
		reversed: "nc.nh"
	},
	{
		suffix: "jl.cn",
		reversed: "nc.lj"
	},
	{
		suffix: "js.cn",
		reversed: "nc.sj"
	},
	{
		suffix: "jx.cn",
		reversed: "nc.xj"
	},
	{
		suffix: "ln.cn",
		reversed: "nc.nl"
	},
	{
		suffix: "nm.cn",
		reversed: "nc.mn"
	},
	{
		suffix: "nx.cn",
		reversed: "nc.xn"
	},
	{
		suffix: "qh.cn",
		reversed: "nc.hq"
	},
	{
		suffix: "sc.cn",
		reversed: "nc.cs"
	},
	{
		suffix: "sd.cn",
		reversed: "nc.ds"
	},
	{
		suffix: "sh.cn",
		reversed: "nc.hs"
	},
	{
		suffix: "sn.cn",
		reversed: "nc.ns"
	},
	{
		suffix: "sx.cn",
		reversed: "nc.xs"
	},
	{
		suffix: "tj.cn",
		reversed: "nc.jt"
	},
	{
		suffix: "xj.cn",
		reversed: "nc.jx"
	},
	{
		suffix: "xz.cn",
		reversed: "nc.zx"
	},
	{
		suffix: "yn.cn",
		reversed: "nc.ny"
	},
	{
		suffix: "zj.cn",
		reversed: "nc.jz"
	},
	{
		suffix: "hk.cn",
		reversed: "nc.kh"
	},
	{
		suffix: "mo.cn",
		reversed: "nc.om"
	},
	{
		suffix: "tw.cn",
		reversed: "nc.wt"
	},
	{
		suffix: "co",
		reversed: "oc"
	},
	{
		suffix: "arts.co",
		reversed: "oc.stra"
	},
	{
		suffix: "com.co",
		reversed: "oc.moc"
	},
	{
		suffix: "edu.co",
		reversed: "oc.ude"
	},
	{
		suffix: "firm.co",
		reversed: "oc.mrif"
	},
	{
		suffix: "gov.co",
		reversed: "oc.vog"
	},
	{
		suffix: "info.co",
		reversed: "oc.ofni"
	},
	{
		suffix: "int.co",
		reversed: "oc.tni"
	},
	{
		suffix: "mil.co",
		reversed: "oc.lim"
	},
	{
		suffix: "net.co",
		reversed: "oc.ten"
	},
	{
		suffix: "nom.co",
		reversed: "oc.mon"
	},
	{
		suffix: "org.co",
		reversed: "oc.gro"
	},
	{
		suffix: "rec.co",
		reversed: "oc.cer"
	},
	{
		suffix: "web.co",
		reversed: "oc.bew"
	},
	{
		suffix: "com",
		reversed: "moc"
	},
	{
		suffix: "coop",
		reversed: "pooc"
	},
	{
		suffix: "cr",
		reversed: "rc"
	},
	{
		suffix: "ac.cr",
		reversed: "rc.ca"
	},
	{
		suffix: "co.cr",
		reversed: "rc.oc"
	},
	{
		suffix: "ed.cr",
		reversed: "rc.de"
	},
	{
		suffix: "fi.cr",
		reversed: "rc.if"
	},
	{
		suffix: "go.cr",
		reversed: "rc.og"
	},
	{
		suffix: "or.cr",
		reversed: "rc.ro"
	},
	{
		suffix: "sa.cr",
		reversed: "rc.as"
	},
	{
		suffix: "cu",
		reversed: "uc"
	},
	{
		suffix: "com.cu",
		reversed: "uc.moc"
	},
	{
		suffix: "edu.cu",
		reversed: "uc.ude"
	},
	{
		suffix: "org.cu",
		reversed: "uc.gro"
	},
	{
		suffix: "net.cu",
		reversed: "uc.ten"
	},
	{
		suffix: "gov.cu",
		reversed: "uc.vog"
	},
	{
		suffix: "inf.cu",
		reversed: "uc.fni"
	},
	{
		suffix: "cv",
		reversed: "vc"
	},
	{
		suffix: "com.cv",
		reversed: "vc.moc"
	},
	{
		suffix: "edu.cv",
		reversed: "vc.ude"
	},
	{
		suffix: "int.cv",
		reversed: "vc.tni"
	},
	{
		suffix: "nome.cv",
		reversed: "vc.emon"
	},
	{
		suffix: "org.cv",
		reversed: "vc.gro"
	},
	{
		suffix: "cw",
		reversed: "wc"
	},
	{
		suffix: "com.cw",
		reversed: "wc.moc"
	},
	{
		suffix: "edu.cw",
		reversed: "wc.ude"
	},
	{
		suffix: "net.cw",
		reversed: "wc.ten"
	},
	{
		suffix: "org.cw",
		reversed: "wc.gro"
	},
	{
		suffix: "cx",
		reversed: "xc"
	},
	{
		suffix: "gov.cx",
		reversed: "xc.vog"
	},
	{
		suffix: "cy",
		reversed: "yc"
	},
	{
		suffix: "ac.cy",
		reversed: "yc.ca"
	},
	{
		suffix: "biz.cy",
		reversed: "yc.zib"
	},
	{
		suffix: "com.cy",
		reversed: "yc.moc"
	},
	{
		suffix: "ekloges.cy",
		reversed: "yc.segolke"
	},
	{
		suffix: "gov.cy",
		reversed: "yc.vog"
	},
	{
		suffix: "ltd.cy",
		reversed: "yc.dtl"
	},
	{
		suffix: "mil.cy",
		reversed: "yc.lim"
	},
	{
		suffix: "net.cy",
		reversed: "yc.ten"
	},
	{
		suffix: "org.cy",
		reversed: "yc.gro"
	},
	{
		suffix: "press.cy",
		reversed: "yc.sserp"
	},
	{
		suffix: "pro.cy",
		reversed: "yc.orp"
	},
	{
		suffix: "tm.cy",
		reversed: "yc.mt"
	},
	{
		suffix: "cz",
		reversed: "zc"
	},
	{
		suffix: "de",
		reversed: "ed"
	},
	{
		suffix: "dj",
		reversed: "jd"
	},
	{
		suffix: "dk",
		reversed: "kd"
	},
	{
		suffix: "dm",
		reversed: "md"
	},
	{
		suffix: "com.dm",
		reversed: "md.moc"
	},
	{
		suffix: "net.dm",
		reversed: "md.ten"
	},
	{
		suffix: "org.dm",
		reversed: "md.gro"
	},
	{
		suffix: "edu.dm",
		reversed: "md.ude"
	},
	{
		suffix: "gov.dm",
		reversed: "md.vog"
	},
	{
		suffix: "do",
		reversed: "od"
	},
	{
		suffix: "art.do",
		reversed: "od.tra"
	},
	{
		suffix: "com.do",
		reversed: "od.moc"
	},
	{
		suffix: "edu.do",
		reversed: "od.ude"
	},
	{
		suffix: "gob.do",
		reversed: "od.bog"
	},
	{
		suffix: "gov.do",
		reversed: "od.vog"
	},
	{
		suffix: "mil.do",
		reversed: "od.lim"
	},
	{
		suffix: "net.do",
		reversed: "od.ten"
	},
	{
		suffix: "org.do",
		reversed: "od.gro"
	},
	{
		suffix: "sld.do",
		reversed: "od.dls"
	},
	{
		suffix: "web.do",
		reversed: "od.bew"
	},
	{
		suffix: "dz",
		reversed: "zd"
	},
	{
		suffix: "art.dz",
		reversed: "zd.tra"
	},
	{
		suffix: "asso.dz",
		reversed: "zd.ossa"
	},
	{
		suffix: "com.dz",
		reversed: "zd.moc"
	},
	{
		suffix: "edu.dz",
		reversed: "zd.ude"
	},
	{
		suffix: "gov.dz",
		reversed: "zd.vog"
	},
	{
		suffix: "org.dz",
		reversed: "zd.gro"
	},
	{
		suffix: "net.dz",
		reversed: "zd.ten"
	},
	{
		suffix: "pol.dz",
		reversed: "zd.lop"
	},
	{
		suffix: "soc.dz",
		reversed: "zd.cos"
	},
	{
		suffix: "tm.dz",
		reversed: "zd.mt"
	},
	{
		suffix: "ec",
		reversed: "ce"
	},
	{
		suffix: "com.ec",
		reversed: "ce.moc"
	},
	{
		suffix: "info.ec",
		reversed: "ce.ofni"
	},
	{
		suffix: "net.ec",
		reversed: "ce.ten"
	},
	{
		suffix: "fin.ec",
		reversed: "ce.nif"
	},
	{
		suffix: "k12.ec",
		reversed: "ce.21k"
	},
	{
		suffix: "med.ec",
		reversed: "ce.dem"
	},
	{
		suffix: "pro.ec",
		reversed: "ce.orp"
	},
	{
		suffix: "org.ec",
		reversed: "ce.gro"
	},
	{
		suffix: "edu.ec",
		reversed: "ce.ude"
	},
	{
		suffix: "gov.ec",
		reversed: "ce.vog"
	},
	{
		suffix: "gob.ec",
		reversed: "ce.bog"
	},
	{
		suffix: "mil.ec",
		reversed: "ce.lim"
	},
	{
		suffix: "edu",
		reversed: "ude"
	},
	{
		suffix: "ee",
		reversed: "ee"
	},
	{
		suffix: "edu.ee",
		reversed: "ee.ude"
	},
	{
		suffix: "gov.ee",
		reversed: "ee.vog"
	},
	{
		suffix: "riik.ee",
		reversed: "ee.kiir"
	},
	{
		suffix: "lib.ee",
		reversed: "ee.bil"
	},
	{
		suffix: "med.ee",
		reversed: "ee.dem"
	},
	{
		suffix: "com.ee",
		reversed: "ee.moc"
	},
	{
		suffix: "pri.ee",
		reversed: "ee.irp"
	},
	{
		suffix: "aip.ee",
		reversed: "ee.pia"
	},
	{
		suffix: "org.ee",
		reversed: "ee.gro"
	},
	{
		suffix: "fie.ee",
		reversed: "ee.eif"
	},
	{
		suffix: "eg",
		reversed: "ge"
	},
	{
		suffix: "com.eg",
		reversed: "ge.moc"
	},
	{
		suffix: "edu.eg",
		reversed: "ge.ude"
	},
	{
		suffix: "eun.eg",
		reversed: "ge.nue"
	},
	{
		suffix: "gov.eg",
		reversed: "ge.vog"
	},
	{
		suffix: "mil.eg",
		reversed: "ge.lim"
	},
	{
		suffix: "name.eg",
		reversed: "ge.eman"
	},
	{
		suffix: "net.eg",
		reversed: "ge.ten"
	},
	{
		suffix: "org.eg",
		reversed: "ge.gro"
	},
	{
		suffix: "sci.eg",
		reversed: "ge.ics"
	},
	{
		suffix: "*.er",
		reversed: "re"
	},
	{
		suffix: "es",
		reversed: "se"
	},
	{
		suffix: "com.es",
		reversed: "se.moc"
	},
	{
		suffix: "nom.es",
		reversed: "se.mon"
	},
	{
		suffix: "org.es",
		reversed: "se.gro"
	},
	{
		suffix: "gob.es",
		reversed: "se.bog"
	},
	{
		suffix: "edu.es",
		reversed: "se.ude"
	},
	{
		suffix: "et",
		reversed: "te"
	},
	{
		suffix: "com.et",
		reversed: "te.moc"
	},
	{
		suffix: "gov.et",
		reversed: "te.vog"
	},
	{
		suffix: "org.et",
		reversed: "te.gro"
	},
	{
		suffix: "edu.et",
		reversed: "te.ude"
	},
	{
		suffix: "biz.et",
		reversed: "te.zib"
	},
	{
		suffix: "name.et",
		reversed: "te.eman"
	},
	{
		suffix: "info.et",
		reversed: "te.ofni"
	},
	{
		suffix: "net.et",
		reversed: "te.ten"
	},
	{
		suffix: "eu",
		reversed: "ue"
	},
	{
		suffix: "fi",
		reversed: "if"
	},
	{
		suffix: "aland.fi",
		reversed: "if.dnala"
	},
	{
		suffix: "fj",
		reversed: "jf"
	},
	{
		suffix: "ac.fj",
		reversed: "jf.ca"
	},
	{
		suffix: "biz.fj",
		reversed: "jf.zib"
	},
	{
		suffix: "com.fj",
		reversed: "jf.moc"
	},
	{
		suffix: "gov.fj",
		reversed: "jf.vog"
	},
	{
		suffix: "info.fj",
		reversed: "jf.ofni"
	},
	{
		suffix: "mil.fj",
		reversed: "jf.lim"
	},
	{
		suffix: "name.fj",
		reversed: "jf.eman"
	},
	{
		suffix: "net.fj",
		reversed: "jf.ten"
	},
	{
		suffix: "org.fj",
		reversed: "jf.gro"
	},
	{
		suffix: "pro.fj",
		reversed: "jf.orp"
	},
	{
		suffix: "*.fk",
		reversed: "kf"
	},
	{
		suffix: "com.fm",
		reversed: "mf.moc"
	},
	{
		suffix: "edu.fm",
		reversed: "mf.ude"
	},
	{
		suffix: "net.fm",
		reversed: "mf.ten"
	},
	{
		suffix: "org.fm",
		reversed: "mf.gro"
	},
	{
		suffix: "fm",
		reversed: "mf"
	},
	{
		suffix: "fo",
		reversed: "of"
	},
	{
		suffix: "fr",
		reversed: "rf"
	},
	{
		suffix: "asso.fr",
		reversed: "rf.ossa"
	},
	{
		suffix: "com.fr",
		reversed: "rf.moc"
	},
	{
		suffix: "gouv.fr",
		reversed: "rf.vuog"
	},
	{
		suffix: "nom.fr",
		reversed: "rf.mon"
	},
	{
		suffix: "prd.fr",
		reversed: "rf.drp"
	},
	{
		suffix: "tm.fr",
		reversed: "rf.mt"
	},
	{
		suffix: "aeroport.fr",
		reversed: "rf.troporea"
	},
	{
		suffix: "avocat.fr",
		reversed: "rf.tacova"
	},
	{
		suffix: "avoues.fr",
		reversed: "rf.seuova"
	},
	{
		suffix: "cci.fr",
		reversed: "rf.icc"
	},
	{
		suffix: "chambagri.fr",
		reversed: "rf.irgabmahc"
	},
	{
		suffix: "chirurgiens-dentistes.fr",
		reversed: "rf.setsitned-sneigrurihc"
	},
	{
		suffix: "experts-comptables.fr",
		reversed: "rf.selbatpmoc-strepxe"
	},
	{
		suffix: "geometre-expert.fr",
		reversed: "rf.trepxe-ertemoeg"
	},
	{
		suffix: "greta.fr",
		reversed: "rf.aterg"
	},
	{
		suffix: "huissier-justice.fr",
		reversed: "rf.ecitsuj-reissiuh"
	},
	{
		suffix: "medecin.fr",
		reversed: "rf.nicedem"
	},
	{
		suffix: "notaires.fr",
		reversed: "rf.seriaton"
	},
	{
		suffix: "pharmacien.fr",
		reversed: "rf.neicamrahp"
	},
	{
		suffix: "port.fr",
		reversed: "rf.trop"
	},
	{
		suffix: "veterinaire.fr",
		reversed: "rf.erianiretev"
	},
	{
		suffix: "ga",
		reversed: "ag"
	},
	{
		suffix: "gb",
		reversed: "bg"
	},
	{
		suffix: "edu.gd",
		reversed: "dg.ude"
	},
	{
		suffix: "gov.gd",
		reversed: "dg.vog"
	},
	{
		suffix: "gd",
		reversed: "dg"
	},
	{
		suffix: "ge",
		reversed: "eg"
	},
	{
		suffix: "com.ge",
		reversed: "eg.moc"
	},
	{
		suffix: "edu.ge",
		reversed: "eg.ude"
	},
	{
		suffix: "gov.ge",
		reversed: "eg.vog"
	},
	{
		suffix: "org.ge",
		reversed: "eg.gro"
	},
	{
		suffix: "mil.ge",
		reversed: "eg.lim"
	},
	{
		suffix: "net.ge",
		reversed: "eg.ten"
	},
	{
		suffix: "pvt.ge",
		reversed: "eg.tvp"
	},
	{
		suffix: "gf",
		reversed: "fg"
	},
	{
		suffix: "gg",
		reversed: "gg"
	},
	{
		suffix: "co.gg",
		reversed: "gg.oc"
	},
	{
		suffix: "net.gg",
		reversed: "gg.ten"
	},
	{
		suffix: "org.gg",
		reversed: "gg.gro"
	},
	{
		suffix: "gh",
		reversed: "hg"
	},
	{
		suffix: "com.gh",
		reversed: "hg.moc"
	},
	{
		suffix: "edu.gh",
		reversed: "hg.ude"
	},
	{
		suffix: "gov.gh",
		reversed: "hg.vog"
	},
	{
		suffix: "org.gh",
		reversed: "hg.gro"
	},
	{
		suffix: "mil.gh",
		reversed: "hg.lim"
	},
	{
		suffix: "gi",
		reversed: "ig"
	},
	{
		suffix: "com.gi",
		reversed: "ig.moc"
	},
	{
		suffix: "ltd.gi",
		reversed: "ig.dtl"
	},
	{
		suffix: "gov.gi",
		reversed: "ig.vog"
	},
	{
		suffix: "mod.gi",
		reversed: "ig.dom"
	},
	{
		suffix: "edu.gi",
		reversed: "ig.ude"
	},
	{
		suffix: "org.gi",
		reversed: "ig.gro"
	},
	{
		suffix: "gl",
		reversed: "lg"
	},
	{
		suffix: "co.gl",
		reversed: "lg.oc"
	},
	{
		suffix: "com.gl",
		reversed: "lg.moc"
	},
	{
		suffix: "edu.gl",
		reversed: "lg.ude"
	},
	{
		suffix: "net.gl",
		reversed: "lg.ten"
	},
	{
		suffix: "org.gl",
		reversed: "lg.gro"
	},
	{
		suffix: "gm",
		reversed: "mg"
	},
	{
		suffix: "gn",
		reversed: "ng"
	},
	{
		suffix: "ac.gn",
		reversed: "ng.ca"
	},
	{
		suffix: "com.gn",
		reversed: "ng.moc"
	},
	{
		suffix: "edu.gn",
		reversed: "ng.ude"
	},
	{
		suffix: "gov.gn",
		reversed: "ng.vog"
	},
	{
		suffix: "org.gn",
		reversed: "ng.gro"
	},
	{
		suffix: "net.gn",
		reversed: "ng.ten"
	},
	{
		suffix: "gov",
		reversed: "vog"
	},
	{
		suffix: "gp",
		reversed: "pg"
	},
	{
		suffix: "com.gp",
		reversed: "pg.moc"
	},
	{
		suffix: "net.gp",
		reversed: "pg.ten"
	},
	{
		suffix: "mobi.gp",
		reversed: "pg.ibom"
	},
	{
		suffix: "edu.gp",
		reversed: "pg.ude"
	},
	{
		suffix: "org.gp",
		reversed: "pg.gro"
	},
	{
		suffix: "asso.gp",
		reversed: "pg.ossa"
	},
	{
		suffix: "gq",
		reversed: "qg"
	},
	{
		suffix: "gr",
		reversed: "rg"
	},
	{
		suffix: "com.gr",
		reversed: "rg.moc"
	},
	{
		suffix: "edu.gr",
		reversed: "rg.ude"
	},
	{
		suffix: "net.gr",
		reversed: "rg.ten"
	},
	{
		suffix: "org.gr",
		reversed: "rg.gro"
	},
	{
		suffix: "gov.gr",
		reversed: "rg.vog"
	},
	{
		suffix: "gs",
		reversed: "sg"
	},
	{
		suffix: "gt",
		reversed: "tg"
	},
	{
		suffix: "com.gt",
		reversed: "tg.moc"
	},
	{
		suffix: "edu.gt",
		reversed: "tg.ude"
	},
	{
		suffix: "gob.gt",
		reversed: "tg.bog"
	},
	{
		suffix: "ind.gt",
		reversed: "tg.dni"
	},
	{
		suffix: "mil.gt",
		reversed: "tg.lim"
	},
	{
		suffix: "net.gt",
		reversed: "tg.ten"
	},
	{
		suffix: "org.gt",
		reversed: "tg.gro"
	},
	{
		suffix: "gu",
		reversed: "ug"
	},
	{
		suffix: "com.gu",
		reversed: "ug.moc"
	},
	{
		suffix: "edu.gu",
		reversed: "ug.ude"
	},
	{
		suffix: "gov.gu",
		reversed: "ug.vog"
	},
	{
		suffix: "guam.gu",
		reversed: "ug.maug"
	},
	{
		suffix: "info.gu",
		reversed: "ug.ofni"
	},
	{
		suffix: "net.gu",
		reversed: "ug.ten"
	},
	{
		suffix: "org.gu",
		reversed: "ug.gro"
	},
	{
		suffix: "web.gu",
		reversed: "ug.bew"
	},
	{
		suffix: "gw",
		reversed: "wg"
	},
	{
		suffix: "gy",
		reversed: "yg"
	},
	{
		suffix: "co.gy",
		reversed: "yg.oc"
	},
	{
		suffix: "com.gy",
		reversed: "yg.moc"
	},
	{
		suffix: "edu.gy",
		reversed: "yg.ude"
	},
	{
		suffix: "gov.gy",
		reversed: "yg.vog"
	},
	{
		suffix: "net.gy",
		reversed: "yg.ten"
	},
	{
		suffix: "org.gy",
		reversed: "yg.gro"
	},
	{
		suffix: "hk",
		reversed: "kh"
	},
	{
		suffix: "com.hk",
		reversed: "kh.moc"
	},
	{
		suffix: "edu.hk",
		reversed: "kh.ude"
	},
	{
		suffix: "gov.hk",
		reversed: "kh.vog"
	},
	{
		suffix: "idv.hk",
		reversed: "kh.vdi"
	},
	{
		suffix: "net.hk",
		reversed: "kh.ten"
	},
	{
		suffix: "org.hk",
		reversed: "kh.gro"
	},
	{
		suffix: "公司.hk",
		reversed: "kh.d5xq55--nx"
	},
	{
		suffix: "教育.hk",
		reversed: "kh.d22svcw--nx"
	},
	{
		suffix: "敎育.hk",
		reversed: "kh.d23rvcl--nx"
	},
	{
		suffix: "政府.hk",
		reversed: "kh.m1qtxm--nx"
	},
	{
		suffix: "個人.hk",
		reversed: "kh.a5wqmg--nx"
	},
	{
		suffix: "个人.hk",
		reversed: "kh.npqic--nx"
	},
	{
		suffix: "箇人.hk",
		reversed: "kh.i050qmg--nx"
	},
	{
		suffix: "網络.hk",
		reversed: "kh.xva0fz--nx"
	},
	{
		suffix: "网络.hk",
		reversed: "kh.i7a0oi--nx"
	},
	{
		suffix: "组織.hk",
		reversed: "kh.ixa0km--nx"
	},
	{
		suffix: "網絡.hk",
		reversed: "kh.gla0do--nx"
	},
	{
		suffix: "网絡.hk",
		reversed: "kh.b3qa0do--nx"
	},
	{
		suffix: "组织.hk",
		reversed: "kh.ga0nt--nx"
	},
	{
		suffix: "組織.hk",
		reversed: "kh.vta0cu--nx"
	},
	{
		suffix: "組织.hk",
		reversed: "kh.a4ya0cu--nx"
	},
	{
		suffix: "hm",
		reversed: "mh"
	},
	{
		suffix: "hn",
		reversed: "nh"
	},
	{
		suffix: "com.hn",
		reversed: "nh.moc"
	},
	{
		suffix: "edu.hn",
		reversed: "nh.ude"
	},
	{
		suffix: "org.hn",
		reversed: "nh.gro"
	},
	{
		suffix: "net.hn",
		reversed: "nh.ten"
	},
	{
		suffix: "mil.hn",
		reversed: "nh.lim"
	},
	{
		suffix: "gob.hn",
		reversed: "nh.bog"
	},
	{
		suffix: "hr",
		reversed: "rh"
	},
	{
		suffix: "iz.hr",
		reversed: "rh.zi"
	},
	{
		suffix: "from.hr",
		reversed: "rh.morf"
	},
	{
		suffix: "name.hr",
		reversed: "rh.eman"
	},
	{
		suffix: "com.hr",
		reversed: "rh.moc"
	},
	{
		suffix: "ht",
		reversed: "th"
	},
	{
		suffix: "com.ht",
		reversed: "th.moc"
	},
	{
		suffix: "shop.ht",
		reversed: "th.pohs"
	},
	{
		suffix: "firm.ht",
		reversed: "th.mrif"
	},
	{
		suffix: "info.ht",
		reversed: "th.ofni"
	},
	{
		suffix: "adult.ht",
		reversed: "th.tluda"
	},
	{
		suffix: "net.ht",
		reversed: "th.ten"
	},
	{
		suffix: "pro.ht",
		reversed: "th.orp"
	},
	{
		suffix: "org.ht",
		reversed: "th.gro"
	},
	{
		suffix: "med.ht",
		reversed: "th.dem"
	},
	{
		suffix: "art.ht",
		reversed: "th.tra"
	},
	{
		suffix: "coop.ht",
		reversed: "th.pooc"
	},
	{
		suffix: "pol.ht",
		reversed: "th.lop"
	},
	{
		suffix: "asso.ht",
		reversed: "th.ossa"
	},
	{
		suffix: "edu.ht",
		reversed: "th.ude"
	},
	{
		suffix: "rel.ht",
		reversed: "th.ler"
	},
	{
		suffix: "gouv.ht",
		reversed: "th.vuog"
	},
	{
		suffix: "perso.ht",
		reversed: "th.osrep"
	},
	{
		suffix: "hu",
		reversed: "uh"
	},
	{
		suffix: "co.hu",
		reversed: "uh.oc"
	},
	{
		suffix: "info.hu",
		reversed: "uh.ofni"
	},
	{
		suffix: "org.hu",
		reversed: "uh.gro"
	},
	{
		suffix: "priv.hu",
		reversed: "uh.virp"
	},
	{
		suffix: "sport.hu",
		reversed: "uh.trops"
	},
	{
		suffix: "tm.hu",
		reversed: "uh.mt"
	},
	{
		suffix: "2000.hu",
		reversed: "uh.0002"
	},
	{
		suffix: "agrar.hu",
		reversed: "uh.rarga"
	},
	{
		suffix: "bolt.hu",
		reversed: "uh.tlob"
	},
	{
		suffix: "casino.hu",
		reversed: "uh.onisac"
	},
	{
		suffix: "city.hu",
		reversed: "uh.ytic"
	},
	{
		suffix: "erotica.hu",
		reversed: "uh.acitore"
	},
	{
		suffix: "erotika.hu",
		reversed: "uh.akitore"
	},
	{
		suffix: "film.hu",
		reversed: "uh.mlif"
	},
	{
		suffix: "forum.hu",
		reversed: "uh.murof"
	},
	{
		suffix: "games.hu",
		reversed: "uh.semag"
	},
	{
		suffix: "hotel.hu",
		reversed: "uh.letoh"
	},
	{
		suffix: "ingatlan.hu",
		reversed: "uh.naltagni"
	},
	{
		suffix: "jogasz.hu",
		reversed: "uh.zsagoj"
	},
	{
		suffix: "konyvelo.hu",
		reversed: "uh.olevynok"
	},
	{
		suffix: "lakas.hu",
		reversed: "uh.sakal"
	},
	{
		suffix: "media.hu",
		reversed: "uh.aidem"
	},
	{
		suffix: "news.hu",
		reversed: "uh.swen"
	},
	{
		suffix: "reklam.hu",
		reversed: "uh.malker"
	},
	{
		suffix: "sex.hu",
		reversed: "uh.xes"
	},
	{
		suffix: "shop.hu",
		reversed: "uh.pohs"
	},
	{
		suffix: "suli.hu",
		reversed: "uh.ilus"
	},
	{
		suffix: "szex.hu",
		reversed: "uh.xezs"
	},
	{
		suffix: "tozsde.hu",
		reversed: "uh.edszot"
	},
	{
		suffix: "utazas.hu",
		reversed: "uh.sazatu"
	},
	{
		suffix: "video.hu",
		reversed: "uh.oediv"
	},
	{
		suffix: "id",
		reversed: "di"
	},
	{
		suffix: "ac.id",
		reversed: "di.ca"
	},
	{
		suffix: "biz.id",
		reversed: "di.zib"
	},
	{
		suffix: "co.id",
		reversed: "di.oc"
	},
	{
		suffix: "desa.id",
		reversed: "di.ased"
	},
	{
		suffix: "go.id",
		reversed: "di.og"
	},
	{
		suffix: "mil.id",
		reversed: "di.lim"
	},
	{
		suffix: "my.id",
		reversed: "di.ym"
	},
	{
		suffix: "net.id",
		reversed: "di.ten"
	},
	{
		suffix: "or.id",
		reversed: "di.ro"
	},
	{
		suffix: "ponpes.id",
		reversed: "di.sepnop"
	},
	{
		suffix: "sch.id",
		reversed: "di.hcs"
	},
	{
		suffix: "web.id",
		reversed: "di.bew"
	},
	{
		suffix: "ie",
		reversed: "ei"
	},
	{
		suffix: "gov.ie",
		reversed: "ei.vog"
	},
	{
		suffix: "il",
		reversed: "li"
	},
	{
		suffix: "ac.il",
		reversed: "li.ca"
	},
	{
		suffix: "co.il",
		reversed: "li.oc"
	},
	{
		suffix: "gov.il",
		reversed: "li.vog"
	},
	{
		suffix: "idf.il",
		reversed: "li.fdi"
	},
	{
		suffix: "k12.il",
		reversed: "li.21k"
	},
	{
		suffix: "muni.il",
		reversed: "li.inum"
	},
	{
		suffix: "net.il",
		reversed: "li.ten"
	},
	{
		suffix: "org.il",
		reversed: "li.gro"
	},
	{
		suffix: "ישראל",
		reversed: "ec0krbd4--nx"
	},
	{
		suffix: "אקדמיה.ישראל",
		reversed: "ec0krbd4--nx.c6ytdgbd4--nx"
	},
	{
		suffix: "ישוב.ישראל",
		reversed: "ec0krbd4--nx.d8lhbd5--nx"
	},
	{
		suffix: "צהל.ישראל",
		reversed: "ec0krbd4--nx.a2qbd8--nx"
	},
	{
		suffix: "ממשל.ישראל",
		reversed: "ec0krbd4--nx.b8adbeh--nx"
	},
	{
		suffix: "im",
		reversed: "mi"
	},
	{
		suffix: "ac.im",
		reversed: "mi.ca"
	},
	{
		suffix: "co.im",
		reversed: "mi.oc"
	},
	{
		suffix: "com.im",
		reversed: "mi.moc"
	},
	{
		suffix: "ltd.co.im",
		reversed: "mi.oc.dtl"
	},
	{
		suffix: "net.im",
		reversed: "mi.ten"
	},
	{
		suffix: "org.im",
		reversed: "mi.gro"
	},
	{
		suffix: "plc.co.im",
		reversed: "mi.oc.clp"
	},
	{
		suffix: "tt.im",
		reversed: "mi.tt"
	},
	{
		suffix: "tv.im",
		reversed: "mi.vt"
	},
	{
		suffix: "in",
		reversed: "ni"
	},
	{
		suffix: "5g.in",
		reversed: "ni.g5"
	},
	{
		suffix: "6g.in",
		reversed: "ni.g6"
	},
	{
		suffix: "ac.in",
		reversed: "ni.ca"
	},
	{
		suffix: "ai.in",
		reversed: "ni.ia"
	},
	{
		suffix: "am.in",
		reversed: "ni.ma"
	},
	{
		suffix: "bihar.in",
		reversed: "ni.rahib"
	},
	{
		suffix: "biz.in",
		reversed: "ni.zib"
	},
	{
		suffix: "business.in",
		reversed: "ni.ssenisub"
	},
	{
		suffix: "ca.in",
		reversed: "ni.ac"
	},
	{
		suffix: "cn.in",
		reversed: "ni.nc"
	},
	{
		suffix: "co.in",
		reversed: "ni.oc"
	},
	{
		suffix: "com.in",
		reversed: "ni.moc"
	},
	{
		suffix: "coop.in",
		reversed: "ni.pooc"
	},
	{
		suffix: "cs.in",
		reversed: "ni.sc"
	},
	{
		suffix: "delhi.in",
		reversed: "ni.ihled"
	},
	{
		suffix: "dr.in",
		reversed: "ni.rd"
	},
	{
		suffix: "edu.in",
		reversed: "ni.ude"
	},
	{
		suffix: "er.in",
		reversed: "ni.re"
	},
	{
		suffix: "firm.in",
		reversed: "ni.mrif"
	},
	{
		suffix: "gen.in",
		reversed: "ni.neg"
	},
	{
		suffix: "gov.in",
		reversed: "ni.vog"
	},
	{
		suffix: "gujarat.in",
		reversed: "ni.tarajug"
	},
	{
		suffix: "ind.in",
		reversed: "ni.dni"
	},
	{
		suffix: "info.in",
		reversed: "ni.ofni"
	},
	{
		suffix: "int.in",
		reversed: "ni.tni"
	},
	{
		suffix: "internet.in",
		reversed: "ni.tenretni"
	},
	{
		suffix: "io.in",
		reversed: "ni.oi"
	},
	{
		suffix: "me.in",
		reversed: "ni.em"
	},
	{
		suffix: "mil.in",
		reversed: "ni.lim"
	},
	{
		suffix: "net.in",
		reversed: "ni.ten"
	},
	{
		suffix: "nic.in",
		reversed: "ni.cin"
	},
	{
		suffix: "org.in",
		reversed: "ni.gro"
	},
	{
		suffix: "pg.in",
		reversed: "ni.gp"
	},
	{
		suffix: "post.in",
		reversed: "ni.tsop"
	},
	{
		suffix: "pro.in",
		reversed: "ni.orp"
	},
	{
		suffix: "res.in",
		reversed: "ni.ser"
	},
	{
		suffix: "travel.in",
		reversed: "ni.levart"
	},
	{
		suffix: "tv.in",
		reversed: "ni.vt"
	},
	{
		suffix: "uk.in",
		reversed: "ni.ku"
	},
	{
		suffix: "up.in",
		reversed: "ni.pu"
	},
	{
		suffix: "us.in",
		reversed: "ni.su"
	},
	{
		suffix: "info",
		reversed: "ofni"
	},
	{
		suffix: "int",
		reversed: "tni"
	},
	{
		suffix: "eu.int",
		reversed: "tni.ue"
	},
	{
		suffix: "io",
		reversed: "oi"
	},
	{
		suffix: "com.io",
		reversed: "oi.moc"
	},
	{
		suffix: "iq",
		reversed: "qi"
	},
	{
		suffix: "gov.iq",
		reversed: "qi.vog"
	},
	{
		suffix: "edu.iq",
		reversed: "qi.ude"
	},
	{
		suffix: "mil.iq",
		reversed: "qi.lim"
	},
	{
		suffix: "com.iq",
		reversed: "qi.moc"
	},
	{
		suffix: "org.iq",
		reversed: "qi.gro"
	},
	{
		suffix: "net.iq",
		reversed: "qi.ten"
	},
	{
		suffix: "ir",
		reversed: "ri"
	},
	{
		suffix: "ac.ir",
		reversed: "ri.ca"
	},
	{
		suffix: "co.ir",
		reversed: "ri.oc"
	},
	{
		suffix: "gov.ir",
		reversed: "ri.vog"
	},
	{
		suffix: "id.ir",
		reversed: "ri.di"
	},
	{
		suffix: "net.ir",
		reversed: "ri.ten"
	},
	{
		suffix: "org.ir",
		reversed: "ri.gro"
	},
	{
		suffix: "sch.ir",
		reversed: "ri.hcs"
	},
	{
		suffix: "ایران.ir",
		reversed: "ri.a61f4a3abgm--nx"
	},
	{
		suffix: "ايران.ir",
		reversed: "ri.arf4a3abgm--nx"
	},
	{
		suffix: "is",
		reversed: "si"
	},
	{
		suffix: "net.is",
		reversed: "si.ten"
	},
	{
		suffix: "com.is",
		reversed: "si.moc"
	},
	{
		suffix: "edu.is",
		reversed: "si.ude"
	},
	{
		suffix: "gov.is",
		reversed: "si.vog"
	},
	{
		suffix: "org.is",
		reversed: "si.gro"
	},
	{
		suffix: "int.is",
		reversed: "si.tni"
	},
	{
		suffix: "it",
		reversed: "ti"
	},
	{
		suffix: "gov.it",
		reversed: "ti.vog"
	},
	{
		suffix: "edu.it",
		reversed: "ti.ude"
	},
	{
		suffix: "abr.it",
		reversed: "ti.rba"
	},
	{
		suffix: "abruzzo.it",
		reversed: "ti.ozzurba"
	},
	{
		suffix: "aosta-valley.it",
		reversed: "ti.yellav-atsoa"
	},
	{
		suffix: "aostavalley.it",
		reversed: "ti.yellavatsoa"
	},
	{
		suffix: "bas.it",
		reversed: "ti.sab"
	},
	{
		suffix: "basilicata.it",
		reversed: "ti.atacilisab"
	},
	{
		suffix: "cal.it",
		reversed: "ti.lac"
	},
	{
		suffix: "calabria.it",
		reversed: "ti.airbalac"
	},
	{
		suffix: "cam.it",
		reversed: "ti.mac"
	},
	{
		suffix: "campania.it",
		reversed: "ti.ainapmac"
	},
	{
		suffix: "emilia-romagna.it",
		reversed: "ti.angamor-ailime"
	},
	{
		suffix: "emiliaromagna.it",
		reversed: "ti.angamorailime"
	},
	{
		suffix: "emr.it",
		reversed: "ti.rme"
	},
	{
		suffix: "friuli-v-giulia.it",
		reversed: "ti.ailuig-v-iluirf"
	},
	{
		suffix: "friuli-ve-giulia.it",
		reversed: "ti.ailuig-ev-iluirf"
	},
	{
		suffix: "friuli-vegiulia.it",
		reversed: "ti.ailuigev-iluirf"
	},
	{
		suffix: "friuli-venezia-giulia.it",
		reversed: "ti.ailuig-aizenev-iluirf"
	},
	{
		suffix: "friuli-veneziagiulia.it",
		reversed: "ti.ailuigaizenev-iluirf"
	},
	{
		suffix: "friuli-vgiulia.it",
		reversed: "ti.ailuigv-iluirf"
	},
	{
		suffix: "friuliv-giulia.it",
		reversed: "ti.ailuig-viluirf"
	},
	{
		suffix: "friulive-giulia.it",
		reversed: "ti.ailuig-eviluirf"
	},
	{
		suffix: "friulivegiulia.it",
		reversed: "ti.ailuigeviluirf"
	},
	{
		suffix: "friulivenezia-giulia.it",
		reversed: "ti.ailuig-aizeneviluirf"
	},
	{
		suffix: "friuliveneziagiulia.it",
		reversed: "ti.ailuigaizeneviluirf"
	},
	{
		suffix: "friulivgiulia.it",
		reversed: "ti.ailuigviluirf"
	},
	{
		suffix: "fvg.it",
		reversed: "ti.gvf"
	},
	{
		suffix: "laz.it",
		reversed: "ti.zal"
	},
	{
		suffix: "lazio.it",
		reversed: "ti.oizal"
	},
	{
		suffix: "lig.it",
		reversed: "ti.gil"
	},
	{
		suffix: "liguria.it",
		reversed: "ti.airugil"
	},
	{
		suffix: "lom.it",
		reversed: "ti.mol"
	},
	{
		suffix: "lombardia.it",
		reversed: "ti.aidrabmol"
	},
	{
		suffix: "lombardy.it",
		reversed: "ti.ydrabmol"
	},
	{
		suffix: "lucania.it",
		reversed: "ti.ainacul"
	},
	{
		suffix: "mar.it",
		reversed: "ti.ram"
	},
	{
		suffix: "marche.it",
		reversed: "ti.ehcram"
	},
	{
		suffix: "mol.it",
		reversed: "ti.lom"
	},
	{
		suffix: "molise.it",
		reversed: "ti.esilom"
	},
	{
		suffix: "piedmont.it",
		reversed: "ti.tnomdeip"
	},
	{
		suffix: "piemonte.it",
		reversed: "ti.etnomeip"
	},
	{
		suffix: "pmn.it",
		reversed: "ti.nmp"
	},
	{
		suffix: "pug.it",
		reversed: "ti.gup"
	},
	{
		suffix: "puglia.it",
		reversed: "ti.ailgup"
	},
	{
		suffix: "sar.it",
		reversed: "ti.ras"
	},
	{
		suffix: "sardegna.it",
		reversed: "ti.angedras"
	},
	{
		suffix: "sardinia.it",
		reversed: "ti.ainidras"
	},
	{
		suffix: "sic.it",
		reversed: "ti.cis"
	},
	{
		suffix: "sicilia.it",
		reversed: "ti.ailicis"
	},
	{
		suffix: "sicily.it",
		reversed: "ti.ylicis"
	},
	{
		suffix: "taa.it",
		reversed: "ti.aat"
	},
	{
		suffix: "tos.it",
		reversed: "ti.sot"
	},
	{
		suffix: "toscana.it",
		reversed: "ti.anacsot"
	},
	{
		suffix: "trentin-sud-tirol.it",
		reversed: "ti.lorit-dus-nitnert"
	},
	{
		suffix: "trentin-süd-tirol.it",
		reversed: "ti.bzr-lorit-ds-nitnert--nx"
	},
	{
		suffix: "trentin-sudtirol.it",
		reversed: "ti.loritdus-nitnert"
	},
	{
		suffix: "trentin-südtirol.it",
		reversed: "ti.bv7-loritds-nitnert--nx"
	},
	{
		suffix: "trentin-sued-tirol.it",
		reversed: "ti.lorit-deus-nitnert"
	},
	{
		suffix: "trentin-suedtirol.it",
		reversed: "ti.loritdeus-nitnert"
	},
	{
		suffix: "trentino-a-adige.it",
		reversed: "ti.egida-a-onitnert"
	},
	{
		suffix: "trentino-aadige.it",
		reversed: "ti.egidaa-onitnert"
	},
	{
		suffix: "trentino-alto-adige.it",
		reversed: "ti.egida-otla-onitnert"
	},
	{
		suffix: "trentino-altoadige.it",
		reversed: "ti.egidaotla-onitnert"
	},
	{
		suffix: "trentino-s-tirol.it",
		reversed: "ti.lorit-s-onitnert"
	},
	{
		suffix: "trentino-stirol.it",
		reversed: "ti.lorits-onitnert"
	},
	{
		suffix: "trentino-sud-tirol.it",
		reversed: "ti.lorit-dus-onitnert"
	},
	{
		suffix: "trentino-süd-tirol.it",
		reversed: "ti.b3c-lorit-ds-onitnert--nx"
	},
	{
		suffix: "trentino-sudtirol.it",
		reversed: "ti.loritdus-onitnert"
	},
	{
		suffix: "trentino-südtirol.it",
		reversed: "ti.bzs-loritds-onitnert--nx"
	},
	{
		suffix: "trentino-sued-tirol.it",
		reversed: "ti.lorit-deus-onitnert"
	},
	{
		suffix: "trentino-suedtirol.it",
		reversed: "ti.loritdeus-onitnert"
	},
	{
		suffix: "trentino.it",
		reversed: "ti.onitnert"
	},
	{
		suffix: "trentinoa-adige.it",
		reversed: "ti.egida-aonitnert"
	},
	{
		suffix: "trentinoaadige.it",
		reversed: "ti.egidaaonitnert"
	},
	{
		suffix: "trentinoalto-adige.it",
		reversed: "ti.egida-otlaonitnert"
	},
	{
		suffix: "trentinoaltoadige.it",
		reversed: "ti.egidaotlaonitnert"
	},
	{
		suffix: "trentinos-tirol.it",
		reversed: "ti.lorit-sonitnert"
	},
	{
		suffix: "trentinostirol.it",
		reversed: "ti.loritsonitnert"
	},
	{
		suffix: "trentinosud-tirol.it",
		reversed: "ti.lorit-dusonitnert"
	},
	{
		suffix: "trentinosüd-tirol.it",
		reversed: "ti.bzr-lorit-dsonitnert--nx"
	},
	{
		suffix: "trentinosudtirol.it",
		reversed: "ti.loritdusonitnert"
	},
	{
		suffix: "trentinosüdtirol.it",
		reversed: "ti.bv7-loritdsonitnert--nx"
	},
	{
		suffix: "trentinosued-tirol.it",
		reversed: "ti.lorit-deusonitnert"
	},
	{
		suffix: "trentinosuedtirol.it",
		reversed: "ti.loritdeusonitnert"
	},
	{
		suffix: "trentinsud-tirol.it",
		reversed: "ti.lorit-dusnitnert"
	},
	{
		suffix: "trentinsüd-tirol.it",
		reversed: "ti.bv6-lorit-dsnitnert--nx"
	},
	{
		suffix: "trentinsudtirol.it",
		reversed: "ti.loritdusnitnert"
	},
	{
		suffix: "trentinsüdtirol.it",
		reversed: "ti.bsn-loritdsnitnert--nx"
	},
	{
		suffix: "trentinsued-tirol.it",
		reversed: "ti.lorit-deusnitnert"
	},
	{
		suffix: "trentinsuedtirol.it",
		reversed: "ti.loritdeusnitnert"
	},
	{
		suffix: "tuscany.it",
		reversed: "ti.ynacsut"
	},
	{
		suffix: "umb.it",
		reversed: "ti.bmu"
	},
	{
		suffix: "umbria.it",
		reversed: "ti.airbmu"
	},
	{
		suffix: "val-d-aosta.it",
		reversed: "ti.atsoa-d-lav"
	},
	{
		suffix: "val-daosta.it",
		reversed: "ti.atsoad-lav"
	},
	{
		suffix: "vald-aosta.it",
		reversed: "ti.atsoa-dlav"
	},
	{
		suffix: "valdaosta.it",
		reversed: "ti.atsoadlav"
	},
	{
		suffix: "valle-aosta.it",
		reversed: "ti.atsoa-ellav"
	},
	{
		suffix: "valle-d-aosta.it",
		reversed: "ti.atsoa-d-ellav"
	},
	{
		suffix: "valle-daosta.it",
		reversed: "ti.atsoad-ellav"
	},
	{
		suffix: "valleaosta.it",
		reversed: "ti.atsoaellav"
	},
	{
		suffix: "valled-aosta.it",
		reversed: "ti.atsoa-dellav"
	},
	{
		suffix: "valledaosta.it",
		reversed: "ti.atsoadellav"
	},
	{
		suffix: "vallee-aoste.it",
		reversed: "ti.etsoa-eellav"
	},
	{
		suffix: "vallée-aoste.it",
		reversed: "ti.bbe-etsoa-ellav--nx"
	},
	{
		suffix: "vallee-d-aoste.it",
		reversed: "ti.etsoa-d-eellav"
	},
	{
		suffix: "vallée-d-aoste.it",
		reversed: "ti.bhe-etsoa-d-ellav--nx"
	},
	{
		suffix: "valleeaoste.it",
		reversed: "ti.etsoaeellav"
	},
	{
		suffix: "valléeaoste.it",
		reversed: "ti.a7e-etsoaellav--nx"
	},
	{
		suffix: "valleedaoste.it",
		reversed: "ti.etsoadeellav"
	},
	{
		suffix: "valléedaoste.it",
		reversed: "ti.bbe-etsoadellav--nx"
	},
	{
		suffix: "vao.it",
		reversed: "ti.oav"
	},
	{
		suffix: "vda.it",
		reversed: "ti.adv"
	},
	{
		suffix: "ven.it",
		reversed: "ti.nev"
	},
	{
		suffix: "veneto.it",
		reversed: "ti.otenev"
	},
	{
		suffix: "ag.it",
		reversed: "ti.ga"
	},
	{
		suffix: "agrigento.it",
		reversed: "ti.otnegirga"
	},
	{
		suffix: "al.it",
		reversed: "ti.la"
	},
	{
		suffix: "alessandria.it",
		reversed: "ti.airdnassela"
	},
	{
		suffix: "alto-adige.it",
		reversed: "ti.egida-otla"
	},
	{
		suffix: "altoadige.it",
		reversed: "ti.egidaotla"
	},
	{
		suffix: "an.it",
		reversed: "ti.na"
	},
	{
		suffix: "ancona.it",
		reversed: "ti.anocna"
	},
	{
		suffix: "andria-barletta-trani.it",
		reversed: "ti.inart-attelrab-airdna"
	},
	{
		suffix: "andria-trani-barletta.it",
		reversed: "ti.attelrab-inart-airdna"
	},
	{
		suffix: "andriabarlettatrani.it",
		reversed: "ti.inartattelrabairdna"
	},
	{
		suffix: "andriatranibarletta.it",
		reversed: "ti.attelrabinartairdna"
	},
	{
		suffix: "ao.it",
		reversed: "ti.oa"
	},
	{
		suffix: "aosta.it",
		reversed: "ti.atsoa"
	},
	{
		suffix: "aoste.it",
		reversed: "ti.etsoa"
	},
	{
		suffix: "ap.it",
		reversed: "ti.pa"
	},
	{
		suffix: "aq.it",
		reversed: "ti.qa"
	},
	{
		suffix: "aquila.it",
		reversed: "ti.aliuqa"
	},
	{
		suffix: "ar.it",
		reversed: "ti.ra"
	},
	{
		suffix: "arezzo.it",
		reversed: "ti.ozzera"
	},
	{
		suffix: "ascoli-piceno.it",
		reversed: "ti.onecip-ilocsa"
	},
	{
		suffix: "ascolipiceno.it",
		reversed: "ti.onecipilocsa"
	},
	{
		suffix: "asti.it",
		reversed: "ti.itsa"
	},
	{
		suffix: "at.it",
		reversed: "ti.ta"
	},
	{
		suffix: "av.it",
		reversed: "ti.va"
	},
	{
		suffix: "avellino.it",
		reversed: "ti.onilleva"
	},
	{
		suffix: "ba.it",
		reversed: "ti.ab"
	},
	{
		suffix: "balsan-sudtirol.it",
		reversed: "ti.loritdus-naslab"
	},
	{
		suffix: "balsan-südtirol.it",
		reversed: "ti.bsn-loritds-naslab--nx"
	},
	{
		suffix: "balsan-suedtirol.it",
		reversed: "ti.loritdeus-naslab"
	},
	{
		suffix: "balsan.it",
		reversed: "ti.naslab"
	},
	{
		suffix: "bari.it",
		reversed: "ti.irab"
	},
	{
		suffix: "barletta-trani-andria.it",
		reversed: "ti.airdna-inart-attelrab"
	},
	{
		suffix: "barlettatraniandria.it",
		reversed: "ti.airdnainartattelrab"
	},
	{
		suffix: "belluno.it",
		reversed: "ti.onulleb"
	},
	{
		suffix: "benevento.it",
		reversed: "ti.otneveneb"
	},
	{
		suffix: "bergamo.it",
		reversed: "ti.omagreb"
	},
	{
		suffix: "bg.it",
		reversed: "ti.gb"
	},
	{
		suffix: "bi.it",
		reversed: "ti.ib"
	},
	{
		suffix: "biella.it",
		reversed: "ti.alleib"
	},
	{
		suffix: "bl.it",
		reversed: "ti.lb"
	},
	{
		suffix: "bn.it",
		reversed: "ti.nb"
	},
	{
		suffix: "bo.it",
		reversed: "ti.ob"
	},
	{
		suffix: "bologna.it",
		reversed: "ti.angolob"
	},
	{
		suffix: "bolzano-altoadige.it",
		reversed: "ti.egidaotla-onazlob"
	},
	{
		suffix: "bolzano.it",
		reversed: "ti.onazlob"
	},
	{
		suffix: "bozen-sudtirol.it",
		reversed: "ti.loritdus-nezob"
	},
	{
		suffix: "bozen-südtirol.it",
		reversed: "ti.bo2-loritds-nezob--nx"
	},
	{
		suffix: "bozen-suedtirol.it",
		reversed: "ti.loritdeus-nezob"
	},
	{
		suffix: "bozen.it",
		reversed: "ti.nezob"
	},
	{
		suffix: "br.it",
		reversed: "ti.rb"
	},
	{
		suffix: "brescia.it",
		reversed: "ti.aicserb"
	},
	{
		suffix: "brindisi.it",
		reversed: "ti.isidnirb"
	},
	{
		suffix: "bs.it",
		reversed: "ti.sb"
	},
	{
		suffix: "bt.it",
		reversed: "ti.tb"
	},
	{
		suffix: "bulsan-sudtirol.it",
		reversed: "ti.loritdus-naslub"
	},
	{
		suffix: "bulsan-südtirol.it",
		reversed: "ti.bsn-loritds-naslub--nx"
	},
	{
		suffix: "bulsan-suedtirol.it",
		reversed: "ti.loritdeus-naslub"
	},
	{
		suffix: "bulsan.it",
		reversed: "ti.naslub"
	},
	{
		suffix: "bz.it",
		reversed: "ti.zb"
	},
	{
		suffix: "ca.it",
		reversed: "ti.ac"
	},
	{
		suffix: "cagliari.it",
		reversed: "ti.irailgac"
	},
	{
		suffix: "caltanissetta.it",
		reversed: "ti.attessinatlac"
	},
	{
		suffix: "campidano-medio.it",
		reversed: "ti.oidem-onadipmac"
	},
	{
		suffix: "campidanomedio.it",
		reversed: "ti.oidemonadipmac"
	},
	{
		suffix: "campobasso.it",
		reversed: "ti.ossabopmac"
	},
	{
		suffix: "carbonia-iglesias.it",
		reversed: "ti.saiselgi-ainobrac"
	},
	{
		suffix: "carboniaiglesias.it",
		reversed: "ti.saiselgiainobrac"
	},
	{
		suffix: "carrara-massa.it",
		reversed: "ti.assam-ararrac"
	},
	{
		suffix: "carraramassa.it",
		reversed: "ti.assamararrac"
	},
	{
		suffix: "caserta.it",
		reversed: "ti.atresac"
	},
	{
		suffix: "catania.it",
		reversed: "ti.ainatac"
	},
	{
		suffix: "catanzaro.it",
		reversed: "ti.oraznatac"
	},
	{
		suffix: "cb.it",
		reversed: "ti.bc"
	},
	{
		suffix: "ce.it",
		reversed: "ti.ec"
	},
	{
		suffix: "cesena-forli.it",
		reversed: "ti.ilrof-anesec"
	},
	{
		suffix: "cesena-forlì.it",
		reversed: "ti.bcm-lrof-anesec--nx"
	},
	{
		suffix: "cesenaforli.it",
		reversed: "ti.ilrofanesec"
	},
	{
		suffix: "cesenaforlì.it",
		reversed: "ti.a8i-lrofanesec--nx"
	},
	{
		suffix: "ch.it",
		reversed: "ti.hc"
	},
	{
		suffix: "chieti.it",
		reversed: "ti.iteihc"
	},
	{
		suffix: "ci.it",
		reversed: "ti.ic"
	},
	{
		suffix: "cl.it",
		reversed: "ti.lc"
	},
	{
		suffix: "cn.it",
		reversed: "ti.nc"
	},
	{
		suffix: "co.it",
		reversed: "ti.oc"
	},
	{
		suffix: "como.it",
		reversed: "ti.omoc"
	},
	{
		suffix: "cosenza.it",
		reversed: "ti.aznesoc"
	},
	{
		suffix: "cr.it",
		reversed: "ti.rc"
	},
	{
		suffix: "cremona.it",
		reversed: "ti.anomerc"
	},
	{
		suffix: "crotone.it",
		reversed: "ti.enotorc"
	},
	{
		suffix: "cs.it",
		reversed: "ti.sc"
	},
	{
		suffix: "ct.it",
		reversed: "ti.tc"
	},
	{
		suffix: "cuneo.it",
		reversed: "ti.oenuc"
	},
	{
		suffix: "cz.it",
		reversed: "ti.zc"
	},
	{
		suffix: "dell-ogliastra.it",
		reversed: "ti.artsailgo-lled"
	},
	{
		suffix: "dellogliastra.it",
		reversed: "ti.artsailgolled"
	},
	{
		suffix: "en.it",
		reversed: "ti.ne"
	},
	{
		suffix: "enna.it",
		reversed: "ti.anne"
	},
	{
		suffix: "fc.it",
		reversed: "ti.cf"
	},
	{
		suffix: "fe.it",
		reversed: "ti.ef"
	},
	{
		suffix: "fermo.it",
		reversed: "ti.omref"
	},
	{
		suffix: "ferrara.it",
		reversed: "ti.ararref"
	},
	{
		suffix: "fg.it",
		reversed: "ti.gf"
	},
	{
		suffix: "fi.it",
		reversed: "ti.if"
	},
	{
		suffix: "firenze.it",
		reversed: "ti.eznerif"
	},
	{
		suffix: "florence.it",
		reversed: "ti.ecnerolf"
	},
	{
		suffix: "fm.it",
		reversed: "ti.mf"
	},
	{
		suffix: "foggia.it",
		reversed: "ti.aiggof"
	},
	{
		suffix: "forli-cesena.it",
		reversed: "ti.anesec-ilrof"
	},
	{
		suffix: "forlì-cesena.it",
		reversed: "ti.bcf-anesec-lrof--nx"
	},
	{
		suffix: "forlicesena.it",
		reversed: "ti.anesecilrof"
	},
	{
		suffix: "forlìcesena.it",
		reversed: "ti.a8c-aneseclrof--nx"
	},
	{
		suffix: "fr.it",
		reversed: "ti.rf"
	},
	{
		suffix: "frosinone.it",
		reversed: "ti.enonisorf"
	},
	{
		suffix: "ge.it",
		reversed: "ti.eg"
	},
	{
		suffix: "genoa.it",
		reversed: "ti.aoneg"
	},
	{
		suffix: "genova.it",
		reversed: "ti.avoneg"
	},
	{
		suffix: "go.it",
		reversed: "ti.og"
	},
	{
		suffix: "gorizia.it",
		reversed: "ti.aizirog"
	},
	{
		suffix: "gr.it",
		reversed: "ti.rg"
	},
	{
		suffix: "grosseto.it",
		reversed: "ti.otessorg"
	},
	{
		suffix: "iglesias-carbonia.it",
		reversed: "ti.ainobrac-saiselgi"
	},
	{
		suffix: "iglesiascarbonia.it",
		reversed: "ti.ainobracsaiselgi"
	},
	{
		suffix: "im.it",
		reversed: "ti.mi"
	},
	{
		suffix: "imperia.it",
		reversed: "ti.airepmi"
	},
	{
		suffix: "is.it",
		reversed: "ti.si"
	},
	{
		suffix: "isernia.it",
		reversed: "ti.ainresi"
	},
	{
		suffix: "kr.it",
		reversed: "ti.rk"
	},
	{
		suffix: "la-spezia.it",
		reversed: "ti.aizeps-al"
	},
	{
		suffix: "laquila.it",
		reversed: "ti.aliuqal"
	},
	{
		suffix: "laspezia.it",
		reversed: "ti.aizepsal"
	},
	{
		suffix: "latina.it",
		reversed: "ti.anital"
	},
	{
		suffix: "lc.it",
		reversed: "ti.cl"
	},
	{
		suffix: "le.it",
		reversed: "ti.el"
	},
	{
		suffix: "lecce.it",
		reversed: "ti.eccel"
	},
	{
		suffix: "lecco.it",
		reversed: "ti.occel"
	},
	{
		suffix: "li.it",
		reversed: "ti.il"
	},
	{
		suffix: "livorno.it",
		reversed: "ti.onrovil"
	},
	{
		suffix: "lo.it",
		reversed: "ti.ol"
	},
	{
		suffix: "lodi.it",
		reversed: "ti.idol"
	},
	{
		suffix: "lt.it",
		reversed: "ti.tl"
	},
	{
		suffix: "lu.it",
		reversed: "ti.ul"
	},
	{
		suffix: "lucca.it",
		reversed: "ti.accul"
	},
	{
		suffix: "macerata.it",
		reversed: "ti.atarecam"
	},
	{
		suffix: "mantova.it",
		reversed: "ti.avotnam"
	},
	{
		suffix: "massa-carrara.it",
		reversed: "ti.ararrac-assam"
	},
	{
		suffix: "massacarrara.it",
		reversed: "ti.ararracassam"
	},
	{
		suffix: "matera.it",
		reversed: "ti.aretam"
	},
	{
		suffix: "mb.it",
		reversed: "ti.bm"
	},
	{
		suffix: "mc.it",
		reversed: "ti.cm"
	},
	{
		suffix: "me.it",
		reversed: "ti.em"
	},
	{
		suffix: "medio-campidano.it",
		reversed: "ti.onadipmac-oidem"
	},
	{
		suffix: "mediocampidano.it",
		reversed: "ti.onadipmacoidem"
	},
	{
		suffix: "messina.it",
		reversed: "ti.anissem"
	},
	{
		suffix: "mi.it",
		reversed: "ti.im"
	},
	{
		suffix: "milan.it",
		reversed: "ti.nalim"
	},
	{
		suffix: "milano.it",
		reversed: "ti.onalim"
	},
	{
		suffix: "mn.it",
		reversed: "ti.nm"
	},
	{
		suffix: "mo.it",
		reversed: "ti.om"
	},
	{
		suffix: "modena.it",
		reversed: "ti.anedom"
	},
	{
		suffix: "monza-brianza.it",
		reversed: "ti.aznairb-aznom"
	},
	{
		suffix: "monza-e-della-brianza.it",
		reversed: "ti.aznairb-alled-e-aznom"
	},
	{
		suffix: "monza.it",
		reversed: "ti.aznom"
	},
	{
		suffix: "monzabrianza.it",
		reversed: "ti.aznairbaznom"
	},
	{
		suffix: "monzaebrianza.it",
		reversed: "ti.aznairbeaznom"
	},
	{
		suffix: "monzaedellabrianza.it",
		reversed: "ti.aznairballedeaznom"
	},
	{
		suffix: "ms.it",
		reversed: "ti.sm"
	},
	{
		suffix: "mt.it",
		reversed: "ti.tm"
	},
	{
		suffix: "na.it",
		reversed: "ti.an"
	},
	{
		suffix: "naples.it",
		reversed: "ti.selpan"
	},
	{
		suffix: "napoli.it",
		reversed: "ti.ilopan"
	},
	{
		suffix: "no.it",
		reversed: "ti.on"
	},
	{
		suffix: "novara.it",
		reversed: "ti.aravon"
	},
	{
		suffix: "nu.it",
		reversed: "ti.un"
	},
	{
		suffix: "nuoro.it",
		reversed: "ti.oroun"
	},
	{
		suffix: "og.it",
		reversed: "ti.go"
	},
	{
		suffix: "ogliastra.it",
		reversed: "ti.artsailgo"
	},
	{
		suffix: "olbia-tempio.it",
		reversed: "ti.oipmet-aiblo"
	},
	{
		suffix: "olbiatempio.it",
		reversed: "ti.oipmetaiblo"
	},
	{
		suffix: "or.it",
		reversed: "ti.ro"
	},
	{
		suffix: "oristano.it",
		reversed: "ti.onatsiro"
	},
	{
		suffix: "ot.it",
		reversed: "ti.to"
	},
	{
		suffix: "pa.it",
		reversed: "ti.ap"
	},
	{
		suffix: "padova.it",
		reversed: "ti.avodap"
	},
	{
		suffix: "padua.it",
		reversed: "ti.audap"
	},
	{
		suffix: "palermo.it",
		reversed: "ti.omrelap"
	},
	{
		suffix: "parma.it",
		reversed: "ti.amrap"
	},
	{
		suffix: "pavia.it",
		reversed: "ti.aivap"
	},
	{
		suffix: "pc.it",
		reversed: "ti.cp"
	},
	{
		suffix: "pd.it",
		reversed: "ti.dp"
	},
	{
		suffix: "pe.it",
		reversed: "ti.ep"
	},
	{
		suffix: "perugia.it",
		reversed: "ti.aigurep"
	},
	{
		suffix: "pesaro-urbino.it",
		reversed: "ti.onibru-orasep"
	},
	{
		suffix: "pesarourbino.it",
		reversed: "ti.onibruorasep"
	},
	{
		suffix: "pescara.it",
		reversed: "ti.aracsep"
	},
	{
		suffix: "pg.it",
		reversed: "ti.gp"
	},
	{
		suffix: "pi.it",
		reversed: "ti.ip"
	},
	{
		suffix: "piacenza.it",
		reversed: "ti.aznecaip"
	},
	{
		suffix: "pisa.it",
		reversed: "ti.asip"
	},
	{
		suffix: "pistoia.it",
		reversed: "ti.aiotsip"
	},
	{
		suffix: "pn.it",
		reversed: "ti.np"
	},
	{
		suffix: "po.it",
		reversed: "ti.op"
	},
	{
		suffix: "pordenone.it",
		reversed: "ti.enonedrop"
	},
	{
		suffix: "potenza.it",
		reversed: "ti.aznetop"
	},
	{
		suffix: "pr.it",
		reversed: "ti.rp"
	},
	{
		suffix: "prato.it",
		reversed: "ti.otarp"
	},
	{
		suffix: "pt.it",
		reversed: "ti.tp"
	},
	{
		suffix: "pu.it",
		reversed: "ti.up"
	},
	{
		suffix: "pv.it",
		reversed: "ti.vp"
	},
	{
		suffix: "pz.it",
		reversed: "ti.zp"
	},
	{
		suffix: "ra.it",
		reversed: "ti.ar"
	},
	{
		suffix: "ragusa.it",
		reversed: "ti.asugar"
	},
	{
		suffix: "ravenna.it",
		reversed: "ti.annevar"
	},
	{
		suffix: "rc.it",
		reversed: "ti.cr"
	},
	{
		suffix: "re.it",
		reversed: "ti.er"
	},
	{
		suffix: "reggio-calabria.it",
		reversed: "ti.airbalac-oigger"
	},
	{
		suffix: "reggio-emilia.it",
		reversed: "ti.ailime-oigger"
	},
	{
		suffix: "reggiocalabria.it",
		reversed: "ti.airbalacoigger"
	},
	{
		suffix: "reggioemilia.it",
		reversed: "ti.ailimeoigger"
	},
	{
		suffix: "rg.it",
		reversed: "ti.gr"
	},
	{
		suffix: "ri.it",
		reversed: "ti.ir"
	},
	{
		suffix: "rieti.it",
		reversed: "ti.iteir"
	},
	{
		suffix: "rimini.it",
		reversed: "ti.inimir"
	},
	{
		suffix: "rm.it",
		reversed: "ti.mr"
	},
	{
		suffix: "rn.it",
		reversed: "ti.nr"
	},
	{
		suffix: "ro.it",
		reversed: "ti.or"
	},
	{
		suffix: "roma.it",
		reversed: "ti.amor"
	},
	{
		suffix: "rome.it",
		reversed: "ti.emor"
	},
	{
		suffix: "rovigo.it",
		reversed: "ti.ogivor"
	},
	{
		suffix: "sa.it",
		reversed: "ti.as"
	},
	{
		suffix: "salerno.it",
		reversed: "ti.onrelas"
	},
	{
		suffix: "sassari.it",
		reversed: "ti.irassas"
	},
	{
		suffix: "savona.it",
		reversed: "ti.anovas"
	},
	{
		suffix: "si.it",
		reversed: "ti.is"
	},
	{
		suffix: "siena.it",
		reversed: "ti.aneis"
	},
	{
		suffix: "siracusa.it",
		reversed: "ti.asucaris"
	},
	{
		suffix: "so.it",
		reversed: "ti.os"
	},
	{
		suffix: "sondrio.it",
		reversed: "ti.oirdnos"
	},
	{
		suffix: "sp.it",
		reversed: "ti.ps"
	},
	{
		suffix: "sr.it",
		reversed: "ti.rs"
	},
	{
		suffix: "ss.it",
		reversed: "ti.ss"
	},
	{
		suffix: "suedtirol.it",
		reversed: "ti.loritdeus"
	},
	{
		suffix: "südtirol.it",
		reversed: "ti.a2n-loritds--nx"
	},
	{
		suffix: "sv.it",
		reversed: "ti.vs"
	},
	{
		suffix: "ta.it",
		reversed: "ti.at"
	},
	{
		suffix: "taranto.it",
		reversed: "ti.otnarat"
	},
	{
		suffix: "te.it",
		reversed: "ti.et"
	},
	{
		suffix: "tempio-olbia.it",
		reversed: "ti.aiblo-oipmet"
	},
	{
		suffix: "tempioolbia.it",
		reversed: "ti.aiblooipmet"
	},
	{
		suffix: "teramo.it",
		reversed: "ti.omaret"
	},
	{
		suffix: "terni.it",
		reversed: "ti.inret"
	},
	{
		suffix: "tn.it",
		reversed: "ti.nt"
	},
	{
		suffix: "to.it",
		reversed: "ti.ot"
	},
	{
		suffix: "torino.it",
		reversed: "ti.onirot"
	},
	{
		suffix: "tp.it",
		reversed: "ti.pt"
	},
	{
		suffix: "tr.it",
		reversed: "ti.rt"
	},
	{
		suffix: "trani-andria-barletta.it",
		reversed: "ti.attelrab-airdna-inart"
	},
	{
		suffix: "trani-barletta-andria.it",
		reversed: "ti.airdna-attelrab-inart"
	},
	{
		suffix: "traniandriabarletta.it",
		reversed: "ti.attelrabairdnainart"
	},
	{
		suffix: "tranibarlettaandria.it",
		reversed: "ti.airdnaattelrabinart"
	},
	{
		suffix: "trapani.it",
		reversed: "ti.inapart"
	},
	{
		suffix: "trento.it",
		reversed: "ti.otnert"
	},
	{
		suffix: "treviso.it",
		reversed: "ti.osivert"
	},
	{
		suffix: "trieste.it",
		reversed: "ti.etseirt"
	},
	{
		suffix: "ts.it",
		reversed: "ti.st"
	},
	{
		suffix: "turin.it",
		reversed: "ti.nirut"
	},
	{
		suffix: "tv.it",
		reversed: "ti.vt"
	},
	{
		suffix: "ud.it",
		reversed: "ti.du"
	},
	{
		suffix: "udine.it",
		reversed: "ti.enidu"
	},
	{
		suffix: "urbino-pesaro.it",
		reversed: "ti.orasep-onibru"
	},
	{
		suffix: "urbinopesaro.it",
		reversed: "ti.oraseponibru"
	},
	{
		suffix: "va.it",
		reversed: "ti.av"
	},
	{
		suffix: "varese.it",
		reversed: "ti.eserav"
	},
	{
		suffix: "vb.it",
		reversed: "ti.bv"
	},
	{
		suffix: "vc.it",
		reversed: "ti.cv"
	},
	{
		suffix: "ve.it",
		reversed: "ti.ev"
	},
	{
		suffix: "venezia.it",
		reversed: "ti.aizenev"
	},
	{
		suffix: "venice.it",
		reversed: "ti.ecinev"
	},
	{
		suffix: "verbania.it",
		reversed: "ti.ainabrev"
	},
	{
		suffix: "vercelli.it",
		reversed: "ti.illecrev"
	},
	{
		suffix: "verona.it",
		reversed: "ti.anorev"
	},
	{
		suffix: "vi.it",
		reversed: "ti.iv"
	},
	{
		suffix: "vibo-valentia.it",
		reversed: "ti.aitnelav-obiv"
	},
	{
		suffix: "vibovalentia.it",
		reversed: "ti.aitnelavobiv"
	},
	{
		suffix: "vicenza.it",
		reversed: "ti.azneciv"
	},
	{
		suffix: "viterbo.it",
		reversed: "ti.obretiv"
	},
	{
		suffix: "vr.it",
		reversed: "ti.rv"
	},
	{
		suffix: "vs.it",
		reversed: "ti.sv"
	},
	{
		suffix: "vt.it",
		reversed: "ti.tv"
	},
	{
		suffix: "vv.it",
		reversed: "ti.vv"
	},
	{
		suffix: "je",
		reversed: "ej"
	},
	{
		suffix: "co.je",
		reversed: "ej.oc"
	},
	{
		suffix: "net.je",
		reversed: "ej.ten"
	},
	{
		suffix: "org.je",
		reversed: "ej.gro"
	},
	{
		suffix: "*.jm",
		reversed: "mj"
	},
	{
		suffix: "jo",
		reversed: "oj"
	},
	{
		suffix: "com.jo",
		reversed: "oj.moc"
	},
	{
		suffix: "org.jo",
		reversed: "oj.gro"
	},
	{
		suffix: "net.jo",
		reversed: "oj.ten"
	},
	{
		suffix: "edu.jo",
		reversed: "oj.ude"
	},
	{
		suffix: "sch.jo",
		reversed: "oj.hcs"
	},
	{
		suffix: "gov.jo",
		reversed: "oj.vog"
	},
	{
		suffix: "mil.jo",
		reversed: "oj.lim"
	},
	{
		suffix: "name.jo",
		reversed: "oj.eman"
	},
	{
		suffix: "jobs",
		reversed: "sboj"
	},
	{
		suffix: "jp",
		reversed: "pj"
	},
	{
		suffix: "ac.jp",
		reversed: "pj.ca"
	},
	{
		suffix: "ad.jp",
		reversed: "pj.da"
	},
	{
		suffix: "co.jp",
		reversed: "pj.oc"
	},
	{
		suffix: "ed.jp",
		reversed: "pj.de"
	},
	{
		suffix: "go.jp",
		reversed: "pj.og"
	},
	{
		suffix: "gr.jp",
		reversed: "pj.rg"
	},
	{
		suffix: "lg.jp",
		reversed: "pj.gl"
	},
	{
		suffix: "ne.jp",
		reversed: "pj.en"
	},
	{
		suffix: "or.jp",
		reversed: "pj.ro"
	},
	{
		suffix: "aichi.jp",
		reversed: "pj.ihcia"
	},
	{
		suffix: "akita.jp",
		reversed: "pj.atika"
	},
	{
		suffix: "aomori.jp",
		reversed: "pj.iromoa"
	},
	{
		suffix: "chiba.jp",
		reversed: "pj.abihc"
	},
	{
		suffix: "ehime.jp",
		reversed: "pj.emihe"
	},
	{
		suffix: "fukui.jp",
		reversed: "pj.iukuf"
	},
	{
		suffix: "fukuoka.jp",
		reversed: "pj.akoukuf"
	},
	{
		suffix: "fukushima.jp",
		reversed: "pj.amihsukuf"
	},
	{
		suffix: "gifu.jp",
		reversed: "pj.ufig"
	},
	{
		suffix: "gunma.jp",
		reversed: "pj.amnug"
	},
	{
		suffix: "hiroshima.jp",
		reversed: "pj.amihsorih"
	},
	{
		suffix: "hokkaido.jp",
		reversed: "pj.odiakkoh"
	},
	{
		suffix: "hyogo.jp",
		reversed: "pj.ogoyh"
	},
	{
		suffix: "ibaraki.jp",
		reversed: "pj.ikarabi"
	},
	{
		suffix: "ishikawa.jp",
		reversed: "pj.awakihsi"
	},
	{
		suffix: "iwate.jp",
		reversed: "pj.etawi"
	},
	{
		suffix: "kagawa.jp",
		reversed: "pj.awagak"
	},
	{
		suffix: "kagoshima.jp",
		reversed: "pj.amihsogak"
	},
	{
		suffix: "kanagawa.jp",
		reversed: "pj.awaganak"
	},
	{
		suffix: "kochi.jp",
		reversed: "pj.ihcok"
	},
	{
		suffix: "kumamoto.jp",
		reversed: "pj.otomamuk"
	},
	{
		suffix: "kyoto.jp",
		reversed: "pj.otoyk"
	},
	{
		suffix: "mie.jp",
		reversed: "pj.eim"
	},
	{
		suffix: "miyagi.jp",
		reversed: "pj.igayim"
	},
	{
		suffix: "miyazaki.jp",
		reversed: "pj.ikazayim"
	},
	{
		suffix: "nagano.jp",
		reversed: "pj.onagan"
	},
	{
		suffix: "nagasaki.jp",
		reversed: "pj.ikasagan"
	},
	{
		suffix: "nara.jp",
		reversed: "pj.aran"
	},
	{
		suffix: "niigata.jp",
		reversed: "pj.atagiin"
	},
	{
		suffix: "oita.jp",
		reversed: "pj.atio"
	},
	{
		suffix: "okayama.jp",
		reversed: "pj.amayako"
	},
	{
		suffix: "okinawa.jp",
		reversed: "pj.awaniko"
	},
	{
		suffix: "osaka.jp",
		reversed: "pj.akaso"
	},
	{
		suffix: "saga.jp",
		reversed: "pj.agas"
	},
	{
		suffix: "saitama.jp",
		reversed: "pj.amatias"
	},
	{
		suffix: "shiga.jp",
		reversed: "pj.agihs"
	},
	{
		suffix: "shimane.jp",
		reversed: "pj.enamihs"
	},
	{
		suffix: "shizuoka.jp",
		reversed: "pj.akouzihs"
	},
	{
		suffix: "tochigi.jp",
		reversed: "pj.igihcot"
	},
	{
		suffix: "tokushima.jp",
		reversed: "pj.amihsukot"
	},
	{
		suffix: "tokyo.jp",
		reversed: "pj.oykot"
	},
	{
		suffix: "tottori.jp",
		reversed: "pj.irottot"
	},
	{
		suffix: "toyama.jp",
		reversed: "pj.amayot"
	},
	{
		suffix: "wakayama.jp",
		reversed: "pj.amayakaw"
	},
	{
		suffix: "yamagata.jp",
		reversed: "pj.atagamay"
	},
	{
		suffix: "yamaguchi.jp",
		reversed: "pj.ihcugamay"
	},
	{
		suffix: "yamanashi.jp",
		reversed: "pj.ihsanamay"
	},
	{
		suffix: "栃木.jp",
		reversed: "pj.sxvp4--nx"
	},
	{
		suffix: "愛知.jp",
		reversed: "pj.c204ugv--nx"
	},
	{
		suffix: "愛媛.jp",
		reversed: "pj.m41s3c--nx"
	},
	{
		suffix: "兵庫.jp",
		reversed: "pj.a35xq6f--nx"
	},
	{
		suffix: "熊本.jp",
		reversed: "pj.u4rvp8--nx"
	},
	{
		suffix: "茨城.jp",
		reversed: "pj.h22tsiu--nx"
	},
	{
		suffix: "北海道.jp",
		reversed: "pj.yu6d27srjd--nx"
	},
	{
		suffix: "千葉.jp",
		reversed: "pj.i54urkm--nx"
	},
	{
		suffix: "和歌山.jp",
		reversed: "pj.nn7p7qrt0--nx"
	},
	{
		suffix: "長崎.jp",
		reversed: "pj.k26rtl8--nx"
	},
	{
		suffix: "長野.jp",
		reversed: "pj.e51a4m2--nx"
	},
	{
		suffix: "新潟.jp",
		reversed: "pj.s9nvfe--nx"
	},
	{
		suffix: "青森.jp",
		reversed: "pj.h03pv23--nx"
	},
	{
		suffix: "静岡.jp",
		reversed: "pj.k797ti4--nx"
	},
	{
		suffix: "東京.jp",
		reversed: "pj.d17sql1--nx"
	},
	{
		suffix: "石川.jp",
		reversed: "pj.c94ptr5--nx"
	},
	{
		suffix: "埼玉.jp",
		reversed: "pj.d540sj5--nx"
	},
	{
		suffix: "三重.jp",
		reversed: "pj.n65zqhe--nx"
	},
	{
		suffix: "京都.jp",
		reversed: "pj.n30sql1--nx"
	},
	{
		suffix: "佐賀.jp",
		reversed: "pj.m11tqqq--nx"
	},
	{
		suffix: "大分.jp",
		reversed: "pj.o7qrbk--nx"
	},
	{
		suffix: "大阪.jp",
		reversed: "pj.l33ussp--nx"
	},
	{
		suffix: "奈良.jp",
		reversed: "pj.g71qstn--nx"
	},
	{
		suffix: "宮城.jp",
		reversed: "pj.g3zsiu--nx"
	},
	{
		suffix: "宮崎.jp",
		reversed: "pj.a5wtb6--nx"
	},
	{
		suffix: "富山.jp",
		reversed: "pj.owtc1--nx"
	},
	{
		suffix: "山口.jp",
		reversed: "pj.r2xro6--nx"
	},
	{
		suffix: "山形.jp",
		reversed: "pj.e16thr--nx"
	},
	{
		suffix: "山梨.jp",
		reversed: "pj.z72thr--nx"
	},
	{
		suffix: "岩手.jp",
		reversed: "pj.k4ytjd--nx"
	},
	{
		suffix: "岐阜.jp",
		reversed: "pj.k522tin--nx"
	},
	{
		suffix: "岡山.jp",
		reversed: "pj.d3thr--nx"
	},
	{
		suffix: "島根.jp",
		reversed: "pj.x5ytlk--nx"
	},
	{
		suffix: "広島.jp",
		reversed: "pj.a9xtlk--nx"
	},
	{
		suffix: "徳島.jp",
		reversed: "pj.d7ptlk--nx"
	},
	{
		suffix: "沖縄.jp",
		reversed: "pj.a85uwuu--nx"
	},
	{
		suffix: "滋賀.jp",
		reversed: "pj.d520xbz--nx"
	},
	{
		suffix: "神奈川.jp",
		reversed: "pj.a3xqi0ostn--nx"
	},
	{
		suffix: "福井.jp",
		reversed: "pj.h61qqle--nx"
	},
	{
		suffix: "福岡.jp",
		reversed: "pj.d861ti4--nx"
	},
	{
		suffix: "福島.jp",
		reversed: "pj.d787tlk--nx"
	},
	{
		suffix: "秋田.jp",
		reversed: "pj.h13ynr--nx"
	},
	{
		suffix: "群馬.jp",
		reversed: "pj.c462a0t7--nx"
	},
	{
		suffix: "香川.jp",
		reversed: "pj.k43qtr5--nx"
	},
	{
		suffix: "高知.jp",
		reversed: "pj.e59ny7k--nx"
	},
	{
		suffix: "鳥取.jp",
		reversed: "pj.o131rot--nx"
	},
	{
		suffix: "鹿児島.jp",
		reversed: "pj.c678z7vq5d--nx"
	},
	{
		suffix: "*.kawasaki.jp",
		reversed: "pj.ikasawak"
	},
	{
		suffix: "*.kitakyushu.jp",
		reversed: "pj.uhsuykatik"
	},
	{
		suffix: "*.kobe.jp",
		reversed: "pj.ebok"
	},
	{
		suffix: "*.nagoya.jp",
		reversed: "pj.ayogan"
	},
	{
		suffix: "*.sapporo.jp",
		reversed: "pj.oroppas"
	},
	{
		suffix: "*.sendai.jp",
		reversed: "pj.iadnes"
	},
	{
		suffix: "*.yokohama.jp",
		reversed: "pj.amahokoy"
	},
	{
		suffix: "!city.kawasaki.jp",
		reversed: "pj.ikasawak.ytic"
	},
	{
		suffix: "!city.kitakyushu.jp",
		reversed: "pj.uhsuykatik.ytic"
	},
	{
		suffix: "!city.kobe.jp",
		reversed: "pj.ebok.ytic"
	},
	{
		suffix: "!city.nagoya.jp",
		reversed: "pj.ayogan.ytic"
	},
	{
		suffix: "!city.sapporo.jp",
		reversed: "pj.oroppas.ytic"
	},
	{
		suffix: "!city.sendai.jp",
		reversed: "pj.iadnes.ytic"
	},
	{
		suffix: "!city.yokohama.jp",
		reversed: "pj.amahokoy.ytic"
	},
	{
		suffix: "aisai.aichi.jp",
		reversed: "pj.ihcia.iasia"
	},
	{
		suffix: "ama.aichi.jp",
		reversed: "pj.ihcia.ama"
	},
	{
		suffix: "anjo.aichi.jp",
		reversed: "pj.ihcia.ojna"
	},
	{
		suffix: "asuke.aichi.jp",
		reversed: "pj.ihcia.ekusa"
	},
	{
		suffix: "chiryu.aichi.jp",
		reversed: "pj.ihcia.uyrihc"
	},
	{
		suffix: "chita.aichi.jp",
		reversed: "pj.ihcia.atihc"
	},
	{
		suffix: "fuso.aichi.jp",
		reversed: "pj.ihcia.osuf"
	},
	{
		suffix: "gamagori.aichi.jp",
		reversed: "pj.ihcia.irogamag"
	},
	{
		suffix: "handa.aichi.jp",
		reversed: "pj.ihcia.adnah"
	},
	{
		suffix: "hazu.aichi.jp",
		reversed: "pj.ihcia.uzah"
	},
	{
		suffix: "hekinan.aichi.jp",
		reversed: "pj.ihcia.nanikeh"
	},
	{
		suffix: "higashiura.aichi.jp",
		reversed: "pj.ihcia.aruihsagih"
	},
	{
		suffix: "ichinomiya.aichi.jp",
		reversed: "pj.ihcia.ayimonihci"
	},
	{
		suffix: "inazawa.aichi.jp",
		reversed: "pj.ihcia.awazani"
	},
	{
		suffix: "inuyama.aichi.jp",
		reversed: "pj.ihcia.amayuni"
	},
	{
		suffix: "isshiki.aichi.jp",
		reversed: "pj.ihcia.ikihssi"
	},
	{
		suffix: "iwakura.aichi.jp",
		reversed: "pj.ihcia.arukawi"
	},
	{
		suffix: "kanie.aichi.jp",
		reversed: "pj.ihcia.einak"
	},
	{
		suffix: "kariya.aichi.jp",
		reversed: "pj.ihcia.ayirak"
	},
	{
		suffix: "kasugai.aichi.jp",
		reversed: "pj.ihcia.iagusak"
	},
	{
		suffix: "kira.aichi.jp",
		reversed: "pj.ihcia.arik"
	},
	{
		suffix: "kiyosu.aichi.jp",
		reversed: "pj.ihcia.usoyik"
	},
	{
		suffix: "komaki.aichi.jp",
		reversed: "pj.ihcia.ikamok"
	},
	{
		suffix: "konan.aichi.jp",
		reversed: "pj.ihcia.nanok"
	},
	{
		suffix: "kota.aichi.jp",
		reversed: "pj.ihcia.atok"
	},
	{
		suffix: "mihama.aichi.jp",
		reversed: "pj.ihcia.amahim"
	},
	{
		suffix: "miyoshi.aichi.jp",
		reversed: "pj.ihcia.ihsoyim"
	},
	{
		suffix: "nishio.aichi.jp",
		reversed: "pj.ihcia.oihsin"
	},
	{
		suffix: "nisshin.aichi.jp",
		reversed: "pj.ihcia.nihssin"
	},
	{
		suffix: "obu.aichi.jp",
		reversed: "pj.ihcia.ubo"
	},
	{
		suffix: "oguchi.aichi.jp",
		reversed: "pj.ihcia.ihcugo"
	},
	{
		suffix: "oharu.aichi.jp",
		reversed: "pj.ihcia.uraho"
	},
	{
		suffix: "okazaki.aichi.jp",
		reversed: "pj.ihcia.ikazako"
	},
	{
		suffix: "owariasahi.aichi.jp",
		reversed: "pj.ihcia.ihasairawo"
	},
	{
		suffix: "seto.aichi.jp",
		reversed: "pj.ihcia.otes"
	},
	{
		suffix: "shikatsu.aichi.jp",
		reversed: "pj.ihcia.ustakihs"
	},
	{
		suffix: "shinshiro.aichi.jp",
		reversed: "pj.ihcia.orihsnihs"
	},
	{
		suffix: "shitara.aichi.jp",
		reversed: "pj.ihcia.aratihs"
	},
	{
		suffix: "tahara.aichi.jp",
		reversed: "pj.ihcia.arahat"
	},
	{
		suffix: "takahama.aichi.jp",
		reversed: "pj.ihcia.amahakat"
	},
	{
		suffix: "tobishima.aichi.jp",
		reversed: "pj.ihcia.amihsibot"
	},
	{
		suffix: "toei.aichi.jp",
		reversed: "pj.ihcia.ieot"
	},
	{
		suffix: "togo.aichi.jp",
		reversed: "pj.ihcia.ogot"
	},
	{
		suffix: "tokai.aichi.jp",
		reversed: "pj.ihcia.iakot"
	},
	{
		suffix: "tokoname.aichi.jp",
		reversed: "pj.ihcia.emanokot"
	},
	{
		suffix: "toyoake.aichi.jp",
		reversed: "pj.ihcia.ekaoyot"
	},
	{
		suffix: "toyohashi.aichi.jp",
		reversed: "pj.ihcia.ihsahoyot"
	},
	{
		suffix: "toyokawa.aichi.jp",
		reversed: "pj.ihcia.awakoyot"
	},
	{
		suffix: "toyone.aichi.jp",
		reversed: "pj.ihcia.enoyot"
	},
	{
		suffix: "toyota.aichi.jp",
		reversed: "pj.ihcia.atoyot"
	},
	{
		suffix: "tsushima.aichi.jp",
		reversed: "pj.ihcia.amihsust"
	},
	{
		suffix: "yatomi.aichi.jp",
		reversed: "pj.ihcia.imotay"
	},
	{
		suffix: "akita.akita.jp",
		reversed: "pj.atika.atika"
	},
	{
		suffix: "daisen.akita.jp",
		reversed: "pj.atika.nesiad"
	},
	{
		suffix: "fujisato.akita.jp",
		reversed: "pj.atika.otasijuf"
	},
	{
		suffix: "gojome.akita.jp",
		reversed: "pj.atika.emojog"
	},
	{
		suffix: "hachirogata.akita.jp",
		reversed: "pj.atika.atagorihcah"
	},
	{
		suffix: "happou.akita.jp",
		reversed: "pj.atika.uoppah"
	},
	{
		suffix: "higashinaruse.akita.jp",
		reversed: "pj.atika.esuranihsagih"
	},
	{
		suffix: "honjo.akita.jp",
		reversed: "pj.atika.ojnoh"
	},
	{
		suffix: "honjyo.akita.jp",
		reversed: "pj.atika.oyjnoh"
	},
	{
		suffix: "ikawa.akita.jp",
		reversed: "pj.atika.awaki"
	},
	{
		suffix: "kamikoani.akita.jp",
		reversed: "pj.atika.inaokimak"
	},
	{
		suffix: "kamioka.akita.jp",
		reversed: "pj.atika.akoimak"
	},
	{
		suffix: "katagami.akita.jp",
		reversed: "pj.atika.imagatak"
	},
	{
		suffix: "kazuno.akita.jp",
		reversed: "pj.atika.onuzak"
	},
	{
		suffix: "kitaakita.akita.jp",
		reversed: "pj.atika.atikaatik"
	},
	{
		suffix: "kosaka.akita.jp",
		reversed: "pj.atika.akasok"
	},
	{
		suffix: "kyowa.akita.jp",
		reversed: "pj.atika.awoyk"
	},
	{
		suffix: "misato.akita.jp",
		reversed: "pj.atika.otasim"
	},
	{
		suffix: "mitane.akita.jp",
		reversed: "pj.atika.enatim"
	},
	{
		suffix: "moriyoshi.akita.jp",
		reversed: "pj.atika.ihsoyirom"
	},
	{
		suffix: "nikaho.akita.jp",
		reversed: "pj.atika.ohakin"
	},
	{
		suffix: "noshiro.akita.jp",
		reversed: "pj.atika.orihson"
	},
	{
		suffix: "odate.akita.jp",
		reversed: "pj.atika.etado"
	},
	{
		suffix: "oga.akita.jp",
		reversed: "pj.atika.ago"
	},
	{
		suffix: "ogata.akita.jp",
		reversed: "pj.atika.atago"
	},
	{
		suffix: "semboku.akita.jp",
		reversed: "pj.atika.ukobmes"
	},
	{
		suffix: "yokote.akita.jp",
		reversed: "pj.atika.etokoy"
	},
	{
		suffix: "yurihonjo.akita.jp",
		reversed: "pj.atika.ojnohiruy"
	},
	{
		suffix: "aomori.aomori.jp",
		reversed: "pj.iromoa.iromoa"
	},
	{
		suffix: "gonohe.aomori.jp",
		reversed: "pj.iromoa.ehonog"
	},
	{
		suffix: "hachinohe.aomori.jp",
		reversed: "pj.iromoa.ehonihcah"
	},
	{
		suffix: "hashikami.aomori.jp",
		reversed: "pj.iromoa.imakihsah"
	},
	{
		suffix: "hiranai.aomori.jp",
		reversed: "pj.iromoa.ianarih"
	},
	{
		suffix: "hirosaki.aomori.jp",
		reversed: "pj.iromoa.ikasorih"
	},
	{
		suffix: "itayanagi.aomori.jp",
		reversed: "pj.iromoa.iganayati"
	},
	{
		suffix: "kuroishi.aomori.jp",
		reversed: "pj.iromoa.ihsioruk"
	},
	{
		suffix: "misawa.aomori.jp",
		reversed: "pj.iromoa.awasim"
	},
	{
		suffix: "mutsu.aomori.jp",
		reversed: "pj.iromoa.ustum"
	},
	{
		suffix: "nakadomari.aomori.jp",
		reversed: "pj.iromoa.iramodakan"
	},
	{
		suffix: "noheji.aomori.jp",
		reversed: "pj.iromoa.ijehon"
	},
	{
		suffix: "oirase.aomori.jp",
		reversed: "pj.iromoa.esario"
	},
	{
		suffix: "owani.aomori.jp",
		reversed: "pj.iromoa.inawo"
	},
	{
		suffix: "rokunohe.aomori.jp",
		reversed: "pj.iromoa.ehonukor"
	},
	{
		suffix: "sannohe.aomori.jp",
		reversed: "pj.iromoa.ehonnas"
	},
	{
		suffix: "shichinohe.aomori.jp",
		reversed: "pj.iromoa.ehonihcihs"
	},
	{
		suffix: "shingo.aomori.jp",
		reversed: "pj.iromoa.ognihs"
	},
	{
		suffix: "takko.aomori.jp",
		reversed: "pj.iromoa.okkat"
	},
	{
		suffix: "towada.aomori.jp",
		reversed: "pj.iromoa.adawot"
	},
	{
		suffix: "tsugaru.aomori.jp",
		reversed: "pj.iromoa.uragust"
	},
	{
		suffix: "tsuruta.aomori.jp",
		reversed: "pj.iromoa.aturust"
	},
	{
		suffix: "abiko.chiba.jp",
		reversed: "pj.abihc.okiba"
	},
	{
		suffix: "asahi.chiba.jp",
		reversed: "pj.abihc.ihasa"
	},
	{
		suffix: "chonan.chiba.jp",
		reversed: "pj.abihc.nanohc"
	},
	{
		suffix: "chosei.chiba.jp",
		reversed: "pj.abihc.iesohc"
	},
	{
		suffix: "choshi.chiba.jp",
		reversed: "pj.abihc.ihsohc"
	},
	{
		suffix: "chuo.chiba.jp",
		reversed: "pj.abihc.ouhc"
	},
	{
		suffix: "funabashi.chiba.jp",
		reversed: "pj.abihc.ihsabanuf"
	},
	{
		suffix: "futtsu.chiba.jp",
		reversed: "pj.abihc.usttuf"
	},
	{
		suffix: "hanamigawa.chiba.jp",
		reversed: "pj.abihc.awagimanah"
	},
	{
		suffix: "ichihara.chiba.jp",
		reversed: "pj.abihc.arahihci"
	},
	{
		suffix: "ichikawa.chiba.jp",
		reversed: "pj.abihc.awakihci"
	},
	{
		suffix: "ichinomiya.chiba.jp",
		reversed: "pj.abihc.ayimonihci"
	},
	{
		suffix: "inzai.chiba.jp",
		reversed: "pj.abihc.iazni"
	},
	{
		suffix: "isumi.chiba.jp",
		reversed: "pj.abihc.imusi"
	},
	{
		suffix: "kamagaya.chiba.jp",
		reversed: "pj.abihc.ayagamak"
	},
	{
		suffix: "kamogawa.chiba.jp",
		reversed: "pj.abihc.awagomak"
	},
	{
		suffix: "kashiwa.chiba.jp",
		reversed: "pj.abihc.awihsak"
	},
	{
		suffix: "katori.chiba.jp",
		reversed: "pj.abihc.irotak"
	},
	{
		suffix: "katsuura.chiba.jp",
		reversed: "pj.abihc.aruustak"
	},
	{
		suffix: "kimitsu.chiba.jp",
		reversed: "pj.abihc.ustimik"
	},
	{
		suffix: "kisarazu.chiba.jp",
		reversed: "pj.abihc.uzarasik"
	},
	{
		suffix: "kozaki.chiba.jp",
		reversed: "pj.abihc.ikazok"
	},
	{
		suffix: "kujukuri.chiba.jp",
		reversed: "pj.abihc.irukujuk"
	},
	{
		suffix: "kyonan.chiba.jp",
		reversed: "pj.abihc.nanoyk"
	},
	{
		suffix: "matsudo.chiba.jp",
		reversed: "pj.abihc.odustam"
	},
	{
		suffix: "midori.chiba.jp",
		reversed: "pj.abihc.irodim"
	},
	{
		suffix: "mihama.chiba.jp",
		reversed: "pj.abihc.amahim"
	},
	{
		suffix: "minamiboso.chiba.jp",
		reversed: "pj.abihc.osobimanim"
	},
	{
		suffix: "mobara.chiba.jp",
		reversed: "pj.abihc.arabom"
	},
	{
		suffix: "mutsuzawa.chiba.jp",
		reversed: "pj.abihc.awazustum"
	},
	{
		suffix: "nagara.chiba.jp",
		reversed: "pj.abihc.aragan"
	},
	{
		suffix: "nagareyama.chiba.jp",
		reversed: "pj.abihc.amayeragan"
	},
	{
		suffix: "narashino.chiba.jp",
		reversed: "pj.abihc.onihsaran"
	},
	{
		suffix: "narita.chiba.jp",
		reversed: "pj.abihc.atiran"
	},
	{
		suffix: "noda.chiba.jp",
		reversed: "pj.abihc.adon"
	},
	{
		suffix: "oamishirasato.chiba.jp",
		reversed: "pj.abihc.otasarihsimao"
	},
	{
		suffix: "omigawa.chiba.jp",
		reversed: "pj.abihc.awagimo"
	},
	{
		suffix: "onjuku.chiba.jp",
		reversed: "pj.abihc.ukujno"
	},
	{
		suffix: "otaki.chiba.jp",
		reversed: "pj.abihc.ikato"
	},
	{
		suffix: "sakae.chiba.jp",
		reversed: "pj.abihc.eakas"
	},
	{
		suffix: "sakura.chiba.jp",
		reversed: "pj.abihc.arukas"
	},
	{
		suffix: "shimofusa.chiba.jp",
		reversed: "pj.abihc.asufomihs"
	},
	{
		suffix: "shirako.chiba.jp",
		reversed: "pj.abihc.okarihs"
	},
	{
		suffix: "shiroi.chiba.jp",
		reversed: "pj.abihc.iorihs"
	},
	{
		suffix: "shisui.chiba.jp",
		reversed: "pj.abihc.iusihs"
	},
	{
		suffix: "sodegaura.chiba.jp",
		reversed: "pj.abihc.aruagedos"
	},
	{
		suffix: "sosa.chiba.jp",
		reversed: "pj.abihc.asos"
	},
	{
		suffix: "tako.chiba.jp",
		reversed: "pj.abihc.okat"
	},
	{
		suffix: "tateyama.chiba.jp",
		reversed: "pj.abihc.amayetat"
	},
	{
		suffix: "togane.chiba.jp",
		reversed: "pj.abihc.enagot"
	},
	{
		suffix: "tohnosho.chiba.jp",
		reversed: "pj.abihc.ohsonhot"
	},
	{
		suffix: "tomisato.chiba.jp",
		reversed: "pj.abihc.otasimot"
	},
	{
		suffix: "urayasu.chiba.jp",
		reversed: "pj.abihc.usayaru"
	},
	{
		suffix: "yachimata.chiba.jp",
		reversed: "pj.abihc.atamihcay"
	},
	{
		suffix: "yachiyo.chiba.jp",
		reversed: "pj.abihc.oyihcay"
	},
	{
		suffix: "yokaichiba.chiba.jp",
		reversed: "pj.abihc.abihciakoy"
	},
	{
		suffix: "yokoshibahikari.chiba.jp",
		reversed: "pj.abihc.irakihabihsokoy"
	},
	{
		suffix: "yotsukaido.chiba.jp",
		reversed: "pj.abihc.odiakustoy"
	},
	{
		suffix: "ainan.ehime.jp",
		reversed: "pj.emihe.nania"
	},
	{
		suffix: "honai.ehime.jp",
		reversed: "pj.emihe.ianoh"
	},
	{
		suffix: "ikata.ehime.jp",
		reversed: "pj.emihe.ataki"
	},
	{
		suffix: "imabari.ehime.jp",
		reversed: "pj.emihe.irabami"
	},
	{
		suffix: "iyo.ehime.jp",
		reversed: "pj.emihe.oyi"
	},
	{
		suffix: "kamijima.ehime.jp",
		reversed: "pj.emihe.amijimak"
	},
	{
		suffix: "kihoku.ehime.jp",
		reversed: "pj.emihe.ukohik"
	},
	{
		suffix: "kumakogen.ehime.jp",
		reversed: "pj.emihe.negokamuk"
	},
	{
		suffix: "masaki.ehime.jp",
		reversed: "pj.emihe.ikasam"
	},
	{
		suffix: "matsuno.ehime.jp",
		reversed: "pj.emihe.onustam"
	},
	{
		suffix: "matsuyama.ehime.jp",
		reversed: "pj.emihe.amayustam"
	},
	{
		suffix: "namikata.ehime.jp",
		reversed: "pj.emihe.atakiman"
	},
	{
		suffix: "niihama.ehime.jp",
		reversed: "pj.emihe.amahiin"
	},
	{
		suffix: "ozu.ehime.jp",
		reversed: "pj.emihe.uzo"
	},
	{
		suffix: "saijo.ehime.jp",
		reversed: "pj.emihe.ojias"
	},
	{
		suffix: "seiyo.ehime.jp",
		reversed: "pj.emihe.oyies"
	},
	{
		suffix: "shikokuchuo.ehime.jp",
		reversed: "pj.emihe.ouhcukokihs"
	},
	{
		suffix: "tobe.ehime.jp",
		reversed: "pj.emihe.ebot"
	},
	{
		suffix: "toon.ehime.jp",
		reversed: "pj.emihe.noot"
	},
	{
		suffix: "uchiko.ehime.jp",
		reversed: "pj.emihe.okihcu"
	},
	{
		suffix: "uwajima.ehime.jp",
		reversed: "pj.emihe.amijawu"
	},
	{
		suffix: "yawatahama.ehime.jp",
		reversed: "pj.emihe.amahataway"
	},
	{
		suffix: "echizen.fukui.jp",
		reversed: "pj.iukuf.nezihce"
	},
	{
		suffix: "eiheiji.fukui.jp",
		reversed: "pj.iukuf.ijiehie"
	},
	{
		suffix: "fukui.fukui.jp",
		reversed: "pj.iukuf.iukuf"
	},
	{
		suffix: "ikeda.fukui.jp",
		reversed: "pj.iukuf.adeki"
	},
	{
		suffix: "katsuyama.fukui.jp",
		reversed: "pj.iukuf.amayustak"
	},
	{
		suffix: "mihama.fukui.jp",
		reversed: "pj.iukuf.amahim"
	},
	{
		suffix: "minamiechizen.fukui.jp",
		reversed: "pj.iukuf.nezihceimanim"
	},
	{
		suffix: "obama.fukui.jp",
		reversed: "pj.iukuf.amabo"
	},
	{
		suffix: "ohi.fukui.jp",
		reversed: "pj.iukuf.iho"
	},
	{
		suffix: "ono.fukui.jp",
		reversed: "pj.iukuf.ono"
	},
	{
		suffix: "sabae.fukui.jp",
		reversed: "pj.iukuf.eabas"
	},
	{
		suffix: "sakai.fukui.jp",
		reversed: "pj.iukuf.iakas"
	},
	{
		suffix: "takahama.fukui.jp",
		reversed: "pj.iukuf.amahakat"
	},
	{
		suffix: "tsuruga.fukui.jp",
		reversed: "pj.iukuf.agurust"
	},
	{
		suffix: "wakasa.fukui.jp",
		reversed: "pj.iukuf.asakaw"
	},
	{
		suffix: "ashiya.fukuoka.jp",
		reversed: "pj.akoukuf.ayihsa"
	},
	{
		suffix: "buzen.fukuoka.jp",
		reversed: "pj.akoukuf.nezub"
	},
	{
		suffix: "chikugo.fukuoka.jp",
		reversed: "pj.akoukuf.ogukihc"
	},
	{
		suffix: "chikuho.fukuoka.jp",
		reversed: "pj.akoukuf.ohukihc"
	},
	{
		suffix: "chikujo.fukuoka.jp",
		reversed: "pj.akoukuf.ojukihc"
	},
	{
		suffix: "chikushino.fukuoka.jp",
		reversed: "pj.akoukuf.onihsukihc"
	},
	{
		suffix: "chikuzen.fukuoka.jp",
		reversed: "pj.akoukuf.nezukihc"
	},
	{
		suffix: "chuo.fukuoka.jp",
		reversed: "pj.akoukuf.ouhc"
	},
	{
		suffix: "dazaifu.fukuoka.jp",
		reversed: "pj.akoukuf.ufiazad"
	},
	{
		suffix: "fukuchi.fukuoka.jp",
		reversed: "pj.akoukuf.ihcukuf"
	},
	{
		suffix: "hakata.fukuoka.jp",
		reversed: "pj.akoukuf.atakah"
	},
	{
		suffix: "higashi.fukuoka.jp",
		reversed: "pj.akoukuf.ihsagih"
	},
	{
		suffix: "hirokawa.fukuoka.jp",
		reversed: "pj.akoukuf.awakorih"
	},
	{
		suffix: "hisayama.fukuoka.jp",
		reversed: "pj.akoukuf.amayasih"
	},
	{
		suffix: "iizuka.fukuoka.jp",
		reversed: "pj.akoukuf.akuzii"
	},
	{
		suffix: "inatsuki.fukuoka.jp",
		reversed: "pj.akoukuf.ikustani"
	},
	{
		suffix: "kaho.fukuoka.jp",
		reversed: "pj.akoukuf.ohak"
	},
	{
		suffix: "kasuga.fukuoka.jp",
		reversed: "pj.akoukuf.agusak"
	},
	{
		suffix: "kasuya.fukuoka.jp",
		reversed: "pj.akoukuf.ayusak"
	},
	{
		suffix: "kawara.fukuoka.jp",
		reversed: "pj.akoukuf.arawak"
	},
	{
		suffix: "keisen.fukuoka.jp",
		reversed: "pj.akoukuf.nesiek"
	},
	{
		suffix: "koga.fukuoka.jp",
		reversed: "pj.akoukuf.agok"
	},
	{
		suffix: "kurate.fukuoka.jp",
		reversed: "pj.akoukuf.etaruk"
	},
	{
		suffix: "kurogi.fukuoka.jp",
		reversed: "pj.akoukuf.igoruk"
	},
	{
		suffix: "kurume.fukuoka.jp",
		reversed: "pj.akoukuf.emuruk"
	},
	{
		suffix: "minami.fukuoka.jp",
		reversed: "pj.akoukuf.imanim"
	},
	{
		suffix: "miyako.fukuoka.jp",
		reversed: "pj.akoukuf.okayim"
	},
	{
		suffix: "miyama.fukuoka.jp",
		reversed: "pj.akoukuf.amayim"
	},
	{
		suffix: "miyawaka.fukuoka.jp",
		reversed: "pj.akoukuf.akawayim"
	},
	{
		suffix: "mizumaki.fukuoka.jp",
		reversed: "pj.akoukuf.ikamuzim"
	},
	{
		suffix: "munakata.fukuoka.jp",
		reversed: "pj.akoukuf.atakanum"
	},
	{
		suffix: "nakagawa.fukuoka.jp",
		reversed: "pj.akoukuf.awagakan"
	},
	{
		suffix: "nakama.fukuoka.jp",
		reversed: "pj.akoukuf.amakan"
	},
	{
		suffix: "nishi.fukuoka.jp",
		reversed: "pj.akoukuf.ihsin"
	},
	{
		suffix: "nogata.fukuoka.jp",
		reversed: "pj.akoukuf.atagon"
	},
	{
		suffix: "ogori.fukuoka.jp",
		reversed: "pj.akoukuf.irogo"
	},
	{
		suffix: "okagaki.fukuoka.jp",
		reversed: "pj.akoukuf.ikagako"
	},
	{
		suffix: "okawa.fukuoka.jp",
		reversed: "pj.akoukuf.awako"
	},
	{
		suffix: "oki.fukuoka.jp",
		reversed: "pj.akoukuf.iko"
	},
	{
		suffix: "omuta.fukuoka.jp",
		reversed: "pj.akoukuf.atumo"
	},
	{
		suffix: "onga.fukuoka.jp",
		reversed: "pj.akoukuf.agno"
	},
	{
		suffix: "onojo.fukuoka.jp",
		reversed: "pj.akoukuf.ojono"
	},
	{
		suffix: "oto.fukuoka.jp",
		reversed: "pj.akoukuf.oto"
	},
	{
		suffix: "saigawa.fukuoka.jp",
		reversed: "pj.akoukuf.awagias"
	},
	{
		suffix: "sasaguri.fukuoka.jp",
		reversed: "pj.akoukuf.irugasas"
	},
	{
		suffix: "shingu.fukuoka.jp",
		reversed: "pj.akoukuf.ugnihs"
	},
	{
		suffix: "shinyoshitomi.fukuoka.jp",
		reversed: "pj.akoukuf.imotihsoynihs"
	},
	{
		suffix: "shonai.fukuoka.jp",
		reversed: "pj.akoukuf.ianohs"
	},
	{
		suffix: "soeda.fukuoka.jp",
		reversed: "pj.akoukuf.adeos"
	},
	{
		suffix: "sue.fukuoka.jp",
		reversed: "pj.akoukuf.eus"
	},
	{
		suffix: "tachiarai.fukuoka.jp",
		reversed: "pj.akoukuf.iaraihcat"
	},
	{
		suffix: "tagawa.fukuoka.jp",
		reversed: "pj.akoukuf.awagat"
	},
	{
		suffix: "takata.fukuoka.jp",
		reversed: "pj.akoukuf.atakat"
	},
	{
		suffix: "toho.fukuoka.jp",
		reversed: "pj.akoukuf.ohot"
	},
	{
		suffix: "toyotsu.fukuoka.jp",
		reversed: "pj.akoukuf.ustoyot"
	},
	{
		suffix: "tsuiki.fukuoka.jp",
		reversed: "pj.akoukuf.ikiust"
	},
	{
		suffix: "ukiha.fukuoka.jp",
		reversed: "pj.akoukuf.ahiku"
	},
	{
		suffix: "umi.fukuoka.jp",
		reversed: "pj.akoukuf.imu"
	},
	{
		suffix: "usui.fukuoka.jp",
		reversed: "pj.akoukuf.iusu"
	},
	{
		suffix: "yamada.fukuoka.jp",
		reversed: "pj.akoukuf.adamay"
	},
	{
		suffix: "yame.fukuoka.jp",
		reversed: "pj.akoukuf.emay"
	},
	{
		suffix: "yanagawa.fukuoka.jp",
		reversed: "pj.akoukuf.awaganay"
	},
	{
		suffix: "yukuhashi.fukuoka.jp",
		reversed: "pj.akoukuf.ihsahukuy"
	},
	{
		suffix: "aizubange.fukushima.jp",
		reversed: "pj.amihsukuf.egnabuzia"
	},
	{
		suffix: "aizumisato.fukushima.jp",
		reversed: "pj.amihsukuf.otasimuzia"
	},
	{
		suffix: "aizuwakamatsu.fukushima.jp",
		reversed: "pj.amihsukuf.ustamakawuzia"
	},
	{
		suffix: "asakawa.fukushima.jp",
		reversed: "pj.amihsukuf.awakasa"
	},
	{
		suffix: "bandai.fukushima.jp",
		reversed: "pj.amihsukuf.iadnab"
	},
	{
		suffix: "date.fukushima.jp",
		reversed: "pj.amihsukuf.etad"
	},
	{
		suffix: "fukushima.fukushima.jp",
		reversed: "pj.amihsukuf.amihsukuf"
	},
	{
		suffix: "furudono.fukushima.jp",
		reversed: "pj.amihsukuf.onoduruf"
	},
	{
		suffix: "futaba.fukushima.jp",
		reversed: "pj.amihsukuf.abatuf"
	},
	{
		suffix: "hanawa.fukushima.jp",
		reversed: "pj.amihsukuf.awanah"
	},
	{
		suffix: "higashi.fukushima.jp",
		reversed: "pj.amihsukuf.ihsagih"
	},
	{
		suffix: "hirata.fukushima.jp",
		reversed: "pj.amihsukuf.atarih"
	},
	{
		suffix: "hirono.fukushima.jp",
		reversed: "pj.amihsukuf.onorih"
	},
	{
		suffix: "iitate.fukushima.jp",
		reversed: "pj.amihsukuf.etatii"
	},
	{
		suffix: "inawashiro.fukushima.jp",
		reversed: "pj.amihsukuf.orihsawani"
	},
	{
		suffix: "ishikawa.fukushima.jp",
		reversed: "pj.amihsukuf.awakihsi"
	},
	{
		suffix: "iwaki.fukushima.jp",
		reversed: "pj.amihsukuf.ikawi"
	},
	{
		suffix: "izumizaki.fukushima.jp",
		reversed: "pj.amihsukuf.ikazimuzi"
	},
	{
		suffix: "kagamiishi.fukushima.jp",
		reversed: "pj.amihsukuf.ihsiimagak"
	},
	{
		suffix: "kaneyama.fukushima.jp",
		reversed: "pj.amihsukuf.amayenak"
	},
	{
		suffix: "kawamata.fukushima.jp",
		reversed: "pj.amihsukuf.atamawak"
	},
	{
		suffix: "kitakata.fukushima.jp",
		reversed: "pj.amihsukuf.atakatik"
	},
	{
		suffix: "kitashiobara.fukushima.jp",
		reversed: "pj.amihsukuf.araboihsatik"
	},
	{
		suffix: "koori.fukushima.jp",
		reversed: "pj.amihsukuf.irook"
	},
	{
		suffix: "koriyama.fukushima.jp",
		reversed: "pj.amihsukuf.amayirok"
	},
	{
		suffix: "kunimi.fukushima.jp",
		reversed: "pj.amihsukuf.iminuk"
	},
	{
		suffix: "miharu.fukushima.jp",
		reversed: "pj.amihsukuf.urahim"
	},
	{
		suffix: "mishima.fukushima.jp",
		reversed: "pj.amihsukuf.amihsim"
	},
	{
		suffix: "namie.fukushima.jp",
		reversed: "pj.amihsukuf.eiman"
	},
	{
		suffix: "nango.fukushima.jp",
		reversed: "pj.amihsukuf.ognan"
	},
	{
		suffix: "nishiaizu.fukushima.jp",
		reversed: "pj.amihsukuf.uziaihsin"
	},
	{
		suffix: "nishigo.fukushima.jp",
		reversed: "pj.amihsukuf.ogihsin"
	},
	{
		suffix: "okuma.fukushima.jp",
		reversed: "pj.amihsukuf.amuko"
	},
	{
		suffix: "omotego.fukushima.jp",
		reversed: "pj.amihsukuf.ogetomo"
	},
	{
		suffix: "ono.fukushima.jp",
		reversed: "pj.amihsukuf.ono"
	},
	{
		suffix: "otama.fukushima.jp",
		reversed: "pj.amihsukuf.amato"
	},
	{
		suffix: "samegawa.fukushima.jp",
		reversed: "pj.amihsukuf.awagemas"
	},
	{
		suffix: "shimogo.fukushima.jp",
		reversed: "pj.amihsukuf.ogomihs"
	},
	{
		suffix: "shirakawa.fukushima.jp",
		reversed: "pj.amihsukuf.awakarihs"
	},
	{
		suffix: "showa.fukushima.jp",
		reversed: "pj.amihsukuf.awohs"
	},
	{
		suffix: "soma.fukushima.jp",
		reversed: "pj.amihsukuf.amos"
	},
	{
		suffix: "sukagawa.fukushima.jp",
		reversed: "pj.amihsukuf.awagakus"
	},
	{
		suffix: "taishin.fukushima.jp",
		reversed: "pj.amihsukuf.nihsiat"
	},
	{
		suffix: "tamakawa.fukushima.jp",
		reversed: "pj.amihsukuf.awakamat"
	},
	{
		suffix: "tanagura.fukushima.jp",
		reversed: "pj.amihsukuf.aruganat"
	},
	{
		suffix: "tenei.fukushima.jp",
		reversed: "pj.amihsukuf.ienet"
	},
	{
		suffix: "yabuki.fukushima.jp",
		reversed: "pj.amihsukuf.ikubay"
	},
	{
		suffix: "yamato.fukushima.jp",
		reversed: "pj.amihsukuf.otamay"
	},
	{
		suffix: "yamatsuri.fukushima.jp",
		reversed: "pj.amihsukuf.irustamay"
	},
	{
		suffix: "yanaizu.fukushima.jp",
		reversed: "pj.amihsukuf.uzianay"
	},
	{
		suffix: "yugawa.fukushima.jp",
		reversed: "pj.amihsukuf.awaguy"
	},
	{
		suffix: "anpachi.gifu.jp",
		reversed: "pj.ufig.ihcapna"
	},
	{
		suffix: "ena.gifu.jp",
		reversed: "pj.ufig.ane"
	},
	{
		suffix: "gifu.gifu.jp",
		reversed: "pj.ufig.ufig"
	},
	{
		suffix: "ginan.gifu.jp",
		reversed: "pj.ufig.nanig"
	},
	{
		suffix: "godo.gifu.jp",
		reversed: "pj.ufig.odog"
	},
	{
		suffix: "gujo.gifu.jp",
		reversed: "pj.ufig.ojug"
	},
	{
		suffix: "hashima.gifu.jp",
		reversed: "pj.ufig.amihsah"
	},
	{
		suffix: "hichiso.gifu.jp",
		reversed: "pj.ufig.osihcih"
	},
	{
		suffix: "hida.gifu.jp",
		reversed: "pj.ufig.adih"
	},
	{
		suffix: "higashishirakawa.gifu.jp",
		reversed: "pj.ufig.awakarihsihsagih"
	},
	{
		suffix: "ibigawa.gifu.jp",
		reversed: "pj.ufig.awagibi"
	},
	{
		suffix: "ikeda.gifu.jp",
		reversed: "pj.ufig.adeki"
	},
	{
		suffix: "kakamigahara.gifu.jp",
		reversed: "pj.ufig.arahagimakak"
	},
	{
		suffix: "kani.gifu.jp",
		reversed: "pj.ufig.inak"
	},
	{
		suffix: "kasahara.gifu.jp",
		reversed: "pj.ufig.arahasak"
	},
	{
		suffix: "kasamatsu.gifu.jp",
		reversed: "pj.ufig.ustamasak"
	},
	{
		suffix: "kawaue.gifu.jp",
		reversed: "pj.ufig.euawak"
	},
	{
		suffix: "kitagata.gifu.jp",
		reversed: "pj.ufig.atagatik"
	},
	{
		suffix: "mino.gifu.jp",
		reversed: "pj.ufig.onim"
	},
	{
		suffix: "minokamo.gifu.jp",
		reversed: "pj.ufig.omakonim"
	},
	{
		suffix: "mitake.gifu.jp",
		reversed: "pj.ufig.ekatim"
	},
	{
		suffix: "mizunami.gifu.jp",
		reversed: "pj.ufig.imanuzim"
	},
	{
		suffix: "motosu.gifu.jp",
		reversed: "pj.ufig.usotom"
	},
	{
		suffix: "nakatsugawa.gifu.jp",
		reversed: "pj.ufig.awagustakan"
	},
	{
		suffix: "ogaki.gifu.jp",
		reversed: "pj.ufig.ikago"
	},
	{
		suffix: "sakahogi.gifu.jp",
		reversed: "pj.ufig.igohakas"
	},
	{
		suffix: "seki.gifu.jp",
		reversed: "pj.ufig.ikes"
	},
	{
		suffix: "sekigahara.gifu.jp",
		reversed: "pj.ufig.arahagikes"
	},
	{
		suffix: "shirakawa.gifu.jp",
		reversed: "pj.ufig.awakarihs"
	},
	{
		suffix: "tajimi.gifu.jp",
		reversed: "pj.ufig.imijat"
	},
	{
		suffix: "takayama.gifu.jp",
		reversed: "pj.ufig.amayakat"
	},
	{
		suffix: "tarui.gifu.jp",
		reversed: "pj.ufig.iurat"
	},
	{
		suffix: "toki.gifu.jp",
		reversed: "pj.ufig.ikot"
	},
	{
		suffix: "tomika.gifu.jp",
		reversed: "pj.ufig.akimot"
	},
	{
		suffix: "wanouchi.gifu.jp",
		reversed: "pj.ufig.ihcuonaw"
	},
	{
		suffix: "yamagata.gifu.jp",
		reversed: "pj.ufig.atagamay"
	},
	{
		suffix: "yaotsu.gifu.jp",
		reversed: "pj.ufig.ustoay"
	},
	{
		suffix: "yoro.gifu.jp",
		reversed: "pj.ufig.oroy"
	},
	{
		suffix: "annaka.gunma.jp",
		reversed: "pj.amnug.akanna"
	},
	{
		suffix: "chiyoda.gunma.jp",
		reversed: "pj.amnug.adoyihc"
	},
	{
		suffix: "fujioka.gunma.jp",
		reversed: "pj.amnug.akoijuf"
	},
	{
		suffix: "higashiagatsuma.gunma.jp",
		reversed: "pj.amnug.amustagaihsagih"
	},
	{
		suffix: "isesaki.gunma.jp",
		reversed: "pj.amnug.ikasesi"
	},
	{
		suffix: "itakura.gunma.jp",
		reversed: "pj.amnug.arukati"
	},
	{
		suffix: "kanna.gunma.jp",
		reversed: "pj.amnug.annak"
	},
	{
		suffix: "kanra.gunma.jp",
		reversed: "pj.amnug.arnak"
	},
	{
		suffix: "katashina.gunma.jp",
		reversed: "pj.amnug.anihsatak"
	},
	{
		suffix: "kawaba.gunma.jp",
		reversed: "pj.amnug.abawak"
	},
	{
		suffix: "kiryu.gunma.jp",
		reversed: "pj.amnug.uyrik"
	},
	{
		suffix: "kusatsu.gunma.jp",
		reversed: "pj.amnug.ustasuk"
	},
	{
		suffix: "maebashi.gunma.jp",
		reversed: "pj.amnug.ihsabeam"
	},
	{
		suffix: "meiwa.gunma.jp",
		reversed: "pj.amnug.awiem"
	},
	{
		suffix: "midori.gunma.jp",
		reversed: "pj.amnug.irodim"
	},
	{
		suffix: "minakami.gunma.jp",
		reversed: "pj.amnug.imakanim"
	},
	{
		suffix: "naganohara.gunma.jp",
		reversed: "pj.amnug.arahonagan"
	},
	{
		suffix: "nakanojo.gunma.jp",
		reversed: "pj.amnug.ojonakan"
	},
	{
		suffix: "nanmoku.gunma.jp",
		reversed: "pj.amnug.ukomnan"
	},
	{
		suffix: "numata.gunma.jp",
		reversed: "pj.amnug.atamun"
	},
	{
		suffix: "oizumi.gunma.jp",
		reversed: "pj.amnug.imuzio"
	},
	{
		suffix: "ora.gunma.jp",
		reversed: "pj.amnug.aro"
	},
	{
		suffix: "ota.gunma.jp",
		reversed: "pj.amnug.ato"
	},
	{
		suffix: "shibukawa.gunma.jp",
		reversed: "pj.amnug.awakubihs"
	},
	{
		suffix: "shimonita.gunma.jp",
		reversed: "pj.amnug.atinomihs"
	},
	{
		suffix: "shinto.gunma.jp",
		reversed: "pj.amnug.otnihs"
	},
	{
		suffix: "showa.gunma.jp",
		reversed: "pj.amnug.awohs"
	},
	{
		suffix: "takasaki.gunma.jp",
		reversed: "pj.amnug.ikasakat"
	},
	{
		suffix: "takayama.gunma.jp",
		reversed: "pj.amnug.amayakat"
	},
	{
		suffix: "tamamura.gunma.jp",
		reversed: "pj.amnug.arumamat"
	},
	{
		suffix: "tatebayashi.gunma.jp",
		reversed: "pj.amnug.ihsayabetat"
	},
	{
		suffix: "tomioka.gunma.jp",
		reversed: "pj.amnug.akoimot"
	},
	{
		suffix: "tsukiyono.gunma.jp",
		reversed: "pj.amnug.onoyikust"
	},
	{
		suffix: "tsumagoi.gunma.jp",
		reversed: "pj.amnug.iogamust"
	},
	{
		suffix: "ueno.gunma.jp",
		reversed: "pj.amnug.oneu"
	},
	{
		suffix: "yoshioka.gunma.jp",
		reversed: "pj.amnug.akoihsoy"
	},
	{
		suffix: "asaminami.hiroshima.jp",
		reversed: "pj.amihsorih.imanimasa"
	},
	{
		suffix: "daiwa.hiroshima.jp",
		reversed: "pj.amihsorih.awiad"
	},
	{
		suffix: "etajima.hiroshima.jp",
		reversed: "pj.amihsorih.amijate"
	},
	{
		suffix: "fuchu.hiroshima.jp",
		reversed: "pj.amihsorih.uhcuf"
	},
	{
		suffix: "fukuyama.hiroshima.jp",
		reversed: "pj.amihsorih.amayukuf"
	},
	{
		suffix: "hatsukaichi.hiroshima.jp",
		reversed: "pj.amihsorih.ihciakustah"
	},
	{
		suffix: "higashihiroshima.hiroshima.jp",
		reversed: "pj.amihsorih.amihsorihihsagih"
	},
	{
		suffix: "hongo.hiroshima.jp",
		reversed: "pj.amihsorih.ognoh"
	},
	{
		suffix: "jinsekikogen.hiroshima.jp",
		reversed: "pj.amihsorih.negokikesnij"
	},
	{
		suffix: "kaita.hiroshima.jp",
		reversed: "pj.amihsorih.atiak"
	},
	{
		suffix: "kui.hiroshima.jp",
		reversed: "pj.amihsorih.iuk"
	},
	{
		suffix: "kumano.hiroshima.jp",
		reversed: "pj.amihsorih.onamuk"
	},
	{
		suffix: "kure.hiroshima.jp",
		reversed: "pj.amihsorih.eruk"
	},
	{
		suffix: "mihara.hiroshima.jp",
		reversed: "pj.amihsorih.arahim"
	},
	{
		suffix: "miyoshi.hiroshima.jp",
		reversed: "pj.amihsorih.ihsoyim"
	},
	{
		suffix: "naka.hiroshima.jp",
		reversed: "pj.amihsorih.akan"
	},
	{
		suffix: "onomichi.hiroshima.jp",
		reversed: "pj.amihsorih.ihcimono"
	},
	{
		suffix: "osakikamijima.hiroshima.jp",
		reversed: "pj.amihsorih.amijimakikaso"
	},
	{
		suffix: "otake.hiroshima.jp",
		reversed: "pj.amihsorih.ekato"
	},
	{
		suffix: "saka.hiroshima.jp",
		reversed: "pj.amihsorih.akas"
	},
	{
		suffix: "sera.hiroshima.jp",
		reversed: "pj.amihsorih.ares"
	},
	{
		suffix: "seranishi.hiroshima.jp",
		reversed: "pj.amihsorih.ihsinares"
	},
	{
		suffix: "shinichi.hiroshima.jp",
		reversed: "pj.amihsorih.ihcinihs"
	},
	{
		suffix: "shobara.hiroshima.jp",
		reversed: "pj.amihsorih.arabohs"
	},
	{
		suffix: "takehara.hiroshima.jp",
		reversed: "pj.amihsorih.arahekat"
	},
	{
		suffix: "abashiri.hokkaido.jp",
		reversed: "pj.odiakkoh.irihsaba"
	},
	{
		suffix: "abira.hokkaido.jp",
		reversed: "pj.odiakkoh.ariba"
	},
	{
		suffix: "aibetsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustebia"
	},
	{
		suffix: "akabira.hokkaido.jp",
		reversed: "pj.odiakkoh.aribaka"
	},
	{
		suffix: "akkeshi.hokkaido.jp",
		reversed: "pj.odiakkoh.ihsekka"
	},
	{
		suffix: "asahikawa.hokkaido.jp",
		reversed: "pj.odiakkoh.awakihasa"
	},
	{
		suffix: "ashibetsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustebihsa"
	},
	{
		suffix: "ashoro.hokkaido.jp",
		reversed: "pj.odiakkoh.orohsa"
	},
	{
		suffix: "assabu.hokkaido.jp",
		reversed: "pj.odiakkoh.ubassa"
	},
	{
		suffix: "atsuma.hokkaido.jp",
		reversed: "pj.odiakkoh.amusta"
	},
	{
		suffix: "bibai.hokkaido.jp",
		reversed: "pj.odiakkoh.iabib"
	},
	{
		suffix: "biei.hokkaido.jp",
		reversed: "pj.odiakkoh.ieib"
	},
	{
		suffix: "bifuka.hokkaido.jp",
		reversed: "pj.odiakkoh.akufib"
	},
	{
		suffix: "bihoro.hokkaido.jp",
		reversed: "pj.odiakkoh.orohib"
	},
	{
		suffix: "biratori.hokkaido.jp",
		reversed: "pj.odiakkoh.irotarib"
	},
	{
		suffix: "chippubetsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustebuppihc"
	},
	{
		suffix: "chitose.hokkaido.jp",
		reversed: "pj.odiakkoh.esotihc"
	},
	{
		suffix: "date.hokkaido.jp",
		reversed: "pj.odiakkoh.etad"
	},
	{
		suffix: "ebetsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustebe"
	},
	{
		suffix: "embetsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustebme"
	},
	{
		suffix: "eniwa.hokkaido.jp",
		reversed: "pj.odiakkoh.awine"
	},
	{
		suffix: "erimo.hokkaido.jp",
		reversed: "pj.odiakkoh.omire"
	},
	{
		suffix: "esan.hokkaido.jp",
		reversed: "pj.odiakkoh.nase"
	},
	{
		suffix: "esashi.hokkaido.jp",
		reversed: "pj.odiakkoh.ihsase"
	},
	{
		suffix: "fukagawa.hokkaido.jp",
		reversed: "pj.odiakkoh.awagakuf"
	},
	{
		suffix: "fukushima.hokkaido.jp",
		reversed: "pj.odiakkoh.amihsukuf"
	},
	{
		suffix: "furano.hokkaido.jp",
		reversed: "pj.odiakkoh.onaruf"
	},
	{
		suffix: "furubira.hokkaido.jp",
		reversed: "pj.odiakkoh.ariburuf"
	},
	{
		suffix: "haboro.hokkaido.jp",
		reversed: "pj.odiakkoh.orobah"
	},
	{
		suffix: "hakodate.hokkaido.jp",
		reversed: "pj.odiakkoh.etadokah"
	},
	{
		suffix: "hamatonbetsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustebnotamah"
	},
	{
		suffix: "hidaka.hokkaido.jp",
		reversed: "pj.odiakkoh.akadih"
	},
	{
		suffix: "higashikagura.hokkaido.jp",
		reversed: "pj.odiakkoh.arugakihsagih"
	},
	{
		suffix: "higashikawa.hokkaido.jp",
		reversed: "pj.odiakkoh.awakihsagih"
	},
	{
		suffix: "hiroo.hokkaido.jp",
		reversed: "pj.odiakkoh.oorih"
	},
	{
		suffix: "hokuryu.hokkaido.jp",
		reversed: "pj.odiakkoh.uyrukoh"
	},
	{
		suffix: "hokuto.hokkaido.jp",
		reversed: "pj.odiakkoh.otukoh"
	},
	{
		suffix: "honbetsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustebnoh"
	},
	{
		suffix: "horokanai.hokkaido.jp",
		reversed: "pj.odiakkoh.ianakoroh"
	},
	{
		suffix: "horonobe.hokkaido.jp",
		reversed: "pj.odiakkoh.ebonoroh"
	},
	{
		suffix: "ikeda.hokkaido.jp",
		reversed: "pj.odiakkoh.adeki"
	},
	{
		suffix: "imakane.hokkaido.jp",
		reversed: "pj.odiakkoh.enakami"
	},
	{
		suffix: "ishikari.hokkaido.jp",
		reversed: "pj.odiakkoh.irakihsi"
	},
	{
		suffix: "iwamizawa.hokkaido.jp",
		reversed: "pj.odiakkoh.awazimawi"
	},
	{
		suffix: "iwanai.hokkaido.jp",
		reversed: "pj.odiakkoh.ianawi"
	},
	{
		suffix: "kamifurano.hokkaido.jp",
		reversed: "pj.odiakkoh.onarufimak"
	},
	{
		suffix: "kamikawa.hokkaido.jp",
		reversed: "pj.odiakkoh.awakimak"
	},
	{
		suffix: "kamishihoro.hokkaido.jp",
		reversed: "pj.odiakkoh.orohihsimak"
	},
	{
		suffix: "kamisunagawa.hokkaido.jp",
		reversed: "pj.odiakkoh.awaganusimak"
	},
	{
		suffix: "kamoenai.hokkaido.jp",
		reversed: "pj.odiakkoh.ianeomak"
	},
	{
		suffix: "kayabe.hokkaido.jp",
		reversed: "pj.odiakkoh.ebayak"
	},
	{
		suffix: "kembuchi.hokkaido.jp",
		reversed: "pj.odiakkoh.ihcubmek"
	},
	{
		suffix: "kikonai.hokkaido.jp",
		reversed: "pj.odiakkoh.ianokik"
	},
	{
		suffix: "kimobetsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustebomik"
	},
	{
		suffix: "kitahiroshima.hokkaido.jp",
		reversed: "pj.odiakkoh.amihsorihatik"
	},
	{
		suffix: "kitami.hokkaido.jp",
		reversed: "pj.odiakkoh.imatik"
	},
	{
		suffix: "kiyosato.hokkaido.jp",
		reversed: "pj.odiakkoh.otasoyik"
	},
	{
		suffix: "koshimizu.hokkaido.jp",
		reversed: "pj.odiakkoh.uzimihsok"
	},
	{
		suffix: "kunneppu.hokkaido.jp",
		reversed: "pj.odiakkoh.uppennuk"
	},
	{
		suffix: "kuriyama.hokkaido.jp",
		reversed: "pj.odiakkoh.amayiruk"
	},
	{
		suffix: "kuromatsunai.hokkaido.jp",
		reversed: "pj.odiakkoh.ianustamoruk"
	},
	{
		suffix: "kushiro.hokkaido.jp",
		reversed: "pj.odiakkoh.orihsuk"
	},
	{
		suffix: "kutchan.hokkaido.jp",
		reversed: "pj.odiakkoh.nahctuk"
	},
	{
		suffix: "kyowa.hokkaido.jp",
		reversed: "pj.odiakkoh.awoyk"
	},
	{
		suffix: "mashike.hokkaido.jp",
		reversed: "pj.odiakkoh.ekihsam"
	},
	{
		suffix: "matsumae.hokkaido.jp",
		reversed: "pj.odiakkoh.eamustam"
	},
	{
		suffix: "mikasa.hokkaido.jp",
		reversed: "pj.odiakkoh.asakim"
	},
	{
		suffix: "minamifurano.hokkaido.jp",
		reversed: "pj.odiakkoh.onarufimanim"
	},
	{
		suffix: "mombetsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustebmom"
	},
	{
		suffix: "moseushi.hokkaido.jp",
		reversed: "pj.odiakkoh.ihsuesom"
	},
	{
		suffix: "mukawa.hokkaido.jp",
		reversed: "pj.odiakkoh.awakum"
	},
	{
		suffix: "muroran.hokkaido.jp",
		reversed: "pj.odiakkoh.narorum"
	},
	{
		suffix: "naie.hokkaido.jp",
		reversed: "pj.odiakkoh.eian"
	},
	{
		suffix: "nakagawa.hokkaido.jp",
		reversed: "pj.odiakkoh.awagakan"
	},
	{
		suffix: "nakasatsunai.hokkaido.jp",
		reversed: "pj.odiakkoh.ianustasakan"
	},
	{
		suffix: "nakatombetsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustebmotakan"
	},
	{
		suffix: "nanae.hokkaido.jp",
		reversed: "pj.odiakkoh.eanan"
	},
	{
		suffix: "nanporo.hokkaido.jp",
		reversed: "pj.odiakkoh.oropnan"
	},
	{
		suffix: "nayoro.hokkaido.jp",
		reversed: "pj.odiakkoh.oroyan"
	},
	{
		suffix: "nemuro.hokkaido.jp",
		reversed: "pj.odiakkoh.orumen"
	},
	{
		suffix: "niikappu.hokkaido.jp",
		reversed: "pj.odiakkoh.uppakiin"
	},
	{
		suffix: "niki.hokkaido.jp",
		reversed: "pj.odiakkoh.ikin"
	},
	{
		suffix: "nishiokoppe.hokkaido.jp",
		reversed: "pj.odiakkoh.eppokoihsin"
	},
	{
		suffix: "noboribetsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustebirobon"
	},
	{
		suffix: "numata.hokkaido.jp",
		reversed: "pj.odiakkoh.atamun"
	},
	{
		suffix: "obihiro.hokkaido.jp",
		reversed: "pj.odiakkoh.orihibo"
	},
	{
		suffix: "obira.hokkaido.jp",
		reversed: "pj.odiakkoh.aribo"
	},
	{
		suffix: "oketo.hokkaido.jp",
		reversed: "pj.odiakkoh.oteko"
	},
	{
		suffix: "okoppe.hokkaido.jp",
		reversed: "pj.odiakkoh.eppoko"
	},
	{
		suffix: "otaru.hokkaido.jp",
		reversed: "pj.odiakkoh.urato"
	},
	{
		suffix: "otobe.hokkaido.jp",
		reversed: "pj.odiakkoh.eboto"
	},
	{
		suffix: "otofuke.hokkaido.jp",
		reversed: "pj.odiakkoh.ekufoto"
	},
	{
		suffix: "otoineppu.hokkaido.jp",
		reversed: "pj.odiakkoh.uppenioto"
	},
	{
		suffix: "oumu.hokkaido.jp",
		reversed: "pj.odiakkoh.umuo"
	},
	{
		suffix: "ozora.hokkaido.jp",
		reversed: "pj.odiakkoh.arozo"
	},
	{
		suffix: "pippu.hokkaido.jp",
		reversed: "pj.odiakkoh.uppip"
	},
	{
		suffix: "rankoshi.hokkaido.jp",
		reversed: "pj.odiakkoh.ihsoknar"
	},
	{
		suffix: "rebun.hokkaido.jp",
		reversed: "pj.odiakkoh.nuber"
	},
	{
		suffix: "rikubetsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustebukir"
	},
	{
		suffix: "rishiri.hokkaido.jp",
		reversed: "pj.odiakkoh.irihsir"
	},
	{
		suffix: "rishirifuji.hokkaido.jp",
		reversed: "pj.odiakkoh.ijufirihsir"
	},
	{
		suffix: "saroma.hokkaido.jp",
		reversed: "pj.odiakkoh.amoras"
	},
	{
		suffix: "sarufutsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustufuras"
	},
	{
		suffix: "shakotan.hokkaido.jp",
		reversed: "pj.odiakkoh.natokahs"
	},
	{
		suffix: "shari.hokkaido.jp",
		reversed: "pj.odiakkoh.irahs"
	},
	{
		suffix: "shibecha.hokkaido.jp",
		reversed: "pj.odiakkoh.ahcebihs"
	},
	{
		suffix: "shibetsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustebihs"
	},
	{
		suffix: "shikabe.hokkaido.jp",
		reversed: "pj.odiakkoh.ebakihs"
	},
	{
		suffix: "shikaoi.hokkaido.jp",
		reversed: "pj.odiakkoh.ioakihs"
	},
	{
		suffix: "shimamaki.hokkaido.jp",
		reversed: "pj.odiakkoh.ikamamihs"
	},
	{
		suffix: "shimizu.hokkaido.jp",
		reversed: "pj.odiakkoh.uzimihs"
	},
	{
		suffix: "shimokawa.hokkaido.jp",
		reversed: "pj.odiakkoh.awakomihs"
	},
	{
		suffix: "shinshinotsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustonihsnihs"
	},
	{
		suffix: "shintoku.hokkaido.jp",
		reversed: "pj.odiakkoh.ukotnihs"
	},
	{
		suffix: "shiranuka.hokkaido.jp",
		reversed: "pj.odiakkoh.akunarihs"
	},
	{
		suffix: "shiraoi.hokkaido.jp",
		reversed: "pj.odiakkoh.ioarihs"
	},
	{
		suffix: "shiriuchi.hokkaido.jp",
		reversed: "pj.odiakkoh.ihcuirihs"
	},
	{
		suffix: "sobetsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustebos"
	},
	{
		suffix: "sunagawa.hokkaido.jp",
		reversed: "pj.odiakkoh.awaganus"
	},
	{
		suffix: "taiki.hokkaido.jp",
		reversed: "pj.odiakkoh.ikiat"
	},
	{
		suffix: "takasu.hokkaido.jp",
		reversed: "pj.odiakkoh.usakat"
	},
	{
		suffix: "takikawa.hokkaido.jp",
		reversed: "pj.odiakkoh.awakikat"
	},
	{
		suffix: "takinoue.hokkaido.jp",
		reversed: "pj.odiakkoh.euonikat"
	},
	{
		suffix: "teshikaga.hokkaido.jp",
		reversed: "pj.odiakkoh.agakihset"
	},
	{
		suffix: "tobetsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustebot"
	},
	{
		suffix: "tohma.hokkaido.jp",
		reversed: "pj.odiakkoh.amhot"
	},
	{
		suffix: "tomakomai.hokkaido.jp",
		reversed: "pj.odiakkoh.iamokamot"
	},
	{
		suffix: "tomari.hokkaido.jp",
		reversed: "pj.odiakkoh.iramot"
	},
	{
		suffix: "toya.hokkaido.jp",
		reversed: "pj.odiakkoh.ayot"
	},
	{
		suffix: "toyako.hokkaido.jp",
		reversed: "pj.odiakkoh.okayot"
	},
	{
		suffix: "toyotomi.hokkaido.jp",
		reversed: "pj.odiakkoh.imotoyot"
	},
	{
		suffix: "toyoura.hokkaido.jp",
		reversed: "pj.odiakkoh.aruoyot"
	},
	{
		suffix: "tsubetsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustebust"
	},
	{
		suffix: "tsukigata.hokkaido.jp",
		reversed: "pj.odiakkoh.atagikust"
	},
	{
		suffix: "urakawa.hokkaido.jp",
		reversed: "pj.odiakkoh.awakaru"
	},
	{
		suffix: "urausu.hokkaido.jp",
		reversed: "pj.odiakkoh.usuaru"
	},
	{
		suffix: "uryu.hokkaido.jp",
		reversed: "pj.odiakkoh.uyru"
	},
	{
		suffix: "utashinai.hokkaido.jp",
		reversed: "pj.odiakkoh.ianihsatu"
	},
	{
		suffix: "wakkanai.hokkaido.jp",
		reversed: "pj.odiakkoh.ianakkaw"
	},
	{
		suffix: "wassamu.hokkaido.jp",
		reversed: "pj.odiakkoh.umassaw"
	},
	{
		suffix: "yakumo.hokkaido.jp",
		reversed: "pj.odiakkoh.omukay"
	},
	{
		suffix: "yoichi.hokkaido.jp",
		reversed: "pj.odiakkoh.ihcioy"
	},
	{
		suffix: "aioi.hyogo.jp",
		reversed: "pj.ogoyh.ioia"
	},
	{
		suffix: "akashi.hyogo.jp",
		reversed: "pj.ogoyh.ihsaka"
	},
	{
		suffix: "ako.hyogo.jp",
		reversed: "pj.ogoyh.oka"
	},
	{
		suffix: "amagasaki.hyogo.jp",
		reversed: "pj.ogoyh.ikasagama"
	},
	{
		suffix: "aogaki.hyogo.jp",
		reversed: "pj.ogoyh.ikagoa"
	},
	{
		suffix: "asago.hyogo.jp",
		reversed: "pj.ogoyh.ogasa"
	},
	{
		suffix: "ashiya.hyogo.jp",
		reversed: "pj.ogoyh.ayihsa"
	},
	{
		suffix: "awaji.hyogo.jp",
		reversed: "pj.ogoyh.ijawa"
	},
	{
		suffix: "fukusaki.hyogo.jp",
		reversed: "pj.ogoyh.ikasukuf"
	},
	{
		suffix: "goshiki.hyogo.jp",
		reversed: "pj.ogoyh.ikihsog"
	},
	{
		suffix: "harima.hyogo.jp",
		reversed: "pj.ogoyh.amirah"
	},
	{
		suffix: "himeji.hyogo.jp",
		reversed: "pj.ogoyh.ijemih"
	},
	{
		suffix: "ichikawa.hyogo.jp",
		reversed: "pj.ogoyh.awakihci"
	},
	{
		suffix: "inagawa.hyogo.jp",
		reversed: "pj.ogoyh.awagani"
	},
	{
		suffix: "itami.hyogo.jp",
		reversed: "pj.ogoyh.imati"
	},
	{
		suffix: "kakogawa.hyogo.jp",
		reversed: "pj.ogoyh.awagokak"
	},
	{
		suffix: "kamigori.hyogo.jp",
		reversed: "pj.ogoyh.irogimak"
	},
	{
		suffix: "kamikawa.hyogo.jp",
		reversed: "pj.ogoyh.awakimak"
	},
	{
		suffix: "kasai.hyogo.jp",
		reversed: "pj.ogoyh.iasak"
	},
	{
		suffix: "kasuga.hyogo.jp",
		reversed: "pj.ogoyh.agusak"
	},
	{
		suffix: "kawanishi.hyogo.jp",
		reversed: "pj.ogoyh.ihsinawak"
	},
	{
		suffix: "miki.hyogo.jp",
		reversed: "pj.ogoyh.ikim"
	},
	{
		suffix: "minamiawaji.hyogo.jp",
		reversed: "pj.ogoyh.ijawaimanim"
	},
	{
		suffix: "nishinomiya.hyogo.jp",
		reversed: "pj.ogoyh.ayimonihsin"
	},
	{
		suffix: "nishiwaki.hyogo.jp",
		reversed: "pj.ogoyh.ikawihsin"
	},
	{
		suffix: "ono.hyogo.jp",
		reversed: "pj.ogoyh.ono"
	},
	{
		suffix: "sanda.hyogo.jp",
		reversed: "pj.ogoyh.adnas"
	},
	{
		suffix: "sannan.hyogo.jp",
		reversed: "pj.ogoyh.nannas"
	},
	{
		suffix: "sasayama.hyogo.jp",
		reversed: "pj.ogoyh.amayasas"
	},
	{
		suffix: "sayo.hyogo.jp",
		reversed: "pj.ogoyh.oyas"
	},
	{
		suffix: "shingu.hyogo.jp",
		reversed: "pj.ogoyh.ugnihs"
	},
	{
		suffix: "shinonsen.hyogo.jp",
		reversed: "pj.ogoyh.nesnonihs"
	},
	{
		suffix: "shiso.hyogo.jp",
		reversed: "pj.ogoyh.osihs"
	},
	{
		suffix: "sumoto.hyogo.jp",
		reversed: "pj.ogoyh.otomus"
	},
	{
		suffix: "taishi.hyogo.jp",
		reversed: "pj.ogoyh.ihsiat"
	},
	{
		suffix: "taka.hyogo.jp",
		reversed: "pj.ogoyh.akat"
	},
	{
		suffix: "takarazuka.hyogo.jp",
		reversed: "pj.ogoyh.akuzarakat"
	},
	{
		suffix: "takasago.hyogo.jp",
		reversed: "pj.ogoyh.ogasakat"
	},
	{
		suffix: "takino.hyogo.jp",
		reversed: "pj.ogoyh.onikat"
	},
	{
		suffix: "tamba.hyogo.jp",
		reversed: "pj.ogoyh.abmat"
	},
	{
		suffix: "tatsuno.hyogo.jp",
		reversed: "pj.ogoyh.onustat"
	},
	{
		suffix: "toyooka.hyogo.jp",
		reversed: "pj.ogoyh.akooyot"
	},
	{
		suffix: "yabu.hyogo.jp",
		reversed: "pj.ogoyh.ubay"
	},
	{
		suffix: "yashiro.hyogo.jp",
		reversed: "pj.ogoyh.orihsay"
	},
	{
		suffix: "yoka.hyogo.jp",
		reversed: "pj.ogoyh.akoy"
	},
	{
		suffix: "yokawa.hyogo.jp",
		reversed: "pj.ogoyh.awakoy"
	},
	{
		suffix: "ami.ibaraki.jp",
		reversed: "pj.ikarabi.ima"
	},
	{
		suffix: "asahi.ibaraki.jp",
		reversed: "pj.ikarabi.ihasa"
	},
	{
		suffix: "bando.ibaraki.jp",
		reversed: "pj.ikarabi.odnab"
	},
	{
		suffix: "chikusei.ibaraki.jp",
		reversed: "pj.ikarabi.iesukihc"
	},
	{
		suffix: "daigo.ibaraki.jp",
		reversed: "pj.ikarabi.ogiad"
	},
	{
		suffix: "fujishiro.ibaraki.jp",
		reversed: "pj.ikarabi.orihsijuf"
	},
	{
		suffix: "hitachi.ibaraki.jp",
		reversed: "pj.ikarabi.ihcatih"
	},
	{
		suffix: "hitachinaka.ibaraki.jp",
		reversed: "pj.ikarabi.akanihcatih"
	},
	{
		suffix: "hitachiomiya.ibaraki.jp",
		reversed: "pj.ikarabi.ayimoihcatih"
	},
	{
		suffix: "hitachiota.ibaraki.jp",
		reversed: "pj.ikarabi.atoihcatih"
	},
	{
		suffix: "ibaraki.ibaraki.jp",
		reversed: "pj.ikarabi.ikarabi"
	},
	{
		suffix: "ina.ibaraki.jp",
		reversed: "pj.ikarabi.ani"
	},
	{
		suffix: "inashiki.ibaraki.jp",
		reversed: "pj.ikarabi.ikihsani"
	},
	{
		suffix: "itako.ibaraki.jp",
		reversed: "pj.ikarabi.okati"
	},
	{
		suffix: "iwama.ibaraki.jp",
		reversed: "pj.ikarabi.amawi"
	},
	{
		suffix: "joso.ibaraki.jp",
		reversed: "pj.ikarabi.osoj"
	},
	{
		suffix: "kamisu.ibaraki.jp",
		reversed: "pj.ikarabi.usimak"
	},
	{
		suffix: "kasama.ibaraki.jp",
		reversed: "pj.ikarabi.amasak"
	},
	{
		suffix: "kashima.ibaraki.jp",
		reversed: "pj.ikarabi.amihsak"
	},
	{
		suffix: "kasumigaura.ibaraki.jp",
		reversed: "pj.ikarabi.aruagimusak"
	},
	{
		suffix: "koga.ibaraki.jp",
		reversed: "pj.ikarabi.agok"
	},
	{
		suffix: "miho.ibaraki.jp",
		reversed: "pj.ikarabi.ohim"
	},
	{
		suffix: "mito.ibaraki.jp",
		reversed: "pj.ikarabi.otim"
	},
	{
		suffix: "moriya.ibaraki.jp",
		reversed: "pj.ikarabi.ayirom"
	},
	{
		suffix: "naka.ibaraki.jp",
		reversed: "pj.ikarabi.akan"
	},
	{
		suffix: "namegata.ibaraki.jp",
		reversed: "pj.ikarabi.atageman"
	},
	{
		suffix: "oarai.ibaraki.jp",
		reversed: "pj.ikarabi.iarao"
	},
	{
		suffix: "ogawa.ibaraki.jp",
		reversed: "pj.ikarabi.awago"
	},
	{
		suffix: "omitama.ibaraki.jp",
		reversed: "pj.ikarabi.amatimo"
	},
	{
		suffix: "ryugasaki.ibaraki.jp",
		reversed: "pj.ikarabi.ikasaguyr"
	},
	{
		suffix: "sakai.ibaraki.jp",
		reversed: "pj.ikarabi.iakas"
	},
	{
		suffix: "sakuragawa.ibaraki.jp",
		reversed: "pj.ikarabi.awagarukas"
	},
	{
		suffix: "shimodate.ibaraki.jp",
		reversed: "pj.ikarabi.etadomihs"
	},
	{
		suffix: "shimotsuma.ibaraki.jp",
		reversed: "pj.ikarabi.amustomihs"
	},
	{
		suffix: "shirosato.ibaraki.jp",
		reversed: "pj.ikarabi.otasorihs"
	},
	{
		suffix: "sowa.ibaraki.jp",
		reversed: "pj.ikarabi.awos"
	},
	{
		suffix: "suifu.ibaraki.jp",
		reversed: "pj.ikarabi.ufius"
	},
	{
		suffix: "takahagi.ibaraki.jp",
		reversed: "pj.ikarabi.igahakat"
	},
	{
		suffix: "tamatsukuri.ibaraki.jp",
		reversed: "pj.ikarabi.irukustamat"
	},
	{
		suffix: "tokai.ibaraki.jp",
		reversed: "pj.ikarabi.iakot"
	},
	{
		suffix: "tomobe.ibaraki.jp",
		reversed: "pj.ikarabi.ebomot"
	},
	{
		suffix: "tone.ibaraki.jp",
		reversed: "pj.ikarabi.enot"
	},
	{
		suffix: "toride.ibaraki.jp",
		reversed: "pj.ikarabi.edirot"
	},
	{
		suffix: "tsuchiura.ibaraki.jp",
		reversed: "pj.ikarabi.aruihcust"
	},
	{
		suffix: "tsukuba.ibaraki.jp",
		reversed: "pj.ikarabi.abukust"
	},
	{
		suffix: "uchihara.ibaraki.jp",
		reversed: "pj.ikarabi.arahihcu"
	},
	{
		suffix: "ushiku.ibaraki.jp",
		reversed: "pj.ikarabi.ukihsu"
	},
	{
		suffix: "yachiyo.ibaraki.jp",
		reversed: "pj.ikarabi.oyihcay"
	},
	{
		suffix: "yamagata.ibaraki.jp",
		reversed: "pj.ikarabi.atagamay"
	},
	{
		suffix: "yawara.ibaraki.jp",
		reversed: "pj.ikarabi.araway"
	},
	{
		suffix: "yuki.ibaraki.jp",
		reversed: "pj.ikarabi.ikuy"
	},
	{
		suffix: "anamizu.ishikawa.jp",
		reversed: "pj.awakihsi.uzimana"
	},
	{
		suffix: "hakui.ishikawa.jp",
		reversed: "pj.awakihsi.iukah"
	},
	{
		suffix: "hakusan.ishikawa.jp",
		reversed: "pj.awakihsi.nasukah"
	},
	{
		suffix: "kaga.ishikawa.jp",
		reversed: "pj.awakihsi.agak"
	},
	{
		suffix: "kahoku.ishikawa.jp",
		reversed: "pj.awakihsi.ukohak"
	},
	{
		suffix: "kanazawa.ishikawa.jp",
		reversed: "pj.awakihsi.awazanak"
	},
	{
		suffix: "kawakita.ishikawa.jp",
		reversed: "pj.awakihsi.atikawak"
	},
	{
		suffix: "komatsu.ishikawa.jp",
		reversed: "pj.awakihsi.ustamok"
	},
	{
		suffix: "nakanoto.ishikawa.jp",
		reversed: "pj.awakihsi.otonakan"
	},
	{
		suffix: "nanao.ishikawa.jp",
		reversed: "pj.awakihsi.oanan"
	},
	{
		suffix: "nomi.ishikawa.jp",
		reversed: "pj.awakihsi.imon"
	},
	{
		suffix: "nonoichi.ishikawa.jp",
		reversed: "pj.awakihsi.ihcionon"
	},
	{
		suffix: "noto.ishikawa.jp",
		reversed: "pj.awakihsi.oton"
	},
	{
		suffix: "shika.ishikawa.jp",
		reversed: "pj.awakihsi.akihs"
	},
	{
		suffix: "suzu.ishikawa.jp",
		reversed: "pj.awakihsi.uzus"
	},
	{
		suffix: "tsubata.ishikawa.jp",
		reversed: "pj.awakihsi.atabust"
	},
	{
		suffix: "tsurugi.ishikawa.jp",
		reversed: "pj.awakihsi.igurust"
	},
	{
		suffix: "uchinada.ishikawa.jp",
		reversed: "pj.awakihsi.adanihcu"
	},
	{
		suffix: "wajima.ishikawa.jp",
		reversed: "pj.awakihsi.amijaw"
	},
	{
		suffix: "fudai.iwate.jp",
		reversed: "pj.etawi.iaduf"
	},
	{
		suffix: "fujisawa.iwate.jp",
		reversed: "pj.etawi.awasijuf"
	},
	{
		suffix: "hanamaki.iwate.jp",
		reversed: "pj.etawi.ikamanah"
	},
	{
		suffix: "hiraizumi.iwate.jp",
		reversed: "pj.etawi.imuziarih"
	},
	{
		suffix: "hirono.iwate.jp",
		reversed: "pj.etawi.onorih"
	},
	{
		suffix: "ichinohe.iwate.jp",
		reversed: "pj.etawi.ehonihci"
	},
	{
		suffix: "ichinoseki.iwate.jp",
		reversed: "pj.etawi.ikesonihci"
	},
	{
		suffix: "iwaizumi.iwate.jp",
		reversed: "pj.etawi.imuziawi"
	},
	{
		suffix: "iwate.iwate.jp",
		reversed: "pj.etawi.etawi"
	},
	{
		suffix: "joboji.iwate.jp",
		reversed: "pj.etawi.ijoboj"
	},
	{
		suffix: "kamaishi.iwate.jp",
		reversed: "pj.etawi.ihsiamak"
	},
	{
		suffix: "kanegasaki.iwate.jp",
		reversed: "pj.etawi.ikasagenak"
	},
	{
		suffix: "karumai.iwate.jp",
		reversed: "pj.etawi.iamurak"
	},
	{
		suffix: "kawai.iwate.jp",
		reversed: "pj.etawi.iawak"
	},
	{
		suffix: "kitakami.iwate.jp",
		reversed: "pj.etawi.imakatik"
	},
	{
		suffix: "kuji.iwate.jp",
		reversed: "pj.etawi.ijuk"
	},
	{
		suffix: "kunohe.iwate.jp",
		reversed: "pj.etawi.ehonuk"
	},
	{
		suffix: "kuzumaki.iwate.jp",
		reversed: "pj.etawi.ikamuzuk"
	},
	{
		suffix: "miyako.iwate.jp",
		reversed: "pj.etawi.okayim"
	},
	{
		suffix: "mizusawa.iwate.jp",
		reversed: "pj.etawi.awasuzim"
	},
	{
		suffix: "morioka.iwate.jp",
		reversed: "pj.etawi.akoirom"
	},
	{
		suffix: "ninohe.iwate.jp",
		reversed: "pj.etawi.ehonin"
	},
	{
		suffix: "noda.iwate.jp",
		reversed: "pj.etawi.adon"
	},
	{
		suffix: "ofunato.iwate.jp",
		reversed: "pj.etawi.otanufo"
	},
	{
		suffix: "oshu.iwate.jp",
		reversed: "pj.etawi.uhso"
	},
	{
		suffix: "otsuchi.iwate.jp",
		reversed: "pj.etawi.ihcusto"
	},
	{
		suffix: "rikuzentakata.iwate.jp",
		reversed: "pj.etawi.atakatnezukir"
	},
	{
		suffix: "shiwa.iwate.jp",
		reversed: "pj.etawi.awihs"
	},
	{
		suffix: "shizukuishi.iwate.jp",
		reversed: "pj.etawi.ihsiukuzihs"
	},
	{
		suffix: "sumita.iwate.jp",
		reversed: "pj.etawi.atimus"
	},
	{
		suffix: "tanohata.iwate.jp",
		reversed: "pj.etawi.atahonat"
	},
	{
		suffix: "tono.iwate.jp",
		reversed: "pj.etawi.onot"
	},
	{
		suffix: "yahaba.iwate.jp",
		reversed: "pj.etawi.abahay"
	},
	{
		suffix: "yamada.iwate.jp",
		reversed: "pj.etawi.adamay"
	},
	{
		suffix: "ayagawa.kagawa.jp",
		reversed: "pj.awagak.awagaya"
	},
	{
		suffix: "higashikagawa.kagawa.jp",
		reversed: "pj.awagak.awagakihsagih"
	},
	{
		suffix: "kanonji.kagawa.jp",
		reversed: "pj.awagak.ijnonak"
	},
	{
		suffix: "kotohira.kagawa.jp",
		reversed: "pj.awagak.arihotok"
	},
	{
		suffix: "manno.kagawa.jp",
		reversed: "pj.awagak.onnam"
	},
	{
		suffix: "marugame.kagawa.jp",
		reversed: "pj.awagak.emaguram"
	},
	{
		suffix: "mitoyo.kagawa.jp",
		reversed: "pj.awagak.oyotim"
	},
	{
		suffix: "naoshima.kagawa.jp",
		reversed: "pj.awagak.amihsoan"
	},
	{
		suffix: "sanuki.kagawa.jp",
		reversed: "pj.awagak.ikunas"
	},
	{
		suffix: "tadotsu.kagawa.jp",
		reversed: "pj.awagak.ustodat"
	},
	{
		suffix: "takamatsu.kagawa.jp",
		reversed: "pj.awagak.ustamakat"
	},
	{
		suffix: "tonosho.kagawa.jp",
		reversed: "pj.awagak.ohsonot"
	},
	{
		suffix: "uchinomi.kagawa.jp",
		reversed: "pj.awagak.imonihcu"
	},
	{
		suffix: "utazu.kagawa.jp",
		reversed: "pj.awagak.uzatu"
	},
	{
		suffix: "zentsuji.kagawa.jp",
		reversed: "pj.awagak.ijustnez"
	},
	{
		suffix: "akune.kagoshima.jp",
		reversed: "pj.amihsogak.enuka"
	},
	{
		suffix: "amami.kagoshima.jp",
		reversed: "pj.amihsogak.imama"
	},
	{
		suffix: "hioki.kagoshima.jp",
		reversed: "pj.amihsogak.ikoih"
	},
	{
		suffix: "isa.kagoshima.jp",
		reversed: "pj.amihsogak.asi"
	},
	{
		suffix: "isen.kagoshima.jp",
		reversed: "pj.amihsogak.nesi"
	},
	{
		suffix: "izumi.kagoshima.jp",
		reversed: "pj.amihsogak.imuzi"
	},
	{
		suffix: "kagoshima.kagoshima.jp",
		reversed: "pj.amihsogak.amihsogak"
	},
	{
		suffix: "kanoya.kagoshima.jp",
		reversed: "pj.amihsogak.ayonak"
	},
	{
		suffix: "kawanabe.kagoshima.jp",
		reversed: "pj.amihsogak.ebanawak"
	},
	{
		suffix: "kinko.kagoshima.jp",
		reversed: "pj.amihsogak.oknik"
	},
	{
		suffix: "kouyama.kagoshima.jp",
		reversed: "pj.amihsogak.amayuok"
	},
	{
		suffix: "makurazaki.kagoshima.jp",
		reversed: "pj.amihsogak.ikazarukam"
	},
	{
		suffix: "matsumoto.kagoshima.jp",
		reversed: "pj.amihsogak.otomustam"
	},
	{
		suffix: "minamitane.kagoshima.jp",
		reversed: "pj.amihsogak.enatimanim"
	},
	{
		suffix: "nakatane.kagoshima.jp",
		reversed: "pj.amihsogak.enatakan"
	},
	{
		suffix: "nishinoomote.kagoshima.jp",
		reversed: "pj.amihsogak.etomoonihsin"
	},
	{
		suffix: "satsumasendai.kagoshima.jp",
		reversed: "pj.amihsogak.iadnesamustas"
	},
	{
		suffix: "soo.kagoshima.jp",
		reversed: "pj.amihsogak.oos"
	},
	{
		suffix: "tarumizu.kagoshima.jp",
		reversed: "pj.amihsogak.uzimurat"
	},
	{
		suffix: "yusui.kagoshima.jp",
		reversed: "pj.amihsogak.iusuy"
	},
	{
		suffix: "aikawa.kanagawa.jp",
		reversed: "pj.awaganak.awakia"
	},
	{
		suffix: "atsugi.kanagawa.jp",
		reversed: "pj.awaganak.igusta"
	},
	{
		suffix: "ayase.kanagawa.jp",
		reversed: "pj.awaganak.esaya"
	},
	{
		suffix: "chigasaki.kanagawa.jp",
		reversed: "pj.awaganak.ikasagihc"
	},
	{
		suffix: "ebina.kanagawa.jp",
		reversed: "pj.awaganak.anibe"
	},
	{
		suffix: "fujisawa.kanagawa.jp",
		reversed: "pj.awaganak.awasijuf"
	},
	{
		suffix: "hadano.kanagawa.jp",
		reversed: "pj.awaganak.onadah"
	},
	{
		suffix: "hakone.kanagawa.jp",
		reversed: "pj.awaganak.enokah"
	},
	{
		suffix: "hiratsuka.kanagawa.jp",
		reversed: "pj.awaganak.akustarih"
	},
	{
		suffix: "isehara.kanagawa.jp",
		reversed: "pj.awaganak.arahesi"
	},
	{
		suffix: "kaisei.kanagawa.jp",
		reversed: "pj.awaganak.iesiak"
	},
	{
		suffix: "kamakura.kanagawa.jp",
		reversed: "pj.awaganak.arukamak"
	},
	{
		suffix: "kiyokawa.kanagawa.jp",
		reversed: "pj.awaganak.awakoyik"
	},
	{
		suffix: "matsuda.kanagawa.jp",
		reversed: "pj.awaganak.adustam"
	},
	{
		suffix: "minamiashigara.kanagawa.jp",
		reversed: "pj.awaganak.aragihsaimanim"
	},
	{
		suffix: "miura.kanagawa.jp",
		reversed: "pj.awaganak.aruim"
	},
	{
		suffix: "nakai.kanagawa.jp",
		reversed: "pj.awaganak.iakan"
	},
	{
		suffix: "ninomiya.kanagawa.jp",
		reversed: "pj.awaganak.ayimonin"
	},
	{
		suffix: "odawara.kanagawa.jp",
		reversed: "pj.awaganak.arawado"
	},
	{
		suffix: "oi.kanagawa.jp",
		reversed: "pj.awaganak.io"
	},
	{
		suffix: "oiso.kanagawa.jp",
		reversed: "pj.awaganak.osio"
	},
	{
		suffix: "sagamihara.kanagawa.jp",
		reversed: "pj.awaganak.arahimagas"
	},
	{
		suffix: "samukawa.kanagawa.jp",
		reversed: "pj.awaganak.awakumas"
	},
	{
		suffix: "tsukui.kanagawa.jp",
		reversed: "pj.awaganak.iukust"
	},
	{
		suffix: "yamakita.kanagawa.jp",
		reversed: "pj.awaganak.atikamay"
	},
	{
		suffix: "yamato.kanagawa.jp",
		reversed: "pj.awaganak.otamay"
	},
	{
		suffix: "yokosuka.kanagawa.jp",
		reversed: "pj.awaganak.akusokoy"
	},
	{
		suffix: "yugawara.kanagawa.jp",
		reversed: "pj.awaganak.arawaguy"
	},
	{
		suffix: "zama.kanagawa.jp",
		reversed: "pj.awaganak.amaz"
	},
	{
		suffix: "zushi.kanagawa.jp",
		reversed: "pj.awaganak.ihsuz"
	},
	{
		suffix: "aki.kochi.jp",
		reversed: "pj.ihcok.ika"
	},
	{
		suffix: "geisei.kochi.jp",
		reversed: "pj.ihcok.iesieg"
	},
	{
		suffix: "hidaka.kochi.jp",
		reversed: "pj.ihcok.akadih"
	},
	{
		suffix: "higashitsuno.kochi.jp",
		reversed: "pj.ihcok.onustihsagih"
	},
	{
		suffix: "ino.kochi.jp",
		reversed: "pj.ihcok.oni"
	},
	{
		suffix: "kagami.kochi.jp",
		reversed: "pj.ihcok.imagak"
	},
	{
		suffix: "kami.kochi.jp",
		reversed: "pj.ihcok.imak"
	},
	{
		suffix: "kitagawa.kochi.jp",
		reversed: "pj.ihcok.awagatik"
	},
	{
		suffix: "kochi.kochi.jp",
		reversed: "pj.ihcok.ihcok"
	},
	{
		suffix: "mihara.kochi.jp",
		reversed: "pj.ihcok.arahim"
	},
	{
		suffix: "motoyama.kochi.jp",
		reversed: "pj.ihcok.amayotom"
	},
	{
		suffix: "muroto.kochi.jp",
		reversed: "pj.ihcok.otorum"
	},
	{
		suffix: "nahari.kochi.jp",
		reversed: "pj.ihcok.irahan"
	},
	{
		suffix: "nakamura.kochi.jp",
		reversed: "pj.ihcok.arumakan"
	},
	{
		suffix: "nankoku.kochi.jp",
		reversed: "pj.ihcok.ukoknan"
	},
	{
		suffix: "nishitosa.kochi.jp",
		reversed: "pj.ihcok.asotihsin"
	},
	{
		suffix: "niyodogawa.kochi.jp",
		reversed: "pj.ihcok.awagodoyin"
	},
	{
		suffix: "ochi.kochi.jp",
		reversed: "pj.ihcok.ihco"
	},
	{
		suffix: "okawa.kochi.jp",
		reversed: "pj.ihcok.awako"
	},
	{
		suffix: "otoyo.kochi.jp",
		reversed: "pj.ihcok.oyoto"
	},
	{
		suffix: "otsuki.kochi.jp",
		reversed: "pj.ihcok.ikusto"
	},
	{
		suffix: "sakawa.kochi.jp",
		reversed: "pj.ihcok.awakas"
	},
	{
		suffix: "sukumo.kochi.jp",
		reversed: "pj.ihcok.omukus"
	},
	{
		suffix: "susaki.kochi.jp",
		reversed: "pj.ihcok.ikasus"
	},
	{
		suffix: "tosa.kochi.jp",
		reversed: "pj.ihcok.asot"
	},
	{
		suffix: "tosashimizu.kochi.jp",
		reversed: "pj.ihcok.uzimihsasot"
	},
	{
		suffix: "toyo.kochi.jp",
		reversed: "pj.ihcok.oyot"
	},
	{
		suffix: "tsuno.kochi.jp",
		reversed: "pj.ihcok.onust"
	},
	{
		suffix: "umaji.kochi.jp",
		reversed: "pj.ihcok.ijamu"
	},
	{
		suffix: "yasuda.kochi.jp",
		reversed: "pj.ihcok.adusay"
	},
	{
		suffix: "yusuhara.kochi.jp",
		reversed: "pj.ihcok.arahusuy"
	},
	{
		suffix: "amakusa.kumamoto.jp",
		reversed: "pj.otomamuk.asukama"
	},
	{
		suffix: "arao.kumamoto.jp",
		reversed: "pj.otomamuk.oara"
	},
	{
		suffix: "aso.kumamoto.jp",
		reversed: "pj.otomamuk.osa"
	},
	{
		suffix: "choyo.kumamoto.jp",
		reversed: "pj.otomamuk.oyohc"
	},
	{
		suffix: "gyokuto.kumamoto.jp",
		reversed: "pj.otomamuk.otukoyg"
	},
	{
		suffix: "kamiamakusa.kumamoto.jp",
		reversed: "pj.otomamuk.asukamaimak"
	},
	{
		suffix: "kikuchi.kumamoto.jp",
		reversed: "pj.otomamuk.ihcukik"
	},
	{
		suffix: "kumamoto.kumamoto.jp",
		reversed: "pj.otomamuk.otomamuk"
	},
	{
		suffix: "mashiki.kumamoto.jp",
		reversed: "pj.otomamuk.ikihsam"
	},
	{
		suffix: "mifune.kumamoto.jp",
		reversed: "pj.otomamuk.enufim"
	},
	{
		suffix: "minamata.kumamoto.jp",
		reversed: "pj.otomamuk.atamanim"
	},
	{
		suffix: "minamioguni.kumamoto.jp",
		reversed: "pj.otomamuk.inugoimanim"
	},
	{
		suffix: "nagasu.kumamoto.jp",
		reversed: "pj.otomamuk.usagan"
	},
	{
		suffix: "nishihara.kumamoto.jp",
		reversed: "pj.otomamuk.arahihsin"
	},
	{
		suffix: "oguni.kumamoto.jp",
		reversed: "pj.otomamuk.inugo"
	},
	{
		suffix: "ozu.kumamoto.jp",
		reversed: "pj.otomamuk.uzo"
	},
	{
		suffix: "sumoto.kumamoto.jp",
		reversed: "pj.otomamuk.otomus"
	},
	{
		suffix: "takamori.kumamoto.jp",
		reversed: "pj.otomamuk.iromakat"
	},
	{
		suffix: "uki.kumamoto.jp",
		reversed: "pj.otomamuk.iku"
	},
	{
		suffix: "uto.kumamoto.jp",
		reversed: "pj.otomamuk.otu"
	},
	{
		suffix: "yamaga.kumamoto.jp",
		reversed: "pj.otomamuk.agamay"
	},
	{
		suffix: "yamato.kumamoto.jp",
		reversed: "pj.otomamuk.otamay"
	},
	{
		suffix: "yatsushiro.kumamoto.jp",
		reversed: "pj.otomamuk.orihsustay"
	},
	{
		suffix: "ayabe.kyoto.jp",
		reversed: "pj.otoyk.ebaya"
	},
	{
		suffix: "fukuchiyama.kyoto.jp",
		reversed: "pj.otoyk.amayihcukuf"
	},
	{
		suffix: "higashiyama.kyoto.jp",
		reversed: "pj.otoyk.amayihsagih"
	},
	{
		suffix: "ide.kyoto.jp",
		reversed: "pj.otoyk.edi"
	},
	{
		suffix: "ine.kyoto.jp",
		reversed: "pj.otoyk.eni"
	},
	{
		suffix: "joyo.kyoto.jp",
		reversed: "pj.otoyk.oyoj"
	},
	{
		suffix: "kameoka.kyoto.jp",
		reversed: "pj.otoyk.akoemak"
	},
	{
		suffix: "kamo.kyoto.jp",
		reversed: "pj.otoyk.omak"
	},
	{
		suffix: "kita.kyoto.jp",
		reversed: "pj.otoyk.atik"
	},
	{
		suffix: "kizu.kyoto.jp",
		reversed: "pj.otoyk.uzik"
	},
	{
		suffix: "kumiyama.kyoto.jp",
		reversed: "pj.otoyk.amayimuk"
	},
	{
		suffix: "kyotamba.kyoto.jp",
		reversed: "pj.otoyk.abmatoyk"
	},
	{
		suffix: "kyotanabe.kyoto.jp",
		reversed: "pj.otoyk.ebanatoyk"
	},
	{
		suffix: "kyotango.kyoto.jp",
		reversed: "pj.otoyk.ognatoyk"
	},
	{
		suffix: "maizuru.kyoto.jp",
		reversed: "pj.otoyk.uruziam"
	},
	{
		suffix: "minami.kyoto.jp",
		reversed: "pj.otoyk.imanim"
	},
	{
		suffix: "minamiyamashiro.kyoto.jp",
		reversed: "pj.otoyk.orihsamayimanim"
	},
	{
		suffix: "miyazu.kyoto.jp",
		reversed: "pj.otoyk.uzayim"
	},
	{
		suffix: "muko.kyoto.jp",
		reversed: "pj.otoyk.okum"
	},
	{
		suffix: "nagaokakyo.kyoto.jp",
		reversed: "pj.otoyk.oykakoagan"
	},
	{
		suffix: "nakagyo.kyoto.jp",
		reversed: "pj.otoyk.oygakan"
	},
	{
		suffix: "nantan.kyoto.jp",
		reversed: "pj.otoyk.natnan"
	},
	{
		suffix: "oyamazaki.kyoto.jp",
		reversed: "pj.otoyk.ikazamayo"
	},
	{
		suffix: "sakyo.kyoto.jp",
		reversed: "pj.otoyk.oykas"
	},
	{
		suffix: "seika.kyoto.jp",
		reversed: "pj.otoyk.akies"
	},
	{
		suffix: "tanabe.kyoto.jp",
		reversed: "pj.otoyk.ebanat"
	},
	{
		suffix: "uji.kyoto.jp",
		reversed: "pj.otoyk.iju"
	},
	{
		suffix: "ujitawara.kyoto.jp",
		reversed: "pj.otoyk.arawatiju"
	},
	{
		suffix: "wazuka.kyoto.jp",
		reversed: "pj.otoyk.akuzaw"
	},
	{
		suffix: "yamashina.kyoto.jp",
		reversed: "pj.otoyk.anihsamay"
	},
	{
		suffix: "yawata.kyoto.jp",
		reversed: "pj.otoyk.ataway"
	},
	{
		suffix: "asahi.mie.jp",
		reversed: "pj.eim.ihasa"
	},
	{
		suffix: "inabe.mie.jp",
		reversed: "pj.eim.ebani"
	},
	{
		suffix: "ise.mie.jp",
		reversed: "pj.eim.esi"
	},
	{
		suffix: "kameyama.mie.jp",
		reversed: "pj.eim.amayemak"
	},
	{
		suffix: "kawagoe.mie.jp",
		reversed: "pj.eim.eogawak"
	},
	{
		suffix: "kiho.mie.jp",
		reversed: "pj.eim.ohik"
	},
	{
		suffix: "kisosaki.mie.jp",
		reversed: "pj.eim.ikasosik"
	},
	{
		suffix: "kiwa.mie.jp",
		reversed: "pj.eim.awik"
	},
	{
		suffix: "komono.mie.jp",
		reversed: "pj.eim.onomok"
	},
	{
		suffix: "kumano.mie.jp",
		reversed: "pj.eim.onamuk"
	},
	{
		suffix: "kuwana.mie.jp",
		reversed: "pj.eim.anawuk"
	},
	{
		suffix: "matsusaka.mie.jp",
		reversed: "pj.eim.akasustam"
	},
	{
		suffix: "meiwa.mie.jp",
		reversed: "pj.eim.awiem"
	},
	{
		suffix: "mihama.mie.jp",
		reversed: "pj.eim.amahim"
	},
	{
		suffix: "minamiise.mie.jp",
		reversed: "pj.eim.esiimanim"
	},
	{
		suffix: "misugi.mie.jp",
		reversed: "pj.eim.igusim"
	},
	{
		suffix: "miyama.mie.jp",
		reversed: "pj.eim.amayim"
	},
	{
		suffix: "nabari.mie.jp",
		reversed: "pj.eim.iraban"
	},
	{
		suffix: "shima.mie.jp",
		reversed: "pj.eim.amihs"
	},
	{
		suffix: "suzuka.mie.jp",
		reversed: "pj.eim.akuzus"
	},
	{
		suffix: "tado.mie.jp",
		reversed: "pj.eim.odat"
	},
	{
		suffix: "taiki.mie.jp",
		reversed: "pj.eim.ikiat"
	},
	{
		suffix: "taki.mie.jp",
		reversed: "pj.eim.ikat"
	},
	{
		suffix: "tamaki.mie.jp",
		reversed: "pj.eim.ikamat"
	},
	{
		suffix: "toba.mie.jp",
		reversed: "pj.eim.abot"
	},
	{
		suffix: "tsu.mie.jp",
		reversed: "pj.eim.ust"
	},
	{
		suffix: "udono.mie.jp",
		reversed: "pj.eim.onodu"
	},
	{
		suffix: "ureshino.mie.jp",
		reversed: "pj.eim.onihseru"
	},
	{
		suffix: "watarai.mie.jp",
		reversed: "pj.eim.iarataw"
	},
	{
		suffix: "yokkaichi.mie.jp",
		reversed: "pj.eim.ihciakkoy"
	},
	{
		suffix: "furukawa.miyagi.jp",
		reversed: "pj.igayim.awakuruf"
	},
	{
		suffix: "higashimatsushima.miyagi.jp",
		reversed: "pj.igayim.amihsustamihsagih"
	},
	{
		suffix: "ishinomaki.miyagi.jp",
		reversed: "pj.igayim.ikamonihsi"
	},
	{
		suffix: "iwanuma.miyagi.jp",
		reversed: "pj.igayim.amunawi"
	},
	{
		suffix: "kakuda.miyagi.jp",
		reversed: "pj.igayim.adukak"
	},
	{
		suffix: "kami.miyagi.jp",
		reversed: "pj.igayim.imak"
	},
	{
		suffix: "kawasaki.miyagi.jp",
		reversed: "pj.igayim.ikasawak"
	},
	{
		suffix: "marumori.miyagi.jp",
		reversed: "pj.igayim.iromuram"
	},
	{
		suffix: "matsushima.miyagi.jp",
		reversed: "pj.igayim.amihsustam"
	},
	{
		suffix: "minamisanriku.miyagi.jp",
		reversed: "pj.igayim.ukirnasimanim"
	},
	{
		suffix: "misato.miyagi.jp",
		reversed: "pj.igayim.otasim"
	},
	{
		suffix: "murata.miyagi.jp",
		reversed: "pj.igayim.atarum"
	},
	{
		suffix: "natori.miyagi.jp",
		reversed: "pj.igayim.irotan"
	},
	{
		suffix: "ogawara.miyagi.jp",
		reversed: "pj.igayim.arawago"
	},
	{
		suffix: "ohira.miyagi.jp",
		reversed: "pj.igayim.ariho"
	},
	{
		suffix: "onagawa.miyagi.jp",
		reversed: "pj.igayim.awagano"
	},
	{
		suffix: "osaki.miyagi.jp",
		reversed: "pj.igayim.ikaso"
	},
	{
		suffix: "rifu.miyagi.jp",
		reversed: "pj.igayim.ufir"
	},
	{
		suffix: "semine.miyagi.jp",
		reversed: "pj.igayim.enimes"
	},
	{
		suffix: "shibata.miyagi.jp",
		reversed: "pj.igayim.atabihs"
	},
	{
		suffix: "shichikashuku.miyagi.jp",
		reversed: "pj.igayim.ukuhsakihcihs"
	},
	{
		suffix: "shikama.miyagi.jp",
		reversed: "pj.igayim.amakihs"
	},
	{
		suffix: "shiogama.miyagi.jp",
		reversed: "pj.igayim.amagoihs"
	},
	{
		suffix: "shiroishi.miyagi.jp",
		reversed: "pj.igayim.ihsiorihs"
	},
	{
		suffix: "tagajo.miyagi.jp",
		reversed: "pj.igayim.ojagat"
	},
	{
		suffix: "taiwa.miyagi.jp",
		reversed: "pj.igayim.awiat"
	},
	{
		suffix: "tome.miyagi.jp",
		reversed: "pj.igayim.emot"
	},
	{
		suffix: "tomiya.miyagi.jp",
		reversed: "pj.igayim.ayimot"
	},
	{
		suffix: "wakuya.miyagi.jp",
		reversed: "pj.igayim.ayukaw"
	},
	{
		suffix: "watari.miyagi.jp",
		reversed: "pj.igayim.irataw"
	},
	{
		suffix: "yamamoto.miyagi.jp",
		reversed: "pj.igayim.otomamay"
	},
	{
		suffix: "zao.miyagi.jp",
		reversed: "pj.igayim.oaz"
	},
	{
		suffix: "aya.miyazaki.jp",
		reversed: "pj.ikazayim.aya"
	},
	{
		suffix: "ebino.miyazaki.jp",
		reversed: "pj.ikazayim.onibe"
	},
	{
		suffix: "gokase.miyazaki.jp",
		reversed: "pj.ikazayim.esakog"
	},
	{
		suffix: "hyuga.miyazaki.jp",
		reversed: "pj.ikazayim.aguyh"
	},
	{
		suffix: "kadogawa.miyazaki.jp",
		reversed: "pj.ikazayim.awagodak"
	},
	{
		suffix: "kawaminami.miyazaki.jp",
		reversed: "pj.ikazayim.imanimawak"
	},
	{
		suffix: "kijo.miyazaki.jp",
		reversed: "pj.ikazayim.ojik"
	},
	{
		suffix: "kitagawa.miyazaki.jp",
		reversed: "pj.ikazayim.awagatik"
	},
	{
		suffix: "kitakata.miyazaki.jp",
		reversed: "pj.ikazayim.atakatik"
	},
	{
		suffix: "kitaura.miyazaki.jp",
		reversed: "pj.ikazayim.aruatik"
	},
	{
		suffix: "kobayashi.miyazaki.jp",
		reversed: "pj.ikazayim.ihsayabok"
	},
	{
		suffix: "kunitomi.miyazaki.jp",
		reversed: "pj.ikazayim.imotinuk"
	},
	{
		suffix: "kushima.miyazaki.jp",
		reversed: "pj.ikazayim.amihsuk"
	},
	{
		suffix: "mimata.miyazaki.jp",
		reversed: "pj.ikazayim.atamim"
	},
	{
		suffix: "miyakonojo.miyazaki.jp",
		reversed: "pj.ikazayim.ojonokayim"
	},
	{
		suffix: "miyazaki.miyazaki.jp",
		reversed: "pj.ikazayim.ikazayim"
	},
	{
		suffix: "morotsuka.miyazaki.jp",
		reversed: "pj.ikazayim.akustorom"
	},
	{
		suffix: "nichinan.miyazaki.jp",
		reversed: "pj.ikazayim.nanihcin"
	},
	{
		suffix: "nishimera.miyazaki.jp",
		reversed: "pj.ikazayim.aremihsin"
	},
	{
		suffix: "nobeoka.miyazaki.jp",
		reversed: "pj.ikazayim.akoebon"
	},
	{
		suffix: "saito.miyazaki.jp",
		reversed: "pj.ikazayim.otias"
	},
	{
		suffix: "shiiba.miyazaki.jp",
		reversed: "pj.ikazayim.abiihs"
	},
	{
		suffix: "shintomi.miyazaki.jp",
		reversed: "pj.ikazayim.imotnihs"
	},
	{
		suffix: "takaharu.miyazaki.jp",
		reversed: "pj.ikazayim.urahakat"
	},
	{
		suffix: "takanabe.miyazaki.jp",
		reversed: "pj.ikazayim.ebanakat"
	},
	{
		suffix: "takazaki.miyazaki.jp",
		reversed: "pj.ikazayim.ikazakat"
	},
	{
		suffix: "tsuno.miyazaki.jp",
		reversed: "pj.ikazayim.onust"
	},
	{
		suffix: "achi.nagano.jp",
		reversed: "pj.onagan.ihca"
	},
	{
		suffix: "agematsu.nagano.jp",
		reversed: "pj.onagan.ustamega"
	},
	{
		suffix: "anan.nagano.jp",
		reversed: "pj.onagan.nana"
	},
	{
		suffix: "aoki.nagano.jp",
		reversed: "pj.onagan.ikoa"
	},
	{
		suffix: "asahi.nagano.jp",
		reversed: "pj.onagan.ihasa"
	},
	{
		suffix: "azumino.nagano.jp",
		reversed: "pj.onagan.onimuza"
	},
	{
		suffix: "chikuhoku.nagano.jp",
		reversed: "pj.onagan.ukohukihc"
	},
	{
		suffix: "chikuma.nagano.jp",
		reversed: "pj.onagan.amukihc"
	},
	{
		suffix: "chino.nagano.jp",
		reversed: "pj.onagan.onihc"
	},
	{
		suffix: "fujimi.nagano.jp",
		reversed: "pj.onagan.imijuf"
	},
	{
		suffix: "hakuba.nagano.jp",
		reversed: "pj.onagan.abukah"
	},
	{
		suffix: "hara.nagano.jp",
		reversed: "pj.onagan.arah"
	},
	{
		suffix: "hiraya.nagano.jp",
		reversed: "pj.onagan.ayarih"
	},
	{
		suffix: "iida.nagano.jp",
		reversed: "pj.onagan.adii"
	},
	{
		suffix: "iijima.nagano.jp",
		reversed: "pj.onagan.amijii"
	},
	{
		suffix: "iiyama.nagano.jp",
		reversed: "pj.onagan.amayii"
	},
	{
		suffix: "iizuna.nagano.jp",
		reversed: "pj.onagan.anuzii"
	},
	{
		suffix: "ikeda.nagano.jp",
		reversed: "pj.onagan.adeki"
	},
	{
		suffix: "ikusaka.nagano.jp",
		reversed: "pj.onagan.akasuki"
	},
	{
		suffix: "ina.nagano.jp",
		reversed: "pj.onagan.ani"
	},
	{
		suffix: "karuizawa.nagano.jp",
		reversed: "pj.onagan.awaziurak"
	},
	{
		suffix: "kawakami.nagano.jp",
		reversed: "pj.onagan.imakawak"
	},
	{
		suffix: "kiso.nagano.jp",
		reversed: "pj.onagan.osik"
	},
	{
		suffix: "kisofukushima.nagano.jp",
		reversed: "pj.onagan.amihsukufosik"
	},
	{
		suffix: "kitaaiki.nagano.jp",
		reversed: "pj.onagan.ikiaatik"
	},
	{
		suffix: "komagane.nagano.jp",
		reversed: "pj.onagan.enagamok"
	},
	{
		suffix: "komoro.nagano.jp",
		reversed: "pj.onagan.oromok"
	},
	{
		suffix: "matsukawa.nagano.jp",
		reversed: "pj.onagan.awakustam"
	},
	{
		suffix: "matsumoto.nagano.jp",
		reversed: "pj.onagan.otomustam"
	},
	{
		suffix: "miasa.nagano.jp",
		reversed: "pj.onagan.asaim"
	},
	{
		suffix: "minamiaiki.nagano.jp",
		reversed: "pj.onagan.ikiaimanim"
	},
	{
		suffix: "minamimaki.nagano.jp",
		reversed: "pj.onagan.ikamimanim"
	},
	{
		suffix: "minamiminowa.nagano.jp",
		reversed: "pj.onagan.awonimimanim"
	},
	{
		suffix: "minowa.nagano.jp",
		reversed: "pj.onagan.awonim"
	},
	{
		suffix: "miyada.nagano.jp",
		reversed: "pj.onagan.adayim"
	},
	{
		suffix: "miyota.nagano.jp",
		reversed: "pj.onagan.atoyim"
	},
	{
		suffix: "mochizuki.nagano.jp",
		reversed: "pj.onagan.ikuzihcom"
	},
	{
		suffix: "nagano.nagano.jp",
		reversed: "pj.onagan.onagan"
	},
	{
		suffix: "nagawa.nagano.jp",
		reversed: "pj.onagan.awagan"
	},
	{
		suffix: "nagiso.nagano.jp",
		reversed: "pj.onagan.osigan"
	},
	{
		suffix: "nakagawa.nagano.jp",
		reversed: "pj.onagan.awagakan"
	},
	{
		suffix: "nakano.nagano.jp",
		reversed: "pj.onagan.onakan"
	},
	{
		suffix: "nozawaonsen.nagano.jp",
		reversed: "pj.onagan.nesnoawazon"
	},
	{
		suffix: "obuse.nagano.jp",
		reversed: "pj.onagan.esubo"
	},
	{
		suffix: "ogawa.nagano.jp",
		reversed: "pj.onagan.awago"
	},
	{
		suffix: "okaya.nagano.jp",
		reversed: "pj.onagan.ayako"
	},
	{
		suffix: "omachi.nagano.jp",
		reversed: "pj.onagan.ihcamo"
	},
	{
		suffix: "omi.nagano.jp",
		reversed: "pj.onagan.imo"
	},
	{
		suffix: "ookuwa.nagano.jp",
		reversed: "pj.onagan.awukoo"
	},
	{
		suffix: "ooshika.nagano.jp",
		reversed: "pj.onagan.akihsoo"
	},
	{
		suffix: "otaki.nagano.jp",
		reversed: "pj.onagan.ikato"
	},
	{
		suffix: "otari.nagano.jp",
		reversed: "pj.onagan.irato"
	},
	{
		suffix: "sakae.nagano.jp",
		reversed: "pj.onagan.eakas"
	},
	{
		suffix: "sakaki.nagano.jp",
		reversed: "pj.onagan.ikakas"
	},
	{
		suffix: "saku.nagano.jp",
		reversed: "pj.onagan.ukas"
	},
	{
		suffix: "sakuho.nagano.jp",
		reversed: "pj.onagan.ohukas"
	},
	{
		suffix: "shimosuwa.nagano.jp",
		reversed: "pj.onagan.awusomihs"
	},
	{
		suffix: "shinanomachi.nagano.jp",
		reversed: "pj.onagan.ihcamonanihs"
	},
	{
		suffix: "shiojiri.nagano.jp",
		reversed: "pj.onagan.irijoihs"
	},
	{
		suffix: "suwa.nagano.jp",
		reversed: "pj.onagan.awus"
	},
	{
		suffix: "suzaka.nagano.jp",
		reversed: "pj.onagan.akazus"
	},
	{
		suffix: "takagi.nagano.jp",
		reversed: "pj.onagan.igakat"
	},
	{
		suffix: "takamori.nagano.jp",
		reversed: "pj.onagan.iromakat"
	},
	{
		suffix: "takayama.nagano.jp",
		reversed: "pj.onagan.amayakat"
	},
	{
		suffix: "tateshina.nagano.jp",
		reversed: "pj.onagan.anihsetat"
	},
	{
		suffix: "tatsuno.nagano.jp",
		reversed: "pj.onagan.onustat"
	},
	{
		suffix: "togakushi.nagano.jp",
		reversed: "pj.onagan.ihsukagot"
	},
	{
		suffix: "togura.nagano.jp",
		reversed: "pj.onagan.arugot"
	},
	{
		suffix: "tomi.nagano.jp",
		reversed: "pj.onagan.imot"
	},
	{
		suffix: "ueda.nagano.jp",
		reversed: "pj.onagan.adeu"
	},
	{
		suffix: "wada.nagano.jp",
		reversed: "pj.onagan.adaw"
	},
	{
		suffix: "yamagata.nagano.jp",
		reversed: "pj.onagan.atagamay"
	},
	{
		suffix: "yamanouchi.nagano.jp",
		reversed: "pj.onagan.ihcuonamay"
	},
	{
		suffix: "yasaka.nagano.jp",
		reversed: "pj.onagan.akasay"
	},
	{
		suffix: "yasuoka.nagano.jp",
		reversed: "pj.onagan.akousay"
	},
	{
		suffix: "chijiwa.nagasaki.jp",
		reversed: "pj.ikasagan.awijihc"
	},
	{
		suffix: "futsu.nagasaki.jp",
		reversed: "pj.ikasagan.ustuf"
	},
	{
		suffix: "goto.nagasaki.jp",
		reversed: "pj.ikasagan.otog"
	},
	{
		suffix: "hasami.nagasaki.jp",
		reversed: "pj.ikasagan.imasah"
	},
	{
		suffix: "hirado.nagasaki.jp",
		reversed: "pj.ikasagan.odarih"
	},
	{
		suffix: "iki.nagasaki.jp",
		reversed: "pj.ikasagan.iki"
	},
	{
		suffix: "isahaya.nagasaki.jp",
		reversed: "pj.ikasagan.ayahasi"
	},
	{
		suffix: "kawatana.nagasaki.jp",
		reversed: "pj.ikasagan.anatawak"
	},
	{
		suffix: "kuchinotsu.nagasaki.jp",
		reversed: "pj.ikasagan.ustonihcuk"
	},
	{
		suffix: "matsuura.nagasaki.jp",
		reversed: "pj.ikasagan.aruustam"
	},
	{
		suffix: "nagasaki.nagasaki.jp",
		reversed: "pj.ikasagan.ikasagan"
	},
	{
		suffix: "obama.nagasaki.jp",
		reversed: "pj.ikasagan.amabo"
	},
	{
		suffix: "omura.nagasaki.jp",
		reversed: "pj.ikasagan.arumo"
	},
	{
		suffix: "oseto.nagasaki.jp",
		reversed: "pj.ikasagan.oteso"
	},
	{
		suffix: "saikai.nagasaki.jp",
		reversed: "pj.ikasagan.iakias"
	},
	{
		suffix: "sasebo.nagasaki.jp",
		reversed: "pj.ikasagan.obesas"
	},
	{
		suffix: "seihi.nagasaki.jp",
		reversed: "pj.ikasagan.ihies"
	},
	{
		suffix: "shimabara.nagasaki.jp",
		reversed: "pj.ikasagan.arabamihs"
	},
	{
		suffix: "shinkamigoto.nagasaki.jp",
		reversed: "pj.ikasagan.otogimaknihs"
	},
	{
		suffix: "togitsu.nagasaki.jp",
		reversed: "pj.ikasagan.ustigot"
	},
	{
		suffix: "tsushima.nagasaki.jp",
		reversed: "pj.ikasagan.amihsust"
	},
	{
		suffix: "unzen.nagasaki.jp",
		reversed: "pj.ikasagan.neznu"
	},
	{
		suffix: "ando.nara.jp",
		reversed: "pj.aran.odna"
	},
	{
		suffix: "gose.nara.jp",
		reversed: "pj.aran.esog"
	},
	{
		suffix: "heguri.nara.jp",
		reversed: "pj.aran.irugeh"
	},
	{
		suffix: "higashiyoshino.nara.jp",
		reversed: "pj.aran.onihsoyihsagih"
	},
	{
		suffix: "ikaruga.nara.jp",
		reversed: "pj.aran.aguraki"
	},
	{
		suffix: "ikoma.nara.jp",
		reversed: "pj.aran.amoki"
	},
	{
		suffix: "kamikitayama.nara.jp",
		reversed: "pj.aran.amayatikimak"
	},
	{
		suffix: "kanmaki.nara.jp",
		reversed: "pj.aran.ikamnak"
	},
	{
		suffix: "kashiba.nara.jp",
		reversed: "pj.aran.abihsak"
	},
	{
		suffix: "kashihara.nara.jp",
		reversed: "pj.aran.arahihsak"
	},
	{
		suffix: "katsuragi.nara.jp",
		reversed: "pj.aran.igarustak"
	},
	{
		suffix: "kawai.nara.jp",
		reversed: "pj.aran.iawak"
	},
	{
		suffix: "kawakami.nara.jp",
		reversed: "pj.aran.imakawak"
	},
	{
		suffix: "kawanishi.nara.jp",
		reversed: "pj.aran.ihsinawak"
	},
	{
		suffix: "koryo.nara.jp",
		reversed: "pj.aran.oyrok"
	},
	{
		suffix: "kurotaki.nara.jp",
		reversed: "pj.aran.ikatoruk"
	},
	{
		suffix: "mitsue.nara.jp",
		reversed: "pj.aran.eustim"
	},
	{
		suffix: "miyake.nara.jp",
		reversed: "pj.aran.ekayim"
	},
	{
		suffix: "nara.nara.jp",
		reversed: "pj.aran.aran"
	},
	{
		suffix: "nosegawa.nara.jp",
		reversed: "pj.aran.awageson"
	},
	{
		suffix: "oji.nara.jp",
		reversed: "pj.aran.ijo"
	},
	{
		suffix: "ouda.nara.jp",
		reversed: "pj.aran.aduo"
	},
	{
		suffix: "oyodo.nara.jp",
		reversed: "pj.aran.odoyo"
	},
	{
		suffix: "sakurai.nara.jp",
		reversed: "pj.aran.iarukas"
	},
	{
		suffix: "sango.nara.jp",
		reversed: "pj.aran.ognas"
	},
	{
		suffix: "shimoichi.nara.jp",
		reversed: "pj.aran.ihciomihs"
	},
	{
		suffix: "shimokitayama.nara.jp",
		reversed: "pj.aran.amayatikomihs"
	},
	{
		suffix: "shinjo.nara.jp",
		reversed: "pj.aran.ojnihs"
	},
	{
		suffix: "soni.nara.jp",
		reversed: "pj.aran.inos"
	},
	{
		suffix: "takatori.nara.jp",
		reversed: "pj.aran.irotakat"
	},
	{
		suffix: "tawaramoto.nara.jp",
		reversed: "pj.aran.otomarawat"
	},
	{
		suffix: "tenkawa.nara.jp",
		reversed: "pj.aran.awaknet"
	},
	{
		suffix: "tenri.nara.jp",
		reversed: "pj.aran.irnet"
	},
	{
		suffix: "uda.nara.jp",
		reversed: "pj.aran.adu"
	},
	{
		suffix: "yamatokoriyama.nara.jp",
		reversed: "pj.aran.amayirokotamay"
	},
	{
		suffix: "yamatotakada.nara.jp",
		reversed: "pj.aran.adakatotamay"
	},
	{
		suffix: "yamazoe.nara.jp",
		reversed: "pj.aran.eozamay"
	},
	{
		suffix: "yoshino.nara.jp",
		reversed: "pj.aran.onihsoy"
	},
	{
		suffix: "aga.niigata.jp",
		reversed: "pj.atagiin.aga"
	},
	{
		suffix: "agano.niigata.jp",
		reversed: "pj.atagiin.onaga"
	},
	{
		suffix: "gosen.niigata.jp",
		reversed: "pj.atagiin.nesog"
	},
	{
		suffix: "itoigawa.niigata.jp",
		reversed: "pj.atagiin.awagioti"
	},
	{
		suffix: "izumozaki.niigata.jp",
		reversed: "pj.atagiin.ikazomuzi"
	},
	{
		suffix: "joetsu.niigata.jp",
		reversed: "pj.atagiin.usteoj"
	},
	{
		suffix: "kamo.niigata.jp",
		reversed: "pj.atagiin.omak"
	},
	{
		suffix: "kariwa.niigata.jp",
		reversed: "pj.atagiin.awirak"
	},
	{
		suffix: "kashiwazaki.niigata.jp",
		reversed: "pj.atagiin.ikazawihsak"
	},
	{
		suffix: "minamiuonuma.niigata.jp",
		reversed: "pj.atagiin.amunouimanim"
	},
	{
		suffix: "mitsuke.niigata.jp",
		reversed: "pj.atagiin.ekustim"
	},
	{
		suffix: "muika.niigata.jp",
		reversed: "pj.atagiin.akium"
	},
	{
		suffix: "murakami.niigata.jp",
		reversed: "pj.atagiin.imakarum"
	},
	{
		suffix: "myoko.niigata.jp",
		reversed: "pj.atagiin.okoym"
	},
	{
		suffix: "nagaoka.niigata.jp",
		reversed: "pj.atagiin.akoagan"
	},
	{
		suffix: "niigata.niigata.jp",
		reversed: "pj.atagiin.atagiin"
	},
	{
		suffix: "ojiya.niigata.jp",
		reversed: "pj.atagiin.ayijo"
	},
	{
		suffix: "omi.niigata.jp",
		reversed: "pj.atagiin.imo"
	},
	{
		suffix: "sado.niigata.jp",
		reversed: "pj.atagiin.odas"
	},
	{
		suffix: "sanjo.niigata.jp",
		reversed: "pj.atagiin.ojnas"
	},
	{
		suffix: "seiro.niigata.jp",
		reversed: "pj.atagiin.ories"
	},
	{
		suffix: "seirou.niigata.jp",
		reversed: "pj.atagiin.uories"
	},
	{
		suffix: "sekikawa.niigata.jp",
		reversed: "pj.atagiin.awakikes"
	},
	{
		suffix: "shibata.niigata.jp",
		reversed: "pj.atagiin.atabihs"
	},
	{
		suffix: "tagami.niigata.jp",
		reversed: "pj.atagiin.imagat"
	},
	{
		suffix: "tainai.niigata.jp",
		reversed: "pj.atagiin.ianiat"
	},
	{
		suffix: "tochio.niigata.jp",
		reversed: "pj.atagiin.oihcot"
	},
	{
		suffix: "tokamachi.niigata.jp",
		reversed: "pj.atagiin.ihcamakot"
	},
	{
		suffix: "tsubame.niigata.jp",
		reversed: "pj.atagiin.emabust"
	},
	{
		suffix: "tsunan.niigata.jp",
		reversed: "pj.atagiin.nanust"
	},
	{
		suffix: "uonuma.niigata.jp",
		reversed: "pj.atagiin.amunou"
	},
	{
		suffix: "yahiko.niigata.jp",
		reversed: "pj.atagiin.okihay"
	},
	{
		suffix: "yoita.niigata.jp",
		reversed: "pj.atagiin.atioy"
	},
	{
		suffix: "yuzawa.niigata.jp",
		reversed: "pj.atagiin.awazuy"
	},
	{
		suffix: "beppu.oita.jp",
		reversed: "pj.atio.uppeb"
	},
	{
		suffix: "bungoono.oita.jp",
		reversed: "pj.atio.onoognub"
	},
	{
		suffix: "bungotakada.oita.jp",
		reversed: "pj.atio.adakatognub"
	},
	{
		suffix: "hasama.oita.jp",
		reversed: "pj.atio.amasah"
	},
	{
		suffix: "hiji.oita.jp",
		reversed: "pj.atio.ijih"
	},
	{
		suffix: "himeshima.oita.jp",
		reversed: "pj.atio.amihsemih"
	},
	{
		suffix: "hita.oita.jp",
		reversed: "pj.atio.atih"
	},
	{
		suffix: "kamitsue.oita.jp",
		reversed: "pj.atio.eustimak"
	},
	{
		suffix: "kokonoe.oita.jp",
		reversed: "pj.atio.eonokok"
	},
	{
		suffix: "kuju.oita.jp",
		reversed: "pj.atio.ujuk"
	},
	{
		suffix: "kunisaki.oita.jp",
		reversed: "pj.atio.ikasinuk"
	},
	{
		suffix: "kusu.oita.jp",
		reversed: "pj.atio.usuk"
	},
	{
		suffix: "oita.oita.jp",
		reversed: "pj.atio.atio"
	},
	{
		suffix: "saiki.oita.jp",
		reversed: "pj.atio.ikias"
	},
	{
		suffix: "taketa.oita.jp",
		reversed: "pj.atio.atekat"
	},
	{
		suffix: "tsukumi.oita.jp",
		reversed: "pj.atio.imukust"
	},
	{
		suffix: "usa.oita.jp",
		reversed: "pj.atio.asu"
	},
	{
		suffix: "usuki.oita.jp",
		reversed: "pj.atio.ikusu"
	},
	{
		suffix: "yufu.oita.jp",
		reversed: "pj.atio.ufuy"
	},
	{
		suffix: "akaiwa.okayama.jp",
		reversed: "pj.amayako.awiaka"
	},
	{
		suffix: "asakuchi.okayama.jp",
		reversed: "pj.amayako.ihcukasa"
	},
	{
		suffix: "bizen.okayama.jp",
		reversed: "pj.amayako.nezib"
	},
	{
		suffix: "hayashima.okayama.jp",
		reversed: "pj.amayako.amihsayah"
	},
	{
		suffix: "ibara.okayama.jp",
		reversed: "pj.amayako.arabi"
	},
	{
		suffix: "kagamino.okayama.jp",
		reversed: "pj.amayako.onimagak"
	},
	{
		suffix: "kasaoka.okayama.jp",
		reversed: "pj.amayako.akoasak"
	},
	{
		suffix: "kibichuo.okayama.jp",
		reversed: "pj.amayako.ouhcibik"
	},
	{
		suffix: "kumenan.okayama.jp",
		reversed: "pj.amayako.nanemuk"
	},
	{
		suffix: "kurashiki.okayama.jp",
		reversed: "pj.amayako.ikihsaruk"
	},
	{
		suffix: "maniwa.okayama.jp",
		reversed: "pj.amayako.awinam"
	},
	{
		suffix: "misaki.okayama.jp",
		reversed: "pj.amayako.ikasim"
	},
	{
		suffix: "nagi.okayama.jp",
		reversed: "pj.amayako.igan"
	},
	{
		suffix: "niimi.okayama.jp",
		reversed: "pj.amayako.imiin"
	},
	{
		suffix: "nishiawakura.okayama.jp",
		reversed: "pj.amayako.arukawaihsin"
	},
	{
		suffix: "okayama.okayama.jp",
		reversed: "pj.amayako.amayako"
	},
	{
		suffix: "satosho.okayama.jp",
		reversed: "pj.amayako.ohsotas"
	},
	{
		suffix: "setouchi.okayama.jp",
		reversed: "pj.amayako.ihcuotes"
	},
	{
		suffix: "shinjo.okayama.jp",
		reversed: "pj.amayako.ojnihs"
	},
	{
		suffix: "shoo.okayama.jp",
		reversed: "pj.amayako.oohs"
	},
	{
		suffix: "soja.okayama.jp",
		reversed: "pj.amayako.ajos"
	},
	{
		suffix: "takahashi.okayama.jp",
		reversed: "pj.amayako.ihsahakat"
	},
	{
		suffix: "tamano.okayama.jp",
		reversed: "pj.amayako.onamat"
	},
	{
		suffix: "tsuyama.okayama.jp",
		reversed: "pj.amayako.amayust"
	},
	{
		suffix: "wake.okayama.jp",
		reversed: "pj.amayako.ekaw"
	},
	{
		suffix: "yakage.okayama.jp",
		reversed: "pj.amayako.egakay"
	},
	{
		suffix: "aguni.okinawa.jp",
		reversed: "pj.awaniko.inuga"
	},
	{
		suffix: "ginowan.okinawa.jp",
		reversed: "pj.awaniko.nawonig"
	},
	{
		suffix: "ginoza.okinawa.jp",
		reversed: "pj.awaniko.azonig"
	},
	{
		suffix: "gushikami.okinawa.jp",
		reversed: "pj.awaniko.imakihsug"
	},
	{
		suffix: "haebaru.okinawa.jp",
		reversed: "pj.awaniko.urabeah"
	},
	{
		suffix: "higashi.okinawa.jp",
		reversed: "pj.awaniko.ihsagih"
	},
	{
		suffix: "hirara.okinawa.jp",
		reversed: "pj.awaniko.ararih"
	},
	{
		suffix: "iheya.okinawa.jp",
		reversed: "pj.awaniko.ayehi"
	},
	{
		suffix: "ishigaki.okinawa.jp",
		reversed: "pj.awaniko.ikagihsi"
	},
	{
		suffix: "ishikawa.okinawa.jp",
		reversed: "pj.awaniko.awakihsi"
	},
	{
		suffix: "itoman.okinawa.jp",
		reversed: "pj.awaniko.namoti"
	},
	{
		suffix: "izena.okinawa.jp",
		reversed: "pj.awaniko.anezi"
	},
	{
		suffix: "kadena.okinawa.jp",
		reversed: "pj.awaniko.anedak"
	},
	{
		suffix: "kin.okinawa.jp",
		reversed: "pj.awaniko.nik"
	},
	{
		suffix: "kitadaito.okinawa.jp",
		reversed: "pj.awaniko.otiadatik"
	},
	{
		suffix: "kitanakagusuku.okinawa.jp",
		reversed: "pj.awaniko.ukusugakanatik"
	},
	{
		suffix: "kumejima.okinawa.jp",
		reversed: "pj.awaniko.amijemuk"
	},
	{
		suffix: "kunigami.okinawa.jp",
		reversed: "pj.awaniko.imaginuk"
	},
	{
		suffix: "minamidaito.okinawa.jp",
		reversed: "pj.awaniko.otiadimanim"
	},
	{
		suffix: "motobu.okinawa.jp",
		reversed: "pj.awaniko.ubotom"
	},
	{
		suffix: "nago.okinawa.jp",
		reversed: "pj.awaniko.ogan"
	},
	{
		suffix: "naha.okinawa.jp",
		reversed: "pj.awaniko.ahan"
	},
	{
		suffix: "nakagusuku.okinawa.jp",
		reversed: "pj.awaniko.ukusugakan"
	},
	{
		suffix: "nakijin.okinawa.jp",
		reversed: "pj.awaniko.nijikan"
	},
	{
		suffix: "nanjo.okinawa.jp",
		reversed: "pj.awaniko.ojnan"
	},
	{
		suffix: "nishihara.okinawa.jp",
		reversed: "pj.awaniko.arahihsin"
	},
	{
		suffix: "ogimi.okinawa.jp",
		reversed: "pj.awaniko.imigo"
	},
	{
		suffix: "okinawa.okinawa.jp",
		reversed: "pj.awaniko.awaniko"
	},
	{
		suffix: "onna.okinawa.jp",
		reversed: "pj.awaniko.anno"
	},
	{
		suffix: "shimoji.okinawa.jp",
		reversed: "pj.awaniko.ijomihs"
	},
	{
		suffix: "taketomi.okinawa.jp",
		reversed: "pj.awaniko.imotekat"
	},
	{
		suffix: "tarama.okinawa.jp",
		reversed: "pj.awaniko.amarat"
	},
	{
		suffix: "tokashiki.okinawa.jp",
		reversed: "pj.awaniko.ikihsakot"
	},
	{
		suffix: "tomigusuku.okinawa.jp",
		reversed: "pj.awaniko.ukusugimot"
	},
	{
		suffix: "tonaki.okinawa.jp",
		reversed: "pj.awaniko.ikanot"
	},
	{
		suffix: "urasoe.okinawa.jp",
		reversed: "pj.awaniko.eosaru"
	},
	{
		suffix: "uruma.okinawa.jp",
		reversed: "pj.awaniko.amuru"
	},
	{
		suffix: "yaese.okinawa.jp",
		reversed: "pj.awaniko.eseay"
	},
	{
		suffix: "yomitan.okinawa.jp",
		reversed: "pj.awaniko.natimoy"
	},
	{
		suffix: "yonabaru.okinawa.jp",
		reversed: "pj.awaniko.urabanoy"
	},
	{
		suffix: "yonaguni.okinawa.jp",
		reversed: "pj.awaniko.inuganoy"
	},
	{
		suffix: "zamami.okinawa.jp",
		reversed: "pj.awaniko.imamaz"
	},
	{
		suffix: "abeno.osaka.jp",
		reversed: "pj.akaso.oneba"
	},
	{
		suffix: "chihayaakasaka.osaka.jp",
		reversed: "pj.akaso.akasakaayahihc"
	},
	{
		suffix: "chuo.osaka.jp",
		reversed: "pj.akaso.ouhc"
	},
	{
		suffix: "daito.osaka.jp",
		reversed: "pj.akaso.otiad"
	},
	{
		suffix: "fujiidera.osaka.jp",
		reversed: "pj.akaso.arediijuf"
	},
	{
		suffix: "habikino.osaka.jp",
		reversed: "pj.akaso.onikibah"
	},
	{
		suffix: "hannan.osaka.jp",
		reversed: "pj.akaso.nannah"
	},
	{
		suffix: "higashiosaka.osaka.jp",
		reversed: "pj.akaso.akasoihsagih"
	},
	{
		suffix: "higashisumiyoshi.osaka.jp",
		reversed: "pj.akaso.ihsoyimusihsagih"
	},
	{
		suffix: "higashiyodogawa.osaka.jp",
		reversed: "pj.akaso.awagodoyihsagih"
	},
	{
		suffix: "hirakata.osaka.jp",
		reversed: "pj.akaso.atakarih"
	},
	{
		suffix: "ibaraki.osaka.jp",
		reversed: "pj.akaso.ikarabi"
	},
	{
		suffix: "ikeda.osaka.jp",
		reversed: "pj.akaso.adeki"
	},
	{
		suffix: "izumi.osaka.jp",
		reversed: "pj.akaso.imuzi"
	},
	{
		suffix: "izumiotsu.osaka.jp",
		reversed: "pj.akaso.ustoimuzi"
	},
	{
		suffix: "izumisano.osaka.jp",
		reversed: "pj.akaso.onasimuzi"
	},
	{
		suffix: "kadoma.osaka.jp",
		reversed: "pj.akaso.amodak"
	},
	{
		suffix: "kaizuka.osaka.jp",
		reversed: "pj.akaso.akuziak"
	},
	{
		suffix: "kanan.osaka.jp",
		reversed: "pj.akaso.nanak"
	},
	{
		suffix: "kashiwara.osaka.jp",
		reversed: "pj.akaso.arawihsak"
	},
	{
		suffix: "katano.osaka.jp",
		reversed: "pj.akaso.onatak"
	},
	{
		suffix: "kawachinagano.osaka.jp",
		reversed: "pj.akaso.onaganihcawak"
	},
	{
		suffix: "kishiwada.osaka.jp",
		reversed: "pj.akaso.adawihsik"
	},
	{
		suffix: "kita.osaka.jp",
		reversed: "pj.akaso.atik"
	},
	{
		suffix: "kumatori.osaka.jp",
		reversed: "pj.akaso.irotamuk"
	},
	{
		suffix: "matsubara.osaka.jp",
		reversed: "pj.akaso.arabustam"
	},
	{
		suffix: "minato.osaka.jp",
		reversed: "pj.akaso.otanim"
	},
	{
		suffix: "minoh.osaka.jp",
		reversed: "pj.akaso.honim"
	},
	{
		suffix: "misaki.osaka.jp",
		reversed: "pj.akaso.ikasim"
	},
	{
		suffix: "moriguchi.osaka.jp",
		reversed: "pj.akaso.ihcugirom"
	},
	{
		suffix: "neyagawa.osaka.jp",
		reversed: "pj.akaso.awagayen"
	},
	{
		suffix: "nishi.osaka.jp",
		reversed: "pj.akaso.ihsin"
	},
	{
		suffix: "nose.osaka.jp",
		reversed: "pj.akaso.eson"
	},
	{
		suffix: "osakasayama.osaka.jp",
		reversed: "pj.akaso.amayasakaso"
	},
	{
		suffix: "sakai.osaka.jp",
		reversed: "pj.akaso.iakas"
	},
	{
		suffix: "sayama.osaka.jp",
		reversed: "pj.akaso.amayas"
	},
	{
		suffix: "sennan.osaka.jp",
		reversed: "pj.akaso.nannes"
	},
	{
		suffix: "settsu.osaka.jp",
		reversed: "pj.akaso.usttes"
	},
	{
		suffix: "shijonawate.osaka.jp",
		reversed: "pj.akaso.etawanojihs"
	},
	{
		suffix: "shimamoto.osaka.jp",
		reversed: "pj.akaso.otomamihs"
	},
	{
		suffix: "suita.osaka.jp",
		reversed: "pj.akaso.atius"
	},
	{
		suffix: "tadaoka.osaka.jp",
		reversed: "pj.akaso.akoadat"
	},
	{
		suffix: "taishi.osaka.jp",
		reversed: "pj.akaso.ihsiat"
	},
	{
		suffix: "tajiri.osaka.jp",
		reversed: "pj.akaso.irijat"
	},
	{
		suffix: "takaishi.osaka.jp",
		reversed: "pj.akaso.ihsiakat"
	},
	{
		suffix: "takatsuki.osaka.jp",
		reversed: "pj.akaso.ikustakat"
	},
	{
		suffix: "tondabayashi.osaka.jp",
		reversed: "pj.akaso.ihsayabadnot"
	},
	{
		suffix: "toyonaka.osaka.jp",
		reversed: "pj.akaso.akanoyot"
	},
	{
		suffix: "toyono.osaka.jp",
		reversed: "pj.akaso.onoyot"
	},
	{
		suffix: "yao.osaka.jp",
		reversed: "pj.akaso.oay"
	},
	{
		suffix: "ariake.saga.jp",
		reversed: "pj.agas.ekaira"
	},
	{
		suffix: "arita.saga.jp",
		reversed: "pj.agas.atira"
	},
	{
		suffix: "fukudomi.saga.jp",
		reversed: "pj.agas.imodukuf"
	},
	{
		suffix: "genkai.saga.jp",
		reversed: "pj.agas.iakneg"
	},
	{
		suffix: "hamatama.saga.jp",
		reversed: "pj.agas.amatamah"
	},
	{
		suffix: "hizen.saga.jp",
		reversed: "pj.agas.nezih"
	},
	{
		suffix: "imari.saga.jp",
		reversed: "pj.agas.irami"
	},
	{
		suffix: "kamimine.saga.jp",
		reversed: "pj.agas.enimimak"
	},
	{
		suffix: "kanzaki.saga.jp",
		reversed: "pj.agas.ikaznak"
	},
	{
		suffix: "karatsu.saga.jp",
		reversed: "pj.agas.ustarak"
	},
	{
		suffix: "kashima.saga.jp",
		reversed: "pj.agas.amihsak"
	},
	{
		suffix: "kitagata.saga.jp",
		reversed: "pj.agas.atagatik"
	},
	{
		suffix: "kitahata.saga.jp",
		reversed: "pj.agas.atahatik"
	},
	{
		suffix: "kiyama.saga.jp",
		reversed: "pj.agas.amayik"
	},
	{
		suffix: "kouhoku.saga.jp",
		reversed: "pj.agas.ukohuok"
	},
	{
		suffix: "kyuragi.saga.jp",
		reversed: "pj.agas.igaruyk"
	},
	{
		suffix: "nishiarita.saga.jp",
		reversed: "pj.agas.atiraihsin"
	},
	{
		suffix: "ogi.saga.jp",
		reversed: "pj.agas.igo"
	},
	{
		suffix: "omachi.saga.jp",
		reversed: "pj.agas.ihcamo"
	},
	{
		suffix: "ouchi.saga.jp",
		reversed: "pj.agas.ihcuo"
	},
	{
		suffix: "saga.saga.jp",
		reversed: "pj.agas.agas"
	},
	{
		suffix: "shiroishi.saga.jp",
		reversed: "pj.agas.ihsiorihs"
	},
	{
		suffix: "taku.saga.jp",
		reversed: "pj.agas.ukat"
	},
	{
		suffix: "tara.saga.jp",
		reversed: "pj.agas.arat"
	},
	{
		suffix: "tosu.saga.jp",
		reversed: "pj.agas.usot"
	},
	{
		suffix: "yoshinogari.saga.jp",
		reversed: "pj.agas.iragonihsoy"
	},
	{
		suffix: "arakawa.saitama.jp",
		reversed: "pj.amatias.awakara"
	},
	{
		suffix: "asaka.saitama.jp",
		reversed: "pj.amatias.akasa"
	},
	{
		suffix: "chichibu.saitama.jp",
		reversed: "pj.amatias.ubihcihc"
	},
	{
		suffix: "fujimi.saitama.jp",
		reversed: "pj.amatias.imijuf"
	},
	{
		suffix: "fujimino.saitama.jp",
		reversed: "pj.amatias.onimijuf"
	},
	{
		suffix: "fukaya.saitama.jp",
		reversed: "pj.amatias.ayakuf"
	},
	{
		suffix: "hanno.saitama.jp",
		reversed: "pj.amatias.onnah"
	},
	{
		suffix: "hanyu.saitama.jp",
		reversed: "pj.amatias.uynah"
	},
	{
		suffix: "hasuda.saitama.jp",
		reversed: "pj.amatias.adusah"
	},
	{
		suffix: "hatogaya.saitama.jp",
		reversed: "pj.amatias.ayagotah"
	},
	{
		suffix: "hatoyama.saitama.jp",
		reversed: "pj.amatias.amayotah"
	},
	{
		suffix: "hidaka.saitama.jp",
		reversed: "pj.amatias.akadih"
	},
	{
		suffix: "higashichichibu.saitama.jp",
		reversed: "pj.amatias.ubihcihcihsagih"
	},
	{
		suffix: "higashimatsuyama.saitama.jp",
		reversed: "pj.amatias.amayustamihsagih"
	},
	{
		suffix: "honjo.saitama.jp",
		reversed: "pj.amatias.ojnoh"
	},
	{
		suffix: "ina.saitama.jp",
		reversed: "pj.amatias.ani"
	},
	{
		suffix: "iruma.saitama.jp",
		reversed: "pj.amatias.amuri"
	},
	{
		suffix: "iwatsuki.saitama.jp",
		reversed: "pj.amatias.ikustawi"
	},
	{
		suffix: "kamiizumi.saitama.jp",
		reversed: "pj.amatias.imuziimak"
	},
	{
		suffix: "kamikawa.saitama.jp",
		reversed: "pj.amatias.awakimak"
	},
	{
		suffix: "kamisato.saitama.jp",
		reversed: "pj.amatias.otasimak"
	},
	{
		suffix: "kasukabe.saitama.jp",
		reversed: "pj.amatias.ebakusak"
	},
	{
		suffix: "kawagoe.saitama.jp",
		reversed: "pj.amatias.eogawak"
	},
	{
		suffix: "kawaguchi.saitama.jp",
		reversed: "pj.amatias.ihcugawak"
	},
	{
		suffix: "kawajima.saitama.jp",
		reversed: "pj.amatias.amijawak"
	},
	{
		suffix: "kazo.saitama.jp",
		reversed: "pj.amatias.ozak"
	},
	{
		suffix: "kitamoto.saitama.jp",
		reversed: "pj.amatias.otomatik"
	},
	{
		suffix: "koshigaya.saitama.jp",
		reversed: "pj.amatias.ayagihsok"
	},
	{
		suffix: "kounosu.saitama.jp",
		reversed: "pj.amatias.usonuok"
	},
	{
		suffix: "kuki.saitama.jp",
		reversed: "pj.amatias.ikuk"
	},
	{
		suffix: "kumagaya.saitama.jp",
		reversed: "pj.amatias.ayagamuk"
	},
	{
		suffix: "matsubushi.saitama.jp",
		reversed: "pj.amatias.ihsubustam"
	},
	{
		suffix: "minano.saitama.jp",
		reversed: "pj.amatias.onanim"
	},
	{
		suffix: "misato.saitama.jp",
		reversed: "pj.amatias.otasim"
	},
	{
		suffix: "miyashiro.saitama.jp",
		reversed: "pj.amatias.orihsayim"
	},
	{
		suffix: "miyoshi.saitama.jp",
		reversed: "pj.amatias.ihsoyim"
	},
	{
		suffix: "moroyama.saitama.jp",
		reversed: "pj.amatias.amayorom"
	},
	{
		suffix: "nagatoro.saitama.jp",
		reversed: "pj.amatias.orotagan"
	},
	{
		suffix: "namegawa.saitama.jp",
		reversed: "pj.amatias.awageman"
	},
	{
		suffix: "niiza.saitama.jp",
		reversed: "pj.amatias.aziin"
	},
	{
		suffix: "ogano.saitama.jp",
		reversed: "pj.amatias.onago"
	},
	{
		suffix: "ogawa.saitama.jp",
		reversed: "pj.amatias.awago"
	},
	{
		suffix: "ogose.saitama.jp",
		reversed: "pj.amatias.esogo"
	},
	{
		suffix: "okegawa.saitama.jp",
		reversed: "pj.amatias.awageko"
	},
	{
		suffix: "omiya.saitama.jp",
		reversed: "pj.amatias.ayimo"
	},
	{
		suffix: "otaki.saitama.jp",
		reversed: "pj.amatias.ikato"
	},
	{
		suffix: "ranzan.saitama.jp",
		reversed: "pj.amatias.naznar"
	},
	{
		suffix: "ryokami.saitama.jp",
		reversed: "pj.amatias.imakoyr"
	},
	{
		suffix: "saitama.saitama.jp",
		reversed: "pj.amatias.amatias"
	},
	{
		suffix: "sakado.saitama.jp",
		reversed: "pj.amatias.odakas"
	},
	{
		suffix: "satte.saitama.jp",
		reversed: "pj.amatias.ettas"
	},
	{
		suffix: "sayama.saitama.jp",
		reversed: "pj.amatias.amayas"
	},
	{
		suffix: "shiki.saitama.jp",
		reversed: "pj.amatias.ikihs"
	},
	{
		suffix: "shiraoka.saitama.jp",
		reversed: "pj.amatias.akoarihs"
	},
	{
		suffix: "soka.saitama.jp",
		reversed: "pj.amatias.akos"
	},
	{
		suffix: "sugito.saitama.jp",
		reversed: "pj.amatias.otigus"
	},
	{
		suffix: "toda.saitama.jp",
		reversed: "pj.amatias.adot"
	},
	{
		suffix: "tokigawa.saitama.jp",
		reversed: "pj.amatias.awagikot"
	},
	{
		suffix: "tokorozawa.saitama.jp",
		reversed: "pj.amatias.awazorokot"
	},
	{
		suffix: "tsurugashima.saitama.jp",
		reversed: "pj.amatias.amihsagurust"
	},
	{
		suffix: "urawa.saitama.jp",
		reversed: "pj.amatias.awaru"
	},
	{
		suffix: "warabi.saitama.jp",
		reversed: "pj.amatias.ibaraw"
	},
	{
		suffix: "yashio.saitama.jp",
		reversed: "pj.amatias.oihsay"
	},
	{
		suffix: "yokoze.saitama.jp",
		reversed: "pj.amatias.ezokoy"
	},
	{
		suffix: "yono.saitama.jp",
		reversed: "pj.amatias.onoy"
	},
	{
		suffix: "yorii.saitama.jp",
		reversed: "pj.amatias.iiroy"
	},
	{
		suffix: "yoshida.saitama.jp",
		reversed: "pj.amatias.adihsoy"
	},
	{
		suffix: "yoshikawa.saitama.jp",
		reversed: "pj.amatias.awakihsoy"
	},
	{
		suffix: "yoshimi.saitama.jp",
		reversed: "pj.amatias.imihsoy"
	},
	{
		suffix: "aisho.shiga.jp",
		reversed: "pj.agihs.ohsia"
	},
	{
		suffix: "gamo.shiga.jp",
		reversed: "pj.agihs.omag"
	},
	{
		suffix: "higashiomi.shiga.jp",
		reversed: "pj.agihs.imoihsagih"
	},
	{
		suffix: "hikone.shiga.jp",
		reversed: "pj.agihs.enokih"
	},
	{
		suffix: "koka.shiga.jp",
		reversed: "pj.agihs.akok"
	},
	{
		suffix: "konan.shiga.jp",
		reversed: "pj.agihs.nanok"
	},
	{
		suffix: "kosei.shiga.jp",
		reversed: "pj.agihs.iesok"
	},
	{
		suffix: "koto.shiga.jp",
		reversed: "pj.agihs.otok"
	},
	{
		suffix: "kusatsu.shiga.jp",
		reversed: "pj.agihs.ustasuk"
	},
	{
		suffix: "maibara.shiga.jp",
		reversed: "pj.agihs.arabiam"
	},
	{
		suffix: "moriyama.shiga.jp",
		reversed: "pj.agihs.amayirom"
	},
	{
		suffix: "nagahama.shiga.jp",
		reversed: "pj.agihs.amahagan"
	},
	{
		suffix: "nishiazai.shiga.jp",
		reversed: "pj.agihs.iazaihsin"
	},
	{
		suffix: "notogawa.shiga.jp",
		reversed: "pj.agihs.awagoton"
	},
	{
		suffix: "omihachiman.shiga.jp",
		reversed: "pj.agihs.namihcahimo"
	},
	{
		suffix: "otsu.shiga.jp",
		reversed: "pj.agihs.usto"
	},
	{
		suffix: "ritto.shiga.jp",
		reversed: "pj.agihs.ottir"
	},
	{
		suffix: "ryuoh.shiga.jp",
		reversed: "pj.agihs.houyr"
	},
	{
		suffix: "takashima.shiga.jp",
		reversed: "pj.agihs.amihsakat"
	},
	{
		suffix: "takatsuki.shiga.jp",
		reversed: "pj.agihs.ikustakat"
	},
	{
		suffix: "torahime.shiga.jp",
		reversed: "pj.agihs.emiharot"
	},
	{
		suffix: "toyosato.shiga.jp",
		reversed: "pj.agihs.otasoyot"
	},
	{
		suffix: "yasu.shiga.jp",
		reversed: "pj.agihs.usay"
	},
	{
		suffix: "akagi.shimane.jp",
		reversed: "pj.enamihs.igaka"
	},
	{
		suffix: "ama.shimane.jp",
		reversed: "pj.enamihs.ama"
	},
	{
		suffix: "gotsu.shimane.jp",
		reversed: "pj.enamihs.ustog"
	},
	{
		suffix: "hamada.shimane.jp",
		reversed: "pj.enamihs.adamah"
	},
	{
		suffix: "higashiizumo.shimane.jp",
		reversed: "pj.enamihs.omuziihsagih"
	},
	{
		suffix: "hikawa.shimane.jp",
		reversed: "pj.enamihs.awakih"
	},
	{
		suffix: "hikimi.shimane.jp",
		reversed: "pj.enamihs.imikih"
	},
	{
		suffix: "izumo.shimane.jp",
		reversed: "pj.enamihs.omuzi"
	},
	{
		suffix: "kakinoki.shimane.jp",
		reversed: "pj.enamihs.ikonikak"
	},
	{
		suffix: "masuda.shimane.jp",
		reversed: "pj.enamihs.adusam"
	},
	{
		suffix: "matsue.shimane.jp",
		reversed: "pj.enamihs.eustam"
	},
	{
		suffix: "misato.shimane.jp",
		reversed: "pj.enamihs.otasim"
	},
	{
		suffix: "nishinoshima.shimane.jp",
		reversed: "pj.enamihs.amihsonihsin"
	},
	{
		suffix: "ohda.shimane.jp",
		reversed: "pj.enamihs.adho"
	},
	{
		suffix: "okinoshima.shimane.jp",
		reversed: "pj.enamihs.amihsoniko"
	},
	{
		suffix: "okuizumo.shimane.jp",
		reversed: "pj.enamihs.omuziuko"
	},
	{
		suffix: "shimane.shimane.jp",
		reversed: "pj.enamihs.enamihs"
	},
	{
		suffix: "tamayu.shimane.jp",
		reversed: "pj.enamihs.uyamat"
	},
	{
		suffix: "tsuwano.shimane.jp",
		reversed: "pj.enamihs.onawust"
	},
	{
		suffix: "unnan.shimane.jp",
		reversed: "pj.enamihs.nannu"
	},
	{
		suffix: "yakumo.shimane.jp",
		reversed: "pj.enamihs.omukay"
	},
	{
		suffix: "yasugi.shimane.jp",
		reversed: "pj.enamihs.igusay"
	},
	{
		suffix: "yatsuka.shimane.jp",
		reversed: "pj.enamihs.akustay"
	},
	{
		suffix: "arai.shizuoka.jp",
		reversed: "pj.akouzihs.iara"
	},
	{
		suffix: "atami.shizuoka.jp",
		reversed: "pj.akouzihs.imata"
	},
	{
		suffix: "fuji.shizuoka.jp",
		reversed: "pj.akouzihs.ijuf"
	},
	{
		suffix: "fujieda.shizuoka.jp",
		reversed: "pj.akouzihs.adeijuf"
	},
	{
		suffix: "fujikawa.shizuoka.jp",
		reversed: "pj.akouzihs.awakijuf"
	},
	{
		suffix: "fujinomiya.shizuoka.jp",
		reversed: "pj.akouzihs.ayimonijuf"
	},
	{
		suffix: "fukuroi.shizuoka.jp",
		reversed: "pj.akouzihs.iorukuf"
	},
	{
		suffix: "gotemba.shizuoka.jp",
		reversed: "pj.akouzihs.abmetog"
	},
	{
		suffix: "haibara.shizuoka.jp",
		reversed: "pj.akouzihs.arabiah"
	},
	{
		suffix: "hamamatsu.shizuoka.jp",
		reversed: "pj.akouzihs.ustamamah"
	},
	{
		suffix: "higashiizu.shizuoka.jp",
		reversed: "pj.akouzihs.uziihsagih"
	},
	{
		suffix: "ito.shizuoka.jp",
		reversed: "pj.akouzihs.oti"
	},
	{
		suffix: "iwata.shizuoka.jp",
		reversed: "pj.akouzihs.atawi"
	},
	{
		suffix: "izu.shizuoka.jp",
		reversed: "pj.akouzihs.uzi"
	},
	{
		suffix: "izunokuni.shizuoka.jp",
		reversed: "pj.akouzihs.inukonuzi"
	},
	{
		suffix: "kakegawa.shizuoka.jp",
		reversed: "pj.akouzihs.awagekak"
	},
	{
		suffix: "kannami.shizuoka.jp",
		reversed: "pj.akouzihs.imannak"
	},
	{
		suffix: "kawanehon.shizuoka.jp",
		reversed: "pj.akouzihs.nohenawak"
	},
	{
		suffix: "kawazu.shizuoka.jp",
		reversed: "pj.akouzihs.uzawak"
	},
	{
		suffix: "kikugawa.shizuoka.jp",
		reversed: "pj.akouzihs.awagukik"
	},
	{
		suffix: "kosai.shizuoka.jp",
		reversed: "pj.akouzihs.iasok"
	},
	{
		suffix: "makinohara.shizuoka.jp",
		reversed: "pj.akouzihs.arahonikam"
	},
	{
		suffix: "matsuzaki.shizuoka.jp",
		reversed: "pj.akouzihs.ikazustam"
	},
	{
		suffix: "minamiizu.shizuoka.jp",
		reversed: "pj.akouzihs.uziimanim"
	},
	{
		suffix: "mishima.shizuoka.jp",
		reversed: "pj.akouzihs.amihsim"
	},
	{
		suffix: "morimachi.shizuoka.jp",
		reversed: "pj.akouzihs.ihcamirom"
	},
	{
		suffix: "nishiizu.shizuoka.jp",
		reversed: "pj.akouzihs.uziihsin"
	},
	{
		suffix: "numazu.shizuoka.jp",
		reversed: "pj.akouzihs.uzamun"
	},
	{
		suffix: "omaezaki.shizuoka.jp",
		reversed: "pj.akouzihs.ikazeamo"
	},
	{
		suffix: "shimada.shizuoka.jp",
		reversed: "pj.akouzihs.adamihs"
	},
	{
		suffix: "shimizu.shizuoka.jp",
		reversed: "pj.akouzihs.uzimihs"
	},
	{
		suffix: "shimoda.shizuoka.jp",
		reversed: "pj.akouzihs.adomihs"
	},
	{
		suffix: "shizuoka.shizuoka.jp",
		reversed: "pj.akouzihs.akouzihs"
	},
	{
		suffix: "susono.shizuoka.jp",
		reversed: "pj.akouzihs.onosus"
	},
	{
		suffix: "yaizu.shizuoka.jp",
		reversed: "pj.akouzihs.uziay"
	},
	{
		suffix: "yoshida.shizuoka.jp",
		reversed: "pj.akouzihs.adihsoy"
	},
	{
		suffix: "ashikaga.tochigi.jp",
		reversed: "pj.igihcot.agakihsa"
	},
	{
		suffix: "bato.tochigi.jp",
		reversed: "pj.igihcot.otab"
	},
	{
		suffix: "haga.tochigi.jp",
		reversed: "pj.igihcot.agah"
	},
	{
		suffix: "ichikai.tochigi.jp",
		reversed: "pj.igihcot.iakihci"
	},
	{
		suffix: "iwafune.tochigi.jp",
		reversed: "pj.igihcot.enufawi"
	},
	{
		suffix: "kaminokawa.tochigi.jp",
		reversed: "pj.igihcot.awakonimak"
	},
	{
		suffix: "kanuma.tochigi.jp",
		reversed: "pj.igihcot.amunak"
	},
	{
		suffix: "karasuyama.tochigi.jp",
		reversed: "pj.igihcot.amayusarak"
	},
	{
		suffix: "kuroiso.tochigi.jp",
		reversed: "pj.igihcot.osioruk"
	},
	{
		suffix: "mashiko.tochigi.jp",
		reversed: "pj.igihcot.okihsam"
	},
	{
		suffix: "mibu.tochigi.jp",
		reversed: "pj.igihcot.ubim"
	},
	{
		suffix: "moka.tochigi.jp",
		reversed: "pj.igihcot.akom"
	},
	{
		suffix: "motegi.tochigi.jp",
		reversed: "pj.igihcot.igetom"
	},
	{
		suffix: "nasu.tochigi.jp",
		reversed: "pj.igihcot.usan"
	},
	{
		suffix: "nasushiobara.tochigi.jp",
		reversed: "pj.igihcot.araboihsusan"
	},
	{
		suffix: "nikko.tochigi.jp",
		reversed: "pj.igihcot.okkin"
	},
	{
		suffix: "nishikata.tochigi.jp",
		reversed: "pj.igihcot.atakihsin"
	},
	{
		suffix: "nogi.tochigi.jp",
		reversed: "pj.igihcot.igon"
	},
	{
		suffix: "ohira.tochigi.jp",
		reversed: "pj.igihcot.ariho"
	},
	{
		suffix: "ohtawara.tochigi.jp",
		reversed: "pj.igihcot.arawatho"
	},
	{
		suffix: "oyama.tochigi.jp",
		reversed: "pj.igihcot.amayo"
	},
	{
		suffix: "sakura.tochigi.jp",
		reversed: "pj.igihcot.arukas"
	},
	{
		suffix: "sano.tochigi.jp",
		reversed: "pj.igihcot.onas"
	},
	{
		suffix: "shimotsuke.tochigi.jp",
		reversed: "pj.igihcot.ekustomihs"
	},
	{
		suffix: "shioya.tochigi.jp",
		reversed: "pj.igihcot.ayoihs"
	},
	{
		suffix: "takanezawa.tochigi.jp",
		reversed: "pj.igihcot.awazenakat"
	},
	{
		suffix: "tochigi.tochigi.jp",
		reversed: "pj.igihcot.igihcot"
	},
	{
		suffix: "tsuga.tochigi.jp",
		reversed: "pj.igihcot.agust"
	},
	{
		suffix: "ujiie.tochigi.jp",
		reversed: "pj.igihcot.eiiju"
	},
	{
		suffix: "utsunomiya.tochigi.jp",
		reversed: "pj.igihcot.ayimonustu"
	},
	{
		suffix: "yaita.tochigi.jp",
		reversed: "pj.igihcot.atiay"
	},
	{
		suffix: "aizumi.tokushima.jp",
		reversed: "pj.amihsukot.imuzia"
	},
	{
		suffix: "anan.tokushima.jp",
		reversed: "pj.amihsukot.nana"
	},
	{
		suffix: "ichiba.tokushima.jp",
		reversed: "pj.amihsukot.abihci"
	},
	{
		suffix: "itano.tokushima.jp",
		reversed: "pj.amihsukot.onati"
	},
	{
		suffix: "kainan.tokushima.jp",
		reversed: "pj.amihsukot.naniak"
	},
	{
		suffix: "komatsushima.tokushima.jp",
		reversed: "pj.amihsukot.amihsustamok"
	},
	{
		suffix: "matsushige.tokushima.jp",
		reversed: "pj.amihsukot.egihsustam"
	},
	{
		suffix: "mima.tokushima.jp",
		reversed: "pj.amihsukot.amim"
	},
	{
		suffix: "minami.tokushima.jp",
		reversed: "pj.amihsukot.imanim"
	},
	{
		suffix: "miyoshi.tokushima.jp",
		reversed: "pj.amihsukot.ihsoyim"
	},
	{
		suffix: "mugi.tokushima.jp",
		reversed: "pj.amihsukot.igum"
	},
	{
		suffix: "nakagawa.tokushima.jp",
		reversed: "pj.amihsukot.awagakan"
	},
	{
		suffix: "naruto.tokushima.jp",
		reversed: "pj.amihsukot.oturan"
	},
	{
		suffix: "sanagochi.tokushima.jp",
		reversed: "pj.amihsukot.ihcoganas"
	},
	{
		suffix: "shishikui.tokushima.jp",
		reversed: "pj.amihsukot.iukihsihs"
	},
	{
		suffix: "tokushima.tokushima.jp",
		reversed: "pj.amihsukot.amihsukot"
	},
	{
		suffix: "wajiki.tokushima.jp",
		reversed: "pj.amihsukot.ikijaw"
	},
	{
		suffix: "adachi.tokyo.jp",
		reversed: "pj.oykot.ihcada"
	},
	{
		suffix: "akiruno.tokyo.jp",
		reversed: "pj.oykot.onurika"
	},
	{
		suffix: "akishima.tokyo.jp",
		reversed: "pj.oykot.amihsika"
	},
	{
		suffix: "aogashima.tokyo.jp",
		reversed: "pj.oykot.amihsagoa"
	},
	{
		suffix: "arakawa.tokyo.jp",
		reversed: "pj.oykot.awakara"
	},
	{
		suffix: "bunkyo.tokyo.jp",
		reversed: "pj.oykot.oyknub"
	},
	{
		suffix: "chiyoda.tokyo.jp",
		reversed: "pj.oykot.adoyihc"
	},
	{
		suffix: "chofu.tokyo.jp",
		reversed: "pj.oykot.ufohc"
	},
	{
		suffix: "chuo.tokyo.jp",
		reversed: "pj.oykot.ouhc"
	},
	{
		suffix: "edogawa.tokyo.jp",
		reversed: "pj.oykot.awagode"
	},
	{
		suffix: "fuchu.tokyo.jp",
		reversed: "pj.oykot.uhcuf"
	},
	{
		suffix: "fussa.tokyo.jp",
		reversed: "pj.oykot.assuf"
	},
	{
		suffix: "hachijo.tokyo.jp",
		reversed: "pj.oykot.ojihcah"
	},
	{
		suffix: "hachioji.tokyo.jp",
		reversed: "pj.oykot.ijoihcah"
	},
	{
		suffix: "hamura.tokyo.jp",
		reversed: "pj.oykot.arumah"
	},
	{
		suffix: "higashikurume.tokyo.jp",
		reversed: "pj.oykot.emurukihsagih"
	},
	{
		suffix: "higashimurayama.tokyo.jp",
		reversed: "pj.oykot.amayarumihsagih"
	},
	{
		suffix: "higashiyamato.tokyo.jp",
		reversed: "pj.oykot.otamayihsagih"
	},
	{
		suffix: "hino.tokyo.jp",
		reversed: "pj.oykot.onih"
	},
	{
		suffix: "hinode.tokyo.jp",
		reversed: "pj.oykot.edonih"
	},
	{
		suffix: "hinohara.tokyo.jp",
		reversed: "pj.oykot.arahonih"
	},
	{
		suffix: "inagi.tokyo.jp",
		reversed: "pj.oykot.igani"
	},
	{
		suffix: "itabashi.tokyo.jp",
		reversed: "pj.oykot.ihsabati"
	},
	{
		suffix: "katsushika.tokyo.jp",
		reversed: "pj.oykot.akihsustak"
	},
	{
		suffix: "kita.tokyo.jp",
		reversed: "pj.oykot.atik"
	},
	{
		suffix: "kiyose.tokyo.jp",
		reversed: "pj.oykot.esoyik"
	},
	{
		suffix: "kodaira.tokyo.jp",
		reversed: "pj.oykot.ariadok"
	},
	{
		suffix: "koganei.tokyo.jp",
		reversed: "pj.oykot.ienagok"
	},
	{
		suffix: "kokubunji.tokyo.jp",
		reversed: "pj.oykot.ijnubukok"
	},
	{
		suffix: "komae.tokyo.jp",
		reversed: "pj.oykot.eamok"
	},
	{
		suffix: "koto.tokyo.jp",
		reversed: "pj.oykot.otok"
	},
	{
		suffix: "kouzushima.tokyo.jp",
		reversed: "pj.oykot.amihsuzuok"
	},
	{
		suffix: "kunitachi.tokyo.jp",
		reversed: "pj.oykot.ihcatinuk"
	},
	{
		suffix: "machida.tokyo.jp",
		reversed: "pj.oykot.adihcam"
	},
	{
		suffix: "meguro.tokyo.jp",
		reversed: "pj.oykot.orugem"
	},
	{
		suffix: "minato.tokyo.jp",
		reversed: "pj.oykot.otanim"
	},
	{
		suffix: "mitaka.tokyo.jp",
		reversed: "pj.oykot.akatim"
	},
	{
		suffix: "mizuho.tokyo.jp",
		reversed: "pj.oykot.ohuzim"
	},
	{
		suffix: "musashimurayama.tokyo.jp",
		reversed: "pj.oykot.amayarumihsasum"
	},
	{
		suffix: "musashino.tokyo.jp",
		reversed: "pj.oykot.onihsasum"
	},
	{
		suffix: "nakano.tokyo.jp",
		reversed: "pj.oykot.onakan"
	},
	{
		suffix: "nerima.tokyo.jp",
		reversed: "pj.oykot.amiren"
	},
	{
		suffix: "ogasawara.tokyo.jp",
		reversed: "pj.oykot.arawasago"
	},
	{
		suffix: "okutama.tokyo.jp",
		reversed: "pj.oykot.amatuko"
	},
	{
		suffix: "ome.tokyo.jp",
		reversed: "pj.oykot.emo"
	},
	{
		suffix: "oshima.tokyo.jp",
		reversed: "pj.oykot.amihso"
	},
	{
		suffix: "ota.tokyo.jp",
		reversed: "pj.oykot.ato"
	},
	{
		suffix: "setagaya.tokyo.jp",
		reversed: "pj.oykot.ayagates"
	},
	{
		suffix: "shibuya.tokyo.jp",
		reversed: "pj.oykot.ayubihs"
	},
	{
		suffix: "shinagawa.tokyo.jp",
		reversed: "pj.oykot.awaganihs"
	},
	{
		suffix: "shinjuku.tokyo.jp",
		reversed: "pj.oykot.ukujnihs"
	},
	{
		suffix: "suginami.tokyo.jp",
		reversed: "pj.oykot.imanigus"
	},
	{
		suffix: "sumida.tokyo.jp",
		reversed: "pj.oykot.adimus"
	},
	{
		suffix: "tachikawa.tokyo.jp",
		reversed: "pj.oykot.awakihcat"
	},
	{
		suffix: "taito.tokyo.jp",
		reversed: "pj.oykot.otiat"
	},
	{
		suffix: "tama.tokyo.jp",
		reversed: "pj.oykot.amat"
	},
	{
		suffix: "toshima.tokyo.jp",
		reversed: "pj.oykot.amihsot"
	},
	{
		suffix: "chizu.tottori.jp",
		reversed: "pj.irottot.uzihc"
	},
	{
		suffix: "hino.tottori.jp",
		reversed: "pj.irottot.onih"
	},
	{
		suffix: "kawahara.tottori.jp",
		reversed: "pj.irottot.arahawak"
	},
	{
		suffix: "koge.tottori.jp",
		reversed: "pj.irottot.egok"
	},
	{
		suffix: "kotoura.tottori.jp",
		reversed: "pj.irottot.aruotok"
	},
	{
		suffix: "misasa.tottori.jp",
		reversed: "pj.irottot.asasim"
	},
	{
		suffix: "nanbu.tottori.jp",
		reversed: "pj.irottot.ubnan"
	},
	{
		suffix: "nichinan.tottori.jp",
		reversed: "pj.irottot.nanihcin"
	},
	{
		suffix: "sakaiminato.tottori.jp",
		reversed: "pj.irottot.otanimiakas"
	},
	{
		suffix: "tottori.tottori.jp",
		reversed: "pj.irottot.irottot"
	},
	{
		suffix: "wakasa.tottori.jp",
		reversed: "pj.irottot.asakaw"
	},
	{
		suffix: "yazu.tottori.jp",
		reversed: "pj.irottot.uzay"
	},
	{
		suffix: "yonago.tottori.jp",
		reversed: "pj.irottot.oganoy"
	},
	{
		suffix: "asahi.toyama.jp",
		reversed: "pj.amayot.ihasa"
	},
	{
		suffix: "fuchu.toyama.jp",
		reversed: "pj.amayot.uhcuf"
	},
	{
		suffix: "fukumitsu.toyama.jp",
		reversed: "pj.amayot.ustimukuf"
	},
	{
		suffix: "funahashi.toyama.jp",
		reversed: "pj.amayot.ihsahanuf"
	},
	{
		suffix: "himi.toyama.jp",
		reversed: "pj.amayot.imih"
	},
	{
		suffix: "imizu.toyama.jp",
		reversed: "pj.amayot.uzimi"
	},
	{
		suffix: "inami.toyama.jp",
		reversed: "pj.amayot.imani"
	},
	{
		suffix: "johana.toyama.jp",
		reversed: "pj.amayot.anahoj"
	},
	{
		suffix: "kamiichi.toyama.jp",
		reversed: "pj.amayot.ihciimak"
	},
	{
		suffix: "kurobe.toyama.jp",
		reversed: "pj.amayot.eboruk"
	},
	{
		suffix: "nakaniikawa.toyama.jp",
		reversed: "pj.amayot.awakiinakan"
	},
	{
		suffix: "namerikawa.toyama.jp",
		reversed: "pj.amayot.awakireman"
	},
	{
		suffix: "nanto.toyama.jp",
		reversed: "pj.amayot.otnan"
	},
	{
		suffix: "nyuzen.toyama.jp",
		reversed: "pj.amayot.nezuyn"
	},
	{
		suffix: "oyabe.toyama.jp",
		reversed: "pj.amayot.ebayo"
	},
	{
		suffix: "taira.toyama.jp",
		reversed: "pj.amayot.ariat"
	},
	{
		suffix: "takaoka.toyama.jp",
		reversed: "pj.amayot.akoakat"
	},
	{
		suffix: "tateyama.toyama.jp",
		reversed: "pj.amayot.amayetat"
	},
	{
		suffix: "toga.toyama.jp",
		reversed: "pj.amayot.agot"
	},
	{
		suffix: "tonami.toyama.jp",
		reversed: "pj.amayot.imanot"
	},
	{
		suffix: "toyama.toyama.jp",
		reversed: "pj.amayot.amayot"
	},
	{
		suffix: "unazuki.toyama.jp",
		reversed: "pj.amayot.ikuzanu"
	},
	{
		suffix: "uozu.toyama.jp",
		reversed: "pj.amayot.uzou"
	},
	{
		suffix: "yamada.toyama.jp",
		reversed: "pj.amayot.adamay"
	},
	{
		suffix: "arida.wakayama.jp",
		reversed: "pj.amayakaw.adira"
	},
	{
		suffix: "aridagawa.wakayama.jp",
		reversed: "pj.amayakaw.awagadira"
	},
	{
		suffix: "gobo.wakayama.jp",
		reversed: "pj.amayakaw.obog"
	},
	{
		suffix: "hashimoto.wakayama.jp",
		reversed: "pj.amayakaw.otomihsah"
	},
	{
		suffix: "hidaka.wakayama.jp",
		reversed: "pj.amayakaw.akadih"
	},
	{
		suffix: "hirogawa.wakayama.jp",
		reversed: "pj.amayakaw.awagorih"
	},
	{
		suffix: "inami.wakayama.jp",
		reversed: "pj.amayakaw.imani"
	},
	{
		suffix: "iwade.wakayama.jp",
		reversed: "pj.amayakaw.edawi"
	},
	{
		suffix: "kainan.wakayama.jp",
		reversed: "pj.amayakaw.naniak"
	},
	{
		suffix: "kamitonda.wakayama.jp",
		reversed: "pj.amayakaw.adnotimak"
	},
	{
		suffix: "katsuragi.wakayama.jp",
		reversed: "pj.amayakaw.igarustak"
	},
	{
		suffix: "kimino.wakayama.jp",
		reversed: "pj.amayakaw.onimik"
	},
	{
		suffix: "kinokawa.wakayama.jp",
		reversed: "pj.amayakaw.awakonik"
	},
	{
		suffix: "kitayama.wakayama.jp",
		reversed: "pj.amayakaw.amayatik"
	},
	{
		suffix: "koya.wakayama.jp",
		reversed: "pj.amayakaw.ayok"
	},
	{
		suffix: "koza.wakayama.jp",
		reversed: "pj.amayakaw.azok"
	},
	{
		suffix: "kozagawa.wakayama.jp",
		reversed: "pj.amayakaw.awagazok"
	},
	{
		suffix: "kudoyama.wakayama.jp",
		reversed: "pj.amayakaw.amayoduk"
	},
	{
		suffix: "kushimoto.wakayama.jp",
		reversed: "pj.amayakaw.otomihsuk"
	},
	{
		suffix: "mihama.wakayama.jp",
		reversed: "pj.amayakaw.amahim"
	},
	{
		suffix: "misato.wakayama.jp",
		reversed: "pj.amayakaw.otasim"
	},
	{
		suffix: "nachikatsuura.wakayama.jp",
		reversed: "pj.amayakaw.aruustakihcan"
	},
	{
		suffix: "shingu.wakayama.jp",
		reversed: "pj.amayakaw.ugnihs"
	},
	{
		suffix: "shirahama.wakayama.jp",
		reversed: "pj.amayakaw.amaharihs"
	},
	{
		suffix: "taiji.wakayama.jp",
		reversed: "pj.amayakaw.ijiat"
	},
	{
		suffix: "tanabe.wakayama.jp",
		reversed: "pj.amayakaw.ebanat"
	},
	{
		suffix: "wakayama.wakayama.jp",
		reversed: "pj.amayakaw.amayakaw"
	},
	{
		suffix: "yuasa.wakayama.jp",
		reversed: "pj.amayakaw.asauy"
	},
	{
		suffix: "yura.wakayama.jp",
		reversed: "pj.amayakaw.aruy"
	},
	{
		suffix: "asahi.yamagata.jp",
		reversed: "pj.atagamay.ihasa"
	},
	{
		suffix: "funagata.yamagata.jp",
		reversed: "pj.atagamay.ataganuf"
	},
	{
		suffix: "higashine.yamagata.jp",
		reversed: "pj.atagamay.enihsagih"
	},
	{
		suffix: "iide.yamagata.jp",
		reversed: "pj.atagamay.edii"
	},
	{
		suffix: "kahoku.yamagata.jp",
		reversed: "pj.atagamay.ukohak"
	},
	{
		suffix: "kaminoyama.yamagata.jp",
		reversed: "pj.atagamay.amayonimak"
	},
	{
		suffix: "kaneyama.yamagata.jp",
		reversed: "pj.atagamay.amayenak"
	},
	{
		suffix: "kawanishi.yamagata.jp",
		reversed: "pj.atagamay.ihsinawak"
	},
	{
		suffix: "mamurogawa.yamagata.jp",
		reversed: "pj.atagamay.awagorumam"
	},
	{
		suffix: "mikawa.yamagata.jp",
		reversed: "pj.atagamay.awakim"
	},
	{
		suffix: "murayama.yamagata.jp",
		reversed: "pj.atagamay.amayarum"
	},
	{
		suffix: "nagai.yamagata.jp",
		reversed: "pj.atagamay.iagan"
	},
	{
		suffix: "nakayama.yamagata.jp",
		reversed: "pj.atagamay.amayakan"
	},
	{
		suffix: "nanyo.yamagata.jp",
		reversed: "pj.atagamay.oynan"
	},
	{
		suffix: "nishikawa.yamagata.jp",
		reversed: "pj.atagamay.awakihsin"
	},
	{
		suffix: "obanazawa.yamagata.jp",
		reversed: "pj.atagamay.awazanabo"
	},
	{
		suffix: "oe.yamagata.jp",
		reversed: "pj.atagamay.eo"
	},
	{
		suffix: "oguni.yamagata.jp",
		reversed: "pj.atagamay.inugo"
	},
	{
		suffix: "ohkura.yamagata.jp",
		reversed: "pj.atagamay.arukho"
	},
	{
		suffix: "oishida.yamagata.jp",
		reversed: "pj.atagamay.adihsio"
	},
	{
		suffix: "sagae.yamagata.jp",
		reversed: "pj.atagamay.eagas"
	},
	{
		suffix: "sakata.yamagata.jp",
		reversed: "pj.atagamay.atakas"
	},
	{
		suffix: "sakegawa.yamagata.jp",
		reversed: "pj.atagamay.awagekas"
	},
	{
		suffix: "shinjo.yamagata.jp",
		reversed: "pj.atagamay.ojnihs"
	},
	{
		suffix: "shirataka.yamagata.jp",
		reversed: "pj.atagamay.akatarihs"
	},
	{
		suffix: "shonai.yamagata.jp",
		reversed: "pj.atagamay.ianohs"
	},
	{
		suffix: "takahata.yamagata.jp",
		reversed: "pj.atagamay.atahakat"
	},
	{
		suffix: "tendo.yamagata.jp",
		reversed: "pj.atagamay.odnet"
	},
	{
		suffix: "tozawa.yamagata.jp",
		reversed: "pj.atagamay.awazot"
	},
	{
		suffix: "tsuruoka.yamagata.jp",
		reversed: "pj.atagamay.akourust"
	},
	{
		suffix: "yamagata.yamagata.jp",
		reversed: "pj.atagamay.atagamay"
	},
	{
		suffix: "yamanobe.yamagata.jp",
		reversed: "pj.atagamay.ebonamay"
	},
	{
		suffix: "yonezawa.yamagata.jp",
		reversed: "pj.atagamay.awazenoy"
	},
	{
		suffix: "yuza.yamagata.jp",
		reversed: "pj.atagamay.azuy"
	},
	{
		suffix: "abu.yamaguchi.jp",
		reversed: "pj.ihcugamay.uba"
	},
	{
		suffix: "hagi.yamaguchi.jp",
		reversed: "pj.ihcugamay.igah"
	},
	{
		suffix: "hikari.yamaguchi.jp",
		reversed: "pj.ihcugamay.irakih"
	},
	{
		suffix: "hofu.yamaguchi.jp",
		reversed: "pj.ihcugamay.ufoh"
	},
	{
		suffix: "iwakuni.yamaguchi.jp",
		reversed: "pj.ihcugamay.inukawi"
	},
	{
		suffix: "kudamatsu.yamaguchi.jp",
		reversed: "pj.ihcugamay.ustamaduk"
	},
	{
		suffix: "mitou.yamaguchi.jp",
		reversed: "pj.ihcugamay.uotim"
	},
	{
		suffix: "nagato.yamaguchi.jp",
		reversed: "pj.ihcugamay.otagan"
	},
	{
		suffix: "oshima.yamaguchi.jp",
		reversed: "pj.ihcugamay.amihso"
	},
	{
		suffix: "shimonoseki.yamaguchi.jp",
		reversed: "pj.ihcugamay.ikesonomihs"
	},
	{
		suffix: "shunan.yamaguchi.jp",
		reversed: "pj.ihcugamay.nanuhs"
	},
	{
		suffix: "tabuse.yamaguchi.jp",
		reversed: "pj.ihcugamay.esubat"
	},
	{
		suffix: "tokuyama.yamaguchi.jp",
		reversed: "pj.ihcugamay.amayukot"
	},
	{
		suffix: "toyota.yamaguchi.jp",
		reversed: "pj.ihcugamay.atoyot"
	},
	{
		suffix: "ube.yamaguchi.jp",
		reversed: "pj.ihcugamay.ebu"
	},
	{
		suffix: "yuu.yamaguchi.jp",
		reversed: "pj.ihcugamay.uuy"
	},
	{
		suffix: "chuo.yamanashi.jp",
		reversed: "pj.ihsanamay.ouhc"
	},
	{
		suffix: "doshi.yamanashi.jp",
		reversed: "pj.ihsanamay.ihsod"
	},
	{
		suffix: "fuefuki.yamanashi.jp",
		reversed: "pj.ihsanamay.ikufeuf"
	},
	{
		suffix: "fujikawa.yamanashi.jp",
		reversed: "pj.ihsanamay.awakijuf"
	},
	{
		suffix: "fujikawaguchiko.yamanashi.jp",
		reversed: "pj.ihsanamay.okihcugawakijuf"
	},
	{
		suffix: "fujiyoshida.yamanashi.jp",
		reversed: "pj.ihsanamay.adihsoyijuf"
	},
	{
		suffix: "hayakawa.yamanashi.jp",
		reversed: "pj.ihsanamay.awakayah"
	},
	{
		suffix: "hokuto.yamanashi.jp",
		reversed: "pj.ihsanamay.otukoh"
	},
	{
		suffix: "ichikawamisato.yamanashi.jp",
		reversed: "pj.ihsanamay.otasimawakihci"
	},
	{
		suffix: "kai.yamanashi.jp",
		reversed: "pj.ihsanamay.iak"
	},
	{
		suffix: "kofu.yamanashi.jp",
		reversed: "pj.ihsanamay.ufok"
	},
	{
		suffix: "koshu.yamanashi.jp",
		reversed: "pj.ihsanamay.uhsok"
	},
	{
		suffix: "kosuge.yamanashi.jp",
		reversed: "pj.ihsanamay.egusok"
	},
	{
		suffix: "minami-alps.yamanashi.jp",
		reversed: "pj.ihsanamay.spla-imanim"
	},
	{
		suffix: "minobu.yamanashi.jp",
		reversed: "pj.ihsanamay.ubonim"
	},
	{
		suffix: "nakamichi.yamanashi.jp",
		reversed: "pj.ihsanamay.ihcimakan"
	},
	{
		suffix: "nanbu.yamanashi.jp",
		reversed: "pj.ihsanamay.ubnan"
	},
	{
		suffix: "narusawa.yamanashi.jp",
		reversed: "pj.ihsanamay.awasuran"
	},
	{
		suffix: "nirasaki.yamanashi.jp",
		reversed: "pj.ihsanamay.ikasarin"
	},
	{
		suffix: "nishikatsura.yamanashi.jp",
		reversed: "pj.ihsanamay.arustakihsin"
	},
	{
		suffix: "oshino.yamanashi.jp",
		reversed: "pj.ihsanamay.onihso"
	},
	{
		suffix: "otsuki.yamanashi.jp",
		reversed: "pj.ihsanamay.ikusto"
	},
	{
		suffix: "showa.yamanashi.jp",
		reversed: "pj.ihsanamay.awohs"
	},
	{
		suffix: "tabayama.yamanashi.jp",
		reversed: "pj.ihsanamay.amayabat"
	},
	{
		suffix: "tsuru.yamanashi.jp",
		reversed: "pj.ihsanamay.urust"
	},
	{
		suffix: "uenohara.yamanashi.jp",
		reversed: "pj.ihsanamay.arahoneu"
	},
	{
		suffix: "yamanakako.yamanashi.jp",
		reversed: "pj.ihsanamay.okakanamay"
	},
	{
		suffix: "yamanashi.yamanashi.jp",
		reversed: "pj.ihsanamay.ihsanamay"
	},
	{
		suffix: "ke",
		reversed: "ek"
	},
	{
		suffix: "ac.ke",
		reversed: "ek.ca"
	},
	{
		suffix: "co.ke",
		reversed: "ek.oc"
	},
	{
		suffix: "go.ke",
		reversed: "ek.og"
	},
	{
		suffix: "info.ke",
		reversed: "ek.ofni"
	},
	{
		suffix: "me.ke",
		reversed: "ek.em"
	},
	{
		suffix: "mobi.ke",
		reversed: "ek.ibom"
	},
	{
		suffix: "ne.ke",
		reversed: "ek.en"
	},
	{
		suffix: "or.ke",
		reversed: "ek.ro"
	},
	{
		suffix: "sc.ke",
		reversed: "ek.cs"
	},
	{
		suffix: "kg",
		reversed: "gk"
	},
	{
		suffix: "org.kg",
		reversed: "gk.gro"
	},
	{
		suffix: "net.kg",
		reversed: "gk.ten"
	},
	{
		suffix: "com.kg",
		reversed: "gk.moc"
	},
	{
		suffix: "edu.kg",
		reversed: "gk.ude"
	},
	{
		suffix: "gov.kg",
		reversed: "gk.vog"
	},
	{
		suffix: "mil.kg",
		reversed: "gk.lim"
	},
	{
		suffix: "*.kh",
		reversed: "hk"
	},
	{
		suffix: "ki",
		reversed: "ik"
	},
	{
		suffix: "edu.ki",
		reversed: "ik.ude"
	},
	{
		suffix: "biz.ki",
		reversed: "ik.zib"
	},
	{
		suffix: "net.ki",
		reversed: "ik.ten"
	},
	{
		suffix: "org.ki",
		reversed: "ik.gro"
	},
	{
		suffix: "gov.ki",
		reversed: "ik.vog"
	},
	{
		suffix: "info.ki",
		reversed: "ik.ofni"
	},
	{
		suffix: "com.ki",
		reversed: "ik.moc"
	},
	{
		suffix: "km",
		reversed: "mk"
	},
	{
		suffix: "org.km",
		reversed: "mk.gro"
	},
	{
		suffix: "nom.km",
		reversed: "mk.mon"
	},
	{
		suffix: "gov.km",
		reversed: "mk.vog"
	},
	{
		suffix: "prd.km",
		reversed: "mk.drp"
	},
	{
		suffix: "tm.km",
		reversed: "mk.mt"
	},
	{
		suffix: "edu.km",
		reversed: "mk.ude"
	},
	{
		suffix: "mil.km",
		reversed: "mk.lim"
	},
	{
		suffix: "ass.km",
		reversed: "mk.ssa"
	},
	{
		suffix: "com.km",
		reversed: "mk.moc"
	},
	{
		suffix: "coop.km",
		reversed: "mk.pooc"
	},
	{
		suffix: "asso.km",
		reversed: "mk.ossa"
	},
	{
		suffix: "presse.km",
		reversed: "mk.esserp"
	},
	{
		suffix: "medecin.km",
		reversed: "mk.nicedem"
	},
	{
		suffix: "notaires.km",
		reversed: "mk.seriaton"
	},
	{
		suffix: "pharmaciens.km",
		reversed: "mk.sneicamrahp"
	},
	{
		suffix: "veterinaire.km",
		reversed: "mk.erianiretev"
	},
	{
		suffix: "gouv.km",
		reversed: "mk.vuog"
	},
	{
		suffix: "kn",
		reversed: "nk"
	},
	{
		suffix: "net.kn",
		reversed: "nk.ten"
	},
	{
		suffix: "org.kn",
		reversed: "nk.gro"
	},
	{
		suffix: "edu.kn",
		reversed: "nk.ude"
	},
	{
		suffix: "gov.kn",
		reversed: "nk.vog"
	},
	{
		suffix: "kp",
		reversed: "pk"
	},
	{
		suffix: "com.kp",
		reversed: "pk.moc"
	},
	{
		suffix: "edu.kp",
		reversed: "pk.ude"
	},
	{
		suffix: "gov.kp",
		reversed: "pk.vog"
	},
	{
		suffix: "org.kp",
		reversed: "pk.gro"
	},
	{
		suffix: "rep.kp",
		reversed: "pk.per"
	},
	{
		suffix: "tra.kp",
		reversed: "pk.art"
	},
	{
		suffix: "kr",
		reversed: "rk"
	},
	{
		suffix: "ac.kr",
		reversed: "rk.ca"
	},
	{
		suffix: "co.kr",
		reversed: "rk.oc"
	},
	{
		suffix: "es.kr",
		reversed: "rk.se"
	},
	{
		suffix: "go.kr",
		reversed: "rk.og"
	},
	{
		suffix: "hs.kr",
		reversed: "rk.sh"
	},
	{
		suffix: "kg.kr",
		reversed: "rk.gk"
	},
	{
		suffix: "mil.kr",
		reversed: "rk.lim"
	},
	{
		suffix: "ms.kr",
		reversed: "rk.sm"
	},
	{
		suffix: "ne.kr",
		reversed: "rk.en"
	},
	{
		suffix: "or.kr",
		reversed: "rk.ro"
	},
	{
		suffix: "pe.kr",
		reversed: "rk.ep"
	},
	{
		suffix: "re.kr",
		reversed: "rk.er"
	},
	{
		suffix: "sc.kr",
		reversed: "rk.cs"
	},
	{
		suffix: "busan.kr",
		reversed: "rk.nasub"
	},
	{
		suffix: "chungbuk.kr",
		reversed: "rk.kubgnuhc"
	},
	{
		suffix: "chungnam.kr",
		reversed: "rk.mangnuhc"
	},
	{
		suffix: "daegu.kr",
		reversed: "rk.ugead"
	},
	{
		suffix: "daejeon.kr",
		reversed: "rk.noejead"
	},
	{
		suffix: "gangwon.kr",
		reversed: "rk.nowgnag"
	},
	{
		suffix: "gwangju.kr",
		reversed: "rk.ujgnawg"
	},
	{
		suffix: "gyeongbuk.kr",
		reversed: "rk.kubgnoeyg"
	},
	{
		suffix: "gyeonggi.kr",
		reversed: "rk.iggnoeyg"
	},
	{
		suffix: "gyeongnam.kr",
		reversed: "rk.mangnoeyg"
	},
	{
		suffix: "incheon.kr",
		reversed: "rk.noehcni"
	},
	{
		suffix: "jeju.kr",
		reversed: "rk.ujej"
	},
	{
		suffix: "jeonbuk.kr",
		reversed: "rk.kubnoej"
	},
	{
		suffix: "jeonnam.kr",
		reversed: "rk.mannoej"
	},
	{
		suffix: "seoul.kr",
		reversed: "rk.luoes"
	},
	{
		suffix: "ulsan.kr",
		reversed: "rk.naslu"
	},
	{
		suffix: "kw",
		reversed: "wk"
	},
	{
		suffix: "com.kw",
		reversed: "wk.moc"
	},
	{
		suffix: "edu.kw",
		reversed: "wk.ude"
	},
	{
		suffix: "emb.kw",
		reversed: "wk.bme"
	},
	{
		suffix: "gov.kw",
		reversed: "wk.vog"
	},
	{
		suffix: "ind.kw",
		reversed: "wk.dni"
	},
	{
		suffix: "net.kw",
		reversed: "wk.ten"
	},
	{
		suffix: "org.kw",
		reversed: "wk.gro"
	},
	{
		suffix: "ky",
		reversed: "yk"
	},
	{
		suffix: "com.ky",
		reversed: "yk.moc"
	},
	{
		suffix: "edu.ky",
		reversed: "yk.ude"
	},
	{
		suffix: "net.ky",
		reversed: "yk.ten"
	},
	{
		suffix: "org.ky",
		reversed: "yk.gro"
	},
	{
		suffix: "kz",
		reversed: "zk"
	},
	{
		suffix: "org.kz",
		reversed: "zk.gro"
	},
	{
		suffix: "edu.kz",
		reversed: "zk.ude"
	},
	{
		suffix: "net.kz",
		reversed: "zk.ten"
	},
	{
		suffix: "gov.kz",
		reversed: "zk.vog"
	},
	{
		suffix: "mil.kz",
		reversed: "zk.lim"
	},
	{
		suffix: "com.kz",
		reversed: "zk.moc"
	},
	{
		suffix: "la",
		reversed: "al"
	},
	{
		suffix: "int.la",
		reversed: "al.tni"
	},
	{
		suffix: "net.la",
		reversed: "al.ten"
	},
	{
		suffix: "info.la",
		reversed: "al.ofni"
	},
	{
		suffix: "edu.la",
		reversed: "al.ude"
	},
	{
		suffix: "gov.la",
		reversed: "al.vog"
	},
	{
		suffix: "per.la",
		reversed: "al.rep"
	},
	{
		suffix: "com.la",
		reversed: "al.moc"
	},
	{
		suffix: "org.la",
		reversed: "al.gro"
	},
	{
		suffix: "lb",
		reversed: "bl"
	},
	{
		suffix: "com.lb",
		reversed: "bl.moc"
	},
	{
		suffix: "edu.lb",
		reversed: "bl.ude"
	},
	{
		suffix: "gov.lb",
		reversed: "bl.vog"
	},
	{
		suffix: "net.lb",
		reversed: "bl.ten"
	},
	{
		suffix: "org.lb",
		reversed: "bl.gro"
	},
	{
		suffix: "lc",
		reversed: "cl"
	},
	{
		suffix: "com.lc",
		reversed: "cl.moc"
	},
	{
		suffix: "net.lc",
		reversed: "cl.ten"
	},
	{
		suffix: "co.lc",
		reversed: "cl.oc"
	},
	{
		suffix: "org.lc",
		reversed: "cl.gro"
	},
	{
		suffix: "edu.lc",
		reversed: "cl.ude"
	},
	{
		suffix: "gov.lc",
		reversed: "cl.vog"
	},
	{
		suffix: "li",
		reversed: "il"
	},
	{
		suffix: "lk",
		reversed: "kl"
	},
	{
		suffix: "gov.lk",
		reversed: "kl.vog"
	},
	{
		suffix: "sch.lk",
		reversed: "kl.hcs"
	},
	{
		suffix: "net.lk",
		reversed: "kl.ten"
	},
	{
		suffix: "int.lk",
		reversed: "kl.tni"
	},
	{
		suffix: "com.lk",
		reversed: "kl.moc"
	},
	{
		suffix: "org.lk",
		reversed: "kl.gro"
	},
	{
		suffix: "edu.lk",
		reversed: "kl.ude"
	},
	{
		suffix: "ngo.lk",
		reversed: "kl.ogn"
	},
	{
		suffix: "soc.lk",
		reversed: "kl.cos"
	},
	{
		suffix: "web.lk",
		reversed: "kl.bew"
	},
	{
		suffix: "ltd.lk",
		reversed: "kl.dtl"
	},
	{
		suffix: "assn.lk",
		reversed: "kl.nssa"
	},
	{
		suffix: "grp.lk",
		reversed: "kl.prg"
	},
	{
		suffix: "hotel.lk",
		reversed: "kl.letoh"
	},
	{
		suffix: "ac.lk",
		reversed: "kl.ca"
	},
	{
		suffix: "lr",
		reversed: "rl"
	},
	{
		suffix: "com.lr",
		reversed: "rl.moc"
	},
	{
		suffix: "edu.lr",
		reversed: "rl.ude"
	},
	{
		suffix: "gov.lr",
		reversed: "rl.vog"
	},
	{
		suffix: "org.lr",
		reversed: "rl.gro"
	},
	{
		suffix: "net.lr",
		reversed: "rl.ten"
	},
	{
		suffix: "ls",
		reversed: "sl"
	},
	{
		suffix: "ac.ls",
		reversed: "sl.ca"
	},
	{
		suffix: "biz.ls",
		reversed: "sl.zib"
	},
	{
		suffix: "co.ls",
		reversed: "sl.oc"
	},
	{
		suffix: "edu.ls",
		reversed: "sl.ude"
	},
	{
		suffix: "gov.ls",
		reversed: "sl.vog"
	},
	{
		suffix: "info.ls",
		reversed: "sl.ofni"
	},
	{
		suffix: "net.ls",
		reversed: "sl.ten"
	},
	{
		suffix: "org.ls",
		reversed: "sl.gro"
	},
	{
		suffix: "sc.ls",
		reversed: "sl.cs"
	},
	{
		suffix: "lt",
		reversed: "tl"
	},
	{
		suffix: "gov.lt",
		reversed: "tl.vog"
	},
	{
		suffix: "lu",
		reversed: "ul"
	},
	{
		suffix: "lv",
		reversed: "vl"
	},
	{
		suffix: "com.lv",
		reversed: "vl.moc"
	},
	{
		suffix: "edu.lv",
		reversed: "vl.ude"
	},
	{
		suffix: "gov.lv",
		reversed: "vl.vog"
	},
	{
		suffix: "org.lv",
		reversed: "vl.gro"
	},
	{
		suffix: "mil.lv",
		reversed: "vl.lim"
	},
	{
		suffix: "id.lv",
		reversed: "vl.di"
	},
	{
		suffix: "net.lv",
		reversed: "vl.ten"
	},
	{
		suffix: "asn.lv",
		reversed: "vl.nsa"
	},
	{
		suffix: "conf.lv",
		reversed: "vl.fnoc"
	},
	{
		suffix: "ly",
		reversed: "yl"
	},
	{
		suffix: "com.ly",
		reversed: "yl.moc"
	},
	{
		suffix: "net.ly",
		reversed: "yl.ten"
	},
	{
		suffix: "gov.ly",
		reversed: "yl.vog"
	},
	{
		suffix: "plc.ly",
		reversed: "yl.clp"
	},
	{
		suffix: "edu.ly",
		reversed: "yl.ude"
	},
	{
		suffix: "sch.ly",
		reversed: "yl.hcs"
	},
	{
		suffix: "med.ly",
		reversed: "yl.dem"
	},
	{
		suffix: "org.ly",
		reversed: "yl.gro"
	},
	{
		suffix: "id.ly",
		reversed: "yl.di"
	},
	{
		suffix: "ma",
		reversed: "am"
	},
	{
		suffix: "co.ma",
		reversed: "am.oc"
	},
	{
		suffix: "net.ma",
		reversed: "am.ten"
	},
	{
		suffix: "gov.ma",
		reversed: "am.vog"
	},
	{
		suffix: "org.ma",
		reversed: "am.gro"
	},
	{
		suffix: "ac.ma",
		reversed: "am.ca"
	},
	{
		suffix: "press.ma",
		reversed: "am.sserp"
	},
	{
		suffix: "mc",
		reversed: "cm"
	},
	{
		suffix: "tm.mc",
		reversed: "cm.mt"
	},
	{
		suffix: "asso.mc",
		reversed: "cm.ossa"
	},
	{
		suffix: "md",
		reversed: "dm"
	},
	{
		suffix: "me",
		reversed: "em"
	},
	{
		suffix: "co.me",
		reversed: "em.oc"
	},
	{
		suffix: "net.me",
		reversed: "em.ten"
	},
	{
		suffix: "org.me",
		reversed: "em.gro"
	},
	{
		suffix: "edu.me",
		reversed: "em.ude"
	},
	{
		suffix: "ac.me",
		reversed: "em.ca"
	},
	{
		suffix: "gov.me",
		reversed: "em.vog"
	},
	{
		suffix: "its.me",
		reversed: "em.sti"
	},
	{
		suffix: "priv.me",
		reversed: "em.virp"
	},
	{
		suffix: "mg",
		reversed: "gm"
	},
	{
		suffix: "org.mg",
		reversed: "gm.gro"
	},
	{
		suffix: "nom.mg",
		reversed: "gm.mon"
	},
	{
		suffix: "gov.mg",
		reversed: "gm.vog"
	},
	{
		suffix: "prd.mg",
		reversed: "gm.drp"
	},
	{
		suffix: "tm.mg",
		reversed: "gm.mt"
	},
	{
		suffix: "edu.mg",
		reversed: "gm.ude"
	},
	{
		suffix: "mil.mg",
		reversed: "gm.lim"
	},
	{
		suffix: "com.mg",
		reversed: "gm.moc"
	},
	{
		suffix: "co.mg",
		reversed: "gm.oc"
	},
	{
		suffix: "mh",
		reversed: "hm"
	},
	{
		suffix: "mil",
		reversed: "lim"
	},
	{
		suffix: "mk",
		reversed: "km"
	},
	{
		suffix: "com.mk",
		reversed: "km.moc"
	},
	{
		suffix: "org.mk",
		reversed: "km.gro"
	},
	{
		suffix: "net.mk",
		reversed: "km.ten"
	},
	{
		suffix: "edu.mk",
		reversed: "km.ude"
	},
	{
		suffix: "gov.mk",
		reversed: "km.vog"
	},
	{
		suffix: "inf.mk",
		reversed: "km.fni"
	},
	{
		suffix: "name.mk",
		reversed: "km.eman"
	},
	{
		suffix: "ml",
		reversed: "lm"
	},
	{
		suffix: "com.ml",
		reversed: "lm.moc"
	},
	{
		suffix: "edu.ml",
		reversed: "lm.ude"
	},
	{
		suffix: "gouv.ml",
		reversed: "lm.vuog"
	},
	{
		suffix: "gov.ml",
		reversed: "lm.vog"
	},
	{
		suffix: "net.ml",
		reversed: "lm.ten"
	},
	{
		suffix: "org.ml",
		reversed: "lm.gro"
	},
	{
		suffix: "presse.ml",
		reversed: "lm.esserp"
	},
	{
		suffix: "*.mm",
		reversed: "mm"
	},
	{
		suffix: "mn",
		reversed: "nm"
	},
	{
		suffix: "gov.mn",
		reversed: "nm.vog"
	},
	{
		suffix: "edu.mn",
		reversed: "nm.ude"
	},
	{
		suffix: "org.mn",
		reversed: "nm.gro"
	},
	{
		suffix: "mo",
		reversed: "om"
	},
	{
		suffix: "com.mo",
		reversed: "om.moc"
	},
	{
		suffix: "net.mo",
		reversed: "om.ten"
	},
	{
		suffix: "org.mo",
		reversed: "om.gro"
	},
	{
		suffix: "edu.mo",
		reversed: "om.ude"
	},
	{
		suffix: "gov.mo",
		reversed: "om.vog"
	},
	{
		suffix: "mobi",
		reversed: "ibom"
	},
	{
		suffix: "mp",
		reversed: "pm"
	},
	{
		suffix: "mq",
		reversed: "qm"
	},
	{
		suffix: "mr",
		reversed: "rm"
	},
	{
		suffix: "gov.mr",
		reversed: "rm.vog"
	},
	{
		suffix: "ms",
		reversed: "sm"
	},
	{
		suffix: "com.ms",
		reversed: "sm.moc"
	},
	{
		suffix: "edu.ms",
		reversed: "sm.ude"
	},
	{
		suffix: "gov.ms",
		reversed: "sm.vog"
	},
	{
		suffix: "net.ms",
		reversed: "sm.ten"
	},
	{
		suffix: "org.ms",
		reversed: "sm.gro"
	},
	{
		suffix: "mt",
		reversed: "tm"
	},
	{
		suffix: "com.mt",
		reversed: "tm.moc"
	},
	{
		suffix: "edu.mt",
		reversed: "tm.ude"
	},
	{
		suffix: "net.mt",
		reversed: "tm.ten"
	},
	{
		suffix: "org.mt",
		reversed: "tm.gro"
	},
	{
		suffix: "mu",
		reversed: "um"
	},
	{
		suffix: "com.mu",
		reversed: "um.moc"
	},
	{
		suffix: "net.mu",
		reversed: "um.ten"
	},
	{
		suffix: "org.mu",
		reversed: "um.gro"
	},
	{
		suffix: "gov.mu",
		reversed: "um.vog"
	},
	{
		suffix: "ac.mu",
		reversed: "um.ca"
	},
	{
		suffix: "co.mu",
		reversed: "um.oc"
	},
	{
		suffix: "or.mu",
		reversed: "um.ro"
	},
	{
		suffix: "museum",
		reversed: "muesum"
	},
	{
		suffix: "mv",
		reversed: "vm"
	},
	{
		suffix: "aero.mv",
		reversed: "vm.orea"
	},
	{
		suffix: "biz.mv",
		reversed: "vm.zib"
	},
	{
		suffix: "com.mv",
		reversed: "vm.moc"
	},
	{
		suffix: "coop.mv",
		reversed: "vm.pooc"
	},
	{
		suffix: "edu.mv",
		reversed: "vm.ude"
	},
	{
		suffix: "gov.mv",
		reversed: "vm.vog"
	},
	{
		suffix: "info.mv",
		reversed: "vm.ofni"
	},
	{
		suffix: "int.mv",
		reversed: "vm.tni"
	},
	{
		suffix: "mil.mv",
		reversed: "vm.lim"
	},
	{
		suffix: "museum.mv",
		reversed: "vm.muesum"
	},
	{
		suffix: "name.mv",
		reversed: "vm.eman"
	},
	{
		suffix: "net.mv",
		reversed: "vm.ten"
	},
	{
		suffix: "org.mv",
		reversed: "vm.gro"
	},
	{
		suffix: "pro.mv",
		reversed: "vm.orp"
	},
	{
		suffix: "mw",
		reversed: "wm"
	},
	{
		suffix: "ac.mw",
		reversed: "wm.ca"
	},
	{
		suffix: "biz.mw",
		reversed: "wm.zib"
	},
	{
		suffix: "co.mw",
		reversed: "wm.oc"
	},
	{
		suffix: "com.mw",
		reversed: "wm.moc"
	},
	{
		suffix: "coop.mw",
		reversed: "wm.pooc"
	},
	{
		suffix: "edu.mw",
		reversed: "wm.ude"
	},
	{
		suffix: "gov.mw",
		reversed: "wm.vog"
	},
	{
		suffix: "int.mw",
		reversed: "wm.tni"
	},
	{
		suffix: "museum.mw",
		reversed: "wm.muesum"
	},
	{
		suffix: "net.mw",
		reversed: "wm.ten"
	},
	{
		suffix: "org.mw",
		reversed: "wm.gro"
	},
	{
		suffix: "mx",
		reversed: "xm"
	},
	{
		suffix: "com.mx",
		reversed: "xm.moc"
	},
	{
		suffix: "org.mx",
		reversed: "xm.gro"
	},
	{
		suffix: "gob.mx",
		reversed: "xm.bog"
	},
	{
		suffix: "edu.mx",
		reversed: "xm.ude"
	},
	{
		suffix: "net.mx",
		reversed: "xm.ten"
	},
	{
		suffix: "my",
		reversed: "ym"
	},
	{
		suffix: "biz.my",
		reversed: "ym.zib"
	},
	{
		suffix: "com.my",
		reversed: "ym.moc"
	},
	{
		suffix: "edu.my",
		reversed: "ym.ude"
	},
	{
		suffix: "gov.my",
		reversed: "ym.vog"
	},
	{
		suffix: "mil.my",
		reversed: "ym.lim"
	},
	{
		suffix: "name.my",
		reversed: "ym.eman"
	},
	{
		suffix: "net.my",
		reversed: "ym.ten"
	},
	{
		suffix: "org.my",
		reversed: "ym.gro"
	},
	{
		suffix: "mz",
		reversed: "zm"
	},
	{
		suffix: "ac.mz",
		reversed: "zm.ca"
	},
	{
		suffix: "adv.mz",
		reversed: "zm.vda"
	},
	{
		suffix: "co.mz",
		reversed: "zm.oc"
	},
	{
		suffix: "edu.mz",
		reversed: "zm.ude"
	},
	{
		suffix: "gov.mz",
		reversed: "zm.vog"
	},
	{
		suffix: "mil.mz",
		reversed: "zm.lim"
	},
	{
		suffix: "net.mz",
		reversed: "zm.ten"
	},
	{
		suffix: "org.mz",
		reversed: "zm.gro"
	},
	{
		suffix: "na",
		reversed: "an"
	},
	{
		suffix: "info.na",
		reversed: "an.ofni"
	},
	{
		suffix: "pro.na",
		reversed: "an.orp"
	},
	{
		suffix: "name.na",
		reversed: "an.eman"
	},
	{
		suffix: "school.na",
		reversed: "an.loohcs"
	},
	{
		suffix: "or.na",
		reversed: "an.ro"
	},
	{
		suffix: "dr.na",
		reversed: "an.rd"
	},
	{
		suffix: "us.na",
		reversed: "an.su"
	},
	{
		suffix: "mx.na",
		reversed: "an.xm"
	},
	{
		suffix: "ca.na",
		reversed: "an.ac"
	},
	{
		suffix: "in.na",
		reversed: "an.ni"
	},
	{
		suffix: "cc.na",
		reversed: "an.cc"
	},
	{
		suffix: "tv.na",
		reversed: "an.vt"
	},
	{
		suffix: "ws.na",
		reversed: "an.sw"
	},
	{
		suffix: "mobi.na",
		reversed: "an.ibom"
	},
	{
		suffix: "co.na",
		reversed: "an.oc"
	},
	{
		suffix: "com.na",
		reversed: "an.moc"
	},
	{
		suffix: "org.na",
		reversed: "an.gro"
	},
	{
		suffix: "name",
		reversed: "eman"
	},
	{
		suffix: "nc",
		reversed: "cn"
	},
	{
		suffix: "asso.nc",
		reversed: "cn.ossa"
	},
	{
		suffix: "nom.nc",
		reversed: "cn.mon"
	},
	{
		suffix: "ne",
		reversed: "en"
	},
	{
		suffix: "net",
		reversed: "ten"
	},
	{
		suffix: "nf",
		reversed: "fn"
	},
	{
		suffix: "com.nf",
		reversed: "fn.moc"
	},
	{
		suffix: "net.nf",
		reversed: "fn.ten"
	},
	{
		suffix: "per.nf",
		reversed: "fn.rep"
	},
	{
		suffix: "rec.nf",
		reversed: "fn.cer"
	},
	{
		suffix: "web.nf",
		reversed: "fn.bew"
	},
	{
		suffix: "arts.nf",
		reversed: "fn.stra"
	},
	{
		suffix: "firm.nf",
		reversed: "fn.mrif"
	},
	{
		suffix: "info.nf",
		reversed: "fn.ofni"
	},
	{
		suffix: "other.nf",
		reversed: "fn.rehto"
	},
	{
		suffix: "store.nf",
		reversed: "fn.erots"
	},
	{
		suffix: "ng",
		reversed: "gn"
	},
	{
		suffix: "com.ng",
		reversed: "gn.moc"
	},
	{
		suffix: "edu.ng",
		reversed: "gn.ude"
	},
	{
		suffix: "gov.ng",
		reversed: "gn.vog"
	},
	{
		suffix: "i.ng",
		reversed: "gn.i"
	},
	{
		suffix: "mil.ng",
		reversed: "gn.lim"
	},
	{
		suffix: "mobi.ng",
		reversed: "gn.ibom"
	},
	{
		suffix: "name.ng",
		reversed: "gn.eman"
	},
	{
		suffix: "net.ng",
		reversed: "gn.ten"
	},
	{
		suffix: "org.ng",
		reversed: "gn.gro"
	},
	{
		suffix: "sch.ng",
		reversed: "gn.hcs"
	},
	{
		suffix: "ni",
		reversed: "in"
	},
	{
		suffix: "ac.ni",
		reversed: "in.ca"
	},
	{
		suffix: "biz.ni",
		reversed: "in.zib"
	},
	{
		suffix: "co.ni",
		reversed: "in.oc"
	},
	{
		suffix: "com.ni",
		reversed: "in.moc"
	},
	{
		suffix: "edu.ni",
		reversed: "in.ude"
	},
	{
		suffix: "gob.ni",
		reversed: "in.bog"
	},
	{
		suffix: "in.ni",
		reversed: "in.ni"
	},
	{
		suffix: "info.ni",
		reversed: "in.ofni"
	},
	{
		suffix: "int.ni",
		reversed: "in.tni"
	},
	{
		suffix: "mil.ni",
		reversed: "in.lim"
	},
	{
		suffix: "net.ni",
		reversed: "in.ten"
	},
	{
		suffix: "nom.ni",
		reversed: "in.mon"
	},
	{
		suffix: "org.ni",
		reversed: "in.gro"
	},
	{
		suffix: "web.ni",
		reversed: "in.bew"
	},
	{
		suffix: "nl",
		reversed: "ln"
	},
	{
		suffix: "no",
		reversed: "on"
	},
	{
		suffix: "fhs.no",
		reversed: "on.shf"
	},
	{
		suffix: "vgs.no",
		reversed: "on.sgv"
	},
	{
		suffix: "fylkesbibl.no",
		reversed: "on.lbibseklyf"
	},
	{
		suffix: "folkebibl.no",
		reversed: "on.lbibeklof"
	},
	{
		suffix: "museum.no",
		reversed: "on.muesum"
	},
	{
		suffix: "idrett.no",
		reversed: "on.tterdi"
	},
	{
		suffix: "priv.no",
		reversed: "on.virp"
	},
	{
		suffix: "mil.no",
		reversed: "on.lim"
	},
	{
		suffix: "stat.no",
		reversed: "on.tats"
	},
	{
		suffix: "dep.no",
		reversed: "on.ped"
	},
	{
		suffix: "kommune.no",
		reversed: "on.enummok"
	},
	{
		suffix: "herad.no",
		reversed: "on.dareh"
	},
	{
		suffix: "aa.no",
		reversed: "on.aa"
	},
	{
		suffix: "ah.no",
		reversed: "on.ha"
	},
	{
		suffix: "bu.no",
		reversed: "on.ub"
	},
	{
		suffix: "fm.no",
		reversed: "on.mf"
	},
	{
		suffix: "hl.no",
		reversed: "on.lh"
	},
	{
		suffix: "hm.no",
		reversed: "on.mh"
	},
	{
		suffix: "jan-mayen.no",
		reversed: "on.neyam-naj"
	},
	{
		suffix: "mr.no",
		reversed: "on.rm"
	},
	{
		suffix: "nl.no",
		reversed: "on.ln"
	},
	{
		suffix: "nt.no",
		reversed: "on.tn"
	},
	{
		suffix: "of.no",
		reversed: "on.fo"
	},
	{
		suffix: "ol.no",
		reversed: "on.lo"
	},
	{
		suffix: "oslo.no",
		reversed: "on.olso"
	},
	{
		suffix: "rl.no",
		reversed: "on.lr"
	},
	{
		suffix: "sf.no",
		reversed: "on.fs"
	},
	{
		suffix: "st.no",
		reversed: "on.ts"
	},
	{
		suffix: "svalbard.no",
		reversed: "on.drablavs"
	},
	{
		suffix: "tm.no",
		reversed: "on.mt"
	},
	{
		suffix: "tr.no",
		reversed: "on.rt"
	},
	{
		suffix: "va.no",
		reversed: "on.av"
	},
	{
		suffix: "vf.no",
		reversed: "on.fv"
	},
	{
		suffix: "gs.aa.no",
		reversed: "on.aa.sg"
	},
	{
		suffix: "gs.ah.no",
		reversed: "on.ha.sg"
	},
	{
		suffix: "gs.bu.no",
		reversed: "on.ub.sg"
	},
	{
		suffix: "gs.fm.no",
		reversed: "on.mf.sg"
	},
	{
		suffix: "gs.hl.no",
		reversed: "on.lh.sg"
	},
	{
		suffix: "gs.hm.no",
		reversed: "on.mh.sg"
	},
	{
		suffix: "gs.jan-mayen.no",
		reversed: "on.neyam-naj.sg"
	},
	{
		suffix: "gs.mr.no",
		reversed: "on.rm.sg"
	},
	{
		suffix: "gs.nl.no",
		reversed: "on.ln.sg"
	},
	{
		suffix: "gs.nt.no",
		reversed: "on.tn.sg"
	},
	{
		suffix: "gs.of.no",
		reversed: "on.fo.sg"
	},
	{
		suffix: "gs.ol.no",
		reversed: "on.lo.sg"
	},
	{
		suffix: "gs.oslo.no",
		reversed: "on.olso.sg"
	},
	{
		suffix: "gs.rl.no",
		reversed: "on.lr.sg"
	},
	{
		suffix: "gs.sf.no",
		reversed: "on.fs.sg"
	},
	{
		suffix: "gs.st.no",
		reversed: "on.ts.sg"
	},
	{
		suffix: "gs.svalbard.no",
		reversed: "on.drablavs.sg"
	},
	{
		suffix: "gs.tm.no",
		reversed: "on.mt.sg"
	},
	{
		suffix: "gs.tr.no",
		reversed: "on.rt.sg"
	},
	{
		suffix: "gs.va.no",
		reversed: "on.av.sg"
	},
	{
		suffix: "gs.vf.no",
		reversed: "on.fv.sg"
	},
	{
		suffix: "akrehamn.no",
		reversed: "on.nmaherka"
	},
	{
		suffix: "åkrehamn.no",
		reversed: "on.axd-nmaherk--nx"
	},
	{
		suffix: "algard.no",
		reversed: "on.dragla"
	},
	{
		suffix: "ålgård.no",
		reversed: "on.caop-drgl--nx"
	},
	{
		suffix: "arna.no",
		reversed: "on.anra"
	},
	{
		suffix: "brumunddal.no",
		reversed: "on.laddnumurb"
	},
	{
		suffix: "bryne.no",
		reversed: "on.enyrb"
	},
	{
		suffix: "bronnoysund.no",
		reversed: "on.dnusyonnorb"
	},
	{
		suffix: "brønnøysund.no",
		reversed: "on.ca8m-dnusynnrb--nx"
	},
	{
		suffix: "drobak.no",
		reversed: "on.kabord"
	},
	{
		suffix: "drøbak.no",
		reversed: "on.auw-kabrd--nx"
	},
	{
		suffix: "egersund.no",
		reversed: "on.dnusrege"
	},
	{
		suffix: "fetsund.no",
		reversed: "on.dnustef"
	},
	{
		suffix: "floro.no",
		reversed: "on.orolf"
	},
	{
		suffix: "florø.no",
		reversed: "on.arj-rolf--nx"
	},
	{
		suffix: "fredrikstad.no",
		reversed: "on.datskirderf"
	},
	{
		suffix: "hokksund.no",
		reversed: "on.dnuskkoh"
	},
	{
		suffix: "honefoss.no",
		reversed: "on.ssofenoh"
	},
	{
		suffix: "hønefoss.no",
		reversed: "on.a1q-ssofenh--nx"
	},
	{
		suffix: "jessheim.no",
		reversed: "on.miehssej"
	},
	{
		suffix: "jorpeland.no",
		reversed: "on.dnaleproj"
	},
	{
		suffix: "jørpeland.no",
		reversed: "on.a45-dnaleprj--nx"
	},
	{
		suffix: "kirkenes.no",
		reversed: "on.senekrik"
	},
	{
		suffix: "kopervik.no",
		reversed: "on.kivrepok"
	},
	{
		suffix: "krokstadelva.no",
		reversed: "on.avledatskork"
	},
	{
		suffix: "langevag.no",
		reversed: "on.gavegnal"
	},
	{
		suffix: "langevåg.no",
		reversed: "on.axj-gvegnal--nx"
	},
	{
		suffix: "leirvik.no",
		reversed: "on.kivriel"
	},
	{
		suffix: "mjondalen.no",
		reversed: "on.neladnojm"
	},
	{
		suffix: "mjøndalen.no",
		reversed: "on.a46-neladnjm--nx"
	},
	{
		suffix: "mo-i-rana.no",
		reversed: "on.anar-i-om"
	},
	{
		suffix: "mosjoen.no",
		reversed: "on.neojsom"
	},
	{
		suffix: "mosjøen.no",
		reversed: "on.aye-nejsom--nx"
	},
	{
		suffix: "nesoddtangen.no",
		reversed: "on.negnatddosen"
	},
	{
		suffix: "orkanger.no",
		reversed: "on.regnakro"
	},
	{
		suffix: "osoyro.no",
		reversed: "on.oryoso"
	},
	{
		suffix: "osøyro.no",
		reversed: "on.auw-oryso--nx"
	},
	{
		suffix: "raholt.no",
		reversed: "on.tlohar"
	},
	{
		suffix: "råholt.no",
		reversed: "on.arm-tlohr--nx"
	},
	{
		suffix: "sandnessjoen.no",
		reversed: "on.neojssendnas"
	},
	{
		suffix: "sandnessjøen.no",
		reversed: "on.bgo-nejssendnas--nx"
	},
	{
		suffix: "skedsmokorset.no",
		reversed: "on.tesrokomsdeks"
	},
	{
		suffix: "slattum.no",
		reversed: "on.muttals"
	},
	{
		suffix: "spjelkavik.no",
		reversed: "on.kivaklejps"
	},
	{
		suffix: "stathelle.no",
		reversed: "on.ellehtats"
	},
	{
		suffix: "stavern.no",
		reversed: "on.nrevats"
	},
	{
		suffix: "stjordalshalsen.no",
		reversed: "on.neslahsladrojts"
	},
	{
		suffix: "stjørdalshalsen.no",
		reversed: "on.bqs-neslahsladrjts--nx"
	},
	{
		suffix: "tananger.no",
		reversed: "on.regnanat"
	},
	{
		suffix: "tranby.no",
		reversed: "on.ybnart"
	},
	{
		suffix: "vossevangen.no",
		reversed: "on.negnavessov"
	},
	{
		suffix: "afjord.no",
		reversed: "on.drojfa"
	},
	{
		suffix: "åfjord.no",
		reversed: "on.arl-drojf--nx"
	},
	{
		suffix: "agdenes.no",
		reversed: "on.senedga"
	},
	{
		suffix: "al.no",
		reversed: "on.la"
	},
	{
		suffix: "ål.no",
		reversed: "on.af1-l--nx"
	},
	{
		suffix: "alesund.no",
		reversed: "on.dnusela"
	},
	{
		suffix: "ålesund.no",
		reversed: "on.auh-dnusel--nx"
	},
	{
		suffix: "alstahaug.no",
		reversed: "on.guahatsla"
	},
	{
		suffix: "alta.no",
		reversed: "on.atla"
	},
	{
		suffix: "áltá.no",
		reversed: "on.cail-tl--nx"
	},
	{
		suffix: "alaheadju.no",
		reversed: "on.ujdaehala"
	},
	{
		suffix: "álaheadju.no",
		reversed: "on.ay7-ujdaehal--nx"
	},
	{
		suffix: "alvdal.no",
		reversed: "on.ladvla"
	},
	{
		suffix: "amli.no",
		reversed: "on.ilma"
	},
	{
		suffix: "åmli.no",
		reversed: "on.alt-ilm--nx"
	},
	{
		suffix: "amot.no",
		reversed: "on.toma"
	},
	{
		suffix: "åmot.no",
		reversed: "on.alt-tom--nx"
	},
	{
		suffix: "andebu.no",
		reversed: "on.ubedna"
	},
	{
		suffix: "andoy.no",
		reversed: "on.yodna"
	},
	{
		suffix: "andøy.no",
		reversed: "on.ari-ydna--nx"
	},
	{
		suffix: "andasuolo.no",
		reversed: "on.olousadna"
	},
	{
		suffix: "ardal.no",
		reversed: "on.ladra"
	},
	{
		suffix: "årdal.no",
		reversed: "on.aop-ladr--nx"
	},
	{
		suffix: "aremark.no",
		reversed: "on.kramera"
	},
	{
		suffix: "arendal.no",
		reversed: "on.ladnera"
	},
	{
		suffix: "ås.no",
		reversed: "on.af1-s--nx"
	},
	{
		suffix: "aseral.no",
		reversed: "on.laresa"
	},
	{
		suffix: "åseral.no",
		reversed: "on.arl-lares--nx"
	},
	{
		suffix: "asker.no",
		reversed: "on.reksa"
	},
	{
		suffix: "askim.no",
		reversed: "on.miksa"
	},
	{
		suffix: "askvoll.no",
		reversed: "on.llovksa"
	},
	{
		suffix: "askoy.no",
		reversed: "on.yoksa"
	},
	{
		suffix: "askøy.no",
		reversed: "on.ari-yksa--nx"
	},
	{
		suffix: "asnes.no",
		reversed: "on.sensa"
	},
	{
		suffix: "åsnes.no",
		reversed: "on.aop-sens--nx"
	},
	{
		suffix: "audnedaln.no",
		reversed: "on.nladendua"
	},
	{
		suffix: "aukra.no",
		reversed: "on.arkua"
	},
	{
		suffix: "aure.no",
		reversed: "on.erua"
	},
	{
		suffix: "aurland.no",
		reversed: "on.dnalrua"
	},
	{
		suffix: "aurskog-holand.no",
		reversed: "on.dnaloh-goksrua"
	},
	{
		suffix: "aurskog-høland.no",
		reversed: "on.bnj-dnalh-goksrua--nx"
	},
	{
		suffix: "austevoll.no",
		reversed: "on.llovetsua"
	},
	{
		suffix: "austrheim.no",
		reversed: "on.miehrtsua"
	},
	{
		suffix: "averoy.no",
		reversed: "on.yoreva"
	},
	{
		suffix: "averøy.no",
		reversed: "on.auy-yreva--nx"
	},
	{
		suffix: "balestrand.no",
		reversed: "on.dnartselab"
	},
	{
		suffix: "ballangen.no",
		reversed: "on.negnallab"
	},
	{
		suffix: "balat.no",
		reversed: "on.talab"
	},
	{
		suffix: "bálát.no",
		reversed: "on.bale-tlb--nx"
	},
	{
		suffix: "balsfjord.no",
		reversed: "on.drojfslab"
	},
	{
		suffix: "bahccavuotna.no",
		reversed: "on.antouvacchab"
	},
	{
		suffix: "báhccavuotna.no",
		reversed: "on.a7k-antouvacchb--nx"
	},
	{
		suffix: "bamble.no",
		reversed: "on.elbmab"
	},
	{
		suffix: "bardu.no",
		reversed: "on.udrab"
	},
	{
		suffix: "beardu.no",
		reversed: "on.udraeb"
	},
	{
		suffix: "beiarn.no",
		reversed: "on.nraieb"
	},
	{
		suffix: "bajddar.no",
		reversed: "on.raddjab"
	},
	{
		suffix: "bájddar.no",
		reversed: "on.atp-raddjb--nx"
	},
	{
		suffix: "baidar.no",
		reversed: "on.radiab"
	},
	{
		suffix: "báidár.no",
		reversed: "on.can5-rdib--nx"
	},
	{
		suffix: "berg.no",
		reversed: "on.greb"
	},
	{
		suffix: "bergen.no",
		reversed: "on.negreb"
	},
	{
		suffix: "berlevag.no",
		reversed: "on.gavelreb"
	},
	{
		suffix: "berlevåg.no",
		reversed: "on.axj-gvelreb--nx"
	},
	{
		suffix: "bearalvahki.no",
		reversed: "on.ikhavlaraeb"
	},
	{
		suffix: "bearalváhki.no",
		reversed: "on.a4y-ikhvlaraeb--nx"
	},
	{
		suffix: "bindal.no",
		reversed: "on.ladnib"
	},
	{
		suffix: "birkenes.no",
		reversed: "on.senekrib"
	},
	{
		suffix: "bjarkoy.no",
		reversed: "on.yokrajb"
	},
	{
		suffix: "bjarkøy.no",
		reversed: "on.ayf-ykrajb--nx"
	},
	{
		suffix: "bjerkreim.no",
		reversed: "on.mierkrejb"
	},
	{
		suffix: "bjugn.no",
		reversed: "on.ngujb"
	},
	{
		suffix: "bodo.no",
		reversed: "on.odob"
	},
	{
		suffix: "bodø.no",
		reversed: "on.an2-dob--nx"
	},
	{
		suffix: "badaddja.no",
		reversed: "on.ajddadab"
	},
	{
		suffix: "bådåddjå.no",
		reversed: "on.dbarm-jdddb--nx"
	},
	{
		suffix: "budejju.no",
		reversed: "on.ujjedub"
	},
	{
		suffix: "bokn.no",
		reversed: "on.nkob"
	},
	{
		suffix: "bremanger.no",
		reversed: "on.regnamerb"
	},
	{
		suffix: "bronnoy.no",
		reversed: "on.yonnorb"
	},
	{
		suffix: "brønnøy.no",
		reversed: "on.cauw-ynnrb--nx"
	},
	{
		suffix: "bygland.no",
		reversed: "on.dnalgyb"
	},
	{
		suffix: "bykle.no",
		reversed: "on.elkyb"
	},
	{
		suffix: "barum.no",
		reversed: "on.murab"
	},
	{
		suffix: "bærum.no",
		reversed: "on.aov-murb--nx"
	},
	{
		suffix: "bo.telemark.no",
		reversed: "on.kramelet.ob"
	},
	{
		suffix: "bø.telemark.no",
		reversed: "on.kramelet.ag5-b--nx"
	},
	{
		suffix: "bo.nordland.no",
		reversed: "on.dnaldron.ob"
	},
	{
		suffix: "bø.nordland.no",
		reversed: "on.dnaldron.ag5-b--nx"
	},
	{
		suffix: "bievat.no",
		reversed: "on.taveib"
	},
	{
		suffix: "bievát.no",
		reversed: "on.aq0-tveib--nx"
	},
	{
		suffix: "bomlo.no",
		reversed: "on.olmob"
	},
	{
		suffix: "bømlo.no",
		reversed: "on.arg-olmb--nx"
	},
	{
		suffix: "batsfjord.no",
		reversed: "on.drojfstab"
	},
	{
		suffix: "båtsfjord.no",
		reversed: "on.az9-drojfstb--nx"
	},
	{
		suffix: "bahcavuotna.no",
		reversed: "on.antouvachab"
	},
	{
		suffix: "báhcavuotna.no",
		reversed: "on.a4s-antouvachb--nx"
	},
	{
		suffix: "dovre.no",
		reversed: "on.ervod"
	},
	{
		suffix: "drammen.no",
		reversed: "on.nemmard"
	},
	{
		suffix: "drangedal.no",
		reversed: "on.ladegnard"
	},
	{
		suffix: "dyroy.no",
		reversed: "on.yoryd"
	},
	{
		suffix: "dyrøy.no",
		reversed: "on.ari-yryd--nx"
	},
	{
		suffix: "donna.no",
		reversed: "on.annod"
	},
	{
		suffix: "dønna.no",
		reversed: "on.arg-annd--nx"
	},
	{
		suffix: "eid.no",
		reversed: "on.die"
	},
	{
		suffix: "eidfjord.no",
		reversed: "on.drojfdie"
	},
	{
		suffix: "eidsberg.no",
		reversed: "on.grebsdie"
	},
	{
		suffix: "eidskog.no",
		reversed: "on.goksdie"
	},
	{
		suffix: "eidsvoll.no",
		reversed: "on.llovsdie"
	},
	{
		suffix: "eigersund.no",
		reversed: "on.dnusregie"
	},
	{
		suffix: "elverum.no",
		reversed: "on.murevle"
	},
	{
		suffix: "enebakk.no",
		reversed: "on.kkabene"
	},
	{
		suffix: "engerdal.no",
		reversed: "on.ladregne"
	},
	{
		suffix: "etne.no",
		reversed: "on.ente"
	},
	{
		suffix: "etnedal.no",
		reversed: "on.ladente"
	},
	{
		suffix: "evenes.no",
		reversed: "on.seneve"
	},
	{
		suffix: "evenassi.no",
		reversed: "on.issaneve"
	},
	{
		suffix: "evenášši.no",
		reversed: "on.ag10aq0-ineve--nx"
	},
	{
		suffix: "evje-og-hornnes.no",
		reversed: "on.sennroh-go-ejve"
	},
	{
		suffix: "farsund.no",
		reversed: "on.dnusraf"
	},
	{
		suffix: "fauske.no",
		reversed: "on.eksuaf"
	},
	{
		suffix: "fuossko.no",
		reversed: "on.okssouf"
	},
	{
		suffix: "fuoisku.no",
		reversed: "on.uksiouf"
	},
	{
		suffix: "fedje.no",
		reversed: "on.ejdef"
	},
	{
		suffix: "fet.no",
		reversed: "on.tef"
	},
	{
		suffix: "finnoy.no",
		reversed: "on.yonnif"
	},
	{
		suffix: "finnøy.no",
		reversed: "on.auy-ynnif--nx"
	},
	{
		suffix: "fitjar.no",
		reversed: "on.rajtif"
	},
	{
		suffix: "fjaler.no",
		reversed: "on.relajf"
	},
	{
		suffix: "fjell.no",
		reversed: "on.llejf"
	},
	{
		suffix: "flakstad.no",
		reversed: "on.datskalf"
	},
	{
		suffix: "flatanger.no",
		reversed: "on.regnatalf"
	},
	{
		suffix: "flekkefjord.no",
		reversed: "on.drojfekkelf"
	},
	{
		suffix: "flesberg.no",
		reversed: "on.grebself"
	},
	{
		suffix: "flora.no",
		reversed: "on.arolf"
	},
	{
		suffix: "fla.no",
		reversed: "on.alf"
	},
	{
		suffix: "flå.no",
		reversed: "on.aiz-lf--nx"
	},
	{
		suffix: "folldal.no",
		reversed: "on.ladllof"
	},
	{
		suffix: "forsand.no",
		reversed: "on.dnasrof"
	},
	{
		suffix: "fosnes.no",
		reversed: "on.sensof"
	},
	{
		suffix: "frei.no",
		reversed: "on.ierf"
	},
	{
		suffix: "frogn.no",
		reversed: "on.ngorf"
	},
	{
		suffix: "froland.no",
		reversed: "on.dnalorf"
	},
	{
		suffix: "frosta.no",
		reversed: "on.atsorf"
	},
	{
		suffix: "frana.no",
		reversed: "on.anarf"
	},
	{
		suffix: "fræna.no",
		reversed: "on.aow-anrf--nx"
	},
	{
		suffix: "froya.no",
		reversed: "on.ayorf"
	},
	{
		suffix: "frøya.no",
		reversed: "on.arh-ayrf--nx"
	},
	{
		suffix: "fusa.no",
		reversed: "on.asuf"
	},
	{
		suffix: "fyresdal.no",
		reversed: "on.ladseryf"
	},
	{
		suffix: "forde.no",
		reversed: "on.edrof"
	},
	{
		suffix: "førde.no",
		reversed: "on.arg-edrf--nx"
	},
	{
		suffix: "gamvik.no",
		reversed: "on.kivmag"
	},
	{
		suffix: "gangaviika.no",
		reversed: "on.akiivagnag"
	},
	{
		suffix: "gáŋgaviika.no",
		reversed: "on.h74ay8-akiivagg--nx"
	},
	{
		suffix: "gaular.no",
		reversed: "on.raluag"
	},
	{
		suffix: "gausdal.no",
		reversed: "on.ladsuag"
	},
	{
		suffix: "gildeskal.no",
		reversed: "on.laksedlig"
	},
	{
		suffix: "gildeskål.no",
		reversed: "on.a0g-lksedlig--nx"
	},
	{
		suffix: "giske.no",
		reversed: "on.eksig"
	},
	{
		suffix: "gjemnes.no",
		reversed: "on.senmejg"
	},
	{
		suffix: "gjerdrum.no",
		reversed: "on.murdrejg"
	},
	{
		suffix: "gjerstad.no",
		reversed: "on.datsrejg"
	},
	{
		suffix: "gjesdal.no",
		reversed: "on.ladsejg"
	},
	{
		suffix: "gjovik.no",
		reversed: "on.kivojg"
	},
	{
		suffix: "gjøvik.no",
		reversed: "on.auw-kivjg--nx"
	},
	{
		suffix: "gloppen.no",
		reversed: "on.neppolg"
	},
	{
		suffix: "gol.no",
		reversed: "on.log"
	},
	{
		suffix: "gran.no",
		reversed: "on.narg"
	},
	{
		suffix: "grane.no",
		reversed: "on.enarg"
	},
	{
		suffix: "granvin.no",
		reversed: "on.nivnarg"
	},
	{
		suffix: "gratangen.no",
		reversed: "on.negnatarg"
	},
	{
		suffix: "grimstad.no",
		reversed: "on.datsmirg"
	},
	{
		suffix: "grong.no",
		reversed: "on.gnorg"
	},
	{
		suffix: "kraanghke.no",
		reversed: "on.ekhgnaark"
	},
	{
		suffix: "kråanghke.no",
		reversed: "on.a0b-ekhgnark--nx"
	},
	{
		suffix: "grue.no",
		reversed: "on.eurg"
	},
	{
		suffix: "gulen.no",
		reversed: "on.nelug"
	},
	{
		suffix: "hadsel.no",
		reversed: "on.lesdah"
	},
	{
		suffix: "halden.no",
		reversed: "on.nedlah"
	},
	{
		suffix: "halsa.no",
		reversed: "on.aslah"
	},
	{
		suffix: "hamar.no",
		reversed: "on.ramah"
	},
	{
		suffix: "hamaroy.no",
		reversed: "on.yoramah"
	},
	{
		suffix: "habmer.no",
		reversed: "on.rembah"
	},
	{
		suffix: "hábmer.no",
		reversed: "on.aqx-rembh--nx"
	},
	{
		suffix: "hapmir.no",
		reversed: "on.rimpah"
	},
	{
		suffix: "hápmir.no",
		reversed: "on.aqx-rimph--nx"
	},
	{
		suffix: "hammerfest.no",
		reversed: "on.tsefremmah"
	},
	{
		suffix: "hammarfeasta.no",
		reversed: "on.atsaeframmah"
	},
	{
		suffix: "hámmárfeasta.no",
		reversed: "on.ca4s-atsaefrmmh--nx"
	},
	{
		suffix: "haram.no",
		reversed: "on.marah"
	},
	{
		suffix: "hareid.no",
		reversed: "on.dierah"
	},
	{
		suffix: "harstad.no",
		reversed: "on.datsrah"
	},
	{
		suffix: "hasvik.no",
		reversed: "on.kivsah"
	},
	{
		suffix: "aknoluokta.no",
		reversed: "on.atkoulonka"
	},
	{
		suffix: "ákŋoluokta.no",
		reversed: "on.h75ay7-atkoulok--nx"
	},
	{
		suffix: "hattfjelldal.no",
		reversed: "on.ladllejfttah"
	},
	{
		suffix: "aarborte.no",
		reversed: "on.etrobraa"
	},
	{
		suffix: "haugesund.no",
		reversed: "on.dnuseguah"
	},
	{
		suffix: "hemne.no",
		reversed: "on.enmeh"
	},
	{
		suffix: "hemnes.no",
		reversed: "on.senmeh"
	},
	{
		suffix: "hemsedal.no",
		reversed: "on.ladesmeh"
	},
	{
		suffix: "heroy.more-og-romsdal.no",
		reversed: "on.ladsmor-go-erom.yoreh"
	},
	{
		suffix: "herøy.møre-og-romsdal.no",
		reversed: "on.bqq-ladsmor-go-erm--nx.ari-yreh--nx"
	},
	{
		suffix: "heroy.nordland.no",
		reversed: "on.dnaldron.yoreh"
	},
	{
		suffix: "herøy.nordland.no",
		reversed: "on.dnaldron.ari-yreh--nx"
	},
	{
		suffix: "hitra.no",
		reversed: "on.artih"
	},
	{
		suffix: "hjartdal.no",
		reversed: "on.ladtrajh"
	},
	{
		suffix: "hjelmeland.no",
		reversed: "on.dnalemlejh"
	},
	{
		suffix: "hobol.no",
		reversed: "on.loboh"
	},
	{
		suffix: "hobøl.no",
		reversed: "on.ari-lboh--nx"
	},
	{
		suffix: "hof.no",
		reversed: "on.foh"
	},
	{
		suffix: "hol.no",
		reversed: "on.loh"
	},
	{
		suffix: "hole.no",
		reversed: "on.eloh"
	},
	{
		suffix: "holmestrand.no",
		reversed: "on.dnartsemloh"
	},
	{
		suffix: "holtalen.no",
		reversed: "on.nelatloh"
	},
	{
		suffix: "holtålen.no",
		reversed: "on.axh-neltloh--nx"
	},
	{
		suffix: "hornindal.no",
		reversed: "on.ladninroh"
	},
	{
		suffix: "horten.no",
		reversed: "on.netroh"
	},
	{
		suffix: "hurdal.no",
		reversed: "on.ladruh"
	},
	{
		suffix: "hurum.no",
		reversed: "on.muruh"
	},
	{
		suffix: "hvaler.no",
		reversed: "on.relavh"
	},
	{
		suffix: "hyllestad.no",
		reversed: "on.datsellyh"
	},
	{
		suffix: "hagebostad.no",
		reversed: "on.datsobegah"
	},
	{
		suffix: "hægebostad.no",
		reversed: "on.a3g-datsobegh--nx"
	},
	{
		suffix: "hoyanger.no",
		reversed: "on.regnayoh"
	},
	{
		suffix: "høyanger.no",
		reversed: "on.a1q-regnayh--nx"
	},
	{
		suffix: "hoylandet.no",
		reversed: "on.tednalyoh"
	},
	{
		suffix: "høylandet.no",
		reversed: "on.a45-tednalyh--nx"
	},
	{
		suffix: "ha.no",
		reversed: "on.ah"
	},
	{
		suffix: "hå.no",
		reversed: "on.af2-h--nx"
	},
	{
		suffix: "ibestad.no",
		reversed: "on.datsebi"
	},
	{
		suffix: "inderoy.no",
		reversed: "on.yoredni"
	},
	{
		suffix: "inderøy.no",
		reversed: "on.ayf-yredni--nx"
	},
	{
		suffix: "iveland.no",
		reversed: "on.dnalevi"
	},
	{
		suffix: "jevnaker.no",
		reversed: "on.rekanvej"
	},
	{
		suffix: "jondal.no",
		reversed: "on.ladnoj"
	},
	{
		suffix: "jolster.no",
		reversed: "on.retsloj"
	},
	{
		suffix: "jølster.no",
		reversed: "on.ayb-retslj--nx"
	},
	{
		suffix: "karasjok.no",
		reversed: "on.kojsarak"
	},
	{
		suffix: "karasjohka.no",
		reversed: "on.akhojsarak"
	},
	{
		suffix: "kárášjohka.no",
		reversed: "on.j94bawh-akhojrk--nx"
	},
	{
		suffix: "karlsoy.no",
		reversed: "on.yoslrak"
	},
	{
		suffix: "galsa.no",
		reversed: "on.aslag"
	},
	{
		suffix: "gálsá.no",
		reversed: "on.cale-slg--nx"
	},
	{
		suffix: "karmoy.no",
		reversed: "on.yomrak"
	},
	{
		suffix: "karmøy.no",
		reversed: "on.auy-ymrak--nx"
	},
	{
		suffix: "kautokeino.no",
		reversed: "on.oniekotuak"
	},
	{
		suffix: "guovdageaidnu.no",
		reversed: "on.undiaegadvoug"
	},
	{
		suffix: "klepp.no",
		reversed: "on.ppelk"
	},
	{
		suffix: "klabu.no",
		reversed: "on.ubalk"
	},
	{
		suffix: "klæbu.no",
		reversed: "on.aow-ublk--nx"
	},
	{
		suffix: "kongsberg.no",
		reversed: "on.grebsgnok"
	},
	{
		suffix: "kongsvinger.no",
		reversed: "on.regnivsgnok"
	},
	{
		suffix: "kragero.no",
		reversed: "on.oregark"
	},
	{
		suffix: "kragerø.no",
		reversed: "on.ayg-regark--nx"
	},
	{
		suffix: "kristiansand.no",
		reversed: "on.dnasnaitsirk"
	},
	{
		suffix: "kristiansund.no",
		reversed: "on.dnusnaitsirk"
	},
	{
		suffix: "krodsherad.no",
		reversed: "on.darehsdork"
	},
	{
		suffix: "krødsherad.no",
		reversed: "on.a8m-darehsdrk--nx"
	},
	{
		suffix: "kvalsund.no",
		reversed: "on.dnuslavk"
	},
	{
		suffix: "rahkkeravju.no",
		reversed: "on.ujvarekkhar"
	},
	{
		suffix: "ráhkkerávju.no",
		reversed: "on.fa10-ujvrekkhr--nx"
	},
	{
		suffix: "kvam.no",
		reversed: "on.mavk"
	},
	{
		suffix: "kvinesdal.no",
		reversed: "on.ladsenivk"
	},
	{
		suffix: "kvinnherad.no",
		reversed: "on.darehnnivk"
	},
	{
		suffix: "kviteseid.no",
		reversed: "on.diesetivk"
	},
	{
		suffix: "kvitsoy.no",
		reversed: "on.yostivk"
	},
	{
		suffix: "kvitsøy.no",
		reversed: "on.ayf-ystivk--nx"
	},
	{
		suffix: "kvafjord.no",
		reversed: "on.drojfavk"
	},
	{
		suffix: "kvæfjord.no",
		reversed: "on.axn-drojfvk--nx"
	},
	{
		suffix: "giehtavuoatna.no",
		reversed: "on.antaouvatheig"
	},
	{
		suffix: "kvanangen.no",
		reversed: "on.negnanavk"
	},
	{
		suffix: "kvænangen.no",
		reversed: "on.a0k-negnanvk--nx"
	},
	{
		suffix: "navuotna.no",
		reversed: "on.antouvan"
	},
	{
		suffix: "návuotna.no",
		reversed: "on.awh-antouvn--nx"
	},
	{
		suffix: "kafjord.no",
		reversed: "on.drojfak"
	},
	{
		suffix: "kåfjord.no",
		reversed: "on.aui-drojfk--nx"
	},
	{
		suffix: "gaivuotna.no",
		reversed: "on.antouviag"
	},
	{
		suffix: "gáivuotna.no",
		reversed: "on.ay8-antouvig--nx"
	},
	{
		suffix: "larvik.no",
		reversed: "on.kivral"
	},
	{
		suffix: "lavangen.no",
		reversed: "on.negnaval"
	},
	{
		suffix: "lavagis.no",
		reversed: "on.sigaval"
	},
	{
		suffix: "loabat.no",
		reversed: "on.tabaol"
	},
	{
		suffix: "loabát.no",
		reversed: "on.aq0-tbaol--nx"
	},
	{
		suffix: "lebesby.no",
		reversed: "on.ybsebel"
	},
	{
		suffix: "davvesiida.no",
		reversed: "on.adiisevvad"
	},
	{
		suffix: "leikanger.no",
		reversed: "on.regnakiel"
	},
	{
		suffix: "leirfjord.no",
		reversed: "on.drojfriel"
	},
	{
		suffix: "leka.no",
		reversed: "on.akel"
	},
	{
		suffix: "leksvik.no",
		reversed: "on.kivskel"
	},
	{
		suffix: "lenvik.no",
		reversed: "on.kivnel"
	},
	{
		suffix: "leangaviika.no",
		reversed: "on.akiivagnael"
	},
	{
		suffix: "leaŋgaviika.no",
		reversed: "on.b25-akiivagael--nx"
	},
	{
		suffix: "lesja.no",
		reversed: "on.ajsel"
	},
	{
		suffix: "levanger.no",
		reversed: "on.regnavel"
	},
	{
		suffix: "lier.no",
		reversed: "on.reil"
	},
	{
		suffix: "lierne.no",
		reversed: "on.enreil"
	},
	{
		suffix: "lillehammer.no",
		reversed: "on.remmahellil"
	},
	{
		suffix: "lillesand.no",
		reversed: "on.dnasellil"
	},
	{
		suffix: "lindesnes.no",
		reversed: "on.sensednil"
	},
	{
		suffix: "lindas.no",
		reversed: "on.sadnil"
	},
	{
		suffix: "lindås.no",
		reversed: "on.arp-sdnil--nx"
	},
	{
		suffix: "lom.no",
		reversed: "on.mol"
	},
	{
		suffix: "loppa.no",
		reversed: "on.appol"
	},
	{
		suffix: "lahppi.no",
		reversed: "on.ipphal"
	},
	{
		suffix: "láhppi.no",
		reversed: "on.aqx-ipphl--nx"
	},
	{
		suffix: "lund.no",
		reversed: "on.dnul"
	},
	{
		suffix: "lunner.no",
		reversed: "on.rennul"
	},
	{
		suffix: "luroy.no",
		reversed: "on.yorul"
	},
	{
		suffix: "lurøy.no",
		reversed: "on.ari-yrul--nx"
	},
	{
		suffix: "luster.no",
		reversed: "on.retsul"
	},
	{
		suffix: "lyngdal.no",
		reversed: "on.ladgnyl"
	},
	{
		suffix: "lyngen.no",
		reversed: "on.negnyl"
	},
	{
		suffix: "ivgu.no",
		reversed: "on.ugvi"
	},
	{
		suffix: "lardal.no",
		reversed: "on.ladral"
	},
	{
		suffix: "lerdal.no",
		reversed: "on.ladrel"
	},
	{
		suffix: "lærdal.no",
		reversed: "on.ars-ladrl--nx"
	},
	{
		suffix: "lodingen.no",
		reversed: "on.negnidol"
	},
	{
		suffix: "lødingen.no",
		reversed: "on.a1q-negnidl--nx"
	},
	{
		suffix: "lorenskog.no",
		reversed: "on.goksnerol"
	},
	{
		suffix: "lørenskog.no",
		reversed: "on.a45-goksnerl--nx"
	},
	{
		suffix: "loten.no",
		reversed: "on.netol"
	},
	{
		suffix: "løten.no",
		reversed: "on.arg-netl--nx"
	},
	{
		suffix: "malvik.no",
		reversed: "on.kivlam"
	},
	{
		suffix: "masoy.no",
		reversed: "on.yosam"
	},
	{
		suffix: "måsøy.no",
		reversed: "on.h0alu-ysm--nx"
	},
	{
		suffix: "muosat.no",
		reversed: "on.tasoum"
	},
	{
		suffix: "muosát.no",
		reversed: "on.aq0-tsoum--nx"
	},
	{
		suffix: "mandal.no",
		reversed: "on.ladnam"
	},
	{
		suffix: "marker.no",
		reversed: "on.rekram"
	},
	{
		suffix: "marnardal.no",
		reversed: "on.ladranram"
	},
	{
		suffix: "masfjorden.no",
		reversed: "on.nedrojfsam"
	},
	{
		suffix: "meland.no",
		reversed: "on.dnalem"
	},
	{
		suffix: "meldal.no",
		reversed: "on.ladlem"
	},
	{
		suffix: "melhus.no",
		reversed: "on.suhlem"
	},
	{
		suffix: "meloy.no",
		reversed: "on.yolem"
	},
	{
		suffix: "meløy.no",
		reversed: "on.ari-ylem--nx"
	},
	{
		suffix: "meraker.no",
		reversed: "on.rekarem"
	},
	{
		suffix: "meråker.no",
		reversed: "on.auk-rekrem--nx"
	},
	{
		suffix: "moareke.no",
		reversed: "on.ekeraom"
	},
	{
		suffix: "moåreke.no",
		reversed: "on.auj-ekerom--nx"
	},
	{
		suffix: "midsund.no",
		reversed: "on.dnusdim"
	},
	{
		suffix: "midtre-gauldal.no",
		reversed: "on.ladluag-ertdim"
	},
	{
		suffix: "modalen.no",
		reversed: "on.neladom"
	},
	{
		suffix: "modum.no",
		reversed: "on.mudom"
	},
	{
		suffix: "molde.no",
		reversed: "on.edlom"
	},
	{
		suffix: "moskenes.no",
		reversed: "on.seneksom"
	},
	{
		suffix: "moss.no",
		reversed: "on.ssom"
	},
	{
		suffix: "mosvik.no",
		reversed: "on.kivsom"
	},
	{
		suffix: "malselv.no",
		reversed: "on.vleslam"
	},
	{
		suffix: "målselv.no",
		reversed: "on.aui-vleslm--nx"
	},
	{
		suffix: "malatvuopmi.no",
		reversed: "on.impouvtalam"
	},
	{
		suffix: "málatvuopmi.no",
		reversed: "on.a4s-impouvtalm--nx"
	},
	{
		suffix: "namdalseid.no",
		reversed: "on.diesladman"
	},
	{
		suffix: "aejrie.no",
		reversed: "on.eirjea"
	},
	{
		suffix: "namsos.no",
		reversed: "on.sosman"
	},
	{
		suffix: "namsskogan.no",
		reversed: "on.nagokssman"
	},
	{
		suffix: "naamesjevuemie.no",
		reversed: "on.eimeuvejsemaan"
	},
	{
		suffix: "nååmesjevuemie.no",
		reversed: "on.abct-eimeuvejsemn--nx"
	},
	{
		suffix: "laakesvuemie.no",
		reversed: "on.eimeuvsekaal"
	},
	{
		suffix: "nannestad.no",
		reversed: "on.datsennan"
	},
	{
		suffix: "narvik.no",
		reversed: "on.kivran"
	},
	{
		suffix: "narviika.no",
		reversed: "on.akiivran"
	},
	{
		suffix: "naustdal.no",
		reversed: "on.ladtsuan"
	},
	{
		suffix: "nedre-eiker.no",
		reversed: "on.rekie-erden"
	},
	{
		suffix: "nes.akershus.no",
		reversed: "on.suhsreka.sen"
	},
	{
		suffix: "nes.buskerud.no",
		reversed: "on.dureksub.sen"
	},
	{
		suffix: "nesna.no",
		reversed: "on.ansen"
	},
	{
		suffix: "nesodden.no",
		reversed: "on.neddosen"
	},
	{
		suffix: "nesseby.no",
		reversed: "on.ybessen"
	},
	{
		suffix: "unjarga.no",
		reversed: "on.agrajnu"
	},
	{
		suffix: "unjárga.no",
		reversed: "on.atr-agrjnu--nx"
	},
	{
		suffix: "nesset.no",
		reversed: "on.tessen"
	},
	{
		suffix: "nissedal.no",
		reversed: "on.ladessin"
	},
	{
		suffix: "nittedal.no",
		reversed: "on.ladettin"
	},
	{
		suffix: "nord-aurdal.no",
		reversed: "on.ladrua-dron"
	},
	{
		suffix: "nord-fron.no",
		reversed: "on.norf-dron"
	},
	{
		suffix: "nord-odal.no",
		reversed: "on.lado-dron"
	},
	{
		suffix: "norddal.no",
		reversed: "on.laddron"
	},
	{
		suffix: "nordkapp.no",
		reversed: "on.ppakdron"
	},
	{
		suffix: "davvenjarga.no",
		reversed: "on.agrajnevvad"
	},
	{
		suffix: "davvenjárga.no",
		reversed: "on.a4y-agrjnevvad--nx"
	},
	{
		suffix: "nordre-land.no",
		reversed: "on.dnal-erdron"
	},
	{
		suffix: "nordreisa.no",
		reversed: "on.asierdron"
	},
	{
		suffix: "raisa.no",
		reversed: "on.asiar"
	},
	{
		suffix: "ráisa.no",
		reversed: "on.an5-asir--nx"
	},
	{
		suffix: "nore-og-uvdal.no",
		reversed: "on.ladvu-go-eron"
	},
	{
		suffix: "notodden.no",
		reversed: "on.neddoton"
	},
	{
		suffix: "naroy.no",
		reversed: "on.yoran"
	},
	{
		suffix: "nærøy.no",
		reversed: "on.g5aly-yrn--nx"
	},
	{
		suffix: "notteroy.no",
		reversed: "on.yoretton"
	},
	{
		suffix: "nøtterøy.no",
		reversed: "on.eayb-yrettn--nx"
	},
	{
		suffix: "odda.no",
		reversed: "on.addo"
	},
	{
		suffix: "oksnes.no",
		reversed: "on.sensko"
	},
	{
		suffix: "øksnes.no",
		reversed: "on.auu-sensk--nx"
	},
	{
		suffix: "oppdal.no",
		reversed: "on.ladppo"
	},
	{
		suffix: "oppegard.no",
		reversed: "on.drageppo"
	},
	{
		suffix: "oppegård.no",
		reversed: "on.axi-drgeppo--nx"
	},
	{
		suffix: "orkdal.no",
		reversed: "on.ladkro"
	},
	{
		suffix: "orland.no",
		reversed: "on.dnalro"
	},
	{
		suffix: "ørland.no",
		reversed: "on.auu-dnalr--nx"
	},
	{
		suffix: "orskog.no",
		reversed: "on.goksro"
	},
	{
		suffix: "ørskog.no",
		reversed: "on.auu-goksr--nx"
	},
	{
		suffix: "orsta.no",
		reversed: "on.atsro"
	},
	{
		suffix: "ørsta.no",
		reversed: "on.arf-atsr--nx"
	},
	{
		suffix: "os.hedmark.no",
		reversed: "on.kramdeh.so"
	},
	{
		suffix: "os.hordaland.no",
		reversed: "on.dnaladroh.so"
	},
	{
		suffix: "osen.no",
		reversed: "on.neso"
	},
	{
		suffix: "osteroy.no",
		reversed: "on.yoretso"
	},
	{
		suffix: "osterøy.no",
		reversed: "on.ayf-yretso--nx"
	},
	{
		suffix: "ostre-toten.no",
		reversed: "on.netot-ertso"
	},
	{
		suffix: "østre-toten.no",
		reversed: "on.bcz-netot-erts--nx"
	},
	{
		suffix: "overhalla.no",
		reversed: "on.allahrevo"
	},
	{
		suffix: "ovre-eiker.no",
		reversed: "on.rekie-ervo"
	},
	{
		suffix: "øvre-eiker.no",
		reversed: "on.a8k-rekie-erv--nx"
	},
	{
		suffix: "oyer.no",
		reversed: "on.reyo"
	},
	{
		suffix: "øyer.no",
		reversed: "on.anz-rey--nx"
	},
	{
		suffix: "oygarden.no",
		reversed: "on.nedragyo"
	},
	{
		suffix: "øygarden.no",
		reversed: "on.a1p-nedragy--nx"
	},
	{
		suffix: "oystre-slidre.no",
		reversed: "on.erdils-ertsyo"
	},
	{
		suffix: "øystre-slidre.no",
		reversed: "on.bju-erdils-ertsy--nx"
	},
	{
		suffix: "porsanger.no",
		reversed: "on.regnasrop"
	},
	{
		suffix: "porsangu.no",
		reversed: "on.ugnasrop"
	},
	{
		suffix: "porsáŋgu.no",
		reversed: "on.f62ats-ugsrop--nx"
	},
	{
		suffix: "porsgrunn.no",
		reversed: "on.nnurgsrop"
	},
	{
		suffix: "radoy.no",
		reversed: "on.yodar"
	},
	{
		suffix: "radøy.no",
		reversed: "on.ari-ydar--nx"
	},
	{
		suffix: "rakkestad.no",
		reversed: "on.datsekkar"
	},
	{
		suffix: "rana.no",
		reversed: "on.anar"
	},
	{
		suffix: "ruovat.no",
		reversed: "on.tavour"
	},
	{
		suffix: "randaberg.no",
		reversed: "on.grebadnar"
	},
	{
		suffix: "rauma.no",
		reversed: "on.amuar"
	},
	{
		suffix: "rendalen.no",
		reversed: "on.neladner"
	},
	{
		suffix: "rennebu.no",
		reversed: "on.ubenner"
	},
	{
		suffix: "rennesoy.no",
		reversed: "on.yosenner"
	},
	{
		suffix: "rennesøy.no",
		reversed: "on.a1v-ysenner--nx"
	},
	{
		suffix: "rindal.no",
		reversed: "on.ladnir"
	},
	{
		suffix: "ringebu.no",
		reversed: "on.ubegnir"
	},
	{
		suffix: "ringerike.no",
		reversed: "on.ekiregnir"
	},
	{
		suffix: "ringsaker.no",
		reversed: "on.rekasgnir"
	},
	{
		suffix: "rissa.no",
		reversed: "on.assir"
	},
	{
		suffix: "risor.no",
		reversed: "on.rosir"
	},
	{
		suffix: "risør.no",
		reversed: "on.ari-rsir--nx"
	},
	{
		suffix: "roan.no",
		reversed: "on.naor"
	},
	{
		suffix: "rollag.no",
		reversed: "on.gallor"
	},
	{
		suffix: "rygge.no",
		reversed: "on.eggyr"
	},
	{
		suffix: "ralingen.no",
		reversed: "on.negnilar"
	},
	{
		suffix: "rælingen.no",
		reversed: "on.axm-negnilr--nx"
	},
	{
		suffix: "rodoy.no",
		reversed: "on.yodor"
	},
	{
		suffix: "rødøy.no",
		reversed: "on.ban0-ydr--nx"
	},
	{
		suffix: "romskog.no",
		reversed: "on.goksmor"
	},
	{
		suffix: "rømskog.no",
		reversed: "on.ayb-goksmr--nx"
	},
	{
		suffix: "roros.no",
		reversed: "on.soror"
	},
	{
		suffix: "røros.no",
		reversed: "on.arg-sorr--nx"
	},
	{
		suffix: "rost.no",
		reversed: "on.tsor"
	},
	{
		suffix: "røst.no",
		reversed: "on.an0-tsr--nx"
	},
	{
		suffix: "royken.no",
		reversed: "on.nekyor"
	},
	{
		suffix: "røyken.no",
		reversed: "on.auv-nekyr--nx"
	},
	{
		suffix: "royrvik.no",
		reversed: "on.kivryor"
	},
	{
		suffix: "røyrvik.no",
		reversed: "on.ayb-kivryr--nx"
	},
	{
		suffix: "rade.no",
		reversed: "on.edar"
	},
	{
		suffix: "råde.no",
		reversed: "on.alu-edr--nx"
	},
	{
		suffix: "salangen.no",
		reversed: "on.negnalas"
	},
	{
		suffix: "siellak.no",
		reversed: "on.kalleis"
	},
	{
		suffix: "saltdal.no",
		reversed: "on.ladtlas"
	},
	{
		suffix: "salat.no",
		reversed: "on.talas"
	},
	{
		suffix: "sálát.no",
		reversed: "on.bale-tls--nx"
	},
	{
		suffix: "sálat.no",
		reversed: "on.an5-tals--nx"
	},
	{
		suffix: "samnanger.no",
		reversed: "on.regnanmas"
	},
	{
		suffix: "sande.more-og-romsdal.no",
		reversed: "on.ladsmor-go-erom.ednas"
	},
	{
		suffix: "sande.møre-og-romsdal.no",
		reversed: "on.bqq-ladsmor-go-erm--nx.ednas"
	},
	{
		suffix: "sande.vestfold.no",
		reversed: "on.dloftsev.ednas"
	},
	{
		suffix: "sandefjord.no",
		reversed: "on.drojfednas"
	},
	{
		suffix: "sandnes.no",
		reversed: "on.sendnas"
	},
	{
		suffix: "sandoy.no",
		reversed: "on.yodnas"
	},
	{
		suffix: "sandøy.no",
		reversed: "on.auy-ydnas--nx"
	},
	{
		suffix: "sarpsborg.no",
		reversed: "on.grobspras"
	},
	{
		suffix: "sauda.no",
		reversed: "on.aduas"
	},
	{
		suffix: "sauherad.no",
		reversed: "on.darehuas"
	},
	{
		suffix: "sel.no",
		reversed: "on.les"
	},
	{
		suffix: "selbu.no",
		reversed: "on.ubles"
	},
	{
		suffix: "selje.no",
		reversed: "on.ejles"
	},
	{
		suffix: "seljord.no",
		reversed: "on.drojles"
	},
	{
		suffix: "sigdal.no",
		reversed: "on.ladgis"
	},
	{
		suffix: "siljan.no",
		reversed: "on.najlis"
	},
	{
		suffix: "sirdal.no",
		reversed: "on.ladris"
	},
	{
		suffix: "skaun.no",
		reversed: "on.nuaks"
	},
	{
		suffix: "skedsmo.no",
		reversed: "on.omsdeks"
	},
	{
		suffix: "ski.no",
		reversed: "on.iks"
	},
	{
		suffix: "skien.no",
		reversed: "on.neiks"
	},
	{
		suffix: "skiptvet.no",
		reversed: "on.tevtpiks"
	},
	{
		suffix: "skjervoy.no",
		reversed: "on.yovrejks"
	},
	{
		suffix: "skjervøy.no",
		reversed: "on.a1v-yvrejks--nx"
	},
	{
		suffix: "skierva.no",
		reversed: "on.avreiks"
	},
	{
		suffix: "skiervá.no",
		reversed: "on.atu-vreiks--nx"
	},
	{
		suffix: "skjak.no",
		reversed: "on.kajks"
	},
	{
		suffix: "skjåk.no",
		reversed: "on.aos-kjks--nx"
	},
	{
		suffix: "skodje.no",
		reversed: "on.ejdoks"
	},
	{
		suffix: "skanland.no",
		reversed: "on.dnalnaks"
	},
	{
		suffix: "skånland.no",
		reversed: "on.axf-dnalnks--nx"
	},
	{
		suffix: "skanit.no",
		reversed: "on.tinaks"
	},
	{
		suffix: "skánit.no",
		reversed: "on.aqy-tinks--nx"
	},
	{
		suffix: "smola.no",
		reversed: "on.aloms"
	},
	{
		suffix: "smøla.no",
		reversed: "on.arh-alms--nx"
	},
	{
		suffix: "snillfjord.no",
		reversed: "on.drojfllins"
	},
	{
		suffix: "snasa.no",
		reversed: "on.asans"
	},
	{
		suffix: "snåsa.no",
		reversed: "on.aor-asns--nx"
	},
	{
		suffix: "snoasa.no",
		reversed: "on.asaons"
	},
	{
		suffix: "snaase.no",
		reversed: "on.esaans"
	},
	{
		suffix: "snåase.no",
		reversed: "on.arn-esans--nx"
	},
	{
		suffix: "sogndal.no",
		reversed: "on.ladngos"
	},
	{
		suffix: "sokndal.no",
		reversed: "on.ladnkos"
	},
	{
		suffix: "sola.no",
		reversed: "on.alos"
	},
	{
		suffix: "solund.no",
		reversed: "on.dnulos"
	},
	{
		suffix: "songdalen.no",
		reversed: "on.neladgnos"
	},
	{
		suffix: "sortland.no",
		reversed: "on.dnaltros"
	},
	{
		suffix: "spydeberg.no",
		reversed: "on.grebedyps"
	},
	{
		suffix: "stange.no",
		reversed: "on.egnats"
	},
	{
		suffix: "stavanger.no",
		reversed: "on.regnavats"
	},
	{
		suffix: "steigen.no",
		reversed: "on.negiets"
	},
	{
		suffix: "steinkjer.no",
		reversed: "on.rejkniets"
	},
	{
		suffix: "stjordal.no",
		reversed: "on.ladrojts"
	},
	{
		suffix: "stjørdal.no",
		reversed: "on.a1s-ladrjts--nx"
	},
	{
		suffix: "stokke.no",
		reversed: "on.ekkots"
	},
	{
		suffix: "stor-elvdal.no",
		reversed: "on.ladvle-rots"
	},
	{
		suffix: "stord.no",
		reversed: "on.drots"
	},
	{
		suffix: "stordal.no",
		reversed: "on.ladrots"
	},
	{
		suffix: "storfjord.no",
		reversed: "on.drojfrots"
	},
	{
		suffix: "omasvuotna.no",
		reversed: "on.antouvsamo"
	},
	{
		suffix: "strand.no",
		reversed: "on.dnarts"
	},
	{
		suffix: "stranda.no",
		reversed: "on.adnarts"
	},
	{
		suffix: "stryn.no",
		reversed: "on.nyrts"
	},
	{
		suffix: "sula.no",
		reversed: "on.alus"
	},
	{
		suffix: "suldal.no",
		reversed: "on.ladlus"
	},
	{
		suffix: "sund.no",
		reversed: "on.dnus"
	},
	{
		suffix: "sunndal.no",
		reversed: "on.ladnnus"
	},
	{
		suffix: "surnadal.no",
		reversed: "on.ladanrus"
	},
	{
		suffix: "sveio.no",
		reversed: "on.oievs"
	},
	{
		suffix: "svelvik.no",
		reversed: "on.kivlevs"
	},
	{
		suffix: "sykkylven.no",
		reversed: "on.nevlykkys"
	},
	{
		suffix: "sogne.no",
		reversed: "on.engos"
	},
	{
		suffix: "søgne.no",
		reversed: "on.arg-engs--nx"
	},
	{
		suffix: "somna.no",
		reversed: "on.anmos"
	},
	{
		suffix: "sømna.no",
		reversed: "on.arg-anms--nx"
	},
	{
		suffix: "sondre-land.no",
		reversed: "on.dnal-erdnos"
	},
	{
		suffix: "søndre-land.no",
		reversed: "on.bc0-dnal-erdns--nx"
	},
	{
		suffix: "sor-aurdal.no",
		reversed: "on.ladrua-ros"
	},
	{
		suffix: "sør-aurdal.no",
		reversed: "on.a8l-ladrua-rs--nx"
	},
	{
		suffix: "sor-fron.no",
		reversed: "on.norf-ros"
	},
	{
		suffix: "sør-fron.no",
		reversed: "on.a1q-norf-rs--nx"
	},
	{
		suffix: "sor-odal.no",
		reversed: "on.lado-ros"
	},
	{
		suffix: "sør-odal.no",
		reversed: "on.a1q-lado-rs--nx"
	},
	{
		suffix: "sor-varanger.no",
		reversed: "on.regnarav-ros"
	},
	{
		suffix: "sør-varanger.no",
		reversed: "on.bgg-regnarav-rs--nx"
	},
	{
		suffix: "matta-varjjat.no",
		reversed: "on.tajjrav-attam"
	},
	{
		suffix: "mátta-várjjat.no",
		reversed: "on.fa7k-tajjrv-attm--nx"
	},
	{
		suffix: "sorfold.no",
		reversed: "on.dlofros"
	},
	{
		suffix: "sørfold.no",
		reversed: "on.ayb-dlofrs--nx"
	},
	{
		suffix: "sorreisa.no",
		reversed: "on.asierros"
	},
	{
		suffix: "sørreisa.no",
		reversed: "on.a1q-asierrs--nx"
	},
	{
		suffix: "sorum.no",
		reversed: "on.muros"
	},
	{
		suffix: "sørum.no",
		reversed: "on.arg-murs--nx"
	},
	{
		suffix: "tana.no",
		reversed: "on.anat"
	},
	{
		suffix: "deatnu.no",
		reversed: "on.untaed"
	},
	{
		suffix: "time.no",
		reversed: "on.emit"
	},
	{
		suffix: "tingvoll.no",
		reversed: "on.llovgnit"
	},
	{
		suffix: "tinn.no",
		reversed: "on.nnit"
	},
	{
		suffix: "tjeldsund.no",
		reversed: "on.dnusdlejt"
	},
	{
		suffix: "dielddanuorri.no",
		reversed: "on.irrounaddleid"
	},
	{
		suffix: "tjome.no",
		reversed: "on.emojt"
	},
	{
		suffix: "tjøme.no",
		reversed: "on.arh-emjt--nx"
	},
	{
		suffix: "tokke.no",
		reversed: "on.ekkot"
	},
	{
		suffix: "tolga.no",
		reversed: "on.aglot"
	},
	{
		suffix: "torsken.no",
		reversed: "on.neksrot"
	},
	{
		suffix: "tranoy.no",
		reversed: "on.yonart"
	},
	{
		suffix: "tranøy.no",
		reversed: "on.auy-ynart--nx"
	},
	{
		suffix: "tromso.no",
		reversed: "on.osmort"
	},
	{
		suffix: "tromsø.no",
		reversed: "on.auz-smort--nx"
	},
	{
		suffix: "tromsa.no",
		reversed: "on.asmort"
	},
	{
		suffix: "romsa.no",
		reversed: "on.asmor"
	},
	{
		suffix: "trondheim.no",
		reversed: "on.miehdnort"
	},
	{
		suffix: "troandin.no",
		reversed: "on.nidnaort"
	},
	{
		suffix: "trysil.no",
		reversed: "on.lisyrt"
	},
	{
		suffix: "trana.no",
		reversed: "on.anart"
	},
	{
		suffix: "træna.no",
		reversed: "on.aow-anrt--nx"
	},
	{
		suffix: "trogstad.no",
		reversed: "on.datsgort"
	},
	{
		suffix: "trøgstad.no",
		reversed: "on.a1r-datsgrt--nx"
	},
	{
		suffix: "tvedestrand.no",
		reversed: "on.dnartsedevt"
	},
	{
		suffix: "tydal.no",
		reversed: "on.ladyt"
	},
	{
		suffix: "tynset.no",
		reversed: "on.tesnyt"
	},
	{
		suffix: "tysfjord.no",
		reversed: "on.drojfsyt"
	},
	{
		suffix: "divtasvuodna.no",
		reversed: "on.andouvsatvid"
	},
	{
		suffix: "divttasvuotna.no",
		reversed: "on.antouvsattvid"
	},
	{
		suffix: "tysnes.no",
		reversed: "on.sensyt"
	},
	{
		suffix: "tysvar.no",
		reversed: "on.ravsyt"
	},
	{
		suffix: "tysvær.no",
		reversed: "on.arv-rvsyt--nx"
	},
	{
		suffix: "tonsberg.no",
		reversed: "on.grebsnot"
	},
	{
		suffix: "tønsberg.no",
		reversed: "on.a1q-grebsnt--nx"
	},
	{
		suffix: "ullensaker.no",
		reversed: "on.rekasnellu"
	},
	{
		suffix: "ullensvang.no",
		reversed: "on.gnavsnellu"
	},
	{
		suffix: "ulvik.no",
		reversed: "on.kivlu"
	},
	{
		suffix: "utsira.no",
		reversed: "on.aristu"
	},
	{
		suffix: "vadso.no",
		reversed: "on.osdav"
	},
	{
		suffix: "vadsø.no",
		reversed: "on.arj-sdav--nx"
	},
	{
		suffix: "cahcesuolo.no",
		reversed: "on.olousechac"
	},
	{
		suffix: "čáhcesuolo.no",
		reversed: "on.b53ay7-olousech--nx"
	},
	{
		suffix: "vaksdal.no",
		reversed: "on.ladskav"
	},
	{
		suffix: "valle.no",
		reversed: "on.ellav"
	},
	{
		suffix: "vang.no",
		reversed: "on.gnav"
	},
	{
		suffix: "vanylven.no",
		reversed: "on.nevlynav"
	},
	{
		suffix: "vardo.no",
		reversed: "on.odrav"
	},
	{
		suffix: "vardø.no",
		reversed: "on.arj-drav--nx"
	},
	{
		suffix: "varggat.no",
		reversed: "on.taggrav"
	},
	{
		suffix: "várggát.no",
		reversed: "on.daqx-tggrv--nx"
	},
	{
		suffix: "vefsn.no",
		reversed: "on.nsfev"
	},
	{
		suffix: "vaapste.no",
		reversed: "on.etspaav"
	},
	{
		suffix: "vega.no",
		reversed: "on.agev"
	},
	{
		suffix: "vegarshei.no",
		reversed: "on.iehsragev"
	},
	{
		suffix: "vegårshei.no",
		reversed: "on.a0c-iehsrgev--nx"
	},
	{
		suffix: "vennesla.no",
		reversed: "on.alsennev"
	},
	{
		suffix: "verdal.no",
		reversed: "on.ladrev"
	},
	{
		suffix: "verran.no",
		reversed: "on.narrev"
	},
	{
		suffix: "vestby.no",
		reversed: "on.ybtsev"
	},
	{
		suffix: "vestnes.no",
		reversed: "on.sentsev"
	},
	{
		suffix: "vestre-slidre.no",
		reversed: "on.erdils-ertsev"
	},
	{
		suffix: "vestre-toten.no",
		reversed: "on.netot-ertsev"
	},
	{
		suffix: "vestvagoy.no",
		reversed: "on.yogavtsev"
	},
	{
		suffix: "vestvågøy.no",
		reversed: "on.o6axi-ygvtsev--nx"
	},
	{
		suffix: "vevelstad.no",
		reversed: "on.datslevev"
	},
	{
		suffix: "vik.no",
		reversed: "on.kiv"
	},
	{
		suffix: "vikna.no",
		reversed: "on.ankiv"
	},
	{
		suffix: "vindafjord.no",
		reversed: "on.drojfadniv"
	},
	{
		suffix: "volda.no",
		reversed: "on.adlov"
	},
	{
		suffix: "voss.no",
		reversed: "on.ssov"
	},
	{
		suffix: "varoy.no",
		reversed: "on.yorav"
	},
	{
		suffix: "værøy.no",
		reversed: "on.g5aly-yrv--nx"
	},
	{
		suffix: "vagan.no",
		reversed: "on.nagav"
	},
	{
		suffix: "vågan.no",
		reversed: "on.aoq-nagv--nx"
	},
	{
		suffix: "voagat.no",
		reversed: "on.tagaov"
	},
	{
		suffix: "vagsoy.no",
		reversed: "on.yosgav"
	},
	{
		suffix: "vågsøy.no",
		reversed: "on.j0aoq-ysgv--nx"
	},
	{
		suffix: "vaga.no",
		reversed: "on.agav"
	},
	{
		suffix: "vågå.no",
		reversed: "on.baiy-gv--nx"
	},
	{
		suffix: "valer.ostfold.no",
		reversed: "on.dloftso.relav"
	},
	{
		suffix: "våler.østfold.no",
		reversed: "on.ax9-dlofts--nx.aoq-relv--nx"
	},
	{
		suffix: "valer.hedmark.no",
		reversed: "on.kramdeh.relav"
	},
	{
		suffix: "våler.hedmark.no",
		reversed: "on.kramdeh.aoq-relv--nx"
	},
	{
		suffix: "*.np",
		reversed: "pn"
	},
	{
		suffix: "nr",
		reversed: "rn"
	},
	{
		suffix: "biz.nr",
		reversed: "rn.zib"
	},
	{
		suffix: "info.nr",
		reversed: "rn.ofni"
	},
	{
		suffix: "gov.nr",
		reversed: "rn.vog"
	},
	{
		suffix: "edu.nr",
		reversed: "rn.ude"
	},
	{
		suffix: "org.nr",
		reversed: "rn.gro"
	},
	{
		suffix: "net.nr",
		reversed: "rn.ten"
	},
	{
		suffix: "com.nr",
		reversed: "rn.moc"
	},
	{
		suffix: "nu",
		reversed: "un"
	},
	{
		suffix: "nz",
		reversed: "zn"
	},
	{
		suffix: "ac.nz",
		reversed: "zn.ca"
	},
	{
		suffix: "co.nz",
		reversed: "zn.oc"
	},
	{
		suffix: "cri.nz",
		reversed: "zn.irc"
	},
	{
		suffix: "geek.nz",
		reversed: "zn.keeg"
	},
	{
		suffix: "gen.nz",
		reversed: "zn.neg"
	},
	{
		suffix: "govt.nz",
		reversed: "zn.tvog"
	},
	{
		suffix: "health.nz",
		reversed: "zn.htlaeh"
	},
	{
		suffix: "iwi.nz",
		reversed: "zn.iwi"
	},
	{
		suffix: "kiwi.nz",
		reversed: "zn.iwik"
	},
	{
		suffix: "maori.nz",
		reversed: "zn.iroam"
	},
	{
		suffix: "mil.nz",
		reversed: "zn.lim"
	},
	{
		suffix: "māori.nz",
		reversed: "zn.asq-irom--nx"
	},
	{
		suffix: "net.nz",
		reversed: "zn.ten"
	},
	{
		suffix: "org.nz",
		reversed: "zn.gro"
	},
	{
		suffix: "parliament.nz",
		reversed: "zn.tnemailrap"
	},
	{
		suffix: "school.nz",
		reversed: "zn.loohcs"
	},
	{
		suffix: "om",
		reversed: "mo"
	},
	{
		suffix: "co.om",
		reversed: "mo.oc"
	},
	{
		suffix: "com.om",
		reversed: "mo.moc"
	},
	{
		suffix: "edu.om",
		reversed: "mo.ude"
	},
	{
		suffix: "gov.om",
		reversed: "mo.vog"
	},
	{
		suffix: "med.om",
		reversed: "mo.dem"
	},
	{
		suffix: "museum.om",
		reversed: "mo.muesum"
	},
	{
		suffix: "net.om",
		reversed: "mo.ten"
	},
	{
		suffix: "org.om",
		reversed: "mo.gro"
	},
	{
		suffix: "pro.om",
		reversed: "mo.orp"
	},
	{
		suffix: "onion",
		reversed: "noino"
	},
	{
		suffix: "org",
		reversed: "gro"
	},
	{
		suffix: "pa",
		reversed: "ap"
	},
	{
		suffix: "ac.pa",
		reversed: "ap.ca"
	},
	{
		suffix: "gob.pa",
		reversed: "ap.bog"
	},
	{
		suffix: "com.pa",
		reversed: "ap.moc"
	},
	{
		suffix: "org.pa",
		reversed: "ap.gro"
	},
	{
		suffix: "sld.pa",
		reversed: "ap.dls"
	},
	{
		suffix: "edu.pa",
		reversed: "ap.ude"
	},
	{
		suffix: "net.pa",
		reversed: "ap.ten"
	},
	{
		suffix: "ing.pa",
		reversed: "ap.gni"
	},
	{
		suffix: "abo.pa",
		reversed: "ap.oba"
	},
	{
		suffix: "med.pa",
		reversed: "ap.dem"
	},
	{
		suffix: "nom.pa",
		reversed: "ap.mon"
	},
	{
		suffix: "pe",
		reversed: "ep"
	},
	{
		suffix: "edu.pe",
		reversed: "ep.ude"
	},
	{
		suffix: "gob.pe",
		reversed: "ep.bog"
	},
	{
		suffix: "nom.pe",
		reversed: "ep.mon"
	},
	{
		suffix: "mil.pe",
		reversed: "ep.lim"
	},
	{
		suffix: "org.pe",
		reversed: "ep.gro"
	},
	{
		suffix: "com.pe",
		reversed: "ep.moc"
	},
	{
		suffix: "net.pe",
		reversed: "ep.ten"
	},
	{
		suffix: "pf",
		reversed: "fp"
	},
	{
		suffix: "com.pf",
		reversed: "fp.moc"
	},
	{
		suffix: "org.pf",
		reversed: "fp.gro"
	},
	{
		suffix: "edu.pf",
		reversed: "fp.ude"
	},
	{
		suffix: "*.pg",
		reversed: "gp"
	},
	{
		suffix: "ph",
		reversed: "hp"
	},
	{
		suffix: "com.ph",
		reversed: "hp.moc"
	},
	{
		suffix: "net.ph",
		reversed: "hp.ten"
	},
	{
		suffix: "org.ph",
		reversed: "hp.gro"
	},
	{
		suffix: "gov.ph",
		reversed: "hp.vog"
	},
	{
		suffix: "edu.ph",
		reversed: "hp.ude"
	},
	{
		suffix: "ngo.ph",
		reversed: "hp.ogn"
	},
	{
		suffix: "mil.ph",
		reversed: "hp.lim"
	},
	{
		suffix: "i.ph",
		reversed: "hp.i"
	},
	{
		suffix: "pk",
		reversed: "kp"
	},
	{
		suffix: "com.pk",
		reversed: "kp.moc"
	},
	{
		suffix: "net.pk",
		reversed: "kp.ten"
	},
	{
		suffix: "edu.pk",
		reversed: "kp.ude"
	},
	{
		suffix: "org.pk",
		reversed: "kp.gro"
	},
	{
		suffix: "fam.pk",
		reversed: "kp.maf"
	},
	{
		suffix: "biz.pk",
		reversed: "kp.zib"
	},
	{
		suffix: "web.pk",
		reversed: "kp.bew"
	},
	{
		suffix: "gov.pk",
		reversed: "kp.vog"
	},
	{
		suffix: "gob.pk",
		reversed: "kp.bog"
	},
	{
		suffix: "gok.pk",
		reversed: "kp.kog"
	},
	{
		suffix: "gon.pk",
		reversed: "kp.nog"
	},
	{
		suffix: "gop.pk",
		reversed: "kp.pog"
	},
	{
		suffix: "gos.pk",
		reversed: "kp.sog"
	},
	{
		suffix: "info.pk",
		reversed: "kp.ofni"
	},
	{
		suffix: "pl",
		reversed: "lp"
	},
	{
		suffix: "com.pl",
		reversed: "lp.moc"
	},
	{
		suffix: "net.pl",
		reversed: "lp.ten"
	},
	{
		suffix: "org.pl",
		reversed: "lp.gro"
	},
	{
		suffix: "aid.pl",
		reversed: "lp.dia"
	},
	{
		suffix: "agro.pl",
		reversed: "lp.orga"
	},
	{
		suffix: "atm.pl",
		reversed: "lp.mta"
	},
	{
		suffix: "auto.pl",
		reversed: "lp.otua"
	},
	{
		suffix: "biz.pl",
		reversed: "lp.zib"
	},
	{
		suffix: "edu.pl",
		reversed: "lp.ude"
	},
	{
		suffix: "gmina.pl",
		reversed: "lp.animg"
	},
	{
		suffix: "gsm.pl",
		reversed: "lp.msg"
	},
	{
		suffix: "info.pl",
		reversed: "lp.ofni"
	},
	{
		suffix: "mail.pl",
		reversed: "lp.liam"
	},
	{
		suffix: "miasta.pl",
		reversed: "lp.atsaim"
	},
	{
		suffix: "media.pl",
		reversed: "lp.aidem"
	},
	{
		suffix: "mil.pl",
		reversed: "lp.lim"
	},
	{
		suffix: "nieruchomosci.pl",
		reversed: "lp.icsomohcurein"
	},
	{
		suffix: "nom.pl",
		reversed: "lp.mon"
	},
	{
		suffix: "pc.pl",
		reversed: "lp.cp"
	},
	{
		suffix: "powiat.pl",
		reversed: "lp.taiwop"
	},
	{
		suffix: "priv.pl",
		reversed: "lp.virp"
	},
	{
		suffix: "realestate.pl",
		reversed: "lp.etatselaer"
	},
	{
		suffix: "rel.pl",
		reversed: "lp.ler"
	},
	{
		suffix: "sex.pl",
		reversed: "lp.xes"
	},
	{
		suffix: "shop.pl",
		reversed: "lp.pohs"
	},
	{
		suffix: "sklep.pl",
		reversed: "lp.pelks"
	},
	{
		suffix: "sos.pl",
		reversed: "lp.sos"
	},
	{
		suffix: "szkola.pl",
		reversed: "lp.alokzs"
	},
	{
		suffix: "targi.pl",
		reversed: "lp.igrat"
	},
	{
		suffix: "tm.pl",
		reversed: "lp.mt"
	},
	{
		suffix: "tourism.pl",
		reversed: "lp.msiruot"
	},
	{
		suffix: "travel.pl",
		reversed: "lp.levart"
	},
	{
		suffix: "turystyka.pl",
		reversed: "lp.akytsyrut"
	},
	{
		suffix: "gov.pl",
		reversed: "lp.vog"
	},
	{
		suffix: "ap.gov.pl",
		reversed: "lp.vog.pa"
	},
	{
		suffix: "ic.gov.pl",
		reversed: "lp.vog.ci"
	},
	{
		suffix: "is.gov.pl",
		reversed: "lp.vog.si"
	},
	{
		suffix: "us.gov.pl",
		reversed: "lp.vog.su"
	},
	{
		suffix: "kmpsp.gov.pl",
		reversed: "lp.vog.pspmk"
	},
	{
		suffix: "kppsp.gov.pl",
		reversed: "lp.vog.psppk"
	},
	{
		suffix: "kwpsp.gov.pl",
		reversed: "lp.vog.pspwk"
	},
	{
		suffix: "psp.gov.pl",
		reversed: "lp.vog.psp"
	},
	{
		suffix: "wskr.gov.pl",
		reversed: "lp.vog.rksw"
	},
	{
		suffix: "kwp.gov.pl",
		reversed: "lp.vog.pwk"
	},
	{
		suffix: "mw.gov.pl",
		reversed: "lp.vog.wm"
	},
	{
		suffix: "ug.gov.pl",
		reversed: "lp.vog.gu"
	},
	{
		suffix: "um.gov.pl",
		reversed: "lp.vog.mu"
	},
	{
		suffix: "umig.gov.pl",
		reversed: "lp.vog.gimu"
	},
	{
		suffix: "ugim.gov.pl",
		reversed: "lp.vog.migu"
	},
	{
		suffix: "upow.gov.pl",
		reversed: "lp.vog.wopu"
	},
	{
		suffix: "uw.gov.pl",
		reversed: "lp.vog.wu"
	},
	{
		suffix: "starostwo.gov.pl",
		reversed: "lp.vog.owtsorats"
	},
	{
		suffix: "pa.gov.pl",
		reversed: "lp.vog.ap"
	},
	{
		suffix: "po.gov.pl",
		reversed: "lp.vog.op"
	},
	{
		suffix: "psse.gov.pl",
		reversed: "lp.vog.essp"
	},
	{
		suffix: "pup.gov.pl",
		reversed: "lp.vog.pup"
	},
	{
		suffix: "rzgw.gov.pl",
		reversed: "lp.vog.wgzr"
	},
	{
		suffix: "sa.gov.pl",
		reversed: "lp.vog.as"
	},
	{
		suffix: "so.gov.pl",
		reversed: "lp.vog.os"
	},
	{
		suffix: "sr.gov.pl",
		reversed: "lp.vog.rs"
	},
	{
		suffix: "wsa.gov.pl",
		reversed: "lp.vog.asw"
	},
	{
		suffix: "sko.gov.pl",
		reversed: "lp.vog.oks"
	},
	{
		suffix: "uzs.gov.pl",
		reversed: "lp.vog.szu"
	},
	{
		suffix: "wiih.gov.pl",
		reversed: "lp.vog.hiiw"
	},
	{
		suffix: "winb.gov.pl",
		reversed: "lp.vog.bniw"
	},
	{
		suffix: "pinb.gov.pl",
		reversed: "lp.vog.bnip"
	},
	{
		suffix: "wios.gov.pl",
		reversed: "lp.vog.soiw"
	},
	{
		suffix: "witd.gov.pl",
		reversed: "lp.vog.dtiw"
	},
	{
		suffix: "wzmiuw.gov.pl",
		reversed: "lp.vog.wuimzw"
	},
	{
		suffix: "piw.gov.pl",
		reversed: "lp.vog.wip"
	},
	{
		suffix: "wiw.gov.pl",
		reversed: "lp.vog.wiw"
	},
	{
		suffix: "griw.gov.pl",
		reversed: "lp.vog.wirg"
	},
	{
		suffix: "wif.gov.pl",
		reversed: "lp.vog.fiw"
	},
	{
		suffix: "oum.gov.pl",
		reversed: "lp.vog.muo"
	},
	{
		suffix: "sdn.gov.pl",
		reversed: "lp.vog.nds"
	},
	{
		suffix: "zp.gov.pl",
		reversed: "lp.vog.pz"
	},
	{
		suffix: "uppo.gov.pl",
		reversed: "lp.vog.oppu"
	},
	{
		suffix: "mup.gov.pl",
		reversed: "lp.vog.pum"
	},
	{
		suffix: "wuoz.gov.pl",
		reversed: "lp.vog.zouw"
	},
	{
		suffix: "konsulat.gov.pl",
		reversed: "lp.vog.talusnok"
	},
	{
		suffix: "oirm.gov.pl",
		reversed: "lp.vog.mrio"
	},
	{
		suffix: "augustow.pl",
		reversed: "lp.wotsugua"
	},
	{
		suffix: "babia-gora.pl",
		reversed: "lp.arog-aibab"
	},
	{
		suffix: "bedzin.pl",
		reversed: "lp.nizdeb"
	},
	{
		suffix: "beskidy.pl",
		reversed: "lp.ydikseb"
	},
	{
		suffix: "bialowieza.pl",
		reversed: "lp.azeiwolaib"
	},
	{
		suffix: "bialystok.pl",
		reversed: "lp.kotsylaib"
	},
	{
		suffix: "bielawa.pl",
		reversed: "lp.awaleib"
	},
	{
		suffix: "bieszczady.pl",
		reversed: "lp.ydazczseib"
	},
	{
		suffix: "boleslawiec.pl",
		reversed: "lp.ceiwalselob"
	},
	{
		suffix: "bydgoszcz.pl",
		reversed: "lp.zczsogdyb"
	},
	{
		suffix: "bytom.pl",
		reversed: "lp.motyb"
	},
	{
		suffix: "cieszyn.pl",
		reversed: "lp.nyzseic"
	},
	{
		suffix: "czeladz.pl",
		reversed: "lp.zdalezc"
	},
	{
		suffix: "czest.pl",
		reversed: "lp.tsezc"
	},
	{
		suffix: "dlugoleka.pl",
		reversed: "lp.akeloguld"
	},
	{
		suffix: "elblag.pl",
		reversed: "lp.galble"
	},
	{
		suffix: "elk.pl",
		reversed: "lp.kle"
	},
	{
		suffix: "glogow.pl",
		reversed: "lp.wogolg"
	},
	{
		suffix: "gniezno.pl",
		reversed: "lp.onzeing"
	},
	{
		suffix: "gorlice.pl",
		reversed: "lp.ecilrog"
	},
	{
		suffix: "grajewo.pl",
		reversed: "lp.owejarg"
	},
	{
		suffix: "ilawa.pl",
		reversed: "lp.awali"
	},
	{
		suffix: "jaworzno.pl",
		reversed: "lp.onzrowaj"
	},
	{
		suffix: "jelenia-gora.pl",
		reversed: "lp.arog-ainelej"
	},
	{
		suffix: "jgora.pl",
		reversed: "lp.arogj"
	},
	{
		suffix: "kalisz.pl",
		reversed: "lp.zsilak"
	},
	{
		suffix: "kazimierz-dolny.pl",
		reversed: "lp.ynlod-zreimizak"
	},
	{
		suffix: "karpacz.pl",
		reversed: "lp.zcaprak"
	},
	{
		suffix: "kartuzy.pl",
		reversed: "lp.yzutrak"
	},
	{
		suffix: "kaszuby.pl",
		reversed: "lp.ybuzsak"
	},
	{
		suffix: "katowice.pl",
		reversed: "lp.eciwotak"
	},
	{
		suffix: "kepno.pl",
		reversed: "lp.onpek"
	},
	{
		suffix: "ketrzyn.pl",
		reversed: "lp.nyzrtek"
	},
	{
		suffix: "klodzko.pl",
		reversed: "lp.okzdolk"
	},
	{
		suffix: "kobierzyce.pl",
		reversed: "lp.ecyzreibok"
	},
	{
		suffix: "kolobrzeg.pl",
		reversed: "lp.gezrbolok"
	},
	{
		suffix: "konin.pl",
		reversed: "lp.ninok"
	},
	{
		suffix: "konskowola.pl",
		reversed: "lp.alowoksnok"
	},
	{
		suffix: "kutno.pl",
		reversed: "lp.ontuk"
	},
	{
		suffix: "lapy.pl",
		reversed: "lp.ypal"
	},
	{
		suffix: "lebork.pl",
		reversed: "lp.krobel"
	},
	{
		suffix: "legnica.pl",
		reversed: "lp.acingel"
	},
	{
		suffix: "lezajsk.pl",
		reversed: "lp.ksjazel"
	},
	{
		suffix: "limanowa.pl",
		reversed: "lp.awonamil"
	},
	{
		suffix: "lomza.pl",
		reversed: "lp.azmol"
	},
	{
		suffix: "lowicz.pl",
		reversed: "lp.zciwol"
	},
	{
		suffix: "lubin.pl",
		reversed: "lp.nibul"
	},
	{
		suffix: "lukow.pl",
		reversed: "lp.wokul"
	},
	{
		suffix: "malbork.pl",
		reversed: "lp.kroblam"
	},
	{
		suffix: "malopolska.pl",
		reversed: "lp.akslopolam"
	},
	{
		suffix: "mazowsze.pl",
		reversed: "lp.ezswozam"
	},
	{
		suffix: "mazury.pl",
		reversed: "lp.yruzam"
	},
	{
		suffix: "mielec.pl",
		reversed: "lp.celeim"
	},
	{
		suffix: "mielno.pl",
		reversed: "lp.onleim"
	},
	{
		suffix: "mragowo.pl",
		reversed: "lp.owogarm"
	},
	{
		suffix: "naklo.pl",
		reversed: "lp.olkan"
	},
	{
		suffix: "nowaruda.pl",
		reversed: "lp.adurawon"
	},
	{
		suffix: "nysa.pl",
		reversed: "lp.asyn"
	},
	{
		suffix: "olawa.pl",
		reversed: "lp.awalo"
	},
	{
		suffix: "olecko.pl",
		reversed: "lp.okcelo"
	},
	{
		suffix: "olkusz.pl",
		reversed: "lp.zsuklo"
	},
	{
		suffix: "olsztyn.pl",
		reversed: "lp.nytzslo"
	},
	{
		suffix: "opoczno.pl",
		reversed: "lp.onzcopo"
	},
	{
		suffix: "opole.pl",
		reversed: "lp.elopo"
	},
	{
		suffix: "ostroda.pl",
		reversed: "lp.adortso"
	},
	{
		suffix: "ostroleka.pl",
		reversed: "lp.akelortso"
	},
	{
		suffix: "ostrowiec.pl",
		reversed: "lp.ceiwortso"
	},
	{
		suffix: "ostrowwlkp.pl",
		reversed: "lp.pklwwortso"
	},
	{
		suffix: "pila.pl",
		reversed: "lp.alip"
	},
	{
		suffix: "pisz.pl",
		reversed: "lp.zsip"
	},
	{
		suffix: "podhale.pl",
		reversed: "lp.elahdop"
	},
	{
		suffix: "podlasie.pl",
		reversed: "lp.eisaldop"
	},
	{
		suffix: "polkowice.pl",
		reversed: "lp.eciwoklop"
	},
	{
		suffix: "pomorze.pl",
		reversed: "lp.ezromop"
	},
	{
		suffix: "pomorskie.pl",
		reversed: "lp.eiksromop"
	},
	{
		suffix: "prochowice.pl",
		reversed: "lp.eciwohcorp"
	},
	{
		suffix: "pruszkow.pl",
		reversed: "lp.wokzsurp"
	},
	{
		suffix: "przeworsk.pl",
		reversed: "lp.ksrowezrp"
	},
	{
		suffix: "pulawy.pl",
		reversed: "lp.ywalup"
	},
	{
		suffix: "radom.pl",
		reversed: "lp.modar"
	},
	{
		suffix: "rawa-maz.pl",
		reversed: "lp.zam-awar"
	},
	{
		suffix: "rybnik.pl",
		reversed: "lp.kinbyr"
	},
	{
		suffix: "rzeszow.pl",
		reversed: "lp.wozsezr"
	},
	{
		suffix: "sanok.pl",
		reversed: "lp.konas"
	},
	{
		suffix: "sejny.pl",
		reversed: "lp.ynjes"
	},
	{
		suffix: "slask.pl",
		reversed: "lp.ksals"
	},
	{
		suffix: "slupsk.pl",
		reversed: "lp.kspuls"
	},
	{
		suffix: "sosnowiec.pl",
		reversed: "lp.ceiwonsos"
	},
	{
		suffix: "stalowa-wola.pl",
		reversed: "lp.alow-awolats"
	},
	{
		suffix: "skoczow.pl",
		reversed: "lp.wozcoks"
	},
	{
		suffix: "starachowice.pl",
		reversed: "lp.eciwohcarats"
	},
	{
		suffix: "stargard.pl",
		reversed: "lp.dragrats"
	},
	{
		suffix: "suwalki.pl",
		reversed: "lp.iklawus"
	},
	{
		suffix: "swidnica.pl",
		reversed: "lp.acindiws"
	},
	{
		suffix: "swiebodzin.pl",
		reversed: "lp.nizdobeiws"
	},
	{
		suffix: "swinoujscie.pl",
		reversed: "lp.eicsjuoniws"
	},
	{
		suffix: "szczecin.pl",
		reversed: "lp.nicezczs"
	},
	{
		suffix: "szczytno.pl",
		reversed: "lp.ontyzczs"
	},
	{
		suffix: "tarnobrzeg.pl",
		reversed: "lp.gezrbonrat"
	},
	{
		suffix: "tgory.pl",
		reversed: "lp.yrogt"
	},
	{
		suffix: "turek.pl",
		reversed: "lp.kerut"
	},
	{
		suffix: "tychy.pl",
		reversed: "lp.yhcyt"
	},
	{
		suffix: "ustka.pl",
		reversed: "lp.aktsu"
	},
	{
		suffix: "walbrzych.pl",
		reversed: "lp.hcyzrblaw"
	},
	{
		suffix: "warmia.pl",
		reversed: "lp.aimraw"
	},
	{
		suffix: "warszawa.pl",
		reversed: "lp.awazsraw"
	},
	{
		suffix: "waw.pl",
		reversed: "lp.waw"
	},
	{
		suffix: "wegrow.pl",
		reversed: "lp.worgew"
	},
	{
		suffix: "wielun.pl",
		reversed: "lp.nuleiw"
	},
	{
		suffix: "wlocl.pl",
		reversed: "lp.lcolw"
	},
	{
		suffix: "wloclawek.pl",
		reversed: "lp.kewalcolw"
	},
	{
		suffix: "wodzislaw.pl",
		reversed: "lp.walsizdow"
	},
	{
		suffix: "wolomin.pl",
		reversed: "lp.nimolow"
	},
	{
		suffix: "wroclaw.pl",
		reversed: "lp.walcorw"
	},
	{
		suffix: "zachpomor.pl",
		reversed: "lp.romophcaz"
	},
	{
		suffix: "zagan.pl",
		reversed: "lp.nagaz"
	},
	{
		suffix: "zarow.pl",
		reversed: "lp.woraz"
	},
	{
		suffix: "zgora.pl",
		reversed: "lp.arogz"
	},
	{
		suffix: "zgorzelec.pl",
		reversed: "lp.celezrogz"
	},
	{
		suffix: "pm",
		reversed: "mp"
	},
	{
		suffix: "pn",
		reversed: "np"
	},
	{
		suffix: "gov.pn",
		reversed: "np.vog"
	},
	{
		suffix: "co.pn",
		reversed: "np.oc"
	},
	{
		suffix: "org.pn",
		reversed: "np.gro"
	},
	{
		suffix: "edu.pn",
		reversed: "np.ude"
	},
	{
		suffix: "net.pn",
		reversed: "np.ten"
	},
	{
		suffix: "post",
		reversed: "tsop"
	},
	{
		suffix: "pr",
		reversed: "rp"
	},
	{
		suffix: "com.pr",
		reversed: "rp.moc"
	},
	{
		suffix: "net.pr",
		reversed: "rp.ten"
	},
	{
		suffix: "org.pr",
		reversed: "rp.gro"
	},
	{
		suffix: "gov.pr",
		reversed: "rp.vog"
	},
	{
		suffix: "edu.pr",
		reversed: "rp.ude"
	},
	{
		suffix: "isla.pr",
		reversed: "rp.alsi"
	},
	{
		suffix: "pro.pr",
		reversed: "rp.orp"
	},
	{
		suffix: "biz.pr",
		reversed: "rp.zib"
	},
	{
		suffix: "info.pr",
		reversed: "rp.ofni"
	},
	{
		suffix: "name.pr",
		reversed: "rp.eman"
	},
	{
		suffix: "est.pr",
		reversed: "rp.tse"
	},
	{
		suffix: "prof.pr",
		reversed: "rp.forp"
	},
	{
		suffix: "ac.pr",
		reversed: "rp.ca"
	},
	{
		suffix: "pro",
		reversed: "orp"
	},
	{
		suffix: "aaa.pro",
		reversed: "orp.aaa"
	},
	{
		suffix: "aca.pro",
		reversed: "orp.aca"
	},
	{
		suffix: "acct.pro",
		reversed: "orp.tcca"
	},
	{
		suffix: "avocat.pro",
		reversed: "orp.tacova"
	},
	{
		suffix: "bar.pro",
		reversed: "orp.rab"
	},
	{
		suffix: "cpa.pro",
		reversed: "orp.apc"
	},
	{
		suffix: "eng.pro",
		reversed: "orp.gne"
	},
	{
		suffix: "jur.pro",
		reversed: "orp.ruj"
	},
	{
		suffix: "law.pro",
		reversed: "orp.wal"
	},
	{
		suffix: "med.pro",
		reversed: "orp.dem"
	},
	{
		suffix: "recht.pro",
		reversed: "orp.thcer"
	},
	{
		suffix: "ps",
		reversed: "sp"
	},
	{
		suffix: "edu.ps",
		reversed: "sp.ude"
	},
	{
		suffix: "gov.ps",
		reversed: "sp.vog"
	},
	{
		suffix: "sec.ps",
		reversed: "sp.ces"
	},
	{
		suffix: "plo.ps",
		reversed: "sp.olp"
	},
	{
		suffix: "com.ps",
		reversed: "sp.moc"
	},
	{
		suffix: "org.ps",
		reversed: "sp.gro"
	},
	{
		suffix: "net.ps",
		reversed: "sp.ten"
	},
	{
		suffix: "pt",
		reversed: "tp"
	},
	{
		suffix: "net.pt",
		reversed: "tp.ten"
	},
	{
		suffix: "gov.pt",
		reversed: "tp.vog"
	},
	{
		suffix: "org.pt",
		reversed: "tp.gro"
	},
	{
		suffix: "edu.pt",
		reversed: "tp.ude"
	},
	{
		suffix: "int.pt",
		reversed: "tp.tni"
	},
	{
		suffix: "publ.pt",
		reversed: "tp.lbup"
	},
	{
		suffix: "com.pt",
		reversed: "tp.moc"
	},
	{
		suffix: "nome.pt",
		reversed: "tp.emon"
	},
	{
		suffix: "pw",
		reversed: "wp"
	},
	{
		suffix: "co.pw",
		reversed: "wp.oc"
	},
	{
		suffix: "ne.pw",
		reversed: "wp.en"
	},
	{
		suffix: "or.pw",
		reversed: "wp.ro"
	},
	{
		suffix: "ed.pw",
		reversed: "wp.de"
	},
	{
		suffix: "go.pw",
		reversed: "wp.og"
	},
	{
		suffix: "belau.pw",
		reversed: "wp.ualeb"
	},
	{
		suffix: "py",
		reversed: "yp"
	},
	{
		suffix: "com.py",
		reversed: "yp.moc"
	},
	{
		suffix: "coop.py",
		reversed: "yp.pooc"
	},
	{
		suffix: "edu.py",
		reversed: "yp.ude"
	},
	{
		suffix: "gov.py",
		reversed: "yp.vog"
	},
	{
		suffix: "mil.py",
		reversed: "yp.lim"
	},
	{
		suffix: "net.py",
		reversed: "yp.ten"
	},
	{
		suffix: "org.py",
		reversed: "yp.gro"
	},
	{
		suffix: "qa",
		reversed: "aq"
	},
	{
		suffix: "com.qa",
		reversed: "aq.moc"
	},
	{
		suffix: "edu.qa",
		reversed: "aq.ude"
	},
	{
		suffix: "gov.qa",
		reversed: "aq.vog"
	},
	{
		suffix: "mil.qa",
		reversed: "aq.lim"
	},
	{
		suffix: "name.qa",
		reversed: "aq.eman"
	},
	{
		suffix: "net.qa",
		reversed: "aq.ten"
	},
	{
		suffix: "org.qa",
		reversed: "aq.gro"
	},
	{
		suffix: "sch.qa",
		reversed: "aq.hcs"
	},
	{
		suffix: "re",
		reversed: "er"
	},
	{
		suffix: "asso.re",
		reversed: "er.ossa"
	},
	{
		suffix: "com.re",
		reversed: "er.moc"
	},
	{
		suffix: "nom.re",
		reversed: "er.mon"
	},
	{
		suffix: "ro",
		reversed: "or"
	},
	{
		suffix: "arts.ro",
		reversed: "or.stra"
	},
	{
		suffix: "com.ro",
		reversed: "or.moc"
	},
	{
		suffix: "firm.ro",
		reversed: "or.mrif"
	},
	{
		suffix: "info.ro",
		reversed: "or.ofni"
	},
	{
		suffix: "nom.ro",
		reversed: "or.mon"
	},
	{
		suffix: "nt.ro",
		reversed: "or.tn"
	},
	{
		suffix: "org.ro",
		reversed: "or.gro"
	},
	{
		suffix: "rec.ro",
		reversed: "or.cer"
	},
	{
		suffix: "store.ro",
		reversed: "or.erots"
	},
	{
		suffix: "tm.ro",
		reversed: "or.mt"
	},
	{
		suffix: "www.ro",
		reversed: "or.www"
	},
	{
		suffix: "rs",
		reversed: "sr"
	},
	{
		suffix: "ac.rs",
		reversed: "sr.ca"
	},
	{
		suffix: "co.rs",
		reversed: "sr.oc"
	},
	{
		suffix: "edu.rs",
		reversed: "sr.ude"
	},
	{
		suffix: "gov.rs",
		reversed: "sr.vog"
	},
	{
		suffix: "in.rs",
		reversed: "sr.ni"
	},
	{
		suffix: "org.rs",
		reversed: "sr.gro"
	},
	{
		suffix: "ru",
		reversed: "ur"
	},
	{
		suffix: "rw",
		reversed: "wr"
	},
	{
		suffix: "ac.rw",
		reversed: "wr.ca"
	},
	{
		suffix: "co.rw",
		reversed: "wr.oc"
	},
	{
		suffix: "coop.rw",
		reversed: "wr.pooc"
	},
	{
		suffix: "gov.rw",
		reversed: "wr.vog"
	},
	{
		suffix: "mil.rw",
		reversed: "wr.lim"
	},
	{
		suffix: "net.rw",
		reversed: "wr.ten"
	},
	{
		suffix: "org.rw",
		reversed: "wr.gro"
	},
	{
		suffix: "sa",
		reversed: "as"
	},
	{
		suffix: "com.sa",
		reversed: "as.moc"
	},
	{
		suffix: "net.sa",
		reversed: "as.ten"
	},
	{
		suffix: "org.sa",
		reversed: "as.gro"
	},
	{
		suffix: "gov.sa",
		reversed: "as.vog"
	},
	{
		suffix: "med.sa",
		reversed: "as.dem"
	},
	{
		suffix: "pub.sa",
		reversed: "as.bup"
	},
	{
		suffix: "edu.sa",
		reversed: "as.ude"
	},
	{
		suffix: "sch.sa",
		reversed: "as.hcs"
	},
	{
		suffix: "sb",
		reversed: "bs"
	},
	{
		suffix: "com.sb",
		reversed: "bs.moc"
	},
	{
		suffix: "edu.sb",
		reversed: "bs.ude"
	},
	{
		suffix: "gov.sb",
		reversed: "bs.vog"
	},
	{
		suffix: "net.sb",
		reversed: "bs.ten"
	},
	{
		suffix: "org.sb",
		reversed: "bs.gro"
	},
	{
		suffix: "sc",
		reversed: "cs"
	},
	{
		suffix: "com.sc",
		reversed: "cs.moc"
	},
	{
		suffix: "gov.sc",
		reversed: "cs.vog"
	},
	{
		suffix: "net.sc",
		reversed: "cs.ten"
	},
	{
		suffix: "org.sc",
		reversed: "cs.gro"
	},
	{
		suffix: "edu.sc",
		reversed: "cs.ude"
	},
	{
		suffix: "sd",
		reversed: "ds"
	},
	{
		suffix: "com.sd",
		reversed: "ds.moc"
	},
	{
		suffix: "net.sd",
		reversed: "ds.ten"
	},
	{
		suffix: "org.sd",
		reversed: "ds.gro"
	},
	{
		suffix: "edu.sd",
		reversed: "ds.ude"
	},
	{
		suffix: "med.sd",
		reversed: "ds.dem"
	},
	{
		suffix: "tv.sd",
		reversed: "ds.vt"
	},
	{
		suffix: "gov.sd",
		reversed: "ds.vog"
	},
	{
		suffix: "info.sd",
		reversed: "ds.ofni"
	},
	{
		suffix: "se",
		reversed: "es"
	},
	{
		suffix: "a.se",
		reversed: "es.a"
	},
	{
		suffix: "ac.se",
		reversed: "es.ca"
	},
	{
		suffix: "b.se",
		reversed: "es.b"
	},
	{
		suffix: "bd.se",
		reversed: "es.db"
	},
	{
		suffix: "brand.se",
		reversed: "es.dnarb"
	},
	{
		suffix: "c.se",
		reversed: "es.c"
	},
	{
		suffix: "d.se",
		reversed: "es.d"
	},
	{
		suffix: "e.se",
		reversed: "es.e"
	},
	{
		suffix: "f.se",
		reversed: "es.f"
	},
	{
		suffix: "fh.se",
		reversed: "es.hf"
	},
	{
		suffix: "fhsk.se",
		reversed: "es.kshf"
	},
	{
		suffix: "fhv.se",
		reversed: "es.vhf"
	},
	{
		suffix: "g.se",
		reversed: "es.g"
	},
	{
		suffix: "h.se",
		reversed: "es.h"
	},
	{
		suffix: "i.se",
		reversed: "es.i"
	},
	{
		suffix: "k.se",
		reversed: "es.k"
	},
	{
		suffix: "komforb.se",
		reversed: "es.brofmok"
	},
	{
		suffix: "kommunalforbund.se",
		reversed: "es.dnubroflanummok"
	},
	{
		suffix: "komvux.se",
		reversed: "es.xuvmok"
	},
	{
		suffix: "l.se",
		reversed: "es.l"
	},
	{
		suffix: "lanbib.se",
		reversed: "es.bibnal"
	},
	{
		suffix: "m.se",
		reversed: "es.m"
	},
	{
		suffix: "n.se",
		reversed: "es.n"
	},
	{
		suffix: "naturbruksgymn.se",
		reversed: "es.nmygskurbrutan"
	},
	{
		suffix: "o.se",
		reversed: "es.o"
	},
	{
		suffix: "org.se",
		reversed: "es.gro"
	},
	{
		suffix: "p.se",
		reversed: "es.p"
	},
	{
		suffix: "parti.se",
		reversed: "es.itrap"
	},
	{
		suffix: "pp.se",
		reversed: "es.pp"
	},
	{
		suffix: "press.se",
		reversed: "es.sserp"
	},
	{
		suffix: "r.se",
		reversed: "es.r"
	},
	{
		suffix: "s.se",
		reversed: "es.s"
	},
	{
		suffix: "t.se",
		reversed: "es.t"
	},
	{
		suffix: "tm.se",
		reversed: "es.mt"
	},
	{
		suffix: "u.se",
		reversed: "es.u"
	},
	{
		suffix: "w.se",
		reversed: "es.w"
	},
	{
		suffix: "x.se",
		reversed: "es.x"
	},
	{
		suffix: "y.se",
		reversed: "es.y"
	},
	{
		suffix: "z.se",
		reversed: "es.z"
	},
	{
		suffix: "sg",
		reversed: "gs"
	},
	{
		suffix: "com.sg",
		reversed: "gs.moc"
	},
	{
		suffix: "net.sg",
		reversed: "gs.ten"
	},
	{
		suffix: "org.sg",
		reversed: "gs.gro"
	},
	{
		suffix: "gov.sg",
		reversed: "gs.vog"
	},
	{
		suffix: "edu.sg",
		reversed: "gs.ude"
	},
	{
		suffix: "per.sg",
		reversed: "gs.rep"
	},
	{
		suffix: "sh",
		reversed: "hs"
	},
	{
		suffix: "com.sh",
		reversed: "hs.moc"
	},
	{
		suffix: "net.sh",
		reversed: "hs.ten"
	},
	{
		suffix: "gov.sh",
		reversed: "hs.vog"
	},
	{
		suffix: "org.sh",
		reversed: "hs.gro"
	},
	{
		suffix: "mil.sh",
		reversed: "hs.lim"
	},
	{
		suffix: "si",
		reversed: "is"
	},
	{
		suffix: "sj",
		reversed: "js"
	},
	{
		suffix: "sk",
		reversed: "ks"
	},
	{
		suffix: "sl",
		reversed: "ls"
	},
	{
		suffix: "com.sl",
		reversed: "ls.moc"
	},
	{
		suffix: "net.sl",
		reversed: "ls.ten"
	},
	{
		suffix: "edu.sl",
		reversed: "ls.ude"
	},
	{
		suffix: "gov.sl",
		reversed: "ls.vog"
	},
	{
		suffix: "org.sl",
		reversed: "ls.gro"
	},
	{
		suffix: "sm",
		reversed: "ms"
	},
	{
		suffix: "sn",
		reversed: "ns"
	},
	{
		suffix: "art.sn",
		reversed: "ns.tra"
	},
	{
		suffix: "com.sn",
		reversed: "ns.moc"
	},
	{
		suffix: "edu.sn",
		reversed: "ns.ude"
	},
	{
		suffix: "gouv.sn",
		reversed: "ns.vuog"
	},
	{
		suffix: "org.sn",
		reversed: "ns.gro"
	},
	{
		suffix: "perso.sn",
		reversed: "ns.osrep"
	},
	{
		suffix: "univ.sn",
		reversed: "ns.vinu"
	},
	{
		suffix: "so",
		reversed: "os"
	},
	{
		suffix: "com.so",
		reversed: "os.moc"
	},
	{
		suffix: "edu.so",
		reversed: "os.ude"
	},
	{
		suffix: "gov.so",
		reversed: "os.vog"
	},
	{
		suffix: "me.so",
		reversed: "os.em"
	},
	{
		suffix: "net.so",
		reversed: "os.ten"
	},
	{
		suffix: "org.so",
		reversed: "os.gro"
	},
	{
		suffix: "sr",
		reversed: "rs"
	},
	{
		suffix: "ss",
		reversed: "ss"
	},
	{
		suffix: "biz.ss",
		reversed: "ss.zib"
	},
	{
		suffix: "com.ss",
		reversed: "ss.moc"
	},
	{
		suffix: "edu.ss",
		reversed: "ss.ude"
	},
	{
		suffix: "gov.ss",
		reversed: "ss.vog"
	},
	{
		suffix: "me.ss",
		reversed: "ss.em"
	},
	{
		suffix: "net.ss",
		reversed: "ss.ten"
	},
	{
		suffix: "org.ss",
		reversed: "ss.gro"
	},
	{
		suffix: "sch.ss",
		reversed: "ss.hcs"
	},
	{
		suffix: "st",
		reversed: "ts"
	},
	{
		suffix: "co.st",
		reversed: "ts.oc"
	},
	{
		suffix: "com.st",
		reversed: "ts.moc"
	},
	{
		suffix: "consulado.st",
		reversed: "ts.odalusnoc"
	},
	{
		suffix: "edu.st",
		reversed: "ts.ude"
	},
	{
		suffix: "embaixada.st",
		reversed: "ts.adaxiabme"
	},
	{
		suffix: "mil.st",
		reversed: "ts.lim"
	},
	{
		suffix: "net.st",
		reversed: "ts.ten"
	},
	{
		suffix: "org.st",
		reversed: "ts.gro"
	},
	{
		suffix: "principe.st",
		reversed: "ts.epicnirp"
	},
	{
		suffix: "saotome.st",
		reversed: "ts.emotoas"
	},
	{
		suffix: "store.st",
		reversed: "ts.erots"
	},
	{
		suffix: "su",
		reversed: "us"
	},
	{
		suffix: "sv",
		reversed: "vs"
	},
	{
		suffix: "com.sv",
		reversed: "vs.moc"
	},
	{
		suffix: "edu.sv",
		reversed: "vs.ude"
	},
	{
		suffix: "gob.sv",
		reversed: "vs.bog"
	},
	{
		suffix: "org.sv",
		reversed: "vs.gro"
	},
	{
		suffix: "red.sv",
		reversed: "vs.der"
	},
	{
		suffix: "sx",
		reversed: "xs"
	},
	{
		suffix: "gov.sx",
		reversed: "xs.vog"
	},
	{
		suffix: "sy",
		reversed: "ys"
	},
	{
		suffix: "edu.sy",
		reversed: "ys.ude"
	},
	{
		suffix: "gov.sy",
		reversed: "ys.vog"
	},
	{
		suffix: "net.sy",
		reversed: "ys.ten"
	},
	{
		suffix: "mil.sy",
		reversed: "ys.lim"
	},
	{
		suffix: "com.sy",
		reversed: "ys.moc"
	},
	{
		suffix: "org.sy",
		reversed: "ys.gro"
	},
	{
		suffix: "sz",
		reversed: "zs"
	},
	{
		suffix: "co.sz",
		reversed: "zs.oc"
	},
	{
		suffix: "ac.sz",
		reversed: "zs.ca"
	},
	{
		suffix: "org.sz",
		reversed: "zs.gro"
	},
	{
		suffix: "tc",
		reversed: "ct"
	},
	{
		suffix: "td",
		reversed: "dt"
	},
	{
		suffix: "tel",
		reversed: "let"
	},
	{
		suffix: "tf",
		reversed: "ft"
	},
	{
		suffix: "tg",
		reversed: "gt"
	},
	{
		suffix: "th",
		reversed: "ht"
	},
	{
		suffix: "ac.th",
		reversed: "ht.ca"
	},
	{
		suffix: "co.th",
		reversed: "ht.oc"
	},
	{
		suffix: "go.th",
		reversed: "ht.og"
	},
	{
		suffix: "in.th",
		reversed: "ht.ni"
	},
	{
		suffix: "mi.th",
		reversed: "ht.im"
	},
	{
		suffix: "net.th",
		reversed: "ht.ten"
	},
	{
		suffix: "or.th",
		reversed: "ht.ro"
	},
	{
		suffix: "tj",
		reversed: "jt"
	},
	{
		suffix: "ac.tj",
		reversed: "jt.ca"
	},
	{
		suffix: "biz.tj",
		reversed: "jt.zib"
	},
	{
		suffix: "co.tj",
		reversed: "jt.oc"
	},
	{
		suffix: "com.tj",
		reversed: "jt.moc"
	},
	{
		suffix: "edu.tj",
		reversed: "jt.ude"
	},
	{
		suffix: "go.tj",
		reversed: "jt.og"
	},
	{
		suffix: "gov.tj",
		reversed: "jt.vog"
	},
	{
		suffix: "int.tj",
		reversed: "jt.tni"
	},
	{
		suffix: "mil.tj",
		reversed: "jt.lim"
	},
	{
		suffix: "name.tj",
		reversed: "jt.eman"
	},
	{
		suffix: "net.tj",
		reversed: "jt.ten"
	},
	{
		suffix: "nic.tj",
		reversed: "jt.cin"
	},
	{
		suffix: "org.tj",
		reversed: "jt.gro"
	},
	{
		suffix: "test.tj",
		reversed: "jt.tset"
	},
	{
		suffix: "web.tj",
		reversed: "jt.bew"
	},
	{
		suffix: "tk",
		reversed: "kt"
	},
	{
		suffix: "tl",
		reversed: "lt"
	},
	{
		suffix: "gov.tl",
		reversed: "lt.vog"
	},
	{
		suffix: "tm",
		reversed: "mt"
	},
	{
		suffix: "com.tm",
		reversed: "mt.moc"
	},
	{
		suffix: "co.tm",
		reversed: "mt.oc"
	},
	{
		suffix: "org.tm",
		reversed: "mt.gro"
	},
	{
		suffix: "net.tm",
		reversed: "mt.ten"
	},
	{
		suffix: "nom.tm",
		reversed: "mt.mon"
	},
	{
		suffix: "gov.tm",
		reversed: "mt.vog"
	},
	{
		suffix: "mil.tm",
		reversed: "mt.lim"
	},
	{
		suffix: "edu.tm",
		reversed: "mt.ude"
	},
	{
		suffix: "tn",
		reversed: "nt"
	},
	{
		suffix: "com.tn",
		reversed: "nt.moc"
	},
	{
		suffix: "ens.tn",
		reversed: "nt.sne"
	},
	{
		suffix: "fin.tn",
		reversed: "nt.nif"
	},
	{
		suffix: "gov.tn",
		reversed: "nt.vog"
	},
	{
		suffix: "ind.tn",
		reversed: "nt.dni"
	},
	{
		suffix: "info.tn",
		reversed: "nt.ofni"
	},
	{
		suffix: "intl.tn",
		reversed: "nt.ltni"
	},
	{
		suffix: "mincom.tn",
		reversed: "nt.mocnim"
	},
	{
		suffix: "nat.tn",
		reversed: "nt.tan"
	},
	{
		suffix: "net.tn",
		reversed: "nt.ten"
	},
	{
		suffix: "org.tn",
		reversed: "nt.gro"
	},
	{
		suffix: "perso.tn",
		reversed: "nt.osrep"
	},
	{
		suffix: "tourism.tn",
		reversed: "nt.msiruot"
	},
	{
		suffix: "to",
		reversed: "ot"
	},
	{
		suffix: "com.to",
		reversed: "ot.moc"
	},
	{
		suffix: "gov.to",
		reversed: "ot.vog"
	},
	{
		suffix: "net.to",
		reversed: "ot.ten"
	},
	{
		suffix: "org.to",
		reversed: "ot.gro"
	},
	{
		suffix: "edu.to",
		reversed: "ot.ude"
	},
	{
		suffix: "mil.to",
		reversed: "ot.lim"
	},
	{
		suffix: "tr",
		reversed: "rt"
	},
	{
		suffix: "av.tr",
		reversed: "rt.va"
	},
	{
		suffix: "bbs.tr",
		reversed: "rt.sbb"
	},
	{
		suffix: "bel.tr",
		reversed: "rt.leb"
	},
	{
		suffix: "biz.tr",
		reversed: "rt.zib"
	},
	{
		suffix: "com.tr",
		reversed: "rt.moc"
	},
	{
		suffix: "dr.tr",
		reversed: "rt.rd"
	},
	{
		suffix: "edu.tr",
		reversed: "rt.ude"
	},
	{
		suffix: "gen.tr",
		reversed: "rt.neg"
	},
	{
		suffix: "gov.tr",
		reversed: "rt.vog"
	},
	{
		suffix: "info.tr",
		reversed: "rt.ofni"
	},
	{
		suffix: "mil.tr",
		reversed: "rt.lim"
	},
	{
		suffix: "k12.tr",
		reversed: "rt.21k"
	},
	{
		suffix: "kep.tr",
		reversed: "rt.pek"
	},
	{
		suffix: "name.tr",
		reversed: "rt.eman"
	},
	{
		suffix: "net.tr",
		reversed: "rt.ten"
	},
	{
		suffix: "org.tr",
		reversed: "rt.gro"
	},
	{
		suffix: "pol.tr",
		reversed: "rt.lop"
	},
	{
		suffix: "tel.tr",
		reversed: "rt.let"
	},
	{
		suffix: "tsk.tr",
		reversed: "rt.kst"
	},
	{
		suffix: "tv.tr",
		reversed: "rt.vt"
	},
	{
		suffix: "web.tr",
		reversed: "rt.bew"
	},
	{
		suffix: "nc.tr",
		reversed: "rt.cn"
	},
	{
		suffix: "gov.nc.tr",
		reversed: "rt.cn.vog"
	},
	{
		suffix: "tt",
		reversed: "tt"
	},
	{
		suffix: "co.tt",
		reversed: "tt.oc"
	},
	{
		suffix: "com.tt",
		reversed: "tt.moc"
	},
	{
		suffix: "org.tt",
		reversed: "tt.gro"
	},
	{
		suffix: "net.tt",
		reversed: "tt.ten"
	},
	{
		suffix: "biz.tt",
		reversed: "tt.zib"
	},
	{
		suffix: "info.tt",
		reversed: "tt.ofni"
	},
	{
		suffix: "pro.tt",
		reversed: "tt.orp"
	},
	{
		suffix: "int.tt",
		reversed: "tt.tni"
	},
	{
		suffix: "coop.tt",
		reversed: "tt.pooc"
	},
	{
		suffix: "jobs.tt",
		reversed: "tt.sboj"
	},
	{
		suffix: "mobi.tt",
		reversed: "tt.ibom"
	},
	{
		suffix: "travel.tt",
		reversed: "tt.levart"
	},
	{
		suffix: "museum.tt",
		reversed: "tt.muesum"
	},
	{
		suffix: "aero.tt",
		reversed: "tt.orea"
	},
	{
		suffix: "name.tt",
		reversed: "tt.eman"
	},
	{
		suffix: "gov.tt",
		reversed: "tt.vog"
	},
	{
		suffix: "edu.tt",
		reversed: "tt.ude"
	},
	{
		suffix: "tv",
		reversed: "vt"
	},
	{
		suffix: "tw",
		reversed: "wt"
	},
	{
		suffix: "edu.tw",
		reversed: "wt.ude"
	},
	{
		suffix: "gov.tw",
		reversed: "wt.vog"
	},
	{
		suffix: "mil.tw",
		reversed: "wt.lim"
	},
	{
		suffix: "com.tw",
		reversed: "wt.moc"
	},
	{
		suffix: "net.tw",
		reversed: "wt.ten"
	},
	{
		suffix: "org.tw",
		reversed: "wt.gro"
	},
	{
		suffix: "idv.tw",
		reversed: "wt.vdi"
	},
	{
		suffix: "game.tw",
		reversed: "wt.emag"
	},
	{
		suffix: "ebiz.tw",
		reversed: "wt.zibe"
	},
	{
		suffix: "club.tw",
		reversed: "wt.bulc"
	},
	{
		suffix: "網路.tw",
		reversed: "wt.a46oa0fz--nx"
	},
	{
		suffix: "組織.tw",
		reversed: "wt.vta0cu--nx"
	},
	{
		suffix: "商業.tw",
		reversed: "wt.b82wrzc--nx"
	},
	{
		suffix: "tz",
		reversed: "zt"
	},
	{
		suffix: "ac.tz",
		reversed: "zt.ca"
	},
	{
		suffix: "co.tz",
		reversed: "zt.oc"
	},
	{
		suffix: "go.tz",
		reversed: "zt.og"
	},
	{
		suffix: "hotel.tz",
		reversed: "zt.letoh"
	},
	{
		suffix: "info.tz",
		reversed: "zt.ofni"
	},
	{
		suffix: "me.tz",
		reversed: "zt.em"
	},
	{
		suffix: "mil.tz",
		reversed: "zt.lim"
	},
	{
		suffix: "mobi.tz",
		reversed: "zt.ibom"
	},
	{
		suffix: "ne.tz",
		reversed: "zt.en"
	},
	{
		suffix: "or.tz",
		reversed: "zt.ro"
	},
	{
		suffix: "sc.tz",
		reversed: "zt.cs"
	},
	{
		suffix: "tv.tz",
		reversed: "zt.vt"
	},
	{
		suffix: "ua",
		reversed: "au"
	},
	{
		suffix: "com.ua",
		reversed: "au.moc"
	},
	{
		suffix: "edu.ua",
		reversed: "au.ude"
	},
	{
		suffix: "gov.ua",
		reversed: "au.vog"
	},
	{
		suffix: "in.ua",
		reversed: "au.ni"
	},
	{
		suffix: "net.ua",
		reversed: "au.ten"
	},
	{
		suffix: "org.ua",
		reversed: "au.gro"
	},
	{
		suffix: "cherkassy.ua",
		reversed: "au.yssakrehc"
	},
	{
		suffix: "cherkasy.ua",
		reversed: "au.ysakrehc"
	},
	{
		suffix: "chernigov.ua",
		reversed: "au.voginrehc"
	},
	{
		suffix: "chernihiv.ua",
		reversed: "au.vihinrehc"
	},
	{
		suffix: "chernivtsi.ua",
		reversed: "au.istvinrehc"
	},
	{
		suffix: "chernovtsy.ua",
		reversed: "au.ystvonrehc"
	},
	{
		suffix: "ck.ua",
		reversed: "au.kc"
	},
	{
		suffix: "cn.ua",
		reversed: "au.nc"
	},
	{
		suffix: "cr.ua",
		reversed: "au.rc"
	},
	{
		suffix: "crimea.ua",
		reversed: "au.aemirc"
	},
	{
		suffix: "cv.ua",
		reversed: "au.vc"
	},
	{
		suffix: "dn.ua",
		reversed: "au.nd"
	},
	{
		suffix: "dnepropetrovsk.ua",
		reversed: "au.ksvorteporpend"
	},
	{
		suffix: "dnipropetrovsk.ua",
		reversed: "au.ksvorteporpind"
	},
	{
		suffix: "donetsk.ua",
		reversed: "au.kstenod"
	},
	{
		suffix: "dp.ua",
		reversed: "au.pd"
	},
	{
		suffix: "if.ua",
		reversed: "au.fi"
	},
	{
		suffix: "ivano-frankivsk.ua",
		reversed: "au.ksviknarf-onavi"
	},
	{
		suffix: "kh.ua",
		reversed: "au.hk"
	},
	{
		suffix: "kharkiv.ua",
		reversed: "au.vikrahk"
	},
	{
		suffix: "kharkov.ua",
		reversed: "au.vokrahk"
	},
	{
		suffix: "kherson.ua",
		reversed: "au.nosrehk"
	},
	{
		suffix: "khmelnitskiy.ua",
		reversed: "au.yikstinlemhk"
	},
	{
		suffix: "khmelnytskyi.ua",
		reversed: "au.iykstynlemhk"
	},
	{
		suffix: "kiev.ua",
		reversed: "au.veik"
	},
	{
		suffix: "kirovograd.ua",
		reversed: "au.dargovorik"
	},
	{
		suffix: "km.ua",
		reversed: "au.mk"
	},
	{
		suffix: "kr.ua",
		reversed: "au.rk"
	},
	{
		suffix: "kropyvnytskyi.ua",
		reversed: "au.iykstynvypork"
	},
	{
		suffix: "krym.ua",
		reversed: "au.myrk"
	},
	{
		suffix: "ks.ua",
		reversed: "au.sk"
	},
	{
		suffix: "kv.ua",
		reversed: "au.vk"
	},
	{
		suffix: "kyiv.ua",
		reversed: "au.viyk"
	},
	{
		suffix: "lg.ua",
		reversed: "au.gl"
	},
	{
		suffix: "lt.ua",
		reversed: "au.tl"
	},
	{
		suffix: "lugansk.ua",
		reversed: "au.ksnagul"
	},
	{
		suffix: "lutsk.ua",
		reversed: "au.kstul"
	},
	{
		suffix: "lv.ua",
		reversed: "au.vl"
	},
	{
		suffix: "lviv.ua",
		reversed: "au.vivl"
	},
	{
		suffix: "mk.ua",
		reversed: "au.km"
	},
	{
		suffix: "mykolaiv.ua",
		reversed: "au.vialokym"
	},
	{
		suffix: "nikolaev.ua",
		reversed: "au.vealokin"
	},
	{
		suffix: "od.ua",
		reversed: "au.do"
	},
	{
		suffix: "odesa.ua",
		reversed: "au.asedo"
	},
	{
		suffix: "odessa.ua",
		reversed: "au.assedo"
	},
	{
		suffix: "pl.ua",
		reversed: "au.lp"
	},
	{
		suffix: "poltava.ua",
		reversed: "au.avatlop"
	},
	{
		suffix: "rivne.ua",
		reversed: "au.envir"
	},
	{
		suffix: "rovno.ua",
		reversed: "au.onvor"
	},
	{
		suffix: "rv.ua",
		reversed: "au.vr"
	},
	{
		suffix: "sb.ua",
		reversed: "au.bs"
	},
	{
		suffix: "sebastopol.ua",
		reversed: "au.lopotsabes"
	},
	{
		suffix: "sevastopol.ua",
		reversed: "au.lopotsaves"
	},
	{
		suffix: "sm.ua",
		reversed: "au.ms"
	},
	{
		suffix: "sumy.ua",
		reversed: "au.ymus"
	},
	{
		suffix: "te.ua",
		reversed: "au.et"
	},
	{
		suffix: "ternopil.ua",
		reversed: "au.liponret"
	},
	{
		suffix: "uz.ua",
		reversed: "au.zu"
	},
	{
		suffix: "uzhgorod.ua",
		reversed: "au.doroghzu"
	},
	{
		suffix: "vinnica.ua",
		reversed: "au.acinniv"
	},
	{
		suffix: "vinnytsia.ua",
		reversed: "au.aistynniv"
	},
	{
		suffix: "vn.ua",
		reversed: "au.nv"
	},
	{
		suffix: "volyn.ua",
		reversed: "au.nylov"
	},
	{
		suffix: "yalta.ua",
		reversed: "au.atlay"
	},
	{
		suffix: "zaporizhzhe.ua",
		reversed: "au.ehzhziropaz"
	},
	{
		suffix: "zaporizhzhia.ua",
		reversed: "au.aihzhziropaz"
	},
	{
		suffix: "zhitomir.ua",
		reversed: "au.rimotihz"
	},
	{
		suffix: "zhytomyr.ua",
		reversed: "au.rymotyhz"
	},
	{
		suffix: "zp.ua",
		reversed: "au.pz"
	},
	{
		suffix: "zt.ua",
		reversed: "au.tz"
	},
	{
		suffix: "ug",
		reversed: "gu"
	},
	{
		suffix: "co.ug",
		reversed: "gu.oc"
	},
	{
		suffix: "or.ug",
		reversed: "gu.ro"
	},
	{
		suffix: "ac.ug",
		reversed: "gu.ca"
	},
	{
		suffix: "sc.ug",
		reversed: "gu.cs"
	},
	{
		suffix: "go.ug",
		reversed: "gu.og"
	},
	{
		suffix: "ne.ug",
		reversed: "gu.en"
	},
	{
		suffix: "com.ug",
		reversed: "gu.moc"
	},
	{
		suffix: "org.ug",
		reversed: "gu.gro"
	},
	{
		suffix: "uk",
		reversed: "ku"
	},
	{
		suffix: "ac.uk",
		reversed: "ku.ca"
	},
	{
		suffix: "co.uk",
		reversed: "ku.oc"
	},
	{
		suffix: "gov.uk",
		reversed: "ku.vog"
	},
	{
		suffix: "ltd.uk",
		reversed: "ku.dtl"
	},
	{
		suffix: "me.uk",
		reversed: "ku.em"
	},
	{
		suffix: "net.uk",
		reversed: "ku.ten"
	},
	{
		suffix: "nhs.uk",
		reversed: "ku.shn"
	},
	{
		suffix: "org.uk",
		reversed: "ku.gro"
	},
	{
		suffix: "plc.uk",
		reversed: "ku.clp"
	},
	{
		suffix: "police.uk",
		reversed: "ku.ecilop"
	},
	{
		suffix: "*.sch.uk",
		reversed: "ku.hcs"
	},
	{
		suffix: "us",
		reversed: "su"
	},
	{
		suffix: "dni.us",
		reversed: "su.ind"
	},
	{
		suffix: "fed.us",
		reversed: "su.def"
	},
	{
		suffix: "isa.us",
		reversed: "su.asi"
	},
	{
		suffix: "kids.us",
		reversed: "su.sdik"
	},
	{
		suffix: "nsn.us",
		reversed: "su.nsn"
	},
	{
		suffix: "ak.us",
		reversed: "su.ka"
	},
	{
		suffix: "al.us",
		reversed: "su.la"
	},
	{
		suffix: "ar.us",
		reversed: "su.ra"
	},
	{
		suffix: "as.us",
		reversed: "su.sa"
	},
	{
		suffix: "az.us",
		reversed: "su.za"
	},
	{
		suffix: "ca.us",
		reversed: "su.ac"
	},
	{
		suffix: "co.us",
		reversed: "su.oc"
	},
	{
		suffix: "ct.us",
		reversed: "su.tc"
	},
	{
		suffix: "dc.us",
		reversed: "su.cd"
	},
	{
		suffix: "de.us",
		reversed: "su.ed"
	},
	{
		suffix: "fl.us",
		reversed: "su.lf"
	},
	{
		suffix: "ga.us",
		reversed: "su.ag"
	},
	{
		suffix: "gu.us",
		reversed: "su.ug"
	},
	{
		suffix: "hi.us",
		reversed: "su.ih"
	},
	{
		suffix: "ia.us",
		reversed: "su.ai"
	},
	{
		suffix: "id.us",
		reversed: "su.di"
	},
	{
		suffix: "il.us",
		reversed: "su.li"
	},
	{
		suffix: "in.us",
		reversed: "su.ni"
	},
	{
		suffix: "ks.us",
		reversed: "su.sk"
	},
	{
		suffix: "ky.us",
		reversed: "su.yk"
	},
	{
		suffix: "la.us",
		reversed: "su.al"
	},
	{
		suffix: "ma.us",
		reversed: "su.am"
	},
	{
		suffix: "md.us",
		reversed: "su.dm"
	},
	{
		suffix: "me.us",
		reversed: "su.em"
	},
	{
		suffix: "mi.us",
		reversed: "su.im"
	},
	{
		suffix: "mn.us",
		reversed: "su.nm"
	},
	{
		suffix: "mo.us",
		reversed: "su.om"
	},
	{
		suffix: "ms.us",
		reversed: "su.sm"
	},
	{
		suffix: "mt.us",
		reversed: "su.tm"
	},
	{
		suffix: "nc.us",
		reversed: "su.cn"
	},
	{
		suffix: "nd.us",
		reversed: "su.dn"
	},
	{
		suffix: "ne.us",
		reversed: "su.en"
	},
	{
		suffix: "nh.us",
		reversed: "su.hn"
	},
	{
		suffix: "nj.us",
		reversed: "su.jn"
	},
	{
		suffix: "nm.us",
		reversed: "su.mn"
	},
	{
		suffix: "nv.us",
		reversed: "su.vn"
	},
	{
		suffix: "ny.us",
		reversed: "su.yn"
	},
	{
		suffix: "oh.us",
		reversed: "su.ho"
	},
	{
		suffix: "ok.us",
		reversed: "su.ko"
	},
	{
		suffix: "or.us",
		reversed: "su.ro"
	},
	{
		suffix: "pa.us",
		reversed: "su.ap"
	},
	{
		suffix: "pr.us",
		reversed: "su.rp"
	},
	{
		suffix: "ri.us",
		reversed: "su.ir"
	},
	{
		suffix: "sc.us",
		reversed: "su.cs"
	},
	{
		suffix: "sd.us",
		reversed: "su.ds"
	},
	{
		suffix: "tn.us",
		reversed: "su.nt"
	},
	{
		suffix: "tx.us",
		reversed: "su.xt"
	},
	{
		suffix: "ut.us",
		reversed: "su.tu"
	},
	{
		suffix: "vi.us",
		reversed: "su.iv"
	},
	{
		suffix: "vt.us",
		reversed: "su.tv"
	},
	{
		suffix: "va.us",
		reversed: "su.av"
	},
	{
		suffix: "wa.us",
		reversed: "su.aw"
	},
	{
		suffix: "wi.us",
		reversed: "su.iw"
	},
	{
		suffix: "wv.us",
		reversed: "su.vw"
	},
	{
		suffix: "wy.us",
		reversed: "su.yw"
	},
	{
		suffix: "k12.ak.us",
		reversed: "su.ka.21k"
	},
	{
		suffix: "k12.al.us",
		reversed: "su.la.21k"
	},
	{
		suffix: "k12.ar.us",
		reversed: "su.ra.21k"
	},
	{
		suffix: "k12.as.us",
		reversed: "su.sa.21k"
	},
	{
		suffix: "k12.az.us",
		reversed: "su.za.21k"
	},
	{
		suffix: "k12.ca.us",
		reversed: "su.ac.21k"
	},
	{
		suffix: "k12.co.us",
		reversed: "su.oc.21k"
	},
	{
		suffix: "k12.ct.us",
		reversed: "su.tc.21k"
	},
	{
		suffix: "k12.dc.us",
		reversed: "su.cd.21k"
	},
	{
		suffix: "k12.de.us",
		reversed: "su.ed.21k"
	},
	{
		suffix: "k12.fl.us",
		reversed: "su.lf.21k"
	},
	{
		suffix: "k12.ga.us",
		reversed: "su.ag.21k"
	},
	{
		suffix: "k12.gu.us",
		reversed: "su.ug.21k"
	},
	{
		suffix: "k12.ia.us",
		reversed: "su.ai.21k"
	},
	{
		suffix: "k12.id.us",
		reversed: "su.di.21k"
	},
	{
		suffix: "k12.il.us",
		reversed: "su.li.21k"
	},
	{
		suffix: "k12.in.us",
		reversed: "su.ni.21k"
	},
	{
		suffix: "k12.ks.us",
		reversed: "su.sk.21k"
	},
	{
		suffix: "k12.ky.us",
		reversed: "su.yk.21k"
	},
	{
		suffix: "k12.la.us",
		reversed: "su.al.21k"
	},
	{
		suffix: "k12.ma.us",
		reversed: "su.am.21k"
	},
	{
		suffix: "k12.md.us",
		reversed: "su.dm.21k"
	},
	{
		suffix: "k12.me.us",
		reversed: "su.em.21k"
	},
	{
		suffix: "k12.mi.us",
		reversed: "su.im.21k"
	},
	{
		suffix: "k12.mn.us",
		reversed: "su.nm.21k"
	},
	{
		suffix: "k12.mo.us",
		reversed: "su.om.21k"
	},
	{
		suffix: "k12.ms.us",
		reversed: "su.sm.21k"
	},
	{
		suffix: "k12.mt.us",
		reversed: "su.tm.21k"
	},
	{
		suffix: "k12.nc.us",
		reversed: "su.cn.21k"
	},
	{
		suffix: "k12.ne.us",
		reversed: "su.en.21k"
	},
	{
		suffix: "k12.nh.us",
		reversed: "su.hn.21k"
	},
	{
		suffix: "k12.nj.us",
		reversed: "su.jn.21k"
	},
	{
		suffix: "k12.nm.us",
		reversed: "su.mn.21k"
	},
	{
		suffix: "k12.nv.us",
		reversed: "su.vn.21k"
	},
	{
		suffix: "k12.ny.us",
		reversed: "su.yn.21k"
	},
	{
		suffix: "k12.oh.us",
		reversed: "su.ho.21k"
	},
	{
		suffix: "k12.ok.us",
		reversed: "su.ko.21k"
	},
	{
		suffix: "k12.or.us",
		reversed: "su.ro.21k"
	},
	{
		suffix: "k12.pa.us",
		reversed: "su.ap.21k"
	},
	{
		suffix: "k12.pr.us",
		reversed: "su.rp.21k"
	},
	{
		suffix: "k12.sc.us",
		reversed: "su.cs.21k"
	},
	{
		suffix: "k12.tn.us",
		reversed: "su.nt.21k"
	},
	{
		suffix: "k12.tx.us",
		reversed: "su.xt.21k"
	},
	{
		suffix: "k12.ut.us",
		reversed: "su.tu.21k"
	},
	{
		suffix: "k12.vi.us",
		reversed: "su.iv.21k"
	},
	{
		suffix: "k12.vt.us",
		reversed: "su.tv.21k"
	},
	{
		suffix: "k12.va.us",
		reversed: "su.av.21k"
	},
	{
		suffix: "k12.wa.us",
		reversed: "su.aw.21k"
	},
	{
		suffix: "k12.wi.us",
		reversed: "su.iw.21k"
	},
	{
		suffix: "k12.wy.us",
		reversed: "su.yw.21k"
	},
	{
		suffix: "cc.ak.us",
		reversed: "su.ka.cc"
	},
	{
		suffix: "cc.al.us",
		reversed: "su.la.cc"
	},
	{
		suffix: "cc.ar.us",
		reversed: "su.ra.cc"
	},
	{
		suffix: "cc.as.us",
		reversed: "su.sa.cc"
	},
	{
		suffix: "cc.az.us",
		reversed: "su.za.cc"
	},
	{
		suffix: "cc.ca.us",
		reversed: "su.ac.cc"
	},
	{
		suffix: "cc.co.us",
		reversed: "su.oc.cc"
	},
	{
		suffix: "cc.ct.us",
		reversed: "su.tc.cc"
	},
	{
		suffix: "cc.dc.us",
		reversed: "su.cd.cc"
	},
	{
		suffix: "cc.de.us",
		reversed: "su.ed.cc"
	},
	{
		suffix: "cc.fl.us",
		reversed: "su.lf.cc"
	},
	{
		suffix: "cc.ga.us",
		reversed: "su.ag.cc"
	},
	{
		suffix: "cc.gu.us",
		reversed: "su.ug.cc"
	},
	{
		suffix: "cc.hi.us",
		reversed: "su.ih.cc"
	},
	{
		suffix: "cc.ia.us",
		reversed: "su.ai.cc"
	},
	{
		suffix: "cc.id.us",
		reversed: "su.di.cc"
	},
	{
		suffix: "cc.il.us",
		reversed: "su.li.cc"
	},
	{
		suffix: "cc.in.us",
		reversed: "su.ni.cc"
	},
	{
		suffix: "cc.ks.us",
		reversed: "su.sk.cc"
	},
	{
		suffix: "cc.ky.us",
		reversed: "su.yk.cc"
	},
	{
		suffix: "cc.la.us",
		reversed: "su.al.cc"
	},
	{
		suffix: "cc.ma.us",
		reversed: "su.am.cc"
	},
	{
		suffix: "cc.md.us",
		reversed: "su.dm.cc"
	},
	{
		suffix: "cc.me.us",
		reversed: "su.em.cc"
	},
	{
		suffix: "cc.mi.us",
		reversed: "su.im.cc"
	},
	{
		suffix: "cc.mn.us",
		reversed: "su.nm.cc"
	},
	{
		suffix: "cc.mo.us",
		reversed: "su.om.cc"
	},
	{
		suffix: "cc.ms.us",
		reversed: "su.sm.cc"
	},
	{
		suffix: "cc.mt.us",
		reversed: "su.tm.cc"
	},
	{
		suffix: "cc.nc.us",
		reversed: "su.cn.cc"
	},
	{
		suffix: "cc.nd.us",
		reversed: "su.dn.cc"
	},
	{
		suffix: "cc.ne.us",
		reversed: "su.en.cc"
	},
	{
		suffix: "cc.nh.us",
		reversed: "su.hn.cc"
	},
	{
		suffix: "cc.nj.us",
		reversed: "su.jn.cc"
	},
	{
		suffix: "cc.nm.us",
		reversed: "su.mn.cc"
	},
	{
		suffix: "cc.nv.us",
		reversed: "su.vn.cc"
	},
	{
		suffix: "cc.ny.us",
		reversed: "su.yn.cc"
	},
	{
		suffix: "cc.oh.us",
		reversed: "su.ho.cc"
	},
	{
		suffix: "cc.ok.us",
		reversed: "su.ko.cc"
	},
	{
		suffix: "cc.or.us",
		reversed: "su.ro.cc"
	},
	{
		suffix: "cc.pa.us",
		reversed: "su.ap.cc"
	},
	{
		suffix: "cc.pr.us",
		reversed: "su.rp.cc"
	},
	{
		suffix: "cc.ri.us",
		reversed: "su.ir.cc"
	},
	{
		suffix: "cc.sc.us",
		reversed: "su.cs.cc"
	},
	{
		suffix: "cc.sd.us",
		reversed: "su.ds.cc"
	},
	{
		suffix: "cc.tn.us",
		reversed: "su.nt.cc"
	},
	{
		suffix: "cc.tx.us",
		reversed: "su.xt.cc"
	},
	{
		suffix: "cc.ut.us",
		reversed: "su.tu.cc"
	},
	{
		suffix: "cc.vi.us",
		reversed: "su.iv.cc"
	},
	{
		suffix: "cc.vt.us",
		reversed: "su.tv.cc"
	},
	{
		suffix: "cc.va.us",
		reversed: "su.av.cc"
	},
	{
		suffix: "cc.wa.us",
		reversed: "su.aw.cc"
	},
	{
		suffix: "cc.wi.us",
		reversed: "su.iw.cc"
	},
	{
		suffix: "cc.wv.us",
		reversed: "su.vw.cc"
	},
	{
		suffix: "cc.wy.us",
		reversed: "su.yw.cc"
	},
	{
		suffix: "lib.ak.us",
		reversed: "su.ka.bil"
	},
	{
		suffix: "lib.al.us",
		reversed: "su.la.bil"
	},
	{
		suffix: "lib.ar.us",
		reversed: "su.ra.bil"
	},
	{
		suffix: "lib.as.us",
		reversed: "su.sa.bil"
	},
	{
		suffix: "lib.az.us",
		reversed: "su.za.bil"
	},
	{
		suffix: "lib.ca.us",
		reversed: "su.ac.bil"
	},
	{
		suffix: "lib.co.us",
		reversed: "su.oc.bil"
	},
	{
		suffix: "lib.ct.us",
		reversed: "su.tc.bil"
	},
	{
		suffix: "lib.dc.us",
		reversed: "su.cd.bil"
	},
	{
		suffix: "lib.fl.us",
		reversed: "su.lf.bil"
	},
	{
		suffix: "lib.ga.us",
		reversed: "su.ag.bil"
	},
	{
		suffix: "lib.gu.us",
		reversed: "su.ug.bil"
	},
	{
		suffix: "lib.hi.us",
		reversed: "su.ih.bil"
	},
	{
		suffix: "lib.ia.us",
		reversed: "su.ai.bil"
	},
	{
		suffix: "lib.id.us",
		reversed: "su.di.bil"
	},
	{
		suffix: "lib.il.us",
		reversed: "su.li.bil"
	},
	{
		suffix: "lib.in.us",
		reversed: "su.ni.bil"
	},
	{
		suffix: "lib.ks.us",
		reversed: "su.sk.bil"
	},
	{
		suffix: "lib.ky.us",
		reversed: "su.yk.bil"
	},
	{
		suffix: "lib.la.us",
		reversed: "su.al.bil"
	},
	{
		suffix: "lib.ma.us",
		reversed: "su.am.bil"
	},
	{
		suffix: "lib.md.us",
		reversed: "su.dm.bil"
	},
	{
		suffix: "lib.me.us",
		reversed: "su.em.bil"
	},
	{
		suffix: "lib.mi.us",
		reversed: "su.im.bil"
	},
	{
		suffix: "lib.mn.us",
		reversed: "su.nm.bil"
	},
	{
		suffix: "lib.mo.us",
		reversed: "su.om.bil"
	},
	{
		suffix: "lib.ms.us",
		reversed: "su.sm.bil"
	},
	{
		suffix: "lib.mt.us",
		reversed: "su.tm.bil"
	},
	{
		suffix: "lib.nc.us",
		reversed: "su.cn.bil"
	},
	{
		suffix: "lib.nd.us",
		reversed: "su.dn.bil"
	},
	{
		suffix: "lib.ne.us",
		reversed: "su.en.bil"
	},
	{
		suffix: "lib.nh.us",
		reversed: "su.hn.bil"
	},
	{
		suffix: "lib.nj.us",
		reversed: "su.jn.bil"
	},
	{
		suffix: "lib.nm.us",
		reversed: "su.mn.bil"
	},
	{
		suffix: "lib.nv.us",
		reversed: "su.vn.bil"
	},
	{
		suffix: "lib.ny.us",
		reversed: "su.yn.bil"
	},
	{
		suffix: "lib.oh.us",
		reversed: "su.ho.bil"
	},
	{
		suffix: "lib.ok.us",
		reversed: "su.ko.bil"
	},
	{
		suffix: "lib.or.us",
		reversed: "su.ro.bil"
	},
	{
		suffix: "lib.pa.us",
		reversed: "su.ap.bil"
	},
	{
		suffix: "lib.pr.us",
		reversed: "su.rp.bil"
	},
	{
		suffix: "lib.ri.us",
		reversed: "su.ir.bil"
	},
	{
		suffix: "lib.sc.us",
		reversed: "su.cs.bil"
	},
	{
		suffix: "lib.sd.us",
		reversed: "su.ds.bil"
	},
	{
		suffix: "lib.tn.us",
		reversed: "su.nt.bil"
	},
	{
		suffix: "lib.tx.us",
		reversed: "su.xt.bil"
	},
	{
		suffix: "lib.ut.us",
		reversed: "su.tu.bil"
	},
	{
		suffix: "lib.vi.us",
		reversed: "su.iv.bil"
	},
	{
		suffix: "lib.vt.us",
		reversed: "su.tv.bil"
	},
	{
		suffix: "lib.va.us",
		reversed: "su.av.bil"
	},
	{
		suffix: "lib.wa.us",
		reversed: "su.aw.bil"
	},
	{
		suffix: "lib.wi.us",
		reversed: "su.iw.bil"
	},
	{
		suffix: "lib.wy.us",
		reversed: "su.yw.bil"
	},
	{
		suffix: "pvt.k12.ma.us",
		reversed: "su.am.21k.tvp"
	},
	{
		suffix: "chtr.k12.ma.us",
		reversed: "su.am.21k.rthc"
	},
	{
		suffix: "paroch.k12.ma.us",
		reversed: "su.am.21k.hcorap"
	},
	{
		suffix: "ann-arbor.mi.us",
		reversed: "su.im.robra-nna"
	},
	{
		suffix: "cog.mi.us",
		reversed: "su.im.goc"
	},
	{
		suffix: "dst.mi.us",
		reversed: "su.im.tsd"
	},
	{
		suffix: "eaton.mi.us",
		reversed: "su.im.notae"
	},
	{
		suffix: "gen.mi.us",
		reversed: "su.im.neg"
	},
	{
		suffix: "mus.mi.us",
		reversed: "su.im.sum"
	},
	{
		suffix: "tec.mi.us",
		reversed: "su.im.cet"
	},
	{
		suffix: "washtenaw.mi.us",
		reversed: "su.im.wanethsaw"
	},
	{
		suffix: "uy",
		reversed: "yu"
	},
	{
		suffix: "com.uy",
		reversed: "yu.moc"
	},
	{
		suffix: "edu.uy",
		reversed: "yu.ude"
	},
	{
		suffix: "gub.uy",
		reversed: "yu.bug"
	},
	{
		suffix: "mil.uy",
		reversed: "yu.lim"
	},
	{
		suffix: "net.uy",
		reversed: "yu.ten"
	},
	{
		suffix: "org.uy",
		reversed: "yu.gro"
	},
	{
		suffix: "uz",
		reversed: "zu"
	},
	{
		suffix: "co.uz",
		reversed: "zu.oc"
	},
	{
		suffix: "com.uz",
		reversed: "zu.moc"
	},
	{
		suffix: "net.uz",
		reversed: "zu.ten"
	},
	{
		suffix: "org.uz",
		reversed: "zu.gro"
	},
	{
		suffix: "va",
		reversed: "av"
	},
	{
		suffix: "vc",
		reversed: "cv"
	},
	{
		suffix: "com.vc",
		reversed: "cv.moc"
	},
	{
		suffix: "net.vc",
		reversed: "cv.ten"
	},
	{
		suffix: "org.vc",
		reversed: "cv.gro"
	},
	{
		suffix: "gov.vc",
		reversed: "cv.vog"
	},
	{
		suffix: "mil.vc",
		reversed: "cv.lim"
	},
	{
		suffix: "edu.vc",
		reversed: "cv.ude"
	},
	{
		suffix: "ve",
		reversed: "ev"
	},
	{
		suffix: "arts.ve",
		reversed: "ev.stra"
	},
	{
		suffix: "bib.ve",
		reversed: "ev.bib"
	},
	{
		suffix: "co.ve",
		reversed: "ev.oc"
	},
	{
		suffix: "com.ve",
		reversed: "ev.moc"
	},
	{
		suffix: "e12.ve",
		reversed: "ev.21e"
	},
	{
		suffix: "edu.ve",
		reversed: "ev.ude"
	},
	{
		suffix: "firm.ve",
		reversed: "ev.mrif"
	},
	{
		suffix: "gob.ve",
		reversed: "ev.bog"
	},
	{
		suffix: "gov.ve",
		reversed: "ev.vog"
	},
	{
		suffix: "info.ve",
		reversed: "ev.ofni"
	},
	{
		suffix: "int.ve",
		reversed: "ev.tni"
	},
	{
		suffix: "mil.ve",
		reversed: "ev.lim"
	},
	{
		suffix: "net.ve",
		reversed: "ev.ten"
	},
	{
		suffix: "nom.ve",
		reversed: "ev.mon"
	},
	{
		suffix: "org.ve",
		reversed: "ev.gro"
	},
	{
		suffix: "rar.ve",
		reversed: "ev.rar"
	},
	{
		suffix: "rec.ve",
		reversed: "ev.cer"
	},
	{
		suffix: "store.ve",
		reversed: "ev.erots"
	},
	{
		suffix: "tec.ve",
		reversed: "ev.cet"
	},
	{
		suffix: "web.ve",
		reversed: "ev.bew"
	},
	{
		suffix: "vg",
		reversed: "gv"
	},
	{
		suffix: "vi",
		reversed: "iv"
	},
	{
		suffix: "co.vi",
		reversed: "iv.oc"
	},
	{
		suffix: "com.vi",
		reversed: "iv.moc"
	},
	{
		suffix: "k12.vi",
		reversed: "iv.21k"
	},
	{
		suffix: "net.vi",
		reversed: "iv.ten"
	},
	{
		suffix: "org.vi",
		reversed: "iv.gro"
	},
	{
		suffix: "vn",
		reversed: "nv"
	},
	{
		suffix: "com.vn",
		reversed: "nv.moc"
	},
	{
		suffix: "net.vn",
		reversed: "nv.ten"
	},
	{
		suffix: "org.vn",
		reversed: "nv.gro"
	},
	{
		suffix: "edu.vn",
		reversed: "nv.ude"
	},
	{
		suffix: "gov.vn",
		reversed: "nv.vog"
	},
	{
		suffix: "int.vn",
		reversed: "nv.tni"
	},
	{
		suffix: "ac.vn",
		reversed: "nv.ca"
	},
	{
		suffix: "biz.vn",
		reversed: "nv.zib"
	},
	{
		suffix: "info.vn",
		reversed: "nv.ofni"
	},
	{
		suffix: "name.vn",
		reversed: "nv.eman"
	},
	{
		suffix: "pro.vn",
		reversed: "nv.orp"
	},
	{
		suffix: "health.vn",
		reversed: "nv.htlaeh"
	},
	{
		suffix: "vu",
		reversed: "uv"
	},
	{
		suffix: "com.vu",
		reversed: "uv.moc"
	},
	{
		suffix: "edu.vu",
		reversed: "uv.ude"
	},
	{
		suffix: "net.vu",
		reversed: "uv.ten"
	},
	{
		suffix: "org.vu",
		reversed: "uv.gro"
	},
	{
		suffix: "wf",
		reversed: "fw"
	},
	{
		suffix: "ws",
		reversed: "sw"
	},
	{
		suffix: "com.ws",
		reversed: "sw.moc"
	},
	{
		suffix: "net.ws",
		reversed: "sw.ten"
	},
	{
		suffix: "org.ws",
		reversed: "sw.gro"
	},
	{
		suffix: "gov.ws",
		reversed: "sw.vog"
	},
	{
		suffix: "edu.ws",
		reversed: "sw.ude"
	},
	{
		suffix: "yt",
		reversed: "ty"
	},
	{
		suffix: "امارات",
		reversed: "h8a7maabgm--nx"
	},
	{
		suffix: "հայ",
		reversed: "qa3a9y--nx"
	},
	{
		suffix: "বাংলা",
		reversed: "cc0atf7b45--nx"
	},
	{
		suffix: "бг",
		reversed: "ea09--nx"
	},
	{
		suffix: "البحرين",
		reversed: "a1apg6qpcbgm--nx"
	},
	{
		suffix: "бел",
		reversed: "sia09--nx"
	},
	{
		suffix: "中国",
		reversed: "s8sqif--nx"
	},
	{
		suffix: "中國",
		reversed: "s9zqif--nx"
	},
	{
		suffix: "الجزائر",
		reversed: "j8da1tabbgl--nx"
	},
	{
		suffix: "مصر",
		reversed: "c1hbgw--nx"
	},
	{
		suffix: "ею",
		reversed: "c4a1e--nx"
	},
	{
		suffix: "ευ",
		reversed: "a6axq--nx"
	},
	{
		suffix: "موريتانيا",
		reversed: "drkjh3a1habgm--nx"
	},
	{
		suffix: "გე",
		reversed: "edon--nx"
	},
	{
		suffix: "ελ",
		reversed: "maxq--nx"
	},
	{
		suffix: "香港",
		reversed: "g391w6j--nx"
	},
	{
		suffix: "公司.香港",
		reversed: "g391w6j--nx.d5xq55--nx"
	},
	{
		suffix: "教育.香港",
		reversed: "g391w6j--nx.d22svcw--nx"
	},
	{
		suffix: "政府.香港",
		reversed: "g391w6j--nx.m1qtxm--nx"
	},
	{
		suffix: "個人.香港",
		reversed: "g391w6j--nx.a5wqmg--nx"
	},
	{
		suffix: "網絡.香港",
		reversed: "g391w6j--nx.gla0do--nx"
	},
	{
		suffix: "組織.香港",
		reversed: "g391w6j--nx.vta0cu--nx"
	},
	{
		suffix: "ಭಾರತ",
		reversed: "c9jrcs2--nx"
	},
	{
		suffix: "ଭାରତ",
		reversed: "c9jrch3--nx"
	},
	{
		suffix: "ভাৰত",
		reversed: "lyc5rb54--nx"
	},
	{
		suffix: "भारतम्",
		reversed: "eve3gerb2h--nx"
	},
	{
		suffix: "भारोत",
		reversed: "c8c9jrb2h--nx"
	},
	{
		suffix: "ڀارت",
		reversed: "a28ugbgm--nx"
	},
	{
		suffix: "ഭാരതം",
		reversed: "e3ma0e1cvr--nx"
	},
	{
		suffix: "भारत",
		reversed: "c9jrb2h--nx"
	},
	{
		suffix: "بارت",
		reversed: "a1hbbgm--nx"
	},
	{
		suffix: "بھارت",
		reversed: "e17a1hbbgm--nx"
	},
	{
		suffix: "భారత్",
		reversed: "d3c9jrcpf--nx"
	},
	{
		suffix: "ભારત",
		reversed: "c9jrceg--nx"
	},
	{
		suffix: "ਭਾਰਤ",
		reversed: "c9jrb9s--nx"
	},
	{
		suffix: "ভারত",
		reversed: "c9jrb54--nx"
	},
	{
		suffix: "இந்தியா",
		reversed: "h0ee5a3ld2ckx--nx"
	},
	{
		suffix: "ایران",
		reversed: "a61f4a3abgm--nx"
	},
	{
		suffix: "ايران",
		reversed: "arf4a3abgm--nx"
	},
	{
		suffix: "عراق",
		reversed: "b2xtbgm--nx"
	},
	{
		suffix: "الاردن",
		reversed: "apg7hyabgm--nx"
	},
	{
		suffix: "한국",
		reversed: "e707b0e3--nx"
	},
	{
		suffix: "қаз",
		reversed: "a12oa08--nx"
	},
	{
		suffix: "ລາວ",
		reversed: "a6ec7q--nx"
	},
	{
		suffix: "ලංකා",
		reversed: "c2e9c2czf--nx"
	},
	{
		suffix: "இலங்கை",
		reversed: "a2eyh3la2ckx--nx"
	},
	{
		suffix: "المغرب",
		reversed: "gcza9a0cbgm--nx"
	},
	{
		suffix: "мкд",
		reversed: "fla1d--nx"
	},
	{
		suffix: "мон",
		reversed: "cca1l--nx"
	},
	{
		suffix: "澳門",
		reversed: "f198xim--nx"
	},
	{
		suffix: "澳门",
		reversed: "f280xim--nx"
	},
	{
		suffix: "مليسيا",
		reversed: "ba0dc4xbgm--nx"
	},
	{
		suffix: "عمان",
		reversed: "fbwa9bgm--nx"
	},
	{
		suffix: "پاکستان",
		reversed: "j6pqgza9iabgm--nx"
	},
	{
		suffix: "پاكستان",
		reversed: "b00ave5a9iabgm--nx"
	},
	{
		suffix: "فلسطين",
		reversed: "xmma2ibgy--nx"
	},
	{
		suffix: "срб",
		reversed: "ca3a09--nx"
	},
	{
		suffix: "пр.срб",
		reversed: "ca3a09--nx.ca1o--nx"
	},
	{
		suffix: "орг.срб",
		reversed: "ca3a09--nx.gva1c--nx"
	},
	{
		suffix: "обр.срб",
		reversed: "ca3a09--nx.hza09--nx"
	},
	{
		suffix: "од.срб",
		reversed: "ca3a09--nx.ta1d--nx"
	},
	{
		suffix: "упр.срб",
		reversed: "ca3a09--nx.hca1o--nx"
	},
	{
		suffix: "ак.срб",
		reversed: "ca3a09--nx.ua08--nx"
	},
	{
		suffix: "рф",
		reversed: "ia1p--nx"
	},
	{
		suffix: "قطر",
		reversed: "a6lbgw--nx"
	},
	{
		suffix: "السعودية",
		reversed: "ra4d5a4prebgm--nx"
	},
	{
		suffix: "السعودیة",
		reversed: "g78a4d5a4prebgm--nx"
	},
	{
		suffix: "السعودیۃ",
		reversed: "cbf76a0c7ylqbgm--nx"
	},
	{
		suffix: "السعوديه",
		reversed: "rfavc7ylqbgm--nx"
	},
	{
		suffix: "سودان",
		reversed: "hf2lpbgm--nx"
	},
	{
		suffix: "新加坡",
		reversed: "o76i4orfy--nx"
	},
	{
		suffix: "சிங்கப்பூர்",
		reversed: "dcg9a2g2b0ae0chclc--nx"
	},
	{
		suffix: "سورية",
		reversed: "lf8fpbgo--nx"
	},
	{
		suffix: "سوريا",
		reversed: "lf8ftbgm--nx"
	},
	{
		suffix: "ไทย",
		reversed: "h4wc3o--nx"
	},
	{
		suffix: "ศึกษา.ไทย",
		reversed: "h4wc3o--nx.rb0ef1c21--nx"
	},
	{
		suffix: "ธุรกิจ.ไทย",
		reversed: "h4wc3o--nx.ave4b3c0oc21--nx"
	},
	{
		suffix: "รัฐบาล.ไทย",
		reversed: "h4wc3o--nx.id1kzuc3h--nx"
	},
	{
		suffix: "ทหาร.ไทย",
		reversed: "h4wc3o--nx.a2xyc3o--nx"
	},
	{
		suffix: "เน็ต.ไทย",
		reversed: "h4wc3o--nx.a3j0hc3m--nx"
	},
	{
		suffix: "องค์กร.ไทย",
		reversed: "h4wc3o--nx.l8bxi8ifc21--nx"
	},
	{
		suffix: "تونس",
		reversed: "hd0sbgp--nx"
	},
	{
		suffix: "台灣",
		reversed: "d75yrpk--nx"
	},
	{
		suffix: "台湾",
		reversed: "d31wrpk--nx"
	},
	{
		suffix: "臺灣",
		reversed: "a883xnn--nx"
	},
	{
		suffix: "укр",
		reversed: "hma1j--nx"
	},
	{
		suffix: "اليمن",
		reversed: "sedd2bgm--nx"
	},
	{
		suffix: "xxx",
		reversed: "xxx"
	},
	{
		suffix: "ye",
		reversed: "ey"
	},
	{
		suffix: "com.ye",
		reversed: "ey.moc"
	},
	{
		suffix: "edu.ye",
		reversed: "ey.ude"
	},
	{
		suffix: "gov.ye",
		reversed: "ey.vog"
	},
	{
		suffix: "net.ye",
		reversed: "ey.ten"
	},
	{
		suffix: "mil.ye",
		reversed: "ey.lim"
	},
	{
		suffix: "org.ye",
		reversed: "ey.gro"
	},
	{
		suffix: "ac.za",
		reversed: "az.ca"
	},
	{
		suffix: "agric.za",
		reversed: "az.cirga"
	},
	{
		suffix: "alt.za",
		reversed: "az.tla"
	},
	{
		suffix: "co.za",
		reversed: "az.oc"
	},
	{
		suffix: "edu.za",
		reversed: "az.ude"
	},
	{
		suffix: "gov.za",
		reversed: "az.vog"
	},
	{
		suffix: "grondar.za",
		reversed: "az.radnorg"
	},
	{
		suffix: "law.za",
		reversed: "az.wal"
	},
	{
		suffix: "mil.za",
		reversed: "az.lim"
	},
	{
		suffix: "net.za",
		reversed: "az.ten"
	},
	{
		suffix: "ngo.za",
		reversed: "az.ogn"
	},
	{
		suffix: "nic.za",
		reversed: "az.cin"
	},
	{
		suffix: "nis.za",
		reversed: "az.sin"
	},
	{
		suffix: "nom.za",
		reversed: "az.mon"
	},
	{
		suffix: "org.za",
		reversed: "az.gro"
	},
	{
		suffix: "school.za",
		reversed: "az.loohcs"
	},
	{
		suffix: "tm.za",
		reversed: "az.mt"
	},
	{
		suffix: "web.za",
		reversed: "az.bew"
	},
	{
		suffix: "zm",
		reversed: "mz"
	},
	{
		suffix: "ac.zm",
		reversed: "mz.ca"
	},
	{
		suffix: "biz.zm",
		reversed: "mz.zib"
	},
	{
		suffix: "co.zm",
		reversed: "mz.oc"
	},
	{
		suffix: "com.zm",
		reversed: "mz.moc"
	},
	{
		suffix: "edu.zm",
		reversed: "mz.ude"
	},
	{
		suffix: "gov.zm",
		reversed: "mz.vog"
	},
	{
		suffix: "info.zm",
		reversed: "mz.ofni"
	},
	{
		suffix: "mil.zm",
		reversed: "mz.lim"
	},
	{
		suffix: "net.zm",
		reversed: "mz.ten"
	},
	{
		suffix: "org.zm",
		reversed: "mz.gro"
	},
	{
		suffix: "sch.zm",
		reversed: "mz.hcs"
	},
	{
		suffix: "zw",
		reversed: "wz"
	},
	{
		suffix: "ac.zw",
		reversed: "wz.ca"
	},
	{
		suffix: "co.zw",
		reversed: "wz.oc"
	},
	{
		suffix: "gov.zw",
		reversed: "wz.vog"
	},
	{
		suffix: "mil.zw",
		reversed: "wz.lim"
	},
	{
		suffix: "org.zw",
		reversed: "wz.gro"
	},
	{
		suffix: "aaa",
		reversed: "aaa"
	},
	{
		suffix: "aarp",
		reversed: "praa"
	},
	{
		suffix: "abarth",
		reversed: "htraba"
	},
	{
		suffix: "abb",
		reversed: "bba"
	},
	{
		suffix: "abbott",
		reversed: "ttobba"
	},
	{
		suffix: "abbvie",
		reversed: "eivbba"
	},
	{
		suffix: "abc",
		reversed: "cba"
	},
	{
		suffix: "able",
		reversed: "elba"
	},
	{
		suffix: "abogado",
		reversed: "odagoba"
	},
	{
		suffix: "abudhabi",
		reversed: "ibahduba"
	},
	{
		suffix: "academy",
		reversed: "ymedaca"
	},
	{
		suffix: "accenture",
		reversed: "erutnecca"
	},
	{
		suffix: "accountant",
		reversed: "tnatnuocca"
	},
	{
		suffix: "accountants",
		reversed: "stnatnuocca"
	},
	{
		suffix: "aco",
		reversed: "oca"
	},
	{
		suffix: "actor",
		reversed: "rotca"
	},
	{
		suffix: "ads",
		reversed: "sda"
	},
	{
		suffix: "adult",
		reversed: "tluda"
	},
	{
		suffix: "aeg",
		reversed: "gea"
	},
	{
		suffix: "aetna",
		reversed: "antea"
	},
	{
		suffix: "afl",
		reversed: "lfa"
	},
	{
		suffix: "africa",
		reversed: "acirfa"
	},
	{
		suffix: "agakhan",
		reversed: "nahkaga"
	},
	{
		suffix: "agency",
		reversed: "ycnega"
	},
	{
		suffix: "aig",
		reversed: "gia"
	},
	{
		suffix: "airbus",
		reversed: "subria"
	},
	{
		suffix: "airforce",
		reversed: "ecrofria"
	},
	{
		suffix: "airtel",
		reversed: "letria"
	},
	{
		suffix: "akdn",
		reversed: "ndka"
	},
	{
		suffix: "alfaromeo",
		reversed: "oemorafla"
	},
	{
		suffix: "alibaba",
		reversed: "ababila"
	},
	{
		suffix: "alipay",
		reversed: "yapila"
	},
	{
		suffix: "allfinanz",
		reversed: "znaniflla"
	},
	{
		suffix: "allstate",
		reversed: "etatslla"
	},
	{
		suffix: "ally",
		reversed: "ylla"
	},
	{
		suffix: "alsace",
		reversed: "ecasla"
	},
	{
		suffix: "alstom",
		reversed: "motsla"
	},
	{
		suffix: "amazon",
		reversed: "nozama"
	},
	{
		suffix: "americanexpress",
		reversed: "sserpxenacirema"
	},
	{
		suffix: "americanfamily",
		reversed: "ylimafnacirema"
	},
	{
		suffix: "amex",
		reversed: "xema"
	},
	{
		suffix: "amfam",
		reversed: "mafma"
	},
	{
		suffix: "amica",
		reversed: "acima"
	},
	{
		suffix: "amsterdam",
		reversed: "madretsma"
	},
	{
		suffix: "analytics",
		reversed: "scitylana"
	},
	{
		suffix: "android",
		reversed: "diordna"
	},
	{
		suffix: "anquan",
		reversed: "nauqna"
	},
	{
		suffix: "anz",
		reversed: "zna"
	},
	{
		suffix: "aol",
		reversed: "loa"
	},
	{
		suffix: "apartments",
		reversed: "stnemtrapa"
	},
	{
		suffix: "app",
		reversed: "ppa"
	},
	{
		suffix: "apple",
		reversed: "elppa"
	},
	{
		suffix: "aquarelle",
		reversed: "ellerauqa"
	},
	{
		suffix: "arab",
		reversed: "bara"
	},
	{
		suffix: "aramco",
		reversed: "ocmara"
	},
	{
		suffix: "archi",
		reversed: "ihcra"
	},
	{
		suffix: "army",
		reversed: "ymra"
	},
	{
		suffix: "art",
		reversed: "tra"
	},
	{
		suffix: "arte",
		reversed: "etra"
	},
	{
		suffix: "asda",
		reversed: "adsa"
	},
	{
		suffix: "associates",
		reversed: "setaicossa"
	},
	{
		suffix: "athleta",
		reversed: "atelhta"
	},
	{
		suffix: "attorney",
		reversed: "yenrotta"
	},
	{
		suffix: "auction",
		reversed: "noitcua"
	},
	{
		suffix: "audi",
		reversed: "idua"
	},
	{
		suffix: "audible",
		reversed: "elbidua"
	},
	{
		suffix: "audio",
		reversed: "oidua"
	},
	{
		suffix: "auspost",
		reversed: "tsopsua"
	},
	{
		suffix: "author",
		reversed: "rohtua"
	},
	{
		suffix: "auto",
		reversed: "otua"
	},
	{
		suffix: "autos",
		reversed: "sotua"
	},
	{
		suffix: "avianca",
		reversed: "acnaiva"
	},
	{
		suffix: "aws",
		reversed: "swa"
	},
	{
		suffix: "axa",
		reversed: "axa"
	},
	{
		suffix: "azure",
		reversed: "eruza"
	},
	{
		suffix: "baby",
		reversed: "ybab"
	},
	{
		suffix: "baidu",
		reversed: "udiab"
	},
	{
		suffix: "banamex",
		reversed: "xemanab"
	},
	{
		suffix: "bananarepublic",
		reversed: "cilbuperananab"
	},
	{
		suffix: "band",
		reversed: "dnab"
	},
	{
		suffix: "bank",
		reversed: "knab"
	},
	{
		suffix: "bar",
		reversed: "rab"
	},
	{
		suffix: "barcelona",
		reversed: "anolecrab"
	},
	{
		suffix: "barclaycard",
		reversed: "dracyalcrab"
	},
	{
		suffix: "barclays",
		reversed: "syalcrab"
	},
	{
		suffix: "barefoot",
		reversed: "tooferab"
	},
	{
		suffix: "bargains",
		reversed: "sniagrab"
	},
	{
		suffix: "baseball",
		reversed: "llabesab"
	},
	{
		suffix: "basketball",
		reversed: "llabteksab"
	},
	{
		suffix: "bauhaus",
		reversed: "suahuab"
	},
	{
		suffix: "bayern",
		reversed: "nreyab"
	},
	{
		suffix: "bbc",
		reversed: "cbb"
	},
	{
		suffix: "bbt",
		reversed: "tbb"
	},
	{
		suffix: "bbva",
		reversed: "avbb"
	},
	{
		suffix: "bcg",
		reversed: "gcb"
	},
	{
		suffix: "bcn",
		reversed: "ncb"
	},
	{
		suffix: "beats",
		reversed: "staeb"
	},
	{
		suffix: "beauty",
		reversed: "ytuaeb"
	},
	{
		suffix: "beer",
		reversed: "reeb"
	},
	{
		suffix: "bentley",
		reversed: "yeltneb"
	},
	{
		suffix: "berlin",
		reversed: "nilreb"
	},
	{
		suffix: "best",
		reversed: "tseb"
	},
	{
		suffix: "bestbuy",
		reversed: "yubtseb"
	},
	{
		suffix: "bet",
		reversed: "teb"
	},
	{
		suffix: "bharti",
		reversed: "itrahb"
	},
	{
		suffix: "bible",
		reversed: "elbib"
	},
	{
		suffix: "bid",
		reversed: "dib"
	},
	{
		suffix: "bike",
		reversed: "ekib"
	},
	{
		suffix: "bing",
		reversed: "gnib"
	},
	{
		suffix: "bingo",
		reversed: "ognib"
	},
	{
		suffix: "bio",
		reversed: "oib"
	},
	{
		suffix: "black",
		reversed: "kcalb"
	},
	{
		suffix: "blackfriday",
		reversed: "yadirfkcalb"
	},
	{
		suffix: "blockbuster",
		reversed: "retsubkcolb"
	},
	{
		suffix: "blog",
		reversed: "golb"
	},
	{
		suffix: "bloomberg",
		reversed: "grebmoolb"
	},
	{
		suffix: "blue",
		reversed: "eulb"
	},
	{
		suffix: "bms",
		reversed: "smb"
	},
	{
		suffix: "bmw",
		reversed: "wmb"
	},
	{
		suffix: "bnpparibas",
		reversed: "sabirappnb"
	},
	{
		suffix: "boats",
		reversed: "staob"
	},
	{
		suffix: "boehringer",
		reversed: "regnirheob"
	},
	{
		suffix: "bofa",
		reversed: "afob"
	},
	{
		suffix: "bom",
		reversed: "mob"
	},
	{
		suffix: "bond",
		reversed: "dnob"
	},
	{
		suffix: "boo",
		reversed: "oob"
	},
	{
		suffix: "book",
		reversed: "koob"
	},
	{
		suffix: "booking",
		reversed: "gnikoob"
	},
	{
		suffix: "bosch",
		reversed: "hcsob"
	},
	{
		suffix: "bostik",
		reversed: "kitsob"
	},
	{
		suffix: "boston",
		reversed: "notsob"
	},
	{
		suffix: "bot",
		reversed: "tob"
	},
	{
		suffix: "boutique",
		reversed: "euqituob"
	},
	{
		suffix: "box",
		reversed: "xob"
	},
	{
		suffix: "bradesco",
		reversed: "ocsedarb"
	},
	{
		suffix: "bridgestone",
		reversed: "enotsegdirb"
	},
	{
		suffix: "broadway",
		reversed: "yawdaorb"
	},
	{
		suffix: "broker",
		reversed: "rekorb"
	},
	{
		suffix: "brother",
		reversed: "rehtorb"
	},
	{
		suffix: "brussels",
		reversed: "slessurb"
	},
	{
		suffix: "build",
		reversed: "dliub"
	},
	{
		suffix: "builders",
		reversed: "sredliub"
	},
	{
		suffix: "business",
		reversed: "ssenisub"
	},
	{
		suffix: "buy",
		reversed: "yub"
	},
	{
		suffix: "buzz",
		reversed: "zzub"
	},
	{
		suffix: "bzh",
		reversed: "hzb"
	},
	{
		suffix: "cab",
		reversed: "bac"
	},
	{
		suffix: "cafe",
		reversed: "efac"
	},
	{
		suffix: "cal",
		reversed: "lac"
	},
	{
		suffix: "call",
		reversed: "llac"
	},
	{
		suffix: "calvinklein",
		reversed: "nielknivlac"
	},
	{
		suffix: "cam",
		reversed: "mac"
	},
	{
		suffix: "camera",
		reversed: "aremac"
	},
	{
		suffix: "camp",
		reversed: "pmac"
	},
	{
		suffix: "canon",
		reversed: "nonac"
	},
	{
		suffix: "capetown",
		reversed: "nwotepac"
	},
	{
		suffix: "capital",
		reversed: "latipac"
	},
	{
		suffix: "capitalone",
		reversed: "enolatipac"
	},
	{
		suffix: "car",
		reversed: "rac"
	},
	{
		suffix: "caravan",
		reversed: "navarac"
	},
	{
		suffix: "cards",
		reversed: "sdrac"
	},
	{
		suffix: "care",
		reversed: "erac"
	},
	{
		suffix: "career",
		reversed: "reerac"
	},
	{
		suffix: "careers",
		reversed: "sreerac"
	},
	{
		suffix: "cars",
		reversed: "srac"
	},
	{
		suffix: "casa",
		reversed: "asac"
	},
	{
		suffix: "case",
		reversed: "esac"
	},
	{
		suffix: "cash",
		reversed: "hsac"
	},
	{
		suffix: "casino",
		reversed: "onisac"
	},
	{
		suffix: "catering",
		reversed: "gniretac"
	},
	{
		suffix: "catholic",
		reversed: "cilohtac"
	},
	{
		suffix: "cba",
		reversed: "abc"
	},
	{
		suffix: "cbn",
		reversed: "nbc"
	},
	{
		suffix: "cbre",
		reversed: "erbc"
	},
	{
		suffix: "cbs",
		reversed: "sbc"
	},
	{
		suffix: "center",
		reversed: "retnec"
	},
	{
		suffix: "ceo",
		reversed: "oec"
	},
	{
		suffix: "cern",
		reversed: "nrec"
	},
	{
		suffix: "cfa",
		reversed: "afc"
	},
	{
		suffix: "cfd",
		reversed: "dfc"
	},
	{
		suffix: "chanel",
		reversed: "lenahc"
	},
	{
		suffix: "channel",
		reversed: "lennahc"
	},
	{
		suffix: "charity",
		reversed: "ytirahc"
	},
	{
		suffix: "chase",
		reversed: "esahc"
	},
	{
		suffix: "chat",
		reversed: "tahc"
	},
	{
		suffix: "cheap",
		reversed: "paehc"
	},
	{
		suffix: "chintai",
		reversed: "iatnihc"
	},
	{
		suffix: "christmas",
		reversed: "samtsirhc"
	},
	{
		suffix: "chrome",
		reversed: "emorhc"
	},
	{
		suffix: "church",
		reversed: "hcruhc"
	},
	{
		suffix: "cipriani",
		reversed: "inairpic"
	},
	{
		suffix: "circle",
		reversed: "elcric"
	},
	{
		suffix: "cisco",
		reversed: "ocsic"
	},
	{
		suffix: "citadel",
		reversed: "ledatic"
	},
	{
		suffix: "citi",
		reversed: "itic"
	},
	{
		suffix: "citic",
		reversed: "citic"
	},
	{
		suffix: "city",
		reversed: "ytic"
	},
	{
		suffix: "cityeats",
		reversed: "staeytic"
	},
	{
		suffix: "claims",
		reversed: "smialc"
	},
	{
		suffix: "cleaning",
		reversed: "gninaelc"
	},
	{
		suffix: "click",
		reversed: "kcilc"
	},
	{
		suffix: "clinic",
		reversed: "cinilc"
	},
	{
		suffix: "clinique",
		reversed: "euqinilc"
	},
	{
		suffix: "clothing",
		reversed: "gnihtolc"
	},
	{
		suffix: "cloud",
		reversed: "duolc"
	},
	{
		suffix: "club",
		reversed: "bulc"
	},
	{
		suffix: "clubmed",
		reversed: "dembulc"
	},
	{
		suffix: "coach",
		reversed: "hcaoc"
	},
	{
		suffix: "codes",
		reversed: "sedoc"
	},
	{
		suffix: "coffee",
		reversed: "eeffoc"
	},
	{
		suffix: "college",
		reversed: "egelloc"
	},
	{
		suffix: "cologne",
		reversed: "engoloc"
	},
	{
		suffix: "comcast",
		reversed: "tsacmoc"
	},
	{
		suffix: "commbank",
		reversed: "knabmmoc"
	},
	{
		suffix: "community",
		reversed: "ytinummoc"
	},
	{
		suffix: "company",
		reversed: "ynapmoc"
	},
	{
		suffix: "compare",
		reversed: "erapmoc"
	},
	{
		suffix: "computer",
		reversed: "retupmoc"
	},
	{
		suffix: "comsec",
		reversed: "cesmoc"
	},
	{
		suffix: "condos",
		reversed: "sodnoc"
	},
	{
		suffix: "construction",
		reversed: "noitcurtsnoc"
	},
	{
		suffix: "consulting",
		reversed: "gnitlusnoc"
	},
	{
		suffix: "contact",
		reversed: "tcatnoc"
	},
	{
		suffix: "contractors",
		reversed: "srotcartnoc"
	},
	{
		suffix: "cooking",
		reversed: "gnikooc"
	},
	{
		suffix: "cookingchannel",
		reversed: "lennahcgnikooc"
	},
	{
		suffix: "cool",
		reversed: "looc"
	},
	{
		suffix: "corsica",
		reversed: "acisroc"
	},
	{
		suffix: "country",
		reversed: "yrtnuoc"
	},
	{
		suffix: "coupon",
		reversed: "nopuoc"
	},
	{
		suffix: "coupons",
		reversed: "snopuoc"
	},
	{
		suffix: "courses",
		reversed: "sesruoc"
	},
	{
		suffix: "cpa",
		reversed: "apc"
	},
	{
		suffix: "credit",
		reversed: "tiderc"
	},
	{
		suffix: "creditcard",
		reversed: "dractiderc"
	},
	{
		suffix: "creditunion",
		reversed: "noinutiderc"
	},
	{
		suffix: "cricket",
		reversed: "tekcirc"
	},
	{
		suffix: "crown",
		reversed: "nworc"
	},
	{
		suffix: "crs",
		reversed: "src"
	},
	{
		suffix: "cruise",
		reversed: "esiurc"
	},
	{
		suffix: "cruises",
		reversed: "sesiurc"
	},
	{
		suffix: "cuisinella",
		reversed: "allenisiuc"
	},
	{
		suffix: "cymru",
		reversed: "urmyc"
	},
	{
		suffix: "cyou",
		reversed: "uoyc"
	},
	{
		suffix: "dabur",
		reversed: "rubad"
	},
	{
		suffix: "dad",
		reversed: "dad"
	},
	{
		suffix: "dance",
		reversed: "ecnad"
	},
	{
		suffix: "data",
		reversed: "atad"
	},
	{
		suffix: "date",
		reversed: "etad"
	},
	{
		suffix: "dating",
		reversed: "gnitad"
	},
	{
		suffix: "datsun",
		reversed: "nustad"
	},
	{
		suffix: "day",
		reversed: "yad"
	},
	{
		suffix: "dclk",
		reversed: "klcd"
	},
	{
		suffix: "dds",
		reversed: "sdd"
	},
	{
		suffix: "deal",
		reversed: "laed"
	},
	{
		suffix: "dealer",
		reversed: "relaed"
	},
	{
		suffix: "deals",
		reversed: "slaed"
	},
	{
		suffix: "degree",
		reversed: "eerged"
	},
	{
		suffix: "delivery",
		reversed: "yreviled"
	},
	{
		suffix: "dell",
		reversed: "lled"
	},
	{
		suffix: "deloitte",
		reversed: "ettioled"
	},
	{
		suffix: "delta",
		reversed: "atled"
	},
	{
		suffix: "democrat",
		reversed: "tarcomed"
	},
	{
		suffix: "dental",
		reversed: "latned"
	},
	{
		suffix: "dentist",
		reversed: "tsitned"
	},
	{
		suffix: "desi",
		reversed: "ised"
	},
	{
		suffix: "design",
		reversed: "ngised"
	},
	{
		suffix: "dev",
		reversed: "ved"
	},
	{
		suffix: "dhl",
		reversed: "lhd"
	},
	{
		suffix: "diamonds",
		reversed: "sdnomaid"
	},
	{
		suffix: "diet",
		reversed: "teid"
	},
	{
		suffix: "digital",
		reversed: "latigid"
	},
	{
		suffix: "direct",
		reversed: "tcerid"
	},
	{
		suffix: "directory",
		reversed: "yrotcerid"
	},
	{
		suffix: "discount",
		reversed: "tnuocsid"
	},
	{
		suffix: "discover",
		reversed: "revocsid"
	},
	{
		suffix: "dish",
		reversed: "hsid"
	},
	{
		suffix: "diy",
		reversed: "yid"
	},
	{
		suffix: "dnp",
		reversed: "pnd"
	},
	{
		suffix: "docs",
		reversed: "scod"
	},
	{
		suffix: "doctor",
		reversed: "rotcod"
	},
	{
		suffix: "dog",
		reversed: "god"
	},
	{
		suffix: "domains",
		reversed: "sniamod"
	},
	{
		suffix: "dot",
		reversed: "tod"
	},
	{
		suffix: "download",
		reversed: "daolnwod"
	},
	{
		suffix: "drive",
		reversed: "evird"
	},
	{
		suffix: "dtv",
		reversed: "vtd"
	},
	{
		suffix: "dubai",
		reversed: "iabud"
	},
	{
		suffix: "dunlop",
		reversed: "polnud"
	},
	{
		suffix: "dupont",
		reversed: "tnopud"
	},
	{
		suffix: "durban",
		reversed: "nabrud"
	},
	{
		suffix: "dvag",
		reversed: "gavd"
	},
	{
		suffix: "dvr",
		reversed: "rvd"
	},
	{
		suffix: "earth",
		reversed: "htrae"
	},
	{
		suffix: "eat",
		reversed: "tae"
	},
	{
		suffix: "eco",
		reversed: "oce"
	},
	{
		suffix: "edeka",
		reversed: "akede"
	},
	{
		suffix: "education",
		reversed: "noitacude"
	},
	{
		suffix: "email",
		reversed: "liame"
	},
	{
		suffix: "emerck",
		reversed: "kcreme"
	},
	{
		suffix: "energy",
		reversed: "ygrene"
	},
	{
		suffix: "engineer",
		reversed: "reenigne"
	},
	{
		suffix: "engineering",
		reversed: "gnireenigne"
	},
	{
		suffix: "enterprises",
		reversed: "sesirpretne"
	},
	{
		suffix: "epson",
		reversed: "nospe"
	},
	{
		suffix: "equipment",
		reversed: "tnempiuqe"
	},
	{
		suffix: "ericsson",
		reversed: "nosscire"
	},
	{
		suffix: "erni",
		reversed: "inre"
	},
	{
		suffix: "esq",
		reversed: "qse"
	},
	{
		suffix: "estate",
		reversed: "etatse"
	},
	{
		suffix: "etisalat",
		reversed: "talasite"
	},
	{
		suffix: "eurovision",
		reversed: "noisivorue"
	},
	{
		suffix: "eus",
		reversed: "sue"
	},
	{
		suffix: "events",
		reversed: "stneve"
	},
	{
		suffix: "exchange",
		reversed: "egnahcxe"
	},
	{
		suffix: "expert",
		reversed: "trepxe"
	},
	{
		suffix: "exposed",
		reversed: "desopxe"
	},
	{
		suffix: "express",
		reversed: "sserpxe"
	},
	{
		suffix: "extraspace",
		reversed: "ecapsartxe"
	},
	{
		suffix: "fage",
		reversed: "egaf"
	},
	{
		suffix: "fail",
		reversed: "liaf"
	},
	{
		suffix: "fairwinds",
		reversed: "sdniwriaf"
	},
	{
		suffix: "faith",
		reversed: "htiaf"
	},
	{
		suffix: "family",
		reversed: "ylimaf"
	},
	{
		suffix: "fan",
		reversed: "naf"
	},
	{
		suffix: "fans",
		reversed: "snaf"
	},
	{
		suffix: "farm",
		reversed: "mraf"
	},
	{
		suffix: "farmers",
		reversed: "sremraf"
	},
	{
		suffix: "fashion",
		reversed: "noihsaf"
	},
	{
		suffix: "fast",
		reversed: "tsaf"
	},
	{
		suffix: "fedex",
		reversed: "xedef"
	},
	{
		suffix: "feedback",
		reversed: "kcabdeef"
	},
	{
		suffix: "ferrari",
		reversed: "irarref"
	},
	{
		suffix: "ferrero",
		reversed: "orerref"
	},
	{
		suffix: "fiat",
		reversed: "taif"
	},
	{
		suffix: "fidelity",
		reversed: "ytiledif"
	},
	{
		suffix: "fido",
		reversed: "odif"
	},
	{
		suffix: "film",
		reversed: "mlif"
	},
	{
		suffix: "final",
		reversed: "lanif"
	},
	{
		suffix: "finance",
		reversed: "ecnanif"
	},
	{
		suffix: "financial",
		reversed: "laicnanif"
	},
	{
		suffix: "fire",
		reversed: "erif"
	},
	{
		suffix: "firestone",
		reversed: "enotserif"
	},
	{
		suffix: "firmdale",
		reversed: "eladmrif"
	},
	{
		suffix: "fish",
		reversed: "hsif"
	},
	{
		suffix: "fishing",
		reversed: "gnihsif"
	},
	{
		suffix: "fit",
		reversed: "tif"
	},
	{
		suffix: "fitness",
		reversed: "ssentif"
	},
	{
		suffix: "flickr",
		reversed: "rkcilf"
	},
	{
		suffix: "flights",
		reversed: "sthgilf"
	},
	{
		suffix: "flir",
		reversed: "rilf"
	},
	{
		suffix: "florist",
		reversed: "tsirolf"
	},
	{
		suffix: "flowers",
		reversed: "srewolf"
	},
	{
		suffix: "fly",
		reversed: "ylf"
	},
	{
		suffix: "foo",
		reversed: "oof"
	},
	{
		suffix: "food",
		reversed: "doof"
	},
	{
		suffix: "foodnetwork",
		reversed: "krowtendoof"
	},
	{
		suffix: "football",
		reversed: "llabtoof"
	},
	{
		suffix: "ford",
		reversed: "drof"
	},
	{
		suffix: "forex",
		reversed: "xerof"
	},
	{
		suffix: "forsale",
		reversed: "elasrof"
	},
	{
		suffix: "forum",
		reversed: "murof"
	},
	{
		suffix: "foundation",
		reversed: "noitadnuof"
	},
	{
		suffix: "fox",
		reversed: "xof"
	},
	{
		suffix: "free",
		reversed: "eerf"
	},
	{
		suffix: "fresenius",
		reversed: "suineserf"
	},
	{
		suffix: "frl",
		reversed: "lrf"
	},
	{
		suffix: "frogans",
		reversed: "snagorf"
	},
	{
		suffix: "frontdoor",
		reversed: "roodtnorf"
	},
	{
		suffix: "frontier",
		reversed: "reitnorf"
	},
	{
		suffix: "ftr",
		reversed: "rtf"
	},
	{
		suffix: "fujitsu",
		reversed: "ustijuf"
	},
	{
		suffix: "fun",
		reversed: "nuf"
	},
	{
		suffix: "fund",
		reversed: "dnuf"
	},
	{
		suffix: "furniture",
		reversed: "erutinruf"
	},
	{
		suffix: "futbol",
		reversed: "lobtuf"
	},
	{
		suffix: "fyi",
		reversed: "iyf"
	},
	{
		suffix: "gal",
		reversed: "lag"
	},
	{
		suffix: "gallery",
		reversed: "yrellag"
	},
	{
		suffix: "gallo",
		reversed: "ollag"
	},
	{
		suffix: "gallup",
		reversed: "pullag"
	},
	{
		suffix: "game",
		reversed: "emag"
	},
	{
		suffix: "games",
		reversed: "semag"
	},
	{
		suffix: "gap",
		reversed: "pag"
	},
	{
		suffix: "garden",
		reversed: "nedrag"
	},
	{
		suffix: "gay",
		reversed: "yag"
	},
	{
		suffix: "gbiz",
		reversed: "zibg"
	},
	{
		suffix: "gdn",
		reversed: "ndg"
	},
	{
		suffix: "gea",
		reversed: "aeg"
	},
	{
		suffix: "gent",
		reversed: "tneg"
	},
	{
		suffix: "genting",
		reversed: "gnitneg"
	},
	{
		suffix: "george",
		reversed: "egroeg"
	},
	{
		suffix: "ggee",
		reversed: "eegg"
	},
	{
		suffix: "gift",
		reversed: "tfig"
	},
	{
		suffix: "gifts",
		reversed: "stfig"
	},
	{
		suffix: "gives",
		reversed: "sevig"
	},
	{
		suffix: "giving",
		reversed: "gnivig"
	},
	{
		suffix: "glass",
		reversed: "ssalg"
	},
	{
		suffix: "gle",
		reversed: "elg"
	},
	{
		suffix: "global",
		reversed: "labolg"
	},
	{
		suffix: "globo",
		reversed: "obolg"
	},
	{
		suffix: "gmail",
		reversed: "liamg"
	},
	{
		suffix: "gmbh",
		reversed: "hbmg"
	},
	{
		suffix: "gmo",
		reversed: "omg"
	},
	{
		suffix: "gmx",
		reversed: "xmg"
	},
	{
		suffix: "godaddy",
		reversed: "yddadog"
	},
	{
		suffix: "gold",
		reversed: "dlog"
	},
	{
		suffix: "goldpoint",
		reversed: "tniopdlog"
	},
	{
		suffix: "golf",
		reversed: "flog"
	},
	{
		suffix: "goo",
		reversed: "oog"
	},
	{
		suffix: "goodyear",
		reversed: "raeydoog"
	},
	{
		suffix: "goog",
		reversed: "goog"
	},
	{
		suffix: "google",
		reversed: "elgoog"
	},
	{
		suffix: "gop",
		reversed: "pog"
	},
	{
		suffix: "got",
		reversed: "tog"
	},
	{
		suffix: "grainger",
		reversed: "regniarg"
	},
	{
		suffix: "graphics",
		reversed: "scihparg"
	},
	{
		suffix: "gratis",
		reversed: "sitarg"
	},
	{
		suffix: "green",
		reversed: "neerg"
	},
	{
		suffix: "gripe",
		reversed: "epirg"
	},
	{
		suffix: "grocery",
		reversed: "yrecorg"
	},
	{
		suffix: "group",
		reversed: "puorg"
	},
	{
		suffix: "guardian",
		reversed: "naidraug"
	},
	{
		suffix: "gucci",
		reversed: "iccug"
	},
	{
		suffix: "guge",
		reversed: "egug"
	},
	{
		suffix: "guide",
		reversed: "ediug"
	},
	{
		suffix: "guitars",
		reversed: "sratiug"
	},
	{
		suffix: "guru",
		reversed: "urug"
	},
	{
		suffix: "hair",
		reversed: "riah"
	},
	{
		suffix: "hamburg",
		reversed: "grubmah"
	},
	{
		suffix: "hangout",
		reversed: "tuognah"
	},
	{
		suffix: "haus",
		reversed: "suah"
	},
	{
		suffix: "hbo",
		reversed: "obh"
	},
	{
		suffix: "hdfc",
		reversed: "cfdh"
	},
	{
		suffix: "hdfcbank",
		reversed: "knabcfdh"
	},
	{
		suffix: "health",
		reversed: "htlaeh"
	},
	{
		suffix: "healthcare",
		reversed: "erachtlaeh"
	},
	{
		suffix: "help",
		reversed: "pleh"
	},
	{
		suffix: "helsinki",
		reversed: "iknisleh"
	},
	{
		suffix: "here",
		reversed: "ereh"
	},
	{
		suffix: "hermes",
		reversed: "semreh"
	},
	{
		suffix: "hgtv",
		reversed: "vtgh"
	},
	{
		suffix: "hiphop",
		reversed: "pohpih"
	},
	{
		suffix: "hisamitsu",
		reversed: "ustimasih"
	},
	{
		suffix: "hitachi",
		reversed: "ihcatih"
	},
	{
		suffix: "hiv",
		reversed: "vih"
	},
	{
		suffix: "hkt",
		reversed: "tkh"
	},
	{
		suffix: "hockey",
		reversed: "yekcoh"
	},
	{
		suffix: "holdings",
		reversed: "sgnidloh"
	},
	{
		suffix: "holiday",
		reversed: "yadiloh"
	},
	{
		suffix: "homedepot",
		reversed: "topedemoh"
	},
	{
		suffix: "homegoods",
		reversed: "sdoogemoh"
	},
	{
		suffix: "homes",
		reversed: "semoh"
	},
	{
		suffix: "homesense",
		reversed: "esnesemoh"
	},
	{
		suffix: "honda",
		reversed: "adnoh"
	},
	{
		suffix: "horse",
		reversed: "esroh"
	},
	{
		suffix: "hospital",
		reversed: "latipsoh"
	},
	{
		suffix: "host",
		reversed: "tsoh"
	},
	{
		suffix: "hosting",
		reversed: "gnitsoh"
	},
	{
		suffix: "hot",
		reversed: "toh"
	},
	{
		suffix: "hoteles",
		reversed: "seletoh"
	},
	{
		suffix: "hotels",
		reversed: "sletoh"
	},
	{
		suffix: "hotmail",
		reversed: "liamtoh"
	},
	{
		suffix: "house",
		reversed: "esuoh"
	},
	{
		suffix: "how",
		reversed: "woh"
	},
	{
		suffix: "hsbc",
		reversed: "cbsh"
	},
	{
		suffix: "hughes",
		reversed: "sehguh"
	},
	{
		suffix: "hyatt",
		reversed: "ttayh"
	},
	{
		suffix: "hyundai",
		reversed: "iadnuyh"
	},
	{
		suffix: "ibm",
		reversed: "mbi"
	},
	{
		suffix: "icbc",
		reversed: "cbci"
	},
	{
		suffix: "ice",
		reversed: "eci"
	},
	{
		suffix: "icu",
		reversed: "uci"
	},
	{
		suffix: "ieee",
		reversed: "eeei"
	},
	{
		suffix: "ifm",
		reversed: "mfi"
	},
	{
		suffix: "ikano",
		reversed: "onaki"
	},
	{
		suffix: "imamat",
		reversed: "tamami"
	},
	{
		suffix: "imdb",
		reversed: "bdmi"
	},
	{
		suffix: "immo",
		reversed: "ommi"
	},
	{
		suffix: "immobilien",
		reversed: "neilibommi"
	},
	{
		suffix: "inc",
		reversed: "cni"
	},
	{
		suffix: "industries",
		reversed: "seirtsudni"
	},
	{
		suffix: "infiniti",
		reversed: "itinifni"
	},
	{
		suffix: "ing",
		reversed: "gni"
	},
	{
		suffix: "ink",
		reversed: "kni"
	},
	{
		suffix: "institute",
		reversed: "etutitsni"
	},
	{
		suffix: "insurance",
		reversed: "ecnarusni"
	},
	{
		suffix: "insure",
		reversed: "erusni"
	},
	{
		suffix: "international",
		reversed: "lanoitanretni"
	},
	{
		suffix: "intuit",
		reversed: "tiutni"
	},
	{
		suffix: "investments",
		reversed: "stnemtsevni"
	},
	{
		suffix: "ipiranga",
		reversed: "agnaripi"
	},
	{
		suffix: "irish",
		reversed: "hsiri"
	},
	{
		suffix: "ismaili",
		reversed: "iliamsi"
	},
	{
		suffix: "ist",
		reversed: "tsi"
	},
	{
		suffix: "istanbul",
		reversed: "lubnatsi"
	},
	{
		suffix: "itau",
		reversed: "uati"
	},
	{
		suffix: "itv",
		reversed: "vti"
	},
	{
		suffix: "jaguar",
		reversed: "raugaj"
	},
	{
		suffix: "java",
		reversed: "avaj"
	},
	{
		suffix: "jcb",
		reversed: "bcj"
	},
	{
		suffix: "jeep",
		reversed: "peej"
	},
	{
		suffix: "jetzt",
		reversed: "tztej"
	},
	{
		suffix: "jewelry",
		reversed: "yrlewej"
	},
	{
		suffix: "jio",
		reversed: "oij"
	},
	{
		suffix: "jll",
		reversed: "llj"
	},
	{
		suffix: "jmp",
		reversed: "pmj"
	},
	{
		suffix: "jnj",
		reversed: "jnj"
	},
	{
		suffix: "joburg",
		reversed: "gruboj"
	},
	{
		suffix: "jot",
		reversed: "toj"
	},
	{
		suffix: "joy",
		reversed: "yoj"
	},
	{
		suffix: "jpmorgan",
		reversed: "nagrompj"
	},
	{
		suffix: "jprs",
		reversed: "srpj"
	},
	{
		suffix: "juegos",
		reversed: "sogeuj"
	},
	{
		suffix: "juniper",
		reversed: "repinuj"
	},
	{
		suffix: "kaufen",
		reversed: "nefuak"
	},
	{
		suffix: "kddi",
		reversed: "iddk"
	},
	{
		suffix: "kerryhotels",
		reversed: "sletohyrrek"
	},
	{
		suffix: "kerrylogistics",
		reversed: "scitsigolyrrek"
	},
	{
		suffix: "kerryproperties",
		reversed: "seitreporpyrrek"
	},
	{
		suffix: "kfh",
		reversed: "hfk"
	},
	{
		suffix: "kia",
		reversed: "aik"
	},
	{
		suffix: "kids",
		reversed: "sdik"
	},
	{
		suffix: "kim",
		reversed: "mik"
	},
	{
		suffix: "kinder",
		reversed: "rednik"
	},
	{
		suffix: "kindle",
		reversed: "eldnik"
	},
	{
		suffix: "kitchen",
		reversed: "nehctik"
	},
	{
		suffix: "kiwi",
		reversed: "iwik"
	},
	{
		suffix: "koeln",
		reversed: "nleok"
	},
	{
		suffix: "komatsu",
		reversed: "ustamok"
	},
	{
		suffix: "kosher",
		reversed: "rehsok"
	},
	{
		suffix: "kpmg",
		reversed: "gmpk"
	},
	{
		suffix: "kpn",
		reversed: "npk"
	},
	{
		suffix: "krd",
		reversed: "drk"
	},
	{
		suffix: "kred",
		reversed: "derk"
	},
	{
		suffix: "kuokgroup",
		reversed: "puorgkouk"
	},
	{
		suffix: "kyoto",
		reversed: "otoyk"
	},
	{
		suffix: "lacaixa",
		reversed: "axiacal"
	},
	{
		suffix: "lamborghini",
		reversed: "inihgrobmal"
	},
	{
		suffix: "lamer",
		reversed: "remal"
	},
	{
		suffix: "lancaster",
		reversed: "retsacnal"
	},
	{
		suffix: "lancia",
		reversed: "aicnal"
	},
	{
		suffix: "land",
		reversed: "dnal"
	},
	{
		suffix: "landrover",
		reversed: "revordnal"
	},
	{
		suffix: "lanxess",
		reversed: "ssexnal"
	},
	{
		suffix: "lasalle",
		reversed: "ellasal"
	},
	{
		suffix: "lat",
		reversed: "tal"
	},
	{
		suffix: "latino",
		reversed: "onital"
	},
	{
		suffix: "latrobe",
		reversed: "ebortal"
	},
	{
		suffix: "law",
		reversed: "wal"
	},
	{
		suffix: "lawyer",
		reversed: "reywal"
	},
	{
		suffix: "lds",
		reversed: "sdl"
	},
	{
		suffix: "lease",
		reversed: "esael"
	},
	{
		suffix: "leclerc",
		reversed: "crelcel"
	},
	{
		suffix: "lefrak",
		reversed: "karfel"
	},
	{
		suffix: "legal",
		reversed: "lagel"
	},
	{
		suffix: "lego",
		reversed: "ogel"
	},
	{
		suffix: "lexus",
		reversed: "suxel"
	},
	{
		suffix: "lgbt",
		reversed: "tbgl"
	},
	{
		suffix: "lidl",
		reversed: "ldil"
	},
	{
		suffix: "life",
		reversed: "efil"
	},
	{
		suffix: "lifeinsurance",
		reversed: "ecnarusniefil"
	},
	{
		suffix: "lifestyle",
		reversed: "elytsefil"
	},
	{
		suffix: "lighting",
		reversed: "gnithgil"
	},
	{
		suffix: "like",
		reversed: "ekil"
	},
	{
		suffix: "lilly",
		reversed: "yllil"
	},
	{
		suffix: "limited",
		reversed: "detimil"
	},
	{
		suffix: "limo",
		reversed: "omil"
	},
	{
		suffix: "lincoln",
		reversed: "nlocnil"
	},
	{
		suffix: "link",
		reversed: "knil"
	},
	{
		suffix: "lipsy",
		reversed: "yspil"
	},
	{
		suffix: "live",
		reversed: "evil"
	},
	{
		suffix: "living",
		reversed: "gnivil"
	},
	{
		suffix: "llc",
		reversed: "cll"
	},
	{
		suffix: "llp",
		reversed: "pll"
	},
	{
		suffix: "loan",
		reversed: "naol"
	},
	{
		suffix: "loans",
		reversed: "snaol"
	},
	{
		suffix: "locker",
		reversed: "rekcol"
	},
	{
		suffix: "locus",
		reversed: "sucol"
	},
	{
		suffix: "lol",
		reversed: "lol"
	},
	{
		suffix: "london",
		reversed: "nodnol"
	},
	{
		suffix: "lotte",
		reversed: "ettol"
	},
	{
		suffix: "lotto",
		reversed: "ottol"
	},
	{
		suffix: "love",
		reversed: "evol"
	},
	{
		suffix: "lpl",
		reversed: "lpl"
	},
	{
		suffix: "lplfinancial",
		reversed: "laicnaniflpl"
	},
	{
		suffix: "ltd",
		reversed: "dtl"
	},
	{
		suffix: "ltda",
		reversed: "adtl"
	},
	{
		suffix: "lundbeck",
		reversed: "kcebdnul"
	},
	{
		suffix: "luxe",
		reversed: "exul"
	},
	{
		suffix: "luxury",
		reversed: "yruxul"
	},
	{
		suffix: "madrid",
		reversed: "dirdam"
	},
	{
		suffix: "maif",
		reversed: "fiam"
	},
	{
		suffix: "maison",
		reversed: "nosiam"
	},
	{
		suffix: "makeup",
		reversed: "puekam"
	},
	{
		suffix: "man",
		reversed: "nam"
	},
	{
		suffix: "management",
		reversed: "tnemeganam"
	},
	{
		suffix: "mango",
		reversed: "ognam"
	},
	{
		suffix: "map",
		reversed: "pam"
	},
	{
		suffix: "market",
		reversed: "tekram"
	},
	{
		suffix: "marketing",
		reversed: "gnitekram"
	},
	{
		suffix: "markets",
		reversed: "stekram"
	},
	{
		suffix: "marriott",
		reversed: "ttoirram"
	},
	{
		suffix: "marshalls",
		reversed: "sllahsram"
	},
	{
		suffix: "maserati",
		reversed: "itaresam"
	},
	{
		suffix: "mattel",
		reversed: "lettam"
	},
	{
		suffix: "mba",
		reversed: "abm"
	},
	{
		suffix: "mckinsey",
		reversed: "yesnikcm"
	},
	{
		suffix: "med",
		reversed: "dem"
	},
	{
		suffix: "media",
		reversed: "aidem"
	},
	{
		suffix: "meet",
		reversed: "teem"
	},
	{
		suffix: "melbourne",
		reversed: "enruoblem"
	},
	{
		suffix: "meme",
		reversed: "emem"
	},
	{
		suffix: "memorial",
		reversed: "lairomem"
	},
	{
		suffix: "men",
		reversed: "nem"
	},
	{
		suffix: "menu",
		reversed: "unem"
	},
	{
		suffix: "merckmsd",
		reversed: "dsmkcrem"
	},
	{
		suffix: "miami",
		reversed: "imaim"
	},
	{
		suffix: "microsoft",
		reversed: "tfosorcim"
	},
	{
		suffix: "mini",
		reversed: "inim"
	},
	{
		suffix: "mint",
		reversed: "tnim"
	},
	{
		suffix: "mit",
		reversed: "tim"
	},
	{
		suffix: "mitsubishi",
		reversed: "ihsibustim"
	},
	{
		suffix: "mlb",
		reversed: "blm"
	},
	{
		suffix: "mls",
		reversed: "slm"
	},
	{
		suffix: "mma",
		reversed: "amm"
	},
	{
		suffix: "mobile",
		reversed: "elibom"
	},
	{
		suffix: "moda",
		reversed: "adom"
	},
	{
		suffix: "moe",
		reversed: "eom"
	},
	{
		suffix: "moi",
		reversed: "iom"
	},
	{
		suffix: "mom",
		reversed: "mom"
	},
	{
		suffix: "monash",
		reversed: "hsanom"
	},
	{
		suffix: "money",
		reversed: "yenom"
	},
	{
		suffix: "monster",
		reversed: "retsnom"
	},
	{
		suffix: "mormon",
		reversed: "nomrom"
	},
	{
		suffix: "mortgage",
		reversed: "egagtrom"
	},
	{
		suffix: "moscow",
		reversed: "wocsom"
	},
	{
		suffix: "moto",
		reversed: "otom"
	},
	{
		suffix: "motorcycles",
		reversed: "selcycrotom"
	},
	{
		suffix: "mov",
		reversed: "vom"
	},
	{
		suffix: "movie",
		reversed: "eivom"
	},
	{
		suffix: "msd",
		reversed: "dsm"
	},
	{
		suffix: "mtn",
		reversed: "ntm"
	},
	{
		suffix: "mtr",
		reversed: "rtm"
	},
	{
		suffix: "music",
		reversed: "cisum"
	},
	{
		suffix: "mutual",
		reversed: "lautum"
	},
	{
		suffix: "nab",
		reversed: "ban"
	},
	{
		suffix: "nagoya",
		reversed: "ayogan"
	},
	{
		suffix: "natura",
		reversed: "arutan"
	},
	{
		suffix: "navy",
		reversed: "yvan"
	},
	{
		suffix: "nba",
		reversed: "abn"
	},
	{
		suffix: "nec",
		reversed: "cen"
	},
	{
		suffix: "netbank",
		reversed: "knabten"
	},
	{
		suffix: "netflix",
		reversed: "xilften"
	},
	{
		suffix: "network",
		reversed: "krowten"
	},
	{
		suffix: "neustar",
		reversed: "ratsuen"
	},
	{
		suffix: "new",
		reversed: "wen"
	},
	{
		suffix: "news",
		reversed: "swen"
	},
	{
		suffix: "next",
		reversed: "txen"
	},
	{
		suffix: "nextdirect",
		reversed: "tceridtxen"
	},
	{
		suffix: "nexus",
		reversed: "suxen"
	},
	{
		suffix: "nfl",
		reversed: "lfn"
	},
	{
		suffix: "ngo",
		reversed: "ogn"
	},
	{
		suffix: "nhk",
		reversed: "khn"
	},
	{
		suffix: "nico",
		reversed: "ocin"
	},
	{
		suffix: "nike",
		reversed: "ekin"
	},
	{
		suffix: "nikon",
		reversed: "nokin"
	},
	{
		suffix: "ninja",
		reversed: "ajnin"
	},
	{
		suffix: "nissan",
		reversed: "nassin"
	},
	{
		suffix: "nissay",
		reversed: "yassin"
	},
	{
		suffix: "nokia",
		reversed: "aikon"
	},
	{
		suffix: "northwesternmutual",
		reversed: "lautumnretsewhtron"
	},
	{
		suffix: "norton",
		reversed: "notron"
	},
	{
		suffix: "now",
		reversed: "won"
	},
	{
		suffix: "nowruz",
		reversed: "zurwon"
	},
	{
		suffix: "nowtv",
		reversed: "vtwon"
	},
	{
		suffix: "nra",
		reversed: "arn"
	},
	{
		suffix: "nrw",
		reversed: "wrn"
	},
	{
		suffix: "ntt",
		reversed: "ttn"
	},
	{
		suffix: "nyc",
		reversed: "cyn"
	},
	{
		suffix: "obi",
		reversed: "ibo"
	},
	{
		suffix: "observer",
		reversed: "revresbo"
	},
	{
		suffix: "office",
		reversed: "eciffo"
	},
	{
		suffix: "okinawa",
		reversed: "awaniko"
	},
	{
		suffix: "olayan",
		reversed: "nayalo"
	},
	{
		suffix: "olayangroup",
		reversed: "puorgnayalo"
	},
	{
		suffix: "oldnavy",
		reversed: "yvandlo"
	},
	{
		suffix: "ollo",
		reversed: "ollo"
	},
	{
		suffix: "omega",
		reversed: "agemo"
	},
	{
		suffix: "one",
		reversed: "eno"
	},
	{
		suffix: "ong",
		reversed: "gno"
	},
	{
		suffix: "onl",
		reversed: "lno"
	},
	{
		suffix: "online",
		reversed: "enilno"
	},
	{
		suffix: "ooo",
		reversed: "ooo"
	},
	{
		suffix: "open",
		reversed: "nepo"
	},
	{
		suffix: "oracle",
		reversed: "elcaro"
	},
	{
		suffix: "orange",
		reversed: "egnaro"
	},
	{
		suffix: "organic",
		reversed: "cinagro"
	},
	{
		suffix: "origins",
		reversed: "snigiro"
	},
	{
		suffix: "osaka",
		reversed: "akaso"
	},
	{
		suffix: "otsuka",
		reversed: "akusto"
	},
	{
		suffix: "ott",
		reversed: "tto"
	},
	{
		suffix: "ovh",
		reversed: "hvo"
	},
	{
		suffix: "page",
		reversed: "egap"
	},
	{
		suffix: "panasonic",
		reversed: "cinosanap"
	},
	{
		suffix: "paris",
		reversed: "sirap"
	},
	{
		suffix: "pars",
		reversed: "srap"
	},
	{
		suffix: "partners",
		reversed: "srentrap"
	},
	{
		suffix: "parts",
		reversed: "strap"
	},
	{
		suffix: "party",
		reversed: "ytrap"
	},
	{
		suffix: "passagens",
		reversed: "snegassap"
	},
	{
		suffix: "pay",
		reversed: "yap"
	},
	{
		suffix: "pccw",
		reversed: "wccp"
	},
	{
		suffix: "pet",
		reversed: "tep"
	},
	{
		suffix: "pfizer",
		reversed: "rezifp"
	},
	{
		suffix: "pharmacy",
		reversed: "ycamrahp"
	},
	{
		suffix: "phd",
		reversed: "dhp"
	},
	{
		suffix: "philips",
		reversed: "spilihp"
	},
	{
		suffix: "phone",
		reversed: "enohp"
	},
	{
		suffix: "photo",
		reversed: "otohp"
	},
	{
		suffix: "photography",
		reversed: "yhpargotohp"
	},
	{
		suffix: "photos",
		reversed: "sotohp"
	},
	{
		suffix: "physio",
		reversed: "oisyhp"
	},
	{
		suffix: "pics",
		reversed: "scip"
	},
	{
		suffix: "pictet",
		reversed: "tetcip"
	},
	{
		suffix: "pictures",
		reversed: "serutcip"
	},
	{
		suffix: "pid",
		reversed: "dip"
	},
	{
		suffix: "pin",
		reversed: "nip"
	},
	{
		suffix: "ping",
		reversed: "gnip"
	},
	{
		suffix: "pink",
		reversed: "knip"
	},
	{
		suffix: "pioneer",
		reversed: "reenoip"
	},
	{
		suffix: "pizza",
		reversed: "azzip"
	},
	{
		suffix: "place",
		reversed: "ecalp"
	},
	{
		suffix: "play",
		reversed: "yalp"
	},
	{
		suffix: "playstation",
		reversed: "noitatsyalp"
	},
	{
		suffix: "plumbing",
		reversed: "gnibmulp"
	},
	{
		suffix: "plus",
		reversed: "sulp"
	},
	{
		suffix: "pnc",
		reversed: "cnp"
	},
	{
		suffix: "pohl",
		reversed: "lhop"
	},
	{
		suffix: "poker",
		reversed: "rekop"
	},
	{
		suffix: "politie",
		reversed: "eitilop"
	},
	{
		suffix: "porn",
		reversed: "nrop"
	},
	{
		suffix: "pramerica",
		reversed: "aciremarp"
	},
	{
		suffix: "praxi",
		reversed: "ixarp"
	},
	{
		suffix: "press",
		reversed: "sserp"
	},
	{
		suffix: "prime",
		reversed: "emirp"
	},
	{
		suffix: "prod",
		reversed: "dorp"
	},
	{
		suffix: "productions",
		reversed: "snoitcudorp"
	},
	{
		suffix: "prof",
		reversed: "forp"
	},
	{
		suffix: "progressive",
		reversed: "evissergorp"
	},
	{
		suffix: "promo",
		reversed: "omorp"
	},
	{
		suffix: "properties",
		reversed: "seitreporp"
	},
	{
		suffix: "property",
		reversed: "ytreporp"
	},
	{
		suffix: "protection",
		reversed: "noitcetorp"
	},
	{
		suffix: "pru",
		reversed: "urp"
	},
	{
		suffix: "prudential",
		reversed: "laitnedurp"
	},
	{
		suffix: "pub",
		reversed: "bup"
	},
	{
		suffix: "pwc",
		reversed: "cwp"
	},
	{
		suffix: "qpon",
		reversed: "nopq"
	},
	{
		suffix: "quebec",
		reversed: "cebeuq"
	},
	{
		suffix: "quest",
		reversed: "tseuq"
	},
	{
		suffix: "racing",
		reversed: "gnicar"
	},
	{
		suffix: "radio",
		reversed: "oidar"
	},
	{
		suffix: "read",
		reversed: "daer"
	},
	{
		suffix: "realestate",
		reversed: "etatselaer"
	},
	{
		suffix: "realtor",
		reversed: "rotlaer"
	},
	{
		suffix: "realty",
		reversed: "ytlaer"
	},
	{
		suffix: "recipes",
		reversed: "sepicer"
	},
	{
		suffix: "red",
		reversed: "der"
	},
	{
		suffix: "redstone",
		reversed: "enotsder"
	},
	{
		suffix: "redumbrella",
		reversed: "allerbmuder"
	},
	{
		suffix: "rehab",
		reversed: "baher"
	},
	{
		suffix: "reise",
		reversed: "esier"
	},
	{
		suffix: "reisen",
		reversed: "nesier"
	},
	{
		suffix: "reit",
		reversed: "tier"
	},
	{
		suffix: "reliance",
		reversed: "ecnailer"
	},
	{
		suffix: "ren",
		reversed: "ner"
	},
	{
		suffix: "rent",
		reversed: "tner"
	},
	{
		suffix: "rentals",
		reversed: "slatner"
	},
	{
		suffix: "repair",
		reversed: "riaper"
	},
	{
		suffix: "report",
		reversed: "troper"
	},
	{
		suffix: "republican",
		reversed: "nacilbuper"
	},
	{
		suffix: "rest",
		reversed: "tser"
	},
	{
		suffix: "restaurant",
		reversed: "tnaruatser"
	},
	{
		suffix: "review",
		reversed: "weiver"
	},
	{
		suffix: "reviews",
		reversed: "sweiver"
	},
	{
		suffix: "rexroth",
		reversed: "htorxer"
	},
	{
		suffix: "rich",
		reversed: "hcir"
	},
	{
		suffix: "richardli",
		reversed: "ildrahcir"
	},
	{
		suffix: "ricoh",
		reversed: "hocir"
	},
	{
		suffix: "ril",
		reversed: "lir"
	},
	{
		suffix: "rio",
		reversed: "oir"
	},
	{
		suffix: "rip",
		reversed: "pir"
	},
	{
		suffix: "rocher",
		reversed: "rehcor"
	},
	{
		suffix: "rocks",
		reversed: "skcor"
	},
	{
		suffix: "rodeo",
		reversed: "oedor"
	},
	{
		suffix: "rogers",
		reversed: "sregor"
	},
	{
		suffix: "room",
		reversed: "moor"
	},
	{
		suffix: "rsvp",
		reversed: "pvsr"
	},
	{
		suffix: "rugby",
		reversed: "ybgur"
	},
	{
		suffix: "ruhr",
		reversed: "rhur"
	},
	{
		suffix: "run",
		reversed: "nur"
	},
	{
		suffix: "rwe",
		reversed: "ewr"
	},
	{
		suffix: "ryukyu",
		reversed: "uykuyr"
	},
	{
		suffix: "saarland",
		reversed: "dnalraas"
	},
	{
		suffix: "safe",
		reversed: "efas"
	},
	{
		suffix: "safety",
		reversed: "ytefas"
	},
	{
		suffix: "sakura",
		reversed: "arukas"
	},
	{
		suffix: "sale",
		reversed: "elas"
	},
	{
		suffix: "salon",
		reversed: "nolas"
	},
	{
		suffix: "samsclub",
		reversed: "bulcsmas"
	},
	{
		suffix: "samsung",
		reversed: "gnusmas"
	},
	{
		suffix: "sandvik",
		reversed: "kivdnas"
	},
	{
		suffix: "sandvikcoromant",
		reversed: "tnamorockivdnas"
	},
	{
		suffix: "sanofi",
		reversed: "ifonas"
	},
	{
		suffix: "sap",
		reversed: "pas"
	},
	{
		suffix: "sarl",
		reversed: "lras"
	},
	{
		suffix: "sas",
		reversed: "sas"
	},
	{
		suffix: "save",
		reversed: "evas"
	},
	{
		suffix: "saxo",
		reversed: "oxas"
	},
	{
		suffix: "sbi",
		reversed: "ibs"
	},
	{
		suffix: "sbs",
		reversed: "sbs"
	},
	{
		suffix: "sca",
		reversed: "acs"
	},
	{
		suffix: "scb",
		reversed: "bcs"
	},
	{
		suffix: "schaeffler",
		reversed: "relffeahcs"
	},
	{
		suffix: "schmidt",
		reversed: "tdimhcs"
	},
	{
		suffix: "scholarships",
		reversed: "spihsralohcs"
	},
	{
		suffix: "school",
		reversed: "loohcs"
	},
	{
		suffix: "schule",
		reversed: "eluhcs"
	},
	{
		suffix: "schwarz",
		reversed: "zrawhcs"
	},
	{
		suffix: "science",
		reversed: "ecneics"
	},
	{
		suffix: "scot",
		reversed: "tocs"
	},
	{
		suffix: "search",
		reversed: "hcraes"
	},
	{
		suffix: "seat",
		reversed: "taes"
	},
	{
		suffix: "secure",
		reversed: "eruces"
	},
	{
		suffix: "security",
		reversed: "ytiruces"
	},
	{
		suffix: "seek",
		reversed: "kees"
	},
	{
		suffix: "select",
		reversed: "tceles"
	},
	{
		suffix: "sener",
		reversed: "renes"
	},
	{
		suffix: "services",
		reversed: "secivres"
	},
	{
		suffix: "seven",
		reversed: "neves"
	},
	{
		suffix: "sew",
		reversed: "wes"
	},
	{
		suffix: "sex",
		reversed: "xes"
	},
	{
		suffix: "sexy",
		reversed: "yxes"
	},
	{
		suffix: "sfr",
		reversed: "rfs"
	},
	{
		suffix: "shangrila",
		reversed: "alirgnahs"
	},
	{
		suffix: "sharp",
		reversed: "prahs"
	},
	{
		suffix: "shaw",
		reversed: "wahs"
	},
	{
		suffix: "shell",
		reversed: "llehs"
	},
	{
		suffix: "shia",
		reversed: "aihs"
	},
	{
		suffix: "shiksha",
		reversed: "ahskihs"
	},
	{
		suffix: "shoes",
		reversed: "seohs"
	},
	{
		suffix: "shop",
		reversed: "pohs"
	},
	{
		suffix: "shopping",
		reversed: "gnippohs"
	},
	{
		suffix: "shouji",
		reversed: "ijuohs"
	},
	{
		suffix: "show",
		reversed: "wohs"
	},
	{
		suffix: "showtime",
		reversed: "emitwohs"
	},
	{
		suffix: "silk",
		reversed: "klis"
	},
	{
		suffix: "sina",
		reversed: "anis"
	},
	{
		suffix: "singles",
		reversed: "selgnis"
	},
	{
		suffix: "site",
		reversed: "etis"
	},
	{
		suffix: "ski",
		reversed: "iks"
	},
	{
		suffix: "skin",
		reversed: "niks"
	},
	{
		suffix: "sky",
		reversed: "yks"
	},
	{
		suffix: "skype",
		reversed: "epyks"
	},
	{
		suffix: "sling",
		reversed: "gnils"
	},
	{
		suffix: "smart",
		reversed: "trams"
	},
	{
		suffix: "smile",
		reversed: "elims"
	},
	{
		suffix: "sncf",
		reversed: "fcns"
	},
	{
		suffix: "soccer",
		reversed: "reccos"
	},
	{
		suffix: "social",
		reversed: "laicos"
	},
	{
		suffix: "softbank",
		reversed: "knabtfos"
	},
	{
		suffix: "software",
		reversed: "erawtfos"
	},
	{
		suffix: "sohu",
		reversed: "uhos"
	},
	{
		suffix: "solar",
		reversed: "ralos"
	},
	{
		suffix: "solutions",
		reversed: "snoitulos"
	},
	{
		suffix: "song",
		reversed: "gnos"
	},
	{
		suffix: "sony",
		reversed: "ynos"
	},
	{
		suffix: "soy",
		reversed: "yos"
	},
	{
		suffix: "spa",
		reversed: "aps"
	},
	{
		suffix: "space",
		reversed: "ecaps"
	},
	{
		suffix: "sport",
		reversed: "trops"
	},
	{
		suffix: "spot",
		reversed: "tops"
	},
	{
		suffix: "srl",
		reversed: "lrs"
	},
	{
		suffix: "stada",
		reversed: "adats"
	},
	{
		suffix: "staples",
		reversed: "selpats"
	},
	{
		suffix: "star",
		reversed: "rats"
	},
	{
		suffix: "statebank",
		reversed: "knabetats"
	},
	{
		suffix: "statefarm",
		reversed: "mrafetats"
	},
	{
		suffix: "stc",
		reversed: "cts"
	},
	{
		suffix: "stcgroup",
		reversed: "puorgcts"
	},
	{
		suffix: "stockholm",
		reversed: "mlohkcots"
	},
	{
		suffix: "storage",
		reversed: "egarots"
	},
	{
		suffix: "store",
		reversed: "erots"
	},
	{
		suffix: "stream",
		reversed: "maerts"
	},
	{
		suffix: "studio",
		reversed: "oiduts"
	},
	{
		suffix: "study",
		reversed: "yduts"
	},
	{
		suffix: "style",
		reversed: "elyts"
	},
	{
		suffix: "sucks",
		reversed: "skcus"
	},
	{
		suffix: "supplies",
		reversed: "seilppus"
	},
	{
		suffix: "supply",
		reversed: "ylppus"
	},
	{
		suffix: "support",
		reversed: "troppus"
	},
	{
		suffix: "surf",
		reversed: "frus"
	},
	{
		suffix: "surgery",
		reversed: "yregrus"
	},
	{
		suffix: "suzuki",
		reversed: "ikuzus"
	},
	{
		suffix: "swatch",
		reversed: "hctaws"
	},
	{
		suffix: "swiss",
		reversed: "ssiws"
	},
	{
		suffix: "sydney",
		reversed: "yendys"
	},
	{
		suffix: "systems",
		reversed: "smetsys"
	},
	{
		suffix: "tab",
		reversed: "bat"
	},
	{
		suffix: "taipei",
		reversed: "iepiat"
	},
	{
		suffix: "talk",
		reversed: "klat"
	},
	{
		suffix: "taobao",
		reversed: "oaboat"
	},
	{
		suffix: "target",
		reversed: "tegrat"
	},
	{
		suffix: "tatamotors",
		reversed: "srotomatat"
	},
	{
		suffix: "tatar",
		reversed: "ratat"
	},
	{
		suffix: "tattoo",
		reversed: "oottat"
	},
	{
		suffix: "tax",
		reversed: "xat"
	},
	{
		suffix: "taxi",
		reversed: "ixat"
	},
	{
		suffix: "tci",
		reversed: "ict"
	},
	{
		suffix: "tdk",
		reversed: "kdt"
	},
	{
		suffix: "team",
		reversed: "maet"
	},
	{
		suffix: "tech",
		reversed: "hcet"
	},
	{
		suffix: "technology",
		reversed: "ygolonhcet"
	},
	{
		suffix: "temasek",
		reversed: "kesamet"
	},
	{
		suffix: "tennis",
		reversed: "sinnet"
	},
	{
		suffix: "teva",
		reversed: "avet"
	},
	{
		suffix: "thd",
		reversed: "dht"
	},
	{
		suffix: "theater",
		reversed: "retaeht"
	},
	{
		suffix: "theatre",
		reversed: "ertaeht"
	},
	{
		suffix: "tiaa",
		reversed: "aait"
	},
	{
		suffix: "tickets",
		reversed: "stekcit"
	},
	{
		suffix: "tienda",
		reversed: "adneit"
	},
	{
		suffix: "tiffany",
		reversed: "ynaffit"
	},
	{
		suffix: "tips",
		reversed: "spit"
	},
	{
		suffix: "tires",
		reversed: "serit"
	},
	{
		suffix: "tirol",
		reversed: "lorit"
	},
	{
		suffix: "tjmaxx",
		reversed: "xxamjt"
	},
	{
		suffix: "tjx",
		reversed: "xjt"
	},
	{
		suffix: "tkmaxx",
		reversed: "xxamkt"
	},
	{
		suffix: "tmall",
		reversed: "llamt"
	},
	{
		suffix: "today",
		reversed: "yadot"
	},
	{
		suffix: "tokyo",
		reversed: "oykot"
	},
	{
		suffix: "tools",
		reversed: "sloot"
	},
	{
		suffix: "top",
		reversed: "pot"
	},
	{
		suffix: "toray",
		reversed: "yarot"
	},
	{
		suffix: "toshiba",
		reversed: "abihsot"
	},
	{
		suffix: "total",
		reversed: "latot"
	},
	{
		suffix: "tours",
		reversed: "sruot"
	},
	{
		suffix: "town",
		reversed: "nwot"
	},
	{
		suffix: "toyota",
		reversed: "atoyot"
	},
	{
		suffix: "toys",
		reversed: "syot"
	},
	{
		suffix: "trade",
		reversed: "edart"
	},
	{
		suffix: "trading",
		reversed: "gnidart"
	},
	{
		suffix: "training",
		reversed: "gniniart"
	},
	{
		suffix: "travel",
		reversed: "levart"
	},
	{
		suffix: "travelchannel",
		reversed: "lennahclevart"
	},
	{
		suffix: "travelers",
		reversed: "srelevart"
	},
	{
		suffix: "travelersinsurance",
		reversed: "ecnarusnisrelevart"
	},
	{
		suffix: "trust",
		reversed: "tsurt"
	},
	{
		suffix: "trv",
		reversed: "vrt"
	},
	{
		suffix: "tube",
		reversed: "ebut"
	},
	{
		suffix: "tui",
		reversed: "iut"
	},
	{
		suffix: "tunes",
		reversed: "senut"
	},
	{
		suffix: "tushu",
		reversed: "uhsut"
	},
	{
		suffix: "tvs",
		reversed: "svt"
	},
	{
		suffix: "ubank",
		reversed: "knabu"
	},
	{
		suffix: "ubs",
		reversed: "sbu"
	},
	{
		suffix: "unicom",
		reversed: "mocinu"
	},
	{
		suffix: "university",
		reversed: "ytisrevinu"
	},
	{
		suffix: "uno",
		reversed: "onu"
	},
	{
		suffix: "uol",
		reversed: "lou"
	},
	{
		suffix: "ups",
		reversed: "spu"
	},
	{
		suffix: "vacations",
		reversed: "snoitacav"
	},
	{
		suffix: "vana",
		reversed: "anav"
	},
	{
		suffix: "vanguard",
		reversed: "draugnav"
	},
	{
		suffix: "vegas",
		reversed: "sagev"
	},
	{
		suffix: "ventures",
		reversed: "serutnev"
	},
	{
		suffix: "verisign",
		reversed: "ngisirev"
	},
	{
		suffix: "versicherung",
		reversed: "gnurehcisrev"
	},
	{
		suffix: "vet",
		reversed: "tev"
	},
	{
		suffix: "viajes",
		reversed: "sejaiv"
	},
	{
		suffix: "video",
		reversed: "oediv"
	},
	{
		suffix: "vig",
		reversed: "giv"
	},
	{
		suffix: "viking",
		reversed: "gnikiv"
	},
	{
		suffix: "villas",
		reversed: "salliv"
	},
	{
		suffix: "vin",
		reversed: "niv"
	},
	{
		suffix: "vip",
		reversed: "piv"
	},
	{
		suffix: "virgin",
		reversed: "nigriv"
	},
	{
		suffix: "visa",
		reversed: "asiv"
	},
	{
		suffix: "vision",
		reversed: "noisiv"
	},
	{
		suffix: "viva",
		reversed: "aviv"
	},
	{
		suffix: "vivo",
		reversed: "oviv"
	},
	{
		suffix: "vlaanderen",
		reversed: "nerednaalv"
	},
	{
		suffix: "vodka",
		reversed: "akdov"
	},
	{
		suffix: "volkswagen",
		reversed: "negawsklov"
	},
	{
		suffix: "volvo",
		reversed: "ovlov"
	},
	{
		suffix: "vote",
		reversed: "etov"
	},
	{
		suffix: "voting",
		reversed: "gnitov"
	},
	{
		suffix: "voto",
		reversed: "otov"
	},
	{
		suffix: "voyage",
		reversed: "egayov"
	},
	{
		suffix: "vuelos",
		reversed: "soleuv"
	},
	{
		suffix: "wales",
		reversed: "selaw"
	},
	{
		suffix: "walmart",
		reversed: "tramlaw"
	},
	{
		suffix: "walter",
		reversed: "retlaw"
	},
	{
		suffix: "wang",
		reversed: "gnaw"
	},
	{
		suffix: "wanggou",
		reversed: "uoggnaw"
	},
	{
		suffix: "watch",
		reversed: "hctaw"
	},
	{
		suffix: "watches",
		reversed: "sehctaw"
	},
	{
		suffix: "weather",
		reversed: "rehtaew"
	},
	{
		suffix: "weatherchannel",
		reversed: "lennahcrehtaew"
	},
	{
		suffix: "webcam",
		reversed: "macbew"
	},
	{
		suffix: "weber",
		reversed: "rebew"
	},
	{
		suffix: "website",
		reversed: "etisbew"
	},
	{
		suffix: "wedding",
		reversed: "gniddew"
	},
	{
		suffix: "weibo",
		reversed: "obiew"
	},
	{
		suffix: "weir",
		reversed: "riew"
	},
	{
		suffix: "whoswho",
		reversed: "ohwsohw"
	},
	{
		suffix: "wien",
		reversed: "neiw"
	},
	{
		suffix: "wiki",
		reversed: "ikiw"
	},
	{
		suffix: "williamhill",
		reversed: "llihmailliw"
	},
	{
		suffix: "win",
		reversed: "niw"
	},
	{
		suffix: "windows",
		reversed: "swodniw"
	},
	{
		suffix: "wine",
		reversed: "eniw"
	},
	{
		suffix: "winners",
		reversed: "srenniw"
	},
	{
		suffix: "wme",
		reversed: "emw"
	},
	{
		suffix: "wolterskluwer",
		reversed: "rewulksretlow"
	},
	{
		suffix: "woodside",
		reversed: "edisdoow"
	},
	{
		suffix: "work",
		reversed: "krow"
	},
	{
		suffix: "works",
		reversed: "skrow"
	},
	{
		suffix: "world",
		reversed: "dlrow"
	},
	{
		suffix: "wow",
		reversed: "wow"
	},
	{
		suffix: "wtc",
		reversed: "ctw"
	},
	{
		suffix: "wtf",
		reversed: "ftw"
	},
	{
		suffix: "xbox",
		reversed: "xobx"
	},
	{
		suffix: "xerox",
		reversed: "xorex"
	},
	{
		suffix: "xfinity",
		reversed: "ytinifx"
	},
	{
		suffix: "xihuan",
		reversed: "nauhix"
	},
	{
		suffix: "xin",
		reversed: "nix"
	},
	{
		suffix: "कॉम",
		reversed: "d3c4b11--nx"
	},
	{
		suffix: "セール",
		reversed: "b1e2kc1--nx"
	},
	{
		suffix: "佛山",
		reversed: "a32wqq1--nx"
	},
	{
		suffix: "慈善",
		reversed: "y7rr03--nx"
	},
	{
		suffix: "集团",
		reversed: "m00tsb3--nx"
	},
	{
		suffix: "在线",
		reversed: "g344sd3--nx"
	},
	{
		suffix: "点看",
		reversed: "k8uxp3--nx"
	},
	{
		suffix: "คอม",
		reversed: "a9d2c24--nx"
	},
	{
		suffix: "八卦",
		reversed: "c11q54--nx"
	},
	{
		suffix: "موقع",
		reversed: "mirbg4--nx"
	},
	{
		suffix: "公益",
		reversed: "g24wq55--nx"
	},
	{
		suffix: "公司",
		reversed: "d5xq55--nx"
	},
	{
		suffix: "香格里拉",
		reversed: "gsgb639j43us5--nx"
	},
	{
		suffix: "网站",
		reversed: "g5mzt5--nx"
	},
	{
		suffix: "移动",
		reversed: "g28zrf6--nx"
	},
	{
		suffix: "我爱你",
		reversed: "lx3b689qq6--nx"
	},
	{
		suffix: "москва",
		reversed: "skhxda08--nx"
	},
	{
		suffix: "католик",
		reversed: "a1rdceqa08--nx"
	},
	{
		suffix: "онлайн",
		reversed: "bdhesa08--nx"
	},
	{
		suffix: "сайт",
		reversed: "gwsa08--nx"
	},
	{
		suffix: "联通",
		reversed: "a360a0y8--nx"
	},
	{
		suffix: "קום",
		reversed: "a2qbd9--nx"
	},
	{
		suffix: "时尚",
		reversed: "u25te9--nx"
	},
	{
		suffix: "微博",
		reversed: "a00trk9--nx"
	},
	{
		suffix: "淡马锡",
		reversed: "dref506w4b--nx"
	},
	{
		suffix: "ファッション",
		reversed: "c4erd5a9b1kcb--nx"
	},
	{
		suffix: "орг",
		reversed: "gva1c--nx"
	},
	{
		suffix: "नेट",
		reversed: "g7rb2c--nx"
	},
	{
		suffix: "ストア",
		reversed: "b3b2kcc--nx"
	},
	{
		suffix: "アマゾン",
		reversed: "dtexcwkcc--nx"
	},
	{
		suffix: "삼성",
		reversed: "ikb4gc--nx"
	},
	{
		suffix: "商标",
		reversed: "b496rzc--nx"
	},
	{
		suffix: "商店",
		reversed: "t0srzc--nx"
	},
	{
		suffix: "商城",
		reversed: "d2urzc--nx"
	},
	{
		suffix: "дети",
		reversed: "b3jca1d--nx"
	},
	{
		suffix: "ポイント",
		reversed: "d9ctdvkce--nx"
	},
	{
		suffix: "新闻",
		reversed: "h88yvfe--nx"
	},
	{
		suffix: "家電",
		reversed: "k924tcf--nx"
	},
	{
		suffix: "كوم",
		reversed: "iebhf--nx"
	},
	{
		suffix: "中文网",
		reversed: "sh5c822qif--nx"
	},
	{
		suffix: "中信",
		reversed: "b46qif--nx"
	},
	{
		suffix: "娱乐",
		reversed: "a027qjf--nx"
	},
	{
		suffix: "谷歌",
		reversed: "e153wlf--nx"
	},
	{
		suffix: "電訊盈科",
		reversed: "mgvu96d8syzf--nx"
	},
	{
		suffix: "购物",
		reversed: "c84xx2g--nx"
	},
	{
		suffix: "クラウド",
		reversed: "f0f3rkcg--nx"
	},
	{
		suffix: "通販",
		reversed: "e1ta3kg--nx"
	},
	{
		suffix: "网店",
		reversed: "e418txh--nx"
	},
	{
		suffix: "संगठन",
		reversed: "e2a6a1b6b1i--nx"
	},
	{
		suffix: "餐厅",
		reversed: "n315rmi--nx"
	},
	{
		suffix: "网络",
		reversed: "i7a0oi--nx"
	},
	{
		suffix: "ком",
		reversed: "fea1j--nx"
	},
	{
		suffix: "亚马逊",
		reversed: "gr2n084qlj--nx"
	},
	{
		suffix: "食品",
		reversed: "m981rvj--nx"
	},
	{
		suffix: "飞利浦",
		reversed: "a4x1d77xrck--nx"
	},
	{
		suffix: "手机",
		reversed: "i3tupk--nx"
	},
	{
		suffix: "ارامكو",
		reversed: "tje3a3abgm--nx"
	},
	{
		suffix: "العليان",
		reversed: "a0nbb0c7abgm--nx"
	},
	{
		suffix: "اتصالات",
		reversed: "fvd7ckaabgm--nx"
	},
	{
		suffix: "بازار",
		reversed: "db2babgm--nx"
	},
	{
		suffix: "ابوظبي",
		reversed: "odzd7acbgm--nx"
	},
	{
		suffix: "كاثوليك",
		reversed: "pxece4ibgm--nx"
	},
	{
		suffix: "همراه",
		reversed: "dhd3tbgm--nx"
	},
	{
		suffix: "닷컴",
		reversed: "c44ub1km--nx"
	},
	{
		suffix: "政府",
		reversed: "m1qtxm--nx"
	},
	{
		suffix: "شبكة",
		reversed: "dza5cbgn--nx"
	},
	{
		suffix: "بيتك",
		reversed: "a0e9ebgn--nx"
	},
	{
		suffix: "عرب",
		reversed: "xrbgn--nx"
	},
	{
		suffix: "机构",
		reversed: "f7vqn--nx"
	},
	{
		suffix: "组织机构",
		reversed: "ame00sf7vqn--nx"
	},
	{
		suffix: "健康",
		reversed: "a62yqyn--nx"
	},
	{
		suffix: "招聘",
		reversed: "d697uto--nx"
	},
	{
		suffix: "рус",
		reversed: "fca1p--nx"
	},
	{
		suffix: "大拿",
		reversed: "u2yssp--nx"
	},
	{
		suffix: "みんな",
		reversed: "c4byj9q--nx"
	},
	{
		suffix: "グーグル",
		reversed: "cmp1akcq--nx"
	},
	{
		suffix: "世界",
		reversed: "g69vqhr--nx"
	},
	{
		suffix: "書籍",
		reversed: "b88uvor--nx"
	},
	{
		suffix: "网址",
		reversed: "g455ses--nx"
	},
	{
		suffix: "닷넷",
		reversed: "a65b06t--nx"
	},
	{
		suffix: "コム",
		reversed: "ewkct--nx"
	},
	{
		suffix: "天主教",
		reversed: "jyqx94qit--nx"
	},
	{
		suffix: "游戏",
		reversed: "y4punu--nx"
	},
	{
		suffix: "vermögensberater",
		reversed: "btc-retarebsnegmrev--nx"
	},
	{
		suffix: "vermögensberatung",
		reversed: "bwp-gnutarebsnegmrev--nx"
	},
	{
		suffix: "企业",
		reversed: "vuqhv--nx"
	},
	{
		suffix: "信息",
		reversed: "b168quv--nx"
	},
	{
		suffix: "嘉里大酒店",
		reversed: "arnd5uhf8le58r4w--nx"
	},
	{
		suffix: "嘉里",
		reversed: "l04sr4w--nx"
	},
	{
		suffix: "广东",
		reversed: "b125qhx--nx"
	},
	{
		suffix: "政务",
		reversed: "b461rfz--nx"
	},
	{
		suffix: "xyz",
		reversed: "zyx"
	},
	{
		suffix: "yachts",
		reversed: "sthcay"
	},
	{
		suffix: "yahoo",
		reversed: "oohay"
	},
	{
		suffix: "yamaxun",
		reversed: "nuxamay"
	},
	{
		suffix: "yandex",
		reversed: "xednay"
	},
	{
		suffix: "yodobashi",
		reversed: "ihsabodoy"
	},
	{
		suffix: "yoga",
		reversed: "agoy"
	},
	{
		suffix: "yokohama",
		reversed: "amahokoy"
	},
	{
		suffix: "you",
		reversed: "uoy"
	},
	{
		suffix: "youtube",
		reversed: "ebutuoy"
	},
	{
		suffix: "yun",
		reversed: "nuy"
	},
	{
		suffix: "zappos",
		reversed: "soppaz"
	},
	{
		suffix: "zara",
		reversed: "araz"
	},
	{
		suffix: "zero",
		reversed: "orez"
	},
	{
		suffix: "zip",
		reversed: "piz"
	},
	{
		suffix: "zone",
		reversed: "enoz"
	},
	{
		suffix: "zuerich",
		reversed: "hcireuz"
	},
	{
		suffix: "cc.ua",
		reversed: "au.cc"
	},
	{
		suffix: "inf.ua",
		reversed: "au.fni"
	},
	{
		suffix: "ltd.ua",
		reversed: "au.dtl"
	},
	{
		suffix: "611.to",
		reversed: "ot.116"
	},
	{
		suffix: "graphox.us",
		reversed: "su.xohparg"
	},
	{
		suffix: "*.devcdnaccesso.com",
		reversed: "moc.osseccandcved"
	},
	{
		suffix: "*.on-acorn.io",
		reversed: "oi.nroca-no"
	},
	{
		suffix: "activetrail.biz",
		reversed: "zib.liartevitca"
	},
	{
		suffix: "adobeaemcloud.com",
		reversed: "moc.duolcmeaeboda"
	},
	{
		suffix: "*.dev.adobeaemcloud.com",
		reversed: "moc.duolcmeaeboda.ved"
	},
	{
		suffix: "hlx.live",
		reversed: "evil.xlh"
	},
	{
		suffix: "adobeaemcloud.net",
		reversed: "ten.duolcmeaeboda"
	},
	{
		suffix: "hlx.page",
		reversed: "egap.xlh"
	},
	{
		suffix: "hlx3.page",
		reversed: "egap.3xlh"
	},
	{
		suffix: "adobeio-static.net",
		reversed: "ten.citats-oieboda"
	},
	{
		suffix: "adobeioruntime.net",
		reversed: "ten.emitnuroieboda"
	},
	{
		suffix: "beep.pl",
		reversed: "lp.peeb"
	},
	{
		suffix: "airkitapps.com",
		reversed: "moc.sppatikria"
	},
	{
		suffix: "airkitapps-au.com",
		reversed: "moc.ua-sppatikria"
	},
	{
		suffix: "airkitapps.eu",
		reversed: "ue.sppatikria"
	},
	{
		suffix: "aivencloud.com",
		reversed: "moc.duolcnevia"
	},
	{
		suffix: "akadns.net",
		reversed: "ten.sndaka"
	},
	{
		suffix: "akamai.net",
		reversed: "ten.iamaka"
	},
	{
		suffix: "akamai-staging.net",
		reversed: "ten.gnigats-iamaka"
	},
	{
		suffix: "akamaiedge.net",
		reversed: "ten.egdeiamaka"
	},
	{
		suffix: "akamaiedge-staging.net",
		reversed: "ten.gnigats-egdeiamaka"
	},
	{
		suffix: "akamaihd.net",
		reversed: "ten.dhiamaka"
	},
	{
		suffix: "akamaihd-staging.net",
		reversed: "ten.gnigats-dhiamaka"
	},
	{
		suffix: "akamaiorigin.net",
		reversed: "ten.nigiroiamaka"
	},
	{
		suffix: "akamaiorigin-staging.net",
		reversed: "ten.gnigats-nigiroiamaka"
	},
	{
		suffix: "akamaized.net",
		reversed: "ten.deziamaka"
	},
	{
		suffix: "akamaized-staging.net",
		reversed: "ten.gnigats-deziamaka"
	},
	{
		suffix: "edgekey.net",
		reversed: "ten.yekegde"
	},
	{
		suffix: "edgekey-staging.net",
		reversed: "ten.gnigats-yekegde"
	},
	{
		suffix: "edgesuite.net",
		reversed: "ten.etiusegde"
	},
	{
		suffix: "edgesuite-staging.net",
		reversed: "ten.gnigats-etiusegde"
	},
	{
		suffix: "barsy.ca",
		reversed: "ac.ysrab"
	},
	{
		suffix: "*.compute.estate",
		reversed: "etatse.etupmoc"
	},
	{
		suffix: "*.alces.network",
		reversed: "krowten.secla"
	},
	{
		suffix: "kasserver.com",
		reversed: "moc.revressak"
	},
	{
		suffix: "altervista.org",
		reversed: "gro.atsivretla"
	},
	{
		suffix: "alwaysdata.net",
		reversed: "ten.atadsyawla"
	},
	{
		suffix: "myamaze.net",
		reversed: "ten.ezamaym"
	},
	{
		suffix: "cloudfront.net",
		reversed: "ten.tnorfduolc"
	},
	{
		suffix: "*.compute.amazonaws.com",
		reversed: "moc.swanozama.etupmoc"
	},
	{
		suffix: "*.compute-1.amazonaws.com",
		reversed: "moc.swanozama.1-etupmoc"
	},
	{
		suffix: "*.compute.amazonaws.com.cn",
		reversed: "nc.moc.swanozama.etupmoc"
	},
	{
		suffix: "us-east-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsae-su"
	},
	{
		suffix: "s3.cn-north-1.amazonaws.com.cn",
		reversed: "nc.moc.swanozama.1-htron-nc.3s"
	},
	{
		suffix: "s3.dualstack.ap-northeast-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsaehtron-pa.kcatslaud.3s"
	},
	{
		suffix: "s3.dualstack.ap-northeast-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsaehtron-pa.kcatslaud.3s"
	},
	{
		suffix: "s3.ap-northeast-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsaehtron-pa.3s"
	},
	{
		suffix: "s3-website.ap-northeast-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsaehtron-pa.etisbew-3s"
	},
	{
		suffix: "s3.dualstack.ap-south-1.amazonaws.com",
		reversed: "moc.swanozama.1-htuos-pa.kcatslaud.3s"
	},
	{
		suffix: "s3.ap-south-1.amazonaws.com",
		reversed: "moc.swanozama.1-htuos-pa.3s"
	},
	{
		suffix: "s3-website.ap-south-1.amazonaws.com",
		reversed: "moc.swanozama.1-htuos-pa.etisbew-3s"
	},
	{
		suffix: "s3.dualstack.ap-southeast-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsaehtuos-pa.kcatslaud.3s"
	},
	{
		suffix: "s3.dualstack.ap-southeast-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsaehtuos-pa.kcatslaud.3s"
	},
	{
		suffix: "s3.dualstack.ca-central-1.amazonaws.com",
		reversed: "moc.swanozama.1-lartnec-ac.kcatslaud.3s"
	},
	{
		suffix: "s3.ca-central-1.amazonaws.com",
		reversed: "moc.swanozama.1-lartnec-ac.3s"
	},
	{
		suffix: "s3-website.ca-central-1.amazonaws.com",
		reversed: "moc.swanozama.1-lartnec-ac.etisbew-3s"
	},
	{
		suffix: "s3.dualstack.eu-central-1.amazonaws.com",
		reversed: "moc.swanozama.1-lartnec-ue.kcatslaud.3s"
	},
	{
		suffix: "s3.eu-central-1.amazonaws.com",
		reversed: "moc.swanozama.1-lartnec-ue.3s"
	},
	{
		suffix: "s3-website.eu-central-1.amazonaws.com",
		reversed: "moc.swanozama.1-lartnec-ue.etisbew-3s"
	},
	{
		suffix: "s3.dualstack.eu-west-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsew-ue.kcatslaud.3s"
	},
	{
		suffix: "s3.dualstack.eu-west-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsew-ue.kcatslaud.3s"
	},
	{
		suffix: "s3.eu-west-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsew-ue.3s"
	},
	{
		suffix: "s3-website.eu-west-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsew-ue.etisbew-3s"
	},
	{
		suffix: "s3.dualstack.eu-west-3.amazonaws.com",
		reversed: "moc.swanozama.3-tsew-ue.kcatslaud.3s"
	},
	{
		suffix: "s3.eu-west-3.amazonaws.com",
		reversed: "moc.swanozama.3-tsew-ue.3s"
	},
	{
		suffix: "s3-website.eu-west-3.amazonaws.com",
		reversed: "moc.swanozama.3-tsew-ue.etisbew-3s"
	},
	{
		suffix: "s3.amazonaws.com",
		reversed: "moc.swanozama.3s"
	},
	{
		suffix: "s3-ap-northeast-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsaehtron-pa-3s"
	},
	{
		suffix: "s3-ap-northeast-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsaehtron-pa-3s"
	},
	{
		suffix: "s3-ap-south-1.amazonaws.com",
		reversed: "moc.swanozama.1-htuos-pa-3s"
	},
	{
		suffix: "s3-ap-southeast-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsaehtuos-pa-3s"
	},
	{
		suffix: "s3-ap-southeast-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsaehtuos-pa-3s"
	},
	{
		suffix: "s3-ca-central-1.amazonaws.com",
		reversed: "moc.swanozama.1-lartnec-ac-3s"
	},
	{
		suffix: "s3-eu-central-1.amazonaws.com",
		reversed: "moc.swanozama.1-lartnec-ue-3s"
	},
	{
		suffix: "s3-eu-west-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsew-ue-3s"
	},
	{
		suffix: "s3-eu-west-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsew-ue-3s"
	},
	{
		suffix: "s3-eu-west-3.amazonaws.com",
		reversed: "moc.swanozama.3-tsew-ue-3s"
	},
	{
		suffix: "s3-external-1.amazonaws.com",
		reversed: "moc.swanozama.1-lanretxe-3s"
	},
	{
		suffix: "s3-fips-us-gov-west-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsew-vog-su-spif-3s"
	},
	{
		suffix: "s3-sa-east-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsae-as-3s"
	},
	{
		suffix: "s3-us-east-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsae-su-3s"
	},
	{
		suffix: "s3-us-gov-west-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsew-vog-su-3s"
	},
	{
		suffix: "s3-us-west-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsew-su-3s"
	},
	{
		suffix: "s3-us-west-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsew-su-3s"
	},
	{
		suffix: "s3-website-ap-northeast-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsaehtron-pa-etisbew-3s"
	},
	{
		suffix: "s3-website-ap-southeast-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsaehtuos-pa-etisbew-3s"
	},
	{
		suffix: "s3-website-ap-southeast-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsaehtuos-pa-etisbew-3s"
	},
	{
		suffix: "s3-website-eu-west-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsew-ue-etisbew-3s"
	},
	{
		suffix: "s3-website-sa-east-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsae-as-etisbew-3s"
	},
	{
		suffix: "s3-website-us-east-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsae-su-etisbew-3s"
	},
	{
		suffix: "s3-website-us-west-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsew-su-etisbew-3s"
	},
	{
		suffix: "s3-website-us-west-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsew-su-etisbew-3s"
	},
	{
		suffix: "s3.dualstack.sa-east-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsae-as.kcatslaud.3s"
	},
	{
		suffix: "s3.dualstack.us-east-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsae-su.kcatslaud.3s"
	},
	{
		suffix: "s3.dualstack.us-east-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsae-su.kcatslaud.3s"
	},
	{
		suffix: "s3.us-east-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsae-su.3s"
	},
	{
		suffix: "s3-website.us-east-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsae-su.etisbew-3s"
	},
	{
		suffix: "vfs.cloud9.af-south-1.amazonaws.com",
		reversed: "moc.swanozama.1-htuos-fa.9duolc.sfv"
	},
	{
		suffix: "webview-assets.cloud9.af-south-1.amazonaws.com",
		reversed: "moc.swanozama.1-htuos-fa.9duolc.stessa-weivbew"
	},
	{
		suffix: "vfs.cloud9.ap-east-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsae-pa.9duolc.sfv"
	},
	{
		suffix: "webview-assets.cloud9.ap-east-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsae-pa.9duolc.stessa-weivbew"
	},
	{
		suffix: "vfs.cloud9.ap-northeast-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsaehtron-pa.9duolc.sfv"
	},
	{
		suffix: "webview-assets.cloud9.ap-northeast-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsaehtron-pa.9duolc.stessa-weivbew"
	},
	{
		suffix: "vfs.cloud9.ap-northeast-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsaehtron-pa.9duolc.sfv"
	},
	{
		suffix: "webview-assets.cloud9.ap-northeast-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsaehtron-pa.9duolc.stessa-weivbew"
	},
	{
		suffix: "vfs.cloud9.ap-northeast-3.amazonaws.com",
		reversed: "moc.swanozama.3-tsaehtron-pa.9duolc.sfv"
	},
	{
		suffix: "webview-assets.cloud9.ap-northeast-3.amazonaws.com",
		reversed: "moc.swanozama.3-tsaehtron-pa.9duolc.stessa-weivbew"
	},
	{
		suffix: "vfs.cloud9.ap-south-1.amazonaws.com",
		reversed: "moc.swanozama.1-htuos-pa.9duolc.sfv"
	},
	{
		suffix: "webview-assets.cloud9.ap-south-1.amazonaws.com",
		reversed: "moc.swanozama.1-htuos-pa.9duolc.stessa-weivbew"
	},
	{
		suffix: "vfs.cloud9.ap-southeast-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsaehtuos-pa.9duolc.sfv"
	},
	{
		suffix: "webview-assets.cloud9.ap-southeast-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsaehtuos-pa.9duolc.stessa-weivbew"
	},
	{
		suffix: "vfs.cloud9.ap-southeast-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsaehtuos-pa.9duolc.sfv"
	},
	{
		suffix: "webview-assets.cloud9.ap-southeast-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsaehtuos-pa.9duolc.stessa-weivbew"
	},
	{
		suffix: "vfs.cloud9.ca-central-1.amazonaws.com",
		reversed: "moc.swanozama.1-lartnec-ac.9duolc.sfv"
	},
	{
		suffix: "webview-assets.cloud9.ca-central-1.amazonaws.com",
		reversed: "moc.swanozama.1-lartnec-ac.9duolc.stessa-weivbew"
	},
	{
		suffix: "vfs.cloud9.eu-central-1.amazonaws.com",
		reversed: "moc.swanozama.1-lartnec-ue.9duolc.sfv"
	},
	{
		suffix: "webview-assets.cloud9.eu-central-1.amazonaws.com",
		reversed: "moc.swanozama.1-lartnec-ue.9duolc.stessa-weivbew"
	},
	{
		suffix: "vfs.cloud9.eu-north-1.amazonaws.com",
		reversed: "moc.swanozama.1-htron-ue.9duolc.sfv"
	},
	{
		suffix: "webview-assets.cloud9.eu-north-1.amazonaws.com",
		reversed: "moc.swanozama.1-htron-ue.9duolc.stessa-weivbew"
	},
	{
		suffix: "vfs.cloud9.eu-south-1.amazonaws.com",
		reversed: "moc.swanozama.1-htuos-ue.9duolc.sfv"
	},
	{
		suffix: "webview-assets.cloud9.eu-south-1.amazonaws.com",
		reversed: "moc.swanozama.1-htuos-ue.9duolc.stessa-weivbew"
	},
	{
		suffix: "vfs.cloud9.eu-west-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsew-ue.9duolc.sfv"
	},
	{
		suffix: "webview-assets.cloud9.eu-west-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsew-ue.9duolc.stessa-weivbew"
	},
	{
		suffix: "vfs.cloud9.eu-west-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsew-ue.9duolc.sfv"
	},
	{
		suffix: "webview-assets.cloud9.eu-west-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsew-ue.9duolc.stessa-weivbew"
	},
	{
		suffix: "vfs.cloud9.eu-west-3.amazonaws.com",
		reversed: "moc.swanozama.3-tsew-ue.9duolc.sfv"
	},
	{
		suffix: "webview-assets.cloud9.eu-west-3.amazonaws.com",
		reversed: "moc.swanozama.3-tsew-ue.9duolc.stessa-weivbew"
	},
	{
		suffix: "vfs.cloud9.me-south-1.amazonaws.com",
		reversed: "moc.swanozama.1-htuos-em.9duolc.sfv"
	},
	{
		suffix: "webview-assets.cloud9.me-south-1.amazonaws.com",
		reversed: "moc.swanozama.1-htuos-em.9duolc.stessa-weivbew"
	},
	{
		suffix: "vfs.cloud9.sa-east-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsae-as.9duolc.sfv"
	},
	{
		suffix: "webview-assets.cloud9.sa-east-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsae-as.9duolc.stessa-weivbew"
	},
	{
		suffix: "vfs.cloud9.us-east-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsae-su.9duolc.sfv"
	},
	{
		suffix: "webview-assets.cloud9.us-east-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsae-su.9duolc.stessa-weivbew"
	},
	{
		suffix: "vfs.cloud9.us-east-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsae-su.9duolc.sfv"
	},
	{
		suffix: "webview-assets.cloud9.us-east-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsae-su.9duolc.stessa-weivbew"
	},
	{
		suffix: "vfs.cloud9.us-west-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsew-su.9duolc.sfv"
	},
	{
		suffix: "webview-assets.cloud9.us-west-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsew-su.9duolc.stessa-weivbew"
	},
	{
		suffix: "vfs.cloud9.us-west-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsew-su.9duolc.sfv"
	},
	{
		suffix: "webview-assets.cloud9.us-west-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsew-su.9duolc.stessa-weivbew"
	},
	{
		suffix: "cn-north-1.eb.amazonaws.com.cn",
		reversed: "nc.moc.swanozama.be.1-htron-nc"
	},
	{
		suffix: "cn-northwest-1.eb.amazonaws.com.cn",
		reversed: "nc.moc.swanozama.be.1-tsewhtron-nc"
	},
	{
		suffix: "elasticbeanstalk.com",
		reversed: "moc.klatsnaebcitsale"
	},
	{
		suffix: "ap-northeast-1.elasticbeanstalk.com",
		reversed: "moc.klatsnaebcitsale.1-tsaehtron-pa"
	},
	{
		suffix: "ap-northeast-2.elasticbeanstalk.com",
		reversed: "moc.klatsnaebcitsale.2-tsaehtron-pa"
	},
	{
		suffix: "ap-northeast-3.elasticbeanstalk.com",
		reversed: "moc.klatsnaebcitsale.3-tsaehtron-pa"
	},
	{
		suffix: "ap-south-1.elasticbeanstalk.com",
		reversed: "moc.klatsnaebcitsale.1-htuos-pa"
	},
	{
		suffix: "ap-southeast-1.elasticbeanstalk.com",
		reversed: "moc.klatsnaebcitsale.1-tsaehtuos-pa"
	},
	{
		suffix: "ap-southeast-2.elasticbeanstalk.com",
		reversed: "moc.klatsnaebcitsale.2-tsaehtuos-pa"
	},
	{
		suffix: "ca-central-1.elasticbeanstalk.com",
		reversed: "moc.klatsnaebcitsale.1-lartnec-ac"
	},
	{
		suffix: "eu-central-1.elasticbeanstalk.com",
		reversed: "moc.klatsnaebcitsale.1-lartnec-ue"
	},
	{
		suffix: "eu-west-1.elasticbeanstalk.com",
		reversed: "moc.klatsnaebcitsale.1-tsew-ue"
	},
	{
		suffix: "eu-west-2.elasticbeanstalk.com",
		reversed: "moc.klatsnaebcitsale.2-tsew-ue"
	},
	{
		suffix: "eu-west-3.elasticbeanstalk.com",
		reversed: "moc.klatsnaebcitsale.3-tsew-ue"
	},
	{
		suffix: "sa-east-1.elasticbeanstalk.com",
		reversed: "moc.klatsnaebcitsale.1-tsae-as"
	},
	{
		suffix: "us-east-1.elasticbeanstalk.com",
		reversed: "moc.klatsnaebcitsale.1-tsae-su"
	},
	{
		suffix: "us-east-2.elasticbeanstalk.com",
		reversed: "moc.klatsnaebcitsale.2-tsae-su"
	},
	{
		suffix: "us-gov-west-1.elasticbeanstalk.com",
		reversed: "moc.klatsnaebcitsale.1-tsew-vog-su"
	},
	{
		suffix: "us-west-1.elasticbeanstalk.com",
		reversed: "moc.klatsnaebcitsale.1-tsew-su"
	},
	{
		suffix: "us-west-2.elasticbeanstalk.com",
		reversed: "moc.klatsnaebcitsale.2-tsew-su"
	},
	{
		suffix: "*.elb.amazonaws.com.cn",
		reversed: "nc.moc.swanozama.ble"
	},
	{
		suffix: "*.elb.amazonaws.com",
		reversed: "moc.swanozama.ble"
	},
	{
		suffix: "awsglobalaccelerator.com",
		reversed: "moc.rotareleccalabolgswa"
	},
	{
		suffix: "eero.online",
		reversed: "enilno.oree"
	},
	{
		suffix: "eero-stage.online",
		reversed: "enilno.egats-oree"
	},
	{
		suffix: "t3l3p0rt.net",
		reversed: "ten.tr0p3l3t"
	},
	{
		suffix: "tele.amune.org",
		reversed: "gro.enuma.elet"
	},
	{
		suffix: "apigee.io",
		reversed: "oi.eegipa"
	},
	{
		suffix: "siiites.com",
		reversed: "moc.setiiis"
	},
	{
		suffix: "appspacehosted.com",
		reversed: "moc.detsohecapsppa"
	},
	{
		suffix: "appspaceusercontent.com",
		reversed: "moc.tnetnocresuecapsppa"
	},
	{
		suffix: "appudo.net",
		reversed: "ten.oduppa"
	},
	{
		suffix: "on-aptible.com",
		reversed: "moc.elbitpa-no"
	},
	{
		suffix: "user.aseinet.ne.jp",
		reversed: "pj.en.teniesa.resu"
	},
	{
		suffix: "gv.vc",
		reversed: "cv.vg"
	},
	{
		suffix: "d.gv.vc",
		reversed: "cv.vg.d"
	},
	{
		suffix: "user.party.eus",
		reversed: "sue.ytrap.resu"
	},
	{
		suffix: "pimienta.org",
		reversed: "gro.atneimip"
	},
	{
		suffix: "poivron.org",
		reversed: "gro.norviop"
	},
	{
		suffix: "potager.org",
		reversed: "gro.regatop"
	},
	{
		suffix: "sweetpepper.org",
		reversed: "gro.reppepteews"
	},
	{
		suffix: "myasustor.com",
		reversed: "moc.rotsusaym"
	},
	{
		suffix: "cdn.prod.atlassian-dev.net",
		reversed: "ten.ved-naissalta.dorp.ndc"
	},
	{
		suffix: "translated.page",
		reversed: "egap.detalsnart"
	},
	{
		suffix: "autocode.dev",
		reversed: "ved.edocotua"
	},
	{
		suffix: "myfritz.net",
		reversed: "ten.ztirfym"
	},
	{
		suffix: "onavstack.net",
		reversed: "ten.kcatsvano"
	},
	{
		suffix: "*.awdev.ca",
		reversed: "ac.vedwa"
	},
	{
		suffix: "*.advisor.ws",
		reversed: "sw.rosivda"
	},
	{
		suffix: "ecommerce-shop.pl",
		reversed: "lp.pohs-ecremmoce"
	},
	{
		suffix: "b-data.io",
		reversed: "oi.atad-b"
	},
	{
		suffix: "backplaneapp.io",
		reversed: "oi.ppaenalpkcab"
	},
	{
		suffix: "balena-devices.com",
		reversed: "moc.secived-anelab"
	},
	{
		suffix: "rs.ba",
		reversed: "ab.sr"
	},
	{
		suffix: "*.banzai.cloud",
		reversed: "duolc.iaznab"
	},
	{
		suffix: "app.banzaicloud.io",
		reversed: "oi.duolciaznab.ppa"
	},
	{
		suffix: "*.backyards.banzaicloud.io",
		reversed: "oi.duolciaznab.sdraykcab"
	},
	{
		suffix: "base.ec",
		reversed: "ce.esab"
	},
	{
		suffix: "official.ec",
		reversed: "ce.laiciffo"
	},
	{
		suffix: "buyshop.jp",
		reversed: "pj.pohsyub"
	},
	{
		suffix: "fashionstore.jp",
		reversed: "pj.erotsnoihsaf"
	},
	{
		suffix: "handcrafted.jp",
		reversed: "pj.detfarcdnah"
	},
	{
		suffix: "kawaiishop.jp",
		reversed: "pj.pohsiiawak"
	},
	{
		suffix: "supersale.jp",
		reversed: "pj.elasrepus"
	},
	{
		suffix: "theshop.jp",
		reversed: "pj.pohseht"
	},
	{
		suffix: "shopselect.net",
		reversed: "ten.tcelespohs"
	},
	{
		suffix: "base.shop",
		reversed: "pohs.esab"
	},
	{
		suffix: "beagleboard.io",
		reversed: "oi.draobelgaeb"
	},
	{
		suffix: "*.beget.app",
		reversed: "ppa.tegeb"
	},
	{
		suffix: "betainabox.com",
		reversed: "moc.xobaniateb"
	},
	{
		suffix: "bnr.la",
		reversed: "al.rnb"
	},
	{
		suffix: "bitbucket.io",
		reversed: "oi.tekcubtib"
	},
	{
		suffix: "blackbaudcdn.net",
		reversed: "ten.ndcduabkcalb"
	},
	{
		suffix: "of.je",
		reversed: "ej.fo"
	},
	{
		suffix: "bluebite.io",
		reversed: "oi.etibeulb"
	},
	{
		suffix: "boomla.net",
		reversed: "ten.almoob"
	},
	{
		suffix: "boutir.com",
		reversed: "moc.rituob"
	},
	{
		suffix: "boxfuse.io",
		reversed: "oi.esufxob"
	},
	{
		suffix: "square7.ch",
		reversed: "hc.7erauqs"
	},
	{
		suffix: "bplaced.com",
		reversed: "moc.decalpb"
	},
	{
		suffix: "bplaced.de",
		reversed: "ed.decalpb"
	},
	{
		suffix: "square7.de",
		reversed: "ed.7erauqs"
	},
	{
		suffix: "bplaced.net",
		reversed: "ten.decalpb"
	},
	{
		suffix: "square7.net",
		reversed: "ten.7erauqs"
	},
	{
		suffix: "shop.brendly.rs",
		reversed: "sr.yldnerb.pohs"
	},
	{
		suffix: "browsersafetymark.io",
		reversed: "oi.kramytefasresworb"
	},
	{
		suffix: "uk0.bigv.io",
		reversed: "oi.vgib.0ku"
	},
	{
		suffix: "dh.bytemark.co.uk",
		reversed: "ku.oc.krametyb.hd"
	},
	{
		suffix: "vm.bytemark.co.uk",
		reversed: "ku.oc.krametyb.mv"
	},
	{
		suffix: "cafjs.com",
		reversed: "moc.sjfac"
	},
	{
		suffix: "mycd.eu",
		reversed: "ue.dcym"
	},
	{
		suffix: "canva-apps.cn",
		reversed: "nc.sppa-avnac"
	},
	{
		suffix: "canva-apps.com",
		reversed: "moc.sppa-avnac"
	},
	{
		suffix: "drr.ac",
		reversed: "ca.rrd"
	},
	{
		suffix: "uwu.ai",
		reversed: "ia.uwu"
	},
	{
		suffix: "carrd.co",
		reversed: "oc.drrac"
	},
	{
		suffix: "crd.co",
		reversed: "oc.drc"
	},
	{
		suffix: "ju.mp",
		reversed: "pm.uj"
	},
	{
		suffix: "ae.org",
		reversed: "gro.ea"
	},
	{
		suffix: "br.com",
		reversed: "moc.rb"
	},
	{
		suffix: "cn.com",
		reversed: "moc.nc"
	},
	{
		suffix: "com.de",
		reversed: "ed.moc"
	},
	{
		suffix: "com.se",
		reversed: "es.moc"
	},
	{
		suffix: "de.com",
		reversed: "moc.ed"
	},
	{
		suffix: "eu.com",
		reversed: "moc.ue"
	},
	{
		suffix: "gb.net",
		reversed: "ten.bg"
	},
	{
		suffix: "hu.net",
		reversed: "ten.uh"
	},
	{
		suffix: "jp.net",
		reversed: "ten.pj"
	},
	{
		suffix: "jpn.com",
		reversed: "moc.npj"
	},
	{
		suffix: "mex.com",
		reversed: "moc.xem"
	},
	{
		suffix: "ru.com",
		reversed: "moc.ur"
	},
	{
		suffix: "sa.com",
		reversed: "moc.as"
	},
	{
		suffix: "se.net",
		reversed: "ten.es"
	},
	{
		suffix: "uk.com",
		reversed: "moc.ku"
	},
	{
		suffix: "uk.net",
		reversed: "ten.ku"
	},
	{
		suffix: "us.com",
		reversed: "moc.su"
	},
	{
		suffix: "za.bz",
		reversed: "zb.az"
	},
	{
		suffix: "za.com",
		reversed: "moc.az"
	},
	{
		suffix: "ar.com",
		reversed: "moc.ra"
	},
	{
		suffix: "hu.com",
		reversed: "moc.uh"
	},
	{
		suffix: "kr.com",
		reversed: "moc.rk"
	},
	{
		suffix: "no.com",
		reversed: "moc.on"
	},
	{
		suffix: "qc.com",
		reversed: "moc.cq"
	},
	{
		suffix: "uy.com",
		reversed: "moc.yu"
	},
	{
		suffix: "africa.com",
		reversed: "moc.acirfa"
	},
	{
		suffix: "gr.com",
		reversed: "moc.rg"
	},
	{
		suffix: "in.net",
		reversed: "ten.ni"
	},
	{
		suffix: "web.in",
		reversed: "ni.bew"
	},
	{
		suffix: "us.org",
		reversed: "gro.su"
	},
	{
		suffix: "co.com",
		reversed: "moc.oc"
	},
	{
		suffix: "aus.basketball",
		reversed: "llabteksab.sua"
	},
	{
		suffix: "nz.basketball",
		reversed: "llabteksab.zn"
	},
	{
		suffix: "radio.am",
		reversed: "ma.oidar"
	},
	{
		suffix: "radio.fm",
		reversed: "mf.oidar"
	},
	{
		suffix: "c.la",
		reversed: "al.c"
	},
	{
		suffix: "certmgr.org",
		reversed: "gro.rgmtrec"
	},
	{
		suffix: "cx.ua",
		reversed: "au.xc"
	},
	{
		suffix: "discourse.group",
		reversed: "puorg.esruocsid"
	},
	{
		suffix: "discourse.team",
		reversed: "maet.esruocsid"
	},
	{
		suffix: "cleverapps.io",
		reversed: "oi.spparevelc"
	},
	{
		suffix: "clerk.app",
		reversed: "ppa.krelc"
	},
	{
		suffix: "clerkstage.app",
		reversed: "ppa.egatskrelc"
	},
	{
		suffix: "*.lcl.dev",
		reversed: "ved.lcl"
	},
	{
		suffix: "*.lclstage.dev",
		reversed: "ved.egatslcl"
	},
	{
		suffix: "*.stg.dev",
		reversed: "ved.gts"
	},
	{
		suffix: "*.stgstage.dev",
		reversed: "ved.egatsgts"
	},
	{
		suffix: "clickrising.net",
		reversed: "ten.gnisirkcilc"
	},
	{
		suffix: "c66.me",
		reversed: "em.66c"
	},
	{
		suffix: "cloud66.ws",
		reversed: "sw.66duolc"
	},
	{
		suffix: "cloud66.zone",
		reversed: "enoz.66duolc"
	},
	{
		suffix: "jdevcloud.com",
		reversed: "moc.duolcvedj"
	},
	{
		suffix: "wpdevcloud.com",
		reversed: "moc.duolcvedpw"
	},
	{
		suffix: "cloudaccess.host",
		reversed: "tsoh.sseccaduolc"
	},
	{
		suffix: "freesite.host",
		reversed: "tsoh.etiseerf"
	},
	{
		suffix: "cloudaccess.net",
		reversed: "ten.sseccaduolc"
	},
	{
		suffix: "cloudcontrolled.com",
		reversed: "moc.dellortnocduolc"
	},
	{
		suffix: "cloudcontrolapp.com",
		reversed: "moc.ppalortnocduolc"
	},
	{
		suffix: "*.cloudera.site",
		reversed: "etis.areduolc"
	},
	{
		suffix: "cf-ipfs.com",
		reversed: "moc.sfpi-fc"
	},
	{
		suffix: "cloudflare-ipfs.com",
		reversed: "moc.sfpi-eralfduolc"
	},
	{
		suffix: "trycloudflare.com",
		reversed: "moc.eralfduolcyrt"
	},
	{
		suffix: "pages.dev",
		reversed: "ved.segap"
	},
	{
		suffix: "r2.dev",
		reversed: "ved.2r"
	},
	{
		suffix: "workers.dev",
		reversed: "ved.srekrow"
	},
	{
		suffix: "wnext.app",
		reversed: "ppa.txenw"
	},
	{
		suffix: "co.ca",
		reversed: "ac.oc"
	},
	{
		suffix: "*.otap.co",
		reversed: "oc.pato"
	},
	{
		suffix: "co.cz",
		reversed: "zc.oc"
	},
	{
		suffix: "c.cdn77.org",
		reversed: "gro.77ndc.c"
	},
	{
		suffix: "cdn77-ssl.net",
		reversed: "ten.lss-77ndc"
	},
	{
		suffix: "r.cdn77.net",
		reversed: "ten.77ndc.r"
	},
	{
		suffix: "rsc.cdn77.org",
		reversed: "gro.77ndc.csr"
	},
	{
		suffix: "ssl.origin.cdn77-secure.org",
		reversed: "gro.eruces-77ndc.nigiro.lss"
	},
	{
		suffix: "cloudns.asia",
		reversed: "aisa.snduolc"
	},
	{
		suffix: "cloudns.biz",
		reversed: "zib.snduolc"
	},
	{
		suffix: "cloudns.club",
		reversed: "bulc.snduolc"
	},
	{
		suffix: "cloudns.cc",
		reversed: "cc.snduolc"
	},
	{
		suffix: "cloudns.eu",
		reversed: "ue.snduolc"
	},
	{
		suffix: "cloudns.in",
		reversed: "ni.snduolc"
	},
	{
		suffix: "cloudns.info",
		reversed: "ofni.snduolc"
	},
	{
		suffix: "cloudns.org",
		reversed: "gro.snduolc"
	},
	{
		suffix: "cloudns.pro",
		reversed: "orp.snduolc"
	},
	{
		suffix: "cloudns.pw",
		reversed: "wp.snduolc"
	},
	{
		suffix: "cloudns.us",
		reversed: "su.snduolc"
	},
	{
		suffix: "cnpy.gdn",
		reversed: "ndg.ypnc"
	},
	{
		suffix: "codeberg.page",
		reversed: "egap.grebedoc"
	},
	{
		suffix: "co.nl",
		reversed: "ln.oc"
	},
	{
		suffix: "co.no",
		reversed: "on.oc"
	},
	{
		suffix: "webhosting.be",
		reversed: "eb.gnitsohbew"
	},
	{
		suffix: "hosting-cluster.nl",
		reversed: "ln.retsulc-gnitsoh"
	},
	{
		suffix: "ac.ru",
		reversed: "ur.ca"
	},
	{
		suffix: "edu.ru",
		reversed: "ur.ude"
	},
	{
		suffix: "gov.ru",
		reversed: "ur.vog"
	},
	{
		suffix: "int.ru",
		reversed: "ur.tni"
	},
	{
		suffix: "mil.ru",
		reversed: "ur.lim"
	},
	{
		suffix: "test.ru",
		reversed: "ur.tset"
	},
	{
		suffix: "dyn.cosidns.de",
		reversed: "ed.sndisoc.nyd"
	},
	{
		suffix: "dynamisches-dns.de",
		reversed: "ed.snd-sehcsimanyd"
	},
	{
		suffix: "dnsupdater.de",
		reversed: "ed.retadpusnd"
	},
	{
		suffix: "internet-dns.de",
		reversed: "ed.snd-tenretni"
	},
	{
		suffix: "l-o-g-i-n.de",
		reversed: "ed.n-i-g-o-l"
	},
	{
		suffix: "dynamic-dns.info",
		reversed: "ofni.snd-cimanyd"
	},
	{
		suffix: "feste-ip.net",
		reversed: "ten.pi-etsef"
	},
	{
		suffix: "knx-server.net",
		reversed: "ten.revres-xnk"
	},
	{
		suffix: "static-access.net",
		reversed: "ten.ssecca-citats"
	},
	{
		suffix: "realm.cz",
		reversed: "zc.mlaer"
	},
	{
		suffix: "*.cryptonomic.net",
		reversed: "ten.cimonotpyrc"
	},
	{
		suffix: "cupcake.is",
		reversed: "si.ekacpuc"
	},
	{
		suffix: "curv.dev",
		reversed: "ved.vruc"
	},
	{
		suffix: "*.customer-oci.com",
		reversed: "moc.ico-remotsuc"
	},
	{
		suffix: "*.oci.customer-oci.com",
		reversed: "moc.ico-remotsuc.ico"
	},
	{
		suffix: "*.ocp.customer-oci.com",
		reversed: "moc.ico-remotsuc.pco"
	},
	{
		suffix: "*.ocs.customer-oci.com",
		reversed: "moc.ico-remotsuc.sco"
	},
	{
		suffix: "cyon.link",
		reversed: "knil.noyc"
	},
	{
		suffix: "cyon.site",
		reversed: "etis.noyc"
	},
	{
		suffix: "fnwk.site",
		reversed: "etis.kwnf"
	},
	{
		suffix: "folionetwork.site",
		reversed: "etis.krowtenoilof"
	},
	{
		suffix: "platform0.app",
		reversed: "ppa.0mroftalp"
	},
	{
		suffix: "daplie.me",
		reversed: "em.eilpad"
	},
	{
		suffix: "localhost.daplie.me",
		reversed: "em.eilpad.tsohlacol"
	},
	{
		suffix: "dattolocal.com",
		reversed: "moc.lacolottad"
	},
	{
		suffix: "dattorelay.com",
		reversed: "moc.yalerottad"
	},
	{
		suffix: "dattoweb.com",
		reversed: "moc.bewottad"
	},
	{
		suffix: "mydatto.com",
		reversed: "moc.ottadym"
	},
	{
		suffix: "dattolocal.net",
		reversed: "ten.lacolottad"
	},
	{
		suffix: "mydatto.net",
		reversed: "ten.ottadym"
	},
	{
		suffix: "biz.dk",
		reversed: "kd.zib"
	},
	{
		suffix: "co.dk",
		reversed: "kd.oc"
	},
	{
		suffix: "firm.dk",
		reversed: "kd.mrif"
	},
	{
		suffix: "reg.dk",
		reversed: "kd.ger"
	},
	{
		suffix: "store.dk",
		reversed: "kd.erots"
	},
	{
		suffix: "dyndns.dappnode.io",
		reversed: "oi.edonppad.sndnyd"
	},
	{
		suffix: "*.dapps.earth",
		reversed: "htrae.sppad"
	},
	{
		suffix: "*.bzz.dapps.earth",
		reversed: "htrae.sppad.zzb"
	},
	{
		suffix: "builtwithdark.com",
		reversed: "moc.kradhtiwtliub"
	},
	{
		suffix: "demo.datadetect.com",
		reversed: "moc.tcetedatad.omed"
	},
	{
		suffix: "instance.datadetect.com",
		reversed: "moc.tcetedatad.ecnatsni"
	},
	{
		suffix: "edgestack.me",
		reversed: "em.kcatsegde"
	},
	{
		suffix: "ddns5.com",
		reversed: "moc.5sndd"
	},
	{
		suffix: "debian.net",
		reversed: "ten.naibed"
	},
	{
		suffix: "deno.dev",
		reversed: "ved.oned"
	},
	{
		suffix: "deno-staging.dev",
		reversed: "ved.gnigats-oned"
	},
	{
		suffix: "dedyn.io",
		reversed: "oi.nyded"
	},
	{
		suffix: "deta.app",
		reversed: "ppa.ated"
	},
	{
		suffix: "deta.dev",
		reversed: "ved.ated"
	},
	{
		suffix: "*.rss.my.id",
		reversed: "di.ym.ssr"
	},
	{
		suffix: "*.diher.solutions",
		reversed: "snoitulos.rehid"
	},
	{
		suffix: "discordsays.com",
		reversed: "moc.syasdrocsid"
	},
	{
		suffix: "discordsez.com",
		reversed: "moc.zesdrocsid"
	},
	{
		suffix: "jozi.biz",
		reversed: "zib.izoj"
	},
	{
		suffix: "dnshome.de",
		reversed: "ed.emohsnd"
	},
	{
		suffix: "online.th",
		reversed: "ht.enilno"
	},
	{
		suffix: "shop.th",
		reversed: "ht.pohs"
	},
	{
		suffix: "drayddns.com",
		reversed: "moc.snddyard"
	},
	{
		suffix: "shoparena.pl",
		reversed: "lp.anerapohs"
	},
	{
		suffix: "dreamhosters.com",
		reversed: "moc.sretsohmaerd"
	},
	{
		suffix: "mydrobo.com",
		reversed: "moc.obordym"
	},
	{
		suffix: "drud.io",
		reversed: "oi.durd"
	},
	{
		suffix: "drud.us",
		reversed: "su.durd"
	},
	{
		suffix: "duckdns.org",
		reversed: "gro.sndkcud"
	},
	{
		suffix: "bip.sh",
		reversed: "hs.pib"
	},
	{
		suffix: "bitbridge.net",
		reversed: "ten.egdirbtib"
	},
	{
		suffix: "dy.fi",
		reversed: "if.yd"
	},
	{
		suffix: "tunk.org",
		reversed: "gro.knut"
	},
	{
		suffix: "dyndns-at-home.com",
		reversed: "moc.emoh-ta-sndnyd"
	},
	{
		suffix: "dyndns-at-work.com",
		reversed: "moc.krow-ta-sndnyd"
	},
	{
		suffix: "dyndns-blog.com",
		reversed: "moc.golb-sndnyd"
	},
	{
		suffix: "dyndns-free.com",
		reversed: "moc.eerf-sndnyd"
	},
	{
		suffix: "dyndns-home.com",
		reversed: "moc.emoh-sndnyd"
	},
	{
		suffix: "dyndns-ip.com",
		reversed: "moc.pi-sndnyd"
	},
	{
		suffix: "dyndns-mail.com",
		reversed: "moc.liam-sndnyd"
	},
	{
		suffix: "dyndns-office.com",
		reversed: "moc.eciffo-sndnyd"
	},
	{
		suffix: "dyndns-pics.com",
		reversed: "moc.scip-sndnyd"
	},
	{
		suffix: "dyndns-remote.com",
		reversed: "moc.etomer-sndnyd"
	},
	{
		suffix: "dyndns-server.com",
		reversed: "moc.revres-sndnyd"
	},
	{
		suffix: "dyndns-web.com",
		reversed: "moc.bew-sndnyd"
	},
	{
		suffix: "dyndns-wiki.com",
		reversed: "moc.ikiw-sndnyd"
	},
	{
		suffix: "dyndns-work.com",
		reversed: "moc.krow-sndnyd"
	},
	{
		suffix: "dyndns.biz",
		reversed: "zib.sndnyd"
	},
	{
		suffix: "dyndns.info",
		reversed: "ofni.sndnyd"
	},
	{
		suffix: "dyndns.org",
		reversed: "gro.sndnyd"
	},
	{
		suffix: "dyndns.tv",
		reversed: "vt.sndnyd"
	},
	{
		suffix: "at-band-camp.net",
		reversed: "ten.pmac-dnab-ta"
	},
	{
		suffix: "ath.cx",
		reversed: "xc.hta"
	},
	{
		suffix: "barrel-of-knowledge.info",
		reversed: "ofni.egdelwonk-fo-lerrab"
	},
	{
		suffix: "barrell-of-knowledge.info",
		reversed: "ofni.egdelwonk-fo-llerrab"
	},
	{
		suffix: "better-than.tv",
		reversed: "vt.naht-retteb"
	},
	{
		suffix: "blogdns.com",
		reversed: "moc.sndgolb"
	},
	{
		suffix: "blogdns.net",
		reversed: "ten.sndgolb"
	},
	{
		suffix: "blogdns.org",
		reversed: "gro.sndgolb"
	},
	{
		suffix: "blogsite.org",
		reversed: "gro.etisgolb"
	},
	{
		suffix: "boldlygoingnowhere.org",
		reversed: "gro.erehwongniogyldlob"
	},
	{
		suffix: "broke-it.net",
		reversed: "ten.ti-ekorb"
	},
	{
		suffix: "buyshouses.net",
		reversed: "ten.sesuohsyub"
	},
	{
		suffix: "cechire.com",
		reversed: "moc.erihcec"
	},
	{
		suffix: "dnsalias.com",
		reversed: "moc.sailasnd"
	},
	{
		suffix: "dnsalias.net",
		reversed: "ten.sailasnd"
	},
	{
		suffix: "dnsalias.org",
		reversed: "gro.sailasnd"
	},
	{
		suffix: "dnsdojo.com",
		reversed: "moc.ojodsnd"
	},
	{
		suffix: "dnsdojo.net",
		reversed: "ten.ojodsnd"
	},
	{
		suffix: "dnsdojo.org",
		reversed: "gro.ojodsnd"
	},
	{
		suffix: "does-it.net",
		reversed: "ten.ti-seod"
	},
	{
		suffix: "doesntexist.com",
		reversed: "moc.tsixetnseod"
	},
	{
		suffix: "doesntexist.org",
		reversed: "gro.tsixetnseod"
	},
	{
		suffix: "dontexist.com",
		reversed: "moc.tsixetnod"
	},
	{
		suffix: "dontexist.net",
		reversed: "ten.tsixetnod"
	},
	{
		suffix: "dontexist.org",
		reversed: "gro.tsixetnod"
	},
	{
		suffix: "doomdns.com",
		reversed: "moc.sndmood"
	},
	{
		suffix: "doomdns.org",
		reversed: "gro.sndmood"
	},
	{
		suffix: "dvrdns.org",
		reversed: "gro.sndrvd"
	},
	{
		suffix: "dyn-o-saur.com",
		reversed: "moc.ruas-o-nyd"
	},
	{
		suffix: "dynalias.com",
		reversed: "moc.sailanyd"
	},
	{
		suffix: "dynalias.net",
		reversed: "ten.sailanyd"
	},
	{
		suffix: "dynalias.org",
		reversed: "gro.sailanyd"
	},
	{
		suffix: "dynathome.net",
		reversed: "ten.emohtanyd"
	},
	{
		suffix: "dyndns.ws",
		reversed: "sw.sndnyd"
	},
	{
		suffix: "endofinternet.net",
		reversed: "ten.tenretnifodne"
	},
	{
		suffix: "endofinternet.org",
		reversed: "gro.tenretnifodne"
	},
	{
		suffix: "endoftheinternet.org",
		reversed: "gro.tenretniehtfodne"
	},
	{
		suffix: "est-a-la-maison.com",
		reversed: "moc.nosiam-al-a-tse"
	},
	{
		suffix: "est-a-la-masion.com",
		reversed: "moc.noisam-al-a-tse"
	},
	{
		suffix: "est-le-patron.com",
		reversed: "moc.nortap-el-tse"
	},
	{
		suffix: "est-mon-blogueur.com",
		reversed: "moc.rueugolb-nom-tse"
	},
	{
		suffix: "for-better.biz",
		reversed: "zib.retteb-rof"
	},
	{
		suffix: "for-more.biz",
		reversed: "zib.erom-rof"
	},
	{
		suffix: "for-our.info",
		reversed: "ofni.ruo-rof"
	},
	{
		suffix: "for-some.biz",
		reversed: "zib.emos-rof"
	},
	{
		suffix: "for-the.biz",
		reversed: "zib.eht-rof"
	},
	{
		suffix: "forgot.her.name",
		reversed: "eman.reh.togrof"
	},
	{
		suffix: "forgot.his.name",
		reversed: "eman.sih.togrof"
	},
	{
		suffix: "from-ak.com",
		reversed: "moc.ka-morf"
	},
	{
		suffix: "from-al.com",
		reversed: "moc.la-morf"
	},
	{
		suffix: "from-ar.com",
		reversed: "moc.ra-morf"
	},
	{
		suffix: "from-az.net",
		reversed: "ten.za-morf"
	},
	{
		suffix: "from-ca.com",
		reversed: "moc.ac-morf"
	},
	{
		suffix: "from-co.net",
		reversed: "ten.oc-morf"
	},
	{
		suffix: "from-ct.com",
		reversed: "moc.tc-morf"
	},
	{
		suffix: "from-dc.com",
		reversed: "moc.cd-morf"
	},
	{
		suffix: "from-de.com",
		reversed: "moc.ed-morf"
	},
	{
		suffix: "from-fl.com",
		reversed: "moc.lf-morf"
	},
	{
		suffix: "from-ga.com",
		reversed: "moc.ag-morf"
	},
	{
		suffix: "from-hi.com",
		reversed: "moc.ih-morf"
	},
	{
		suffix: "from-ia.com",
		reversed: "moc.ai-morf"
	},
	{
		suffix: "from-id.com",
		reversed: "moc.di-morf"
	},
	{
		suffix: "from-il.com",
		reversed: "moc.li-morf"
	},
	{
		suffix: "from-in.com",
		reversed: "moc.ni-morf"
	},
	{
		suffix: "from-ks.com",
		reversed: "moc.sk-morf"
	},
	{
		suffix: "from-ky.com",
		reversed: "moc.yk-morf"
	},
	{
		suffix: "from-la.net",
		reversed: "ten.al-morf"
	},
	{
		suffix: "from-ma.com",
		reversed: "moc.am-morf"
	},
	{
		suffix: "from-md.com",
		reversed: "moc.dm-morf"
	},
	{
		suffix: "from-me.org",
		reversed: "gro.em-morf"
	},
	{
		suffix: "from-mi.com",
		reversed: "moc.im-morf"
	},
	{
		suffix: "from-mn.com",
		reversed: "moc.nm-morf"
	},
	{
		suffix: "from-mo.com",
		reversed: "moc.om-morf"
	},
	{
		suffix: "from-ms.com",
		reversed: "moc.sm-morf"
	},
	{
		suffix: "from-mt.com",
		reversed: "moc.tm-morf"
	},
	{
		suffix: "from-nc.com",
		reversed: "moc.cn-morf"
	},
	{
		suffix: "from-nd.com",
		reversed: "moc.dn-morf"
	},
	{
		suffix: "from-ne.com",
		reversed: "moc.en-morf"
	},
	{
		suffix: "from-nh.com",
		reversed: "moc.hn-morf"
	},
	{
		suffix: "from-nj.com",
		reversed: "moc.jn-morf"
	},
	{
		suffix: "from-nm.com",
		reversed: "moc.mn-morf"
	},
	{
		suffix: "from-nv.com",
		reversed: "moc.vn-morf"
	},
	{
		suffix: "from-ny.net",
		reversed: "ten.yn-morf"
	},
	{
		suffix: "from-oh.com",
		reversed: "moc.ho-morf"
	},
	{
		suffix: "from-ok.com",
		reversed: "moc.ko-morf"
	},
	{
		suffix: "from-or.com",
		reversed: "moc.ro-morf"
	},
	{
		suffix: "from-pa.com",
		reversed: "moc.ap-morf"
	},
	{
		suffix: "from-pr.com",
		reversed: "moc.rp-morf"
	},
	{
		suffix: "from-ri.com",
		reversed: "moc.ir-morf"
	},
	{
		suffix: "from-sc.com",
		reversed: "moc.cs-morf"
	},
	{
		suffix: "from-sd.com",
		reversed: "moc.ds-morf"
	},
	{
		suffix: "from-tn.com",
		reversed: "moc.nt-morf"
	},
	{
		suffix: "from-tx.com",
		reversed: "moc.xt-morf"
	},
	{
		suffix: "from-ut.com",
		reversed: "moc.tu-morf"
	},
	{
		suffix: "from-va.com",
		reversed: "moc.av-morf"
	},
	{
		suffix: "from-vt.com",
		reversed: "moc.tv-morf"
	},
	{
		suffix: "from-wa.com",
		reversed: "moc.aw-morf"
	},
	{
		suffix: "from-wi.com",
		reversed: "moc.iw-morf"
	},
	{
		suffix: "from-wv.com",
		reversed: "moc.vw-morf"
	},
	{
		suffix: "from-wy.com",
		reversed: "moc.yw-morf"
	},
	{
		suffix: "ftpaccess.cc",
		reversed: "cc.sseccaptf"
	},
	{
		suffix: "fuettertdasnetz.de",
		reversed: "ed.ztensadtretteuf"
	},
	{
		suffix: "game-host.org",
		reversed: "gro.tsoh-emag"
	},
	{
		suffix: "game-server.cc",
		reversed: "cc.revres-emag"
	},
	{
		suffix: "getmyip.com",
		reversed: "moc.piymteg"
	},
	{
		suffix: "gets-it.net",
		reversed: "ten.ti-steg"
	},
	{
		suffix: "go.dyndns.org",
		reversed: "gro.sndnyd.og"
	},
	{
		suffix: "gotdns.com",
		reversed: "moc.sndtog"
	},
	{
		suffix: "gotdns.org",
		reversed: "gro.sndtog"
	},
	{
		suffix: "groks-the.info",
		reversed: "ofni.eht-skorg"
	},
	{
		suffix: "groks-this.info",
		reversed: "ofni.siht-skorg"
	},
	{
		suffix: "ham-radio-op.net",
		reversed: "ten.po-oidar-mah"
	},
	{
		suffix: "here-for-more.info",
		reversed: "ofni.erom-rof-ereh"
	},
	{
		suffix: "hobby-site.com",
		reversed: "moc.etis-ybboh"
	},
	{
		suffix: "hobby-site.org",
		reversed: "gro.etis-ybboh"
	},
	{
		suffix: "home.dyndns.org",
		reversed: "gro.sndnyd.emoh"
	},
	{
		suffix: "homedns.org",
		reversed: "gro.sndemoh"
	},
	{
		suffix: "homeftp.net",
		reversed: "ten.ptfemoh"
	},
	{
		suffix: "homeftp.org",
		reversed: "gro.ptfemoh"
	},
	{
		suffix: "homeip.net",
		reversed: "ten.piemoh"
	},
	{
		suffix: "homelinux.com",
		reversed: "moc.xunilemoh"
	},
	{
		suffix: "homelinux.net",
		reversed: "ten.xunilemoh"
	},
	{
		suffix: "homelinux.org",
		reversed: "gro.xunilemoh"
	},
	{
		suffix: "homeunix.com",
		reversed: "moc.xinuemoh"
	},
	{
		suffix: "homeunix.net",
		reversed: "ten.xinuemoh"
	},
	{
		suffix: "homeunix.org",
		reversed: "gro.xinuemoh"
	},
	{
		suffix: "iamallama.com",
		reversed: "moc.amallamai"
	},
	{
		suffix: "in-the-band.net",
		reversed: "ten.dnab-eht-ni"
	},
	{
		suffix: "is-a-anarchist.com",
		reversed: "moc.tsihcrana-a-si"
	},
	{
		suffix: "is-a-blogger.com",
		reversed: "moc.reggolb-a-si"
	},
	{
		suffix: "is-a-bookkeeper.com",
		reversed: "moc.repeekkoob-a-si"
	},
	{
		suffix: "is-a-bruinsfan.org",
		reversed: "gro.nafsniurb-a-si"
	},
	{
		suffix: "is-a-bulls-fan.com",
		reversed: "moc.naf-sllub-a-si"
	},
	{
		suffix: "is-a-candidate.org",
		reversed: "gro.etadidnac-a-si"
	},
	{
		suffix: "is-a-caterer.com",
		reversed: "moc.reretac-a-si"
	},
	{
		suffix: "is-a-celticsfan.org",
		reversed: "gro.nafscitlec-a-si"
	},
	{
		suffix: "is-a-chef.com",
		reversed: "moc.fehc-a-si"
	},
	{
		suffix: "is-a-chef.net",
		reversed: "ten.fehc-a-si"
	},
	{
		suffix: "is-a-chef.org",
		reversed: "gro.fehc-a-si"
	},
	{
		suffix: "is-a-conservative.com",
		reversed: "moc.evitavresnoc-a-si"
	},
	{
		suffix: "is-a-cpa.com",
		reversed: "moc.apc-a-si"
	},
	{
		suffix: "is-a-cubicle-slave.com",
		reversed: "moc.evals-elcibuc-a-si"
	},
	{
		suffix: "is-a-democrat.com",
		reversed: "moc.tarcomed-a-si"
	},
	{
		suffix: "is-a-designer.com",
		reversed: "moc.rengised-a-si"
	},
	{
		suffix: "is-a-doctor.com",
		reversed: "moc.rotcod-a-si"
	},
	{
		suffix: "is-a-financialadvisor.com",
		reversed: "moc.rosivdalaicnanif-a-si"
	},
	{
		suffix: "is-a-geek.com",
		reversed: "moc.keeg-a-si"
	},
	{
		suffix: "is-a-geek.net",
		reversed: "ten.keeg-a-si"
	},
	{
		suffix: "is-a-geek.org",
		reversed: "gro.keeg-a-si"
	},
	{
		suffix: "is-a-green.com",
		reversed: "moc.neerg-a-si"
	},
	{
		suffix: "is-a-guru.com",
		reversed: "moc.urug-a-si"
	},
	{
		suffix: "is-a-hard-worker.com",
		reversed: "moc.rekrow-drah-a-si"
	},
	{
		suffix: "is-a-hunter.com",
		reversed: "moc.retnuh-a-si"
	},
	{
		suffix: "is-a-knight.org",
		reversed: "gro.thgink-a-si"
	},
	{
		suffix: "is-a-landscaper.com",
		reversed: "moc.repacsdnal-a-si"
	},
	{
		suffix: "is-a-lawyer.com",
		reversed: "moc.reywal-a-si"
	},
	{
		suffix: "is-a-liberal.com",
		reversed: "moc.larebil-a-si"
	},
	{
		suffix: "is-a-libertarian.com",
		reversed: "moc.nairatrebil-a-si"
	},
	{
		suffix: "is-a-linux-user.org",
		reversed: "gro.resu-xunil-a-si"
	},
	{
		suffix: "is-a-llama.com",
		reversed: "moc.amall-a-si"
	},
	{
		suffix: "is-a-musician.com",
		reversed: "moc.naicisum-a-si"
	},
	{
		suffix: "is-a-nascarfan.com",
		reversed: "moc.nafracsan-a-si"
	},
	{
		suffix: "is-a-nurse.com",
		reversed: "moc.esrun-a-si"
	},
	{
		suffix: "is-a-painter.com",
		reversed: "moc.retniap-a-si"
	},
	{
		suffix: "is-a-patsfan.org",
		reversed: "gro.nafstap-a-si"
	},
	{
		suffix: "is-a-personaltrainer.com",
		reversed: "moc.reniartlanosrep-a-si"
	},
	{
		suffix: "is-a-photographer.com",
		reversed: "moc.rehpargotohp-a-si"
	},
	{
		suffix: "is-a-player.com",
		reversed: "moc.reyalp-a-si"
	},
	{
		suffix: "is-a-republican.com",
		reversed: "moc.nacilbuper-a-si"
	},
	{
		suffix: "is-a-rockstar.com",
		reversed: "moc.ratskcor-a-si"
	},
	{
		suffix: "is-a-socialist.com",
		reversed: "moc.tsilaicos-a-si"
	},
	{
		suffix: "is-a-soxfan.org",
		reversed: "gro.nafxos-a-si"
	},
	{
		suffix: "is-a-student.com",
		reversed: "moc.tneduts-a-si"
	},
	{
		suffix: "is-a-teacher.com",
		reversed: "moc.rehcaet-a-si"
	},
	{
		suffix: "is-a-techie.com",
		reversed: "moc.eihcet-a-si"
	},
	{
		suffix: "is-a-therapist.com",
		reversed: "moc.tsipareht-a-si"
	},
	{
		suffix: "is-an-accountant.com",
		reversed: "moc.tnatnuocca-na-si"
	},
	{
		suffix: "is-an-actor.com",
		reversed: "moc.rotca-na-si"
	},
	{
		suffix: "is-an-actress.com",
		reversed: "moc.ssertca-na-si"
	},
	{
		suffix: "is-an-anarchist.com",
		reversed: "moc.tsihcrana-na-si"
	},
	{
		suffix: "is-an-artist.com",
		reversed: "moc.tsitra-na-si"
	},
	{
		suffix: "is-an-engineer.com",
		reversed: "moc.reenigne-na-si"
	},
	{
		suffix: "is-an-entertainer.com",
		reversed: "moc.reniatretne-na-si"
	},
	{
		suffix: "is-by.us",
		reversed: "su.yb-si"
	},
	{
		suffix: "is-certified.com",
		reversed: "moc.deifitrec-si"
	},
	{
		suffix: "is-found.org",
		reversed: "gro.dnuof-si"
	},
	{
		suffix: "is-gone.com",
		reversed: "moc.enog-si"
	},
	{
		suffix: "is-into-anime.com",
		reversed: "moc.emina-otni-si"
	},
	{
		suffix: "is-into-cars.com",
		reversed: "moc.srac-otni-si"
	},
	{
		suffix: "is-into-cartoons.com",
		reversed: "moc.snootrac-otni-si"
	},
	{
		suffix: "is-into-games.com",
		reversed: "moc.semag-otni-si"
	},
	{
		suffix: "is-leet.com",
		reversed: "moc.teel-si"
	},
	{
		suffix: "is-lost.org",
		reversed: "gro.tsol-si"
	},
	{
		suffix: "is-not-certified.com",
		reversed: "moc.deifitrec-ton-si"
	},
	{
		suffix: "is-saved.org",
		reversed: "gro.devas-si"
	},
	{
		suffix: "is-slick.com",
		reversed: "moc.kcils-si"
	},
	{
		suffix: "is-uberleet.com",
		reversed: "moc.teelrebu-si"
	},
	{
		suffix: "is-very-bad.org",
		reversed: "gro.dab-yrev-si"
	},
	{
		suffix: "is-very-evil.org",
		reversed: "gro.live-yrev-si"
	},
	{
		suffix: "is-very-good.org",
		reversed: "gro.doog-yrev-si"
	},
	{
		suffix: "is-very-nice.org",
		reversed: "gro.ecin-yrev-si"
	},
	{
		suffix: "is-very-sweet.org",
		reversed: "gro.teews-yrev-si"
	},
	{
		suffix: "is-with-theband.com",
		reversed: "moc.dnabeht-htiw-si"
	},
	{
		suffix: "isa-geek.com",
		reversed: "moc.keeg-asi"
	},
	{
		suffix: "isa-geek.net",
		reversed: "ten.keeg-asi"
	},
	{
		suffix: "isa-geek.org",
		reversed: "gro.keeg-asi"
	},
	{
		suffix: "isa-hockeynut.com",
		reversed: "moc.tunyekcoh-asi"
	},
	{
		suffix: "issmarterthanyou.com",
		reversed: "moc.uoynahtretramssi"
	},
	{
		suffix: "isteingeek.de",
		reversed: "ed.keegnietsi"
	},
	{
		suffix: "istmein.de",
		reversed: "ed.niemtsi"
	},
	{
		suffix: "kicks-ass.net",
		reversed: "ten.ssa-skcik"
	},
	{
		suffix: "kicks-ass.org",
		reversed: "gro.ssa-skcik"
	},
	{
		suffix: "knowsitall.info",
		reversed: "ofni.llatiswonk"
	},
	{
		suffix: "land-4-sale.us",
		reversed: "su.elas-4-dnal"
	},
	{
		suffix: "lebtimnetz.de",
		reversed: "ed.ztenmitbel"
	},
	{
		suffix: "leitungsen.de",
		reversed: "ed.nesgnutiel"
	},
	{
		suffix: "likes-pie.com",
		reversed: "moc.eip-sekil"
	},
	{
		suffix: "likescandy.com",
		reversed: "moc.ydnacsekil"
	},
	{
		suffix: "merseine.nu",
		reversed: "un.eniesrem"
	},
	{
		suffix: "mine.nu",
		reversed: "un.enim"
	},
	{
		suffix: "misconfused.org",
		reversed: "gro.desufnocsim"
	},
	{
		suffix: "mypets.ws",
		reversed: "sw.stepym"
	},
	{
		suffix: "myphotos.cc",
		reversed: "cc.sotohpym"
	},
	{
		suffix: "neat-url.com",
		reversed: "moc.lru-taen"
	},
	{
		suffix: "office-on-the.net",
		reversed: "ten.eht-no-eciffo"
	},
	{
		suffix: "on-the-web.tv",
		reversed: "vt.bew-eht-no"
	},
	{
		suffix: "podzone.net",
		reversed: "ten.enozdop"
	},
	{
		suffix: "podzone.org",
		reversed: "gro.enozdop"
	},
	{
		suffix: "readmyblog.org",
		reversed: "gro.golbymdaer"
	},
	{
		suffix: "saves-the-whales.com",
		reversed: "moc.selahw-eht-sevas"
	},
	{
		suffix: "scrapper-site.net",
		reversed: "ten.etis-repparcs"
	},
	{
		suffix: "scrapping.cc",
		reversed: "cc.gnipparcs"
	},
	{
		suffix: "selfip.biz",
		reversed: "zib.pifles"
	},
	{
		suffix: "selfip.com",
		reversed: "moc.pifles"
	},
	{
		suffix: "selfip.info",
		reversed: "ofni.pifles"
	},
	{
		suffix: "selfip.net",
		reversed: "ten.pifles"
	},
	{
		suffix: "selfip.org",
		reversed: "gro.pifles"
	},
	{
		suffix: "sells-for-less.com",
		reversed: "moc.ssel-rof-slles"
	},
	{
		suffix: "sells-for-u.com",
		reversed: "moc.u-rof-slles"
	},
	{
		suffix: "sells-it.net",
		reversed: "ten.ti-slles"
	},
	{
		suffix: "sellsyourhome.org",
		reversed: "gro.emohruoyslles"
	},
	{
		suffix: "servebbs.com",
		reversed: "moc.sbbevres"
	},
	{
		suffix: "servebbs.net",
		reversed: "ten.sbbevres"
	},
	{
		suffix: "servebbs.org",
		reversed: "gro.sbbevres"
	},
	{
		suffix: "serveftp.net",
		reversed: "ten.ptfevres"
	},
	{
		suffix: "serveftp.org",
		reversed: "gro.ptfevres"
	},
	{
		suffix: "servegame.org",
		reversed: "gro.emagevres"
	},
	{
		suffix: "shacknet.nu",
		reversed: "un.tenkcahs"
	},
	{
		suffix: "simple-url.com",
		reversed: "moc.lru-elpmis"
	},
	{
		suffix: "space-to-rent.com",
		reversed: "moc.tner-ot-ecaps"
	},
	{
		suffix: "stuff-4-sale.org",
		reversed: "gro.elas-4-ffuts"
	},
	{
		suffix: "stuff-4-sale.us",
		reversed: "su.elas-4-ffuts"
	},
	{
		suffix: "teaches-yoga.com",
		reversed: "moc.agoy-sehcaet"
	},
	{
		suffix: "thruhere.net",
		reversed: "ten.erehurht"
	},
	{
		suffix: "traeumtgerade.de",
		reversed: "ed.edaregtmueart"
	},
	{
		suffix: "webhop.biz",
		reversed: "zib.pohbew"
	},
	{
		suffix: "webhop.info",
		reversed: "ofni.pohbew"
	},
	{
		suffix: "webhop.net",
		reversed: "ten.pohbew"
	},
	{
		suffix: "webhop.org",
		reversed: "gro.pohbew"
	},
	{
		suffix: "worse-than.tv",
		reversed: "vt.naht-esrow"
	},
	{
		suffix: "writesthisblog.com",
		reversed: "moc.golbsihtsetirw"
	},
	{
		suffix: "ddnss.de",
		reversed: "ed.ssndd"
	},
	{
		suffix: "dyn.ddnss.de",
		reversed: "ed.ssndd.nyd"
	},
	{
		suffix: "dyndns.ddnss.de",
		reversed: "ed.ssndd.sndnyd"
	},
	{
		suffix: "dyndns1.de",
		reversed: "ed.1sndnyd"
	},
	{
		suffix: "dyn-ip24.de",
		reversed: "ed.42pi-nyd"
	},
	{
		suffix: "home-webserver.de",
		reversed: "ed.revresbew-emoh"
	},
	{
		suffix: "dyn.home-webserver.de",
		reversed: "ed.revresbew-emoh.nyd"
	},
	{
		suffix: "myhome-server.de",
		reversed: "ed.revres-emohym"
	},
	{
		suffix: "ddnss.org",
		reversed: "gro.ssndd"
	},
	{
		suffix: "definima.net",
		reversed: "ten.aminifed"
	},
	{
		suffix: "definima.io",
		reversed: "oi.aminifed"
	},
	{
		suffix: "ondigitalocean.app",
		reversed: "ppa.naecolatigidno"
	},
	{
		suffix: "*.digitaloceanspaces.com",
		reversed: "moc.secapsnaecolatigid"
	},
	{
		suffix: "bci.dnstrace.pro",
		reversed: "orp.ecartsnd.icb"
	},
	{
		suffix: "ddnsfree.com",
		reversed: "moc.eerfsndd"
	},
	{
		suffix: "ddnsgeek.com",
		reversed: "moc.keegsndd"
	},
	{
		suffix: "giize.com",
		reversed: "moc.eziig"
	},
	{
		suffix: "gleeze.com",
		reversed: "moc.ezeelg"
	},
	{
		suffix: "kozow.com",
		reversed: "moc.wozok"
	},
	{
		suffix: "loseyourip.com",
		reversed: "moc.piruoyesol"
	},
	{
		suffix: "ooguy.com",
		reversed: "moc.yugoo"
	},
	{
		suffix: "theworkpc.com",
		reversed: "moc.cpkroweht"
	},
	{
		suffix: "casacam.net",
		reversed: "ten.macasac"
	},
	{
		suffix: "dynu.net",
		reversed: "ten.unyd"
	},
	{
		suffix: "accesscam.org",
		reversed: "gro.macssecca"
	},
	{
		suffix: "camdvr.org",
		reversed: "gro.rvdmac"
	},
	{
		suffix: "freeddns.org",
		reversed: "gro.snddeerf"
	},
	{
		suffix: "mywire.org",
		reversed: "gro.eriwym"
	},
	{
		suffix: "webredirect.org",
		reversed: "gro.tceriderbew"
	},
	{
		suffix: "myddns.rocks",
		reversed: "skcor.snddym"
	},
	{
		suffix: "blogsite.xyz",
		reversed: "zyx.etisgolb"
	},
	{
		suffix: "dynv6.net",
		reversed: "ten.6vnyd"
	},
	{
		suffix: "e4.cz",
		reversed: "zc.4e"
	},
	{
		suffix: "easypanel.app",
		reversed: "ppa.lenapysae"
	},
	{
		suffix: "easypanel.host",
		reversed: "tsoh.lenapysae"
	},
	{
		suffix: "elementor.cloud",
		reversed: "duolc.rotnemele"
	},
	{
		suffix: "elementor.cool",
		reversed: "looc.rotnemele"
	},
	{
		suffix: "en-root.fr",
		reversed: "rf.toor-ne"
	},
	{
		suffix: "mytuleap.com",
		reversed: "moc.paelutym"
	},
	{
		suffix: "tuleap-partners.com",
		reversed: "moc.srentrap-paelut"
	},
	{
		suffix: "encr.app",
		reversed: "ppa.rcne"
	},
	{
		suffix: "encoreapi.com",
		reversed: "moc.ipaerocne"
	},
	{
		suffix: "onred.one",
		reversed: "eno.derno"
	},
	{
		suffix: "staging.onred.one",
		reversed: "eno.derno.gnigats"
	},
	{
		suffix: "eu.encoway.cloud",
		reversed: "duolc.yawocne.ue"
	},
	{
		suffix: "eu.org",
		reversed: "gro.ue"
	},
	{
		suffix: "al.eu.org",
		reversed: "gro.ue.la"
	},
	{
		suffix: "asso.eu.org",
		reversed: "gro.ue.ossa"
	},
	{
		suffix: "at.eu.org",
		reversed: "gro.ue.ta"
	},
	{
		suffix: "au.eu.org",
		reversed: "gro.ue.ua"
	},
	{
		suffix: "be.eu.org",
		reversed: "gro.ue.eb"
	},
	{
		suffix: "bg.eu.org",
		reversed: "gro.ue.gb"
	},
	{
		suffix: "ca.eu.org",
		reversed: "gro.ue.ac"
	},
	{
		suffix: "cd.eu.org",
		reversed: "gro.ue.dc"
	},
	{
		suffix: "ch.eu.org",
		reversed: "gro.ue.hc"
	},
	{
		suffix: "cn.eu.org",
		reversed: "gro.ue.nc"
	},
	{
		suffix: "cy.eu.org",
		reversed: "gro.ue.yc"
	},
	{
		suffix: "cz.eu.org",
		reversed: "gro.ue.zc"
	},
	{
		suffix: "de.eu.org",
		reversed: "gro.ue.ed"
	},
	{
		suffix: "dk.eu.org",
		reversed: "gro.ue.kd"
	},
	{
		suffix: "edu.eu.org",
		reversed: "gro.ue.ude"
	},
	{
		suffix: "ee.eu.org",
		reversed: "gro.ue.ee"
	},
	{
		suffix: "es.eu.org",
		reversed: "gro.ue.se"
	},
	{
		suffix: "fi.eu.org",
		reversed: "gro.ue.if"
	},
	{
		suffix: "fr.eu.org",
		reversed: "gro.ue.rf"
	},
	{
		suffix: "gr.eu.org",
		reversed: "gro.ue.rg"
	},
	{
		suffix: "hr.eu.org",
		reversed: "gro.ue.rh"
	},
	{
		suffix: "hu.eu.org",
		reversed: "gro.ue.uh"
	},
	{
		suffix: "ie.eu.org",
		reversed: "gro.ue.ei"
	},
	{
		suffix: "il.eu.org",
		reversed: "gro.ue.li"
	},
	{
		suffix: "in.eu.org",
		reversed: "gro.ue.ni"
	},
	{
		suffix: "int.eu.org",
		reversed: "gro.ue.tni"
	},
	{
		suffix: "is.eu.org",
		reversed: "gro.ue.si"
	},
	{
		suffix: "it.eu.org",
		reversed: "gro.ue.ti"
	},
	{
		suffix: "jp.eu.org",
		reversed: "gro.ue.pj"
	},
	{
		suffix: "kr.eu.org",
		reversed: "gro.ue.rk"
	},
	{
		suffix: "lt.eu.org",
		reversed: "gro.ue.tl"
	},
	{
		suffix: "lu.eu.org",
		reversed: "gro.ue.ul"
	},
	{
		suffix: "lv.eu.org",
		reversed: "gro.ue.vl"
	},
	{
		suffix: "mc.eu.org",
		reversed: "gro.ue.cm"
	},
	{
		suffix: "me.eu.org",
		reversed: "gro.ue.em"
	},
	{
		suffix: "mk.eu.org",
		reversed: "gro.ue.km"
	},
	{
		suffix: "mt.eu.org",
		reversed: "gro.ue.tm"
	},
	{
		suffix: "my.eu.org",
		reversed: "gro.ue.ym"
	},
	{
		suffix: "net.eu.org",
		reversed: "gro.ue.ten"
	},
	{
		suffix: "ng.eu.org",
		reversed: "gro.ue.gn"
	},
	{
		suffix: "nl.eu.org",
		reversed: "gro.ue.ln"
	},
	{
		suffix: "no.eu.org",
		reversed: "gro.ue.on"
	},
	{
		suffix: "nz.eu.org",
		reversed: "gro.ue.zn"
	},
	{
		suffix: "paris.eu.org",
		reversed: "gro.ue.sirap"
	},
	{
		suffix: "pl.eu.org",
		reversed: "gro.ue.lp"
	},
	{
		suffix: "pt.eu.org",
		reversed: "gro.ue.tp"
	},
	{
		suffix: "q-a.eu.org",
		reversed: "gro.ue.a-q"
	},
	{
		suffix: "ro.eu.org",
		reversed: "gro.ue.or"
	},
	{
		suffix: "ru.eu.org",
		reversed: "gro.ue.ur"
	},
	{
		suffix: "se.eu.org",
		reversed: "gro.ue.es"
	},
	{
		suffix: "si.eu.org",
		reversed: "gro.ue.is"
	},
	{
		suffix: "sk.eu.org",
		reversed: "gro.ue.ks"
	},
	{
		suffix: "tr.eu.org",
		reversed: "gro.ue.rt"
	},
	{
		suffix: "uk.eu.org",
		reversed: "gro.ue.ku"
	},
	{
		suffix: "us.eu.org",
		reversed: "gro.ue.su"
	},
	{
		suffix: "eurodir.ru",
		reversed: "ur.ridorue"
	},
	{
		suffix: "eu-1.evennode.com",
		reversed: "moc.edonneve.1-ue"
	},
	{
		suffix: "eu-2.evennode.com",
		reversed: "moc.edonneve.2-ue"
	},
	{
		suffix: "eu-3.evennode.com",
		reversed: "moc.edonneve.3-ue"
	},
	{
		suffix: "eu-4.evennode.com",
		reversed: "moc.edonneve.4-ue"
	},
	{
		suffix: "us-1.evennode.com",
		reversed: "moc.edonneve.1-su"
	},
	{
		suffix: "us-2.evennode.com",
		reversed: "moc.edonneve.2-su"
	},
	{
		suffix: "us-3.evennode.com",
		reversed: "moc.edonneve.3-su"
	},
	{
		suffix: "us-4.evennode.com",
		reversed: "moc.edonneve.4-su"
	},
	{
		suffix: "twmail.cc",
		reversed: "cc.liamwt"
	},
	{
		suffix: "twmail.net",
		reversed: "ten.liamwt"
	},
	{
		suffix: "twmail.org",
		reversed: "gro.liamwt"
	},
	{
		suffix: "mymailer.com.tw",
		reversed: "wt.moc.reliamym"
	},
	{
		suffix: "url.tw",
		reversed: "wt.lru"
	},
	{
		suffix: "onfabrica.com",
		reversed: "moc.acirbafno"
	},
	{
		suffix: "apps.fbsbx.com",
		reversed: "moc.xbsbf.sppa"
	},
	{
		suffix: "ru.net",
		reversed: "ten.ur"
	},
	{
		suffix: "adygeya.ru",
		reversed: "ur.ayegyda"
	},
	{
		suffix: "bashkiria.ru",
		reversed: "ur.airikhsab"
	},
	{
		suffix: "bir.ru",
		reversed: "ur.rib"
	},
	{
		suffix: "cbg.ru",
		reversed: "ur.gbc"
	},
	{
		suffix: "com.ru",
		reversed: "ur.moc"
	},
	{
		suffix: "dagestan.ru",
		reversed: "ur.natsegad"
	},
	{
		suffix: "grozny.ru",
		reversed: "ur.ynzorg"
	},
	{
		suffix: "kalmykia.ru",
		reversed: "ur.aikymlak"
	},
	{
		suffix: "kustanai.ru",
		reversed: "ur.ianatsuk"
	},
	{
		suffix: "marine.ru",
		reversed: "ur.eniram"
	},
	{
		suffix: "mordovia.ru",
		reversed: "ur.aivodrom"
	},
	{
		suffix: "msk.ru",
		reversed: "ur.ksm"
	},
	{
		suffix: "mytis.ru",
		reversed: "ur.sitym"
	},
	{
		suffix: "nalchik.ru",
		reversed: "ur.kihclan"
	},
	{
		suffix: "nov.ru",
		reversed: "ur.von"
	},
	{
		suffix: "pyatigorsk.ru",
		reversed: "ur.ksrogitayp"
	},
	{
		suffix: "spb.ru",
		reversed: "ur.bps"
	},
	{
		suffix: "vladikavkaz.ru",
		reversed: "ur.zakvakidalv"
	},
	{
		suffix: "vladimir.ru",
		reversed: "ur.rimidalv"
	},
	{
		suffix: "abkhazia.su",
		reversed: "us.aizahkba"
	},
	{
		suffix: "adygeya.su",
		reversed: "us.ayegyda"
	},
	{
		suffix: "aktyubinsk.su",
		reversed: "us.ksnibuytka"
	},
	{
		suffix: "arkhangelsk.su",
		reversed: "us.kslegnahkra"
	},
	{
		suffix: "armenia.su",
		reversed: "us.ainemra"
	},
	{
		suffix: "ashgabad.su",
		reversed: "us.dabaghsa"
	},
	{
		suffix: "azerbaijan.su",
		reversed: "us.najiabreza"
	},
	{
		suffix: "balashov.su",
		reversed: "us.vohsalab"
	},
	{
		suffix: "bashkiria.su",
		reversed: "us.airikhsab"
	},
	{
		suffix: "bryansk.su",
		reversed: "us.ksnayrb"
	},
	{
		suffix: "bukhara.su",
		reversed: "us.arahkub"
	},
	{
		suffix: "chimkent.su",
		reversed: "us.tnekmihc"
	},
	{
		suffix: "dagestan.su",
		reversed: "us.natsegad"
	},
	{
		suffix: "east-kazakhstan.su",
		reversed: "us.natshkazak-tsae"
	},
	{
		suffix: "exnet.su",
		reversed: "us.tenxe"
	},
	{
		suffix: "georgia.su",
		reversed: "us.aigroeg"
	},
	{
		suffix: "grozny.su",
		reversed: "us.ynzorg"
	},
	{
		suffix: "ivanovo.su",
		reversed: "us.ovonavi"
	},
	{
		suffix: "jambyl.su",
		reversed: "us.lybmaj"
	},
	{
		suffix: "kalmykia.su",
		reversed: "us.aikymlak"
	},
	{
		suffix: "kaluga.su",
		reversed: "us.agulak"
	},
	{
		suffix: "karacol.su",
		reversed: "us.locarak"
	},
	{
		suffix: "karaganda.su",
		reversed: "us.adnagarak"
	},
	{
		suffix: "karelia.su",
		reversed: "us.ailerak"
	},
	{
		suffix: "khakassia.su",
		reversed: "us.aissakahk"
	},
	{
		suffix: "krasnodar.su",
		reversed: "us.radonsark"
	},
	{
		suffix: "kurgan.su",
		reversed: "us.nagruk"
	},
	{
		suffix: "kustanai.su",
		reversed: "us.ianatsuk"
	},
	{
		suffix: "lenug.su",
		reversed: "us.gunel"
	},
	{
		suffix: "mangyshlak.su",
		reversed: "us.kalhsygnam"
	},
	{
		suffix: "mordovia.su",
		reversed: "us.aivodrom"
	},
	{
		suffix: "msk.su",
		reversed: "us.ksm"
	},
	{
		suffix: "murmansk.su",
		reversed: "us.ksnamrum"
	},
	{
		suffix: "nalchik.su",
		reversed: "us.kihclan"
	},
	{
		suffix: "navoi.su",
		reversed: "us.iovan"
	},
	{
		suffix: "north-kazakhstan.su",
		reversed: "us.natshkazak-htron"
	},
	{
		suffix: "nov.su",
		reversed: "us.von"
	},
	{
		suffix: "obninsk.su",
		reversed: "us.ksninbo"
	},
	{
		suffix: "penza.su",
		reversed: "us.aznep"
	},
	{
		suffix: "pokrovsk.su",
		reversed: "us.ksvorkop"
	},
	{
		suffix: "sochi.su",
		reversed: "us.ihcos"
	},
	{
		suffix: "spb.su",
		reversed: "us.bps"
	},
	{
		suffix: "tashkent.su",
		reversed: "us.tnekhsat"
	},
	{
		suffix: "termez.su",
		reversed: "us.zemret"
	},
	{
		suffix: "togliatti.su",
		reversed: "us.ittailgot"
	},
	{
		suffix: "troitsk.su",
		reversed: "us.kstiort"
	},
	{
		suffix: "tselinograd.su",
		reversed: "us.dargonilest"
	},
	{
		suffix: "tula.su",
		reversed: "us.alut"
	},
	{
		suffix: "tuva.su",
		reversed: "us.avut"
	},
	{
		suffix: "vladikavkaz.su",
		reversed: "us.zakvakidalv"
	},
	{
		suffix: "vladimir.su",
		reversed: "us.rimidalv"
	},
	{
		suffix: "vologda.su",
		reversed: "us.adgolov"
	},
	{
		suffix: "channelsdvr.net",
		reversed: "ten.rvdslennahc"
	},
	{
		suffix: "u.channelsdvr.net",
		reversed: "ten.rvdslennahc.u"
	},
	{
		suffix: "edgecompute.app",
		reversed: "ppa.etupmocegde"
	},
	{
		suffix: "fastly-edge.com",
		reversed: "moc.egde-yltsaf"
	},
	{
		suffix: "fastly-terrarium.com",
		reversed: "moc.muirarret-yltsaf"
	},
	{
		suffix: "fastlylb.net",
		reversed: "ten.blyltsaf"
	},
	{
		suffix: "map.fastlylb.net",
		reversed: "ten.blyltsaf.pam"
	},
	{
		suffix: "freetls.fastly.net",
		reversed: "ten.yltsaf.slteerf"
	},
	{
		suffix: "map.fastly.net",
		reversed: "ten.yltsaf.pam"
	},
	{
		suffix: "a.prod.fastly.net",
		reversed: "ten.yltsaf.dorp.a"
	},
	{
		suffix: "global.prod.fastly.net",
		reversed: "ten.yltsaf.dorp.labolg"
	},
	{
		suffix: "a.ssl.fastly.net",
		reversed: "ten.yltsaf.lss.a"
	},
	{
		suffix: "b.ssl.fastly.net",
		reversed: "ten.yltsaf.lss.b"
	},
	{
		suffix: "global.ssl.fastly.net",
		reversed: "ten.yltsaf.lss.labolg"
	},
	{
		suffix: "*.user.fm",
		reversed: "mf.resu"
	},
	{
		suffix: "fastvps-server.com",
		reversed: "moc.revres-spvtsaf"
	},
	{
		suffix: "fastvps.host",
		reversed: "tsoh.spvtsaf"
	},
	{
		suffix: "myfast.host",
		reversed: "tsoh.tsafym"
	},
	{
		suffix: "fastvps.site",
		reversed: "etis.spvtsaf"
	},
	{
		suffix: "myfast.space",
		reversed: "ecaps.tsafym"
	},
	{
		suffix: "fedorainfracloud.org",
		reversed: "gro.duolcarfniarodef"
	},
	{
		suffix: "fedorapeople.org",
		reversed: "gro.elpoeparodef"
	},
	{
		suffix: "cloud.fedoraproject.org",
		reversed: "gro.tcejorparodef.duolc"
	},
	{
		suffix: "app.os.fedoraproject.org",
		reversed: "gro.tcejorparodef.so.ppa"
	},
	{
		suffix: "app.os.stg.fedoraproject.org",
		reversed: "gro.tcejorparodef.gts.so.ppa"
	},
	{
		suffix: "conn.uk",
		reversed: "ku.nnoc"
	},
	{
		suffix: "copro.uk",
		reversed: "ku.orpoc"
	},
	{
		suffix: "hosp.uk",
		reversed: "ku.psoh"
	},
	{
		suffix: "mydobiss.com",
		reversed: "moc.ssibodym"
	},
	{
		suffix: "fh-muenster.io",
		reversed: "oi.retsneum-hf"
	},
	{
		suffix: "filegear.me",
		reversed: "em.raegelif"
	},
	{
		suffix: "filegear-au.me",
		reversed: "em.ua-raegelif"
	},
	{
		suffix: "filegear-de.me",
		reversed: "em.ed-raegelif"
	},
	{
		suffix: "filegear-gb.me",
		reversed: "em.bg-raegelif"
	},
	{
		suffix: "filegear-ie.me",
		reversed: "em.ei-raegelif"
	},
	{
		suffix: "filegear-jp.me",
		reversed: "em.pj-raegelif"
	},
	{
		suffix: "filegear-sg.me",
		reversed: "em.gs-raegelif"
	},
	{
		suffix: "firebaseapp.com",
		reversed: "moc.ppaesaberif"
	},
	{
		suffix: "fireweb.app",
		reversed: "ppa.bewerif"
	},
	{
		suffix: "flap.id",
		reversed: "di.palf"
	},
	{
		suffix: "onflashdrive.app",
		reversed: "ppa.evirdhsalfno"
	},
	{
		suffix: "fldrv.com",
		reversed: "moc.vrdlf"
	},
	{
		suffix: "fly.dev",
		reversed: "ved.ylf"
	},
	{
		suffix: "edgeapp.net",
		reversed: "ten.ppaegde"
	},
	{
		suffix: "shw.io",
		reversed: "oi.whs"
	},
	{
		suffix: "flynnhosting.net",
		reversed: "ten.gnitsohnnylf"
	},
	{
		suffix: "forgeblocks.com",
		reversed: "moc.skcolbegrof"
	},
	{
		suffix: "id.forgerock.io",
		reversed: "oi.kcoregrof.di"
	},
	{
		suffix: "framer.app",
		reversed: "ppa.remarf"
	},
	{
		suffix: "framercanvas.com",
		reversed: "moc.savnacremarf"
	},
	{
		suffix: "framer.media",
		reversed: "aidem.remarf"
	},
	{
		suffix: "framer.photos",
		reversed: "sotohp.remarf"
	},
	{
		suffix: "framer.website",
		reversed: "etisbew.remarf"
	},
	{
		suffix: "framer.wiki",
		reversed: "ikiw.remarf"
	},
	{
		suffix: "*.frusky.de",
		reversed: "ed.yksurf"
	},
	{
		suffix: "ravpage.co.il",
		reversed: "li.oc.egapvar"
	},
	{
		suffix: "0e.vc",
		reversed: "cv.e0"
	},
	{
		suffix: "freebox-os.com",
		reversed: "moc.so-xobeerf"
	},
	{
		suffix: "freeboxos.com",
		reversed: "moc.soxobeerf"
	},
	{
		suffix: "fbx-os.fr",
		reversed: "rf.so-xbf"
	},
	{
		suffix: "fbxos.fr",
		reversed: "rf.soxbf"
	},
	{
		suffix: "freebox-os.fr",
		reversed: "rf.so-xobeerf"
	},
	{
		suffix: "freeboxos.fr",
		reversed: "rf.soxobeerf"
	},
	{
		suffix: "freedesktop.org",
		reversed: "gro.potksedeerf"
	},
	{
		suffix: "freemyip.com",
		reversed: "moc.piymeerf"
	},
	{
		suffix: "wien.funkfeuer.at",
		reversed: "ta.reuefknuf.neiw"
	},
	{
		suffix: "*.futurecms.at",
		reversed: "ta.smcerutuf"
	},
	{
		suffix: "*.ex.futurecms.at",
		reversed: "ta.smcerutuf.xe"
	},
	{
		suffix: "*.in.futurecms.at",
		reversed: "ta.smcerutuf.ni"
	},
	{
		suffix: "futurehosting.at",
		reversed: "ta.gnitsoherutuf"
	},
	{
		suffix: "futuremailing.at",
		reversed: "ta.gniliamerutuf"
	},
	{
		suffix: "*.ex.ortsinfo.at",
		reversed: "ta.ofnistro.xe"
	},
	{
		suffix: "*.kunden.ortsinfo.at",
		reversed: "ta.ofnistro.nednuk"
	},
	{
		suffix: "*.statics.cloud",
		reversed: "duolc.scitats"
	},
	{
		suffix: "independent-commission.uk",
		reversed: "ku.noissimmoc-tnednepedni"
	},
	{
		suffix: "independent-inquest.uk",
		reversed: "ku.tseuqni-tnednepedni"
	},
	{
		suffix: "independent-inquiry.uk",
		reversed: "ku.yriuqni-tnednepedni"
	},
	{
		suffix: "independent-panel.uk",
		reversed: "ku.lenap-tnednepedni"
	},
	{
		suffix: "independent-review.uk",
		reversed: "ku.weiver-tnednepedni"
	},
	{
		suffix: "public-inquiry.uk",
		reversed: "ku.yriuqni-cilbup"
	},
	{
		suffix: "royal-commission.uk",
		reversed: "ku.noissimmoc-layor"
	},
	{
		suffix: "campaign.gov.uk",
		reversed: "ku.vog.ngiapmac"
	},
	{
		suffix: "service.gov.uk",
		reversed: "ku.vog.ecivres"
	},
	{
		suffix: "api.gov.uk",
		reversed: "ku.vog.ipa"
	},
	{
		suffix: "gehirn.ne.jp",
		reversed: "pj.en.nriheg"
	},
	{
		suffix: "usercontent.jp",
		reversed: "pj.tnetnocresu"
	},
	{
		suffix: "gentapps.com",
		reversed: "moc.sppatneg"
	},
	{
		suffix: "gentlentapis.com",
		reversed: "moc.sipatneltneg"
	},
	{
		suffix: "lab.ms",
		reversed: "sm.bal"
	},
	{
		suffix: "cdn-edges.net",
		reversed: "ten.segde-ndc"
	},
	{
		suffix: "ghost.io",
		reversed: "oi.tsohg"
	},
	{
		suffix: "gsj.bz",
		reversed: "zb.jsg"
	},
	{
		suffix: "githubusercontent.com",
		reversed: "moc.tnetnocresubuhtig"
	},
	{
		suffix: "githubpreview.dev",
		reversed: "ved.weiverpbuhtig"
	},
	{
		suffix: "github.io",
		reversed: "oi.buhtig"
	},
	{
		suffix: "gitlab.io",
		reversed: "oi.baltig"
	},
	{
		suffix: "gitapp.si",
		reversed: "is.ppatig"
	},
	{
		suffix: "gitpage.si",
		reversed: "is.egaptig"
	},
	{
		suffix: "glitch.me",
		reversed: "em.hctilg"
	},
	{
		suffix: "nog.community",
		reversed: "ytinummoc.gon"
	},
	{
		suffix: "co.ro",
		reversed: "or.oc"
	},
	{
		suffix: "shop.ro",
		reversed: "or.pohs"
	},
	{
		suffix: "lolipop.io",
		reversed: "oi.popilol"
	},
	{
		suffix: "angry.jp",
		reversed: "pj.yrgna"
	},
	{
		suffix: "babyblue.jp",
		reversed: "pj.eulbybab"
	},
	{
		suffix: "babymilk.jp",
		reversed: "pj.klimybab"
	},
	{
		suffix: "backdrop.jp",
		reversed: "pj.pordkcab"
	},
	{
		suffix: "bambina.jp",
		reversed: "pj.anibmab"
	},
	{
		suffix: "bitter.jp",
		reversed: "pj.rettib"
	},
	{
		suffix: "blush.jp",
		reversed: "pj.hsulb"
	},
	{
		suffix: "boo.jp",
		reversed: "pj.oob"
	},
	{
		suffix: "boy.jp",
		reversed: "pj.yob"
	},
	{
		suffix: "boyfriend.jp",
		reversed: "pj.dneirfyob"
	},
	{
		suffix: "but.jp",
		reversed: "pj.tub"
	},
	{
		suffix: "candypop.jp",
		reversed: "pj.popydnac"
	},
	{
		suffix: "capoo.jp",
		reversed: "pj.oopac"
	},
	{
		suffix: "catfood.jp",
		reversed: "pj.dooftac"
	},
	{
		suffix: "cheap.jp",
		reversed: "pj.paehc"
	},
	{
		suffix: "chicappa.jp",
		reversed: "pj.appacihc"
	},
	{
		suffix: "chillout.jp",
		reversed: "pj.tuollihc"
	},
	{
		suffix: "chips.jp",
		reversed: "pj.spihc"
	},
	{
		suffix: "chowder.jp",
		reversed: "pj.redwohc"
	},
	{
		suffix: "chu.jp",
		reversed: "pj.uhc"
	},
	{
		suffix: "ciao.jp",
		reversed: "pj.oaic"
	},
	{
		suffix: "cocotte.jp",
		reversed: "pj.ettococ"
	},
	{
		suffix: "coolblog.jp",
		reversed: "pj.golblooc"
	},
	{
		suffix: "cranky.jp",
		reversed: "pj.yknarc"
	},
	{
		suffix: "cutegirl.jp",
		reversed: "pj.lrigetuc"
	},
	{
		suffix: "daa.jp",
		reversed: "pj.aad"
	},
	{
		suffix: "deca.jp",
		reversed: "pj.aced"
	},
	{
		suffix: "deci.jp",
		reversed: "pj.iced"
	},
	{
		suffix: "digick.jp",
		reversed: "pj.kcigid"
	},
	{
		suffix: "egoism.jp",
		reversed: "pj.msioge"
	},
	{
		suffix: "fakefur.jp",
		reversed: "pj.rufekaf"
	},
	{
		suffix: "fem.jp",
		reversed: "pj.mef"
	},
	{
		suffix: "flier.jp",
		reversed: "pj.reilf"
	},
	{
		suffix: "floppy.jp",
		reversed: "pj.yppolf"
	},
	{
		suffix: "fool.jp",
		reversed: "pj.loof"
	},
	{
		suffix: "frenchkiss.jp",
		reversed: "pj.ssikhcnerf"
	},
	{
		suffix: "girlfriend.jp",
		reversed: "pj.dneirflrig"
	},
	{
		suffix: "girly.jp",
		reversed: "pj.ylrig"
	},
	{
		suffix: "gloomy.jp",
		reversed: "pj.ymoolg"
	},
	{
		suffix: "gonna.jp",
		reversed: "pj.annog"
	},
	{
		suffix: "greater.jp",
		reversed: "pj.retaerg"
	},
	{
		suffix: "hacca.jp",
		reversed: "pj.accah"
	},
	{
		suffix: "heavy.jp",
		reversed: "pj.yvaeh"
	},
	{
		suffix: "her.jp",
		reversed: "pj.reh"
	},
	{
		suffix: "hiho.jp",
		reversed: "pj.ohih"
	},
	{
		suffix: "hippy.jp",
		reversed: "pj.yppih"
	},
	{
		suffix: "holy.jp",
		reversed: "pj.yloh"
	},
	{
		suffix: "hungry.jp",
		reversed: "pj.yrgnuh"
	},
	{
		suffix: "icurus.jp",
		reversed: "pj.suruci"
	},
	{
		suffix: "itigo.jp",
		reversed: "pj.ogiti"
	},
	{
		suffix: "jellybean.jp",
		reversed: "pj.naebyllej"
	},
	{
		suffix: "kikirara.jp",
		reversed: "pj.ararikik"
	},
	{
		suffix: "kill.jp",
		reversed: "pj.llik"
	},
	{
		suffix: "kilo.jp",
		reversed: "pj.olik"
	},
	{
		suffix: "kuron.jp",
		reversed: "pj.noruk"
	},
	{
		suffix: "littlestar.jp",
		reversed: "pj.ratselttil"
	},
	{
		suffix: "lolipopmc.jp",
		reversed: "pj.cmpopilol"
	},
	{
		suffix: "lolitapunk.jp",
		reversed: "pj.knupatilol"
	},
	{
		suffix: "lomo.jp",
		reversed: "pj.omol"
	},
	{
		suffix: "lovepop.jp",
		reversed: "pj.popevol"
	},
	{
		suffix: "lovesick.jp",
		reversed: "pj.kcisevol"
	},
	{
		suffix: "main.jp",
		reversed: "pj.niam"
	},
	{
		suffix: "mods.jp",
		reversed: "pj.sdom"
	},
	{
		suffix: "mond.jp",
		reversed: "pj.dnom"
	},
	{
		suffix: "mongolian.jp",
		reversed: "pj.nailognom"
	},
	{
		suffix: "moo.jp",
		reversed: "pj.oom"
	},
	{
		suffix: "namaste.jp",
		reversed: "pj.etsaman"
	},
	{
		suffix: "nikita.jp",
		reversed: "pj.atikin"
	},
	{
		suffix: "nobushi.jp",
		reversed: "pj.ihsubon"
	},
	{
		suffix: "noor.jp",
		reversed: "pj.roon"
	},
	{
		suffix: "oops.jp",
		reversed: "pj.spoo"
	},
	{
		suffix: "parallel.jp",
		reversed: "pj.lellarap"
	},
	{
		suffix: "parasite.jp",
		reversed: "pj.etisarap"
	},
	{
		suffix: "pecori.jp",
		reversed: "pj.irocep"
	},
	{
		suffix: "peewee.jp",
		reversed: "pj.eeweep"
	},
	{
		suffix: "penne.jp",
		reversed: "pj.ennep"
	},
	{
		suffix: "pepper.jp",
		reversed: "pj.reppep"
	},
	{
		suffix: "perma.jp",
		reversed: "pj.amrep"
	},
	{
		suffix: "pigboat.jp",
		reversed: "pj.taobgip"
	},
	{
		suffix: "pinoko.jp",
		reversed: "pj.okonip"
	},
	{
		suffix: "punyu.jp",
		reversed: "pj.uynup"
	},
	{
		suffix: "pupu.jp",
		reversed: "pj.upup"
	},
	{
		suffix: "pussycat.jp",
		reversed: "pj.tacyssup"
	},
	{
		suffix: "pya.jp",
		reversed: "pj.ayp"
	},
	{
		suffix: "raindrop.jp",
		reversed: "pj.pordniar"
	},
	{
		suffix: "readymade.jp",
		reversed: "pj.edamydaer"
	},
	{
		suffix: "sadist.jp",
		reversed: "pj.tsidas"
	},
	{
		suffix: "schoolbus.jp",
		reversed: "pj.subloohcs"
	},
	{
		suffix: "secret.jp",
		reversed: "pj.terces"
	},
	{
		suffix: "staba.jp",
		reversed: "pj.abats"
	},
	{
		suffix: "stripper.jp",
		reversed: "pj.reppirts"
	},
	{
		suffix: "sub.jp",
		reversed: "pj.bus"
	},
	{
		suffix: "sunnyday.jp",
		reversed: "pj.yadynnus"
	},
	{
		suffix: "thick.jp",
		reversed: "pj.kciht"
	},
	{
		suffix: "tonkotsu.jp",
		reversed: "pj.ustoknot"
	},
	{
		suffix: "under.jp",
		reversed: "pj.rednu"
	},
	{
		suffix: "upper.jp",
		reversed: "pj.reppu"
	},
	{
		suffix: "velvet.jp",
		reversed: "pj.tevlev"
	},
	{
		suffix: "verse.jp",
		reversed: "pj.esrev"
	},
	{
		suffix: "versus.jp",
		reversed: "pj.susrev"
	},
	{
		suffix: "vivian.jp",
		reversed: "pj.naiviv"
	},
	{
		suffix: "watson.jp",
		reversed: "pj.nostaw"
	},
	{
		suffix: "weblike.jp",
		reversed: "pj.ekilbew"
	},
	{
		suffix: "whitesnow.jp",
		reversed: "pj.wonsetihw"
	},
	{
		suffix: "zombie.jp",
		reversed: "pj.eibmoz"
	},
	{
		suffix: "heteml.net",
		reversed: "ten.lmeteh"
	},
	{
		suffix: "cloudapps.digital",
		reversed: "latigid.sppaduolc"
	},
	{
		suffix: "london.cloudapps.digital",
		reversed: "latigid.sppaduolc.nodnol"
	},
	{
		suffix: "pymnt.uk",
		reversed: "ku.tnmyp"
	},
	{
		suffix: "homeoffice.gov.uk",
		reversed: "ku.vog.eciffoemoh"
	},
	{
		suffix: "ro.im",
		reversed: "mi.or"
	},
	{
		suffix: "goip.de",
		reversed: "ed.piog"
	},
	{
		suffix: "run.app",
		reversed: "ppa.nur"
	},
	{
		suffix: "a.run.app",
		reversed: "ppa.nur.a"
	},
	{
		suffix: "web.app",
		reversed: "ppa.bew"
	},
	{
		suffix: "*.0emm.com",
		reversed: "moc.mme0"
	},
	{
		suffix: "appspot.com",
		reversed: "moc.topsppa"
	},
	{
		suffix: "*.r.appspot.com",
		reversed: "moc.topsppa.r"
	},
	{
		suffix: "codespot.com",
		reversed: "moc.topsedoc"
	},
	{
		suffix: "googleapis.com",
		reversed: "moc.sipaelgoog"
	},
	{
		suffix: "googlecode.com",
		reversed: "moc.edocelgoog"
	},
	{
		suffix: "pagespeedmobilizer.com",
		reversed: "moc.rezilibomdeepsegap"
	},
	{
		suffix: "publishproxy.com",
		reversed: "moc.yxorphsilbup"
	},
	{
		suffix: "withgoogle.com",
		reversed: "moc.elgooghtiw"
	},
	{
		suffix: "withyoutube.com",
		reversed: "moc.ebutuoyhtiw"
	},
	{
		suffix: "*.gateway.dev",
		reversed: "ved.yawetag"
	},
	{
		suffix: "cloud.goog",
		reversed: "goog.duolc"
	},
	{
		suffix: "translate.goog",
		reversed: "goog.etalsnart"
	},
	{
		suffix: "*.usercontent.goog",
		reversed: "goog.tnetnocresu"
	},
	{
		suffix: "cloudfunctions.net",
		reversed: "ten.snoitcnufduolc"
	},
	{
		suffix: "blogspot.ae",
		reversed: "ea.topsgolb"
	},
	{
		suffix: "blogspot.al",
		reversed: "la.topsgolb"
	},
	{
		suffix: "blogspot.am",
		reversed: "ma.topsgolb"
	},
	{
		suffix: "blogspot.ba",
		reversed: "ab.topsgolb"
	},
	{
		suffix: "blogspot.be",
		reversed: "eb.topsgolb"
	},
	{
		suffix: "blogspot.bg",
		reversed: "gb.topsgolb"
	},
	{
		suffix: "blogspot.bj",
		reversed: "jb.topsgolb"
	},
	{
		suffix: "blogspot.ca",
		reversed: "ac.topsgolb"
	},
	{
		suffix: "blogspot.cf",
		reversed: "fc.topsgolb"
	},
	{
		suffix: "blogspot.ch",
		reversed: "hc.topsgolb"
	},
	{
		suffix: "blogspot.cl",
		reversed: "lc.topsgolb"
	},
	{
		suffix: "blogspot.co.at",
		reversed: "ta.oc.topsgolb"
	},
	{
		suffix: "blogspot.co.id",
		reversed: "di.oc.topsgolb"
	},
	{
		suffix: "blogspot.co.il",
		reversed: "li.oc.topsgolb"
	},
	{
		suffix: "blogspot.co.ke",
		reversed: "ek.oc.topsgolb"
	},
	{
		suffix: "blogspot.co.nz",
		reversed: "zn.oc.topsgolb"
	},
	{
		suffix: "blogspot.co.uk",
		reversed: "ku.oc.topsgolb"
	},
	{
		suffix: "blogspot.co.za",
		reversed: "az.oc.topsgolb"
	},
	{
		suffix: "blogspot.com",
		reversed: "moc.topsgolb"
	},
	{
		suffix: "blogspot.com.ar",
		reversed: "ra.moc.topsgolb"
	},
	{
		suffix: "blogspot.com.au",
		reversed: "ua.moc.topsgolb"
	},
	{
		suffix: "blogspot.com.br",
		reversed: "rb.moc.topsgolb"
	},
	{
		suffix: "blogspot.com.by",
		reversed: "yb.moc.topsgolb"
	},
	{
		suffix: "blogspot.com.co",
		reversed: "oc.moc.topsgolb"
	},
	{
		suffix: "blogspot.com.cy",
		reversed: "yc.moc.topsgolb"
	},
	{
		suffix: "blogspot.com.ee",
		reversed: "ee.moc.topsgolb"
	},
	{
		suffix: "blogspot.com.eg",
		reversed: "ge.moc.topsgolb"
	},
	{
		suffix: "blogspot.com.es",
		reversed: "se.moc.topsgolb"
	},
	{
		suffix: "blogspot.com.mt",
		reversed: "tm.moc.topsgolb"
	},
	{
		suffix: "blogspot.com.ng",
		reversed: "gn.moc.topsgolb"
	},
	{
		suffix: "blogspot.com.tr",
		reversed: "rt.moc.topsgolb"
	},
	{
		suffix: "blogspot.com.uy",
		reversed: "yu.moc.topsgolb"
	},
	{
		suffix: "blogspot.cv",
		reversed: "vc.topsgolb"
	},
	{
		suffix: "blogspot.cz",
		reversed: "zc.topsgolb"
	},
	{
		suffix: "blogspot.de",
		reversed: "ed.topsgolb"
	},
	{
		suffix: "blogspot.dk",
		reversed: "kd.topsgolb"
	},
	{
		suffix: "blogspot.fi",
		reversed: "if.topsgolb"
	},
	{
		suffix: "blogspot.fr",
		reversed: "rf.topsgolb"
	},
	{
		suffix: "blogspot.gr",
		reversed: "rg.topsgolb"
	},
	{
		suffix: "blogspot.hk",
		reversed: "kh.topsgolb"
	},
	{
		suffix: "blogspot.hr",
		reversed: "rh.topsgolb"
	},
	{
		suffix: "blogspot.hu",
		reversed: "uh.topsgolb"
	},
	{
		suffix: "blogspot.ie",
		reversed: "ei.topsgolb"
	},
	{
		suffix: "blogspot.in",
		reversed: "ni.topsgolb"
	},
	{
		suffix: "blogspot.is",
		reversed: "si.topsgolb"
	},
	{
		suffix: "blogspot.it",
		reversed: "ti.topsgolb"
	},
	{
		suffix: "blogspot.jp",
		reversed: "pj.topsgolb"
	},
	{
		suffix: "blogspot.kr",
		reversed: "rk.topsgolb"
	},
	{
		suffix: "blogspot.li",
		reversed: "il.topsgolb"
	},
	{
		suffix: "blogspot.lt",
		reversed: "tl.topsgolb"
	},
	{
		suffix: "blogspot.lu",
		reversed: "ul.topsgolb"
	},
	{
		suffix: "blogspot.md",
		reversed: "dm.topsgolb"
	},
	{
		suffix: "blogspot.mk",
		reversed: "km.topsgolb"
	},
	{
		suffix: "blogspot.mr",
		reversed: "rm.topsgolb"
	},
	{
		suffix: "blogspot.mx",
		reversed: "xm.topsgolb"
	},
	{
		suffix: "blogspot.my",
		reversed: "ym.topsgolb"
	},
	{
		suffix: "blogspot.nl",
		reversed: "ln.topsgolb"
	},
	{
		suffix: "blogspot.no",
		reversed: "on.topsgolb"
	},
	{
		suffix: "blogspot.pe",
		reversed: "ep.topsgolb"
	},
	{
		suffix: "blogspot.pt",
		reversed: "tp.topsgolb"
	},
	{
		suffix: "blogspot.qa",
		reversed: "aq.topsgolb"
	},
	{
		suffix: "blogspot.re",
		reversed: "er.topsgolb"
	},
	{
		suffix: "blogspot.ro",
		reversed: "or.topsgolb"
	},
	{
		suffix: "blogspot.rs",
		reversed: "sr.topsgolb"
	},
	{
		suffix: "blogspot.ru",
		reversed: "ur.topsgolb"
	},
	{
		suffix: "blogspot.se",
		reversed: "es.topsgolb"
	},
	{
		suffix: "blogspot.sg",
		reversed: "gs.topsgolb"
	},
	{
		suffix: "blogspot.si",
		reversed: "is.topsgolb"
	},
	{
		suffix: "blogspot.sk",
		reversed: "ks.topsgolb"
	},
	{
		suffix: "blogspot.sn",
		reversed: "ns.topsgolb"
	},
	{
		suffix: "blogspot.td",
		reversed: "dt.topsgolb"
	},
	{
		suffix: "blogspot.tw",
		reversed: "wt.topsgolb"
	},
	{
		suffix: "blogspot.ug",
		reversed: "gu.topsgolb"
	},
	{
		suffix: "blogspot.vn",
		reversed: "nv.topsgolb"
	},
	{
		suffix: "goupile.fr",
		reversed: "rf.elipuog"
	},
	{
		suffix: "gov.nl",
		reversed: "ln.vog"
	},
	{
		suffix: "awsmppl.com",
		reversed: "moc.lppmswa"
	},
	{
		suffix: "günstigbestellen.de",
		reversed: "ed.bvz-nelletsebgitsng--nx"
	},
	{
		suffix: "günstigliefern.de",
		reversed: "ed.bow-nrefeilgitsng--nx"
	},
	{
		suffix: "fin.ci",
		reversed: "ic.nif"
	},
	{
		suffix: "free.hr",
		reversed: "rh.eerf"
	},
	{
		suffix: "caa.li",
		reversed: "il.aac"
	},
	{
		suffix: "ua.rs",
		reversed: "sr.au"
	},
	{
		suffix: "conf.se",
		reversed: "es.fnoc"
	},
	{
		suffix: "hs.zone",
		reversed: "enoz.sh"
	},
	{
		suffix: "hs.run",
		reversed: "nur.sh"
	},
	{
		suffix: "hashbang.sh",
		reversed: "hs.gnabhsah"
	},
	{
		suffix: "hasura.app",
		reversed: "ppa.arusah"
	},
	{
		suffix: "hasura-app.io",
		reversed: "oi.ppa-arusah"
	},
	{
		suffix: "pages.it.hs-heilbronn.de",
		reversed: "ed.nnorblieh-sh.ti.segap"
	},
	{
		suffix: "hepforge.org",
		reversed: "gro.egrofpeh"
	},
	{
		suffix: "herokuapp.com",
		reversed: "moc.ppaukoreh"
	},
	{
		suffix: "herokussl.com",
		reversed: "moc.lssukoreh"
	},
	{
		suffix: "ravendb.cloud",
		reversed: "duolc.bdnevar"
	},
	{
		suffix: "ravendb.community",
		reversed: "ytinummoc.bdnevar"
	},
	{
		suffix: "ravendb.me",
		reversed: "em.bdnevar"
	},
	{
		suffix: "development.run",
		reversed: "nur.tnempoleved"
	},
	{
		suffix: "ravendb.run",
		reversed: "nur.bdnevar"
	},
	{
		suffix: "homesklep.pl",
		reversed: "lp.pelksemoh"
	},
	{
		suffix: "secaas.hk",
		reversed: "kh.saaces"
	},
	{
		suffix: "hoplix.shop",
		reversed: "pohs.xilpoh"
	},
	{
		suffix: "orx.biz",
		reversed: "zib.xro"
	},
	{
		suffix: "biz.gl",
		reversed: "lg.zib"
	},
	{
		suffix: "col.ng",
		reversed: "gn.loc"
	},
	{
		suffix: "firm.ng",
		reversed: "gn.mrif"
	},
	{
		suffix: "gen.ng",
		reversed: "gn.neg"
	},
	{
		suffix: "ltd.ng",
		reversed: "gn.dtl"
	},
	{
		suffix: "ngo.ng",
		reversed: "gn.ogn"
	},
	{
		suffix: "edu.scot",
		reversed: "tocs.ude"
	},
	{
		suffix: "sch.so",
		reversed: "os.hcs"
	},
	{
		suffix: "ie.ua",
		reversed: "au.ei"
	},
	{
		suffix: "hostyhosting.io",
		reversed: "oi.gnitsohytsoh"
	},
	{
		suffix: "häkkinen.fi",
		reversed: "if.aw5-nenikkh--nx"
	},
	{
		suffix: "*.moonscale.io",
		reversed: "oi.elacsnoom"
	},
	{
		suffix: "moonscale.net",
		reversed: "ten.elacsnoom"
	},
	{
		suffix: "iki.fi",
		reversed: "if.iki"
	},
	{
		suffix: "ibxos.it",
		reversed: "ti.soxbi"
	},
	{
		suffix: "iliadboxos.it",
		reversed: "ti.soxobdaili"
	},
	{
		suffix: "impertrixcdn.com",
		reversed: "moc.ndcxirtrepmi"
	},
	{
		suffix: "impertrix.com",
		reversed: "moc.xirtrepmi"
	},
	{
		suffix: "smushcdn.com",
		reversed: "moc.ndchsums"
	},
	{
		suffix: "wphostedmail.com",
		reversed: "moc.liamdetsohpw"
	},
	{
		suffix: "wpmucdn.com",
		reversed: "moc.ndcumpw"
	},
	{
		suffix: "tempurl.host",
		reversed: "tsoh.lrupmet"
	},
	{
		suffix: "wpmudev.host",
		reversed: "tsoh.vedumpw"
	},
	{
		suffix: "dyn-berlin.de",
		reversed: "ed.nilreb-nyd"
	},
	{
		suffix: "in-berlin.de",
		reversed: "ed.nilreb-ni"
	},
	{
		suffix: "in-brb.de",
		reversed: "ed.brb-ni"
	},
	{
		suffix: "in-butter.de",
		reversed: "ed.rettub-ni"
	},
	{
		suffix: "in-dsl.de",
		reversed: "ed.lsd-ni"
	},
	{
		suffix: "in-dsl.net",
		reversed: "ten.lsd-ni"
	},
	{
		suffix: "in-dsl.org",
		reversed: "gro.lsd-ni"
	},
	{
		suffix: "in-vpn.de",
		reversed: "ed.npv-ni"
	},
	{
		suffix: "in-vpn.net",
		reversed: "ten.npv-ni"
	},
	{
		suffix: "in-vpn.org",
		reversed: "gro.npv-ni"
	},
	{
		suffix: "biz.at",
		reversed: "ta.zib"
	},
	{
		suffix: "info.at",
		reversed: "ta.ofni"
	},
	{
		suffix: "info.cx",
		reversed: "xc.ofni"
	},
	{
		suffix: "ac.leg.br",
		reversed: "rb.gel.ca"
	},
	{
		suffix: "al.leg.br",
		reversed: "rb.gel.la"
	},
	{
		suffix: "am.leg.br",
		reversed: "rb.gel.ma"
	},
	{
		suffix: "ap.leg.br",
		reversed: "rb.gel.pa"
	},
	{
		suffix: "ba.leg.br",
		reversed: "rb.gel.ab"
	},
	{
		suffix: "ce.leg.br",
		reversed: "rb.gel.ec"
	},
	{
		suffix: "df.leg.br",
		reversed: "rb.gel.fd"
	},
	{
		suffix: "es.leg.br",
		reversed: "rb.gel.se"
	},
	{
		suffix: "go.leg.br",
		reversed: "rb.gel.og"
	},
	{
		suffix: "ma.leg.br",
		reversed: "rb.gel.am"
	},
	{
		suffix: "mg.leg.br",
		reversed: "rb.gel.gm"
	},
	{
		suffix: "ms.leg.br",
		reversed: "rb.gel.sm"
	},
	{
		suffix: "mt.leg.br",
		reversed: "rb.gel.tm"
	},
	{
		suffix: "pa.leg.br",
		reversed: "rb.gel.ap"
	},
	{
		suffix: "pb.leg.br",
		reversed: "rb.gel.bp"
	},
	{
		suffix: "pe.leg.br",
		reversed: "rb.gel.ep"
	},
	{
		suffix: "pi.leg.br",
		reversed: "rb.gel.ip"
	},
	{
		suffix: "pr.leg.br",
		reversed: "rb.gel.rp"
	},
	{
		suffix: "rj.leg.br",
		reversed: "rb.gel.jr"
	},
	{
		suffix: "rn.leg.br",
		reversed: "rb.gel.nr"
	},
	{
		suffix: "ro.leg.br",
		reversed: "rb.gel.or"
	},
	{
		suffix: "rr.leg.br",
		reversed: "rb.gel.rr"
	},
	{
		suffix: "rs.leg.br",
		reversed: "rb.gel.sr"
	},
	{
		suffix: "sc.leg.br",
		reversed: "rb.gel.cs"
	},
	{
		suffix: "se.leg.br",
		reversed: "rb.gel.es"
	},
	{
		suffix: "sp.leg.br",
		reversed: "rb.gel.ps"
	},
	{
		suffix: "to.leg.br",
		reversed: "rb.gel.ot"
	},
	{
		suffix: "pixolino.com",
		reversed: "moc.oniloxip"
	},
	{
		suffix: "na4u.ru",
		reversed: "ur.u4an"
	},
	{
		suffix: "iopsys.se",
		reversed: "es.syspoi"
	},
	{
		suffix: "ipifony.net",
		reversed: "ten.ynofipi"
	},
	{
		suffix: "iservschule.de",
		reversed: "ed.eluhcsvresi"
	},
	{
		suffix: "mein-iserv.de",
		reversed: "ed.vresi-niem"
	},
	{
		suffix: "schulplattform.de",
		reversed: "ed.mrofttalpluhcs"
	},
	{
		suffix: "schulserver.de",
		reversed: "ed.revresluhcs"
	},
	{
		suffix: "test-iserv.de",
		reversed: "ed.vresi-tset"
	},
	{
		suffix: "iserv.dev",
		reversed: "ved.vresi"
	},
	{
		suffix: "iobb.net",
		reversed: "ten.bboi"
	},
	{
		suffix: "mel.cloudlets.com.au",
		reversed: "ua.moc.stelduolc.lem"
	},
	{
		suffix: "cloud.interhostsolutions.be",
		reversed: "eb.snoitulostsohretni.duolc"
	},
	{
		suffix: "users.scale.virtualcloud.com.br",
		reversed: "rb.moc.duolclautriv.elacs.sresu"
	},
	{
		suffix: "mycloud.by",
		reversed: "yb.duolcym"
	},
	{
		suffix: "alp1.ae.flow.ch",
		reversed: "hc.wolf.ea.1pla"
	},
	{
		suffix: "appengine.flow.ch",
		reversed: "hc.wolf.enigneppa"
	},
	{
		suffix: "es-1.axarnet.cloud",
		reversed: "duolc.tenraxa.1-se"
	},
	{
		suffix: "diadem.cloud",
		reversed: "duolc.medaid"
	},
	{
		suffix: "vip.jelastic.cloud",
		reversed: "duolc.citsalej.piv"
	},
	{
		suffix: "jele.cloud",
		reversed: "duolc.elej"
	},
	{
		suffix: "it1.eur.aruba.jenv-aruba.cloud",
		reversed: "duolc.abura-vnej.abura.rue.1ti"
	},
	{
		suffix: "it1.jenv-aruba.cloud",
		reversed: "duolc.abura-vnej.1ti"
	},
	{
		suffix: "keliweb.cloud",
		reversed: "duolc.bewilek"
	},
	{
		suffix: "cs.keliweb.cloud",
		reversed: "duolc.bewilek.sc"
	},
	{
		suffix: "oxa.cloud",
		reversed: "duolc.axo"
	},
	{
		suffix: "tn.oxa.cloud",
		reversed: "duolc.axo.nt"
	},
	{
		suffix: "uk.oxa.cloud",
		reversed: "duolc.axo.ku"
	},
	{
		suffix: "primetel.cloud",
		reversed: "duolc.letemirp"
	},
	{
		suffix: "uk.primetel.cloud",
		reversed: "duolc.letemirp.ku"
	},
	{
		suffix: "ca.reclaim.cloud",
		reversed: "duolc.mialcer.ac"
	},
	{
		suffix: "uk.reclaim.cloud",
		reversed: "duolc.mialcer.ku"
	},
	{
		suffix: "us.reclaim.cloud",
		reversed: "duolc.mialcer.su"
	},
	{
		suffix: "ch.trendhosting.cloud",
		reversed: "duolc.gnitsohdnert.hc"
	},
	{
		suffix: "de.trendhosting.cloud",
		reversed: "duolc.gnitsohdnert.ed"
	},
	{
		suffix: "jele.club",
		reversed: "bulc.elej"
	},
	{
		suffix: "amscompute.com",
		reversed: "moc.etupmocsma"
	},
	{
		suffix: "clicketcloud.com",
		reversed: "moc.duolctekcilc"
	},
	{
		suffix: "dopaas.com",
		reversed: "moc.saapod"
	},
	{
		suffix: "hidora.com",
		reversed: "moc.arodih"
	},
	{
		suffix: "paas.hosted-by-previder.com",
		reversed: "moc.rediverp-yb-detsoh.saap"
	},
	{
		suffix: "rag-cloud.hosteur.com",
		reversed: "moc.ruetsoh.duolc-gar"
	},
	{
		suffix: "rag-cloud-ch.hosteur.com",
		reversed: "moc.ruetsoh.hc-duolc-gar"
	},
	{
		suffix: "jcloud.ik-server.com",
		reversed: "moc.revres-ki.duolcj"
	},
	{
		suffix: "jcloud-ver-jpc.ik-server.com",
		reversed: "moc.revres-ki.cpj-rev-duolcj"
	},
	{
		suffix: "demo.jelastic.com",
		reversed: "moc.citsalej.omed"
	},
	{
		suffix: "kilatiron.com",
		reversed: "moc.noritalik"
	},
	{
		suffix: "paas.massivegrid.com",
		reversed: "moc.dirgevissam.saap"
	},
	{
		suffix: "jed.wafaicloud.com",
		reversed: "moc.duolciafaw.dej"
	},
	{
		suffix: "lon.wafaicloud.com",
		reversed: "moc.duolciafaw.nol"
	},
	{
		suffix: "ryd.wafaicloud.com",
		reversed: "moc.duolciafaw.dyr"
	},
	{
		suffix: "j.scaleforce.com.cy",
		reversed: "yc.moc.ecrofelacs.j"
	},
	{
		suffix: "jelastic.dogado.eu",
		reversed: "ue.odagod.citsalej"
	},
	{
		suffix: "fi.cloudplatform.fi",
		reversed: "if.mroftalpduolc.if"
	},
	{
		suffix: "demo.datacenter.fi",
		reversed: "if.retnecatad.omed"
	},
	{
		suffix: "paas.datacenter.fi",
		reversed: "if.retnecatad.saap"
	},
	{
		suffix: "jele.host",
		reversed: "tsoh.elej"
	},
	{
		suffix: "mircloud.host",
		reversed: "tsoh.duolcrim"
	},
	{
		suffix: "paas.beebyte.io",
		reversed: "oi.etybeeb.saap"
	},
	{
		suffix: "sekd1.beebyteapp.io",
		reversed: "oi.ppaetybeeb.1dkes"
	},
	{
		suffix: "jele.io",
		reversed: "oi.elej"
	},
	{
		suffix: "cloud-fr1.unispace.io",
		reversed: "oi.ecapsinu.1rf-duolc"
	},
	{
		suffix: "jc.neen.it",
		reversed: "ti.neen.cj"
	},
	{
		suffix: "cloud.jelastic.open.tim.it",
		reversed: "ti.mit.nepo.citsalej.duolc"
	},
	{
		suffix: "jcloud.kz",
		reversed: "zk.duolcj"
	},
	{
		suffix: "upaas.kazteleport.kz",
		reversed: "zk.tropeletzak.saapu"
	},
	{
		suffix: "cloudjiffy.net",
		reversed: "ten.yffijduolc"
	},
	{
		suffix: "fra1-de.cloudjiffy.net",
		reversed: "ten.yffijduolc.ed-1arf"
	},
	{
		suffix: "west1-us.cloudjiffy.net",
		reversed: "ten.yffijduolc.su-1tsew"
	},
	{
		suffix: "jls-sto1.elastx.net",
		reversed: "ten.xtsale.1ots-slj"
	},
	{
		suffix: "jls-sto2.elastx.net",
		reversed: "ten.xtsale.2ots-slj"
	},
	{
		suffix: "jls-sto3.elastx.net",
		reversed: "ten.xtsale.3ots-slj"
	},
	{
		suffix: "faststacks.net",
		reversed: "ten.skcatstsaf"
	},
	{
		suffix: "fr-1.paas.massivegrid.net",
		reversed: "ten.dirgevissam.saap.1-rf"
	},
	{
		suffix: "lon-1.paas.massivegrid.net",
		reversed: "ten.dirgevissam.saap.1-nol"
	},
	{
		suffix: "lon-2.paas.massivegrid.net",
		reversed: "ten.dirgevissam.saap.2-nol"
	},
	{
		suffix: "ny-1.paas.massivegrid.net",
		reversed: "ten.dirgevissam.saap.1-yn"
	},
	{
		suffix: "ny-2.paas.massivegrid.net",
		reversed: "ten.dirgevissam.saap.2-yn"
	},
	{
		suffix: "sg-1.paas.massivegrid.net",
		reversed: "ten.dirgevissam.saap.1-gs"
	},
	{
		suffix: "jelastic.saveincloud.net",
		reversed: "ten.duolcnievas.citsalej"
	},
	{
		suffix: "nordeste-idc.saveincloud.net",
		reversed: "ten.duolcnievas.cdi-etsedron"
	},
	{
		suffix: "j.scaleforce.net",
		reversed: "ten.ecrofelacs.j"
	},
	{
		suffix: "jelastic.tsukaeru.net",
		reversed: "ten.ureakust.citsalej"
	},
	{
		suffix: "sdscloud.pl",
		reversed: "lp.duolcsds"
	},
	{
		suffix: "unicloud.pl",
		reversed: "lp.duolcinu"
	},
	{
		suffix: "mircloud.ru",
		reversed: "ur.duolcrim"
	},
	{
		suffix: "jelastic.regruhosting.ru",
		reversed: "ur.gnitsohurger.citsalej"
	},
	{
		suffix: "enscaled.sg",
		reversed: "gs.delacsne"
	},
	{
		suffix: "jele.site",
		reversed: "etis.elej"
	},
	{
		suffix: "jelastic.team",
		reversed: "maet.citsalej"
	},
	{
		suffix: "orangecloud.tn",
		reversed: "nt.duolcegnaro"
	},
	{
		suffix: "j.layershift.co.uk",
		reversed: "ku.oc.tfihsreyal.j"
	},
	{
		suffix: "phx.enscaled.us",
		reversed: "su.delacsne.xhp"
	},
	{
		suffix: "mircloud.us",
		reversed: "su.duolcrim"
	},
	{
		suffix: "myjino.ru",
		reversed: "ur.onijym"
	},
	{
		suffix: "*.hosting.myjino.ru",
		reversed: "ur.onijym.gnitsoh"
	},
	{
		suffix: "*.landing.myjino.ru",
		reversed: "ur.onijym.gnidnal"
	},
	{
		suffix: "*.spectrum.myjino.ru",
		reversed: "ur.onijym.murtceps"
	},
	{
		suffix: "*.vps.myjino.ru",
		reversed: "ur.onijym.spv"
	},
	{
		suffix: "jotelulu.cloud",
		reversed: "duolc.ululetoj"
	},
	{
		suffix: "*.triton.zone",
		reversed: "enoz.notirt"
	},
	{
		suffix: "*.cns.joyent.com",
		reversed: "moc.tneyoj.snc"
	},
	{
		suffix: "js.org",
		reversed: "gro.sj"
	},
	{
		suffix: "kaas.gg",
		reversed: "gg.saak"
	},
	{
		suffix: "khplay.nl",
		reversed: "ln.yalphk"
	},
	{
		suffix: "ktistory.com",
		reversed: "moc.yrotsitk"
	},
	{
		suffix: "kapsi.fi",
		reversed: "if.ispak"
	},
	{
		suffix: "keymachine.de",
		reversed: "ed.enihcamyek"
	},
	{
		suffix: "kinghost.net",
		reversed: "ten.tsohgnik"
	},
	{
		suffix: "uni5.net",
		reversed: "ten.5inu"
	},
	{
		suffix: "knightpoint.systems",
		reversed: "smetsys.tniopthgink"
	},
	{
		suffix: "koobin.events",
		reversed: "stneve.nibook"
	},
	{
		suffix: "oya.to",
		reversed: "ot.ayo"
	},
	{
		suffix: "kuleuven.cloud",
		reversed: "duolc.nevueluk"
	},
	{
		suffix: "ezproxy.kuleuven.be",
		reversed: "eb.nevueluk.yxorpze"
	},
	{
		suffix: "co.krd",
		reversed: "drk.oc"
	},
	{
		suffix: "edu.krd",
		reversed: "drk.ude"
	},
	{
		suffix: "krellian.net",
		reversed: "ten.naillerk"
	},
	{
		suffix: "webthings.io",
		reversed: "oi.sgnihtbew"
	},
	{
		suffix: "git-repos.de",
		reversed: "ed.soper-tig"
	},
	{
		suffix: "lcube-server.de",
		reversed: "ed.revres-ebucl"
	},
	{
		suffix: "svn-repos.de",
		reversed: "ed.soper-nvs"
	},
	{
		suffix: "leadpages.co",
		reversed: "oc.segapdael"
	},
	{
		suffix: "lpages.co",
		reversed: "oc.segapl"
	},
	{
		suffix: "lpusercontent.com",
		reversed: "moc.tnetnocresupl"
	},
	{
		suffix: "lelux.site",
		reversed: "etis.xulel"
	},
	{
		suffix: "co.business",
		reversed: "ssenisub.oc"
	},
	{
		suffix: "co.education",
		reversed: "noitacude.oc"
	},
	{
		suffix: "co.events",
		reversed: "stneve.oc"
	},
	{
		suffix: "co.financial",
		reversed: "laicnanif.oc"
	},
	{
		suffix: "co.network",
		reversed: "krowten.oc"
	},
	{
		suffix: "co.place",
		reversed: "ecalp.oc"
	},
	{
		suffix: "co.technology",
		reversed: "ygolonhcet.oc"
	},
	{
		suffix: "app.lmpm.com",
		reversed: "moc.mpml.ppa"
	},
	{
		suffix: "linkyard.cloud",
		reversed: "duolc.drayknil"
	},
	{
		suffix: "linkyard-cloud.ch",
		reversed: "hc.duolc-drayknil"
	},
	{
		suffix: "members.linode.com",
		reversed: "moc.edonil.srebmem"
	},
	{
		suffix: "*.nodebalancer.linode.com",
		reversed: "moc.edonil.recnalabedon"
	},
	{
		suffix: "*.linodeobjects.com",
		reversed: "moc.stcejboedonil"
	},
	{
		suffix: "ip.linodeusercontent.com",
		reversed: "moc.tnetnocresuedonil.pi"
	},
	{
		suffix: "we.bs",
		reversed: "sb.ew"
	},
	{
		suffix: "*.user.localcert.dev",
		reversed: "ved.treclacol.resu"
	},
	{
		suffix: "localzone.xyz",
		reversed: "zyx.enozlacol"
	},
	{
		suffix: "loginline.app",
		reversed: "ppa.enilnigol"
	},
	{
		suffix: "loginline.dev",
		reversed: "ved.enilnigol"
	},
	{
		suffix: "loginline.io",
		reversed: "oi.enilnigol"
	},
	{
		suffix: "loginline.services",
		reversed: "secivres.enilnigol"
	},
	{
		suffix: "loginline.site",
		reversed: "etis.enilnigol"
	},
	{
		suffix: "servers.run",
		reversed: "nur.srevres"
	},
	{
		suffix: "lohmus.me",
		reversed: "em.sumhol"
	},
	{
		suffix: "krasnik.pl",
		reversed: "lp.kinsark"
	},
	{
		suffix: "leczna.pl",
		reversed: "lp.anzcel"
	},
	{
		suffix: "lubartow.pl",
		reversed: "lp.wotrabul"
	},
	{
		suffix: "lublin.pl",
		reversed: "lp.nilbul"
	},
	{
		suffix: "poniatowa.pl",
		reversed: "lp.awotainop"
	},
	{
		suffix: "swidnik.pl",
		reversed: "lp.kindiws"
	},
	{
		suffix: "glug.org.uk",
		reversed: "ku.gro.gulg"
	},
	{
		suffix: "lug.org.uk",
		reversed: "ku.gro.gul"
	},
	{
		suffix: "lugs.org.uk",
		reversed: "ku.gro.sgul"
	},
	{
		suffix: "barsy.bg",
		reversed: "gb.ysrab"
	},
	{
		suffix: "barsy.co.uk",
		reversed: "ku.oc.ysrab"
	},
	{
		suffix: "barsyonline.co.uk",
		reversed: "ku.oc.enilnoysrab"
	},
	{
		suffix: "barsycenter.com",
		reversed: "moc.retnecysrab"
	},
	{
		suffix: "barsyonline.com",
		reversed: "moc.enilnoysrab"
	},
	{
		suffix: "barsy.club",
		reversed: "bulc.ysrab"
	},
	{
		suffix: "barsy.de",
		reversed: "ed.ysrab"
	},
	{
		suffix: "barsy.eu",
		reversed: "ue.ysrab"
	},
	{
		suffix: "barsy.in",
		reversed: "ni.ysrab"
	},
	{
		suffix: "barsy.info",
		reversed: "ofni.ysrab"
	},
	{
		suffix: "barsy.io",
		reversed: "oi.ysrab"
	},
	{
		suffix: "barsy.me",
		reversed: "em.ysrab"
	},
	{
		suffix: "barsy.menu",
		reversed: "unem.ysrab"
	},
	{
		suffix: "barsy.mobi",
		reversed: "ibom.ysrab"
	},
	{
		suffix: "barsy.net",
		reversed: "ten.ysrab"
	},
	{
		suffix: "barsy.online",
		reversed: "enilno.ysrab"
	},
	{
		suffix: "barsy.org",
		reversed: "gro.ysrab"
	},
	{
		suffix: "barsy.pro",
		reversed: "orp.ysrab"
	},
	{
		suffix: "barsy.pub",
		reversed: "bup.ysrab"
	},
	{
		suffix: "barsy.ro",
		reversed: "or.ysrab"
	},
	{
		suffix: "barsy.shop",
		reversed: "pohs.ysrab"
	},
	{
		suffix: "barsy.site",
		reversed: "etis.ysrab"
	},
	{
		suffix: "barsy.support",
		reversed: "troppus.ysrab"
	},
	{
		suffix: "barsy.uk",
		reversed: "ku.ysrab"
	},
	{
		suffix: "*.magentosite.cloud",
		reversed: "duolc.etisotnegam"
	},
	{
		suffix: "mayfirst.info",
		reversed: "ofni.tsrifyam"
	},
	{
		suffix: "mayfirst.org",
		reversed: "gro.tsrifyam"
	},
	{
		suffix: "hb.cldmail.ru",
		reversed: "ur.liamdlc.bh"
	},
	{
		suffix: "cn.vu",
		reversed: "uv.nc"
	},
	{
		suffix: "mazeplay.com",
		reversed: "moc.yalpezam"
	},
	{
		suffix: "mcpe.me",
		reversed: "em.epcm"
	},
	{
		suffix: "mcdir.me",
		reversed: "em.ridcm"
	},
	{
		suffix: "mcdir.ru",
		reversed: "ur.ridcm"
	},
	{
		suffix: "mcpre.ru",
		reversed: "ur.erpcm"
	},
	{
		suffix: "vps.mcdir.ru",
		reversed: "ur.ridcm.spv"
	},
	{
		suffix: "mediatech.by",
		reversed: "yb.hcetaidem"
	},
	{
		suffix: "mediatech.dev",
		reversed: "ved.hcetaidem"
	},
	{
		suffix: "hra.health",
		reversed: "htlaeh.arh"
	},
	{
		suffix: "miniserver.com",
		reversed: "moc.revresinim"
	},
	{
		suffix: "memset.net",
		reversed: "ten.tesmem"
	},
	{
		suffix: "messerli.app",
		reversed: "ppa.ilressem"
	},
	{
		suffix: "*.cloud.metacentrum.cz",
		reversed: "zc.murtnecatem.duolc"
	},
	{
		suffix: "custom.metacentrum.cz",
		reversed: "zc.murtnecatem.motsuc"
	},
	{
		suffix: "flt.cloud.muni.cz",
		reversed: "zc.inum.duolc.tlf"
	},
	{
		suffix: "usr.cloud.muni.cz",
		reversed: "zc.inum.duolc.rsu"
	},
	{
		suffix: "meteorapp.com",
		reversed: "moc.pparoetem"
	},
	{
		suffix: "eu.meteorapp.com",
		reversed: "moc.pparoetem.ue"
	},
	{
		suffix: "co.pl",
		reversed: "lp.oc"
	},
	{
		suffix: "*.azurecontainer.io",
		reversed: "oi.reniatnoceruza"
	},
	{
		suffix: "azurewebsites.net",
		reversed: "ten.setisbeweruza"
	},
	{
		suffix: "azure-mobile.net",
		reversed: "ten.elibom-eruza"
	},
	{
		suffix: "cloudapp.net",
		reversed: "ten.ppaduolc"
	},
	{
		suffix: "azurestaticapps.net",
		reversed: "ten.sppacitatseruza"
	},
	{
		suffix: "1.azurestaticapps.net",
		reversed: "ten.sppacitatseruza.1"
	},
	{
		suffix: "2.azurestaticapps.net",
		reversed: "ten.sppacitatseruza.2"
	},
	{
		suffix: "3.azurestaticapps.net",
		reversed: "ten.sppacitatseruza.3"
	},
	{
		suffix: "centralus.azurestaticapps.net",
		reversed: "ten.sppacitatseruza.sulartnec"
	},
	{
		suffix: "eastasia.azurestaticapps.net",
		reversed: "ten.sppacitatseruza.aisatsae"
	},
	{
		suffix: "eastus2.azurestaticapps.net",
		reversed: "ten.sppacitatseruza.2sutsae"
	},
	{
		suffix: "westeurope.azurestaticapps.net",
		reversed: "ten.sppacitatseruza.eporuetsew"
	},
	{
		suffix: "westus2.azurestaticapps.net",
		reversed: "ten.sppacitatseruza.2sutsew"
	},
	{
		suffix: "csx.cc",
		reversed: "cc.xsc"
	},
	{
		suffix: "mintere.site",
		reversed: "etis.eretnim"
	},
	{
		suffix: "forte.id",
		reversed: "di.etrof"
	},
	{
		suffix: "mozilla-iot.org",
		reversed: "gro.toi-allizom"
	},
	{
		suffix: "bmoattachments.org",
		reversed: "gro.stnemhcattaomb"
	},
	{
		suffix: "net.ru",
		reversed: "ur.ten"
	},
	{
		suffix: "org.ru",
		reversed: "ur.gro"
	},
	{
		suffix: "pp.ru",
		reversed: "ur.pp"
	},
	{
		suffix: "hostedpi.com",
		reversed: "moc.ipdetsoh"
	},
	{
		suffix: "customer.mythic-beasts.com",
		reversed: "moc.stsaeb-cihtym.remotsuc"
	},
	{
		suffix: "caracal.mythic-beasts.com",
		reversed: "moc.stsaeb-cihtym.lacarac"
	},
	{
		suffix: "fentiger.mythic-beasts.com",
		reversed: "moc.stsaeb-cihtym.regitnef"
	},
	{
		suffix: "lynx.mythic-beasts.com",
		reversed: "moc.stsaeb-cihtym.xnyl"
	},
	{
		suffix: "ocelot.mythic-beasts.com",
		reversed: "moc.stsaeb-cihtym.toleco"
	},
	{
		suffix: "oncilla.mythic-beasts.com",
		reversed: "moc.stsaeb-cihtym.allicno"
	},
	{
		suffix: "onza.mythic-beasts.com",
		reversed: "moc.stsaeb-cihtym.azno"
	},
	{
		suffix: "sphinx.mythic-beasts.com",
		reversed: "moc.stsaeb-cihtym.xnihps"
	},
	{
		suffix: "vs.mythic-beasts.com",
		reversed: "moc.stsaeb-cihtym.sv"
	},
	{
		suffix: "x.mythic-beasts.com",
		reversed: "moc.stsaeb-cihtym.x"
	},
	{
		suffix: "yali.mythic-beasts.com",
		reversed: "moc.stsaeb-cihtym.ilay"
	},
	{
		suffix: "cust.retrosnub.co.uk",
		reversed: "ku.oc.bunsorter.tsuc"
	},
	{
		suffix: "ui.nabu.casa",
		reversed: "asac.uban.iu"
	},
	{
		suffix: "cloud.nospamproxy.com",
		reversed: "moc.yxorpmapson.duolc"
	},
	{
		suffix: "netlify.app",
		reversed: "ppa.yfilten"
	},
	{
		suffix: "4u.com",
		reversed: "moc.u4"
	},
	{
		suffix: "ngrok.app",
		reversed: "ppa.korgn"
	},
	{
		suffix: "ngrok-free.app",
		reversed: "ppa.eerf-korgn"
	},
	{
		suffix: "ngrok.dev",
		reversed: "ved.korgn"
	},
	{
		suffix: "ngrok-free.dev",
		reversed: "ved.eerf-korgn"
	},
	{
		suffix: "ngrok.io",
		reversed: "oi.korgn"
	},
	{
		suffix: "ap.ngrok.io",
		reversed: "oi.korgn.pa"
	},
	{
		suffix: "au.ngrok.io",
		reversed: "oi.korgn.ua"
	},
	{
		suffix: "eu.ngrok.io",
		reversed: "oi.korgn.ue"
	},
	{
		suffix: "in.ngrok.io",
		reversed: "oi.korgn.ni"
	},
	{
		suffix: "jp.ngrok.io",
		reversed: "oi.korgn.pj"
	},
	{
		suffix: "sa.ngrok.io",
		reversed: "oi.korgn.as"
	},
	{
		suffix: "us.ngrok.io",
		reversed: "oi.korgn.su"
	},
	{
		suffix: "ngrok.pizza",
		reversed: "azzip.korgn"
	},
	{
		suffix: "nh-serv.co.uk",
		reversed: "ku.oc.vres-hn"
	},
	{
		suffix: "nfshost.com",
		reversed: "moc.tsohsfn"
	},
	{
		suffix: "*.developer.app",
		reversed: "ppa.repoleved"
	},
	{
		suffix: "noop.app",
		reversed: "ppa.poon"
	},
	{
		suffix: "*.northflank.app",
		reversed: "ppa.knalfhtron"
	},
	{
		suffix: "*.build.run",
		reversed: "nur.dliub"
	},
	{
		suffix: "*.code.run",
		reversed: "nur.edoc"
	},
	{
		suffix: "*.database.run",
		reversed: "nur.esabatad"
	},
	{
		suffix: "*.migration.run",
		reversed: "nur.noitargim"
	},
	{
		suffix: "noticeable.news",
		reversed: "swen.elbaeciton"
	},
	{
		suffix: "dnsking.ch",
		reversed: "hc.gniksnd"
	},
	{
		suffix: "mypi.co",
		reversed: "oc.ipym"
	},
	{
		suffix: "n4t.co",
		reversed: "oc.t4n"
	},
	{
		suffix: "001www.com",
		reversed: "moc.www100"
	},
	{
		suffix: "ddnslive.com",
		reversed: "moc.evilsndd"
	},
	{
		suffix: "myiphost.com",
		reversed: "moc.tsohpiym"
	},
	{
		suffix: "forumz.info",
		reversed: "ofni.zmurof"
	},
	{
		suffix: "16-b.it",
		reversed: "ti.b-61"
	},
	{
		suffix: "32-b.it",
		reversed: "ti.b-23"
	},
	{
		suffix: "64-b.it",
		reversed: "ti.b-46"
	},
	{
		suffix: "soundcast.me",
		reversed: "em.tsacdnuos"
	},
	{
		suffix: "tcp4.me",
		reversed: "em.4pct"
	},
	{
		suffix: "dnsup.net",
		reversed: "ten.pusnd"
	},
	{
		suffix: "hicam.net",
		reversed: "ten.macih"
	},
	{
		suffix: "now-dns.net",
		reversed: "ten.snd-won"
	},
	{
		suffix: "ownip.net",
		reversed: "ten.pinwo"
	},
	{
		suffix: "vpndns.net",
		reversed: "ten.sndnpv"
	},
	{
		suffix: "dynserv.org",
		reversed: "gro.vresnyd"
	},
	{
		suffix: "now-dns.org",
		reversed: "gro.snd-won"
	},
	{
		suffix: "x443.pw",
		reversed: "wp.344x"
	},
	{
		suffix: "now-dns.top",
		reversed: "pot.snd-won"
	},
	{
		suffix: "ntdll.top",
		reversed: "pot.lldtn"
	},
	{
		suffix: "freeddns.us",
		reversed: "su.snddeerf"
	},
	{
		suffix: "crafting.xyz",
		reversed: "zyx.gnitfarc"
	},
	{
		suffix: "zapto.xyz",
		reversed: "zyx.otpaz"
	},
	{
		suffix: "nsupdate.info",
		reversed: "ofni.etadpusn"
	},
	{
		suffix: "nerdpol.ovh",
		reversed: "hvo.lopdren"
	},
	{
		suffix: "blogsyte.com",
		reversed: "moc.etysgolb"
	},
	{
		suffix: "brasilia.me",
		reversed: "em.ailisarb"
	},
	{
		suffix: "cable-modem.org",
		reversed: "gro.medom-elbac"
	},
	{
		suffix: "ciscofreak.com",
		reversed: "moc.kaerfocsic"
	},
	{
		suffix: "collegefan.org",
		reversed: "gro.nafegelloc"
	},
	{
		suffix: "couchpotatofries.org",
		reversed: "gro.seirfotatophcuoc"
	},
	{
		suffix: "damnserver.com",
		reversed: "moc.revresnmad"
	},
	{
		suffix: "ddns.me",
		reversed: "em.sndd"
	},
	{
		suffix: "ditchyourip.com",
		reversed: "moc.piruoyhctid"
	},
	{
		suffix: "dnsfor.me",
		reversed: "em.rofsnd"
	},
	{
		suffix: "dnsiskinky.com",
		reversed: "moc.ykniksisnd"
	},
	{
		suffix: "dvrcam.info",
		reversed: "ofni.macrvd"
	},
	{
		suffix: "dynns.com",
		reversed: "moc.snnyd"
	},
	{
		suffix: "eating-organic.net",
		reversed: "ten.cinagro-gnitae"
	},
	{
		suffix: "fantasyleague.cc",
		reversed: "cc.eugaelysatnaf"
	},
	{
		suffix: "geekgalaxy.com",
		reversed: "moc.yxalagkeeg"
	},
	{
		suffix: "golffan.us",
		reversed: "su.nafflog"
	},
	{
		suffix: "health-carereform.com",
		reversed: "moc.mrofererac-htlaeh"
	},
	{
		suffix: "homesecuritymac.com",
		reversed: "moc.camytirucesemoh"
	},
	{
		suffix: "homesecuritypc.com",
		reversed: "moc.cpytirucesemoh"
	},
	{
		suffix: "hopto.me",
		reversed: "em.otpoh"
	},
	{
		suffix: "ilovecollege.info",
		reversed: "ofni.egellocevoli"
	},
	{
		suffix: "loginto.me",
		reversed: "em.otnigol"
	},
	{
		suffix: "mlbfan.org",
		reversed: "gro.nafblm"
	},
	{
		suffix: "mmafan.biz",
		reversed: "zib.nafamm"
	},
	{
		suffix: "myactivedirectory.com",
		reversed: "moc.yrotceridevitcaym"
	},
	{
		suffix: "mydissent.net",
		reversed: "ten.tnessidym"
	},
	{
		suffix: "myeffect.net",
		reversed: "ten.tceffeym"
	},
	{
		suffix: "mymediapc.net",
		reversed: "ten.cpaidemym"
	},
	{
		suffix: "mypsx.net",
		reversed: "ten.xspym"
	},
	{
		suffix: "mysecuritycamera.com",
		reversed: "moc.aremacytirucesym"
	},
	{
		suffix: "mysecuritycamera.net",
		reversed: "ten.aremacytirucesym"
	},
	{
		suffix: "mysecuritycamera.org",
		reversed: "gro.aremacytirucesym"
	},
	{
		suffix: "net-freaks.com",
		reversed: "moc.skaerf-ten"
	},
	{
		suffix: "nflfan.org",
		reversed: "gro.naflfn"
	},
	{
		suffix: "nhlfan.net",
		reversed: "ten.naflhn"
	},
	{
		suffix: "no-ip.ca",
		reversed: "ac.pi-on"
	},
	{
		suffix: "no-ip.co.uk",
		reversed: "ku.oc.pi-on"
	},
	{
		suffix: "no-ip.net",
		reversed: "ten.pi-on"
	},
	{
		suffix: "noip.us",
		reversed: "su.pion"
	},
	{
		suffix: "onthewifi.com",
		reversed: "moc.ifiwehtno"
	},
	{
		suffix: "pgafan.net",
		reversed: "ten.nafagp"
	},
	{
		suffix: "point2this.com",
		reversed: "moc.siht2tniop"
	},
	{
		suffix: "pointto.us",
		reversed: "su.ottniop"
	},
	{
		suffix: "privatizehealthinsurance.net",
		reversed: "ten.ecnarusnihtlaehezitavirp"
	},
	{
		suffix: "quicksytes.com",
		reversed: "moc.setyskciuq"
	},
	{
		suffix: "read-books.org",
		reversed: "gro.skoob-daer"
	},
	{
		suffix: "securitytactics.com",
		reversed: "moc.scitcatytiruces"
	},
	{
		suffix: "serveexchange.com",
		reversed: "moc.egnahcxeevres"
	},
	{
		suffix: "servehumour.com",
		reversed: "moc.ruomuhevres"
	},
	{
		suffix: "servep2p.com",
		reversed: "moc.p2pevres"
	},
	{
		suffix: "servesarcasm.com",
		reversed: "moc.msacrasevres"
	},
	{
		suffix: "stufftoread.com",
		reversed: "moc.daerotffuts"
	},
	{
		suffix: "ufcfan.org",
		reversed: "gro.nafcfu"
	},
	{
		suffix: "unusualperson.com",
		reversed: "moc.nosreplausunu"
	},
	{
		suffix: "workisboring.com",
		reversed: "moc.gnirobsikrow"
	},
	{
		suffix: "3utilities.com",
		reversed: "moc.seitilitu3"
	},
	{
		suffix: "bounceme.net",
		reversed: "ten.emecnuob"
	},
	{
		suffix: "ddns.net",
		reversed: "ten.sndd"
	},
	{
		suffix: "ddnsking.com",
		reversed: "moc.gniksndd"
	},
	{
		suffix: "gotdns.ch",
		reversed: "hc.sndtog"
	},
	{
		suffix: "hopto.org",
		reversed: "gro.otpoh"
	},
	{
		suffix: "myftp.biz",
		reversed: "zib.ptfym"
	},
	{
		suffix: "myftp.org",
		reversed: "gro.ptfym"
	},
	{
		suffix: "myvnc.com",
		reversed: "moc.cnvym"
	},
	{
		suffix: "no-ip.biz",
		reversed: "zib.pi-on"
	},
	{
		suffix: "no-ip.info",
		reversed: "ofni.pi-on"
	},
	{
		suffix: "no-ip.org",
		reversed: "gro.pi-on"
	},
	{
		suffix: "noip.me",
		reversed: "em.pion"
	},
	{
		suffix: "redirectme.net",
		reversed: "ten.emtcerider"
	},
	{
		suffix: "servebeer.com",
		reversed: "moc.reebevres"
	},
	{
		suffix: "serveblog.net",
		reversed: "ten.golbevres"
	},
	{
		suffix: "servecounterstrike.com",
		reversed: "moc.ekirtsretnuocevres"
	},
	{
		suffix: "serveftp.com",
		reversed: "moc.ptfevres"
	},
	{
		suffix: "servegame.com",
		reversed: "moc.emagevres"
	},
	{
		suffix: "servehalflife.com",
		reversed: "moc.efilflahevres"
	},
	{
		suffix: "servehttp.com",
		reversed: "moc.ptthevres"
	},
	{
		suffix: "serveirc.com",
		reversed: "moc.crievres"
	},
	{
		suffix: "serveminecraft.net",
		reversed: "ten.tfarcenimevres"
	},
	{
		suffix: "servemp3.com",
		reversed: "moc.3pmevres"
	},
	{
		suffix: "servepics.com",
		reversed: "moc.scipevres"
	},
	{
		suffix: "servequake.com",
		reversed: "moc.ekauqevres"
	},
	{
		suffix: "sytes.net",
		reversed: "ten.setys"
	},
	{
		suffix: "webhop.me",
		reversed: "em.pohbew"
	},
	{
		suffix: "zapto.org",
		reversed: "gro.otpaz"
	},
	{
		suffix: "stage.nodeart.io",
		reversed: "oi.traedon.egats"
	},
	{
		suffix: "pcloud.host",
		reversed: "tsoh.duolcp"
	},
	{
		suffix: "nyc.mn",
		reversed: "nm.cyn"
	},
	{
		suffix: "static.observableusercontent.com",
		reversed: "moc.tnetnocresuelbavresbo.citats"
	},
	{
		suffix: "cya.gg",
		reversed: "gg.ayc"
	},
	{
		suffix: "omg.lol",
		reversed: "lol.gmo"
	},
	{
		suffix: "cloudycluster.net",
		reversed: "ten.retsulcyduolc"
	},
	{
		suffix: "omniwe.site",
		reversed: "etis.ewinmo"
	},
	{
		suffix: "123hjemmeside.dk",
		reversed: "kd.edisemmejh321"
	},
	{
		suffix: "123hjemmeside.no",
		reversed: "on.edisemmejh321"
	},
	{
		suffix: "123homepage.it",
		reversed: "ti.egapemoh321"
	},
	{
		suffix: "123kotisivu.fi",
		reversed: "if.uvisitok321"
	},
	{
		suffix: "123minsida.se",
		reversed: "es.adisnim321"
	},
	{
		suffix: "123miweb.es",
		reversed: "se.bewim321"
	},
	{
		suffix: "123paginaweb.pt",
		reversed: "tp.bewanigap321"
	},
	{
		suffix: "123sait.ru",
		reversed: "ur.tias321"
	},
	{
		suffix: "123siteweb.fr",
		reversed: "rf.bewetis321"
	},
	{
		suffix: "123webseite.at",
		reversed: "ta.etiesbew321"
	},
	{
		suffix: "123webseite.de",
		reversed: "ed.etiesbew321"
	},
	{
		suffix: "123website.be",
		reversed: "eb.etisbew321"
	},
	{
		suffix: "123website.ch",
		reversed: "hc.etisbew321"
	},
	{
		suffix: "123website.lu",
		reversed: "ul.etisbew321"
	},
	{
		suffix: "123website.nl",
		reversed: "ln.etisbew321"
	},
	{
		suffix: "service.one",
		reversed: "eno.ecivres"
	},
	{
		suffix: "simplesite.com",
		reversed: "moc.etiselpmis"
	},
	{
		suffix: "simplesite.com.br",
		reversed: "rb.moc.etiselpmis"
	},
	{
		suffix: "simplesite.gr",
		reversed: "rg.etiselpmis"
	},
	{
		suffix: "simplesite.pl",
		reversed: "lp.etiselpmis"
	},
	{
		suffix: "nid.io",
		reversed: "oi.din"
	},
	{
		suffix: "opensocial.site",
		reversed: "etis.laicosnepo"
	},
	{
		suffix: "opencraft.hosting",
		reversed: "gnitsoh.tfarcnepo"
	},
	{
		suffix: "orsites.com",
		reversed: "moc.setisro"
	},
	{
		suffix: "operaunite.com",
		reversed: "moc.etinuarepo"
	},
	{
		suffix: "tech.orange",
		reversed: "egnaro.hcet"
	},
	{
		suffix: "authgear-staging.com",
		reversed: "moc.gnigats-raeghtua"
	},
	{
		suffix: "authgearapps.com",
		reversed: "moc.spparaeghtua"
	},
	{
		suffix: "skygearapp.com",
		reversed: "moc.pparaegyks"
	},
	{
		suffix: "outsystemscloud.com",
		reversed: "moc.duolcsmetsystuo"
	},
	{
		suffix: "*.webpaas.ovh.net",
		reversed: "ten.hvo.saapbew"
	},
	{
		suffix: "*.hosting.ovh.net",
		reversed: "ten.hvo.gnitsoh"
	},
	{
		suffix: "ownprovider.com",
		reversed: "moc.redivorpnwo"
	},
	{
		suffix: "own.pm",
		reversed: "mp.nwo"
	},
	{
		suffix: "*.owo.codes",
		reversed: "sedoc.owo"
	},
	{
		suffix: "ox.rs",
		reversed: "sr.xo"
	},
	{
		suffix: "oy.lc",
		reversed: "cl.yo"
	},
	{
		suffix: "pgfog.com",
		reversed: "moc.gofgp"
	},
	{
		suffix: "pagefrontapp.com",
		reversed: "moc.ppatnorfegap"
	},
	{
		suffix: "pagexl.com",
		reversed: "moc.lxegap"
	},
	{
		suffix: "*.paywhirl.com",
		reversed: "moc.lrihwyap"
	},
	{
		suffix: "bar0.net",
		reversed: "ten.0rab"
	},
	{
		suffix: "bar1.net",
		reversed: "ten.1rab"
	},
	{
		suffix: "bar2.net",
		reversed: "ten.2rab"
	},
	{
		suffix: "rdv.to",
		reversed: "ot.vdr"
	},
	{
		suffix: "art.pl",
		reversed: "lp.tra"
	},
	{
		suffix: "gliwice.pl",
		reversed: "lp.eciwilg"
	},
	{
		suffix: "krakow.pl",
		reversed: "lp.wokark"
	},
	{
		suffix: "poznan.pl",
		reversed: "lp.nanzop"
	},
	{
		suffix: "wroc.pl",
		reversed: "lp.corw"
	},
	{
		suffix: "zakopane.pl",
		reversed: "lp.enapokaz"
	},
	{
		suffix: "pantheonsite.io",
		reversed: "oi.etisnoehtnap"
	},
	{
		suffix: "gotpantheon.com",
		reversed: "moc.noehtnaptog"
	},
	{
		suffix: "mypep.link",
		reversed: "knil.pepym"
	},
	{
		suffix: "perspecta.cloud",
		reversed: "duolc.atcepsrep"
	},
	{
		suffix: "lk3.ru",
		reversed: "ur.3kl"
	},
	{
		suffix: "on-web.fr",
		reversed: "rf.bew-no"
	},
	{
		suffix: "bc.platform.sh",
		reversed: "hs.mroftalp.cb"
	},
	{
		suffix: "ent.platform.sh",
		reversed: "hs.mroftalp.tne"
	},
	{
		suffix: "eu.platform.sh",
		reversed: "hs.mroftalp.ue"
	},
	{
		suffix: "us.platform.sh",
		reversed: "hs.mroftalp.su"
	},
	{
		suffix: "*.platformsh.site",
		reversed: "etis.hsmroftalp"
	},
	{
		suffix: "*.tst.site",
		reversed: "etis.tst"
	},
	{
		suffix: "platter-app.com",
		reversed: "moc.ppa-rettalp"
	},
	{
		suffix: "platter-app.dev",
		reversed: "ved.ppa-rettalp"
	},
	{
		suffix: "platterp.us",
		reversed: "su.prettalp"
	},
	{
		suffix: "pdns.page",
		reversed: "egap.sndp"
	},
	{
		suffix: "plesk.page",
		reversed: "egap.kselp"
	},
	{
		suffix: "pleskns.com",
		reversed: "moc.snkselp"
	},
	{
		suffix: "dyn53.io",
		reversed: "oi.35nyd"
	},
	{
		suffix: "onporter.run",
		reversed: "nur.retropno"
	},
	{
		suffix: "co.bn",
		reversed: "nb.oc"
	},
	{
		suffix: "postman-echo.com",
		reversed: "moc.ohce-namtsop"
	},
	{
		suffix: "pstmn.io",
		reversed: "oi.nmtsp"
	},
	{
		suffix: "mock.pstmn.io",
		reversed: "oi.nmtsp.kcom"
	},
	{
		suffix: "httpbin.org",
		reversed: "gro.nibptth"
	},
	{
		suffix: "prequalifyme.today",
		reversed: "yadot.emyfilauqerp"
	},
	{
		suffix: "xen.prgmr.com",
		reversed: "moc.rmgrp.nex"
	},
	{
		suffix: "priv.at",
		reversed: "ta.virp"
	},
	{
		suffix: "prvcy.page",
		reversed: "egap.ycvrp"
	},
	{
		suffix: "*.dweb.link",
		reversed: "knil.bewd"
	},
	{
		suffix: "protonet.io",
		reversed: "oi.tenotorp"
	},
	{
		suffix: "chirurgiens-dentistes-en-france.fr",
		reversed: "rf.ecnarf-ne-setsitned-sneigrurihc"
	},
	{
		suffix: "byen.site",
		reversed: "etis.neyb"
	},
	{
		suffix: "pubtls.org",
		reversed: "gro.sltbup"
	},
	{
		suffix: "pythonanywhere.com",
		reversed: "moc.erehwynanohtyp"
	},
	{
		suffix: "eu.pythonanywhere.com",
		reversed: "moc.erehwynanohtyp.ue"
	},
	{
		suffix: "qoto.io",
		reversed: "oi.otoq"
	},
	{
		suffix: "qualifioapp.com",
		reversed: "moc.ppaoifilauq"
	},
	{
		suffix: "ladesk.com",
		reversed: "moc.ksedal"
	},
	{
		suffix: "qbuser.com",
		reversed: "moc.resubq"
	},
	{
		suffix: "cloudsite.builders",
		reversed: "sredliub.etisduolc"
	},
	{
		suffix: "instances.spawn.cc",
		reversed: "cc.nwaps.secnatsni"
	},
	{
		suffix: "instantcloud.cn",
		reversed: "nc.duolctnatsni"
	},
	{
		suffix: "ras.ru",
		reversed: "ur.sar"
	},
	{
		suffix: "qa2.com",
		reversed: "moc.2aq"
	},
	{
		suffix: "qcx.io",
		reversed: "oi.xcq"
	},
	{
		suffix: "*.sys.qcx.io",
		reversed: "oi.xcq.sys"
	},
	{
		suffix: "dev-myqnapcloud.com",
		reversed: "moc.duolcpanqym-ved"
	},
	{
		suffix: "alpha-myqnapcloud.com",
		reversed: "moc.duolcpanqym-ahpla"
	},
	{
		suffix: "myqnapcloud.com",
		reversed: "moc.duolcpanqym"
	},
	{
		suffix: "*.quipelements.com",
		reversed: "moc.stnemelepiuq"
	},
	{
		suffix: "vapor.cloud",
		reversed: "duolc.ropav"
	},
	{
		suffix: "vaporcloud.io",
		reversed: "oi.duolcropav"
	},
	{
		suffix: "rackmaze.com",
		reversed: "moc.ezamkcar"
	},
	{
		suffix: "rackmaze.net",
		reversed: "ten.ezamkcar"
	},
	{
		suffix: "g.vbrplsbx.io",
		reversed: "oi.xbslprbv.g"
	},
	{
		suffix: "*.on-k3s.io",
		reversed: "oi.s3k-no"
	},
	{
		suffix: "*.on-rancher.cloud",
		reversed: "duolc.rehcnar-no"
	},
	{
		suffix: "*.on-rio.io",
		reversed: "oi.oir-no"
	},
	{
		suffix: "readthedocs.io",
		reversed: "oi.scodehtdaer"
	},
	{
		suffix: "rhcloud.com",
		reversed: "moc.duolchr"
	},
	{
		suffix: "app.render.com",
		reversed: "moc.redner.ppa"
	},
	{
		suffix: "onrender.com",
		reversed: "moc.rednerno"
	},
	{
		suffix: "firewalledreplit.co",
		reversed: "oc.tilperdellawerif"
	},
	{
		suffix: "id.firewalledreplit.co",
		reversed: "oc.tilperdellawerif.di"
	},
	{
		suffix: "repl.co",
		reversed: "oc.lper"
	},
	{
		suffix: "id.repl.co",
		reversed: "oc.lper.di"
	},
	{
		suffix: "repl.run",
		reversed: "nur.lper"
	},
	{
		suffix: "resindevice.io",
		reversed: "oi.ecivedniser"
	},
	{
		suffix: "devices.resinstaging.io",
		reversed: "oi.gnigatsniser.secived"
	},
	{
		suffix: "hzc.io",
		reversed: "oi.czh"
	},
	{
		suffix: "wellbeingzone.eu",
		reversed: "ue.enozgniebllew"
	},
	{
		suffix: "wellbeingzone.co.uk",
		reversed: "ku.oc.enozgniebllew"
	},
	{
		suffix: "adimo.co.uk",
		reversed: "ku.oc.omida"
	},
	{
		suffix: "itcouldbewor.se",
		reversed: "es.rowebdluocti"
	},
	{
		suffix: "git-pages.rit.edu",
		reversed: "ude.tir.segap-tig"
	},
	{
		suffix: "rocky.page",
		reversed: "egap.ykcor"
	},
	{
		suffix: "биз.рус",
		reversed: "fca1p--nx.cma09--nx"
	},
	{
		suffix: "ком.рус",
		reversed: "fca1p--nx.fea1j--nx"
	},
	{
		suffix: "крым.рус",
		reversed: "fca1p--nx.b8lea1j--nx"
	},
	{
		suffix: "мир.рус",
		reversed: "fca1p--nx.nha1h--nx"
	},
	{
		suffix: "мск.рус",
		reversed: "fca1p--nx.pda1j--nx"
	},
	{
		suffix: "орг.рус",
		reversed: "fca1p--nx.gva1c--nx"
	},
	{
		suffix: "самара.рус",
		reversed: "fca1p--nx.cavc0aaa08--nx"
	},
	{
		suffix: "сочи.рус",
		reversed: "fca1p--nx.zila1h--nx"
	},
	{
		suffix: "спб.рус",
		reversed: "fca1p--nx.fa1a09--nx"
	},
	{
		suffix: "я.рус",
		reversed: "fca1p--nx.a14--nx"
	},
	{
		suffix: "180r.com",
		reversed: "moc.r081"
	},
	{
		suffix: "dojin.com",
		reversed: "moc.nijod"
	},
	{
		suffix: "sakuratan.com",
		reversed: "moc.natarukas"
	},
	{
		suffix: "sakuraweb.com",
		reversed: "moc.bewarukas"
	},
	{
		suffix: "x0.com",
		reversed: "moc.0x"
	},
	{
		suffix: "2-d.jp",
		reversed: "pj.d-2"
	},
	{
		suffix: "bona.jp",
		reversed: "pj.anob"
	},
	{
		suffix: "crap.jp",
		reversed: "pj.parc"
	},
	{
		suffix: "daynight.jp",
		reversed: "pj.thginyad"
	},
	{
		suffix: "eek.jp",
		reversed: "pj.kee"
	},
	{
		suffix: "flop.jp",
		reversed: "pj.polf"
	},
	{
		suffix: "halfmoon.jp",
		reversed: "pj.noomflah"
	},
	{
		suffix: "jeez.jp",
		reversed: "pj.zeej"
	},
	{
		suffix: "matrix.jp",
		reversed: "pj.xirtam"
	},
	{
		suffix: "mimoza.jp",
		reversed: "pj.azomim"
	},
	{
		suffix: "ivory.ne.jp",
		reversed: "pj.en.yrovi"
	},
	{
		suffix: "mail-box.ne.jp",
		reversed: "pj.en.xob-liam"
	},
	{
		suffix: "mints.ne.jp",
		reversed: "pj.en.stnim"
	},
	{
		suffix: "mokuren.ne.jp",
		reversed: "pj.en.nerukom"
	},
	{
		suffix: "opal.ne.jp",
		reversed: "pj.en.lapo"
	},
	{
		suffix: "sakura.ne.jp",
		reversed: "pj.en.arukas"
	},
	{
		suffix: "sumomo.ne.jp",
		reversed: "pj.en.omomus"
	},
	{
		suffix: "topaz.ne.jp",
		reversed: "pj.en.zapot"
	},
	{
		suffix: "netgamers.jp",
		reversed: "pj.sremagten"
	},
	{
		suffix: "nyanta.jp",
		reversed: "pj.atnayn"
	},
	{
		suffix: "o0o0.jp",
		reversed: "pj.0o0o"
	},
	{
		suffix: "rdy.jp",
		reversed: "pj.ydr"
	},
	{
		suffix: "rgr.jp",
		reversed: "pj.rgr"
	},
	{
		suffix: "rulez.jp",
		reversed: "pj.zelur"
	},
	{
		suffix: "s3.isk01.sakurastorage.jp",
		reversed: "pj.egarotsarukas.10ksi.3s"
	},
	{
		suffix: "s3.isk02.sakurastorage.jp",
		reversed: "pj.egarotsarukas.20ksi.3s"
	},
	{
		suffix: "saloon.jp",
		reversed: "pj.noolas"
	},
	{
		suffix: "sblo.jp",
		reversed: "pj.olbs"
	},
	{
		suffix: "skr.jp",
		reversed: "pj.rks"
	},
	{
		suffix: "tank.jp",
		reversed: "pj.knat"
	},
	{
		suffix: "uh-oh.jp",
		reversed: "pj.ho-hu"
	},
	{
		suffix: "undo.jp",
		reversed: "pj.odnu"
	},
	{
		suffix: "rs.webaccel.jp",
		reversed: "pj.leccabew.sr"
	},
	{
		suffix: "user.webaccel.jp",
		reversed: "pj.leccabew.resu"
	},
	{
		suffix: "websozai.jp",
		reversed: "pj.iazosbew"
	},
	{
		suffix: "xii.jp",
		reversed: "pj.iix"
	},
	{
		suffix: "squares.net",
		reversed: "ten.serauqs"
	},
	{
		suffix: "jpn.org",
		reversed: "gro.npj"
	},
	{
		suffix: "kirara.st",
		reversed: "ts.ararik"
	},
	{
		suffix: "x0.to",
		reversed: "ot.0x"
	},
	{
		suffix: "from.tv",
		reversed: "vt.morf"
	},
	{
		suffix: "sakura.tv",
		reversed: "vt.arukas"
	},
	{
		suffix: "*.builder.code.com",
		reversed: "moc.edoc.redliub"
	},
	{
		suffix: "*.dev-builder.code.com",
		reversed: "moc.edoc.redliub-ved"
	},
	{
		suffix: "*.stg-builder.code.com",
		reversed: "moc.edoc.redliub-gts"
	},
	{
		suffix: "sandcats.io",
		reversed: "oi.stacdnas"
	},
	{
		suffix: "logoip.de",
		reversed: "ed.piogol"
	},
	{
		suffix: "logoip.com",
		reversed: "moc.piogol"
	},
	{
		suffix: "fr-par-1.baremetal.scw.cloud",
		reversed: "duolc.wcs.latemerab.1-rap-rf"
	},
	{
		suffix: "fr-par-2.baremetal.scw.cloud",
		reversed: "duolc.wcs.latemerab.2-rap-rf"
	},
	{
		suffix: "nl-ams-1.baremetal.scw.cloud",
		reversed: "duolc.wcs.latemerab.1-sma-ln"
	},
	{
		suffix: "fnc.fr-par.scw.cloud",
		reversed: "duolc.wcs.rap-rf.cnf"
	},
	{
		suffix: "functions.fnc.fr-par.scw.cloud",
		reversed: "duolc.wcs.rap-rf.cnf.snoitcnuf"
	},
	{
		suffix: "k8s.fr-par.scw.cloud",
		reversed: "duolc.wcs.rap-rf.s8k"
	},
	{
		suffix: "nodes.k8s.fr-par.scw.cloud",
		reversed: "duolc.wcs.rap-rf.s8k.sedon"
	},
	{
		suffix: "s3.fr-par.scw.cloud",
		reversed: "duolc.wcs.rap-rf.3s"
	},
	{
		suffix: "s3-website.fr-par.scw.cloud",
		reversed: "duolc.wcs.rap-rf.etisbew-3s"
	},
	{
		suffix: "whm.fr-par.scw.cloud",
		reversed: "duolc.wcs.rap-rf.mhw"
	},
	{
		suffix: "priv.instances.scw.cloud",
		reversed: "duolc.wcs.secnatsni.virp"
	},
	{
		suffix: "pub.instances.scw.cloud",
		reversed: "duolc.wcs.secnatsni.bup"
	},
	{
		suffix: "k8s.scw.cloud",
		reversed: "duolc.wcs.s8k"
	},
	{
		suffix: "k8s.nl-ams.scw.cloud",
		reversed: "duolc.wcs.sma-ln.s8k"
	},
	{
		suffix: "nodes.k8s.nl-ams.scw.cloud",
		reversed: "duolc.wcs.sma-ln.s8k.sedon"
	},
	{
		suffix: "s3.nl-ams.scw.cloud",
		reversed: "duolc.wcs.sma-ln.3s"
	},
	{
		suffix: "s3-website.nl-ams.scw.cloud",
		reversed: "duolc.wcs.sma-ln.etisbew-3s"
	},
	{
		suffix: "whm.nl-ams.scw.cloud",
		reversed: "duolc.wcs.sma-ln.mhw"
	},
	{
		suffix: "k8s.pl-waw.scw.cloud",
		reversed: "duolc.wcs.waw-lp.s8k"
	},
	{
		suffix: "nodes.k8s.pl-waw.scw.cloud",
		reversed: "duolc.wcs.waw-lp.s8k.sedon"
	},
	{
		suffix: "s3.pl-waw.scw.cloud",
		reversed: "duolc.wcs.waw-lp.3s"
	},
	{
		suffix: "s3-website.pl-waw.scw.cloud",
		reversed: "duolc.wcs.waw-lp.etisbew-3s"
	},
	{
		suffix: "scalebook.scw.cloud",
		reversed: "duolc.wcs.koobelacs"
	},
	{
		suffix: "smartlabeling.scw.cloud",
		reversed: "duolc.wcs.gnilebaltrams"
	},
	{
		suffix: "dedibox.fr",
		reversed: "rf.xobided"
	},
	{
		suffix: "schokokeks.net",
		reversed: "ten.skekokohcs"
	},
	{
		suffix: "gov.scot",
		reversed: "tocs.vog"
	},
	{
		suffix: "service.gov.scot",
		reversed: "tocs.vog.ecivres"
	},
	{
		suffix: "scrysec.com",
		reversed: "moc.cesyrcs"
	},
	{
		suffix: "firewall-gateway.com",
		reversed: "moc.yawetag-llawerif"
	},
	{
		suffix: "firewall-gateway.de",
		reversed: "ed.yawetag-llawerif"
	},
	{
		suffix: "my-gateway.de",
		reversed: "ed.yawetag-ym"
	},
	{
		suffix: "my-router.de",
		reversed: "ed.retuor-ym"
	},
	{
		suffix: "spdns.de",
		reversed: "ed.sndps"
	},
	{
		suffix: "spdns.eu",
		reversed: "ue.sndps"
	},
	{
		suffix: "firewall-gateway.net",
		reversed: "ten.yawetag-llawerif"
	},
	{
		suffix: "my-firewall.org",
		reversed: "gro.llawerif-ym"
	},
	{
		suffix: "myfirewall.org",
		reversed: "gro.llawerifym"
	},
	{
		suffix: "spdns.org",
		reversed: "gro.sndps"
	},
	{
		suffix: "seidat.net",
		reversed: "ten.tadies"
	},
	{
		suffix: "sellfy.store",
		reversed: "erots.yflles"
	},
	{
		suffix: "senseering.net",
		reversed: "ten.gnireesnes"
	},
	{
		suffix: "minisite.ms",
		reversed: "sm.etisinim"
	},
	{
		suffix: "magnet.page",
		reversed: "egap.tengam"
	},
	{
		suffix: "biz.ua",
		reversed: "au.zib"
	},
	{
		suffix: "co.ua",
		reversed: "au.oc"
	},
	{
		suffix: "pp.ua",
		reversed: "au.pp"
	},
	{
		suffix: "shiftcrypto.dev",
		reversed: "ved.otpyrctfihs"
	},
	{
		suffix: "shiftcrypto.io",
		reversed: "oi.otpyrctfihs"
	},
	{
		suffix: "shiftedit.io",
		reversed: "oi.tidetfihs"
	},
	{
		suffix: "myshopblocks.com",
		reversed: "moc.skcolbpohsym"
	},
	{
		suffix: "myshopify.com",
		reversed: "moc.yfipohsym"
	},
	{
		suffix: "shopitsite.com",
		reversed: "moc.etistipohs"
	},
	{
		suffix: "shopware.store",
		reversed: "erots.erawpohs"
	},
	{
		suffix: "mo-siemens.io",
		reversed: "oi.snemeis-om"
	},
	{
		suffix: "1kapp.com",
		reversed: "moc.ppak1"
	},
	{
		suffix: "appchizi.com",
		reversed: "moc.izihcppa"
	},
	{
		suffix: "applinzi.com",
		reversed: "moc.iznilppa"
	},
	{
		suffix: "sinaapp.com",
		reversed: "moc.ppaanis"
	},
	{
		suffix: "vipsinaapp.com",
		reversed: "moc.ppaanispiv"
	},
	{
		suffix: "siteleaf.net",
		reversed: "ten.faeletis"
	},
	{
		suffix: "bounty-full.com",
		reversed: "moc.lluf-ytnuob"
	},
	{
		suffix: "alpha.bounty-full.com",
		reversed: "moc.lluf-ytnuob.ahpla"
	},
	{
		suffix: "beta.bounty-full.com",
		reversed: "moc.lluf-ytnuob.ateb"
	},
	{
		suffix: "small-web.org",
		reversed: "gro.bew-llams"
	},
	{
		suffix: "vp4.me",
		reversed: "em.4pv"
	},
	{
		suffix: "snowflake.app",
		reversed: "ppa.ekalfwons"
	},
	{
		suffix: "privatelink.snowflake.app",
		reversed: "ppa.ekalfwons.kniletavirp"
	},
	{
		suffix: "streamlit.app",
		reversed: "ppa.tilmaerts"
	},
	{
		suffix: "streamlitapp.com",
		reversed: "moc.ppatilmaerts"
	},
	{
		suffix: "try-snowplow.com",
		reversed: "moc.wolpwons-yrt"
	},
	{
		suffix: "srht.site",
		reversed: "etis.thrs"
	},
	{
		suffix: "stackhero-network.com",
		reversed: "moc.krowten-orehkcats"
	},
	{
		suffix: "musician.io",
		reversed: "oi.naicisum"
	},
	{
		suffix: "novecore.site",
		reversed: "etis.erocevon"
	},
	{
		suffix: "static.land",
		reversed: "dnal.citats"
	},
	{
		suffix: "dev.static.land",
		reversed: "dnal.citats.ved"
	},
	{
		suffix: "sites.static.land",
		reversed: "dnal.citats.setis"
	},
	{
		suffix: "storebase.store",
		reversed: "erots.esaberots"
	},
	{
		suffix: "vps-host.net",
		reversed: "ten.tsoh-spv"
	},
	{
		suffix: "atl.jelastic.vps-host.net",
		reversed: "ten.tsoh-spv.citsalej.lta"
	},
	{
		suffix: "njs.jelastic.vps-host.net",
		reversed: "ten.tsoh-spv.citsalej.sjn"
	},
	{
		suffix: "ric.jelastic.vps-host.net",
		reversed: "ten.tsoh-spv.citsalej.cir"
	},
	{
		suffix: "playstation-cloud.com",
		reversed: "moc.duolc-noitatsyalp"
	},
	{
		suffix: "apps.lair.io",
		reversed: "oi.rial.sppa"
	},
	{
		suffix: "*.stolos.io",
		reversed: "oi.solots"
	},
	{
		suffix: "spacekit.io",
		reversed: "oi.tikecaps"
	},
	{
		suffix: "customer.speedpartner.de",
		reversed: "ed.rentrapdeeps.remotsuc"
	},
	{
		suffix: "myspreadshop.at",
		reversed: "ta.pohsdaerpsym"
	},
	{
		suffix: "myspreadshop.com.au",
		reversed: "ua.moc.pohsdaerpsym"
	},
	{
		suffix: "myspreadshop.be",
		reversed: "eb.pohsdaerpsym"
	},
	{
		suffix: "myspreadshop.ca",
		reversed: "ac.pohsdaerpsym"
	},
	{
		suffix: "myspreadshop.ch",
		reversed: "hc.pohsdaerpsym"
	},
	{
		suffix: "myspreadshop.com",
		reversed: "moc.pohsdaerpsym"
	},
	{
		suffix: "myspreadshop.de",
		reversed: "ed.pohsdaerpsym"
	},
	{
		suffix: "myspreadshop.dk",
		reversed: "kd.pohsdaerpsym"
	},
	{
		suffix: "myspreadshop.es",
		reversed: "se.pohsdaerpsym"
	},
	{
		suffix: "myspreadshop.fi",
		reversed: "if.pohsdaerpsym"
	},
	{
		suffix: "myspreadshop.fr",
		reversed: "rf.pohsdaerpsym"
	},
	{
		suffix: "myspreadshop.ie",
		reversed: "ei.pohsdaerpsym"
	},
	{
		suffix: "myspreadshop.it",
		reversed: "ti.pohsdaerpsym"
	},
	{
		suffix: "myspreadshop.net",
		reversed: "ten.pohsdaerpsym"
	},
	{
		suffix: "myspreadshop.nl",
		reversed: "ln.pohsdaerpsym"
	},
	{
		suffix: "myspreadshop.no",
		reversed: "on.pohsdaerpsym"
	},
	{
		suffix: "myspreadshop.pl",
		reversed: "lp.pohsdaerpsym"
	},
	{
		suffix: "myspreadshop.se",
		reversed: "es.pohsdaerpsym"
	},
	{
		suffix: "myspreadshop.co.uk",
		reversed: "ku.oc.pohsdaerpsym"
	},
	{
		suffix: "api.stdlib.com",
		reversed: "moc.bildts.ipa"
	},
	{
		suffix: "storj.farm",
		reversed: "mraf.jrots"
	},
	{
		suffix: "utwente.io",
		reversed: "oi.etnewtu"
	},
	{
		suffix: "soc.srcf.net",
		reversed: "ten.fcrs.cos"
	},
	{
		suffix: "user.srcf.net",
		reversed: "ten.fcrs.resu"
	},
	{
		suffix: "temp-dns.com",
		reversed: "moc.snd-pmet"
	},
	{
		suffix: "supabase.co",
		reversed: "oc.esabapus"
	},
	{
		suffix: "supabase.in",
		reversed: "ni.esabapus"
	},
	{
		suffix: "supabase.net",
		reversed: "ten.esabapus"
	},
	{
		suffix: "su.paba.se",
		reversed: "es.abap.us"
	},
	{
		suffix: "*.s5y.io",
		reversed: "oi.y5s"
	},
	{
		suffix: "*.sensiosite.cloud",
		reversed: "duolc.etisoisnes"
	},
	{
		suffix: "syncloud.it",
		reversed: "ti.duolcnys"
	},
	{
		suffix: "dscloud.biz",
		reversed: "zib.duolcsd"
	},
	{
		suffix: "direct.quickconnect.cn",
		reversed: "nc.tcennockciuq.tcerid"
	},
	{
		suffix: "dsmynas.com",
		reversed: "moc.sanymsd"
	},
	{
		suffix: "familyds.com",
		reversed: "moc.sdylimaf"
	},
	{
		suffix: "diskstation.me",
		reversed: "em.noitatsksid"
	},
	{
		suffix: "dscloud.me",
		reversed: "em.duolcsd"
	},
	{
		suffix: "i234.me",
		reversed: "em.432i"
	},
	{
		suffix: "myds.me",
		reversed: "em.sdym"
	},
	{
		suffix: "synology.me",
		reversed: "em.ygolonys"
	},
	{
		suffix: "dscloud.mobi",
		reversed: "ibom.duolcsd"
	},
	{
		suffix: "dsmynas.net",
		reversed: "ten.sanymsd"
	},
	{
		suffix: "familyds.net",
		reversed: "ten.sdylimaf"
	},
	{
		suffix: "dsmynas.org",
		reversed: "gro.sanymsd"
	},
	{
		suffix: "familyds.org",
		reversed: "gro.sdylimaf"
	},
	{
		suffix: "vpnplus.to",
		reversed: "ot.sulpnpv"
	},
	{
		suffix: "direct.quickconnect.to",
		reversed: "ot.tcennockciuq.tcerid"
	},
	{
		suffix: "tabitorder.co.il",
		reversed: "li.oc.redrotibat"
	},
	{
		suffix: "mytabit.co.il",
		reversed: "li.oc.tibatym"
	},
	{
		suffix: "mytabit.com",
		reversed: "moc.tibatym"
	},
	{
		suffix: "taifun-dns.de",
		reversed: "ed.snd-nufiat"
	},
	{
		suffix: "beta.tailscale.net",
		reversed: "ten.elacsliat.ateb"
	},
	{
		suffix: "ts.net",
		reversed: "ten.st"
	},
	{
		suffix: "gda.pl",
		reversed: "lp.adg"
	},
	{
		suffix: "gdansk.pl",
		reversed: "lp.ksnadg"
	},
	{
		suffix: "gdynia.pl",
		reversed: "lp.ainydg"
	},
	{
		suffix: "med.pl",
		reversed: "lp.dem"
	},
	{
		suffix: "sopot.pl",
		reversed: "lp.topos"
	},
	{
		suffix: "site.tb-hosting.com",
		reversed: "moc.gnitsoh-bt.etis"
	},
	{
		suffix: "edugit.io",
		reversed: "oi.tigude"
	},
	{
		suffix: "s3.teckids.org",
		reversed: "gro.sdikcet.3s"
	},
	{
		suffix: "telebit.app",
		reversed: "ppa.tibelet"
	},
	{
		suffix: "telebit.io",
		reversed: "oi.tibelet"
	},
	{
		suffix: "*.telebit.xyz",
		reversed: "zyx.tibelet"
	},
	{
		suffix: "*.firenet.ch",
		reversed: "hc.tenerif"
	},
	{
		suffix: "*.svc.firenet.ch",
		reversed: "hc.tenerif.cvs"
	},
	{
		suffix: "reservd.com",
		reversed: "moc.dvreser"
	},
	{
		suffix: "thingdustdata.com",
		reversed: "moc.atadtsudgniht"
	},
	{
		suffix: "cust.dev.thingdust.io",
		reversed: "oi.tsudgniht.ved.tsuc"
	},
	{
		suffix: "cust.disrec.thingdust.io",
		reversed: "oi.tsudgniht.cersid.tsuc"
	},
	{
		suffix: "cust.prod.thingdust.io",
		reversed: "oi.tsudgniht.dorp.tsuc"
	},
	{
		suffix: "cust.testing.thingdust.io",
		reversed: "oi.tsudgniht.gnitset.tsuc"
	},
	{
		suffix: "reservd.dev.thingdust.io",
		reversed: "oi.tsudgniht.ved.dvreser"
	},
	{
		suffix: "reservd.disrec.thingdust.io",
		reversed: "oi.tsudgniht.cersid.dvreser"
	},
	{
		suffix: "reservd.testing.thingdust.io",
		reversed: "oi.tsudgniht.gnitset.dvreser"
	},
	{
		suffix: "tickets.io",
		reversed: "oi.stekcit"
	},
	{
		suffix: "arvo.network",
		reversed: "krowten.ovra"
	},
	{
		suffix: "azimuth.network",
		reversed: "krowten.htumiza"
	},
	{
		suffix: "tlon.network",
		reversed: "krowten.nolt"
	},
	{
		suffix: "torproject.net",
		reversed: "ten.tcejorprot"
	},
	{
		suffix: "pages.torproject.net",
		reversed: "ten.tcejorprot.segap"
	},
	{
		suffix: "bloxcms.com",
		reversed: "moc.smcxolb"
	},
	{
		suffix: "townnews-staging.com",
		reversed: "moc.gnigats-swennwot"
	},
	{
		suffix: "12hp.at",
		reversed: "ta.ph21"
	},
	{
		suffix: "2ix.at",
		reversed: "ta.xi2"
	},
	{
		suffix: "4lima.at",
		reversed: "ta.amil4"
	},
	{
		suffix: "lima-city.at",
		reversed: "ta.ytic-amil"
	},
	{
		suffix: "12hp.ch",
		reversed: "hc.ph21"
	},
	{
		suffix: "2ix.ch",
		reversed: "hc.xi2"
	},
	{
		suffix: "4lima.ch",
		reversed: "hc.amil4"
	},
	{
		suffix: "lima-city.ch",
		reversed: "hc.ytic-amil"
	},
	{
		suffix: "trafficplex.cloud",
		reversed: "duolc.xelpciffart"
	},
	{
		suffix: "de.cool",
		reversed: "looc.ed"
	},
	{
		suffix: "12hp.de",
		reversed: "ed.ph21"
	},
	{
		suffix: "2ix.de",
		reversed: "ed.xi2"
	},
	{
		suffix: "4lima.de",
		reversed: "ed.amil4"
	},
	{
		suffix: "lima-city.de",
		reversed: "ed.ytic-amil"
	},
	{
		suffix: "1337.pictures",
		reversed: "serutcip.7331"
	},
	{
		suffix: "clan.rip",
		reversed: "pir.nalc"
	},
	{
		suffix: "lima-city.rocks",
		reversed: "skcor.ytic-amil"
	},
	{
		suffix: "webspace.rocks",
		reversed: "skcor.ecapsbew"
	},
	{
		suffix: "lima.zone",
		reversed: "enoz.amil"
	},
	{
		suffix: "*.transurl.be",
		reversed: "eb.lrusnart"
	},
	{
		suffix: "*.transurl.eu",
		reversed: "ue.lrusnart"
	},
	{
		suffix: "*.transurl.nl",
		reversed: "ln.lrusnart"
	},
	{
		suffix: "site.transip.me",
		reversed: "em.pisnart.etis"
	},
	{
		suffix: "tuxfamily.org",
		reversed: "gro.ylimafxut"
	},
	{
		suffix: "dd-dns.de",
		reversed: "ed.snd-dd"
	},
	{
		suffix: "diskstation.eu",
		reversed: "ue.noitatsksid"
	},
	{
		suffix: "diskstation.org",
		reversed: "gro.noitatsksid"
	},
	{
		suffix: "dray-dns.de",
		reversed: "ed.snd-yard"
	},
	{
		suffix: "draydns.de",
		reversed: "ed.sndyard"
	},
	{
		suffix: "dyn-vpn.de",
		reversed: "ed.npv-nyd"
	},
	{
		suffix: "dynvpn.de",
		reversed: "ed.npvnyd"
	},
	{
		suffix: "mein-vigor.de",
		reversed: "ed.rogiv-niem"
	},
	{
		suffix: "my-vigor.de",
		reversed: "ed.rogiv-ym"
	},
	{
		suffix: "my-wan.de",
		reversed: "ed.naw-ym"
	},
	{
		suffix: "syno-ds.de",
		reversed: "ed.sd-onys"
	},
	{
		suffix: "synology-diskstation.de",
		reversed: "ed.noitatsksid-ygolonys"
	},
	{
		suffix: "synology-ds.de",
		reversed: "ed.sd-ygolonys"
	},
	{
		suffix: "typedream.app",
		reversed: "ppa.maerdepyt"
	},
	{
		suffix: "pro.typeform.com",
		reversed: "moc.mrofepyt.orp"
	},
	{
		suffix: "uber.space",
		reversed: "ecaps.rebu"
	},
	{
		suffix: "*.uberspace.de",
		reversed: "ed.ecapsrebu"
	},
	{
		suffix: "hk.com",
		reversed: "moc.kh"
	},
	{
		suffix: "hk.org",
		reversed: "gro.kh"
	},
	{
		suffix: "ltd.hk",
		reversed: "kh.dtl"
	},
	{
		suffix: "inc.hk",
		reversed: "kh.cni"
	},
	{
		suffix: "it.com",
		reversed: "moc.ti"
	},
	{
		suffix: "name.pm",
		reversed: "mp.eman"
	},
	{
		suffix: "sch.tf",
		reversed: "ft.hcs"
	},
	{
		suffix: "biz.wf",
		reversed: "fw.zib"
	},
	{
		suffix: "sch.wf",
		reversed: "fw.hcs"
	},
	{
		suffix: "org.yt",
		reversed: "ty.gro"
	},
	{
		suffix: "virtualuser.de",
		reversed: "ed.resulautriv"
	},
	{
		suffix: "virtual-user.de",
		reversed: "ed.resu-lautriv"
	},
	{
		suffix: "upli.io",
		reversed: "oi.ilpu"
	},
	{
		suffix: "urown.cloud",
		reversed: "duolc.nworu"
	},
	{
		suffix: "dnsupdate.info",
		reversed: "ofni.etadpusnd"
	},
	{
		suffix: "lib.de.us",
		reversed: "su.ed.bil"
	},
	{
		suffix: "2038.io",
		reversed: "oi.8302"
	},
	{
		suffix: "vercel.app",
		reversed: "ppa.lecrev"
	},
	{
		suffix: "vercel.dev",
		reversed: "ved.lecrev"
	},
	{
		suffix: "now.sh",
		reversed: "hs.won"
	},
	{
		suffix: "router.management",
		reversed: "tnemeganam.retuor"
	},
	{
		suffix: "v-info.info",
		reversed: "ofni.ofni-v"
	},
	{
		suffix: "voorloper.cloud",
		reversed: "duolc.repolroov"
	},
	{
		suffix: "neko.am",
		reversed: "ma.oken"
	},
	{
		suffix: "nyaa.am",
		reversed: "ma.aayn"
	},
	{
		suffix: "be.ax",
		reversed: "xa.eb"
	},
	{
		suffix: "cat.ax",
		reversed: "xa.tac"
	},
	{
		suffix: "es.ax",
		reversed: "xa.se"
	},
	{
		suffix: "eu.ax",
		reversed: "xa.ue"
	},
	{
		suffix: "gg.ax",
		reversed: "xa.gg"
	},
	{
		suffix: "mc.ax",
		reversed: "xa.cm"
	},
	{
		suffix: "us.ax",
		reversed: "xa.su"
	},
	{
		suffix: "xy.ax",
		reversed: "xa.yx"
	},
	{
		suffix: "nl.ci",
		reversed: "ic.ln"
	},
	{
		suffix: "xx.gl",
		reversed: "lg.xx"
	},
	{
		suffix: "app.gp",
		reversed: "pg.ppa"
	},
	{
		suffix: "blog.gt",
		reversed: "tg.golb"
	},
	{
		suffix: "de.gt",
		reversed: "tg.ed"
	},
	{
		suffix: "to.gt",
		reversed: "tg.ot"
	},
	{
		suffix: "be.gy",
		reversed: "yg.eb"
	},
	{
		suffix: "cc.hn",
		reversed: "nh.cc"
	},
	{
		suffix: "blog.kg",
		reversed: "gk.golb"
	},
	{
		suffix: "io.kg",
		reversed: "gk.oi"
	},
	{
		suffix: "jp.kg",
		reversed: "gk.pj"
	},
	{
		suffix: "tv.kg",
		reversed: "gk.vt"
	},
	{
		suffix: "uk.kg",
		reversed: "gk.ku"
	},
	{
		suffix: "us.kg",
		reversed: "gk.su"
	},
	{
		suffix: "de.ls",
		reversed: "sl.ed"
	},
	{
		suffix: "at.md",
		reversed: "dm.ta"
	},
	{
		suffix: "de.md",
		reversed: "dm.ed"
	},
	{
		suffix: "jp.md",
		reversed: "dm.pj"
	},
	{
		suffix: "to.md",
		reversed: "dm.ot"
	},
	{
		suffix: "indie.porn",
		reversed: "nrop.eidni"
	},
	{
		suffix: "vxl.sh",
		reversed: "hs.lxv"
	},
	{
		suffix: "ch.tc",
		reversed: "ct.hc"
	},
	{
		suffix: "me.tc",
		reversed: "ct.em"
	},
	{
		suffix: "we.tc",
		reversed: "ct.ew"
	},
	{
		suffix: "nyan.to",
		reversed: "ot.nayn"
	},
	{
		suffix: "at.vg",
		reversed: "gv.ta"
	},
	{
		suffix: "blog.vu",
		reversed: "uv.golb"
	},
	{
		suffix: "dev.vu",
		reversed: "uv.ved"
	},
	{
		suffix: "me.vu",
		reversed: "uv.em"
	},
	{
		suffix: "v.ua",
		reversed: "au.v"
	},
	{
		suffix: "*.vultrobjects.com",
		reversed: "moc.stcejbortluv"
	},
	{
		suffix: "wafflecell.com",
		reversed: "moc.llecelffaw"
	},
	{
		suffix: "*.webhare.dev",
		reversed: "ved.erahbew"
	},
	{
		suffix: "reserve-online.net",
		reversed: "ten.enilno-evreser"
	},
	{
		suffix: "reserve-online.com",
		reversed: "moc.enilno-evreser"
	},
	{
		suffix: "bookonline.app",
		reversed: "ppa.enilnokoob"
	},
	{
		suffix: "hotelwithflight.com",
		reversed: "moc.thgilfhtiwletoh"
	},
	{
		suffix: "wedeploy.io",
		reversed: "oi.yolpedew"
	},
	{
		suffix: "wedeploy.me",
		reversed: "em.yolpedew"
	},
	{
		suffix: "wedeploy.sh",
		reversed: "hs.yolpedew"
	},
	{
		suffix: "remotewd.com",
		reversed: "moc.dwetomer"
	},
	{
		suffix: "pages.wiardweb.com",
		reversed: "moc.bewdraiw.segap"
	},
	{
		suffix: "wmflabs.org",
		reversed: "gro.sbalfmw"
	},
	{
		suffix: "toolforge.org",
		reversed: "gro.egrofloot"
	},
	{
		suffix: "wmcloud.org",
		reversed: "gro.duolcmw"
	},
	{
		suffix: "panel.gg",
		reversed: "gg.lenap"
	},
	{
		suffix: "daemon.panel.gg",
		reversed: "gg.lenap.nomead"
	},
	{
		suffix: "messwithdns.com",
		reversed: "moc.sndhtiwssem"
	},
	{
		suffix: "woltlab-demo.com",
		reversed: "moc.omed-baltlow"
	},
	{
		suffix: "myforum.community",
		reversed: "ytinummoc.murofym"
	},
	{
		suffix: "community-pro.de",
		reversed: "ed.orp-ytinummoc"
	},
	{
		suffix: "diskussionsbereich.de",
		reversed: "ed.hcierebsnoissuksid"
	},
	{
		suffix: "community-pro.net",
		reversed: "ten.orp-ytinummoc"
	},
	{
		suffix: "meinforum.net",
		reversed: "ten.murofniem"
	},
	{
		suffix: "affinitylottery.org.uk",
		reversed: "ku.gro.yrettolytiniffa"
	},
	{
		suffix: "raffleentry.org.uk",
		reversed: "ku.gro.yrtneelffar"
	},
	{
		suffix: "weeklylottery.org.uk",
		reversed: "ku.gro.yrettolylkeew"
	},
	{
		suffix: "wpenginepowered.com",
		reversed: "moc.derewopenignepw"
	},
	{
		suffix: "js.wpenginepowered.com",
		reversed: "moc.derewopenignepw.sj"
	},
	{
		suffix: "wixsite.com",
		reversed: "moc.etisxiw"
	},
	{
		suffix: "editorx.io",
		reversed: "oi.xrotide"
	},
	{
		suffix: "half.host",
		reversed: "tsoh.flah"
	},
	{
		suffix: "xnbay.com",
		reversed: "moc.yabnx"
	},
	{
		suffix: "u2.xnbay.com",
		reversed: "moc.yabnx.2u"
	},
	{
		suffix: "u2-local.xnbay.com",
		reversed: "moc.yabnx.lacol-2u"
	},
	{
		suffix: "cistron.nl",
		reversed: "ln.nortsic"
	},
	{
		suffix: "demon.nl",
		reversed: "ln.nomed"
	},
	{
		suffix: "xs4all.space",
		reversed: "ecaps.lla4sx"
	},
	{
		suffix: "yandexcloud.net",
		reversed: "ten.duolcxednay"
	},
	{
		suffix: "storage.yandexcloud.net",
		reversed: "ten.duolcxednay.egarots"
	},
	{
		suffix: "website.yandexcloud.net",
		reversed: "ten.duolcxednay.etisbew"
	},
	{
		suffix: "official.academy",
		reversed: "ymedaca.laiciffo"
	},
	{
		suffix: "yolasite.com",
		reversed: "moc.etisaloy"
	},
	{
		suffix: "ybo.faith",
		reversed: "htiaf.oby"
	},
	{
		suffix: "yombo.me",
		reversed: "em.obmoy"
	},
	{
		suffix: "homelink.one",
		reversed: "eno.knilemoh"
	},
	{
		suffix: "ybo.party",
		reversed: "ytrap.oby"
	},
	{
		suffix: "ybo.review",
		reversed: "weiver.oby"
	},
	{
		suffix: "ybo.science",
		reversed: "ecneics.oby"
	},
	{
		suffix: "ybo.trade",
		reversed: "edart.oby"
	},
	{
		suffix: "ynh.fr",
		reversed: "rf.hny"
	},
	{
		suffix: "nohost.me",
		reversed: "em.tsohon"
	},
	{
		suffix: "noho.st",
		reversed: "ts.ohon"
	},
	{
		suffix: "za.net",
		reversed: "ten.az"
	},
	{
		suffix: "za.org",
		reversed: "gro.az"
	},
	{
		suffix: "bss.design",
		reversed: "ngised.ssb"
	},
	{
		suffix: "basicserver.io",
		reversed: "oi.revrescisab"
	},
	{
		suffix: "virtualserver.io",
		reversed: "oi.revreslautriv"
	},
	{
		suffix: "enterprisecloud.nu",
		reversed: "un.duolcesirpretne"
	}
];

/** Highest positive signed 32-bit float value */
const maxInt = 2147483647; // aka. 0x7FFFFFFF or 2^31-1

/** Bootstring parameters */
const base = 36;
const tMin = 1;
const tMax = 26;
const skew = 38;
const damp = 700;
const initialBias = 72;
const initialN = 128; // 0x80
const delimiter = '-'; // '\x2D'
const regexNonASCII = /[^\0-\x7E]/; // non-ASCII chars
const regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g; // RFC 3490 separators

/** Error messages */
const errors$2 = {
	'overflow': 'Overflow: input needs wider integers to process',
	'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
	'invalid-input': 'Invalid input'
};

/** Convenience shortcuts */
const baseMinusTMin = base - tMin;
const floor = Math.floor;
const stringFromCharCode = String.fromCharCode;

/*--------------------------------------------------------------------------*/

/**
 * A generic error utility function.
 * @private
 * @param {String} type The error type.
 * @returns {Error} Throws a `RangeError` with the applicable error message.
 */
function error(type) {
	throw new RangeError(errors$2[type]);
}

/**
 * A generic `Array#map` utility function.
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} callback The function that gets called for every array
 * item.
 * @returns {Array} A new array of values returned by the callback function.
 */
function map(array, fn) {
	const result = [];
	let length = array.length;
	while (length--) {
		result[length] = fn(array[length]);
	}
	return result;
}

/**
 * A simple `Array#map`-like wrapper to work with domain name strings or email
 * addresses.
 * @private
 * @param {String} domain The domain name or email address.
 * @param {Function} callback The function that gets called for every
 * character.
 * @returns {Array} A new string of characters returned by the callback
 * function.
 */
function mapDomain(string, fn) {
	const parts = string.split('@');
	let result = '';
	if (parts.length > 1) {
		// In email addresses, only the domain name should be punycoded. Leave
		// the local part (i.e. everything up to `@`) intact.
		result = parts[0] + '@';
		string = parts[1];
	}
	// Avoid `split(regex)` for IE8 compatibility. See #17.
	string = string.replace(regexSeparators, '\x2E');
	const labels = string.split('.');
	const encoded = map(labels, fn).join('.');
	return result + encoded;
}

/**
 * Creates an array containing the numeric code points of each Unicode
 * character in the string. While JavaScript uses UCS-2 internally,
 * this function will convert a pair of surrogate halves (each of which
 * UCS-2 exposes as separate characters) into a single code point,
 * matching UTF-16.
 * @see `punycode.ucs2.encode`
 * @see <https://mathiasbynens.be/notes/javascript-encoding>
 * @memberOf punycode.ucs2
 * @name decode
 * @param {String} string The Unicode input string (UCS-2).
 * @returns {Array} The new array of code points.
 */
function ucs2decode(string) {
	const output = [];
	let counter = 0;
	const length = string.length;
	while (counter < length) {
		const value = string.charCodeAt(counter++);
		if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
			// It's a high surrogate, and there is a next character.
			const extra = string.charCodeAt(counter++);
			if ((extra & 0xFC00) == 0xDC00) { // Low surrogate.
				output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
			} else {
				// It's an unmatched surrogate; only append this code unit, in case the
				// next code unit is the high surrogate of a surrogate pair.
				output.push(value);
				counter--;
			}
		} else {
			output.push(value);
		}
	}
	return output;
}

/**
 * Converts a digit/integer into a basic code point.
 * @see `basicToDigit()`
 * @private
 * @param {Number} digit The numeric value of a basic code point.
 * @returns {Number} The basic code point whose value (when used for
 * representing integers) is `digit`, which needs to be in the range
 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
 * used; else, the lowercase form is used. The behavior is undefined
 * if `flag` is non-zero and `digit` has no uppercase form.
 */
const digitToBasic = function(digit, flag) {
	//  0..25 map to ASCII a..z or A..Z
	// 26..35 map to ASCII 0..9
	return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
};

/**
 * Bias adaptation function as per section 3.4 of RFC 3492.
 * https://tools.ietf.org/html/rfc3492#section-3.4
 * @private
 */
const adapt = function(delta, numPoints, firstTime) {
	let k = 0;
	delta = firstTime ? floor(delta / damp) : delta >> 1;
	delta += floor(delta / numPoints);
	for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
		delta = floor(delta / baseMinusTMin);
	}
	return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
};

/**
 * Converts a string of Unicode symbols (e.g. a domain name label) to a
 * Punycode string of ASCII-only symbols.
 * @memberOf punycode
 * @param {String} input The string of Unicode symbols.
 * @returns {String} The resulting Punycode string of ASCII-only symbols.
 */
const encode = function(input) {
	const output = [];

	// Convert the input in UCS-2 to an array of Unicode code points.
	input = ucs2decode(input);

	// Cache the length.
	let inputLength = input.length;

	// Initialize the state.
	let n = initialN;
	let delta = 0;
	let bias = initialBias;

	// Handle the basic code points.
	for (const currentValue of input) {
		if (currentValue < 0x80) {
			output.push(stringFromCharCode(currentValue));
		}
	}

	let basicLength = output.length;
	let handledCPCount = basicLength;

	// `handledCPCount` is the number of code points that have been handled;
	// `basicLength` is the number of basic code points.

	// Finish the basic string with a delimiter unless it's empty.
	if (basicLength) {
		output.push(delimiter);
	}

	// Main encoding loop:
	while (handledCPCount < inputLength) {

		// All non-basic code points < n have been handled already. Find the next
		// larger one:
		let m = maxInt;
		for (const currentValue of input) {
			if (currentValue >= n && currentValue < m) {
				m = currentValue;
			}
		}

		// Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
		// but guard against overflow.
		const handledCPCountPlusOne = handledCPCount + 1;
		if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
			error('overflow');
		}

		delta += (m - n) * handledCPCountPlusOne;
		n = m;

		for (const currentValue of input) {
			if (currentValue < n && ++delta > maxInt) {
				error('overflow');
			}
			if (currentValue == n) {
				// Represent delta as a generalized variable-length integer.
				let q = delta;
				for (let k = base; /* no condition */; k += base) {
					const t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
					if (q < t) {
						break;
					}
					const qMinusT = q - t;
					const baseMinusT = base - t;
					output.push(
						stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
					);
					q = floor(qMinusT / baseMinusT);
				}

				output.push(stringFromCharCode(digitToBasic(q, 0)));
				bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
				delta = 0;
				++handledCPCount;
			}
		}

		++delta;
		++n;

	}
	return output.join('');
};

/**
 * Converts a Unicode string representing a domain name or an email address to
 * Punycode. Only the non-ASCII parts of the domain name will be converted,
 * i.e. it doesn't matter if you call it with a domain that's already in
 * ASCII.
 * @memberOf punycode
 * @param {String} input The domain name or email address to convert, as a
 * Unicode string.
 * @returns {String} The Punycode representation of the given domain name or
 * email address.
 */
const toASCII = function(input) {
	return mapDomain(input, function(string) {
		return regexNonASCII.test(string)
			? 'xn--' + encode(string)
			: string;
	});
};

const rootNode = createTrie();
const cache$1 = new Map();
function createTrie() {
    const root = {
        key: '',
        parent: null,
        children: new Map(),
        suffix: '',
        end: false,
    };
    for (const rule of domainSuffixListReversed) {
        const word = rule.reversed + '.';
        let node = root;
        for (let i = 0; i < word.length; i++) {
            if (!node.children.has(word[i])) {
                node.children.set(word[i], {
                    key: word[i],
                    suffix: '',
                    parent: node,
                    children: new Map(),
                    end: false,
                });
            }
            node = node.children.get(word[i]);
            if (i === word.length - 1 || i === word.length - 2) {
                node.suffix = rule.suffix;
                node.end = true;
            }
        }
    }
    return root;
}
function search(domain) {
    let node = rootNode;
    for (let i = 0; i < domain.length; i++) {
        if (node.children.has(domain[i])) {
            node = node.children.get(domain[i]);
        }
        else {
            return node.end ? node.suffix : null;
        }
    }
    return node.end ? node.suffix : null;
}
function reverse(str) {
    let newStr = '';
    for (let i = str.length - 1; i >= 0; i--) {
        newStr += str[i];
    }
    return newStr;
}
function findRule(domain) {
    if (cache$1.has(domain)) {
        return cache$1.get(domain);
    }
    const punyDomain = toASCII(domain);
    let foundRule = null;
    const domainReversed = reverse(punyDomain);
    const rule = search(domainReversed);
    if (!rule) {
        return null;
    }
    const suffix = rule.replace(/^(\*\.|!)/, '');
    const wildcard = rule.charAt(0) === '*';
    const exception = rule.charAt(0) === '!';
    foundRule = { rule, suffix, wildcard, exception };
    cache$1.set(domain, foundRule);
    return foundRule;
}
const errorCodes = {
    DOMAIN_TOO_SHORT: 'Domain name too short.',
    DOMAIN_TOO_LONG: 'Domain name too long. It should be no more than 255 chars.',
    LABEL_STARTS_WITH_DASH: 'Domain name label can not start with a dash.',
    LABEL_ENDS_WITH_DASH: 'Domain name label can not end with a dash.',
    LABEL_TOO_LONG: 'Domain name label should be at most 63 chars long.',
    LABEL_TOO_SHORT: 'Domain name label should be at least 1 character long.',
    LABEL_INVALID_CHARS: 'Domain name label can only contain alphanumeric characters or dashes.',
};
function validate(input) {
    const ascii = toASCII(input);
    const labels = ascii.split('.');
    let label;
    for (let i = 0; i < labels.length; ++i) {
        label = labels[i];
        if (!label.length) {
            return 'LABEL_TOO_SHORT';
        }
    }
    return null;
}
function parsePunycode(domain, parsed) {
    if (!/xn--/.test(domain)) {
        return parsed;
    }
    if (parsed.domain) {
        parsed.domain = toASCII(parsed.domain);
    }
    if (parsed.subdomain) {
        parsed.subdomain = toASCII(parsed.subdomain);
    }
    return parsed;
}
function parse$1(domain) {
    const domainSanitized = domain.toLowerCase();
    const validationErrorCode = validate(domain);
    if (validationErrorCode) {
        throw new Error(JSON.stringify({
            input: domain,
            error: {
                message: errorCodes[validationErrorCode],
                code: validationErrorCode,
            },
        }));
    }
    const parsed = {
        input: domain,
        tld: null,
        sld: null,
        domain: null,
        subdomain: null,
        listed: false,
    };
    const domainParts = domainSanitized.split('.');
    const rule = findRule(domainSanitized);
    if (!rule) {
        if (domainParts.length < 2) {
            return parsed;
        }
        parsed.tld = domainParts.pop();
        parsed.sld = domainParts.pop();
        parsed.domain = `${parsed.sld}.${parsed.tld}`;
        if (domainParts.length) {
            parsed.subdomain = domainParts.pop();
        }
        return parsePunycode(domain, parsed);
    }
    parsed.listed = true;
    const tldParts = rule.suffix.split('.');
    const privateParts = domainParts.slice(0, domainParts.length - tldParts.length);
    if (rule.exception) {
        privateParts.push(tldParts.shift());
    }
    parsed.tld = tldParts.join('.');
    if (!privateParts.length) {
        return parsePunycode(domainSanitized, parsed);
    }
    if (rule.wildcard) {
        parsed.tld = `${privateParts.pop()}.${parsed.tld}`;
    }
    if (!privateParts.length) {
        return parsePunycode(domainSanitized, parsed);
    }
    parsed.sld = privateParts.pop();
    parsed.domain = `${parsed.sld}.${parsed.tld}`;
    if (privateParts.length) {
        parsed.subdomain = privateParts.join('.');
    }
    return parsePunycode(domainSanitized, parsed);
}
function get(domain) {
    if (!domain) {
        return null;
    }
    return parse$1(domain).domain;
}
function getEffectiveTLDPlusOne(hostname) {
    try {
        return get(hostname) || '';
    }
    catch (e) {
        return '';
    }
}

const defaultCustomerVariables = {
    [CustomerVariableType.BehaviourPath]: 'fpjs',
    [CustomerVariableType.GetResultPath]: 'resultId',
    [CustomerVariableType.PreSharedSecret]: null,
    [CustomerVariableType.AgentDownloadPath]: 'agent',
};
function getDefaultCustomerVariable(variable) {
    return defaultCustomerVariables[variable];
}

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function getAugmentedNamespace(n) {
  if (n.__esModule) return n;
  var f = n.default;
	if (typeof f == "function") {
		var a = function a () {
			if (this instanceof a) {
				var args = [null];
				args.push.apply(args, arguments);
				var Ctor = Function.bind.apply(f, args);
				return new Ctor();
			}
			return f.apply(this, arguments);
		};
		a.prototype = f.prototype;
  } else a = {};
  Object.defineProperty(a, '__esModule', {value: true});
	Object.keys(n).forEach(function (k) {
		var d = Object.getOwnPropertyDescriptor(n, k);
		Object.defineProperty(a, k, d.get ? d : {
			enumerable: true,
			get: function () {
				return n[k];
			}
		});
	});
	return a;
}

var winston = {};

var logform$1 = {};

var format$2;
var hasRequiredFormat;

function requireFormat () {
	if (hasRequiredFormat) return format$2;
	hasRequiredFormat = 1;

	/*
	 * Displays a helpful message and the source of
	 * the format when it is invalid.
	 */
	class InvalidFormatError extends Error {
	  constructor(formatFn) {
	    super(`Format functions must be synchronous taking a two arguments: (info, opts)
Found: ${formatFn.toString().split('\n')[0]}\n`);

	    Error.captureStackTrace(this, InvalidFormatError);
	  }
	}

	/*
	 * function format (formatFn)
	 * Returns a create function for the `formatFn`.
	 */
	format$2 = formatFn => {
	  if (formatFn.length > 2) {
	    throw new InvalidFormatError(formatFn);
	  }

	  /*
	   * function Format (options)
	   * Base prototype which calls a `_format`
	   * function and pushes the result.
	   */
	  function Format(options = {}) {
	    this.options = options;
	  }

	  Format.prototype.transform = formatFn;

	  //
	  // Create a function which returns new instances of
	  // FormatWrap for simple syntax like:
	  //
	  // require('winston').formats.json();
	  //
	  function createFormatWrap(opts) {
	    return new Format(opts);
	  }

	  //
	  // Expose the FormatWrap through the create function
	  // for testability.
	  //
	  createFormatWrap.Format = Format;
	  return createFormatWrap;
	};
	return format$2;
}

var colorizeExports = {};
var colorize = {
  get exports(){ return colorizeExports; },
  set exports(v){ colorizeExports = v; },
};

var safeExports = {};
var safe = {
  get exports(){ return safeExports; },
  set exports(v){ safeExports = v; },
};

var colorsExports = {};
var colors$1 = {
  get exports(){ return colorsExports; },
  set exports(v){ colorsExports = v; },
};

var stylesExports = {};
var styles = {
  get exports(){ return stylesExports; },
  set exports(v){ stylesExports = v; },
};

/*
The MIT License (MIT)

Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (sindresorhus.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

*/

(function (module) {
	var styles = {};
	module['exports'] = styles;

	var codes = {
	  reset: [0, 0],

	  bold: [1, 22],
	  dim: [2, 22],
	  italic: [3, 23],
	  underline: [4, 24],
	  inverse: [7, 27],
	  hidden: [8, 28],
	  strikethrough: [9, 29],

	  black: [30, 39],
	  red: [31, 39],
	  green: [32, 39],
	  yellow: [33, 39],
	  blue: [34, 39],
	  magenta: [35, 39],
	  cyan: [36, 39],
	  white: [37, 39],
	  gray: [90, 39],
	  grey: [90, 39],

	  brightRed: [91, 39],
	  brightGreen: [92, 39],
	  brightYellow: [93, 39],
	  brightBlue: [94, 39],
	  brightMagenta: [95, 39],
	  brightCyan: [96, 39],
	  brightWhite: [97, 39],

	  bgBlack: [40, 49],
	  bgRed: [41, 49],
	  bgGreen: [42, 49],
	  bgYellow: [43, 49],
	  bgBlue: [44, 49],
	  bgMagenta: [45, 49],
	  bgCyan: [46, 49],
	  bgWhite: [47, 49],
	  bgGray: [100, 49],
	  bgGrey: [100, 49],

	  bgBrightRed: [101, 49],
	  bgBrightGreen: [102, 49],
	  bgBrightYellow: [103, 49],
	  bgBrightBlue: [104, 49],
	  bgBrightMagenta: [105, 49],
	  bgBrightCyan: [106, 49],
	  bgBrightWhite: [107, 49],

	  // legacy styles for colors pre v1.0.0
	  blackBG: [40, 49],
	  redBG: [41, 49],
	  greenBG: [42, 49],
	  yellowBG: [43, 49],
	  blueBG: [44, 49],
	  magentaBG: [45, 49],
	  cyanBG: [46, 49],
	  whiteBG: [47, 49],

	};

	Object.keys(codes).forEach(function(key) {
	  var val = codes[key];
	  var style = styles[key] = [];
	  style.open = '\u001b[' + val[0] + 'm';
	  style.close = '\u001b[' + val[1] + 'm';
	});
} (styles));

/*
MIT License

Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (sindresorhus.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

var hasFlag$1 = function(flag, argv) {
  argv = argv || process.argv;

  var terminatorPos = argv.indexOf('--');
  var prefix = /^-{1,2}/.test(flag) ? '' : '--';
  var pos = argv.indexOf(prefix + flag);

  return pos !== -1 && (terminatorPos === -1 ? true : pos < terminatorPos);
};

/*
The MIT License (MIT)

Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (sindresorhus.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

*/

var os$2 = require$$0__default["default"];
var hasFlag = hasFlag$1;

var env = process.env;

var forceColor = void 0;
if (hasFlag('no-color') || hasFlag('no-colors') || hasFlag('color=false')) {
  forceColor = false;
} else if (hasFlag('color') || hasFlag('colors') || hasFlag('color=true')
           || hasFlag('color=always')) {
  forceColor = true;
}
if ('FORCE_COLOR' in env) {
  forceColor = env.FORCE_COLOR.length === 0
    || parseInt(env.FORCE_COLOR, 10) !== 0;
}

function translateLevel(level) {
  if (level === 0) {
    return false;
  }

  return {
    level: level,
    hasBasic: true,
    has256: level >= 2,
    has16m: level >= 3,
  };
}

function supportsColor(stream) {
  if (forceColor === false) {
    return 0;
  }

  if (hasFlag('color=16m') || hasFlag('color=full')
      || hasFlag('color=truecolor')) {
    return 3;
  }

  if (hasFlag('color=256')) {
    return 2;
  }

  if (stream && !stream.isTTY && forceColor !== true) {
    return 0;
  }

  var min = forceColor ? 1 : 0;

  if (process.platform === 'win32') {
    // Node.js 7.5.0 is the first version of Node.js to include a patch to
    // libuv that enables 256 color output on Windows. Anything earlier and it
    // won't work. However, here we target Node.js 8 at minimum as it is an LTS
    // release, and Node.js 7 is not. Windows 10 build 10586 is the first
    // Windows release that supports 256 colors. Windows 10 build 14931 is the
    // first release that supports 16m/TrueColor.
    var osRelease = os$2.release().split('.');
    if (Number(process.versions.node.split('.')[0]) >= 8
        && Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586) {
      return Number(osRelease[2]) >= 14931 ? 3 : 2;
    }

    return 1;
  }

  if ('CI' in env) {
    if (['TRAVIS', 'CIRCLECI', 'APPVEYOR', 'GITLAB_CI'].some(function(sign) {
      return sign in env;
    }) || env.CI_NAME === 'codeship') {
      return 1;
    }

    return min;
  }

  if ('TEAMCITY_VERSION' in env) {
    return (/^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0
    );
  }

  if ('TERM_PROGRAM' in env) {
    var version = parseInt((env.TERM_PROGRAM_VERSION || '').split('.')[0], 10);

    switch (env.TERM_PROGRAM) {
      case 'iTerm.app':
        return version >= 3 ? 3 : 2;
      case 'Hyper':
        return 3;
      case 'Apple_Terminal':
        return 2;
      // No default
    }
  }

  if (/-256(color)?$/i.test(env.TERM)) {
    return 2;
  }

  if (/^screen|^xterm|^vt100|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
    return 1;
  }

  if ('COLORTERM' in env) {
    return 1;
  }

  if (env.TERM === 'dumb') {
    return min;
  }

  return min;
}

function getSupportLevel(stream) {
  var level = supportsColor(stream);
  return translateLevel(level);
}

var supportsColors = {
  supportsColor: getSupportLevel,
  stdout: getSupportLevel(process.stdout),
  stderr: getSupportLevel(process.stderr),
};

var trapExports = {};
var trap = {
  get exports(){ return trapExports; },
  set exports(v){ trapExports = v; },
};

var hasRequiredTrap;

function requireTrap () {
	if (hasRequiredTrap) return trapExports;
	hasRequiredTrap = 1;
	(function (module) {
		module['exports'] = function runTheTrap(text, options) {
		  var result = '';
		  text = text || 'Run the trap, drop the bass';
		  text = text.split('');
		  var trap = {
		    a: ['\u0040', '\u0104', '\u023a', '\u0245', '\u0394', '\u039b', '\u0414'],
		    b: ['\u00df', '\u0181', '\u0243', '\u026e', '\u03b2', '\u0e3f'],
		    c: ['\u00a9', '\u023b', '\u03fe'],
		    d: ['\u00d0', '\u018a', '\u0500', '\u0501', '\u0502', '\u0503'],
		    e: ['\u00cb', '\u0115', '\u018e', '\u0258', '\u03a3', '\u03be', '\u04bc',
		      '\u0a6c'],
		    f: ['\u04fa'],
		    g: ['\u0262'],
		    h: ['\u0126', '\u0195', '\u04a2', '\u04ba', '\u04c7', '\u050a'],
		    i: ['\u0f0f'],
		    j: ['\u0134'],
		    k: ['\u0138', '\u04a0', '\u04c3', '\u051e'],
		    l: ['\u0139'],
		    m: ['\u028d', '\u04cd', '\u04ce', '\u0520', '\u0521', '\u0d69'],
		    n: ['\u00d1', '\u014b', '\u019d', '\u0376', '\u03a0', '\u048a'],
		    o: ['\u00d8', '\u00f5', '\u00f8', '\u01fe', '\u0298', '\u047a', '\u05dd',
		      '\u06dd', '\u0e4f'],
		    p: ['\u01f7', '\u048e'],
		    q: ['\u09cd'],
		    r: ['\u00ae', '\u01a6', '\u0210', '\u024c', '\u0280', '\u042f'],
		    s: ['\u00a7', '\u03de', '\u03df', '\u03e8'],
		    t: ['\u0141', '\u0166', '\u0373'],
		    u: ['\u01b1', '\u054d'],
		    v: ['\u05d8'],
		    w: ['\u0428', '\u0460', '\u047c', '\u0d70'],
		    x: ['\u04b2', '\u04fe', '\u04fc', '\u04fd'],
		    y: ['\u00a5', '\u04b0', '\u04cb'],
		    z: ['\u01b5', '\u0240'],
		  };
		  text.forEach(function(c) {
		    c = c.toLowerCase();
		    var chars = trap[c] || [' '];
		    var rand = Math.floor(Math.random() * chars.length);
		    if (typeof trap[c] !== 'undefined') {
		      result += trap[c][rand];
		    } else {
		      result += c;
		    }
		  });
		  return result;
		};
} (trap));
	return trapExports;
}

var zalgoExports = {};
var zalgo = {
  get exports(){ return zalgoExports; },
  set exports(v){ zalgoExports = v; },
};

var hasRequiredZalgo;

function requireZalgo () {
	if (hasRequiredZalgo) return zalgoExports;
	hasRequiredZalgo = 1;
	(function (module) {
		// please no
		module['exports'] = function zalgo(text, options) {
		  text = text || '   he is here   ';
		  var soul = {
		    'up': [
		      '̍', '̎', '̄', '̅',
		      '̿', '̑', '̆', '̐',
		      '͒', '͗', '͑', '̇',
		      '̈', '̊', '͂', '̓',
		      '̈', '͊', '͋', '͌',
		      '̃', '̂', '̌', '͐',
		      '̀', '́', '̋', '̏',
		      '̒', '̓', '̔', '̽',
		      '̉', 'ͣ', 'ͤ', 'ͥ',
		      'ͦ', 'ͧ', 'ͨ', 'ͩ',
		      'ͪ', 'ͫ', 'ͬ', 'ͭ',
		      'ͮ', 'ͯ', '̾', '͛',
		      '͆', '̚',
		    ],
		    'down': [
		      '̖', '̗', '̘', '̙',
		      '̜', '̝', '̞', '̟',
		      '̠', '̤', '̥', '̦',
		      '̩', '̪', '̫', '̬',
		      '̭', '̮', '̯', '̰',
		      '̱', '̲', '̳', '̹',
		      '̺', '̻', '̼', 'ͅ',
		      '͇', '͈', '͉', '͍',
		      '͎', '͓', '͔', '͕',
		      '͖', '͙', '͚', '̣',
		    ],
		    'mid': [
		      '̕', '̛', '̀', '́',
		      '͘', '̡', '̢', '̧',
		      '̨', '̴', '̵', '̶',
		      '͜', '͝', '͞',
		      '͟', '͠', '͢', '̸',
		      '̷', '͡', ' ҉',
		    ],
		  };
		  var all = [].concat(soul.up, soul.down, soul.mid);

		  function randomNumber(range) {
		    var r = Math.floor(Math.random() * range);
		    return r;
		  }

		  function isChar(character) {
		    var bool = false;
		    all.filter(function(i) {
		      bool = (i === character);
		    });
		    return bool;
		  }


		  function heComes(text, options) {
		    var result = '';
		    var counts;
		    var l;
		    options = options || {};
		    options['up'] =
		      typeof options['up'] !== 'undefined' ? options['up'] : true;
		    options['mid'] =
		      typeof options['mid'] !== 'undefined' ? options['mid'] : true;
		    options['down'] =
		      typeof options['down'] !== 'undefined' ? options['down'] : true;
		    options['size'] =
		      typeof options['size'] !== 'undefined' ? options['size'] : 'maxi';
		    text = text.split('');
		    for (l in text) {
		      if (isChar(l)) {
		        continue;
		      }
		      result = result + text[l];
		      counts = {'up': 0, 'down': 0, 'mid': 0};
		      switch (options.size) {
		        case 'mini':
		          counts.up = randomNumber(8);
		          counts.mid = randomNumber(2);
		          counts.down = randomNumber(8);
		          break;
		        case 'maxi':
		          counts.up = randomNumber(16) + 3;
		          counts.mid = randomNumber(4) + 1;
		          counts.down = randomNumber(64) + 3;
		          break;
		        default:
		          counts.up = randomNumber(8) + 1;
		          counts.mid = randomNumber(6) / 2;
		          counts.down = randomNumber(8) + 1;
		          break;
		      }

		      var arr = ['up', 'mid', 'down'];
		      for (var d in arr) {
		        var index = arr[d];
		        for (var i = 0; i <= counts[index]; i++) {
		          if (options[index]) {
		            result = result + soul[index][randomNumber(soul[index].length)];
		          }
		        }
		      }
		    }
		    return result;
		  }
		  // don't summon him
		  return heComes(text, options);
		};
} (zalgo));
	return zalgoExports;
}

var americaExports = {};
var america = {
  get exports(){ return americaExports; },
  set exports(v){ americaExports = v; },
};

var hasRequiredAmerica;

function requireAmerica () {
	if (hasRequiredAmerica) return americaExports;
	hasRequiredAmerica = 1;
	(function (module) {
		module['exports'] = function(colors) {
		  return function(letter, i, exploded) {
		    if (letter === ' ') return letter;
		    switch (i%3) {
		      case 0: return colors.red(letter);
		      case 1: return colors.white(letter);
		      case 2: return colors.blue(letter);
		    }
		  };
		};
} (america));
	return americaExports;
}

var zebraExports = {};
var zebra = {
  get exports(){ return zebraExports; },
  set exports(v){ zebraExports = v; },
};

var hasRequiredZebra;

function requireZebra () {
	if (hasRequiredZebra) return zebraExports;
	hasRequiredZebra = 1;
	(function (module) {
		module['exports'] = function(colors) {
		  return function(letter, i, exploded) {
		    return i % 2 === 0 ? letter : colors.inverse(letter);
		  };
		};
} (zebra));
	return zebraExports;
}

var rainbowExports = {};
var rainbow = {
  get exports(){ return rainbowExports; },
  set exports(v){ rainbowExports = v; },
};

var hasRequiredRainbow;

function requireRainbow () {
	if (hasRequiredRainbow) return rainbowExports;
	hasRequiredRainbow = 1;
	(function (module) {
		module['exports'] = function(colors) {
		  // RoY G BiV
		  var rainbowColors = ['red', 'yellow', 'green', 'blue', 'magenta'];
		  return function(letter, i, exploded) {
		    if (letter === ' ') {
		      return letter;
		    } else {
		      return colors[rainbowColors[i++ % rainbowColors.length]](letter);
		    }
		  };
		};
} (rainbow));
	return rainbowExports;
}

var randomExports = {};
var random = {
  get exports(){ return randomExports; },
  set exports(v){ randomExports = v; },
};

var hasRequiredRandom;

function requireRandom () {
	if (hasRequiredRandom) return randomExports;
	hasRequiredRandom = 1;
	(function (module) {
		module['exports'] = function(colors) {
		  var available = ['underline', 'inverse', 'grey', 'yellow', 'red', 'green',
		    'blue', 'white', 'cyan', 'magenta', 'brightYellow', 'brightRed',
		    'brightGreen', 'brightBlue', 'brightWhite', 'brightCyan', 'brightMagenta'];
		  return function(letter, i, exploded) {
		    return letter === ' ' ? letter :
		      colors[
		          available[Math.round(Math.random() * (available.length - 2))]
		      ](letter);
		  };
		};
} (random));
	return randomExports;
}

/*

The MIT License (MIT)

Original Library
  - Copyright (c) Marak Squires

Additional functionality
 - Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (sindresorhus.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

*/

(function (module) {
	var colors = {};
	module['exports'] = colors;

	colors.themes = {};

	var util = require$$0__default$1["default"];
	var ansiStyles = colors.styles = stylesExports;
	var defineProps = Object.defineProperties;
	var newLineRegex = new RegExp(/[\r\n]+/g);

	colors.supportsColor = supportsColors.supportsColor;

	if (typeof colors.enabled === 'undefined') {
	  colors.enabled = colors.supportsColor() !== false;
	}

	colors.enable = function() {
	  colors.enabled = true;
	};

	colors.disable = function() {
	  colors.enabled = false;
	};

	colors.stripColors = colors.strip = function(str) {
	  return ('' + str).replace(/\x1B\[\d+m/g, '');
	};

	// eslint-disable-next-line no-unused-vars
	colors.stylize = function stylize(str, style) {
	  if (!colors.enabled) {
	    return str+'';
	  }

	  var styleMap = ansiStyles[style];

	  // Stylize should work for non-ANSI styles, too
	  if (!styleMap && style in colors) {
	    // Style maps like trap operate as functions on strings;
	    // they don't have properties like open or close.
	    return colors[style](str);
	  }

	  return styleMap.open + str + styleMap.close;
	};

	var matchOperatorsRe = /[|\\{}()[\]^$+*?.]/g;
	var escapeStringRegexp = function(str) {
	  if (typeof str !== 'string') {
	    throw new TypeError('Expected a string');
	  }
	  return str.replace(matchOperatorsRe, '\\$&');
	};

	function build(_styles) {
	  var builder = function builder() {
	    return applyStyle.apply(builder, arguments);
	  };
	  builder._styles = _styles;
	  // __proto__ is used because we must return a function, but there is
	  // no way to create a function with a different prototype.
	  builder.__proto__ = proto;
	  return builder;
	}

	var styles = (function() {
	  var ret = {};
	  ansiStyles.grey = ansiStyles.gray;
	  Object.keys(ansiStyles).forEach(function(key) {
	    ansiStyles[key].closeRe =
	      new RegExp(escapeStringRegexp(ansiStyles[key].close), 'g');
	    ret[key] = {
	      get: function() {
	        return build(this._styles.concat(key));
	      },
	    };
	  });
	  return ret;
	})();

	var proto = defineProps(function colors() {}, styles);

	function applyStyle() {
	  var args = Array.prototype.slice.call(arguments);

	  var str = args.map(function(arg) {
	    // Use weak equality check so we can colorize null/undefined in safe mode
	    if (arg != null && arg.constructor === String) {
	      return arg;
	    } else {
	      return util.inspect(arg);
	    }
	  }).join(' ');

	  if (!colors.enabled || !str) {
	    return str;
	  }

	  var newLinesPresent = str.indexOf('\n') != -1;

	  var nestedStyles = this._styles;

	  var i = nestedStyles.length;
	  while (i--) {
	    var code = ansiStyles[nestedStyles[i]];
	    str = code.open + str.replace(code.closeRe, code.open) + code.close;
	    if (newLinesPresent) {
	      str = str.replace(newLineRegex, function(match) {
	        return code.close + match + code.open;
	      });
	    }
	  }

	  return str;
	}

	colors.setTheme = function(theme) {
	  if (typeof theme === 'string') {
	    console.log('colors.setTheme now only accepts an object, not a string.  ' +
	      'If you are trying to set a theme from a file, it is now your (the ' +
	      'caller\'s) responsibility to require the file.  The old syntax ' +
	      'looked like colors.setTheme(__dirname + ' +
	      '\'/../themes/generic-logging.js\'); The new syntax looks like '+
	      'colors.setTheme(require(__dirname + ' +
	      '\'/../themes/generic-logging.js\'));');
	    return;
	  }
	  for (var style in theme) {
	    (function(style) {
	      colors[style] = function(str) {
	        if (typeof theme[style] === 'object') {
	          var out = str;
	          for (var i in theme[style]) {
	            out = colors[theme[style][i]](out);
	          }
	          return out;
	        }
	        return colors[theme[style]](str);
	      };
	    })(style);
	  }
	};

	function init() {
	  var ret = {};
	  Object.keys(styles).forEach(function(name) {
	    ret[name] = {
	      get: function() {
	        return build([name]);
	      },
	    };
	  });
	  return ret;
	}

	var sequencer = function sequencer(map, str) {
	  var exploded = str.split('');
	  exploded = exploded.map(map);
	  return exploded.join('');
	};

	// custom formatter methods
	colors.trap = requireTrap();
	colors.zalgo = requireZalgo();

	// maps
	colors.maps = {};
	colors.maps.america = requireAmerica()(colors);
	colors.maps.zebra = requireZebra()(colors);
	colors.maps.rainbow = requireRainbow()(colors);
	colors.maps.random = requireRandom()(colors);

	for (var map in colors.maps) {
	  (function(map) {
	    colors[map] = function(str) {
	      return sequencer(colors.maps[map], str);
	    };
	  })(map);
	}

	defineProps(colors, init());
} (colors$1));

(function (module) {
	//
	// Remark: Requiring this file will use the "safe" colors API,
	// which will not touch String.prototype.
	//
	//   var colors = require('colors/safe');
	//   colors.red("foo")
	//
	//
	var colors = colorsExports;
	module['exports'] = colors;
} (safe));

var tripleBeam = {};

var config$3 = {};

var cli$1 = {};

/**
 * cli.js: Config that conform to commonly used CLI logging levels.
 *
 * (C) 2010 Charlie Robbins
 * MIT LICENCE
 */

/**
 * Default levels for the CLI configuration.
 * @type {Object}
 */
cli$1.levels = {
  error: 0,
  warn: 1,
  help: 2,
  data: 3,
  info: 4,
  debug: 5,
  prompt: 6,
  verbose: 7,
  input: 8,
  silly: 9
};

/**
 * Default colors for the CLI configuration.
 * @type {Object}
 */
cli$1.colors = {
  error: 'red',
  warn: 'yellow',
  help: 'cyan',
  data: 'grey',
  info: 'green',
  debug: 'blue',
  prompt: 'grey',
  verbose: 'cyan',
  input: 'grey',
  silly: 'magenta'
};

var npm = {};

/**
 * npm.js: Config that conform to npm logging levels.
 *
 * (C) 2010 Charlie Robbins
 * MIT LICENCE
 */

/**
 * Default levels for the npm configuration.
 * @type {Object}
 */
npm.levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6
};

/**
 * Default levels for the npm configuration.
 * @type {Object}
 */
npm.colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'green',
  verbose: 'cyan',
  debug: 'blue',
  silly: 'magenta'
};

var syslog = {};

/**
 * syslog.js: Config that conform to syslog logging levels.
 *
 * (C) 2010 Charlie Robbins
 * MIT LICENCE
 */

/**
 * Default levels for the syslog configuration.
 * @type {Object}
 */
syslog.levels = {
  emerg: 0,
  alert: 1,
  crit: 2,
  error: 3,
  warning: 4,
  notice: 5,
  info: 6,
  debug: 7
};

/**
 * Default levels for the syslog configuration.
 * @type {Object}
 */
syslog.colors = {
  emerg: 'red',
  alert: 'yellow',
  crit: 'red',
  error: 'red',
  warning: 'red',
  notice: 'yellow',
  info: 'green',
  debug: 'blue'
};

/**
 * index.js: Default settings for all levels that winston knows about.
 *
 * (C) 2010 Charlie Robbins
 * MIT LICENCE
 */

(function (exports) {

	/**
	 * Export config set for the CLI.
	 * @type {Object}
	 */
	Object.defineProperty(exports, 'cli', {
	  value: cli$1
	});

	/**
	 * Export config set for npm.
	 * @type {Object}
	 */
	Object.defineProperty(exports, 'npm', {
	  value: npm
	});

	/**
	 * Export config set for the syslog.
	 * @type {Object}
	 */
	Object.defineProperty(exports, 'syslog', {
	  value: syslog
	});
} (config$3));

(function (exports) {

	/**
	 * A shareable symbol constant that can be used
	 * as a non-enumerable / semi-hidden level identifier
	 * to allow the readable level property to be mutable for
	 * operations like colorization
	 *
	 * @type {Symbol}
	 */
	Object.defineProperty(exports, 'LEVEL', {
	  value: Symbol.for('level')
	});

	/**
	 * A shareable symbol constant that can be used
	 * as a non-enumerable / semi-hidden message identifier
	 * to allow the final message property to not have
	 * side effects on another.
	 *
	 * @type {Symbol}
	 */
	Object.defineProperty(exports, 'MESSAGE', {
	  value: Symbol.for('message')
	});

	/**
	 * A shareable symbol constant that can be used
	 * as a non-enumerable / semi-hidden message identifier
	 * to allow the extracted splat property be hidden
	 *
	 * @type {Symbol}
	 */
	Object.defineProperty(exports, 'SPLAT', {
	  value: Symbol.for('splat')
	});

	/**
	 * A shareable object constant  that can be used
	 * as a standard configuration for winston@3.
	 *
	 * @type {Object}
	 */
	Object.defineProperty(exports, 'configs', {
	  value: config$3
	});
} (tripleBeam));

const colors = safeExports;
const { LEVEL: LEVEL$2, MESSAGE } = tripleBeam;

//
// Fix colors not appearing in non-tty environments
//
colors.enabled = true;

/**
 * @property {RegExp} hasSpace
 * Simple regex to check for presence of spaces.
 */
const hasSpace = /\s+/;

/*
 * Colorizer format. Wraps the `level` and/or `message` properties
 * of the `info` objects with ANSI color codes based on a few options.
 */
class Colorizer$1 {
  constructor(opts = {}) {
    if (opts.colors) {
      this.addColors(opts.colors);
    }

    this.options = opts;
  }

  /*
   * Adds the colors Object to the set of allColors
   * known by the Colorizer
   *
   * @param {Object} colors Set of color mappings to add.
   */
  static addColors(clrs) {
    const nextColors = Object.keys(clrs).reduce((acc, level) => {
      acc[level] = hasSpace.test(clrs[level])
        ? clrs[level].split(hasSpace)
        : clrs[level];

      return acc;
    }, {});

    Colorizer$1.allColors = Object.assign({}, Colorizer$1.allColors || {}, nextColors);
    return Colorizer$1.allColors;
  }

  /*
   * Adds the colors Object to the set of allColors
   * known by the Colorizer
   *
   * @param {Object} colors Set of color mappings to add.
   */
  addColors(clrs) {
    return Colorizer$1.addColors(clrs);
  }

  /*
   * function colorize (lookup, level, message)
   * Performs multi-step colorization using @colors/colors/safe
   */
  colorize(lookup, level, message) {
    if (typeof message === 'undefined') {
      message = level;
    }

    //
    // If the color for the level is just a string
    // then attempt to colorize the message with it.
    //
    if (!Array.isArray(Colorizer$1.allColors[lookup])) {
      return colors[Colorizer$1.allColors[lookup]](message);
    }

    //
    // If it is an Array then iterate over that Array, applying
    // the colors function for each item.
    //
    for (let i = 0, len = Colorizer$1.allColors[lookup].length; i < len; i++) {
      message = colors[Colorizer$1.allColors[lookup][i]](message);
    }

    return message;
  }

  /*
   * function transform (info, opts)
   * Attempts to colorize the { level, message } of the given
   * `logform` info object.
   */
  transform(info, opts) {
    if (opts.all && typeof info[MESSAGE] === 'string') {
      info[MESSAGE] = this.colorize(info[LEVEL$2], info.level, info[MESSAGE]);
    }

    if (opts.level || opts.all || !opts.message) {
      info.level = this.colorize(info[LEVEL$2], info.level);
    }

    if (opts.all || opts.message) {
      info.message = this.colorize(info[LEVEL$2], info.level, info.message);
    }

    return info;
  }
}

/*
 * function colorize (info)
 * Returns a new instance of the colorize Format that applies
 * level colors to `info` objects. This was previously exposed
 * as { colorize: true } to transports in `winston < 3.0.0`.
 */
colorize.exports = opts => new Colorizer$1(opts);

//
// Attach the Colorizer for registration purposes
//
colorizeExports.Colorizer
  = colorizeExports.Format
  = Colorizer$1;

const { Colorizer } = colorizeExports;

/*
 * Simple method to register colors with a simpler require
 * path within the module.
 */
var levels = config => {
  Colorizer.addColors(config.colors || config);
  return config;
};

var align;
var hasRequiredAlign;

function requireAlign () {
	if (hasRequiredAlign) return align;
	hasRequiredAlign = 1;

	const format = requireFormat();

	/*
	 * function align (info)
	 * Returns a new instance of the align Format which adds a `\t`
	 * delimiter before the message to properly align it in the same place.
	 * It was previously { align: true } in winston < 3.0.0
	 */
	align = format(info => {
	  info.message = `\t${info.message}`;
	  return info;
	});
	return align;
}

/* eslint no-undefined: 0 */

var errors$1;
var hasRequiredErrors$1;

function requireErrors$1 () {
	if (hasRequiredErrors$1) return errors$1;
	hasRequiredErrors$1 = 1;

	const format = requireFormat();
	const { LEVEL, MESSAGE } = tripleBeam;

	/*
	 * function errors (info)
	 * If the `message` property of the `info` object is an instance of `Error`,
	 * replace the `Error` object its own `message` property.
	 *
	 * Optionally, the Error's `stack` property can also be appended to the `info` object.
	 */
	errors$1 = format((einfo, { stack }) => {
	  if (einfo instanceof Error) {
	    const info = Object.assign({}, einfo, {
	      level: einfo.level,
	      [LEVEL]: einfo[LEVEL] || einfo.level,
	      message: einfo.message,
	      [MESSAGE]: einfo[MESSAGE] || einfo.message
	    });

	    if (stack) info.stack = einfo.stack;
	    return info;
	  }

	  if (!(einfo.message instanceof Error)) return einfo;

	  // Assign all enumerable properties and the
	  // message property from the error provided.
	  const err = einfo.message;
	  Object.assign(einfo, err);
	  einfo.message = err.message;
	  einfo[MESSAGE] = err.message;

	  // Assign the stack if requested.
	  if (stack) einfo.stack = err.stack;
	  return einfo;
	});
	return errors$1;
}

var cliExports = {};
var cli = {
  get exports(){ return cliExports; },
  set exports(v){ cliExports = v; },
};

var padLevelsExports = {};
var padLevels = {
  get exports(){ return padLevelsExports; },
  set exports(v){ padLevelsExports = v; },
};

/* eslint no-unused-vars: 0 */

var hasRequiredPadLevels;

function requirePadLevels () {
	if (hasRequiredPadLevels) return padLevelsExports;
	hasRequiredPadLevels = 1;

	const { configs, LEVEL, MESSAGE } = tripleBeam;

	class Padder {
	  constructor(opts = { levels: configs.npm.levels }) {
	    this.paddings = Padder.paddingForLevels(opts.levels, opts.filler);
	    this.options = opts;
	  }

	  /**
	   * Returns the maximum length of keys in the specified `levels` Object.
	   * @param  {Object} levels Set of all levels to calculate longest level against.
	   * @returns {Number} Maximum length of the longest level string.
	   */
	  static getLongestLevel(levels) {
	    const lvls = Object.keys(levels).map(level => level.length);
	    return Math.max(...lvls);
	  }

	  /**
	   * Returns the padding for the specified `level` assuming that the
	   * maximum length of all levels it's associated with is `maxLength`.
	   * @param  {String} level Level to calculate padding for.
	   * @param  {String} filler Repeatable text to use for padding.
	   * @param  {Number} maxLength Length of the longest level
	   * @returns {String} Padding string for the `level`
	   */
	  static paddingForLevel(level, filler, maxLength) {
	    const targetLen = maxLength + 1 - level.length;
	    const rep = Math.floor(targetLen / filler.length);
	    const padding = `${filler}${filler.repeat(rep)}`;
	    return padding.slice(0, targetLen);
	  }

	  /**
	   * Returns an object with the string paddings for the given `levels`
	   * using the specified `filler`.
	   * @param  {Object} levels Set of all levels to calculate padding for.
	   * @param  {String} filler Repeatable text to use for padding.
	   * @returns {Object} Mapping of level to desired padding.
	   */
	  static paddingForLevels(levels, filler = ' ') {
	    const maxLength = Padder.getLongestLevel(levels);
	    return Object.keys(levels).reduce((acc, level) => {
	      acc[level] = Padder.paddingForLevel(level, filler, maxLength);
	      return acc;
	    }, {});
	  }

	  /**
	   * Prepends the padding onto the `message` based on the `LEVEL` of
	   * the `info`. This is based on the behavior of `winston@2` which also
	   * prepended the level onto the message.
	   *
	   * See: https://github.com/winstonjs/winston/blob/2.x/lib/winston/logger.js#L198-L201
	   *
	   * @param  {Info} info Logform info object
	   * @param  {Object} opts Options passed along to this instance.
	   * @returns {Info} Modified logform info object.
	   */
	  transform(info, opts) {
	    info.message = `${this.paddings[info[LEVEL]]}${info.message}`;
	    if (info[MESSAGE]) {
	      info[MESSAGE] = `${this.paddings[info[LEVEL]]}${info[MESSAGE]}`;
	    }

	    return info;
	  }
	}

	/*
	 * function padLevels (info)
	 * Returns a new instance of the padLevels Format which pads
	 * levels to be the same length. This was previously exposed as
	 * { padLevels: true } to transports in `winston < 3.0.0`.
	 */
	padLevels.exports = opts => new Padder(opts);

	padLevelsExports.Padder
	  = padLevelsExports.Format
	  = Padder;
	return padLevelsExports;
}

var hasRequiredCli;

function requireCli () {
	if (hasRequiredCli) return cliExports;
	hasRequiredCli = 1;

	const { Colorizer } = colorizeExports;
	const { Padder } = requirePadLevels();
	const { configs, MESSAGE } = tripleBeam;


	/**
	 * Cli format class that handles initial state for a a separate
	 * Colorizer and Padder instance.
	 */
	class CliFormat {
	  constructor(opts = {}) {
	    if (!opts.levels) {
	      opts.levels = configs.cli.levels;
	    }

	    this.colorizer = new Colorizer(opts);
	    this.padder = new Padder(opts);
	    this.options = opts;
	  }

	  /*
	   * function transform (info, opts)
	   * Attempts to both:
	   * 1. Pad the { level }
	   * 2. Colorize the { level, message }
	   * of the given `logform` info object depending on the `opts`.
	   */
	  transform(info, opts) {
	    this.colorizer.transform(
	      this.padder.transform(info, opts),
	      opts
	    );

	    info[MESSAGE] = `${info.level}:${info.message}`;
	    return info;
	  }
	}

	/*
	 * function cli (opts)
	 * Returns a new instance of the CLI format that turns a log
	 * `info` object into the same format previously available
	 * in `winston.cli()` in `winston < 3.0.0`.
	 */
	cli.exports = opts => new CliFormat(opts);

	//
	// Attach the CliFormat for registration purposes
	//
	cliExports.Format = CliFormat;
	return cliExports;
}

var combineExports = {};
var combine = {
  get exports(){ return combineExports; },
  set exports(v){ combineExports = v; },
};

var hasRequiredCombine;

function requireCombine () {
	if (hasRequiredCombine) return combineExports;
	hasRequiredCombine = 1;

	const format = requireFormat();

	/*
	 * function cascade(formats)
	 * Returns a function that invokes the `._format` function in-order
	 * for the specified set of `formats`. In this manner we say that Formats
	 * are "pipe-like", but not a pure pumpify implementation. Since there is no back
	 * pressure we can remove all of the "readable" plumbing in Node streams.
	 */
	function cascade(formats) {
	  if (!formats.every(isValidFormat)) {
	    return;
	  }

	  return info => {
	    let obj = info;
	    for (let i = 0; i < formats.length; i++) {
	      obj = formats[i].transform(obj, formats[i].options);
	      if (!obj) {
	        return false;
	      }
	    }

	    return obj;
	  };
	}

	/*
	 * function isValidFormat(format)
	 * If the format does not define a `transform` function throw an error
	 * with more detailed usage.
	 */
	function isValidFormat(fmt) {
	  if (typeof fmt.transform !== 'function') {
	    throw new Error([
	      'No transform function found on format. Did you create a format instance?',
	      'const myFormat = format(formatFn);',
	      'const instance = myFormat();'
	    ].join('\n'));
	  }

	  return true;
	}

	/*
	 * function combine (info)
	 * Returns a new instance of the combine Format which combines the specified
	 * formats into a new format. This is similar to a pipe-chain in transform streams.
	 * We choose to combine the prototypes this way because there is no back pressure in
	 * an in-memory transform chain.
	 */
	combine.exports = (...formats) => {
	  const combinedFormat = format(cascade(formats));
	  const instance = combinedFormat();
	  instance.Format = combinedFormat.Format;
	  return instance;
	};

	//
	// Export the cascade method for use in cli and other
	// combined formats that should not be assumed to be
	// singletons.
	//
	combineExports.cascade = cascade;
	return combineExports;
}

var safeStableStringifyExports = {};
var safeStableStringify = {
  get exports(){ return safeStableStringifyExports; },
  set exports(v){ safeStableStringifyExports = v; },
};

var hasRequiredSafeStableStringify;

function requireSafeStableStringify () {
	if (hasRequiredSafeStableStringify) return safeStableStringifyExports;
	hasRequiredSafeStableStringify = 1;
	(function (module, exports) {

		const { hasOwnProperty } = Object.prototype;

		const stringify = configure();

		// @ts-expect-error
		stringify.configure = configure;
		// @ts-expect-error
		stringify.stringify = stringify;

		// @ts-expect-error
		stringify.default = stringify;

		// @ts-expect-error used for named export
		exports.stringify = stringify;
		// @ts-expect-error used for named export
		exports.configure = configure;

		module.exports = stringify;

		// eslint-disable-next-line no-control-regex
		const strEscapeSequencesRegExp = /[\u0000-\u001f\u0022\u005c\ud800-\udfff]|[\ud800-\udbff](?![\udc00-\udfff])|(?:[^\ud800-\udbff]|^)[\udc00-\udfff]/;
		const strEscapeSequencesReplacer = new RegExp(strEscapeSequencesRegExp, 'g');

		// Escaped special characters. Use empty strings to fill up unused entries.
		const meta = [
		  '\\u0000', '\\u0001', '\\u0002', '\\u0003', '\\u0004',
		  '\\u0005', '\\u0006', '\\u0007', '\\b', '\\t',
		  '\\n', '\\u000b', '\\f', '\\r', '\\u000e',
		  '\\u000f', '\\u0010', '\\u0011', '\\u0012', '\\u0013',
		  '\\u0014', '\\u0015', '\\u0016', '\\u0017', '\\u0018',
		  '\\u0019', '\\u001a', '\\u001b', '\\u001c', '\\u001d',
		  '\\u001e', '\\u001f', '', '', '\\"',
		  '', '', '', '', '', '', '', '', '', '',
		  '', '', '', '', '', '', '', '', '', '',
		  '', '', '', '', '', '', '', '', '', '',
		  '', '', '', '', '', '', '', '', '', '',
		  '', '', '', '', '', '', '', '', '', '',
		  '', '', '', '', '', '', '', '\\\\'
		];

		function escapeFn (str) {
		  if (str.length === 2) {
		    const charCode = str.charCodeAt(1);
		    return `${str[0]}\\u${charCode.toString(16)}`
		  }
		  const charCode = str.charCodeAt(0);
		  return meta.length > charCode
		    ? meta[charCode]
		    : `\\u${charCode.toString(16)}`
		}

		// Escape C0 control characters, double quotes, the backslash and every code
		// unit with a numeric value in the inclusive range 0xD800 to 0xDFFF.
		function strEscape (str) {
		  // Some magic numbers that worked out fine while benchmarking with v8 8.0
		  if (str.length < 5000 && !strEscapeSequencesRegExp.test(str)) {
		    return str
		  }
		  if (str.length > 100) {
		    return str.replace(strEscapeSequencesReplacer, escapeFn)
		  }
		  let result = '';
		  let last = 0;
		  for (let i = 0; i < str.length; i++) {
		    const point = str.charCodeAt(i);
		    if (point === 34 || point === 92 || point < 32) {
		      result += `${str.slice(last, i)}${meta[point]}`;
		      last = i + 1;
		    } else if (point >= 0xd800 && point <= 0xdfff) {
		      if (point <= 0xdbff && i + 1 < str.length) {
		        const nextPoint = str.charCodeAt(i + 1);
		        if (nextPoint >= 0xdc00 && nextPoint <= 0xdfff) {
		          i++;
		          continue
		        }
		      }
		      result += `${str.slice(last, i)}\\u${point.toString(16)}`;
		      last = i + 1;
		    }
		  }
		  result += str.slice(last);
		  return result
		}

		function insertSort (array) {
		  // Insertion sort is very efficient for small input sizes but it has a bad
		  // worst case complexity. Thus, use native array sort for bigger values.
		  if (array.length > 2e2) {
		    return array.sort()
		  }
		  for (let i = 1; i < array.length; i++) {
		    const currentValue = array[i];
		    let position = i;
		    while (position !== 0 && array[position - 1] > currentValue) {
		      array[position] = array[position - 1];
		      position--;
		    }
		    array[position] = currentValue;
		  }
		  return array
		}

		const typedArrayPrototypeGetSymbolToStringTag =
		  Object.getOwnPropertyDescriptor(
		    Object.getPrototypeOf(
		      Object.getPrototypeOf(
		        new Int8Array()
		      )
		    ),
		    Symbol.toStringTag
		  ).get;

		function isTypedArrayWithEntries (value) {
		  return typedArrayPrototypeGetSymbolToStringTag.call(value) !== undefined && value.length !== 0
		}

		function stringifyTypedArray (array, separator, maximumBreadth) {
		  if (array.length < maximumBreadth) {
		    maximumBreadth = array.length;
		  }
		  const whitespace = separator === ',' ? '' : ' ';
		  let res = `"0":${whitespace}${array[0]}`;
		  for (let i = 1; i < maximumBreadth; i++) {
		    res += `${separator}"${i}":${whitespace}${array[i]}`;
		  }
		  return res
		}

		function getCircularValueOption (options) {
		  if (hasOwnProperty.call(options, 'circularValue')) {
		    const circularValue = options.circularValue;
		    if (typeof circularValue === 'string') {
		      return `"${circularValue}"`
		    }
		    if (circularValue == null) {
		      return circularValue
		    }
		    if (circularValue === Error || circularValue === TypeError) {
		      return {
		        toString () {
		          throw new TypeError('Converting circular structure to JSON')
		        }
		      }
		    }
		    throw new TypeError('The "circularValue" argument must be of type string or the value null or undefined')
		  }
		  return '"[Circular]"'
		}

		function getBooleanOption (options, key) {
		  let value;
		  if (hasOwnProperty.call(options, key)) {
		    value = options[key];
		    if (typeof value !== 'boolean') {
		      throw new TypeError(`The "${key}" argument must be of type boolean`)
		    }
		  }
		  return value === undefined ? true : value
		}

		function getPositiveIntegerOption (options, key) {
		  let value;
		  if (hasOwnProperty.call(options, key)) {
		    value = options[key];
		    if (typeof value !== 'number') {
		      throw new TypeError(`The "${key}" argument must be of type number`)
		    }
		    if (!Number.isInteger(value)) {
		      throw new TypeError(`The "${key}" argument must be an integer`)
		    }
		    if (value < 1) {
		      throw new RangeError(`The "${key}" argument must be >= 1`)
		    }
		  }
		  return value === undefined ? Infinity : value
		}

		function getItemCount (number) {
		  if (number === 1) {
		    return '1 item'
		  }
		  return `${number} items`
		}

		function getUniqueReplacerSet (replacerArray) {
		  const replacerSet = new Set();
		  for (const value of replacerArray) {
		    if (typeof value === 'string' || typeof value === 'number') {
		      replacerSet.add(String(value));
		    }
		  }
		  return replacerSet
		}

		function getStrictOption (options) {
		  if (hasOwnProperty.call(options, 'strict')) {
		    const value = options.strict;
		    if (typeof value !== 'boolean') {
		      throw new TypeError('The "strict" argument must be of type boolean')
		    }
		    if (value) {
		      return (value) => {
		        let message = `Object can not safely be stringified. Received type ${typeof value}`;
		        if (typeof value !== 'function') message += ` (${value.toString()})`;
		        throw new Error(message)
		      }
		    }
		  }
		}

		function configure (options) {
		  options = { ...options };
		  const fail = getStrictOption(options);
		  if (fail) {
		    if (options.bigint === undefined) {
		      options.bigint = false;
		    }
		    if (!('circularValue' in options)) {
		      options.circularValue = Error;
		    }
		  }
		  const circularValue = getCircularValueOption(options);
		  const bigint = getBooleanOption(options, 'bigint');
		  const deterministic = getBooleanOption(options, 'deterministic');
		  const maximumDepth = getPositiveIntegerOption(options, 'maximumDepth');
		  const maximumBreadth = getPositiveIntegerOption(options, 'maximumBreadth');

		  function stringifyFnReplacer (key, parent, stack, replacer, spacer, indentation) {
		    let value = parent[key];

		    if (typeof value === 'object' && value !== null && typeof value.toJSON === 'function') {
		      value = value.toJSON(key);
		    }
		    value = replacer.call(parent, key, value);

		    switch (typeof value) {
		      case 'string':
		        return `"${strEscape(value)}"`
		      case 'object': {
		        if (value === null) {
		          return 'null'
		        }
		        if (stack.indexOf(value) !== -1) {
		          return circularValue
		        }

		        let res = '';
		        let join = ',';
		        const originalIndentation = indentation;

		        if (Array.isArray(value)) {
		          if (value.length === 0) {
		            return '[]'
		          }
		          if (maximumDepth < stack.length + 1) {
		            return '"[Array]"'
		          }
		          stack.push(value);
		          if (spacer !== '') {
		            indentation += spacer;
		            res += `\n${indentation}`;
		            join = `,\n${indentation}`;
		          }
		          const maximumValuesToStringify = Math.min(value.length, maximumBreadth);
		          let i = 0;
		          for (; i < maximumValuesToStringify - 1; i++) {
		            const tmp = stringifyFnReplacer(i, value, stack, replacer, spacer, indentation);
		            res += tmp !== undefined ? tmp : 'null';
		            res += join;
		          }
		          const tmp = stringifyFnReplacer(i, value, stack, replacer, spacer, indentation);
		          res += tmp !== undefined ? tmp : 'null';
		          if (value.length - 1 > maximumBreadth) {
		            const removedKeys = value.length - maximumBreadth - 1;
		            res += `${join}"... ${getItemCount(removedKeys)} not stringified"`;
		          }
		          if (spacer !== '') {
		            res += `\n${originalIndentation}`;
		          }
		          stack.pop();
		          return `[${res}]`
		        }

		        let keys = Object.keys(value);
		        const keyLength = keys.length;
		        if (keyLength === 0) {
		          return '{}'
		        }
		        if (maximumDepth < stack.length + 1) {
		          return '"[Object]"'
		        }
		        let whitespace = '';
		        let separator = '';
		        if (spacer !== '') {
		          indentation += spacer;
		          join = `,\n${indentation}`;
		          whitespace = ' ';
		        }
		        let maximumPropertiesToStringify = Math.min(keyLength, maximumBreadth);
		        if (isTypedArrayWithEntries(value)) {
		          res += stringifyTypedArray(value, join, maximumBreadth);
		          keys = keys.slice(value.length);
		          maximumPropertiesToStringify -= value.length;
		          separator = join;
		        }
		        if (deterministic) {
		          keys = insertSort(keys);
		        }
		        stack.push(value);
		        for (let i = 0; i < maximumPropertiesToStringify; i++) {
		          const key = keys[i];
		          const tmp = stringifyFnReplacer(key, value, stack, replacer, spacer, indentation);
		          if (tmp !== undefined) {
		            res += `${separator}"${strEscape(key)}":${whitespace}${tmp}`;
		            separator = join;
		          }
		        }
		        if (keyLength > maximumBreadth) {
		          const removedKeys = keyLength - maximumBreadth;
		          res += `${separator}"...":${whitespace}"${getItemCount(removedKeys)} not stringified"`;
		          separator = join;
		        }
		        if (spacer !== '' && separator.length > 1) {
		          res = `\n${indentation}${res}\n${originalIndentation}`;
		        }
		        stack.pop();
		        return `{${res}}`
		      }
		      case 'number':
		        return isFinite(value) ? String(value) : fail ? fail(value) : 'null'
		      case 'boolean':
		        return value === true ? 'true' : 'false'
		      case 'undefined':
		        return undefined
		      case 'bigint':
		        if (bigint) {
		          return String(value)
		        }
		        // fallthrough
		      default:
		        return fail ? fail(value) : undefined
		    }
		  }

		  function stringifyArrayReplacer (key, value, stack, replacer, spacer, indentation) {
		    if (typeof value === 'object' && value !== null && typeof value.toJSON === 'function') {
		      value = value.toJSON(key);
		    }

		    switch (typeof value) {
		      case 'string':
		        return `"${strEscape(value)}"`
		      case 'object': {
		        if (value === null) {
		          return 'null'
		        }
		        if (stack.indexOf(value) !== -1) {
		          return circularValue
		        }

		        const originalIndentation = indentation;
		        let res = '';
		        let join = ',';

		        if (Array.isArray(value)) {
		          if (value.length === 0) {
		            return '[]'
		          }
		          if (maximumDepth < stack.length + 1) {
		            return '"[Array]"'
		          }
		          stack.push(value);
		          if (spacer !== '') {
		            indentation += spacer;
		            res += `\n${indentation}`;
		            join = `,\n${indentation}`;
		          }
		          const maximumValuesToStringify = Math.min(value.length, maximumBreadth);
		          let i = 0;
		          for (; i < maximumValuesToStringify - 1; i++) {
		            const tmp = stringifyArrayReplacer(i, value[i], stack, replacer, spacer, indentation);
		            res += tmp !== undefined ? tmp : 'null';
		            res += join;
		          }
		          const tmp = stringifyArrayReplacer(i, value[i], stack, replacer, spacer, indentation);
		          res += tmp !== undefined ? tmp : 'null';
		          if (value.length - 1 > maximumBreadth) {
		            const removedKeys = value.length - maximumBreadth - 1;
		            res += `${join}"... ${getItemCount(removedKeys)} not stringified"`;
		          }
		          if (spacer !== '') {
		            res += `\n${originalIndentation}`;
		          }
		          stack.pop();
		          return `[${res}]`
		        }
		        stack.push(value);
		        let whitespace = '';
		        if (spacer !== '') {
		          indentation += spacer;
		          join = `,\n${indentation}`;
		          whitespace = ' ';
		        }
		        let separator = '';
		        for (const key of replacer) {
		          const tmp = stringifyArrayReplacer(key, value[key], stack, replacer, spacer, indentation);
		          if (tmp !== undefined) {
		            res += `${separator}"${strEscape(key)}":${whitespace}${tmp}`;
		            separator = join;
		          }
		        }
		        if (spacer !== '' && separator.length > 1) {
		          res = `\n${indentation}${res}\n${originalIndentation}`;
		        }
		        stack.pop();
		        return `{${res}}`
		      }
		      case 'number':
		        return isFinite(value) ? String(value) : fail ? fail(value) : 'null'
		      case 'boolean':
		        return value === true ? 'true' : 'false'
		      case 'undefined':
		        return undefined
		      case 'bigint':
		        if (bigint) {
		          return String(value)
		        }
		        // fallthrough
		      default:
		        return fail ? fail(value) : undefined
		    }
		  }

		  function stringifyIndent (key, value, stack, spacer, indentation) {
		    switch (typeof value) {
		      case 'string':
		        return `"${strEscape(value)}"`
		      case 'object': {
		        if (value === null) {
		          return 'null'
		        }
		        if (typeof value.toJSON === 'function') {
		          value = value.toJSON(key);
		          // Prevent calling `toJSON` again.
		          if (typeof value !== 'object') {
		            return stringifyIndent(key, value, stack, spacer, indentation)
		          }
		          if (value === null) {
		            return 'null'
		          }
		        }
		        if (stack.indexOf(value) !== -1) {
		          return circularValue
		        }
		        const originalIndentation = indentation;

		        if (Array.isArray(value)) {
		          if (value.length === 0) {
		            return '[]'
		          }
		          if (maximumDepth < stack.length + 1) {
		            return '"[Array]"'
		          }
		          stack.push(value);
		          indentation += spacer;
		          let res = `\n${indentation}`;
		          const join = `,\n${indentation}`;
		          const maximumValuesToStringify = Math.min(value.length, maximumBreadth);
		          let i = 0;
		          for (; i < maximumValuesToStringify - 1; i++) {
		            const tmp = stringifyIndent(i, value[i], stack, spacer, indentation);
		            res += tmp !== undefined ? tmp : 'null';
		            res += join;
		          }
		          const tmp = stringifyIndent(i, value[i], stack, spacer, indentation);
		          res += tmp !== undefined ? tmp : 'null';
		          if (value.length - 1 > maximumBreadth) {
		            const removedKeys = value.length - maximumBreadth - 1;
		            res += `${join}"... ${getItemCount(removedKeys)} not stringified"`;
		          }
		          res += `\n${originalIndentation}`;
		          stack.pop();
		          return `[${res}]`
		        }

		        let keys = Object.keys(value);
		        const keyLength = keys.length;
		        if (keyLength === 0) {
		          return '{}'
		        }
		        if (maximumDepth < stack.length + 1) {
		          return '"[Object]"'
		        }
		        indentation += spacer;
		        const join = `,\n${indentation}`;
		        let res = '';
		        let separator = '';
		        let maximumPropertiesToStringify = Math.min(keyLength, maximumBreadth);
		        if (isTypedArrayWithEntries(value)) {
		          res += stringifyTypedArray(value, join, maximumBreadth);
		          keys = keys.slice(value.length);
		          maximumPropertiesToStringify -= value.length;
		          separator = join;
		        }
		        if (deterministic) {
		          keys = insertSort(keys);
		        }
		        stack.push(value);
		        for (let i = 0; i < maximumPropertiesToStringify; i++) {
		          const key = keys[i];
		          const tmp = stringifyIndent(key, value[key], stack, spacer, indentation);
		          if (tmp !== undefined) {
		            res += `${separator}"${strEscape(key)}": ${tmp}`;
		            separator = join;
		          }
		        }
		        if (keyLength > maximumBreadth) {
		          const removedKeys = keyLength - maximumBreadth;
		          res += `${separator}"...": "${getItemCount(removedKeys)} not stringified"`;
		          separator = join;
		        }
		        if (separator !== '') {
		          res = `\n${indentation}${res}\n${originalIndentation}`;
		        }
		        stack.pop();
		        return `{${res}}`
		      }
		      case 'number':
		        return isFinite(value) ? String(value) : fail ? fail(value) : 'null'
		      case 'boolean':
		        return value === true ? 'true' : 'false'
		      case 'undefined':
		        return undefined
		      case 'bigint':
		        if (bigint) {
		          return String(value)
		        }
		        // fallthrough
		      default:
		        return fail ? fail(value) : undefined
		    }
		  }

		  function stringifySimple (key, value, stack) {
		    switch (typeof value) {
		      case 'string':
		        return `"${strEscape(value)}"`
		      case 'object': {
		        if (value === null) {
		          return 'null'
		        }
		        if (typeof value.toJSON === 'function') {
		          value = value.toJSON(key);
		          // Prevent calling `toJSON` again
		          if (typeof value !== 'object') {
		            return stringifySimple(key, value, stack)
		          }
		          if (value === null) {
		            return 'null'
		          }
		        }
		        if (stack.indexOf(value) !== -1) {
		          return circularValue
		        }

		        let res = '';

		        if (Array.isArray(value)) {
		          if (value.length === 0) {
		            return '[]'
		          }
		          if (maximumDepth < stack.length + 1) {
		            return '"[Array]"'
		          }
		          stack.push(value);
		          const maximumValuesToStringify = Math.min(value.length, maximumBreadth);
		          let i = 0;
		          for (; i < maximumValuesToStringify - 1; i++) {
		            const tmp = stringifySimple(i, value[i], stack);
		            res += tmp !== undefined ? tmp : 'null';
		            res += ',';
		          }
		          const tmp = stringifySimple(i, value[i], stack);
		          res += tmp !== undefined ? tmp : 'null';
		          if (value.length - 1 > maximumBreadth) {
		            const removedKeys = value.length - maximumBreadth - 1;
		            res += `,"... ${getItemCount(removedKeys)} not stringified"`;
		          }
		          stack.pop();
		          return `[${res}]`
		        }

		        let keys = Object.keys(value);
		        const keyLength = keys.length;
		        if (keyLength === 0) {
		          return '{}'
		        }
		        if (maximumDepth < stack.length + 1) {
		          return '"[Object]"'
		        }
		        let separator = '';
		        let maximumPropertiesToStringify = Math.min(keyLength, maximumBreadth);
		        if (isTypedArrayWithEntries(value)) {
		          res += stringifyTypedArray(value, ',', maximumBreadth);
		          keys = keys.slice(value.length);
		          maximumPropertiesToStringify -= value.length;
		          separator = ',';
		        }
		        if (deterministic) {
		          keys = insertSort(keys);
		        }
		        stack.push(value);
		        for (let i = 0; i < maximumPropertiesToStringify; i++) {
		          const key = keys[i];
		          const tmp = stringifySimple(key, value[key], stack);
		          if (tmp !== undefined) {
		            res += `${separator}"${strEscape(key)}":${tmp}`;
		            separator = ',';
		          }
		        }
		        if (keyLength > maximumBreadth) {
		          const removedKeys = keyLength - maximumBreadth;
		          res += `${separator}"...":"${getItemCount(removedKeys)} not stringified"`;
		        }
		        stack.pop();
		        return `{${res}}`
		      }
		      case 'number':
		        return isFinite(value) ? String(value) : fail ? fail(value) : 'null'
		      case 'boolean':
		        return value === true ? 'true' : 'false'
		      case 'undefined':
		        return undefined
		      case 'bigint':
		        if (bigint) {
		          return String(value)
		        }
		        // fallthrough
		      default:
		        return fail ? fail(value) : undefined
		    }
		  }

		  function stringify (value, replacer, space) {
		    if (arguments.length > 1) {
		      let spacer = '';
		      if (typeof space === 'number') {
		        spacer = ' '.repeat(Math.min(space, 10));
		      } else if (typeof space === 'string') {
		        spacer = space.slice(0, 10);
		      }
		      if (replacer != null) {
		        if (typeof replacer === 'function') {
		          return stringifyFnReplacer('', { '': value }, [], replacer, spacer, '')
		        }
		        if (Array.isArray(replacer)) {
		          return stringifyArrayReplacer('', value, [], getUniqueReplacerSet(replacer), spacer, '')
		        }
		      }
		      if (spacer.length !== 0) {
		        return stringifyIndent('', value, [], spacer, '')
		      }
		    }
		    return stringifySimple('', value, [])
		  }

		  return stringify
		}
} (safeStableStringify, safeStableStringifyExports));
	return safeStableStringifyExports;
}

var json;
var hasRequiredJson;

function requireJson () {
	if (hasRequiredJson) return json;
	hasRequiredJson = 1;

	const format = requireFormat();
	const { MESSAGE } = tripleBeam;
	const stringify = requireSafeStableStringify();

	/*
	 * function replacer (key, value)
	 * Handles proper stringification of Buffer and bigint output.
	 */
	function replacer(key, value) {
	  // safe-stable-stringify does support BigInt, however, it doesn't wrap the value in quotes.
	  // Leading to a loss in fidelity if the resulting string is parsed.
	  // It would also be a breaking change for logform.
	  if (typeof value === 'bigint')
	    return value.toString();
	  return value;
	}

	/*
	 * function json (info)
	 * Returns a new instance of the JSON format that turns a log `info`
	 * object into pure JSON. This was previously exposed as { json: true }
	 * to transports in `winston < 3.0.0`.
	 */
	json = format((info, opts) => {
	  const jsonStringify = stringify.configure(opts);
	  info[MESSAGE] = jsonStringify(info, opts.replacer || replacer, opts.space);
	  return info;
	});
	return json;
}

var label;
var hasRequiredLabel;

function requireLabel () {
	if (hasRequiredLabel) return label;
	hasRequiredLabel = 1;

	const format = requireFormat();

	/*
	 * function label (info)
	 * Returns a new instance of the label Format which adds the specified
	 * `opts.label` before the message. This was previously exposed as
	 * { label: 'my label' } to transports in `winston < 3.0.0`.
	 */
	label = format((info, opts) => {
	  if (opts.message) {
	    info.message = `[${opts.label}] ${info.message}`;
	    return info;
	  }

	  info.label = opts.label;
	  return info;
	});
	return label;
}

var logstash;
var hasRequiredLogstash;

function requireLogstash () {
	if (hasRequiredLogstash) return logstash;
	hasRequiredLogstash = 1;

	const format = requireFormat();
	const { MESSAGE } = tripleBeam;
	const jsonStringify = requireSafeStableStringify();

	/*
	 * function logstash (info)
	 * Returns a new instance of the LogStash Format that turns a
	 * log `info` object into pure JSON with the appropriate logstash
	 * options. This was previously exposed as { logstash: true }
	 * to transports in `winston < 3.0.0`.
	 */
	logstash = format(info => {
	  const logstash = {};
	  if (info.message) {
	    logstash['@message'] = info.message;
	    delete info.message;
	  }

	  if (info.timestamp) {
	    logstash['@timestamp'] = info.timestamp;
	    delete info.timestamp;
	  }

	  logstash['@fields'] = info;
	  info[MESSAGE] = jsonStringify(logstash);
	  return info;
	});
	return logstash;
}

var metadata;
var hasRequiredMetadata;

function requireMetadata () {
	if (hasRequiredMetadata) return metadata;
	hasRequiredMetadata = 1;

	const format = requireFormat();

	function fillExcept(info, fillExceptKeys, metadataKey) {
	  const savedKeys = fillExceptKeys.reduce((acc, key) => {
	    acc[key] = info[key];
	    delete info[key];
	    return acc;
	  }, {});
	  const metadata = Object.keys(info).reduce((acc, key) => {
	    acc[key] = info[key];
	    delete info[key];
	    return acc;
	  }, {});

	  Object.assign(info, savedKeys, {
	    [metadataKey]: metadata
	  });
	  return info;
	}

	function fillWith(info, fillWithKeys, metadataKey) {
	  info[metadataKey] = fillWithKeys.reduce((acc, key) => {
	    acc[key] = info[key];
	    delete info[key];
	    return acc;
	  }, {});
	  return info;
	}

	/**
	 * Adds in a "metadata" object to collect extraneous data, similar to the metadata
	 * object in winston 2.x.
	 */
	metadata = format((info, opts = {}) => {
	  let metadataKey = 'metadata';
	  if (opts.key) {
	    metadataKey = opts.key;
	  }

	  let fillExceptKeys = [];
	  if (!opts.fillExcept && !opts.fillWith) {
	    fillExceptKeys.push('level');
	    fillExceptKeys.push('message');
	  }

	  if (opts.fillExcept) {
	    fillExceptKeys = opts.fillExcept;
	  }

	  if (fillExceptKeys.length > 0) {
	    return fillExcept(info, fillExceptKeys, metadataKey);
	  }

	  if (opts.fillWith) {
	    return fillWith(info, opts.fillWith, metadataKey);
	  }

	  return info;
	});
	return metadata;
}

/**
 * Helpers.
 */

var ms;
var hasRequiredMs$1;

function requireMs$1 () {
	if (hasRequiredMs$1) return ms;
	hasRequiredMs$1 = 1;
	var s = 1000;
	var m = s * 60;
	var h = m * 60;
	var d = h * 24;
	var w = d * 7;
	var y = d * 365.25;

	/**
	 * Parse or format the given `val`.
	 *
	 * Options:
	 *
	 *  - `long` verbose formatting [false]
	 *
	 * @param {String|Number} val
	 * @param {Object} [options]
	 * @throws {Error} throw an error if val is not a non-empty string or a number
	 * @return {String|Number}
	 * @api public
	 */

	ms = function (val, options) {
	  options = options || {};
	  var type = typeof val;
	  if (type === 'string' && val.length > 0) {
	    return parse(val);
	  } else if (type === 'number' && isFinite(val)) {
	    return options.long ? fmtLong(val) : fmtShort(val);
	  }
	  throw new Error(
	    'val is not a non-empty string or a valid number. val=' +
	      JSON.stringify(val)
	  );
	};

	/**
	 * Parse the given `str` and return milliseconds.
	 *
	 * @param {String} str
	 * @return {Number}
	 * @api private
	 */

	function parse(str) {
	  str = String(str);
	  if (str.length > 100) {
	    return;
	  }
	  var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
	    str
	  );
	  if (!match) {
	    return;
	  }
	  var n = parseFloat(match[1]);
	  var type = (match[2] || 'ms').toLowerCase();
	  switch (type) {
	    case 'years':
	    case 'year':
	    case 'yrs':
	    case 'yr':
	    case 'y':
	      return n * y;
	    case 'weeks':
	    case 'week':
	    case 'w':
	      return n * w;
	    case 'days':
	    case 'day':
	    case 'd':
	      return n * d;
	    case 'hours':
	    case 'hour':
	    case 'hrs':
	    case 'hr':
	    case 'h':
	      return n * h;
	    case 'minutes':
	    case 'minute':
	    case 'mins':
	    case 'min':
	    case 'm':
	      return n * m;
	    case 'seconds':
	    case 'second':
	    case 'secs':
	    case 'sec':
	    case 's':
	      return n * s;
	    case 'milliseconds':
	    case 'millisecond':
	    case 'msecs':
	    case 'msec':
	    case 'ms':
	      return n;
	    default:
	      return undefined;
	  }
	}

	/**
	 * Short format for `ms`.
	 *
	 * @param {Number} ms
	 * @return {String}
	 * @api private
	 */

	function fmtShort(ms) {
	  var msAbs = Math.abs(ms);
	  if (msAbs >= d) {
	    return Math.round(ms / d) + 'd';
	  }
	  if (msAbs >= h) {
	    return Math.round(ms / h) + 'h';
	  }
	  if (msAbs >= m) {
	    return Math.round(ms / m) + 'm';
	  }
	  if (msAbs >= s) {
	    return Math.round(ms / s) + 's';
	  }
	  return ms + 'ms';
	}

	/**
	 * Long format for `ms`.
	 *
	 * @param {Number} ms
	 * @return {String}
	 * @api private
	 */

	function fmtLong(ms) {
	  var msAbs = Math.abs(ms);
	  if (msAbs >= d) {
	    return plural(ms, msAbs, d, 'day');
	  }
	  if (msAbs >= h) {
	    return plural(ms, msAbs, h, 'hour');
	  }
	  if (msAbs >= m) {
	    return plural(ms, msAbs, m, 'minute');
	  }
	  if (msAbs >= s) {
	    return plural(ms, msAbs, s, 'second');
	  }
	  return ms + ' ms';
	}

	/**
	 * Pluralization helper.
	 */

	function plural(ms, msAbs, n, name) {
	  var isPlural = msAbs >= n * 1.5;
	  return Math.round(ms / n) + ' ' + name + (isPlural ? 's' : '');
	}
	return ms;
}

var ms_1;
var hasRequiredMs;

function requireMs () {
	if (hasRequiredMs) return ms_1;
	hasRequiredMs = 1;

	const format = requireFormat();
	const ms = requireMs$1();

	/*
	 * function ms (info)
	 * Returns an `info` with a `ms` property. The `ms` property holds the Value
	 * of the time difference between two calls in milliseconds.
	 */
	ms_1 = format(info => {
	  const curr = +new Date();
	  this.diff = curr - (this.prevTime || curr);
	  this.prevTime = curr;
	  info.ms = `+${ms(this.diff)}`;

	  return info;
	});
	return ms_1;
}

var prettyPrint;
var hasRequiredPrettyPrint;

function requirePrettyPrint () {
	if (hasRequiredPrettyPrint) return prettyPrint;
	hasRequiredPrettyPrint = 1;

	const inspect = require$$0__default$1["default"].inspect;
	const format = requireFormat();
	const { LEVEL, MESSAGE, SPLAT } = tripleBeam;

	/*
	 * function prettyPrint (info)
	 * Returns a new instance of the prettyPrint Format that "prettyPrint"
	 * serializes `info` objects. This was previously exposed as
	 * { prettyPrint: true } to transports in `winston < 3.0.0`.
	 */
	prettyPrint = format((info, opts = {}) => {
	  //
	  // info[{LEVEL, MESSAGE, SPLAT}] are enumerable here. Since they
	  // are internal, we remove them before util.inspect so they
	  // are not printed.
	  //
	  const stripped = Object.assign({}, info);

	  // Remark (indexzero): update this technique in April 2019
	  // when node@6 is EOL
	  delete stripped[LEVEL];
	  delete stripped[MESSAGE];
	  delete stripped[SPLAT];

	  info[MESSAGE] = inspect(stripped, false, opts.depth || null, opts.colorize);
	  return info;
	});
	return prettyPrint;
}

var printfExports = {};
var printf = {
  get exports(){ return printfExports; },
  set exports(v){ printfExports = v; },
};

var hasRequiredPrintf;

function requirePrintf () {
	if (hasRequiredPrintf) return printfExports;
	hasRequiredPrintf = 1;

	const { MESSAGE } = tripleBeam;

	class Printf {
	  constructor(templateFn) {
	    this.template = templateFn;
	  }

	  transform(info) {
	    info[MESSAGE] = this.template(info);
	    return info;
	  }
	}

	/*
	 * function printf (templateFn)
	 * Returns a new instance of the printf Format that creates an
	 * intermediate prototype to store the template string-based formatter
	 * function.
	 */
	printf.exports = opts => new Printf(opts);

	printfExports.Printf
	  = printfExports.Format
	  = Printf;
	return printfExports;
}

/* eslint no-undefined: 0 */

var simple;
var hasRequiredSimple;

function requireSimple () {
	if (hasRequiredSimple) return simple;
	hasRequiredSimple = 1;

	const format = requireFormat();
	const { MESSAGE } = tripleBeam;
	const jsonStringify = requireSafeStableStringify();

	/*
	 * function simple (info)
	 * Returns a new instance of the simple format TransformStream
	 * which writes a simple representation of logs.
	 *
	 *    const { level, message, splat, ...rest } = info;
	 *
	 *    ${level}: ${message}                            if rest is empty
	 *    ${level}: ${message} ${JSON.stringify(rest)}    otherwise
	 */
	simple = format(info => {
	  const stringifiedRest = jsonStringify(Object.assign({}, info, {
	    level: undefined,
	    message: undefined,
	    splat: undefined
	  }));

	  const padding = info.padding && info.padding[info.level] || '';
	  if (stringifiedRest !== '{}') {
	    info[MESSAGE] = `${info.level}:${padding} ${info.message} ${stringifiedRest}`;
	  } else {
	    info[MESSAGE] = `${info.level}:${padding} ${info.message}`;
	  }

	  return info;
	});
	return simple;
}

var splat;
var hasRequiredSplat;

function requireSplat () {
	if (hasRequiredSplat) return splat;
	hasRequiredSplat = 1;

	const util = require$$0__default$1["default"];
	const { SPLAT } = tripleBeam;

	/**
	 * Captures the number of format (i.e. %s strings) in a given string.
	 * Based on `util.format`, see Node.js source:
	 * https://github.com/nodejs/node/blob/b1c8f15c5f169e021f7c46eb7b219de95fe97603/lib/util.js#L201-L230
	 * @type {RegExp}
	 */
	const formatRegExp = /%[scdjifoO%]/g;

	/**
	 * Captures the number of escaped % signs in a format string (i.e. %s strings).
	 * @type {RegExp}
	 */
	const escapedPercent = /%%/g;

	class Splatter {
	  constructor(opts) {
	    this.options = opts;
	  }

	  /**
	     * Check to see if tokens <= splat.length, assign { splat, meta } into the
	     * `info` accordingly, and write to this instance.
	     *
	     * @param  {Info} info Logform info message.
	     * @param  {String[]} tokens Set of string interpolation tokens.
	     * @returns {Info} Modified info message
	     * @private
	     */
	  _splat(info, tokens) {
	    const msg = info.message;
	    const splat = info[SPLAT] || info.splat || [];
	    const percents = msg.match(escapedPercent);
	    const escapes = percents && percents.length || 0;

	    // The expected splat is the number of tokens minus the number of escapes
	    // e.g.
	    // - { expectedSplat: 3 } '%d %s %j'
	    // - { expectedSplat: 5 } '[%s] %d%% %d%% %s %j'
	    //
	    // Any "meta" will be arugments in addition to the expected splat size
	    // regardless of type. e.g.
	    //
	    // logger.log('info', '%d%% %s %j', 100, 'wow', { such: 'js' }, { thisIsMeta: true });
	    // would result in splat of four (4), but only three (3) are expected. Therefore:
	    //
	    // extraSplat = 3 - 4 = -1
	    // metas = [100, 'wow', { such: 'js' }, { thisIsMeta: true }].splice(-1, -1 * -1);
	    // splat = [100, 'wow', { such: 'js' }]
	    const expectedSplat = tokens.length - escapes;
	    const extraSplat = expectedSplat - splat.length;
	    const metas = extraSplat < 0
	      ? splat.splice(extraSplat, -1 * extraSplat)
	      : [];

	    // Now that { splat } has been separated from any potential { meta }. we
	    // can assign this to the `info` object and write it to our format stream.
	    // If the additional metas are **NOT** objects or **LACK** enumerable properties
	    // you are going to have a bad time.
	    const metalen = metas.length;
	    if (metalen) {
	      for (let i = 0; i < metalen; i++) {
	        Object.assign(info, metas[i]);
	      }
	    }

	    info.message = util.format(msg, ...splat);
	    return info;
	  }

	  /**
	    * Transforms the `info` message by using `util.format` to complete
	    * any `info.message` provided it has string interpolation tokens.
	    * If no tokens exist then `info` is immutable.
	    *
	    * @param  {Info} info Logform info message.
	    * @param  {Object} opts Options for this instance.
	    * @returns {Info} Modified info message
	    */
	  transform(info) {
	    const msg = info.message;
	    const splat = info[SPLAT] || info.splat;

	    // No need to process anything if splat is undefined
	    if (!splat || !splat.length) {
	      return info;
	    }

	    // Extract tokens, if none available default to empty array to
	    // ensure consistancy in expected results
	    const tokens = msg && msg.match && msg.match(formatRegExp);

	    // This condition will take care of inputs with info[SPLAT]
	    // but no tokens present
	    if (!tokens && (splat || splat.length)) {
	      const metas = splat.length > 1
	        ? splat.splice(0)
	        : splat;

	      // Now that { splat } has been separated from any potential { meta }. we
	      // can assign this to the `info` object and write it to our format stream.
	      // If the additional metas are **NOT** objects or **LACK** enumerable properties
	      // you are going to have a bad time.
	      const metalen = metas.length;
	      if (metalen) {
	        for (let i = 0; i < metalen; i++) {
	          Object.assign(info, metas[i]);
	        }
	      }

	      return info;
	    }

	    if (tokens) {
	      return this._splat(info, tokens);
	    }

	    return info;
	  }
	}

	/*
	 * function splat (info)
	 * Returns a new instance of the splat format TransformStream
	 * which performs string interpolation from `info` objects. This was
	 * previously exposed implicitly in `winston < 3.0.0`.
	 */
	splat = opts => new Splatter(opts);
	return splat;
}

var token = /d{1,4}|M{1,4}|YY(?:YY)?|S{1,3}|Do|ZZ|Z|([HhMsDm])\1?|[aA]|"[^"]*"|'[^']*'/g;
var twoDigitsOptional = "\\d\\d?";
var twoDigits = "\\d\\d";
var threeDigits = "\\d{3}";
var fourDigits = "\\d{4}";
var word = "[^\\s]+";
var literal = /\[([^]*?)\]/gm;
function shorten(arr, sLen) {
    var newArr = [];
    for (var i = 0, len = arr.length; i < len; i++) {
        newArr.push(arr[i].substr(0, sLen));
    }
    return newArr;
}
var monthUpdate = function (arrName) { return function (v, i18n) {
    var lowerCaseArr = i18n[arrName].map(function (v) { return v.toLowerCase(); });
    var index = lowerCaseArr.indexOf(v.toLowerCase());
    if (index > -1) {
        return index;
    }
    return null;
}; };
function assign(origObj) {
    var args = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
    }
    for (var _a = 0, args_1 = args; _a < args_1.length; _a++) {
        var obj = args_1[_a];
        for (var key in obj) {
            // @ts-ignore ex
            origObj[key] = obj[key];
        }
    }
    return origObj;
}
var dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
];
var monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
];
var monthNamesShort = shorten(monthNames, 3);
var dayNamesShort = shorten(dayNames, 3);
var defaultI18n = {
    dayNamesShort: dayNamesShort,
    dayNames: dayNames,
    monthNamesShort: monthNamesShort,
    monthNames: monthNames,
    amPm: ["am", "pm"],
    DoFn: function (dayOfMonth) {
        return (dayOfMonth +
            ["th", "st", "nd", "rd"][dayOfMonth % 10 > 3
                ? 0
                : ((dayOfMonth - (dayOfMonth % 10) !== 10 ? 1 : 0) * dayOfMonth) % 10]);
    }
};
var globalI18n = assign({}, defaultI18n);
var setGlobalDateI18n = function (i18n) {
    return (globalI18n = assign(globalI18n, i18n));
};
var regexEscape = function (str) {
    return str.replace(/[|\\{()[^$+*?.-]/g, "\\$&");
};
var pad = function (val, len) {
    if (len === void 0) { len = 2; }
    val = String(val);
    while (val.length < len) {
        val = "0" + val;
    }
    return val;
};
var formatFlags = {
    D: function (dateObj) { return String(dateObj.getDate()); },
    DD: function (dateObj) { return pad(dateObj.getDate()); },
    Do: function (dateObj, i18n) {
        return i18n.DoFn(dateObj.getDate());
    },
    d: function (dateObj) { return String(dateObj.getDay()); },
    dd: function (dateObj) { return pad(dateObj.getDay()); },
    ddd: function (dateObj, i18n) {
        return i18n.dayNamesShort[dateObj.getDay()];
    },
    dddd: function (dateObj, i18n) {
        return i18n.dayNames[dateObj.getDay()];
    },
    M: function (dateObj) { return String(dateObj.getMonth() + 1); },
    MM: function (dateObj) { return pad(dateObj.getMonth() + 1); },
    MMM: function (dateObj, i18n) {
        return i18n.monthNamesShort[dateObj.getMonth()];
    },
    MMMM: function (dateObj, i18n) {
        return i18n.monthNames[dateObj.getMonth()];
    },
    YY: function (dateObj) {
        return pad(String(dateObj.getFullYear()), 4).substr(2);
    },
    YYYY: function (dateObj) { return pad(dateObj.getFullYear(), 4); },
    h: function (dateObj) { return String(dateObj.getHours() % 12 || 12); },
    hh: function (dateObj) { return pad(dateObj.getHours() % 12 || 12); },
    H: function (dateObj) { return String(dateObj.getHours()); },
    HH: function (dateObj) { return pad(dateObj.getHours()); },
    m: function (dateObj) { return String(dateObj.getMinutes()); },
    mm: function (dateObj) { return pad(dateObj.getMinutes()); },
    s: function (dateObj) { return String(dateObj.getSeconds()); },
    ss: function (dateObj) { return pad(dateObj.getSeconds()); },
    S: function (dateObj) {
        return String(Math.round(dateObj.getMilliseconds() / 100));
    },
    SS: function (dateObj) {
        return pad(Math.round(dateObj.getMilliseconds() / 10), 2);
    },
    SSS: function (dateObj) { return pad(dateObj.getMilliseconds(), 3); },
    a: function (dateObj, i18n) {
        return dateObj.getHours() < 12 ? i18n.amPm[0] : i18n.amPm[1];
    },
    A: function (dateObj, i18n) {
        return dateObj.getHours() < 12
            ? i18n.amPm[0].toUpperCase()
            : i18n.amPm[1].toUpperCase();
    },
    ZZ: function (dateObj) {
        var offset = dateObj.getTimezoneOffset();
        return ((offset > 0 ? "-" : "+") +
            pad(Math.floor(Math.abs(offset) / 60) * 100 + (Math.abs(offset) % 60), 4));
    },
    Z: function (dateObj) {
        var offset = dateObj.getTimezoneOffset();
        return ((offset > 0 ? "-" : "+") +
            pad(Math.floor(Math.abs(offset) / 60), 2) +
            ":" +
            pad(Math.abs(offset) % 60, 2));
    }
};
var monthParse = function (v) { return +v - 1; };
var emptyDigits = [null, twoDigitsOptional];
var emptyWord = [null, word];
var amPm = [
    "isPm",
    word,
    function (v, i18n) {
        var val = v.toLowerCase();
        if (val === i18n.amPm[0]) {
            return 0;
        }
        else if (val === i18n.amPm[1]) {
            return 1;
        }
        return null;
    }
];
var timezoneOffset = [
    "timezoneOffset",
    "[^\\s]*?[\\+\\-]\\d\\d:?\\d\\d|[^\\s]*?Z?",
    function (v) {
        var parts = (v + "").match(/([+-]|\d\d)/gi);
        if (parts) {
            var minutes = +parts[1] * 60 + parseInt(parts[2], 10);
            return parts[0] === "+" ? minutes : -minutes;
        }
        return 0;
    }
];
var parseFlags = {
    D: ["day", twoDigitsOptional],
    DD: ["day", twoDigits],
    Do: ["day", twoDigitsOptional + word, function (v) { return parseInt(v, 10); }],
    M: ["month", twoDigitsOptional, monthParse],
    MM: ["month", twoDigits, monthParse],
    YY: [
        "year",
        twoDigits,
        function (v) {
            var now = new Date();
            var cent = +("" + now.getFullYear()).substr(0, 2);
            return +("" + (+v > 68 ? cent - 1 : cent) + v);
        }
    ],
    h: ["hour", twoDigitsOptional, undefined, "isPm"],
    hh: ["hour", twoDigits, undefined, "isPm"],
    H: ["hour", twoDigitsOptional],
    HH: ["hour", twoDigits],
    m: ["minute", twoDigitsOptional],
    mm: ["minute", twoDigits],
    s: ["second", twoDigitsOptional],
    ss: ["second", twoDigits],
    YYYY: ["year", fourDigits],
    S: ["millisecond", "\\d", function (v) { return +v * 100; }],
    SS: ["millisecond", twoDigits, function (v) { return +v * 10; }],
    SSS: ["millisecond", threeDigits],
    d: emptyDigits,
    dd: emptyDigits,
    ddd: emptyWord,
    dddd: emptyWord,
    MMM: ["month", word, monthUpdate("monthNamesShort")],
    MMMM: ["month", word, monthUpdate("monthNames")],
    a: amPm,
    A: amPm,
    ZZ: timezoneOffset,
    Z: timezoneOffset
};
// Some common format strings
var globalMasks = {
    default: "ddd MMM DD YYYY HH:mm:ss",
    shortDate: "M/D/YY",
    mediumDate: "MMM D, YYYY",
    longDate: "MMMM D, YYYY",
    fullDate: "dddd, MMMM D, YYYY",
    isoDate: "YYYY-MM-DD",
    isoDateTime: "YYYY-MM-DDTHH:mm:ssZ",
    shortTime: "HH:mm",
    mediumTime: "HH:mm:ss",
    longTime: "HH:mm:ss.SSS"
};
var setGlobalDateMasks = function (masks) { return assign(globalMasks, masks); };
/***
 * Format a date
 * @method format
 * @param {Date|number} dateObj
 * @param {string} mask Format of the date, i.e. 'mm-dd-yy' or 'shortDate'
 * @returns {string} Formatted date string
 */
var format$1 = function (dateObj, mask, i18n) {
    if (mask === void 0) { mask = globalMasks["default"]; }
    if (i18n === void 0) { i18n = {}; }
    if (typeof dateObj === "number") {
        dateObj = new Date(dateObj);
    }
    if (Object.prototype.toString.call(dateObj) !== "[object Date]" ||
        isNaN(dateObj.getTime())) {
        throw new Error("Invalid Date pass to format");
    }
    mask = globalMasks[mask] || mask;
    var literals = [];
    // Make literals inactive by replacing them with @@@
    mask = mask.replace(literal, function ($0, $1) {
        literals.push($1);
        return "@@@";
    });
    var combinedI18nSettings = assign(assign({}, globalI18n), i18n);
    // Apply formatting rules
    mask = mask.replace(token, function ($0) {
        return formatFlags[$0](dateObj, combinedI18nSettings);
    });
    // Inline literal values back into the formatted value
    return mask.replace(/@@@/g, function () { return literals.shift(); });
};
/**
 * Parse a date string into a Javascript Date object /
 * @method parse
 * @param {string} dateStr Date string
 * @param {string} format Date parse format
 * @param {i18n} I18nSettingsOptional Full or subset of I18N settings
 * @returns {Date|null} Returns Date object. Returns null what date string is invalid or doesn't match format
 */
function parse(dateStr, format, i18n) {
    if (i18n === void 0) { i18n = {}; }
    if (typeof format !== "string") {
        throw new Error("Invalid format in fecha parse");
    }
    // Check to see if the format is actually a mask
    format = globalMasks[format] || format;
    // Avoid regular expression denial of service, fail early for really long strings
    // https://www.owasp.org/index.php/Regular_expression_Denial_of_Service_-_ReDoS
    if (dateStr.length > 1000) {
        return null;
    }
    // Default to the beginning of the year.
    var today = new Date();
    var dateInfo = {
        year: today.getFullYear(),
        month: 0,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
        isPm: null,
        timezoneOffset: null
    };
    var parseInfo = [];
    var literals = [];
    // Replace all the literals with @@@. Hopefully a string that won't exist in the format
    var newFormat = format.replace(literal, function ($0, $1) {
        literals.push(regexEscape($1));
        return "@@@";
    });
    var specifiedFields = {};
    var requiredFields = {};
    // Change every token that we find into the correct regex
    newFormat = regexEscape(newFormat).replace(token, function ($0) {
        var info = parseFlags[$0];
        var field = info[0], regex = info[1], requiredField = info[3];
        // Check if the person has specified the same field twice. This will lead to confusing results.
        if (specifiedFields[field]) {
            throw new Error("Invalid format. " + field + " specified twice in format");
        }
        specifiedFields[field] = true;
        // Check if there are any required fields. For instance, 12 hour time requires AM/PM specified
        if (requiredField) {
            requiredFields[requiredField] = true;
        }
        parseInfo.push(info);
        return "(" + regex + ")";
    });
    // Check all the required fields are present
    Object.keys(requiredFields).forEach(function (field) {
        if (!specifiedFields[field]) {
            throw new Error("Invalid format. " + field + " is required in specified format");
        }
    });
    // Add back all the literals after
    newFormat = newFormat.replace(/@@@/g, function () { return literals.shift(); });
    // Check if the date string matches the format. If it doesn't return null
    var matches = dateStr.match(new RegExp(newFormat, "i"));
    if (!matches) {
        return null;
    }
    var combinedI18nSettings = assign(assign({}, globalI18n), i18n);
    // For each match, call the parser function for that date part
    for (var i = 1; i < matches.length; i++) {
        var _a = parseInfo[i - 1], field = _a[0], parser = _a[2];
        var value = parser
            ? parser(matches[i], combinedI18nSettings)
            : +matches[i];
        // If the parser can't make sense of the value, return null
        if (value == null) {
            return null;
        }
        dateInfo[field] = value;
    }
    if (dateInfo.isPm === 1 && dateInfo.hour != null && +dateInfo.hour !== 12) {
        dateInfo.hour = +dateInfo.hour + 12;
    }
    else if (dateInfo.isPm === 0 && +dateInfo.hour === 12) {
        dateInfo.hour = 0;
    }
    var dateTZ;
    if (dateInfo.timezoneOffset == null) {
        dateTZ = new Date(dateInfo.year, dateInfo.month, dateInfo.day, dateInfo.hour, dateInfo.minute, dateInfo.second, dateInfo.millisecond);
        var validateFields = [
            ["month", "getMonth"],
            ["day", "getDate"],
            ["hour", "getHours"],
            ["minute", "getMinutes"],
            ["second", "getSeconds"]
        ];
        for (var i = 0, len = validateFields.length; i < len; i++) {
            // Check to make sure the date field is within the allowed range. Javascript dates allows values
            // outside the allowed range. If the values don't match the value was invalid
            if (specifiedFields[validateFields[i][0]] &&
                dateInfo[validateFields[i][0]] !== dateTZ[validateFields[i][1]]()) {
                return null;
            }
        }
    }
    else {
        dateTZ = new Date(Date.UTC(dateInfo.year, dateInfo.month, dateInfo.day, dateInfo.hour, dateInfo.minute - dateInfo.timezoneOffset, dateInfo.second, dateInfo.millisecond));
        // We can't validate dates in another timezone unfortunately. Do a basic check instead
        if (dateInfo.month > 11 ||
            dateInfo.month < 0 ||
            dateInfo.day > 31 ||
            dateInfo.day < 1 ||
            dateInfo.hour > 23 ||
            dateInfo.hour < 0 ||
            dateInfo.minute > 59 ||
            dateInfo.minute < 0 ||
            dateInfo.second > 59 ||
            dateInfo.second < 0) {
            return null;
        }
    }
    // Don't allow invalid dates
    return dateTZ;
}
var fecha = {
    format: format$1,
    parse: parse,
    defaultI18n: defaultI18n,
    setGlobalDateI18n: setGlobalDateI18n,
    setGlobalDateMasks: setGlobalDateMasks
};

var fecha$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    'default': fecha,
    assign: assign,
    format: format$1,
    parse: parse,
    defaultI18n: defaultI18n,
    setGlobalDateI18n: setGlobalDateI18n,
    setGlobalDateMasks: setGlobalDateMasks
});

var require$$0 = /*@__PURE__*/getAugmentedNamespace(fecha$1);

var timestamp;
var hasRequiredTimestamp;

function requireTimestamp () {
	if (hasRequiredTimestamp) return timestamp;
	hasRequiredTimestamp = 1;

	const fecha = require$$0;
	const format = requireFormat();

	/*
	 * function timestamp (info)
	 * Returns a new instance of the timestamp Format which adds a timestamp
	 * to the info. It was previously available in winston < 3.0.0 as:
	 *
	 * - { timestamp: true }             // `new Date.toISOString()`
	 * - { timestamp: function:String }  // Value returned by `timestamp()`
	 */
	timestamp = format((info, opts = {}) => {
	  if (opts.format) {
	    info.timestamp = typeof opts.format === 'function'
	      ? opts.format()
	      : fecha.format(new Date(), opts.format);
	  }

	  if (!info.timestamp) {
	    info.timestamp = new Date().toISOString();
	  }

	  if (opts.alias) {
	    info[opts.alias] = info.timestamp;
	  }

	  return info;
	});
	return timestamp;
}

var uncolorize;
var hasRequiredUncolorize;

function requireUncolorize () {
	if (hasRequiredUncolorize) return uncolorize;
	hasRequiredUncolorize = 1;

	const colors = safeExports;
	const format = requireFormat();
	const { MESSAGE } = tripleBeam;

	/*
	 * function uncolorize (info)
	 * Returns a new instance of the uncolorize Format that strips colors
	 * from `info` objects. This was previously exposed as { stripColors: true }
	 * to transports in `winston < 3.0.0`.
	 */
	uncolorize = format((info, opts) => {
	  if (opts.level !== false) {
	    info.level = colors.strip(info.level);
	  }

	  if (opts.message !== false) {
	    info.message = colors.strip(String(info.message));
	  }

	  if (opts.raw !== false && info[MESSAGE]) {
	    info[MESSAGE] = colors.strip(String(info[MESSAGE]));
	  }

	  return info;
	});
	return uncolorize;
}

/*
 * @api public
 * @property {function} format
 * Both the construction method and set of exposed
 * formats.
 */
const format = logform$1.format = requireFormat();

/*
 * @api public
 * @method {function} levels
 * Registers the specified levels with logform.
 */
logform$1.levels = levels;

/*
 * @api private
 * method {function} exposeFormat
 * Exposes a sub-format on the main format object
 * as a lazy-loaded getter.
 */
function exposeFormat(name, requireFormat) {
  Object.defineProperty(format, name, {
    get() {
      return requireFormat();
    },
    configurable: true
  });
}

//
// Setup all transports as lazy-loaded getters.
//
exposeFormat('align', function () { return requireAlign(); });
exposeFormat('errors', function () { return requireErrors$1(); });
exposeFormat('cli', function () { return requireCli(); });
exposeFormat('combine', function () { return requireCombine(); });
exposeFormat('colorize', function () { return colorizeExports; });
exposeFormat('json', function () { return requireJson(); });
exposeFormat('label', function () { return requireLabel(); });
exposeFormat('logstash', function () { return requireLogstash(); });
exposeFormat('metadata', function () { return requireMetadata(); });
exposeFormat('ms', function () { return requireMs(); });
exposeFormat('padLevels', function () { return requirePadLevels(); });
exposeFormat('prettyPrint', function () { return requirePrettyPrint(); });
exposeFormat('printf', function () { return requirePrintf(); });
exposeFormat('simple', function () { return requireSimple(); });
exposeFormat('splat', function () { return requireSplat(); });
exposeFormat('timestamp', function () { return requireTimestamp(); });
exposeFormat('uncolorize', function () { return requireUncolorize(); });

var common = {};

/**
 * common.js: Internal helper and utility functions for winston.
 *
 * (C) 2010 Charlie Robbins
 * MIT LICENCE
 */

(function (exports) {

	const { format } = require$$0__default$1["default"];

	/**
	 * Set of simple deprecation notices and a way to expose them for a set of
	 * properties.
	 * @type {Object}
	 * @private
	 */
	exports.warn = {
	  deprecated(prop) {
	    return () => {
	      throw new Error(format('{ %s } was removed in winston@3.0.0.', prop));
	    };
	  },
	  useFormat(prop) {
	    return () => {
	      throw new Error([
	        format('{ %s } was removed in winston@3.0.0.', prop),
	        'Use a custom winston.format = winston.format(function) instead.'
	      ].join('\n'));
	    };
	  },
	  forFunctions(obj, type, props) {
	    props.forEach(prop => {
	      obj[prop] = exports.warn[type](prop);
	    });
	  },
	  moved(obj, movedTo, prop) {
	    function movedNotice() {
	      return () => {
	        throw new Error([
	          format('winston.%s was moved in winston@3.0.0.', prop),
	          format('Use a winston.%s instead.', movedTo)
	        ].join('\n'));
	      };
	    }

	    Object.defineProperty(obj, prop, {
	      get: movedNotice,
	      set: movedNotice
	    });
	  },
	  forProperties(obj, type, props) {
	    props.forEach(prop => {
	      const notice = exports.warn[type](prop);
	      Object.defineProperty(obj, prop, {
	        get: notice,
	        set: notice
	      });
	    });
	  }
	};
} (common));

var name$1 = "winston";
var description = "A logger for just about everything.";
var version = "3.8.2";
var author = "Charlie Robbins <charlie.robbins@gmail.com>";
var maintainers = [
	"David Hyde <dabh@alumni.stanford.edu>"
];
var repository = {
	type: "git",
	url: "https://github.com/winstonjs/winston.git"
};
var keywords = [
	"winston",
	"logger",
	"logging",
	"logs",
	"sysadmin",
	"bunyan",
	"pino",
	"loglevel",
	"tools",
	"json",
	"stream"
];
var dependencies = {
	"@dabh/diagnostics": "^2.0.2",
	"@colors/colors": "1.5.0",
	async: "^3.2.3",
	"is-stream": "^2.0.0",
	logform: "^2.4.0",
	"one-time": "^1.0.0",
	"readable-stream": "^3.4.0",
	"safe-stable-stringify": "^2.3.1",
	"stack-trace": "0.0.x",
	"triple-beam": "^1.3.0",
	"winston-transport": "^4.5.0"
};
var devDependencies = {
	"@babel/cli": "^7.17.0",
	"@babel/core": "^7.17.2",
	"@babel/preset-env": "^7.16.7",
	"@dabh/eslint-config-populist": "^5.0.0",
	"@types/node": "^18.0.0",
	"abstract-winston-transport": "^0.5.1",
	assume: "^2.2.0",
	"cross-spawn-async": "^2.2.5",
	eslint: "^8.9.0",
	hock: "^1.4.1",
	mocha: "8.1.3",
	nyc: "^15.1.0",
	rimraf: "^3.0.2",
	split2: "^4.1.0",
	"std-mocks": "^1.0.1",
	through2: "^4.0.2",
	"winston-compat": "^0.1.5"
};
var main = "./lib/winston.js";
var browser = "./dist/winston";
var types = "./index.d.ts";
var scripts = {
	lint: "eslint lib/*.js lib/winston/*.js lib/winston/**/*.js --resolve-plugins-relative-to ./node_modules/@dabh/eslint-config-populist",
	test: "mocha",
	"test:coverage": "nyc npm run test:unit",
	"test:unit": "mocha test/unit",
	"test:integration": "mocha test/integration",
	build: "rimraf dist && babel lib -d dist",
	prepublishOnly: "npm run build"
};
var engines = {
	node: ">= 12.0.0"
};
var license = "MIT";
var require$$2 = {
	name: name$1,
	description: description,
	version: version,
	author: author,
	maintainers: maintainers,
	repository: repository,
	keywords: keywords,
	dependencies: dependencies,
	devDependencies: devDependencies,
	main: main,
	browser: browser,
	types: types,
	scripts: scripts,
	engines: engines,
	license: license
};

var transports = {};

var winstonTransportExports = {};
var winstonTransport = {
  get exports(){ return winstonTransportExports; },
  set exports(v){ winstonTransportExports = v; },
};

var node$1;
var hasRequiredNode;

function requireNode () {
	if (hasRequiredNode) return node$1;
	hasRequiredNode = 1;
	/**
	 * For Node.js, simply re-export the core `util.deprecate` function.
	 */

	node$1 = require$$0__default$1["default"].deprecate;
	return node$1;
}

var streamExports = {};
var stream$1 = {
  get exports(){ return streamExports; },
  set exports(v){ streamExports = v; },
};

var hasRequiredStream$1;

function requireStream$1 () {
	if (hasRequiredStream$1) return streamExports;
	hasRequiredStream$1 = 1;
	(function (module) {
		module.exports = require$$0__default$2["default"];
} (stream$1));
	return streamExports;
}

var destroy_1;
var hasRequiredDestroy;

function requireDestroy () {
	if (hasRequiredDestroy) return destroy_1;
	hasRequiredDestroy = 1;

	function destroy(err, cb) {
	  var _this = this;

	  var readableDestroyed = this._readableState && this._readableState.destroyed;
	  var writableDestroyed = this._writableState && this._writableState.destroyed;

	  if (readableDestroyed || writableDestroyed) {
	    if (cb) {
	      cb(err);
	    } else if (err) {
	      if (!this._writableState) {
	        process.nextTick(emitErrorNT, this, err);
	      } else if (!this._writableState.errorEmitted) {
	        this._writableState.errorEmitted = true;
	        process.nextTick(emitErrorNT, this, err);
	      }
	    }

	    return this;
	  } // we set destroyed to true before firing error callbacks in order
	  // to make it re-entrance safe in case destroy() is called within callbacks


	  if (this._readableState) {
	    this._readableState.destroyed = true;
	  } // if this is a duplex stream mark the writable part as destroyed as well


	  if (this._writableState) {
	    this._writableState.destroyed = true;
	  }

	  this._destroy(err || null, function (err) {
	    if (!cb && err) {
	      if (!_this._writableState) {
	        process.nextTick(emitErrorAndCloseNT, _this, err);
	      } else if (!_this._writableState.errorEmitted) {
	        _this._writableState.errorEmitted = true;
	        process.nextTick(emitErrorAndCloseNT, _this, err);
	      } else {
	        process.nextTick(emitCloseNT, _this);
	      }
	    } else if (cb) {
	      process.nextTick(emitCloseNT, _this);
	      cb(err);
	    } else {
	      process.nextTick(emitCloseNT, _this);
	    }
	  });

	  return this;
	}

	function emitErrorAndCloseNT(self, err) {
	  emitErrorNT(self, err);
	  emitCloseNT(self);
	}

	function emitCloseNT(self) {
	  if (self._writableState && !self._writableState.emitClose) return;
	  if (self._readableState && !self._readableState.emitClose) return;
	  self.emit('close');
	}

	function undestroy() {
	  if (this._readableState) {
	    this._readableState.destroyed = false;
	    this._readableState.reading = false;
	    this._readableState.ended = false;
	    this._readableState.endEmitted = false;
	  }

	  if (this._writableState) {
	    this._writableState.destroyed = false;
	    this._writableState.ended = false;
	    this._writableState.ending = false;
	    this._writableState.finalCalled = false;
	    this._writableState.prefinished = false;
	    this._writableState.finished = false;
	    this._writableState.errorEmitted = false;
	  }
	}

	function emitErrorNT(self, err) {
	  self.emit('error', err);
	}

	function errorOrDestroy(stream, err) {
	  // We have tests that rely on errors being emitted
	  // in the same tick, so changing this is semver major.
	  // For now when you opt-in to autoDestroy we allow
	  // the error to be emitted nextTick. In a future
	  // semver major update we should change the default to this.
	  var rState = stream._readableState;
	  var wState = stream._writableState;
	  if (rState && rState.autoDestroy || wState && wState.autoDestroy) stream.destroy(err);else stream.emit('error', err);
	}

	destroy_1 = {
	  destroy: destroy,
	  undestroy: undestroy,
	  errorOrDestroy: errorOrDestroy
	};
	return destroy_1;
}

var errors = {};

var hasRequiredErrors;

function requireErrors () {
	if (hasRequiredErrors) return errors;
	hasRequiredErrors = 1;

	const codes = {};

	function createErrorType(code, message, Base) {
	  if (!Base) {
	    Base = Error;
	  }

	  function getMessage (arg1, arg2, arg3) {
	    if (typeof message === 'string') {
	      return message
	    } else {
	      return message(arg1, arg2, arg3)
	    }
	  }

	  class NodeError extends Base {
	    constructor (arg1, arg2, arg3) {
	      super(getMessage(arg1, arg2, arg3));
	    }
	  }

	  NodeError.prototype.name = Base.name;
	  NodeError.prototype.code = code;

	  codes[code] = NodeError;
	}

	// https://github.com/nodejs/node/blob/v10.8.0/lib/internal/errors.js
	function oneOf(expected, thing) {
	  if (Array.isArray(expected)) {
	    const len = expected.length;
	    expected = expected.map((i) => String(i));
	    if (len > 2) {
	      return `one of ${thing} ${expected.slice(0, len - 1).join(', ')}, or ` +
	             expected[len - 1];
	    } else if (len === 2) {
	      return `one of ${thing} ${expected[0]} or ${expected[1]}`;
	    } else {
	      return `of ${thing} ${expected[0]}`;
	    }
	  } else {
	    return `of ${thing} ${String(expected)}`;
	  }
	}

	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith
	function startsWith(str, search, pos) {
		return str.substr(!pos || pos < 0 ? 0 : +pos, search.length) === search;
	}

	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith
	function endsWith(str, search, this_len) {
		if (this_len === undefined || this_len > str.length) {
			this_len = str.length;
		}
		return str.substring(this_len - search.length, this_len) === search;
	}

	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/includes
	function includes(str, search, start) {
	  if (typeof start !== 'number') {
	    start = 0;
	  }

	  if (start + search.length > str.length) {
	    return false;
	  } else {
	    return str.indexOf(search, start) !== -1;
	  }
	}

	createErrorType('ERR_INVALID_OPT_VALUE', function (name, value) {
	  return 'The value "' + value + '" is invalid for option "' + name + '"'
	}, TypeError);
	createErrorType('ERR_INVALID_ARG_TYPE', function (name, expected, actual) {
	  // determiner: 'must be' or 'must not be'
	  let determiner;
	  if (typeof expected === 'string' && startsWith(expected, 'not ')) {
	    determiner = 'must not be';
	    expected = expected.replace(/^not /, '');
	  } else {
	    determiner = 'must be';
	  }

	  let msg;
	  if (endsWith(name, ' argument')) {
	    // For cases like 'first argument'
	    msg = `The ${name} ${determiner} ${oneOf(expected, 'type')}`;
	  } else {
	    const type = includes(name, '.') ? 'property' : 'argument';
	    msg = `The "${name}" ${type} ${determiner} ${oneOf(expected, 'type')}`;
	  }

	  msg += `. Received type ${typeof actual}`;
	  return msg;
	}, TypeError);
	createErrorType('ERR_STREAM_PUSH_AFTER_EOF', 'stream.push() after EOF');
	createErrorType('ERR_METHOD_NOT_IMPLEMENTED', function (name) {
	  return 'The ' + name + ' method is not implemented'
	});
	createErrorType('ERR_STREAM_PREMATURE_CLOSE', 'Premature close');
	createErrorType('ERR_STREAM_DESTROYED', function (name) {
	  return 'Cannot call ' + name + ' after a stream was destroyed';
	});
	createErrorType('ERR_MULTIPLE_CALLBACK', 'Callback called multiple times');
	createErrorType('ERR_STREAM_CANNOT_PIPE', 'Cannot pipe, not readable');
	createErrorType('ERR_STREAM_WRITE_AFTER_END', 'write after end');
	createErrorType('ERR_STREAM_NULL_VALUES', 'May not write null values to stream', TypeError);
	createErrorType('ERR_UNKNOWN_ENCODING', function (arg) {
	  return 'Unknown encoding: ' + arg
	}, TypeError);
	createErrorType('ERR_STREAM_UNSHIFT_AFTER_END_EVENT', 'stream.unshift() after end event');

	errors.codes = codes;
	return errors;
}

var state;
var hasRequiredState;

function requireState () {
	if (hasRequiredState) return state;
	hasRequiredState = 1;

	var ERR_INVALID_OPT_VALUE = requireErrors().codes.ERR_INVALID_OPT_VALUE;

	function highWaterMarkFrom(options, isDuplex, duplexKey) {
	  return options.highWaterMark != null ? options.highWaterMark : isDuplex ? options[duplexKey] : null;
	}

	function getHighWaterMark(state, options, duplexKey, isDuplex) {
	  var hwm = highWaterMarkFrom(options, isDuplex, duplexKey);

	  if (hwm != null) {
	    if (!(isFinite(hwm) && Math.floor(hwm) === hwm) || hwm < 0) {
	      var name = isDuplex ? duplexKey : 'highWaterMark';
	      throw new ERR_INVALID_OPT_VALUE(name, hwm);
	    }

	    return Math.floor(hwm);
	  } // Default value


	  return state.objectMode ? 16 : 16 * 1024;
	}

	state = {
	  getHighWaterMark: getHighWaterMark
	};
	return state;
}

var inheritsExports = {};
var inherits = {
  get exports(){ return inheritsExports; },
  set exports(v){ inheritsExports = v; },
};

var inherits_browserExports = {};
var inherits_browser = {
  get exports(){ return inherits_browserExports; },
  set exports(v){ inherits_browserExports = v; },
};

var hasRequiredInherits_browser;

function requireInherits_browser () {
	if (hasRequiredInherits_browser) return inherits_browserExports;
	hasRequiredInherits_browser = 1;
	if (typeof Object.create === 'function') {
	  // implementation from standard node.js 'util' module
	  inherits_browser.exports = function inherits(ctor, superCtor) {
	    if (superCtor) {
	      ctor.super_ = superCtor;
	      ctor.prototype = Object.create(superCtor.prototype, {
	        constructor: {
	          value: ctor,
	          enumerable: false,
	          writable: true,
	          configurable: true
	        }
	      });
	    }
	  };
	} else {
	  // old school shim for old browsers
	  inherits_browser.exports = function inherits(ctor, superCtor) {
	    if (superCtor) {
	      ctor.super_ = superCtor;
	      var TempCtor = function () {};
	      TempCtor.prototype = superCtor.prototype;
	      ctor.prototype = new TempCtor();
	      ctor.prototype.constructor = ctor;
	    }
	  };
	}
	return inherits_browserExports;
}

var hasRequiredInherits;

function requireInherits () {
	if (hasRequiredInherits) return inheritsExports;
	hasRequiredInherits = 1;
	(function (module) {
		try {
		  var util = require('util');
		  /* istanbul ignore next */
		  if (typeof util.inherits !== 'function') throw '';
		  module.exports = util.inherits;
		} catch (e) {
		  /* istanbul ignore next */
		  module.exports = requireInherits_browser();
		}
} (inherits));
	return inheritsExports;
}

var buffer_list;
var hasRequiredBuffer_list;

function requireBuffer_list () {
	if (hasRequiredBuffer_list) return buffer_list;
	hasRequiredBuffer_list = 1;

	function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

	function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

	function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

	function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

	function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

	var _require = require$$0__default$3["default"],
	    Buffer = _require.Buffer;

	var _require2 = require$$0__default$1["default"],
	    inspect = _require2.inspect;

	var custom = inspect && inspect.custom || 'inspect';

	function copyBuffer(src, target, offset) {
	  Buffer.prototype.copy.call(src, target, offset);
	}

	buffer_list =
	/*#__PURE__*/
	function () {
	  function BufferList() {
	    _classCallCheck(this, BufferList);

	    this.head = null;
	    this.tail = null;
	    this.length = 0;
	  }

	  _createClass(BufferList, [{
	    key: "push",
	    value: function push(v) {
	      var entry = {
	        data: v,
	        next: null
	      };
	      if (this.length > 0) this.tail.next = entry;else this.head = entry;
	      this.tail = entry;
	      ++this.length;
	    }
	  }, {
	    key: "unshift",
	    value: function unshift(v) {
	      var entry = {
	        data: v,
	        next: this.head
	      };
	      if (this.length === 0) this.tail = entry;
	      this.head = entry;
	      ++this.length;
	    }
	  }, {
	    key: "shift",
	    value: function shift() {
	      if (this.length === 0) return;
	      var ret = this.head.data;
	      if (this.length === 1) this.head = this.tail = null;else this.head = this.head.next;
	      --this.length;
	      return ret;
	    }
	  }, {
	    key: "clear",
	    value: function clear() {
	      this.head = this.tail = null;
	      this.length = 0;
	    }
	  }, {
	    key: "join",
	    value: function join(s) {
	      if (this.length === 0) return '';
	      var p = this.head;
	      var ret = '' + p.data;

	      while (p = p.next) {
	        ret += s + p.data;
	      }

	      return ret;
	    }
	  }, {
	    key: "concat",
	    value: function concat(n) {
	      if (this.length === 0) return Buffer.alloc(0);
	      var ret = Buffer.allocUnsafe(n >>> 0);
	      var p = this.head;
	      var i = 0;

	      while (p) {
	        copyBuffer(p.data, ret, i);
	        i += p.data.length;
	        p = p.next;
	      }

	      return ret;
	    } // Consumes a specified amount of bytes or characters from the buffered data.

	  }, {
	    key: "consume",
	    value: function consume(n, hasStrings) {
	      var ret;

	      if (n < this.head.data.length) {
	        // `slice` is the same for buffers and strings.
	        ret = this.head.data.slice(0, n);
	        this.head.data = this.head.data.slice(n);
	      } else if (n === this.head.data.length) {
	        // First chunk is a perfect match.
	        ret = this.shift();
	      } else {
	        // Result spans more than one buffer.
	        ret = hasStrings ? this._getString(n) : this._getBuffer(n);
	      }

	      return ret;
	    }
	  }, {
	    key: "first",
	    value: function first() {
	      return this.head.data;
	    } // Consumes a specified amount of characters from the buffered data.

	  }, {
	    key: "_getString",
	    value: function _getString(n) {
	      var p = this.head;
	      var c = 1;
	      var ret = p.data;
	      n -= ret.length;

	      while (p = p.next) {
	        var str = p.data;
	        var nb = n > str.length ? str.length : n;
	        if (nb === str.length) ret += str;else ret += str.slice(0, n);
	        n -= nb;

	        if (n === 0) {
	          if (nb === str.length) {
	            ++c;
	            if (p.next) this.head = p.next;else this.head = this.tail = null;
	          } else {
	            this.head = p;
	            p.data = str.slice(nb);
	          }

	          break;
	        }

	        ++c;
	      }

	      this.length -= c;
	      return ret;
	    } // Consumes a specified amount of bytes from the buffered data.

	  }, {
	    key: "_getBuffer",
	    value: function _getBuffer(n) {
	      var ret = Buffer.allocUnsafe(n);
	      var p = this.head;
	      var c = 1;
	      p.data.copy(ret);
	      n -= p.data.length;

	      while (p = p.next) {
	        var buf = p.data;
	        var nb = n > buf.length ? buf.length : n;
	        buf.copy(ret, ret.length - n, 0, nb);
	        n -= nb;

	        if (n === 0) {
	          if (nb === buf.length) {
	            ++c;
	            if (p.next) this.head = p.next;else this.head = this.tail = null;
	          } else {
	            this.head = p;
	            p.data = buf.slice(nb);
	          }

	          break;
	        }

	        ++c;
	      }

	      this.length -= c;
	      return ret;
	    } // Make sure the linked list only shows the minimal necessary information.

	  }, {
	    key: custom,
	    value: function value(_, options) {
	      return inspect(this, _objectSpread({}, options, {
	        // Only inspect one level.
	        depth: 0,
	        // It should not recurse.
	        customInspect: false
	      }));
	    }
	  }]);

	  return BufferList;
	}();
	return buffer_list;
}

var string_decoder = {};

var safeBufferExports = {};
var safeBuffer = {
  get exports(){ return safeBufferExports; },
  set exports(v){ safeBufferExports = v; },
};

/*! safe-buffer. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */

var hasRequiredSafeBuffer;

function requireSafeBuffer () {
	if (hasRequiredSafeBuffer) return safeBufferExports;
	hasRequiredSafeBuffer = 1;
	(function (module, exports) {
		/* eslint-disable node/no-deprecated-api */
		var buffer = require$$0__default$3["default"];
		var Buffer = buffer.Buffer;

		// alternative to using Object.keys for old browsers
		function copyProps (src, dst) {
		  for (var key in src) {
		    dst[key] = src[key];
		  }
		}
		if (Buffer.from && Buffer.alloc && Buffer.allocUnsafe && Buffer.allocUnsafeSlow) {
		  module.exports = buffer;
		} else {
		  // Copy properties from require('buffer')
		  copyProps(buffer, exports);
		  exports.Buffer = SafeBuffer;
		}

		function SafeBuffer (arg, encodingOrOffset, length) {
		  return Buffer(arg, encodingOrOffset, length)
		}

		SafeBuffer.prototype = Object.create(Buffer.prototype);

		// Copy static methods from Buffer
		copyProps(Buffer, SafeBuffer);

		SafeBuffer.from = function (arg, encodingOrOffset, length) {
		  if (typeof arg === 'number') {
		    throw new TypeError('Argument must not be a number')
		  }
		  return Buffer(arg, encodingOrOffset, length)
		};

		SafeBuffer.alloc = function (size, fill, encoding) {
		  if (typeof size !== 'number') {
		    throw new TypeError('Argument must be a number')
		  }
		  var buf = Buffer(size);
		  if (fill !== undefined) {
		    if (typeof encoding === 'string') {
		      buf.fill(fill, encoding);
		    } else {
		      buf.fill(fill);
		    }
		  } else {
		    buf.fill(0);
		  }
		  return buf
		};

		SafeBuffer.allocUnsafe = function (size) {
		  if (typeof size !== 'number') {
		    throw new TypeError('Argument must be a number')
		  }
		  return Buffer(size)
		};

		SafeBuffer.allocUnsafeSlow = function (size) {
		  if (typeof size !== 'number') {
		    throw new TypeError('Argument must be a number')
		  }
		  return buffer.SlowBuffer(size)
		};
} (safeBuffer, safeBufferExports));
	return safeBufferExports;
}

var hasRequiredString_decoder;

function requireString_decoder () {
	if (hasRequiredString_decoder) return string_decoder;
	hasRequiredString_decoder = 1;

	/*<replacement>*/

	var Buffer = requireSafeBuffer().Buffer;
	/*</replacement>*/

	var isEncoding = Buffer.isEncoding || function (encoding) {
	  encoding = '' + encoding;
	  switch (encoding && encoding.toLowerCase()) {
	    case 'hex':case 'utf8':case 'utf-8':case 'ascii':case 'binary':case 'base64':case 'ucs2':case 'ucs-2':case 'utf16le':case 'utf-16le':case 'raw':
	      return true;
	    default:
	      return false;
	  }
	};

	function _normalizeEncoding(enc) {
	  if (!enc) return 'utf8';
	  var retried;
	  while (true) {
	    switch (enc) {
	      case 'utf8':
	      case 'utf-8':
	        return 'utf8';
	      case 'ucs2':
	      case 'ucs-2':
	      case 'utf16le':
	      case 'utf-16le':
	        return 'utf16le';
	      case 'latin1':
	      case 'binary':
	        return 'latin1';
	      case 'base64':
	      case 'ascii':
	      case 'hex':
	        return enc;
	      default:
	        if (retried) return; // undefined
	        enc = ('' + enc).toLowerCase();
	        retried = true;
	    }
	  }
	}
	// Do not cache `Buffer.isEncoding` when checking encoding names as some
	// modules monkey-patch it to support additional encodings
	function normalizeEncoding(enc) {
	  var nenc = _normalizeEncoding(enc);
	  if (typeof nenc !== 'string' && (Buffer.isEncoding === isEncoding || !isEncoding(enc))) throw new Error('Unknown encoding: ' + enc);
	  return nenc || enc;
	}

	// StringDecoder provides an interface for efficiently splitting a series of
	// buffers into a series of JS strings without breaking apart multi-byte
	// characters.
	string_decoder.StringDecoder = StringDecoder;
	function StringDecoder(encoding) {
	  this.encoding = normalizeEncoding(encoding);
	  var nb;
	  switch (this.encoding) {
	    case 'utf16le':
	      this.text = utf16Text;
	      this.end = utf16End;
	      nb = 4;
	      break;
	    case 'utf8':
	      this.fillLast = utf8FillLast;
	      nb = 4;
	      break;
	    case 'base64':
	      this.text = base64Text;
	      this.end = base64End;
	      nb = 3;
	      break;
	    default:
	      this.write = simpleWrite;
	      this.end = simpleEnd;
	      return;
	  }
	  this.lastNeed = 0;
	  this.lastTotal = 0;
	  this.lastChar = Buffer.allocUnsafe(nb);
	}

	StringDecoder.prototype.write = function (buf) {
	  if (buf.length === 0) return '';
	  var r;
	  var i;
	  if (this.lastNeed) {
	    r = this.fillLast(buf);
	    if (r === undefined) return '';
	    i = this.lastNeed;
	    this.lastNeed = 0;
	  } else {
	    i = 0;
	  }
	  if (i < buf.length) return r ? r + this.text(buf, i) : this.text(buf, i);
	  return r || '';
	};

	StringDecoder.prototype.end = utf8End;

	// Returns only complete characters in a Buffer
	StringDecoder.prototype.text = utf8Text;

	// Attempts to complete a partial non-UTF-8 character using bytes from a Buffer
	StringDecoder.prototype.fillLast = function (buf) {
	  if (this.lastNeed <= buf.length) {
	    buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed);
	    return this.lastChar.toString(this.encoding, 0, this.lastTotal);
	  }
	  buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, buf.length);
	  this.lastNeed -= buf.length;
	};

	// Checks the type of a UTF-8 byte, whether it's ASCII, a leading byte, or a
	// continuation byte. If an invalid byte is detected, -2 is returned.
	function utf8CheckByte(byte) {
	  if (byte <= 0x7F) return 0;else if (byte >> 5 === 0x06) return 2;else if (byte >> 4 === 0x0E) return 3;else if (byte >> 3 === 0x1E) return 4;
	  return byte >> 6 === 0x02 ? -1 : -2;
	}

	// Checks at most 3 bytes at the end of a Buffer in order to detect an
	// incomplete multi-byte UTF-8 character. The total number of bytes (2, 3, or 4)
	// needed to complete the UTF-8 character (if applicable) are returned.
	function utf8CheckIncomplete(self, buf, i) {
	  var j = buf.length - 1;
	  if (j < i) return 0;
	  var nb = utf8CheckByte(buf[j]);
	  if (nb >= 0) {
	    if (nb > 0) self.lastNeed = nb - 1;
	    return nb;
	  }
	  if (--j < i || nb === -2) return 0;
	  nb = utf8CheckByte(buf[j]);
	  if (nb >= 0) {
	    if (nb > 0) self.lastNeed = nb - 2;
	    return nb;
	  }
	  if (--j < i || nb === -2) return 0;
	  nb = utf8CheckByte(buf[j]);
	  if (nb >= 0) {
	    if (nb > 0) {
	      if (nb === 2) nb = 0;else self.lastNeed = nb - 3;
	    }
	    return nb;
	  }
	  return 0;
	}

	// Validates as many continuation bytes for a multi-byte UTF-8 character as
	// needed or are available. If we see a non-continuation byte where we expect
	// one, we "replace" the validated continuation bytes we've seen so far with
	// a single UTF-8 replacement character ('\ufffd'), to match v8's UTF-8 decoding
	// behavior. The continuation byte check is included three times in the case
	// where all of the continuation bytes for a character exist in the same buffer.
	// It is also done this way as a slight performance increase instead of using a
	// loop.
	function utf8CheckExtraBytes(self, buf, p) {
	  if ((buf[0] & 0xC0) !== 0x80) {
	    self.lastNeed = 0;
	    return '\ufffd';
	  }
	  if (self.lastNeed > 1 && buf.length > 1) {
	    if ((buf[1] & 0xC0) !== 0x80) {
	      self.lastNeed = 1;
	      return '\ufffd';
	    }
	    if (self.lastNeed > 2 && buf.length > 2) {
	      if ((buf[2] & 0xC0) !== 0x80) {
	        self.lastNeed = 2;
	        return '\ufffd';
	      }
	    }
	  }
	}

	// Attempts to complete a multi-byte UTF-8 character using bytes from a Buffer.
	function utf8FillLast(buf) {
	  var p = this.lastTotal - this.lastNeed;
	  var r = utf8CheckExtraBytes(this, buf);
	  if (r !== undefined) return r;
	  if (this.lastNeed <= buf.length) {
	    buf.copy(this.lastChar, p, 0, this.lastNeed);
	    return this.lastChar.toString(this.encoding, 0, this.lastTotal);
	  }
	  buf.copy(this.lastChar, p, 0, buf.length);
	  this.lastNeed -= buf.length;
	}

	// Returns all complete UTF-8 characters in a Buffer. If the Buffer ended on a
	// partial character, the character's bytes are buffered until the required
	// number of bytes are available.
	function utf8Text(buf, i) {
	  var total = utf8CheckIncomplete(this, buf, i);
	  if (!this.lastNeed) return buf.toString('utf8', i);
	  this.lastTotal = total;
	  var end = buf.length - (total - this.lastNeed);
	  buf.copy(this.lastChar, 0, end);
	  return buf.toString('utf8', i, end);
	}

	// For UTF-8, a replacement character is added when ending on a partial
	// character.
	function utf8End(buf) {
	  var r = buf && buf.length ? this.write(buf) : '';
	  if (this.lastNeed) return r + '\ufffd';
	  return r;
	}

	// UTF-16LE typically needs two bytes per character, but even if we have an even
	// number of bytes available, we need to check if we end on a leading/high
	// surrogate. In that case, we need to wait for the next two bytes in order to
	// decode the last character properly.
	function utf16Text(buf, i) {
	  if ((buf.length - i) % 2 === 0) {
	    var r = buf.toString('utf16le', i);
	    if (r) {
	      var c = r.charCodeAt(r.length - 1);
	      if (c >= 0xD800 && c <= 0xDBFF) {
	        this.lastNeed = 2;
	        this.lastTotal = 4;
	        this.lastChar[0] = buf[buf.length - 2];
	        this.lastChar[1] = buf[buf.length - 1];
	        return r.slice(0, -1);
	      }
	    }
	    return r;
	  }
	  this.lastNeed = 1;
	  this.lastTotal = 2;
	  this.lastChar[0] = buf[buf.length - 1];
	  return buf.toString('utf16le', i, buf.length - 1);
	}

	// For UTF-16LE we do not explicitly append special replacement characters if we
	// end on a partial character, we simply let v8 handle that.
	function utf16End(buf) {
	  var r = buf && buf.length ? this.write(buf) : '';
	  if (this.lastNeed) {
	    var end = this.lastTotal - this.lastNeed;
	    return r + this.lastChar.toString('utf16le', 0, end);
	  }
	  return r;
	}

	function base64Text(buf, i) {
	  var n = (buf.length - i) % 3;
	  if (n === 0) return buf.toString('base64', i);
	  this.lastNeed = 3 - n;
	  this.lastTotal = 3;
	  if (n === 1) {
	    this.lastChar[0] = buf[buf.length - 1];
	  } else {
	    this.lastChar[0] = buf[buf.length - 2];
	    this.lastChar[1] = buf[buf.length - 1];
	  }
	  return buf.toString('base64', i, buf.length - n);
	}

	function base64End(buf) {
	  var r = buf && buf.length ? this.write(buf) : '';
	  if (this.lastNeed) return r + this.lastChar.toString('base64', 0, 3 - this.lastNeed);
	  return r;
	}

	// Pass bytes on through for single-byte encodings (e.g. ascii, latin1, hex)
	function simpleWrite(buf) {
	  return buf.toString(this.encoding);
	}

	function simpleEnd(buf) {
	  return buf && buf.length ? this.write(buf) : '';
	}
	return string_decoder;
}

var endOfStream;
var hasRequiredEndOfStream;

function requireEndOfStream () {
	if (hasRequiredEndOfStream) return endOfStream;
	hasRequiredEndOfStream = 1;

	var ERR_STREAM_PREMATURE_CLOSE = requireErrors().codes.ERR_STREAM_PREMATURE_CLOSE;

	function once(callback) {
	  var called = false;
	  return function () {
	    if (called) return;
	    called = true;

	    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
	      args[_key] = arguments[_key];
	    }

	    callback.apply(this, args);
	  };
	}

	function noop() {}

	function isRequest(stream) {
	  return stream.setHeader && typeof stream.abort === 'function';
	}

	function eos(stream, opts, callback) {
	  if (typeof opts === 'function') return eos(stream, null, opts);
	  if (!opts) opts = {};
	  callback = once(callback || noop);
	  var readable = opts.readable || opts.readable !== false && stream.readable;
	  var writable = opts.writable || opts.writable !== false && stream.writable;

	  var onlegacyfinish = function onlegacyfinish() {
	    if (!stream.writable) onfinish();
	  };

	  var writableEnded = stream._writableState && stream._writableState.finished;

	  var onfinish = function onfinish() {
	    writable = false;
	    writableEnded = true;
	    if (!readable) callback.call(stream);
	  };

	  var readableEnded = stream._readableState && stream._readableState.endEmitted;

	  var onend = function onend() {
	    readable = false;
	    readableEnded = true;
	    if (!writable) callback.call(stream);
	  };

	  var onerror = function onerror(err) {
	    callback.call(stream, err);
	  };

	  var onclose = function onclose() {
	    var err;

	    if (readable && !readableEnded) {
	      if (!stream._readableState || !stream._readableState.ended) err = new ERR_STREAM_PREMATURE_CLOSE();
	      return callback.call(stream, err);
	    }

	    if (writable && !writableEnded) {
	      if (!stream._writableState || !stream._writableState.ended) err = new ERR_STREAM_PREMATURE_CLOSE();
	      return callback.call(stream, err);
	    }
	  };

	  var onrequest = function onrequest() {
	    stream.req.on('finish', onfinish);
	  };

	  if (isRequest(stream)) {
	    stream.on('complete', onfinish);
	    stream.on('abort', onclose);
	    if (stream.req) onrequest();else stream.on('request', onrequest);
	  } else if (writable && !stream._writableState) {
	    // legacy streams
	    stream.on('end', onlegacyfinish);
	    stream.on('close', onlegacyfinish);
	  }

	  stream.on('end', onend);
	  stream.on('finish', onfinish);
	  if (opts.error !== false) stream.on('error', onerror);
	  stream.on('close', onclose);
	  return function () {
	    stream.removeListener('complete', onfinish);
	    stream.removeListener('abort', onclose);
	    stream.removeListener('request', onrequest);
	    if (stream.req) stream.req.removeListener('finish', onfinish);
	    stream.removeListener('end', onlegacyfinish);
	    stream.removeListener('close', onlegacyfinish);
	    stream.removeListener('finish', onfinish);
	    stream.removeListener('end', onend);
	    stream.removeListener('error', onerror);
	    stream.removeListener('close', onclose);
	  };
	}

	endOfStream = eos;
	return endOfStream;
}

var async_iterator;
var hasRequiredAsync_iterator;

function requireAsync_iterator () {
	if (hasRequiredAsync_iterator) return async_iterator;
	hasRequiredAsync_iterator = 1;

	var _Object$setPrototypeO;

	function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

	var finished = requireEndOfStream();

	var kLastResolve = Symbol('lastResolve');
	var kLastReject = Symbol('lastReject');
	var kError = Symbol('error');
	var kEnded = Symbol('ended');
	var kLastPromise = Symbol('lastPromise');
	var kHandlePromise = Symbol('handlePromise');
	var kStream = Symbol('stream');

	function createIterResult(value, done) {
	  return {
	    value: value,
	    done: done
	  };
	}

	function readAndResolve(iter) {
	  var resolve = iter[kLastResolve];

	  if (resolve !== null) {
	    var data = iter[kStream].read(); // we defer if data is null
	    // we can be expecting either 'end' or
	    // 'error'

	    if (data !== null) {
	      iter[kLastPromise] = null;
	      iter[kLastResolve] = null;
	      iter[kLastReject] = null;
	      resolve(createIterResult(data, false));
	    }
	  }
	}

	function onReadable(iter) {
	  // we wait for the next tick, because it might
	  // emit an error with process.nextTick
	  process.nextTick(readAndResolve, iter);
	}

	function wrapForNext(lastPromise, iter) {
	  return function (resolve, reject) {
	    lastPromise.then(function () {
	      if (iter[kEnded]) {
	        resolve(createIterResult(undefined, true));
	        return;
	      }

	      iter[kHandlePromise](resolve, reject);
	    }, reject);
	  };
	}

	var AsyncIteratorPrototype = Object.getPrototypeOf(function () {});
	var ReadableStreamAsyncIteratorPrototype = Object.setPrototypeOf((_Object$setPrototypeO = {
	  get stream() {
	    return this[kStream];
	  },

	  next: function next() {
	    var _this = this;

	    // if we have detected an error in the meanwhile
	    // reject straight away
	    var error = this[kError];

	    if (error !== null) {
	      return Promise.reject(error);
	    }

	    if (this[kEnded]) {
	      return Promise.resolve(createIterResult(undefined, true));
	    }

	    if (this[kStream].destroyed) {
	      // We need to defer via nextTick because if .destroy(err) is
	      // called, the error will be emitted via nextTick, and
	      // we cannot guarantee that there is no error lingering around
	      // waiting to be emitted.
	      return new Promise(function (resolve, reject) {
	        process.nextTick(function () {
	          if (_this[kError]) {
	            reject(_this[kError]);
	          } else {
	            resolve(createIterResult(undefined, true));
	          }
	        });
	      });
	    } // if we have multiple next() calls
	    // we will wait for the previous Promise to finish
	    // this logic is optimized to support for await loops,
	    // where next() is only called once at a time


	    var lastPromise = this[kLastPromise];
	    var promise;

	    if (lastPromise) {
	      promise = new Promise(wrapForNext(lastPromise, this));
	    } else {
	      // fast path needed to support multiple this.push()
	      // without triggering the next() queue
	      var data = this[kStream].read();

	      if (data !== null) {
	        return Promise.resolve(createIterResult(data, false));
	      }

	      promise = new Promise(this[kHandlePromise]);
	    }

	    this[kLastPromise] = promise;
	    return promise;
	  }
	}, _defineProperty(_Object$setPrototypeO, Symbol.asyncIterator, function () {
	  return this;
	}), _defineProperty(_Object$setPrototypeO, "return", function _return() {
	  var _this2 = this;

	  // destroy(err, cb) is a private API
	  // we can guarantee we have that here, because we control the
	  // Readable class this is attached to
	  return new Promise(function (resolve, reject) {
	    _this2[kStream].destroy(null, function (err) {
	      if (err) {
	        reject(err);
	        return;
	      }

	      resolve(createIterResult(undefined, true));
	    });
	  });
	}), _Object$setPrototypeO), AsyncIteratorPrototype);

	var createReadableStreamAsyncIterator = function createReadableStreamAsyncIterator(stream) {
	  var _Object$create;

	  var iterator = Object.create(ReadableStreamAsyncIteratorPrototype, (_Object$create = {}, _defineProperty(_Object$create, kStream, {
	    value: stream,
	    writable: true
	  }), _defineProperty(_Object$create, kLastResolve, {
	    value: null,
	    writable: true
	  }), _defineProperty(_Object$create, kLastReject, {
	    value: null,
	    writable: true
	  }), _defineProperty(_Object$create, kError, {
	    value: null,
	    writable: true
	  }), _defineProperty(_Object$create, kEnded, {
	    value: stream._readableState.endEmitted,
	    writable: true
	  }), _defineProperty(_Object$create, kHandlePromise, {
	    value: function value(resolve, reject) {
	      var data = iterator[kStream].read();

	      if (data) {
	        iterator[kLastPromise] = null;
	        iterator[kLastResolve] = null;
	        iterator[kLastReject] = null;
	        resolve(createIterResult(data, false));
	      } else {
	        iterator[kLastResolve] = resolve;
	        iterator[kLastReject] = reject;
	      }
	    },
	    writable: true
	  }), _Object$create));
	  iterator[kLastPromise] = null;
	  finished(stream, function (err) {
	    if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
	      var reject = iterator[kLastReject]; // reject if we are waiting for data in the Promise
	      // returned by next() and store the error

	      if (reject !== null) {
	        iterator[kLastPromise] = null;
	        iterator[kLastResolve] = null;
	        iterator[kLastReject] = null;
	        reject(err);
	      }

	      iterator[kError] = err;
	      return;
	    }

	    var resolve = iterator[kLastResolve];

	    if (resolve !== null) {
	      iterator[kLastPromise] = null;
	      iterator[kLastResolve] = null;
	      iterator[kLastReject] = null;
	      resolve(createIterResult(undefined, true));
	    }

	    iterator[kEnded] = true;
	  });
	  stream.on('readable', onReadable.bind(null, iterator));
	  return iterator;
	};

	async_iterator = createReadableStreamAsyncIterator;
	return async_iterator;
}

var from_1;
var hasRequiredFrom;

function requireFrom () {
	if (hasRequiredFrom) return from_1;
	hasRequiredFrom = 1;

	function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

	function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

	function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

	function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

	function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

	var ERR_INVALID_ARG_TYPE = requireErrors().codes.ERR_INVALID_ARG_TYPE;

	function from(Readable, iterable, opts) {
	  var iterator;

	  if (iterable && typeof iterable.next === 'function') {
	    iterator = iterable;
	  } else if (iterable && iterable[Symbol.asyncIterator]) iterator = iterable[Symbol.asyncIterator]();else if (iterable && iterable[Symbol.iterator]) iterator = iterable[Symbol.iterator]();else throw new ERR_INVALID_ARG_TYPE('iterable', ['Iterable'], iterable);

	  var readable = new Readable(_objectSpread({
	    objectMode: true
	  }, opts)); // Reading boolean to protect against _read
	  // being called before last iteration completion.

	  var reading = false;

	  readable._read = function () {
	    if (!reading) {
	      reading = true;
	      next();
	    }
	  };

	  function next() {
	    return _next2.apply(this, arguments);
	  }

	  function _next2() {
	    _next2 = _asyncToGenerator(function* () {
	      try {
	        var _ref = yield iterator.next(),
	            value = _ref.value,
	            done = _ref.done;

	        if (done) {
	          readable.push(null);
	        } else if (readable.push((yield value))) {
	          next();
	        } else {
	          reading = false;
	        }
	      } catch (err) {
	        readable.destroy(err);
	      }
	    });
	    return _next2.apply(this, arguments);
	  }

	  return readable;
	}

	from_1 = from;
	return from_1;
}

var _stream_readable;
var hasRequired_stream_readable;

function require_stream_readable () {
	if (hasRequired_stream_readable) return _stream_readable;
	hasRequired_stream_readable = 1;

	_stream_readable = Readable;
	/*<replacement>*/

	var Duplex;
	/*</replacement>*/

	Readable.ReadableState = ReadableState;
	/*<replacement>*/

	require$$0__default$4["default"].EventEmitter;

	var EElistenerCount = function EElistenerCount(emitter, type) {
	  return emitter.listeners(type).length;
	};
	/*</replacement>*/

	/*<replacement>*/


	var Stream = requireStream$1();
	/*</replacement>*/


	var Buffer = require$$0__default$3["default"].Buffer;

	var OurUint8Array = commonjsGlobal.Uint8Array || function () {};

	function _uint8ArrayToBuffer(chunk) {
	  return Buffer.from(chunk);
	}

	function _isUint8Array(obj) {
	  return Buffer.isBuffer(obj) || obj instanceof OurUint8Array;
	}
	/*<replacement>*/


	var debugUtil = require$$0__default$1["default"];

	var debug;

	if (debugUtil && debugUtil.debuglog) {
	  debug = debugUtil.debuglog('stream');
	} else {
	  debug = function debug() {};
	}
	/*</replacement>*/


	var BufferList = requireBuffer_list();

	var destroyImpl = requireDestroy();

	var _require = requireState(),
	    getHighWaterMark = _require.getHighWaterMark;

	var _require$codes = requireErrors().codes,
	    ERR_INVALID_ARG_TYPE = _require$codes.ERR_INVALID_ARG_TYPE,
	    ERR_STREAM_PUSH_AFTER_EOF = _require$codes.ERR_STREAM_PUSH_AFTER_EOF,
	    ERR_METHOD_NOT_IMPLEMENTED = _require$codes.ERR_METHOD_NOT_IMPLEMENTED,
	    ERR_STREAM_UNSHIFT_AFTER_END_EVENT = _require$codes.ERR_STREAM_UNSHIFT_AFTER_END_EVENT; // Lazy loaded to improve the startup performance.


	var StringDecoder;
	var createReadableStreamAsyncIterator;
	var from;

	requireInherits()(Readable, Stream);

	var errorOrDestroy = destroyImpl.errorOrDestroy;
	var kProxyEvents = ['error', 'close', 'destroy', 'pause', 'resume'];

	function prependListener(emitter, event, fn) {
	  // Sadly this is not cacheable as some libraries bundle their own
	  // event emitter implementation with them.
	  if (typeof emitter.prependListener === 'function') return emitter.prependListener(event, fn); // This is a hack to make sure that our error handler is attached before any
	  // userland ones.  NEVER DO THIS. This is here only because this code needs
	  // to continue to work with older versions of Node.js that do not include
	  // the prependListener() method. The goal is to eventually remove this hack.

	  if (!emitter._events || !emitter._events[event]) emitter.on(event, fn);else if (Array.isArray(emitter._events[event])) emitter._events[event].unshift(fn);else emitter._events[event] = [fn, emitter._events[event]];
	}

	function ReadableState(options, stream, isDuplex) {
	  Duplex = Duplex || require_stream_duplex();
	  options = options || {}; // Duplex streams are both readable and writable, but share
	  // the same options object.
	  // However, some cases require setting options to different
	  // values for the readable and the writable sides of the duplex stream.
	  // These options can be provided separately as readableXXX and writableXXX.

	  if (typeof isDuplex !== 'boolean') isDuplex = stream instanceof Duplex; // object stream flag. Used to make read(n) ignore n and to
	  // make all the buffer merging and length checks go away

	  this.objectMode = !!options.objectMode;
	  if (isDuplex) this.objectMode = this.objectMode || !!options.readableObjectMode; // the point at which it stops calling _read() to fill the buffer
	  // Note: 0 is a valid value, means "don't call _read preemptively ever"

	  this.highWaterMark = getHighWaterMark(this, options, 'readableHighWaterMark', isDuplex); // A linked list is used to store data chunks instead of an array because the
	  // linked list can remove elements from the beginning faster than
	  // array.shift()

	  this.buffer = new BufferList();
	  this.length = 0;
	  this.pipes = null;
	  this.pipesCount = 0;
	  this.flowing = null;
	  this.ended = false;
	  this.endEmitted = false;
	  this.reading = false; // a flag to be able to tell if the event 'readable'/'data' is emitted
	  // immediately, or on a later tick.  We set this to true at first, because
	  // any actions that shouldn't happen until "later" should generally also
	  // not happen before the first read call.

	  this.sync = true; // whenever we return null, then we set a flag to say
	  // that we're awaiting a 'readable' event emission.

	  this.needReadable = false;
	  this.emittedReadable = false;
	  this.readableListening = false;
	  this.resumeScheduled = false;
	  this.paused = true; // Should close be emitted on destroy. Defaults to true.

	  this.emitClose = options.emitClose !== false; // Should .destroy() be called after 'end' (and potentially 'finish')

	  this.autoDestroy = !!options.autoDestroy; // has it been destroyed

	  this.destroyed = false; // Crypto is kind of old and crusty.  Historically, its default string
	  // encoding is 'binary' so we have to make this configurable.
	  // Everything else in the universe uses 'utf8', though.

	  this.defaultEncoding = options.defaultEncoding || 'utf8'; // the number of writers that are awaiting a drain event in .pipe()s

	  this.awaitDrain = 0; // if true, a maybeReadMore has been scheduled

	  this.readingMore = false;
	  this.decoder = null;
	  this.encoding = null;

	  if (options.encoding) {
	    if (!StringDecoder) StringDecoder = requireString_decoder().StringDecoder;
	    this.decoder = new StringDecoder(options.encoding);
	    this.encoding = options.encoding;
	  }
	}

	function Readable(options) {
	  Duplex = Duplex || require_stream_duplex();
	  if (!(this instanceof Readable)) return new Readable(options); // Checking for a Stream.Duplex instance is faster here instead of inside
	  // the ReadableState constructor, at least with V8 6.5

	  var isDuplex = this instanceof Duplex;
	  this._readableState = new ReadableState(options, this, isDuplex); // legacy

	  this.readable = true;

	  if (options) {
	    if (typeof options.read === 'function') this._read = options.read;
	    if (typeof options.destroy === 'function') this._destroy = options.destroy;
	  }

	  Stream.call(this);
	}

	Object.defineProperty(Readable.prototype, 'destroyed', {
	  // making it explicit this property is not enumerable
	  // because otherwise some prototype manipulation in
	  // userland will fail
	  enumerable: false,
	  get: function get() {
	    if (this._readableState === undefined) {
	      return false;
	    }

	    return this._readableState.destroyed;
	  },
	  set: function set(value) {
	    // we ignore the value if the stream
	    // has not been initialized yet
	    if (!this._readableState) {
	      return;
	    } // backward compatibility, the user is explicitly
	    // managing destroyed


	    this._readableState.destroyed = value;
	  }
	});
	Readable.prototype.destroy = destroyImpl.destroy;
	Readable.prototype._undestroy = destroyImpl.undestroy;

	Readable.prototype._destroy = function (err, cb) {
	  cb(err);
	}; // Manually shove something into the read() buffer.
	// This returns true if the highWaterMark has not been hit yet,
	// similar to how Writable.write() returns true if you should
	// write() some more.


	Readable.prototype.push = function (chunk, encoding) {
	  var state = this._readableState;
	  var skipChunkCheck;

	  if (!state.objectMode) {
	    if (typeof chunk === 'string') {
	      encoding = encoding || state.defaultEncoding;

	      if (encoding !== state.encoding) {
	        chunk = Buffer.from(chunk, encoding);
	        encoding = '';
	      }

	      skipChunkCheck = true;
	    }
	  } else {
	    skipChunkCheck = true;
	  }

	  return readableAddChunk(this, chunk, encoding, false, skipChunkCheck);
	}; // Unshift should *always* be something directly out of read()


	Readable.prototype.unshift = function (chunk) {
	  return readableAddChunk(this, chunk, null, true, false);
	};

	function readableAddChunk(stream, chunk, encoding, addToFront, skipChunkCheck) {
	  debug('readableAddChunk', chunk);
	  var state = stream._readableState;

	  if (chunk === null) {
	    state.reading = false;
	    onEofChunk(stream, state);
	  } else {
	    var er;
	    if (!skipChunkCheck) er = chunkInvalid(state, chunk);

	    if (er) {
	      errorOrDestroy(stream, er);
	    } else if (state.objectMode || chunk && chunk.length > 0) {
	      if (typeof chunk !== 'string' && !state.objectMode && Object.getPrototypeOf(chunk) !== Buffer.prototype) {
	        chunk = _uint8ArrayToBuffer(chunk);
	      }

	      if (addToFront) {
	        if (state.endEmitted) errorOrDestroy(stream, new ERR_STREAM_UNSHIFT_AFTER_END_EVENT());else addChunk(stream, state, chunk, true);
	      } else if (state.ended) {
	        errorOrDestroy(stream, new ERR_STREAM_PUSH_AFTER_EOF());
	      } else if (state.destroyed) {
	        return false;
	      } else {
	        state.reading = false;

	        if (state.decoder && !encoding) {
	          chunk = state.decoder.write(chunk);
	          if (state.objectMode || chunk.length !== 0) addChunk(stream, state, chunk, false);else maybeReadMore(stream, state);
	        } else {
	          addChunk(stream, state, chunk, false);
	        }
	      }
	    } else if (!addToFront) {
	      state.reading = false;
	      maybeReadMore(stream, state);
	    }
	  } // We can push more data if we are below the highWaterMark.
	  // Also, if we have no data yet, we can stand some more bytes.
	  // This is to work around cases where hwm=0, such as the repl.


	  return !state.ended && (state.length < state.highWaterMark || state.length === 0);
	}

	function addChunk(stream, state, chunk, addToFront) {
	  if (state.flowing && state.length === 0 && !state.sync) {
	    state.awaitDrain = 0;
	    stream.emit('data', chunk);
	  } else {
	    // update the buffer info.
	    state.length += state.objectMode ? 1 : chunk.length;
	    if (addToFront) state.buffer.unshift(chunk);else state.buffer.push(chunk);
	    if (state.needReadable) emitReadable(stream);
	  }

	  maybeReadMore(stream, state);
	}

	function chunkInvalid(state, chunk) {
	  var er;

	  if (!_isUint8Array(chunk) && typeof chunk !== 'string' && chunk !== undefined && !state.objectMode) {
	    er = new ERR_INVALID_ARG_TYPE('chunk', ['string', 'Buffer', 'Uint8Array'], chunk);
	  }

	  return er;
	}

	Readable.prototype.isPaused = function () {
	  return this._readableState.flowing === false;
	}; // backwards compatibility.


	Readable.prototype.setEncoding = function (enc) {
	  if (!StringDecoder) StringDecoder = requireString_decoder().StringDecoder;
	  var decoder = new StringDecoder(enc);
	  this._readableState.decoder = decoder; // If setEncoding(null), decoder.encoding equals utf8

	  this._readableState.encoding = this._readableState.decoder.encoding; // Iterate over current buffer to convert already stored Buffers:

	  var p = this._readableState.buffer.head;
	  var content = '';

	  while (p !== null) {
	    content += decoder.write(p.data);
	    p = p.next;
	  }

	  this._readableState.buffer.clear();

	  if (content !== '') this._readableState.buffer.push(content);
	  this._readableState.length = content.length;
	  return this;
	}; // Don't raise the hwm > 1GB


	var MAX_HWM = 0x40000000;

	function computeNewHighWaterMark(n) {
	  if (n >= MAX_HWM) {
	    // TODO(ronag): Throw ERR_VALUE_OUT_OF_RANGE.
	    n = MAX_HWM;
	  } else {
	    // Get the next highest power of 2 to prevent increasing hwm excessively in
	    // tiny amounts
	    n--;
	    n |= n >>> 1;
	    n |= n >>> 2;
	    n |= n >>> 4;
	    n |= n >>> 8;
	    n |= n >>> 16;
	    n++;
	  }

	  return n;
	} // This function is designed to be inlinable, so please take care when making
	// changes to the function body.


	function howMuchToRead(n, state) {
	  if (n <= 0 || state.length === 0 && state.ended) return 0;
	  if (state.objectMode) return 1;

	  if (n !== n) {
	    // Only flow one buffer at a time
	    if (state.flowing && state.length) return state.buffer.head.data.length;else return state.length;
	  } // If we're asking for more than the current hwm, then raise the hwm.


	  if (n > state.highWaterMark) state.highWaterMark = computeNewHighWaterMark(n);
	  if (n <= state.length) return n; // Don't have enough

	  if (!state.ended) {
	    state.needReadable = true;
	    return 0;
	  }

	  return state.length;
	} // you can override either this method, or the async _read(n) below.


	Readable.prototype.read = function (n) {
	  debug('read', n);
	  n = parseInt(n, 10);
	  var state = this._readableState;
	  var nOrig = n;
	  if (n !== 0) state.emittedReadable = false; // if we're doing read(0) to trigger a readable event, but we
	  // already have a bunch of data in the buffer, then just trigger
	  // the 'readable' event and move on.

	  if (n === 0 && state.needReadable && ((state.highWaterMark !== 0 ? state.length >= state.highWaterMark : state.length > 0) || state.ended)) {
	    debug('read: emitReadable', state.length, state.ended);
	    if (state.length === 0 && state.ended) endReadable(this);else emitReadable(this);
	    return null;
	  }

	  n = howMuchToRead(n, state); // if we've ended, and we're now clear, then finish it up.

	  if (n === 0 && state.ended) {
	    if (state.length === 0) endReadable(this);
	    return null;
	  } // All the actual chunk generation logic needs to be
	  // *below* the call to _read.  The reason is that in certain
	  // synthetic stream cases, such as passthrough streams, _read
	  // may be a completely synchronous operation which may change
	  // the state of the read buffer, providing enough data when
	  // before there was *not* enough.
	  //
	  // So, the steps are:
	  // 1. Figure out what the state of things will be after we do
	  // a read from the buffer.
	  //
	  // 2. If that resulting state will trigger a _read, then call _read.
	  // Note that this may be asynchronous, or synchronous.  Yes, it is
	  // deeply ugly to write APIs this way, but that still doesn't mean
	  // that the Readable class should behave improperly, as streams are
	  // designed to be sync/async agnostic.
	  // Take note if the _read call is sync or async (ie, if the read call
	  // has returned yet), so that we know whether or not it's safe to emit
	  // 'readable' etc.
	  //
	  // 3. Actually pull the requested chunks out of the buffer and return.
	  // if we need a readable event, then we need to do some reading.


	  var doRead = state.needReadable;
	  debug('need readable', doRead); // if we currently have less than the highWaterMark, then also read some

	  if (state.length === 0 || state.length - n < state.highWaterMark) {
	    doRead = true;
	    debug('length less than watermark', doRead);
	  } // however, if we've ended, then there's no point, and if we're already
	  // reading, then it's unnecessary.


	  if (state.ended || state.reading) {
	    doRead = false;
	    debug('reading or ended', doRead);
	  } else if (doRead) {
	    debug('do read');
	    state.reading = true;
	    state.sync = true; // if the length is currently zero, then we *need* a readable event.

	    if (state.length === 0) state.needReadable = true; // call internal read method

	    this._read(state.highWaterMark);

	    state.sync = false; // If _read pushed data synchronously, then `reading` will be false,
	    // and we need to re-evaluate how much data we can return to the user.

	    if (!state.reading) n = howMuchToRead(nOrig, state);
	  }

	  var ret;
	  if (n > 0) ret = fromList(n, state);else ret = null;

	  if (ret === null) {
	    state.needReadable = state.length <= state.highWaterMark;
	    n = 0;
	  } else {
	    state.length -= n;
	    state.awaitDrain = 0;
	  }

	  if (state.length === 0) {
	    // If we have nothing in the buffer, then we want to know
	    // as soon as we *do* get something into the buffer.
	    if (!state.ended) state.needReadable = true; // If we tried to read() past the EOF, then emit end on the next tick.

	    if (nOrig !== n && state.ended) endReadable(this);
	  }

	  if (ret !== null) this.emit('data', ret);
	  return ret;
	};

	function onEofChunk(stream, state) {
	  debug('onEofChunk');
	  if (state.ended) return;

	  if (state.decoder) {
	    var chunk = state.decoder.end();

	    if (chunk && chunk.length) {
	      state.buffer.push(chunk);
	      state.length += state.objectMode ? 1 : chunk.length;
	    }
	  }

	  state.ended = true;

	  if (state.sync) {
	    // if we are sync, wait until next tick to emit the data.
	    // Otherwise we risk emitting data in the flow()
	    // the readable code triggers during a read() call
	    emitReadable(stream);
	  } else {
	    // emit 'readable' now to make sure it gets picked up.
	    state.needReadable = false;

	    if (!state.emittedReadable) {
	      state.emittedReadable = true;
	      emitReadable_(stream);
	    }
	  }
	} // Don't emit readable right away in sync mode, because this can trigger
	// another read() call => stack overflow.  This way, it might trigger
	// a nextTick recursion warning, but that's not so bad.


	function emitReadable(stream) {
	  var state = stream._readableState;
	  debug('emitReadable', state.needReadable, state.emittedReadable);
	  state.needReadable = false;

	  if (!state.emittedReadable) {
	    debug('emitReadable', state.flowing);
	    state.emittedReadable = true;
	    process.nextTick(emitReadable_, stream);
	  }
	}

	function emitReadable_(stream) {
	  var state = stream._readableState;
	  debug('emitReadable_', state.destroyed, state.length, state.ended);

	  if (!state.destroyed && (state.length || state.ended)) {
	    stream.emit('readable');
	    state.emittedReadable = false;
	  } // The stream needs another readable event if
	  // 1. It is not flowing, as the flow mechanism will take
	  //    care of it.
	  // 2. It is not ended.
	  // 3. It is below the highWaterMark, so we can schedule
	  //    another readable later.


	  state.needReadable = !state.flowing && !state.ended && state.length <= state.highWaterMark;
	  flow(stream);
	} // at this point, the user has presumably seen the 'readable' event,
	// and called read() to consume some data.  that may have triggered
	// in turn another _read(n) call, in which case reading = true if
	// it's in progress.
	// However, if we're not ended, or reading, and the length < hwm,
	// then go ahead and try to read some more preemptively.


	function maybeReadMore(stream, state) {
	  if (!state.readingMore) {
	    state.readingMore = true;
	    process.nextTick(maybeReadMore_, stream, state);
	  }
	}

	function maybeReadMore_(stream, state) {
	  // Attempt to read more data if we should.
	  //
	  // The conditions for reading more data are (one of):
	  // - Not enough data buffered (state.length < state.highWaterMark). The loop
	  //   is responsible for filling the buffer with enough data if such data
	  //   is available. If highWaterMark is 0 and we are not in the flowing mode
	  //   we should _not_ attempt to buffer any extra data. We'll get more data
	  //   when the stream consumer calls read() instead.
	  // - No data in the buffer, and the stream is in flowing mode. In this mode
	  //   the loop below is responsible for ensuring read() is called. Failing to
	  //   call read here would abort the flow and there's no other mechanism for
	  //   continuing the flow if the stream consumer has just subscribed to the
	  //   'data' event.
	  //
	  // In addition to the above conditions to keep reading data, the following
	  // conditions prevent the data from being read:
	  // - The stream has ended (state.ended).
	  // - There is already a pending 'read' operation (state.reading). This is a
	  //   case where the the stream has called the implementation defined _read()
	  //   method, but they are processing the call asynchronously and have _not_
	  //   called push() with new data. In this case we skip performing more
	  //   read()s. The execution ends in this method again after the _read() ends
	  //   up calling push() with more data.
	  while (!state.reading && !state.ended && (state.length < state.highWaterMark || state.flowing && state.length === 0)) {
	    var len = state.length;
	    debug('maybeReadMore read 0');
	    stream.read(0);
	    if (len === state.length) // didn't get any data, stop spinning.
	      break;
	  }

	  state.readingMore = false;
	} // abstract method.  to be overridden in specific implementation classes.
	// call cb(er, data) where data is <= n in length.
	// for virtual (non-string, non-buffer) streams, "length" is somewhat
	// arbitrary, and perhaps not very meaningful.


	Readable.prototype._read = function (n) {
	  errorOrDestroy(this, new ERR_METHOD_NOT_IMPLEMENTED('_read()'));
	};

	Readable.prototype.pipe = function (dest, pipeOpts) {
	  var src = this;
	  var state = this._readableState;

	  switch (state.pipesCount) {
	    case 0:
	      state.pipes = dest;
	      break;

	    case 1:
	      state.pipes = [state.pipes, dest];
	      break;

	    default:
	      state.pipes.push(dest);
	      break;
	  }

	  state.pipesCount += 1;
	  debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);
	  var doEnd = (!pipeOpts || pipeOpts.end !== false) && dest !== process.stdout && dest !== process.stderr;
	  var endFn = doEnd ? onend : unpipe;
	  if (state.endEmitted) process.nextTick(endFn);else src.once('end', endFn);
	  dest.on('unpipe', onunpipe);

	  function onunpipe(readable, unpipeInfo) {
	    debug('onunpipe');

	    if (readable === src) {
	      if (unpipeInfo && unpipeInfo.hasUnpiped === false) {
	        unpipeInfo.hasUnpiped = true;
	        cleanup();
	      }
	    }
	  }

	  function onend() {
	    debug('onend');
	    dest.end();
	  } // when the dest drains, it reduces the awaitDrain counter
	  // on the source.  This would be more elegant with a .once()
	  // handler in flow(), but adding and removing repeatedly is
	  // too slow.


	  var ondrain = pipeOnDrain(src);
	  dest.on('drain', ondrain);
	  var cleanedUp = false;

	  function cleanup() {
	    debug('cleanup'); // cleanup event handlers once the pipe is broken

	    dest.removeListener('close', onclose);
	    dest.removeListener('finish', onfinish);
	    dest.removeListener('drain', ondrain);
	    dest.removeListener('error', onerror);
	    dest.removeListener('unpipe', onunpipe);
	    src.removeListener('end', onend);
	    src.removeListener('end', unpipe);
	    src.removeListener('data', ondata);
	    cleanedUp = true; // if the reader is waiting for a drain event from this
	    // specific writer, then it would cause it to never start
	    // flowing again.
	    // So, if this is awaiting a drain, then we just call it now.
	    // If we don't know, then assume that we are waiting for one.

	    if (state.awaitDrain && (!dest._writableState || dest._writableState.needDrain)) ondrain();
	  }

	  src.on('data', ondata);

	  function ondata(chunk) {
	    debug('ondata');
	    var ret = dest.write(chunk);
	    debug('dest.write', ret);

	    if (ret === false) {
	      // If the user unpiped during `dest.write()`, it is possible
	      // to get stuck in a permanently paused state if that write
	      // also returned false.
	      // => Check whether `dest` is still a piping destination.
	      if ((state.pipesCount === 1 && state.pipes === dest || state.pipesCount > 1 && indexOf(state.pipes, dest) !== -1) && !cleanedUp) {
	        debug('false write response, pause', state.awaitDrain);
	        state.awaitDrain++;
	      }

	      src.pause();
	    }
	  } // if the dest has an error, then stop piping into it.
	  // however, don't suppress the throwing behavior for this.


	  function onerror(er) {
	    debug('onerror', er);
	    unpipe();
	    dest.removeListener('error', onerror);
	    if (EElistenerCount(dest, 'error') === 0) errorOrDestroy(dest, er);
	  } // Make sure our error handler is attached before userland ones.


	  prependListener(dest, 'error', onerror); // Both close and finish should trigger unpipe, but only once.

	  function onclose() {
	    dest.removeListener('finish', onfinish);
	    unpipe();
	  }

	  dest.once('close', onclose);

	  function onfinish() {
	    debug('onfinish');
	    dest.removeListener('close', onclose);
	    unpipe();
	  }

	  dest.once('finish', onfinish);

	  function unpipe() {
	    debug('unpipe');
	    src.unpipe(dest);
	  } // tell the dest that it's being piped to


	  dest.emit('pipe', src); // start the flow if it hasn't been started already.

	  if (!state.flowing) {
	    debug('pipe resume');
	    src.resume();
	  }

	  return dest;
	};

	function pipeOnDrain(src) {
	  return function pipeOnDrainFunctionResult() {
	    var state = src._readableState;
	    debug('pipeOnDrain', state.awaitDrain);
	    if (state.awaitDrain) state.awaitDrain--;

	    if (state.awaitDrain === 0 && EElistenerCount(src, 'data')) {
	      state.flowing = true;
	      flow(src);
	    }
	  };
	}

	Readable.prototype.unpipe = function (dest) {
	  var state = this._readableState;
	  var unpipeInfo = {
	    hasUnpiped: false
	  }; // if we're not piping anywhere, then do nothing.

	  if (state.pipesCount === 0) return this; // just one destination.  most common case.

	  if (state.pipesCount === 1) {
	    // passed in one, but it's not the right one.
	    if (dest && dest !== state.pipes) return this;
	    if (!dest) dest = state.pipes; // got a match.

	    state.pipes = null;
	    state.pipesCount = 0;
	    state.flowing = false;
	    if (dest) dest.emit('unpipe', this, unpipeInfo);
	    return this;
	  } // slow case. multiple pipe destinations.


	  if (!dest) {
	    // remove all.
	    var dests = state.pipes;
	    var len = state.pipesCount;
	    state.pipes = null;
	    state.pipesCount = 0;
	    state.flowing = false;

	    for (var i = 0; i < len; i++) {
	      dests[i].emit('unpipe', this, {
	        hasUnpiped: false
	      });
	    }

	    return this;
	  } // try to find the right one.


	  var index = indexOf(state.pipes, dest);
	  if (index === -1) return this;
	  state.pipes.splice(index, 1);
	  state.pipesCount -= 1;
	  if (state.pipesCount === 1) state.pipes = state.pipes[0];
	  dest.emit('unpipe', this, unpipeInfo);
	  return this;
	}; // set up data events if they are asked for
	// Ensure readable listeners eventually get something


	Readable.prototype.on = function (ev, fn) {
	  var res = Stream.prototype.on.call(this, ev, fn);
	  var state = this._readableState;

	  if (ev === 'data') {
	    // update readableListening so that resume() may be a no-op
	    // a few lines down. This is needed to support once('readable').
	    state.readableListening = this.listenerCount('readable') > 0; // Try start flowing on next tick if stream isn't explicitly paused

	    if (state.flowing !== false) this.resume();
	  } else if (ev === 'readable') {
	    if (!state.endEmitted && !state.readableListening) {
	      state.readableListening = state.needReadable = true;
	      state.flowing = false;
	      state.emittedReadable = false;
	      debug('on readable', state.length, state.reading);

	      if (state.length) {
	        emitReadable(this);
	      } else if (!state.reading) {
	        process.nextTick(nReadingNextTick, this);
	      }
	    }
	  }

	  return res;
	};

	Readable.prototype.addListener = Readable.prototype.on;

	Readable.prototype.removeListener = function (ev, fn) {
	  var res = Stream.prototype.removeListener.call(this, ev, fn);

	  if (ev === 'readable') {
	    // We need to check if there is someone still listening to
	    // readable and reset the state. However this needs to happen
	    // after readable has been emitted but before I/O (nextTick) to
	    // support once('readable', fn) cycles. This means that calling
	    // resume within the same tick will have no
	    // effect.
	    process.nextTick(updateReadableListening, this);
	  }

	  return res;
	};

	Readable.prototype.removeAllListeners = function (ev) {
	  var res = Stream.prototype.removeAllListeners.apply(this, arguments);

	  if (ev === 'readable' || ev === undefined) {
	    // We need to check if there is someone still listening to
	    // readable and reset the state. However this needs to happen
	    // after readable has been emitted but before I/O (nextTick) to
	    // support once('readable', fn) cycles. This means that calling
	    // resume within the same tick will have no
	    // effect.
	    process.nextTick(updateReadableListening, this);
	  }

	  return res;
	};

	function updateReadableListening(self) {
	  var state = self._readableState;
	  state.readableListening = self.listenerCount('readable') > 0;

	  if (state.resumeScheduled && !state.paused) {
	    // flowing needs to be set to true now, otherwise
	    // the upcoming resume will not flow.
	    state.flowing = true; // crude way to check if we should resume
	  } else if (self.listenerCount('data') > 0) {
	    self.resume();
	  }
	}

	function nReadingNextTick(self) {
	  debug('readable nexttick read 0');
	  self.read(0);
	} // pause() and resume() are remnants of the legacy readable stream API
	// If the user uses them, then switch into old mode.


	Readable.prototype.resume = function () {
	  var state = this._readableState;

	  if (!state.flowing) {
	    debug('resume'); // we flow only if there is no one listening
	    // for readable, but we still have to call
	    // resume()

	    state.flowing = !state.readableListening;
	    resume(this, state);
	  }

	  state.paused = false;
	  return this;
	};

	function resume(stream, state) {
	  if (!state.resumeScheduled) {
	    state.resumeScheduled = true;
	    process.nextTick(resume_, stream, state);
	  }
	}

	function resume_(stream, state) {
	  debug('resume', state.reading);

	  if (!state.reading) {
	    stream.read(0);
	  }

	  state.resumeScheduled = false;
	  stream.emit('resume');
	  flow(stream);
	  if (state.flowing && !state.reading) stream.read(0);
	}

	Readable.prototype.pause = function () {
	  debug('call pause flowing=%j', this._readableState.flowing);

	  if (this._readableState.flowing !== false) {
	    debug('pause');
	    this._readableState.flowing = false;
	    this.emit('pause');
	  }

	  this._readableState.paused = true;
	  return this;
	};

	function flow(stream) {
	  var state = stream._readableState;
	  debug('flow', state.flowing);

	  while (state.flowing && stream.read() !== null) {
	  }
	} // wrap an old-style stream as the async data source.
	// This is *not* part of the readable stream interface.
	// It is an ugly unfortunate mess of history.


	Readable.prototype.wrap = function (stream) {
	  var _this = this;

	  var state = this._readableState;
	  var paused = false;
	  stream.on('end', function () {
	    debug('wrapped end');

	    if (state.decoder && !state.ended) {
	      var chunk = state.decoder.end();
	      if (chunk && chunk.length) _this.push(chunk);
	    }

	    _this.push(null);
	  });
	  stream.on('data', function (chunk) {
	    debug('wrapped data');
	    if (state.decoder) chunk = state.decoder.write(chunk); // don't skip over falsy values in objectMode

	    if (state.objectMode && (chunk === null || chunk === undefined)) return;else if (!state.objectMode && (!chunk || !chunk.length)) return;

	    var ret = _this.push(chunk);

	    if (!ret) {
	      paused = true;
	      stream.pause();
	    }
	  }); // proxy all the other methods.
	  // important when wrapping filters and duplexes.

	  for (var i in stream) {
	    if (this[i] === undefined && typeof stream[i] === 'function') {
	      this[i] = function methodWrap(method) {
	        return function methodWrapReturnFunction() {
	          return stream[method].apply(stream, arguments);
	        };
	      }(i);
	    }
	  } // proxy certain important events.


	  for (var n = 0; n < kProxyEvents.length; n++) {
	    stream.on(kProxyEvents[n], this.emit.bind(this, kProxyEvents[n]));
	  } // when we try to consume some more bytes, simply unpause the
	  // underlying stream.


	  this._read = function (n) {
	    debug('wrapped _read', n);

	    if (paused) {
	      paused = false;
	      stream.resume();
	    }
	  };

	  return this;
	};

	if (typeof Symbol === 'function') {
	  Readable.prototype[Symbol.asyncIterator] = function () {
	    if (createReadableStreamAsyncIterator === undefined) {
	      createReadableStreamAsyncIterator = requireAsync_iterator();
	    }

	    return createReadableStreamAsyncIterator(this);
	  };
	}

	Object.defineProperty(Readable.prototype, 'readableHighWaterMark', {
	  // making it explicit this property is not enumerable
	  // because otherwise some prototype manipulation in
	  // userland will fail
	  enumerable: false,
	  get: function get() {
	    return this._readableState.highWaterMark;
	  }
	});
	Object.defineProperty(Readable.prototype, 'readableBuffer', {
	  // making it explicit this property is not enumerable
	  // because otherwise some prototype manipulation in
	  // userland will fail
	  enumerable: false,
	  get: function get() {
	    return this._readableState && this._readableState.buffer;
	  }
	});
	Object.defineProperty(Readable.prototype, 'readableFlowing', {
	  // making it explicit this property is not enumerable
	  // because otherwise some prototype manipulation in
	  // userland will fail
	  enumerable: false,
	  get: function get() {
	    return this._readableState.flowing;
	  },
	  set: function set(state) {
	    if (this._readableState) {
	      this._readableState.flowing = state;
	    }
	  }
	}); // exposed for testing purposes only.

	Readable._fromList = fromList;
	Object.defineProperty(Readable.prototype, 'readableLength', {
	  // making it explicit this property is not enumerable
	  // because otherwise some prototype manipulation in
	  // userland will fail
	  enumerable: false,
	  get: function get() {
	    return this._readableState.length;
	  }
	}); // Pluck off n bytes from an array of buffers.
	// Length is the combined lengths of all the buffers in the list.
	// This function is designed to be inlinable, so please take care when making
	// changes to the function body.

	function fromList(n, state) {
	  // nothing buffered
	  if (state.length === 0) return null;
	  var ret;
	  if (state.objectMode) ret = state.buffer.shift();else if (!n || n >= state.length) {
	    // read it all, truncate the list
	    if (state.decoder) ret = state.buffer.join('');else if (state.buffer.length === 1) ret = state.buffer.first();else ret = state.buffer.concat(state.length);
	    state.buffer.clear();
	  } else {
	    // read part of list
	    ret = state.buffer.consume(n, state.decoder);
	  }
	  return ret;
	}

	function endReadable(stream) {
	  var state = stream._readableState;
	  debug('endReadable', state.endEmitted);

	  if (!state.endEmitted) {
	    state.ended = true;
	    process.nextTick(endReadableNT, state, stream);
	  }
	}

	function endReadableNT(state, stream) {
	  debug('endReadableNT', state.endEmitted, state.length); // Check that we didn't get one last unshift.

	  if (!state.endEmitted && state.length === 0) {
	    state.endEmitted = true;
	    stream.readable = false;
	    stream.emit('end');

	    if (state.autoDestroy) {
	      // In case of duplex streams we need a way to detect
	      // if the writable side is ready for autoDestroy as well
	      var wState = stream._writableState;

	      if (!wState || wState.autoDestroy && wState.finished) {
	        stream.destroy();
	      }
	    }
	  }
	}

	if (typeof Symbol === 'function') {
	  Readable.from = function (iterable, opts) {
	    if (from === undefined) {
	      from = requireFrom();
	    }

	    return from(Readable, iterable, opts);
	  };
	}

	function indexOf(xs, x) {
	  for (var i = 0, l = xs.length; i < l; i++) {
	    if (xs[i] === x) return i;
	  }

	  return -1;
	}
	return _stream_readable;
}

var _stream_duplex;
var hasRequired_stream_duplex;

function require_stream_duplex () {
	if (hasRequired_stream_duplex) return _stream_duplex;
	hasRequired_stream_duplex = 1;
	/*<replacement>*/

	var objectKeys = Object.keys || function (obj) {
	  var keys = [];

	  for (var key in obj) {
	    keys.push(key);
	  }

	  return keys;
	};
	/*</replacement>*/


	_stream_duplex = Duplex;

	var Readable = require_stream_readable();

	var Writable = require_stream_writable();

	requireInherits()(Duplex, Readable);

	{
	  // Allow the keys array to be GC'ed.
	  var keys = objectKeys(Writable.prototype);

	  for (var v = 0; v < keys.length; v++) {
	    var method = keys[v];
	    if (!Duplex.prototype[method]) Duplex.prototype[method] = Writable.prototype[method];
	  }
	}

	function Duplex(options) {
	  if (!(this instanceof Duplex)) return new Duplex(options);
	  Readable.call(this, options);
	  Writable.call(this, options);
	  this.allowHalfOpen = true;

	  if (options) {
	    if (options.readable === false) this.readable = false;
	    if (options.writable === false) this.writable = false;

	    if (options.allowHalfOpen === false) {
	      this.allowHalfOpen = false;
	      this.once('end', onend);
	    }
	  }
	}

	Object.defineProperty(Duplex.prototype, 'writableHighWaterMark', {
	  // making it explicit this property is not enumerable
	  // because otherwise some prototype manipulation in
	  // userland will fail
	  enumerable: false,
	  get: function get() {
	    return this._writableState.highWaterMark;
	  }
	});
	Object.defineProperty(Duplex.prototype, 'writableBuffer', {
	  // making it explicit this property is not enumerable
	  // because otherwise some prototype manipulation in
	  // userland will fail
	  enumerable: false,
	  get: function get() {
	    return this._writableState && this._writableState.getBuffer();
	  }
	});
	Object.defineProperty(Duplex.prototype, 'writableLength', {
	  // making it explicit this property is not enumerable
	  // because otherwise some prototype manipulation in
	  // userland will fail
	  enumerable: false,
	  get: function get() {
	    return this._writableState.length;
	  }
	}); // the no-half-open enforcer

	function onend() {
	  // If the writable side ended, then we're ok.
	  if (this._writableState.ended) return; // no more data can be written.
	  // But allow more writes to happen in this tick.

	  process.nextTick(onEndNT, this);
	}

	function onEndNT(self) {
	  self.end();
	}

	Object.defineProperty(Duplex.prototype, 'destroyed', {
	  // making it explicit this property is not enumerable
	  // because otherwise some prototype manipulation in
	  // userland will fail
	  enumerable: false,
	  get: function get() {
	    if (this._readableState === undefined || this._writableState === undefined) {
	      return false;
	    }

	    return this._readableState.destroyed && this._writableState.destroyed;
	  },
	  set: function set(value) {
	    // we ignore the value if the stream
	    // has not been initialized yet
	    if (this._readableState === undefined || this._writableState === undefined) {
	      return;
	    } // backward compatibility, the user is explicitly
	    // managing destroyed


	    this._readableState.destroyed = value;
	    this._writableState.destroyed = value;
	  }
	});
	return _stream_duplex;
}

var _stream_writable;
var hasRequired_stream_writable;

function require_stream_writable () {
	if (hasRequired_stream_writable) return _stream_writable;
	hasRequired_stream_writable = 1;

	_stream_writable = Writable;
	// there will be only 2 of these for each stream


	function CorkedRequest(state) {
	  var _this = this;

	  this.next = null;
	  this.entry = null;

	  this.finish = function () {
	    onCorkedFinish(_this, state);
	  };
	}
	/* </replacement> */

	/*<replacement>*/


	var Duplex;
	/*</replacement>*/

	Writable.WritableState = WritableState;
	/*<replacement>*/

	var internalUtil = {
	  deprecate: requireNode()
	};
	/*</replacement>*/

	/*<replacement>*/

	var Stream = requireStream$1();
	/*</replacement>*/


	var Buffer = require$$0__default$3["default"].Buffer;

	var OurUint8Array = commonjsGlobal.Uint8Array || function () {};

	function _uint8ArrayToBuffer(chunk) {
	  return Buffer.from(chunk);
	}

	function _isUint8Array(obj) {
	  return Buffer.isBuffer(obj) || obj instanceof OurUint8Array;
	}

	var destroyImpl = requireDestroy();

	var _require = requireState(),
	    getHighWaterMark = _require.getHighWaterMark;

	var _require$codes = requireErrors().codes,
	    ERR_INVALID_ARG_TYPE = _require$codes.ERR_INVALID_ARG_TYPE,
	    ERR_METHOD_NOT_IMPLEMENTED = _require$codes.ERR_METHOD_NOT_IMPLEMENTED,
	    ERR_MULTIPLE_CALLBACK = _require$codes.ERR_MULTIPLE_CALLBACK,
	    ERR_STREAM_CANNOT_PIPE = _require$codes.ERR_STREAM_CANNOT_PIPE,
	    ERR_STREAM_DESTROYED = _require$codes.ERR_STREAM_DESTROYED,
	    ERR_STREAM_NULL_VALUES = _require$codes.ERR_STREAM_NULL_VALUES,
	    ERR_STREAM_WRITE_AFTER_END = _require$codes.ERR_STREAM_WRITE_AFTER_END,
	    ERR_UNKNOWN_ENCODING = _require$codes.ERR_UNKNOWN_ENCODING;

	var errorOrDestroy = destroyImpl.errorOrDestroy;

	requireInherits()(Writable, Stream);

	function nop() {}

	function WritableState(options, stream, isDuplex) {
	  Duplex = Duplex || require_stream_duplex();
	  options = options || {}; // Duplex streams are both readable and writable, but share
	  // the same options object.
	  // However, some cases require setting options to different
	  // values for the readable and the writable sides of the duplex stream,
	  // e.g. options.readableObjectMode vs. options.writableObjectMode, etc.

	  if (typeof isDuplex !== 'boolean') isDuplex = stream instanceof Duplex; // object stream flag to indicate whether or not this stream
	  // contains buffers or objects.

	  this.objectMode = !!options.objectMode;
	  if (isDuplex) this.objectMode = this.objectMode || !!options.writableObjectMode; // the point at which write() starts returning false
	  // Note: 0 is a valid value, means that we always return false if
	  // the entire buffer is not flushed immediately on write()

	  this.highWaterMark = getHighWaterMark(this, options, 'writableHighWaterMark', isDuplex); // if _final has been called

	  this.finalCalled = false; // drain event flag.

	  this.needDrain = false; // at the start of calling end()

	  this.ending = false; // when end() has been called, and returned

	  this.ended = false; // when 'finish' is emitted

	  this.finished = false; // has it been destroyed

	  this.destroyed = false; // should we decode strings into buffers before passing to _write?
	  // this is here so that some node-core streams can optimize string
	  // handling at a lower level.

	  var noDecode = options.decodeStrings === false;
	  this.decodeStrings = !noDecode; // Crypto is kind of old and crusty.  Historically, its default string
	  // encoding is 'binary' so we have to make this configurable.
	  // Everything else in the universe uses 'utf8', though.

	  this.defaultEncoding = options.defaultEncoding || 'utf8'; // not an actual buffer we keep track of, but a measurement
	  // of how much we're waiting to get pushed to some underlying
	  // socket or file.

	  this.length = 0; // a flag to see when we're in the middle of a write.

	  this.writing = false; // when true all writes will be buffered until .uncork() call

	  this.corked = 0; // a flag to be able to tell if the onwrite cb is called immediately,
	  // or on a later tick.  We set this to true at first, because any
	  // actions that shouldn't happen until "later" should generally also
	  // not happen before the first write call.

	  this.sync = true; // a flag to know if we're processing previously buffered items, which
	  // may call the _write() callback in the same tick, so that we don't
	  // end up in an overlapped onwrite situation.

	  this.bufferProcessing = false; // the callback that's passed to _write(chunk,cb)

	  this.onwrite = function (er) {
	    onwrite(stream, er);
	  }; // the callback that the user supplies to write(chunk,encoding,cb)


	  this.writecb = null; // the amount that is being written when _write is called.

	  this.writelen = 0;
	  this.bufferedRequest = null;
	  this.lastBufferedRequest = null; // number of pending user-supplied write callbacks
	  // this must be 0 before 'finish' can be emitted

	  this.pendingcb = 0; // emit prefinish if the only thing we're waiting for is _write cbs
	  // This is relevant for synchronous Transform streams

	  this.prefinished = false; // True if the error was already emitted and should not be thrown again

	  this.errorEmitted = false; // Should close be emitted on destroy. Defaults to true.

	  this.emitClose = options.emitClose !== false; // Should .destroy() be called after 'finish' (and potentially 'end')

	  this.autoDestroy = !!options.autoDestroy; // count buffered requests

	  this.bufferedRequestCount = 0; // allocate the first CorkedRequest, there is always
	  // one allocated and free to use, and we maintain at most two

	  this.corkedRequestsFree = new CorkedRequest(this);
	}

	WritableState.prototype.getBuffer = function getBuffer() {
	  var current = this.bufferedRequest;
	  var out = [];

	  while (current) {
	    out.push(current);
	    current = current.next;
	  }

	  return out;
	};

	(function () {
	  try {
	    Object.defineProperty(WritableState.prototype, 'buffer', {
	      get: internalUtil.deprecate(function writableStateBufferGetter() {
	        return this.getBuffer();
	      }, '_writableState.buffer is deprecated. Use _writableState.getBuffer ' + 'instead.', 'DEP0003')
	    });
	  } catch (_) {}
	})(); // Test _writableState for inheritance to account for Duplex streams,
	// whose prototype chain only points to Readable.


	var realHasInstance;

	if (typeof Symbol === 'function' && Symbol.hasInstance && typeof Function.prototype[Symbol.hasInstance] === 'function') {
	  realHasInstance = Function.prototype[Symbol.hasInstance];
	  Object.defineProperty(Writable, Symbol.hasInstance, {
	    value: function value(object) {
	      if (realHasInstance.call(this, object)) return true;
	      if (this !== Writable) return false;
	      return object && object._writableState instanceof WritableState;
	    }
	  });
	} else {
	  realHasInstance = function realHasInstance(object) {
	    return object instanceof this;
	  };
	}

	function Writable(options) {
	  Duplex = Duplex || require_stream_duplex(); // Writable ctor is applied to Duplexes, too.
	  // `realHasInstance` is necessary because using plain `instanceof`
	  // would return false, as no `_writableState` property is attached.
	  // Trying to use the custom `instanceof` for Writable here will also break the
	  // Node.js LazyTransform implementation, which has a non-trivial getter for
	  // `_writableState` that would lead to infinite recursion.
	  // Checking for a Stream.Duplex instance is faster here instead of inside
	  // the WritableState constructor, at least with V8 6.5

	  var isDuplex = this instanceof Duplex;
	  if (!isDuplex && !realHasInstance.call(Writable, this)) return new Writable(options);
	  this._writableState = new WritableState(options, this, isDuplex); // legacy.

	  this.writable = true;

	  if (options) {
	    if (typeof options.write === 'function') this._write = options.write;
	    if (typeof options.writev === 'function') this._writev = options.writev;
	    if (typeof options.destroy === 'function') this._destroy = options.destroy;
	    if (typeof options.final === 'function') this._final = options.final;
	  }

	  Stream.call(this);
	} // Otherwise people can pipe Writable streams, which is just wrong.


	Writable.prototype.pipe = function () {
	  errorOrDestroy(this, new ERR_STREAM_CANNOT_PIPE());
	};

	function writeAfterEnd(stream, cb) {
	  var er = new ERR_STREAM_WRITE_AFTER_END(); // TODO: defer error events consistently everywhere, not just the cb

	  errorOrDestroy(stream, er);
	  process.nextTick(cb, er);
	} // Checks that a user-supplied chunk is valid, especially for the particular
	// mode the stream is in. Currently this means that `null` is never accepted
	// and undefined/non-string values are only allowed in object mode.


	function validChunk(stream, state, chunk, cb) {
	  var er;

	  if (chunk === null) {
	    er = new ERR_STREAM_NULL_VALUES();
	  } else if (typeof chunk !== 'string' && !state.objectMode) {
	    er = new ERR_INVALID_ARG_TYPE('chunk', ['string', 'Buffer'], chunk);
	  }

	  if (er) {
	    errorOrDestroy(stream, er);
	    process.nextTick(cb, er);
	    return false;
	  }

	  return true;
	}

	Writable.prototype.write = function (chunk, encoding, cb) {
	  var state = this._writableState;
	  var ret = false;

	  var isBuf = !state.objectMode && _isUint8Array(chunk);

	  if (isBuf && !Buffer.isBuffer(chunk)) {
	    chunk = _uint8ArrayToBuffer(chunk);
	  }

	  if (typeof encoding === 'function') {
	    cb = encoding;
	    encoding = null;
	  }

	  if (isBuf) encoding = 'buffer';else if (!encoding) encoding = state.defaultEncoding;
	  if (typeof cb !== 'function') cb = nop;
	  if (state.ending) writeAfterEnd(this, cb);else if (isBuf || validChunk(this, state, chunk, cb)) {
	    state.pendingcb++;
	    ret = writeOrBuffer(this, state, isBuf, chunk, encoding, cb);
	  }
	  return ret;
	};

	Writable.prototype.cork = function () {
	  this._writableState.corked++;
	};

	Writable.prototype.uncork = function () {
	  var state = this._writableState;

	  if (state.corked) {
	    state.corked--;
	    if (!state.writing && !state.corked && !state.bufferProcessing && state.bufferedRequest) clearBuffer(this, state);
	  }
	};

	Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
	  // node::ParseEncoding() requires lower case.
	  if (typeof encoding === 'string') encoding = encoding.toLowerCase();
	  if (!(['hex', 'utf8', 'utf-8', 'ascii', 'binary', 'base64', 'ucs2', 'ucs-2', 'utf16le', 'utf-16le', 'raw'].indexOf((encoding + '').toLowerCase()) > -1)) throw new ERR_UNKNOWN_ENCODING(encoding);
	  this._writableState.defaultEncoding = encoding;
	  return this;
	};

	Object.defineProperty(Writable.prototype, 'writableBuffer', {
	  // making it explicit this property is not enumerable
	  // because otherwise some prototype manipulation in
	  // userland will fail
	  enumerable: false,
	  get: function get() {
	    return this._writableState && this._writableState.getBuffer();
	  }
	});

	function decodeChunk(state, chunk, encoding) {
	  if (!state.objectMode && state.decodeStrings !== false && typeof chunk === 'string') {
	    chunk = Buffer.from(chunk, encoding);
	  }

	  return chunk;
	}

	Object.defineProperty(Writable.prototype, 'writableHighWaterMark', {
	  // making it explicit this property is not enumerable
	  // because otherwise some prototype manipulation in
	  // userland will fail
	  enumerable: false,
	  get: function get() {
	    return this._writableState.highWaterMark;
	  }
	}); // if we're already writing something, then just put this
	// in the queue, and wait our turn.  Otherwise, call _write
	// If we return false, then we need a drain event, so set that flag.

	function writeOrBuffer(stream, state, isBuf, chunk, encoding, cb) {
	  if (!isBuf) {
	    var newChunk = decodeChunk(state, chunk, encoding);

	    if (chunk !== newChunk) {
	      isBuf = true;
	      encoding = 'buffer';
	      chunk = newChunk;
	    }
	  }

	  var len = state.objectMode ? 1 : chunk.length;
	  state.length += len;
	  var ret = state.length < state.highWaterMark; // we must ensure that previous needDrain will not be reset to false.

	  if (!ret) state.needDrain = true;

	  if (state.writing || state.corked) {
	    var last = state.lastBufferedRequest;
	    state.lastBufferedRequest = {
	      chunk: chunk,
	      encoding: encoding,
	      isBuf: isBuf,
	      callback: cb,
	      next: null
	    };

	    if (last) {
	      last.next = state.lastBufferedRequest;
	    } else {
	      state.bufferedRequest = state.lastBufferedRequest;
	    }

	    state.bufferedRequestCount += 1;
	  } else {
	    doWrite(stream, state, false, len, chunk, encoding, cb);
	  }

	  return ret;
	}

	function doWrite(stream, state, writev, len, chunk, encoding, cb) {
	  state.writelen = len;
	  state.writecb = cb;
	  state.writing = true;
	  state.sync = true;
	  if (state.destroyed) state.onwrite(new ERR_STREAM_DESTROYED('write'));else if (writev) stream._writev(chunk, state.onwrite);else stream._write(chunk, encoding, state.onwrite);
	  state.sync = false;
	}

	function onwriteError(stream, state, sync, er, cb) {
	  --state.pendingcb;

	  if (sync) {
	    // defer the callback if we are being called synchronously
	    // to avoid piling up things on the stack
	    process.nextTick(cb, er); // this can emit finish, and it will always happen
	    // after error

	    process.nextTick(finishMaybe, stream, state);
	    stream._writableState.errorEmitted = true;
	    errorOrDestroy(stream, er);
	  } else {
	    // the caller expect this to happen before if
	    // it is async
	    cb(er);
	    stream._writableState.errorEmitted = true;
	    errorOrDestroy(stream, er); // this can emit finish, but finish must
	    // always follow error

	    finishMaybe(stream, state);
	  }
	}

	function onwriteStateUpdate(state) {
	  state.writing = false;
	  state.writecb = null;
	  state.length -= state.writelen;
	  state.writelen = 0;
	}

	function onwrite(stream, er) {
	  var state = stream._writableState;
	  var sync = state.sync;
	  var cb = state.writecb;
	  if (typeof cb !== 'function') throw new ERR_MULTIPLE_CALLBACK();
	  onwriteStateUpdate(state);
	  if (er) onwriteError(stream, state, sync, er, cb);else {
	    // Check if we're actually ready to finish, but don't emit yet
	    var finished = needFinish(state) || stream.destroyed;

	    if (!finished && !state.corked && !state.bufferProcessing && state.bufferedRequest) {
	      clearBuffer(stream, state);
	    }

	    if (sync) {
	      process.nextTick(afterWrite, stream, state, finished, cb);
	    } else {
	      afterWrite(stream, state, finished, cb);
	    }
	  }
	}

	function afterWrite(stream, state, finished, cb) {
	  if (!finished) onwriteDrain(stream, state);
	  state.pendingcb--;
	  cb();
	  finishMaybe(stream, state);
	} // Must force callback to be called on nextTick, so that we don't
	// emit 'drain' before the write() consumer gets the 'false' return
	// value, and has a chance to attach a 'drain' listener.


	function onwriteDrain(stream, state) {
	  if (state.length === 0 && state.needDrain) {
	    state.needDrain = false;
	    stream.emit('drain');
	  }
	} // if there's something in the buffer waiting, then process it


	function clearBuffer(stream, state) {
	  state.bufferProcessing = true;
	  var entry = state.bufferedRequest;

	  if (stream._writev && entry && entry.next) {
	    // Fast case, write everything using _writev()
	    var l = state.bufferedRequestCount;
	    var buffer = new Array(l);
	    var holder = state.corkedRequestsFree;
	    holder.entry = entry;
	    var count = 0;
	    var allBuffers = true;

	    while (entry) {
	      buffer[count] = entry;
	      if (!entry.isBuf) allBuffers = false;
	      entry = entry.next;
	      count += 1;
	    }

	    buffer.allBuffers = allBuffers;
	    doWrite(stream, state, true, state.length, buffer, '', holder.finish); // doWrite is almost always async, defer these to save a bit of time
	    // as the hot path ends with doWrite

	    state.pendingcb++;
	    state.lastBufferedRequest = null;

	    if (holder.next) {
	      state.corkedRequestsFree = holder.next;
	      holder.next = null;
	    } else {
	      state.corkedRequestsFree = new CorkedRequest(state);
	    }

	    state.bufferedRequestCount = 0;
	  } else {
	    // Slow case, write chunks one-by-one
	    while (entry) {
	      var chunk = entry.chunk;
	      var encoding = entry.encoding;
	      var cb = entry.callback;
	      var len = state.objectMode ? 1 : chunk.length;
	      doWrite(stream, state, false, len, chunk, encoding, cb);
	      entry = entry.next;
	      state.bufferedRequestCount--; // if we didn't call the onwrite immediately, then
	      // it means that we need to wait until it does.
	      // also, that means that the chunk and cb are currently
	      // being processed, so move the buffer counter past them.

	      if (state.writing) {
	        break;
	      }
	    }

	    if (entry === null) state.lastBufferedRequest = null;
	  }

	  state.bufferedRequest = entry;
	  state.bufferProcessing = false;
	}

	Writable.prototype._write = function (chunk, encoding, cb) {
	  cb(new ERR_METHOD_NOT_IMPLEMENTED('_write()'));
	};

	Writable.prototype._writev = null;

	Writable.prototype.end = function (chunk, encoding, cb) {
	  var state = this._writableState;

	  if (typeof chunk === 'function') {
	    cb = chunk;
	    chunk = null;
	    encoding = null;
	  } else if (typeof encoding === 'function') {
	    cb = encoding;
	    encoding = null;
	  }

	  if (chunk !== null && chunk !== undefined) this.write(chunk, encoding); // .end() fully uncorks

	  if (state.corked) {
	    state.corked = 1;
	    this.uncork();
	  } // ignore unnecessary end() calls.


	  if (!state.ending) endWritable(this, state, cb);
	  return this;
	};

	Object.defineProperty(Writable.prototype, 'writableLength', {
	  // making it explicit this property is not enumerable
	  // because otherwise some prototype manipulation in
	  // userland will fail
	  enumerable: false,
	  get: function get() {
	    return this._writableState.length;
	  }
	});

	function needFinish(state) {
	  return state.ending && state.length === 0 && state.bufferedRequest === null && !state.finished && !state.writing;
	}

	function callFinal(stream, state) {
	  stream._final(function (err) {
	    state.pendingcb--;

	    if (err) {
	      errorOrDestroy(stream, err);
	    }

	    state.prefinished = true;
	    stream.emit('prefinish');
	    finishMaybe(stream, state);
	  });
	}

	function prefinish(stream, state) {
	  if (!state.prefinished && !state.finalCalled) {
	    if (typeof stream._final === 'function' && !state.destroyed) {
	      state.pendingcb++;
	      state.finalCalled = true;
	      process.nextTick(callFinal, stream, state);
	    } else {
	      state.prefinished = true;
	      stream.emit('prefinish');
	    }
	  }
	}

	function finishMaybe(stream, state) {
	  var need = needFinish(state);

	  if (need) {
	    prefinish(stream, state);

	    if (state.pendingcb === 0) {
	      state.finished = true;
	      stream.emit('finish');

	      if (state.autoDestroy) {
	        // In case of duplex streams we need a way to detect
	        // if the readable side is ready for autoDestroy as well
	        var rState = stream._readableState;

	        if (!rState || rState.autoDestroy && rState.endEmitted) {
	          stream.destroy();
	        }
	      }
	    }
	  }

	  return need;
	}

	function endWritable(stream, state, cb) {
	  state.ending = true;
	  finishMaybe(stream, state);

	  if (cb) {
	    if (state.finished) process.nextTick(cb);else stream.once('finish', cb);
	  }

	  state.ended = true;
	  stream.writable = false;
	}

	function onCorkedFinish(corkReq, state, err) {
	  var entry = corkReq.entry;
	  corkReq.entry = null;

	  while (entry) {
	    var cb = entry.callback;
	    state.pendingcb--;
	    cb(err);
	    entry = entry.next;
	  } // reuse the free corkReq.


	  state.corkedRequestsFree.next = corkReq;
	}

	Object.defineProperty(Writable.prototype, 'destroyed', {
	  // making it explicit this property is not enumerable
	  // because otherwise some prototype manipulation in
	  // userland will fail
	  enumerable: false,
	  get: function get() {
	    if (this._writableState === undefined) {
	      return false;
	    }

	    return this._writableState.destroyed;
	  },
	  set: function set(value) {
	    // we ignore the value if the stream
	    // has not been initialized yet
	    if (!this._writableState) {
	      return;
	    } // backward compatibility, the user is explicitly
	    // managing destroyed


	    this._writableState.destroyed = value;
	  }
	});
	Writable.prototype.destroy = destroyImpl.destroy;
	Writable.prototype._undestroy = destroyImpl.undestroy;

	Writable.prototype._destroy = function (err, cb) {
	  cb(err);
	};
	return _stream_writable;
}

var legacyExports = {};
var legacy = {
  get exports(){ return legacyExports; },
  set exports(v){ legacyExports = v; },
};

var hasRequiredLegacy;

function requireLegacy () {
	if (hasRequiredLegacy) return legacyExports;
	hasRequiredLegacy = 1;

	const util = require$$0__default$1["default"];
	const { LEVEL } = tripleBeam;
	const TransportStream = requireWinstonTransport();

	/**
	 * Constructor function for the LegacyTransportStream. This is an internal
	 * wrapper `winston >= 3` uses to wrap older transports implementing
	 * log(level, message, meta).
	 * @param {Object} options - Options for this TransportStream instance.
	 * @param {Transpot} options.transport - winston@2 or older Transport to wrap.
	 */

	const LegacyTransportStream = legacy.exports = function LegacyTransportStream(options = {}) {
	  TransportStream.call(this, options);
	  if (!options.transport || typeof options.transport.log !== 'function') {
	    throw new Error('Invalid transport, must be an object with a log method.');
	  }

	  this.transport = options.transport;
	  this.level = this.level || options.transport.level;
	  this.handleExceptions = this.handleExceptions || options.transport.handleExceptions;

	  // Display our deprecation notice.
	  this._deprecated();

	  // Properly bubble up errors from the transport to the
	  // LegacyTransportStream instance, but only once no matter how many times
	  // this transport is shared.
	  function transportError(err) {
	    this.emit('error', err, this.transport);
	  }

	  if (!this.transport.__winstonError) {
	    this.transport.__winstonError = transportError.bind(this);
	    this.transport.on('error', this.transport.__winstonError);
	  }
	};

	/*
	 * Inherit from TransportStream using Node.js built-ins
	 */
	util.inherits(LegacyTransportStream, TransportStream);

	/**
	 * Writes the info object to our transport instance.
	 * @param {mixed} info - TODO: add param description.
	 * @param {mixed} enc - TODO: add param description.
	 * @param {function} callback - TODO: add param description.
	 * @returns {undefined}
	 * @private
	 */
	LegacyTransportStream.prototype._write = function _write(info, enc, callback) {
	  if (this.silent || (info.exception === true && !this.handleExceptions)) {
	    return callback(null);
	  }

	  // Remark: This has to be handled in the base transport now because we
	  // cannot conditionally write to our pipe targets as stream.
	  if (!this.level || this.levels[this.level] >= this.levels[info[LEVEL]]) {
	    this.transport.log(info[LEVEL], info.message, info, this._nop);
	  }

	  callback(null);
	};

	/**
	 * Writes the batch of info objects (i.e. "object chunks") to our transport
	 * instance after performing any necessary filtering.
	 * @param {mixed} chunks - TODO: add params description.
	 * @param {function} callback - TODO: add params description.
	 * @returns {mixed} - TODO: add returns description.
	 * @private
	 */
	LegacyTransportStream.prototype._writev = function _writev(chunks, callback) {
	  for (let i = 0; i < chunks.length; i++) {
	    if (this._accept(chunks[i])) {
	      this.transport.log(
	        chunks[i].chunk[LEVEL],
	        chunks[i].chunk.message,
	        chunks[i].chunk,
	        this._nop
	      );
	      chunks[i].callback();
	    }
	  }

	  return callback(null);
	};

	/**
	 * Displays a deprecation notice. Defined as a function so it can be
	 * overriden in tests.
	 * @returns {undefined}
	 */
	LegacyTransportStream.prototype._deprecated = function _deprecated() {
	  // eslint-disable-next-line no-console
	  console.error([
	    `${this.transport.name} is a legacy winston transport. Consider upgrading: `,
	    '- Upgrade docs: https://github.com/winstonjs/winston/blob/master/UPGRADE-3.0.md'
	  ].join('\n'));
	};

	/**
	 * Clean up error handling state on the legacy transport associated
	 * with this instance.
	 * @returns {undefined}
	 */
	LegacyTransportStream.prototype.close = function close() {
	  if (this.transport.close) {
	    this.transport.close();
	  }

	  if (this.transport.__winstonError) {
	    this.transport.removeListener('error', this.transport.__winstonError);
	    this.transport.__winstonError = null;
	  }
	};
	return legacyExports;
}

var hasRequiredWinstonTransport;

function requireWinstonTransport () {
	if (hasRequiredWinstonTransport) return winstonTransportExports;
	hasRequiredWinstonTransport = 1;

	const util = require$$0__default$1["default"];
	const Writable = require_stream_writable();
	const { LEVEL } = tripleBeam;

	/**
	 * Constructor function for the TransportStream. This is the base prototype
	 * that all `winston >= 3` transports should inherit from.
	 * @param {Object} options - Options for this TransportStream instance
	 * @param {String} options.level - Highest level according to RFC5424.
	 * @param {Boolean} options.handleExceptions - If true, info with
	 * { exception: true } will be written.
	 * @param {Function} options.log - Custom log function for simple Transport
	 * creation
	 * @param {Function} options.close - Called on "unpipe" from parent.
	 */
	const TransportStream = winstonTransport.exports = function TransportStream(options = {}) {
	  Writable.call(this, { objectMode: true, highWaterMark: options.highWaterMark });

	  this.format = options.format;
	  this.level = options.level;
	  this.handleExceptions = options.handleExceptions;
	  this.handleRejections = options.handleRejections;
	  this.silent = options.silent;

	  if (options.log) this.log = options.log;
	  if (options.logv) this.logv = options.logv;
	  if (options.close) this.close = options.close;

	  // Get the levels from the source we are piped from.
	  this.once('pipe', logger => {
	    // Remark (indexzero): this bookkeeping can only support multiple
	    // Logger parents with the same `levels`. This comes into play in
	    // the `winston.Container` code in which `container.add` takes
	    // a fully realized set of options with pre-constructed TransportStreams.
	    this.levels = logger.levels;
	    this.parent = logger;
	  });

	  // If and/or when the transport is removed from this instance
	  this.once('unpipe', src => {
	    // Remark (indexzero): this bookkeeping can only support multiple
	    // Logger parents with the same `levels`. This comes into play in
	    // the `winston.Container` code in which `container.add` takes
	    // a fully realized set of options with pre-constructed TransportStreams.
	    if (src === this.parent) {
	      this.parent = null;
	      if (this.close) {
	        this.close();
	      }
	    }
	  });
	};

	/*
	 * Inherit from Writeable using Node.js built-ins
	 */
	util.inherits(TransportStream, Writable);

	/**
	 * Writes the info object to our transport instance.
	 * @param {mixed} info - TODO: add param description.
	 * @param {mixed} enc - TODO: add param description.
	 * @param {function} callback - TODO: add param description.
	 * @returns {undefined}
	 * @private
	 */
	TransportStream.prototype._write = function _write(info, enc, callback) {
	  if (this.silent || (info.exception === true && !this.handleExceptions)) {
	    return callback(null);
	  }

	  // Remark: This has to be handled in the base transport now because we
	  // cannot conditionally write to our pipe targets as stream. We always
	  // prefer any explicit level set on the Transport itself falling back to
	  // any level set on the parent.
	  const level = this.level || (this.parent && this.parent.level);

	  if (!level || this.levels[level] >= this.levels[info[LEVEL]]) {
	    if (info && !this.format) {
	      return this.log(info, callback);
	    }

	    let errState;
	    let transformed;

	    // We trap(and re-throw) any errors generated by the user-provided format, but also
	    // guarantee that the streams callback is invoked so that we can continue flowing.
	    try {
	      transformed = this.format.transform(Object.assign({}, info), this.format.options);
	    } catch (err) {
	      errState = err;
	    }

	    if (errState || !transformed) {
	      // eslint-disable-next-line callback-return
	      callback();
	      if (errState) throw errState;
	      return;
	    }

	    return this.log(transformed, callback);
	  }
	  this._writableState.sync = false;
	  return callback(null);
	};

	/**
	 * Writes the batch of info objects (i.e. "object chunks") to our transport
	 * instance after performing any necessary filtering.
	 * @param {mixed} chunks - TODO: add params description.
	 * @param {function} callback - TODO: add params description.
	 * @returns {mixed} - TODO: add returns description.
	 * @private
	 */
	TransportStream.prototype._writev = function _writev(chunks, callback) {
	  if (this.logv) {
	    const infos = chunks.filter(this._accept, this);
	    if (!infos.length) {
	      return callback(null);
	    }

	    // Remark (indexzero): from a performance perspective if Transport
	    // implementers do choose to implement logv should we make it their
	    // responsibility to invoke their format?
	    return this.logv(infos, callback);
	  }

	  for (let i = 0; i < chunks.length; i++) {
	    if (!this._accept(chunks[i])) continue;

	    if (chunks[i].chunk && !this.format) {
	      this.log(chunks[i].chunk, chunks[i].callback);
	      continue;
	    }

	    let errState;
	    let transformed;

	    // We trap(and re-throw) any errors generated by the user-provided format, but also
	    // guarantee that the streams callback is invoked so that we can continue flowing.
	    try {
	      transformed = this.format.transform(
	        Object.assign({}, chunks[i].chunk),
	        this.format.options
	      );
	    } catch (err) {
	      errState = err;
	    }

	    if (errState || !transformed) {
	      // eslint-disable-next-line callback-return
	      chunks[i].callback();
	      if (errState) {
	        // eslint-disable-next-line callback-return
	        callback(null);
	        throw errState;
	      }
	    } else {
	      this.log(transformed, chunks[i].callback);
	    }
	  }

	  return callback(null);
	};

	/**
	 * Predicate function that returns true if the specfied `info` on the
	 * WriteReq, `write`, should be passed down into the derived
	 * TransportStream's I/O via `.log(info, callback)`.
	 * @param {WriteReq} write - winston@3 Node.js WriteReq for the `info` object
	 * representing the log message.
	 * @returns {Boolean} - Value indicating if the `write` should be accepted &
	 * logged.
	 */
	TransportStream.prototype._accept = function _accept(write) {
	  const info = write.chunk;
	  if (this.silent) {
	    return false;
	  }

	  // We always prefer any explicit level set on the Transport itself
	  // falling back to any level set on the parent.
	  const level = this.level || (this.parent && this.parent.level);

	  // Immediately check the average case: log level filtering.
	  if (
	    info.exception === true ||
	    !level ||
	    this.levels[level] >= this.levels[info[LEVEL]]
	  ) {
	    // Ensure the info object is valid based on `{ exception }`:
	    // 1. { handleExceptions: true }: all `info` objects are valid
	    // 2. { exception: false }: accepted by all transports.
	    if (this.handleExceptions || info.exception !== true) {
	      return true;
	    }
	  }

	  return false;
	};

	/**
	 * _nop is short for "No operation"
	 * @returns {Boolean} Intentionally false.
	 */
	TransportStream.prototype._nop = function _nop() {
	  // eslint-disable-next-line no-undefined
	  return void undefined;
	};


	// Expose legacy stream
	winstonTransportExports.LegacyTransportStream = requireLegacy();
	return winstonTransportExports;
}

/* eslint-disable no-console */

var console_1$1;
var hasRequiredConsole$1;

function requireConsole$1 () {
	if (hasRequiredConsole$1) return console_1$1;
	hasRequiredConsole$1 = 1;

	const os = require$$0__default["default"];
	const { LEVEL, MESSAGE } = tripleBeam;
	const TransportStream = requireWinstonTransport();

	/**
	 * Transport for outputting to the console.
	 * @type {Console}
	 * @extends {TransportStream}
	 */
	console_1$1 = class Console extends TransportStream {
	  /**
	   * Constructor function for the Console transport object responsible for
	   * persisting log messages and metadata to a terminal or TTY.
	   * @param {!Object} [options={}] - Options for this instance.
	   */
	  constructor(options = {}) {
	    super(options);

	    // Expose the name of this Transport on the prototype
	    this.name = options.name || 'console';
	    this.stderrLevels = this._stringArrayToSet(options.stderrLevels);
	    this.consoleWarnLevels = this._stringArrayToSet(options.consoleWarnLevels);
	    this.eol = (typeof options.eol === 'string') ? options.eol : os.EOL;

	    this.setMaxListeners(30);
	  }

	  /**
	   * Core logging method exposed to Winston.
	   * @param {Object} info - TODO: add param description.
	   * @param {Function} callback - TODO: add param description.
	   * @returns {undefined}
	   */
	  log(info, callback) {
	    setImmediate(() => this.emit('logged', info));

	    // Remark: what if there is no raw...?
	    if (this.stderrLevels[info[LEVEL]]) {
	      if (console._stderr) {
	        // Node.js maps `process.stderr` to `console._stderr`.
	        console._stderr.write(`${info[MESSAGE]}${this.eol}`);
	      } else {
	        // console.error adds a newline
	        console.error(info[MESSAGE]);
	      }

	      if (callback) {
	        callback(); // eslint-disable-line callback-return
	      }
	      return;
	    } else if (this.consoleWarnLevels[info[LEVEL]]) {
	      if (console._stderr) {
	        // Node.js maps `process.stderr` to `console._stderr`.
	        // in Node.js console.warn is an alias for console.error
	        console._stderr.write(`${info[MESSAGE]}${this.eol}`);
	      } else {
	        // console.warn adds a newline
	        console.warn(info[MESSAGE]);
	      }

	      if (callback) {
	        callback(); // eslint-disable-line callback-return
	      }
	      return;
	    }

	    if (console._stdout) {
	      // Node.js maps `process.stdout` to `console._stdout`.
	      console._stdout.write(`${info[MESSAGE]}${this.eol}`);
	    } else {
	      // console.log adds a newline.
	      console.log(info[MESSAGE]);
	    }

	    if (callback) {
	      callback(); // eslint-disable-line callback-return
	    }
	  }

	  /**
	   * Returns a Set-like object with strArray's elements as keys (each with the
	   * value true).
	   * @param {Array} strArray - Array of Set-elements as strings.
	   * @param {?string} [errMsg] - Custom error message thrown on invalid input.
	   * @returns {Object} - TODO: add return description.
	   * @private
	   */
	  _stringArrayToSet(strArray, errMsg) {
	    if (!strArray)
	      return {};

	    errMsg = errMsg || 'Cannot make set from type other than Array of string elements';

	    if (!Array.isArray(strArray)) {
	      throw new Error(errMsg);
	    }

	    return strArray.reduce((set, el) =>  {
	      if (typeof el !== 'string') {
	        throw new Error(errMsg);
	      }
	      set[el] = true;

	      return set;
	    }, {});
	  }
	};
	return console_1$1;
}

var seriesExports = {};
var series = {
  get exports(){ return seriesExports; },
  set exports(v){ seriesExports = v; },
};

var parallelExports = {};
var parallel = {
  get exports(){ return parallelExports; },
  set exports(v){ parallelExports = v; },
};

var isArrayLikeExports = {};
var isArrayLike = {
  get exports(){ return isArrayLikeExports; },
  set exports(v){ isArrayLikeExports = v; },
};

(function (module, exports) {

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});
	exports.default = isArrayLike;
	function isArrayLike(value) {
	    return value && typeof value.length === 'number' && value.length >= 0 && value.length % 1 === 0;
	}
	module.exports = exports['default'];
} (isArrayLike, isArrayLikeExports));

var wrapAsync = {};

var asyncifyExports = {};
var asyncify = {
  get exports(){ return asyncifyExports; },
  set exports(v){ asyncifyExports = v; },
};

var initialParamsExports = {};
var initialParams = {
  get exports(){ return initialParamsExports; },
  set exports(v){ initialParamsExports = v; },
};

(function (module, exports) {

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});

	exports.default = function (fn) {
	    return function (...args /*, callback*/) {
	        var callback = args.pop();
	        return fn.call(this, args, callback);
	    };
	};

	module.exports = exports["default"];
} (initialParams, initialParamsExports));

var setImmediate$1 = {};

Object.defineProperty(setImmediate$1, "__esModule", {
    value: true
});
setImmediate$1.fallback = fallback;
setImmediate$1.wrap = wrap;
/* istanbul ignore file */

var hasQueueMicrotask = setImmediate$1.hasQueueMicrotask = typeof queueMicrotask === 'function' && queueMicrotask;
var hasSetImmediate = setImmediate$1.hasSetImmediate = typeof setImmediate === 'function' && setImmediate;
var hasNextTick = setImmediate$1.hasNextTick = typeof process === 'object' && typeof process.nextTick === 'function';

function fallback(fn) {
    setTimeout(fn, 0);
}

function wrap(defer) {
    return (fn, ...args) => defer(() => fn(...args));
}

var _defer;

if (hasQueueMicrotask) {
    _defer = queueMicrotask;
} else if (hasSetImmediate) {
    _defer = setImmediate;
} else if (hasNextTick) {
    _defer = process.nextTick;
} else {
    _defer = fallback;
}

setImmediate$1.default = wrap(_defer);

var hasRequiredAsyncify;

function requireAsyncify () {
	if (hasRequiredAsyncify) return asyncifyExports;
	hasRequiredAsyncify = 1;
	(function (module, exports) {

		Object.defineProperty(exports, "__esModule", {
		    value: true
		});
		exports.default = asyncify;

		var _initialParams = initialParamsExports;

		var _initialParams2 = _interopRequireDefault(_initialParams);

		var _setImmediate = setImmediate$1;

		var _setImmediate2 = _interopRequireDefault(_setImmediate);

		var _wrapAsync = requireWrapAsync();

		function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

		/**
		 * Take a sync function and make it async, passing its return value to a
		 * callback. This is useful for plugging sync functions into a waterfall,
		 * series, or other async functions. Any arguments passed to the generated
		 * function will be passed to the wrapped function (except for the final
		 * callback argument). Errors thrown will be passed to the callback.
		 *
		 * If the function passed to `asyncify` returns a Promise, that promises's
		 * resolved/rejected state will be used to call the callback, rather than simply
		 * the synchronous return value.
		 *
		 * This also means you can asyncify ES2017 `async` functions.
		 *
		 * @name asyncify
		 * @static
		 * @memberOf module:Utils
		 * @method
		 * @alias wrapSync
		 * @category Util
		 * @param {Function} func - The synchronous function, or Promise-returning
		 * function to convert to an {@link AsyncFunction}.
		 * @returns {AsyncFunction} An asynchronous wrapper of the `func`. To be
		 * invoked with `(args..., callback)`.
		 * @example
		 *
		 * // passing a regular synchronous function
		 * async.waterfall([
		 *     async.apply(fs.readFile, filename, "utf8"),
		 *     async.asyncify(JSON.parse),
		 *     function (data, next) {
		 *         // data is the result of parsing the text.
		 *         // If there was a parsing error, it would have been caught.
		 *     }
		 * ], callback);
		 *
		 * // passing a function returning a promise
		 * async.waterfall([
		 *     async.apply(fs.readFile, filename, "utf8"),
		 *     async.asyncify(function (contents) {
		 *         return db.model.create(contents);
		 *     }),
		 *     function (model, next) {
		 *         // `model` is the instantiated model object.
		 *         // If there was an error, this function would be skipped.
		 *     }
		 * ], callback);
		 *
		 * // es2017 example, though `asyncify` is not needed if your JS environment
		 * // supports async functions out of the box
		 * var q = async.queue(async.asyncify(async function(file) {
		 *     var intermediateStep = await processFile(file);
		 *     return await somePromise(intermediateStep)
		 * }));
		 *
		 * q.push(files);
		 */
		function asyncify(func) {
		    if ((0, _wrapAsync.isAsync)(func)) {
		        return function (...args /*, callback*/) {
		            const callback = args.pop();
		            const promise = func.apply(this, args);
		            return handlePromise(promise, callback);
		        };
		    }

		    return (0, _initialParams2.default)(function (args, callback) {
		        var result;
		        try {
		            result = func.apply(this, args);
		        } catch (e) {
		            return callback(e);
		        }
		        // if result is Promise object
		        if (result && typeof result.then === 'function') {
		            return handlePromise(result, callback);
		        } else {
		            callback(null, result);
		        }
		    });
		}

		function handlePromise(promise, callback) {
		    return promise.then(value => {
		        invokeCallback(callback, null, value);
		    }, err => {
		        invokeCallback(callback, err && err.message ? err : new Error(err));
		    });
		}

		function invokeCallback(callback, error, value) {
		    try {
		        callback(error, value);
		    } catch (err) {
		        (0, _setImmediate2.default)(e => {
		            throw e;
		        }, err);
		    }
		}
		module.exports = exports['default'];
} (asyncify, asyncifyExports));
	return asyncifyExports;
}

var hasRequiredWrapAsync;

function requireWrapAsync () {
	if (hasRequiredWrapAsync) return wrapAsync;
	hasRequiredWrapAsync = 1;

	Object.defineProperty(wrapAsync, "__esModule", {
	    value: true
	});
	wrapAsync.isAsyncIterable = wrapAsync.isAsyncGenerator = wrapAsync.isAsync = undefined;

	var _asyncify = requireAsyncify();

	var _asyncify2 = _interopRequireDefault(_asyncify);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	function isAsync(fn) {
	    return fn[Symbol.toStringTag] === 'AsyncFunction';
	}

	function isAsyncGenerator(fn) {
	    return fn[Symbol.toStringTag] === 'AsyncGenerator';
	}

	function isAsyncIterable(obj) {
	    return typeof obj[Symbol.asyncIterator] === 'function';
	}

	function wrapAsync$1(asyncFn) {
	    if (typeof asyncFn !== 'function') throw new Error('expected a function');
	    return isAsync(asyncFn) ? (0, _asyncify2.default)(asyncFn) : asyncFn;
	}

	wrapAsync.default = wrapAsync$1;
	wrapAsync.isAsync = isAsync;
	wrapAsync.isAsyncGenerator = isAsyncGenerator;
	wrapAsync.isAsyncIterable = isAsyncIterable;
	return wrapAsync;
}

var awaitifyExports = {};
var awaitify = {
  get exports(){ return awaitifyExports; },
  set exports(v){ awaitifyExports = v; },
};

(function (module, exports) {

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});
	exports.default = awaitify;
	// conditionally promisify a function.
	// only return a promise if a callback is omitted
	function awaitify(asyncFn, arity = asyncFn.length) {
	    if (!arity) throw new Error('arity is undefined');
	    function awaitable(...args) {
	        if (typeof args[arity - 1] === 'function') {
	            return asyncFn.apply(this, args);
	        }

	        return new Promise((resolve, reject) => {
	            args[arity - 1] = (err, ...cbArgs) => {
	                if (err) return reject(err);
	                resolve(cbArgs.length > 1 ? cbArgs : cbArgs[0]);
	            };
	            asyncFn.apply(this, args);
	        });
	    }

	    return awaitable;
	}
	module.exports = exports['default'];
} (awaitify, awaitifyExports));

var hasRequiredParallel;

function requireParallel () {
	if (hasRequiredParallel) return parallelExports;
	hasRequiredParallel = 1;
	(function (module, exports) {

		Object.defineProperty(exports, "__esModule", {
		    value: true
		});

		var _isArrayLike = isArrayLikeExports;

		var _isArrayLike2 = _interopRequireDefault(_isArrayLike);

		var _wrapAsync = requireWrapAsync();

		var _wrapAsync2 = _interopRequireDefault(_wrapAsync);

		var _awaitify = awaitifyExports;

		var _awaitify2 = _interopRequireDefault(_awaitify);

		function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

		exports.default = (0, _awaitify2.default)((eachfn, tasks, callback) => {
		    var results = (0, _isArrayLike2.default)(tasks) ? [] : {};

		    eachfn(tasks, (task, key, taskCb) => {
		        (0, _wrapAsync2.default)(task)((err, ...result) => {
		            if (result.length < 2) {
		                [result] = result;
		            }
		            results[key] = result;
		            taskCb(err);
		        });
		    }, err => callback(err, results));
		}, 3);
		module.exports = exports['default'];
} (parallel, parallelExports));
	return parallelExports;
}

var eachOfSeriesExports = {};
var eachOfSeries = {
  get exports(){ return eachOfSeriesExports; },
  set exports(v){ eachOfSeriesExports = v; },
};

var eachOfLimitExports$1 = {};
var eachOfLimit$1 = {
  get exports(){ return eachOfLimitExports$1; },
  set exports(v){ eachOfLimitExports$1 = v; },
};

var eachOfLimitExports = {};
var eachOfLimit = {
  get exports(){ return eachOfLimitExports; },
  set exports(v){ eachOfLimitExports = v; },
};

var onceExports = {};
var once$2 = {
  get exports(){ return onceExports; },
  set exports(v){ onceExports = v; },
};

(function (module, exports) {

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});
	exports.default = once;
	function once(fn) {
	    function wrapper(...args) {
	        if (fn === null) return;
	        var callFn = fn;
	        fn = null;
	        callFn.apply(this, args);
	    }
	    Object.assign(wrapper, fn);
	    return wrapper;
	}
	module.exports = exports["default"];
} (once$2, onceExports));

var iteratorExports = {};
var iterator = {
  get exports(){ return iteratorExports; },
  set exports(v){ iteratorExports = v; },
};

var getIteratorExports = {};
var getIterator = {
  get exports(){ return getIteratorExports; },
  set exports(v){ getIteratorExports = v; },
};

(function (module, exports) {

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});

	exports.default = function (coll) {
	    return coll[Symbol.iterator] && coll[Symbol.iterator]();
	};

	module.exports = exports["default"];
} (getIterator, getIteratorExports));

(function (module, exports) {

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});
	exports.default = createIterator;

	var _isArrayLike = isArrayLikeExports;

	var _isArrayLike2 = _interopRequireDefault(_isArrayLike);

	var _getIterator = getIteratorExports;

	var _getIterator2 = _interopRequireDefault(_getIterator);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	function createArrayIterator(coll) {
	    var i = -1;
	    var len = coll.length;
	    return function next() {
	        return ++i < len ? { value: coll[i], key: i } : null;
	    };
	}

	function createES2015Iterator(iterator) {
	    var i = -1;
	    return function next() {
	        var item = iterator.next();
	        if (item.done) return null;
	        i++;
	        return { value: item.value, key: i };
	    };
	}

	function createObjectIterator(obj) {
	    var okeys = obj ? Object.keys(obj) : [];
	    var i = -1;
	    var len = okeys.length;
	    return function next() {
	        var key = okeys[++i];
	        if (key === '__proto__') {
	            return next();
	        }
	        return i < len ? { value: obj[key], key } : null;
	    };
	}

	function createIterator(coll) {
	    if ((0, _isArrayLike2.default)(coll)) {
	        return createArrayIterator(coll);
	    }

	    var iterator = (0, _getIterator2.default)(coll);
	    return iterator ? createES2015Iterator(iterator) : createObjectIterator(coll);
	}
	module.exports = exports['default'];
} (iterator, iteratorExports));

var onlyOnceExports = {};
var onlyOnce = {
  get exports(){ return onlyOnceExports; },
  set exports(v){ onlyOnceExports = v; },
};

(function (module, exports) {

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});
	exports.default = onlyOnce;
	function onlyOnce(fn) {
	    return function (...args) {
	        if (fn === null) throw new Error("Callback was already called.");
	        var callFn = fn;
	        fn = null;
	        callFn.apply(this, args);
	    };
	}
	module.exports = exports["default"];
} (onlyOnce, onlyOnceExports));

var asyncEachOfLimitExports = {};
var asyncEachOfLimit = {
  get exports(){ return asyncEachOfLimitExports; },
  set exports(v){ asyncEachOfLimitExports = v; },
};

var breakLoopExports = {};
var breakLoop = {
  get exports(){ return breakLoopExports; },
  set exports(v){ breakLoopExports = v; },
};

(function (module, exports) {

	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	// A temporary value used to identify if the loop should be broken.
	// See #1064, #1293
	const breakLoop = {};
	exports.default = breakLoop;
	module.exports = exports["default"];
} (breakLoop, breakLoopExports));

(function (module, exports) {

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});
	exports.default = asyncEachOfLimit;

	var _breakLoop = breakLoopExports;

	var _breakLoop2 = _interopRequireDefault(_breakLoop);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	// for async generators
	function asyncEachOfLimit(generator, limit, iteratee, callback) {
	    let done = false;
	    let canceled = false;
	    let awaiting = false;
	    let running = 0;
	    let idx = 0;

	    function replenish() {
	        //console.log('replenish')
	        if (running >= limit || awaiting || done) return;
	        //console.log('replenish awaiting')
	        awaiting = true;
	        generator.next().then(({ value, done: iterDone }) => {
	            //console.log('got value', value)
	            if (canceled || done) return;
	            awaiting = false;
	            if (iterDone) {
	                done = true;
	                if (running <= 0) {
	                    //console.log('done nextCb')
	                    callback(null);
	                }
	                return;
	            }
	            running++;
	            iteratee(value, idx, iterateeCallback);
	            idx++;
	            replenish();
	        }).catch(handleError);
	    }

	    function iterateeCallback(err, result) {
	        //console.log('iterateeCallback')
	        running -= 1;
	        if (canceled) return;
	        if (err) return handleError(err);

	        if (err === false) {
	            done = true;
	            canceled = true;
	            return;
	        }

	        if (result === _breakLoop2.default || done && running <= 0) {
	            done = true;
	            //console.log('done iterCb')
	            return callback(null);
	        }
	        replenish();
	    }

	    function handleError(err) {
	        if (canceled) return;
	        awaiting = false;
	        done = true;
	        callback(err);
	    }

	    replenish();
	}
	module.exports = exports['default'];
} (asyncEachOfLimit, asyncEachOfLimitExports));

(function (module, exports) {

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});

	var _once = onceExports;

	var _once2 = _interopRequireDefault(_once);

	var _iterator = iteratorExports;

	var _iterator2 = _interopRequireDefault(_iterator);

	var _onlyOnce = onlyOnceExports;

	var _onlyOnce2 = _interopRequireDefault(_onlyOnce);

	var _wrapAsync = requireWrapAsync();

	var _asyncEachOfLimit = asyncEachOfLimitExports;

	var _asyncEachOfLimit2 = _interopRequireDefault(_asyncEachOfLimit);

	var _breakLoop = breakLoopExports;

	var _breakLoop2 = _interopRequireDefault(_breakLoop);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	exports.default = limit => {
	    return (obj, iteratee, callback) => {
	        callback = (0, _once2.default)(callback);
	        if (limit <= 0) {
	            throw new RangeError('concurrency limit cannot be less than 1');
	        }
	        if (!obj) {
	            return callback(null);
	        }
	        if ((0, _wrapAsync.isAsyncGenerator)(obj)) {
	            return (0, _asyncEachOfLimit2.default)(obj, limit, iteratee, callback);
	        }
	        if ((0, _wrapAsync.isAsyncIterable)(obj)) {
	            return (0, _asyncEachOfLimit2.default)(obj[Symbol.asyncIterator](), limit, iteratee, callback);
	        }
	        var nextElem = (0, _iterator2.default)(obj);
	        var done = false;
	        var canceled = false;
	        var running = 0;
	        var looping = false;

	        function iterateeCallback(err, value) {
	            if (canceled) return;
	            running -= 1;
	            if (err) {
	                done = true;
	                callback(err);
	            } else if (err === false) {
	                done = true;
	                canceled = true;
	            } else if (value === _breakLoop2.default || done && running <= 0) {
	                done = true;
	                return callback(null);
	            } else if (!looping) {
	                replenish();
	            }
	        }

	        function replenish() {
	            looping = true;
	            while (running < limit && !done) {
	                var elem = nextElem();
	                if (elem === null) {
	                    done = true;
	                    if (running <= 0) {
	                        callback(null);
	                    }
	                    return;
	                }
	                running += 1;
	                iteratee(elem.value, elem.key, (0, _onlyOnce2.default)(iterateeCallback));
	            }
	            looping = false;
	        }

	        replenish();
	    };
	};

	module.exports = exports['default'];
} (eachOfLimit, eachOfLimitExports));

(function (module, exports) {

	Object.defineProperty(exports, "__esModule", {
	  value: true
	});

	var _eachOfLimit2 = eachOfLimitExports;

	var _eachOfLimit3 = _interopRequireDefault(_eachOfLimit2);

	var _wrapAsync = requireWrapAsync();

	var _wrapAsync2 = _interopRequireDefault(_wrapAsync);

	var _awaitify = awaitifyExports;

	var _awaitify2 = _interopRequireDefault(_awaitify);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	/**
	 * The same as [`eachOf`]{@link module:Collections.eachOf} but runs a maximum of `limit` async operations at a
	 * time.
	 *
	 * @name eachOfLimit
	 * @static
	 * @memberOf module:Collections
	 * @method
	 * @see [async.eachOf]{@link module:Collections.eachOf}
	 * @alias forEachOfLimit
	 * @category Collection
	 * @param {Array|Iterable|AsyncIterable|Object} coll - A collection to iterate over.
	 * @param {number} limit - The maximum number of async operations at a time.
	 * @param {AsyncFunction} iteratee - An async function to apply to each
	 * item in `coll`. The `key` is the item's key, or index in the case of an
	 * array.
	 * Invoked with (item, key, callback).
	 * @param {Function} [callback] - A callback which is called when all
	 * `iteratee` functions have finished, or an error occurs. Invoked with (err).
	 * @returns {Promise} a promise, if a callback is omitted
	 */
	function eachOfLimit(coll, limit, iteratee, callback) {
	  return (0, _eachOfLimit3.default)(limit)(coll, (0, _wrapAsync2.default)(iteratee), callback);
	}

	exports.default = (0, _awaitify2.default)(eachOfLimit, 4);
	module.exports = exports['default'];
} (eachOfLimit$1, eachOfLimitExports$1));

var hasRequiredEachOfSeries;

function requireEachOfSeries () {
	if (hasRequiredEachOfSeries) return eachOfSeriesExports;
	hasRequiredEachOfSeries = 1;
	(function (module, exports) {

		Object.defineProperty(exports, "__esModule", {
		  value: true
		});

		var _eachOfLimit = eachOfLimitExports$1;

		var _eachOfLimit2 = _interopRequireDefault(_eachOfLimit);

		var _awaitify = awaitifyExports;

		var _awaitify2 = _interopRequireDefault(_awaitify);

		function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

		/**
		 * The same as [`eachOf`]{@link module:Collections.eachOf} but runs only a single async operation at a time.
		 *
		 * @name eachOfSeries
		 * @static
		 * @memberOf module:Collections
		 * @method
		 * @see [async.eachOf]{@link module:Collections.eachOf}
		 * @alias forEachOfSeries
		 * @category Collection
		 * @param {Array|Iterable|AsyncIterable|Object} coll - A collection to iterate over.
		 * @param {AsyncFunction} iteratee - An async function to apply to each item in
		 * `coll`.
		 * Invoked with (item, key, callback).
		 * @param {Function} [callback] - A callback which is called when all `iteratee`
		 * functions have finished, or an error occurs. Invoked with (err).
		 * @returns {Promise} a promise, if a callback is omitted
		 */
		function eachOfSeries(coll, iteratee, callback) {
		  return (0, _eachOfLimit2.default)(coll, 1, iteratee, callback);
		}
		exports.default = (0, _awaitify2.default)(eachOfSeries, 3);
		module.exports = exports['default'];
} (eachOfSeries, eachOfSeriesExports));
	return eachOfSeriesExports;
}

var hasRequiredSeries;

function requireSeries () {
	if (hasRequiredSeries) return seriesExports;
	hasRequiredSeries = 1;
	(function (module, exports) {

		Object.defineProperty(exports, "__esModule", {
		  value: true
		});
		exports.default = series;

		var _parallel2 = requireParallel();

		var _parallel3 = _interopRequireDefault(_parallel2);

		var _eachOfSeries = requireEachOfSeries();

		var _eachOfSeries2 = _interopRequireDefault(_eachOfSeries);

		function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

		/**
		 * Run the functions in the `tasks` collection in series, each one running once
		 * the previous function has completed. If any functions in the series pass an
		 * error to its callback, no more functions are run, and `callback` is
		 * immediately called with the value of the error. Otherwise, `callback`
		 * receives an array of results when `tasks` have completed.
		 *
		 * It is also possible to use an object instead of an array. Each property will
		 * be run as a function, and the results will be passed to the final `callback`
		 * as an object instead of an array. This can be a more readable way of handling
		 *  results from {@link async.series}.
		 *
		 * **Note** that while many implementations preserve the order of object
		 * properties, the [ECMAScript Language Specification](http://www.ecma-international.org/ecma-262/5.1/#sec-8.6)
		 * explicitly states that
		 *
		 * > The mechanics and order of enumerating the properties is not specified.
		 *
		 * So if you rely on the order in which your series of functions are executed,
		 * and want this to work on all platforms, consider using an array.
		 *
		 * @name series
		 * @static
		 * @memberOf module:ControlFlow
		 * @method
		 * @category Control Flow
		 * @param {Array|Iterable|AsyncIterable|Object} tasks - A collection containing
		 * [async functions]{@link AsyncFunction} to run in series.
		 * Each function can complete with any number of optional `result` values.
		 * @param {Function} [callback] - An optional callback to run once all the
		 * functions have completed. This function gets a results array (or object)
		 * containing all the result arguments passed to the `task` callbacks. Invoked
		 * with (err, result).
		 * @return {Promise} a promise, if no callback is passed
		 * @example
		 *
		 * //Using Callbacks
		 * async.series([
		 *     function(callback) {
		 *         setTimeout(function() {
		 *             // do some async task
		 *             callback(null, 'one');
		 *         }, 200);
		 *     },
		 *     function(callback) {
		 *         setTimeout(function() {
		 *             // then do another async task
		 *             callback(null, 'two');
		 *         }, 100);
		 *     }
		 * ], function(err, results) {
		 *     console.log(results);
		 *     // results is equal to ['one','two']
		 * });
		 *
		 * // an example using objects instead of arrays
		 * async.series({
		 *     one: function(callback) {
		 *         setTimeout(function() {
		 *             // do some async task
		 *             callback(null, 1);
		 *         }, 200);
		 *     },
		 *     two: function(callback) {
		 *         setTimeout(function() {
		 *             // then do another async task
		 *             callback(null, 2);
		 *         }, 100);
		 *     }
		 * }, function(err, results) {
		 *     console.log(results);
		 *     // results is equal to: { one: 1, two: 2 }
		 * });
		 *
		 * //Using Promises
		 * async.series([
		 *     function(callback) {
		 *         setTimeout(function() {
		 *             callback(null, 'one');
		 *         }, 200);
		 *     },
		 *     function(callback) {
		 *         setTimeout(function() {
		 *             callback(null, 'two');
		 *         }, 100);
		 *     }
		 * ]).then(results => {
		 *     console.log(results);
		 *     // results is equal to ['one','two']
		 * }).catch(err => {
		 *     console.log(err);
		 * });
		 *
		 * // an example using an object instead of an array
		 * async.series({
		 *     one: function(callback) {
		 *         setTimeout(function() {
		 *             // do some async task
		 *             callback(null, 1);
		 *         }, 200);
		 *     },
		 *     two: function(callback) {
		 *         setTimeout(function() {
		 *             // then do another async task
		 *             callback(null, 2);
		 *         }, 100);
		 *     }
		 * }).then(results => {
		 *     console.log(results);
		 *     // results is equal to: { one: 1, two: 2 }
		 * }).catch(err => {
		 *     console.log(err);
		 * });
		 *
		 * //Using async/await
		 * async () => {
		 *     try {
		 *         let results = await async.series([
		 *             function(callback) {
		 *                 setTimeout(function() {
		 *                     // do some async task
		 *                     callback(null, 'one');
		 *                 }, 200);
		 *             },
		 *             function(callback) {
		 *                 setTimeout(function() {
		 *                     // then do another async task
		 *                     callback(null, 'two');
		 *                 }, 100);
		 *             }
		 *         ]);
		 *         console.log(results);
		 *         // results is equal to ['one','two']
		 *     }
		 *     catch (err) {
		 *         console.log(err);
		 *     }
		 * }
		 *
		 * // an example using an object instead of an array
		 * async () => {
		 *     try {
		 *         let results = await async.parallel({
		 *             one: function(callback) {
		 *                 setTimeout(function() {
		 *                     // do some async task
		 *                     callback(null, 1);
		 *                 }, 200);
		 *             },
		 *            two: function(callback) {
		 *                 setTimeout(function() {
		 *                     // then do another async task
		 *                     callback(null, 2);
		 *                 }, 100);
		 *            }
		 *         });
		 *         console.log(results);
		 *         // results is equal to: { one: 1, two: 2 }
		 *     }
		 *     catch (err) {
		 *         console.log(err);
		 *     }
		 * }
		 *
		 */
		function series(tasks, callback) {
		  return (0, _parallel3.default)(_eachOfSeries2.default, tasks, callback);
		}
		module.exports = exports['default'];
} (series, seriesExports));
	return seriesExports;
}

var readableExports = {};
var readable = {
  get exports(){ return readableExports; },
  set exports(v){ readableExports = v; },
};

var _stream_transform;
var hasRequired_stream_transform;

function require_stream_transform () {
	if (hasRequired_stream_transform) return _stream_transform;
	hasRequired_stream_transform = 1;

	_stream_transform = Transform;

	var _require$codes = requireErrors().codes,
	    ERR_METHOD_NOT_IMPLEMENTED = _require$codes.ERR_METHOD_NOT_IMPLEMENTED,
	    ERR_MULTIPLE_CALLBACK = _require$codes.ERR_MULTIPLE_CALLBACK,
	    ERR_TRANSFORM_ALREADY_TRANSFORMING = _require$codes.ERR_TRANSFORM_ALREADY_TRANSFORMING,
	    ERR_TRANSFORM_WITH_LENGTH_0 = _require$codes.ERR_TRANSFORM_WITH_LENGTH_0;

	var Duplex = require_stream_duplex();

	requireInherits()(Transform, Duplex);

	function afterTransform(er, data) {
	  var ts = this._transformState;
	  ts.transforming = false;
	  var cb = ts.writecb;

	  if (cb === null) {
	    return this.emit('error', new ERR_MULTIPLE_CALLBACK());
	  }

	  ts.writechunk = null;
	  ts.writecb = null;
	  if (data != null) // single equals check for both `null` and `undefined`
	    this.push(data);
	  cb(er);
	  var rs = this._readableState;
	  rs.reading = false;

	  if (rs.needReadable || rs.length < rs.highWaterMark) {
	    this._read(rs.highWaterMark);
	  }
	}

	function Transform(options) {
	  if (!(this instanceof Transform)) return new Transform(options);
	  Duplex.call(this, options);
	  this._transformState = {
	    afterTransform: afterTransform.bind(this),
	    needTransform: false,
	    transforming: false,
	    writecb: null,
	    writechunk: null,
	    writeencoding: null
	  }; // start out asking for a readable event once data is transformed.

	  this._readableState.needReadable = true; // we have implemented the _read method, and done the other things
	  // that Readable wants before the first _read call, so unset the
	  // sync guard flag.

	  this._readableState.sync = false;

	  if (options) {
	    if (typeof options.transform === 'function') this._transform = options.transform;
	    if (typeof options.flush === 'function') this._flush = options.flush;
	  } // When the writable side finishes, then flush out anything remaining.


	  this.on('prefinish', prefinish);
	}

	function prefinish() {
	  var _this = this;

	  if (typeof this._flush === 'function' && !this._readableState.destroyed) {
	    this._flush(function (er, data) {
	      done(_this, er, data);
	    });
	  } else {
	    done(this, null, null);
	  }
	}

	Transform.prototype.push = function (chunk, encoding) {
	  this._transformState.needTransform = false;
	  return Duplex.prototype.push.call(this, chunk, encoding);
	}; // This is the part where you do stuff!
	// override this function in implementation classes.
	// 'chunk' is an input chunk.
	//
	// Call `push(newChunk)` to pass along transformed output
	// to the readable side.  You may call 'push' zero or more times.
	//
	// Call `cb(err)` when you are done with this chunk.  If you pass
	// an error, then that'll put the hurt on the whole operation.  If you
	// never call cb(), then you'll never get another chunk.


	Transform.prototype._transform = function (chunk, encoding, cb) {
	  cb(new ERR_METHOD_NOT_IMPLEMENTED('_transform()'));
	};

	Transform.prototype._write = function (chunk, encoding, cb) {
	  var ts = this._transformState;
	  ts.writecb = cb;
	  ts.writechunk = chunk;
	  ts.writeencoding = encoding;

	  if (!ts.transforming) {
	    var rs = this._readableState;
	    if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark) this._read(rs.highWaterMark);
	  }
	}; // Doesn't matter what the args are here.
	// _transform does all the work.
	// That we got here means that the readable side wants more data.


	Transform.prototype._read = function (n) {
	  var ts = this._transformState;

	  if (ts.writechunk !== null && !ts.transforming) {
	    ts.transforming = true;

	    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
	  } else {
	    // mark that we need a transform, so that any data that comes in
	    // will get processed, now that we've asked for it.
	    ts.needTransform = true;
	  }
	};

	Transform.prototype._destroy = function (err, cb) {
	  Duplex.prototype._destroy.call(this, err, function (err2) {
	    cb(err2);
	  });
	};

	function done(stream, er, data) {
	  if (er) return stream.emit('error', er);
	  if (data != null) // single equals check for both `null` and `undefined`
	    stream.push(data); // TODO(BridgeAR): Write a test for these two error cases
	  // if there's nothing in the write buffer, then that means
	  // that nothing more will ever be provided

	  if (stream._writableState.length) throw new ERR_TRANSFORM_WITH_LENGTH_0();
	  if (stream._transformState.transforming) throw new ERR_TRANSFORM_ALREADY_TRANSFORMING();
	  return stream.push(null);
	}
	return _stream_transform;
}

var _stream_passthrough;
var hasRequired_stream_passthrough;

function require_stream_passthrough () {
	if (hasRequired_stream_passthrough) return _stream_passthrough;
	hasRequired_stream_passthrough = 1;

	_stream_passthrough = PassThrough;

	var Transform = require_stream_transform();

	requireInherits()(PassThrough, Transform);

	function PassThrough(options) {
	  if (!(this instanceof PassThrough)) return new PassThrough(options);
	  Transform.call(this, options);
	}

	PassThrough.prototype._transform = function (chunk, encoding, cb) {
	  cb(null, chunk);
	};
	return _stream_passthrough;
}

var pipeline_1;
var hasRequiredPipeline;

function requirePipeline () {
	if (hasRequiredPipeline) return pipeline_1;
	hasRequiredPipeline = 1;

	var eos;

	function once(callback) {
	  var called = false;
	  return function () {
	    if (called) return;
	    called = true;
	    callback.apply(void 0, arguments);
	  };
	}

	var _require$codes = requireErrors().codes,
	    ERR_MISSING_ARGS = _require$codes.ERR_MISSING_ARGS,
	    ERR_STREAM_DESTROYED = _require$codes.ERR_STREAM_DESTROYED;

	function noop(err) {
	  // Rethrow the error if it exists to avoid swallowing it
	  if (err) throw err;
	}

	function isRequest(stream) {
	  return stream.setHeader && typeof stream.abort === 'function';
	}

	function destroyer(stream, reading, writing, callback) {
	  callback = once(callback);
	  var closed = false;
	  stream.on('close', function () {
	    closed = true;
	  });
	  if (eos === undefined) eos = requireEndOfStream();
	  eos(stream, {
	    readable: reading,
	    writable: writing
	  }, function (err) {
	    if (err) return callback(err);
	    closed = true;
	    callback();
	  });
	  var destroyed = false;
	  return function (err) {
	    if (closed) return;
	    if (destroyed) return;
	    destroyed = true; // request.destroy just do .end - .abort is what we want

	    if (isRequest(stream)) return stream.abort();
	    if (typeof stream.destroy === 'function') return stream.destroy();
	    callback(err || new ERR_STREAM_DESTROYED('pipe'));
	  };
	}

	function call(fn) {
	  fn();
	}

	function pipe(from, to) {
	  return from.pipe(to);
	}

	function popCallback(streams) {
	  if (!streams.length) return noop;
	  if (typeof streams[streams.length - 1] !== 'function') return noop;
	  return streams.pop();
	}

	function pipeline() {
	  for (var _len = arguments.length, streams = new Array(_len), _key = 0; _key < _len; _key++) {
	    streams[_key] = arguments[_key];
	  }

	  var callback = popCallback(streams);
	  if (Array.isArray(streams[0])) streams = streams[0];

	  if (streams.length < 2) {
	    throw new ERR_MISSING_ARGS('streams');
	  }

	  var error;
	  var destroys = streams.map(function (stream, i) {
	    var reading = i < streams.length - 1;
	    var writing = i > 0;
	    return destroyer(stream, reading, writing, function (err) {
	      if (!error) error = err;
	      if (err) destroys.forEach(call);
	      if (reading) return;
	      destroys.forEach(call);
	      callback(error);
	    });
	  });
	  return streams.reduce(pipe);
	}

	pipeline_1 = pipeline;
	return pipeline_1;
}

(function (module, exports) {
	var Stream = require$$0__default$2["default"];
	if (process.env.READABLE_STREAM === 'disable' && Stream) {
	  module.exports = Stream.Readable;
	  Object.assign(module.exports, Stream);
	  module.exports.Stream = Stream;
	} else {
	  exports = module.exports = require_stream_readable();
	  exports.Stream = Stream || exports;
	  exports.Readable = exports;
	  exports.Writable = require_stream_writable();
	  exports.Duplex = require_stream_duplex();
	  exports.Transform = require_stream_transform();
	  exports.PassThrough = require_stream_passthrough();
	  exports.finished = requireEndOfStream();
	  exports.pipeline = requirePipeline();
	}
} (readable, readableExports));

var nodeExports = {};
var node = {
  get exports(){ return nodeExports; },
  set exports(v){ nodeExports = v; },
};

/**
 * Contains all configured adapters for the given environment.
 *
 * @type {Array}
 * @public
 */

var diagnostics;
var hasRequiredDiagnostics;

function requireDiagnostics () {
	if (hasRequiredDiagnostics) return diagnostics;
	hasRequiredDiagnostics = 1;
	var adapters = [];

	/**
	 * Contains all modifier functions.
	 *
	 * @typs {Array}
	 * @public
	 */
	var modifiers = [];

	/**
	 * Our default logger.
	 *
	 * @public
	 */
	var logger = function devnull() {};

	/**
	 * Register a new adapter that will used to find environments.
	 *
	 * @param {Function} adapter A function that will return the possible env.
	 * @returns {Boolean} Indication of a successful add.
	 * @public
	 */
	function use(adapter) {
	  if (~adapters.indexOf(adapter)) return false;

	  adapters.push(adapter);
	  return true;
	}

	/**
	 * Assign a new log method.
	 *
	 * @param {Function} custom The log method.
	 * @public
	 */
	function set(custom) {
	  logger = custom;
	}

	/**
	 * Check if the namespace is allowed by any of our adapters.
	 *
	 * @param {String} namespace The namespace that needs to be enabled
	 * @returns {Boolean|Promise} Indication if the namespace is enabled by our adapters.
	 * @public
	 */
	function enabled(namespace) {
	  var async = [];

	  for (var i = 0; i < adapters.length; i++) {
	    if (adapters[i].async) {
	      async.push(adapters[i]);
	      continue;
	    }

	    if (adapters[i](namespace)) return true;
	  }

	  if (!async.length) return false;

	  //
	  // Now that we know that we Async functions, we know we run in an ES6
	  // environment and can use all the API's that they offer, in this case
	  // we want to return a Promise so that we can `await` in React-Native
	  // for an async adapter.
	  //
	  return new Promise(function pinky(resolve) {
	    Promise.all(
	      async.map(function prebind(fn) {
	        return fn(namespace);
	      })
	    ).then(function resolved(values) {
	      resolve(values.some(Boolean));
	    });
	  });
	}

	/**
	 * Add a new message modifier to the debugger.
	 *
	 * @param {Function} fn Modification function.
	 * @returns {Boolean} Indication of a successful add.
	 * @public
	 */
	function modify(fn) {
	  if (~modifiers.indexOf(fn)) return false;

	  modifiers.push(fn);
	  return true;
	}

	/**
	 * Write data to the supplied logger.
	 *
	 * @param {Object} meta Meta information about the log.
	 * @param {Array} args Arguments for console.log.
	 * @public
	 */
	function write() {
	  logger.apply(logger, arguments);
	}

	/**
	 * Process the message with the modifiers.
	 *
	 * @param {Mixed} message The message to be transformed by modifers.
	 * @returns {String} Transformed message.
	 * @public
	 */
	function process(message) {
	  for (var i = 0; i < modifiers.length; i++) {
	    message = modifiers[i].apply(modifiers[i], arguments);
	  }

	  return message;
	}

	/**
	 * Introduce options to the logger function.
	 *
	 * @param {Function} fn Calback function.
	 * @param {Object} options Properties to introduce on fn.
	 * @returns {Function} The passed function
	 * @public
	 */
	function introduce(fn, options) {
	  var has = Object.prototype.hasOwnProperty;

	  for (var key in options) {
	    if (has.call(options, key)) {
	      fn[key] = options[key];
	    }
	  }

	  return fn;
	}

	/**
	 * Nope, we're not allowed to write messages.
	 *
	 * @returns {Boolean} false
	 * @public
	 */
	function nope(options) {
	  options.enabled = false;
	  options.modify = modify;
	  options.set = set;
	  options.use = use;

	  return introduce(function diagnopes() {
	    return false;
	  }, options);
	}

	/**
	 * Yep, we're allowed to write debug messages.
	 *
	 * @param {Object} options The options for the process.
	 * @returns {Function} The function that does the logging.
	 * @public
	 */
	function yep(options) {
	  /**
	   * The function that receives the actual debug information.
	   *
	   * @returns {Boolean} indication that we're logging.
	   * @public
	   */
	  function diagnostics() {
	    var args = Array.prototype.slice.call(arguments, 0);

	    write.call(write, options, process(args, options));
	    return true;
	  }

	  options.enabled = true;
	  options.modify = modify;
	  options.set = set;
	  options.use = use;

	  return introduce(diagnostics, options);
	}

	/**
	 * Simple helper function to introduce various of helper methods to our given
	 * diagnostics function.
	 *
	 * @param {Function} diagnostics The diagnostics function.
	 * @returns {Function} diagnostics
	 * @public
	 */
	diagnostics = function create(diagnostics) {
	  diagnostics.introduce = introduce;
	  diagnostics.enabled = enabled;
	  diagnostics.process = process;
	  diagnostics.modify = modify;
	  diagnostics.write = write;
	  diagnostics.nope = nope;
	  diagnostics.yep = yep;
	  diagnostics.set = set;
	  diagnostics.use = use;

	  return diagnostics;
	};
	return diagnostics;
}

var production;
var hasRequiredProduction;

function requireProduction () {
	if (hasRequiredProduction) return production;
	hasRequiredProduction = 1;
	var create = requireDiagnostics();

	/**
	 * Create a new diagnostics logger.
	 *
	 * @param {String} namespace The namespace it should enable.
	 * @param {Object} options Additional options.
	 * @returns {Function} The logger.
	 * @public
	 */
	var diagnostics = create(function prod(namespace, options) {
	  options = options || {};
	  options.namespace = namespace;
	  options.prod = true;
	  options.dev = false;

	  if (!(options.force || prod.force)) return prod.nope(options);
	  return prod.yep(options);
	});

	//
	// Expose the diagnostics logger.
	//
	production = diagnostics;
	return production;
}

var colorStringExports = {};
var colorString = {
  get exports(){ return colorStringExports; },
  set exports(v){ colorStringExports = v; },
};

var colorName$1;
var hasRequiredColorName$1;

function requireColorName$1 () {
	if (hasRequiredColorName$1) return colorName$1;
	hasRequiredColorName$1 = 1;

	colorName$1 = {
		"aliceblue": [240, 248, 255],
		"antiquewhite": [250, 235, 215],
		"aqua": [0, 255, 255],
		"aquamarine": [127, 255, 212],
		"azure": [240, 255, 255],
		"beige": [245, 245, 220],
		"bisque": [255, 228, 196],
		"black": [0, 0, 0],
		"blanchedalmond": [255, 235, 205],
		"blue": [0, 0, 255],
		"blueviolet": [138, 43, 226],
		"brown": [165, 42, 42],
		"burlywood": [222, 184, 135],
		"cadetblue": [95, 158, 160],
		"chartreuse": [127, 255, 0],
		"chocolate": [210, 105, 30],
		"coral": [255, 127, 80],
		"cornflowerblue": [100, 149, 237],
		"cornsilk": [255, 248, 220],
		"crimson": [220, 20, 60],
		"cyan": [0, 255, 255],
		"darkblue": [0, 0, 139],
		"darkcyan": [0, 139, 139],
		"darkgoldenrod": [184, 134, 11],
		"darkgray": [169, 169, 169],
		"darkgreen": [0, 100, 0],
		"darkgrey": [169, 169, 169],
		"darkkhaki": [189, 183, 107],
		"darkmagenta": [139, 0, 139],
		"darkolivegreen": [85, 107, 47],
		"darkorange": [255, 140, 0],
		"darkorchid": [153, 50, 204],
		"darkred": [139, 0, 0],
		"darksalmon": [233, 150, 122],
		"darkseagreen": [143, 188, 143],
		"darkslateblue": [72, 61, 139],
		"darkslategray": [47, 79, 79],
		"darkslategrey": [47, 79, 79],
		"darkturquoise": [0, 206, 209],
		"darkviolet": [148, 0, 211],
		"deeppink": [255, 20, 147],
		"deepskyblue": [0, 191, 255],
		"dimgray": [105, 105, 105],
		"dimgrey": [105, 105, 105],
		"dodgerblue": [30, 144, 255],
		"firebrick": [178, 34, 34],
		"floralwhite": [255, 250, 240],
		"forestgreen": [34, 139, 34],
		"fuchsia": [255, 0, 255],
		"gainsboro": [220, 220, 220],
		"ghostwhite": [248, 248, 255],
		"gold": [255, 215, 0],
		"goldenrod": [218, 165, 32],
		"gray": [128, 128, 128],
		"green": [0, 128, 0],
		"greenyellow": [173, 255, 47],
		"grey": [128, 128, 128],
		"honeydew": [240, 255, 240],
		"hotpink": [255, 105, 180],
		"indianred": [205, 92, 92],
		"indigo": [75, 0, 130],
		"ivory": [255, 255, 240],
		"khaki": [240, 230, 140],
		"lavender": [230, 230, 250],
		"lavenderblush": [255, 240, 245],
		"lawngreen": [124, 252, 0],
		"lemonchiffon": [255, 250, 205],
		"lightblue": [173, 216, 230],
		"lightcoral": [240, 128, 128],
		"lightcyan": [224, 255, 255],
		"lightgoldenrodyellow": [250, 250, 210],
		"lightgray": [211, 211, 211],
		"lightgreen": [144, 238, 144],
		"lightgrey": [211, 211, 211],
		"lightpink": [255, 182, 193],
		"lightsalmon": [255, 160, 122],
		"lightseagreen": [32, 178, 170],
		"lightskyblue": [135, 206, 250],
		"lightslategray": [119, 136, 153],
		"lightslategrey": [119, 136, 153],
		"lightsteelblue": [176, 196, 222],
		"lightyellow": [255, 255, 224],
		"lime": [0, 255, 0],
		"limegreen": [50, 205, 50],
		"linen": [250, 240, 230],
		"magenta": [255, 0, 255],
		"maroon": [128, 0, 0],
		"mediumaquamarine": [102, 205, 170],
		"mediumblue": [0, 0, 205],
		"mediumorchid": [186, 85, 211],
		"mediumpurple": [147, 112, 219],
		"mediumseagreen": [60, 179, 113],
		"mediumslateblue": [123, 104, 238],
		"mediumspringgreen": [0, 250, 154],
		"mediumturquoise": [72, 209, 204],
		"mediumvioletred": [199, 21, 133],
		"midnightblue": [25, 25, 112],
		"mintcream": [245, 255, 250],
		"mistyrose": [255, 228, 225],
		"moccasin": [255, 228, 181],
		"navajowhite": [255, 222, 173],
		"navy": [0, 0, 128],
		"oldlace": [253, 245, 230],
		"olive": [128, 128, 0],
		"olivedrab": [107, 142, 35],
		"orange": [255, 165, 0],
		"orangered": [255, 69, 0],
		"orchid": [218, 112, 214],
		"palegoldenrod": [238, 232, 170],
		"palegreen": [152, 251, 152],
		"paleturquoise": [175, 238, 238],
		"palevioletred": [219, 112, 147],
		"papayawhip": [255, 239, 213],
		"peachpuff": [255, 218, 185],
		"peru": [205, 133, 63],
		"pink": [255, 192, 203],
		"plum": [221, 160, 221],
		"powderblue": [176, 224, 230],
		"purple": [128, 0, 128],
		"rebeccapurple": [102, 51, 153],
		"red": [255, 0, 0],
		"rosybrown": [188, 143, 143],
		"royalblue": [65, 105, 225],
		"saddlebrown": [139, 69, 19],
		"salmon": [250, 128, 114],
		"sandybrown": [244, 164, 96],
		"seagreen": [46, 139, 87],
		"seashell": [255, 245, 238],
		"sienna": [160, 82, 45],
		"silver": [192, 192, 192],
		"skyblue": [135, 206, 235],
		"slateblue": [106, 90, 205],
		"slategray": [112, 128, 144],
		"slategrey": [112, 128, 144],
		"snow": [255, 250, 250],
		"springgreen": [0, 255, 127],
		"steelblue": [70, 130, 180],
		"tan": [210, 180, 140],
		"teal": [0, 128, 128],
		"thistle": [216, 191, 216],
		"tomato": [255, 99, 71],
		"turquoise": [64, 224, 208],
		"violet": [238, 130, 238],
		"wheat": [245, 222, 179],
		"white": [255, 255, 255],
		"whitesmoke": [245, 245, 245],
		"yellow": [255, 255, 0],
		"yellowgreen": [154, 205, 50]
	};
	return colorName$1;
}

var simpleSwizzleExports = {};
var simpleSwizzle = {
  get exports(){ return simpleSwizzleExports; },
  set exports(v){ simpleSwizzleExports = v; },
};

var isArrayish;
var hasRequiredIsArrayish;

function requireIsArrayish () {
	if (hasRequiredIsArrayish) return isArrayish;
	hasRequiredIsArrayish = 1;
	isArrayish = function isArrayish(obj) {
		if (!obj || typeof obj === 'string') {
			return false;
		}

		return obj instanceof Array || Array.isArray(obj) ||
			(obj.length >= 0 && (obj.splice instanceof Function ||
				(Object.getOwnPropertyDescriptor(obj, (obj.length - 1)) && obj.constructor.name !== 'String')));
	};
	return isArrayish;
}

var hasRequiredSimpleSwizzle;

function requireSimpleSwizzle () {
	if (hasRequiredSimpleSwizzle) return simpleSwizzleExports;
	hasRequiredSimpleSwizzle = 1;

	var isArrayish = requireIsArrayish();

	var concat = Array.prototype.concat;
	var slice = Array.prototype.slice;

	var swizzle = simpleSwizzle.exports = function swizzle(args) {
		var results = [];

		for (var i = 0, len = args.length; i < len; i++) {
			var arg = args[i];

			if (isArrayish(arg)) {
				// http://jsperf.com/javascript-array-concat-vs-push/98
				results = concat.call(results, slice.call(arg));
			} else {
				results.push(arg);
			}
		}

		return results;
	};

	swizzle.wrap = function (fn) {
		return function () {
			return fn(swizzle(arguments));
		};
	};
	return simpleSwizzleExports;
}

/* MIT license */

var hasRequiredColorString;

function requireColorString () {
	if (hasRequiredColorString) return colorStringExports;
	hasRequiredColorString = 1;
	var colorNames = requireColorName$1();
	var swizzle = requireSimpleSwizzle();
	var hasOwnProperty = Object.hasOwnProperty;

	var reverseNames = Object.create(null);

	// create a list of reverse color names
	for (var name in colorNames) {
		if (hasOwnProperty.call(colorNames, name)) {
			reverseNames[colorNames[name]] = name;
		}
	}

	var cs = colorString.exports = {
		to: {},
		get: {}
	};

	cs.get = function (string) {
		var prefix = string.substring(0, 3).toLowerCase();
		var val;
		var model;
		switch (prefix) {
			case 'hsl':
				val = cs.get.hsl(string);
				model = 'hsl';
				break;
			case 'hwb':
				val = cs.get.hwb(string);
				model = 'hwb';
				break;
			default:
				val = cs.get.rgb(string);
				model = 'rgb';
				break;
		}

		if (!val) {
			return null;
		}

		return {model: model, value: val};
	};

	cs.get.rgb = function (string) {
		if (!string) {
			return null;
		}

		var abbr = /^#([a-f0-9]{3,4})$/i;
		var hex = /^#([a-f0-9]{6})([a-f0-9]{2})?$/i;
		var rgba = /^rgba?\(\s*([+-]?\d+)(?=[\s,])\s*(?:,\s*)?([+-]?\d+)(?=[\s,])\s*(?:,\s*)?([+-]?\d+)\s*(?:[,|\/]\s*([+-]?[\d\.]+)(%?)\s*)?\)$/;
		var per = /^rgba?\(\s*([+-]?[\d\.]+)\%\s*,?\s*([+-]?[\d\.]+)\%\s*,?\s*([+-]?[\d\.]+)\%\s*(?:[,|\/]\s*([+-]?[\d\.]+)(%?)\s*)?\)$/;
		var keyword = /^(\w+)$/;

		var rgb = [0, 0, 0, 1];
		var match;
		var i;
		var hexAlpha;

		if (match = string.match(hex)) {
			hexAlpha = match[2];
			match = match[1];

			for (i = 0; i < 3; i++) {
				// https://jsperf.com/slice-vs-substr-vs-substring-methods-long-string/19
				var i2 = i * 2;
				rgb[i] = parseInt(match.slice(i2, i2 + 2), 16);
			}

			if (hexAlpha) {
				rgb[3] = parseInt(hexAlpha, 16) / 255;
			}
		} else if (match = string.match(abbr)) {
			match = match[1];
			hexAlpha = match[3];

			for (i = 0; i < 3; i++) {
				rgb[i] = parseInt(match[i] + match[i], 16);
			}

			if (hexAlpha) {
				rgb[3] = parseInt(hexAlpha + hexAlpha, 16) / 255;
			}
		} else if (match = string.match(rgba)) {
			for (i = 0; i < 3; i++) {
				rgb[i] = parseInt(match[i + 1], 0);
			}

			if (match[4]) {
				if (match[5]) {
					rgb[3] = parseFloat(match[4]) * 0.01;
				} else {
					rgb[3] = parseFloat(match[4]);
				}
			}
		} else if (match = string.match(per)) {
			for (i = 0; i < 3; i++) {
				rgb[i] = Math.round(parseFloat(match[i + 1]) * 2.55);
			}

			if (match[4]) {
				if (match[5]) {
					rgb[3] = parseFloat(match[4]) * 0.01;
				} else {
					rgb[3] = parseFloat(match[4]);
				}
			}
		} else if (match = string.match(keyword)) {
			if (match[1] === 'transparent') {
				return [0, 0, 0, 0];
			}

			if (!hasOwnProperty.call(colorNames, match[1])) {
				return null;
			}

			rgb = colorNames[match[1]];
			rgb[3] = 1;

			return rgb;
		} else {
			return null;
		}

		for (i = 0; i < 3; i++) {
			rgb[i] = clamp(rgb[i], 0, 255);
		}
		rgb[3] = clamp(rgb[3], 0, 1);

		return rgb;
	};

	cs.get.hsl = function (string) {
		if (!string) {
			return null;
		}

		var hsl = /^hsla?\(\s*([+-]?(?:\d{0,3}\.)?\d+)(?:deg)?\s*,?\s*([+-]?[\d\.]+)%\s*,?\s*([+-]?[\d\.]+)%\s*(?:[,|\/]\s*([+-]?(?=\.\d|\d)(?:0|[1-9]\d*)?(?:\.\d*)?(?:[eE][+-]?\d+)?)\s*)?\)$/;
		var match = string.match(hsl);

		if (match) {
			var alpha = parseFloat(match[4]);
			var h = ((parseFloat(match[1]) % 360) + 360) % 360;
			var s = clamp(parseFloat(match[2]), 0, 100);
			var l = clamp(parseFloat(match[3]), 0, 100);
			var a = clamp(isNaN(alpha) ? 1 : alpha, 0, 1);

			return [h, s, l, a];
		}

		return null;
	};

	cs.get.hwb = function (string) {
		if (!string) {
			return null;
		}

		var hwb = /^hwb\(\s*([+-]?\d{0,3}(?:\.\d+)?)(?:deg)?\s*,\s*([+-]?[\d\.]+)%\s*,\s*([+-]?[\d\.]+)%\s*(?:,\s*([+-]?(?=\.\d|\d)(?:0|[1-9]\d*)?(?:\.\d*)?(?:[eE][+-]?\d+)?)\s*)?\)$/;
		var match = string.match(hwb);

		if (match) {
			var alpha = parseFloat(match[4]);
			var h = ((parseFloat(match[1]) % 360) + 360) % 360;
			var w = clamp(parseFloat(match[2]), 0, 100);
			var b = clamp(parseFloat(match[3]), 0, 100);
			var a = clamp(isNaN(alpha) ? 1 : alpha, 0, 1);
			return [h, w, b, a];
		}

		return null;
	};

	cs.to.hex = function () {
		var rgba = swizzle(arguments);

		return (
			'#' +
			hexDouble(rgba[0]) +
			hexDouble(rgba[1]) +
			hexDouble(rgba[2]) +
			(rgba[3] < 1
				? (hexDouble(Math.round(rgba[3] * 255)))
				: '')
		);
	};

	cs.to.rgb = function () {
		var rgba = swizzle(arguments);

		return rgba.length < 4 || rgba[3] === 1
			? 'rgb(' + Math.round(rgba[0]) + ', ' + Math.round(rgba[1]) + ', ' + Math.round(rgba[2]) + ')'
			: 'rgba(' + Math.round(rgba[0]) + ', ' + Math.round(rgba[1]) + ', ' + Math.round(rgba[2]) + ', ' + rgba[3] + ')';
	};

	cs.to.rgb.percent = function () {
		var rgba = swizzle(arguments);

		var r = Math.round(rgba[0] / 255 * 100);
		var g = Math.round(rgba[1] / 255 * 100);
		var b = Math.round(rgba[2] / 255 * 100);

		return rgba.length < 4 || rgba[3] === 1
			? 'rgb(' + r + '%, ' + g + '%, ' + b + '%)'
			: 'rgba(' + r + '%, ' + g + '%, ' + b + '%, ' + rgba[3] + ')';
	};

	cs.to.hsl = function () {
		var hsla = swizzle(arguments);
		return hsla.length < 4 || hsla[3] === 1
			? 'hsl(' + hsla[0] + ', ' + hsla[1] + '%, ' + hsla[2] + '%)'
			: 'hsla(' + hsla[0] + ', ' + hsla[1] + '%, ' + hsla[2] + '%, ' + hsla[3] + ')';
	};

	// hwb is a bit different than rgb(a) & hsl(a) since there is no alpha specific syntax
	// (hwb have alpha optional & 1 is default value)
	cs.to.hwb = function () {
		var hwba = swizzle(arguments);

		var a = '';
		if (hwba.length >= 4 && hwba[3] !== 1) {
			a = ', ' + hwba[3];
		}

		return 'hwb(' + hwba[0] + ', ' + hwba[1] + '%, ' + hwba[2] + '%' + a + ')';
	};

	cs.to.keyword = function (rgb) {
		return reverseNames[rgb.slice(0, 3)];
	};

	// helpers
	function clamp(num, min, max) {
		return Math.min(Math.max(min, num), max);
	}

	function hexDouble(num) {
		var str = Math.round(num).toString(16).toUpperCase();
		return (str.length < 2) ? '0' + str : str;
	}
	return colorStringExports;
}

var conversionsExports = {};
var conversions = {
  get exports(){ return conversionsExports; },
  set exports(v){ conversionsExports = v; },
};

var colorName;
var hasRequiredColorName;

function requireColorName () {
	if (hasRequiredColorName) return colorName;
	hasRequiredColorName = 1;

	colorName = {
		"aliceblue": [240, 248, 255],
		"antiquewhite": [250, 235, 215],
		"aqua": [0, 255, 255],
		"aquamarine": [127, 255, 212],
		"azure": [240, 255, 255],
		"beige": [245, 245, 220],
		"bisque": [255, 228, 196],
		"black": [0, 0, 0],
		"blanchedalmond": [255, 235, 205],
		"blue": [0, 0, 255],
		"blueviolet": [138, 43, 226],
		"brown": [165, 42, 42],
		"burlywood": [222, 184, 135],
		"cadetblue": [95, 158, 160],
		"chartreuse": [127, 255, 0],
		"chocolate": [210, 105, 30],
		"coral": [255, 127, 80],
		"cornflowerblue": [100, 149, 237],
		"cornsilk": [255, 248, 220],
		"crimson": [220, 20, 60],
		"cyan": [0, 255, 255],
		"darkblue": [0, 0, 139],
		"darkcyan": [0, 139, 139],
		"darkgoldenrod": [184, 134, 11],
		"darkgray": [169, 169, 169],
		"darkgreen": [0, 100, 0],
		"darkgrey": [169, 169, 169],
		"darkkhaki": [189, 183, 107],
		"darkmagenta": [139, 0, 139],
		"darkolivegreen": [85, 107, 47],
		"darkorange": [255, 140, 0],
		"darkorchid": [153, 50, 204],
		"darkred": [139, 0, 0],
		"darksalmon": [233, 150, 122],
		"darkseagreen": [143, 188, 143],
		"darkslateblue": [72, 61, 139],
		"darkslategray": [47, 79, 79],
		"darkslategrey": [47, 79, 79],
		"darkturquoise": [0, 206, 209],
		"darkviolet": [148, 0, 211],
		"deeppink": [255, 20, 147],
		"deepskyblue": [0, 191, 255],
		"dimgray": [105, 105, 105],
		"dimgrey": [105, 105, 105],
		"dodgerblue": [30, 144, 255],
		"firebrick": [178, 34, 34],
		"floralwhite": [255, 250, 240],
		"forestgreen": [34, 139, 34],
		"fuchsia": [255, 0, 255],
		"gainsboro": [220, 220, 220],
		"ghostwhite": [248, 248, 255],
		"gold": [255, 215, 0],
		"goldenrod": [218, 165, 32],
		"gray": [128, 128, 128],
		"green": [0, 128, 0],
		"greenyellow": [173, 255, 47],
		"grey": [128, 128, 128],
		"honeydew": [240, 255, 240],
		"hotpink": [255, 105, 180],
		"indianred": [205, 92, 92],
		"indigo": [75, 0, 130],
		"ivory": [255, 255, 240],
		"khaki": [240, 230, 140],
		"lavender": [230, 230, 250],
		"lavenderblush": [255, 240, 245],
		"lawngreen": [124, 252, 0],
		"lemonchiffon": [255, 250, 205],
		"lightblue": [173, 216, 230],
		"lightcoral": [240, 128, 128],
		"lightcyan": [224, 255, 255],
		"lightgoldenrodyellow": [250, 250, 210],
		"lightgray": [211, 211, 211],
		"lightgreen": [144, 238, 144],
		"lightgrey": [211, 211, 211],
		"lightpink": [255, 182, 193],
		"lightsalmon": [255, 160, 122],
		"lightseagreen": [32, 178, 170],
		"lightskyblue": [135, 206, 250],
		"lightslategray": [119, 136, 153],
		"lightslategrey": [119, 136, 153],
		"lightsteelblue": [176, 196, 222],
		"lightyellow": [255, 255, 224],
		"lime": [0, 255, 0],
		"limegreen": [50, 205, 50],
		"linen": [250, 240, 230],
		"magenta": [255, 0, 255],
		"maroon": [128, 0, 0],
		"mediumaquamarine": [102, 205, 170],
		"mediumblue": [0, 0, 205],
		"mediumorchid": [186, 85, 211],
		"mediumpurple": [147, 112, 219],
		"mediumseagreen": [60, 179, 113],
		"mediumslateblue": [123, 104, 238],
		"mediumspringgreen": [0, 250, 154],
		"mediumturquoise": [72, 209, 204],
		"mediumvioletred": [199, 21, 133],
		"midnightblue": [25, 25, 112],
		"mintcream": [245, 255, 250],
		"mistyrose": [255, 228, 225],
		"moccasin": [255, 228, 181],
		"navajowhite": [255, 222, 173],
		"navy": [0, 0, 128],
		"oldlace": [253, 245, 230],
		"olive": [128, 128, 0],
		"olivedrab": [107, 142, 35],
		"orange": [255, 165, 0],
		"orangered": [255, 69, 0],
		"orchid": [218, 112, 214],
		"palegoldenrod": [238, 232, 170],
		"palegreen": [152, 251, 152],
		"paleturquoise": [175, 238, 238],
		"palevioletred": [219, 112, 147],
		"papayawhip": [255, 239, 213],
		"peachpuff": [255, 218, 185],
		"peru": [205, 133, 63],
		"pink": [255, 192, 203],
		"plum": [221, 160, 221],
		"powderblue": [176, 224, 230],
		"purple": [128, 0, 128],
		"rebeccapurple": [102, 51, 153],
		"red": [255, 0, 0],
		"rosybrown": [188, 143, 143],
		"royalblue": [65, 105, 225],
		"saddlebrown": [139, 69, 19],
		"salmon": [250, 128, 114],
		"sandybrown": [244, 164, 96],
		"seagreen": [46, 139, 87],
		"seashell": [255, 245, 238],
		"sienna": [160, 82, 45],
		"silver": [192, 192, 192],
		"skyblue": [135, 206, 235],
		"slateblue": [106, 90, 205],
		"slategray": [112, 128, 144],
		"slategrey": [112, 128, 144],
		"snow": [255, 250, 250],
		"springgreen": [0, 255, 127],
		"steelblue": [70, 130, 180],
		"tan": [210, 180, 140],
		"teal": [0, 128, 128],
		"thistle": [216, 191, 216],
		"tomato": [255, 99, 71],
		"turquoise": [64, 224, 208],
		"violet": [238, 130, 238],
		"wheat": [245, 222, 179],
		"white": [255, 255, 255],
		"whitesmoke": [245, 245, 245],
		"yellow": [255, 255, 0],
		"yellowgreen": [154, 205, 50]
	};
	return colorName;
}

/* MIT license */

var hasRequiredConversions;

function requireConversions () {
	if (hasRequiredConversions) return conversionsExports;
	hasRequiredConversions = 1;
	var cssKeywords = requireColorName();

	// NOTE: conversions should only return primitive values (i.e. arrays, or
	//       values that give correct `typeof` results).
	//       do not use box values types (i.e. Number(), String(), etc.)

	var reverseKeywords = {};
	for (var key in cssKeywords) {
		if (cssKeywords.hasOwnProperty(key)) {
			reverseKeywords[cssKeywords[key]] = key;
		}
	}

	var convert = conversions.exports = {
		rgb: {channels: 3, labels: 'rgb'},
		hsl: {channels: 3, labels: 'hsl'},
		hsv: {channels: 3, labels: 'hsv'},
		hwb: {channels: 3, labels: 'hwb'},
		cmyk: {channels: 4, labels: 'cmyk'},
		xyz: {channels: 3, labels: 'xyz'},
		lab: {channels: 3, labels: 'lab'},
		lch: {channels: 3, labels: 'lch'},
		hex: {channels: 1, labels: ['hex']},
		keyword: {channels: 1, labels: ['keyword']},
		ansi16: {channels: 1, labels: ['ansi16']},
		ansi256: {channels: 1, labels: ['ansi256']},
		hcg: {channels: 3, labels: ['h', 'c', 'g']},
		apple: {channels: 3, labels: ['r16', 'g16', 'b16']},
		gray: {channels: 1, labels: ['gray']}
	};

	// hide .channels and .labels properties
	for (var model in convert) {
		if (convert.hasOwnProperty(model)) {
			if (!('channels' in convert[model])) {
				throw new Error('missing channels property: ' + model);
			}

			if (!('labels' in convert[model])) {
				throw new Error('missing channel labels property: ' + model);
			}

			if (convert[model].labels.length !== convert[model].channels) {
				throw new Error('channel and label counts mismatch: ' + model);
			}

			var channels = convert[model].channels;
			var labels = convert[model].labels;
			delete convert[model].channels;
			delete convert[model].labels;
			Object.defineProperty(convert[model], 'channels', {value: channels});
			Object.defineProperty(convert[model], 'labels', {value: labels});
		}
	}

	convert.rgb.hsl = function (rgb) {
		var r = rgb[0] / 255;
		var g = rgb[1] / 255;
		var b = rgb[2] / 255;
		var min = Math.min(r, g, b);
		var max = Math.max(r, g, b);
		var delta = max - min;
		var h;
		var s;
		var l;

		if (max === min) {
			h = 0;
		} else if (r === max) {
			h = (g - b) / delta;
		} else if (g === max) {
			h = 2 + (b - r) / delta;
		} else if (b === max) {
			h = 4 + (r - g) / delta;
		}

		h = Math.min(h * 60, 360);

		if (h < 0) {
			h += 360;
		}

		l = (min + max) / 2;

		if (max === min) {
			s = 0;
		} else if (l <= 0.5) {
			s = delta / (max + min);
		} else {
			s = delta / (2 - max - min);
		}

		return [h, s * 100, l * 100];
	};

	convert.rgb.hsv = function (rgb) {
		var rdif;
		var gdif;
		var bdif;
		var h;
		var s;

		var r = rgb[0] / 255;
		var g = rgb[1] / 255;
		var b = rgb[2] / 255;
		var v = Math.max(r, g, b);
		var diff = v - Math.min(r, g, b);
		var diffc = function (c) {
			return (v - c) / 6 / diff + 1 / 2;
		};

		if (diff === 0) {
			h = s = 0;
		} else {
			s = diff / v;
			rdif = diffc(r);
			gdif = diffc(g);
			bdif = diffc(b);

			if (r === v) {
				h = bdif - gdif;
			} else if (g === v) {
				h = (1 / 3) + rdif - bdif;
			} else if (b === v) {
				h = (2 / 3) + gdif - rdif;
			}
			if (h < 0) {
				h += 1;
			} else if (h > 1) {
				h -= 1;
			}
		}

		return [
			h * 360,
			s * 100,
			v * 100
		];
	};

	convert.rgb.hwb = function (rgb) {
		var r = rgb[0];
		var g = rgb[1];
		var b = rgb[2];
		var h = convert.rgb.hsl(rgb)[0];
		var w = 1 / 255 * Math.min(r, Math.min(g, b));

		b = 1 - 1 / 255 * Math.max(r, Math.max(g, b));

		return [h, w * 100, b * 100];
	};

	convert.rgb.cmyk = function (rgb) {
		var r = rgb[0] / 255;
		var g = rgb[1] / 255;
		var b = rgb[2] / 255;
		var c;
		var m;
		var y;
		var k;

		k = Math.min(1 - r, 1 - g, 1 - b);
		c = (1 - r - k) / (1 - k) || 0;
		m = (1 - g - k) / (1 - k) || 0;
		y = (1 - b - k) / (1 - k) || 0;

		return [c * 100, m * 100, y * 100, k * 100];
	};

	/**
	 * See https://en.m.wikipedia.org/wiki/Euclidean_distance#Squared_Euclidean_distance
	 * */
	function comparativeDistance(x, y) {
		return (
			Math.pow(x[0] - y[0], 2) +
			Math.pow(x[1] - y[1], 2) +
			Math.pow(x[2] - y[2], 2)
		);
	}

	convert.rgb.keyword = function (rgb) {
		var reversed = reverseKeywords[rgb];
		if (reversed) {
			return reversed;
		}

		var currentClosestDistance = Infinity;
		var currentClosestKeyword;

		for (var keyword in cssKeywords) {
			if (cssKeywords.hasOwnProperty(keyword)) {
				var value = cssKeywords[keyword];

				// Compute comparative distance
				var distance = comparativeDistance(rgb, value);

				// Check if its less, if so set as closest
				if (distance < currentClosestDistance) {
					currentClosestDistance = distance;
					currentClosestKeyword = keyword;
				}
			}
		}

		return currentClosestKeyword;
	};

	convert.keyword.rgb = function (keyword) {
		return cssKeywords[keyword];
	};

	convert.rgb.xyz = function (rgb) {
		var r = rgb[0] / 255;
		var g = rgb[1] / 255;
		var b = rgb[2] / 255;

		// assume sRGB
		r = r > 0.04045 ? Math.pow(((r + 0.055) / 1.055), 2.4) : (r / 12.92);
		g = g > 0.04045 ? Math.pow(((g + 0.055) / 1.055), 2.4) : (g / 12.92);
		b = b > 0.04045 ? Math.pow(((b + 0.055) / 1.055), 2.4) : (b / 12.92);

		var x = (r * 0.4124) + (g * 0.3576) + (b * 0.1805);
		var y = (r * 0.2126) + (g * 0.7152) + (b * 0.0722);
		var z = (r * 0.0193) + (g * 0.1192) + (b * 0.9505);

		return [x * 100, y * 100, z * 100];
	};

	convert.rgb.lab = function (rgb) {
		var xyz = convert.rgb.xyz(rgb);
		var x = xyz[0];
		var y = xyz[1];
		var z = xyz[2];
		var l;
		var a;
		var b;

		x /= 95.047;
		y /= 100;
		z /= 108.883;

		x = x > 0.008856 ? Math.pow(x, 1 / 3) : (7.787 * x) + (16 / 116);
		y = y > 0.008856 ? Math.pow(y, 1 / 3) : (7.787 * y) + (16 / 116);
		z = z > 0.008856 ? Math.pow(z, 1 / 3) : (7.787 * z) + (16 / 116);

		l = (116 * y) - 16;
		a = 500 * (x - y);
		b = 200 * (y - z);

		return [l, a, b];
	};

	convert.hsl.rgb = function (hsl) {
		var h = hsl[0] / 360;
		var s = hsl[1] / 100;
		var l = hsl[2] / 100;
		var t1;
		var t2;
		var t3;
		var rgb;
		var val;

		if (s === 0) {
			val = l * 255;
			return [val, val, val];
		}

		if (l < 0.5) {
			t2 = l * (1 + s);
		} else {
			t2 = l + s - l * s;
		}

		t1 = 2 * l - t2;

		rgb = [0, 0, 0];
		for (var i = 0; i < 3; i++) {
			t3 = h + 1 / 3 * -(i - 1);
			if (t3 < 0) {
				t3++;
			}
			if (t3 > 1) {
				t3--;
			}

			if (6 * t3 < 1) {
				val = t1 + (t2 - t1) * 6 * t3;
			} else if (2 * t3 < 1) {
				val = t2;
			} else if (3 * t3 < 2) {
				val = t1 + (t2 - t1) * (2 / 3 - t3) * 6;
			} else {
				val = t1;
			}

			rgb[i] = val * 255;
		}

		return rgb;
	};

	convert.hsl.hsv = function (hsl) {
		var h = hsl[0];
		var s = hsl[1] / 100;
		var l = hsl[2] / 100;
		var smin = s;
		var lmin = Math.max(l, 0.01);
		var sv;
		var v;

		l *= 2;
		s *= (l <= 1) ? l : 2 - l;
		smin *= lmin <= 1 ? lmin : 2 - lmin;
		v = (l + s) / 2;
		sv = l === 0 ? (2 * smin) / (lmin + smin) : (2 * s) / (l + s);

		return [h, sv * 100, v * 100];
	};

	convert.hsv.rgb = function (hsv) {
		var h = hsv[0] / 60;
		var s = hsv[1] / 100;
		var v = hsv[2] / 100;
		var hi = Math.floor(h) % 6;

		var f = h - Math.floor(h);
		var p = 255 * v * (1 - s);
		var q = 255 * v * (1 - (s * f));
		var t = 255 * v * (1 - (s * (1 - f)));
		v *= 255;

		switch (hi) {
			case 0:
				return [v, t, p];
			case 1:
				return [q, v, p];
			case 2:
				return [p, v, t];
			case 3:
				return [p, q, v];
			case 4:
				return [t, p, v];
			case 5:
				return [v, p, q];
		}
	};

	convert.hsv.hsl = function (hsv) {
		var h = hsv[0];
		var s = hsv[1] / 100;
		var v = hsv[2] / 100;
		var vmin = Math.max(v, 0.01);
		var lmin;
		var sl;
		var l;

		l = (2 - s) * v;
		lmin = (2 - s) * vmin;
		sl = s * vmin;
		sl /= (lmin <= 1) ? lmin : 2 - lmin;
		sl = sl || 0;
		l /= 2;

		return [h, sl * 100, l * 100];
	};

	// http://dev.w3.org/csswg/css-color/#hwb-to-rgb
	convert.hwb.rgb = function (hwb) {
		var h = hwb[0] / 360;
		var wh = hwb[1] / 100;
		var bl = hwb[2] / 100;
		var ratio = wh + bl;
		var i;
		var v;
		var f;
		var n;

		// wh + bl cant be > 1
		if (ratio > 1) {
			wh /= ratio;
			bl /= ratio;
		}

		i = Math.floor(6 * h);
		v = 1 - bl;
		f = 6 * h - i;

		if ((i & 0x01) !== 0) {
			f = 1 - f;
		}

		n = wh + f * (v - wh); // linear interpolation

		var r;
		var g;
		var b;
		switch (i) {
			default:
			case 6:
			case 0: r = v; g = n; b = wh; break;
			case 1: r = n; g = v; b = wh; break;
			case 2: r = wh; g = v; b = n; break;
			case 3: r = wh; g = n; b = v; break;
			case 4: r = n; g = wh; b = v; break;
			case 5: r = v; g = wh; b = n; break;
		}

		return [r * 255, g * 255, b * 255];
	};

	convert.cmyk.rgb = function (cmyk) {
		var c = cmyk[0] / 100;
		var m = cmyk[1] / 100;
		var y = cmyk[2] / 100;
		var k = cmyk[3] / 100;
		var r;
		var g;
		var b;

		r = 1 - Math.min(1, c * (1 - k) + k);
		g = 1 - Math.min(1, m * (1 - k) + k);
		b = 1 - Math.min(1, y * (1 - k) + k);

		return [r * 255, g * 255, b * 255];
	};

	convert.xyz.rgb = function (xyz) {
		var x = xyz[0] / 100;
		var y = xyz[1] / 100;
		var z = xyz[2] / 100;
		var r;
		var g;
		var b;

		r = (x * 3.2406) + (y * -1.5372) + (z * -0.4986);
		g = (x * -0.9689) + (y * 1.8758) + (z * 0.0415);
		b = (x * 0.0557) + (y * -0.2040) + (z * 1.0570);

		// assume sRGB
		r = r > 0.0031308
			? ((1.055 * Math.pow(r, 1.0 / 2.4)) - 0.055)
			: r * 12.92;

		g = g > 0.0031308
			? ((1.055 * Math.pow(g, 1.0 / 2.4)) - 0.055)
			: g * 12.92;

		b = b > 0.0031308
			? ((1.055 * Math.pow(b, 1.0 / 2.4)) - 0.055)
			: b * 12.92;

		r = Math.min(Math.max(0, r), 1);
		g = Math.min(Math.max(0, g), 1);
		b = Math.min(Math.max(0, b), 1);

		return [r * 255, g * 255, b * 255];
	};

	convert.xyz.lab = function (xyz) {
		var x = xyz[0];
		var y = xyz[1];
		var z = xyz[2];
		var l;
		var a;
		var b;

		x /= 95.047;
		y /= 100;
		z /= 108.883;

		x = x > 0.008856 ? Math.pow(x, 1 / 3) : (7.787 * x) + (16 / 116);
		y = y > 0.008856 ? Math.pow(y, 1 / 3) : (7.787 * y) + (16 / 116);
		z = z > 0.008856 ? Math.pow(z, 1 / 3) : (7.787 * z) + (16 / 116);

		l = (116 * y) - 16;
		a = 500 * (x - y);
		b = 200 * (y - z);

		return [l, a, b];
	};

	convert.lab.xyz = function (lab) {
		var l = lab[0];
		var a = lab[1];
		var b = lab[2];
		var x;
		var y;
		var z;

		y = (l + 16) / 116;
		x = a / 500 + y;
		z = y - b / 200;

		var y2 = Math.pow(y, 3);
		var x2 = Math.pow(x, 3);
		var z2 = Math.pow(z, 3);
		y = y2 > 0.008856 ? y2 : (y - 16 / 116) / 7.787;
		x = x2 > 0.008856 ? x2 : (x - 16 / 116) / 7.787;
		z = z2 > 0.008856 ? z2 : (z - 16 / 116) / 7.787;

		x *= 95.047;
		y *= 100;
		z *= 108.883;

		return [x, y, z];
	};

	convert.lab.lch = function (lab) {
		var l = lab[0];
		var a = lab[1];
		var b = lab[2];
		var hr;
		var h;
		var c;

		hr = Math.atan2(b, a);
		h = hr * 360 / 2 / Math.PI;

		if (h < 0) {
			h += 360;
		}

		c = Math.sqrt(a * a + b * b);

		return [l, c, h];
	};

	convert.lch.lab = function (lch) {
		var l = lch[0];
		var c = lch[1];
		var h = lch[2];
		var a;
		var b;
		var hr;

		hr = h / 360 * 2 * Math.PI;
		a = c * Math.cos(hr);
		b = c * Math.sin(hr);

		return [l, a, b];
	};

	convert.rgb.ansi16 = function (args) {
		var r = args[0];
		var g = args[1];
		var b = args[2];
		var value = 1 in arguments ? arguments[1] : convert.rgb.hsv(args)[2]; // hsv -> ansi16 optimization

		value = Math.round(value / 50);

		if (value === 0) {
			return 30;
		}

		var ansi = 30
			+ ((Math.round(b / 255) << 2)
			| (Math.round(g / 255) << 1)
			| Math.round(r / 255));

		if (value === 2) {
			ansi += 60;
		}

		return ansi;
	};

	convert.hsv.ansi16 = function (args) {
		// optimization here; we already know the value and don't need to get
		// it converted for us.
		return convert.rgb.ansi16(convert.hsv.rgb(args), args[2]);
	};

	convert.rgb.ansi256 = function (args) {
		var r = args[0];
		var g = args[1];
		var b = args[2];

		// we use the extended greyscale palette here, with the exception of
		// black and white. normal palette only has 4 greyscale shades.
		if (r === g && g === b) {
			if (r < 8) {
				return 16;
			}

			if (r > 248) {
				return 231;
			}

			return Math.round(((r - 8) / 247) * 24) + 232;
		}

		var ansi = 16
			+ (36 * Math.round(r / 255 * 5))
			+ (6 * Math.round(g / 255 * 5))
			+ Math.round(b / 255 * 5);

		return ansi;
	};

	convert.ansi16.rgb = function (args) {
		var color = args % 10;

		// handle greyscale
		if (color === 0 || color === 7) {
			if (args > 50) {
				color += 3.5;
			}

			color = color / 10.5 * 255;

			return [color, color, color];
		}

		var mult = (~~(args > 50) + 1) * 0.5;
		var r = ((color & 1) * mult) * 255;
		var g = (((color >> 1) & 1) * mult) * 255;
		var b = (((color >> 2) & 1) * mult) * 255;

		return [r, g, b];
	};

	convert.ansi256.rgb = function (args) {
		// handle greyscale
		if (args >= 232) {
			var c = (args - 232) * 10 + 8;
			return [c, c, c];
		}

		args -= 16;

		var rem;
		var r = Math.floor(args / 36) / 5 * 255;
		var g = Math.floor((rem = args % 36) / 6) / 5 * 255;
		var b = (rem % 6) / 5 * 255;

		return [r, g, b];
	};

	convert.rgb.hex = function (args) {
		var integer = ((Math.round(args[0]) & 0xFF) << 16)
			+ ((Math.round(args[1]) & 0xFF) << 8)
			+ (Math.round(args[2]) & 0xFF);

		var string = integer.toString(16).toUpperCase();
		return '000000'.substring(string.length) + string;
	};

	convert.hex.rgb = function (args) {
		var match = args.toString(16).match(/[a-f0-9]{6}|[a-f0-9]{3}/i);
		if (!match) {
			return [0, 0, 0];
		}

		var colorString = match[0];

		if (match[0].length === 3) {
			colorString = colorString.split('').map(function (char) {
				return char + char;
			}).join('');
		}

		var integer = parseInt(colorString, 16);
		var r = (integer >> 16) & 0xFF;
		var g = (integer >> 8) & 0xFF;
		var b = integer & 0xFF;

		return [r, g, b];
	};

	convert.rgb.hcg = function (rgb) {
		var r = rgb[0] / 255;
		var g = rgb[1] / 255;
		var b = rgb[2] / 255;
		var max = Math.max(Math.max(r, g), b);
		var min = Math.min(Math.min(r, g), b);
		var chroma = (max - min);
		var grayscale;
		var hue;

		if (chroma < 1) {
			grayscale = min / (1 - chroma);
		} else {
			grayscale = 0;
		}

		if (chroma <= 0) {
			hue = 0;
		} else
		if (max === r) {
			hue = ((g - b) / chroma) % 6;
		} else
		if (max === g) {
			hue = 2 + (b - r) / chroma;
		} else {
			hue = 4 + (r - g) / chroma + 4;
		}

		hue /= 6;
		hue %= 1;

		return [hue * 360, chroma * 100, grayscale * 100];
	};

	convert.hsl.hcg = function (hsl) {
		var s = hsl[1] / 100;
		var l = hsl[2] / 100;
		var c = 1;
		var f = 0;

		if (l < 0.5) {
			c = 2.0 * s * l;
		} else {
			c = 2.0 * s * (1.0 - l);
		}

		if (c < 1.0) {
			f = (l - 0.5 * c) / (1.0 - c);
		}

		return [hsl[0], c * 100, f * 100];
	};

	convert.hsv.hcg = function (hsv) {
		var s = hsv[1] / 100;
		var v = hsv[2] / 100;

		var c = s * v;
		var f = 0;

		if (c < 1.0) {
			f = (v - c) / (1 - c);
		}

		return [hsv[0], c * 100, f * 100];
	};

	convert.hcg.rgb = function (hcg) {
		var h = hcg[0] / 360;
		var c = hcg[1] / 100;
		var g = hcg[2] / 100;

		if (c === 0.0) {
			return [g * 255, g * 255, g * 255];
		}

		var pure = [0, 0, 0];
		var hi = (h % 1) * 6;
		var v = hi % 1;
		var w = 1 - v;
		var mg = 0;

		switch (Math.floor(hi)) {
			case 0:
				pure[0] = 1; pure[1] = v; pure[2] = 0; break;
			case 1:
				pure[0] = w; pure[1] = 1; pure[2] = 0; break;
			case 2:
				pure[0] = 0; pure[1] = 1; pure[2] = v; break;
			case 3:
				pure[0] = 0; pure[1] = w; pure[2] = 1; break;
			case 4:
				pure[0] = v; pure[1] = 0; pure[2] = 1; break;
			default:
				pure[0] = 1; pure[1] = 0; pure[2] = w;
		}

		mg = (1.0 - c) * g;

		return [
			(c * pure[0] + mg) * 255,
			(c * pure[1] + mg) * 255,
			(c * pure[2] + mg) * 255
		];
	};

	convert.hcg.hsv = function (hcg) {
		var c = hcg[1] / 100;
		var g = hcg[2] / 100;

		var v = c + g * (1.0 - c);
		var f = 0;

		if (v > 0.0) {
			f = c / v;
		}

		return [hcg[0], f * 100, v * 100];
	};

	convert.hcg.hsl = function (hcg) {
		var c = hcg[1] / 100;
		var g = hcg[2] / 100;

		var l = g * (1.0 - c) + 0.5 * c;
		var s = 0;

		if (l > 0.0 && l < 0.5) {
			s = c / (2 * l);
		} else
		if (l >= 0.5 && l < 1.0) {
			s = c / (2 * (1 - l));
		}

		return [hcg[0], s * 100, l * 100];
	};

	convert.hcg.hwb = function (hcg) {
		var c = hcg[1] / 100;
		var g = hcg[2] / 100;
		var v = c + g * (1.0 - c);
		return [hcg[0], (v - c) * 100, (1 - v) * 100];
	};

	convert.hwb.hcg = function (hwb) {
		var w = hwb[1] / 100;
		var b = hwb[2] / 100;
		var v = 1 - b;
		var c = v - w;
		var g = 0;

		if (c < 1) {
			g = (v - c) / (1 - c);
		}

		return [hwb[0], c * 100, g * 100];
	};

	convert.apple.rgb = function (apple) {
		return [(apple[0] / 65535) * 255, (apple[1] / 65535) * 255, (apple[2] / 65535) * 255];
	};

	convert.rgb.apple = function (rgb) {
		return [(rgb[0] / 255) * 65535, (rgb[1] / 255) * 65535, (rgb[2] / 255) * 65535];
	};

	convert.gray.rgb = function (args) {
		return [args[0] / 100 * 255, args[0] / 100 * 255, args[0] / 100 * 255];
	};

	convert.gray.hsl = convert.gray.hsv = function (args) {
		return [0, 0, args[0]];
	};

	convert.gray.hwb = function (gray) {
		return [0, 100, gray[0]];
	};

	convert.gray.cmyk = function (gray) {
		return [0, 0, 0, gray[0]];
	};

	convert.gray.lab = function (gray) {
		return [gray[0], 0, 0];
	};

	convert.gray.hex = function (gray) {
		var val = Math.round(gray[0] / 100 * 255) & 0xFF;
		var integer = (val << 16) + (val << 8) + val;

		var string = integer.toString(16).toUpperCase();
		return '000000'.substring(string.length) + string;
	};

	convert.rgb.gray = function (rgb) {
		var val = (rgb[0] + rgb[1] + rgb[2]) / 3;
		return [val / 255 * 100];
	};
	return conversionsExports;
}

var route;
var hasRequiredRoute;

function requireRoute () {
	if (hasRequiredRoute) return route;
	hasRequiredRoute = 1;
	var conversions = requireConversions();

	/*
		this function routes a model to all other models.

		all functions that are routed have a property `.conversion` attached
		to the returned synthetic function. This property is an array
		of strings, each with the steps in between the 'from' and 'to'
		color models (inclusive).

		conversions that are not possible simply are not included.
	*/

	function buildGraph() {
		var graph = {};
		// https://jsperf.com/object-keys-vs-for-in-with-closure/3
		var models = Object.keys(conversions);

		for (var len = models.length, i = 0; i < len; i++) {
			graph[models[i]] = {
				// http://jsperf.com/1-vs-infinity
				// micro-opt, but this is simple.
				distance: -1,
				parent: null
			};
		}

		return graph;
	}

	// https://en.wikipedia.org/wiki/Breadth-first_search
	function deriveBFS(fromModel) {
		var graph = buildGraph();
		var queue = [fromModel]; // unshift -> queue -> pop

		graph[fromModel].distance = 0;

		while (queue.length) {
			var current = queue.pop();
			var adjacents = Object.keys(conversions[current]);

			for (var len = adjacents.length, i = 0; i < len; i++) {
				var adjacent = adjacents[i];
				var node = graph[adjacent];

				if (node.distance === -1) {
					node.distance = graph[current].distance + 1;
					node.parent = current;
					queue.unshift(adjacent);
				}
			}
		}

		return graph;
	}

	function link(from, to) {
		return function (args) {
			return to(from(args));
		};
	}

	function wrapConversion(toModel, graph) {
		var path = [graph[toModel].parent, toModel];
		var fn = conversions[graph[toModel].parent][toModel];

		var cur = graph[toModel].parent;
		while (graph[cur].parent) {
			path.unshift(graph[cur].parent);
			fn = link(conversions[graph[cur].parent][cur], fn);
			cur = graph[cur].parent;
		}

		fn.conversion = path;
		return fn;
	}

	route = function (fromModel) {
		var graph = deriveBFS(fromModel);
		var conversion = {};

		var models = Object.keys(graph);
		for (var len = models.length, i = 0; i < len; i++) {
			var toModel = models[i];
			var node = graph[toModel];

			if (node.parent === null) {
				// no possible conversion, or this node is the source model.
				continue;
			}

			conversion[toModel] = wrapConversion(toModel, graph);
		}

		return conversion;
	};
	return route;
}

var colorConvert;
var hasRequiredColorConvert;

function requireColorConvert () {
	if (hasRequiredColorConvert) return colorConvert;
	hasRequiredColorConvert = 1;
	var conversions = requireConversions();
	var route = requireRoute();

	var convert = {};

	var models = Object.keys(conversions);

	function wrapRaw(fn) {
		var wrappedFn = function (args) {
			if (args === undefined || args === null) {
				return args;
			}

			if (arguments.length > 1) {
				args = Array.prototype.slice.call(arguments);
			}

			return fn(args);
		};

		// preserve .conversion property if there is one
		if ('conversion' in fn) {
			wrappedFn.conversion = fn.conversion;
		}

		return wrappedFn;
	}

	function wrapRounded(fn) {
		var wrappedFn = function (args) {
			if (args === undefined || args === null) {
				return args;
			}

			if (arguments.length > 1) {
				args = Array.prototype.slice.call(arguments);
			}

			var result = fn(args);

			// we're assuming the result is an array here.
			// see notice in conversions.js; don't use box types
			// in conversion functions.
			if (typeof result === 'object') {
				for (var len = result.length, i = 0; i < len; i++) {
					result[i] = Math.round(result[i]);
				}
			}

			return result;
		};

		// preserve .conversion property if there is one
		if ('conversion' in fn) {
			wrappedFn.conversion = fn.conversion;
		}

		return wrappedFn;
	}

	models.forEach(function (fromModel) {
		convert[fromModel] = {};

		Object.defineProperty(convert[fromModel], 'channels', {value: conversions[fromModel].channels});
		Object.defineProperty(convert[fromModel], 'labels', {value: conversions[fromModel].labels});

		var routes = route(fromModel);
		var routeModels = Object.keys(routes);

		routeModels.forEach(function (toModel) {
			var fn = routes[toModel];

			convert[fromModel][toModel] = wrapRounded(fn);
			convert[fromModel][toModel].raw = wrapRaw(fn);
		});
	});

	colorConvert = convert;
	return colorConvert;
}

var color;
var hasRequiredColor;

function requireColor () {
	if (hasRequiredColor) return color;
	hasRequiredColor = 1;

	var colorString = requireColorString();
	var convert = requireColorConvert();

	var _slice = [].slice;

	var skippedModels = [
		// to be honest, I don't really feel like keyword belongs in color convert, but eh.
		'keyword',

		// gray conflicts with some method names, and has its own method defined.
		'gray',

		// shouldn't really be in color-convert either...
		'hex'
	];

	var hashedModelKeys = {};
	Object.keys(convert).forEach(function (model) {
		hashedModelKeys[_slice.call(convert[model].labels).sort().join('')] = model;
	});

	var limiters = {};

	function Color(obj, model) {
		if (!(this instanceof Color)) {
			return new Color(obj, model);
		}

		if (model && model in skippedModels) {
			model = null;
		}

		if (model && !(model in convert)) {
			throw new Error('Unknown model: ' + model);
		}

		var i;
		var channels;

		if (obj == null) { // eslint-disable-line no-eq-null,eqeqeq
			this.model = 'rgb';
			this.color = [0, 0, 0];
			this.valpha = 1;
		} else if (obj instanceof Color) {
			this.model = obj.model;
			this.color = obj.color.slice();
			this.valpha = obj.valpha;
		} else if (typeof obj === 'string') {
			var result = colorString.get(obj);
			if (result === null) {
				throw new Error('Unable to parse color from string: ' + obj);
			}

			this.model = result.model;
			channels = convert[this.model].channels;
			this.color = result.value.slice(0, channels);
			this.valpha = typeof result.value[channels] === 'number' ? result.value[channels] : 1;
		} else if (obj.length) {
			this.model = model || 'rgb';
			channels = convert[this.model].channels;
			var newArr = _slice.call(obj, 0, channels);
			this.color = zeroArray(newArr, channels);
			this.valpha = typeof obj[channels] === 'number' ? obj[channels] : 1;
		} else if (typeof obj === 'number') {
			// this is always RGB - can be converted later on.
			obj &= 0xFFFFFF;
			this.model = 'rgb';
			this.color = [
				(obj >> 16) & 0xFF,
				(obj >> 8) & 0xFF,
				obj & 0xFF
			];
			this.valpha = 1;
		} else {
			this.valpha = 1;

			var keys = Object.keys(obj);
			if ('alpha' in obj) {
				keys.splice(keys.indexOf('alpha'), 1);
				this.valpha = typeof obj.alpha === 'number' ? obj.alpha : 0;
			}

			var hashedKeys = keys.sort().join('');
			if (!(hashedKeys in hashedModelKeys)) {
				throw new Error('Unable to parse color from object: ' + JSON.stringify(obj));
			}

			this.model = hashedModelKeys[hashedKeys];

			var labels = convert[this.model].labels;
			var color = [];
			for (i = 0; i < labels.length; i++) {
				color.push(obj[labels[i]]);
			}

			this.color = zeroArray(color);
		}

		// perform limitations (clamping, etc.)
		if (limiters[this.model]) {
			channels = convert[this.model].channels;
			for (i = 0; i < channels; i++) {
				var limit = limiters[this.model][i];
				if (limit) {
					this.color[i] = limit(this.color[i]);
				}
			}
		}

		this.valpha = Math.max(0, Math.min(1, this.valpha));

		if (Object.freeze) {
			Object.freeze(this);
		}
	}

	Color.prototype = {
		toString: function () {
			return this.string();
		},

		toJSON: function () {
			return this[this.model]();
		},

		string: function (places) {
			var self = this.model in colorString.to ? this : this.rgb();
			self = self.round(typeof places === 'number' ? places : 1);
			var args = self.valpha === 1 ? self.color : self.color.concat(this.valpha);
			return colorString.to[self.model](args);
		},

		percentString: function (places) {
			var self = this.rgb().round(typeof places === 'number' ? places : 1);
			var args = self.valpha === 1 ? self.color : self.color.concat(this.valpha);
			return colorString.to.rgb.percent(args);
		},

		array: function () {
			return this.valpha === 1 ? this.color.slice() : this.color.concat(this.valpha);
		},

		object: function () {
			var result = {};
			var channels = convert[this.model].channels;
			var labels = convert[this.model].labels;

			for (var i = 0; i < channels; i++) {
				result[labels[i]] = this.color[i];
			}

			if (this.valpha !== 1) {
				result.alpha = this.valpha;
			}

			return result;
		},

		unitArray: function () {
			var rgb = this.rgb().color;
			rgb[0] /= 255;
			rgb[1] /= 255;
			rgb[2] /= 255;

			if (this.valpha !== 1) {
				rgb.push(this.valpha);
			}

			return rgb;
		},

		unitObject: function () {
			var rgb = this.rgb().object();
			rgb.r /= 255;
			rgb.g /= 255;
			rgb.b /= 255;

			if (this.valpha !== 1) {
				rgb.alpha = this.valpha;
			}

			return rgb;
		},

		round: function (places) {
			places = Math.max(places || 0, 0);
			return new Color(this.color.map(roundToPlace(places)).concat(this.valpha), this.model);
		},

		alpha: function (val) {
			if (arguments.length) {
				return new Color(this.color.concat(Math.max(0, Math.min(1, val))), this.model);
			}

			return this.valpha;
		},

		// rgb
		red: getset('rgb', 0, maxfn(255)),
		green: getset('rgb', 1, maxfn(255)),
		blue: getset('rgb', 2, maxfn(255)),

		hue: getset(['hsl', 'hsv', 'hsl', 'hwb', 'hcg'], 0, function (val) { return ((val % 360) + 360) % 360; }), // eslint-disable-line brace-style

		saturationl: getset('hsl', 1, maxfn(100)),
		lightness: getset('hsl', 2, maxfn(100)),

		saturationv: getset('hsv', 1, maxfn(100)),
		value: getset('hsv', 2, maxfn(100)),

		chroma: getset('hcg', 1, maxfn(100)),
		gray: getset('hcg', 2, maxfn(100)),

		white: getset('hwb', 1, maxfn(100)),
		wblack: getset('hwb', 2, maxfn(100)),

		cyan: getset('cmyk', 0, maxfn(100)),
		magenta: getset('cmyk', 1, maxfn(100)),
		yellow: getset('cmyk', 2, maxfn(100)),
		black: getset('cmyk', 3, maxfn(100)),

		x: getset('xyz', 0, maxfn(100)),
		y: getset('xyz', 1, maxfn(100)),
		z: getset('xyz', 2, maxfn(100)),

		l: getset('lab', 0, maxfn(100)),
		a: getset('lab', 1),
		b: getset('lab', 2),

		keyword: function (val) {
			if (arguments.length) {
				return new Color(val);
			}

			return convert[this.model].keyword(this.color);
		},

		hex: function (val) {
			if (arguments.length) {
				return new Color(val);
			}

			return colorString.to.hex(this.rgb().round().color);
		},

		rgbNumber: function () {
			var rgb = this.rgb().color;
			return ((rgb[0] & 0xFF) << 16) | ((rgb[1] & 0xFF) << 8) | (rgb[2] & 0xFF);
		},

		luminosity: function () {
			// http://www.w3.org/TR/WCAG20/#relativeluminancedef
			var rgb = this.rgb().color;

			var lum = [];
			for (var i = 0; i < rgb.length; i++) {
				var chan = rgb[i] / 255;
				lum[i] = (chan <= 0.03928) ? chan / 12.92 : Math.pow(((chan + 0.055) / 1.055), 2.4);
			}

			return 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2];
		},

		contrast: function (color2) {
			// http://www.w3.org/TR/WCAG20/#contrast-ratiodef
			var lum1 = this.luminosity();
			var lum2 = color2.luminosity();

			if (lum1 > lum2) {
				return (lum1 + 0.05) / (lum2 + 0.05);
			}

			return (lum2 + 0.05) / (lum1 + 0.05);
		},

		level: function (color2) {
			var contrastRatio = this.contrast(color2);
			if (contrastRatio >= 7.1) {
				return 'AAA';
			}

			return (contrastRatio >= 4.5) ? 'AA' : '';
		},

		isDark: function () {
			// YIQ equation from http://24ways.org/2010/calculating-color-contrast
			var rgb = this.rgb().color;
			var yiq = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
			return yiq < 128;
		},

		isLight: function () {
			return !this.isDark();
		},

		negate: function () {
			var rgb = this.rgb();
			for (var i = 0; i < 3; i++) {
				rgb.color[i] = 255 - rgb.color[i];
			}
			return rgb;
		},

		lighten: function (ratio) {
			var hsl = this.hsl();
			hsl.color[2] += hsl.color[2] * ratio;
			return hsl;
		},

		darken: function (ratio) {
			var hsl = this.hsl();
			hsl.color[2] -= hsl.color[2] * ratio;
			return hsl;
		},

		saturate: function (ratio) {
			var hsl = this.hsl();
			hsl.color[1] += hsl.color[1] * ratio;
			return hsl;
		},

		desaturate: function (ratio) {
			var hsl = this.hsl();
			hsl.color[1] -= hsl.color[1] * ratio;
			return hsl;
		},

		whiten: function (ratio) {
			var hwb = this.hwb();
			hwb.color[1] += hwb.color[1] * ratio;
			return hwb;
		},

		blacken: function (ratio) {
			var hwb = this.hwb();
			hwb.color[2] += hwb.color[2] * ratio;
			return hwb;
		},

		grayscale: function () {
			// http://en.wikipedia.org/wiki/Grayscale#Converting_color_to_grayscale
			var rgb = this.rgb().color;
			var val = rgb[0] * 0.3 + rgb[1] * 0.59 + rgb[2] * 0.11;
			return Color.rgb(val, val, val);
		},

		fade: function (ratio) {
			return this.alpha(this.valpha - (this.valpha * ratio));
		},

		opaquer: function (ratio) {
			return this.alpha(this.valpha + (this.valpha * ratio));
		},

		rotate: function (degrees) {
			var hsl = this.hsl();
			var hue = hsl.color[0];
			hue = (hue + degrees) % 360;
			hue = hue < 0 ? 360 + hue : hue;
			hsl.color[0] = hue;
			return hsl;
		},

		mix: function (mixinColor, weight) {
			// ported from sass implementation in C
			// https://github.com/sass/libsass/blob/0e6b4a2850092356aa3ece07c6b249f0221caced/functions.cpp#L209
			if (!mixinColor || !mixinColor.rgb) {
				throw new Error('Argument to "mix" was not a Color instance, but rather an instance of ' + typeof mixinColor);
			}
			var color1 = mixinColor.rgb();
			var color2 = this.rgb();
			var p = weight === undefined ? 0.5 : weight;

			var w = 2 * p - 1;
			var a = color1.alpha() - color2.alpha();

			var w1 = (((w * a === -1) ? w : (w + a) / (1 + w * a)) + 1) / 2.0;
			var w2 = 1 - w1;

			return Color.rgb(
					w1 * color1.red() + w2 * color2.red(),
					w1 * color1.green() + w2 * color2.green(),
					w1 * color1.blue() + w2 * color2.blue(),
					color1.alpha() * p + color2.alpha() * (1 - p));
		}
	};

	// model conversion methods and static constructors
	Object.keys(convert).forEach(function (model) {
		if (skippedModels.indexOf(model) !== -1) {
			return;
		}

		var channels = convert[model].channels;

		// conversion methods
		Color.prototype[model] = function () {
			if (this.model === model) {
				return new Color(this);
			}

			if (arguments.length) {
				return new Color(arguments, model);
			}

			var newAlpha = typeof arguments[channels] === 'number' ? channels : this.valpha;
			return new Color(assertArray(convert[this.model][model].raw(this.color)).concat(newAlpha), model);
		};

		// 'static' construction methods
		Color[model] = function (color) {
			if (typeof color === 'number') {
				color = zeroArray(_slice.call(arguments), channels);
			}
			return new Color(color, model);
		};
	});

	function roundTo(num, places) {
		return Number(num.toFixed(places));
	}

	function roundToPlace(places) {
		return function (num) {
			return roundTo(num, places);
		};
	}

	function getset(model, channel, modifier) {
		model = Array.isArray(model) ? model : [model];

		model.forEach(function (m) {
			(limiters[m] || (limiters[m] = []))[channel] = modifier;
		});

		model = model[0];

		return function (val) {
			var result;

			if (arguments.length) {
				if (modifier) {
					val = modifier(val);
				}

				result = this[model]();
				result.color[channel] = val;
				return result;
			}

			result = this[model]().color[channel];
			if (modifier) {
				result = modifier(result);
			}

			return result;
		};
	}

	function maxfn(max) {
		return function (v) {
			return Math.max(0, Math.min(max, v));
		};
	}

	function assertArray(val) {
		return Array.isArray(val) ? val : [val];
	}

	function zeroArray(arr, length) {
		for (var i = 0; i < length; i++) {
			if (typeof arr[i] !== 'number') {
				arr[i] = 0;
			}
		}

		return arr;
	}

	color = Color;
	return color;
}

var textHex;
var hasRequiredTextHex;

function requireTextHex () {
	if (hasRequiredTextHex) return textHex;
	hasRequiredTextHex = 1;

	/***
	 * Convert string to hex color.
	 *
	 * @param {String} str Text to hash and convert to hex.
	 * @returns {String}
	 * @api public
	 */
	textHex = function hex(str) {
	  for (
	    var i = 0, hash = 0;
	    i < str.length;
	    hash = str.charCodeAt(i++) + ((hash << 5) - hash)
	  );

	  var color = Math.floor(
	    Math.abs(
	      (Math.sin(hash) * 10000) % 1 * 16777216
	    )
	  ).toString(16);

	  return '#' + Array(6 - color.length + 1).join('0') + color;
	};
	return textHex;
}

var colorspace;
var hasRequiredColorspace;

function requireColorspace () {
	if (hasRequiredColorspace) return colorspace;
	hasRequiredColorspace = 1;

	var color = requireColor()
	  , hex = requireTextHex();

	/**
	 * Generate a color for a given name. But be reasonably smart about it by
	 * understanding name spaces and coloring each namespace a bit lighter so they
	 * still have the same base color as the root.
	 *
	 * @param {string} namespace The namespace
	 * @param {string} [delimiter] The delimiter
	 * @returns {string} color
	 */
	colorspace = function colorspace(namespace, delimiter) {
	  var split = namespace.split(delimiter || ':');
	  var base = hex(split[0]);

	  if (!split.length) return base;

	  for (var i = 0, l = split.length - 1; i < l; i++) {
	    base = color(base)
	    .mix(color(hex(split[i + 1])))
	    .saturate(1)
	    .hex();
	  }

	  return base;
	};
	return colorspace;
}

var kuler;
var hasRequiredKuler;

function requireKuler () {
	if (hasRequiredKuler) return kuler;
	hasRequiredKuler = 1;

	/**
	 * Kuler: Color text using CSS colors
	 *
	 * @constructor
	 * @param {String} text The text that needs to be styled
	 * @param {String} color Optional color for alternate API.
	 * @api public
	 */
	function Kuler(text, color) {
	  if (color) return (new Kuler(text)).style(color);
	  if (!(this instanceof Kuler)) return new Kuler(text);

	  this.text = text;
	}

	/**
	 * ANSI color codes.
	 *
	 * @type {String}
	 * @private
	 */
	Kuler.prototype.prefix = '\x1b[';
	Kuler.prototype.suffix = 'm';

	/**
	 * Parse a hex color string and parse it to it's RGB equiv.
	 *
	 * @param {String} color
	 * @returns {Array}
	 * @api private
	 */
	Kuler.prototype.hex = function hex(color) {
	  color = color[0] === '#' ? color.substring(1) : color;

	  //
	  // Pre-parse for shorthand hex colors.
	  //
	  if (color.length === 3) {
	    color = color.split('');

	    color[5] = color[2]; // F60##0
	    color[4] = color[2]; // F60#00
	    color[3] = color[1]; // F60600
	    color[2] = color[1]; // F66600
	    color[1] = color[0]; // FF6600

	    color = color.join('');
	  }

	  var r = color.substring(0, 2)
	    , g = color.substring(2, 4)
	    , b = color.substring(4, 6);

	  return [ parseInt(r, 16), parseInt(g, 16), parseInt(b, 16) ];
	};

	/**
	 * Transform a 255 RGB value to an RGV code.
	 *
	 * @param {Number} r Red color channel.
	 * @param {Number} g Green color channel.
	 * @param {Number} b Blue color channel.
	 * @returns {String}
	 * @api public
	 */
	Kuler.prototype.rgb = function rgb(r, g, b) {
	  var red = r / 255 * 5
	    , green = g / 255 * 5
	    , blue = b / 255 * 5;

	  return this.ansi(red, green, blue);
	};

	/**
	 * Turns RGB 0-5 values into a single ANSI code.
	 *
	 * @param {Number} r Red color channel.
	 * @param {Number} g Green color channel.
	 * @param {Number} b Blue color channel.
	 * @returns {String}
	 * @api public
	 */
	Kuler.prototype.ansi = function ansi(r, g, b) {
	  var red = Math.round(r)
	    , green = Math.round(g)
	    , blue = Math.round(b);

	  return 16 + (red * 36) + (green * 6) + blue;
	};

	/**
	 * Marks an end of color sequence.
	 *
	 * @returns {String} Reset sequence.
	 * @api public
	 */
	Kuler.prototype.reset = function reset() {
	  return this.prefix +'39;49'+ this.suffix;
	};

	/**
	 * Colour the terminal using CSS.
	 *
	 * @param {String} color The HEX color code.
	 * @returns {String} the escape code.
	 * @api public
	 */
	Kuler.prototype.style = function style(color) {
	  return this.prefix +'38;5;'+ this.rgb.apply(this, this.hex(color)) + this.suffix + this.text + this.reset();
	};


	//
	// Expose the actual interface.
	//
	kuler = Kuler;
	return kuler;
}

var namespaceAnsi;
var hasRequiredNamespaceAnsi;

function requireNamespaceAnsi () {
	if (hasRequiredNamespaceAnsi) return namespaceAnsi;
	hasRequiredNamespaceAnsi = 1;
	var colorspace = requireColorspace();
	var kuler = requireKuler();

	/**
	 * Prefix the messages with a colored namespace.
	 *
	 * @param {Array} args The messages array that is getting written.
	 * @param {Object} options Options for diagnostics.
	 * @returns {Array} Altered messages array.
	 * @public
	 */
	namespaceAnsi = function ansiModifier(args, options) {
	  var namespace = options.namespace;
	  var ansi = options.colors !== false
	  ? kuler(namespace +':', colorspace(namespace))
	  : namespace +':';

	  args[0] = ansi +' '+ args[0];
	  return args;
	};
	return namespaceAnsi;
}

var enabled;
var hasRequiredEnabled;

function requireEnabled () {
	if (hasRequiredEnabled) return enabled;
	hasRequiredEnabled = 1;

	/**
	 * Checks if a given namespace is allowed by the given variable.
	 *
	 * @param {String} name namespace that should be included.
	 * @param {String} variable Value that needs to be tested.
	 * @returns {Boolean} Indication if namespace is enabled.
	 * @public
	 */
	enabled = function enabled(name, variable) {
	  if (!variable) return false;

	  var variables = variable.split(/[\s,]+/)
	    , i = 0;

	  for (; i < variables.length; i++) {
	    variable = variables[i].replace('*', '.*?');

	    if ('-' === variable.charAt(0)) {
	      if ((new RegExp('^'+ variable.substr(1) +'$')).test(name)) {
	        return false;
	      }

	      continue;
	    }

	    if ((new RegExp('^'+ variable +'$')).test(name)) {
	      return true;
	    }
	  }

	  return false;
	};
	return enabled;
}

var adapters;
var hasRequiredAdapters;

function requireAdapters () {
	if (hasRequiredAdapters) return adapters;
	hasRequiredAdapters = 1;
	var enabled = requireEnabled();

	/**
	 * Creates a new Adapter.
	 *
	 * @param {Function} fn Function that returns the value.
	 * @returns {Function} The adapter logic.
	 * @public
	 */
	adapters = function create(fn) {
	  return function adapter(namespace) {
	    try {
	      return enabled(namespace, fn());
	    } catch (e) { /* Any failure means that we found nothing */ }

	    return false;
	  };
	};
	return adapters;
}

var process_env;
var hasRequiredProcess_env;

function requireProcess_env () {
	if (hasRequiredProcess_env) return process_env;
	hasRequiredProcess_env = 1;
	var adapter = requireAdapters();

	/**
	 * Extracts the values from process.env.
	 *
	 * @type {Function}
	 * @public
	 */
	process_env = adapter(function processenv() {
	  return process.env.DEBUG || process.env.DIAGNOSTICS;
	});
	return process_env;
}

/**
 * An idiot proof logger to be used as default. We've wrapped it in a try/catch
 * statement to ensure the environments without the `console` API do not crash
 * as well as an additional fix for ancient browsers like IE8 where the
 * `console.log` API doesn't have an `apply`, so we need to use the Function's
 * apply functionality to apply the arguments.
 *
 * @param {Object} meta Options of the logger.
 * @param {Array} messages The actuall message that needs to be logged.
 * @public
 */

var console_1;
var hasRequiredConsole;

function requireConsole () {
	if (hasRequiredConsole) return console_1;
	hasRequiredConsole = 1;
	console_1 = function (meta, messages) {
	  //
	  // So yea. IE8 doesn't have an apply so we need a work around to puke the
	  // arguments in place.
	  //
	  try { Function.prototype.apply.call(console.log, console, messages); }
	  catch (e) {}
	};
	return console_1;
}

var development;
var hasRequiredDevelopment;

function requireDevelopment () {
	if (hasRequiredDevelopment) return development;
	hasRequiredDevelopment = 1;
	var create = requireDiagnostics();
	var tty = require$$1__default["default"].isatty(1);

	/**
	 * Create a new diagnostics logger.
	 *
	 * @param {String} namespace The namespace it should enable.
	 * @param {Object} options Additional options.
	 * @returns {Function} The logger.
	 * @public
	 */
	var diagnostics = create(function dev(namespace, options) {
	  options = options || {};
	  options.colors = 'colors' in options ? options.colors : tty;
	  options.namespace = namespace;
	  options.prod = false;
	  options.dev = true;

	  if (!dev.enabled(namespace) && !(options.force || dev.force)) {
	    return dev.nope(options);
	  }
	  
	  return dev.yep(options);
	});

	//
	// Configure the logger for the given environment.
	//
	diagnostics.modify(requireNamespaceAnsi());
	diagnostics.use(requireProcess_env());
	diagnostics.set(requireConsole());

	//
	// Expose the diagnostics logger.
	//
	development = diagnostics;
	return development;
}

(function (module) {
	//
	// Select the correct build version depending on the environment.
	//
	if (process.env.NODE_ENV === 'production') {
	  module.exports = requireProduction();
	} else {
	  module.exports = requireDevelopment();
	}
} (node));

/**
 * tail-file.js: TODO: add file header description.
 *
 * (C) 2010 Charlie Robbins
 * MIT LICENCE
 */

var tailFile;
var hasRequiredTailFile;

function requireTailFile () {
	if (hasRequiredTailFile) return tailFile;
	hasRequiredTailFile = 1;

	const fs = require$$0__default$5["default"];
	const { StringDecoder } = requireString_decoder();
	const { Stream } = readableExports;

	/**
	 * Simple no-op function.
	 * @returns {undefined}
	 */
	function noop() {}

	/**
	 * TODO: add function description.
	 * @param {Object} options - Options for tail.
	 * @param {function} iter - Iterator function to execute on every line.
	* `tail -f` a file. Options must include file.
	 * @returns {mixed} - TODO: add return description.
	 */
	tailFile = (options, iter) => {
	  const buffer = Buffer.alloc(64 * 1024);
	  const decode = new StringDecoder('utf8');
	  const stream = new Stream();
	  let buff = '';
	  let pos = 0;
	  let row = 0;

	  if (options.start === -1) {
	    delete options.start;
	  }

	  stream.readable = true;
	  stream.destroy = () => {
	    stream.destroyed = true;
	    stream.emit('end');
	    stream.emit('close');
	  };

	  fs.open(options.file, 'a+', '0644', (err, fd) => {
	    if (err) {
	      if (!iter) {
	        stream.emit('error', err);
	      } else {
	        iter(err);
	      }
	      stream.destroy();
	      return;
	    }

	    (function read() {
	      if (stream.destroyed) {
	        fs.close(fd, noop);
	        return;
	      }

	      return fs.read(fd, buffer, 0, buffer.length, pos, (error, bytes) => {
	        if (error) {
	          if (!iter) {
	            stream.emit('error', error);
	          } else {
	            iter(error);
	          }
	          stream.destroy();
	          return;
	        }

	        if (!bytes) {
	          if (buff) {
	            // eslint-disable-next-line eqeqeq
	            if (options.start == null || row > options.start) {
	              if (!iter) {
	                stream.emit('line', buff);
	              } else {
	                iter(null, buff);
	              }
	            }
	            row++;
	            buff = '';
	          }
	          return setTimeout(read, 1000);
	        }

	        let data = decode.write(buffer.slice(0, bytes));
	        if (!iter) {
	          stream.emit('data', data);
	        }

	        data = (buff + data).split(/\n+/);

	        const l = data.length - 1;
	        let i = 0;

	        for (; i < l; i++) {
	          // eslint-disable-next-line eqeqeq
	          if (options.start == null || row > options.start) {
	            if (!iter) {
	              stream.emit('line', data[i]);
	            } else {
	              iter(null, data[i]);
	            }
	          }
	          row++;
	        }

	        buff = data[l];
	        pos += bytes;
	        return read();
	      });
	    }());
	  });

	  if (!iter) {
	    return stream;
	  }

	  return stream.destroy;
	};
	return tailFile;
}

/* eslint-disable complexity,max-statements */

var file;
var hasRequiredFile;

function requireFile () {
	if (hasRequiredFile) return file;
	hasRequiredFile = 1;

	const fs = require$$0__default$5["default"];
	const path = require$$1__default$1["default"];
	const asyncSeries = requireSeries();
	const zlib = require$$3__default["default"];
	const { MESSAGE } = tripleBeam;
	const { Stream, PassThrough } = readableExports;
	const TransportStream = requireWinstonTransport();
	const debug = nodeExports('winston:file');
	const os = require$$0__default["default"];
	const tailFile = requireTailFile();

	/**
	 * Transport for outputting to a local log file.
	 * @type {File}
	 * @extends {TransportStream}
	 */
	file = class File extends TransportStream {
	  /**
	   * Constructor function for the File transport object responsible for
	   * persisting log messages and metadata to one or more files.
	   * @param {Object} options - Options for this instance.
	   */
	  constructor(options = {}) {
	    super(options);

	    // Expose the name of this Transport on the prototype.
	    this.name = options.name || 'file';

	    // Helper function which throws an `Error` in the event that any of the
	    // rest of the arguments is present in `options`.
	    function throwIf(target, ...args) {
	      args.slice(1).forEach(name => {
	        if (options[name]) {
	          throw new Error(`Cannot set ${name} and ${target} together`);
	        }
	      });
	    }

	    // Setup the base stream that always gets piped to to handle buffering.
	    this._stream = new PassThrough();
	    this._stream.setMaxListeners(30);

	    // Bind this context for listener methods.
	    this._onError = this._onError.bind(this);

	    if (options.filename || options.dirname) {
	      throwIf('filename or dirname', 'stream');
	      this._basename = this.filename = options.filename
	        ? path.basename(options.filename)
	        : 'winston.log';

	      this.dirname = options.dirname || path.dirname(options.filename);
	      this.options = options.options || { flags: 'a' };
	    } else if (options.stream) {
	      // eslint-disable-next-line no-console
	      console.warn('options.stream will be removed in winston@4. Use winston.transports.Stream');
	      throwIf('stream', 'filename', 'maxsize');
	      this._dest = this._stream.pipe(this._setupStream(options.stream));
	      this.dirname = path.dirname(this._dest.path);
	      // We need to listen for drain events when write() returns false. This
	      // can make node mad at times.
	    } else {
	      throw new Error('Cannot log to file without filename or stream.');
	    }

	    this.maxsize = options.maxsize || null;
	    this.rotationFormat = options.rotationFormat || false;
	    this.zippedArchive = options.zippedArchive || false;
	    this.maxFiles = options.maxFiles || null;
	    this.eol = (typeof options.eol === 'string') ? options.eol : os.EOL;
	    this.tailable = options.tailable || false;

	    // Internal state variables representing the number of files this instance
	    // has created and the current size (in bytes) of the current logfile.
	    this._size = 0;
	    this._pendingSize = 0;
	    this._created = 0;
	    this._drain = false;
	    this._opening = false;
	    this._ending = false;

	    if (this.dirname) this._createLogDirIfNotExist(this.dirname);
	    this.open();
	  }

	  finishIfEnding() {
	    if (this._ending) {
	      if (this._opening) {
	        this.once('open', () => {
	          this._stream.once('finish', () => this.emit('finish'));
	          setImmediate(() => this._stream.end());
	        });
	      } else {
	        this._stream.once('finish', () => this.emit('finish'));
	        setImmediate(() => this._stream.end());
	      }
	    }
	  }


	  /**
	   * Core logging method exposed to Winston. Metadata is optional.
	   * @param {Object} info - TODO: add param description.
	   * @param {Function} callback - TODO: add param description.
	   * @returns {undefined}
	   */
	  log(info, callback = () => {}) {
	    // Remark: (jcrugzz) What is necessary about this callback(null, true) now
	    // when thinking about 3.x? Should silent be handled in the base
	    // TransportStream _write method?
	    if (this.silent) {
	      callback();
	      return true;
	    }

	    // Output stream buffer is full and has asked us to wait for the drain event
	    if (this._drain) {
	      this._stream.once('drain', () => {
	        this._drain = false;
	        this.log(info, callback);
	      });
	      return;
	    }
	    if (this._rotate) {
	      this._stream.once('rotate', () => {
	        this._rotate = false;
	        this.log(info, callback);
	      });
	      return;
	    }

	    // Grab the raw string and append the expected EOL.
	    const output = `${info[MESSAGE]}${this.eol}`;
	    const bytes = Buffer.byteLength(output);

	    // After we have written to the PassThrough check to see if we need
	    // to rotate to the next file.
	    //
	    // Remark: This gets called too early and does not depict when data
	    // has been actually flushed to disk.
	    function logged() {
	      this._size += bytes;
	      this._pendingSize -= bytes;

	      debug('logged %s %s', this._size, output);
	      this.emit('logged', info);

	      // Do not attempt to rotate files while opening
	      if (this._opening) {
	        return;
	      }

	      // Check to see if we need to end the stream and create a new one.
	      if (!this._needsNewFile()) {
	        return;
	      }

	      // End the current stream, ensure it flushes and create a new one.
	      // This could potentially be optimized to not run a stat call but its
	      // the safest way since we are supporting `maxFiles`.
	      this._rotate = true;
	      this._endStream(() => this._rotateFile());
	    }

	    // Keep track of the pending bytes being written while files are opening
	    // in order to properly rotate the PassThrough this._stream when the file
	    // eventually does open.
	    this._pendingSize += bytes;
	    if (this._opening
	      && !this.rotatedWhileOpening
	      && this._needsNewFile(this._size + this._pendingSize)) {
	      this.rotatedWhileOpening = true;
	    }

	    const written = this._stream.write(output, logged.bind(this));
	    if (!written) {
	      this._drain = true;
	      this._stream.once('drain', () => {
	        this._drain = false;
	        callback();
	      });
	    } else {
	      callback(); // eslint-disable-line callback-return
	    }

	    debug('written', written, this._drain);

	    this.finishIfEnding();

	    return written;
	  }

	  /**
	   * Query the transport. Options object is optional.
	   * @param {Object} options - Loggly-like query options for this instance.
	   * @param {function} callback - Continuation to respond to when complete.
	   * TODO: Refactor me.
	   */
	  query(options, callback) {
	    if (typeof options === 'function') {
	      callback = options;
	      options = {};
	    }

	    options = normalizeQuery(options);
	    const file = path.join(this.dirname, this.filename);
	    let buff = '';
	    let results = [];
	    let row = 0;

	    const stream = fs.createReadStream(file, {
	      encoding: 'utf8'
	    });

	    stream.on('error', err => {
	      if (stream.readable) {
	        stream.destroy();
	      }
	      if (!callback) {
	        return;
	      }

	      return err.code !== 'ENOENT' ? callback(err) : callback(null, results);
	    });

	    stream.on('data', data => {
	      data = (buff + data).split(/\n+/);
	      const l = data.length - 1;
	      let i = 0;

	      for (; i < l; i++) {
	        if (!options.start || row >= options.start) {
	          add(data[i]);
	        }
	        row++;
	      }

	      buff = data[l];
	    });

	    stream.on('close', () => {
	      if (buff) {
	        add(buff, true);
	      }
	      if (options.order === 'desc') {
	        results = results.reverse();
	      }

	      // eslint-disable-next-line callback-return
	      if (callback) callback(null, results);
	    });

	    function add(buff, attempt) {
	      try {
	        const log = JSON.parse(buff);
	        if (check(log)) {
	          push(log);
	        }
	      } catch (e) {
	        if (!attempt) {
	          stream.emit('error', e);
	        }
	      }
	    }

	    function push(log) {
	      if (
	        options.rows &&
	        results.length >= options.rows &&
	        options.order !== 'desc'
	      ) {
	        if (stream.readable) {
	          stream.destroy();
	        }
	        return;
	      }

	      if (options.fields) {
	        log = options.fields.reduce((obj, key) => {
	          obj[key] = log[key];
	          return obj;
	        }, {});
	      }

	      if (options.order === 'desc') {
	        if (results.length >= options.rows) {
	          results.shift();
	        }
	      }
	      results.push(log);
	    }

	    function check(log) {
	      if (!log) {
	        return;
	      }

	      if (typeof log !== 'object') {
	        return;
	      }

	      const time = new Date(log.timestamp);
	      if (
	        (options.from && time < options.from) ||
	        (options.until && time > options.until) ||
	        (options.level && options.level !== log.level)
	      ) {
	        return;
	      }

	      return true;
	    }

	    function normalizeQuery(options) {
	      options = options || {};

	      // limit
	      options.rows = options.rows || options.limit || 10;

	      // starting row offset
	      options.start = options.start || 0;

	      // now
	      options.until = options.until || new Date();
	      if (typeof options.until !== 'object') {
	        options.until = new Date(options.until);
	      }

	      // now - 24
	      options.from = options.from || (options.until - (24 * 60 * 60 * 1000));
	      if (typeof options.from !== 'object') {
	        options.from = new Date(options.from);
	      }

	      // 'asc' or 'desc'
	      options.order = options.order || 'desc';

	      return options;
	    }
	  }

	  /**
	   * Returns a log stream for this transport. Options object is optional.
	   * @param {Object} options - Stream options for this instance.
	   * @returns {Stream} - TODO: add return description.
	   * TODO: Refactor me.
	   */
	  stream(options = {}) {
	    const file = path.join(this.dirname, this.filename);
	    const stream = new Stream();
	    const tail = {
	      file,
	      start: options.start
	    };

	    stream.destroy = tailFile(tail, (err, line) => {
	      if (err) {
	        return stream.emit('error', err);
	      }

	      try {
	        stream.emit('data', line);
	        line = JSON.parse(line);
	        stream.emit('log', line);
	      } catch (e) {
	        stream.emit('error', e);
	      }
	    });

	    return stream;
	  }

	  /**
	   * Checks to see the filesize of.
	   * @returns {undefined}
	   */
	  open() {
	    // If we do not have a filename then we were passed a stream and
	    // don't need to keep track of size.
	    if (!this.filename) return;
	    if (this._opening) return;

	    this._opening = true;

	    // Stat the target file to get the size and create the stream.
	    this.stat((err, size) => {
	      if (err) {
	        return this.emit('error', err);
	      }
	      debug('stat done: %s { size: %s }', this.filename, size);
	      this._size = size;
	      this._dest = this._createStream(this._stream);
	      this._opening = false;
	      this.once('open', () => {
	        if (this._stream.eventNames().includes('rotate')) {
	          this._stream.emit('rotate');
	        } else {
	          this._rotate = false;
	        }
	      });
	    });
	  }

	  /**
	   * Stat the file and assess information in order to create the proper stream.
	   * @param {function} callback - TODO: add param description.
	   * @returns {undefined}
	   */
	  stat(callback) {
	    const target = this._getFile();
	    const fullpath = path.join(this.dirname, target);

	    fs.stat(fullpath, (err, stat) => {
	      if (err && err.code === 'ENOENT') {
	        debug('ENOENT ok', fullpath);
	        // Update internally tracked filename with the new target name.
	        this.filename = target;
	        return callback(null, 0);
	      }

	      if (err) {
	        debug(`err ${err.code} ${fullpath}`);
	        return callback(err);
	      }

	      if (!stat || this._needsNewFile(stat.size)) {
	        // If `stats.size` is greater than the `maxsize` for this
	        // instance then try again.
	        return this._incFile(() => this.stat(callback));
	      }

	      // Once we have figured out what the filename is, set it
	      // and return the size.
	      this.filename = target;
	      callback(null, stat.size);
	    });
	  }

	  /**
	   * Closes the stream associated with this instance.
	   * @param {function} cb - TODO: add param description.
	   * @returns {undefined}
	   */
	  close(cb) {
	    if (!this._stream) {
	      return;
	    }

	    this._stream.end(() => {
	      if (cb) {
	        cb(); // eslint-disable-line callback-return
	      }
	      this.emit('flush');
	      this.emit('closed');
	    });
	  }

	  /**
	   * TODO: add method description.
	   * @param {number} size - TODO: add param description.
	   * @returns {undefined}
	   */
	  _needsNewFile(size) {
	    size = size || this._size;
	    return this.maxsize && size >= this.maxsize;
	  }

	  /**
	   * TODO: add method description.
	   * @param {Error} err - TODO: add param description.
	   * @returns {undefined}
	   */
	  _onError(err) {
	    this.emit('error', err);
	  }

	  /**
	   * TODO: add method description.
	   * @param {Stream} stream - TODO: add param description.
	   * @returns {mixed} - TODO: add return description.
	   */
	  _setupStream(stream) {
	    stream.on('error', this._onError);

	    return stream;
	  }

	  /**
	   * TODO: add method description.
	   * @param {Stream} stream - TODO: add param description.
	   * @returns {mixed} - TODO: add return description.
	   */
	  _cleanupStream(stream) {
	    stream.removeListener('error', this._onError);

	    return stream;
	  }

	  /**
	   * TODO: add method description.
	   */
	  _rotateFile() {
	    this._incFile(() => this.open());
	  }

	  /**
	   * Unpipe from the stream that has been marked as full and end it so it
	   * flushes to disk.
	   *
	   * @param {function} callback - Callback for when the current file has closed.
	   * @private
	   */
	  _endStream(callback = () => {}) {
	    if (this._dest) {
	      this._stream.unpipe(this._dest);
	      this._dest.end(() => {
	        this._cleanupStream(this._dest);
	        callback();
	      });
	    } else {
	      callback(); // eslint-disable-line callback-return
	    }
	  }

	  /**
	   * Returns the WritableStream for the active file on this instance. If we
	   * should gzip the file then a zlib stream is returned.
	   *
	   * @param {ReadableStream} source – PassThrough to pipe to the file when open.
	   * @returns {WritableStream} Stream that writes to disk for the active file.
	   */
	  _createStream(source) {
	    const fullpath = path.join(this.dirname, this.filename);

	    debug('create stream start', fullpath, this.options);
	    const dest = fs.createWriteStream(fullpath, this.options)
	      // TODO: What should we do with errors here?
	      .on('error', err => debug(err))
	      .on('close', () => debug('close', dest.path, dest.bytesWritten))
	      .on('open', () => {
	        debug('file open ok', fullpath);
	        this.emit('open', fullpath);
	        source.pipe(dest);

	        // If rotation occured during the open operation then we immediately
	        // start writing to a new PassThrough, begin opening the next file
	        // and cleanup the previous source and dest once the source has drained.
	        if (this.rotatedWhileOpening) {
	          this._stream = new PassThrough();
	          this._stream.setMaxListeners(30);
	          this._rotateFile();
	          this.rotatedWhileOpening = false;
	          this._cleanupStream(dest);
	          source.end();
	        }
	      });

	    debug('create stream ok', fullpath);
	    if (this.zippedArchive) {
	      const gzip = zlib.createGzip();
	      gzip.pipe(dest);
	      return gzip;
	    }

	    return dest;
	  }

	  /**
	   * TODO: add method description.
	   * @param {function} callback - TODO: add param description.
	   * @returns {undefined}
	   */
	  _incFile(callback) {
	    debug('_incFile', this.filename);
	    const ext = path.extname(this._basename);
	    const basename = path.basename(this._basename, ext);

	    if (!this.tailable) {
	      this._created += 1;
	      this._checkMaxFilesIncrementing(ext, basename, callback);
	    } else {
	      this._checkMaxFilesTailable(ext, basename, callback);
	    }
	  }

	  /**
	   * Gets the next filename to use for this instance in the case that log
	   * filesizes are being capped.
	   * @returns {string} - TODO: add return description.
	   * @private
	   */
	  _getFile() {
	    const ext = path.extname(this._basename);
	    const basename = path.basename(this._basename, ext);
	    const isRotation = this.rotationFormat
	      ? this.rotationFormat()
	      : this._created;

	    // Caveat emptor (indexzero): rotationFormat() was broken by design When
	    // combined with max files because the set of files to unlink is never
	    // stored.
	    const target = !this.tailable && this._created
	      ? `${basename}${isRotation}${ext}`
	      : `${basename}${ext}`;

	    return this.zippedArchive && !this.tailable
	      ? `${target}.gz`
	      : target;
	  }

	  /**
	   * Increment the number of files created or checked by this instance.
	   * @param {mixed} ext - TODO: add param description.
	   * @param {mixed} basename - TODO: add param description.
	   * @param {mixed} callback - TODO: add param description.
	   * @returns {undefined}
	   * @private
	   */
	  _checkMaxFilesIncrementing(ext, basename, callback) {
	    // Check for maxFiles option and delete file.
	    if (!this.maxFiles || this._created < this.maxFiles) {
	      return setImmediate(callback);
	    }

	    const oldest = this._created - this.maxFiles;
	    const isOldest = oldest !== 0 ? oldest : '';
	    const isZipped = this.zippedArchive ? '.gz' : '';
	    const filePath = `${basename}${isOldest}${ext}${isZipped}`;
	    const target = path.join(this.dirname, filePath);

	    fs.unlink(target, callback);
	  }

	  /**
	   * Roll files forward based on integer, up to maxFiles. e.g. if base if
	   * file.log and it becomes oversized, roll to file1.log, and allow file.log
	   * to be re-used. If file is oversized again, roll file1.log to file2.log,
	   * roll file.log to file1.log, and so on.
	   * @param {mixed} ext - TODO: add param description.
	   * @param {mixed} basename - TODO: add param description.
	   * @param {mixed} callback - TODO: add param description.
	   * @returns {undefined}
	   * @private
	   */
	  _checkMaxFilesTailable(ext, basename, callback) {
	    const tasks = [];
	    if (!this.maxFiles) {
	      return;
	    }

	    // const isZipped = this.zippedArchive ? '.gz' : '';
	    const isZipped = this.zippedArchive ? '.gz' : '';
	    for (let x = this.maxFiles - 1; x > 1; x--) {
	      tasks.push(function (i, cb) {
	        let fileName = `${basename}${(i - 1)}${ext}${isZipped}`;
	        const tmppath = path.join(this.dirname, fileName);

	        fs.exists(tmppath, exists => {
	          if (!exists) {
	            return cb(null);
	          }

	          fileName = `${basename}${i}${ext}${isZipped}`;
	          fs.rename(tmppath, path.join(this.dirname, fileName), cb);
	        });
	      }.bind(this, x));
	    }

	    asyncSeries(tasks, () => {
	      fs.rename(
	        path.join(this.dirname, `${basename}${ext}`),
	        path.join(this.dirname, `${basename}1${ext}${isZipped}`),
	        callback
	      );
	    });
	  }

	  _createLogDirIfNotExist(dirPath) {
	    /* eslint-disable no-sync */
	    if (!fs.existsSync(dirPath)) {
	      fs.mkdirSync(dirPath, { recursive: true });
	    }
	    /* eslint-enable no-sync */
	  }
	};
	return file;
}

/**
 * http.js: Transport for outputting to a json-rpcserver.
 *
 * (C) 2010 Charlie Robbins
 * MIT LICENCE
 */

var http_1;
var hasRequiredHttp;

function requireHttp () {
	if (hasRequiredHttp) return http_1;
	hasRequiredHttp = 1;

	const http = require$$0__default$6["default"];
	const https = https__default["default"];
	const { Stream } = readableExports;
	const TransportStream = requireWinstonTransport();
	const jsonStringify = requireSafeStableStringify();

	/**
	 * Transport for outputting to a json-rpc server.
	 * @type {Stream}
	 * @extends {TransportStream}
	 */
	http_1 = class Http extends TransportStream {
	  /**
	   * Constructor function for the Http transport object responsible for
	   * persisting log messages and metadata to a terminal or TTY.
	   * @param {!Object} [options={}] - Options for this instance.
	   */
	  // eslint-disable-next-line max-statements
	  constructor(options = {}) {
	    super(options);

	    this.options = options;
	    this.name = options.name || 'http';
	    this.ssl = !!options.ssl;
	    this.host = options.host || 'localhost';
	    this.port = options.port;
	    this.auth = options.auth;
	    this.path = options.path || '';
	    this.agent = options.agent;
	    this.headers = options.headers || {};
	    this.headers['content-type'] = 'application/json';
	    this.batch = options.batch || false;
	    this.batchInterval = options.batchInterval || 5000;
	    this.batchCount = options.batchCount || 10;
	    this.batchOptions = [];
	    this.batchTimeoutID = -1;
	    this.batchCallback = {};

	    if (!this.port) {
	      this.port = this.ssl ? 443 : 80;
	    }
	  }

	  /**
	   * Core logging method exposed to Winston.
	   * @param {Object} info - TODO: add param description.
	   * @param {function} callback - TODO: add param description.
	   * @returns {undefined}
	   */
	  log(info, callback) {
	    this._request(info, (err, res) => {
	      if (res && res.statusCode !== 200) {
	        err = new Error(`Invalid HTTP Status Code: ${res.statusCode}`);
	      }

	      if (err) {
	        this.emit('warn', err);
	      } else {
	        this.emit('logged', info);
	      }
	    });

	    // Remark: (jcrugzz) Fire and forget here so requests dont cause buffering
	    // and block more requests from happening?
	    if (callback) {
	      setImmediate(callback);
	    }
	  }

	  /**
	   * Query the transport. Options object is optional.
	   * @param {Object} options -  Loggly-like query options for this instance.
	   * @param {function} callback - Continuation to respond to when complete.
	   * @returns {undefined}
	   */
	  query(options, callback) {
	    if (typeof options === 'function') {
	      callback = options;
	      options = {};
	    }

	    options = {
	      method: 'query',
	      params: this.normalizeQuery(options)
	    };

	    if (options.params.path) {
	      options.path = options.params.path;
	      delete options.params.path;
	    }

	    if (options.params.auth) {
	      options.auth = options.params.auth;
	      delete options.params.auth;
	    }

	    this._request(options, (err, res, body) => {
	      if (res && res.statusCode !== 200) {
	        err = new Error(`Invalid HTTP Status Code: ${res.statusCode}`);
	      }

	      if (err) {
	        return callback(err);
	      }

	      if (typeof body === 'string') {
	        try {
	          body = JSON.parse(body);
	        } catch (e) {
	          return callback(e);
	        }
	      }

	      callback(null, body);
	    });
	  }

	  /**
	   * Returns a log stream for this transport. Options object is optional.
	   * @param {Object} options - Stream options for this instance.
	   * @returns {Stream} - TODO: add return description
	   */
	  stream(options = {}) {
	    const stream = new Stream();
	    options = {
	      method: 'stream',
	      params: options
	    };

	    if (options.params.path) {
	      options.path = options.params.path;
	      delete options.params.path;
	    }

	    if (options.params.auth) {
	      options.auth = options.params.auth;
	      delete options.params.auth;
	    }

	    let buff = '';
	    const req = this._request(options);

	    stream.destroy = () => req.destroy();
	    req.on('data', data => {
	      data = (buff + data).split(/\n+/);
	      const l = data.length - 1;

	      let i = 0;
	      for (; i < l; i++) {
	        try {
	          stream.emit('log', JSON.parse(data[i]));
	        } catch (e) {
	          stream.emit('error', e);
	        }
	      }

	      buff = data[l];
	    });
	    req.on('error', err => stream.emit('error', err));

	    return stream;
	  }

	  /**
	   * Make a request to a winstond server or any http server which can
	   * handle json-rpc.
	   * @param {function} options - Options to sent the request.
	   * @param {function} callback - Continuation to respond to when complete.
	   */
	  _request(options, callback) {
	    options = options || {};

	    const auth = options.auth || this.auth;
	    const path = options.path || this.path || '';

	    delete options.auth;
	    delete options.path;

	    if (this.batch) {
	      this._doBatch(options, callback, auth, path);
	    } else {
	      this._doRequest(options, callback, auth, path);
	    }
	  }

	  /**
	   * Send or memorize the options according to batch configuration
	   * @param {function} options - Options to sent the request.
	   * @param {function} callback - Continuation to respond to when complete.
	   * @param {Object?} auth - authentication options
	   * @param {string} path - request path
	   */
	  _doBatch(options, callback, auth, path) {
	    this.batchOptions.push(options);
	    if (this.batchOptions.length === 1) {
	      // First message stored, it's time to start the timeout!
	      const me = this;
	      this.batchCallback = callback;
	      this.batchTimeoutID = setTimeout(function () {
	        // timeout is reached, send all messages to endpoint
	        me.batchTimeoutID = -1;
	        me._doBatchRequest(me.batchCallback, auth, path);
	      }, this.batchInterval);
	    }
	    if (this.batchOptions.length === this.batchCount) {
	      // max batch count is reached, send all messages to endpoint
	      this._doBatchRequest(this.batchCallback, auth, path);
	    }
	  }

	  /**
	   * Initiate a request with the memorized batch options, stop the batch timeout
	   * @param {function} callback - Continuation to respond to when complete.
	   * @param {Object?} auth - authentication options
	   * @param {string} path - request path
	   */
	  _doBatchRequest(callback, auth, path) {
	    if (this.batchTimeoutID > 0) {
	      clearTimeout(this.batchTimeoutID);
	      this.batchTimeoutID = -1;
	    }
	    const batchOptionsCopy = this.batchOptions.slice();
	    this.batchOptions = [];
	    this._doRequest(batchOptionsCopy, callback, auth, path);
	  }

	  /**
	   * Make a request to a winstond server or any http server which can
	   * handle json-rpc.
	   * @param {function} options - Options to sent the request.
	   * @param {function} callback - Continuation to respond to when complete.
	   * @param {Object?} auth - authentication options
	   * @param {string} path - request path
	   */
	  _doRequest(options, callback, auth, path) {
	    // Prepare options for outgoing HTTP request
	    const headers = Object.assign({}, this.headers);
	    if (auth && auth.bearer) {
	      headers.Authorization = `Bearer ${auth.bearer}`;
	    }
	    const req = (this.ssl ? https : http).request({
	      ...this.options,
	      method: 'POST',
	      host: this.host,
	      port: this.port,
	      path: `/${path.replace(/^\//, '')}`,
	      headers: headers,
	      auth: (auth && auth.username && auth.password) ? (`${auth.username}:${auth.password}`) : '',
	      agent: this.agent
	    });

	    req.on('error', callback);
	    req.on('response', res => (
	      res.on('end', () => callback(null, res)).resume()
	    ));
	    req.end(Buffer.from(jsonStringify(options, this.options.replacer), 'utf8'));
	  }
	};
	return http_1;
}

const isStream$1 = stream =>
	stream !== null &&
	typeof stream === 'object' &&
	typeof stream.pipe === 'function';

isStream$1.writable = stream =>
	isStream$1(stream) &&
	stream.writable !== false &&
	typeof stream._write === 'function' &&
	typeof stream._writableState === 'object';

isStream$1.readable = stream =>
	isStream$1(stream) &&
	stream.readable !== false &&
	typeof stream._read === 'function' &&
	typeof stream._readableState === 'object';

isStream$1.duplex = stream =>
	isStream$1.writable(stream) &&
	isStream$1.readable(stream);

isStream$1.transform = stream =>
	isStream$1.duplex(stream) &&
	typeof stream._transform === 'function';

var isStream_1 = isStream$1;

/**
 * stream.js: Transport for outputting to any arbitrary stream.
 *
 * (C) 2010 Charlie Robbins
 * MIT LICENCE
 */

var stream;
var hasRequiredStream;

function requireStream () {
	if (hasRequiredStream) return stream;
	hasRequiredStream = 1;

	const isStream = isStream_1;
	const { MESSAGE } = tripleBeam;
	const os = require$$0__default["default"];
	const TransportStream = requireWinstonTransport();

	/**
	 * Transport for outputting to any arbitrary stream.
	 * @type {Stream}
	 * @extends {TransportStream}
	 */
	stream = class Stream extends TransportStream {
	  /**
	   * Constructor function for the Console transport object responsible for
	   * persisting log messages and metadata to a terminal or TTY.
	   * @param {!Object} [options={}] - Options for this instance.
	   */
	  constructor(options = {}) {
	    super(options);

	    if (!options.stream || !isStream(options.stream)) {
	      throw new Error('options.stream is required.');
	    }

	    // We need to listen for drain events when write() returns false. This can
	    // make node mad at times.
	    this._stream = options.stream;
	    this._stream.setMaxListeners(Infinity);
	    this.isObjectMode = options.stream._writableState.objectMode;
	    this.eol = (typeof options.eol === 'string') ? options.eol : os.EOL;
	  }

	  /**
	   * Core logging method exposed to Winston.
	   * @param {Object} info - TODO: add param description.
	   * @param {Function} callback - TODO: add param description.
	   * @returns {undefined}
	   */
	  log(info, callback) {
	    setImmediate(() => this.emit('logged', info));
	    if (this.isObjectMode) {
	      this._stream.write(info);
	      if (callback) {
	        callback(); // eslint-disable-line callback-return
	      }
	      return;
	    }

	    this._stream.write(`${info[MESSAGE]}${this.eol}`);
	    if (callback) {
	      callback(); // eslint-disable-line callback-return
	    }
	    return;
	  }
	};
	return stream;
}

/**
 * transports.js: Set of all transports Winston knows about.
 *
 * (C) 2010 Charlie Robbins
 * MIT LICENCE
 */

(function (exports) {

	/**
	 * TODO: add property description.
	 * @type {Console}
	 */
	Object.defineProperty(exports, 'Console', {
	  configurable: true,
	  enumerable: true,
	  get() {
	    return requireConsole$1();
	  }
	});

	/**
	 * TODO: add property description.
	 * @type {File}
	 */
	Object.defineProperty(exports, 'File', {
	  configurable: true,
	  enumerable: true,
	  get() {
	    return requireFile();
	  }
	});

	/**
	 * TODO: add property description.
	 * @type {Http}
	 */
	Object.defineProperty(exports, 'Http', {
	  configurable: true,
	  enumerable: true,
	  get() {
	    return requireHttp();
	  }
	});

	/**
	 * TODO: add property description.
	 * @type {Stream}
	 */
	Object.defineProperty(exports, 'Stream', {
	  configurable: true,
	  enumerable: true,
	  get() {
	    return requireStream();
	  }
	});
} (transports));

var config$2 = {};

/**
 * index.js: Default settings for all levels that winston knows about.
 *
 * (C) 2010 Charlie Robbins
 * MIT LICENCE
 */

const logform = logform$1;
const { configs } = tripleBeam;

/**
 * Export config set for the CLI.
 * @type {Object}
 */
config$2.cli = logform.levels(configs.cli);

/**
 * Export config set for npm.
 * @type {Object}
 */
config$2.npm = logform.levels(configs.npm);

/**
 * Export config set for the syslog.
 * @type {Object}
 */
config$2.syslog = logform.levels(configs.syslog);

/**
 * Hoist addColors from logform where it was refactored into in winston@3.
 * @type {Object}
 */
config$2.addColors = logform.levels;

var forEachExports = {};
var forEach = {
  get exports(){ return forEachExports; },
  set exports(v){ forEachExports = v; },
};

var eachOfExports = {};
var eachOf = {
  get exports(){ return eachOfExports; },
  set exports(v){ eachOfExports = v; },
};

(function (module, exports) {

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});

	var _isArrayLike = isArrayLikeExports;

	var _isArrayLike2 = _interopRequireDefault(_isArrayLike);

	var _breakLoop = breakLoopExports;

	var _breakLoop2 = _interopRequireDefault(_breakLoop);

	var _eachOfLimit = eachOfLimitExports$1;

	var _eachOfLimit2 = _interopRequireDefault(_eachOfLimit);

	var _once = onceExports;

	var _once2 = _interopRequireDefault(_once);

	var _onlyOnce = onlyOnceExports;

	var _onlyOnce2 = _interopRequireDefault(_onlyOnce);

	var _wrapAsync = requireWrapAsync();

	var _wrapAsync2 = _interopRequireDefault(_wrapAsync);

	var _awaitify = awaitifyExports;

	var _awaitify2 = _interopRequireDefault(_awaitify);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	// eachOf implementation optimized for array-likes
	function eachOfArrayLike(coll, iteratee, callback) {
	    callback = (0, _once2.default)(callback);
	    var index = 0,
	        completed = 0,
	        { length } = coll,
	        canceled = false;
	    if (length === 0) {
	        callback(null);
	    }

	    function iteratorCallback(err, value) {
	        if (err === false) {
	            canceled = true;
	        }
	        if (canceled === true) return;
	        if (err) {
	            callback(err);
	        } else if (++completed === length || value === _breakLoop2.default) {
	            callback(null);
	        }
	    }

	    for (; index < length; index++) {
	        iteratee(coll[index], index, (0, _onlyOnce2.default)(iteratorCallback));
	    }
	}

	// a generic version of eachOf which can handle array, object, and iterator cases.
	function eachOfGeneric(coll, iteratee, callback) {
	    return (0, _eachOfLimit2.default)(coll, Infinity, iteratee, callback);
	}

	/**
	 * Like [`each`]{@link module:Collections.each}, except that it passes the key (or index) as the second argument
	 * to the iteratee.
	 *
	 * @name eachOf
	 * @static
	 * @memberOf module:Collections
	 * @method
	 * @alias forEachOf
	 * @category Collection
	 * @see [async.each]{@link module:Collections.each}
	 * @param {Array|Iterable|AsyncIterable|Object} coll - A collection to iterate over.
	 * @param {AsyncFunction} iteratee - A function to apply to each
	 * item in `coll`.
	 * The `key` is the item's key, or index in the case of an array.
	 * Invoked with (item, key, callback).
	 * @param {Function} [callback] - A callback which is called when all
	 * `iteratee` functions have finished, or an error occurs. Invoked with (err).
	 * @returns {Promise} a promise, if a callback is omitted
	 * @example
	 *
	 * // dev.json is a file containing a valid json object config for dev environment
	 * // dev.json is a file containing a valid json object config for test environment
	 * // prod.json is a file containing a valid json object config for prod environment
	 * // invalid.json is a file with a malformed json object
	 *
	 * let configs = {}; //global variable
	 * let validConfigFileMap = {dev: 'dev.json', test: 'test.json', prod: 'prod.json'};
	 * let invalidConfigFileMap = {dev: 'dev.json', test: 'test.json', invalid: 'invalid.json'};
	 *
	 * // asynchronous function that reads a json file and parses the contents as json object
	 * function parseFile(file, key, callback) {
	 *     fs.readFile(file, "utf8", function(err, data) {
	 *         if (err) return calback(err);
	 *         try {
	 *             configs[key] = JSON.parse(data);
	 *         } catch (e) {
	 *             return callback(e);
	 *         }
	 *         callback();
	 *     });
	 * }
	 *
	 * // Using callbacks
	 * async.forEachOf(validConfigFileMap, parseFile, function (err) {
	 *     if (err) {
	 *         console.error(err);
	 *     } else {
	 *         console.log(configs);
	 *         // configs is now a map of JSON data, e.g.
	 *         // { dev: //parsed dev.json, test: //parsed test.json, prod: //parsed prod.json}
	 *     }
	 * });
	 *
	 * //Error handing
	 * async.forEachOf(invalidConfigFileMap, parseFile, function (err) {
	 *     if (err) {
	 *         console.error(err);
	 *         // JSON parse error exception
	 *     } else {
	 *         console.log(configs);
	 *     }
	 * });
	 *
	 * // Using Promises
	 * async.forEachOf(validConfigFileMap, parseFile)
	 * .then( () => {
	 *     console.log(configs);
	 *     // configs is now a map of JSON data, e.g.
	 *     // { dev: //parsed dev.json, test: //parsed test.json, prod: //parsed prod.json}
	 * }).catch( err => {
	 *     console.error(err);
	 * });
	 *
	 * //Error handing
	 * async.forEachOf(invalidConfigFileMap, parseFile)
	 * .then( () => {
	 *     console.log(configs);
	 * }).catch( err => {
	 *     console.error(err);
	 *     // JSON parse error exception
	 * });
	 *
	 * // Using async/await
	 * async () => {
	 *     try {
	 *         let result = await async.forEachOf(validConfigFileMap, parseFile);
	 *         console.log(configs);
	 *         // configs is now a map of JSON data, e.g.
	 *         // { dev: //parsed dev.json, test: //parsed test.json, prod: //parsed prod.json}
	 *     }
	 *     catch (err) {
	 *         console.log(err);
	 *     }
	 * }
	 *
	 * //Error handing
	 * async () => {
	 *     try {
	 *         let result = await async.forEachOf(invalidConfigFileMap, parseFile);
	 *         console.log(configs);
	 *     }
	 *     catch (err) {
	 *         console.log(err);
	 *         // JSON parse error exception
	 *     }
	 * }
	 *
	 */
	function eachOf(coll, iteratee, callback) {
	    var eachOfImplementation = (0, _isArrayLike2.default)(coll) ? eachOfArrayLike : eachOfGeneric;
	    return eachOfImplementation(coll, (0, _wrapAsync2.default)(iteratee), callback);
	}

	exports.default = (0, _awaitify2.default)(eachOf, 3);
	module.exports = exports['default'];
} (eachOf, eachOfExports));

var withoutIndexExports = {};
var withoutIndex = {
  get exports(){ return withoutIndexExports; },
  set exports(v){ withoutIndexExports = v; },
};

(function (module, exports) {

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});
	exports.default = _withoutIndex;
	function _withoutIndex(iteratee) {
	    return (value, index, callback) => iteratee(value, callback);
	}
	module.exports = exports["default"];
} (withoutIndex, withoutIndexExports));

(function (module, exports) {

	Object.defineProperty(exports, "__esModule", {
	  value: true
	});

	var _eachOf = eachOfExports;

	var _eachOf2 = _interopRequireDefault(_eachOf);

	var _withoutIndex = withoutIndexExports;

	var _withoutIndex2 = _interopRequireDefault(_withoutIndex);

	var _wrapAsync = requireWrapAsync();

	var _wrapAsync2 = _interopRequireDefault(_wrapAsync);

	var _awaitify = awaitifyExports;

	var _awaitify2 = _interopRequireDefault(_awaitify);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	/**
	 * Applies the function `iteratee` to each item in `coll`, in parallel.
	 * The `iteratee` is called with an item from the list, and a callback for when
	 * it has finished. If the `iteratee` passes an error to its `callback`, the
	 * main `callback` (for the `each` function) is immediately called with the
	 * error.
	 *
	 * Note, that since this function applies `iteratee` to each item in parallel,
	 * there is no guarantee that the iteratee functions will complete in order.
	 *
	 * @name each
	 * @static
	 * @memberOf module:Collections
	 * @method
	 * @alias forEach
	 * @category Collection
	 * @param {Array|Iterable|AsyncIterable|Object} coll - A collection to iterate over.
	 * @param {AsyncFunction} iteratee - An async function to apply to
	 * each item in `coll`. Invoked with (item, callback).
	 * The array index is not passed to the iteratee.
	 * If you need the index, use `eachOf`.
	 * @param {Function} [callback] - A callback which is called when all
	 * `iteratee` functions have finished, or an error occurs. Invoked with (err).
	 * @returns {Promise} a promise, if a callback is omitted
	 * @example
	 *
	 * // dir1 is a directory that contains file1.txt, file2.txt
	 * // dir2 is a directory that contains file3.txt, file4.txt
	 * // dir3 is a directory that contains file5.txt
	 * // dir4 does not exist
	 *
	 * const fileList = [ 'dir1/file2.txt', 'dir2/file3.txt', 'dir/file5.txt'];
	 * const withMissingFileList = ['dir1/file1.txt', 'dir4/file2.txt'];
	 *
	 * // asynchronous function that deletes a file
	 * const deleteFile = function(file, callback) {
	 *     fs.unlink(file, callback);
	 * };
	 *
	 * // Using callbacks
	 * async.each(fileList, deleteFile, function(err) {
	 *     if( err ) {
	 *         console.log(err);
	 *     } else {
	 *         console.log('All files have been deleted successfully');
	 *     }
	 * });
	 *
	 * // Error Handling
	 * async.each(withMissingFileList, deleteFile, function(err){
	 *     console.log(err);
	 *     // [ Error: ENOENT: no such file or directory ]
	 *     // since dir4/file2.txt does not exist
	 *     // dir1/file1.txt could have been deleted
	 * });
	 *
	 * // Using Promises
	 * async.each(fileList, deleteFile)
	 * .then( () => {
	 *     console.log('All files have been deleted successfully');
	 * }).catch( err => {
	 *     console.log(err);
	 * });
	 *
	 * // Error Handling
	 * async.each(fileList, deleteFile)
	 * .then( () => {
	 *     console.log('All files have been deleted successfully');
	 * }).catch( err => {
	 *     console.log(err);
	 *     // [ Error: ENOENT: no such file or directory ]
	 *     // since dir4/file2.txt does not exist
	 *     // dir1/file1.txt could have been deleted
	 * });
	 *
	 * // Using async/await
	 * async () => {
	 *     try {
	 *         await async.each(files, deleteFile);
	 *     }
	 *     catch (err) {
	 *         console.log(err);
	 *     }
	 * }
	 *
	 * // Error Handling
	 * async () => {
	 *     try {
	 *         await async.each(withMissingFileList, deleteFile);
	 *     }
	 *     catch (err) {
	 *         console.log(err);
	 *         // [ Error: ENOENT: no such file or directory ]
	 *         // since dir4/file2.txt does not exist
	 *         // dir1/file1.txt could have been deleted
	 *     }
	 * }
	 *
	 */
	function eachLimit(coll, iteratee, callback) {
	  return (0, _eachOf2.default)(coll, (0, _withoutIndex2.default)((0, _wrapAsync2.default)(iteratee)), callback);
	}

	exports.default = (0, _awaitify2.default)(eachLimit, 3);
	module.exports = exports['default'];
} (forEach, forEachExports));

var toString = Object.prototype.toString;

/**
 * Extract names from functions.
 *
 * @param {Function} fn The function who's name we need to extract.
 * @returns {String} The name of the function.
 * @public
 */
var fn_name = function name(fn) {
  if ('string' === typeof fn.displayName && fn.constructor.name) {
    return fn.displayName;
  } else if ('string' === typeof fn.name && fn.name) {
    return fn.name;
  }

  //
  // Check to see if the constructor has a name.
  //
  if (
       'object' === typeof fn
    && fn.constructor
    && 'string' === typeof fn.constructor.name
  ) return fn.constructor.name;

  //
  // toString the given function and attempt to parse it out of it, or determine
  // the class.
  //
  var named = fn.toString()
    , type = toString.call(fn).slice(8, -1);

  if ('Function' === type) {
    named = named.substring(named.indexOf('(') + 1, named.indexOf(')'));
  } else {
    named = type;
  }

  return named || 'anonymous';
};

var name = fn_name;

/**
 * Wrap callbacks to prevent double execution.
 *
 * @param {Function} fn Function that should only be called once.
 * @returns {Function} A wrapped callback which prevents multiple executions.
 * @public
 */
var oneTime = function one(fn) {
  var called = 0
    , value;

  /**
   * The function that prevents double execution.
   *
   * @private
   */
  function onetime() {
    if (called) return value;

    called = 1;
    value = fn.apply(this, arguments);
    fn = null;

    return value;
  }

  //
  // To make debugging more easy we want to use the name of the supplied
  // function. So when you look at the functions that are assigned to event
  // listeners you don't see a load of `onetime` functions but actually the
  // names of the functions that this module will call.
  //
  // NOTE: We cannot override the `name` property, as that is `readOnly`
  // property, so displayName will have to do.
  //
  onetime.displayName = name(fn);
  return onetime;
};

var stackTrace$2 = {};

(function (exports) {
	exports.get = function(belowFn) {
	  var oldLimit = Error.stackTraceLimit;
	  Error.stackTraceLimit = Infinity;

	  var dummyObject = {};

	  var v8Handler = Error.prepareStackTrace;
	  Error.prepareStackTrace = function(dummyObject, v8StackTrace) {
	    return v8StackTrace;
	  };
	  Error.captureStackTrace(dummyObject, belowFn || exports.get);

	  var v8StackTrace = dummyObject.stack;
	  Error.prepareStackTrace = v8Handler;
	  Error.stackTraceLimit = oldLimit;

	  return v8StackTrace;
	};

	exports.parse = function(err) {
	  if (!err.stack) {
	    return [];
	  }

	  var self = this;
	  var lines = err.stack.split('\n').slice(1);

	  return lines
	    .map(function(line) {
	      if (line.match(/^\s*[-]{4,}$/)) {
	        return self._createParsedCallSite({
	          fileName: line,
	          lineNumber: null,
	          functionName: null,
	          typeName: null,
	          methodName: null,
	          columnNumber: null,
	          'native': null,
	        });
	      }

	      var lineMatch = line.match(/at (?:(.+)\s+\()?(?:(.+?):(\d+)(?::(\d+))?|([^)]+))\)?/);
	      if (!lineMatch) {
	        return;
	      }

	      var object = null;
	      var method = null;
	      var functionName = null;
	      var typeName = null;
	      var methodName = null;
	      var isNative = (lineMatch[5] === 'native');

	      if (lineMatch[1]) {
	        functionName = lineMatch[1];
	        var methodStart = functionName.lastIndexOf('.');
	        if (functionName[methodStart-1] == '.')
	          methodStart--;
	        if (methodStart > 0) {
	          object = functionName.substr(0, methodStart);
	          method = functionName.substr(methodStart + 1);
	          var objectEnd = object.indexOf('.Module');
	          if (objectEnd > 0) {
	            functionName = functionName.substr(objectEnd + 1);
	            object = object.substr(0, objectEnd);
	          }
	        }
	        typeName = null;
	      }

	      if (method) {
	        typeName = object;
	        methodName = method;
	      }

	      if (method === '<anonymous>') {
	        methodName = null;
	        functionName = null;
	      }

	      var properties = {
	        fileName: lineMatch[2] || null,
	        lineNumber: parseInt(lineMatch[3], 10) || null,
	        functionName: functionName,
	        typeName: typeName,
	        methodName: methodName,
	        columnNumber: parseInt(lineMatch[4], 10) || null,
	        'native': isNative,
	      };

	      return self._createParsedCallSite(properties);
	    })
	    .filter(function(callSite) {
	      return !!callSite;
	    });
	};

	function CallSite(properties) {
	  for (var property in properties) {
	    this[property] = properties[property];
	  }
	}

	var strProperties = [
	  'this',
	  'typeName',
	  'functionName',
	  'methodName',
	  'fileName',
	  'lineNumber',
	  'columnNumber',
	  'function',
	  'evalOrigin'
	];
	var boolProperties = [
	  'topLevel',
	  'eval',
	  'native',
	  'constructor'
	];
	strProperties.forEach(function (property) {
	  CallSite.prototype[property] = null;
	  CallSite.prototype['get' + property[0].toUpperCase() + property.substr(1)] = function () {
	    return this[property];
	  };
	});
	boolProperties.forEach(function (property) {
	  CallSite.prototype[property] = false;
	  CallSite.prototype['is' + property[0].toUpperCase() + property.substr(1)] = function () {
	    return this[property];
	  };
	});

	exports._createParsedCallSite = function(properties) {
	  return new CallSite(properties);
	};
} (stackTrace$2));

/**
 * exception-stream.js: TODO: add file header handler.
 *
 * (C) 2010 Charlie Robbins
 * MIT LICENCE
 */

const { Writable } = readableExports;

/**
 * TODO: add class description.
 * @type {ExceptionStream}
 * @extends {Writable}
 */
var exceptionStream = class ExceptionStream extends Writable {
  /**
   * Constructor function for the ExceptionStream responsible for wrapping a
   * TransportStream; only allowing writes of `info` objects with
   * `info.exception` set to true.
   * @param {!TransportStream} transport - Stream to filter to exceptions
   */
  constructor(transport) {
    super({ objectMode: true });

    if (!transport) {
      throw new Error('ExceptionStream requires a TransportStream instance.');
    }

    // Remark (indexzero): we set `handleExceptions` here because it's the
    // predicate checked in ExceptionHandler.prototype.__getExceptionHandlers
    this.handleExceptions = true;
    this.transport = transport;
  }

  /**
   * Writes the info object to our transport instance if (and only if) the
   * `exception` property is set on the info.
   * @param {mixed} info - TODO: add param description.
   * @param {mixed} enc - TODO: add param description.
   * @param {mixed} callback - TODO: add param description.
   * @returns {mixed} - TODO: add return description.
   * @private
   */
  _write(info, enc, callback) {
    if (info.exception) {
      return this.transport.log(info, callback);
    }

    callback();
    return true;
  }
};

/**
 * exception-handler.js: Object for handling uncaughtException events.
 *
 * (C) 2010 Charlie Robbins
 * MIT LICENCE
 */

const os$1 = require$$0__default["default"];
const asyncForEach$2 = forEachExports;
const debug$2 = nodeExports('winston:exception');
const once$1 = oneTime;
const stackTrace$1 = stackTrace$2;
const ExceptionStream$1 = exceptionStream;

/**
 * Object for handling uncaughtException events.
 * @type {ExceptionHandler}
 */
var exceptionHandler = class ExceptionHandler {
  /**
   * TODO: add contructor description
   * @param {!Logger} logger - TODO: add param description
   */
  constructor(logger) {
    if (!logger) {
      throw new Error('Logger is required to handle exceptions');
    }

    this.logger = logger;
    this.handlers = new Map();
  }

  /**
   * Handles `uncaughtException` events for the current process by adding any
   * handlers passed in.
   * @returns {undefined}
   */
  handle(...args) {
    args.forEach(arg => {
      if (Array.isArray(arg)) {
        return arg.forEach(handler => this._addHandler(handler));
      }

      this._addHandler(arg);
    });

    if (!this.catcher) {
      this.catcher = this._uncaughtException.bind(this);
      process.on('uncaughtException', this.catcher);
    }
  }

  /**
   * Removes any handlers to `uncaughtException` events for the current
   * process. This does not modify the state of the `this.handlers` set.
   * @returns {undefined}
   */
  unhandle() {
    if (this.catcher) {
      process.removeListener('uncaughtException', this.catcher);
      this.catcher = false;

      Array.from(this.handlers.values())
        .forEach(wrapper => this.logger.unpipe(wrapper));
    }
  }

  /**
   * TODO: add method description
   * @param {Error} err - Error to get information about.
   * @returns {mixed} - TODO: add return description.
   */
  getAllInfo(err) {
    let { message } = err;
    if (!message && typeof err === 'string') {
      message = err;
    }

    return {
      error: err,
      // TODO (indexzero): how do we configure this?
      level: 'error',
      message: [
        `uncaughtException: ${(message || '(no error message)')}`,
        err.stack || '  No stack trace'
      ].join('\n'),
      stack: err.stack,
      exception: true,
      date: new Date().toString(),
      process: this.getProcessInfo(),
      os: this.getOsInfo(),
      trace: this.getTrace(err)
    };
  }

  /**
   * Gets all relevant process information for the currently running process.
   * @returns {mixed} - TODO: add return description.
   */
  getProcessInfo() {
    return {
      pid: process.pid,
      uid: process.getuid ? process.getuid() : null,
      gid: process.getgid ? process.getgid() : null,
      cwd: process.cwd(),
      execPath: process.execPath,
      version: process.version,
      argv: process.argv,
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Gets all relevant OS information for the currently running process.
   * @returns {mixed} - TODO: add return description.
   */
  getOsInfo() {
    return {
      loadavg: os$1.loadavg(),
      uptime: os$1.uptime()
    };
  }

  /**
   * Gets a stack trace for the specified error.
   * @param {mixed} err - TODO: add param description.
   * @returns {mixed} - TODO: add return description.
   */
  getTrace(err) {
    const trace = err ? stackTrace$1.parse(err) : stackTrace$1.get();
    return trace.map(site => {
      return {
        column: site.getColumnNumber(),
        file: site.getFileName(),
        function: site.getFunctionName(),
        line: site.getLineNumber(),
        method: site.getMethodName(),
        native: site.isNative()
      };
    });
  }

  /**
   * Helper method to add a transport as an exception handler.
   * @param {Transport} handler - The transport to add as an exception handler.
   * @returns {void}
   */
  _addHandler(handler) {
    if (!this.handlers.has(handler)) {
      handler.handleExceptions = true;
      const wrapper = new ExceptionStream$1(handler);
      this.handlers.set(handler, wrapper);
      this.logger.pipe(wrapper);
    }
  }

  /**
   * Logs all relevant information around the `err` and exits the current
   * process.
   * @param {Error} err - Error to handle
   * @returns {mixed} - TODO: add return description.
   * @private
   */
  _uncaughtException(err) {
    const info = this.getAllInfo(err);
    const handlers = this._getExceptionHandlers();
    // Calculate if we should exit on this error
    let doExit = typeof this.logger.exitOnError === 'function'
      ? this.logger.exitOnError(err)
      : this.logger.exitOnError;
    let timeout;

    if (!handlers.length && doExit) {
      // eslint-disable-next-line no-console
      console.warn('winston: exitOnError cannot be true with no exception handlers.');
      // eslint-disable-next-line no-console
      console.warn('winston: not exiting process.');
      doExit = false;
    }

    function gracefulExit() {
      debug$2('doExit', doExit);
      debug$2('process._exiting', process._exiting);

      if (doExit && !process._exiting) {
        // Remark: Currently ignoring any exceptions from transports when
        // catching uncaught exceptions.
        if (timeout) {
          clearTimeout(timeout);
        }
        // eslint-disable-next-line no-process-exit
        process.exit(1);
      }
    }

    if (!handlers || handlers.length === 0) {
      return process.nextTick(gracefulExit);
    }

    // Log to all transports attempting to listen for when they are completed.
    asyncForEach$2(handlers, (handler, next) => {
      const done = once$1(next);
      const transport = handler.transport || handler;

      // Debug wrapping so that we can inspect what's going on under the covers.
      function onDone(event) {
        return () => {
          debug$2(event);
          done();
        };
      }

      transport._ending = true;
      transport.once('finish', onDone('finished'));
      transport.once('error', onDone('error'));
    }, () => doExit && gracefulExit());

    this.logger.log(info);

    // If exitOnError is true, then only allow the logging of exceptions to
    // take up to `3000ms`.
    if (doExit) {
      timeout = setTimeout(gracefulExit, 3000);
    }
  }

  /**
   * Returns the list of transports and exceptionHandlers for this instance.
   * @returns {Array} - List of transports and exceptionHandlers for this
   * instance.
   * @private
   */
  _getExceptionHandlers() {
    // Remark (indexzero): since `logger.transports` returns all of the pipes
    // from the _readableState of the stream we actually get the join of the
    // explicit handlers and the implicit transports with
    // `handleExceptions: true`
    return this.logger.transports.filter(wrap => {
      const transport = wrap.transport || wrap;
      return transport.handleExceptions;
    });
  }
};

/**
 * exception-handler.js: Object for handling uncaughtException events.
 *
 * (C) 2010 Charlie Robbins
 * MIT LICENCE
 */

const os = require$$0__default["default"];
const asyncForEach$1 = forEachExports;
const debug$1 = nodeExports('winston:rejection');
const once = oneTime;
const stackTrace = stackTrace$2;
const ExceptionStream = exceptionStream;

/**
 * Object for handling unhandledRejection events.
 * @type {RejectionHandler}
 */
var rejectionHandler = class RejectionHandler {
  /**
   * TODO: add contructor description
   * @param {!Logger} logger - TODO: add param description
   */
  constructor(logger) {
    if (!logger) {
      throw new Error('Logger is required to handle rejections');
    }

    this.logger = logger;
    this.handlers = new Map();
  }

  /**
   * Handles `unhandledRejection` events for the current process by adding any
   * handlers passed in.
   * @returns {undefined}
   */
  handle(...args) {
    args.forEach(arg => {
      if (Array.isArray(arg)) {
        return arg.forEach(handler => this._addHandler(handler));
      }

      this._addHandler(arg);
    });

    if (!this.catcher) {
      this.catcher = this._unhandledRejection.bind(this);
      process.on('unhandledRejection', this.catcher);
    }
  }

  /**
   * Removes any handlers to `unhandledRejection` events for the current
   * process. This does not modify the state of the `this.handlers` set.
   * @returns {undefined}
   */
  unhandle() {
    if (this.catcher) {
      process.removeListener('unhandledRejection', this.catcher);
      this.catcher = false;

      Array.from(this.handlers.values()).forEach(wrapper =>
        this.logger.unpipe(wrapper)
      );
    }
  }

  /**
   * TODO: add method description
   * @param {Error} err - Error to get information about.
   * @returns {mixed} - TODO: add return description.
   */
  getAllInfo(err) {
    let message = null;
    if (err) {
      message = typeof err === 'string' ? err : err.message;
    }

    return {
      error: err,
      // TODO (indexzero): how do we configure this?
      level: 'error',
      message: [
        `unhandledRejection: ${message || '(no error message)'}`,
        err && err.stack || '  No stack trace'
      ].join('\n'),
      stack: err && err.stack,
      exception: true,
      date: new Date().toString(),
      process: this.getProcessInfo(),
      os: this.getOsInfo(),
      trace: this.getTrace(err)
    };
  }

  /**
   * Gets all relevant process information for the currently running process.
   * @returns {mixed} - TODO: add return description.
   */
  getProcessInfo() {
    return {
      pid: process.pid,
      uid: process.getuid ? process.getuid() : null,
      gid: process.getgid ? process.getgid() : null,
      cwd: process.cwd(),
      execPath: process.execPath,
      version: process.version,
      argv: process.argv,
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Gets all relevant OS information for the currently running process.
   * @returns {mixed} - TODO: add return description.
   */
  getOsInfo() {
    return {
      loadavg: os.loadavg(),
      uptime: os.uptime()
    };
  }

  /**
   * Gets a stack trace for the specified error.
   * @param {mixed} err - TODO: add param description.
   * @returns {mixed} - TODO: add return description.
   */
  getTrace(err) {
    const trace = err ? stackTrace.parse(err) : stackTrace.get();
    return trace.map(site => {
      return {
        column: site.getColumnNumber(),
        file: site.getFileName(),
        function: site.getFunctionName(),
        line: site.getLineNumber(),
        method: site.getMethodName(),
        native: site.isNative()
      };
    });
  }

  /**
   * Helper method to add a transport as an exception handler.
   * @param {Transport} handler - The transport to add as an exception handler.
   * @returns {void}
   */
  _addHandler(handler) {
    if (!this.handlers.has(handler)) {
      handler.handleRejections = true;
      const wrapper = new ExceptionStream(handler);
      this.handlers.set(handler, wrapper);
      this.logger.pipe(wrapper);
    }
  }

  /**
   * Logs all relevant information around the `err` and exits the current
   * process.
   * @param {Error} err - Error to handle
   * @returns {mixed} - TODO: add return description.
   * @private
   */
  _unhandledRejection(err) {
    const info = this.getAllInfo(err);
    const handlers = this._getRejectionHandlers();
    // Calculate if we should exit on this error
    let doExit =
      typeof this.logger.exitOnError === 'function'
        ? this.logger.exitOnError(err)
        : this.logger.exitOnError;
    let timeout;

    if (!handlers.length && doExit) {
      // eslint-disable-next-line no-console
      console.warn('winston: exitOnError cannot be true with no rejection handlers.');
      // eslint-disable-next-line no-console
      console.warn('winston: not exiting process.');
      doExit = false;
    }

    function gracefulExit() {
      debug$1('doExit', doExit);
      debug$1('process._exiting', process._exiting);

      if (doExit && !process._exiting) {
        // Remark: Currently ignoring any rejections from transports when
        // catching unhandled rejections.
        if (timeout) {
          clearTimeout(timeout);
        }
        // eslint-disable-next-line no-process-exit
        process.exit(1);
      }
    }

    if (!handlers || handlers.length === 0) {
      return process.nextTick(gracefulExit);
    }

    // Log to all transports attempting to listen for when they are completed.
    asyncForEach$1(
      handlers,
      (handler, next) => {
        const done = once(next);
        const transport = handler.transport || handler;

        // Debug wrapping so that we can inspect what's going on under the covers.
        function onDone(event) {
          return () => {
            debug$1(event);
            done();
          };
        }

        transport._ending = true;
        transport.once('finish', onDone('finished'));
        transport.once('error', onDone('error'));
      },
      () => doExit && gracefulExit()
    );

    this.logger.log(info);

    // If exitOnError is true, then only allow the logging of exceptions to
    // take up to `3000ms`.
    if (doExit) {
      timeout = setTimeout(gracefulExit, 3000);
    }
  }

  /**
   * Returns the list of transports and exceptionHandlers for this instance.
   * @returns {Array} - List of transports and exceptionHandlers for this
   * instance.
   * @private
   */
  _getRejectionHandlers() {
    // Remark (indexzero): since `logger.transports` returns all of the pipes
    // from the _readableState of the stream we actually get the join of the
    // explicit handlers and the implicit transports with
    // `handleRejections: true`
    return this.logger.transports.filter(wrap => {
      const transport = wrap.transport || wrap;
      return transport.handleRejections;
    });
  }
};

/**
 * profiler.js: TODO: add file header description.
 *
 * (C) 2010 Charlie Robbins
 * MIT LICENCE
 */

/**
 * TODO: add class description.
 * @type {Profiler}
 * @private
 */
var profiler = class Profiler {
  /**
   * Constructor function for the Profiler instance used by
   * `Logger.prototype.startTimer`. When done is called the timer will finish
   * and log the duration.
   * @param {!Logger} logger - TODO: add param description.
   * @private
   */
  constructor(logger) {
    if (!logger) {
      throw new Error('Logger is required for profiling.');
    }

    this.logger = logger;
    this.start = Date.now();
  }

  /**
   * Ends the current timer (i.e. Profiler) instance and logs the `msg` along
   * with the duration since creation.
   * @returns {mixed} - TODO: add return description.
   * @private
   */
  done(...args) {
    if (typeof args[args.length - 1] === 'function') {
      // eslint-disable-next-line no-console
      console.warn('Callback function no longer supported as of winston@3.0.0');
      args.pop();
    }

    const info = typeof args[args.length - 1] === 'object' ? args.pop() : {};
    info.level = info.level || 'info';
    info.durationMs = (Date.now()) - this.start;

    return this.logger.write(info);
  }
};

/**
 * logger.js: TODO: add file header description.
 *
 * (C) 2010 Charlie Robbins
 * MIT LICENCE
 */

const { Stream, Transform } = readableExports;
const asyncForEach = forEachExports;
const { LEVEL: LEVEL$1, SPLAT } = tripleBeam;
const isStream = isStream_1;
const ExceptionHandler = exceptionHandler;
const RejectionHandler = rejectionHandler;
const LegacyTransportStream = requireLegacy();
const Profiler = profiler;
const { warn } = common;
const config$1 = config$2;

/**
 * Captures the number of format (i.e. %s strings) in a given string.
 * Based on `util.format`, see Node.js source:
 * https://github.com/nodejs/node/blob/b1c8f15c5f169e021f7c46eb7b219de95fe97603/lib/util.js#L201-L230
 * @type {RegExp}
 */
const formatRegExp = /%[scdjifoO%]/g;

/**
 * TODO: add class description.
 * @type {Logger}
 * @extends {Transform}
 */
class Logger$1 extends Transform {
  /**
   * Constructor function for the Logger object responsible for persisting log
   * messages and metadata to one or more transports.
   * @param {!Object} options - foo
   */
  constructor(options) {
    super({ objectMode: true });
    this.configure(options);
  }

  child(defaultRequestMetadata) {
    const logger = this;
    return Object.create(logger, {
      write: {
        value: function (info) {
          const infoClone = Object.assign(
            {},
            defaultRequestMetadata,
            info
          );

          // Object.assign doesn't copy inherited Error
          // properties so we have to do that explicitly
          //
          // Remark (indexzero): we should remove this
          // since the errors format will handle this case.
          //
          if (info instanceof Error) {
            infoClone.stack = info.stack;
            infoClone.message = info.message;
          }

          logger.write(infoClone);
        }
      }
    });
  }

  /**
   * This will wholesale reconfigure this instance by:
   * 1. Resetting all transports. Older transports will be removed implicitly.
   * 2. Set all other options including levels, colors, rewriters, filters,
   *    exceptionHandlers, etc.
   * @param {!Object} options - TODO: add param description.
   * @returns {undefined}
   */
  configure({
    silent,
    format,
    defaultMeta,
    levels,
    level = 'info',
    exitOnError = true,
    transports,
    colors,
    emitErrs,
    formatters,
    padLevels,
    rewriters,
    stripColors,
    exceptionHandlers,
    rejectionHandlers
  } = {}) {
    // Reset transports if we already have them
    if (this.transports.length) {
      this.clear();
    }

    this.silent = silent;
    this.format = format || this.format || requireJson()();

    this.defaultMeta = defaultMeta || null;
    // Hoist other options onto this instance.
    this.levels = levels || this.levels || config$1.npm.levels;
    this.level = level;
    if (this.exceptions) {
      this.exceptions.unhandle();
    }
    if (this.rejections) {
      this.rejections.unhandle();
    }
    this.exceptions = new ExceptionHandler(this);
    this.rejections = new RejectionHandler(this);
    this.profilers = {};
    this.exitOnError = exitOnError;

    // Add all transports we have been provided.
    if (transports) {
      transports = Array.isArray(transports) ? transports : [transports];
      transports.forEach(transport => this.add(transport));
    }

    if (
      colors ||
      emitErrs ||
      formatters ||
      padLevels ||
      rewriters ||
      stripColors
    ) {
      throw new Error(
        [
          '{ colors, emitErrs, formatters, padLevels, rewriters, stripColors } were removed in winston@3.0.0.',
          'Use a custom winston.format(function) instead.',
          'See: https://github.com/winstonjs/winston/tree/master/UPGRADE-3.0.md'
        ].join('\n')
      );
    }

    if (exceptionHandlers) {
      this.exceptions.handle(exceptionHandlers);
    }
    if (rejectionHandlers) {
      this.rejections.handle(rejectionHandlers);
    }
  }

  isLevelEnabled(level) {
    const givenLevelValue = getLevelValue(this.levels, level);
    if (givenLevelValue === null) {
      return false;
    }

    const configuredLevelValue = getLevelValue(this.levels, this.level);
    if (configuredLevelValue === null) {
      return false;
    }

    if (!this.transports || this.transports.length === 0) {
      return configuredLevelValue >= givenLevelValue;
    }

    const index = this.transports.findIndex(transport => {
      let transportLevelValue = getLevelValue(this.levels, transport.level);
      if (transportLevelValue === null) {
        transportLevelValue = configuredLevelValue;
      }
      return transportLevelValue >= givenLevelValue;
    });
    return index !== -1;
  }

  /* eslint-disable valid-jsdoc */
  /**
   * Ensure backwards compatibility with a `log` method
   * @param {mixed} level - Level the log message is written at.
   * @param {mixed} msg - TODO: add param description.
   * @param {mixed} meta - TODO: add param description.
   * @returns {Logger} - TODO: add return description.
   *
   * @example
   *    // Supports the existing API:
   *    logger.log('info', 'Hello world', { custom: true });
   *    logger.log('info', new Error('Yo, it\'s on fire'));
   *
   *    // Requires winston.format.splat()
   *    logger.log('info', '%s %d%%', 'A string', 50, { thisIsMeta: true });
   *
   *    // And the new API with a single JSON literal:
   *    logger.log({ level: 'info', message: 'Hello world', custom: true });
   *    logger.log({ level: 'info', message: new Error('Yo, it\'s on fire') });
   *
   *    // Also requires winston.format.splat()
   *    logger.log({
   *      level: 'info',
   *      message: '%s %d%%',
   *      [SPLAT]: ['A string', 50],
   *      meta: { thisIsMeta: true }
   *    });
   *
   */
  /* eslint-enable valid-jsdoc */
  log(level, msg, ...splat) {
    // eslint-disable-line max-params
    // Optimize for the hotpath of logging JSON literals
    if (arguments.length === 1) {
      // Yo dawg, I heard you like levels ... seriously ...
      // In this context the LHS `level` here is actually the `info` so read
      // this as: info[LEVEL] = info.level;
      level[LEVEL$1] = level.level;
      this._addDefaultMeta(level);
      this.write(level);
      return this;
    }

    // Slightly less hotpath, but worth optimizing for.
    if (arguments.length === 2) {
      if (msg && typeof msg === 'object') {
        msg[LEVEL$1] = msg.level = level;
        this._addDefaultMeta(msg);
        this.write(msg);
        return this;
      }

      msg = { [LEVEL$1]: level, level, message: msg };
      this._addDefaultMeta(msg);
      this.write(msg);
      return this;
    }

    const [meta] = splat;
    if (typeof meta === 'object' && meta !== null) {
      // Extract tokens, if none available default to empty array to
      // ensure consistancy in expected results
      const tokens = msg && msg.match && msg.match(formatRegExp);

      if (!tokens) {
        const info = Object.assign({}, this.defaultMeta, meta, {
          [LEVEL$1]: level,
          [SPLAT]: splat,
          level,
          message: msg
        });

        if (meta.message) info.message = `${info.message} ${meta.message}`;
        if (meta.stack) info.stack = meta.stack;

        this.write(info);
        return this;
      }
    }

    this.write(Object.assign({}, this.defaultMeta, {
      [LEVEL$1]: level,
      [SPLAT]: splat,
      level,
      message: msg
    }));

    return this;
  }

  /**
   * Pushes data so that it can be picked up by all of our pipe targets.
   * @param {mixed} info - TODO: add param description.
   * @param {mixed} enc - TODO: add param description.
   * @param {mixed} callback - Continues stream processing.
   * @returns {undefined}
   * @private
   */
  _transform(info, enc, callback) {
    if (this.silent) {
      return callback();
    }

    // [LEVEL] is only soft guaranteed to be set here since we are a proper
    // stream. It is likely that `info` came in through `.log(info)` or
    // `.info(info)`. If it is not defined, however, define it.
    // This LEVEL symbol is provided by `triple-beam` and also used in:
    // - logform
    // - winston-transport
    // - abstract-winston-transport
    if (!info[LEVEL$1]) {
      info[LEVEL$1] = info.level;
    }

    // Remark: really not sure what to do here, but this has been reported as
    // very confusing by pre winston@2.0.0 users as quite confusing when using
    // custom levels.
    if (!this.levels[info[LEVEL$1]] && this.levels[info[LEVEL$1]] !== 0) {
      // eslint-disable-next-line no-console
      console.error('[winston] Unknown logger level: %s', info[LEVEL$1]);
    }

    // Remark: not sure if we should simply error here.
    if (!this._readableState.pipes) {
      // eslint-disable-next-line no-console
      console.error(
        '[winston] Attempt to write logs with no transports, which can increase memory usage: %j',
        info
      );
    }

    // Here we write to the `format` pipe-chain, which on `readable` above will
    // push the formatted `info` Object onto the buffer for this instance. We trap
    // (and re-throw) any errors generated by the user-provided format, but also
    // guarantee that the streams callback is invoked so that we can continue flowing.
    try {
      this.push(this.format.transform(info, this.format.options));
    } finally {
      this._writableState.sync = false;
      // eslint-disable-next-line callback-return
      callback();
    }
  }

  /**
   * Delays the 'finish' event until all transport pipe targets have
   * also emitted 'finish' or are already finished.
   * @param {mixed} callback - Continues stream processing.
   */
  _final(callback) {
    const transports = this.transports.slice();
    asyncForEach(
      transports,
      (transport, next) => {
        if (!transport || transport.finished) return setImmediate(next);
        transport.once('finish', next);
        transport.end();
      },
      callback
    );
  }

  /**
   * Adds the transport to this logger instance by piping to it.
   * @param {mixed} transport - TODO: add param description.
   * @returns {Logger} - TODO: add return description.
   */
  add(transport) {
    // Support backwards compatibility with all existing `winston < 3.x.x`
    // transports which meet one of two criteria:
    // 1. They inherit from winston.Transport in  < 3.x.x which is NOT a stream.
    // 2. They expose a log method which has a length greater than 2 (i.e. more then
    //    just `log(info, callback)`.
    const target =
      !isStream(transport) || transport.log.length > 2
        ? new LegacyTransportStream({ transport })
        : transport;

    if (!target._writableState || !target._writableState.objectMode) {
      throw new Error(
        'Transports must WritableStreams in objectMode. Set { objectMode: true }.'
      );
    }

    // Listen for the `error` event and the `warn` event on the new Transport.
    this._onEvent('error', target);
    this._onEvent('warn', target);
    this.pipe(target);

    if (transport.handleExceptions) {
      this.exceptions.handle();
    }

    if (transport.handleRejections) {
      this.rejections.handle();
    }

    return this;
  }

  /**
   * Removes the transport from this logger instance by unpiping from it.
   * @param {mixed} transport - TODO: add param description.
   * @returns {Logger} - TODO: add return description.
   */
  remove(transport) {
    if (!transport) return this;
    let target = transport;
    if (!isStream(transport) || transport.log.length > 2) {
      target = this.transports.filter(
        match => match.transport === transport
      )[0];
    }

    if (target) {
      this.unpipe(target);
    }
    return this;
  }

  /**
   * Removes all transports from this logger instance.
   * @returns {Logger} - TODO: add return description.
   */
  clear() {
    this.unpipe();
    return this;
  }

  /**
   * Cleans up resources (streams, event listeners) for all transports
   * associated with this instance (if necessary).
   * @returns {Logger} - TODO: add return description.
   */
  close() {
    this.exceptions.unhandle();
    this.rejections.unhandle();
    this.clear();
    this.emit('close');
    return this;
  }

  /**
   * Sets the `target` levels specified on this instance.
   * @param {Object} Target levels to use on this instance.
   */
  setLevels() {
    warn.deprecated('setLevels');
  }

  /**
   * Queries the all transports for this instance with the specified `options`.
   * This will aggregate each transport's results into one object containing
   * a property per transport.
   * @param {Object} options - Query options for this instance.
   * @param {function} callback - Continuation to respond to when complete.
   */
  query(options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    options = options || {};
    const results = {};
    const queryObject = Object.assign({}, options.query || {});

    // Helper function to query a single transport
    function queryTransport(transport, next) {
      if (options.query && typeof transport.formatQuery === 'function') {
        options.query = transport.formatQuery(queryObject);
      }

      transport.query(options, (err, res) => {
        if (err) {
          return next(err);
        }

        if (typeof transport.formatResults === 'function') {
          res = transport.formatResults(res, options.format);
        }

        next(null, res);
      });
    }

    // Helper function to accumulate the results from `queryTransport` into
    // the `results`.
    function addResults(transport, next) {
      queryTransport(transport, (err, result) => {
        // queryTransport could potentially invoke the callback multiple times
        // since Transport code can be unpredictable.
        if (next) {
          result = err || result;
          if (result) {
            results[transport.name] = result;
          }

          // eslint-disable-next-line callback-return
          next();
        }

        next = null;
      });
    }

    // Iterate over the transports in parallel setting the appropriate key in
    // the `results`.
    asyncForEach(
      this.transports.filter(transport => !!transport.query),
      addResults,
      () => callback(null, results)
    );
  }

  /**
   * Returns a log stream for all transports. Options object is optional.
   * @param{Object} options={} - Stream options for this instance.
   * @returns {Stream} - TODO: add return description.
   */
  stream(options = {}) {
    const out = new Stream();
    const streams = [];

    out._streams = streams;
    out.destroy = () => {
      let i = streams.length;
      while (i--) {
        streams[i].destroy();
      }
    };

    // Create a list of all transports for this instance.
    this.transports
      .filter(transport => !!transport.stream)
      .forEach(transport => {
        const str = transport.stream(options);
        if (!str) {
          return;
        }

        streams.push(str);

        str.on('log', log => {
          log.transport = log.transport || [];
          log.transport.push(transport.name);
          out.emit('log', log);
        });

        str.on('error', err => {
          err.transport = err.transport || [];
          err.transport.push(transport.name);
          out.emit('error', err);
        });
      });

    return out;
  }

  /**
   * Returns an object corresponding to a specific timing. When done is called
   * the timer will finish and log the duration. e.g.:
   * @returns {Profile} - TODO: add return description.
   * @example
   *    const timer = winston.startTimer()
   *    setTimeout(() => {
   *      timer.done({
   *        message: 'Logging message'
   *      });
   *    }, 1000);
   */
  startTimer() {
    return new Profiler(this);
  }

  /**
   * Tracks the time inbetween subsequent calls to this method with the same
   * `id` parameter. The second call to this method will log the difference in
   * milliseconds along with the message.
   * @param {string} id Unique id of the profiler
   * @returns {Logger} - TODO: add return description.
   */
  profile(id, ...args) {
    const time = Date.now();
    if (this.profilers[id]) {
      const timeEnd = this.profilers[id];
      delete this.profilers[id];

      // Attempt to be kind to users if they are still using older APIs.
      if (typeof args[args.length - 2] === 'function') {
        // eslint-disable-next-line no-console
        console.warn(
          'Callback function no longer supported as of winston@3.0.0'
        );
        args.pop();
      }

      // Set the duration property of the metadata
      const info = typeof args[args.length - 1] === 'object' ? args.pop() : {};
      info.level = info.level || 'info';
      info.durationMs = time - timeEnd;
      info.message = info.message || id;
      return this.write(info);
    }

    this.profilers[id] = time;
    return this;
  }

  /**
   * Backwards compatibility to `exceptions.handle` in winston < 3.0.0.
   * @returns {undefined}
   * @deprecated
   */
  handleExceptions(...args) {
    // eslint-disable-next-line no-console
    console.warn(
      'Deprecated: .handleExceptions() will be removed in winston@4. Use .exceptions.handle()'
    );
    this.exceptions.handle(...args);
  }

  /**
   * Backwards compatibility to `exceptions.handle` in winston < 3.0.0.
   * @returns {undefined}
   * @deprecated
   */
  unhandleExceptions(...args) {
    // eslint-disable-next-line no-console
    console.warn(
      'Deprecated: .unhandleExceptions() will be removed in winston@4. Use .exceptions.unhandle()'
    );
    this.exceptions.unhandle(...args);
  }

  /**
   * Throw a more meaningful deprecation notice
   * @throws {Error} - TODO: add throws description.
   */
  cli() {
    throw new Error(
      [
        'Logger.cli() was removed in winston@3.0.0',
        'Use a custom winston.formats.cli() instead.',
        'See: https://github.com/winstonjs/winston/tree/master/UPGRADE-3.0.md'
      ].join('\n')
    );
  }

  /**
   * Bubbles the `event` that occured on the specified `transport` up
   * from this instance.
   * @param {string} event - The event that occured
   * @param {Object} transport - Transport on which the event occured
   * @private
   */
  _onEvent(event, transport) {
    function transportEvent(err) {
      // https://github.com/winstonjs/winston/issues/1364
      if (event === 'error' && !this.transports.includes(transport)) {
        this.add(transport);
      }
      this.emit(event, err, transport);
    }

    if (!transport['__winston' + event]) {
      transport['__winston' + event] = transportEvent.bind(this);
      transport.on(event, transport['__winston' + event]);
    }
  }

  _addDefaultMeta(msg) {
    if (this.defaultMeta) {
      Object.assign(msg, this.defaultMeta);
    }
  }
}

function getLevelValue(levels, level) {
  const value = levels[level];
  if (!value && value !== 0) {
    return null;
  }
  return value;
}

/**
 * Represents the current readableState pipe targets for this Logger instance.
 * @type {Array|Object}
 */
Object.defineProperty(Logger$1.prototype, 'transports', {
  configurable: false,
  enumerable: true,
  get() {
    const { pipes } = this._readableState;
    return !Array.isArray(pipes) ? [pipes].filter(Boolean) : pipes;
  }
});

var logger = Logger$1;

/**
 * create-logger.js: Logger factory for winston logger instances.
 *
 * (C) 2010 Charlie Robbins
 * MIT LICENCE
 */

const { LEVEL } = tripleBeam;
const config = config$2;
const Logger = logger;
const debug = nodeExports('winston:create-logger');

function isLevelEnabledFunctionName(level) {
  return 'is' + level.charAt(0).toUpperCase() + level.slice(1) + 'Enabled';
}

/**
 * Create a new instance of a winston Logger. Creates a new
 * prototype for each instance.
 * @param {!Object} opts - Options for the created logger.
 * @returns {Logger} - A newly created logger instance.
 */
var createLogger$2 = function (opts = {}) {
  //
  // Default levels: npm
  //
  opts.levels = opts.levels || config.npm.levels;

  /**
   * DerivedLogger to attach the logs level methods.
   * @type {DerivedLogger}
   * @extends {Logger}
   */
  class DerivedLogger extends Logger {
    /**
     * Create a new class derived logger for which the levels can be attached to
     * the prototype of. This is a V8 optimization that is well know to increase
     * performance of prototype functions.
     * @param {!Object} options - Options for the created logger.
     */
    constructor(options) {
      super(options);
    }
  }

  const logger = new DerivedLogger(opts);

  //
  // Create the log level methods for the derived logger.
  //
  Object.keys(opts.levels).forEach(function (level) {
    debug('Define prototype method for "%s"', level);
    if (level === 'log') {
      // eslint-disable-next-line no-console
      console.warn('Level "log" not defined: conflicts with the method "log". Use a different level name.');
      return;
    }

    //
    // Define prototype methods for each log level e.g.:
    // logger.log('info', msg) implies these methods are defined:
    // - logger.info(msg)
    // - logger.isInfoEnabled()
    //
    // Remark: to support logger.child this **MUST** be a function
    // so it'll always be called on the instance instead of a fixed
    // place in the prototype chain.
    //
    DerivedLogger.prototype[level] = function (...args) {
      // Prefer any instance scope, but default to "root" logger
      const self = this || logger;

      // Optimize the hot-path which is the single object.
      if (args.length === 1) {
        const [msg] = args;
        const info = msg && msg.message && msg || { message: msg };
        info.level = info[LEVEL] = level;
        self._addDefaultMeta(info);
        self.write(info);
        return (this || logger);
      }

      // When provided nothing assume the empty string
      if (args.length === 0) {
        self.log(level, '');
        return self;
      }

      // Otherwise build argument list which could potentially conform to
      // either:
      // . v3 API: log(obj)
      // 2. v1/v2 API: log(level, msg, ... [string interpolate], [{metadata}], [callback])
      return self.log(level, ...args);
    };

    DerivedLogger.prototype[isLevelEnabledFunctionName(level)] = function () {
      return (this || logger).isLevelEnabled(level);
    };
  });

  return logger;
};

/**
 * container.js: Inversion of control container for winston logger instances.
 *
 * (C) 2010 Charlie Robbins
 * MIT LICENCE
 */

const createLogger$1 = createLogger$2;

/**
 * Inversion of control container for winston logger instances.
 * @type {Container}
 */
var container = class Container {
  /**
   * Constructor function for the Container object responsible for managing a
   * set of `winston.Logger` instances based on string ids.
   * @param {!Object} [options={}] - Default pass-thru options for Loggers.
   */
  constructor(options = {}) {
    this.loggers = new Map();
    this.options = options;
  }

  /**
   * Retrieves a `winston.Logger` instance for the specified `id`. If an
   * instance does not exist, one is created.
   * @param {!string} id - The id of the Logger to get.
   * @param {?Object} [options] - Options for the Logger instance.
   * @returns {Logger} - A configured Logger instance with a specified id.
   */
  add(id, options) {
    if (!this.loggers.has(id)) {
      // Remark: Simple shallow clone for configuration options in case we pass
      // in instantiated protoypal objects
      options = Object.assign({}, options || this.options);
      const existing = options.transports || this.options.transports;

      // Remark: Make sure if we have an array of transports we slice it to
      // make copies of those references.
      options.transports = existing ? existing.slice() : [];

      const logger = createLogger$1(options);
      logger.on('close', () => this._delete(id));
      this.loggers.set(id, logger);
    }

    return this.loggers.get(id);
  }

  /**
   * Retreives a `winston.Logger` instance for the specified `id`. If
   * an instance does not exist, one is created.
   * @param {!string} id - The id of the Logger to get.
   * @param {?Object} [options] - Options for the Logger instance.
   * @returns {Logger} - A configured Logger instance with a specified id.
   */
  get(id, options) {
    return this.add(id, options);
  }

  /**
   * Check if the container has a logger with the id.
   * @param {?string} id - The id of the Logger instance to find.
   * @returns {boolean} - Boolean value indicating if this instance has a
   * logger with the specified `id`.
   */
  has(id) {
    return !!this.loggers.has(id);
  }

  /**
   * Closes a `Logger` instance with the specified `id` if it exists.
   * If no `id` is supplied then all Loggers are closed.
   * @param {?string} id - The id of the Logger instance to close.
   * @returns {undefined}
   */
  close(id) {
    if (id) {
      return this._removeLogger(id);
    }

    this.loggers.forEach((val, key) => this._removeLogger(key));
  }

  /**
   * Remove a logger based on the id.
   * @param {!string} id - The id of the logger to remove.
   * @returns {undefined}
   * @private
   */
  _removeLogger(id) {
    if (!this.loggers.has(id)) {
      return;
    }

    const logger = this.loggers.get(id);
    logger.close();
    this._delete(id);
  }

  /**
   * Deletes a `Logger` instance with the specified `id`.
   * @param {!string} id - The id of the Logger instance to delete from
   * container.
   * @returns {undefined}
   * @private
   */
  _delete(id) {
    this.loggers.delete(id);
  }
};

/**
 * winston.js: Top-level include defining Winston.
 *
 * (C) 2010 Charlie Robbins
 * MIT LICENCE
 */

(function (exports) {

	const logform = logform$1;
	const { warn } = common;

	/**
	 * Expose version. Use `require` method for `webpack` support.
	 * @type {string}
	 */
	exports.version = require$$2.version;
	/**
	 * Include transports defined by default by winston
	 * @type {Array}
	 */
	exports.transports = transports;
	/**
	 * Expose utility methods
	 * @type {Object}
	 */
	exports.config = config$2;
	/**
	 * Hoist format-related functionality from logform.
	 * @type {Object}
	 */
	exports.addColors = logform.levels;
	/**
	 * Hoist format-related functionality from logform.
	 * @type {Object}
	 */
	exports.format = logform.format;
	/**
	 * Expose core Logging-related prototypes.
	 * @type {function}
	 */
	exports.createLogger = createLogger$2;
	/**
	 * Expose core Logging-related prototypes.
	 * @type {Object}
	 */
	exports.ExceptionHandler = exceptionHandler;
	/**
	 * Expose core Logging-related prototypes.
	 * @type {Object}
	 */
	exports.RejectionHandler = rejectionHandler;
	/**
	 * Expose core Logging-related prototypes.
	 * @type {Container}
	 */
	exports.Container = container;
	/**
	 * Expose core Logging-related prototypes.
	 * @type {Object}
	 */
	exports.Transport = requireWinstonTransport();
	/**
	 * We create and expose a default `Container` to `winston.loggers` so that the
	 * programmer may manage multiple `winston.Logger` instances without any
	 * additional overhead.
	 * @example
	 *   // some-file1.js
	 *   const logger = require('winston').loggers.get('something');
	 *
	 *   // some-file2.js
	 *   const logger = require('winston').loggers.get('something');
	 */
	exports.loggers = new exports.Container();

	/**
	 * We create and expose a 'defaultLogger' so that the programmer may do the
	 * following without the need to create an instance of winston.Logger directly:
	 * @example
	 *   const winston = require('winston');
	 *   winston.log('info', 'some message');
	 *   winston.error('some error');
	 */
	const defaultLogger = exports.createLogger();

	// Pass through the target methods onto `winston.
	Object.keys(exports.config.npm.levels)
	  .concat([
	    'log',
	    'query',
	    'stream',
	    'add',
	    'remove',
	    'clear',
	    'profile',
	    'startTimer',
	    'handleExceptions',
	    'unhandleExceptions',
	    'handleRejections',
	    'unhandleRejections',
	    'configure',
	    'child'
	  ])
	  .forEach(
	    method => (exports[method] = (...args) => defaultLogger[method](...args))
	  );

	/**
	 * Define getter / setter for the default logger level which need to be exposed
	 * by winston.
	 * @type {string}
	 */
	Object.defineProperty(exports, 'level', {
	  get() {
	    return defaultLogger.level;
	  },
	  set(val) {
	    defaultLogger.level = val;
	  }
	});

	/**
	 * Define getter for `exceptions` which replaces `handleExceptions` and
	 * `unhandleExceptions`.
	 * @type {Object}
	 */
	Object.defineProperty(exports, 'exceptions', {
	  get() {
	    return defaultLogger.exceptions;
	  }
	});

	/**
	 * Define getters / setters for appropriate properties of the default logger
	 * which need to be exposed by winston.
	 * @type {Logger}
	 */
	['exitOnError'].forEach(prop => {
	  Object.defineProperty(exports, prop, {
	    get() {
	      return defaultLogger[prop];
	    },
	    set(val) {
	      defaultLogger[prop] = val;
	    }
	  });
	});

	/**
	 * The default transports and exceptionHandlers for the default winston logger.
	 * @type {Object}
	 */
	Object.defineProperty(exports, 'default', {
	  get() {
	    return {
	      exceptionHandlers: defaultLogger.exceptionHandlers,
	      rejectionHandlers: defaultLogger.rejectionHandlers,
	      transports: defaultLogger.transports
	    };
	  }
	});

	// Have friendlier breakage notices for properties that were exposed by default
	// on winston < 3.0.
	warn.deprecated(exports, 'setLevels');
	warn.forFunctions(exports, 'useFormat', ['cli']);
	warn.forProperties(exports, 'useFormat', ['padLevels', 'stripColors']);
	warn.forFunctions(exports, 'deprecated', [
	  'addRewriter',
	  'addFilter',
	  'clone',
	  'extend'
	]);
	warn.forProperties(exports, 'deprecated', ['emitErrs', 'levelLength']);
	// Throw a useful error when users attempt to run `new winston.Logger`.
	warn.moved(exports, 'createLogger', 'Logger');
} (winston));

function createLogger(request) {
    const debugValue = request ? getHeaderValue(request, 'fpjs_debug') : undefined;
    const isDebug = debugValue === 'true';
    return winston.createLogger({
        level: isDebug ? 'debug' : 'info',
        format: winston.format.json({
            replacer: (_key, value) => {
                if (value instanceof Error) {
                    return {
                        name: value.name,
                        message: value.message,
                        stack: isDebug ? value.stack : undefined,
                    };
                }
                return value;
            },
        }),
        transports: [new winston.transports.Console()],
    });
}

/**
 * Allows access to customer defined variables using multiple providers.
 * Variables will be resolved in order in which providers are set.
 * */
class CustomerVariables {
    constructor(providers, logger = createLogger()) {
        this.providers = providers;
        this.logger = logger;
    }
    /**
     * Attempts to resolve customer variable using providers.
     * If no provider can resolve the variable, the default value is returned.
     * */
    async getVariable(variable) {
        const providerResult = await this.getValueFromProviders(variable);
        if (providerResult) {
            return providerResult;
        }
        const defaultValue = getDefaultCustomerVariable(variable);
        this.logger.debug(`Resolved customer variable ${variable} with default value ${defaultValue}`);
        return {
            value: defaultValue,
            resolvedBy: null,
        };
    }
    async getValueFromProviders(variable) {
        for (const provider of this.providers) {
            try {
                const result = await provider.getVariable(variable);
                if (result) {
                    this.logger.debug(`Resolved customer variable ${variable} with provider ${provider.name}`);
                    return {
                        value: result,
                        resolvedBy: provider.name,
                    };
                }
            }
            catch (error) {
                this.logger.error(`Error while resolving customer variable ${variable} with provider ${provider.name}`, {
                    error,
                });
            }
        }
        return null;
    }
}

class HeaderCustomerVariables {
    constructor(request) {
        this.request = request;
        this.name = 'HeaderCustomerVariables';
    }
    async getVariable(variable) {
        return getHeaderValue(this.request, variable);
    }
}

function arrayBufferToString(buffer) {
    return Buffer.from(buffer).toString('utf8');
}

function normalizeSecret(secret) {
    const entries = Object.entries(JSON.parse(secret));
    return Object.fromEntries(entries.map(([key, value]) => [key.toLowerCase(), value]));
}

const allowedKeys = Object.values(CustomerVariableType);
function assertIsCustomerVariableValue(value, key) {
    if (typeof value !== 'string' && value !== null && value !== undefined) {
        throw new TypeError(`Secrets Manager secret contains an invalid value ${key}: ${value}`);
    }
}
// TODO Update notion documentation to contain correct keys
function validateSecret(obj) {
    if (!obj || typeof obj !== 'object') {
        throw new TypeError('Secrets Manager secret is not an object');
    }
    const secret = obj;
    for (const [key, value] of Object.entries(secret)) {
        if (!allowedKeys.includes(key)) {
            throw new TypeError(`Secrets Manager secret contains an invalid key: ${key}`);
        }
        assertIsCustomerVariableValue(value, key);
    }
}

/**
 * Global cache for customer variables fetched from Secrets Manager.
 * */
const cache = new Map();
/**
 * Retrieves a secret from Secrets Manager and caches it or returns it from cache if it's still valid.
 * */
async function retrieveSecret(secretsManager, key, logger) {
    if (cache.has(key)) {
        const entry = cache.get(key);
        return entry.value;
    }
    const result = await fetchSecret(secretsManager, key, logger);
    cache.set(key, {
        value: result,
    });
    return result;
}
async function convertSecretToString(result) {
    if (result.SecretBinary) {
        return arrayBufferToString(result.SecretBinary);
    }
    else {
        return result.SecretString || '';
    }
}
async function fetchSecret(secretsManager, key, logger) {
    try {
        const result = await secretsManager.send(new clientSecretsManager.GetSecretValueCommand({
            SecretId: key,
        }));
        const secretString = await convertSecretToString(result);
        if (!secretString) {
            return null;
        }
        const parsedSecret = normalizeSecret(secretString);
        validateSecret(parsedSecret);
        return parsedSecret;
    }
    catch (error) {
        logger.error(`Failed to fetch and parse secret ${key}`, { error });
        return null;
    }
}

class SecretsManagerVariables {
    constructor(request, SecretsManagerImpl = clientSecretsManager.SecretsManager, logger = createLogger()) {
        this.request = request;
        this.logger = logger;
        this.name = 'SecretsManagerVariables';
        this.headers = {
            secretName: 'fpjs_secret_name',
            secretRegion: 'fpjs_secret_region',
        };
        this.readSecretsInfoFromHeaders();
        if (SecretsManagerVariables.isValidSecretInfo(this.secretsInfo)) {
            try {
                this.secretsManager = new SecretsManagerImpl({ region: this.secretsInfo.secretRegion });
            }
            catch (error) {
                logger.error('Failed to create secrets manager', {
                    error,
                    secretsInfo: this.secretsInfo,
                });
            }
        }
    }
    async getVariable(variable) {
        const secretsObject = await this.retrieveSecrets();
        return secretsObject?.[variable] ?? null;
    }
    async retrieveSecrets() {
        if (!this.secretsManager) {
            return null;
        }
        try {
            return await retrieveSecret(this.secretsManager, this.secretsInfo.secretName, this.logger);
        }
        catch (error) {
            this.logger.error('Error retrieving secret from secrets manager', {
                error,
                secretsInfo: this.secretsInfo,
            });
            return null;
        }
    }
    readSecretsInfoFromHeaders() {
        if (!this.secretsInfo) {
            this.secretsInfo = {
                secretName: getHeaderValue(this.request, this.headers.secretName),
                secretRegion: getHeaderValue(this.request, this.headers.secretRegion),
            };
        }
    }
    static isValidSecretInfo(secretsInfo) {
        return Boolean(secretsInfo?.secretRegion && secretsInfo?.secretName);
    }
}

const handler = async (event) => {
    const request = event.Records[0].cf.request;
    const logger = createLogger(request);
    const customerVariables = new CustomerVariables([
        new SecretsManagerVariables(request),
        new HeaderCustomerVariables(request),
    ]);
    logger.debug('Handling request', request);
    const pathname = removeTrailingSlashes(request.uri);
    if (pathname === (await getAgentUri(customerVariables))) {
        return downloadAgent({
            apiKey: getApiKey(request, logger),
            version: getVersion(request, logger),
            loaderVersion: getLoaderVersion(request, logger),
            method: request.method,
            headers: filterRequestHeaders(request),
            domain: getHost(request),
            logger,
        });
    }
    else if (pathname === (await getResultUri(customerVariables))) {
        const eTLDPlusOneDomain = getEffectiveTLDPlusOne(getHost(request));
        return handleResult({
            region: getRegion(request, logger),
            querystring: request.querystring,
            method: request.method,
            headers: await prepareHeadersForIngressAPI(request, customerVariables),
            body: request.body?.data || '',
            domain: eTLDPlusOneDomain,
            logger,
        });
    }
    else if (pathname === (await getStatusUri(customerVariables))) {
        return handleStatus(customerVariables);
    }
    else {
        return new Promise((resolve) => resolve({
            status: '404',
        }));
    }
};

exports.handler = handler;
