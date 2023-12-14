/**
 * FingerprintJS Pro CloudFront Lambda function v1.3.3 - Copyright (c) FingerprintJS, Inc, 2023 (https://fingerprint.com)
 * Licensed under the MIT (http://www.opensource.org/licenses/mit-license.php) license.
 */

'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var https = require('https');
var require$$0$1 = require('os');
var require$$0$2 = require('stream');
var require$$0$3 = require('fs');
var require$$1$1 = require('path');
var require$$3 = require('zlib');
var require$$1 = require('tty');
var require$$0$4 = require('http');
var awsSdk = require('aws-sdk');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var https__default = /*#__PURE__*/_interopDefaultLegacy(https);
var require$$0__default = /*#__PURE__*/_interopDefaultLegacy(require$$0$1);
var require$$0__default$1 = /*#__PURE__*/_interopDefaultLegacy(require$$0$2);
var require$$0__default$2 = /*#__PURE__*/_interopDefaultLegacy(require$$0$3);
var require$$1__default$1 = /*#__PURE__*/_interopDefaultLegacy(require$$1$1);
var require$$3__default = /*#__PURE__*/_interopDefaultLegacy(require$$3);
var require$$1__default = /*#__PURE__*/_interopDefaultLegacy(require$$1);
var require$$0__default$3 = /*#__PURE__*/_interopDefaultLegacy(require$$0$4);

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

