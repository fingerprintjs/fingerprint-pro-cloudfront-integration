/**
 * Fingerprint Pro CloudFront Lambda function v2.0.0-rc.1 - Copyright (c) FingerprintJS, Inc, 2024 (https://fingerprint.com)
 * Licensed under the MIT (http://www.opensource.org/licenses/mit-license.php) license.
 */

'use strict';

var https = require('https');
var clientSecretsManager = require('@aws-sdk/client-secrets-manager');

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
    CustomerVariableType["GetResultPath"] = "fpjs_get_result_path";
    CustomerVariableType["PreSharedSecret"] = "fpjs_pre_shared_secret";
    CustomerVariableType["AgentDownloadPath"] = "fpjs_agent_download_path";
    CustomerVariableType["FpCdnUrl"] = "fpjs_cdn_url";
    CustomerVariableType["FpIngressBaseHost"] = "fpjs_ingress_base_host";
})(CustomerVariableType || (CustomerVariableType = {}));
const internalVariables = new Set([
    CustomerVariableType.FpCdnUrl,
    CustomerVariableType.FpIngressBaseHost,
]);

const extractVariable = (result) => result.value;
const getAgentUri = async (variables) => `/${await getAgentDownloadPath(variables)}`;
const getResultUri = async (variables) => `/${await getResultPath(variables)}(/.*)?`;
const getStatusUri = () => `/status`;
const getAgentDownloadPath = async (variables) => variables.getVariable(CustomerVariableType.AgentDownloadPath).then(extractVariable);
const getResultPath = async (variables) => variables.getVariable(CustomerVariableType.GetResultPath).then(extractVariable);
const getPreSharedSecret = async (variables) => variables.getVariable(CustomerVariableType.PreSharedSecret).then(extractVariable);
const getFpCdnUrl = async (variables) => variables.getVariable(CustomerVariableType.FpCdnUrl).then(extractVariable);
const getFpIngressBaseHost = async (variables) => variables.getVariable(CustomerVariableType.FpIngressBaseHost).then(extractVariable);

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
const CACHE_CONTROL_HEADER_NAME = 'cache-control';
async function prepareHeadersForIngressAPI(request, variables) {
    const headers = filterRequestHeaders(request);
    headers['fpjs-proxy-client-ip'] = request.clientIp;
    const preSharedSecret = await getPreSharedSecret(variables);
    if (preSharedSecret) {
        headers['fpjs-proxy-secret'] = preSharedSecret;
    }
    headers['fpjs-proxy-forwarded-host'] = getHost(request);
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
const updateResponseHeadersForAgentDownload = (headers) => updateResponseHeaders(headers, true);
function updateResponseHeaders(headers, overrideCacheControl = false) {
    const resultHeaders = {};
    for (const [key, value] of Object.entries(headers)) {
        // Lambda@Edge function can't add read-only headers to response to CloudFront
        // So, such headers from IngressAPI response are filtered out before return the response to CloudFront
        if (!isHeaderAllowedForResponse(key)) {
            continue;
        }
        if (overrideCacheControl && key == CACHE_CONTROL_HEADER_NAME && typeof value === 'string') {
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

var Region;
(function (Region) {
    Region["us"] = "us";
    Region["eu"] = "eu";
    Region["ap"] = "ap";
})(Region || (Region = {}));

const getApiKey = (request) => getQueryParameter(request, 'apiKey');
const getVersion = (request) => {
    const version = getQueryParameter(request, 'version');
    return version === undefined ? '3' : version;
};
const getLoaderVersion = (request) => getQueryParameter(request, 'loaderVersion');
const getRegion = (request) => {
    const value = getQueryParameter(request, 'region');
    if (!value || !(value in Region)) {
        return Region.us;
    }
    return value;
};
function getQueryParameter(request, key) {
    const params = request.querystring.split('&');
    console.debug(`Attempting to extract ${key} from ${params}. Query string: ${request.querystring}`);
    for (let i = 0; i < params.length; i++) {
        const kv = params[i].split('=');
        if (kv[0] === key) {
            console.debug(`Found ${key} in ${params}: ${kv[1]}`);
            return kv[1];
        }
    }
    return undefined;
}

const LAMBDA_FUNC_VERSION = '2.0.0-rc.1';
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

function removeTrailingSlashesAndMultiSlashes(str) {
    return str.replace(/\/+$/, '').replace(/(?<=\/)\/+/, '');
}
function addPathnameMatchBeforeRoute(route) {
    return `[\\/[A-Za-z0-9:._-]*${route}`;
}
function addEndingTrailingSlashToRoute(route) {
    return `${route}\\/*`;
}
function createRoute(route) {
    let routeRegExp = route;
    // routeRegExp = addTrailingWildcard(routeRegExp) // Can be uncommented if wildcard (*) is needed
    routeRegExp = removeTrailingSlashesAndMultiSlashes(routeRegExp);
    routeRegExp = addPathnameMatchBeforeRoute(routeRegExp);
    routeRegExp = addEndingTrailingSlashToRoute(routeRegExp);
    // routeRegExp = replaceDot(routeRegExp) // Can be uncommented if dot (.) is needed
    return RegExp(`^${routeRegExp}$`);
}

function setLogLevel(request) {
    const debugValue = request ? getHeaderValue(request, 'fpjs_debug') : undefined;
    const level = debugValue === 'true' ? 'DEBUG' : 'ERROR';
    process.env.AWS_LAMBDA_LOG_LEVEL = level;
}

function copySearchParams(oldSearchString, newURL) {
    newURL.search = oldSearchString;
}
function downloadAgent(options) {
    return new Promise((resolve) => {
        const data = [];
        const url = new URL(`https://${options.fpCdnUrl}`);
        url.pathname = getEndpoint(options.apiKey, options.version, options.loaderVersion);
        copySearchParams(options.querystring, url);
        addTrafficMonitoringSearchParamsForProCDN(url);
        console.debug(`Downloading agent from: ${url.toString()}`);
        const request = https.request(url, {
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
                    headers: updateResponseHeadersForAgentDownload(response.headers),
                    bodyEncoding: 'base64',
                    body: body.toString('base64'),
                });
            });
        });
        request.on('error', (error) => {
            console.error('unable to download agent', { error });
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
        console.debug('Handling result:', { options });
        const data = [];
        const url = new URL(getIngressAPIHost(options.region, options.fpIngressBaseHost) + options.suffix);
        decodeURIComponent(options.querystring)
            .split('&')
            .filter((it) => it.includes('='))
            .forEach((it) => {
            const kv = it.split('=');
            if (kv[0] === 'region') {
                kv[1] = options.region;
            }
            url.searchParams.append(kv[0], kv[1]);
        });
        addTrafficMonitoringSearchParamsForVisitorIdRequest(url);
        console.debug(`Performing request: ${url.toString()}`);
        const request = https.request(url, {
            method: options.method,
            headers: options.headers,
        }, (response) => {
            response.on('data', (chunk) => data.push(chunk));
            response.on('end', () => {
                const payload = Buffer.concat(data);
                console.debug('Response from Ingress API', {
                    statusCode: response.statusCode,
                    payload: payload.toString('utf-8'),
                });
                resolve({
                    status: response.statusCode ? response.statusCode.toString() : '500',
                    statusDescription: response.statusMessage,
                    headers: updateResponseHeaders(response.headers),
                    bodyEncoding: 'base64',
                    body: payload.toString('base64'),
                });
            });
        });
        request.write(Buffer.from(options.body, 'base64'));
        request.on('error', (error) => {
            console.error('unable to handle result', { error });
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
function getIngressAPIHost(region, baseHost) {
    const prefix = region === Region.us ? '' : `${region}.`;
    return `https://${prefix}${baseHost}`;
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
            isInternal: internalVariables.has(variable),
            resolvedBy: value.resolvedBy,
        };
    }));
    return infoArray;
}
function renderEnvInfo(envInfo) {
    const isAllCustomerDefinedVariablesSet = envInfo
        .filter((info) => !info.isInternal)
        .every((info) => info.isSet && info.resolvedBy);
    if (isAllCustomerDefinedVariablesSet) {
        return `
      <div>
        ✅ All environment variables are set
      </div>
    `;
    }
    const children = envInfo
        .filter((info) => (!info.isSet || !info.resolvedBy) && !info.isInternal)
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
        version: '2.0.0-rc.1',
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

const defaultCustomerVariables = {
    [CustomerVariableType.GetResultPath]: 'resultId',
    [CustomerVariableType.PreSharedSecret]: null,
    [CustomerVariableType.AgentDownloadPath]: 'agent',
    [CustomerVariableType.FpCdnUrl]: 'fpcdn.io',
    [CustomerVariableType.FpIngressBaseHost]: 'api.fpjs.io',
};
function getDefaultCustomerVariable(variable) {
    return defaultCustomerVariables[variable];
}
const DEFAULT_REGION = 'us-east-1';
const SECRET_NAME_HEADER_KEY = 'fpjs_secret_name';

/**
 * Allows access to customer defined variables using multiple providers.
 * Variables will be resolved in order in which providers are set.
 * */
class CustomerVariables {
    constructor(providers) {
        this.providers = providers;
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
        console.debug(`Resolved customer variable ${variable} with default value ${defaultValue}`);
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
                    console.debug(`Resolved customer variable ${variable} with provider ${provider.name}`);
                    return {
                        value: result,
                        resolvedBy: provider.name,
                    };
                }
            }
            catch (error) {
                console.error(`Error while resolving customer variable ${variable} with provider ${provider.name}`, {
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
            console.warn(`Secrets Manager secret contains an invalid key: ${key}`);
            continue;
        }
        assertIsCustomerVariableValue(value, key);
    }
}

function normalizeSecret(secret) {
    const entries = Object.entries(JSON.parse(secret));
    return Object.fromEntries(entries.map(([key, value]) => [key.toLowerCase(), value]));
}

/**
 * Global cache for customer variables fetched from Secrets Manager.
 * */
const cache = new Map();
/**
 * Retrieves a secret from Secrets Manager and caches it or returns it from cache if it's still valid.
 * */
async function retrieveSecret(secretsManager, key) {
    if (cache.has(key)) {
        const entry = cache.get(key);
        return entry.value;
    }
    const result = await fetchSecret(secretsManager, key);
    cache.set(key, {
        value: result,
    });
    return result;
}
function convertSecretToString(result) {
    if (result.SecretBinary) {
        return arrayBufferToString(result.SecretBinary);
    }
    else {
        return result.SecretString || '';
    }
}
async function fetchSecret(secretsManager, key) {
    try {
        const command = new clientSecretsManager.GetSecretValueCommand({
            SecretId: key,
        });
        const result = await secretsManager.send(command);
        const secretString = convertSecretToString(result);
        if (!secretString) {
            return null;
        }
        const parsedSecret = normalizeSecret(secretString);
        validateSecret(parsedSecret);
        return parsedSecret;
    }
    catch (error) {
        console.error(`Failed to fetch and parse secret ${key}`, { error });
        return null;
    }
}

class SecretsManagerVariables {
    constructor(request) {
        this.request = request;
        this.name = 'SecretsManagerVariables';
        this.readSecretsInfoFromHeaders();
        if (SecretsManagerVariables.isValidSecretInfo(this.secretsInfo)) {
            try {
                this.secretsManager = new clientSecretsManager.SecretsManagerClient({ region: this.secretsInfo.secretRegion });
            }
            catch (error) {
                console.error('Failed to create secrets manager', {
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
            return await retrieveSecret(this.secretsManager, this.secretsInfo.secretName);
        }
        catch (error) {
            console.error('Error retrieving secret from secrets manager', {
                error,
                secretsInfo: this.secretsInfo,
            });
            return null;
        }
    }
    readSecretsInfoFromHeaders() {
        if (!this.secretsInfo) {
            this.secretsInfo = {
                secretName: getHeaderValue(this.request, SECRET_NAME_HEADER_KEY),
                secretRegion: DEFAULT_REGION,
            };
        }
    }
    static isValidSecretInfo(secretsInfo) {
        return Boolean(secretsInfo?.secretRegion && secretsInfo?.secretName);
    }
}

async function createRoutes(customerVariables) {
    const routes = [];
    const downloadScriptRoute = {
        pathPattern: createRoute(await getAgentUri(customerVariables)),
        handler: handleDownloadScript,
    };
    const ingressAPIRoute = {
        pathPattern: createRoute(await getResultUri(customerVariables)),
        handler: handleIngressAPI,
    };
    const statusRoute = {
        pathPattern: createRoute(getStatusUri()),
        handler: (request, env) => handleStatusPage(request, env),
    };
    routes.push(downloadScriptRoute);
    routes.push(ingressAPIRoute);
    routes.push(statusRoute);
    return routes;
}
async function handleDownloadScript(request, customerVariables) {
    const fpCdnUrl = await getFpCdnUrl(customerVariables);
    if (!fpCdnUrl) {
        return new Promise((resolve) => resolve({
            status: '500',
        }));
    }
    return downloadAgent({
        querystring: request.querystring,
        fpCdnUrl,
        apiKey: getApiKey(request),
        version: getVersion(request),
        loaderVersion: getLoaderVersion(request),
        method: request.method,
        headers: filterRequestHeaders(request),
    });
}
async function handleIngressAPI(request, customerVariables, resultPathMatches) {
    const fpIngressBaseHost = await getFpIngressBaseHost(customerVariables);
    if (!fpIngressBaseHost) {
        return new Promise((resolve) => resolve({
            status: '500',
        }));
    }
    let suffix = '';
    if (resultPathMatches && resultPathMatches.length >= 1) {
        suffix = resultPathMatches[1] ?? '';
    }
    if (suffix.length > 0 && !suffix.startsWith('/')) {
        suffix = '/' + suffix;
    }
    return handleResult({
        fpIngressBaseHost,
        region: getRegion(request),
        querystring: request.querystring,
        method: request.method,
        headers: await prepareHeadersForIngressAPI(request, customerVariables),
        body: request.body?.data || '',
        suffix,
    });
}
function handleStatusPage(_, customerVariables) {
    return handleStatus(customerVariables);
}
const handler = async (event) => {
    const request = event.Records[0].cf.request;
    setLogLevel(request);
    const customerVariables = new CustomerVariables([
        new SecretsManagerVariables(request),
        new HeaderCustomerVariables(request),
    ]);
    console.debug('Handling request', request);
    const routes = await createRoutes(customerVariables);
    return handleRequestWithRoutes(request, customerVariables, routes);
};
function handleRequestWithRoutes(request, customerVariables, routes) {
    for (const route of routes) {
        const matches = request.uri.match(route.pathPattern);
        if (matches) {
            return route.handler(request, customerVariables, matches);
        }
    }
    return handleNoMatch();
}
function handleNoMatch() {
    return new Promise((resolve) => resolve({
        status: '404',
    }));
}

exports.handleRequestWithRoutes = handleRequestWithRoutes;
exports.handler = handler;
//# sourceMappingURL=fingerprintjs-pro-cloudfront-lambda-function.js.map