const getApiKey = (request, logger) => getQueryParameter(request, 'apiKey', logger);
const getVersion = (request, logger) => {
    const version = getQueryParameter(request, 'version', logger);
    return version === undefined ? '3' : version;
};
const getLoaderVersion = (request, logger) => getQueryParameter(request, 'loaderVersion', logger);
const getRegion = (request, logger) => {
    const value = getQueryParameter(request, 'region', logger);
    if (!value || !(value in Region)) {
        return Region.us;
    }
    return value;
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

const LAMBDA_FUNC_VERSION = '1.3.3';
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
        const url = new URL('https://fpcdn.io');
        url.pathname = getEndpoint(options.apiKey, options.version, options.loaderVersion);
        addTrafficMonitoringSearchParamsForProCDN(url);
        options.logger.debug(`Downloading agent from: ${url.toString()}`);
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
                    headers: updateResponseHeadersForAgentDownload(response.headers),
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
        options.logger.debug('Handling result:', { options });
        const data = [];
        const url = new URL(getIngressAPIHost(options.region) + options.suffix);
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
        options.logger.debug(`Performing request: ${url.toString()}`);
        const request = https__default["default"].request(url, {
            method: options.method,
            headers: options.headers,
        }, (response) => {
            response.on('data', (chunk) => data.push(chunk));
            response.on('end', () => {
                const payload = Buffer.concat(data);
                options.logger.debug('Response from Ingress API', {
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
    const prefix = region === Region.us ? '' : `${region}.`;
    return `https://${prefix}api.fpjs.io`;
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
        version: '1.3.3',
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

var util = {};

var types$1 = {};

/* eslint complexity: [2, 18], max-statements: [2, 33] */
var shams$1 = function hasSymbols() {
	if (typeof Symbol !== 'function' || typeof Object.getOwnPropertySymbols !== 'function') { return false; }
	if (typeof Symbol.iterator === 'symbol') { return true; }

	var obj = {};
	var sym = Symbol('test');
	var symObj = Object(sym);
	if (typeof sym === 'string') { return false; }

	if (Object.prototype.toString.call(sym) !== '[object Symbol]') { return false; }
	if (Object.prototype.toString.call(symObj) !== '[object Symbol]') { return false; }

	// temp disabled per https://github.com/ljharb/object.assign/issues/17
	// if (sym instanceof Symbol) { return false; }
	// temp disabled per https://github.com/WebReflection/get-own-property-symbols/issues/4
	// if (!(symObj instanceof Symbol)) { return false; }

	// if (typeof Symbol.prototype.toString !== 'function') { return false; }
	// if (String(sym) !== Symbol.prototype.toString.call(sym)) { return false; }

	var symVal = 42;
	obj[sym] = symVal;
	for (sym in obj) { return false; } // eslint-disable-line no-restricted-syntax, no-unreachable-loop
	if (typeof Object.keys === 'function' && Object.keys(obj).length !== 0) { return false; }

	if (typeof Object.getOwnPropertyNames === 'function' && Object.getOwnPropertyNames(obj).length !== 0) { return false; }

	var syms = Object.getOwnPropertySymbols(obj);
	if (syms.length !== 1 || syms[0] !== sym) { return false; }

	if (!Object.prototype.propertyIsEnumerable.call(obj, sym)) { return false; }

	if (typeof Object.getOwnPropertyDescriptor === 'function') {
		var descriptor = Object.getOwnPropertyDescriptor(obj, sym);
		if (descriptor.value !== symVal || descriptor.enumerable !== true) { return false; }
	}

	return true;
};

var hasSymbols$2 = shams$1;

var shams = function hasToStringTagShams() {
	return hasSymbols$2() && !!Symbol.toStringTag;
};

var origSymbol = typeof Symbol !== 'undefined' && Symbol;
var hasSymbolSham = shams$1;

var hasSymbols$1 = function hasNativeSymbols() {
	if (typeof origSymbol !== 'function') { return false; }
	if (typeof Symbol !== 'function') { return false; }
	if (typeof origSymbol('foo') !== 'symbol') { return false; }
	if (typeof Symbol('bar') !== 'symbol') { return false; }

	return hasSymbolSham();
};

/* eslint no-invalid-this: 1 */

var ERROR_MESSAGE = 'Function.prototype.bind called on incompatible ';
var slice = Array.prototype.slice;
var toStr$3 = Object.prototype.toString;
var funcType = '[object Function]';

var implementation$1 = function bind(that) {
    var target = this;
    if (typeof target !== 'function' || toStr$3.call(target) !== funcType) {
        throw new TypeError(ERROR_MESSAGE + target);
    }
    var args = slice.call(arguments, 1);

    var bound;
    var binder = function () {
        if (this instanceof bound) {
            var result = target.apply(
                this,
                args.concat(slice.call(arguments))
            );
            if (Object(result) === result) {
                return result;
            }
            return this;
        } else {
            return target.apply(
                that,
                args.concat(slice.call(arguments))
            );
        }
    };

    var boundLength = Math.max(0, target.length - args.length);
    var boundArgs = [];
    for (var i = 0; i < boundLength; i++) {
        boundArgs.push('$' + i);
    }

    bound = Function('binder', 'return function (' + boundArgs.join(',') + '){ return binder.apply(this,arguments); }')(binder);

    if (target.prototype) {
        var Empty = function Empty() {};
        Empty.prototype = target.prototype;
        bound.prototype = new Empty();
        Empty.prototype = null;
    }

    return bound;
};

var implementation = implementation$1;

var functionBind = Function.prototype.bind || implementation;

var bind$1 = functionBind;

var src = bind$1.call(Function.call, Object.prototype.hasOwnProperty);

var undefined$1;

var $SyntaxError = SyntaxError;
var $Function = Function;
var $TypeError = TypeError;

// eslint-disable-next-line consistent-return
var getEvalledConstructor = function (expressionSyntax) {
	try {
		return $Function('"use strict"; return (' + expressionSyntax + ').constructor;')();
	} catch (e) {}
};

var $gOPD = Object.getOwnPropertyDescriptor;
if ($gOPD) {
	try {
		$gOPD({}, '');
	} catch (e) {
		$gOPD = null; // this is IE 8, which has a broken gOPD
	}
}

var throwTypeError = function () {
	throw new $TypeError();
};
var ThrowTypeError = $gOPD
	? (function () {
		try {
			// eslint-disable-next-line no-unused-expressions, no-caller, no-restricted-properties
			arguments.callee; // IE 8 does not throw here
			return throwTypeError;
		} catch (calleeThrows) {
			try {
				// IE 8 throws on Object.getOwnPropertyDescriptor(arguments, '')
				return $gOPD(arguments, 'callee').get;
			} catch (gOPDthrows) {
				return throwTypeError;
			}
		}
	}())
	: throwTypeError;

var hasSymbols = hasSymbols$1();

var getProto$1 = Object.getPrototypeOf || function (x) { return x.__proto__; }; // eslint-disable-line no-proto

var needsEval = {};

var TypedArray = typeof Uint8Array === 'undefined' ? undefined$1 : getProto$1(Uint8Array);

var INTRINSICS = {
	'%AggregateError%': typeof AggregateError === 'undefined' ? undefined$1 : AggregateError,
	'%Array%': Array,
	'%ArrayBuffer%': typeof ArrayBuffer === 'undefined' ? undefined$1 : ArrayBuffer,
	'%ArrayIteratorPrototype%': hasSymbols ? getProto$1([][Symbol.iterator]()) : undefined$1,
	'%AsyncFromSyncIteratorPrototype%': undefined$1,
	'%AsyncFunction%': needsEval,
	'%AsyncGenerator%': needsEval,
	'%AsyncGeneratorFunction%': needsEval,
	'%AsyncIteratorPrototype%': needsEval,
	'%Atomics%': typeof Atomics === 'undefined' ? undefined$1 : Atomics,
	'%BigInt%': typeof BigInt === 'undefined' ? undefined$1 : BigInt,
	'%Boolean%': Boolean,
	'%DataView%': typeof DataView === 'undefined' ? undefined$1 : DataView,
	'%Date%': Date,
	'%decodeURI%': decodeURI,
	'%decodeURIComponent%': decodeURIComponent,
	'%encodeURI%': encodeURI,
	'%encodeURIComponent%': encodeURIComponent,
	'%Error%': Error,
	'%eval%': eval, // eslint-disable-line no-eval
	'%EvalError%': EvalError,
	'%Float32Array%': typeof Float32Array === 'undefined' ? undefined$1 : Float32Array,
	'%Float64Array%': typeof Float64Array === 'undefined' ? undefined$1 : Float64Array,
	'%FinalizationRegistry%': typeof FinalizationRegistry === 'undefined' ? undefined$1 : FinalizationRegistry,
	'%Function%': $Function,
	'%GeneratorFunction%': needsEval,
	'%Int8Array%': typeof Int8Array === 'undefined' ? undefined$1 : Int8Array,
	'%Int16Array%': typeof Int16Array === 'undefined' ? undefined$1 : Int16Array,
	'%Int32Array%': typeof Int32Array === 'undefined' ? undefined$1 : Int32Array,
	'%isFinite%': isFinite,
	'%isNaN%': isNaN,
	'%IteratorPrototype%': hasSymbols ? getProto$1(getProto$1([][Symbol.iterator]())) : undefined$1,
	'%JSON%': typeof JSON === 'object' ? JSON : undefined$1,
	'%Map%': typeof Map === 'undefined' ? undefined$1 : Map,
	'%MapIteratorPrototype%': typeof Map === 'undefined' || !hasSymbols ? undefined$1 : getProto$1(new Map()[Symbol.iterator]()),
	'%Math%': Math,
	'%Number%': Number,
	'%Object%': Object,
	'%parseFloat%': parseFloat,
	'%parseInt%': parseInt,
	'%Promise%': typeof Promise === 'undefined' ? undefined$1 : Promise,
	'%Proxy%': typeof Proxy === 'undefined' ? undefined$1 : Proxy,
	'%RangeError%': RangeError,
	'%ReferenceError%': ReferenceError,
	'%Reflect%': typeof Reflect === 'undefined' ? undefined$1 : Reflect,
	'%RegExp%': RegExp,
	'%Set%': typeof Set === 'undefined' ? undefined$1 : Set,
	'%SetIteratorPrototype%': typeof Set === 'undefined' || !hasSymbols ? undefined$1 : getProto$1(new Set()[Symbol.iterator]()),
	'%SharedArrayBuffer%': typeof SharedArrayBuffer === 'undefined' ? undefined$1 : SharedArrayBuffer,
	'%String%': String,
	'%StringIteratorPrototype%': hasSymbols ? getProto$1(''[Symbol.iterator]()) : undefined$1,
	'%Symbol%': hasSymbols ? Symbol : undefined$1,
	'%SyntaxError%': $SyntaxError,
	'%ThrowTypeError%': ThrowTypeError,
	'%TypedArray%': TypedArray,
	'%TypeError%': $TypeError,
	'%Uint8Array%': typeof Uint8Array === 'undefined' ? undefined$1 : Uint8Array,
	'%Uint8ClampedArray%': typeof Uint8ClampedArray === 'undefined' ? undefined$1 : Uint8ClampedArray,
	'%Uint16Array%': typeof Uint16Array === 'undefined' ? undefined$1 : Uint16Array,
	'%Uint32Array%': typeof Uint32Array === 'undefined' ? undefined$1 : Uint32Array,
	'%URIError%': URIError,
	'%WeakMap%': typeof WeakMap === 'undefined' ? undefined$1 : WeakMap,
	'%WeakRef%': typeof WeakRef === 'undefined' ? undefined$1 : WeakRef,
	'%WeakSet%': typeof WeakSet === 'undefined' ? undefined$1 : WeakSet
};

var doEval = function doEval(name) {
	var value;
	if (name === '%AsyncFunction%') {
		value = getEvalledConstructor('async function () {}');
	} else if (name === '%GeneratorFunction%') {
		value = getEvalledConstructor('function* () {}');
	} else if (name === '%AsyncGeneratorFunction%') {
		value = getEvalledConstructor('async function* () {}');
	} else if (name === '%AsyncGenerator%') {
		var fn = doEval('%AsyncGeneratorFunction%');
		if (fn) {
			value = fn.prototype;
		}
	} else if (name === '%AsyncIteratorPrototype%') {
		var gen = doEval('%AsyncGenerator%');
		if (gen) {
			value = getProto$1(gen.prototype);
		}
	}

	INTRINSICS[name] = value;

	return value;
};

var LEGACY_ALIASES = {
	'%ArrayBufferPrototype%': ['ArrayBuffer', 'prototype'],
	'%ArrayPrototype%': ['Array', 'prototype'],
	'%ArrayProto_entries%': ['Array', 'prototype', 'entries'],
	'%ArrayProto_forEach%': ['Array', 'prototype', 'forEach'],
	'%ArrayProto_keys%': ['Array', 'prototype', 'keys'],
	'%ArrayProto_values%': ['Array', 'prototype', 'values'],
	'%AsyncFunctionPrototype%': ['AsyncFunction', 'prototype'],
	'%AsyncGenerator%': ['AsyncGeneratorFunction', 'prototype'],
	'%AsyncGeneratorPrototype%': ['AsyncGeneratorFunction', 'prototype', 'prototype'],
	'%BooleanPrototype%': ['Boolean', 'prototype'],
	'%DataViewPrototype%': ['DataView', 'prototype'],
	'%DatePrototype%': ['Date', 'prototype'],
	'%ErrorPrototype%': ['Error', 'prototype'],
	'%EvalErrorPrototype%': ['EvalError', 'prototype'],
	'%Float32ArrayPrototype%': ['Float32Array', 'prototype'],
	'%Float64ArrayPrototype%': ['Float64Array', 'prototype'],
	'%FunctionPrototype%': ['Function', 'prototype'],
	'%Generator%': ['GeneratorFunction', 'prototype'],
	'%GeneratorPrototype%': ['GeneratorFunction', 'prototype', 'prototype'],
	'%Int8ArrayPrototype%': ['Int8Array', 'prototype'],
	'%Int16ArrayPrototype%': ['Int16Array', 'prototype'],
	'%Int32ArrayPrototype%': ['Int32Array', 'prototype'],
	'%JSONParse%': ['JSON', 'parse'],
	'%JSONStringify%': ['JSON', 'stringify'],
	'%MapPrototype%': ['Map', 'prototype'],
	'%NumberPrototype%': ['Number', 'prototype'],
	'%ObjectPrototype%': ['Object', 'prototype'],
	'%ObjProto_toString%': ['Object', 'prototype', 'toString'],
	'%ObjProto_valueOf%': ['Object', 'prototype', 'valueOf'],
	'%PromisePrototype%': ['Promise', 'prototype'],
	'%PromiseProto_then%': ['Promise', 'prototype', 'then'],
	'%Promise_all%': ['Promise', 'all'],
	'%Promise_reject%': ['Promise', 'reject'],
	'%Promise_resolve%': ['Promise', 'resolve'],
	'%RangeErrorPrototype%': ['RangeError', 'prototype'],
	'%ReferenceErrorPrototype%': ['ReferenceError', 'prototype'],
	'%RegExpPrototype%': ['RegExp', 'prototype'],
	'%SetPrototype%': ['Set', 'prototype'],
	'%SharedArrayBufferPrototype%': ['SharedArrayBuffer', 'prototype'],
	'%StringPrototype%': ['String', 'prototype'],
	'%SymbolPrototype%': ['Symbol', 'prototype'],
	'%SyntaxErrorPrototype%': ['SyntaxError', 'prototype'],
	'%TypedArrayPrototype%': ['TypedArray', 'prototype'],
	'%TypeErrorPrototype%': ['TypeError', 'prototype'],
	'%Uint8ArrayPrototype%': ['Uint8Array', 'prototype'],
	'%Uint8ClampedArrayPrototype%': ['Uint8ClampedArray', 'prototype'],
	'%Uint16ArrayPrototype%': ['Uint16Array', 'prototype'],
	'%Uint32ArrayPrototype%': ['Uint32Array', 'prototype'],
	'%URIErrorPrototype%': ['URIError', 'prototype'],
	'%WeakMapPrototype%': ['WeakMap', 'prototype'],
	'%WeakSetPrototype%': ['WeakSet', 'prototype']
};

var bind = functionBind;
var hasOwn = src;
var $concat = bind.call(Function.call, Array.prototype.concat);
var $spliceApply = bind.call(Function.apply, Array.prototype.splice);
var $replace = bind.call(Function.call, String.prototype.replace);
var $strSlice = bind.call(Function.call, String.prototype.slice);
var $exec = bind.call(Function.call, RegExp.prototype.exec);

/* adapted from https://github.com/lodash/lodash/blob/4.17.15/dist/lodash.js#L6735-L6744 */
var rePropName = /[^%.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|%$))/g;
var reEscapeChar = /\\(\\)?/g; /** Used to match backslashes in property paths. */
var stringToPath = function stringToPath(string) {
	var first = $strSlice(string, 0, 1);
	var last = $strSlice(string, -1);
	if (first === '%' && last !== '%') {
		throw new $SyntaxError('invalid intrinsic syntax, expected closing `%`');
	} else if (last === '%' && first !== '%') {
		throw new $SyntaxError('invalid intrinsic syntax, expected opening `%`');
	}
	var result = [];
	$replace(string, rePropName, function (match, number, quote, subString) {
		result[result.length] = quote ? $replace(subString, reEscapeChar, '$1') : number || match;
	});
	return result;
};
/* end adaptation */

var getBaseIntrinsic = function getBaseIntrinsic(name, allowMissing) {
	var intrinsicName = name;
	var alias;
	if (hasOwn(LEGACY_ALIASES, intrinsicName)) {
		alias = LEGACY_ALIASES[intrinsicName];
		intrinsicName = '%' + alias[0] + '%';
	}

	if (hasOwn(INTRINSICS, intrinsicName)) {
		var value = INTRINSICS[intrinsicName];
		if (value === needsEval) {
			value = doEval(intrinsicName);
		}
		if (typeof value === 'undefined' && !allowMissing) {
			throw new $TypeError('intrinsic ' + name + ' exists, but is not available. Please file an issue!');
		}

		return {
			alias: alias,
			name: intrinsicName,
			value: value
		};
	}

	throw new $SyntaxError('intrinsic ' + name + ' does not exist!');
};

var getIntrinsic = function GetIntrinsic(name, allowMissing) {
	if (typeof name !== 'string' || name.length === 0) {
		throw new $TypeError('intrinsic name must be a non-empty string');
	}
	if (arguments.length > 1 && typeof allowMissing !== 'boolean') {
		throw new $TypeError('"allowMissing" argument must be a boolean');
	}

	if ($exec(/^%?[^%]*%?$/, name) === null) {
		throw new $SyntaxError('`%` may not be present anywhere but at the beginning and end of the intrinsic name');
	}
	var parts = stringToPath(name);
	var intrinsicBaseName = parts.length > 0 ? parts[0] : '';

	var intrinsic = getBaseIntrinsic('%' + intrinsicBaseName + '%', allowMissing);
	var intrinsicRealName = intrinsic.name;
	var value = intrinsic.value;
	var skipFurtherCaching = false;

	var alias = intrinsic.alias;
	if (alias) {
		intrinsicBaseName = alias[0];
		$spliceApply(parts, $concat([0, 1], alias));
	}

	for (var i = 1, isOwn = true; i < parts.length; i += 1) {
		var part = parts[i];
		var first = $strSlice(part, 0, 1);
		var last = $strSlice(part, -1);
		if (
			(
				(first === '"' || first === "'" || first === '`')
				|| (last === '"' || last === "'" || last === '`')
			)
			&& first !== last
		) {
			throw new $SyntaxError('property names with quotes must have matching quotes');
		}
		if (part === 'constructor' || !isOwn) {
			skipFurtherCaching = true;
		}

		intrinsicBaseName += '.' + part;
		intrinsicRealName = '%' + intrinsicBaseName + '%';

		if (hasOwn(INTRINSICS, intrinsicRealName)) {
			value = INTRINSICS[intrinsicRealName];
		} else if (value != null) {
			if (!(part in value)) {
				if (!allowMissing) {
					throw new $TypeError('base intrinsic for ' + name + ' exists, but the property is not available.');
				}
				return void undefined$1;
			}
			if ($gOPD && (i + 1) >= parts.length) {
				var desc = $gOPD(value, part);
				isOwn = !!desc;

				// By convention, when a data property is converted to an accessor
				// property to emulate a data property that does not suffer from
				// the override mistake, that accessor's getter is marked with
				// an `originalValue` property. Here, when we detect this, we
				// uphold the illusion by pretending to see that original data
				// property, i.e., returning the value rather than the getter
				// itself.
				if (isOwn && 'get' in desc && !('originalValue' in desc.get)) {
					value = desc.get;
				} else {
					value = value[part];
				}
			} else {
				isOwn = hasOwn(value, part);
				value = value[part];
			}

			if (isOwn && !skipFurtherCaching) {
				INTRINSICS[intrinsicRealName] = value;
			}
		}
	}
	return value;
};

var callBindExports = {};
var callBind$1 = {
  get exports(){ return callBindExports; },
  set exports(v){ callBindExports = v; },
};

(function (module) {

	var bind = functionBind;
	var GetIntrinsic = getIntrinsic;

	var $apply = GetIntrinsic('%Function.prototype.apply%');
	var $call = GetIntrinsic('%Function.prototype.call%');
	var $reflectApply = GetIntrinsic('%Reflect.apply%', true) || bind.call($call, $apply);

	var $gOPD = GetIntrinsic('%Object.getOwnPropertyDescriptor%', true);
	var $defineProperty = GetIntrinsic('%Object.defineProperty%', true);
	var $max = GetIntrinsic('%Math.max%');

	if ($defineProperty) {
		try {
			$defineProperty({}, 'a', { value: 1 });
		} catch (e) {
			// IE 8 has a broken defineProperty
			$defineProperty = null;
		}
	}

	module.exports = function callBind(originalFunction) {
		var func = $reflectApply(bind, $call, arguments);
		if ($gOPD && $defineProperty) {
			var desc = $gOPD(func, 'length');
			if (desc.configurable) {
				// original length, plus the receiver, minus any additional arguments (after the receiver)
				$defineProperty(
					func,
					'length',
					{ value: 1 + $max(0, originalFunction.length - (arguments.length - 1)) }
				);
			}
		}
		return func;
	};

	var applyBind = function applyBind() {
		return $reflectApply(bind, $apply, arguments);
	};

	if ($defineProperty) {
		$defineProperty(module.exports, 'apply', { value: applyBind });
	} else {
		module.exports.apply = applyBind;
	}
} (callBind$1));

var GetIntrinsic = getIntrinsic;

var callBind = callBindExports;

var $indexOf$1 = callBind(GetIntrinsic('String.prototype.indexOf'));

var callBound$3 = function callBoundIntrinsic(name, allowMissing) {
	var intrinsic = GetIntrinsic(name, !!allowMissing);
	if (typeof intrinsic === 'function' && $indexOf$1(name, '.prototype.') > -1) {
		return callBind(intrinsic);
	}
	return intrinsic;
};

var hasToStringTag$4 = shams();
var callBound$2 = callBound$3;

var $toString$2 = callBound$2('Object.prototype.toString');

var isStandardArguments = function isArguments(value) {
	if (hasToStringTag$4 && value && typeof value === 'object' && Symbol.toStringTag in value) {
		return false;
	}
	return $toString$2(value) === '[object Arguments]';
};

var isLegacyArguments = function isArguments(value) {
	if (isStandardArguments(value)) {
		return true;
	}
	return value !== null &&
		typeof value === 'object' &&
		typeof value.length === 'number' &&
		value.length >= 0 &&
		$toString$2(value) !== '[object Array]' &&
		$toString$2(value.callee) === '[object Function]';
};

var supportsStandardArguments = (function () {
	return isStandardArguments(arguments);
}());

isStandardArguments.isLegacyArguments = isLegacyArguments; // for tests

var isArguments = supportsStandardArguments ? isStandardArguments : isLegacyArguments;

var toStr$2 = Object.prototype.toString;
var fnToStr$1 = Function.prototype.toString;
var isFnRegex = /^\s*(?:function)?\*/;
var hasToStringTag$3 = shams();
var getProto = Object.getPrototypeOf;
var getGeneratorFunc = function () { // eslint-disable-line consistent-return
	if (!hasToStringTag$3) {
		return false;
	}
	try {
		return Function('return function*() {}')();
	} catch (e) {
	}
};
var GeneratorFunction;

var isGeneratorFunction = function isGeneratorFunction(fn) {
	if (typeof fn !== 'function') {
		return false;
	}
	if (isFnRegex.test(fnToStr$1.call(fn))) {
		return true;
	}
	if (!hasToStringTag$3) {
		var str = toStr$2.call(fn);
		return str === '[object GeneratorFunction]';
	}
	if (!getProto) {
		return false;
	}
	if (typeof GeneratorFunction === 'undefined') {
		var generatorFunc = getGeneratorFunc();
		GeneratorFunction = generatorFunc ? getProto(generatorFunc) : false;
	}
	return getProto(fn) === GeneratorFunction;
};

var fnToStr = Function.prototype.toString;
var reflectApply = typeof Reflect === 'object' && Reflect !== null && Reflect.apply;
var badArrayLike;
var isCallableMarker;
if (typeof reflectApply === 'function' && typeof Object.defineProperty === 'function') {
	try {
		badArrayLike = Object.defineProperty({}, 'length', {
			get: function () {
				throw isCallableMarker;
			}
		});
		isCallableMarker = {};
		// eslint-disable-next-line no-throw-literal
		reflectApply(function () { throw 42; }, null, badArrayLike);
	} catch (_) {
		if (_ !== isCallableMarker) {
			reflectApply = null;
		}
	}
} else {
	reflectApply = null;
}

var constructorRegex = /^\s*class\b/;
var isES6ClassFn = function isES6ClassFunction(value) {
	try {
		var fnStr = fnToStr.call(value);
		return constructorRegex.test(fnStr);
	} catch (e) {
		return false; // not a function
	}
};

var tryFunctionObject = function tryFunctionToStr(value) {
	try {
		if (isES6ClassFn(value)) { return false; }
		fnToStr.call(value);
		return true;
	} catch (e) {
		return false;
	}
};
var toStr$1 = Object.prototype.toString;
var objectClass = '[object Object]';
var fnClass = '[object Function]';
var genClass = '[object GeneratorFunction]';
var ddaClass = '[object HTMLAllCollection]'; // IE 11
var ddaClass2 = '[object HTML document.all class]';
var ddaClass3 = '[object HTMLCollection]'; // IE 9-10
var hasToStringTag$2 = typeof Symbol === 'function' && !!Symbol.toStringTag; // better: use `has-tostringtag`

var isIE68 = !(0 in [,]); // eslint-disable-line no-sparse-arrays, comma-spacing

var isDDA = function isDocumentDotAll() { return false; };
if (typeof document === 'object') {
	// Firefox 3 canonicalizes DDA to undefined when it's not accessed directly
	var all = document.all;
	if (toStr$1.call(all) === toStr$1.call(document.all)) {
		isDDA = function isDocumentDotAll(value) {
			/* globals document: false */
			// in IE 6-8, typeof document.all is "object" and it's truthy
			if ((isIE68 || !value) && (typeof value === 'undefined' || typeof value === 'object')) {
				try {
					var str = toStr$1.call(value);
					return (
						str === ddaClass
						|| str === ddaClass2
						|| str === ddaClass3 // opera 12.16
						|| str === objectClass // IE 6-8
					) && value('') == null; // eslint-disable-line eqeqeq
				} catch (e) { /**/ }
			}
			return false;
		};
	}
}

var isCallable$1 = reflectApply
	? function isCallable(value) {
		if (isDDA(value)) { return true; }
		if (!value) { return false; }
		if (typeof value !== 'function' && typeof value !== 'object') { return false; }
		try {
			reflectApply(value, null, badArrayLike);
		} catch (e) {
			if (e !== isCallableMarker) { return false; }
		}
		return !isES6ClassFn(value) && tryFunctionObject(value);
	}
	: function isCallable(value) {
		if (isDDA(value)) { return true; }
		if (!value) { return false; }
		if (typeof value !== 'function' && typeof value !== 'object') { return false; }
		if (hasToStringTag$2) { return tryFunctionObject(value); }
		if (isES6ClassFn(value)) { return false; }
		var strClass = toStr$1.call(value);
		if (strClass !== fnClass && strClass !== genClass && !(/^\[object HTML/).test(strClass)) { return false; }
		return tryFunctionObject(value);
	};

var isCallable = isCallable$1;

var toStr = Object.prototype.toString;
var hasOwnProperty = Object.prototype.hasOwnProperty;

var forEachArray = function forEachArray(array, iterator, receiver) {
    for (var i = 0, len = array.length; i < len; i++) {
        if (hasOwnProperty.call(array, i)) {
            if (receiver == null) {
                iterator(array[i], i, array);
            } else {
                iterator.call(receiver, array[i], i, array);
            }
        }
    }
};

var forEachString = function forEachString(string, iterator, receiver) {
    for (var i = 0, len = string.length; i < len; i++) {
        // no such thing as a sparse string.
        if (receiver == null) {
            iterator(string.charAt(i), i, string);
        } else {
            iterator.call(receiver, string.charAt(i), i, string);
        }
    }
};

var forEachObject = function forEachObject(object, iterator, receiver) {
    for (var k in object) {
        if (hasOwnProperty.call(object, k)) {
            if (receiver == null) {
                iterator(object[k], k, object);
            } else {
                iterator.call(receiver, object[k], k, object);
            }
        }
    }
};

var forEach$3 = function forEach(list, iterator, thisArg) {
    if (!isCallable(iterator)) {
        throw new TypeError('iterator must be a function');
    }

    var receiver;
    if (arguments.length >= 3) {
        receiver = thisArg;
    }

    if (toStr.call(list) === '[object Array]') {
        forEachArray(list, iterator, receiver);
    } else if (typeof list === 'string') {
        forEachString(list, iterator, receiver);
    } else {
        forEachObject(list, iterator, receiver);
    }
};

var forEach_1 = forEach$3;

var possibleNames = [
	'BigInt64Array',
	'BigUint64Array',
	'Float32Array',
	'Float64Array',
	'Int16Array',
	'Int32Array',
	'Int8Array',
	'Uint16Array',
	'Uint32Array',
	'Uint8Array',
	'Uint8ClampedArray'
];

var g$2 = typeof globalThis === 'undefined' ? commonjsGlobal : globalThis;

var availableTypedArrays$2 = function availableTypedArrays() {
	var out = [];
	for (var i = 0; i < possibleNames.length; i++) {
		if (typeof g$2[possibleNames[i]] === 'function') {
			out[out.length] = possibleNames[i];
		}
	}
	return out;
};

var getOwnPropertyDescriptor;
var hasRequiredGetOwnPropertyDescriptor;

function requireGetOwnPropertyDescriptor () {
	if (hasRequiredGetOwnPropertyDescriptor) return getOwnPropertyDescriptor;
	hasRequiredGetOwnPropertyDescriptor = 1;

	var GetIntrinsic = getIntrinsic;

	var $gOPD = GetIntrinsic('%Object.getOwnPropertyDescriptor%', true);
	if ($gOPD) {
		try {
			$gOPD([], 'length');
		} catch (e) {
			// IE 8 has a broken gOPD
			$gOPD = null;
		}
	}

	getOwnPropertyDescriptor = $gOPD;
	return getOwnPropertyDescriptor;
}

var forEach$2 = forEach_1;
var availableTypedArrays$1 = availableTypedArrays$2;
var callBound$1 = callBound$3;

var $toString$1 = callBound$1('Object.prototype.toString');
var hasToStringTag$1 = shams();

var g$1 = typeof globalThis === 'undefined' ? commonjsGlobal : globalThis;
var typedArrays$1 = availableTypedArrays$1();

var $indexOf = callBound$1('Array.prototype.indexOf', true) || function indexOf(array, value) {
	for (var i = 0; i < array.length; i += 1) {
		if (array[i] === value) {
			return i;
		}
	}
	return -1;
};
var $slice$1 = callBound$1('String.prototype.slice');
var toStrTags$1 = {};
var gOPD$1 = requireGetOwnPropertyDescriptor();
var getPrototypeOf$1 = Object.getPrototypeOf; // require('getprototypeof');
if (hasToStringTag$1 && gOPD$1 && getPrototypeOf$1) {
	forEach$2(typedArrays$1, function (typedArray) {
		var arr = new g$1[typedArray]();
		if (Symbol.toStringTag in arr) {
			var proto = getPrototypeOf$1(arr);
			var descriptor = gOPD$1(proto, Symbol.toStringTag);
			if (!descriptor) {
				var superProto = getPrototypeOf$1(proto);
				descriptor = gOPD$1(superProto, Symbol.toStringTag);
			}
			toStrTags$1[typedArray] = descriptor.get;
		}
	});
}

var tryTypedArrays$1 = function tryAllTypedArrays(value) {
	var anyTrue = false;
	forEach$2(toStrTags$1, function (getter, typedArray) {
		if (!anyTrue) {
			try {
				anyTrue = getter.call(value) === typedArray;
			} catch (e) { /**/ }
		}
	});
	return anyTrue;
};

var isTypedArray$1 = function isTypedArray(value) {
	if (!value || typeof value !== 'object') { return false; }
	if (!hasToStringTag$1 || !(Symbol.toStringTag in value)) {
		var tag = $slice$1($toString$1(value), 8, -1);
		return $indexOf(typedArrays$1, tag) > -1;
	}
	if (!gOPD$1) { return false; }
	return tryTypedArrays$1(value);
};

var forEach$1 = forEach_1;
var availableTypedArrays = availableTypedArrays$2;
var callBound = callBound$3;

var $toString = callBound('Object.prototype.toString');
var hasToStringTag = shams();

var g = typeof globalThis === 'undefined' ? commonjsGlobal : globalThis;
var typedArrays = availableTypedArrays();

var $slice = callBound('String.prototype.slice');
var toStrTags = {};
var gOPD = requireGetOwnPropertyDescriptor();
var getPrototypeOf = Object.getPrototypeOf; // require('getprototypeof');
if (hasToStringTag && gOPD && getPrototypeOf) {
	forEach$1(typedArrays, function (typedArray) {
		if (typeof g[typedArray] === 'function') {
			var arr = new g[typedArray]();
			if (Symbol.toStringTag in arr) {
				var proto = getPrototypeOf(arr);
				var descriptor = gOPD(proto, Symbol.toStringTag);
				if (!descriptor) {
					var superProto = getPrototypeOf(proto);
					descriptor = gOPD(superProto, Symbol.toStringTag);
				}
				toStrTags[typedArray] = descriptor.get;
			}
		}
	});
}

var tryTypedArrays = function tryAllTypedArrays(value) {
	var foundName = false;
	forEach$1(toStrTags, function (getter, typedArray) {
		if (!foundName) {
			try {
				var name = getter.call(value);
				if (name === typedArray) {
					foundName = name;
				}
			} catch (e) {}
		}
	});
	return foundName;
};

var isTypedArray = isTypedArray$1;

var whichTypedArray = function whichTypedArray(value) {
	if (!isTypedArray(value)) { return false; }
	if (!hasToStringTag || !(Symbol.toStringTag in value)) { return $slice($toString(value), 8, -1); }
	return tryTypedArrays(value);
};

(function (exports) {

	var isArgumentsObject = isArguments;
	var isGeneratorFunction$1 = isGeneratorFunction;
	var whichTypedArray$1 = whichTypedArray;
	var isTypedArray = isTypedArray$1;

	function uncurryThis(f) {
	  return f.call.bind(f);
	}

	var BigIntSupported = typeof BigInt !== 'undefined';
	var SymbolSupported = typeof Symbol !== 'undefined';

	var ObjectToString = uncurryThis(Object.prototype.toString);

	var numberValue = uncurryThis(Number.prototype.valueOf);
	var stringValue = uncurryThis(String.prototype.valueOf);
	var booleanValue = uncurryThis(Boolean.prototype.valueOf);

	if (BigIntSupported) {
	  var bigIntValue = uncurryThis(BigInt.prototype.valueOf);
	}

	if (SymbolSupported) {
	  var symbolValue = uncurryThis(Symbol.prototype.valueOf);
	}

	function checkBoxedPrimitive(value, prototypeValueOf) {
	  if (typeof value !== 'object') {
	    return false;
	  }
	  try {
	    prototypeValueOf(value);
	    return true;
	  } catch(e) {
	    return false;
	  }
	}

	exports.isArgumentsObject = isArgumentsObject;
	exports.isGeneratorFunction = isGeneratorFunction$1;
	exports.isTypedArray = isTypedArray;

	// Taken from here and modified for better browser support
	// https://github.com/sindresorhus/p-is-promise/blob/cda35a513bda03f977ad5cde3a079d237e82d7ef/index.js
	function isPromise(input) {
		return (
			(
				typeof Promise !== 'undefined' &&
				input instanceof Promise
			) ||
			(
				input !== null &&
				typeof input === 'object' &&
				typeof input.then === 'function' &&
				typeof input.catch === 'function'
			)
		);
	}
	exports.isPromise = isPromise;

	function isArrayBufferView(value) {
	  if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView) {
	    return ArrayBuffer.isView(value);
	  }

	  return (
	    isTypedArray(value) ||
	    isDataView(value)
	  );
	}
	exports.isArrayBufferView = isArrayBufferView;


	function isUint8Array(value) {
	  return whichTypedArray$1(value) === 'Uint8Array';
	}
	exports.isUint8Array = isUint8Array;

	function isUint8ClampedArray(value) {
	  return whichTypedArray$1(value) === 'Uint8ClampedArray';
	}
	exports.isUint8ClampedArray = isUint8ClampedArray;

	function isUint16Array(value) {
	  return whichTypedArray$1(value) === 'Uint16Array';
	}
	exports.isUint16Array = isUint16Array;

	function isUint32Array(value) {
	  return whichTypedArray$1(value) === 'Uint32Array';
	}
	exports.isUint32Array = isUint32Array;

	function isInt8Array(value) {
	  return whichTypedArray$1(value) === 'Int8Array';
	}
	exports.isInt8Array = isInt8Array;

	function isInt16Array(value) {
	  return whichTypedArray$1(value) === 'Int16Array';
	}
	exports.isInt16Array = isInt16Array;

	function isInt32Array(value) {
	  return whichTypedArray$1(value) === 'Int32Array';
	}
	exports.isInt32Array = isInt32Array;

	function isFloat32Array(value) {
	  return whichTypedArray$1(value) === 'Float32Array';
	}
	exports.isFloat32Array = isFloat32Array;

	function isFloat64Array(value) {
	  return whichTypedArray$1(value) === 'Float64Array';
	}
	exports.isFloat64Array = isFloat64Array;

	function isBigInt64Array(value) {
	  return whichTypedArray$1(value) === 'BigInt64Array';
	}
	exports.isBigInt64Array = isBigInt64Array;

	function isBigUint64Array(value) {
	  return whichTypedArray$1(value) === 'BigUint64Array';
	}
	exports.isBigUint64Array = isBigUint64Array;

	function isMapToString(value) {
	  return ObjectToString(value) === '[object Map]';
	}
	isMapToString.working = (
	  typeof Map !== 'undefined' &&
	  isMapToString(new Map())
	);

	function isMap(value) {
	  if (typeof Map === 'undefined') {
	    return false;
	  }

	  return isMapToString.working
	    ? isMapToString(value)
	    : value instanceof Map;
	}
	exports.isMap = isMap;

	function isSetToString(value) {
	  return ObjectToString(value) === '[object Set]';
	}
	isSetToString.working = (
	  typeof Set !== 'undefined' &&
	  isSetToString(new Set())
	);
	function isSet(value) {
	  if (typeof Set === 'undefined') {
	    return false;
	  }

	  return isSetToString.working
	    ? isSetToString(value)
	    : value instanceof Set;
	}
	exports.isSet = isSet;

	function isWeakMapToString(value) {
	  return ObjectToString(value) === '[object WeakMap]';
	}
	isWeakMapToString.working = (
	  typeof WeakMap !== 'undefined' &&
	  isWeakMapToString(new WeakMap())
	);
	function isWeakMap(value) {
	  if (typeof WeakMap === 'undefined') {
	    return false;
	  }

	  return isWeakMapToString.working
	    ? isWeakMapToString(value)
	    : value instanceof WeakMap;
	}
	exports.isWeakMap = isWeakMap;

	function isWeakSetToString(value) {
	  return ObjectToString(value) === '[object WeakSet]';
	}
	isWeakSetToString.working = (
	  typeof WeakSet !== 'undefined' &&
	  isWeakSetToString(new WeakSet())
	);
	function isWeakSet(value) {
	  return isWeakSetToString(value);
	}
	exports.isWeakSet = isWeakSet;

	function isArrayBufferToString(value) {
	  return ObjectToString(value) === '[object ArrayBuffer]';
	}
	isArrayBufferToString.working = (
	  typeof ArrayBuffer !== 'undefined' &&
	  isArrayBufferToString(new ArrayBuffer())
	);
	function isArrayBuffer(value) {
	  if (typeof ArrayBuffer === 'undefined') {
	    return false;
	  }

	  return isArrayBufferToString.working
	    ? isArrayBufferToString(value)
	    : value instanceof ArrayBuffer;
	}
	exports.isArrayBuffer = isArrayBuffer;

	function isDataViewToString(value) {
	  return ObjectToString(value) === '[object DataView]';
	}
	isDataViewToString.working = (
	  typeof ArrayBuffer !== 'undefined' &&
	  typeof DataView !== 'undefined' &&
	  isDataViewToString(new DataView(new ArrayBuffer(1), 0, 1))
	);
	function isDataView(value) {
	  if (typeof DataView === 'undefined') {
	    return false;
	  }

	  return isDataViewToString.working
	    ? isDataViewToString(value)
	    : value instanceof DataView;
	}
	exports.isDataView = isDataView;

	// Store a copy of SharedArrayBuffer in case it's deleted elsewhere
	var SharedArrayBufferCopy = typeof SharedArrayBuffer !== 'undefined' ? SharedArrayBuffer : undefined;
	function isSharedArrayBufferToString(value) {
	  return ObjectToString(value) === '[object SharedArrayBuffer]';
	}
	function isSharedArrayBuffer(value) {
	  if (typeof SharedArrayBufferCopy === 'undefined') {
	    return false;
	  }

	  if (typeof isSharedArrayBufferToString.working === 'undefined') {
	    isSharedArrayBufferToString.working = isSharedArrayBufferToString(new SharedArrayBufferCopy());
	  }

	  return isSharedArrayBufferToString.working
	    ? isSharedArrayBufferToString(value)
	    : value instanceof SharedArrayBufferCopy;
	}
	exports.isSharedArrayBuffer = isSharedArrayBuffer;

	function isAsyncFunction(value) {
	  return ObjectToString(value) === '[object AsyncFunction]';
	}
	exports.isAsyncFunction = isAsyncFunction;

	function isMapIterator(value) {
	  return ObjectToString(value) === '[object Map Iterator]';
	}
	exports.isMapIterator = isMapIterator;

	function isSetIterator(value) {
	  return ObjectToString(value) === '[object Set Iterator]';
	}
	exports.isSetIterator = isSetIterator;

	function isGeneratorObject(value) {
	  return ObjectToString(value) === '[object Generator]';
	}
	exports.isGeneratorObject = isGeneratorObject;

	function isWebAssemblyCompiledModule(value) {
	  return ObjectToString(value) === '[object WebAssembly.Module]';
	}
	exports.isWebAssemblyCompiledModule = isWebAssemblyCompiledModule;

	function isNumberObject(value) {
	  return checkBoxedPrimitive(value, numberValue);
	}
	exports.isNumberObject = isNumberObject;

	function isStringObject(value) {
	  return checkBoxedPrimitive(value, stringValue);
	}
	exports.isStringObject = isStringObject;

	function isBooleanObject(value) {
	  return checkBoxedPrimitive(value, booleanValue);
	}
	exports.isBooleanObject = isBooleanObject;

	function isBigIntObject(value) {
	  return BigIntSupported && checkBoxedPrimitive(value, bigIntValue);
	}
	exports.isBigIntObject = isBigIntObject;

	function isSymbolObject(value) {
	  return SymbolSupported && checkBoxedPrimitive(value, symbolValue);
	}
	exports.isSymbolObject = isSymbolObject;

	function isBoxedPrimitive(value) {
	  return (
	    isNumberObject(value) ||
	    isStringObject(value) ||
	    isBooleanObject(value) ||
	    isBigIntObject(value) ||
	    isSymbolObject(value)
	  );
	}
	exports.isBoxedPrimitive = isBoxedPrimitive;

	function isAnyArrayBuffer(value) {
	  return typeof Uint8Array !== 'undefined' && (
	    isArrayBuffer(value) ||
	    isSharedArrayBuffer(value)
	  );
	}
	exports.isAnyArrayBuffer = isAnyArrayBuffer;

	['isProxy', 'isExternal', 'isModuleNamespaceObject'].forEach(function(method) {
	  Object.defineProperty(exports, method, {
	    enumerable: false,
	    value: function() {
	      throw new Error(method + ' is not supported in userland');
	    }
	  });
	});
} (types$1));

var isBuffer = function isBuffer(arg) {
  return arg instanceof Buffer;
};

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
		  var util = requireUtil();
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

var hasRequiredUtil;

function requireUtil () {
	if (hasRequiredUtil) return util;
	hasRequiredUtil = 1;
	(function (exports) {
		// Copyright Joyent, Inc. and other Node contributors.
		//
		// Permission is hereby granted, free of charge, to any person obtaining a
		// copy of this software and associated documentation files (the
		// "Software"), to deal in the Software without restriction, including
		// without limitation the rights to use, copy, modify, merge, publish,
		// distribute, sublicense, and/or sell copies of the Software, and to permit
		// persons to whom the Software is furnished to do so, subject to the
		// following conditions:
		//
		// The above copyright notice and this permission notice shall be included
		// in all copies or substantial portions of the Software.
		//
		// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
		// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
		// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
		// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
		// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
		// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
		// USE OR OTHER DEALINGS IN THE SOFTWARE.

		var getOwnPropertyDescriptors = Object.getOwnPropertyDescriptors ||
		  function getOwnPropertyDescriptors(obj) {
		    var keys = Object.keys(obj);
		    var descriptors = {};
		    for (var i = 0; i < keys.length; i++) {
		      descriptors[keys[i]] = Object.getOwnPropertyDescriptor(obj, keys[i]);
		    }
		    return descriptors;
		  };

		var formatRegExp = /%[sdj%]/g;
		exports.format = function(f) {
		  if (!isString(f)) {
		    var objects = [];
		    for (var i = 0; i < arguments.length; i++) {
		      objects.push(inspect(arguments[i]));
		    }
		    return objects.join(' ');
		  }

		  var i = 1;
		  var args = arguments;
		  var len = args.length;
		  var str = String(f).replace(formatRegExp, function(x) {
		    if (x === '%%') return '%';
		    if (i >= len) return x;
		    switch (x) {
		      case '%s': return String(args[i++]);
		      case '%d': return Number(args[i++]);
		      case '%j':
		        try {
		          return JSON.stringify(args[i++]);
		        } catch (_) {
		          return '[Circular]';
		        }
		      default:
		        return x;
		    }
		  });
		  for (var x = args[i]; i < len; x = args[++i]) {
		    if (isNull(x) || !isObject(x)) {
		      str += ' ' + x;
		    } else {
		      str += ' ' + inspect(x);
		    }
		  }
		  return str;
		};


		// Mark that a method should not be used.
		// Returns a modified function which warns once by default.
		// If --no-deprecation is set, then it is a no-op.
		exports.deprecate = function(fn, msg) {
		  if (typeof process !== 'undefined' && process.noDeprecation === true) {
		    return fn;
		  }

		  // Allow for deprecating things in the process of starting up.
		  if (typeof process === 'undefined') {
		    return function() {
		      return exports.deprecate(fn, msg).apply(this, arguments);
		    };
		  }

		  var warned = false;
		  function deprecated() {
		    if (!warned) {
		      if (process.throwDeprecation) {
		        throw new Error(msg);
		      } else if (process.traceDeprecation) {
		        console.trace(msg);
		      } else {
		        console.error(msg);
		      }
		      warned = true;
		    }
		    return fn.apply(this, arguments);
		  }

		  return deprecated;
		};


		var debugs = {};
		var debugEnvRegex = /^$/;

		if (process.env.NODE_DEBUG) {
		  var debugEnv = process.env.NODE_DEBUG;
		  debugEnv = debugEnv.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
		    .replace(/\*/g, '.*')
		    .replace(/,/g, '$|^')
		    .toUpperCase();
		  debugEnvRegex = new RegExp('^' + debugEnv + '$', 'i');
		}
		exports.debuglog = function(set) {
		  set = set.toUpperCase();
		  if (!debugs[set]) {
		    if (debugEnvRegex.test(set)) {
		      var pid = process.pid;
		      debugs[set] = function() {
		        var msg = exports.format.apply(exports, arguments);
		        console.error('%s %d: %s', set, pid, msg);
		      };
		    } else {
		      debugs[set] = function() {};
		    }
		  }
		  return debugs[set];
		};


		/**
		 * Echos the value of a value. Trys to print the value out
		 * in the best way possible given the different types.
		 *
		 * @param {Object} obj The object to print out.
		 * @param {Object} opts Optional options object that alters the output.
		 */
		/* legacy: obj, showHidden, depth, colors*/
		function inspect(obj, opts) {
		  // default options
		  var ctx = {
		    seen: [],
		    stylize: stylizeNoColor
		  };
		  // legacy...
		  if (arguments.length >= 3) ctx.depth = arguments[2];
		  if (arguments.length >= 4) ctx.colors = arguments[3];
		  if (isBoolean(opts)) {
		    // legacy...
		    ctx.showHidden = opts;
		  } else if (opts) {
		    // got an "options" object
		    exports._extend(ctx, opts);
		  }
		  // set default options
		  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
		  if (isUndefined(ctx.depth)) ctx.depth = 2;
		  if (isUndefined(ctx.colors)) ctx.colors = false;
		  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
		  if (ctx.colors) ctx.stylize = stylizeWithColor;
		  return formatValue(ctx, obj, ctx.depth);
		}
		exports.inspect = inspect;


		// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
		inspect.colors = {
		  'bold' : [1, 22],
		  'italic' : [3, 23],
		  'underline' : [4, 24],
		  'inverse' : [7, 27],
		  'white' : [37, 39],
		  'grey' : [90, 39],
		  'black' : [30, 39],
		  'blue' : [34, 39],
		  'cyan' : [36, 39],
		  'green' : [32, 39],
		  'magenta' : [35, 39],
		  'red' : [31, 39],
		  'yellow' : [33, 39]
		};

		// Don't use 'blue' not visible on cmd.exe
		inspect.styles = {
		  'special': 'cyan',
		  'number': 'yellow',
		  'boolean': 'yellow',
		  'undefined': 'grey',
		  'null': 'bold',
		  'string': 'green',
		  'date': 'magenta',
		  // "name": intentionally not styling
		  'regexp': 'red'
		};


		function stylizeWithColor(str, styleType) {
		  var style = inspect.styles[styleType];

		  if (style) {
		    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
		           '\u001b[' + inspect.colors[style][1] + 'm';
		  } else {
		    return str;
		  }
		}


		function stylizeNoColor(str, styleType) {
		  return str;
		}


		function arrayToHash(array) {
		  var hash = {};

		  array.forEach(function(val, idx) {
		    hash[val] = true;
		  });

		  return hash;
		}


		function formatValue(ctx, value, recurseTimes) {
		  // Provide a hook for user-specified inspect functions.
		  // Check that value is an object with an inspect function on it
		  if (ctx.customInspect &&
		      value &&
		      isFunction(value.inspect) &&
		      // Filter out the util module, it's inspect function is special
		      value.inspect !== exports.inspect &&
		      // Also filter out any prototype objects using the circular check.
		      !(value.constructor && value.constructor.prototype === value)) {
		    var ret = value.inspect(recurseTimes, ctx);
		    if (!isString(ret)) {
		      ret = formatValue(ctx, ret, recurseTimes);
		    }
		    return ret;
		  }

		  // Primitive types cannot have properties
		  var primitive = formatPrimitive(ctx, value);
		  if (primitive) {
		    return primitive;
		  }

		  // Look up the keys of the object.
		  var keys = Object.keys(value);
		  var visibleKeys = arrayToHash(keys);

		  if (ctx.showHidden) {
		    keys = Object.getOwnPropertyNames(value);
		  }

		  // IE doesn't make error fields non-enumerable
		  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
		  if (isError(value)
		      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
		    return formatError(value);
		  }

		  // Some type of object without properties can be shortcutted.
		  if (keys.length === 0) {
		    if (isFunction(value)) {
		      var name = value.name ? ': ' + value.name : '';
		      return ctx.stylize('[Function' + name + ']', 'special');
		    }
		    if (isRegExp(value)) {
		      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
		    }
		    if (isDate(value)) {
		      return ctx.stylize(Date.prototype.toString.call(value), 'date');
		    }
		    if (isError(value)) {
		      return formatError(value);
		    }
		  }

		  var base = '', array = false, braces = ['{', '}'];

		  // Make Array say that they are Array
		  if (isArray(value)) {
		    array = true;
		    braces = ['[', ']'];
		  }

		  // Make functions say that they are functions
		  if (isFunction(value)) {
		    var n = value.name ? ': ' + value.name : '';
		    base = ' [Function' + n + ']';
		  }

		  // Make RegExps say that they are RegExps
		  if (isRegExp(value)) {
		    base = ' ' + RegExp.prototype.toString.call(value);
		  }

		  // Make dates with properties first say the date
		  if (isDate(value)) {
		    base = ' ' + Date.prototype.toUTCString.call(value);
		  }

		  // Make error with message first say the error
		  if (isError(value)) {
		    base = ' ' + formatError(value);
		  }

		  if (keys.length === 0 && (!array || value.length == 0)) {
		    return braces[0] + base + braces[1];
		  }

		  if (recurseTimes < 0) {
		    if (isRegExp(value)) {
		      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
		    } else {
		      return ctx.stylize('[Object]', 'special');
		    }
		  }

		  ctx.seen.push(value);

		  var output;
		  if (array) {
		    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
		  } else {
		    output = keys.map(function(key) {
		      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
		    });
		  }

		  ctx.seen.pop();

		  return reduceToSingleString(output, base, braces);
		}


		function formatPrimitive(ctx, value) {
		  if (isUndefined(value))
		    return ctx.stylize('undefined', 'undefined');
		  if (isString(value)) {
		    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
		                                             .replace(/'/g, "\\'")
		                                             .replace(/\\"/g, '"') + '\'';
		    return ctx.stylize(simple, 'string');
		  }
		  if (isNumber(value))
		    return ctx.stylize('' + value, 'number');
		  if (isBoolean(value))
		    return ctx.stylize('' + value, 'boolean');
		  // For some reason typeof null is "object", so special case here.
		  if (isNull(value))
		    return ctx.stylize('null', 'null');
		}


		function formatError(value) {
		  return '[' + Error.prototype.toString.call(value) + ']';
		}


		function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
		  var output = [];
		  for (var i = 0, l = value.length; i < l; ++i) {
		    if (hasOwnProperty(value, String(i))) {
		      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
		          String(i), true));
		    } else {
		      output.push('');
		    }
		  }
		  keys.forEach(function(key) {
		    if (!key.match(/^\d+$/)) {
		      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
		          key, true));
		    }
		  });
		  return output;
		}


		function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
		  var name, str, desc;
		  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
		  if (desc.get) {
		    if (desc.set) {
		      str = ctx.stylize('[Getter/Setter]', 'special');
		    } else {
		      str = ctx.stylize('[Getter]', 'special');
		    }
		  } else {
		    if (desc.set) {
		      str = ctx.stylize('[Setter]', 'special');
		    }
		  }
		  if (!hasOwnProperty(visibleKeys, key)) {
		    name = '[' + key + ']';
		  }
		  if (!str) {
		    if (ctx.seen.indexOf(desc.value) < 0) {
		      if (isNull(recurseTimes)) {
		        str = formatValue(ctx, desc.value, null);
		      } else {
		        str = formatValue(ctx, desc.value, recurseTimes - 1);
		      }
		      if (str.indexOf('\n') > -1) {
		        if (array) {
		          str = str.split('\n').map(function(line) {
		            return '  ' + line;
		          }).join('\n').slice(2);
		        } else {
		          str = '\n' + str.split('\n').map(function(line) {
		            return '   ' + line;
		          }).join('\n');
		        }
		      }
		    } else {
		      str = ctx.stylize('[Circular]', 'special');
		    }
		  }
		  if (isUndefined(name)) {
		    if (array && key.match(/^\d+$/)) {
		      return str;
		    }
		    name = JSON.stringify('' + key);
		    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
		      name = name.slice(1, -1);
		      name = ctx.stylize(name, 'name');
		    } else {
		      name = name.replace(/'/g, "\\'")
		                 .replace(/\\"/g, '"')
		                 .replace(/(^"|"$)/g, "'");
		      name = ctx.stylize(name, 'string');
		    }
		  }

		  return name + ': ' + str;
		}


		function reduceToSingleString(output, base, braces) {
		  var length = output.reduce(function(prev, cur) {
		    if (cur.indexOf('\n') >= 0) ;
		    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
		  }, 0);

		  if (length > 60) {
		    return braces[0] +
		           (base === '' ? '' : base + '\n ') +
		           ' ' +
		           output.join(',\n  ') +
		           ' ' +
		           braces[1];
		  }

		  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
		}


		// NOTE: These type checking functions intentionally don't use `instanceof`
		// because it is fragile and can be easily faked with `Object.create()`.
		exports.types = types$1;

		function isArray(ar) {
		  return Array.isArray(ar);
		}
		exports.isArray = isArray;

		function isBoolean(arg) {
		  return typeof arg === 'boolean';
		}
		exports.isBoolean = isBoolean;

		function isNull(arg) {
		  return arg === null;
		}
		exports.isNull = isNull;

		function isNullOrUndefined(arg) {
		  return arg == null;
		}
		exports.isNullOrUndefined = isNullOrUndefined;

		function isNumber(arg) {
		  return typeof arg === 'number';
		}
		exports.isNumber = isNumber;

		function isString(arg) {
		  return typeof arg === 'string';
		}
		exports.isString = isString;

		function isSymbol(arg) {
		  return typeof arg === 'symbol';
		}
		exports.isSymbol = isSymbol;

		function isUndefined(arg) {
		  return arg === void 0;
		}
		exports.isUndefined = isUndefined;

		function isRegExp(re) {
		  return isObject(re) && objectToString(re) === '[object RegExp]';
		}
		exports.isRegExp = isRegExp;
		exports.types.isRegExp = isRegExp;

		function isObject(arg) {
		  return typeof arg === 'object' && arg !== null;
		}
		exports.isObject = isObject;

		function isDate(d) {
		  return isObject(d) && objectToString(d) === '[object Date]';
		}
		exports.isDate = isDate;
		exports.types.isDate = isDate;

		function isError(e) {
		  return isObject(e) &&
		      (objectToString(e) === '[object Error]' || e instanceof Error);
		}
		exports.isError = isError;
		exports.types.isNativeError = isError;

		function isFunction(arg) {
		  return typeof arg === 'function';
		}
		exports.isFunction = isFunction;

		function isPrimitive(arg) {
		  return arg === null ||
		         typeof arg === 'boolean' ||
		         typeof arg === 'number' ||
		         typeof arg === 'string' ||
		         typeof arg === 'symbol' ||  // ES6 symbol
		         typeof arg === 'undefined';
		}
		exports.isPrimitive = isPrimitive;

		exports.isBuffer = isBuffer;

		function objectToString(o) {
		  return Object.prototype.toString.call(o);
		}


		function pad(n) {
		  return n < 10 ? '0' + n.toString(10) : n.toString(10);
		}


		var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
		              'Oct', 'Nov', 'Dec'];

		// 26 Feb 16:19:34
		function timestamp() {
		  var d = new Date();
		  var time = [pad(d.getHours()),
		              pad(d.getMinutes()),
		              pad(d.getSeconds())].join(':');
		  return [d.getDate(), months[d.getMonth()], time].join(' ');
		}


		// log is just a thin wrapper to console.log that prepends a timestamp
		exports.log = function() {
		  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
		};


		/**
		 * Inherit the prototype methods from one constructor into another.
		 *
		 * The Function.prototype.inherits from lang.js rewritten as a standalone
		 * function (not on Function.prototype). NOTE: If this file is to be loaded
		 * during bootstrapping this function needs to be rewritten using some native
		 * functions as prototype setup using normal JavaScript does not work as
		 * expected during bootstrapping (see mirror.js in r114903).
		 *
		 * @param {function} ctor Constructor function which needs to inherit the
		 *     prototype.
		 * @param {function} superCtor Constructor function to inherit prototype from.
		 */
		exports.inherits = requireInherits();

		exports._extend = function(origin, add) {
		  // Don't do anything if add isn't an object
		  if (!add || !isObject(add)) return origin;

		  var keys = Object.keys(add);
		  var i = keys.length;
		  while (i--) {
		    origin[keys[i]] = add[keys[i]];
		  }
		  return origin;
		};

		function hasOwnProperty(obj, prop) {
		  return Object.prototype.hasOwnProperty.call(obj, prop);
		}

		var kCustomPromisifiedSymbol = typeof Symbol !== 'undefined' ? Symbol('util.promisify.custom') : undefined;

		exports.promisify = function promisify(original) {
		  if (typeof original !== 'function')
		    throw new TypeError('The "original" argument must be of type Function');

		  if (kCustomPromisifiedSymbol && original[kCustomPromisifiedSymbol]) {
		    var fn = original[kCustomPromisifiedSymbol];
		    if (typeof fn !== 'function') {
		      throw new TypeError('The "util.promisify.custom" argument must be of type Function');
		    }
		    Object.defineProperty(fn, kCustomPromisifiedSymbol, {
		      value: fn, enumerable: false, writable: false, configurable: true
		    });
		    return fn;
		  }

		  function fn() {
		    var promiseResolve, promiseReject;
		    var promise = new Promise(function (resolve, reject) {
		      promiseResolve = resolve;
		      promiseReject = reject;
		    });

		    var args = [];
		    for (var i = 0; i < arguments.length; i++) {
		      args.push(arguments[i]);
		    }
		    args.push(function (err, value) {
		      if (err) {
		        promiseReject(err);
		      } else {
		        promiseResolve(value);
		      }
		    });

		    try {
		      original.apply(this, args);
		    } catch (err) {
		      promiseReject(err);
		    }

		    return promise;
		  }

		  Object.setPrototypeOf(fn, Object.getPrototypeOf(original));

		  if (kCustomPromisifiedSymbol) Object.defineProperty(fn, kCustomPromisifiedSymbol, {
		    value: fn, enumerable: false, writable: false, configurable: true
		  });
		  return Object.defineProperties(
		    fn,
		    getOwnPropertyDescriptors(original)
		  );
		};

		exports.promisify.custom = kCustomPromisifiedSymbol;

		function callbackifyOnRejected(reason, cb) {
		  // `!reason` guard inspired by bluebird (Ref: https://goo.gl/t5IS6M).
		  // Because `null` is a special error value in callbacks which means "no error
		  // occurred", we error-wrap so the callback consumer can distinguish between
		  // "the promise rejected with null" or "the promise fulfilled with undefined".
		  if (!reason) {
		    var newReason = new Error('Promise was rejected with a falsy value');
		    newReason.reason = reason;
		    reason = newReason;
		  }
		  return cb(reason);
		}

		function callbackify(original) {
		  if (typeof original !== 'function') {
		    throw new TypeError('The "original" argument must be of type Function');
		  }

		  // We DO NOT return the promise as it gives the user a false sense that
		  // the promise is actually somehow related to the callback's execution
		  // and that the callback throwing will reject the promise.
		  function callbackified() {
		    var args = [];
		    for (var i = 0; i < arguments.length; i++) {
		      args.push(arguments[i]);
		    }

		    var maybeCb = args.pop();
		    if (typeof maybeCb !== 'function') {
		      throw new TypeError('The last argument must be of type Function');
		    }
		    var self = this;
		    var cb = function() {
		      return maybeCb.apply(self, arguments);
		    };
		    // In true node style we process the callback on `nextTick` with all the
		    // implications (stack, `uncaughtException`, `async_hooks`)
		    original.apply(this, args)
		      .then(function(ret) { process.nextTick(cb.bind(null, null, ret)); },
		            function(rej) { process.nextTick(callbackifyOnRejected.bind(null, rej, cb)); });
		  }

		  Object.setPrototypeOf(callbackified, Object.getPrototypeOf(original));
		  Object.defineProperties(callbackified,
		                          getOwnPropertyDescriptors(original));
		  return callbackified;
		}
		exports.callbackify = callbackify;
} (util));
	return util;
}

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

	var util = requireUtil();
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

	const inspect = requireUtil().inspect;
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

	const util = requireUtil();
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

	const { format } = requireUtil();

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

	node$1 = requireUtil().deprecate;
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
		module.exports = require$$0__default$1["default"];
} (stream$1));
	return streamExports;
}

var buffer = {};

var base64Js = {};

var hasRequiredBase64Js;

function requireBase64Js () {
	if (hasRequiredBase64Js) return base64Js;
	hasRequiredBase64Js = 1;

	base64Js.byteLength = byteLength;
	base64Js.toByteArray = toByteArray;
	base64Js.fromByteArray = fromByteArray;

	var lookup = [];
	var revLookup = [];
	var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array;

	var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
	for (var i = 0, len = code.length; i < len; ++i) {
	  lookup[i] = code[i];
	  revLookup[code.charCodeAt(i)] = i;
	}

	// Support decoding URL-safe base64 strings, as Node.js does.
	// See: https://en.wikipedia.org/wiki/Base64#URL_applications
	revLookup['-'.charCodeAt(0)] = 62;
	revLookup['_'.charCodeAt(0)] = 63;

	function getLens (b64) {
	  var len = b64.length;

	  if (len % 4 > 0) {
	    throw new Error('Invalid string. Length must be a multiple of 4')
	  }

	  // Trim off extra bytes after placeholder bytes are found
	  // See: https://github.com/beatgammit/base64-js/issues/42
	  var validLen = b64.indexOf('=');
	  if (validLen === -1) validLen = len;

	  var placeHoldersLen = validLen === len
	    ? 0
	    : 4 - (validLen % 4);

	  return [validLen, placeHoldersLen]
	}

	// base64 is 4/3 + up to two characters of the original data
	function byteLength (b64) {
	  var lens = getLens(b64);
	  var validLen = lens[0];
	  var placeHoldersLen = lens[1];
	  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
	}

	function _byteLength (b64, validLen, placeHoldersLen) {
	  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
	}

	function toByteArray (b64) {
	  var tmp;
	  var lens = getLens(b64);
	  var validLen = lens[0];
	  var placeHoldersLen = lens[1];

	  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen));

	  var curByte = 0;

	  // if there are placeholders, only get up to the last complete 4 chars
	  var len = placeHoldersLen > 0
	    ? validLen - 4
	    : validLen;

	  var i;
	  for (i = 0; i < len; i += 4) {
	    tmp =
	      (revLookup[b64.charCodeAt(i)] << 18) |
	      (revLookup[b64.charCodeAt(i + 1)] << 12) |
	      (revLookup[b64.charCodeAt(i + 2)] << 6) |
	      revLookup[b64.charCodeAt(i + 3)];
	    arr[curByte++] = (tmp >> 16) & 0xFF;
	    arr[curByte++] = (tmp >> 8) & 0xFF;
	    arr[curByte++] = tmp & 0xFF;
	  }

	  if (placeHoldersLen === 2) {
	    tmp =
	      (revLookup[b64.charCodeAt(i)] << 2) |
	      (revLookup[b64.charCodeAt(i + 1)] >> 4);
	    arr[curByte++] = tmp & 0xFF;
	  }

	  if (placeHoldersLen === 1) {
	    tmp =
	      (revLookup[b64.charCodeAt(i)] << 10) |
	      (revLookup[b64.charCodeAt(i + 1)] << 4) |
	      (revLookup[b64.charCodeAt(i + 2)] >> 2);
	    arr[curByte++] = (tmp >> 8) & 0xFF;
	    arr[curByte++] = tmp & 0xFF;
	  }

	  return arr
	}

	function tripletToBase64 (num) {
	  return lookup[num >> 18 & 0x3F] +
	    lookup[num >> 12 & 0x3F] +
	    lookup[num >> 6 & 0x3F] +
	    lookup[num & 0x3F]
	}

	function encodeChunk (uint8, start, end) {
	  var tmp;
	  var output = [];
	  for (var i = start; i < end; i += 3) {
	    tmp =
	      ((uint8[i] << 16) & 0xFF0000) +
	      ((uint8[i + 1] << 8) & 0xFF00) +
	      (uint8[i + 2] & 0xFF);
	    output.push(tripletToBase64(tmp));
	  }
	  return output.join('')
	}

	function fromByteArray (uint8) {
	  var tmp;
	  var len = uint8.length;
	  var extraBytes = len % 3; // if we have 1 byte left, pad 2 bytes
	  var parts = [];
	  var maxChunkLength = 16383; // must be multiple of 3

	  // go through the array every three bytes, we'll deal with trailing stuff later
	  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
	    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)));
	  }

	  // pad the end with zeros, but make sure to not forget the extra bytes
	  if (extraBytes === 1) {
	    tmp = uint8[len - 1];
	    parts.push(
	      lookup[tmp >> 2] +
	      lookup[(tmp << 4) & 0x3F] +
	      '=='
	    );
	  } else if (extraBytes === 2) {
	    tmp = (uint8[len - 2] << 8) + uint8[len - 1];
	    parts.push(
	      lookup[tmp >> 10] +
	      lookup[(tmp >> 4) & 0x3F] +
	      lookup[(tmp << 2) & 0x3F] +
	      '='
	    );
	  }

	  return parts.join('')
	}
	return base64Js;
}

var ieee754 = {};

/*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */

var hasRequiredIeee754;

function requireIeee754 () {
	if (hasRequiredIeee754) return ieee754;
	hasRequiredIeee754 = 1;
	ieee754.read = function (buffer, offset, isLE, mLen, nBytes) {
	  var e, m;
	  var eLen = (nBytes * 8) - mLen - 1;
	  var eMax = (1 << eLen) - 1;
	  var eBias = eMax >> 1;
	  var nBits = -7;
	  var i = isLE ? (nBytes - 1) : 0;
	  var d = isLE ? -1 : 1;
	  var s = buffer[offset + i];

	  i += d;

	  e = s & ((1 << (-nBits)) - 1);
	  s >>= (-nBits);
	  nBits += eLen;
	  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

	  m = e & ((1 << (-nBits)) - 1);
	  e >>= (-nBits);
	  nBits += mLen;
	  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

	  if (e === 0) {
	    e = 1 - eBias;
	  } else if (e === eMax) {
	    return m ? NaN : ((s ? -1 : 1) * Infinity)
	  } else {
	    m = m + Math.pow(2, mLen);
	    e = e - eBias;
	  }
	  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
	};

	ieee754.write = function (buffer, value, offset, isLE, mLen, nBytes) {
	  var e, m, c;
	  var eLen = (nBytes * 8) - mLen - 1;
	  var eMax = (1 << eLen) - 1;
	  var eBias = eMax >> 1;
	  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0);
	  var i = isLE ? 0 : (nBytes - 1);
	  var d = isLE ? 1 : -1;
	  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

	  value = Math.abs(value);

	  if (isNaN(value) || value === Infinity) {
	    m = isNaN(value) ? 1 : 0;
	    e = eMax;
	  } else {
	    e = Math.floor(Math.log(value) / Math.LN2);
	    if (value * (c = Math.pow(2, -e)) < 1) {
	      e--;
	      c *= 2;
	    }
	    if (e + eBias >= 1) {
	      value += rt / c;
	    } else {
	      value += rt * Math.pow(2, 1 - eBias);
	    }
	    if (value * c >= 2) {
	      e++;
	      c /= 2;
	    }

	    if (e + eBias >= eMax) {
	      m = 0;
	      e = eMax;
	    } else if (e + eBias >= 1) {
	      m = ((value * c) - 1) * Math.pow(2, mLen);
	      e = e + eBias;
	    } else {
	      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
	      e = 0;
	    }
	  }

	  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

	  e = (e << mLen) | m;
	  eLen += mLen;
	  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

	  buffer[offset + i - d] |= s * 128;
	};
	return ieee754;
}

var isarray;
var hasRequiredIsarray;

function requireIsarray () {
	if (hasRequiredIsarray) return isarray;
	hasRequiredIsarray = 1;
	var toString = {}.toString;

	isarray = Array.isArray || function (arr) {
	  return toString.call(arr) == '[object Array]';
	};
	return isarray;
}

/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <http://feross.org>
 * @license  MIT
 */

var hasRequiredBuffer;

function requireBuffer () {
	if (hasRequiredBuffer) return buffer;
	hasRequiredBuffer = 1;
	(function (exports) {

		var base64 = requireBase64Js();
		var ieee754 = requireIeee754();
		var isArray = requireIsarray();

		exports.Buffer = Buffer;
		exports.SlowBuffer = SlowBuffer;
		exports.INSPECT_MAX_BYTES = 50;

		/**
		 * If `Buffer.TYPED_ARRAY_SUPPORT`:
		 *   === true    Use Uint8Array implementation (fastest)
		 *   === false   Use Object implementation (most compatible, even IE6)
		 *
		 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
		 * Opera 11.6+, iOS 4.2+.
		 *
		 * Due to various browser bugs, sometimes the Object implementation will be used even
		 * when the browser supports typed arrays.
		 *
		 * Note:
		 *
		 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
		 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
		 *
		 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
		 *
		 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
		 *     incorrect length in some situations.

		 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
		 * get the Object implementation, which is slower but behaves correctly.
		 */
		Buffer.TYPED_ARRAY_SUPPORT = commonjsGlobal.TYPED_ARRAY_SUPPORT !== undefined
		  ? commonjsGlobal.TYPED_ARRAY_SUPPORT
		  : typedArraySupport();

		/*
		 * Export kMaxLength after typed array support is determined.
		 */
		exports.kMaxLength = kMaxLength();

		function typedArraySupport () {
		  try {
		    var arr = new Uint8Array(1);
		    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }};
		    return arr.foo() === 42 && // typed array instances can be augmented
		        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
		        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
		  } catch (e) {
		    return false
		  }
		}

		function kMaxLength () {
		  return Buffer.TYPED_ARRAY_SUPPORT
		    ? 0x7fffffff
		    : 0x3fffffff
		}

		function createBuffer (that, length) {
		  if (kMaxLength() < length) {
		    throw new RangeError('Invalid typed array length')
		  }
		  if (Buffer.TYPED_ARRAY_SUPPORT) {
		    // Return an augmented `Uint8Array` instance, for best performance
		    that = new Uint8Array(length);
		    that.__proto__ = Buffer.prototype;
		  } else {
		    // Fallback: Return an object instance of the Buffer class
		    if (that === null) {
		      that = new Buffer(length);
		    }
		    that.length = length;
		  }

		  return that
		}

		/**
		 * The Buffer constructor returns instances of `Uint8Array` that have their
		 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
		 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
		 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
		 * returns a single octet.
		 *
		 * The `Uint8Array` prototype remains unmodified.
		 */

		function Buffer (arg, encodingOrOffset, length) {
		  if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
		    return new Buffer(arg, encodingOrOffset, length)
		  }

		  // Common case.
		  if (typeof arg === 'number') {
		    if (typeof encodingOrOffset === 'string') {
		      throw new Error(
		        'If encoding is specified then the first argument must be a string'
		      )
		    }
		    return allocUnsafe(this, arg)
		  }
		  return from(this, arg, encodingOrOffset, length)
		}

		Buffer.poolSize = 8192; // not used by this implementation

		// TODO: Legacy, not needed anymore. Remove in next major version.
		Buffer._augment = function (arr) {
		  arr.__proto__ = Buffer.prototype;
		  return arr
		};

		function from (that, value, encodingOrOffset, length) {
		  if (typeof value === 'number') {
		    throw new TypeError('"value" argument must not be a number')
		  }

		  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
		    return fromArrayBuffer(that, value, encodingOrOffset, length)
		  }

		  if (typeof value === 'string') {
		    return fromString(that, value, encodingOrOffset)
		  }

		  return fromObject(that, value)
		}

		/**
		 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
		 * if value is a number.
		 * Buffer.from(str[, encoding])
		 * Buffer.from(array)
		 * Buffer.from(buffer)
		 * Buffer.from(arrayBuffer[, byteOffset[, length]])
		 **/
		Buffer.from = function (value, encodingOrOffset, length) {
		  return from(null, value, encodingOrOffset, length)
		};

		if (Buffer.TYPED_ARRAY_SUPPORT) {
		  Buffer.prototype.__proto__ = Uint8Array.prototype;
		  Buffer.__proto__ = Uint8Array;
		  if (typeof Symbol !== 'undefined' && Symbol.species &&
		      Buffer[Symbol.species] === Buffer) {
		    // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
		    Object.defineProperty(Buffer, Symbol.species, {
		      value: null,
		      configurable: true
		    });
		  }
		}

		function assertSize (size) {
		  if (typeof size !== 'number') {
		    throw new TypeError('"size" argument must be a number')
		  } else if (size < 0) {
		    throw new RangeError('"size" argument must not be negative')
		  }
		}

		function alloc (that, size, fill, encoding) {
		  assertSize(size);
		  if (size <= 0) {
		    return createBuffer(that, size)
		  }
		  if (fill !== undefined) {
		    // Only pay attention to encoding if it's a string. This
		    // prevents accidentally sending in a number that would
		    // be interpretted as a start offset.
		    return typeof encoding === 'string'
		      ? createBuffer(that, size).fill(fill, encoding)
		      : createBuffer(that, size).fill(fill)
		  }
		  return createBuffer(that, size)
		}

		/**
		 * Creates a new filled Buffer instance.
		 * alloc(size[, fill[, encoding]])
		 **/
		Buffer.alloc = function (size, fill, encoding) {
		  return alloc(null, size, fill, encoding)
		};

		function allocUnsafe (that, size) {
		  assertSize(size);
		  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0);
		  if (!Buffer.TYPED_ARRAY_SUPPORT) {
		    for (var i = 0; i < size; ++i) {
		      that[i] = 0;
		    }
		  }
		  return that
		}

		/**
		 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
		 * */
		Buffer.allocUnsafe = function (size) {
		  return allocUnsafe(null, size)
		};
		/**
		 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
		 */
		Buffer.allocUnsafeSlow = function (size) {
		  return allocUnsafe(null, size)
		};

		function fromString (that, string, encoding) {
		  if (typeof encoding !== 'string' || encoding === '') {
		    encoding = 'utf8';
		  }

		  if (!Buffer.isEncoding(encoding)) {
		    throw new TypeError('"encoding" must be a valid string encoding')
		  }

		  var length = byteLength(string, encoding) | 0;
		  that = createBuffer(that, length);

		  var actual = that.write(string, encoding);

		  if (actual !== length) {
		    // Writing a hex string, for example, that contains invalid characters will
		    // cause everything after the first invalid character to be ignored. (e.g.
		    // 'abxxcd' will be treated as 'ab')
		    that = that.slice(0, actual);
		  }

		  return that
		}

		function fromArrayLike (that, array) {
		  var length = array.length < 0 ? 0 : checked(array.length) | 0;
		  that = createBuffer(that, length);
		  for (var i = 0; i < length; i += 1) {
		    that[i] = array[i] & 255;
		  }
		  return that
		}

		function fromArrayBuffer (that, array, byteOffset, length) {
		  array.byteLength; // this throws if `array` is not a valid ArrayBuffer

		  if (byteOffset < 0 || array.byteLength < byteOffset) {
		    throw new RangeError('\'offset\' is out of bounds')
		  }

		  if (array.byteLength < byteOffset + (length || 0)) {
		    throw new RangeError('\'length\' is out of bounds')
		  }

		  if (byteOffset === undefined && length === undefined) {
		    array = new Uint8Array(array);
		  } else if (length === undefined) {
		    array = new Uint8Array(array, byteOffset);
		  } else {
		    array = new Uint8Array(array, byteOffset, length);
		  }

		  if (Buffer.TYPED_ARRAY_SUPPORT) {
		    // Return an augmented `Uint8Array` instance, for best performance
		    that = array;
		    that.__proto__ = Buffer.prototype;
		  } else {
		    // Fallback: Return an object instance of the Buffer class
		    that = fromArrayLike(that, array);
		  }
		  return that
		}

		function fromObject (that, obj) {
		  if (Buffer.isBuffer(obj)) {
		    var len = checked(obj.length) | 0;
		    that = createBuffer(that, len);

		    if (that.length === 0) {
		      return that
		    }

		    obj.copy(that, 0, 0, len);
		    return that
		  }

		  if (obj) {
		    if ((typeof ArrayBuffer !== 'undefined' &&
		        obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
		      if (typeof obj.length !== 'number' || isnan(obj.length)) {
		        return createBuffer(that, 0)
		      }
		      return fromArrayLike(that, obj)
		    }

		    if (obj.type === 'Buffer' && isArray(obj.data)) {
		      return fromArrayLike(that, obj.data)
		    }
		  }

		  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
		}

		function checked (length) {
		  // Note: cannot use `length < kMaxLength()` here because that fails when
		  // length is NaN (which is otherwise coerced to zero.)
		  if (length >= kMaxLength()) {
		    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
		                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
		  }
		  return length | 0
		}

		function SlowBuffer (length) {
		  if (+length != length) { // eslint-disable-line eqeqeq
		    length = 0;
		  }
		  return Buffer.alloc(+length)
		}

		Buffer.isBuffer = function isBuffer (b) {
		  return !!(b != null && b._isBuffer)
		};

		Buffer.compare = function compare (a, b) {
		  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
		    throw new TypeError('Arguments must be Buffers')
		  }

		  if (a === b) return 0

		  var x = a.length;
		  var y = b.length;

		  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
		    if (a[i] !== b[i]) {
		      x = a[i];
		      y = b[i];
		      break
		    }
		  }

		  if (x < y) return -1
		  if (y < x) return 1
		  return 0
		};

		Buffer.isEncoding = function isEncoding (encoding) {
		  switch (String(encoding).toLowerCase()) {
		    case 'hex':
		    case 'utf8':
		    case 'utf-8':
		    case 'ascii':
		    case 'latin1':
		    case 'binary':
		    case 'base64':
		    case 'ucs2':
		    case 'ucs-2':
		    case 'utf16le':
		    case 'utf-16le':
		      return true
		    default:
		      return false
		  }
		};

		Buffer.concat = function concat (list, length) {
		  if (!isArray(list)) {
		    throw new TypeError('"list" argument must be an Array of Buffers')
		  }

		  if (list.length === 0) {
		    return Buffer.alloc(0)
		  }

		  var i;
		  if (length === undefined) {
		    length = 0;
		    for (i = 0; i < list.length; ++i) {
		      length += list[i].length;
		    }
		  }

		  var buffer = Buffer.allocUnsafe(length);
		  var pos = 0;
		  for (i = 0; i < list.length; ++i) {
		    var buf = list[i];
		    if (!Buffer.isBuffer(buf)) {
		      throw new TypeError('"list" argument must be an Array of Buffers')
		    }
		    buf.copy(buffer, pos);
		    pos += buf.length;
		  }
		  return buffer
		};

		function byteLength (string, encoding) {
		  if (Buffer.isBuffer(string)) {
		    return string.length
		  }
		  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
		      (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
		    return string.byteLength
		  }
		  if (typeof string !== 'string') {
		    string = '' + string;
		  }

		  var len = string.length;
		  if (len === 0) return 0

		  // Use a for loop to avoid recursion
		  var loweredCase = false;
		  for (;;) {
		    switch (encoding) {
		      case 'ascii':
		      case 'latin1':
		      case 'binary':
		        return len
		      case 'utf8':
		      case 'utf-8':
		      case undefined:
		        return utf8ToBytes(string).length
		      case 'ucs2':
		      case 'ucs-2':
		      case 'utf16le':
		      case 'utf-16le':
		        return len * 2
		      case 'hex':
		        return len >>> 1
		      case 'base64':
		        return base64ToBytes(string).length
		      default:
		        if (loweredCase) return utf8ToBytes(string).length // assume utf8
		        encoding = ('' + encoding).toLowerCase();
		        loweredCase = true;
		    }
		  }
		}
		Buffer.byteLength = byteLength;

		function slowToString (encoding, start, end) {
		  var loweredCase = false;

		  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
		  // property of a typed array.

		  // This behaves neither like String nor Uint8Array in that we set start/end
		  // to their upper/lower bounds if the value passed is out of range.
		  // undefined is handled specially as per ECMA-262 6th Edition,
		  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
		  if (start === undefined || start < 0) {
		    start = 0;
		  }
		  // Return early if start > this.length. Done here to prevent potential uint32
		  // coercion fail below.
		  if (start > this.length) {
		    return ''
		  }

		  if (end === undefined || end > this.length) {
		    end = this.length;
		  }

		  if (end <= 0) {
		    return ''
		  }

		  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
		  end >>>= 0;
		  start >>>= 0;

		  if (end <= start) {
		    return ''
		  }

		  if (!encoding) encoding = 'utf8';

		  while (true) {
		    switch (encoding) {
		      case 'hex':
		        return hexSlice(this, start, end)

		      case 'utf8':
		      case 'utf-8':
		        return utf8Slice(this, start, end)

		      case 'ascii':
		        return asciiSlice(this, start, end)

		      case 'latin1':
		      case 'binary':
		        return latin1Slice(this, start, end)

		      case 'base64':
		        return base64Slice(this, start, end)

		      case 'ucs2':
		      case 'ucs-2':
		      case 'utf16le':
		      case 'utf-16le':
		        return utf16leSlice(this, start, end)

		      default:
		        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
		        encoding = (encoding + '').toLowerCase();
		        loweredCase = true;
		    }
		  }
		}

		// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
		// Buffer instances.
		Buffer.prototype._isBuffer = true;

		function swap (b, n, m) {
		  var i = b[n];
		  b[n] = b[m];
		  b[m] = i;
		}

		Buffer.prototype.swap16 = function swap16 () {
		  var len = this.length;
		  if (len % 2 !== 0) {
		    throw new RangeError('Buffer size must be a multiple of 16-bits')
		  }
		  for (var i = 0; i < len; i += 2) {
		    swap(this, i, i + 1);
		  }
		  return this
		};

		Buffer.prototype.swap32 = function swap32 () {
		  var len = this.length;
		  if (len % 4 !== 0) {
		    throw new RangeError('Buffer size must be a multiple of 32-bits')
		  }
		  for (var i = 0; i < len; i += 4) {
		    swap(this, i, i + 3);
		    swap(this, i + 1, i + 2);
		  }
		  return this
		};

		Buffer.prototype.swap64 = function swap64 () {
		  var len = this.length;
		  if (len % 8 !== 0) {
		    throw new RangeError('Buffer size must be a multiple of 64-bits')
		  }
		  for (var i = 0; i < len; i += 8) {
		    swap(this, i, i + 7);
		    swap(this, i + 1, i + 6);
		    swap(this, i + 2, i + 5);
		    swap(this, i + 3, i + 4);
		  }
		  return this
		};

		Buffer.prototype.toString = function toString () {
		  var length = this.length | 0;
		  if (length === 0) return ''
		  if (arguments.length === 0) return utf8Slice(this, 0, length)
		  return slowToString.apply(this, arguments)
		};

		Buffer.prototype.equals = function equals (b) {
		  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
		  if (this === b) return true
		  return Buffer.compare(this, b) === 0
		};

		Buffer.prototype.inspect = function inspect () {
		  var str = '';
		  var max = exports.INSPECT_MAX_BYTES;
		  if (this.length > 0) {
		    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ');
		    if (this.length > max) str += ' ... ';
		  }
		  return '<Buffer ' + str + '>'
		};

		Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
		  if (!Buffer.isBuffer(target)) {
		    throw new TypeError('Argument must be a Buffer')
		  }

		  if (start === undefined) {
		    start = 0;
		  }
		  if (end === undefined) {
		    end = target ? target.length : 0;
		  }
		  if (thisStart === undefined) {
		    thisStart = 0;
		  }
		  if (thisEnd === undefined) {
		    thisEnd = this.length;
		  }

		  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
		    throw new RangeError('out of range index')
		  }

		  if (thisStart >= thisEnd && start >= end) {
		    return 0
		  }
		  if (thisStart >= thisEnd) {
		    return -1
		  }
		  if (start >= end) {
		    return 1
		  }

		  start >>>= 0;
		  end >>>= 0;
		  thisStart >>>= 0;
		  thisEnd >>>= 0;

		  if (this === target) return 0

		  var x = thisEnd - thisStart;
		  var y = end - start;
		  var len = Math.min(x, y);

		  var thisCopy = this.slice(thisStart, thisEnd);
		  var targetCopy = target.slice(start, end);

		  for (var i = 0; i < len; ++i) {
		    if (thisCopy[i] !== targetCopy[i]) {
		      x = thisCopy[i];
		      y = targetCopy[i];
		      break
		    }
		  }

		  if (x < y) return -1
		  if (y < x) return 1
		  return 0
		};

		// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
		// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
		//
		// Arguments:
		// - buffer - a Buffer to search
		// - val - a string, Buffer, or number
		// - byteOffset - an index into `buffer`; will be clamped to an int32
		// - encoding - an optional encoding, relevant is val is a string
		// - dir - true for indexOf, false for lastIndexOf
		function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
		  // Empty buffer means no match
		  if (buffer.length === 0) return -1

		  // Normalize byteOffset
		  if (typeof byteOffset === 'string') {
		    encoding = byteOffset;
		    byteOffset = 0;
		  } else if (byteOffset > 0x7fffffff) {
		    byteOffset = 0x7fffffff;
		  } else if (byteOffset < -0x80000000) {
		    byteOffset = -0x80000000;
		  }
		  byteOffset = +byteOffset;  // Coerce to Number.
		  if (isNaN(byteOffset)) {
		    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
		    byteOffset = dir ? 0 : (buffer.length - 1);
		  }

		  // Normalize byteOffset: negative offsets start from the end of the buffer
		  if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
		  if (byteOffset >= buffer.length) {
		    if (dir) return -1
		    else byteOffset = buffer.length - 1;
		  } else if (byteOffset < 0) {
		    if (dir) byteOffset = 0;
		    else return -1
		  }

		  // Normalize val
		  if (typeof val === 'string') {
		    val = Buffer.from(val, encoding);
		  }

		  // Finally, search either indexOf (if dir is true) or lastIndexOf
		  if (Buffer.isBuffer(val)) {
		    // Special case: looking for empty string/buffer always fails
		    if (val.length === 0) {
		      return -1
		    }
		    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
		  } else if (typeof val === 'number') {
		    val = val & 0xFF; // Search for a byte value [0-255]
		    if (Buffer.TYPED_ARRAY_SUPPORT &&
		        typeof Uint8Array.prototype.indexOf === 'function') {
		      if (dir) {
		        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
		      } else {
		        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
		      }
		    }
		    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
		  }

		  throw new TypeError('val must be string, number or Buffer')
		}

		function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
		  var indexSize = 1;
		  var arrLength = arr.length;
		  var valLength = val.length;

		  if (encoding !== undefined) {
		    encoding = String(encoding).toLowerCase();
		    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
		        encoding === 'utf16le' || encoding === 'utf-16le') {
		      if (arr.length < 2 || val.length < 2) {
		        return -1
		      }
		      indexSize = 2;
		      arrLength /= 2;
		      valLength /= 2;
		      byteOffset /= 2;
		    }
		  }

		  function read (buf, i) {
		    if (indexSize === 1) {
		      return buf[i]
		    } else {
		      return buf.readUInt16BE(i * indexSize)
		    }
		  }

		  var i;
		  if (dir) {
		    var foundIndex = -1;
		    for (i = byteOffset; i < arrLength; i++) {
		      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
		        if (foundIndex === -1) foundIndex = i;
		        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
		      } else {
		        if (foundIndex !== -1) i -= i - foundIndex;
		        foundIndex = -1;
		      }
		    }
		  } else {
		    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
		    for (i = byteOffset; i >= 0; i--) {
		      var found = true;
		      for (var j = 0; j < valLength; j++) {
		        if (read(arr, i + j) !== read(val, j)) {
		          found = false;
		          break
		        }
		      }
		      if (found) return i
		    }
		  }

		  return -1
		}

		Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
		  return this.indexOf(val, byteOffset, encoding) !== -1
		};

		Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
		  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
		};

		Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
		  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
		};

		function hexWrite (buf, string, offset, length) {
		  offset = Number(offset) || 0;
		  var remaining = buf.length - offset;
		  if (!length) {
		    length = remaining;
		  } else {
		    length = Number(length);
		    if (length > remaining) {
		      length = remaining;
		    }
		  }

		  // must be an even number of digits
		  var strLen = string.length;
		  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

		  if (length > strLen / 2) {
		    length = strLen / 2;
		  }
		  for (var i = 0; i < length; ++i) {
		    var parsed = parseInt(string.substr(i * 2, 2), 16);
		    if (isNaN(parsed)) return i
		    buf[offset + i] = parsed;
		  }
		  return i
		}

		function utf8Write (buf, string, offset, length) {
		  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
		}

		function asciiWrite (buf, string, offset, length) {
		  return blitBuffer(asciiToBytes(string), buf, offset, length)
		}

		function latin1Write (buf, string, offset, length) {
		  return asciiWrite(buf, string, offset, length)
		}

		function base64Write (buf, string, offset, length) {
		  return blitBuffer(base64ToBytes(string), buf, offset, length)
		}

		function ucs2Write (buf, string, offset, length) {
		  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
		}

		Buffer.prototype.write = function write (string, offset, length, encoding) {
		  // Buffer#write(string)
		  if (offset === undefined) {
		    encoding = 'utf8';
		    length = this.length;
		    offset = 0;
		  // Buffer#write(string, encoding)
		  } else if (length === undefined && typeof offset === 'string') {
		    encoding = offset;
		    length = this.length;
		    offset = 0;
		  // Buffer#write(string, offset[, length][, encoding])
		  } else if (isFinite(offset)) {
		    offset = offset | 0;
		    if (isFinite(length)) {
		      length = length | 0;
		      if (encoding === undefined) encoding = 'utf8';
		    } else {
		      encoding = length;
		      length = undefined;
		    }
		  // legacy write(string, encoding, offset, length) - remove in v0.13
		  } else {
		    throw new Error(
		      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
		    )
		  }

		  var remaining = this.length - offset;
		  if (length === undefined || length > remaining) length = remaining;

		  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
		    throw new RangeError('Attempt to write outside buffer bounds')
		  }

		  if (!encoding) encoding = 'utf8';

		  var loweredCase = false;
		  for (;;) {
		    switch (encoding) {
		      case 'hex':
		        return hexWrite(this, string, offset, length)

		      case 'utf8':
		      case 'utf-8':
		        return utf8Write(this, string, offset, length)

		      case 'ascii':
		        return asciiWrite(this, string, offset, length)

		      case 'latin1':
		      case 'binary':
		        return latin1Write(this, string, offset, length)

		      case 'base64':
		        // Warning: maxLength not taken into account in base64Write
		        return base64Write(this, string, offset, length)

		      case 'ucs2':
		      case 'ucs-2':
		      case 'utf16le':
		      case 'utf-16le':
		        return ucs2Write(this, string, offset, length)

		      default:
		        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
		        encoding = ('' + encoding).toLowerCase();
		        loweredCase = true;
		    }
		  }
		};

		Buffer.prototype.toJSON = function toJSON () {
		  return {
		    type: 'Buffer',
		    data: Array.prototype.slice.call(this._arr || this, 0)
		  }
		};

		function base64Slice (buf, start, end) {
		  if (start === 0 && end === buf.length) {
		    return base64.fromByteArray(buf)
		  } else {
		    return base64.fromByteArray(buf.slice(start, end))
		  }
		}

		function utf8Slice (buf, start, end) {
		  end = Math.min(buf.length, end);
		  var res = [];

		  var i = start;
		  while (i < end) {
		    var firstByte = buf[i];
		    var codePoint = null;
		    var bytesPerSequence = (firstByte > 0xEF) ? 4
		      : (firstByte > 0xDF) ? 3
		      : (firstByte > 0xBF) ? 2
		      : 1;

		    if (i + bytesPerSequence <= end) {
		      var secondByte, thirdByte, fourthByte, tempCodePoint;

		      switch (bytesPerSequence) {
		        case 1:
		          if (firstByte < 0x80) {
		            codePoint = firstByte;
		          }
		          break
		        case 2:
		          secondByte = buf[i + 1];
		          if ((secondByte & 0xC0) === 0x80) {
		            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F);
		            if (tempCodePoint > 0x7F) {
		              codePoint = tempCodePoint;
		            }
		          }
		          break
		        case 3:
		          secondByte = buf[i + 1];
		          thirdByte = buf[i + 2];
		          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
		            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F);
		            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
		              codePoint = tempCodePoint;
		            }
		          }
		          break
		        case 4:
		          secondByte = buf[i + 1];
		          thirdByte = buf[i + 2];
		          fourthByte = buf[i + 3];
		          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
		            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F);
		            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
		              codePoint = tempCodePoint;
		            }
		          }
		      }
		    }

		    if (codePoint === null) {
		      // we did not generate a valid codePoint so insert a
		      // replacement char (U+FFFD) and advance only 1 byte
		      codePoint = 0xFFFD;
		      bytesPerSequence = 1;
		    } else if (codePoint > 0xFFFF) {
		      // encode to utf16 (surrogate pair dance)
		      codePoint -= 0x10000;
		      res.push(codePoint >>> 10 & 0x3FF | 0xD800);
		      codePoint = 0xDC00 | codePoint & 0x3FF;
		    }

		    res.push(codePoint);
		    i += bytesPerSequence;
		  }

		  return decodeCodePointsArray(res)
		}

		// Based on http://stackoverflow.com/a/22747272/680742, the browser with
		// the lowest limit is Chrome, with 0x10000 args.
		// We go 1 magnitude less, for safety
		var MAX_ARGUMENTS_LENGTH = 0x1000;

		function decodeCodePointsArray (codePoints) {
		  var len = codePoints.length;
		  if (len <= MAX_ARGUMENTS_LENGTH) {
		    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
		  }

		  // Decode in chunks to avoid "call stack size exceeded".
		  var res = '';
		  var i = 0;
		  while (i < len) {
		    res += String.fromCharCode.apply(
		      String,
		      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
		    );
		  }
		  return res
		}

		function asciiSlice (buf, start, end) {
		  var ret = '';
		  end = Math.min(buf.length, end);

		  for (var i = start; i < end; ++i) {
		    ret += String.fromCharCode(buf[i] & 0x7F);
		  }
		  return ret
		}

		function latin1Slice (buf, start, end) {
		  var ret = '';
		  end = Math.min(buf.length, end);

		  for (var i = start; i < end; ++i) {
		    ret += String.fromCharCode(buf[i]);
		  }
		  return ret
		}

		function hexSlice (buf, start, end) {
		  var len = buf.length;

		  if (!start || start < 0) start = 0;
		  if (!end || end < 0 || end > len) end = len;

		  var out = '';
		  for (var i = start; i < end; ++i) {
		    out += toHex(buf[i]);
		  }
		  return out
		}

		function utf16leSlice (buf, start, end) {
		  var bytes = buf.slice(start, end);
		  var res = '';
		  for (var i = 0; i < bytes.length; i += 2) {
		    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
		  }
		  return res
		}

		Buffer.prototype.slice = function slice (start, end) {
		  var len = this.length;
		  start = ~~start;
		  end = end === undefined ? len : ~~end;

		  if (start < 0) {
		    start += len;
		    if (start < 0) start = 0;
		  } else if (start > len) {
		    start = len;
		  }

		  if (end < 0) {
		    end += len;
		    if (end < 0) end = 0;
		  } else if (end > len) {
		    end = len;
		  }

		  if (end < start) end = start;

		  var newBuf;
		  if (Buffer.TYPED_ARRAY_SUPPORT) {
		    newBuf = this.subarray(start, end);
		    newBuf.__proto__ = Buffer.prototype;
		  } else {
		    var sliceLen = end - start;
		    newBuf = new Buffer(sliceLen, undefined);
		    for (var i = 0; i < sliceLen; ++i) {
		      newBuf[i] = this[i + start];
		    }
		  }

		  return newBuf
		};

		/*
		 * Need to make sure that buffer isn't trying to write out of bounds.
		 */
		function checkOffset (offset, ext, length) {
		  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
		  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
		}

		Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
		  offset = offset | 0;
		  byteLength = byteLength | 0;
		  if (!noAssert) checkOffset(offset, byteLength, this.length);

		  var val = this[offset];
		  var mul = 1;
		  var i = 0;
		  while (++i < byteLength && (mul *= 0x100)) {
		    val += this[offset + i] * mul;
		  }

		  return val
		};

		Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
		  offset = offset | 0;
		  byteLength = byteLength | 0;
		  if (!noAssert) {
		    checkOffset(offset, byteLength, this.length);
		  }

		  var val = this[offset + --byteLength];
		  var mul = 1;
		  while (byteLength > 0 && (mul *= 0x100)) {
		    val += this[offset + --byteLength] * mul;
		  }

		  return val
		};

		Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
		  if (!noAssert) checkOffset(offset, 1, this.length);
		  return this[offset]
		};

		Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
		  if (!noAssert) checkOffset(offset, 2, this.length);
		  return this[offset] | (this[offset + 1] << 8)
		};

		Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
		  if (!noAssert) checkOffset(offset, 2, this.length);
		  return (this[offset] << 8) | this[offset + 1]
		};

		Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
		  if (!noAssert) checkOffset(offset, 4, this.length);

		  return ((this[offset]) |
		      (this[offset + 1] << 8) |
		      (this[offset + 2] << 16)) +
		      (this[offset + 3] * 0x1000000)
		};

		Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
		  if (!noAssert) checkOffset(offset, 4, this.length);

		  return (this[offset] * 0x1000000) +
		    ((this[offset + 1] << 16) |
		    (this[offset + 2] << 8) |
		    this[offset + 3])
		};

		Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
		  offset = offset | 0;
		  byteLength = byteLength | 0;
		  if (!noAssert) checkOffset(offset, byteLength, this.length);

		  var val = this[offset];
		  var mul = 1;
		  var i = 0;
		  while (++i < byteLength && (mul *= 0x100)) {
		    val += this[offset + i] * mul;
		  }
		  mul *= 0x80;

		  if (val >= mul) val -= Math.pow(2, 8 * byteLength);

		  return val
		};

		Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
		  offset = offset | 0;
		  byteLength = byteLength | 0;
		  if (!noAssert) checkOffset(offset, byteLength, this.length);

		  var i = byteLength;
		  var mul = 1;
		  var val = this[offset + --i];
		  while (i > 0 && (mul *= 0x100)) {
		    val += this[offset + --i] * mul;
		  }
		  mul *= 0x80;

		  if (val >= mul) val -= Math.pow(2, 8 * byteLength);

		  return val
		};

		Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
		  if (!noAssert) checkOffset(offset, 1, this.length);
		  if (!(this[offset] & 0x80)) return (this[offset])
		  return ((0xff - this[offset] + 1) * -1)
		};

		Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
		  if (!noAssert) checkOffset(offset, 2, this.length);
		  var val = this[offset] | (this[offset + 1] << 8);
		  return (val & 0x8000) ? val | 0xFFFF0000 : val
		};

		Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
		  if (!noAssert) checkOffset(offset, 2, this.length);
		  var val = this[offset + 1] | (this[offset] << 8);
		  return (val & 0x8000) ? val | 0xFFFF0000 : val
		};

		Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
		  if (!noAssert) checkOffset(offset, 4, this.length);

		  return (this[offset]) |
		    (this[offset + 1] << 8) |
		    (this[offset + 2] << 16) |
		    (this[offset + 3] << 24)
		};

		Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
		  if (!noAssert) checkOffset(offset, 4, this.length);

		  return (this[offset] << 24) |
		    (this[offset + 1] << 16) |
		    (this[offset + 2] << 8) |
		    (this[offset + 3])
		};

		Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
		  if (!noAssert) checkOffset(offset, 4, this.length);
		  return ieee754.read(this, offset, true, 23, 4)
		};

		Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
		  if (!noAssert) checkOffset(offset, 4, this.length);
		  return ieee754.read(this, offset, false, 23, 4)
		};

		Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
		  if (!noAssert) checkOffset(offset, 8, this.length);
		  return ieee754.read(this, offset, true, 52, 8)
		};

		Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
		  if (!noAssert) checkOffset(offset, 8, this.length);
		  return ieee754.read(this, offset, false, 52, 8)
		};

		function checkInt (buf, value, offset, ext, max, min) {
		  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
		  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
		  if (offset + ext > buf.length) throw new RangeError('Index out of range')
		}

		Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
		  value = +value;
		  offset = offset | 0;
		  byteLength = byteLength | 0;
		  if (!noAssert) {
		    var maxBytes = Math.pow(2, 8 * byteLength) - 1;
		    checkInt(this, value, offset, byteLength, maxBytes, 0);
		  }

		  var mul = 1;
		  var i = 0;
		  this[offset] = value & 0xFF;
		  while (++i < byteLength && (mul *= 0x100)) {
		    this[offset + i] = (value / mul) & 0xFF;
		  }

		  return offset + byteLength
		};

		Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
		  value = +value;
		  offset = offset | 0;
		  byteLength = byteLength | 0;
		  if (!noAssert) {
		    var maxBytes = Math.pow(2, 8 * byteLength) - 1;
		    checkInt(this, value, offset, byteLength, maxBytes, 0);
		  }

		  var i = byteLength - 1;
		  var mul = 1;
		  this[offset + i] = value & 0xFF;
		  while (--i >= 0 && (mul *= 0x100)) {
		    this[offset + i] = (value / mul) & 0xFF;
		  }

		  return offset + byteLength
		};

		Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
		  value = +value;
		  offset = offset | 0;
		  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0);
		  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
		  this[offset] = (value & 0xff);
		  return offset + 1
		};

		function objectWriteUInt16 (buf, value, offset, littleEndian) {
		  if (value < 0) value = 0xffff + value + 1;
		  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
		    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
		      (littleEndian ? i : 1 - i) * 8;
		  }
		}

		Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
		  value = +value;
		  offset = offset | 0;
		  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
		  if (Buffer.TYPED_ARRAY_SUPPORT) {
		    this[offset] = (value & 0xff);
		    this[offset + 1] = (value >>> 8);
		  } else {
		    objectWriteUInt16(this, value, offset, true);
		  }
		  return offset + 2
		};

		Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
		  value = +value;
		  offset = offset | 0;
		  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
		  if (Buffer.TYPED_ARRAY_SUPPORT) {
		    this[offset] = (value >>> 8);
		    this[offset + 1] = (value & 0xff);
		  } else {
		    objectWriteUInt16(this, value, offset, false);
		  }
		  return offset + 2
		};

		function objectWriteUInt32 (buf, value, offset, littleEndian) {
		  if (value < 0) value = 0xffffffff + value + 1;
		  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
		    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff;
		  }
		}

		Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
		  value = +value;
		  offset = offset | 0;
		  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
		  if (Buffer.TYPED_ARRAY_SUPPORT) {
		    this[offset + 3] = (value >>> 24);
		    this[offset + 2] = (value >>> 16);
		    this[offset + 1] = (value >>> 8);
		    this[offset] = (value & 0xff);
		  } else {
		    objectWriteUInt32(this, value, offset, true);
		  }
		  return offset + 4
		};

		Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
		  value = +value;
		  offset = offset | 0;
		  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
		  if (Buffer.TYPED_ARRAY_SUPPORT) {
		    this[offset] = (value >>> 24);
		    this[offset + 1] = (value >>> 16);
		    this[offset + 2] = (value >>> 8);
		    this[offset + 3] = (value & 0xff);
		  } else {
		    objectWriteUInt32(this, value, offset, false);
		  }
		  return offset + 4
		};

		Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
		  value = +value;
		  offset = offset | 0;
		  if (!noAssert) {
		    var limit = Math.pow(2, 8 * byteLength - 1);

		    checkInt(this, value, offset, byteLength, limit - 1, -limit);
		  }

		  var i = 0;
		  var mul = 1;
		  var sub = 0;
		  this[offset] = value & 0xFF;
		  while (++i < byteLength && (mul *= 0x100)) {
		    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
		      sub = 1;
		    }
		    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
		  }

		  return offset + byteLength
		};

		Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
		  value = +value;
		  offset = offset | 0;
		  if (!noAssert) {
		    var limit = Math.pow(2, 8 * byteLength - 1);

		    checkInt(this, value, offset, byteLength, limit - 1, -limit);
		  }

		  var i = byteLength - 1;
		  var mul = 1;
		  var sub = 0;
		  this[offset + i] = value & 0xFF;
		  while (--i >= 0 && (mul *= 0x100)) {
		    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
		      sub = 1;
		    }
		    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
		  }

		  return offset + byteLength
		};

		Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
		  value = +value;
		  offset = offset | 0;
		  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80);
		  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
		  if (value < 0) value = 0xff + value + 1;
		  this[offset] = (value & 0xff);
		  return offset + 1
		};

		Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
		  value = +value;
		  offset = offset | 0;
		  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
		  if (Buffer.TYPED_ARRAY_SUPPORT) {
		    this[offset] = (value & 0xff);
		    this[offset + 1] = (value >>> 8);
		  } else {
		    objectWriteUInt16(this, value, offset, true);
		  }
		  return offset + 2
		};

		Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
		  value = +value;
		  offset = offset | 0;
		  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
		  if (Buffer.TYPED_ARRAY_SUPPORT) {
		    this[offset] = (value >>> 8);
		    this[offset + 1] = (value & 0xff);
		  } else {
		    objectWriteUInt16(this, value, offset, false);
		  }
		  return offset + 2
		};

		Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
		  value = +value;
		  offset = offset | 0;
		  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
		  if (Buffer.TYPED_ARRAY_SUPPORT) {
		    this[offset] = (value & 0xff);
		    this[offset + 1] = (value >>> 8);
		    this[offset + 2] = (value >>> 16);
		    this[offset + 3] = (value >>> 24);
		  } else {
		    objectWriteUInt32(this, value, offset, true);
		  }
		  return offset + 4
		};

		Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
		  value = +value;
		  offset = offset | 0;
		  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
		  if (value < 0) value = 0xffffffff + value + 1;
		  if (Buffer.TYPED_ARRAY_SUPPORT) {
		    this[offset] = (value >>> 24);
		    this[offset + 1] = (value >>> 16);
		    this[offset + 2] = (value >>> 8);
		    this[offset + 3] = (value & 0xff);
		  } else {
		    objectWriteUInt32(this, value, offset, false);
		  }
		  return offset + 4
		};

		function checkIEEE754 (buf, value, offset, ext, max, min) {
		  if (offset + ext > buf.length) throw new RangeError('Index out of range')
		  if (offset < 0) throw new RangeError('Index out of range')
		}

		function writeFloat (buf, value, offset, littleEndian, noAssert) {
		  if (!noAssert) {
		    checkIEEE754(buf, value, offset, 4);
		  }
		  ieee754.write(buf, value, offset, littleEndian, 23, 4);
		  return offset + 4
		}

		Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
		  return writeFloat(this, value, offset, true, noAssert)
		};

		Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
		  return writeFloat(this, value, offset, false, noAssert)
		};

		function writeDouble (buf, value, offset, littleEndian, noAssert) {
		  if (!noAssert) {
		    checkIEEE754(buf, value, offset, 8);
		  }
		  ieee754.write(buf, value, offset, littleEndian, 52, 8);
		  return offset + 8
		}

		Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
		  return writeDouble(this, value, offset, true, noAssert)
		};

		Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
		  return writeDouble(this, value, offset, false, noAssert)
		};

		// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
		Buffer.prototype.copy = function copy (target, targetStart, start, end) {
		  if (!start) start = 0;
		  if (!end && end !== 0) end = this.length;
		  if (targetStart >= target.length) targetStart = target.length;
		  if (!targetStart) targetStart = 0;
		  if (end > 0 && end < start) end = start;

		  // Copy 0 bytes; we're done
		  if (end === start) return 0
		  if (target.length === 0 || this.length === 0) return 0

		  // Fatal error conditions
		  if (targetStart < 0) {
		    throw new RangeError('targetStart out of bounds')
		  }
		  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
		  if (end < 0) throw new RangeError('sourceEnd out of bounds')

		  // Are we oob?
		  if (end > this.length) end = this.length;
		  if (target.length - targetStart < end - start) {
		    end = target.length - targetStart + start;
		  }

		  var len = end - start;
		  var i;

		  if (this === target && start < targetStart && targetStart < end) {
		    // descending copy from end
		    for (i = len - 1; i >= 0; --i) {
		      target[i + targetStart] = this[i + start];
		    }
		  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
		    // ascending copy from start
		    for (i = 0; i < len; ++i) {
		      target[i + targetStart] = this[i + start];
		    }
		  } else {
		    Uint8Array.prototype.set.call(
		      target,
		      this.subarray(start, start + len),
		      targetStart
		    );
		  }

		  return len
		};

		// Usage:
		//    buffer.fill(number[, offset[, end]])
		//    buffer.fill(buffer[, offset[, end]])
		//    buffer.fill(string[, offset[, end]][, encoding])
		Buffer.prototype.fill = function fill (val, start, end, encoding) {
		  // Handle string cases:
		  if (typeof val === 'string') {
		    if (typeof start === 'string') {
		      encoding = start;
		      start = 0;
		      end = this.length;
		    } else if (typeof end === 'string') {
		      encoding = end;
		      end = this.length;
		    }
		    if (val.length === 1) {
		      var code = val.charCodeAt(0);
		      if (code < 256) {
		        val = code;
		      }
		    }
		    if (encoding !== undefined && typeof encoding !== 'string') {
		      throw new TypeError('encoding must be a string')
		    }
		    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
		      throw new TypeError('Unknown encoding: ' + encoding)
		    }
		  } else if (typeof val === 'number') {
		    val = val & 255;
		  }

		  // Invalid ranges are not set to a default, so can range check early.
		  if (start < 0 || this.length < start || this.length < end) {
		    throw new RangeError('Out of range index')
		  }

		  if (end <= start) {
		    return this
		  }

		  start = start >>> 0;
		  end = end === undefined ? this.length : end >>> 0;

		  if (!val) val = 0;

		  var i;
		  if (typeof val === 'number') {
		    for (i = start; i < end; ++i) {
		      this[i] = val;
		    }
		  } else {
		    var bytes = Buffer.isBuffer(val)
		      ? val
		      : utf8ToBytes(new Buffer(val, encoding).toString());
		    var len = bytes.length;
		    for (i = 0; i < end - start; ++i) {
		      this[i + start] = bytes[i % len];
		    }
		  }

		  return this
		};

		// HELPER FUNCTIONS
		// ================

		var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g;

		function base64clean (str) {
		  // Node strips out invalid characters like \n and \t from the string, base64-js does not
		  str = stringtrim(str).replace(INVALID_BASE64_RE, '');
		  // Node converts strings with length < 2 to ''
		  if (str.length < 2) return ''
		  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
		  while (str.length % 4 !== 0) {
		    str = str + '=';
		  }
		  return str
		}

		function stringtrim (str) {
		  if (str.trim) return str.trim()
		  return str.replace(/^\s+|\s+$/g, '')
		}

		function toHex (n) {
		  if (n < 16) return '0' + n.toString(16)
		  return n.toString(16)
		}

		function utf8ToBytes (string, units) {
		  units = units || Infinity;
		  var codePoint;
		  var length = string.length;
		  var leadSurrogate = null;
		  var bytes = [];

		  for (var i = 0; i < length; ++i) {
		    codePoint = string.charCodeAt(i);

		    // is surrogate component
		    if (codePoint > 0xD7FF && codePoint < 0xE000) {
		      // last char was a lead
		      if (!leadSurrogate) {
		        // no lead yet
		        if (codePoint > 0xDBFF) {
		          // unexpected trail
		          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
		          continue
		        } else if (i + 1 === length) {
		          // unpaired lead
		          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
		          continue
		        }

		        // valid lead
		        leadSurrogate = codePoint;

		        continue
		      }

		      // 2 leads in a row
		      if (codePoint < 0xDC00) {
		        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
		        leadSurrogate = codePoint;
		        continue
		      }

		      // valid surrogate pair
		      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000;
		    } else if (leadSurrogate) {
		      // valid bmp char, but last char was a lead
		      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
		    }

		    leadSurrogate = null;

		    // encode utf8
		    if (codePoint < 0x80) {
		      if ((units -= 1) < 0) break
		      bytes.push(codePoint);
		    } else if (codePoint < 0x800) {
		      if ((units -= 2) < 0) break
		      bytes.push(
		        codePoint >> 0x6 | 0xC0,
		        codePoint & 0x3F | 0x80
		      );
		    } else if (codePoint < 0x10000) {
		      if ((units -= 3) < 0) break
		      bytes.push(
		        codePoint >> 0xC | 0xE0,
		        codePoint >> 0x6 & 0x3F | 0x80,
		        codePoint & 0x3F | 0x80
		      );
		    } else if (codePoint < 0x110000) {
		      if ((units -= 4) < 0) break
		      bytes.push(
		        codePoint >> 0x12 | 0xF0,
		        codePoint >> 0xC & 0x3F | 0x80,
		        codePoint >> 0x6 & 0x3F | 0x80,
		        codePoint & 0x3F | 0x80
		      );
		    } else {
		      throw new Error('Invalid code point')
		    }
		  }

		  return bytes
		}

		function asciiToBytes (str) {
		  var byteArray = [];
		  for (var i = 0; i < str.length; ++i) {
		    // Node's code seems to be doing this and not & 0x7F..
		    byteArray.push(str.charCodeAt(i) & 0xFF);
		  }
		  return byteArray
		}

		function utf16leToBytes (str, units) {
		  var c, hi, lo;
		  var byteArray = [];
		  for (var i = 0; i < str.length; ++i) {
		    if ((units -= 2) < 0) break

		    c = str.charCodeAt(i);
		    hi = c >> 8;
		    lo = c % 256;
		    byteArray.push(lo);
		    byteArray.push(hi);
		  }

		  return byteArray
		}

		function base64ToBytes (str) {
		  return base64.toByteArray(base64clean(str))
		}

		function blitBuffer (src, dst, offset, length) {
		  for (var i = 0; i < length; ++i) {
		    if ((i + offset >= dst.length) || (i >= src.length)) break
		    dst[i + offset] = src[i];
		  }
		  return i
		}

		function isnan (val) {
		  return val !== val // eslint-disable-line no-self-compare
		}
} (buffer));
	return buffer;
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

var events;
var hasRequiredEvents;

function requireEvents () {
	if (hasRequiredEvents) return events;
	hasRequiredEvents = 1;
	// Copyright Joyent, Inc. and other Node contributors.
	//
	// Permission is hereby granted, free of charge, to any person obtaining a
	// copy of this software and associated documentation files (the
	// "Software"), to deal in the Software without restriction, including
	// without limitation the rights to use, copy, modify, merge, publish,
	// distribute, sublicense, and/or sell copies of the Software, and to permit
	// persons to whom the Software is furnished to do so, subject to the
	// following conditions:
	//
	// The above copyright notice and this permission notice shall be included
	// in all copies or substantial portions of the Software.
	//
	// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
	// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
	// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
	// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
	// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
	// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
	// USE OR OTHER DEALINGS IN THE SOFTWARE.

	function EventEmitter() {
	  this._events = this._events || {};
	  this._maxListeners = this._maxListeners || undefined;
	}
	events = EventEmitter;

	// Backwards-compat with node 0.10.x
	EventEmitter.EventEmitter = EventEmitter;

	EventEmitter.prototype._events = undefined;
	EventEmitter.prototype._maxListeners = undefined;

	// By default EventEmitters will print a warning if more than 10 listeners are
	// added to it. This is a useful default which helps finding memory leaks.
	EventEmitter.defaultMaxListeners = 10;

	// Obviously not all Emitters should be limited to 10. This function allows
	// that to be increased. Set to zero for unlimited.
	EventEmitter.prototype.setMaxListeners = function(n) {
	  if (!isNumber(n) || n < 0 || isNaN(n))
	    throw TypeError('n must be a positive number');
	  this._maxListeners = n;
	  return this;
	};

	EventEmitter.prototype.emit = function(type) {
	  var er, handler, len, args, i, listeners;

	  if (!this._events)
	    this._events = {};

	  // If there is no 'error' event listener then throw.
	  if (type === 'error') {
	    if (!this._events.error ||
	        (isObject(this._events.error) && !this._events.error.length)) {
	      er = arguments[1];
	      if (er instanceof Error) {
	        throw er; // Unhandled 'error' event
	      } else {
	        // At least give some kind of context to the user
	        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
	        err.context = er;
	        throw err;
	      }
	    }
	  }

	  handler = this._events[type];

	  if (isUndefined(handler))
	    return false;

	  if (isFunction(handler)) {
	    switch (arguments.length) {
	      // fast cases
	      case 1:
	        handler.call(this);
	        break;
	      case 2:
	        handler.call(this, arguments[1]);
	        break;
	      case 3:
	        handler.call(this, arguments[1], arguments[2]);
	        break;
	      // slower
	      default:
	        args = Array.prototype.slice.call(arguments, 1);
	        handler.apply(this, args);
	    }
	  } else if (isObject(handler)) {
	    args = Array.prototype.slice.call(arguments, 1);
	    listeners = handler.slice();
	    len = listeners.length;
	    for (i = 0; i < len; i++)
	      listeners[i].apply(this, args);
	  }

	  return true;
	};

	EventEmitter.prototype.addListener = function(type, listener) {
	  var m;

	  if (!isFunction(listener))
	    throw TypeError('listener must be a function');

	  if (!this._events)
	    this._events = {};

	  // To avoid recursion in the case that type === "newListener"! Before
	  // adding it to the listeners, first emit "newListener".
	  if (this._events.newListener)
	    this.emit('newListener', type,
	              isFunction(listener.listener) ?
	              listener.listener : listener);

	  if (!this._events[type])
	    // Optimize the case of one listener. Don't need the extra array object.
	    this._events[type] = listener;
	  else if (isObject(this._events[type]))
	    // If we've already got an array, just append.
	    this._events[type].push(listener);
	  else
	    // Adding the second element, need to change to array.
	    this._events[type] = [this._events[type], listener];

	  // Check for listener leak
	  if (isObject(this._events[type]) && !this._events[type].warned) {
	    if (!isUndefined(this._maxListeners)) {
	      m = this._maxListeners;
	    } else {
	      m = EventEmitter.defaultMaxListeners;
	    }

	    if (m && m > 0 && this._events[type].length > m) {
	      this._events[type].warned = true;
	      console.error('(node) warning: possible EventEmitter memory ' +
	                    'leak detected. %d listeners added. ' +
	                    'Use emitter.setMaxListeners() to increase limit.',
	                    this._events[type].length);
	      if (typeof console.trace === 'function') {
	        // not supported in IE 10
	        console.trace();
	      }
	    }
	  }

	  return this;
	};

	EventEmitter.prototype.on = EventEmitter.prototype.addListener;

	EventEmitter.prototype.once = function(type, listener) {
	  if (!isFunction(listener))
	    throw TypeError('listener must be a function');

	  var fired = false;

	  function g() {
	    this.removeListener(type, g);

	    if (!fired) {
	      fired = true;
	      listener.apply(this, arguments);
	    }
	  }

	  g.listener = listener;
	  this.on(type, g);

	  return this;
	};

	// emits a 'removeListener' event iff the listener was removed
	EventEmitter.prototype.removeListener = function(type, listener) {
	  var list, position, length, i;

	  if (!isFunction(listener))
	    throw TypeError('listener must be a function');

	  if (!this._events || !this._events[type])
	    return this;

	  list = this._events[type];
	  length = list.length;
	  position = -1;

	  if (list === listener ||
	      (isFunction(list.listener) && list.listener === listener)) {
	    delete this._events[type];
	    if (this._events.removeListener)
	      this.emit('removeListener', type, listener);

	  } else if (isObject(list)) {
	    for (i = length; i-- > 0;) {
	      if (list[i] === listener ||
	          (list[i].listener && list[i].listener === listener)) {
	        position = i;
	        break;
	      }
	    }

	    if (position < 0)
	      return this;

	    if (list.length === 1) {
	      list.length = 0;
	      delete this._events[type];
	    } else {
	      list.splice(position, 1);
	    }

	    if (this._events.removeListener)
	      this.emit('removeListener', type, listener);
	  }

	  return this;
	};

	EventEmitter.prototype.removeAllListeners = function(type) {
	  var key, listeners;

	  if (!this._events)
	    return this;

	  // not listening for removeListener, no need to emit
	  if (!this._events.removeListener) {
	    if (arguments.length === 0)
	      this._events = {};
	    else if (this._events[type])
	      delete this._events[type];
	    return this;
	  }

	  // emit removeListener for all listeners on all events
	  if (arguments.length === 0) {
	    for (key in this._events) {
	      if (key === 'removeListener') continue;
	      this.removeAllListeners(key);
	    }
	    this.removeAllListeners('removeListener');
	    this._events = {};
	    return this;
	  }

	  listeners = this._events[type];

	  if (isFunction(listeners)) {
	    this.removeListener(type, listeners);
	  } else if (listeners) {
	    // LIFO order
	    while (listeners.length)
	      this.removeListener(type, listeners[listeners.length - 1]);
	  }
	  delete this._events[type];

	  return this;
	};

	EventEmitter.prototype.listeners = function(type) {
	  var ret;
	  if (!this._events || !this._events[type])
	    ret = [];
	  else if (isFunction(this._events[type]))
	    ret = [this._events[type]];
	  else
	    ret = this._events[type].slice();
	  return ret;
	};

	EventEmitter.prototype.listenerCount = function(type) {
	  if (this._events) {
	    var evlistener = this._events[type];

	    if (isFunction(evlistener))
	      return 1;
	    else if (evlistener)
	      return evlistener.length;
	  }
	  return 0;
	};

	EventEmitter.listenerCount = function(emitter, type) {
	  return emitter.listenerCount(type);
	};

	function isFunction(arg) {
	  return typeof arg === 'function';
	}

	function isNumber(arg) {
	  return typeof arg === 'number';
	}

	function isObject(arg) {
	  return typeof arg === 'object' && arg !== null;
	}

	function isUndefined(arg) {
	  return arg === void 0;
	}
	return events;
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

	var _require = requireBuffer(),
	    Buffer = _require.Buffer;

	var _require2 = requireUtil(),
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
		var buffer = requireBuffer();
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

	requireEvents().EventEmitter;

	var EElistenerCount = function EElistenerCount(emitter, type) {
	  return emitter.listeners(type).length;
	};
	/*</replacement>*/

	/*<replacement>*/


	var Stream = requireStream$1();
	/*</replacement>*/


	var Buffer = requireBuffer().Buffer;

	var OurUint8Array = commonjsGlobal.Uint8Array || function () {};

	function _uint8ArrayToBuffer(chunk) {
	  return Buffer.from(chunk);
	}

	function _isUint8Array(obj) {
	  return Buffer.isBuffer(obj) || obj instanceof OurUint8Array;
	}
	/*<replacement>*/


	var debugUtil = requireUtil();

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


	var Buffer = requireBuffer().Buffer;

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

	const util = requireUtil();
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

	const util = requireUtil();
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
	var Stream = require$$0__default$1["default"];
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

	const fs = require$$0__default$2["default"];
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

	const fs = require$$0__default$2["default"];
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

	const http = require$$0__default$3["default"];
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
 * Special check for Blob in order to avoid doing "instanceof Blob" which breaks rollup build
 * */
function isBlob(value) {
    return Boolean(value &&
        typeof value === 'object' &&
        // In our case we only care about .text() method
        'text' in value &&
        typeof value.text === 'function');
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
        if (result.SecretBinary instanceof Uint8Array) {
            return arrayBufferToString(result.SecretBinary);
        }
        else if (isBlob(result.SecretBinary)) {
            return await result.SecretBinary.text();
        }
        else {
            return result.SecretBinary.toString();
        }
    }
    else {
        return result.SecretString || '';
    }
}
async function fetchSecret(secretsManager, key, logger) {
    try {
        const result = await secretsManager
            .getSecretValue({
            SecretId: key,
        })
            .promise();
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
    constructor(request, SecretsManagerImpl = awsSdk.SecretsManager, logger = createLogger()) {
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
    const resultUri = await getResultUri(customerVariables);
    const resultUriRegex = new RegExp(`^${resultUri}(/.*)?$`);
    const pathname = removeTrailingSlashes(request.uri);
    const resultPathMatches = pathname.match(resultUriRegex);
    const agentUri = await getAgentUri(customerVariables);
    if (pathname === agentUri) {
        return downloadAgent({
            apiKey: getApiKey(request, logger),
            version: getVersion(request, logger),
            loaderVersion: getLoaderVersion(request, logger),
            method: request.method,
            headers: filterRequestHeaders(request),
            logger,
        });
    }
    else if (resultPathMatches?.length) {
        let suffix = '';
        if (resultPathMatches && resultPathMatches.length >= 1) {
            suffix = resultPathMatches[1] ?? '';
        }
        if (suffix.length > 0 && !suffix.startsWith('/')) {
            suffix = '/' + suffix;
        }
        return handleResult({
            region: getRegion(request, logger),
            querystring: request.querystring,
            method: request.method,
            headers: await prepareHeadersForIngressAPI(request, customerVariables),
            body: request.body?.data || '',
            logger,
            suffix,
        });
    }
    else {
        const statusUri = await getStatusUri(customerVariables);
        if (pathname === statusUri) {
            return handleStatus(customerVariables);
        }
        return new Promise((resolve) => resolve({
            status: '404',
        }));
    }
};

exports.handler = handler;
//# sourceMappingURL=fingerprintjs-pro-cloudfront-lambda-function.js.map
