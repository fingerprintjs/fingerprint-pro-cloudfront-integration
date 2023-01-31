/**
 * FingerprintJS Pro CloudFront Lambda function v1.0.0 - Copyright (c) FingerprintJS, Inc, 2023 (https://fingerprint.com)
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

const ALLOWED_RESPONSE_HEADERS = [
    'access-control-allow-credentials',
    'access-control-allow-origin',
    'access-control-expose-headers',
    'content-encoding',
    'content-type',
    'cross-origin-resource-policy',
    'etag',
    'vary',
];
const COOKIE_HEADER_NAME = 'set-cookie';
const CACHE_CONTROL_HEADER_NAME = 'cache-control';
const BLACKLISTED_REQUEST_HEADERS = ['content-length', 'host', 'transfer-encoding', 'via'];
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
        if (!BLACKLISTED_REQUEST_HEADERS.includes(headerName)) {
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
    for (const name of ALLOWED_RESPONSE_HEADERS) {
        const headerValue = headers[name];
        if (headerValue) {
            resultHeaders[name] = [
                {
                    key: name,
                    value: headerValue.toString(),
                },
            ];
        }
    }
    if (headers[COOKIE_HEADER_NAME] !== undefined) {
        resultHeaders[COOKIE_HEADER_NAME] = [
            {
                key: COOKIE_HEADER_NAME,
                value: adjustCookies(headers[COOKIE_HEADER_NAME], domain),
            },
        ];
    }
    if (headers[CACHE_CONTROL_HEADER_NAME] !== undefined) {
        resultHeaders[CACHE_CONTROL_HEADER_NAME] = [
            {
                key: CACHE_CONTROL_HEADER_NAME,
                value: updateCacheControlHeader(headers[CACHE_CONTROL_HEADER_NAME]),
            },
        ];
    }
    return resultHeaders;
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

const LAMBDA_FUNC_VERSION = '1.0.0';
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
        version: '1.0.0',
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
		suffix: "!www.ck",
		reversed: "kc.www"
	},
	{
		suffix: "*.0emm.com",
		reversed: "moc.mme0"
	},
	{
		suffix: "*.advisor.ws",
		reversed: "sw.rosivda"
	},
	{
		suffix: "*.alces.network",
		reversed: "krowten.secla"
	},
	{
		suffix: "*.awdev.ca",
		reversed: "ac.vedwa"
	},
	{
		suffix: "*.azurecontainer.io",
		reversed: "oi.reniatnoceruza"
	},
	{
		suffix: "*.backyards.banzaicloud.io",
		reversed: "oi.duolciaznab.sdraykcab"
	},
	{
		suffix: "*.banzai.cloud",
		reversed: "duolc.iaznab"
	},
	{
		suffix: "*.bd",
		reversed: "db"
	},
	{
		suffix: "*.beget.app",
		reversed: "ppa.tegeb"
	},
	{
		suffix: "*.build.run",
		reversed: "nur.dliub"
	},
	{
		suffix: "*.builder.code.com",
		reversed: "moc.edoc.redliub"
	},
	{
		suffix: "*.bzz.dapps.earth",
		reversed: "htrae.sppad.zzb"
	},
	{
		suffix: "*.ck",
		reversed: "kc"
	},
	{
		suffix: "*.cloud.metacentrum.cz",
		reversed: "zc.murtnecatem.duolc"
	},
	{
		suffix: "*.cloudera.site",
		reversed: "etis.areduolc"
	},
	{
		suffix: "*.cns.joyent.com",
		reversed: "moc.tneyoj.snc"
	},
	{
		suffix: "*.code.run",
		reversed: "nur.edoc"
	},
	{
		suffix: "*.compute-1.amazonaws.com",
		reversed: "moc.swanozama.1-etupmoc"
	},
	{
		suffix: "*.compute.amazonaws.com",
		reversed: "moc.swanozama.etupmoc"
	},
	{
		suffix: "*.compute.amazonaws.com.cn",
		reversed: "nc.moc.swanozama.etupmoc"
	},
	{
		suffix: "*.compute.estate",
		reversed: "etatse.etupmoc"
	},
	{
		suffix: "*.cryptonomic.net",
		reversed: "ten.cimonotpyrc"
	},
	{
		suffix: "*.customer-oci.com",
		reversed: "moc.ico-remotsuc"
	},
	{
		suffix: "*.dapps.earth",
		reversed: "htrae.sppad"
	},
	{
		suffix: "*.database.run",
		reversed: "nur.esabatad"
	},
	{
		suffix: "*.dev-builder.code.com",
		reversed: "moc.edoc.redliub-ved"
	},
	{
		suffix: "*.dev.adobeaemcloud.com",
		reversed: "moc.duolcmeaeboda.ved"
	},
	{
		suffix: "*.devcdnaccesso.com",
		reversed: "moc.osseccandcved"
	},
	{
		suffix: "*.developer.app",
		reversed: "ppa.repoleved"
	},
	{
		suffix: "*.digitaloceanspaces.com",
		reversed: "moc.secapsnaecolatigid"
	},
	{
		suffix: "*.diher.solutions",
		reversed: "snoitulos.rehid"
	},
	{
		suffix: "*.dweb.link",
		reversed: "knil.bewd"
	},
	{
		suffix: "*.elb.amazonaws.com",
		reversed: "moc.swanozama.ble"
	},
	{
		suffix: "*.elb.amazonaws.com.cn",
		reversed: "nc.moc.swanozama.ble"
	},
	{
		suffix: "*.er",
		reversed: "re"
	},
	{
		suffix: "*.ex.futurecms.at",
		reversed: "ta.smcerutuf.xe"
	},
	{
		suffix: "*.ex.ortsinfo.at",
		reversed: "ta.ofnistro.xe"
	},
	{
		suffix: "*.firenet.ch",
		reversed: "hc.tenerif"
	},
	{
		suffix: "*.fk",
		reversed: "kf"
	},
	{
		suffix: "*.frusky.de",
		reversed: "ed.yksurf"
	},
	{
		suffix: "*.futurecms.at",
		reversed: "ta.smcerutuf"
	},
	{
		suffix: "*.gateway.dev",
		reversed: "ved.yawetag"
	},
	{
		suffix: "*.hosting.myjino.ru",
		reversed: "ur.onijym.gnitsoh"
	},
	{
		suffix: "*.hosting.ovh.net",
		reversed: "ten.hvo.gnitsoh"
	},
	{
		suffix: "*.in.futurecms.at",
		reversed: "ta.smcerutuf.ni"
	},
	{
		suffix: "*.jm",
		reversed: "mj"
	},
	{
		suffix: "*.kawasaki.jp",
		reversed: "pj.ikasawak"
	},
	{
		suffix: "*.kh",
		reversed: "hk"
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
		suffix: "*.kunden.ortsinfo.at",
		reversed: "ta.ofnistro.nednuk"
	},
	{
		suffix: "*.landing.myjino.ru",
		reversed: "ur.onijym.gnidnal"
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
		suffix: "*.linodeobjects.com",
		reversed: "moc.stcejboedonil"
	},
	{
		suffix: "*.magentosite.cloud",
		reversed: "duolc.etisotnegam"
	},
	{
		suffix: "*.migration.run",
		reversed: "nur.noitargim"
	},
	{
		suffix: "*.mm",
		reversed: "mm"
	},
	{
		suffix: "*.moonscale.io",
		reversed: "oi.elacsnoom"
	},
	{
		suffix: "*.nagoya.jp",
		reversed: "pj.ayogan"
	},
	{
		suffix: "*.nodebalancer.linode.com",
		reversed: "moc.edonil.recnalabedon"
	},
	{
		suffix: "*.nom.br",
		reversed: "rb.mon"
	},
	{
		suffix: "*.northflank.app",
		reversed: "ppa.knalfhtron"
	},
	{
		suffix: "*.np",
		reversed: "pn"
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
		suffix: "*.on-acorn.io",
		reversed: "oi.nroca-no"
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
		suffix: "*.otap.co",
		reversed: "oc.pato"
	},
	{
		suffix: "*.owo.codes",
		reversed: "sedoc.owo"
	},
	{
		suffix: "*.paywhirl.com",
		reversed: "moc.lrihwyap"
	},
	{
		suffix: "*.pg",
		reversed: "gp"
	},
	{
		suffix: "*.platformsh.site",
		reversed: "etis.hsmroftalp"
	},
	{
		suffix: "*.quipelements.com",
		reversed: "moc.stnemelepiuq"
	},
	{
		suffix: "*.r.appspot.com",
		reversed: "moc.topsppa.r"
	},
	{
		suffix: "*.rss.my.id",
		reversed: "di.ym.ssr"
	},
	{
		suffix: "*.s5y.io",
		reversed: "oi.y5s"
	},
	{
		suffix: "*.sapporo.jp",
		reversed: "pj.oroppas"
	},
	{
		suffix: "*.sch.uk",
		reversed: "ku.hcs"
	},
	{
		suffix: "*.sendai.jp",
		reversed: "pj.iadnes"
	},
	{
		suffix: "*.sensiosite.cloud",
		reversed: "duolc.etisoisnes"
	},
	{
		suffix: "*.spectrum.myjino.ru",
		reversed: "ur.onijym.murtceps"
	},
	{
		suffix: "*.statics.cloud",
		reversed: "duolc.scitats"
	},
	{
		suffix: "*.stg-builder.code.com",
		reversed: "moc.edoc.redliub-gts"
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
		suffix: "*.stolos.io",
		reversed: "oi.solots"
	},
	{
		suffix: "*.svc.firenet.ch",
		reversed: "hc.tenerif.cvs"
	},
	{
		suffix: "*.sys.qcx.io",
		reversed: "oi.xcq.sys"
	},
	{
		suffix: "*.telebit.xyz",
		reversed: "zyx.tibelet"
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
		suffix: "*.triton.zone",
		reversed: "enoz.notirt"
	},
	{
		suffix: "*.tst.site",
		reversed: "etis.tst"
	},
	{
		suffix: "*.uberspace.de",
		reversed: "ed.ecapsrebu"
	},
	{
		suffix: "*.user.fm",
		reversed: "mf.resu"
	},
	{
		suffix: "*.user.localcert.dev",
		reversed: "ved.treclacol.resu"
	},
	{
		suffix: "*.usercontent.goog",
		reversed: "goog.tnetnocresu"
	},
	{
		suffix: "*.vps.myjino.ru",
		reversed: "ur.onijym.spv"
	},
	{
		suffix: "*.vultrobjects.com",
		reversed: "moc.stcejbortluv"
	},
	{
		suffix: "*.webhare.dev",
		reversed: "ved.erahbew"
	},
	{
		suffix: "*.webpaas.ovh.net",
		reversed: "ten.hvo.saapbew"
	},
	{
		suffix: "*.yokohama.jp",
		reversed: "pj.amahokoy"
	},
	{
		suffix: "0.bg",
		reversed: "gb.0"
	},
	{
		suffix: "001www.com",
		reversed: "moc.www100"
	},
	{
		suffix: "0e.vc",
		reversed: "cv.e0"
	},
	{
		suffix: "1.azurestaticapps.net",
		reversed: "ten.sppacitatseruza.1"
	},
	{
		suffix: "1.bg",
		reversed: "gb.1"
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
		suffix: "12hp.at",
		reversed: "ta.ph21"
	},
	{
		suffix: "12hp.ch",
		reversed: "hc.ph21"
	},
	{
		suffix: "12hp.de",
		reversed: "ed.ph21"
	},
	{
		suffix: "1337.pictures",
		reversed: "serutcip.7331"
	},
	{
		suffix: "16-b.it",
		reversed: "ti.b-61"
	},
	{
		suffix: "1kapp.com",
		reversed: "moc.ppak1"
	},
	{
		suffix: "2.azurestaticapps.net",
		reversed: "ten.sppacitatseruza.2"
	},
	{
		suffix: "2.bg",
		reversed: "gb.2"
	},
	{
		suffix: "2000.hu",
		reversed: "uh.0002"
	},
	{
		suffix: "2038.io",
		reversed: "oi.8302"
	},
	{
		suffix: "2ix.at",
		reversed: "ta.xi2"
	},
	{
		suffix: "2ix.ch",
		reversed: "hc.xi2"
	},
	{
		suffix: "2ix.de",
		reversed: "ed.xi2"
	},
	{
		suffix: "3.bg",
		reversed: "gb.3"
	},
	{
		suffix: "32-b.it",
		reversed: "ti.b-23"
	},
	{
		suffix: "3utilities.com",
		reversed: "moc.seitilitu3"
	},
	{
		suffix: "4.bg",
		reversed: "gb.4"
	},
	{
		suffix: "4lima.at",
		reversed: "ta.amil4"
	},
	{
		suffix: "4lima.ch",
		reversed: "hc.amil4"
	},
	{
		suffix: "4lima.de",
		reversed: "ed.amil4"
	},
	{
		suffix: "4u.com",
		reversed: "moc.u4"
	},
	{
		suffix: "5.bg",
		reversed: "gb.5"
	},
	{
		suffix: "5g.in",
		reversed: "ni.g5"
	},
	{
		suffix: "6.bg",
		reversed: "gb.6"
	},
	{
		suffix: "611.to",
		reversed: "ot.116"
	},
	{
		suffix: "64-b.it",
		reversed: "ti.b-46"
	},
	{
		suffix: "6g.in",
		reversed: "ni.g6"
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
		suffix: "9guacu.br",
		reversed: "rb.ucaug9"
	},
	{
		suffix: "a.bg",
		reversed: "gb.a"
	},
	{
		suffix: "a.prod.fastly.net",
		reversed: "ten.yltsaf.dorp.a"
	},
	{
		suffix: "a.run.app",
		reversed: "ppa.nur.a"
	},
	{
		suffix: "a.se",
		reversed: "es.a"
	},
	{
		suffix: "a.ssl.fastly.net",
		reversed: "ten.yltsaf.lss.a"
	},
	{
		suffix: "aa.no",
		reversed: "on.aa"
	},
	{
		suffix: "aaa",
		reversed: "aaa"
	},
	{
		suffix: "aaa.pro",
		reversed: "orp.aaa"
	},
	{
		suffix: "aarborte.no",
		reversed: "on.etrobraa"
	},
	{
		suffix: "aarp",
		reversed: "praa"
	},
	{
		suffix: "ab.ca",
		reversed: "ac.ba"
	},
	{
		suffix: "abarth",
		reversed: "htraba"
	},
	{
		suffix: "abashiri.hokkaido.jp",
		reversed: "pj.odiakkoh.irihsaba"
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
		suffix: "abc.br",
		reversed: "rb.cba"
	},
	{
		suffix: "abeno.osaka.jp",
		reversed: "pj.akaso.oneba"
	},
	{
		suffix: "abiko.chiba.jp",
		reversed: "pj.abihc.okiba"
	},
	{
		suffix: "abira.hokkaido.jp",
		reversed: "pj.odiakkoh.ariba"
	},
	{
		suffix: "abkhazia.su",
		reversed: "us.aizahkba"
	},
	{
		suffix: "able",
		reversed: "elba"
	},
	{
		suffix: "abo.pa",
		reversed: "ap.oba"
	},
	{
		suffix: "abogado",
		reversed: "odagoba"
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
		suffix: "abu.yamaguchi.jp",
		reversed: "pj.ihcugamay.uba"
	},
	{
		suffix: "abudhabi",
		reversed: "ibahduba"
	},
	{
		suffix: "ac",
		reversed: "ca"
	},
	{
		suffix: "ac.ae",
		reversed: "ea.ca"
	},
	{
		suffix: "ac.at",
		reversed: "ta.ca"
	},
	{
		suffix: "ac.be",
		reversed: "eb.ca"
	},
	{
		suffix: "ac.ci",
		reversed: "ic.ca"
	},
	{
		suffix: "ac.cn",
		reversed: "nc.ca"
	},
	{
		suffix: "ac.cr",
		reversed: "rc.ca"
	},
	{
		suffix: "ac.cy",
		reversed: "yc.ca"
	},
	{
		suffix: "ac.fj",
		reversed: "jf.ca"
	},
	{
		suffix: "ac.gn",
		reversed: "ng.ca"
	},
	{
		suffix: "ac.gov.br",
		reversed: "rb.vog.ca"
	},
	{
		suffix: "ac.id",
		reversed: "di.ca"
	},
	{
		suffix: "ac.il",
		reversed: "li.ca"
	},
	{
		suffix: "ac.im",
		reversed: "mi.ca"
	},
	{
		suffix: "ac.in",
		reversed: "ni.ca"
	},
	{
		suffix: "ac.ir",
		reversed: "ri.ca"
	},
	{
		suffix: "ac.jp",
		reversed: "pj.ca"
	},
	{
		suffix: "ac.ke",
		reversed: "ek.ca"
	},
	{
		suffix: "ac.kr",
		reversed: "rk.ca"
	},
	{
		suffix: "ac.leg.br",
		reversed: "rb.gel.ca"
	},
	{
		suffix: "ac.lk",
		reversed: "kl.ca"
	},
	{
		suffix: "ac.ls",
		reversed: "sl.ca"
	},
	{
		suffix: "ac.ma",
		reversed: "am.ca"
	},
	{
		suffix: "ac.me",
		reversed: "em.ca"
	},
	{
		suffix: "ac.mu",
		reversed: "um.ca"
	},
	{
		suffix: "ac.mw",
		reversed: "wm.ca"
	},
	{
		suffix: "ac.mz",
		reversed: "zm.ca"
	},
	{
		suffix: "ac.ni",
		reversed: "in.ca"
	},
	{
		suffix: "ac.nz",
		reversed: "zn.ca"
	},
	{
		suffix: "ac.pa",
		reversed: "ap.ca"
	},
	{
		suffix: "ac.pr",
		reversed: "rp.ca"
	},
	{
		suffix: "ac.rs",
		reversed: "sr.ca"
	},
	{
		suffix: "ac.ru",
		reversed: "ur.ca"
	},
	{
		suffix: "ac.rw",
		reversed: "wr.ca"
	},
	{
		suffix: "ac.se",
		reversed: "es.ca"
	},
	{
		suffix: "ac.sz",
		reversed: "zs.ca"
	},
	{
		suffix: "ac.th",
		reversed: "ht.ca"
	},
	{
		suffix: "ac.tj",
		reversed: "jt.ca"
	},
	{
		suffix: "ac.tz",
		reversed: "zt.ca"
	},
	{
		suffix: "ac.ug",
		reversed: "gu.ca"
	},
	{
		suffix: "ac.uk",
		reversed: "ku.ca"
	},
	{
		suffix: "ac.vn",
		reversed: "nv.ca"
	},
	{
		suffix: "ac.za",
		reversed: "az.ca"
	},
	{
		suffix: "ac.zm",
		reversed: "mz.ca"
	},
	{
		suffix: "ac.zw",
		reversed: "wz.ca"
	},
	{
		suffix: "aca.pro",
		reversed: "orp.aca"
	},
	{
		suffix: "academia.bo",
		reversed: "ob.aimedaca"
	},
	{
		suffix: "academy",
		reversed: "ymedaca"
	},
	{
		suffix: "academy.museum",
		reversed: "muesum.ymedaca"
	},
	{
		suffix: "accenture",
		reversed: "erutnecca"
	},
	{
		suffix: "accesscam.org",
		reversed: "gro.macssecca"
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
		suffix: "accountant",
		reversed: "tnatnuocca"
	},
	{
		suffix: "accountants",
		reversed: "stnatnuocca"
	},
	{
		suffix: "acct.pro",
		reversed: "orp.tcca"
	},
	{
		suffix: "achi.nagano.jp",
		reversed: "pj.onagan.ihca"
	},
	{
		suffix: "aco",
		reversed: "oca"
	},
	{
		suffix: "act.au",
		reversed: "ua.tca"
	},
	{
		suffix: "act.edu.au",
		reversed: "ua.ude.tca"
	},
	{
		suffix: "actor",
		reversed: "rotca"
	},
	{
		suffix: "ad",
		reversed: "da"
	},
	{
		suffix: "ad.jp",
		reversed: "pj.da"
	},
	{
		suffix: "adac",
		reversed: "cada"
	},
	{
		suffix: "adachi.tokyo.jp",
		reversed: "pj.oykot.ihcada"
	},
	{
		suffix: "adimo.co.uk",
		reversed: "ku.oc.omida"
	},
	{
		suffix: "adm.br",
		reversed: "rb.mda"
	},
	{
		suffix: "adobeaemcloud.com",
		reversed: "moc.duolcmeaeboda"
	},
	{
		suffix: "adobeaemcloud.net",
		reversed: "ten.duolcmeaeboda"
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
		suffix: "adult.ht",
		reversed: "th.tluda"
	},
	{
		suffix: "adv.br",
		reversed: "rb.vda"
	},
	{
		suffix: "adv.mz",
		reversed: "zm.vda"
	},
	{
		suffix: "adygeya.ru",
		reversed: "ur.ayegyda"
	},
	{
		suffix: "adygeya.su",
		reversed: "us.ayegyda"
	},
	{
		suffix: "ae",
		reversed: "ea"
	},
	{
		suffix: "ae.org",
		reversed: "gro.ea"
	},
	{
		suffix: "aeg",
		reversed: "gea"
	},
	{
		suffix: "aejrie.no",
		reversed: "on.eirjea"
	},
	{
		suffix: "aero",
		reversed: "orea"
	},
	{
		suffix: "aero.mv",
		reversed: "vm.orea"
	},
	{
		suffix: "aero.tt",
		reversed: "tt.orea"
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
		suffix: "aeroport.fr",
		reversed: "rf.troporea"
	},
	{
		suffix: "aetna",
		reversed: "antea"
	},
	{
		suffix: "af",
		reversed: "fa"
	},
	{
		suffix: "affinitylottery.org.uk",
		reversed: "ku.gro.yrettolytiniffa"
	},
	{
		suffix: "afjord.no",
		reversed: "on.drojfa"
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
		suffix: "africa.com",
		reversed: "moc.acirfa"
	},
	{
		suffix: "ag",
		reversed: "ga"
	},
	{
		suffix: "ag.it",
		reversed: "ti.ga"
	},
	{
		suffix: "aga.niigata.jp",
		reversed: "pj.atagiin.aga"
	},
	{
		suffix: "agakhan",
		reversed: "nahkaga"
	},
	{
		suffix: "agano.niigata.jp",
		reversed: "pj.atagiin.onaga"
	},
	{
		suffix: "agdenes.no",
		reversed: "on.senedga"
	},
	{
		suffix: "agematsu.nagano.jp",
		reversed: "pj.onagan.ustamega"
	},
	{
		suffix: "agency",
		reversed: "ycnega"
	},
	{
		suffix: "agents.aero",
		reversed: "orea.stnega"
	},
	{
		suffix: "agr.br",
		reversed: "rb.rga"
	},
	{
		suffix: "agrar.hu",
		reversed: "uh.rarga"
	},
	{
		suffix: "agric.za",
		reversed: "az.cirga"
	},
	{
		suffix: "agriculture.museum",
		reversed: "muesum.erutlucirga"
	},
	{
		suffix: "agrigento.it",
		reversed: "ti.otnegirga"
	},
	{
		suffix: "agro.bo",
		reversed: "ob.orga"
	},
	{
		suffix: "agro.pl",
		reversed: "lp.orga"
	},
	{
		suffix: "aguni.okinawa.jp",
		reversed: "pj.awaniko.inuga"
	},
	{
		suffix: "ah.cn",
		reversed: "nc.ha"
	},
	{
		suffix: "ah.no",
		reversed: "on.ha"
	},
	{
		suffix: "ai",
		reversed: "ia"
	},
	{
		suffix: "ai.in",
		reversed: "ni.ia"
	},
	{
		suffix: "aibetsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustebia"
	},
	{
		suffix: "aichi.jp",
		reversed: "pj.ihcia"
	},
	{
		suffix: "aid.pl",
		reversed: "lp.dia"
	},
	{
		suffix: "aig",
		reversed: "gia"
	},
	{
		suffix: "aikawa.kanagawa.jp",
		reversed: "pj.awaganak.awakia"
	},
	{
		suffix: "ainan.ehime.jp",
		reversed: "pj.emihe.nania"
	},
	{
		suffix: "aioi.hyogo.jp",
		reversed: "pj.ogoyh.ioia"
	},
	{
		suffix: "aip.ee",
		reversed: "ee.pia"
	},
	{
		suffix: "air-surveillance.aero",
		reversed: "orea.ecnallievrus-ria"
	},
	{
		suffix: "air-traffic-control.aero",
		reversed: "orea.lortnoc-ciffart-ria"
	},
	{
		suffix: "air.museum",
		reversed: "muesum.ria"
	},
	{
		suffix: "airbus",
		reversed: "subria"
	},
	{
		suffix: "aircraft.aero",
		reversed: "orea.tfarcria"
	},
	{
		suffix: "airforce",
		reversed: "ecrofria"
	},
	{
		suffix: "airguard.museum",
		reversed: "muesum.draugria"
	},
	{
		suffix: "airkitapps-au.com",
		reversed: "moc.ua-sppatikria"
	},
	{
		suffix: "airkitapps.com",
		reversed: "moc.sppatikria"
	},
	{
		suffix: "airkitapps.eu",
		reversed: "ue.sppatikria"
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
		suffix: "airtel",
		reversed: "letria"
	},
	{
		suffix: "airtraffic.aero",
		reversed: "orea.ciffartria"
	},
	{
		suffix: "aisai.aichi.jp",
		reversed: "pj.ihcia.iasia"
	},
	{
		suffix: "aisho.shiga.jp",
		reversed: "pj.agihs.ohsia"
	},
	{
		suffix: "aivencloud.com",
		reversed: "moc.duolcnevia"
	},
	{
		suffix: "aizubange.fukushima.jp",
		reversed: "pj.amihsukuf.egnabuzia"
	},
	{
		suffix: "aizumi.tokushima.jp",
		reversed: "pj.amihsukot.imuzia"
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
		suffix: "aju.br",
		reversed: "rb.uja"
	},
	{
		suffix: "ak.us",
		reversed: "su.ka"
	},
	{
		suffix: "akabira.hokkaido.jp",
		reversed: "pj.odiakkoh.aribaka"
	},
	{
		suffix: "akagi.shimane.jp",
		reversed: "pj.enamihs.igaka"
	},
	{
		suffix: "akaiwa.okayama.jp",
		reversed: "pj.amayako.awiaka"
	},
	{
		suffix: "akashi.hyogo.jp",
		reversed: "pj.ogoyh.ihsaka"
	},
	{
		suffix: "akdn",
		reversed: "ndka"
	},
	{
		suffix: "aki.kochi.jp",
		reversed: "pj.ihcok.ika"
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
		suffix: "akita.akita.jp",
		reversed: "pj.atika.atika"
	},
	{
		suffix: "akita.jp",
		reversed: "pj.atika"
	},
	{
		suffix: "akkeshi.hokkaido.jp",
		reversed: "pj.odiakkoh.ihsekka"
	},
	{
		suffix: "aknoluokta.no",
		reversed: "on.atkoulonka"
	},
	{
		suffix: "ako.hyogo.jp",
		reversed: "pj.ogoyh.oka"
	},
	{
		suffix: "akrehamn.no",
		reversed: "on.nmaherka"
	},
	{
		suffix: "aktyubinsk.su",
		reversed: "us.ksnibuytka"
	},
	{
		suffix: "akune.kagoshima.jp",
		reversed: "pj.amihsogak.enuka"
	},
	{
		suffix: "al",
		reversed: "la"
	},
	{
		suffix: "al.eu.org",
		reversed: "gro.ue.la"
	},
	{
		suffix: "al.gov.br",
		reversed: "rb.vog.la"
	},
	{
		suffix: "al.it",
		reversed: "ti.la"
	},
	{
		suffix: "al.leg.br",
		reversed: "rb.gel.la"
	},
	{
		suffix: "al.no",
		reversed: "on.la"
	},
	{
		suffix: "al.us",
		reversed: "su.la"
	},
	{
		suffix: "alabama.museum",
		reversed: "muesum.amabala"
	},
	{
		suffix: "alaheadju.no",
		reversed: "on.ujdaehala"
	},
	{
		suffix: "aland.fi",
		reversed: "if.dnala"
	},
	{
		suffix: "alaska.museum",
		reversed: "muesum.aksala"
	},
	{
		suffix: "alessandria.it",
		reversed: "ti.airdnassela"
	},
	{
		suffix: "alesund.no",
		reversed: "on.dnusela"
	},
	{
		suffix: "alfaromeo",
		reversed: "oemorafla"
	},
	{
		suffix: "algard.no",
		reversed: "on.dragla"
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
		suffix: "alp1.ae.flow.ch",
		reversed: "hc.wolf.ea.1pla"
	},
	{
		suffix: "alpha-myqnapcloud.com",
		reversed: "moc.duolcpanqym-ahpla"
	},
	{
		suffix: "alpha.bounty-full.com",
		reversed: "moc.lluf-ytnuob.ahpla"
	},
	{
		suffix: "alsace",
		reversed: "ecasla"
	},
	{
		suffix: "alstahaug.no",
		reversed: "on.guahatsla"
	},
	{
		suffix: "alstom",
		reversed: "motsla"
	},
	{
		suffix: "alt.za",
		reversed: "az.tla"
	},
	{
		suffix: "alta.no",
		reversed: "on.atla"
	},
	{
		suffix: "altervista.org",
		reversed: "gro.atsivretla"
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
		suffix: "alvdal.no",
		reversed: "on.ladvla"
	},
	{
		suffix: "alwaysdata.net",
		reversed: "ten.atadsyawla"
	},
	{
		suffix: "am",
		reversed: "ma"
	},
	{
		suffix: "am.br",
		reversed: "rb.ma"
	},
	{
		suffix: "am.gov.br",
		reversed: "rb.vog.ma"
	},
	{
		suffix: "am.in",
		reversed: "ni.ma"
	},
	{
		suffix: "am.leg.br",
		reversed: "rb.gel.ma"
	},
	{
		suffix: "ama.aichi.jp",
		reversed: "pj.ihcia.ama"
	},
	{
		suffix: "ama.shimane.jp",
		reversed: "pj.enamihs.ama"
	},
	{
		suffix: "amagasaki.hyogo.jp",
		reversed: "pj.ogoyh.ikasagama"
	},
	{
		suffix: "amakusa.kumamoto.jp",
		reversed: "pj.otomamuk.asukama"
	},
	{
		suffix: "amami.kagoshima.jp",
		reversed: "pj.amihsogak.imama"
	},
	{
		suffix: "amazon",
		reversed: "nozama"
	},
	{
		suffix: "amber.museum",
		reversed: "muesum.rebma"
	},
	{
		suffix: "ambulance.aero",
		reversed: "orea.ecnalubma"
	},
	{
		suffix: "ambulance.museum",
		reversed: "muesum.ecnalubma"
	},
	{
		suffix: "american.museum",
		reversed: "muesum.nacirema"
	},
	{
		suffix: "americana.museum",
		reversed: "muesum.anacirema"
	},
	{
		suffix: "americanantiques.museum",
		reversed: "muesum.seuqitnanacirema"
	},
	{
		suffix: "americanart.museum",
		reversed: "muesum.tranacirema"
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
		suffix: "ami.ibaraki.jp",
		reversed: "pj.ikarabi.ima"
	},
	{
		suffix: "amica",
		reversed: "acima"
	},
	{
		suffix: "amli.no",
		reversed: "on.ilma"
	},
	{
		suffix: "amot.no",
		reversed: "on.toma"
	},
	{
		suffix: "amscompute.com",
		reversed: "moc.etupmocsma"
	},
	{
		suffix: "amsterdam",
		reversed: "madretsma"
	},
	{
		suffix: "amsterdam.museum",
		reversed: "muesum.madretsma"
	},
	{
		suffix: "amusement.aero",
		reversed: "orea.tnemesuma"
	},
	{
		suffix: "an.it",
		reversed: "ti.na"
	},
	{
		suffix: "analytics",
		reversed: "scitylana"
	},
	{
		suffix: "anamizu.ishikawa.jp",
		reversed: "pj.awakihsi.uzimana"
	},
	{
		suffix: "anan.nagano.jp",
		reversed: "pj.onagan.nana"
	},
	{
		suffix: "anan.tokushima.jp",
		reversed: "pj.amihsukot.nana"
	},
	{
		suffix: "anani.br",
		reversed: "rb.inana"
	},
	{
		suffix: "ancona.it",
		reversed: "ti.anocna"
	},
	{
		suffix: "and.museum",
		reversed: "muesum.dna"
	},
	{
		suffix: "andasuolo.no",
		reversed: "on.olousadna"
	},
	{
		suffix: "andebu.no",
		reversed: "on.ubedna"
	},
	{
		suffix: "ando.nara.jp",
		reversed: "pj.aran.odna"
	},
	{
		suffix: "andoy.no",
		reversed: "on.yodna"
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
		suffix: "android",
		reversed: "diordna"
	},
	{
		suffix: "andøy.no",
		reversed: "on.ari-ydna--nx"
	},
	{
		suffix: "angry.jp",
		reversed: "pj.yrgna"
	},
	{
		suffix: "anjo.aichi.jp",
		reversed: "pj.ihcia.ojna"
	},
	{
		suffix: "ann-arbor.mi.us",
		reversed: "su.im.robra-nna"
	},
	{
		suffix: "annaka.gunma.jp",
		reversed: "pj.amnug.akanna"
	},
	{
		suffix: "annefrank.museum",
		reversed: "muesum.knarfenna"
	},
	{
		suffix: "anpachi.gifu.jp",
		reversed: "pj.ufig.ihcapna"
	},
	{
		suffix: "anquan",
		reversed: "nauqna"
	},
	{
		suffix: "anthro.museum",
		reversed: "muesum.orhtna"
	},
	{
		suffix: "anthropology.museum",
		reversed: "muesum.ygoloporhtna"
	},
	{
		suffix: "antiques.museum",
		reversed: "muesum.seuqitna"
	},
	{
		suffix: "anz",
		reversed: "zna"
	},
	{
		suffix: "ao",
		reversed: "oa"
	},
	{
		suffix: "ao.it",
		reversed: "ti.oa"
	},
	{
		suffix: "aogaki.hyogo.jp",
		reversed: "pj.ogoyh.ikagoa"
	},
	{
		suffix: "aogashima.tokyo.jp",
		reversed: "pj.oykot.amihsagoa"
	},
	{
		suffix: "aoki.nagano.jp",
		reversed: "pj.onagan.ikoa"
	},
	{
		suffix: "aol",
		reversed: "loa"
	},
	{
		suffix: "aomori.aomori.jp",
		reversed: "pj.iromoa.iromoa"
	},
	{
		suffix: "aomori.jp",
		reversed: "pj.iromoa"
	},
	{
		suffix: "aosta-valley.it",
		reversed: "ti.yellav-atsoa"
	},
	{
		suffix: "aosta.it",
		reversed: "ti.atsoa"
	},
	{
		suffix: "aostavalley.it",
		reversed: "ti.yellavatsoa"
	},
	{
		suffix: "aoste.it",
		reversed: "ti.etsoa"
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
		suffix: "ap.gov.br",
		reversed: "rb.vog.pa"
	},
	{
		suffix: "ap.gov.pl",
		reversed: "lp.vog.pa"
	},
	{
		suffix: "ap.it",
		reversed: "ti.pa"
	},
	{
		suffix: "ap.leg.br",
		reversed: "rb.gel.pa"
	},
	{
		suffix: "aparecida.br",
		reversed: "rb.adicerapa"
	},
	{
		suffix: "apartments",
		reversed: "stnemtrapa"
	},
	{
		suffix: "api.gov.uk",
		reversed: "ku.vog.ipa"
	},
	{
		suffix: "api.stdlib.com",
		reversed: "moc.bildts.ipa"
	},
	{
		suffix: "apigee.io",
		reversed: "oi.eegipa"
	},
	{
		suffix: "app",
		reversed: "ppa"
	},
	{
		suffix: "app.banzaicloud.io",
		reversed: "oi.duolciaznab.ppa"
	},
	{
		suffix: "app.br",
		reversed: "rb.ppa"
	},
	{
		suffix: "app.gp",
		reversed: "pg.ppa"
	},
	{
		suffix: "app.lmpm.com",
		reversed: "moc.mpml.ppa"
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
		suffix: "app.render.com",
		reversed: "moc.redner.ppa"
	},
	{
		suffix: "appchizi.com",
		reversed: "moc.izihcppa"
	},
	{
		suffix: "appengine.flow.ch",
		reversed: "hc.wolf.enigneppa"
	},
	{
		suffix: "apple",
		reversed: "elppa"
	},
	{
		suffix: "applinzi.com",
		reversed: "moc.iznilppa"
	},
	{
		suffix: "apps.fbsbx.com",
		reversed: "moc.xbsbf.sppa"
	},
	{
		suffix: "apps.lair.io",
		reversed: "oi.rial.sppa"
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
		suffix: "appspot.com",
		reversed: "moc.topsppa"
	},
	{
		suffix: "appudo.net",
		reversed: "ten.oduppa"
	},
	{
		suffix: "aq",
		reversed: "qa"
	},
	{
		suffix: "aq.it",
		reversed: "ti.qa"
	},
	{
		suffix: "aquarelle",
		reversed: "ellerauqa"
	},
	{
		suffix: "aquarium.museum",
		reversed: "muesum.muirauqa"
	},
	{
		suffix: "aquila.it",
		reversed: "ti.aliuqa"
	},
	{
		suffix: "ar",
		reversed: "ra"
	},
	{
		suffix: "ar.com",
		reversed: "moc.ra"
	},
	{
		suffix: "ar.it",
		reversed: "ti.ra"
	},
	{
		suffix: "ar.us",
		reversed: "su.ra"
	},
	{
		suffix: "arab",
		reversed: "bara"
	},
	{
		suffix: "arai.shizuoka.jp",
		reversed: "pj.akouzihs.iara"
	},
	{
		suffix: "arakawa.saitama.jp",
		reversed: "pj.amatias.awakara"
	},
	{
		suffix: "arakawa.tokyo.jp",
		reversed: "pj.oykot.awakara"
	},
	{
		suffix: "aramco",
		reversed: "ocmara"
	},
	{
		suffix: "arao.kumamoto.jp",
		reversed: "pj.otomamuk.oara"
	},
	{
		suffix: "arboretum.museum",
		reversed: "muesum.muterobra"
	},
	{
		suffix: "archaeological.museum",
		reversed: "muesum.lacigoloeahcra"
	},
	{
		suffix: "archaeology.museum",
		reversed: "muesum.ygoloeahcra"
	},
	{
		suffix: "archi",
		reversed: "ihcra"
	},
	{
		suffix: "architecture.museum",
		reversed: "muesum.erutcetihcra"
	},
	{
		suffix: "ardal.no",
		reversed: "on.ladra"
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
		suffix: "arezzo.it",
		reversed: "ti.ozzera"
	},
	{
		suffix: "ariake.saga.jp",
		reversed: "pj.agas.ekaira"
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
		suffix: "arita.saga.jp",
		reversed: "pj.agas.atira"
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
		suffix: "army",
		reversed: "ymra"
	},
	{
		suffix: "arna.no",
		reversed: "on.anra"
	},
	{
		suffix: "arpa",
		reversed: "apra"
	},
	{
		suffix: "arq.br",
		reversed: "rb.qra"
	},
	{
		suffix: "art",
		reversed: "tra"
	},
	{
		suffix: "art.br",
		reversed: "rb.tra"
	},
	{
		suffix: "art.do",
		reversed: "od.tra"
	},
	{
		suffix: "art.dz",
		reversed: "zd.tra"
	},
	{
		suffix: "art.ht",
		reversed: "th.tra"
	},
	{
		suffix: "art.museum",
		reversed: "muesum.tra"
	},
	{
		suffix: "art.pl",
		reversed: "lp.tra"
	},
	{
		suffix: "art.sn",
		reversed: "ns.tra"
	},
	{
		suffix: "artanddesign.museum",
		reversed: "muesum.ngiseddnatra"
	},
	{
		suffix: "artcenter.museum",
		reversed: "muesum.retnectra"
	},
	{
		suffix: "artdeco.museum",
		reversed: "muesum.ocedtra"
	},
	{
		suffix: "arte",
		reversed: "etra"
	},
	{
		suffix: "arte.bo",
		reversed: "ob.etra"
	},
	{
		suffix: "arteducation.museum",
		reversed: "muesum.noitacudetra"
	},
	{
		suffix: "artgallery.museum",
		reversed: "muesum.yrellagtra"
	},
	{
		suffix: "arts.co",
		reversed: "oc.stra"
	},
	{
		suffix: "arts.museum",
		reversed: "muesum.stra"
	},
	{
		suffix: "arts.nf",
		reversed: "fn.stra"
	},
	{
		suffix: "arts.ro",
		reversed: "or.stra"
	},
	{
		suffix: "arts.ve",
		reversed: "ev.stra"
	},
	{
		suffix: "artsandcrafts.museum",
		reversed: "muesum.stfarcdnastra"
	},
	{
		suffix: "arvo.network",
		reversed: "krowten.ovra"
	},
	{
		suffix: "as",
		reversed: "sa"
	},
	{
		suffix: "as.us",
		reversed: "su.sa"
	},
	{
		suffix: "asago.hyogo.jp",
		reversed: "pj.ogoyh.ogasa"
	},
	{
		suffix: "asahi.chiba.jp",
		reversed: "pj.abihc.ihasa"
	},
	{
		suffix: "asahi.ibaraki.jp",
		reversed: "pj.ikarabi.ihasa"
	},
	{
		suffix: "asahi.mie.jp",
		reversed: "pj.eim.ihasa"
	},
	{
		suffix: "asahi.nagano.jp",
		reversed: "pj.onagan.ihasa"
	},
	{
		suffix: "asahi.toyama.jp",
		reversed: "pj.amayot.ihasa"
	},
	{
		suffix: "asahi.yamagata.jp",
		reversed: "pj.atagamay.ihasa"
	},
	{
		suffix: "asahikawa.hokkaido.jp",
		reversed: "pj.odiakkoh.awakihasa"
	},
	{
		suffix: "asaka.saitama.jp",
		reversed: "pj.amatias.akasa"
	},
	{
		suffix: "asakawa.fukushima.jp",
		reversed: "pj.amihsukuf.awakasa"
	},
	{
		suffix: "asakuchi.okayama.jp",
		reversed: "pj.amayako.ihcukasa"
	},
	{
		suffix: "asaminami.hiroshima.jp",
		reversed: "pj.amihsorih.imanimasa"
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
		suffix: "asda",
		reversed: "adsa"
	},
	{
		suffix: "aseral.no",
		reversed: "on.laresa"
	},
	{
		suffix: "ashgabad.su",
		reversed: "us.dabaghsa"
	},
	{
		suffix: "ashibetsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustebihsa"
	},
	{
		suffix: "ashikaga.tochigi.jp",
		reversed: "pj.igihcot.agakihsa"
	},
	{
		suffix: "ashiya.fukuoka.jp",
		reversed: "pj.akoukuf.ayihsa"
	},
	{
		suffix: "ashiya.hyogo.jp",
		reversed: "pj.ogoyh.ayihsa"
	},
	{
		suffix: "ashoro.hokkaido.jp",
		reversed: "pj.odiakkoh.orohsa"
	},
	{
		suffix: "asia",
		reversed: "aisa"
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
		suffix: "askoy.no",
		reversed: "on.yoksa"
	},
	{
		suffix: "askvoll.no",
		reversed: "on.llovksa"
	},
	{
		suffix: "askøy.no",
		reversed: "on.ari-yksa--nx"
	},
	{
		suffix: "asmatart.museum",
		reversed: "muesum.tratamsa"
	},
	{
		suffix: "asn.au",
		reversed: "ua.nsa"
	},
	{
		suffix: "asn.lv",
		reversed: "vl.nsa"
	},
	{
		suffix: "asnes.no",
		reversed: "on.sensa"
	},
	{
		suffix: "aso.kumamoto.jp",
		reversed: "pj.otomamuk.osa"
	},
	{
		suffix: "ass.km",
		reversed: "mk.ssa"
	},
	{
		suffix: "assabu.hokkaido.jp",
		reversed: "pj.odiakkoh.ubassa"
	},
	{
		suffix: "assassination.museum",
		reversed: "muesum.noitanissassa"
	},
	{
		suffix: "assisi.museum",
		reversed: "muesum.isissa"
	},
	{
		suffix: "assn.lk",
		reversed: "kl.nssa"
	},
	{
		suffix: "asso.bj",
		reversed: "jb.ossa"
	},
	{
		suffix: "asso.ci",
		reversed: "ic.ossa"
	},
	{
		suffix: "asso.dz",
		reversed: "zd.ossa"
	},
	{
		suffix: "asso.eu.org",
		reversed: "gro.ue.ossa"
	},
	{
		suffix: "asso.fr",
		reversed: "rf.ossa"
	},
	{
		suffix: "asso.gp",
		reversed: "pg.ossa"
	},
	{
		suffix: "asso.ht",
		reversed: "th.ossa"
	},
	{
		suffix: "asso.km",
		reversed: "mk.ossa"
	},
	{
		suffix: "asso.mc",
		reversed: "cm.ossa"
	},
	{
		suffix: "asso.nc",
		reversed: "cn.ossa"
	},
	{
		suffix: "asso.re",
		reversed: "er.ossa"
	},
	{
		suffix: "associates",
		reversed: "setaicossa"
	},
	{
		suffix: "association.aero",
		reversed: "orea.noitaicossa"
	},
	{
		suffix: "association.museum",
		reversed: "muesum.noitaicossa"
	},
	{
		suffix: "asti.it",
		reversed: "ti.itsa"
	},
	{
		suffix: "astronomy.museum",
		reversed: "muesum.ymonortsa"
	},
	{
		suffix: "asuke.aichi.jp",
		reversed: "pj.ihcia.ekusa"
	},
	{
		suffix: "at",
		reversed: "ta"
	},
	{
		suffix: "at-band-camp.net",
		reversed: "ten.pmac-dnab-ta"
	},
	{
		suffix: "at.eu.org",
		reversed: "gro.ue.ta"
	},
	{
		suffix: "at.it",
		reversed: "ti.ta"
	},
	{
		suffix: "at.md",
		reversed: "dm.ta"
	},
	{
		suffix: "at.vg",
		reversed: "gv.ta"
	},
	{
		suffix: "atami.shizuoka.jp",
		reversed: "pj.akouzihs.imata"
	},
	{
		suffix: "ath.cx",
		reversed: "xc.hta"
	},
	{
		suffix: "athleta",
		reversed: "atelhta"
	},
	{
		suffix: "atl.jelastic.vps-host.net",
		reversed: "ten.tsoh-spv.citsalej.lta"
	},
	{
		suffix: "atlanta.museum",
		reversed: "muesum.atnalta"
	},
	{
		suffix: "atm.pl",
		reversed: "lp.mta"
	},
	{
		suffix: "ato.br",
		reversed: "rb.ota"
	},
	{
		suffix: "atsugi.kanagawa.jp",
		reversed: "pj.awaganak.igusta"
	},
	{
		suffix: "atsuma.hokkaido.jp",
		reversed: "pj.odiakkoh.amusta"
	},
	{
		suffix: "attorney",
		reversed: "yenrotta"
	},
	{
		suffix: "au",
		reversed: "ua"
	},
	{
		suffix: "au.eu.org",
		reversed: "gro.ue.ua"
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
		suffix: "audnedaln.no",
		reversed: "on.nladendua"
	},
	{
		suffix: "augustow.pl",
		reversed: "lp.wotsugua"
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
		suffix: "aus.basketball",
		reversed: "llabteksab.sua"
	},
	{
		suffix: "auspost",
		reversed: "tsopsua"
	},
	{
		suffix: "austevoll.no",
		reversed: "on.llovetsua"
	},
	{
		suffix: "austin.museum",
		reversed: "muesum.nitsua"
	},
	{
		suffix: "australia.museum",
		reversed: "muesum.ailartsua"
	},
	{
		suffix: "austrheim.no",
		reversed: "on.miehrtsua"
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
		suffix: "author",
		reversed: "rohtua"
	},
	{
		suffix: "author.aero",
		reversed: "orea.rohtua"
	},
	{
		suffix: "auto",
		reversed: "otua"
	},
	{
		suffix: "auto.pl",
		reversed: "lp.otua"
	},
	{
		suffix: "automotive.museum",
		reversed: "muesum.evitomotua"
	},
	{
		suffix: "autos",
		reversed: "sotua"
	},
	{
		suffix: "av.it",
		reversed: "ti.va"
	},
	{
		suffix: "av.tr",
		reversed: "rt.va"
	},
	{
		suffix: "avellino.it",
		reversed: "ti.onilleva"
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
		suffix: "avianca",
		reversed: "acnaiva"
	},
	{
		suffix: "aviation.museum",
		reversed: "muesum.noitaiva"
	},
	{
		suffix: "avocat.fr",
		reversed: "rf.tacova"
	},
	{
		suffix: "avocat.pro",
		reversed: "orp.tacova"
	},
	{
		suffix: "avoues.fr",
		reversed: "rf.seuova"
	},
	{
		suffix: "aw",
		reversed: "wa"
	},
	{
		suffix: "awaji.hyogo.jp",
		reversed: "pj.ogoyh.ijawa"
	},
	{
		suffix: "aws",
		reversed: "swa"
	},
	{
		suffix: "awsglobalaccelerator.com",
		reversed: "moc.rotareleccalabolgswa"
	},
	{
		suffix: "awsmppl.com",
		reversed: "moc.lppmswa"
	},
	{
		suffix: "ax",
		reversed: "xa"
	},
	{
		suffix: "axa",
		reversed: "axa"
	},
	{
		suffix: "axis.museum",
		reversed: "muesum.sixa"
	},
	{
		suffix: "aya.miyazaki.jp",
		reversed: "pj.ikazayim.aya"
	},
	{
		suffix: "ayabe.kyoto.jp",
		reversed: "pj.otoyk.ebaya"
	},
	{
		suffix: "ayagawa.kagawa.jp",
		reversed: "pj.awagak.awagaya"
	},
	{
		suffix: "ayase.kanagawa.jp",
		reversed: "pj.awaganak.esaya"
	},
	{
		suffix: "az",
		reversed: "za"
	},
	{
		suffix: "az.us",
		reversed: "su.za"
	},
	{
		suffix: "azerbaijan.su",
		reversed: "us.najiabreza"
	},
	{
		suffix: "azimuth.network",
		reversed: "krowten.htumiza"
	},
	{
		suffix: "azumino.nagano.jp",
		reversed: "pj.onagan.onimuza"
	},
	{
		suffix: "azure",
		reversed: "eruza"
	},
	{
		suffix: "azure-mobile.net",
		reversed: "ten.elibom-eruza"
	},
	{
		suffix: "azurestaticapps.net",
		reversed: "ten.sppacitatseruza"
	},
	{
		suffix: "azurewebsites.net",
		reversed: "ten.setisbeweruza"
	},
	{
		suffix: "aéroport.ci",
		reversed: "ic.ayb-tropora--nx"
	},
	{
		suffix: "b-data.io",
		reversed: "oi.atad-b"
	},
	{
		suffix: "b.bg",
		reversed: "gb.b"
	},
	{
		suffix: "b.br",
		reversed: "rb.b"
	},
	{
		suffix: "b.se",
		reversed: "es.b"
	},
	{
		suffix: "b.ssl.fastly.net",
		reversed: "ten.yltsaf.lss.b"
	},
	{
		suffix: "ba",
		reversed: "ab"
	},
	{
		suffix: "ba.gov.br",
		reversed: "rb.vog.ab"
	},
	{
		suffix: "ba.it",
		reversed: "ti.ab"
	},
	{
		suffix: "ba.leg.br",
		reversed: "rb.gel.ab"
	},
	{
		suffix: "babia-gora.pl",
		reversed: "lp.arog-aibab"
	},
	{
		suffix: "baby",
		reversed: "ybab"
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
		suffix: "backplaneapp.io",
		reversed: "oi.ppaenalpkcab"
	},
	{
		suffix: "badaddja.no",
		reversed: "on.ajddadab"
	},
	{
		suffix: "badajoz.museum",
		reversed: "muesum.zojadab"
	},
	{
		suffix: "baghdad.museum",
		reversed: "muesum.dadhgab"
	},
	{
		suffix: "bahcavuotna.no",
		reversed: "on.antouvachab"
	},
	{
		suffix: "bahccavuotna.no",
		reversed: "on.antouvacchab"
	},
	{
		suffix: "bahn.museum",
		reversed: "muesum.nhab"
	},
	{
		suffix: "baidar.no",
		reversed: "on.radiab"
	},
	{
		suffix: "baidu",
		reversed: "udiab"
	},
	{
		suffix: "bajddar.no",
		reversed: "on.raddjab"
	},
	{
		suffix: "balashov.su",
		reversed: "us.vohsalab"
	},
	{
		suffix: "balat.no",
		reversed: "on.talab"
	},
	{
		suffix: "bale.museum",
		reversed: "muesum.elab"
	},
	{
		suffix: "balena-devices.com",
		reversed: "moc.secived-anelab"
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
		suffix: "ballooning.aero",
		reversed: "orea.gninoollab"
	},
	{
		suffix: "balsan-sudtirol.it",
		reversed: "ti.loritdus-naslab"
	},
	{
		suffix: "balsan-suedtirol.it",
		reversed: "ti.loritdeus-naslab"
	},
	{
		suffix: "balsan-südtirol.it",
		reversed: "ti.bsn-loritds-naslab--nx"
	},
	{
		suffix: "balsan.it",
		reversed: "ti.naslab"
	},
	{
		suffix: "balsfjord.no",
		reversed: "on.drojfslab"
	},
	{
		suffix: "baltimore.museum",
		reversed: "muesum.eromitlab"
	},
	{
		suffix: "bambina.jp",
		reversed: "pj.anibmab"
	},
	{
		suffix: "bamble.no",
		reversed: "on.elbmab"
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
		suffix: "bandai.fukushima.jp",
		reversed: "pj.amihsukuf.iadnab"
	},
	{
		suffix: "bando.ibaraki.jp",
		reversed: "pj.ikarabi.odnab"
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
		suffix: "bar.pro",
		reversed: "orp.rab"
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
		suffix: "barcelona",
		reversed: "anolecrab"
	},
	{
		suffix: "barcelona.museum",
		reversed: "muesum.anolecrab"
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
		suffix: "bardu.no",
		reversed: "on.udrab"
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
		suffix: "barreau.bj",
		reversed: "jb.uaerrab"
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
		suffix: "barsy.bg",
		reversed: "gb.ysrab"
	},
	{
		suffix: "barsy.ca",
		reversed: "ac.ysrab"
	},
	{
		suffix: "barsy.club",
		reversed: "bulc.ysrab"
	},
	{
		suffix: "barsy.co.uk",
		reversed: "ku.oc.ysrab"
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
		suffix: "barsycenter.com",
		reversed: "moc.retnecysrab"
	},
	{
		suffix: "barsyonline.co.uk",
		reversed: "ku.oc.enilnoysrab"
	},
	{
		suffix: "barsyonline.com",
		reversed: "moc.enilnoysrab"
	},
	{
		suffix: "barueri.br",
		reversed: "rb.ireurab"
	},
	{
		suffix: "barum.no",
		reversed: "on.murab"
	},
	{
		suffix: "bas.it",
		reversed: "ti.sab"
	},
	{
		suffix: "base.ec",
		reversed: "ce.esab"
	},
	{
		suffix: "base.shop",
		reversed: "pohs.esab"
	},
	{
		suffix: "baseball",
		reversed: "llabesab"
	},
	{
		suffix: "baseball.museum",
		reversed: "muesum.llabesab"
	},
	{
		suffix: "basel.museum",
		reversed: "muesum.lesab"
	},
	{
		suffix: "bashkiria.ru",
		reversed: "ur.airikhsab"
	},
	{
		suffix: "bashkiria.su",
		reversed: "us.airikhsab"
	},
	{
		suffix: "basicserver.io",
		reversed: "oi.revrescisab"
	},
	{
		suffix: "basilicata.it",
		reversed: "ti.atacilisab"
	},
	{
		suffix: "basketball",
		reversed: "llabteksab"
	},
	{
		suffix: "baths.museum",
		reversed: "muesum.shtab"
	},
	{
		suffix: "bato.tochigi.jp",
		reversed: "pj.igihcot.otab"
	},
	{
		suffix: "batsfjord.no",
		reversed: "on.drojfstab"
	},
	{
		suffix: "bauern.museum",
		reversed: "muesum.nreuab"
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
		suffix: "bb",
		reversed: "bb"
	},
	{
		suffix: "bbc",
		reversed: "cbb"
	},
	{
		suffix: "bbs.tr",
		reversed: "rt.sbb"
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
		suffix: "bc.ca",
		reversed: "ac.cb"
	},
	{
		suffix: "bc.platform.sh",
		reversed: "hs.mroftalp.cb"
	},
	{
		suffix: "bcg",
		reversed: "gcb"
	},
	{
		suffix: "bci.dnstrace.pro",
		reversed: "orp.ecartsnd.icb"
	},
	{
		suffix: "bcn",
		reversed: "ncb"
	},
	{
		suffix: "bd.se",
		reversed: "es.db"
	},
	{
		suffix: "be",
		reversed: "eb"
	},
	{
		suffix: "be.ax",
		reversed: "xa.eb"
	},
	{
		suffix: "be.eu.org",
		reversed: "gro.ue.eb"
	},
	{
		suffix: "be.gy",
		reversed: "yg.eb"
	},
	{
		suffix: "beagleboard.io",
		reversed: "oi.draobelgaeb"
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
		suffix: "beardu.no",
		reversed: "on.udraeb"
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
		suffix: "beauxarts.museum",
		reversed: "muesum.straxuaeb"
	},
	{
		suffix: "bedzin.pl",
		reversed: "lp.nizdeb"
	},
	{
		suffix: "beeldengeluid.museum",
		reversed: "muesum.diulegnedleeb"
	},
	{
		suffix: "beep.pl",
		reversed: "lp.peeb"
	},
	{
		suffix: "beer",
		reversed: "reeb"
	},
	{
		suffix: "beiarn.no",
		reversed: "on.nraieb"
	},
	{
		suffix: "bel.tr",
		reversed: "rt.leb"
	},
	{
		suffix: "belau.pw",
		reversed: "wp.ualeb"
	},
	{
		suffix: "belem.br",
		reversed: "rb.meleb"
	},
	{
		suffix: "bellevue.museum",
		reversed: "muesum.euvelleb"
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
		suffix: "bentley",
		reversed: "yeltneb"
	},
	{
		suffix: "beppu.oita.jp",
		reversed: "pj.atio.uppeb"
	},
	{
		suffix: "berg.no",
		reversed: "on.greb"
	},
	{
		suffix: "bergamo.it",
		reversed: "ti.omagreb"
	},
	{
		suffix: "bergbau.museum",
		reversed: "muesum.uabgreb"
	},
	{
		suffix: "bergen.no",
		reversed: "on.negreb"
	},
	{
		suffix: "berkeley.museum",
		reversed: "muesum.yelekreb"
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
		suffix: "berlin",
		reversed: "nilreb"
	},
	{
		suffix: "berlin.museum",
		reversed: "muesum.nilreb"
	},
	{
		suffix: "bern.museum",
		reversed: "muesum.nreb"
	},
	{
		suffix: "beskidy.pl",
		reversed: "lp.ydikseb"
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
		suffix: "bet.ar",
		reversed: "ra.teb"
	},
	{
		suffix: "beta.bounty-full.com",
		reversed: "moc.lluf-ytnuob.ateb"
	},
	{
		suffix: "beta.tailscale.net",
		reversed: "ten.elacsliat.ateb"
	},
	{
		suffix: "betainabox.com",
		reversed: "moc.xobaniateb"
	},
	{
		suffix: "better-than.tv",
		reversed: "vt.naht-retteb"
	},
	{
		suffix: "bf",
		reversed: "fb"
	},
	{
		suffix: "bg",
		reversed: "gb"
	},
	{
		suffix: "bg.eu.org",
		reversed: "gro.ue.gb"
	},
	{
		suffix: "bg.it",
		reversed: "ti.gb"
	},
	{
		suffix: "bh",
		reversed: "hb"
	},
	{
		suffix: "bharti",
		reversed: "itrahb"
	},
	{
		suffix: "bhz.br",
		reversed: "rb.zhb"
	},
	{
		suffix: "bi",
		reversed: "ib"
	},
	{
		suffix: "bi.it",
		reversed: "ti.ib"
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
		suffix: "bib.br",
		reversed: "rb.bib"
	},
	{
		suffix: "bib.ve",
		reversed: "ev.bib"
	},
	{
		suffix: "bibai.hokkaido.jp",
		reversed: "pj.odiakkoh.iabib"
	},
	{
		suffix: "bible",
		reversed: "elbib"
	},
	{
		suffix: "bible.museum",
		reversed: "muesum.elbib"
	},
	{
		suffix: "bid",
		reversed: "dib"
	},
	{
		suffix: "biei.hokkaido.jp",
		reversed: "pj.odiakkoh.ieib"
	},
	{
		suffix: "bielawa.pl",
		reversed: "lp.awaleib"
	},
	{
		suffix: "biella.it",
		reversed: "ti.alleib"
	},
	{
		suffix: "bieszczady.pl",
		reversed: "lp.ydazczseib"
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
		suffix: "bifuka.hokkaido.jp",
		reversed: "pj.odiakkoh.akufib"
	},
	{
		suffix: "bihar.in",
		reversed: "ni.rahib"
	},
	{
		suffix: "bihoro.hokkaido.jp",
		reversed: "pj.odiakkoh.orohib"
	},
	{
		suffix: "bike",
		reversed: "ekib"
	},
	{
		suffix: "bilbao.museum",
		reversed: "muesum.oablib"
	},
	{
		suffix: "bill.museum",
		reversed: "muesum.llib"
	},
	{
		suffix: "bindal.no",
		reversed: "on.ladnib"
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
		suffix: "bio.br",
		reversed: "rb.oib"
	},
	{
		suffix: "bip.sh",
		reversed: "hs.pib"
	},
	{
		suffix: "bir.ru",
		reversed: "ur.rib"
	},
	{
		suffix: "biratori.hokkaido.jp",
		reversed: "pj.odiakkoh.irotarib"
	},
	{
		suffix: "birdart.museum",
		reversed: "muesum.tradrib"
	},
	{
		suffix: "birkenes.no",
		reversed: "on.senekrib"
	},
	{
		suffix: "birthplace.museum",
		reversed: "muesum.ecalphtrib"
	},
	{
		suffix: "bitbridge.net",
		reversed: "ten.egdirbtib"
	},
	{
		suffix: "bitbucket.io",
		reversed: "oi.tekcubtib"
	},
	{
		suffix: "bitter.jp",
		reversed: "pj.rettib"
	},
	{
		suffix: "biz",
		reversed: "zib"
	},
	{
		suffix: "biz.at",
		reversed: "ta.zib"
	},
	{
		suffix: "biz.az",
		reversed: "za.zib"
	},
	{
		suffix: "biz.bb",
		reversed: "bb.zib"
	},
	{
		suffix: "biz.cy",
		reversed: "yc.zib"
	},
	{
		suffix: "biz.dk",
		reversed: "kd.zib"
	},
	{
		suffix: "biz.et",
		reversed: "te.zib"
	},
	{
		suffix: "biz.fj",
		reversed: "jf.zib"
	},
	{
		suffix: "biz.gl",
		reversed: "lg.zib"
	},
	{
		suffix: "biz.id",
		reversed: "di.zib"
	},
	{
		suffix: "biz.in",
		reversed: "ni.zib"
	},
	{
		suffix: "biz.ki",
		reversed: "ik.zib"
	},
	{
		suffix: "biz.ls",
		reversed: "sl.zib"
	},
	{
		suffix: "biz.mv",
		reversed: "vm.zib"
	},
	{
		suffix: "biz.mw",
		reversed: "wm.zib"
	},
	{
		suffix: "biz.my",
		reversed: "ym.zib"
	},
	{
		suffix: "biz.ni",
		reversed: "in.zib"
	},
	{
		suffix: "biz.nr",
		reversed: "rn.zib"
	},
	{
		suffix: "biz.pk",
		reversed: "kp.zib"
	},
	{
		suffix: "biz.pl",
		reversed: "lp.zib"
	},
	{
		suffix: "biz.pr",
		reversed: "rp.zib"
	},
	{
		suffix: "biz.ss",
		reversed: "ss.zib"
	},
	{
		suffix: "biz.tj",
		reversed: "jt.zib"
	},
	{
		suffix: "biz.tr",
		reversed: "rt.zib"
	},
	{
		suffix: "biz.tt",
		reversed: "tt.zib"
	},
	{
		suffix: "biz.ua",
		reversed: "au.zib"
	},
	{
		suffix: "biz.vn",
		reversed: "nv.zib"
	},
	{
		suffix: "biz.wf",
		reversed: "fw.zib"
	},
	{
		suffix: "biz.zm",
		reversed: "mz.zib"
	},
	{
		suffix: "bizen.okayama.jp",
		reversed: "pj.amayako.nezib"
	},
	{
		suffix: "bj",
		reversed: "jb"
	},
	{
		suffix: "bj.cn",
		reversed: "nc.jb"
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
		suffix: "bl.it",
		reversed: "ti.lb"
	},
	{
		suffix: "black",
		reversed: "kcalb"
	},
	{
		suffix: "blackbaudcdn.net",
		reversed: "ten.ndcduabkcalb"
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
		suffix: "blog.bo",
		reversed: "ob.golb"
	},
	{
		suffix: "blog.br",
		reversed: "rb.golb"
	},
	{
		suffix: "blog.gt",
		reversed: "tg.golb"
	},
	{
		suffix: "blog.kg",
		reversed: "gk.golb"
	},
	{
		suffix: "blog.vu",
		reversed: "uv.golb"
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
		suffix: "blogsite.xyz",
		reversed: "zyx.etisgolb"
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
		suffix: "blogsyte.com",
		reversed: "moc.etysgolb"
	},
	{
		suffix: "bloomberg",
		reversed: "grebmoolb"
	},
	{
		suffix: "bloxcms.com",
		reversed: "moc.smcxolb"
	},
	{
		suffix: "blue",
		reversed: "eulb"
	},
	{
		suffix: "bluebite.io",
		reversed: "oi.etibeulb"
	},
	{
		suffix: "blush.jp",
		reversed: "pj.hsulb"
	},
	{
		suffix: "bm",
		reversed: "mb"
	},
	{
		suffix: "bmd.br",
		reversed: "rb.dmb"
	},
	{
		suffix: "bmoattachments.org",
		reversed: "gro.stnemhcattaomb"
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
		suffix: "bn",
		reversed: "nb"
	},
	{
		suffix: "bn.it",
		reversed: "ti.nb"
	},
	{
		suffix: "bnpparibas",
		reversed: "sabirappnb"
	},
	{
		suffix: "bnr.la",
		reversed: "al.rnb"
	},
	{
		suffix: "bo",
		reversed: "ob"
	},
	{
		suffix: "bo.it",
		reversed: "ti.ob"
	},
	{
		suffix: "bo.nordland.no",
		reversed: "on.dnaldron.ob"
	},
	{
		suffix: "bo.telemark.no",
		reversed: "on.kramelet.ob"
	},
	{
		suffix: "boats",
		reversed: "staob"
	},
	{
		suffix: "boavista.br",
		reversed: "rb.atsivaob"
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
		suffix: "boehringer",
		reversed: "regnirheob"
	},
	{
		suffix: "bofa",
		reversed: "afob"
	},
	{
		suffix: "bokn.no",
		reversed: "on.nkob"
	},
	{
		suffix: "boldlygoingnowhere.org",
		reversed: "gro.erehwongniogyldlob"
	},
	{
		suffix: "boleslawiec.pl",
		reversed: "lp.ceiwalselob"
	},
	{
		suffix: "bolivia.bo",
		reversed: "ob.aivilob"
	},
	{
		suffix: "bologna.it",
		reversed: "ti.angolob"
	},
	{
		suffix: "bolt.hu",
		reversed: "uh.tlob"
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
		suffix: "bom",
		reversed: "mob"
	},
	{
		suffix: "bomlo.no",
		reversed: "on.olmob"
	},
	{
		suffix: "bond",
		reversed: "dnob"
	},
	{
		suffix: "bonn.museum",
		reversed: "muesum.nnob"
	},
	{
		suffix: "boo",
		reversed: "oob"
	},
	{
		suffix: "boo.jp",
		reversed: "pj.oob"
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
		suffix: "bookonline.app",
		reversed: "ppa.enilnokoob"
	},
	{
		suffix: "boomla.net",
		reversed: "ten.almoob"
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
		suffix: "boston.museum",
		reversed: "muesum.notsob"
	},
	{
		suffix: "bot",
		reversed: "tob"
	},
	{
		suffix: "botanical.museum",
		reversed: "muesum.lacinatob"
	},
	{
		suffix: "botanicalgarden.museum",
		reversed: "muesum.nedraglacinatob"
	},
	{
		suffix: "botanicgarden.museum",
		reversed: "muesum.nedragcinatob"
	},
	{
		suffix: "botany.museum",
		reversed: "muesum.ynatob"
	},
	{
		suffix: "bounceme.net",
		reversed: "ten.emecnuob"
	},
	{
		suffix: "bounty-full.com",
		reversed: "moc.lluf-ytnuob"
	},
	{
		suffix: "boutique",
		reversed: "euqituob"
	},
	{
		suffix: "boutir.com",
		reversed: "moc.rituob"
	},
	{
		suffix: "box",
		reversed: "xob"
	},
	{
		suffix: "boxfuse.io",
		reversed: "oi.esufxob"
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
		suffix: "bozen-sudtirol.it",
		reversed: "ti.loritdus-nezob"
	},
	{
		suffix: "bozen-suedtirol.it",
		reversed: "ti.loritdeus-nezob"
	},
	{
		suffix: "bozen-südtirol.it",
		reversed: "ti.bo2-loritds-nezob--nx"
	},
	{
		suffix: "bozen.it",
		reversed: "ti.nezob"
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
		suffix: "bplaced.net",
		reversed: "ten.decalpb"
	},
	{
		suffix: "br",
		reversed: "rb"
	},
	{
		suffix: "br.com",
		reversed: "moc.rb"
	},
	{
		suffix: "br.it",
		reversed: "ti.rb"
	},
	{
		suffix: "bradesco",
		reversed: "ocsedarb"
	},
	{
		suffix: "brand.se",
		reversed: "es.dnarb"
	},
	{
		suffix: "brandywinevalley.museum",
		reversed: "muesum.yellaveniwydnarb"
	},
	{
		suffix: "brasil.museum",
		reversed: "muesum.lisarb"
	},
	{
		suffix: "brasilia.me",
		reversed: "em.ailisarb"
	},
	{
		suffix: "bremanger.no",
		reversed: "on.regnamerb"
	},
	{
		suffix: "brescia.it",
		reversed: "ti.aicserb"
	},
	{
		suffix: "bridgestone",
		reversed: "enotsegdirb"
	},
	{
		suffix: "brindisi.it",
		reversed: "ti.isidnirb"
	},
	{
		suffix: "bristol.museum",
		reversed: "muesum.lotsirb"
	},
	{
		suffix: "british.museum",
		reversed: "muesum.hsitirb"
	},
	{
		suffix: "britishcolumbia.museum",
		reversed: "muesum.aibmulochsitirb"
	},
	{
		suffix: "broadcast.museum",
		reversed: "muesum.tsacdaorb"
	},
	{
		suffix: "broadway",
		reversed: "yawdaorb"
	},
	{
		suffix: "broke-it.net",
		reversed: "ten.ti-ekorb"
	},
	{
		suffix: "broker",
		reversed: "rekorb"
	},
	{
		suffix: "broker.aero",
		reversed: "orea.rekorb"
	},
	{
		suffix: "bronnoy.no",
		reversed: "on.yonnorb"
	},
	{
		suffix: "bronnoysund.no",
		reversed: "on.dnusyonnorb"
	},
	{
		suffix: "brother",
		reversed: "rehtorb"
	},
	{
		suffix: "browsersafetymark.io",
		reversed: "oi.kramytefasresworb"
	},
	{
		suffix: "brumunddal.no",
		reversed: "on.laddnumurb"
	},
	{
		suffix: "brunel.museum",
		reversed: "muesum.lenurb"
	},
	{
		suffix: "brussel.museum",
		reversed: "muesum.lessurb"
	},
	{
		suffix: "brussels",
		reversed: "slessurb"
	},
	{
		suffix: "brussels.museum",
		reversed: "muesum.slessurb"
	},
	{
		suffix: "bruxelles.museum",
		reversed: "muesum.sellexurb"
	},
	{
		suffix: "bryansk.su",
		reversed: "us.ksnayrb"
	},
	{
		suffix: "bryne.no",
		reversed: "on.enyrb"
	},
	{
		suffix: "brønnøy.no",
		reversed: "on.cauw-ynnrb--nx"
	},
	{
		suffix: "brønnøysund.no",
		reversed: "on.ca8m-dnusynnrb--nx"
	},
	{
		suffix: "bs",
		reversed: "sb"
	},
	{
		suffix: "bs.it",
		reversed: "ti.sb"
	},
	{
		suffix: "bsb.br",
		reversed: "rb.bsb"
	},
	{
		suffix: "bss.design",
		reversed: "ngised.ssb"
	},
	{
		suffix: "bt",
		reversed: "tb"
	},
	{
		suffix: "bt.it",
		reversed: "ti.tb"
	},
	{
		suffix: "bu.no",
		reversed: "on.ub"
	},
	{
		suffix: "budejju.no",
		reversed: "on.ujjedub"
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
		suffix: "building.museum",
		reversed: "muesum.gnidliub"
	},
	{
		suffix: "builtwithdark.com",
		reversed: "moc.kradhtiwtliub"
	},
	{
		suffix: "bukhara.su",
		reversed: "us.arahkub"
	},
	{
		suffix: "bulsan-sudtirol.it",
		reversed: "ti.loritdus-naslub"
	},
	{
		suffix: "bulsan-suedtirol.it",
		reversed: "ti.loritdeus-naslub"
	},
	{
		suffix: "bulsan-südtirol.it",
		reversed: "ti.bsn-loritds-naslub--nx"
	},
	{
		suffix: "bulsan.it",
		reversed: "ti.naslub"
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
		suffix: "bunkyo.tokyo.jp",
		reversed: "pj.oykot.oyknub"
	},
	{
		suffix: "burghof.museum",
		reversed: "muesum.fohgrub"
	},
	{
		suffix: "bus.museum",
		reversed: "muesum.sub"
	},
	{
		suffix: "busan.kr",
		reversed: "rk.nasub"
	},
	{
		suffix: "bushey.museum",
		reversed: "muesum.yehsub"
	},
	{
		suffix: "business",
		reversed: "ssenisub"
	},
	{
		suffix: "business.in",
		reversed: "ni.ssenisub"
	},
	{
		suffix: "but.jp",
		reversed: "pj.tub"
	},
	{
		suffix: "buy",
		reversed: "yub"
	},
	{
		suffix: "buyshop.jp",
		reversed: "pj.pohsyub"
	},
	{
		suffix: "buyshouses.net",
		reversed: "ten.sesuohsyub"
	},
	{
		suffix: "buzen.fukuoka.jp",
		reversed: "pj.akoukuf.nezub"
	},
	{
		suffix: "buzz",
		reversed: "zzub"
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
		suffix: "by",
		reversed: "yb"
	},
	{
		suffix: "bydgoszcz.pl",
		reversed: "lp.zczsogdyb"
	},
	{
		suffix: "byen.site",
		reversed: "etis.neyb"
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
		suffix: "bytom.pl",
		reversed: "lp.motyb"
	},
	{
		suffix: "bz",
		reversed: "zb"
	},
	{
		suffix: "bz.it",
		reversed: "ti.zb"
	},
	{
		suffix: "bzh",
		reversed: "hzb"
	},
	{
		suffix: "báhcavuotna.no",
		reversed: "on.a4s-antouvachb--nx"
	},
	{
		suffix: "báhccavuotna.no",
		reversed: "on.a7k-antouvacchb--nx"
	},
	{
		suffix: "báidár.no",
		reversed: "on.can5-rdib--nx"
	},
	{
		suffix: "bájddar.no",
		reversed: "on.atp-raddjb--nx"
	},
	{
		suffix: "bálát.no",
		reversed: "on.bale-tlb--nx"
	},
	{
		suffix: "bådåddjå.no",
		reversed: "on.dbarm-jdddb--nx"
	},
	{
		suffix: "båtsfjord.no",
		reversed: "on.az9-drojfstb--nx"
	},
	{
		suffix: "bærum.no",
		reversed: "on.aov-murb--nx"
	},
	{
		suffix: "bø.nordland.no",
		reversed: "on.dnaldron.ag5-b--nx"
	},
	{
		suffix: "bø.telemark.no",
		reversed: "on.kramelet.ag5-b--nx"
	},
	{
		suffix: "bømlo.no",
		reversed: "on.arg-olmb--nx"
	},
	{
		suffix: "c.bg",
		reversed: "gb.c"
	},
	{
		suffix: "c.cdn77.org",
		reversed: "gro.77ndc.c"
	},
	{
		suffix: "c.la",
		reversed: "al.c"
	},
	{
		suffix: "c.se",
		reversed: "es.c"
	},
	{
		suffix: "c66.me",
		reversed: "em.66c"
	},
	{
		suffix: "ca",
		reversed: "ac"
	},
	{
		suffix: "ca-central-1.elasticbeanstalk.com",
		reversed: "moc.klatsnaebcitsale.1-lartnec-ac"
	},
	{
		suffix: "ca.eu.org",
		reversed: "gro.ue.ac"
	},
	{
		suffix: "ca.in",
		reversed: "ni.ac"
	},
	{
		suffix: "ca.it",
		reversed: "ti.ac"
	},
	{
		suffix: "ca.na",
		reversed: "an.ac"
	},
	{
		suffix: "ca.reclaim.cloud",
		reversed: "duolc.mialcer.ac"
	},
	{
		suffix: "ca.us",
		reversed: "su.ac"
	},
	{
		suffix: "caa.aero",
		reversed: "orea.aac"
	},
	{
		suffix: "caa.li",
		reversed: "il.aac"
	},
	{
		suffix: "cab",
		reversed: "bac"
	},
	{
		suffix: "cable-modem.org",
		reversed: "gro.medom-elbac"
	},
	{
		suffix: "cadaques.museum",
		reversed: "muesum.seuqadac"
	},
	{
		suffix: "cafe",
		reversed: "efac"
	},
	{
		suffix: "cafjs.com",
		reversed: "moc.sjfac"
	},
	{
		suffix: "cagliari.it",
		reversed: "ti.irailgac"
	},
	{
		suffix: "cahcesuolo.no",
		reversed: "on.olousechac"
	},
	{
		suffix: "cal",
		reversed: "lac"
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
		suffix: "california.museum",
		reversed: "muesum.ainrofilac"
	},
	{
		suffix: "call",
		reversed: "llac"
	},
	{
		suffix: "caltanissetta.it",
		reversed: "ti.attessinatlac"
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
		suffix: "cam.it",
		reversed: "ti.mac"
	},
	{
		suffix: "cambridge.museum",
		reversed: "muesum.egdirbmac"
	},
	{
		suffix: "camdvr.org",
		reversed: "gro.rvdmac"
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
		suffix: "campaign.gov.uk",
		reversed: "ku.vog.ngiapmac"
	},
	{
		suffix: "campania.it",
		reversed: "ti.ainapmac"
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
		suffix: "campinagrande.br",
		reversed: "rb.ednarganipmac"
	},
	{
		suffix: "campinas.br",
		reversed: "rb.sanipmac"
	},
	{
		suffix: "campobasso.it",
		reversed: "ti.ossabopmac"
	},
	{
		suffix: "can.museum",
		reversed: "muesum.nac"
	},
	{
		suffix: "canada.museum",
		reversed: "muesum.adanac"
	},
	{
		suffix: "candypop.jp",
		reversed: "pj.popydnac"
	},
	{
		suffix: "canon",
		reversed: "nonac"
	},
	{
		suffix: "capebreton.museum",
		reversed: "muesum.noterbepac"
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
		suffix: "capoo.jp",
		reversed: "pj.oopac"
	},
	{
		suffix: "car",
		reversed: "rac"
	},
	{
		suffix: "caracal.mythic-beasts.com",
		reversed: "moc.stsaeb-cihtym.lacarac"
	},
	{
		suffix: "caravan",
		reversed: "navarac"
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
		suffix: "cargo.aero",
		reversed: "orea.ograc"
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
		suffix: "carrd.co",
		reversed: "oc.drrac"
	},
	{
		suffix: "carrier.museum",
		reversed: "muesum.reirrac"
	},
	{
		suffix: "cars",
		reversed: "srac"
	},
	{
		suffix: "cartoonart.museum",
		reversed: "muesum.tranootrac"
	},
	{
		suffix: "casa",
		reversed: "asac"
	},
	{
		suffix: "casacam.net",
		reversed: "ten.macasac"
	},
	{
		suffix: "casadelamoneda.museum",
		reversed: "muesum.adenomaledasac"
	},
	{
		suffix: "case",
		reversed: "esac"
	},
	{
		suffix: "caserta.it",
		reversed: "ti.atresac"
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
		suffix: "casino.hu",
		reversed: "uh.onisac"
	},
	{
		suffix: "castle.museum",
		reversed: "muesum.eltsac"
	},
	{
		suffix: "castres.museum",
		reversed: "muesum.sertsac"
	},
	{
		suffix: "cat",
		reversed: "tac"
	},
	{
		suffix: "cat.ax",
		reversed: "xa.tac"
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
		suffix: "catering",
		reversed: "gniretac"
	},
	{
		suffix: "catering.aero",
		reversed: "orea.gniretac"
	},
	{
		suffix: "catfood.jp",
		reversed: "pj.dooftac"
	},
	{
		suffix: "catholic",
		reversed: "cilohtac"
	},
	{
		suffix: "catholic.edu.au",
		reversed: "ua.ude.cilohtac"
	},
	{
		suffix: "caxias.br",
		reversed: "rb.saixac"
	},
	{
		suffix: "cb.it",
		reversed: "ti.bc"
	},
	{
		suffix: "cba",
		reversed: "abc"
	},
	{
		suffix: "cbg.ru",
		reversed: "ur.gbc"
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
		suffix: "cc",
		reversed: "cc"
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
		suffix: "cc.hn",
		reversed: "nh.cc"
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
		suffix: "cc.na",
		reversed: "an.cc"
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
		suffix: "cc.ua",
		reversed: "au.cc"
	},
	{
		suffix: "cc.ut.us",
		reversed: "su.tu.cc"
	},
	{
		suffix: "cc.va.us",
		reversed: "su.av.cc"
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
		suffix: "cci.fr",
		reversed: "rf.icc"
	},
	{
		suffix: "cd",
		reversed: "dc"
	},
	{
		suffix: "cd.eu.org",
		reversed: "gro.ue.dc"
	},
	{
		suffix: "cdn-edges.net",
		reversed: "ten.segde-ndc"
	},
	{
		suffix: "cdn.prod.atlassian-dev.net",
		reversed: "ten.ved-naissalta.dorp.ndc"
	},
	{
		suffix: "cdn77-ssl.net",
		reversed: "ten.lss-77ndc"
	},
	{
		suffix: "ce.gov.br",
		reversed: "rb.vog.ec"
	},
	{
		suffix: "ce.it",
		reversed: "ti.ec"
	},
	{
		suffix: "ce.leg.br",
		reversed: "rb.gel.ec"
	},
	{
		suffix: "cechire.com",
		reversed: "moc.erihcec"
	},
	{
		suffix: "celtic.museum",
		reversed: "muesum.citlec"
	},
	{
		suffix: "center",
		reversed: "retnec"
	},
	{
		suffix: "center.museum",
		reversed: "muesum.retnec"
	},
	{
		suffix: "centralus.azurestaticapps.net",
		reversed: "ten.sppacitatseruza.sulartnec"
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
		suffix: "certification.aero",
		reversed: "orea.noitacifitrec"
	},
	{
		suffix: "certmgr.org",
		reversed: "gro.rgmtrec"
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
		suffix: "cf",
		reversed: "fc"
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
		suffix: "cg",
		reversed: "gc"
	},
	{
		suffix: "ch",
		reversed: "hc"
	},
	{
		suffix: "ch.eu.org",
		reversed: "gro.ue.hc"
	},
	{
		suffix: "ch.it",
		reversed: "ti.hc"
	},
	{
		suffix: "ch.tc",
		reversed: "ct.hc"
	},
	{
		suffix: "ch.trendhosting.cloud",
		reversed: "duolc.gnitsohdnert.hc"
	},
	{
		suffix: "chambagri.fr",
		reversed: "rf.irgabmahc"
	},
	{
		suffix: "championship.aero",
		reversed: "orea.pihsnoipmahc"
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
		suffix: "channelsdvr.net",
		reversed: "ten.rvdslennahc"
	},
	{
		suffix: "charity",
		reversed: "ytirahc"
	},
	{
		suffix: "charter.aero",
		reversed: "orea.retrahc"
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
		suffix: "chattanooga.museum",
		reversed: "muesum.agoonattahc"
	},
	{
		suffix: "cheap",
		reversed: "paehc"
	},
	{
		suffix: "cheap.jp",
		reversed: "pj.paehc"
	},
	{
		suffix: "cheltenham.museum",
		reversed: "muesum.mahnetlehc"
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
		suffix: "chesapeakebay.museum",
		reversed: "muesum.yabekaepasehc"
	},
	{
		suffix: "chiba.jp",
		reversed: "pj.abihc"
	},
	{
		suffix: "chicago.museum",
		reversed: "muesum.ogacihc"
	},
	{
		suffix: "chicappa.jp",
		reversed: "pj.appacihc"
	},
	{
		suffix: "chichibu.saitama.jp",
		reversed: "pj.amatias.ubihcihc"
	},
	{
		suffix: "chieti.it",
		reversed: "ti.iteihc"
	},
	{
		suffix: "chigasaki.kanagawa.jp",
		reversed: "pj.awaganak.ikasagihc"
	},
	{
		suffix: "chihayaakasaka.osaka.jp",
		reversed: "pj.akaso.akasakaayahihc"
	},
	{
		suffix: "chijiwa.nagasaki.jp",
		reversed: "pj.ikasagan.awijihc"
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
		suffix: "chikuhoku.nagano.jp",
		reversed: "pj.onagan.ukohukihc"
	},
	{
		suffix: "chikujo.fukuoka.jp",
		reversed: "pj.akoukuf.ojukihc"
	},
	{
		suffix: "chikuma.nagano.jp",
		reversed: "pj.onagan.amukihc"
	},
	{
		suffix: "chikusei.ibaraki.jp",
		reversed: "pj.ikarabi.iesukihc"
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
		suffix: "children.museum",
		reversed: "muesum.nerdlihc"
	},
	{
		suffix: "childrens.museum",
		reversed: "muesum.snerdlihc"
	},
	{
		suffix: "childrensgarden.museum",
		reversed: "muesum.nedragsnerdlihc"
	},
	{
		suffix: "chillout.jp",
		reversed: "pj.tuollihc"
	},
	{
		suffix: "chimkent.su",
		reversed: "us.tnekmihc"
	},
	{
		suffix: "chino.nagano.jp",
		reversed: "pj.onagan.onihc"
	},
	{
		suffix: "chintai",
		reversed: "iatnihc"
	},
	{
		suffix: "chippubetsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustebuppihc"
	},
	{
		suffix: "chips.jp",
		reversed: "pj.spihc"
	},
	{
		suffix: "chiropractic.museum",
		reversed: "muesum.citcarporihc"
	},
	{
		suffix: "chirurgiens-dentistes-en-france.fr",
		reversed: "rf.ecnarf-ne-setsitned-sneigrurihc"
	},
	{
		suffix: "chirurgiens-dentistes.fr",
		reversed: "rf.setsitned-sneigrurihc"
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
		suffix: "chitose.hokkaido.jp",
		reversed: "pj.odiakkoh.esotihc"
	},
	{
		suffix: "chiyoda.gunma.jp",
		reversed: "pj.amnug.adoyihc"
	},
	{
		suffix: "chiyoda.tokyo.jp",
		reversed: "pj.oykot.adoyihc"
	},
	{
		suffix: "chizu.tottori.jp",
		reversed: "pj.irottot.uzihc"
	},
	{
		suffix: "chocolate.museum",
		reversed: "muesum.etalocohc"
	},
	{
		suffix: "chofu.tokyo.jp",
		reversed: "pj.oykot.ufohc"
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
		suffix: "chowder.jp",
		reversed: "pj.redwohc"
	},
	{
		suffix: "choyo.kumamoto.jp",
		reversed: "pj.otomamuk.oyohc"
	},
	{
		suffix: "christiansburg.museum",
		reversed: "muesum.grubsnaitsirhc"
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
		suffix: "chtr.k12.ma.us",
		reversed: "su.am.21k.rthc"
	},
	{
		suffix: "chu.jp",
		reversed: "pj.uhc"
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
		suffix: "chuo.chiba.jp",
		reversed: "pj.abihc.ouhc"
	},
	{
		suffix: "chuo.fukuoka.jp",
		reversed: "pj.akoukuf.ouhc"
	},
	{
		suffix: "chuo.osaka.jp",
		reversed: "pj.akaso.ouhc"
	},
	{
		suffix: "chuo.tokyo.jp",
		reversed: "pj.oykot.ouhc"
	},
	{
		suffix: "chuo.yamanashi.jp",
		reversed: "pj.ihsanamay.ouhc"
	},
	{
		suffix: "church",
		reversed: "hcruhc"
	},
	{
		suffix: "ci",
		reversed: "ic"
	},
	{
		suffix: "ci.it",
		reversed: "ti.ic"
	},
	{
		suffix: "ciao.jp",
		reversed: "pj.oaic"
	},
	{
		suffix: "ciencia.bo",
		reversed: "ob.aicneic"
	},
	{
		suffix: "cieszyn.pl",
		reversed: "lp.nyzseic"
	},
	{
		suffix: "cim.br",
		reversed: "rb.mic"
	},
	{
		suffix: "cincinnati.museum",
		reversed: "muesum.itannicnic"
	},
	{
		suffix: "cinema.museum",
		reversed: "muesum.amenic"
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
		suffix: "circus.museum",
		reversed: "muesum.sucric"
	},
	{
		suffix: "cisco",
		reversed: "ocsic"
	},
	{
		suffix: "ciscofreak.com",
		reversed: "moc.kaerfocsic"
	},
	{
		suffix: "cistron.nl",
		reversed: "ln.nortsic"
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
		suffix: "city.hu",
		reversed: "uh.ytic"
	},
	{
		suffix: "cityeats",
		reversed: "staeytic"
	},
	{
		suffix: "civilaviation.aero",
		reversed: "orea.noitaivalivic"
	},
	{
		suffix: "civilisation.museum",
		reversed: "muesum.noitasilivic"
	},
	{
		suffix: "civilization.museum",
		reversed: "muesum.noitazilivic"
	},
	{
		suffix: "civilwar.museum",
		reversed: "muesum.rawlivic"
	},
	{
		suffix: "ck.ua",
		reversed: "au.kc"
	},
	{
		suffix: "cl",
		reversed: "lc"
	},
	{
		suffix: "cl.it",
		reversed: "ti.lc"
	},
	{
		suffix: "claims",
		reversed: "smialc"
	},
	{
		suffix: "clan.rip",
		reversed: "pir.nalc"
	},
	{
		suffix: "cleaning",
		reversed: "gninaelc"
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
		suffix: "cleverapps.io",
		reversed: "oi.spparevelc"
	},
	{
		suffix: "click",
		reversed: "kcilc"
	},
	{
		suffix: "clicketcloud.com",
		reversed: "moc.duolctekcilc"
	},
	{
		suffix: "clickrising.net",
		reversed: "ten.gnisirkcilc"
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
		suffix: "clinton.museum",
		reversed: "muesum.notnilc"
	},
	{
		suffix: "clock.museum",
		reversed: "muesum.kcolc"
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
		suffix: "cloud-fr1.unispace.io",
		reversed: "oi.ecapsinu.1rf-duolc"
	},
	{
		suffix: "cloud.fedoraproject.org",
		reversed: "gro.tcejorparodef.duolc"
	},
	{
		suffix: "cloud.goog",
		reversed: "goog.duolc"
	},
	{
		suffix: "cloud.interhostsolutions.be",
		reversed: "eb.snoitulostsohretni.duolc"
	},
	{
		suffix: "cloud.jelastic.open.tim.it",
		reversed: "ti.mit.nepo.citsalej.duolc"
	},
	{
		suffix: "cloud.nospamproxy.com",
		reversed: "moc.yxorpmapson.duolc"
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
		suffix: "cloudaccess.host",
		reversed: "tsoh.sseccaduolc"
	},
	{
		suffix: "cloudaccess.net",
		reversed: "ten.sseccaduolc"
	},
	{
		suffix: "cloudapp.net",
		reversed: "ten.ppaduolc"
	},
	{
		suffix: "cloudapps.digital",
		reversed: "latigid.sppaduolc"
	},
	{
		suffix: "cloudcontrolapp.com",
		reversed: "moc.ppalortnocduolc"
	},
	{
		suffix: "cloudcontrolled.com",
		reversed: "moc.dellortnocduolc"
	},
	{
		suffix: "cloudfront.net",
		reversed: "ten.tnorfduolc"
	},
	{
		suffix: "cloudfunctions.net",
		reversed: "ten.snoitcnufduolc"
	},
	{
		suffix: "cloudjiffy.net",
		reversed: "ten.yffijduolc"
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
		suffix: "cloudns.cc",
		reversed: "cc.snduolc"
	},
	{
		suffix: "cloudns.club",
		reversed: "bulc.snduolc"
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
		suffix: "cloudsite.builders",
		reversed: "sredliub.etisduolc"
	},
	{
		suffix: "cloudycluster.net",
		reversed: "ten.retsulcyduolc"
	},
	{
		suffix: "club",
		reversed: "bulc"
	},
	{
		suffix: "club.aero",
		reversed: "orea.bulc"
	},
	{
		suffix: "club.tw",
		reversed: "wt.bulc"
	},
	{
		suffix: "clubmed",
		reversed: "dembulc"
	},
	{
		suffix: "cm",
		reversed: "mc"
	},
	{
		suffix: "cn",
		reversed: "nc"
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
		suffix: "cn.com",
		reversed: "moc.nc"
	},
	{
		suffix: "cn.eu.org",
		reversed: "gro.ue.nc"
	},
	{
		suffix: "cn.in",
		reversed: "ni.nc"
	},
	{
		suffix: "cn.it",
		reversed: "ti.nc"
	},
	{
		suffix: "cn.ua",
		reversed: "au.nc"
	},
	{
		suffix: "cn.vu",
		reversed: "uv.nc"
	},
	{
		suffix: "cng.br",
		reversed: "rb.gnc"
	},
	{
		suffix: "cnpy.gdn",
		reversed: "ndg.ypnc"
	},
	{
		suffix: "cnt.br",
		reversed: "rb.tnc"
	},
	{
		suffix: "co",
		reversed: "oc"
	},
	{
		suffix: "co.ae",
		reversed: "ea.oc"
	},
	{
		suffix: "co.ag",
		reversed: "ga.oc"
	},
	{
		suffix: "co.am",
		reversed: "ma.oc"
	},
	{
		suffix: "co.ao",
		reversed: "oa.oc"
	},
	{
		suffix: "co.at",
		reversed: "ta.oc"
	},
	{
		suffix: "co.bb",
		reversed: "bb.oc"
	},
	{
		suffix: "co.bi",
		reversed: "ib.oc"
	},
	{
		suffix: "co.bn",
		reversed: "nb.oc"
	},
	{
		suffix: "co.business",
		reversed: "ssenisub.oc"
	},
	{
		suffix: "co.bw",
		reversed: "wb.oc"
	},
	{
		suffix: "co.ca",
		reversed: "ac.oc"
	},
	{
		suffix: "co.ci",
		reversed: "ic.oc"
	},
	{
		suffix: "co.cl",
		reversed: "lc.oc"
	},
	{
		suffix: "co.cm",
		reversed: "mc.oc"
	},
	{
		suffix: "co.com",
		reversed: "moc.oc"
	},
	{
		suffix: "co.cr",
		reversed: "rc.oc"
	},
	{
		suffix: "co.cz",
		reversed: "zc.oc"
	},
	{
		suffix: "co.dk",
		reversed: "kd.oc"
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
		suffix: "co.gg",
		reversed: "gg.oc"
	},
	{
		suffix: "co.gl",
		reversed: "lg.oc"
	},
	{
		suffix: "co.gy",
		reversed: "yg.oc"
	},
	{
		suffix: "co.hu",
		reversed: "uh.oc"
	},
	{
		suffix: "co.id",
		reversed: "di.oc"
	},
	{
		suffix: "co.il",
		reversed: "li.oc"
	},
	{
		suffix: "co.im",
		reversed: "mi.oc"
	},
	{
		suffix: "co.in",
		reversed: "ni.oc"
	},
	{
		suffix: "co.ir",
		reversed: "ri.oc"
	},
	{
		suffix: "co.it",
		reversed: "ti.oc"
	},
	{
		suffix: "co.je",
		reversed: "ej.oc"
	},
	{
		suffix: "co.jp",
		reversed: "pj.oc"
	},
	{
		suffix: "co.ke",
		reversed: "ek.oc"
	},
	{
		suffix: "co.kr",
		reversed: "rk.oc"
	},
	{
		suffix: "co.krd",
		reversed: "drk.oc"
	},
	{
		suffix: "co.lc",
		reversed: "cl.oc"
	},
	{
		suffix: "co.ls",
		reversed: "sl.oc"
	},
	{
		suffix: "co.ma",
		reversed: "am.oc"
	},
	{
		suffix: "co.me",
		reversed: "em.oc"
	},
	{
		suffix: "co.mg",
		reversed: "gm.oc"
	},
	{
		suffix: "co.mu",
		reversed: "um.oc"
	},
	{
		suffix: "co.mw",
		reversed: "wm.oc"
	},
	{
		suffix: "co.mz",
		reversed: "zm.oc"
	},
	{
		suffix: "co.na",
		reversed: "an.oc"
	},
	{
		suffix: "co.network",
		reversed: "krowten.oc"
	},
	{
		suffix: "co.ni",
		reversed: "in.oc"
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
		suffix: "co.nz",
		reversed: "zn.oc"
	},
	{
		suffix: "co.om",
		reversed: "mo.oc"
	},
	{
		suffix: "co.pl",
		reversed: "lp.oc"
	},
	{
		suffix: "co.place",
		reversed: "ecalp.oc"
	},
	{
		suffix: "co.pn",
		reversed: "np.oc"
	},
	{
		suffix: "co.pw",
		reversed: "wp.oc"
	},
	{
		suffix: "co.ro",
		reversed: "or.oc"
	},
	{
		suffix: "co.rs",
		reversed: "sr.oc"
	},
	{
		suffix: "co.rw",
		reversed: "wr.oc"
	},
	{
		suffix: "co.st",
		reversed: "ts.oc"
	},
	{
		suffix: "co.sz",
		reversed: "zs.oc"
	},
	{
		suffix: "co.technology",
		reversed: "ygolonhcet.oc"
	},
	{
		suffix: "co.th",
		reversed: "ht.oc"
	},
	{
		suffix: "co.tj",
		reversed: "jt.oc"
	},
	{
		suffix: "co.tm",
		reversed: "mt.oc"
	},
	{
		suffix: "co.tt",
		reversed: "tt.oc"
	},
	{
		suffix: "co.tz",
		reversed: "zt.oc"
	},
	{
		suffix: "co.ua",
		reversed: "au.oc"
	},
	{
		suffix: "co.ug",
		reversed: "gu.oc"
	},
	{
		suffix: "co.uk",
		reversed: "ku.oc"
	},
	{
		suffix: "co.us",
		reversed: "su.oc"
	},
	{
		suffix: "co.uz",
		reversed: "zu.oc"
	},
	{
		suffix: "co.ve",
		reversed: "ev.oc"
	},
	{
		suffix: "co.vi",
		reversed: "iv.oc"
	},
	{
		suffix: "co.za",
		reversed: "az.oc"
	},
	{
		suffix: "co.zm",
		reversed: "mz.oc"
	},
	{
		suffix: "co.zw",
		reversed: "wz.oc"
	},
	{
		suffix: "coach",
		reversed: "hcaoc"
	},
	{
		suffix: "coal.museum",
		reversed: "muesum.laoc"
	},
	{
		suffix: "coastaldefence.museum",
		reversed: "muesum.ecnefedlatsaoc"
	},
	{
		suffix: "cocotte.jp",
		reversed: "pj.ettococ"
	},
	{
		suffix: "codeberg.page",
		reversed: "egap.grebedoc"
	},
	{
		suffix: "codes",
		reversed: "sedoc"
	},
	{
		suffix: "codespot.com",
		reversed: "moc.topsedoc"
	},
	{
		suffix: "cody.museum",
		reversed: "muesum.ydoc"
	},
	{
		suffix: "coffee",
		reversed: "eeffoc"
	},
	{
		suffix: "cog.mi.us",
		reversed: "su.im.goc"
	},
	{
		suffix: "col.ng",
		reversed: "gn.loc"
	},
	{
		suffix: "coldwar.museum",
		reversed: "muesum.rawdloc"
	},
	{
		suffix: "collection.museum",
		reversed: "muesum.noitcelloc"
	},
	{
		suffix: "college",
		reversed: "egelloc"
	},
	{
		suffix: "collegefan.org",
		reversed: "gro.nafegelloc"
	},
	{
		suffix: "cologne",
		reversed: "engoloc"
	},
	{
		suffix: "colonialwilliamsburg.museum",
		reversed: "muesum.grubsmailliwlainoloc"
	},
	{
		suffix: "coloradoplateau.museum",
		reversed: "muesum.uaetalpodaroloc"
	},
	{
		suffix: "columbia.museum",
		reversed: "muesum.aibmuloc"
	},
	{
		suffix: "columbus.museum",
		reversed: "muesum.submuloc"
	},
	{
		suffix: "com",
		reversed: "moc"
	},
	{
		suffix: "com.ac",
		reversed: "ca.moc"
	},
	{
		suffix: "com.af",
		reversed: "fa.moc"
	},
	{
		suffix: "com.ag",
		reversed: "ga.moc"
	},
	{
		suffix: "com.ai",
		reversed: "ia.moc"
	},
	{
		suffix: "com.al",
		reversed: "la.moc"
	},
	{
		suffix: "com.am",
		reversed: "ma.moc"
	},
	{
		suffix: "com.ar",
		reversed: "ra.moc"
	},
	{
		suffix: "com.au",
		reversed: "ua.moc"
	},
	{
		suffix: "com.aw",
		reversed: "wa.moc"
	},
	{
		suffix: "com.az",
		reversed: "za.moc"
	},
	{
		suffix: "com.ba",
		reversed: "ab.moc"
	},
	{
		suffix: "com.bb",
		reversed: "bb.moc"
	},
	{
		suffix: "com.bh",
		reversed: "hb.moc"
	},
	{
		suffix: "com.bi",
		reversed: "ib.moc"
	},
	{
		suffix: "com.bm",
		reversed: "mb.moc"
	},
	{
		suffix: "com.bn",
		reversed: "nb.moc"
	},
	{
		suffix: "com.bo",
		reversed: "ob.moc"
	},
	{
		suffix: "com.br",
		reversed: "rb.moc"
	},
	{
		suffix: "com.bs",
		reversed: "sb.moc"
	},
	{
		suffix: "com.bt",
		reversed: "tb.moc"
	},
	{
		suffix: "com.by",
		reversed: "yb.moc"
	},
	{
		suffix: "com.bz",
		reversed: "zb.moc"
	},
	{
		suffix: "com.ci",
		reversed: "ic.moc"
	},
	{
		suffix: "com.cm",
		reversed: "mc.moc"
	},
	{
		suffix: "com.cn",
		reversed: "nc.moc"
	},
	{
		suffix: "com.co",
		reversed: "oc.moc"
	},
	{
		suffix: "com.cu",
		reversed: "uc.moc"
	},
	{
		suffix: "com.cv",
		reversed: "vc.moc"
	},
	{
		suffix: "com.cw",
		reversed: "wc.moc"
	},
	{
		suffix: "com.cy",
		reversed: "yc.moc"
	},
	{
		suffix: "com.de",
		reversed: "ed.moc"
	},
	{
		suffix: "com.dm",
		reversed: "md.moc"
	},
	{
		suffix: "com.do",
		reversed: "od.moc"
	},
	{
		suffix: "com.dz",
		reversed: "zd.moc"
	},
	{
		suffix: "com.ec",
		reversed: "ce.moc"
	},
	{
		suffix: "com.ee",
		reversed: "ee.moc"
	},
	{
		suffix: "com.eg",
		reversed: "ge.moc"
	},
	{
		suffix: "com.es",
		reversed: "se.moc"
	},
	{
		suffix: "com.et",
		reversed: "te.moc"
	},
	{
		suffix: "com.fj",
		reversed: "jf.moc"
	},
	{
		suffix: "com.fm",
		reversed: "mf.moc"
	},
	{
		suffix: "com.fr",
		reversed: "rf.moc"
	},
	{
		suffix: "com.ge",
		reversed: "eg.moc"
	},
	{
		suffix: "com.gh",
		reversed: "hg.moc"
	},
	{
		suffix: "com.gi",
		reversed: "ig.moc"
	},
	{
		suffix: "com.gl",
		reversed: "lg.moc"
	},
	{
		suffix: "com.gn",
		reversed: "ng.moc"
	},
	{
		suffix: "com.gp",
		reversed: "pg.moc"
	},
	{
		suffix: "com.gr",
		reversed: "rg.moc"
	},
	{
		suffix: "com.gt",
		reversed: "tg.moc"
	},
	{
		suffix: "com.gu",
		reversed: "ug.moc"
	},
	{
		suffix: "com.gy",
		reversed: "yg.moc"
	},
	{
		suffix: "com.hk",
		reversed: "kh.moc"
	},
	{
		suffix: "com.hn",
		reversed: "nh.moc"
	},
	{
		suffix: "com.hr",
		reversed: "rh.moc"
	},
	{
		suffix: "com.ht",
		reversed: "th.moc"
	},
	{
		suffix: "com.im",
		reversed: "mi.moc"
	},
	{
		suffix: "com.in",
		reversed: "ni.moc"
	},
	{
		suffix: "com.io",
		reversed: "oi.moc"
	},
	{
		suffix: "com.iq",
		reversed: "qi.moc"
	},
	{
		suffix: "com.is",
		reversed: "si.moc"
	},
	{
		suffix: "com.jo",
		reversed: "oj.moc"
	},
	{
		suffix: "com.kg",
		reversed: "gk.moc"
	},
	{
		suffix: "com.ki",
		reversed: "ik.moc"
	},
	{
		suffix: "com.km",
		reversed: "mk.moc"
	},
	{
		suffix: "com.kp",
		reversed: "pk.moc"
	},
	{
		suffix: "com.kw",
		reversed: "wk.moc"
	},
	{
		suffix: "com.ky",
		reversed: "yk.moc"
	},
	{
		suffix: "com.kz",
		reversed: "zk.moc"
	},
	{
		suffix: "com.la",
		reversed: "al.moc"
	},
	{
		suffix: "com.lb",
		reversed: "bl.moc"
	},
	{
		suffix: "com.lc",
		reversed: "cl.moc"
	},
	{
		suffix: "com.lk",
		reversed: "kl.moc"
	},
	{
		suffix: "com.lr",
		reversed: "rl.moc"
	},
	{
		suffix: "com.lv",
		reversed: "vl.moc"
	},
	{
		suffix: "com.ly",
		reversed: "yl.moc"
	},
	{
		suffix: "com.mg",
		reversed: "gm.moc"
	},
	{
		suffix: "com.mk",
		reversed: "km.moc"
	},
	{
		suffix: "com.ml",
		reversed: "lm.moc"
	},
	{
		suffix: "com.mo",
		reversed: "om.moc"
	},
	{
		suffix: "com.ms",
		reversed: "sm.moc"
	},
	{
		suffix: "com.mt",
		reversed: "tm.moc"
	},
	{
		suffix: "com.mu",
		reversed: "um.moc"
	},
	{
		suffix: "com.mv",
		reversed: "vm.moc"
	},
	{
		suffix: "com.mw",
		reversed: "wm.moc"
	},
	{
		suffix: "com.mx",
		reversed: "xm.moc"
	},
	{
		suffix: "com.my",
		reversed: "ym.moc"
	},
	{
		suffix: "com.na",
		reversed: "an.moc"
	},
	{
		suffix: "com.nf",
		reversed: "fn.moc"
	},
	{
		suffix: "com.ng",
		reversed: "gn.moc"
	},
	{
		suffix: "com.ni",
		reversed: "in.moc"
	},
	{
		suffix: "com.nr",
		reversed: "rn.moc"
	},
	{
		suffix: "com.om",
		reversed: "mo.moc"
	},
	{
		suffix: "com.pa",
		reversed: "ap.moc"
	},
	{
		suffix: "com.pe",
		reversed: "ep.moc"
	},
	{
		suffix: "com.pf",
		reversed: "fp.moc"
	},
	{
		suffix: "com.ph",
		reversed: "hp.moc"
	},
	{
		suffix: "com.pk",
		reversed: "kp.moc"
	},
	{
		suffix: "com.pl",
		reversed: "lp.moc"
	},
	{
		suffix: "com.pr",
		reversed: "rp.moc"
	},
	{
		suffix: "com.ps",
		reversed: "sp.moc"
	},
	{
		suffix: "com.pt",
		reversed: "tp.moc"
	},
	{
		suffix: "com.py",
		reversed: "yp.moc"
	},
	{
		suffix: "com.qa",
		reversed: "aq.moc"
	},
	{
		suffix: "com.re",
		reversed: "er.moc"
	},
	{
		suffix: "com.ro",
		reversed: "or.moc"
	},
	{
		suffix: "com.ru",
		reversed: "ur.moc"
	},
	{
		suffix: "com.sa",
		reversed: "as.moc"
	},
	{
		suffix: "com.sb",
		reversed: "bs.moc"
	},
	{
		suffix: "com.sc",
		reversed: "cs.moc"
	},
	{
		suffix: "com.sd",
		reversed: "ds.moc"
	},
	{
		suffix: "com.se",
		reversed: "es.moc"
	},
	{
		suffix: "com.sg",
		reversed: "gs.moc"
	},
	{
		suffix: "com.sh",
		reversed: "hs.moc"
	},
	{
		suffix: "com.sl",
		reversed: "ls.moc"
	},
	{
		suffix: "com.sn",
		reversed: "ns.moc"
	},
	{
		suffix: "com.so",
		reversed: "os.moc"
	},
	{
		suffix: "com.ss",
		reversed: "ss.moc"
	},
	{
		suffix: "com.st",
		reversed: "ts.moc"
	},
	{
		suffix: "com.sv",
		reversed: "vs.moc"
	},
	{
		suffix: "com.sy",
		reversed: "ys.moc"
	},
	{
		suffix: "com.tj",
		reversed: "jt.moc"
	},
	{
		suffix: "com.tm",
		reversed: "mt.moc"
	},
	{
		suffix: "com.tn",
		reversed: "nt.moc"
	},
	{
		suffix: "com.to",
		reversed: "ot.moc"
	},
	{
		suffix: "com.tr",
		reversed: "rt.moc"
	},
	{
		suffix: "com.tt",
		reversed: "tt.moc"
	},
	{
		suffix: "com.tw",
		reversed: "wt.moc"
	},
	{
		suffix: "com.ua",
		reversed: "au.moc"
	},
	{
		suffix: "com.ug",
		reversed: "gu.moc"
	},
	{
		suffix: "com.uy",
		reversed: "yu.moc"
	},
	{
		suffix: "com.uz",
		reversed: "zu.moc"
	},
	{
		suffix: "com.vc",
		reversed: "cv.moc"
	},
	{
		suffix: "com.ve",
		reversed: "ev.moc"
	},
	{
		suffix: "com.vi",
		reversed: "iv.moc"
	},
	{
		suffix: "com.vn",
		reversed: "nv.moc"
	},
	{
		suffix: "com.vu",
		reversed: "uv.moc"
	},
	{
		suffix: "com.ws",
		reversed: "sw.moc"
	},
	{
		suffix: "com.ye",
		reversed: "ey.moc"
	},
	{
		suffix: "com.zm",
		reversed: "mz.moc"
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
		suffix: "commune.am",
		reversed: "ma.enummoc"
	},
	{
		suffix: "communication.museum",
		reversed: "muesum.noitacinummoc"
	},
	{
		suffix: "communications.museum",
		reversed: "muesum.snoitacinummoc"
	},
	{
		suffix: "community",
		reversed: "ytinummoc"
	},
	{
		suffix: "community-pro.de",
		reversed: "ed.orp-ytinummoc"
	},
	{
		suffix: "community-pro.net",
		reversed: "ten.orp-ytinummoc"
	},
	{
		suffix: "community.museum",
		reversed: "muesum.ytinummoc"
	},
	{
		suffix: "como.it",
		reversed: "ti.omoc"
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
		suffix: "computer.museum",
		reversed: "muesum.retupmoc"
	},
	{
		suffix: "computerhistory.museum",
		reversed: "muesum.yrotsihretupmoc"
	},
	{
		suffix: "comsec",
		reversed: "cesmoc"
	},
	{
		suffix: "comunicações.museum",
		reversed: "muesum.o2a6v-seacinumoc--nx"
	},
	{
		suffix: "condos",
		reversed: "sodnoc"
	},
	{
		suffix: "conf.au",
		reversed: "ua.fnoc"
	},
	{
		suffix: "conf.lv",
		reversed: "vl.fnoc"
	},
	{
		suffix: "conf.se",
		reversed: "es.fnoc"
	},
	{
		suffix: "conference.aero",
		reversed: "orea.ecnerefnoc"
	},
	{
		suffix: "conn.uk",
		reversed: "ku.nnoc"
	},
	{
		suffix: "construction",
		reversed: "noitcurtsnoc"
	},
	{
		suffix: "consulado.st",
		reversed: "ts.odalusnoc"
	},
	{
		suffix: "consultant.aero",
		reversed: "orea.tnatlusnoc"
	},
	{
		suffix: "consulting",
		reversed: "gnitlusnoc"
	},
	{
		suffix: "consulting.aero",
		reversed: "orea.gnitlusnoc"
	},
	{
		suffix: "contact",
		reversed: "tcatnoc"
	},
	{
		suffix: "contagem.br",
		reversed: "rb.megatnoc"
	},
	{
		suffix: "contemporary.museum",
		reversed: "muesum.yraropmetnoc"
	},
	{
		suffix: "contemporaryart.museum",
		reversed: "muesum.trayraropmetnoc"
	},
	{
		suffix: "contractors",
		reversed: "srotcartnoc"
	},
	{
		suffix: "control.aero",
		reversed: "orea.lortnoc"
	},
	{
		suffix: "convent.museum",
		reversed: "muesum.tnevnoc"
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
		suffix: "coolblog.jp",
		reversed: "pj.golblooc"
	},
	{
		suffix: "coop",
		reversed: "pooc"
	},
	{
		suffix: "coop.ar",
		reversed: "ra.pooc"
	},
	{
		suffix: "coop.br",
		reversed: "rb.pooc"
	},
	{
		suffix: "coop.ht",
		reversed: "th.pooc"
	},
	{
		suffix: "coop.in",
		reversed: "ni.pooc"
	},
	{
		suffix: "coop.km",
		reversed: "mk.pooc"
	},
	{
		suffix: "coop.mv",
		reversed: "vm.pooc"
	},
	{
		suffix: "coop.mw",
		reversed: "wm.pooc"
	},
	{
		suffix: "coop.py",
		reversed: "yp.pooc"
	},
	{
		suffix: "coop.rw",
		reversed: "wr.pooc"
	},
	{
		suffix: "coop.tt",
		reversed: "tt.pooc"
	},
	{
		suffix: "cooperativa.bo",
		reversed: "ob.avitarepooc"
	},
	{
		suffix: "copenhagen.museum",
		reversed: "muesum.negahnepoc"
	},
	{
		suffix: "copro.uk",
		reversed: "ku.orpoc"
	},
	{
		suffix: "corporation.museum",
		reversed: "muesum.noitaroproc"
	},
	{
		suffix: "correios-e-telecomunicações.museum",
		reversed: "muesum.a92chg-seacinumocelet-e-soierroc--nx"
	},
	{
		suffix: "corsica",
		reversed: "acisroc"
	},
	{
		suffix: "corvette.museum",
		reversed: "muesum.ettevroc"
	},
	{
		suffix: "cosenza.it",
		reversed: "ti.aznesoc"
	},
	{
		suffix: "costume.museum",
		reversed: "muesum.emutsoc"
	},
	{
		suffix: "couchpotatofries.org",
		reversed: "gro.seirfotatophcuoc"
	},
	{
		suffix: "council.aero",
		reversed: "orea.licnuoc"
	},
	{
		suffix: "country",
		reversed: "yrtnuoc"
	},
	{
		suffix: "countryestate.museum",
		reversed: "muesum.etatseyrtnuoc"
	},
	{
		suffix: "county.museum",
		reversed: "muesum.ytnuoc"
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
		suffix: "coz.br",
		reversed: "rb.zoc"
	},
	{
		suffix: "cpa",
		reversed: "apc"
	},
	{
		suffix: "cpa.pro",
		reversed: "orp.apc"
	},
	{
		suffix: "cq.cn",
		reversed: "nc.qc"
	},
	{
		suffix: "cr",
		reversed: "rc"
	},
	{
		suffix: "cr.it",
		reversed: "ti.rc"
	},
	{
		suffix: "cr.ua",
		reversed: "au.rc"
	},
	{
		suffix: "crafting.xyz",
		reversed: "zyx.gnitfarc"
	},
	{
		suffix: "crafts.museum",
		reversed: "muesum.stfarc"
	},
	{
		suffix: "cranbrook.museum",
		reversed: "muesum.koorbnarc"
	},
	{
		suffix: "cranky.jp",
		reversed: "pj.yknarc"
	},
	{
		suffix: "crd.co",
		reversed: "oc.drc"
	},
	{
		suffix: "creation.museum",
		reversed: "muesum.noitaerc"
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
		suffix: "cremona.it",
		reversed: "ti.anomerc"
	},
	{
		suffix: "crew.aero",
		reversed: "orea.werc"
	},
	{
		suffix: "cri.br",
		reversed: "rb.irc"
	},
	{
		suffix: "cri.nz",
		reversed: "zn.irc"
	},
	{
		suffix: "cricket",
		reversed: "tekcirc"
	},
	{
		suffix: "crimea.ua",
		reversed: "au.aemirc"
	},
	{
		suffix: "crotone.it",
		reversed: "ti.enotorc"
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
		suffix: "cs.in",
		reversed: "ni.sc"
	},
	{
		suffix: "cs.it",
		reversed: "ti.sc"
	},
	{
		suffix: "cs.keliweb.cloud",
		reversed: "duolc.bewilek.sc"
	},
	{
		suffix: "csx.cc",
		reversed: "cc.xsc"
	},
	{
		suffix: "ct.it",
		reversed: "ti.tc"
	},
	{
		suffix: "ct.us",
		reversed: "su.tc"
	},
	{
		suffix: "cu",
		reversed: "uc"
	},
	{
		suffix: "cuiaba.br",
		reversed: "rb.abaiuc"
	},
	{
		suffix: "cuisinella",
		reversed: "allenisiuc"
	},
	{
		suffix: "cultural.museum",
		reversed: "muesum.larutluc"
	},
	{
		suffix: "culturalcenter.museum",
		reversed: "muesum.retneclarutluc"
	},
	{
		suffix: "culture.museum",
		reversed: "muesum.erutluc"
	},
	{
		suffix: "cuneo.it",
		reversed: "ti.oenuc"
	},
	{
		suffix: "cupcake.is",
		reversed: "si.ekacpuc"
	},
	{
		suffix: "curitiba.br",
		reversed: "rb.abitiruc"
	},
	{
		suffix: "curv.dev",
		reversed: "ved.vruc"
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
		suffix: "cust.retrosnub.co.uk",
		reversed: "ku.oc.bunsorter.tsuc"
	},
	{
		suffix: "cust.testing.thingdust.io",
		reversed: "oi.tsudgniht.gnitset.tsuc"
	},
	{
		suffix: "custom.metacentrum.cz",
		reversed: "zc.murtnecatem.motsuc"
	},
	{
		suffix: "customer.mythic-beasts.com",
		reversed: "moc.stsaeb-cihtym.remotsuc"
	},
	{
		suffix: "customer.speedpartner.de",
		reversed: "ed.rentrapdeeps.remotsuc"
	},
	{
		suffix: "cutegirl.jp",
		reversed: "pj.lrigetuc"
	},
	{
		suffix: "cv",
		reversed: "vc"
	},
	{
		suffix: "cv.ua",
		reversed: "au.vc"
	},
	{
		suffix: "cw",
		reversed: "wc"
	},
	{
		suffix: "cx",
		reversed: "xc"
	},
	{
		suffix: "cx.ua",
		reversed: "au.xc"
	},
	{
		suffix: "cy",
		reversed: "yc"
	},
	{
		suffix: "cy.eu.org",
		reversed: "gro.ue.yc"
	},
	{
		suffix: "cya.gg",
		reversed: "gg.ayc"
	},
	{
		suffix: "cyber.museum",
		reversed: "muesum.rebyc"
	},
	{
		suffix: "cymru",
		reversed: "urmyc"
	},
	{
		suffix: "cymru.museum",
		reversed: "muesum.urmyc"
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
		suffix: "cyou",
		reversed: "uoyc"
	},
	{
		suffix: "cz",
		reversed: "zc"
	},
	{
		suffix: "cz.eu.org",
		reversed: "gro.ue.zc"
	},
	{
		suffix: "cz.it",
		reversed: "ti.zc"
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
		suffix: "d.bg",
		reversed: "gb.d"
	},
	{
		suffix: "d.gv.vc",
		reversed: "cv.vg.d"
	},
	{
		suffix: "d.se",
		reversed: "es.d"
	},
	{
		suffix: "daa.jp",
		reversed: "pj.aad"
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
		suffix: "daegu.kr",
		reversed: "rk.ugead"
	},
	{
		suffix: "daejeon.kr",
		reversed: "rk.noejead"
	},
	{
		suffix: "daemon.panel.gg",
		reversed: "gg.lenap.nomead"
	},
	{
		suffix: "dagestan.ru",
		reversed: "ur.natsegad"
	},
	{
		suffix: "dagestan.su",
		reversed: "us.natsegad"
	},
	{
		suffix: "daigo.ibaraki.jp",
		reversed: "pj.ikarabi.ogiad"
	},
	{
		suffix: "daisen.akita.jp",
		reversed: "pj.atika.nesiad"
	},
	{
		suffix: "daito.osaka.jp",
		reversed: "pj.akaso.otiad"
	},
	{
		suffix: "daiwa.hiroshima.jp",
		reversed: "pj.amihsorih.awiad"
	},
	{
		suffix: "dali.museum",
		reversed: "muesum.ilad"
	},
	{
		suffix: "dallas.museum",
		reversed: "muesum.sallad"
	},
	{
		suffix: "damnserver.com",
		reversed: "moc.revresnmad"
	},
	{
		suffix: "dance",
		reversed: "ecnad"
	},
	{
		suffix: "daplie.me",
		reversed: "em.eilpad"
	},
	{
		suffix: "data",
		reversed: "atad"
	},
	{
		suffix: "database.museum",
		reversed: "muesum.esabatad"
	},
	{
		suffix: "date",
		reversed: "etad"
	},
	{
		suffix: "date.fukushima.jp",
		reversed: "pj.amihsukuf.etad"
	},
	{
		suffix: "date.hokkaido.jp",
		reversed: "pj.odiakkoh.etad"
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
		suffix: "dattolocal.com",
		reversed: "moc.lacolottad"
	},
	{
		suffix: "dattolocal.net",
		reversed: "ten.lacolottad"
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
		suffix: "davvenjarga.no",
		reversed: "on.agrajnevvad"
	},
	{
		suffix: "davvenjárga.no",
		reversed: "on.a4y-agrjnevvad--nx"
	},
	{
		suffix: "davvesiida.no",
		reversed: "on.adiisevvad"
	},
	{
		suffix: "day",
		reversed: "yad"
	},
	{
		suffix: "dazaifu.fukuoka.jp",
		reversed: "pj.akoukuf.ufiazad"
	},
	{
		suffix: "dc.us",
		reversed: "su.cd"
	},
	{
		suffix: "dclk",
		reversed: "klcd"
	},
	{
		suffix: "dd-dns.de",
		reversed: "ed.snd-dd"
	},
	{
		suffix: "ddns.me",
		reversed: "em.sndd"
	},
	{
		suffix: "ddns.net",
		reversed: "ten.sndd"
	},
	{
		suffix: "ddns5.com",
		reversed: "moc.5sndd"
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
		suffix: "ddnsking.com",
		reversed: "moc.gniksndd"
	},
	{
		suffix: "ddnslive.com",
		reversed: "moc.evilsndd"
	},
	{
		suffix: "ddnss.de",
		reversed: "ed.ssndd"
	},
	{
		suffix: "ddnss.org",
		reversed: "gro.ssndd"
	},
	{
		suffix: "ddr.museum",
		reversed: "muesum.rdd"
	},
	{
		suffix: "dds",
		reversed: "sdd"
	},
	{
		suffix: "de",
		reversed: "ed"
	},
	{
		suffix: "de.com",
		reversed: "moc.ed"
	},
	{
		suffix: "de.cool",
		reversed: "looc.ed"
	},
	{
		suffix: "de.eu.org",
		reversed: "gro.ue.ed"
	},
	{
		suffix: "de.gt",
		reversed: "tg.ed"
	},
	{
		suffix: "de.ls",
		reversed: "sl.ed"
	},
	{
		suffix: "de.md",
		reversed: "dm.ed"
	},
	{
		suffix: "de.trendhosting.cloud",
		reversed: "duolc.gnitsohdnert.ed"
	},
	{
		suffix: "de.us",
		reversed: "su.ed"
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
		suffix: "deatnu.no",
		reversed: "on.untaed"
	},
	{
		suffix: "debian.net",
		reversed: "ten.naibed"
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
		suffix: "decorativearts.museum",
		reversed: "muesum.straevitaroced"
	},
	{
		suffix: "dedibox.fr",
		reversed: "rf.xobided"
	},
	{
		suffix: "dedyn.io",
		reversed: "oi.nyded"
	},
	{
		suffix: "def.br",
		reversed: "rb.fed"
	},
	{
		suffix: "definima.io",
		reversed: "oi.aminifed"
	},
	{
		suffix: "definima.net",
		reversed: "ten.aminifed"
	},
	{
		suffix: "degree",
		reversed: "eerged"
	},
	{
		suffix: "delaware.museum",
		reversed: "muesum.erawaled"
	},
	{
		suffix: "delhi.in",
		reversed: "ni.ihled"
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
		suffix: "dell-ogliastra.it",
		reversed: "ti.artsailgo-lled"
	},
	{
		suffix: "dellogliastra.it",
		reversed: "ti.artsailgolled"
	},
	{
		suffix: "delmenhorst.museum",
		reversed: "muesum.tsrohnemled"
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
		suffix: "demo.datacenter.fi",
		reversed: "if.retnecatad.omed"
	},
	{
		suffix: "demo.datadetect.com",
		reversed: "moc.tcetedatad.omed"
	},
	{
		suffix: "demo.jelastic.com",
		reversed: "moc.citsalej.omed"
	},
	{
		suffix: "democracia.bo",
		reversed: "ob.aicarcomed"
	},
	{
		suffix: "democrat",
		reversed: "tarcomed"
	},
	{
		suffix: "demon.nl",
		reversed: "ln.nomed"
	},
	{
		suffix: "denmark.museum",
		reversed: "muesum.kramned"
	},
	{
		suffix: "deno-staging.dev",
		reversed: "ved.gnigats-oned"
	},
	{
		suffix: "deno.dev",
		reversed: "ved.oned"
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
		suffix: "dep.no",
		reversed: "on.ped"
	},
	{
		suffix: "deporte.bo",
		reversed: "ob.etroped"
	},
	{
		suffix: "depot.museum",
		reversed: "muesum.toped"
	},
	{
		suffix: "des.br",
		reversed: "rb.sed"
	},
	{
		suffix: "desa.id",
		reversed: "di.ased"
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
		suffix: "design.aero",
		reversed: "orea.ngised"
	},
	{
		suffix: "design.museum",
		reversed: "muesum.ngised"
	},
	{
		suffix: "det.br",
		reversed: "rb.ted"
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
		suffix: "detroit.museum",
		reversed: "muesum.tiorted"
	},
	{
		suffix: "dev",
		reversed: "ved"
	},
	{
		suffix: "dev-myqnapcloud.com",
		reversed: "moc.duolcpanqym-ved"
	},
	{
		suffix: "dev.br",
		reversed: "rb.ved"
	},
	{
		suffix: "dev.static.land",
		reversed: "dnal.citats.ved"
	},
	{
		suffix: "dev.vu",
		reversed: "uv.ved"
	},
	{
		suffix: "development.run",
		reversed: "nur.tnempoleved"
	},
	{
		suffix: "devices.resinstaging.io",
		reversed: "oi.gnigatsniser.secived"
	},
	{
		suffix: "df.gov.br",
		reversed: "rb.vog.fd"
	},
	{
		suffix: "df.leg.br",
		reversed: "rb.gel.fd"
	},
	{
		suffix: "dgca.aero",
		reversed: "orea.acgd"
	},
	{
		suffix: "dh.bytemark.co.uk",
		reversed: "ku.oc.krametyb.hd"
	},
	{
		suffix: "dhl",
		reversed: "lhd"
	},
	{
		suffix: "diadem.cloud",
		reversed: "duolc.medaid"
	},
	{
		suffix: "diamonds",
		reversed: "sdnomaid"
	},
	{
		suffix: "dielddanuorri.no",
		reversed: "on.irrounaddleid"
	},
	{
		suffix: "diet",
		reversed: "teid"
	},
	{
		suffix: "digick.jp",
		reversed: "pj.kcigid"
	},
	{
		suffix: "digital",
		reversed: "latigid"
	},
	{
		suffix: "dinosaur.museum",
		reversed: "muesum.ruasonid"
	},
	{
		suffix: "direct",
		reversed: "tcerid"
	},
	{
		suffix: "direct.quickconnect.cn",
		reversed: "nc.tcennockciuq.tcerid"
	},
	{
		suffix: "direct.quickconnect.to",
		reversed: "ot.tcennockciuq.tcerid"
	},
	{
		suffix: "directory",
		reversed: "yrotcerid"
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
		suffix: "discount",
		reversed: "tnuocsid"
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
		suffix: "discover",
		reversed: "revocsid"
	},
	{
		suffix: "discovery.museum",
		reversed: "muesum.yrevocsid"
	},
	{
		suffix: "dish",
		reversed: "hsid"
	},
	{
		suffix: "diskstation.eu",
		reversed: "ue.noitatsksid"
	},
	{
		suffix: "diskstation.me",
		reversed: "em.noitatsksid"
	},
	{
		suffix: "diskstation.org",
		reversed: "gro.noitatsksid"
	},
	{
		suffix: "diskussionsbereich.de",
		reversed: "ed.hcierebsnoissuksid"
	},
	{
		suffix: "ditchyourip.com",
		reversed: "moc.piruoyhctid"
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
		suffix: "diy",
		reversed: "yid"
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
		suffix: "dk.eu.org",
		reversed: "gro.ue.kd"
	},
	{
		suffix: "dlugoleka.pl",
		reversed: "lp.akeloguld"
	},
	{
		suffix: "dm",
		reversed: "md"
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
		suffix: "dni.us",
		reversed: "su.ind"
	},
	{
		suffix: "dnipropetrovsk.ua",
		reversed: "au.ksvorteporpind"
	},
	{
		suffix: "dnp",
		reversed: "pnd"
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
		suffix: "dnsfor.me",
		reversed: "em.rofsnd"
	},
	{
		suffix: "dnshome.de",
		reversed: "ed.emohsnd"
	},
	{
		suffix: "dnsiskinky.com",
		reversed: "moc.ykniksisnd"
	},
	{
		suffix: "dnsking.ch",
		reversed: "hc.gniksnd"
	},
	{
		suffix: "dnsup.net",
		reversed: "ten.pusnd"
	},
	{
		suffix: "dnsupdate.info",
		reversed: "ofni.etadpusnd"
	},
	{
		suffix: "dnsupdater.de",
		reversed: "ed.retadpusnd"
	},
	{
		suffix: "do",
		reversed: "od"
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
		suffix: "dog",
		reversed: "god"
	},
	{
		suffix: "dolls.museum",
		reversed: "muesum.sllod"
	},
	{
		suffix: "domains",
		reversed: "sniamod"
	},
	{
		suffix: "donetsk.ua",
		reversed: "au.kstenod"
	},
	{
		suffix: "donna.no",
		reversed: "on.annod"
	},
	{
		suffix: "donostia.museum",
		reversed: "muesum.aitsonod"
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
		suffix: "dopaas.com",
		reversed: "moc.saapod"
	},
	{
		suffix: "doshi.yamanashi.jp",
		reversed: "pj.ihsanamay.ihsod"
	},
	{
		suffix: "dot",
		reversed: "tod"
	},
	{
		suffix: "dovre.no",
		reversed: "on.ervod"
	},
	{
		suffix: "download",
		reversed: "daolnwod"
	},
	{
		suffix: "dp.ua",
		reversed: "au.pd"
	},
	{
		suffix: "dr.in",
		reversed: "ni.rd"
	},
	{
		suffix: "dr.na",
		reversed: "an.rd"
	},
	{
		suffix: "dr.tr",
		reversed: "rt.rd"
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
		suffix: "dray-dns.de",
		reversed: "ed.snd-yard"
	},
	{
		suffix: "drayddns.com",
		reversed: "moc.snddyard"
	},
	{
		suffix: "draydns.de",
		reversed: "ed.sndyard"
	},
	{
		suffix: "dreamhosters.com",
		reversed: "moc.sretsohmaerd"
	},
	{
		suffix: "drive",
		reversed: "evird"
	},
	{
		suffix: "drobak.no",
		reversed: "on.kabord"
	},
	{
		suffix: "drr.ac",
		reversed: "ca.rrd"
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
		suffix: "drøbak.no",
		reversed: "on.auw-kabrd--nx"
	},
	{
		suffix: "dscloud.biz",
		reversed: "zib.duolcsd"
	},
	{
		suffix: "dscloud.me",
		reversed: "em.duolcsd"
	},
	{
		suffix: "dscloud.mobi",
		reversed: "ibom.duolcsd"
	},
	{
		suffix: "dsmynas.com",
		reversed: "moc.sanymsd"
	},
	{
		suffix: "dsmynas.net",
		reversed: "ten.sanymsd"
	},
	{
		suffix: "dsmynas.org",
		reversed: "gro.sanymsd"
	},
	{
		suffix: "dst.mi.us",
		reversed: "su.im.tsd"
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
		suffix: "duckdns.org",
		reversed: "gro.sndkcud"
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
		suffix: "durham.museum",
		reversed: "muesum.mahrud"
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
		suffix: "dvrcam.info",
		reversed: "ofni.macrvd"
	},
	{
		suffix: "dvrdns.org",
		reversed: "gro.sndrvd"
	},
	{
		suffix: "dy.fi",
		reversed: "if.yd"
	},
	{
		suffix: "dyn-berlin.de",
		reversed: "ed.nilreb-nyd"
	},
	{
		suffix: "dyn-ip24.de",
		reversed: "ed.42pi-nyd"
	},
	{
		suffix: "dyn-o-saur.com",
		reversed: "moc.ruas-o-nyd"
	},
	{
		suffix: "dyn-vpn.de",
		reversed: "ed.npv-nyd"
	},
	{
		suffix: "dyn.cosidns.de",
		reversed: "ed.sndisoc.nyd"
	},
	{
		suffix: "dyn.ddnss.de",
		reversed: "ed.ssndd.nyd"
	},
	{
		suffix: "dyn.home-webserver.de",
		reversed: "ed.revresbew-emoh.nyd"
	},
	{
		suffix: "dyn53.io",
		reversed: "oi.35nyd"
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
		suffix: "dynamic-dns.info",
		reversed: "ofni.snd-cimanyd"
	},
	{
		suffix: "dynamisches-dns.de",
		reversed: "ed.snd-sehcsimanyd"
	},
	{
		suffix: "dynathome.net",
		reversed: "ten.emohtanyd"
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
		suffix: "dyndns.dappnode.io",
		reversed: "oi.edonppad.sndnyd"
	},
	{
		suffix: "dyndns.ddnss.de",
		reversed: "ed.ssndd.sndnyd"
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
		suffix: "dyndns.ws",
		reversed: "sw.sndnyd"
	},
	{
		suffix: "dyndns1.de",
		reversed: "ed.1sndnyd"
	},
	{
		suffix: "dynns.com",
		reversed: "moc.snnyd"
	},
	{
		suffix: "dynserv.org",
		reversed: "gro.vresnyd"
	},
	{
		suffix: "dynu.net",
		reversed: "ten.unyd"
	},
	{
		suffix: "dynv6.net",
		reversed: "ten.6vnyd"
	},
	{
		suffix: "dynvpn.de",
		reversed: "ed.npvnyd"
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
		suffix: "dz",
		reversed: "zd"
	},
	{
		suffix: "dønna.no",
		reversed: "on.arg-annd--nx"
	},
	{
		suffix: "e.bg",
		reversed: "gb.e"
	},
	{
		suffix: "e.se",
		reversed: "es.e"
	},
	{
		suffix: "e12.ve",
		reversed: "ev.21e"
	},
	{
		suffix: "e164.arpa",
		reversed: "apra.461e"
	},
	{
		suffix: "e4.cz",
		reversed: "zc.4e"
	},
	{
		suffix: "earth",
		reversed: "htrae"
	},
	{
		suffix: "east-kazakhstan.su",
		reversed: "us.natshkazak-tsae"
	},
	{
		suffix: "eastafrica.museum",
		reversed: "muesum.acirfatsae"
	},
	{
		suffix: "eastasia.azurestaticapps.net",
		reversed: "ten.sppacitatseruza.aisatsae"
	},
	{
		suffix: "eastcoast.museum",
		reversed: "muesum.tsaoctsae"
	},
	{
		suffix: "eastus2.azurestaticapps.net",
		reversed: "ten.sppacitatseruza.2sutsae"
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
		suffix: "eat",
		reversed: "tae"
	},
	{
		suffix: "eating-organic.net",
		reversed: "ten.cinagro-gnitae"
	},
	{
		suffix: "eaton.mi.us",
		reversed: "su.im.notae"
	},
	{
		suffix: "ebetsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustebe"
	},
	{
		suffix: "ebina.kanagawa.jp",
		reversed: "pj.awaganak.anibe"
	},
	{
		suffix: "ebino.miyazaki.jp",
		reversed: "pj.ikazayim.onibe"
	},
	{
		suffix: "ebiz.tw",
		reversed: "wt.zibe"
	},
	{
		suffix: "ec",
		reversed: "ce"
	},
	{
		suffix: "echizen.fukui.jp",
		reversed: "pj.iukuf.nezihce"
	},
	{
		suffix: "ecn.br",
		reversed: "rb.nce"
	},
	{
		suffix: "eco",
		reversed: "oce"
	},
	{
		suffix: "eco.br",
		reversed: "rb.oce"
	},
	{
		suffix: "ecologia.bo",
		reversed: "ob.aigoloce"
	},
	{
		suffix: "ecommerce-shop.pl",
		reversed: "lp.pohs-ecremmoce"
	},
	{
		suffix: "economia.bo",
		reversed: "ob.aimonoce"
	},
	{
		suffix: "ed.ao",
		reversed: "oa.de"
	},
	{
		suffix: "ed.ci",
		reversed: "ic.de"
	},
	{
		suffix: "ed.cr",
		reversed: "rc.de"
	},
	{
		suffix: "ed.jp",
		reversed: "pj.de"
	},
	{
		suffix: "ed.pw",
		reversed: "wp.de"
	},
	{
		suffix: "edeka",
		reversed: "akede"
	},
	{
		suffix: "edgeapp.net",
		reversed: "ten.ppaegde"
	},
	{
		suffix: "edgecompute.app",
		reversed: "ppa.etupmocegde"
	},
	{
		suffix: "edgestack.me",
		reversed: "em.kcatsegde"
	},
	{
		suffix: "editorx.io",
		reversed: "oi.xrotide"
	},
	{
		suffix: "edogawa.tokyo.jp",
		reversed: "pj.oykot.awagode"
	},
	{
		suffix: "edu",
		reversed: "ude"
	},
	{
		suffix: "edu.ac",
		reversed: "ca.ude"
	},
	{
		suffix: "edu.af",
		reversed: "fa.ude"
	},
	{
		suffix: "edu.al",
		reversed: "la.ude"
	},
	{
		suffix: "edu.ar",
		reversed: "ra.ude"
	},
	{
		suffix: "edu.au",
		reversed: "ua.ude"
	},
	{
		suffix: "edu.az",
		reversed: "za.ude"
	},
	{
		suffix: "edu.ba",
		reversed: "ab.ude"
	},
	{
		suffix: "edu.bb",
		reversed: "bb.ude"
	},
	{
		suffix: "edu.bh",
		reversed: "hb.ude"
	},
	{
		suffix: "edu.bi",
		reversed: "ib.ude"
	},
	{
		suffix: "edu.bm",
		reversed: "mb.ude"
	},
	{
		suffix: "edu.bn",
		reversed: "nb.ude"
	},
	{
		suffix: "edu.bo",
		reversed: "ob.ude"
	},
	{
		suffix: "edu.br",
		reversed: "rb.ude"
	},
	{
		suffix: "edu.bs",
		reversed: "sb.ude"
	},
	{
		suffix: "edu.bt",
		reversed: "tb.ude"
	},
	{
		suffix: "edu.bz",
		reversed: "zb.ude"
	},
	{
		suffix: "edu.ci",
		reversed: "ic.ude"
	},
	{
		suffix: "edu.cn",
		reversed: "nc.ude"
	},
	{
		suffix: "edu.co",
		reversed: "oc.ude"
	},
	{
		suffix: "edu.cu",
		reversed: "uc.ude"
	},
	{
		suffix: "edu.cv",
		reversed: "vc.ude"
	},
	{
		suffix: "edu.cw",
		reversed: "wc.ude"
	},
	{
		suffix: "edu.dm",
		reversed: "md.ude"
	},
	{
		suffix: "edu.do",
		reversed: "od.ude"
	},
	{
		suffix: "edu.dz",
		reversed: "zd.ude"
	},
	{
		suffix: "edu.ec",
		reversed: "ce.ude"
	},
	{
		suffix: "edu.ee",
		reversed: "ee.ude"
	},
	{
		suffix: "edu.eg",
		reversed: "ge.ude"
	},
	{
		suffix: "edu.es",
		reversed: "se.ude"
	},
	{
		suffix: "edu.et",
		reversed: "te.ude"
	},
	{
		suffix: "edu.eu.org",
		reversed: "gro.ue.ude"
	},
	{
		suffix: "edu.fm",
		reversed: "mf.ude"
	},
	{
		suffix: "edu.gd",
		reversed: "dg.ude"
	},
	{
		suffix: "edu.ge",
		reversed: "eg.ude"
	},
	{
		suffix: "edu.gh",
		reversed: "hg.ude"
	},
	{
		suffix: "edu.gi",
		reversed: "ig.ude"
	},
	{
		suffix: "edu.gl",
		reversed: "lg.ude"
	},
	{
		suffix: "edu.gn",
		reversed: "ng.ude"
	},
	{
		suffix: "edu.gp",
		reversed: "pg.ude"
	},
	{
		suffix: "edu.gr",
		reversed: "rg.ude"
	},
	{
		suffix: "edu.gt",
		reversed: "tg.ude"
	},
	{
		suffix: "edu.gu",
		reversed: "ug.ude"
	},
	{
		suffix: "edu.gy",
		reversed: "yg.ude"
	},
	{
		suffix: "edu.hk",
		reversed: "kh.ude"
	},
	{
		suffix: "edu.hn",
		reversed: "nh.ude"
	},
	{
		suffix: "edu.ht",
		reversed: "th.ude"
	},
	{
		suffix: "edu.in",
		reversed: "ni.ude"
	},
	{
		suffix: "edu.iq",
		reversed: "qi.ude"
	},
	{
		suffix: "edu.is",
		reversed: "si.ude"
	},
	{
		suffix: "edu.it",
		reversed: "ti.ude"
	},
	{
		suffix: "edu.jo",
		reversed: "oj.ude"
	},
	{
		suffix: "edu.kg",
		reversed: "gk.ude"
	},
	{
		suffix: "edu.ki",
		reversed: "ik.ude"
	},
	{
		suffix: "edu.km",
		reversed: "mk.ude"
	},
	{
		suffix: "edu.kn",
		reversed: "nk.ude"
	},
	{
		suffix: "edu.kp",
		reversed: "pk.ude"
	},
	{
		suffix: "edu.krd",
		reversed: "drk.ude"
	},
	{
		suffix: "edu.kw",
		reversed: "wk.ude"
	},
	{
		suffix: "edu.ky",
		reversed: "yk.ude"
	},
	{
		suffix: "edu.kz",
		reversed: "zk.ude"
	},
	{
		suffix: "edu.la",
		reversed: "al.ude"
	},
	{
		suffix: "edu.lb",
		reversed: "bl.ude"
	},
	{
		suffix: "edu.lc",
		reversed: "cl.ude"
	},
	{
		suffix: "edu.lk",
		reversed: "kl.ude"
	},
	{
		suffix: "edu.lr",
		reversed: "rl.ude"
	},
	{
		suffix: "edu.ls",
		reversed: "sl.ude"
	},
	{
		suffix: "edu.lv",
		reversed: "vl.ude"
	},
	{
		suffix: "edu.ly",
		reversed: "yl.ude"
	},
	{
		suffix: "edu.me",
		reversed: "em.ude"
	},
	{
		suffix: "edu.mg",
		reversed: "gm.ude"
	},
	{
		suffix: "edu.mk",
		reversed: "km.ude"
	},
	{
		suffix: "edu.ml",
		reversed: "lm.ude"
	},
	{
		suffix: "edu.mn",
		reversed: "nm.ude"
	},
	{
		suffix: "edu.mo",
		reversed: "om.ude"
	},
	{
		suffix: "edu.ms",
		reversed: "sm.ude"
	},
	{
		suffix: "edu.mt",
		reversed: "tm.ude"
	},
	{
		suffix: "edu.mv",
		reversed: "vm.ude"
	},
	{
		suffix: "edu.mw",
		reversed: "wm.ude"
	},
	{
		suffix: "edu.mx",
		reversed: "xm.ude"
	},
	{
		suffix: "edu.my",
		reversed: "ym.ude"
	},
	{
		suffix: "edu.mz",
		reversed: "zm.ude"
	},
	{
		suffix: "edu.ng",
		reversed: "gn.ude"
	},
	{
		suffix: "edu.ni",
		reversed: "in.ude"
	},
	{
		suffix: "edu.nr",
		reversed: "rn.ude"
	},
	{
		suffix: "edu.om",
		reversed: "mo.ude"
	},
	{
		suffix: "edu.pa",
		reversed: "ap.ude"
	},
	{
		suffix: "edu.pe",
		reversed: "ep.ude"
	},
	{
		suffix: "edu.pf",
		reversed: "fp.ude"
	},
	{
		suffix: "edu.ph",
		reversed: "hp.ude"
	},
	{
		suffix: "edu.pk",
		reversed: "kp.ude"
	},
	{
		suffix: "edu.pl",
		reversed: "lp.ude"
	},
	{
		suffix: "edu.pn",
		reversed: "np.ude"
	},
	{
		suffix: "edu.pr",
		reversed: "rp.ude"
	},
	{
		suffix: "edu.ps",
		reversed: "sp.ude"
	},
	{
		suffix: "edu.pt",
		reversed: "tp.ude"
	},
	{
		suffix: "edu.py",
		reversed: "yp.ude"
	},
	{
		suffix: "edu.qa",
		reversed: "aq.ude"
	},
	{
		suffix: "edu.rs",
		reversed: "sr.ude"
	},
	{
		suffix: "edu.ru",
		reversed: "ur.ude"
	},
	{
		suffix: "edu.sa",
		reversed: "as.ude"
	},
	{
		suffix: "edu.sb",
		reversed: "bs.ude"
	},
	{
		suffix: "edu.sc",
		reversed: "cs.ude"
	},
	{
		suffix: "edu.scot",
		reversed: "tocs.ude"
	},
	{
		suffix: "edu.sd",
		reversed: "ds.ude"
	},
	{
		suffix: "edu.sg",
		reversed: "gs.ude"
	},
	{
		suffix: "edu.sl",
		reversed: "ls.ude"
	},
	{
		suffix: "edu.sn",
		reversed: "ns.ude"
	},
	{
		suffix: "edu.so",
		reversed: "os.ude"
	},
	{
		suffix: "edu.ss",
		reversed: "ss.ude"
	},
	{
		suffix: "edu.st",
		reversed: "ts.ude"
	},
	{
		suffix: "edu.sv",
		reversed: "vs.ude"
	},
	{
		suffix: "edu.sy",
		reversed: "ys.ude"
	},
	{
		suffix: "edu.tj",
		reversed: "jt.ude"
	},
	{
		suffix: "edu.tm",
		reversed: "mt.ude"
	},
	{
		suffix: "edu.to",
		reversed: "ot.ude"
	},
	{
		suffix: "edu.tr",
		reversed: "rt.ude"
	},
	{
		suffix: "edu.tt",
		reversed: "tt.ude"
	},
	{
		suffix: "edu.tw",
		reversed: "wt.ude"
	},
	{
		suffix: "edu.ua",
		reversed: "au.ude"
	},
	{
		suffix: "edu.uy",
		reversed: "yu.ude"
	},
	{
		suffix: "edu.vc",
		reversed: "cv.ude"
	},
	{
		suffix: "edu.ve",
		reversed: "ev.ude"
	},
	{
		suffix: "edu.vn",
		reversed: "nv.ude"
	},
	{
		suffix: "edu.vu",
		reversed: "uv.ude"
	},
	{
		suffix: "edu.ws",
		reversed: "sw.ude"
	},
	{
		suffix: "edu.ye",
		reversed: "ey.ude"
	},
	{
		suffix: "edu.za",
		reversed: "az.ude"
	},
	{
		suffix: "edu.zm",
		reversed: "mz.ude"
	},
	{
		suffix: "education",
		reversed: "noitacude"
	},
	{
		suffix: "education.museum",
		reversed: "muesum.noitacude"
	},
	{
		suffix: "educational.museum",
		reversed: "muesum.lanoitacude"
	},
	{
		suffix: "educator.aero",
		reversed: "orea.rotacude"
	},
	{
		suffix: "edugit.io",
		reversed: "oi.tigude"
	},
	{
		suffix: "ee",
		reversed: "ee"
	},
	{
		suffix: "ee.eu.org",
		reversed: "gro.ue.ee"
	},
	{
		suffix: "eero-stage.online",
		reversed: "enilno.egats-oree"
	},
	{
		suffix: "eero.online",
		reversed: "enilno.oree"
	},
	{
		suffix: "eg",
		reversed: "ge"
	},
	{
		suffix: "egersund.no",
		reversed: "on.dnusrege"
	},
	{
		suffix: "egoism.jp",
		reversed: "pj.msioge"
	},
	{
		suffix: "egyptian.museum",
		reversed: "muesum.naitpyge"
	},
	{
		suffix: "ehime.jp",
		reversed: "pj.emihe"
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
		suffix: "eiheiji.fukui.jp",
		reversed: "pj.iukuf.ijiehie"
	},
	{
		suffix: "eisenbahn.museum",
		reversed: "muesum.nhabnesie"
	},
	{
		suffix: "ekloges.cy",
		reversed: "yc.segolke"
	},
	{
		suffix: "elasticbeanstalk.com",
		reversed: "moc.klatsnaebcitsale"
	},
	{
		suffix: "elblag.pl",
		reversed: "lp.galble"
	},
	{
		suffix: "elburg.museum",
		reversed: "muesum.gruble"
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
		suffix: "elk.pl",
		reversed: "lp.kle"
	},
	{
		suffix: "elvendrell.museum",
		reversed: "muesum.llerdnevle"
	},
	{
		suffix: "elverum.no",
		reversed: "on.murevle"
	},
	{
		suffix: "email",
		reversed: "liame"
	},
	{
		suffix: "emb.kw",
		reversed: "wk.bme"
	},
	{
		suffix: "embaixada.st",
		reversed: "ts.adaxiabme"
	},
	{
		suffix: "embetsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustebme"
	},
	{
		suffix: "embroidery.museum",
		reversed: "muesum.yrediorbme"
	},
	{
		suffix: "emerck",
		reversed: "kcreme"
	},
	{
		suffix: "emergency.aero",
		reversed: "orea.ycnegreme"
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
		suffix: "emp.br",
		reversed: "rb.pme"
	},
	{
		suffix: "empresa.bo",
		reversed: "ob.aserpme"
	},
	{
		suffix: "emr.it",
		reversed: "ti.rme"
	},
	{
		suffix: "en-root.fr",
		reversed: "rf.toor-ne"
	},
	{
		suffix: "en.it",
		reversed: "ti.ne"
	},
	{
		suffix: "ena.gifu.jp",
		reversed: "pj.ufig.ane"
	},
	{
		suffix: "encoreapi.com",
		reversed: "moc.ipaerocne"
	},
	{
		suffix: "encr.app",
		reversed: "ppa.rcne"
	},
	{
		suffix: "encyclopedic.museum",
		reversed: "muesum.cidepolcycne"
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
		suffix: "enebakk.no",
		reversed: "on.kkabene"
	},
	{
		suffix: "energy",
		reversed: "ygrene"
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
		suffix: "eng.pro",
		reversed: "orp.gne"
	},
	{
		suffix: "engerdal.no",
		reversed: "on.ladregne"
	},
	{
		suffix: "engine.aero",
		reversed: "orea.enigne"
	},
	{
		suffix: "engineer",
		reversed: "reenigne"
	},
	{
		suffix: "engineer.aero",
		reversed: "orea.reenigne"
	},
	{
		suffix: "engineering",
		reversed: "gnireenigne"
	},
	{
		suffix: "england.museum",
		reversed: "muesum.dnalgne"
	},
	{
		suffix: "eniwa.hokkaido.jp",
		reversed: "pj.odiakkoh.awine"
	},
	{
		suffix: "enna.it",
		reversed: "ti.anne"
	},
	{
		suffix: "ens.tn",
		reversed: "nt.sne"
	},
	{
		suffix: "enscaled.sg",
		reversed: "gs.delacsne"
	},
	{
		suffix: "ent.platform.sh",
		reversed: "hs.mroftalp.tne"
	},
	{
		suffix: "enterprisecloud.nu",
		reversed: "un.duolcesirpretne"
	},
	{
		suffix: "enterprises",
		reversed: "sesirpretne"
	},
	{
		suffix: "entertainment.aero",
		reversed: "orea.tnemniatretne"
	},
	{
		suffix: "entomology.museum",
		reversed: "muesum.ygolomotne"
	},
	{
		suffix: "environment.museum",
		reversed: "muesum.tnemnorivne"
	},
	{
		suffix: "environmentalconservation.museum",
		reversed: "muesum.noitavresnoclatnemnorivne"
	},
	{
		suffix: "epilepsy.museum",
		reversed: "muesum.yspelipe"
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
		suffix: "equipment.aero",
		reversed: "orea.tnempiuqe"
	},
	{
		suffix: "er.in",
		reversed: "ni.re"
	},
	{
		suffix: "ericsson",
		reversed: "nosscire"
	},
	{
		suffix: "erimo.hokkaido.jp",
		reversed: "pj.odiakkoh.omire"
	},
	{
		suffix: "erni",
		reversed: "inre"
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
		suffix: "es",
		reversed: "se"
	},
	{
		suffix: "es-1.axarnet.cloud",
		reversed: "duolc.tenraxa.1-se"
	},
	{
		suffix: "es.ax",
		reversed: "xa.se"
	},
	{
		suffix: "es.eu.org",
		reversed: "gro.ue.se"
	},
	{
		suffix: "es.gov.br",
		reversed: "rb.vog.se"
	},
	{
		suffix: "es.kr",
		reversed: "rk.se"
	},
	{
		suffix: "es.leg.br",
		reversed: "rb.gel.se"
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
		suffix: "esp.br",
		reversed: "rb.pse"
	},
	{
		suffix: "esq",
		reversed: "qse"
	},
	{
		suffix: "essex.museum",
		reversed: "muesum.xesse"
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
		suffix: "est.pr",
		reversed: "rp.tse"
	},
	{
		suffix: "estate",
		reversed: "etatse"
	},
	{
		suffix: "estate.museum",
		reversed: "muesum.etatse"
	},
	{
		suffix: "et",
		reversed: "te"
	},
	{
		suffix: "etajima.hiroshima.jp",
		reversed: "pj.amihsorih.amijate"
	},
	{
		suffix: "etc.br",
		reversed: "rb.cte"
	},
	{
		suffix: "ethnology.museum",
		reversed: "muesum.ygolonhte"
	},
	{
		suffix: "eti.br",
		reversed: "rb.ite"
	},
	{
		suffix: "etisalat",
		reversed: "talasite"
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
		suffix: "eu",
		reversed: "ue"
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
		suffix: "eu.ax",
		reversed: "xa.ue"
	},
	{
		suffix: "eu.com",
		reversed: "moc.ue"
	},
	{
		suffix: "eu.encoway.cloud",
		reversed: "duolc.yawocne.ue"
	},
	{
		suffix: "eu.int",
		reversed: "tni.ue"
	},
	{
		suffix: "eu.meteorapp.com",
		reversed: "moc.pparoetem.ue"
	},
	{
		suffix: "eu.org",
		reversed: "gro.ue"
	},
	{
		suffix: "eu.platform.sh",
		reversed: "hs.mroftalp.ue"
	},
	{
		suffix: "eu.pythonanywhere.com",
		reversed: "moc.erehwynanohtyp.ue"
	},
	{
		suffix: "eun.eg",
		reversed: "ge.nue"
	},
	{
		suffix: "eurodir.ru",
		reversed: "ur.ridorue"
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
		suffix: "evenassi.no",
		reversed: "on.issaneve"
	},
	{
		suffix: "evenes.no",
		reversed: "on.seneve"
	},
	{
		suffix: "events",
		reversed: "stneve"
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
		suffix: "exchange",
		reversed: "egnahcxe"
	},
	{
		suffix: "exchange.aero",
		reversed: "orea.egnahcxe"
	},
	{
		suffix: "exeter.museum",
		reversed: "muesum.retexe"
	},
	{
		suffix: "exhibition.museum",
		reversed: "muesum.noitibihxe"
	},
	{
		suffix: "exnet.su",
		reversed: "us.tenxe"
	},
	{
		suffix: "expert",
		reversed: "trepxe"
	},
	{
		suffix: "experts-comptables.fr",
		reversed: "rf.selbatpmoc-strepxe"
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
		suffix: "express.aero",
		reversed: "orea.sserpxe"
	},
	{
		suffix: "extraspace",
		reversed: "ecapsartxe"
	},
	{
		suffix: "ezproxy.kuleuven.be",
		reversed: "eb.nevueluk.yxorpze"
	},
	{
		suffix: "f.bg",
		reversed: "gb.f"
	},
	{
		suffix: "f.se",
		reversed: "es.f"
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
		suffix: "fakefur.jp",
		reversed: "pj.rufekaf"
	},
	{
		suffix: "fam.pk",
		reversed: "kp.maf"
	},
	{
		suffix: "family",
		reversed: "ylimaf"
	},
	{
		suffix: "family.museum",
		reversed: "muesum.ylimaf"
	},
	{
		suffix: "familyds.com",
		reversed: "moc.sdylimaf"
	},
	{
		suffix: "familyds.net",
		reversed: "ten.sdylimaf"
	},
	{
		suffix: "familyds.org",
		reversed: "gro.sdylimaf"
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
		suffix: "fantasyleague.cc",
		reversed: "cc.eugaelysatnaf"
	},
	{
		suffix: "far.br",
		reversed: "rb.raf"
	},
	{
		suffix: "farm",
		reversed: "mraf"
	},
	{
		suffix: "farm.museum",
		reversed: "muesum.mraf"
	},
	{
		suffix: "farmequipment.museum",
		reversed: "muesum.tnempiuqemraf"
	},
	{
		suffix: "farmers",
		reversed: "sremraf"
	},
	{
		suffix: "farmers.museum",
		reversed: "muesum.sremraf"
	},
	{
		suffix: "farmstead.museum",
		reversed: "muesum.daetsmraf"
	},
	{
		suffix: "farsund.no",
		reversed: "on.dnusraf"
	},
	{
		suffix: "fashion",
		reversed: "noihsaf"
	},
	{
		suffix: "fashionstore.jp",
		reversed: "pj.erotsnoihsaf"
	},
	{
		suffix: "fast",
		reversed: "tsaf"
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
		suffix: "faststacks.net",
		reversed: "ten.skcatstsaf"
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
		suffix: "fastvps.site",
		reversed: "etis.spvtsaf"
	},
	{
		suffix: "fauske.no",
		reversed: "on.eksuaf"
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
		suffix: "fc.it",
		reversed: "ti.cf"
	},
	{
		suffix: "fe.it",
		reversed: "ti.ef"
	},
	{
		suffix: "fed.us",
		reversed: "su.def"
	},
	{
		suffix: "federation.aero",
		reversed: "orea.noitaredef"
	},
	{
		suffix: "fedex",
		reversed: "xedef"
	},
	{
		suffix: "fedje.no",
		reversed: "on.ejdef"
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
		suffix: "feedback",
		reversed: "kcabdeef"
	},
	{
		suffix: "feira.br",
		reversed: "rb.arief"
	},
	{
		suffix: "fem.jp",
		reversed: "pj.mef"
	},
	{
		suffix: "fentiger.mythic-beasts.com",
		reversed: "moc.stsaeb-cihtym.regitnef"
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
		suffix: "ferrari",
		reversed: "irarref"
	},
	{
		suffix: "ferrero",
		reversed: "orerref"
	},
	{
		suffix: "feste-ip.net",
		reversed: "ten.pi-etsef"
	},
	{
		suffix: "fet.no",
		reversed: "on.tef"
	},
	{
		suffix: "fetsund.no",
		reversed: "on.dnustef"
	},
	{
		suffix: "fg.it",
		reversed: "ti.gf"
	},
	{
		suffix: "fh-muenster.io",
		reversed: "oi.retsneum-hf"
	},
	{
		suffix: "fh.se",
		reversed: "es.hf"
	},
	{
		suffix: "fhs.no",
		reversed: "on.shf"
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
		suffix: "fi",
		reversed: "if"
	},
	{
		suffix: "fi.cloudplatform.fi",
		reversed: "if.mroftalpduolc.if"
	},
	{
		suffix: "fi.cr",
		reversed: "rc.if"
	},
	{
		suffix: "fi.eu.org",
		reversed: "gro.ue.if"
	},
	{
		suffix: "fi.it",
		reversed: "ti.if"
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
		suffix: "fie.ee",
		reversed: "ee.eif"
	},
	{
		suffix: "field.museum",
		reversed: "muesum.dleif"
	},
	{
		suffix: "figueres.museum",
		reversed: "muesum.sereugif"
	},
	{
		suffix: "filatelia.museum",
		reversed: "muesum.ailetalif"
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
		suffix: "filegear.me",
		reversed: "em.raegelif"
	},
	{
		suffix: "film",
		reversed: "mlif"
	},
	{
		suffix: "film.hu",
		reversed: "uh.mlif"
	},
	{
		suffix: "film.museum",
		reversed: "muesum.mlif"
	},
	{
		suffix: "fin.ci",
		reversed: "ic.nif"
	},
	{
		suffix: "fin.ec",
		reversed: "ce.nif"
	},
	{
		suffix: "fin.tn",
		reversed: "nt.nif"
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
		suffix: "fineart.museum",
		reversed: "muesum.traenif"
	},
	{
		suffix: "finearts.museum",
		reversed: "muesum.straenif"
	},
	{
		suffix: "finland.museum",
		reversed: "muesum.dnalnif"
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
		suffix: "fire",
		reversed: "erif"
	},
	{
		suffix: "firebaseapp.com",
		reversed: "moc.ppaesaberif"
	},
	{
		suffix: "firenze.it",
		reversed: "ti.eznerif"
	},
	{
		suffix: "firestone",
		reversed: "enotserif"
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
		suffix: "firewall-gateway.net",
		reversed: "ten.yawetag-llawerif"
	},
	{
		suffix: "firewalledreplit.co",
		reversed: "oc.tilperdellawerif"
	},
	{
		suffix: "fireweb.app",
		reversed: "ppa.bewerif"
	},
	{
		suffix: "firm.co",
		reversed: "oc.mrif"
	},
	{
		suffix: "firm.dk",
		reversed: "kd.mrif"
	},
	{
		suffix: "firm.ht",
		reversed: "th.mrif"
	},
	{
		suffix: "firm.in",
		reversed: "ni.mrif"
	},
	{
		suffix: "firm.nf",
		reversed: "fn.mrif"
	},
	{
		suffix: "firm.ng",
		reversed: "gn.mrif"
	},
	{
		suffix: "firm.ro",
		reversed: "or.mrif"
	},
	{
		suffix: "firm.ve",
		reversed: "ev.mrif"
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
		suffix: "fitjar.no",
		reversed: "on.rajtif"
	},
	{
		suffix: "fitness",
		reversed: "ssentif"
	},
	{
		suffix: "fj",
		reversed: "jf"
	},
	{
		suffix: "fj.cn",
		reversed: "nc.jf"
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
		suffix: "fl.us",
		reversed: "su.lf"
	},
	{
		suffix: "fla.no",
		reversed: "on.alf"
	},
	{
		suffix: "flakstad.no",
		reversed: "on.datskalf"
	},
	{
		suffix: "flanders.museum",
		reversed: "muesum.srednalf"
	},
	{
		suffix: "flap.id",
		reversed: "di.palf"
	},
	{
		suffix: "flatanger.no",
		reversed: "on.regnatalf"
	},
	{
		suffix: "fldrv.com",
		reversed: "moc.vrdlf"
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
		suffix: "flickr",
		reversed: "rkcilf"
	},
	{
		suffix: "flier.jp",
		reversed: "pj.reilf"
	},
	{
		suffix: "flight.aero",
		reversed: "orea.thgilf"
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
		suffix: "flog.br",
		reversed: "rb.golf"
	},
	{
		suffix: "floppy.jp",
		reversed: "pj.yppolf"
	},
	{
		suffix: "flora.no",
		reversed: "on.arolf"
	},
	{
		suffix: "florence.it",
		reversed: "ti.ecnerolf"
	},
	{
		suffix: "florida.museum",
		reversed: "muesum.adirolf"
	},
	{
		suffix: "floripa.br",
		reversed: "rb.apirolf"
	},
	{
		suffix: "florist",
		reversed: "tsirolf"
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
		suffix: "flowers",
		reversed: "srewolf"
	},
	{
		suffix: "flt.cloud.muni.cz",
		reversed: "zc.inum.duolc.tlf"
	},
	{
		suffix: "fly",
		reversed: "ylf"
	},
	{
		suffix: "fly.dev",
		reversed: "ved.ylf"
	},
	{
		suffix: "flynnhosting.net",
		reversed: "ten.gnitsohnnylf"
	},
	{
		suffix: "flå.no",
		reversed: "on.aiz-lf--nx"
	},
	{
		suffix: "fm",
		reversed: "mf"
	},
	{
		suffix: "fm.br",
		reversed: "rb.mf"
	},
	{
		suffix: "fm.it",
		reversed: "ti.mf"
	},
	{
		suffix: "fm.no",
		reversed: "on.mf"
	},
	{
		suffix: "fnc.fr-par.scw.cloud",
		reversed: "duolc.wcs.rap-rf.cnf"
	},
	{
		suffix: "fnd.br",
		reversed: "rb.dnf"
	},
	{
		suffix: "fnwk.site",
		reversed: "etis.kwnf"
	},
	{
		suffix: "fo",
		reversed: "of"
	},
	{
		suffix: "foggia.it",
		reversed: "ti.aiggof"
	},
	{
		suffix: "folionetwork.site",
		reversed: "etis.krowtenoilof"
	},
	{
		suffix: "folkebibl.no",
		reversed: "on.lbibeklof"
	},
	{
		suffix: "folldal.no",
		reversed: "on.ladllof"
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
		suffix: "fool.jp",
		reversed: "pj.loof"
	},
	{
		suffix: "football",
		reversed: "llabtoof"
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
		suffix: "force.museum",
		reversed: "muesum.ecrof"
	},
	{
		suffix: "ford",
		reversed: "drof"
	},
	{
		suffix: "forde.no",
		reversed: "on.edrof"
	},
	{
		suffix: "forex",
		reversed: "xerof"
	},
	{
		suffix: "forgeblocks.com",
		reversed: "moc.skcolbegrof"
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
		suffix: "forli-cesena.it",
		reversed: "ti.anesec-ilrof"
	},
	{
		suffix: "forlicesena.it",
		reversed: "ti.anesecilrof"
	},
	{
		suffix: "forlì-cesena.it",
		reversed: "ti.bcf-anesec-lrof--nx"
	},
	{
		suffix: "forlìcesena.it",
		reversed: "ti.a8c-aneseclrof--nx"
	},
	{
		suffix: "forsale",
		reversed: "elasrof"
	},
	{
		suffix: "forsand.no",
		reversed: "on.dnasrof"
	},
	{
		suffix: "fortal.br",
		reversed: "rb.latrof"
	},
	{
		suffix: "forte.id",
		reversed: "di.etrof"
	},
	{
		suffix: "fortmissoula.museum",
		reversed: "muesum.aluossimtrof"
	},
	{
		suffix: "fortworth.museum",
		reversed: "muesum.htrowtrof"
	},
	{
		suffix: "forum",
		reversed: "murof"
	},
	{
		suffix: "forum.hu",
		reversed: "uh.murof"
	},
	{
		suffix: "forumz.info",
		reversed: "ofni.zmurof"
	},
	{
		suffix: "fosnes.no",
		reversed: "on.sensof"
	},
	{
		suffix: "fot.br",
		reversed: "rb.tof"
	},
	{
		suffix: "foundation",
		reversed: "noitadnuof"
	},
	{
		suffix: "foundation.museum",
		reversed: "muesum.noitadnuof"
	},
	{
		suffix: "fox",
		reversed: "xof"
	},
	{
		suffix: "foz.br",
		reversed: "rb.zof"
	},
	{
		suffix: "fr",
		reversed: "rf"
	},
	{
		suffix: "fr-1.paas.massivegrid.net",
		reversed: "ten.dirgevissam.saap.1-rf"
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
		suffix: "fr.eu.org",
		reversed: "gro.ue.rf"
	},
	{
		suffix: "fr.it",
		reversed: "ti.rf"
	},
	{
		suffix: "fra1-de.cloudjiffy.net",
		reversed: "ten.yffijduolc.ed-1arf"
	},
	{
		suffix: "framer.app",
		reversed: "ppa.remarf"
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
		suffix: "framercanvas.com",
		reversed: "moc.savnacremarf"
	},
	{
		suffix: "frana.no",
		reversed: "on.anarf"
	},
	{
		suffix: "francaise.museum",
		reversed: "muesum.esiacnarf"
	},
	{
		suffix: "frankfurt.museum",
		reversed: "muesum.trufknarf"
	},
	{
		suffix: "franziskaner.museum",
		reversed: "muesum.renaksiznarf"
	},
	{
		suffix: "fredrikstad.no",
		reversed: "on.datskirderf"
	},
	{
		suffix: "free",
		reversed: "eerf"
	},
	{
		suffix: "free.hr",
		reversed: "rh.eerf"
	},
	{
		suffix: "freebox-os.com",
		reversed: "moc.so-xobeerf"
	},
	{
		suffix: "freebox-os.fr",
		reversed: "rf.so-xobeerf"
	},
	{
		suffix: "freeboxos.com",
		reversed: "moc.soxobeerf"
	},
	{
		suffix: "freeboxos.fr",
		reversed: "rf.soxobeerf"
	},
	{
		suffix: "freeddns.org",
		reversed: "gro.snddeerf"
	},
	{
		suffix: "freeddns.us",
		reversed: "su.snddeerf"
	},
	{
		suffix: "freedesktop.org",
		reversed: "gro.potksedeerf"
	},
	{
		suffix: "freemasonry.museum",
		reversed: "muesum.yrnosameerf"
	},
	{
		suffix: "freemyip.com",
		reversed: "moc.piymeerf"
	},
	{
		suffix: "freesite.host",
		reversed: "tsoh.etiseerf"
	},
	{
		suffix: "freetls.fastly.net",
		reversed: "ten.yltsaf.slteerf"
	},
	{
		suffix: "frei.no",
		reversed: "on.ierf"
	},
	{
		suffix: "freiburg.museum",
		reversed: "muesum.grubierf"
	},
	{
		suffix: "frenchkiss.jp",
		reversed: "pj.ssikhcnerf"
	},
	{
		suffix: "fresenius",
		reversed: "suineserf"
	},
	{
		suffix: "fribourg.museum",
		reversed: "muesum.gruobirf"
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
		suffix: "frl",
		reversed: "lrf"
	},
	{
		suffix: "frog.museum",
		reversed: "muesum.gorf"
	},
	{
		suffix: "frogans",
		reversed: "snagorf"
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
		suffix: "from.hr",
		reversed: "rh.morf"
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
		suffix: "frosinone.it",
		reversed: "ti.enonisorf"
	},
	{
		suffix: "frosta.no",
		reversed: "on.atsorf"
	},
	{
		suffix: "froya.no",
		reversed: "on.ayorf"
	},
	{
		suffix: "fræna.no",
		reversed: "on.aow-anrf--nx"
	},
	{
		suffix: "frøya.no",
		reversed: "on.arh-ayrf--nx"
	},
	{
		suffix: "fst.br",
		reversed: "rb.tsf"
	},
	{
		suffix: "ftpaccess.cc",
		reversed: "cc.sseccaptf"
	},
	{
		suffix: "ftr",
		reversed: "rtf"
	},
	{
		suffix: "fuchu.hiroshima.jp",
		reversed: "pj.amihsorih.uhcuf"
	},
	{
		suffix: "fuchu.tokyo.jp",
		reversed: "pj.oykot.uhcuf"
	},
	{
		suffix: "fuchu.toyama.jp",
		reversed: "pj.amayot.uhcuf"
	},
	{
		suffix: "fudai.iwate.jp",
		reversed: "pj.etawi.iaduf"
	},
	{
		suffix: "fuefuki.yamanashi.jp",
		reversed: "pj.ihsanamay.ikufeuf"
	},
	{
		suffix: "fuel.aero",
		reversed: "orea.leuf"
	},
	{
		suffix: "fuettertdasnetz.de",
		reversed: "ed.ztensadtretteuf"
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
		suffix: "fujiidera.osaka.jp",
		reversed: "pj.akaso.arediijuf"
	},
	{
		suffix: "fujikawa.shizuoka.jp",
		reversed: "pj.akouzihs.awakijuf"
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
		suffix: "fujimi.nagano.jp",
		reversed: "pj.onagan.imijuf"
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
		suffix: "fujinomiya.shizuoka.jp",
		reversed: "pj.akouzihs.ayimonijuf"
	},
	{
		suffix: "fujioka.gunma.jp",
		reversed: "pj.amnug.akoijuf"
	},
	{
		suffix: "fujisato.akita.jp",
		reversed: "pj.atika.otasijuf"
	},
	{
		suffix: "fujisawa.iwate.jp",
		reversed: "pj.etawi.awasijuf"
	},
	{
		suffix: "fujisawa.kanagawa.jp",
		reversed: "pj.awaganak.awasijuf"
	},
	{
		suffix: "fujishiro.ibaraki.jp",
		reversed: "pj.ikarabi.orihsijuf"
	},
	{
		suffix: "fujitsu",
		reversed: "ustijuf"
	},
	{
		suffix: "fujiyoshida.yamanashi.jp",
		reversed: "pj.ihsanamay.adihsoyijuf"
	},
	{
		suffix: "fukagawa.hokkaido.jp",
		reversed: "pj.odiakkoh.awagakuf"
	},
	{
		suffix: "fukaya.saitama.jp",
		reversed: "pj.amatias.ayakuf"
	},
	{
		suffix: "fukuchi.fukuoka.jp",
		reversed: "pj.akoukuf.ihcukuf"
	},
	{
		suffix: "fukuchiyama.kyoto.jp",
		reversed: "pj.otoyk.amayihcukuf"
	},
	{
		suffix: "fukudomi.saga.jp",
		reversed: "pj.agas.imodukuf"
	},
	{
		suffix: "fukui.fukui.jp",
		reversed: "pj.iukuf.iukuf"
	},
	{
		suffix: "fukui.jp",
		reversed: "pj.iukuf"
	},
	{
		suffix: "fukumitsu.toyama.jp",
		reversed: "pj.amayot.ustimukuf"
	},
	{
		suffix: "fukuoka.jp",
		reversed: "pj.akoukuf"
	},
	{
		suffix: "fukuroi.shizuoka.jp",
		reversed: "pj.akouzihs.iorukuf"
	},
	{
		suffix: "fukusaki.hyogo.jp",
		reversed: "pj.ogoyh.ikasukuf"
	},
	{
		suffix: "fukushima.fukushima.jp",
		reversed: "pj.amihsukuf.amihsukuf"
	},
	{
		suffix: "fukushima.hokkaido.jp",
		reversed: "pj.odiakkoh.amihsukuf"
	},
	{
		suffix: "fukushima.jp",
		reversed: "pj.amihsukuf"
	},
	{
		suffix: "fukuyama.hiroshima.jp",
		reversed: "pj.amihsorih.amayukuf"
	},
	{
		suffix: "fun",
		reversed: "nuf"
	},
	{
		suffix: "funabashi.chiba.jp",
		reversed: "pj.abihc.ihsabanuf"
	},
	{
		suffix: "funagata.yamagata.jp",
		reversed: "pj.atagamay.ataganuf"
	},
	{
		suffix: "funahashi.toyama.jp",
		reversed: "pj.amayot.ihsahanuf"
	},
	{
		suffix: "functions.fnc.fr-par.scw.cloud",
		reversed: "duolc.wcs.rap-rf.cnf.snoitcnuf"
	},
	{
		suffix: "fund",
		reversed: "dnuf"
	},
	{
		suffix: "fundacio.museum",
		reversed: "muesum.oicadnuf"
	},
	{
		suffix: "fuoisku.no",
		reversed: "on.uksiouf"
	},
	{
		suffix: "fuossko.no",
		reversed: "on.okssouf"
	},
	{
		suffix: "furano.hokkaido.jp",
		reversed: "pj.odiakkoh.onaruf"
	},
	{
		suffix: "furniture",
		reversed: "erutinruf"
	},
	{
		suffix: "furniture.museum",
		reversed: "muesum.erutinruf"
	},
	{
		suffix: "furubira.hokkaido.jp",
		reversed: "pj.odiakkoh.ariburuf"
	},
	{
		suffix: "furudono.fukushima.jp",
		reversed: "pj.amihsukuf.onoduruf"
	},
	{
		suffix: "furukawa.miyagi.jp",
		reversed: "pj.igayim.awakuruf"
	},
	{
		suffix: "fusa.no",
		reversed: "on.asuf"
	},
	{
		suffix: "fuso.aichi.jp",
		reversed: "pj.ihcia.osuf"
	},
	{
		suffix: "fussa.tokyo.jp",
		reversed: "pj.oykot.assuf"
	},
	{
		suffix: "futaba.fukushima.jp",
		reversed: "pj.amihsukuf.abatuf"
	},
	{
		suffix: "futbol",
		reversed: "lobtuf"
	},
	{
		suffix: "futsu.nagasaki.jp",
		reversed: "pj.ikasagan.ustuf"
	},
	{
		suffix: "futtsu.chiba.jp",
		reversed: "pj.abihc.usttuf"
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
		suffix: "fvg.it",
		reversed: "ti.gvf"
	},
	{
		suffix: "fyi",
		reversed: "iyf"
	},
	{
		suffix: "fylkesbibl.no",
		reversed: "on.lbibseklyf"
	},
	{
		suffix: "fyresdal.no",
		reversed: "on.ladseryf"
	},
	{
		suffix: "førde.no",
		reversed: "on.arg-edrf--nx"
	},
	{
		suffix: "g.bg",
		reversed: "gb.g"
	},
	{
		suffix: "g.se",
		reversed: "es.g"
	},
	{
		suffix: "g.vbrplsbx.io",
		reversed: "oi.xbslprbv.g"
	},
	{
		suffix: "g12.br",
		reversed: "rb.21g"
	},
	{
		suffix: "ga",
		reversed: "ag"
	},
	{
		suffix: "ga.us",
		reversed: "su.ag"
	},
	{
		suffix: "gaivuotna.no",
		reversed: "on.antouviag"
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
		suffix: "gallery.museum",
		reversed: "muesum.yrellag"
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
		suffix: "galsa.no",
		reversed: "on.aslag"
	},
	{
		suffix: "gamagori.aichi.jp",
		reversed: "pj.ihcia.irogamag"
	},
	{
		suffix: "game",
		reversed: "emag"
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
		suffix: "game.tw",
		reversed: "wt.emag"
	},
	{
		suffix: "games",
		reversed: "semag"
	},
	{
		suffix: "games.hu",
		reversed: "uh.semag"
	},
	{
		suffix: "gamo.shiga.jp",
		reversed: "pj.agihs.omag"
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
		suffix: "gangwon.kr",
		reversed: "rk.nowgnag"
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
		suffix: "garden.museum",
		reversed: "muesum.nedrag"
	},
	{
		suffix: "gateway.museum",
		reversed: "muesum.yawetag"
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
		suffix: "gay",
		reversed: "yag"
	},
	{
		suffix: "gb",
		reversed: "bg"
	},
	{
		suffix: "gb.net",
		reversed: "ten.bg"
	},
	{
		suffix: "gbiz",
		reversed: "zibg"
	},
	{
		suffix: "gc.ca",
		reversed: "ac.cg"
	},
	{
		suffix: "gd",
		reversed: "dg"
	},
	{
		suffix: "gd.cn",
		reversed: "nc.dg"
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
		suffix: "gdn",
		reversed: "ndg"
	},
	{
		suffix: "gdynia.pl",
		reversed: "lp.ainydg"
	},
	{
		suffix: "ge",
		reversed: "eg"
	},
	{
		suffix: "ge.it",
		reversed: "ti.eg"
	},
	{
		suffix: "gea",
		reversed: "aeg"
	},
	{
		suffix: "geek.nz",
		reversed: "zn.keeg"
	},
	{
		suffix: "geekgalaxy.com",
		reversed: "moc.yxalagkeeg"
	},
	{
		suffix: "geelvinck.museum",
		reversed: "muesum.kcnivleeg"
	},
	{
		suffix: "gehirn.ne.jp",
		reversed: "pj.en.nriheg"
	},
	{
		suffix: "geisei.kochi.jp",
		reversed: "pj.ihcok.iesieg"
	},
	{
		suffix: "gemological.museum",
		reversed: "muesum.lacigolomeg"
	},
	{
		suffix: "gen.in",
		reversed: "ni.neg"
	},
	{
		suffix: "gen.mi.us",
		reversed: "su.im.neg"
	},
	{
		suffix: "gen.ng",
		reversed: "gn.neg"
	},
	{
		suffix: "gen.nz",
		reversed: "zn.neg"
	},
	{
		suffix: "gen.tr",
		reversed: "rt.neg"
	},
	{
		suffix: "genkai.saga.jp",
		reversed: "pj.agas.iakneg"
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
		suffix: "gent",
		reversed: "tneg"
	},
	{
		suffix: "gentapps.com",
		reversed: "moc.sppatneg"
	},
	{
		suffix: "genting",
		reversed: "gnitneg"
	},
	{
		suffix: "gentlentapis.com",
		reversed: "moc.sipatneltneg"
	},
	{
		suffix: "geo.br",
		reversed: "rb.oeg"
	},
	{
		suffix: "geology.museum",
		reversed: "muesum.ygoloeg"
	},
	{
		suffix: "geometre-expert.fr",
		reversed: "rf.trepxe-ertemoeg"
	},
	{
		suffix: "george",
		reversed: "egroeg"
	},
	{
		suffix: "georgia.museum",
		reversed: "muesum.aigroeg"
	},
	{
		suffix: "georgia.su",
		reversed: "us.aigroeg"
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
		suffix: "gf",
		reversed: "fg"
	},
	{
		suffix: "gg",
		reversed: "gg"
	},
	{
		suffix: "gg.ax",
		reversed: "xa.gg"
	},
	{
		suffix: "ggee",
		reversed: "eegg"
	},
	{
		suffix: "ggf.br",
		reversed: "rb.fgg"
	},
	{
		suffix: "gh",
		reversed: "hg"
	},
	{
		suffix: "ghost.io",
		reversed: "oi.tsohg"
	},
	{
		suffix: "gi",
		reversed: "ig"
	},
	{
		suffix: "giehtavuoatna.no",
		reversed: "on.antaouvatheig"
	},
	{
		suffix: "giessen.museum",
		reversed: "muesum.nesseig"
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
		suffix: "gifu.gifu.jp",
		reversed: "pj.ufig.ufig"
	},
	{
		suffix: "gifu.jp",
		reversed: "pj.ufig"
	},
	{
		suffix: "giize.com",
		reversed: "moc.eziig"
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
		suffix: "ginan.gifu.jp",
		reversed: "pj.ufig.nanig"
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
		suffix: "girlfriend.jp",
		reversed: "pj.dneirflrig"
	},
	{
		suffix: "girly.jp",
		reversed: "pj.ylrig"
	},
	{
		suffix: "giske.no",
		reversed: "on.eksig"
	},
	{
		suffix: "git-pages.rit.edu",
		reversed: "ude.tir.segap-tig"
	},
	{
		suffix: "git-repos.de",
		reversed: "ed.soper-tig"
	},
	{
		suffix: "gitapp.si",
		reversed: "is.ppatig"
	},
	{
		suffix: "github.io",
		reversed: "oi.buhtig"
	},
	{
		suffix: "githubpreview.dev",
		reversed: "ved.weiverpbuhtig"
	},
	{
		suffix: "githubusercontent.com",
		reversed: "moc.tnetnocresubuhtig"
	},
	{
		suffix: "gitlab.io",
		reversed: "oi.baltig"
	},
	{
		suffix: "gitpage.si",
		reversed: "is.egaptig"
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
		suffix: "gl",
		reversed: "lg"
	},
	{
		suffix: "glas.museum",
		reversed: "muesum.salg"
	},
	{
		suffix: "glass",
		reversed: "ssalg"
	},
	{
		suffix: "glass.museum",
		reversed: "muesum.ssalg"
	},
	{
		suffix: "gle",
		reversed: "elg"
	},
	{
		suffix: "gleeze.com",
		reversed: "moc.ezeelg"
	},
	{
		suffix: "gliding.aero",
		reversed: "orea.gnidilg"
	},
	{
		suffix: "glitch.me",
		reversed: "em.hctilg"
	},
	{
		suffix: "gliwice.pl",
		reversed: "lp.eciwilg"
	},
	{
		suffix: "global",
		reversed: "labolg"
	},
	{
		suffix: "global.prod.fastly.net",
		reversed: "ten.yltsaf.dorp.labolg"
	},
	{
		suffix: "global.ssl.fastly.net",
		reversed: "ten.yltsaf.lss.labolg"
	},
	{
		suffix: "globo",
		reversed: "obolg"
	},
	{
		suffix: "glogow.pl",
		reversed: "lp.wogolg"
	},
	{
		suffix: "gloomy.jp",
		reversed: "pj.ymoolg"
	},
	{
		suffix: "gloppen.no",
		reversed: "on.neppolg"
	},
	{
		suffix: "glug.org.uk",
		reversed: "ku.gro.gulg"
	},
	{
		suffix: "gm",
		reversed: "mg"
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
		suffix: "gmina.pl",
		reversed: "lp.animg"
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
		suffix: "gn",
		reversed: "ng"
	},
	{
		suffix: "gniezno.pl",
		reversed: "lp.onzeing"
	},
	{
		suffix: "go.ci",
		reversed: "ic.og"
	},
	{
		suffix: "go.cr",
		reversed: "rc.og"
	},
	{
		suffix: "go.dyndns.org",
		reversed: "gro.sndnyd.og"
	},
	{
		suffix: "go.gov.br",
		reversed: "rb.vog.og"
	},
	{
		suffix: "go.id",
		reversed: "di.og"
	},
	{
		suffix: "go.it",
		reversed: "ti.og"
	},
	{
		suffix: "go.jp",
		reversed: "pj.og"
	},
	{
		suffix: "go.ke",
		reversed: "ek.og"
	},
	{
		suffix: "go.kr",
		reversed: "rk.og"
	},
	{
		suffix: "go.leg.br",
		reversed: "rb.gel.og"
	},
	{
		suffix: "go.pw",
		reversed: "wp.og"
	},
	{
		suffix: "go.th",
		reversed: "ht.og"
	},
	{
		suffix: "go.tj",
		reversed: "jt.og"
	},
	{
		suffix: "go.tz",
		reversed: "zt.og"
	},
	{
		suffix: "go.ug",
		reversed: "gu.og"
	},
	{
		suffix: "gob.ar",
		reversed: "ra.bog"
	},
	{
		suffix: "gob.bo",
		reversed: "ob.bog"
	},
	{
		suffix: "gob.cl",
		reversed: "lc.bog"
	},
	{
		suffix: "gob.do",
		reversed: "od.bog"
	},
	{
		suffix: "gob.ec",
		reversed: "ce.bog"
	},
	{
		suffix: "gob.es",
		reversed: "se.bog"
	},
	{
		suffix: "gob.gt",
		reversed: "tg.bog"
	},
	{
		suffix: "gob.hn",
		reversed: "nh.bog"
	},
	{
		suffix: "gob.mx",
		reversed: "xm.bog"
	},
	{
		suffix: "gob.ni",
		reversed: "in.bog"
	},
	{
		suffix: "gob.pa",
		reversed: "ap.bog"
	},
	{
		suffix: "gob.pe",
		reversed: "ep.bog"
	},
	{
		suffix: "gob.pk",
		reversed: "kp.bog"
	},
	{
		suffix: "gob.sv",
		reversed: "vs.bog"
	},
	{
		suffix: "gob.ve",
		reversed: "ev.bog"
	},
	{
		suffix: "gobo.wakayama.jp",
		reversed: "pj.amayakaw.obog"
	},
	{
		suffix: "godaddy",
		reversed: "yddadog"
	},
	{
		suffix: "godo.gifu.jp",
		reversed: "pj.ufig.odog"
	},
	{
		suffix: "goiania.br",
		reversed: "rb.ainaiog"
	},
	{
		suffix: "goip.de",
		reversed: "ed.piog"
	},
	{
		suffix: "gojome.akita.jp",
		reversed: "pj.atika.emojog"
	},
	{
		suffix: "gok.pk",
		reversed: "kp.kog"
	},
	{
		suffix: "gokase.miyazaki.jp",
		reversed: "pj.ikazayim.esakog"
	},
	{
		suffix: "gol.no",
		reversed: "on.log"
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
		suffix: "golffan.us",
		reversed: "su.nafflog"
	},
	{
		suffix: "gon.pk",
		reversed: "kp.nog"
	},
	{
		suffix: "gonna.jp",
		reversed: "pj.annog"
	},
	{
		suffix: "gonohe.aomori.jp",
		reversed: "pj.iromoa.ehonog"
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
		suffix: "googleapis.com",
		reversed: "moc.sipaelgoog"
	},
	{
		suffix: "googlecode.com",
		reversed: "moc.edocelgoog"
	},
	{
		suffix: "gop",
		reversed: "pog"
	},
	{
		suffix: "gop.pk",
		reversed: "kp.pog"
	},
	{
		suffix: "gorge.museum",
		reversed: "muesum.egrog"
	},
	{
		suffix: "gorizia.it",
		reversed: "ti.aizirog"
	},
	{
		suffix: "gorlice.pl",
		reversed: "lp.ecilrog"
	},
	{
		suffix: "gos.pk",
		reversed: "kp.sog"
	},
	{
		suffix: "gose.nara.jp",
		reversed: "pj.aran.esog"
	},
	{
		suffix: "gosen.niigata.jp",
		reversed: "pj.atagiin.nesog"
	},
	{
		suffix: "goshiki.hyogo.jp",
		reversed: "pj.ogoyh.ikihsog"
	},
	{
		suffix: "got",
		reversed: "tog"
	},
	{
		suffix: "gotdns.ch",
		reversed: "hc.sndtog"
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
		suffix: "gotemba.shizuoka.jp",
		reversed: "pj.akouzihs.abmetog"
	},
	{
		suffix: "goto.nagasaki.jp",
		reversed: "pj.ikasagan.otog"
	},
	{
		suffix: "gotpantheon.com",
		reversed: "moc.noehtnaptog"
	},
	{
		suffix: "gotsu.shimane.jp",
		reversed: "pj.enamihs.ustog"
	},
	{
		suffix: "goupile.fr",
		reversed: "rf.elipuog"
	},
	{
		suffix: "gouv.bj",
		reversed: "jb.vuog"
	},
	{
		suffix: "gouv.ci",
		reversed: "ic.vuog"
	},
	{
		suffix: "gouv.fr",
		reversed: "rf.vuog"
	},
	{
		suffix: "gouv.ht",
		reversed: "th.vuog"
	},
	{
		suffix: "gouv.km",
		reversed: "mk.vuog"
	},
	{
		suffix: "gouv.ml",
		reversed: "lm.vuog"
	},
	{
		suffix: "gouv.sn",
		reversed: "ns.vuog"
	},
	{
		suffix: "gov",
		reversed: "vog"
	},
	{
		suffix: "gov.ac",
		reversed: "ca.vog"
	},
	{
		suffix: "gov.ae",
		reversed: "ea.vog"
	},
	{
		suffix: "gov.af",
		reversed: "fa.vog"
	},
	{
		suffix: "gov.al",
		reversed: "la.vog"
	},
	{
		suffix: "gov.ar",
		reversed: "ra.vog"
	},
	{
		suffix: "gov.as",
		reversed: "sa.vog"
	},
	{
		suffix: "gov.au",
		reversed: "ua.vog"
	},
	{
		suffix: "gov.az",
		reversed: "za.vog"
	},
	{
		suffix: "gov.ba",
		reversed: "ab.vog"
	},
	{
		suffix: "gov.bb",
		reversed: "bb.vog"
	},
	{
		suffix: "gov.bf",
		reversed: "fb.vog"
	},
	{
		suffix: "gov.bh",
		reversed: "hb.vog"
	},
	{
		suffix: "gov.bm",
		reversed: "mb.vog"
	},
	{
		suffix: "gov.bn",
		reversed: "nb.vog"
	},
	{
		suffix: "gov.br",
		reversed: "rb.vog"
	},
	{
		suffix: "gov.bs",
		reversed: "sb.vog"
	},
	{
		suffix: "gov.bt",
		reversed: "tb.vog"
	},
	{
		suffix: "gov.by",
		reversed: "yb.vog"
	},
	{
		suffix: "gov.bz",
		reversed: "zb.vog"
	},
	{
		suffix: "gov.cd",
		reversed: "dc.vog"
	},
	{
		suffix: "gov.cl",
		reversed: "lc.vog"
	},
	{
		suffix: "gov.cm",
		reversed: "mc.vog"
	},
	{
		suffix: "gov.cn",
		reversed: "nc.vog"
	},
	{
		suffix: "gov.co",
		reversed: "oc.vog"
	},
	{
		suffix: "gov.cu",
		reversed: "uc.vog"
	},
	{
		suffix: "gov.cx",
		reversed: "xc.vog"
	},
	{
		suffix: "gov.cy",
		reversed: "yc.vog"
	},
	{
		suffix: "gov.dm",
		reversed: "md.vog"
	},
	{
		suffix: "gov.do",
		reversed: "od.vog"
	},
	{
		suffix: "gov.dz",
		reversed: "zd.vog"
	},
	{
		suffix: "gov.ec",
		reversed: "ce.vog"
	},
	{
		suffix: "gov.ee",
		reversed: "ee.vog"
	},
	{
		suffix: "gov.eg",
		reversed: "ge.vog"
	},
	{
		suffix: "gov.et",
		reversed: "te.vog"
	},
	{
		suffix: "gov.fj",
		reversed: "jf.vog"
	},
	{
		suffix: "gov.gd",
		reversed: "dg.vog"
	},
	{
		suffix: "gov.ge",
		reversed: "eg.vog"
	},
	{
		suffix: "gov.gh",
		reversed: "hg.vog"
	},
	{
		suffix: "gov.gi",
		reversed: "ig.vog"
	},
	{
		suffix: "gov.gn",
		reversed: "ng.vog"
	},
	{
		suffix: "gov.gr",
		reversed: "rg.vog"
	},
	{
		suffix: "gov.gu",
		reversed: "ug.vog"
	},
	{
		suffix: "gov.gy",
		reversed: "yg.vog"
	},
	{
		suffix: "gov.hk",
		reversed: "kh.vog"
	},
	{
		suffix: "gov.ie",
		reversed: "ei.vog"
	},
	{
		suffix: "gov.il",
		reversed: "li.vog"
	},
	{
		suffix: "gov.in",
		reversed: "ni.vog"
	},
	{
		suffix: "gov.iq",
		reversed: "qi.vog"
	},
	{
		suffix: "gov.ir",
		reversed: "ri.vog"
	},
	{
		suffix: "gov.is",
		reversed: "si.vog"
	},
	{
		suffix: "gov.it",
		reversed: "ti.vog"
	},
	{
		suffix: "gov.jo",
		reversed: "oj.vog"
	},
	{
		suffix: "gov.kg",
		reversed: "gk.vog"
	},
	{
		suffix: "gov.ki",
		reversed: "ik.vog"
	},
	{
		suffix: "gov.km",
		reversed: "mk.vog"
	},
	{
		suffix: "gov.kn",
		reversed: "nk.vog"
	},
	{
		suffix: "gov.kp",
		reversed: "pk.vog"
	},
	{
		suffix: "gov.kw",
		reversed: "wk.vog"
	},
	{
		suffix: "gov.kz",
		reversed: "zk.vog"
	},
	{
		suffix: "gov.la",
		reversed: "al.vog"
	},
	{
		suffix: "gov.lb",
		reversed: "bl.vog"
	},
	{
		suffix: "gov.lc",
		reversed: "cl.vog"
	},
	{
		suffix: "gov.lk",
		reversed: "kl.vog"
	},
	{
		suffix: "gov.lr",
		reversed: "rl.vog"
	},
	{
		suffix: "gov.ls",
		reversed: "sl.vog"
	},
	{
		suffix: "gov.lt",
		reversed: "tl.vog"
	},
	{
		suffix: "gov.lv",
		reversed: "vl.vog"
	},
	{
		suffix: "gov.ly",
		reversed: "yl.vog"
	},
	{
		suffix: "gov.ma",
		reversed: "am.vog"
	},
	{
		suffix: "gov.me",
		reversed: "em.vog"
	},
	{
		suffix: "gov.mg",
		reversed: "gm.vog"
	},
	{
		suffix: "gov.mk",
		reversed: "km.vog"
	},
	{
		suffix: "gov.ml",
		reversed: "lm.vog"
	},
	{
		suffix: "gov.mn",
		reversed: "nm.vog"
	},
	{
		suffix: "gov.mo",
		reversed: "om.vog"
	},
	{
		suffix: "gov.mr",
		reversed: "rm.vog"
	},
	{
		suffix: "gov.ms",
		reversed: "sm.vog"
	},
	{
		suffix: "gov.mu",
		reversed: "um.vog"
	},
	{
		suffix: "gov.mv",
		reversed: "vm.vog"
	},
	{
		suffix: "gov.mw",
		reversed: "wm.vog"
	},
	{
		suffix: "gov.my",
		reversed: "ym.vog"
	},
	{
		suffix: "gov.mz",
		reversed: "zm.vog"
	},
	{
		suffix: "gov.nc.tr",
		reversed: "rt.cn.vog"
	},
	{
		suffix: "gov.ng",
		reversed: "gn.vog"
	},
	{
		suffix: "gov.nl",
		reversed: "ln.vog"
	},
	{
		suffix: "gov.nr",
		reversed: "rn.vog"
	},
	{
		suffix: "gov.om",
		reversed: "mo.vog"
	},
	{
		suffix: "gov.ph",
		reversed: "hp.vog"
	},
	{
		suffix: "gov.pk",
		reversed: "kp.vog"
	},
	{
		suffix: "gov.pl",
		reversed: "lp.vog"
	},
	{
		suffix: "gov.pn",
		reversed: "np.vog"
	},
	{
		suffix: "gov.pr",
		reversed: "rp.vog"
	},
	{
		suffix: "gov.ps",
		reversed: "sp.vog"
	},
	{
		suffix: "gov.pt",
		reversed: "tp.vog"
	},
	{
		suffix: "gov.py",
		reversed: "yp.vog"
	},
	{
		suffix: "gov.qa",
		reversed: "aq.vog"
	},
	{
		suffix: "gov.rs",
		reversed: "sr.vog"
	},
	{
		suffix: "gov.ru",
		reversed: "ur.vog"
	},
	{
		suffix: "gov.rw",
		reversed: "wr.vog"
	},
	{
		suffix: "gov.sa",
		reversed: "as.vog"
	},
	{
		suffix: "gov.sb",
		reversed: "bs.vog"
	},
	{
		suffix: "gov.sc",
		reversed: "cs.vog"
	},
	{
		suffix: "gov.scot",
		reversed: "tocs.vog"
	},
	{
		suffix: "gov.sd",
		reversed: "ds.vog"
	},
	{
		suffix: "gov.sg",
		reversed: "gs.vog"
	},
	{
		suffix: "gov.sh",
		reversed: "hs.vog"
	},
	{
		suffix: "gov.sl",
		reversed: "ls.vog"
	},
	{
		suffix: "gov.so",
		reversed: "os.vog"
	},
	{
		suffix: "gov.ss",
		reversed: "ss.vog"
	},
	{
		suffix: "gov.sx",
		reversed: "xs.vog"
	},
	{
		suffix: "gov.sy",
		reversed: "ys.vog"
	},
	{
		suffix: "gov.tj",
		reversed: "jt.vog"
	},
	{
		suffix: "gov.tl",
		reversed: "lt.vog"
	},
	{
		suffix: "gov.tm",
		reversed: "mt.vog"
	},
	{
		suffix: "gov.tn",
		reversed: "nt.vog"
	},
	{
		suffix: "gov.to",
		reversed: "ot.vog"
	},
	{
		suffix: "gov.tr",
		reversed: "rt.vog"
	},
	{
		suffix: "gov.tt",
		reversed: "tt.vog"
	},
	{
		suffix: "gov.tw",
		reversed: "wt.vog"
	},
	{
		suffix: "gov.ua",
		reversed: "au.vog"
	},
	{
		suffix: "gov.uk",
		reversed: "ku.vog"
	},
	{
		suffix: "gov.vc",
		reversed: "cv.vog"
	},
	{
		suffix: "gov.ve",
		reversed: "ev.vog"
	},
	{
		suffix: "gov.vn",
		reversed: "nv.vog"
	},
	{
		suffix: "gov.ws",
		reversed: "sw.vog"
	},
	{
		suffix: "gov.ye",
		reversed: "ey.vog"
	},
	{
		suffix: "gov.za",
		reversed: "az.vog"
	},
	{
		suffix: "gov.zm",
		reversed: "mz.vog"
	},
	{
		suffix: "gov.zw",
		reversed: "wz.vog"
	},
	{
		suffix: "government.aero",
		reversed: "orea.tnemnrevog"
	},
	{
		suffix: "govt.nz",
		reversed: "zn.tvog"
	},
	{
		suffix: "gp",
		reversed: "pg"
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
		suffix: "gr.com",
		reversed: "moc.rg"
	},
	{
		suffix: "gr.eu.org",
		reversed: "gro.ue.rg"
	},
	{
		suffix: "gr.it",
		reversed: "ti.rg"
	},
	{
		suffix: "gr.jp",
		reversed: "pj.rg"
	},
	{
		suffix: "grainger",
		reversed: "regniarg"
	},
	{
		suffix: "grajewo.pl",
		reversed: "lp.owejarg"
	},
	{
		suffix: "gran.no",
		reversed: "on.narg"
	},
	{
		suffix: "grandrapids.museum",
		reversed: "muesum.sdipardnarg"
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
		suffix: "graphics",
		reversed: "scihparg"
	},
	{
		suffix: "graphox.us",
		reversed: "su.xohparg"
	},
	{
		suffix: "gratangen.no",
		reversed: "on.negnatarg"
	},
	{
		suffix: "gratis",
		reversed: "sitarg"
	},
	{
		suffix: "graz.museum",
		reversed: "muesum.zarg"
	},
	{
		suffix: "greater.jp",
		reversed: "pj.retaerg"
	},
	{
		suffix: "green",
		reversed: "neerg"
	},
	{
		suffix: "greta.fr",
		reversed: "rf.aterg"
	},
	{
		suffix: "grimstad.no",
		reversed: "on.datsmirg"
	},
	{
		suffix: "gripe",
		reversed: "epirg"
	},
	{
		suffix: "griw.gov.pl",
		reversed: "lp.vog.wirg"
	},
	{
		suffix: "grocery",
		reversed: "yrecorg"
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
		suffix: "grondar.za",
		reversed: "az.radnorg"
	},
	{
		suffix: "grong.no",
		reversed: "on.gnorg"
	},
	{
		suffix: "grosseto.it",
		reversed: "ti.otessorg"
	},
	{
		suffix: "groundhandling.aero",
		reversed: "orea.gnildnahdnuorg"
	},
	{
		suffix: "group",
		reversed: "puorg"
	},
	{
		suffix: "group.aero",
		reversed: "orea.puorg"
	},
	{
		suffix: "grozny.ru",
		reversed: "ur.ynzorg"
	},
	{
		suffix: "grozny.su",
		reversed: "us.ynzorg"
	},
	{
		suffix: "grp.lk",
		reversed: "kl.prg"
	},
	{
		suffix: "gru.br",
		reversed: "rb.urg"
	},
	{
		suffix: "grue.no",
		reversed: "on.eurg"
	},
	{
		suffix: "gs",
		reversed: "sg"
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
		suffix: "gs.cn",
		reversed: "nc.sg"
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
		suffix: "gsj.bz",
		reversed: "zb.jsg"
	},
	{
		suffix: "gsm.pl",
		reversed: "lp.msg"
	},
	{
		suffix: "gt",
		reversed: "tg"
	},
	{
		suffix: "gu",
		reversed: "ug"
	},
	{
		suffix: "gu.us",
		reversed: "su.ug"
	},
	{
		suffix: "guam.gu",
		reversed: "ug.maug"
	},
	{
		suffix: "guardian",
		reversed: "naidraug"
	},
	{
		suffix: "gub.uy",
		reversed: "yu.bug"
	},
	{
		suffix: "gucci",
		reversed: "iccug"
	},
	{
		suffix: "guernsey.museum",
		reversed: "muesum.yesnreug"
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
		suffix: "gujarat.in",
		reversed: "ni.tarajug"
	},
	{
		suffix: "gujo.gifu.jp",
		reversed: "pj.ufig.ojug"
	},
	{
		suffix: "gulen.no",
		reversed: "on.nelug"
	},
	{
		suffix: "gunma.jp",
		reversed: "pj.amnug"
	},
	{
		suffix: "guovdageaidnu.no",
		reversed: "on.undiaegadvoug"
	},
	{
		suffix: "guru",
		reversed: "urug"
	},
	{
		suffix: "gushikami.okinawa.jp",
		reversed: "pj.awaniko.imakihsug"
	},
	{
		suffix: "gv.ao",
		reversed: "oa.vg"
	},
	{
		suffix: "gv.at",
		reversed: "ta.vg"
	},
	{
		suffix: "gv.vc",
		reversed: "cv.vg"
	},
	{
		suffix: "gw",
		reversed: "wg"
	},
	{
		suffix: "gwangju.kr",
		reversed: "rk.ujgnawg"
	},
	{
		suffix: "gwiddle.co.uk",
		reversed: "ku.oc.elddiwg"
	},
	{
		suffix: "gx.cn",
		reversed: "nc.xg"
	},
	{
		suffix: "gy",
		reversed: "yg"
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
		suffix: "gyokuto.kumamoto.jp",
		reversed: "pj.otomamuk.otukoyg"
	},
	{
		suffix: "gz.cn",
		reversed: "nc.zg"
	},
	{
		suffix: "gáivuotna.no",
		reversed: "on.ay8-antouvig--nx"
	},
	{
		suffix: "gálsá.no",
		reversed: "on.cale-slg--nx"
	},
	{
		suffix: "gáŋgaviika.no",
		reversed: "on.h74ay8-akiivagg--nx"
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
		suffix: "h.bg",
		reversed: "gb.h"
	},
	{
		suffix: "h.se",
		reversed: "es.h"
	},
	{
		suffix: "ha.cn",
		reversed: "nc.ah"
	},
	{
		suffix: "ha.no",
		reversed: "on.ah"
	},
	{
		suffix: "habikino.osaka.jp",
		reversed: "pj.akaso.onikibah"
	},
	{
		suffix: "habmer.no",
		reversed: "on.rembah"
	},
	{
		suffix: "haboro.hokkaido.jp",
		reversed: "pj.odiakkoh.orobah"
	},
	{
		suffix: "hacca.jp",
		reversed: "pj.accah"
	},
	{
		suffix: "hachijo.tokyo.jp",
		reversed: "pj.oykot.ojihcah"
	},
	{
		suffix: "hachinohe.aomori.jp",
		reversed: "pj.iromoa.ehonihcah"
	},
	{
		suffix: "hachioji.tokyo.jp",
		reversed: "pj.oykot.ijoihcah"
	},
	{
		suffix: "hachirogata.akita.jp",
		reversed: "pj.atika.atagorihcah"
	},
	{
		suffix: "hadano.kanagawa.jp",
		reversed: "pj.awaganak.onadah"
	},
	{
		suffix: "hadsel.no",
		reversed: "on.lesdah"
	},
	{
		suffix: "haebaru.okinawa.jp",
		reversed: "pj.awaniko.urabeah"
	},
	{
		suffix: "haga.tochigi.jp",
		reversed: "pj.igihcot.agah"
	},
	{
		suffix: "hagebostad.no",
		reversed: "on.datsobegah"
	},
	{
		suffix: "hagi.yamaguchi.jp",
		reversed: "pj.ihcugamay.igah"
	},
	{
		suffix: "haibara.shizuoka.jp",
		reversed: "pj.akouzihs.arabiah"
	},
	{
		suffix: "hair",
		reversed: "riah"
	},
	{
		suffix: "hakata.fukuoka.jp",
		reversed: "pj.akoukuf.atakah"
	},
	{
		suffix: "hakodate.hokkaido.jp",
		reversed: "pj.odiakkoh.etadokah"
	},
	{
		suffix: "hakone.kanagawa.jp",
		reversed: "pj.awaganak.enokah"
	},
	{
		suffix: "hakuba.nagano.jp",
		reversed: "pj.onagan.abukah"
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
		suffix: "halden.no",
		reversed: "on.nedlah"
	},
	{
		suffix: "half.host",
		reversed: "tsoh.flah"
	},
	{
		suffix: "halloffame.museum",
		reversed: "muesum.emaffollah"
	},
	{
		suffix: "halsa.no",
		reversed: "on.aslah"
	},
	{
		suffix: "ham-radio-op.net",
		reversed: "ten.po-oidar-mah"
	},
	{
		suffix: "hamada.shimane.jp",
		reversed: "pj.enamihs.adamah"
	},
	{
		suffix: "hamamatsu.shizuoka.jp",
		reversed: "pj.akouzihs.ustamamah"
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
		suffix: "hamatama.saga.jp",
		reversed: "pj.agas.amatamah"
	},
	{
		suffix: "hamatonbetsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustebnotamah"
	},
	{
		suffix: "hamburg",
		reversed: "grubmah"
	},
	{
		suffix: "hamburg.museum",
		reversed: "muesum.grubmah"
	},
	{
		suffix: "hammarfeasta.no",
		reversed: "on.atsaeframmah"
	},
	{
		suffix: "hammerfest.no",
		reversed: "on.tsefremmah"
	},
	{
		suffix: "hamura.tokyo.jp",
		reversed: "pj.oykot.arumah"
	},
	{
		suffix: "hanamaki.iwate.jp",
		reversed: "pj.etawi.ikamanah"
	},
	{
		suffix: "hanamigawa.chiba.jp",
		reversed: "pj.abihc.awagimanah"
	},
	{
		suffix: "hanawa.fukushima.jp",
		reversed: "pj.amihsukuf.awanah"
	},
	{
		suffix: "handa.aichi.jp",
		reversed: "pj.ihcia.adnah"
	},
	{
		suffix: "handcrafted.jp",
		reversed: "pj.detfarcdnah"
	},
	{
		suffix: "handson.museum",
		reversed: "muesum.nosdnah"
	},
	{
		suffix: "hanggliding.aero",
		reversed: "orea.gnidilggnah"
	},
	{
		suffix: "hangout",
		reversed: "tuognah"
	},
	{
		suffix: "hannan.osaka.jp",
		reversed: "pj.akaso.nannah"
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
		suffix: "hapmir.no",
		reversed: "on.rimpah"
	},
	{
		suffix: "happou.akita.jp",
		reversed: "pj.atika.uoppah"
	},
	{
		suffix: "hara.nagano.jp",
		reversed: "pj.onagan.arah"
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
		suffix: "harima.hyogo.jp",
		reversed: "pj.ogoyh.amirah"
	},
	{
		suffix: "harstad.no",
		reversed: "on.datsrah"
	},
	{
		suffix: "harvestcelebration.museum",
		reversed: "muesum.noitarbelectsevrah"
	},
	{
		suffix: "hasama.oita.jp",
		reversed: "pj.atio.amasah"
	},
	{
		suffix: "hasami.nagasaki.jp",
		reversed: "pj.ikasagan.imasah"
	},
	{
		suffix: "hashbang.sh",
		reversed: "hs.gnabhsah"
	},
	{
		suffix: "hashikami.aomori.jp",
		reversed: "pj.iromoa.imakihsah"
	},
	{
		suffix: "hashima.gifu.jp",
		reversed: "pj.ufig.amihsah"
	},
	{
		suffix: "hashimoto.wakayama.jp",
		reversed: "pj.amayakaw.otomihsah"
	},
	{
		suffix: "hasuda.saitama.jp",
		reversed: "pj.amatias.adusah"
	},
	{
		suffix: "hasura-app.io",
		reversed: "oi.ppa-arusah"
	},
	{
		suffix: "hasura.app",
		reversed: "ppa.arusah"
	},
	{
		suffix: "hasvik.no",
		reversed: "on.kivsah"
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
		suffix: "hatsukaichi.hiroshima.jp",
		reversed: "pj.amihsorih.ihciakustah"
	},
	{
		suffix: "hattfjelldal.no",
		reversed: "on.ladllejfttah"
	},
	{
		suffix: "haugesund.no",
		reversed: "on.dnuseguah"
	},
	{
		suffix: "haus",
		reversed: "suah"
	},
	{
		suffix: "hawaii.museum",
		reversed: "muesum.iiawah"
	},
	{
		suffix: "hayakawa.yamanashi.jp",
		reversed: "pj.ihsanamay.awakayah"
	},
	{
		suffix: "hayashima.okayama.jp",
		reversed: "pj.amayako.amihsayah"
	},
	{
		suffix: "hazu.aichi.jp",
		reversed: "pj.ihcia.uzah"
	},
	{
		suffix: "hb.cldmail.ru",
		reversed: "ur.liamdlc.bh"
	},
	{
		suffix: "hb.cn",
		reversed: "nc.bh"
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
		suffix: "he.cn",
		reversed: "nc.eh"
	},
	{
		suffix: "health",
		reversed: "htlaeh"
	},
	{
		suffix: "health-carereform.com",
		reversed: "moc.mrofererac-htlaeh"
	},
	{
		suffix: "health.museum",
		reversed: "muesum.htlaeh"
	},
	{
		suffix: "health.nz",
		reversed: "zn.htlaeh"
	},
	{
		suffix: "health.vn",
		reversed: "nv.htlaeh"
	},
	{
		suffix: "healthcare",
		reversed: "erachtlaeh"
	},
	{
		suffix: "heavy.jp",
		reversed: "pj.yvaeh"
	},
	{
		suffix: "heguri.nara.jp",
		reversed: "pj.aran.irugeh"
	},
	{
		suffix: "heimatunduhren.museum",
		reversed: "muesum.nerhudnutamieh"
	},
	{
		suffix: "hekinan.aichi.jp",
		reversed: "pj.ihcia.nanikeh"
	},
	{
		suffix: "hellas.museum",
		reversed: "muesum.salleh"
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
		suffix: "helsinki.museum",
		reversed: "muesum.iknisleh"
	},
	{
		suffix: "hembygdsforbund.museum",
		reversed: "muesum.dnubrofsdgybmeh"
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
		suffix: "hepforge.org",
		reversed: "gro.egrofpeh"
	},
	{
		suffix: "her.jp",
		reversed: "pj.reh"
	},
	{
		suffix: "herad.no",
		reversed: "on.dareh"
	},
	{
		suffix: "here",
		reversed: "ereh"
	},
	{
		suffix: "here-for-more.info",
		reversed: "ofni.erom-rof-ereh"
	},
	{
		suffix: "heritage.museum",
		reversed: "muesum.egatireh"
	},
	{
		suffix: "hermes",
		reversed: "semreh"
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
		suffix: "heroy.more-og-romsdal.no",
		reversed: "on.ladsmor-go-erom.yoreh"
	},
	{
		suffix: "heroy.nordland.no",
		reversed: "on.dnaldron.yoreh"
	},
	{
		suffix: "herøy.møre-og-romsdal.no",
		reversed: "on.bqq-ladsmor-go-erm--nx.ari-yreh--nx"
	},
	{
		suffix: "herøy.nordland.no",
		reversed: "on.dnaldron.ari-yreh--nx"
	},
	{
		suffix: "heteml.net",
		reversed: "ten.lmeteh"
	},
	{
		suffix: "hgtv",
		reversed: "vtgh"
	},
	{
		suffix: "hi.cn",
		reversed: "nc.ih"
	},
	{
		suffix: "hi.us",
		reversed: "su.ih"
	},
	{
		suffix: "hicam.net",
		reversed: "ten.macih"
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
		suffix: "hidaka.hokkaido.jp",
		reversed: "pj.odiakkoh.akadih"
	},
	{
		suffix: "hidaka.kochi.jp",
		reversed: "pj.ihcok.akadih"
	},
	{
		suffix: "hidaka.saitama.jp",
		reversed: "pj.amatias.akadih"
	},
	{
		suffix: "hidaka.wakayama.jp",
		reversed: "pj.amayakaw.akadih"
	},
	{
		suffix: "hidora.com",
		reversed: "moc.arodih"
	},
	{
		suffix: "higashi.fukuoka.jp",
		reversed: "pj.akoukuf.ihsagih"
	},
	{
		suffix: "higashi.fukushima.jp",
		reversed: "pj.amihsukuf.ihsagih"
	},
	{
		suffix: "higashi.okinawa.jp",
		reversed: "pj.awaniko.ihsagih"
	},
	{
		suffix: "higashiagatsuma.gunma.jp",
		reversed: "pj.amnug.amustagaihsagih"
	},
	{
		suffix: "higashichichibu.saitama.jp",
		reversed: "pj.amatias.ubihcihcihsagih"
	},
	{
		suffix: "higashihiroshima.hiroshima.jp",
		reversed: "pj.amihsorih.amihsorihihsagih"
	},
	{
		suffix: "higashiizu.shizuoka.jp",
		reversed: "pj.akouzihs.uziihsagih"
	},
	{
		suffix: "higashiizumo.shimane.jp",
		reversed: "pj.enamihs.omuziihsagih"
	},
	{
		suffix: "higashikagawa.kagawa.jp",
		reversed: "pj.awagak.awagakihsagih"
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
		suffix: "higashikurume.tokyo.jp",
		reversed: "pj.oykot.emurukihsagih"
	},
	{
		suffix: "higashimatsushima.miyagi.jp",
		reversed: "pj.igayim.amihsustamihsagih"
	},
	{
		suffix: "higashimatsuyama.saitama.jp",
		reversed: "pj.amatias.amayustamihsagih"
	},
	{
		suffix: "higashimurayama.tokyo.jp",
		reversed: "pj.oykot.amayarumihsagih"
	},
	{
		suffix: "higashinaruse.akita.jp",
		reversed: "pj.atika.esuranihsagih"
	},
	{
		suffix: "higashine.yamagata.jp",
		reversed: "pj.atagamay.enihsagih"
	},
	{
		suffix: "higashiomi.shiga.jp",
		reversed: "pj.agihs.imoihsagih"
	},
	{
		suffix: "higashiosaka.osaka.jp",
		reversed: "pj.akaso.akasoihsagih"
	},
	{
		suffix: "higashishirakawa.gifu.jp",
		reversed: "pj.ufig.awakarihsihsagih"
	},
	{
		suffix: "higashisumiyoshi.osaka.jp",
		reversed: "pj.akaso.ihsoyimusihsagih"
	},
	{
		suffix: "higashitsuno.kochi.jp",
		reversed: "pj.ihcok.onustihsagih"
	},
	{
		suffix: "higashiura.aichi.jp",
		reversed: "pj.ihcia.aruihsagih"
	},
	{
		suffix: "higashiyama.kyoto.jp",
		reversed: "pj.otoyk.amayihsagih"
	},
	{
		suffix: "higashiyamato.tokyo.jp",
		reversed: "pj.oykot.otamayihsagih"
	},
	{
		suffix: "higashiyodogawa.osaka.jp",
		reversed: "pj.akaso.awagodoyihsagih"
	},
	{
		suffix: "higashiyoshino.nara.jp",
		reversed: "pj.aran.onihsoyihsagih"
	},
	{
		suffix: "hiho.jp",
		reversed: "pj.ohih"
	},
	{
		suffix: "hiji.oita.jp",
		reversed: "pj.atio.ijih"
	},
	{
		suffix: "hikari.yamaguchi.jp",
		reversed: "pj.ihcugamay.irakih"
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
		suffix: "hikone.shiga.jp",
		reversed: "pj.agihs.enokih"
	},
	{
		suffix: "himeji.hyogo.jp",
		reversed: "pj.ogoyh.ijemih"
	},
	{
		suffix: "himeshima.oita.jp",
		reversed: "pj.atio.amihsemih"
	},
	{
		suffix: "himi.toyama.jp",
		reversed: "pj.amayot.imih"
	},
	{
		suffix: "hino.tokyo.jp",
		reversed: "pj.oykot.onih"
	},
	{
		suffix: "hino.tottori.jp",
		reversed: "pj.irottot.onih"
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
		suffix: "hioki.kagoshima.jp",
		reversed: "pj.amihsogak.ikoih"
	},
	{
		suffix: "hiphop",
		reversed: "pohpih"
	},
	{
		suffix: "hippy.jp",
		reversed: "pj.yppih"
	},
	{
		suffix: "hirado.nagasaki.jp",
		reversed: "pj.ikasagan.odarih"
	},
	{
		suffix: "hiraizumi.iwate.jp",
		reversed: "pj.etawi.imuziarih"
	},
	{
		suffix: "hirakata.osaka.jp",
		reversed: "pj.akaso.atakarih"
	},
	{
		suffix: "hiranai.aomori.jp",
		reversed: "pj.iromoa.ianarih"
	},
	{
		suffix: "hirara.okinawa.jp",
		reversed: "pj.awaniko.ararih"
	},
	{
		suffix: "hirata.fukushima.jp",
		reversed: "pj.amihsukuf.atarih"
	},
	{
		suffix: "hiratsuka.kanagawa.jp",
		reversed: "pj.awaganak.akustarih"
	},
	{
		suffix: "hiraya.nagano.jp",
		reversed: "pj.onagan.ayarih"
	},
	{
		suffix: "hirogawa.wakayama.jp",
		reversed: "pj.amayakaw.awagorih"
	},
	{
		suffix: "hirokawa.fukuoka.jp",
		reversed: "pj.akoukuf.awakorih"
	},
	{
		suffix: "hirono.fukushima.jp",
		reversed: "pj.amihsukuf.onorih"
	},
	{
		suffix: "hirono.iwate.jp",
		reversed: "pj.etawi.onorih"
	},
	{
		suffix: "hiroo.hokkaido.jp",
		reversed: "pj.odiakkoh.oorih"
	},
	{
		suffix: "hirosaki.aomori.jp",
		reversed: "pj.iromoa.ikasorih"
	},
	{
		suffix: "hiroshima.jp",
		reversed: "pj.amihsorih"
	},
	{
		suffix: "hisamitsu",
		reversed: "ustimasih"
	},
	{
		suffix: "hisayama.fukuoka.jp",
		reversed: "pj.akoukuf.amayasih"
	},
	{
		suffix: "histoire.museum",
		reversed: "muesum.eriotsih"
	},
	{
		suffix: "historical.museum",
		reversed: "muesum.lacirotsih"
	},
	{
		suffix: "historicalsociety.museum",
		reversed: "muesum.yteicoslacirotsih"
	},
	{
		suffix: "historichouses.museum",
		reversed: "muesum.sesuohcirotsih"
	},
	{
		suffix: "historisch.museum",
		reversed: "muesum.hcsirotsih"
	},
	{
		suffix: "historisches.museum",
		reversed: "muesum.sehcsirotsih"
	},
	{
		suffix: "history.museum",
		reversed: "muesum.yrotsih"
	},
	{
		suffix: "historyofscience.museum",
		reversed: "muesum.ecneicsfoyrotsih"
	},
	{
		suffix: "hita.oita.jp",
		reversed: "pj.atio.atih"
	},
	{
		suffix: "hitachi",
		reversed: "ihcatih"
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
		suffix: "hitra.no",
		reversed: "on.artih"
	},
	{
		suffix: "hiv",
		reversed: "vih"
	},
	{
		suffix: "hizen.saga.jp",
		reversed: "pj.agas.nezih"
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
		suffix: "hk",
		reversed: "kh"
	},
	{
		suffix: "hk.cn",
		reversed: "nc.kh"
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
		suffix: "hkt",
		reversed: "tkh"
	},
	{
		suffix: "hl.cn",
		reversed: "nc.lh"
	},
	{
		suffix: "hl.no",
		reversed: "on.lh"
	},
	{
		suffix: "hlx.live",
		reversed: "evil.xlh"
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
		suffix: "hm",
		reversed: "mh"
	},
	{
		suffix: "hm.no",
		reversed: "on.mh"
	},
	{
		suffix: "hn",
		reversed: "nh"
	},
	{
		suffix: "hn.cn",
		reversed: "nc.nh"
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
		suffix: "hobol.no",
		reversed: "on.loboh"
	},
	{
		suffix: "hobøl.no",
		reversed: "on.ari-lboh--nx"
	},
	{
		suffix: "hockey",
		reversed: "yekcoh"
	},
	{
		suffix: "hof.no",
		reversed: "on.foh"
	},
	{
		suffix: "hofu.yamaguchi.jp",
		reversed: "pj.ihcugamay.ufoh"
	},
	{
		suffix: "hokkaido.jp",
		reversed: "pj.odiakkoh"
	},
	{
		suffix: "hokksund.no",
		reversed: "on.dnuskkoh"
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
		suffix: "hokuto.yamanashi.jp",
		reversed: "pj.ihsanamay.otukoh"
	},
	{
		suffix: "hol.no",
		reversed: "on.loh"
	},
	{
		suffix: "holdings",
		reversed: "sgnidloh"
	},
	{
		suffix: "hole.no",
		reversed: "on.eloh"
	},
	{
		suffix: "holiday",
		reversed: "yadiloh"
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
		suffix: "holy.jp",
		reversed: "pj.yloh"
	},
	{
		suffix: "home-webserver.de",
		reversed: "ed.revresbew-emoh"
	},
	{
		suffix: "home.dyndns.org",
		reversed: "gro.sndnyd.emoh"
	},
	{
		suffix: "homebuilt.aero",
		reversed: "orea.tliubemoh"
	},
	{
		suffix: "homedepot",
		reversed: "topedemoh"
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
		suffix: "homegoods",
		reversed: "sdoogemoh"
	},
	{
		suffix: "homeip.net",
		reversed: "ten.piemoh"
	},
	{
		suffix: "homelink.one",
		reversed: "eno.knilemoh"
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
		suffix: "homeoffice.gov.uk",
		reversed: "ku.vog.eciffoemoh"
	},
	{
		suffix: "homes",
		reversed: "semoh"
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
		suffix: "homesense",
		reversed: "esnesemoh"
	},
	{
		suffix: "homesklep.pl",
		reversed: "lp.pelksemoh"
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
		suffix: "honai.ehime.jp",
		reversed: "pj.emihe.ianoh"
	},
	{
		suffix: "honbetsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustebnoh"
	},
	{
		suffix: "honda",
		reversed: "adnoh"
	},
	{
		suffix: "honefoss.no",
		reversed: "on.ssofenoh"
	},
	{
		suffix: "hongo.hiroshima.jp",
		reversed: "pj.amihsorih.ognoh"
	},
	{
		suffix: "honjo.akita.jp",
		reversed: "pj.atika.ojnoh"
	},
	{
		suffix: "honjo.saitama.jp",
		reversed: "pj.amatias.ojnoh"
	},
	{
		suffix: "honjyo.akita.jp",
		reversed: "pj.atika.oyjnoh"
	},
	{
		suffix: "hoplix.shop",
		reversed: "pohs.xilpoh"
	},
	{
		suffix: "hopto.me",
		reversed: "em.otpoh"
	},
	{
		suffix: "hopto.org",
		reversed: "gro.otpoh"
	},
	{
		suffix: "hornindal.no",
		reversed: "on.ladninroh"
	},
	{
		suffix: "horokanai.hokkaido.jp",
		reversed: "pj.odiakkoh.ianakoroh"
	},
	{
		suffix: "horology.museum",
		reversed: "muesum.ygoloroh"
	},
	{
		suffix: "horonobe.hokkaido.jp",
		reversed: "pj.odiakkoh.ebonoroh"
	},
	{
		suffix: "horse",
		reversed: "esroh"
	},
	{
		suffix: "horten.no",
		reversed: "on.netroh"
	},
	{
		suffix: "hosp.uk",
		reversed: "ku.psoh"
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
		suffix: "hostedpi.com",
		reversed: "moc.ipdetsoh"
	},
	{
		suffix: "hosting",
		reversed: "gnitsoh"
	},
	{
		suffix: "hosting-cluster.nl",
		reversed: "ln.retsulc-gnitsoh"
	},
	{
		suffix: "hostyhosting.io",
		reversed: "oi.gnitsohytsoh"
	},
	{
		suffix: "hot",
		reversed: "toh"
	},
	{
		suffix: "hotel.hu",
		reversed: "uh.letoh"
	},
	{
		suffix: "hotel.lk",
		reversed: "kl.letoh"
	},
	{
		suffix: "hotel.tz",
		reversed: "zt.letoh"
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
		suffix: "hotelwithflight.com",
		reversed: "moc.thgilfhtiwletoh"
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
		suffix: "house.museum",
		reversed: "muesum.esuoh"
	},
	{
		suffix: "how",
		reversed: "woh"
	},
	{
		suffix: "hoyanger.no",
		reversed: "on.regnayoh"
	},
	{
		suffix: "hoylandet.no",
		reversed: "on.tednalyoh"
	},
	{
		suffix: "hr",
		reversed: "rh"
	},
	{
		suffix: "hr.eu.org",
		reversed: "gro.ue.rh"
	},
	{
		suffix: "hra.health",
		reversed: "htlaeh.arh"
	},
	{
		suffix: "hs.kr",
		reversed: "rk.sh"
	},
	{
		suffix: "hs.run",
		reversed: "nur.sh"
	},
	{
		suffix: "hs.zone",
		reversed: "enoz.sh"
	},
	{
		suffix: "hsbc",
		reversed: "cbsh"
	},
	{
		suffix: "ht",
		reversed: "th"
	},
	{
		suffix: "httpbin.org",
		reversed: "gro.nibptth"
	},
	{
		suffix: "hu",
		reversed: "uh"
	},
	{
		suffix: "hu.com",
		reversed: "moc.uh"
	},
	{
		suffix: "hu.eu.org",
		reversed: "gro.ue.uh"
	},
	{
		suffix: "hu.net",
		reversed: "ten.uh"
	},
	{
		suffix: "hughes",
		reversed: "sehguh"
	},
	{
		suffix: "huissier-justice.fr",
		reversed: "rf.ecitsuj-reissiuh"
	},
	{
		suffix: "humanities.museum",
		reversed: "muesum.seitinamuh"
	},
	{
		suffix: "hungry.jp",
		reversed: "pj.yrgnuh"
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
		suffix: "hyatt",
		reversed: "ttayh"
	},
	{
		suffix: "hyllestad.no",
		reversed: "on.datsellyh"
	},
	{
		suffix: "hyogo.jp",
		reversed: "pj.ogoyh"
	},
	{
		suffix: "hyuga.miyazaki.jp",
		reversed: "pj.ikazayim.aguyh"
	},
	{
		suffix: "hyundai",
		reversed: "iadnuyh"
	},
	{
		suffix: "hzc.io",
		reversed: "oi.czh"
	},
	{
		suffix: "hábmer.no",
		reversed: "on.aqx-rembh--nx"
	},
	{
		suffix: "hámmárfeasta.no",
		reversed: "on.ca4s-atsaefrmmh--nx"
	},
	{
		suffix: "hápmir.no",
		reversed: "on.aqx-rimph--nx"
	},
	{
		suffix: "häkkinen.fi",
		reversed: "if.aw5-nenikkh--nx"
	},
	{
		suffix: "hå.no",
		reversed: "on.af2-h--nx"
	},
	{
		suffix: "hægebostad.no",
		reversed: "on.a3g-datsobegh--nx"
	},
	{
		suffix: "hønefoss.no",
		reversed: "on.a1q-ssofenh--nx"
	},
	{
		suffix: "høyanger.no",
		reversed: "on.a1q-regnayh--nx"
	},
	{
		suffix: "høylandet.no",
		reversed: "on.a45-tednalyh--nx"
	},
	{
		suffix: "i.bg",
		reversed: "gb.i"
	},
	{
		suffix: "i.ng",
		reversed: "gn.i"
	},
	{
		suffix: "i.ph",
		reversed: "hp.i"
	},
	{
		suffix: "i.se",
		reversed: "es.i"
	},
	{
		suffix: "i234.me",
		reversed: "em.432i"
	},
	{
		suffix: "ia.us",
		reversed: "su.ai"
	},
	{
		suffix: "iamallama.com",
		reversed: "moc.amallamai"
	},
	{
		suffix: "ibara.okayama.jp",
		reversed: "pj.amayako.arabi"
	},
	{
		suffix: "ibaraki.ibaraki.jp",
		reversed: "pj.ikarabi.ikarabi"
	},
	{
		suffix: "ibaraki.jp",
		reversed: "pj.ikarabi"
	},
	{
		suffix: "ibaraki.osaka.jp",
		reversed: "pj.akaso.ikarabi"
	},
	{
		suffix: "ibestad.no",
		reversed: "on.datsebi"
	},
	{
		suffix: "ibigawa.gifu.jp",
		reversed: "pj.ufig.awagibi"
	},
	{
		suffix: "ibm",
		reversed: "mbi"
	},
	{
		suffix: "ibxos.it",
		reversed: "ti.soxbi"
	},
	{
		suffix: "ic.gov.pl",
		reversed: "lp.vog.ci"
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
		suffix: "ichiba.tokushima.jp",
		reversed: "pj.amihsukot.abihci"
	},
	{
		suffix: "ichihara.chiba.jp",
		reversed: "pj.abihc.arahihci"
	},
	{
		suffix: "ichikai.tochigi.jp",
		reversed: "pj.igihcot.iakihci"
	},
	{
		suffix: "ichikawa.chiba.jp",
		reversed: "pj.abihc.awakihci"
	},
	{
		suffix: "ichikawa.hyogo.jp",
		reversed: "pj.ogoyh.awakihci"
	},
	{
		suffix: "ichikawamisato.yamanashi.jp",
		reversed: "pj.ihsanamay.otasimawakihci"
	},
	{
		suffix: "ichinohe.iwate.jp",
		reversed: "pj.etawi.ehonihci"
	},
	{
		suffix: "ichinomiya.aichi.jp",
		reversed: "pj.ihcia.ayimonihci"
	},
	{
		suffix: "ichinomiya.chiba.jp",
		reversed: "pj.abihc.ayimonihci"
	},
	{
		suffix: "ichinoseki.iwate.jp",
		reversed: "pj.etawi.ikesonihci"
	},
	{
		suffix: "icu",
		reversed: "uci"
	},
	{
		suffix: "icurus.jp",
		reversed: "pj.suruci"
	},
	{
		suffix: "id",
		reversed: "di"
	},
	{
		suffix: "id.au",
		reversed: "ua.di"
	},
	{
		suffix: "id.firewalledreplit.co",
		reversed: "oc.tilperdellawerif.di"
	},
	{
		suffix: "id.forgerock.io",
		reversed: "oi.kcoregrof.di"
	},
	{
		suffix: "id.ir",
		reversed: "ri.di"
	},
	{
		suffix: "id.lv",
		reversed: "vl.di"
	},
	{
		suffix: "id.ly",
		reversed: "yl.di"
	},
	{
		suffix: "id.repl.co",
		reversed: "oc.lper.di"
	},
	{
		suffix: "id.us",
		reversed: "su.di"
	},
	{
		suffix: "ide.kyoto.jp",
		reversed: "pj.otoyk.edi"
	},
	{
		suffix: "idf.il",
		reversed: "li.fdi"
	},
	{
		suffix: "idrett.no",
		reversed: "on.tterdi"
	},
	{
		suffix: "idv.hk",
		reversed: "kh.vdi"
	},
	{
		suffix: "idv.tw",
		reversed: "wt.vdi"
	},
	{
		suffix: "ie",
		reversed: "ei"
	},
	{
		suffix: "ie.eu.org",
		reversed: "gro.ue.ei"
	},
	{
		suffix: "ieee",
		reversed: "eeei"
	},
	{
		suffix: "if.ua",
		reversed: "au.fi"
	},
	{
		suffix: "ifm",
		reversed: "mfi"
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
		suffix: "iheya.okinawa.jp",
		reversed: "pj.awaniko.ayehi"
	},
	{
		suffix: "iida.nagano.jp",
		reversed: "pj.onagan.adii"
	},
	{
		suffix: "iide.yamagata.jp",
		reversed: "pj.atagamay.edii"
	},
	{
		suffix: "iijima.nagano.jp",
		reversed: "pj.onagan.amijii"
	},
	{
		suffix: "iitate.fukushima.jp",
		reversed: "pj.amihsukuf.etatii"
	},
	{
		suffix: "iiyama.nagano.jp",
		reversed: "pj.onagan.amayii"
	},
	{
		suffix: "iizuka.fukuoka.jp",
		reversed: "pj.akoukuf.akuzii"
	},
	{
		suffix: "iizuna.nagano.jp",
		reversed: "pj.onagan.anuzii"
	},
	{
		suffix: "ikano",
		reversed: "onaki"
	},
	{
		suffix: "ikaruga.nara.jp",
		reversed: "pj.aran.aguraki"
	},
	{
		suffix: "ikata.ehime.jp",
		reversed: "pj.emihe.ataki"
	},
	{
		suffix: "ikawa.akita.jp",
		reversed: "pj.atika.awaki"
	},
	{
		suffix: "ikeda.fukui.jp",
		reversed: "pj.iukuf.adeki"
	},
	{
		suffix: "ikeda.gifu.jp",
		reversed: "pj.ufig.adeki"
	},
	{
		suffix: "ikeda.hokkaido.jp",
		reversed: "pj.odiakkoh.adeki"
	},
	{
		suffix: "ikeda.nagano.jp",
		reversed: "pj.onagan.adeki"
	},
	{
		suffix: "ikeda.osaka.jp",
		reversed: "pj.akaso.adeki"
	},
	{
		suffix: "iki.fi",
		reversed: "if.iki"
	},
	{
		suffix: "iki.nagasaki.jp",
		reversed: "pj.ikasagan.iki"
	},
	{
		suffix: "ikoma.nara.jp",
		reversed: "pj.aran.amoki"
	},
	{
		suffix: "ikusaka.nagano.jp",
		reversed: "pj.onagan.akasuki"
	},
	{
		suffix: "il",
		reversed: "li"
	},
	{
		suffix: "il.eu.org",
		reversed: "gro.ue.li"
	},
	{
		suffix: "il.us",
		reversed: "su.li"
	},
	{
		suffix: "ilawa.pl",
		reversed: "lp.awali"
	},
	{
		suffix: "iliadboxos.it",
		reversed: "ti.soxobdaili"
	},
	{
		suffix: "illustration.museum",
		reversed: "muesum.noitartsulli"
	},
	{
		suffix: "ilovecollege.info",
		reversed: "ofni.egellocevoli"
	},
	{
		suffix: "im",
		reversed: "mi"
	},
	{
		suffix: "im.it",
		reversed: "ti.mi"
	},
	{
		suffix: "imabari.ehime.jp",
		reversed: "pj.emihe.irabami"
	},
	{
		suffix: "imageandsound.museum",
		reversed: "muesum.dnuosdnaegami"
	},
	{
		suffix: "imakane.hokkaido.jp",
		reversed: "pj.odiakkoh.enakami"
	},
	{
		suffix: "imamat",
		reversed: "tamami"
	},
	{
		suffix: "imari.saga.jp",
		reversed: "pj.agas.irami"
	},
	{
		suffix: "imb.br",
		reversed: "rb.bmi"
	},
	{
		suffix: "imdb",
		reversed: "bdmi"
	},
	{
		suffix: "imizu.toyama.jp",
		reversed: "pj.amayot.uzimi"
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
		suffix: "imperia.it",
		reversed: "ti.airepmi"
	},
	{
		suffix: "impertrix.com",
		reversed: "moc.xirtrepmi"
	},
	{
		suffix: "impertrixcdn.com",
		reversed: "moc.ndcxirtrepmi"
	},
	{
		suffix: "in",
		reversed: "ni"
	},
	{
		suffix: "in-addr.arpa",
		reversed: "apra.rdda-ni"
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
		suffix: "in-the-band.net",
		reversed: "ten.dnab-eht-ni"
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
		suffix: "in.eu.org",
		reversed: "gro.ue.ni"
	},
	{
		suffix: "in.na",
		reversed: "an.ni"
	},
	{
		suffix: "in.net",
		reversed: "ten.ni"
	},
	{
		suffix: "in.ni",
		reversed: "in.ni"
	},
	{
		suffix: "in.rs",
		reversed: "sr.ni"
	},
	{
		suffix: "in.th",
		reversed: "ht.ni"
	},
	{
		suffix: "in.ua",
		reversed: "au.ni"
	},
	{
		suffix: "in.us",
		reversed: "su.ni"
	},
	{
		suffix: "ina.ibaraki.jp",
		reversed: "pj.ikarabi.ani"
	},
	{
		suffix: "ina.nagano.jp",
		reversed: "pj.onagan.ani"
	},
	{
		suffix: "ina.saitama.jp",
		reversed: "pj.amatias.ani"
	},
	{
		suffix: "inabe.mie.jp",
		reversed: "pj.eim.ebani"
	},
	{
		suffix: "inagawa.hyogo.jp",
		reversed: "pj.ogoyh.awagani"
	},
	{
		suffix: "inagi.tokyo.jp",
		reversed: "pj.oykot.igani"
	},
	{
		suffix: "inami.toyama.jp",
		reversed: "pj.amayot.imani"
	},
	{
		suffix: "inami.wakayama.jp",
		reversed: "pj.amayakaw.imani"
	},
	{
		suffix: "inashiki.ibaraki.jp",
		reversed: "pj.ikarabi.ikihsani"
	},
	{
		suffix: "inatsuki.fukuoka.jp",
		reversed: "pj.akoukuf.ikustani"
	},
	{
		suffix: "inawashiro.fukushima.jp",
		reversed: "pj.amihsukuf.orihsawani"
	},
	{
		suffix: "inazawa.aichi.jp",
		reversed: "pj.ihcia.awazani"
	},
	{
		suffix: "inc",
		reversed: "cni"
	},
	{
		suffix: "inc.hk",
		reversed: "kh.cni"
	},
	{
		suffix: "incheon.kr",
		reversed: "rk.noehcni"
	},
	{
		suffix: "ind.br",
		reversed: "rb.dni"
	},
	{
		suffix: "ind.gt",
		reversed: "tg.dni"
	},
	{
		suffix: "ind.in",
		reversed: "ni.dni"
	},
	{
		suffix: "ind.kw",
		reversed: "wk.dni"
	},
	{
		suffix: "ind.tn",
		reversed: "nt.dni"
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
		suffix: "inderoy.no",
		reversed: "on.yoredni"
	},
	{
		suffix: "inderøy.no",
		reversed: "on.ayf-yredni--nx"
	},
	{
		suffix: "indian.museum",
		reversed: "muesum.naidni"
	},
	{
		suffix: "indiana.museum",
		reversed: "muesum.anaidni"
	},
	{
		suffix: "indianapolis.museum",
		reversed: "muesum.silopanaidni"
	},
	{
		suffix: "indianmarket.museum",
		reversed: "muesum.tekramnaidni"
	},
	{
		suffix: "indie.porn",
		reversed: "nrop.eidni"
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
		suffix: "industries",
		reversed: "seirtsudni"
	},
	{
		suffix: "ine.kyoto.jp",
		reversed: "pj.otoyk.eni"
	},
	{
		suffix: "inf.br",
		reversed: "rb.fni"
	},
	{
		suffix: "inf.cu",
		reversed: "uc.fni"
	},
	{
		suffix: "inf.mk",
		reversed: "km.fni"
	},
	{
		suffix: "inf.ua",
		reversed: "au.fni"
	},
	{
		suffix: "infiniti",
		reversed: "itinifni"
	},
	{
		suffix: "info",
		reversed: "ofni"
	},
	{
		suffix: "info.at",
		reversed: "ta.ofni"
	},
	{
		suffix: "info.au",
		reversed: "ua.ofni"
	},
	{
		suffix: "info.az",
		reversed: "za.ofni"
	},
	{
		suffix: "info.bb",
		reversed: "bb.ofni"
	},
	{
		suffix: "info.bo",
		reversed: "ob.ofni"
	},
	{
		suffix: "info.co",
		reversed: "oc.ofni"
	},
	{
		suffix: "info.cx",
		reversed: "xc.ofni"
	},
	{
		suffix: "info.ec",
		reversed: "ce.ofni"
	},
	{
		suffix: "info.et",
		reversed: "te.ofni"
	},
	{
		suffix: "info.fj",
		reversed: "jf.ofni"
	},
	{
		suffix: "info.gu",
		reversed: "ug.ofni"
	},
	{
		suffix: "info.ht",
		reversed: "th.ofni"
	},
	{
		suffix: "info.hu",
		reversed: "uh.ofni"
	},
	{
		suffix: "info.in",
		reversed: "ni.ofni"
	},
	{
		suffix: "info.ke",
		reversed: "ek.ofni"
	},
	{
		suffix: "info.ki",
		reversed: "ik.ofni"
	},
	{
		suffix: "info.la",
		reversed: "al.ofni"
	},
	{
		suffix: "info.ls",
		reversed: "sl.ofni"
	},
	{
		suffix: "info.mv",
		reversed: "vm.ofni"
	},
	{
		suffix: "info.na",
		reversed: "an.ofni"
	},
	{
		suffix: "info.nf",
		reversed: "fn.ofni"
	},
	{
		suffix: "info.ni",
		reversed: "in.ofni"
	},
	{
		suffix: "info.nr",
		reversed: "rn.ofni"
	},
	{
		suffix: "info.pk",
		reversed: "kp.ofni"
	},
	{
		suffix: "info.pl",
		reversed: "lp.ofni"
	},
	{
		suffix: "info.pr",
		reversed: "rp.ofni"
	},
	{
		suffix: "info.ro",
		reversed: "or.ofni"
	},
	{
		suffix: "info.sd",
		reversed: "ds.ofni"
	},
	{
		suffix: "info.tn",
		reversed: "nt.ofni"
	},
	{
		suffix: "info.tr",
		reversed: "rt.ofni"
	},
	{
		suffix: "info.tt",
		reversed: "tt.ofni"
	},
	{
		suffix: "info.tz",
		reversed: "zt.ofni"
	},
	{
		suffix: "info.ve",
		reversed: "ev.ofni"
	},
	{
		suffix: "info.vn",
		reversed: "nv.ofni"
	},
	{
		suffix: "info.zm",
		reversed: "mz.ofni"
	},
	{
		suffix: "ing",
		reversed: "gni"
	},
	{
		suffix: "ing.pa",
		reversed: "ap.gni"
	},
	{
		suffix: "ingatlan.hu",
		reversed: "uh.naltagni"
	},
	{
		suffix: "ink",
		reversed: "kni"
	},
	{
		suffix: "ino.kochi.jp",
		reversed: "pj.ihcok.oni"
	},
	{
		suffix: "instance.datadetect.com",
		reversed: "moc.tcetedatad.ecnatsni"
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
		suffix: "institute",
		reversed: "etutitsni"
	},
	{
		suffix: "insurance",
		reversed: "ecnarusni"
	},
	{
		suffix: "insurance.aero",
		reversed: "orea.ecnarusni"
	},
	{
		suffix: "insure",
		reversed: "erusni"
	},
	{
		suffix: "int",
		reversed: "tni"
	},
	{
		suffix: "int.ar",
		reversed: "ra.tni"
	},
	{
		suffix: "int.az",
		reversed: "za.tni"
	},
	{
		suffix: "int.bo",
		reversed: "ob.tni"
	},
	{
		suffix: "int.ci",
		reversed: "ic.tni"
	},
	{
		suffix: "int.co",
		reversed: "oc.tni"
	},
	{
		suffix: "int.cv",
		reversed: "vc.tni"
	},
	{
		suffix: "int.eu.org",
		reversed: "gro.ue.tni"
	},
	{
		suffix: "int.in",
		reversed: "ni.tni"
	},
	{
		suffix: "int.is",
		reversed: "si.tni"
	},
	{
		suffix: "int.la",
		reversed: "al.tni"
	},
	{
		suffix: "int.lk",
		reversed: "kl.tni"
	},
	{
		suffix: "int.mv",
		reversed: "vm.tni"
	},
	{
		suffix: "int.mw",
		reversed: "wm.tni"
	},
	{
		suffix: "int.ni",
		reversed: "in.tni"
	},
	{
		suffix: "int.pt",
		reversed: "tp.tni"
	},
	{
		suffix: "int.ru",
		reversed: "ur.tni"
	},
	{
		suffix: "int.tj",
		reversed: "jt.tni"
	},
	{
		suffix: "int.tt",
		reversed: "tt.tni"
	},
	{
		suffix: "int.ve",
		reversed: "ev.tni"
	},
	{
		suffix: "int.vn",
		reversed: "nv.tni"
	},
	{
		suffix: "intelligence.museum",
		reversed: "muesum.ecnegilletni"
	},
	{
		suffix: "interactive.museum",
		reversed: "muesum.evitcaretni"
	},
	{
		suffix: "international",
		reversed: "lanoitanretni"
	},
	{
		suffix: "internet-dns.de",
		reversed: "ed.snd-tenretni"
	},
	{
		suffix: "internet.in",
		reversed: "ni.tenretni"
	},
	{
		suffix: "intl.tn",
		reversed: "nt.ltni"
	},
	{
		suffix: "intuit",
		reversed: "tiutni"
	},
	{
		suffix: "inuyama.aichi.jp",
		reversed: "pj.ihcia.amayuni"
	},
	{
		suffix: "investments",
		reversed: "stnemtsevni"
	},
	{
		suffix: "inzai.chiba.jp",
		reversed: "pj.abihc.iazni"
	},
	{
		suffix: "io",
		reversed: "oi"
	},
	{
		suffix: "io.in",
		reversed: "ni.oi"
	},
	{
		suffix: "io.kg",
		reversed: "gk.oi"
	},
	{
		suffix: "iobb.net",
		reversed: "ten.bboi"
	},
	{
		suffix: "iopsys.se",
		reversed: "es.syspoi"
	},
	{
		suffix: "ip.linodeusercontent.com",
		reversed: "moc.tnetnocresuedonil.pi"
	},
	{
		suffix: "ip6.arpa",
		reversed: "apra.6pi"
	},
	{
		suffix: "ipifony.net",
		reversed: "ten.ynofipi"
	},
	{
		suffix: "ipiranga",
		reversed: "agnaripi"
	},
	{
		suffix: "iq",
		reversed: "qi"
	},
	{
		suffix: "ir",
		reversed: "ri"
	},
	{
		suffix: "iraq.museum",
		reversed: "muesum.qari"
	},
	{
		suffix: "iris.arpa",
		reversed: "apra.siri"
	},
	{
		suffix: "irish",
		reversed: "hsiri"
	},
	{
		suffix: "iron.museum",
		reversed: "muesum.nori"
	},
	{
		suffix: "iruma.saitama.jp",
		reversed: "pj.amatias.amuri"
	},
	{
		suffix: "is",
		reversed: "si"
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
		suffix: "is.eu.org",
		reversed: "gro.ue.si"
	},
	{
		suffix: "is.gov.pl",
		reversed: "lp.vog.si"
	},
	{
		suffix: "is.it",
		reversed: "ti.si"
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
		suffix: "isa.kagoshima.jp",
		reversed: "pj.amihsogak.asi"
	},
	{
		suffix: "isa.us",
		reversed: "su.asi"
	},
	{
		suffix: "isahaya.nagasaki.jp",
		reversed: "pj.ikasagan.ayahasi"
	},
	{
		suffix: "ise.mie.jp",
		reversed: "pj.eim.esi"
	},
	{
		suffix: "isehara.kanagawa.jp",
		reversed: "pj.awaganak.arahesi"
	},
	{
		suffix: "isen.kagoshima.jp",
		reversed: "pj.amihsogak.nesi"
	},
	{
		suffix: "isernia.it",
		reversed: "ti.ainresi"
	},
	{
		suffix: "iserv.dev",
		reversed: "ved.vresi"
	},
	{
		suffix: "iservschule.de",
		reversed: "ed.eluhcsvresi"
	},
	{
		suffix: "isesaki.gunma.jp",
		reversed: "pj.amnug.ikasesi"
	},
	{
		suffix: "ishigaki.okinawa.jp",
		reversed: "pj.awaniko.ikagihsi"
	},
	{
		suffix: "ishikari.hokkaido.jp",
		reversed: "pj.odiakkoh.irakihsi"
	},
	{
		suffix: "ishikawa.fukushima.jp",
		reversed: "pj.amihsukuf.awakihsi"
	},
	{
		suffix: "ishikawa.jp",
		reversed: "pj.awakihsi"
	},
	{
		suffix: "ishikawa.okinawa.jp",
		reversed: "pj.awaniko.awakihsi"
	},
	{
		suffix: "ishinomaki.miyagi.jp",
		reversed: "pj.igayim.ikamonihsi"
	},
	{
		suffix: "isla.pr",
		reversed: "rp.alsi"
	},
	{
		suffix: "isleofman.museum",
		reversed: "muesum.namfoelsi"
	},
	{
		suffix: "ismaili",
		reversed: "iliamsi"
	},
	{
		suffix: "isshiki.aichi.jp",
		reversed: "pj.ihcia.ikihssi"
	},
	{
		suffix: "issmarterthanyou.com",
		reversed: "moc.uoynahtretramssi"
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
		suffix: "isteingeek.de",
		reversed: "ed.keegnietsi"
	},
	{
		suffix: "istmein.de",
		reversed: "ed.niemtsi"
	},
	{
		suffix: "isumi.chiba.jp",
		reversed: "pj.abihc.imusi"
	},
	{
		suffix: "it",
		reversed: "ti"
	},
	{
		suffix: "it.ao",
		reversed: "oa.ti"
	},
	{
		suffix: "it.eu.org",
		reversed: "gro.ue.ti"
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
		suffix: "itabashi.tokyo.jp",
		reversed: "pj.oykot.ihsabati"
	},
	{
		suffix: "itako.ibaraki.jp",
		reversed: "pj.ikarabi.okati"
	},
	{
		suffix: "itakura.gunma.jp",
		reversed: "pj.amnug.arukati"
	},
	{
		suffix: "itami.hyogo.jp",
		reversed: "pj.ogoyh.imati"
	},
	{
		suffix: "itano.tokushima.jp",
		reversed: "pj.amihsukot.onati"
	},
	{
		suffix: "itau",
		reversed: "uati"
	},
	{
		suffix: "itayanagi.aomori.jp",
		reversed: "pj.iromoa.iganayati"
	},
	{
		suffix: "itcouldbewor.se",
		reversed: "es.rowebdluocti"
	},
	{
		suffix: "itigo.jp",
		reversed: "pj.ogiti"
	},
	{
		suffix: "ito.shizuoka.jp",
		reversed: "pj.akouzihs.oti"
	},
	{
		suffix: "itoigawa.niigata.jp",
		reversed: "pj.atagiin.awagioti"
	},
	{
		suffix: "itoman.okinawa.jp",
		reversed: "pj.awaniko.namoti"
	},
	{
		suffix: "its.me",
		reversed: "em.sti"
	},
	{
		suffix: "itv",
		reversed: "vti"
	},
	{
		suffix: "ivano-frankivsk.ua",
		reversed: "au.ksviknarf-onavi"
	},
	{
		suffix: "ivanovo.su",
		reversed: "us.ovonavi"
	},
	{
		suffix: "iveland.no",
		reversed: "on.dnalevi"
	},
	{
		suffix: "ivgu.no",
		reversed: "on.ugvi"
	},
	{
		suffix: "iwade.wakayama.jp",
		reversed: "pj.amayakaw.edawi"
	},
	{
		suffix: "iwafune.tochigi.jp",
		reversed: "pj.igihcot.enufawi"
	},
	{
		suffix: "iwaizumi.iwate.jp",
		reversed: "pj.etawi.imuziawi"
	},
	{
		suffix: "iwaki.fukushima.jp",
		reversed: "pj.amihsukuf.ikawi"
	},
	{
		suffix: "iwakuni.yamaguchi.jp",
		reversed: "pj.ihcugamay.inukawi"
	},
	{
		suffix: "iwakura.aichi.jp",
		reversed: "pj.ihcia.arukawi"
	},
	{
		suffix: "iwama.ibaraki.jp",
		reversed: "pj.ikarabi.amawi"
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
		suffix: "iwanuma.miyagi.jp",
		reversed: "pj.igayim.amunawi"
	},
	{
		suffix: "iwata.shizuoka.jp",
		reversed: "pj.akouzihs.atawi"
	},
	{
		suffix: "iwate.iwate.jp",
		reversed: "pj.etawi.etawi"
	},
	{
		suffix: "iwate.jp",
		reversed: "pj.etawi"
	},
	{
		suffix: "iwatsuki.saitama.jp",
		reversed: "pj.amatias.ikustawi"
	},
	{
		suffix: "iwi.nz",
		reversed: "zn.iwi"
	},
	{
		suffix: "iyo.ehime.jp",
		reversed: "pj.emihe.oyi"
	},
	{
		suffix: "iz.hr",
		reversed: "rh.zi"
	},
	{
		suffix: "izena.okinawa.jp",
		reversed: "pj.awaniko.anezi"
	},
	{
		suffix: "izu.shizuoka.jp",
		reversed: "pj.akouzihs.uzi"
	},
	{
		suffix: "izumi.kagoshima.jp",
		reversed: "pj.amihsogak.imuzi"
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
		suffix: "izumizaki.fukushima.jp",
		reversed: "pj.amihsukuf.ikazimuzi"
	},
	{
		suffix: "izumo.shimane.jp",
		reversed: "pj.enamihs.omuzi"
	},
	{
		suffix: "izumozaki.niigata.jp",
		reversed: "pj.atagiin.ikazomuzi"
	},
	{
		suffix: "izunokuni.shizuoka.jp",
		reversed: "pj.akouzihs.inukonuzi"
	},
	{
		suffix: "j.bg",
		reversed: "gb.j"
	},
	{
		suffix: "j.layershift.co.uk",
		reversed: "ku.oc.tfihsreyal.j"
	},
	{
		suffix: "j.scaleforce.com.cy",
		reversed: "yc.moc.ecrofelacs.j"
	},
	{
		suffix: "j.scaleforce.net",
		reversed: "ten.ecrofelacs.j"
	},
	{
		suffix: "jab.br",
		reversed: "rb.baj"
	},
	{
		suffix: "jaguar",
		reversed: "raugaj"
	},
	{
		suffix: "jambyl.su",
		reversed: "us.lybmaj"
	},
	{
		suffix: "jamison.museum",
		reversed: "muesum.nosimaj"
	},
	{
		suffix: "jampa.br",
		reversed: "rb.apmaj"
	},
	{
		suffix: "jan-mayen.no",
		reversed: "on.neyam-naj"
	},
	{
		suffix: "java",
		reversed: "avaj"
	},
	{
		suffix: "jaworzno.pl",
		reversed: "lp.onzrowaj"
	},
	{
		suffix: "jc.neen.it",
		reversed: "ti.neen.cj"
	},
	{
		suffix: "jcb",
		reversed: "bcj"
	},
	{
		suffix: "jcloud-ver-jpc.ik-server.com",
		reversed: "moc.revres-ki.cpj-rev-duolcj"
	},
	{
		suffix: "jcloud.ik-server.com",
		reversed: "moc.revres-ki.duolcj"
	},
	{
		suffix: "jcloud.kz",
		reversed: "zk.duolcj"
	},
	{
		suffix: "jdevcloud.com",
		reversed: "moc.duolcvedj"
	},
	{
		suffix: "jdf.br",
		reversed: "rb.fdj"
	},
	{
		suffix: "je",
		reversed: "ej"
	},
	{
		suffix: "jed.wafaicloud.com",
		reversed: "moc.duolciafaw.dej"
	},
	{
		suffix: "jeep",
		reversed: "peej"
	},
	{
		suffix: "jefferson.museum",
		reversed: "muesum.nosreffej"
	},
	{
		suffix: "jeju.kr",
		reversed: "rk.ujej"
	},
	{
		suffix: "jelastic.dogado.eu",
		reversed: "ue.odagod.citsalej"
	},
	{
		suffix: "jelastic.regruhosting.ru",
		reversed: "ur.gnitsohurger.citsalej"
	},
	{
		suffix: "jelastic.saveincloud.net",
		reversed: "ten.duolcnievas.citsalej"
	},
	{
		suffix: "jelastic.team",
		reversed: "maet.citsalej"
	},
	{
		suffix: "jelastic.tsukaeru.net",
		reversed: "ten.ureakust.citsalej"
	},
	{
		suffix: "jele.cloud",
		reversed: "duolc.elej"
	},
	{
		suffix: "jele.club",
		reversed: "bulc.elej"
	},
	{
		suffix: "jele.host",
		reversed: "tsoh.elej"
	},
	{
		suffix: "jele.io",
		reversed: "oi.elej"
	},
	{
		suffix: "jele.site",
		reversed: "etis.elej"
	},
	{
		suffix: "jelenia-gora.pl",
		reversed: "lp.arog-ainelej"
	},
	{
		suffix: "jellybean.jp",
		reversed: "pj.naebyllej"
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
		suffix: "jerusalem.museum",
		reversed: "muesum.melasurej"
	},
	{
		suffix: "jessheim.no",
		reversed: "on.miehssej"
	},
	{
		suffix: "jetzt",
		reversed: "tztej"
	},
	{
		suffix: "jevnaker.no",
		reversed: "on.rekanvej"
	},
	{
		suffix: "jewelry",
		reversed: "yrlewej"
	},
	{
		suffix: "jewelry.museum",
		reversed: "muesum.yrlewej"
	},
	{
		suffix: "jewish.museum",
		reversed: "muesum.hsiwej"
	},
	{
		suffix: "jewishart.museum",
		reversed: "muesum.trahsiwej"
	},
	{
		suffix: "jfk.museum",
		reversed: "muesum.kfj"
	},
	{
		suffix: "jgora.pl",
		reversed: "lp.arogj"
	},
	{
		suffix: "jinsekikogen.hiroshima.jp",
		reversed: "pj.amihsorih.negokikesnij"
	},
	{
		suffix: "jio",
		reversed: "oij"
	},
	{
		suffix: "jl.cn",
		reversed: "nc.lj"
	},
	{
		suffix: "jll",
		reversed: "llj"
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
		suffix: "jmp",
		reversed: "pmj"
	},
	{
		suffix: "jnj",
		reversed: "jnj"
	},
	{
		suffix: "jo",
		reversed: "oj"
	},
	{
		suffix: "joboji.iwate.jp",
		reversed: "pj.etawi.ijoboj"
	},
	{
		suffix: "jobs",
		reversed: "sboj"
	},
	{
		suffix: "jobs.tt",
		reversed: "tt.sboj"
	},
	{
		suffix: "joburg",
		reversed: "gruboj"
	},
	{
		suffix: "joetsu.niigata.jp",
		reversed: "pj.atagiin.usteoj"
	},
	{
		suffix: "jogasz.hu",
		reversed: "uh.zsagoj"
	},
	{
		suffix: "johana.toyama.jp",
		reversed: "pj.amayot.anahoj"
	},
	{
		suffix: "joinville.br",
		reversed: "rb.ellivnioj"
	},
	{
		suffix: "jolster.no",
		reversed: "on.retsloj"
	},
	{
		suffix: "jondal.no",
		reversed: "on.ladnoj"
	},
	{
		suffix: "jor.br",
		reversed: "rb.roj"
	},
	{
		suffix: "jorpeland.no",
		reversed: "on.dnaleproj"
	},
	{
		suffix: "joso.ibaraki.jp",
		reversed: "pj.ikarabi.osoj"
	},
	{
		suffix: "jot",
		reversed: "toj"
	},
	{
		suffix: "jotelulu.cloud",
		reversed: "duolc.ululetoj"
	},
	{
		suffix: "journal.aero",
		reversed: "orea.lanruoj"
	},
	{
		suffix: "journalism.museum",
		reversed: "muesum.msilanruoj"
	},
	{
		suffix: "journalist.aero",
		reversed: "orea.tsilanruoj"
	},
	{
		suffix: "joy",
		reversed: "yoj"
	},
	{
		suffix: "joyo.kyoto.jp",
		reversed: "pj.otoyk.oyoj"
	},
	{
		suffix: "jozi.biz",
		reversed: "zib.izoj"
	},
	{
		suffix: "jp",
		reversed: "pj"
	},
	{
		suffix: "jp.eu.org",
		reversed: "gro.ue.pj"
	},
	{
		suffix: "jp.kg",
		reversed: "gk.pj"
	},
	{
		suffix: "jp.md",
		reversed: "dm.pj"
	},
	{
		suffix: "jp.net",
		reversed: "ten.pj"
	},
	{
		suffix: "jpmorgan",
		reversed: "nagrompj"
	},
	{
		suffix: "jpn.com",
		reversed: "moc.npj"
	},
	{
		suffix: "jprs",
		reversed: "srpj"
	},
	{
		suffix: "js.cn",
		reversed: "nc.sj"
	},
	{
		suffix: "js.org",
		reversed: "gro.sj"
	},
	{
		suffix: "js.wpenginepowered.com",
		reversed: "moc.derewopenignepw.sj"
	},
	{
		suffix: "ju.mp",
		reversed: "pm.uj"
	},
	{
		suffix: "judaica.museum",
		reversed: "muesum.aciaduj"
	},
	{
		suffix: "judygarland.museum",
		reversed: "muesum.dnalragyduj"
	},
	{
		suffix: "juedisches.museum",
		reversed: "muesum.sehcsideuj"
	},
	{
		suffix: "juegos",
		reversed: "sogeuj"
	},
	{
		suffix: "juif.museum",
		reversed: "muesum.fiuj"
	},
	{
		suffix: "juniper",
		reversed: "repinuj"
	},
	{
		suffix: "jur.pro",
		reversed: "orp.ruj"
	},
	{
		suffix: "jus.br",
		reversed: "rb.suj"
	},
	{
		suffix: "jx.cn",
		reversed: "nc.xj"
	},
	{
		suffix: "jølster.no",
		reversed: "on.ayb-retslj--nx"
	},
	{
		suffix: "jørpeland.no",
		reversed: "on.a45-dnaleprj--nx"
	},
	{
		suffix: "k.bg",
		reversed: "gb.k"
	},
	{
		suffix: "k.se",
		reversed: "es.k"
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
		suffix: "k12.ec",
		reversed: "ce.21k"
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
		suffix: "k12.il",
		reversed: "li.21k"
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
		suffix: "k12.tr",
		reversed: "rt.21k"
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
		suffix: "k12.va.us",
		reversed: "su.av.21k"
	},
	{
		suffix: "k12.vi",
		reversed: "iv.21k"
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
		suffix: "k8s.fr-par.scw.cloud",
		reversed: "duolc.wcs.rap-rf.s8k"
	},
	{
		suffix: "k8s.nl-ams.scw.cloud",
		reversed: "duolc.wcs.sma-ln.s8k"
	},
	{
		suffix: "k8s.pl-waw.scw.cloud",
		reversed: "duolc.wcs.waw-lp.s8k"
	},
	{
		suffix: "k8s.scw.cloud",
		reversed: "duolc.wcs.s8k"
	},
	{
		suffix: "kaas.gg",
		reversed: "gg.saak"
	},
	{
		suffix: "kadena.okinawa.jp",
		reversed: "pj.awaniko.anedak"
	},
	{
		suffix: "kadogawa.miyazaki.jp",
		reversed: "pj.ikazayim.awagodak"
	},
	{
		suffix: "kadoma.osaka.jp",
		reversed: "pj.akaso.amodak"
	},
	{
		suffix: "kafjord.no",
		reversed: "on.drojfak"
	},
	{
		suffix: "kaga.ishikawa.jp",
		reversed: "pj.awakihsi.agak"
	},
	{
		suffix: "kagami.kochi.jp",
		reversed: "pj.ihcok.imagak"
	},
	{
		suffix: "kagamiishi.fukushima.jp",
		reversed: "pj.amihsukuf.ihsiimagak"
	},
	{
		suffix: "kagamino.okayama.jp",
		reversed: "pj.amayako.onimagak"
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
		suffix: "kagoshima.kagoshima.jp",
		reversed: "pj.amihsogak.amihsogak"
	},
	{
		suffix: "kaho.fukuoka.jp",
		reversed: "pj.akoukuf.ohak"
	},
	{
		suffix: "kahoku.ishikawa.jp",
		reversed: "pj.awakihsi.ukohak"
	},
	{
		suffix: "kahoku.yamagata.jp",
		reversed: "pj.atagamay.ukohak"
	},
	{
		suffix: "kai.yamanashi.jp",
		reversed: "pj.ihsanamay.iak"
	},
	{
		suffix: "kainan.tokushima.jp",
		reversed: "pj.amihsukot.naniak"
	},
	{
		suffix: "kainan.wakayama.jp",
		reversed: "pj.amayakaw.naniak"
	},
	{
		suffix: "kaisei.kanagawa.jp",
		reversed: "pj.awaganak.iesiak"
	},
	{
		suffix: "kaita.hiroshima.jp",
		reversed: "pj.amihsorih.atiak"
	},
	{
		suffix: "kaizuka.osaka.jp",
		reversed: "pj.akaso.akuziak"
	},
	{
		suffix: "kakamigahara.gifu.jp",
		reversed: "pj.ufig.arahagimakak"
	},
	{
		suffix: "kakegawa.shizuoka.jp",
		reversed: "pj.akouzihs.awagekak"
	},
	{
		suffix: "kakinoki.shimane.jp",
		reversed: "pj.enamihs.ikonikak"
	},
	{
		suffix: "kakogawa.hyogo.jp",
		reversed: "pj.ogoyh.awagokak"
	},
	{
		suffix: "kakuda.miyagi.jp",
		reversed: "pj.igayim.adukak"
	},
	{
		suffix: "kalisz.pl",
		reversed: "lp.zsilak"
	},
	{
		suffix: "kalmykia.ru",
		reversed: "ur.aikymlak"
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
		suffix: "kamagaya.chiba.jp",
		reversed: "pj.abihc.ayagamak"
	},
	{
		suffix: "kamaishi.iwate.jp",
		reversed: "pj.etawi.ihsiamak"
	},
	{
		suffix: "kamakura.kanagawa.jp",
		reversed: "pj.awaganak.arukamak"
	},
	{
		suffix: "kameoka.kyoto.jp",
		reversed: "pj.otoyk.akoemak"
	},
	{
		suffix: "kameyama.mie.jp",
		reversed: "pj.eim.amayemak"
	},
	{
		suffix: "kami.kochi.jp",
		reversed: "pj.ihcok.imak"
	},
	{
		suffix: "kami.miyagi.jp",
		reversed: "pj.igayim.imak"
	},
	{
		suffix: "kamiamakusa.kumamoto.jp",
		reversed: "pj.otomamuk.asukamaimak"
	},
	{
		suffix: "kamifurano.hokkaido.jp",
		reversed: "pj.odiakkoh.onarufimak"
	},
	{
		suffix: "kamigori.hyogo.jp",
		reversed: "pj.ogoyh.irogimak"
	},
	{
		suffix: "kamiichi.toyama.jp",
		reversed: "pj.amayot.ihciimak"
	},
	{
		suffix: "kamiizumi.saitama.jp",
		reversed: "pj.amatias.imuziimak"
	},
	{
		suffix: "kamijima.ehime.jp",
		reversed: "pj.emihe.amijimak"
	},
	{
		suffix: "kamikawa.hokkaido.jp",
		reversed: "pj.odiakkoh.awakimak"
	},
	{
		suffix: "kamikawa.hyogo.jp",
		reversed: "pj.ogoyh.awakimak"
	},
	{
		suffix: "kamikawa.saitama.jp",
		reversed: "pj.amatias.awakimak"
	},
	{
		suffix: "kamikitayama.nara.jp",
		reversed: "pj.aran.amayatikimak"
	},
	{
		suffix: "kamikoani.akita.jp",
		reversed: "pj.atika.inaokimak"
	},
	{
		suffix: "kamimine.saga.jp",
		reversed: "pj.agas.enimimak"
	},
	{
		suffix: "kaminokawa.tochigi.jp",
		reversed: "pj.igihcot.awakonimak"
	},
	{
		suffix: "kaminoyama.yamagata.jp",
		reversed: "pj.atagamay.amayonimak"
	},
	{
		suffix: "kamioka.akita.jp",
		reversed: "pj.atika.akoimak"
	},
	{
		suffix: "kamisato.saitama.jp",
		reversed: "pj.amatias.otasimak"
	},
	{
		suffix: "kamishihoro.hokkaido.jp",
		reversed: "pj.odiakkoh.orohihsimak"
	},
	{
		suffix: "kamisu.ibaraki.jp",
		reversed: "pj.ikarabi.usimak"
	},
	{
		suffix: "kamisunagawa.hokkaido.jp",
		reversed: "pj.odiakkoh.awaganusimak"
	},
	{
		suffix: "kamitonda.wakayama.jp",
		reversed: "pj.amayakaw.adnotimak"
	},
	{
		suffix: "kamitsue.oita.jp",
		reversed: "pj.atio.eustimak"
	},
	{
		suffix: "kamo.kyoto.jp",
		reversed: "pj.otoyk.omak"
	},
	{
		suffix: "kamo.niigata.jp",
		reversed: "pj.atagiin.omak"
	},
	{
		suffix: "kamoenai.hokkaido.jp",
		reversed: "pj.odiakkoh.ianeomak"
	},
	{
		suffix: "kamogawa.chiba.jp",
		reversed: "pj.abihc.awagomak"
	},
	{
		suffix: "kanagawa.jp",
		reversed: "pj.awaganak"
	},
	{
		suffix: "kanan.osaka.jp",
		reversed: "pj.akaso.nanak"
	},
	{
		suffix: "kanazawa.ishikawa.jp",
		reversed: "pj.awakihsi.awazanak"
	},
	{
		suffix: "kanegasaki.iwate.jp",
		reversed: "pj.etawi.ikasagenak"
	},
	{
		suffix: "kaneyama.fukushima.jp",
		reversed: "pj.amihsukuf.amayenak"
	},
	{
		suffix: "kaneyama.yamagata.jp",
		reversed: "pj.atagamay.amayenak"
	},
	{
		suffix: "kani.gifu.jp",
		reversed: "pj.ufig.inak"
	},
	{
		suffix: "kanie.aichi.jp",
		reversed: "pj.ihcia.einak"
	},
	{
		suffix: "kanmaki.nara.jp",
		reversed: "pj.aran.ikamnak"
	},
	{
		suffix: "kanna.gunma.jp",
		reversed: "pj.amnug.annak"
	},
	{
		suffix: "kannami.shizuoka.jp",
		reversed: "pj.akouzihs.imannak"
	},
	{
		suffix: "kanonji.kagawa.jp",
		reversed: "pj.awagak.ijnonak"
	},
	{
		suffix: "kanoya.kagoshima.jp",
		reversed: "pj.amihsogak.ayonak"
	},
	{
		suffix: "kanra.gunma.jp",
		reversed: "pj.amnug.arnak"
	},
	{
		suffix: "kanuma.tochigi.jp",
		reversed: "pj.igihcot.amunak"
	},
	{
		suffix: "kanzaki.saga.jp",
		reversed: "pj.agas.ikaznak"
	},
	{
		suffix: "kapsi.fi",
		reversed: "if.ispak"
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
		suffix: "karasjohka.no",
		reversed: "on.akhojsarak"
	},
	{
		suffix: "karasjok.no",
		reversed: "on.kojsarak"
	},
	{
		suffix: "karasuyama.tochigi.jp",
		reversed: "pj.igihcot.amayusarak"
	},
	{
		suffix: "karate.museum",
		reversed: "muesum.etarak"
	},
	{
		suffix: "karatsu.saga.jp",
		reversed: "pj.agas.ustarak"
	},
	{
		suffix: "karelia.su",
		reversed: "us.ailerak"
	},
	{
		suffix: "karikatur.museum",
		reversed: "muesum.rutakirak"
	},
	{
		suffix: "kariwa.niigata.jp",
		reversed: "pj.atagiin.awirak"
	},
	{
		suffix: "kariya.aichi.jp",
		reversed: "pj.ihcia.ayirak"
	},
	{
		suffix: "karlsoy.no",
		reversed: "on.yoslrak"
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
		suffix: "karpacz.pl",
		reversed: "lp.zcaprak"
	},
	{
		suffix: "kartuzy.pl",
		reversed: "lp.yzutrak"
	},
	{
		suffix: "karuizawa.nagano.jp",
		reversed: "pj.onagan.awaziurak"
	},
	{
		suffix: "karumai.iwate.jp",
		reversed: "pj.etawi.iamurak"
	},
	{
		suffix: "kasahara.gifu.jp",
		reversed: "pj.ufig.arahasak"
	},
	{
		suffix: "kasai.hyogo.jp",
		reversed: "pj.ogoyh.iasak"
	},
	{
		suffix: "kasama.ibaraki.jp",
		reversed: "pj.ikarabi.amasak"
	},
	{
		suffix: "kasamatsu.gifu.jp",
		reversed: "pj.ufig.ustamasak"
	},
	{
		suffix: "kasaoka.okayama.jp",
		reversed: "pj.amayako.akoasak"
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
		suffix: "kashima.ibaraki.jp",
		reversed: "pj.ikarabi.amihsak"
	},
	{
		suffix: "kashima.saga.jp",
		reversed: "pj.agas.amihsak"
	},
	{
		suffix: "kashiwa.chiba.jp",
		reversed: "pj.abihc.awihsak"
	},
	{
		suffix: "kashiwara.osaka.jp",
		reversed: "pj.akaso.arawihsak"
	},
	{
		suffix: "kashiwazaki.niigata.jp",
		reversed: "pj.atagiin.ikazawihsak"
	},
	{
		suffix: "kasserver.com",
		reversed: "moc.revressak"
	},
	{
		suffix: "kasuga.fukuoka.jp",
		reversed: "pj.akoukuf.agusak"
	},
	{
		suffix: "kasuga.hyogo.jp",
		reversed: "pj.ogoyh.agusak"
	},
	{
		suffix: "kasugai.aichi.jp",
		reversed: "pj.ihcia.iagusak"
	},
	{
		suffix: "kasukabe.saitama.jp",
		reversed: "pj.amatias.ebakusak"
	},
	{
		suffix: "kasumigaura.ibaraki.jp",
		reversed: "pj.ikarabi.aruagimusak"
	},
	{
		suffix: "kasuya.fukuoka.jp",
		reversed: "pj.akoukuf.ayusak"
	},
	{
		suffix: "kaszuby.pl",
		reversed: "lp.ybuzsak"
	},
	{
		suffix: "katagami.akita.jp",
		reversed: "pj.atika.imagatak"
	},
	{
		suffix: "katano.osaka.jp",
		reversed: "pj.akaso.onatak"
	},
	{
		suffix: "katashina.gunma.jp",
		reversed: "pj.amnug.anihsatak"
	},
	{
		suffix: "katori.chiba.jp",
		reversed: "pj.abihc.irotak"
	},
	{
		suffix: "katowice.pl",
		reversed: "lp.eciwotak"
	},
	{
		suffix: "katsuragi.nara.jp",
		reversed: "pj.aran.igarustak"
	},
	{
		suffix: "katsuragi.wakayama.jp",
		reversed: "pj.amayakaw.igarustak"
	},
	{
		suffix: "katsushika.tokyo.jp",
		reversed: "pj.oykot.akihsustak"
	},
	{
		suffix: "katsuura.chiba.jp",
		reversed: "pj.abihc.aruustak"
	},
	{
		suffix: "katsuyama.fukui.jp",
		reversed: "pj.iukuf.amayustak"
	},
	{
		suffix: "kaufen",
		reversed: "nefuak"
	},
	{
		suffix: "kautokeino.no",
		reversed: "on.oniekotuak"
	},
	{
		suffix: "kawaba.gunma.jp",
		reversed: "pj.amnug.abawak"
	},
	{
		suffix: "kawachinagano.osaka.jp",
		reversed: "pj.akaso.onaganihcawak"
	},
	{
		suffix: "kawagoe.mie.jp",
		reversed: "pj.eim.eogawak"
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
		suffix: "kawahara.tottori.jp",
		reversed: "pj.irottot.arahawak"
	},
	{
		suffix: "kawai.iwate.jp",
		reversed: "pj.etawi.iawak"
	},
	{
		suffix: "kawai.nara.jp",
		reversed: "pj.aran.iawak"
	},
	{
		suffix: "kawaiishop.jp",
		reversed: "pj.pohsiiawak"
	},
	{
		suffix: "kawajima.saitama.jp",
		reversed: "pj.amatias.amijawak"
	},
	{
		suffix: "kawakami.nagano.jp",
		reversed: "pj.onagan.imakawak"
	},
	{
		suffix: "kawakami.nara.jp",
		reversed: "pj.aran.imakawak"
	},
	{
		suffix: "kawakita.ishikawa.jp",
		reversed: "pj.awakihsi.atikawak"
	},
	{
		suffix: "kawamata.fukushima.jp",
		reversed: "pj.amihsukuf.atamawak"
	},
	{
		suffix: "kawaminami.miyazaki.jp",
		reversed: "pj.ikazayim.imanimawak"
	},
	{
		suffix: "kawanabe.kagoshima.jp",
		reversed: "pj.amihsogak.ebanawak"
	},
	{
		suffix: "kawanehon.shizuoka.jp",
		reversed: "pj.akouzihs.nohenawak"
	},
	{
		suffix: "kawanishi.hyogo.jp",
		reversed: "pj.ogoyh.ihsinawak"
	},
	{
		suffix: "kawanishi.nara.jp",
		reversed: "pj.aran.ihsinawak"
	},
	{
		suffix: "kawanishi.yamagata.jp",
		reversed: "pj.atagamay.ihsinawak"
	},
	{
		suffix: "kawara.fukuoka.jp",
		reversed: "pj.akoukuf.arawak"
	},
	{
		suffix: "kawasaki.miyagi.jp",
		reversed: "pj.igayim.ikasawak"
	},
	{
		suffix: "kawatana.nagasaki.jp",
		reversed: "pj.ikasagan.anatawak"
	},
	{
		suffix: "kawaue.gifu.jp",
		reversed: "pj.ufig.euawak"
	},
	{
		suffix: "kawazu.shizuoka.jp",
		reversed: "pj.akouzihs.uzawak"
	},
	{
		suffix: "kayabe.hokkaido.jp",
		reversed: "pj.odiakkoh.ebayak"
	},
	{
		suffix: "kazimierz-dolny.pl",
		reversed: "lp.ynlod-zreimizak"
	},
	{
		suffix: "kazo.saitama.jp",
		reversed: "pj.amatias.ozak"
	},
	{
		suffix: "kazuno.akita.jp",
		reversed: "pj.atika.onuzak"
	},
	{
		suffix: "kddi",
		reversed: "iddk"
	},
	{
		suffix: "ke",
		reversed: "ek"
	},
	{
		suffix: "keisen.fukuoka.jp",
		reversed: "pj.akoukuf.nesiek"
	},
	{
		suffix: "keliweb.cloud",
		reversed: "duolc.bewilek"
	},
	{
		suffix: "kembuchi.hokkaido.jp",
		reversed: "pj.odiakkoh.ihcubmek"
	},
	{
		suffix: "kep.tr",
		reversed: "rt.pek"
	},
	{
		suffix: "kepno.pl",
		reversed: "lp.onpek"
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
		suffix: "ketrzyn.pl",
		reversed: "lp.nyzrtek"
	},
	{
		suffix: "keymachine.de",
		reversed: "ed.enihcamyek"
	},
	{
		suffix: "kfh",
		reversed: "hfk"
	},
	{
		suffix: "kg",
		reversed: "gk"
	},
	{
		suffix: "kg.kr",
		reversed: "rk.gk"
	},
	{
		suffix: "kh.ua",
		reversed: "au.hk"
	},
	{
		suffix: "khakassia.su",
		reversed: "us.aissakahk"
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
		suffix: "khplay.nl",
		reversed: "ln.yalphk"
	},
	{
		suffix: "ki",
		reversed: "ik"
	},
	{
		suffix: "kia",
		reversed: "aik"
	},
	{
		suffix: "kibichuo.okayama.jp",
		reversed: "pj.amayako.ouhcibik"
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
		suffix: "kids",
		reversed: "sdik"
	},
	{
		suffix: "kids.museum",
		reversed: "muesum.sdik"
	},
	{
		suffix: "kids.us",
		reversed: "su.sdik"
	},
	{
		suffix: "kiev.ua",
		reversed: "au.veik"
	},
	{
		suffix: "kiho.mie.jp",
		reversed: "pj.eim.ohik"
	},
	{
		suffix: "kihoku.ehime.jp",
		reversed: "pj.emihe.ukohik"
	},
	{
		suffix: "kijo.miyazaki.jp",
		reversed: "pj.ikazayim.ojik"
	},
	{
		suffix: "kikirara.jp",
		reversed: "pj.ararikik"
	},
	{
		suffix: "kikonai.hokkaido.jp",
		reversed: "pj.odiakkoh.ianokik"
	},
	{
		suffix: "kikuchi.kumamoto.jp",
		reversed: "pj.otomamuk.ihcukik"
	},
	{
		suffix: "kikugawa.shizuoka.jp",
		reversed: "pj.akouzihs.awagukik"
	},
	{
		suffix: "kilatiron.com",
		reversed: "moc.noritalik"
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
		suffix: "kim",
		reversed: "mik"
	},
	{
		suffix: "kimino.wakayama.jp",
		reversed: "pj.amayakaw.onimik"
	},
	{
		suffix: "kimitsu.chiba.jp",
		reversed: "pj.abihc.ustimik"
	},
	{
		suffix: "kimobetsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustebomik"
	},
	{
		suffix: "kin.okinawa.jp",
		reversed: "pj.awaniko.nik"
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
		suffix: "kinghost.net",
		reversed: "ten.tsohgnik"
	},
	{
		suffix: "kinko.kagoshima.jp",
		reversed: "pj.amihsogak.oknik"
	},
	{
		suffix: "kinokawa.wakayama.jp",
		reversed: "pj.amayakaw.awakonik"
	},
	{
		suffix: "kira.aichi.jp",
		reversed: "pj.ihcia.arik"
	},
	{
		suffix: "kirkenes.no",
		reversed: "on.senekrik"
	},
	{
		suffix: "kirovograd.ua",
		reversed: "au.dargovorik"
	},
	{
		suffix: "kiryu.gunma.jp",
		reversed: "pj.amnug.uyrik"
	},
	{
		suffix: "kisarazu.chiba.jp",
		reversed: "pj.abihc.uzarasik"
	},
	{
		suffix: "kishiwada.osaka.jp",
		reversed: "pj.akaso.adawihsik"
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
		suffix: "kisosaki.mie.jp",
		reversed: "pj.eim.ikasosik"
	},
	{
		suffix: "kita.kyoto.jp",
		reversed: "pj.otoyk.atik"
	},
	{
		suffix: "kita.osaka.jp",
		reversed: "pj.akaso.atik"
	},
	{
		suffix: "kita.tokyo.jp",
		reversed: "pj.oykot.atik"
	},
	{
		suffix: "kitaaiki.nagano.jp",
		reversed: "pj.onagan.ikiaatik"
	},
	{
		suffix: "kitaakita.akita.jp",
		reversed: "pj.atika.atikaatik"
	},
	{
		suffix: "kitadaito.okinawa.jp",
		reversed: "pj.awaniko.otiadatik"
	},
	{
		suffix: "kitagata.gifu.jp",
		reversed: "pj.ufig.atagatik"
	},
	{
		suffix: "kitagata.saga.jp",
		reversed: "pj.agas.atagatik"
	},
	{
		suffix: "kitagawa.kochi.jp",
		reversed: "pj.ihcok.awagatik"
	},
	{
		suffix: "kitagawa.miyazaki.jp",
		reversed: "pj.ikazayim.awagatik"
	},
	{
		suffix: "kitahata.saga.jp",
		reversed: "pj.agas.atahatik"
	},
	{
		suffix: "kitahiroshima.hokkaido.jp",
		reversed: "pj.odiakkoh.amihsorihatik"
	},
	{
		suffix: "kitakami.iwate.jp",
		reversed: "pj.etawi.imakatik"
	},
	{
		suffix: "kitakata.fukushima.jp",
		reversed: "pj.amihsukuf.atakatik"
	},
	{
		suffix: "kitakata.miyazaki.jp",
		reversed: "pj.ikazayim.atakatik"
	},
	{
		suffix: "kitami.hokkaido.jp",
		reversed: "pj.odiakkoh.imatik"
	},
	{
		suffix: "kitamoto.saitama.jp",
		reversed: "pj.amatias.otomatik"
	},
	{
		suffix: "kitanakagusuku.okinawa.jp",
		reversed: "pj.awaniko.ukusugakanatik"
	},
	{
		suffix: "kitashiobara.fukushima.jp",
		reversed: "pj.amihsukuf.araboihsatik"
	},
	{
		suffix: "kitaura.miyazaki.jp",
		reversed: "pj.ikazayim.aruatik"
	},
	{
		suffix: "kitayama.wakayama.jp",
		reversed: "pj.amayakaw.amayatik"
	},
	{
		suffix: "kitchen",
		reversed: "nehctik"
	},
	{
		suffix: "kiwa.mie.jp",
		reversed: "pj.eim.awik"
	},
	{
		suffix: "kiwi",
		reversed: "iwik"
	},
	{
		suffix: "kiwi.nz",
		reversed: "zn.iwik"
	},
	{
		suffix: "kiyama.saga.jp",
		reversed: "pj.agas.amayik"
	},
	{
		suffix: "kiyokawa.kanagawa.jp",
		reversed: "pj.awaganak.awakoyik"
	},
	{
		suffix: "kiyosato.hokkaido.jp",
		reversed: "pj.odiakkoh.otasoyik"
	},
	{
		suffix: "kiyose.tokyo.jp",
		reversed: "pj.oykot.esoyik"
	},
	{
		suffix: "kiyosu.aichi.jp",
		reversed: "pj.ihcia.usoyik"
	},
	{
		suffix: "kizu.kyoto.jp",
		reversed: "pj.otoyk.uzik"
	},
	{
		suffix: "klabu.no",
		reversed: "on.ubalk"
	},
	{
		suffix: "klepp.no",
		reversed: "on.ppelk"
	},
	{
		suffix: "klodzko.pl",
		reversed: "lp.okzdolk"
	},
	{
		suffix: "klæbu.no",
		reversed: "on.aow-ublk--nx"
	},
	{
		suffix: "km",
		reversed: "mk"
	},
	{
		suffix: "km.ua",
		reversed: "au.mk"
	},
	{
		suffix: "kmpsp.gov.pl",
		reversed: "lp.vog.pspmk"
	},
	{
		suffix: "kn",
		reversed: "nk"
	},
	{
		suffix: "knightpoint.systems",
		reversed: "smetsys.tniopthgink"
	},
	{
		suffix: "knowsitall.info",
		reversed: "ofni.llatiswonk"
	},
	{
		suffix: "knx-server.net",
		reversed: "ten.revres-xnk"
	},
	{
		suffix: "kobayashi.miyazaki.jp",
		reversed: "pj.ikazayim.ihsayabok"
	},
	{
		suffix: "kobierzyce.pl",
		reversed: "lp.ecyzreibok"
	},
	{
		suffix: "kochi.jp",
		reversed: "pj.ihcok"
	},
	{
		suffix: "kochi.kochi.jp",
		reversed: "pj.ihcok.ihcok"
	},
	{
		suffix: "kodaira.tokyo.jp",
		reversed: "pj.oykot.ariadok"
	},
	{
		suffix: "koebenhavn.museum",
		reversed: "muesum.nvahnebeok"
	},
	{
		suffix: "koeln",
		reversed: "nleok"
	},
	{
		suffix: "koeln.museum",
		reversed: "muesum.nleok"
	},
	{
		suffix: "kofu.yamanashi.jp",
		reversed: "pj.ihsanamay.ufok"
	},
	{
		suffix: "koga.fukuoka.jp",
		reversed: "pj.akoukuf.agok"
	},
	{
		suffix: "koga.ibaraki.jp",
		reversed: "pj.ikarabi.agok"
	},
	{
		suffix: "koganei.tokyo.jp",
		reversed: "pj.oykot.ienagok"
	},
	{
		suffix: "koge.tottori.jp",
		reversed: "pj.irottot.egok"
	},
	{
		suffix: "koka.shiga.jp",
		reversed: "pj.agihs.akok"
	},
	{
		suffix: "kokonoe.oita.jp",
		reversed: "pj.atio.eonokok"
	},
	{
		suffix: "kokubunji.tokyo.jp",
		reversed: "pj.oykot.ijnubukok"
	},
	{
		suffix: "kolobrzeg.pl",
		reversed: "lp.gezrbolok"
	},
	{
		suffix: "komae.tokyo.jp",
		reversed: "pj.oykot.eamok"
	},
	{
		suffix: "komagane.nagano.jp",
		reversed: "pj.onagan.enagamok"
	},
	{
		suffix: "komaki.aichi.jp",
		reversed: "pj.ihcia.ikamok"
	},
	{
		suffix: "komatsu",
		reversed: "ustamok"
	},
	{
		suffix: "komatsu.ishikawa.jp",
		reversed: "pj.awakihsi.ustamok"
	},
	{
		suffix: "komatsushima.tokushima.jp",
		reversed: "pj.amihsukot.amihsustamok"
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
		suffix: "kommune.no",
		reversed: "on.enummok"
	},
	{
		suffix: "komono.mie.jp",
		reversed: "pj.eim.onomok"
	},
	{
		suffix: "komoro.nagano.jp",
		reversed: "pj.onagan.oromok"
	},
	{
		suffix: "komvux.se",
		reversed: "es.xuvmok"
	},
	{
		suffix: "konan.aichi.jp",
		reversed: "pj.ihcia.nanok"
	},
	{
		suffix: "konan.shiga.jp",
		reversed: "pj.agihs.nanok"
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
		suffix: "konin.pl",
		reversed: "lp.ninok"
	},
	{
		suffix: "konskowola.pl",
		reversed: "lp.alowoksnok"
	},
	{
		suffix: "konsulat.gov.pl",
		reversed: "lp.vog.talusnok"
	},
	{
		suffix: "konyvelo.hu",
		reversed: "uh.olevynok"
	},
	{
		suffix: "koobin.events",
		reversed: "stneve.nibook"
	},
	{
		suffix: "koori.fukushima.jp",
		reversed: "pj.amihsukuf.irook"
	},
	{
		suffix: "kopervik.no",
		reversed: "on.kivrepok"
	},
	{
		suffix: "koriyama.fukushima.jp",
		reversed: "pj.amihsukuf.amayirok"
	},
	{
		suffix: "koryo.nara.jp",
		reversed: "pj.aran.oyrok"
	},
	{
		suffix: "kosai.shizuoka.jp",
		reversed: "pj.akouzihs.iasok"
	},
	{
		suffix: "kosaka.akita.jp",
		reversed: "pj.atika.akasok"
	},
	{
		suffix: "kosei.shiga.jp",
		reversed: "pj.agihs.iesok"
	},
	{
		suffix: "kosher",
		reversed: "rehsok"
	},
	{
		suffix: "koshigaya.saitama.jp",
		reversed: "pj.amatias.ayagihsok"
	},
	{
		suffix: "koshimizu.hokkaido.jp",
		reversed: "pj.odiakkoh.uzimihsok"
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
		suffix: "kota.aichi.jp",
		reversed: "pj.ihcia.atok"
	},
	{
		suffix: "koto.shiga.jp",
		reversed: "pj.agihs.otok"
	},
	{
		suffix: "koto.tokyo.jp",
		reversed: "pj.oykot.otok"
	},
	{
		suffix: "kotohira.kagawa.jp",
		reversed: "pj.awagak.arihotok"
	},
	{
		suffix: "kotoura.tottori.jp",
		reversed: "pj.irottot.aruotok"
	},
	{
		suffix: "kouhoku.saga.jp",
		reversed: "pj.agas.ukohuok"
	},
	{
		suffix: "kounosu.saitama.jp",
		reversed: "pj.amatias.usonuok"
	},
	{
		suffix: "kouyama.kagoshima.jp",
		reversed: "pj.amihsogak.amayuok"
	},
	{
		suffix: "kouzushima.tokyo.jp",
		reversed: "pj.oykot.amihsuzuok"
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
		suffix: "kozaki.chiba.jp",
		reversed: "pj.abihc.ikazok"
	},
	{
		suffix: "kozow.com",
		reversed: "moc.wozok"
	},
	{
		suffix: "kp",
		reversed: "pk"
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
		suffix: "kppsp.gov.pl",
		reversed: "lp.vog.psppk"
	},
	{
		suffix: "kr",
		reversed: "rk"
	},
	{
		suffix: "kr.com",
		reversed: "moc.rk"
	},
	{
		suffix: "kr.eu.org",
		reversed: "gro.ue.rk"
	},
	{
		suffix: "kr.it",
		reversed: "ti.rk"
	},
	{
		suffix: "kr.ua",
		reversed: "au.rk"
	},
	{
		suffix: "kraanghke.no",
		reversed: "on.ekhgnaark"
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
		suffix: "krakow.pl",
		reversed: "lp.wokark"
	},
	{
		suffix: "krasnik.pl",
		reversed: "lp.kinsark"
	},
	{
		suffix: "krasnodar.su",
		reversed: "us.radonsark"
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
		suffix: "krellian.net",
		reversed: "ten.naillerk"
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
		suffix: "krokstadelva.no",
		reversed: "on.avledatskork"
	},
	{
		suffix: "krym.ua",
		reversed: "au.myrk"
	},
	{
		suffix: "kråanghke.no",
		reversed: "on.a0b-ekhgnark--nx"
	},
	{
		suffix: "krødsherad.no",
		reversed: "on.a8m-darehsdrk--nx"
	},
	{
		suffix: "ks.ua",
		reversed: "au.sk"
	},
	{
		suffix: "ks.us",
		reversed: "su.sk"
	},
	{
		suffix: "ktistory.com",
		reversed: "moc.yrotsitk"
	},
	{
		suffix: "kuchinotsu.nagasaki.jp",
		reversed: "pj.ikasagan.ustonihcuk"
	},
	{
		suffix: "kudamatsu.yamaguchi.jp",
		reversed: "pj.ihcugamay.ustamaduk"
	},
	{
		suffix: "kudoyama.wakayama.jp",
		reversed: "pj.amayakaw.amayoduk"
	},
	{
		suffix: "kui.hiroshima.jp",
		reversed: "pj.amihsorih.iuk"
	},
	{
		suffix: "kuji.iwate.jp",
		reversed: "pj.etawi.ijuk"
	},
	{
		suffix: "kuju.oita.jp",
		reversed: "pj.atio.ujuk"
	},
	{
		suffix: "kujukuri.chiba.jp",
		reversed: "pj.abihc.irukujuk"
	},
	{
		suffix: "kuki.saitama.jp",
		reversed: "pj.amatias.ikuk"
	},
	{
		suffix: "kuleuven.cloud",
		reversed: "duolc.nevueluk"
	},
	{
		suffix: "kumagaya.saitama.jp",
		reversed: "pj.amatias.ayagamuk"
	},
	{
		suffix: "kumakogen.ehime.jp",
		reversed: "pj.emihe.negokamuk"
	},
	{
		suffix: "kumamoto.jp",
		reversed: "pj.otomamuk"
	},
	{
		suffix: "kumamoto.kumamoto.jp",
		reversed: "pj.otomamuk.otomamuk"
	},
	{
		suffix: "kumano.hiroshima.jp",
		reversed: "pj.amihsorih.onamuk"
	},
	{
		suffix: "kumano.mie.jp",
		reversed: "pj.eim.onamuk"
	},
	{
		suffix: "kumatori.osaka.jp",
		reversed: "pj.akaso.irotamuk"
	},
	{
		suffix: "kumejima.okinawa.jp",
		reversed: "pj.awaniko.amijemuk"
	},
	{
		suffix: "kumenan.okayama.jp",
		reversed: "pj.amayako.nanemuk"
	},
	{
		suffix: "kumiyama.kyoto.jp",
		reversed: "pj.otoyk.amayimuk"
	},
	{
		suffix: "kunigami.okinawa.jp",
		reversed: "pj.awaniko.imaginuk"
	},
	{
		suffix: "kunimi.fukushima.jp",
		reversed: "pj.amihsukuf.iminuk"
	},
	{
		suffix: "kunisaki.oita.jp",
		reversed: "pj.atio.ikasinuk"
	},
	{
		suffix: "kunitachi.tokyo.jp",
		reversed: "pj.oykot.ihcatinuk"
	},
	{
		suffix: "kunitomi.miyazaki.jp",
		reversed: "pj.ikazayim.imotinuk"
	},
	{
		suffix: "kunneppu.hokkaido.jp",
		reversed: "pj.odiakkoh.uppennuk"
	},
	{
		suffix: "kunohe.iwate.jp",
		reversed: "pj.etawi.ehonuk"
	},
	{
		suffix: "kunst.museum",
		reversed: "muesum.tsnuk"
	},
	{
		suffix: "kunstsammlung.museum",
		reversed: "muesum.gnulmmastsnuk"
	},
	{
		suffix: "kunstunddesign.museum",
		reversed: "muesum.ngiseddnutsnuk"
	},
	{
		suffix: "kuokgroup",
		reversed: "puorgkouk"
	},
	{
		suffix: "kurashiki.okayama.jp",
		reversed: "pj.amayako.ikihsaruk"
	},
	{
		suffix: "kurate.fukuoka.jp",
		reversed: "pj.akoukuf.etaruk"
	},
	{
		suffix: "kure.hiroshima.jp",
		reversed: "pj.amihsorih.eruk"
	},
	{
		suffix: "kurgan.su",
		reversed: "us.nagruk"
	},
	{
		suffix: "kuriyama.hokkaido.jp",
		reversed: "pj.odiakkoh.amayiruk"
	},
	{
		suffix: "kurobe.toyama.jp",
		reversed: "pj.amayot.eboruk"
	},
	{
		suffix: "kurogi.fukuoka.jp",
		reversed: "pj.akoukuf.igoruk"
	},
	{
		suffix: "kuroishi.aomori.jp",
		reversed: "pj.iromoa.ihsioruk"
	},
	{
		suffix: "kuroiso.tochigi.jp",
		reversed: "pj.igihcot.osioruk"
	},
	{
		suffix: "kuromatsunai.hokkaido.jp",
		reversed: "pj.odiakkoh.ianustamoruk"
	},
	{
		suffix: "kuron.jp",
		reversed: "pj.noruk"
	},
	{
		suffix: "kurotaki.nara.jp",
		reversed: "pj.aran.ikatoruk"
	},
	{
		suffix: "kurume.fukuoka.jp",
		reversed: "pj.akoukuf.emuruk"
	},
	{
		suffix: "kusatsu.gunma.jp",
		reversed: "pj.amnug.ustasuk"
	},
	{
		suffix: "kusatsu.shiga.jp",
		reversed: "pj.agihs.ustasuk"
	},
	{
		suffix: "kushima.miyazaki.jp",
		reversed: "pj.ikazayim.amihsuk"
	},
	{
		suffix: "kushimoto.wakayama.jp",
		reversed: "pj.amayakaw.otomihsuk"
	},
	{
		suffix: "kushiro.hokkaido.jp",
		reversed: "pj.odiakkoh.orihsuk"
	},
	{
		suffix: "kustanai.ru",
		reversed: "ur.ianatsuk"
	},
	{
		suffix: "kustanai.su",
		reversed: "us.ianatsuk"
	},
	{
		suffix: "kusu.oita.jp",
		reversed: "pj.atio.usuk"
	},
	{
		suffix: "kutchan.hokkaido.jp",
		reversed: "pj.odiakkoh.nahctuk"
	},
	{
		suffix: "kutno.pl",
		reversed: "lp.ontuk"
	},
	{
		suffix: "kuwana.mie.jp",
		reversed: "pj.eim.anawuk"
	},
	{
		suffix: "kuzumaki.iwate.jp",
		reversed: "pj.etawi.ikamuzuk"
	},
	{
		suffix: "kv.ua",
		reversed: "au.vk"
	},
	{
		suffix: "kvafjord.no",
		reversed: "on.drojfavk"
	},
	{
		suffix: "kvalsund.no",
		reversed: "on.dnuslavk"
	},
	{
		suffix: "kvam.no",
		reversed: "on.mavk"
	},
	{
		suffix: "kvanangen.no",
		reversed: "on.negnanavk"
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
		suffix: "kvæfjord.no",
		reversed: "on.axn-drojfvk--nx"
	},
	{
		suffix: "kvænangen.no",
		reversed: "on.a0k-negnanvk--nx"
	},
	{
		suffix: "kw",
		reversed: "wk"
	},
	{
		suffix: "kwp.gov.pl",
		reversed: "lp.vog.pwk"
	},
	{
		suffix: "kwpsp.gov.pl",
		reversed: "lp.vog.pspwk"
	},
	{
		suffix: "ky",
		reversed: "yk"
	},
	{
		suffix: "ky.us",
		reversed: "su.yk"
	},
	{
		suffix: "kyiv.ua",
		reversed: "au.viyk"
	},
	{
		suffix: "kyonan.chiba.jp",
		reversed: "pj.abihc.nanoyk"
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
		suffix: "kyoto",
		reversed: "otoyk"
	},
	{
		suffix: "kyoto.jp",
		reversed: "pj.otoyk"
	},
	{
		suffix: "kyowa.akita.jp",
		reversed: "pj.atika.awoyk"
	},
	{
		suffix: "kyowa.hokkaido.jp",
		reversed: "pj.odiakkoh.awoyk"
	},
	{
		suffix: "kyuragi.saga.jp",
		reversed: "pj.agas.igaruyk"
	},
	{
		suffix: "kz",
		reversed: "zk"
	},
	{
		suffix: "kárášjohka.no",
		reversed: "on.j94bawh-akhojrk--nx"
	},
	{
		suffix: "kåfjord.no",
		reversed: "on.aui-drojfk--nx"
	},
	{
		suffix: "l-o-g-i-n.de",
		reversed: "ed.n-i-g-o-l"
	},
	{
		suffix: "l.bg",
		reversed: "gb.l"
	},
	{
		suffix: "l.se",
		reversed: "es.l"
	},
	{
		suffix: "la",
		reversed: "al"
	},
	{
		suffix: "la-spezia.it",
		reversed: "ti.aizeps-al"
	},
	{
		suffix: "la.us",
		reversed: "su.al"
	},
	{
		suffix: "laakesvuemie.no",
		reversed: "on.eimeuvsekaal"
	},
	{
		suffix: "lab.ms",
		reversed: "sm.bal"
	},
	{
		suffix: "labor.museum",
		reversed: "muesum.robal"
	},
	{
		suffix: "labour.museum",
		reversed: "muesum.ruobal"
	},
	{
		suffix: "lacaixa",
		reversed: "axiacal"
	},
	{
		suffix: "lahppi.no",
		reversed: "on.ipphal"
	},
	{
		suffix: "lajolla.museum",
		reversed: "muesum.allojal"
	},
	{
		suffix: "lakas.hu",
		reversed: "uh.sakal"
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
		suffix: "lanbib.se",
		reversed: "es.bibnal"
	},
	{
		suffix: "lancashire.museum",
		reversed: "muesum.erihsacnal"
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
		suffix: "land-4-sale.us",
		reversed: "su.elas-4-dnal"
	},
	{
		suffix: "landes.museum",
		reversed: "muesum.sednal"
	},
	{
		suffix: "landrover",
		reversed: "revordnal"
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
		suffix: "lans.museum",
		reversed: "muesum.snal"
	},
	{
		suffix: "lanxess",
		reversed: "ssexnal"
	},
	{
		suffix: "lapy.pl",
		reversed: "lp.ypal"
	},
	{
		suffix: "laquila.it",
		reversed: "ti.aliuqal"
	},
	{
		suffix: "lardal.no",
		reversed: "on.ladral"
	},
	{
		suffix: "larsson.museum",
		reversed: "muesum.nossral"
	},
	{
		suffix: "larvik.no",
		reversed: "on.kivral"
	},
	{
		suffix: "lasalle",
		reversed: "ellasal"
	},
	{
		suffix: "laspezia.it",
		reversed: "ti.aizepsal"
	},
	{
		suffix: "lat",
		reversed: "tal"
	},
	{
		suffix: "latina.it",
		reversed: "ti.anital"
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
		suffix: "lavagis.no",
		reversed: "on.sigaval"
	},
	{
		suffix: "lavangen.no",
		reversed: "on.negnaval"
	},
	{
		suffix: "law",
		reversed: "wal"
	},
	{
		suffix: "law.pro",
		reversed: "orp.wal"
	},
	{
		suffix: "law.za",
		reversed: "az.wal"
	},
	{
		suffix: "lawyer",
		reversed: "reywal"
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
		suffix: "lb",
		reversed: "bl"
	},
	{
		suffix: "lc",
		reversed: "cl"
	},
	{
		suffix: "lc.it",
		reversed: "ti.cl"
	},
	{
		suffix: "lcube-server.de",
		reversed: "ed.revres-ebucl"
	},
	{
		suffix: "lds",
		reversed: "sdl"
	},
	{
		suffix: "le.it",
		reversed: "ti.el"
	},
	{
		suffix: "leadpages.co",
		reversed: "oc.segapdael"
	},
	{
		suffix: "leangaviika.no",
		reversed: "on.akiivagnael"
	},
	{
		suffix: "lease",
		reversed: "esael"
	},
	{
		suffix: "leasing.aero",
		reversed: "orea.gnisael"
	},
	{
		suffix: "leaŋgaviika.no",
		reversed: "on.b25-akiivagael--nx"
	},
	{
		suffix: "lebesby.no",
		reversed: "on.ybsebel"
	},
	{
		suffix: "lebork.pl",
		reversed: "lp.krobel"
	},
	{
		suffix: "lebtimnetz.de",
		reversed: "ed.ztenmitbel"
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
		suffix: "leclerc",
		reversed: "crelcel"
	},
	{
		suffix: "leczna.pl",
		reversed: "lp.anzcel"
	},
	{
		suffix: "lefrak",
		reversed: "karfel"
	},
	{
		suffix: "leg.br",
		reversed: "rb.gel"
	},
	{
		suffix: "legal",
		reversed: "lagel"
	},
	{
		suffix: "legnica.pl",
		reversed: "lp.acingel"
	},
	{
		suffix: "lego",
		reversed: "ogel"
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
		suffix: "leirvik.no",
		reversed: "on.kivriel"
	},
	{
		suffix: "leitungsen.de",
		reversed: "ed.nesgnutiel"
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
		suffix: "lel.br",
		reversed: "rb.lel"
	},
	{
		suffix: "lelux.site",
		reversed: "etis.xulel"
	},
	{
		suffix: "lenug.su",
		reversed: "us.gunel"
	},
	{
		suffix: "lenvik.no",
		reversed: "on.kivnel"
	},
	{
		suffix: "lerdal.no",
		reversed: "on.ladrel"
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
		suffix: "lewismiller.museum",
		reversed: "muesum.rellimsiwel"
	},
	{
		suffix: "lexus",
		reversed: "suxel"
	},
	{
		suffix: "lezajsk.pl",
		reversed: "lp.ksjazel"
	},
	{
		suffix: "lg.jp",
		reversed: "pj.gl"
	},
	{
		suffix: "lg.ua",
		reversed: "au.gl"
	},
	{
		suffix: "lgbt",
		reversed: "tbgl"
	},
	{
		suffix: "li",
		reversed: "il"
	},
	{
		suffix: "li.it",
		reversed: "ti.il"
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
		suffix: "lib.de.us",
		reversed: "su.ed.bil"
	},
	{
		suffix: "lib.ee",
		reversed: "ee.bil"
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
		suffix: "lib.va.us",
		reversed: "su.av.bil"
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
		suffix: "lidl",
		reversed: "ldil"
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
		suffix: "lig.it",
		reversed: "ti.gil"
	},
	{
		suffix: "lighting",
		reversed: "gnithgil"
	},
	{
		suffix: "liguria.it",
		reversed: "ti.airugil"
	},
	{
		suffix: "like",
		reversed: "ekil"
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
		suffix: "lillehammer.no",
		reversed: "on.remmahellil"
	},
	{
		suffix: "lillesand.no",
		reversed: "on.dnasellil"
	},
	{
		suffix: "lilly",
		reversed: "yllil"
	},
	{
		suffix: "lima-city.at",
		reversed: "ta.ytic-amil"
	},
	{
		suffix: "lima-city.ch",
		reversed: "hc.ytic-amil"
	},
	{
		suffix: "lima-city.de",
		reversed: "ed.ytic-amil"
	},
	{
		suffix: "lima-city.rocks",
		reversed: "skcor.ytic-amil"
	},
	{
		suffix: "lima.zone",
		reversed: "enoz.amil"
	},
	{
		suffix: "limanowa.pl",
		reversed: "lp.awonamil"
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
		suffix: "lincoln.museum",
		reversed: "muesum.nlocnil"
	},
	{
		suffix: "lindas.no",
		reversed: "on.sadnil"
	},
	{
		suffix: "linde",
		reversed: "ednil"
	},
	{
		suffix: "lindesnes.no",
		reversed: "on.sensednil"
	},
	{
		suffix: "lindås.no",
		reversed: "on.arp-sdnil--nx"
	},
	{
		suffix: "link",
		reversed: "knil"
	},
	{
		suffix: "linkyard-cloud.ch",
		reversed: "hc.duolc-drayknil"
	},
	{
		suffix: "linkyard.cloud",
		reversed: "duolc.drayknil"
	},
	{
		suffix: "linz.museum",
		reversed: "muesum.znil"
	},
	{
		suffix: "lipsy",
		reversed: "yspil"
	},
	{
		suffix: "littlestar.jp",
		reversed: "pj.ratselttil"
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
		suffix: "living.museum",
		reversed: "muesum.gnivil"
	},
	{
		suffix: "livinghistory.museum",
		reversed: "muesum.yrotsihgnivil"
	},
	{
		suffix: "livorno.it",
		reversed: "ti.onrovil"
	},
	{
		suffix: "lk",
		reversed: "kl"
	},
	{
		suffix: "lk3.ru",
		reversed: "ur.3kl"
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
		suffix: "ln.cn",
		reversed: "nc.nl"
	},
	{
		suffix: "lo.it",
		reversed: "ti.ol"
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
		suffix: "loan",
		reversed: "naol"
	},
	{
		suffix: "loans",
		reversed: "snaol"
	},
	{
		suffix: "localhistory.museum",
		reversed: "muesum.yrotsihlacol"
	},
	{
		suffix: "localhost.daplie.me",
		reversed: "em.eilpad.tsohlacol"
	},
	{
		suffix: "localzone.xyz",
		reversed: "zyx.enozlacol"
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
		suffix: "lodi.it",
		reversed: "ti.idol"
	},
	{
		suffix: "lodingen.no",
		reversed: "on.negnidol"
	},
	{
		suffix: "loft",
		reversed: "tfol"
	},
	{
		suffix: "log.br",
		reversed: "rb.gol"
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
		suffix: "loginto.me",
		reversed: "em.otnigol"
	},
	{
		suffix: "logistics.aero",
		reversed: "orea.scitsigol"
	},
	{
		suffix: "logoip.com",
		reversed: "moc.piogol"
	},
	{
		suffix: "logoip.de",
		reversed: "ed.piogol"
	},
	{
		suffix: "lohmus.me",
		reversed: "em.sumhol"
	},
	{
		suffix: "lol",
		reversed: "lol"
	},
	{
		suffix: "lolipop.io",
		reversed: "oi.popilol"
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
		suffix: "lom.it",
		reversed: "ti.mol"
	},
	{
		suffix: "lom.no",
		reversed: "on.mol"
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
		suffix: "lomo.jp",
		reversed: "pj.omol"
	},
	{
		suffix: "lomza.pl",
		reversed: "lp.azmol"
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
		suffix: "lon.wafaicloud.com",
		reversed: "moc.duolciafaw.nol"
	},
	{
		suffix: "london",
		reversed: "nodnol"
	},
	{
		suffix: "london.cloudapps.digital",
		reversed: "latigid.sppaduolc.nodnol"
	},
	{
		suffix: "london.museum",
		reversed: "muesum.nodnol"
	},
	{
		suffix: "londrina.br",
		reversed: "rb.anirdnol"
	},
	{
		suffix: "loppa.no",
		reversed: "on.appol"
	},
	{
		suffix: "lorenskog.no",
		reversed: "on.goksnerol"
	},
	{
		suffix: "losangeles.museum",
		reversed: "muesum.selegnasol"
	},
	{
		suffix: "loseyourip.com",
		reversed: "moc.piruoyesol"
	},
	{
		suffix: "loten.no",
		reversed: "on.netol"
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
		suffix: "louvre.museum",
		reversed: "muesum.ervuol"
	},
	{
		suffix: "love",
		reversed: "evol"
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
		suffix: "lowicz.pl",
		reversed: "lp.zciwol"
	},
	{
		suffix: "loyalist.museum",
		reversed: "muesum.tsilayol"
	},
	{
		suffix: "lpages.co",
		reversed: "oc.segapl"
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
		suffix: "lpusercontent.com",
		reversed: "moc.tnetnocresupl"
	},
	{
		suffix: "lr",
		reversed: "rl"
	},
	{
		suffix: "ls",
		reversed: "sl"
	},
	{
		suffix: "lt",
		reversed: "tl"
	},
	{
		suffix: "lt.eu.org",
		reversed: "gro.ue.tl"
	},
	{
		suffix: "lt.it",
		reversed: "ti.tl"
	},
	{
		suffix: "lt.ua",
		reversed: "au.tl"
	},
	{
		suffix: "ltd",
		reversed: "dtl"
	},
	{
		suffix: "ltd.co.im",
		reversed: "mi.oc.dtl"
	},
	{
		suffix: "ltd.cy",
		reversed: "yc.dtl"
	},
	{
		suffix: "ltd.gi",
		reversed: "ig.dtl"
	},
	{
		suffix: "ltd.hk",
		reversed: "kh.dtl"
	},
	{
		suffix: "ltd.lk",
		reversed: "kl.dtl"
	},
	{
		suffix: "ltd.ng",
		reversed: "gn.dtl"
	},
	{
		suffix: "ltd.ua",
		reversed: "au.dtl"
	},
	{
		suffix: "ltd.uk",
		reversed: "ku.dtl"
	},
	{
		suffix: "ltda",
		reversed: "adtl"
	},
	{
		suffix: "lu",
		reversed: "ul"
	},
	{
		suffix: "lu.eu.org",
		reversed: "gro.ue.ul"
	},
	{
		suffix: "lu.it",
		reversed: "ti.ul"
	},
	{
		suffix: "lubartow.pl",
		reversed: "lp.wotrabul"
	},
	{
		suffix: "lubin.pl",
		reversed: "lp.nibul"
	},
	{
		suffix: "lublin.pl",
		reversed: "lp.nilbul"
	},
	{
		suffix: "lucania.it",
		reversed: "ti.ainacul"
	},
	{
		suffix: "lucca.it",
		reversed: "ti.accul"
	},
	{
		suffix: "lucerne.museum",
		reversed: "muesum.enrecul"
	},
	{
		suffix: "lug.org.uk",
		reversed: "ku.gro.gul"
	},
	{
		suffix: "lugansk.ua",
		reversed: "au.ksnagul"
	},
	{
		suffix: "lugs.org.uk",
		reversed: "ku.gro.sgul"
	},
	{
		suffix: "lukow.pl",
		reversed: "lp.wokul"
	},
	{
		suffix: "lund.no",
		reversed: "on.dnul"
	},
	{
		suffix: "lundbeck",
		reversed: "kcebdnul"
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
		suffix: "lutsk.ua",
		reversed: "au.kstul"
	},
	{
		suffix: "luxe",
		reversed: "exul"
	},
	{
		suffix: "luxembourg.museum",
		reversed: "muesum.gruobmexul"
	},
	{
		suffix: "luxury",
		reversed: "yruxul"
	},
	{
		suffix: "luzern.museum",
		reversed: "muesum.nrezul"
	},
	{
		suffix: "lv",
		reversed: "vl"
	},
	{
		suffix: "lv.eu.org",
		reversed: "gro.ue.vl"
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
		suffix: "ly",
		reversed: "yl"
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
		suffix: "lynx.mythic-beasts.com",
		reversed: "moc.stsaeb-cihtym.xnyl"
	},
	{
		suffix: "láhppi.no",
		reversed: "on.aqx-ipphl--nx"
	},
	{
		suffix: "läns.museum",
		reversed: "muesum.alq-snl--nx"
	},
	{
		suffix: "lærdal.no",
		reversed: "on.ars-ladrl--nx"
	},
	{
		suffix: "lødingen.no",
		reversed: "on.a1q-negnidl--nx"
	},
	{
		suffix: "lørenskog.no",
		reversed: "on.a45-goksnerl--nx"
	},
	{
		suffix: "løten.no",
		reversed: "on.arg-netl--nx"
	},
	{
		suffix: "m.bg",
		reversed: "gb.m"
	},
	{
		suffix: "m.se",
		reversed: "es.m"
	},
	{
		suffix: "ma",
		reversed: "am"
	},
	{
		suffix: "ma.gov.br",
		reversed: "rb.vog.am"
	},
	{
		suffix: "ma.leg.br",
		reversed: "rb.gel.am"
	},
	{
		suffix: "ma.us",
		reversed: "su.am"
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
		suffix: "macerata.it",
		reversed: "ti.atarecam"
	},
	{
		suffix: "machida.tokyo.jp",
		reversed: "pj.oykot.adihcam"
	},
	{
		suffix: "macys",
		reversed: "sycam"
	},
	{
		suffix: "mad.museum",
		reversed: "muesum.dam"
	},
	{
		suffix: "madrid",
		reversed: "dirdam"
	},
	{
		suffix: "madrid.museum",
		reversed: "muesum.dirdam"
	},
	{
		suffix: "maebashi.gunma.jp",
		reversed: "pj.amnug.ihsabeam"
	},
	{
		suffix: "magazine.aero",
		reversed: "orea.enizagam"
	},
	{
		suffix: "magnet.page",
		reversed: "egap.tengam"
	},
	{
		suffix: "maibara.shiga.jp",
		reversed: "pj.agihs.arabiam"
	},
	{
		suffix: "maif",
		reversed: "fiam"
	},
	{
		suffix: "mail.pl",
		reversed: "lp.liam"
	},
	{
		suffix: "main.jp",
		reversed: "pj.niam"
	},
	{
		suffix: "maintenance.aero",
		reversed: "orea.ecnanetniam"
	},
	{
		suffix: "maison",
		reversed: "nosiam"
	},
	{
		suffix: "maizuru.kyoto.jp",
		reversed: "pj.otoyk.uruziam"
	},
	{
		suffix: "makeup",
		reversed: "puekam"
	},
	{
		suffix: "makinohara.shizuoka.jp",
		reversed: "pj.akouzihs.arahonikam"
	},
	{
		suffix: "makurazaki.kagoshima.jp",
		reversed: "pj.amihsogak.ikazarukam"
	},
	{
		suffix: "malatvuopmi.no",
		reversed: "on.impouvtalam"
	},
	{
		suffix: "malbork.pl",
		reversed: "lp.kroblam"
	},
	{
		suffix: "mallorca.museum",
		reversed: "muesum.acrollam"
	},
	{
		suffix: "malopolska.pl",
		reversed: "lp.akslopolam"
	},
	{
		suffix: "malselv.no",
		reversed: "on.vleslam"
	},
	{
		suffix: "malvik.no",
		reversed: "on.kivlam"
	},
	{
		suffix: "mamurogawa.yamagata.jp",
		reversed: "pj.atagamay.awagorumam"
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
		suffix: "manaus.br",
		reversed: "rb.suanam"
	},
	{
		suffix: "manchester.museum",
		reversed: "muesum.retsehcnam"
	},
	{
		suffix: "mandal.no",
		reversed: "on.ladnam"
	},
	{
		suffix: "mango",
		reversed: "ognam"
	},
	{
		suffix: "mangyshlak.su",
		reversed: "us.kalhsygnam"
	},
	{
		suffix: "maniwa.okayama.jp",
		reversed: "pj.amayako.awinam"
	},
	{
		suffix: "manno.kagawa.jp",
		reversed: "pj.awagak.onnam"
	},
	{
		suffix: "mansion.museum",
		reversed: "muesum.noisnam"
	},
	{
		suffix: "mansions.museum",
		reversed: "muesum.snoisnam"
	},
	{
		suffix: "mantova.it",
		reversed: "ti.avotnam"
	},
	{
		suffix: "manx.museum",
		reversed: "muesum.xnam"
	},
	{
		suffix: "maori.nz",
		reversed: "zn.iroam"
	},
	{
		suffix: "map",
		reversed: "pam"
	},
	{
		suffix: "map.fastly.net",
		reversed: "ten.yltsaf.pam"
	},
	{
		suffix: "map.fastlylb.net",
		reversed: "ten.blyltsaf.pam"
	},
	{
		suffix: "mar.it",
		reversed: "ti.ram"
	},
	{
		suffix: "marburg.museum",
		reversed: "muesum.grubram"
	},
	{
		suffix: "marche.it",
		reversed: "ti.ehcram"
	},
	{
		suffix: "marine.ru",
		reversed: "ur.eniram"
	},
	{
		suffix: "maringa.br",
		reversed: "rb.agniram"
	},
	{
		suffix: "maritime.museum",
		reversed: "muesum.emitiram"
	},
	{
		suffix: "maritimo.museum",
		reversed: "muesum.omitiram"
	},
	{
		suffix: "marker.no",
		reversed: "on.rekram"
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
		suffix: "marnardal.no",
		reversed: "on.ladranram"
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
		suffix: "marugame.kagawa.jp",
		reversed: "pj.awagak.emaguram"
	},
	{
		suffix: "marumori.miyagi.jp",
		reversed: "pj.igayim.iromuram"
	},
	{
		suffix: "maryland.museum",
		reversed: "muesum.dnalyram"
	},
	{
		suffix: "marylhurst.museum",
		reversed: "muesum.tsruhlyram"
	},
	{
		suffix: "masaki.ehime.jp",
		reversed: "pj.emihe.ikasam"
	},
	{
		suffix: "maserati",
		reversed: "itaresam"
	},
	{
		suffix: "masfjorden.no",
		reversed: "on.nedrojfsam"
	},
	{
		suffix: "mashike.hokkaido.jp",
		reversed: "pj.odiakkoh.ekihsam"
	},
	{
		suffix: "mashiki.kumamoto.jp",
		reversed: "pj.otomamuk.ikihsam"
	},
	{
		suffix: "mashiko.tochigi.jp",
		reversed: "pj.igihcot.okihsam"
	},
	{
		suffix: "masoy.no",
		reversed: "on.yosam"
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
		suffix: "masuda.shimane.jp",
		reversed: "pj.enamihs.adusam"
	},
	{
		suffix: "mat.br",
		reversed: "rb.tam"
	},
	{
		suffix: "matera.it",
		reversed: "ti.aretam"
	},
	{
		suffix: "matsubara.osaka.jp",
		reversed: "pj.akaso.arabustam"
	},
	{
		suffix: "matsubushi.saitama.jp",
		reversed: "pj.amatias.ihsubustam"
	},
	{
		suffix: "matsuda.kanagawa.jp",
		reversed: "pj.awaganak.adustam"
	},
	{
		suffix: "matsudo.chiba.jp",
		reversed: "pj.abihc.odustam"
	},
	{
		suffix: "matsue.shimane.jp",
		reversed: "pj.enamihs.eustam"
	},
	{
		suffix: "matsukawa.nagano.jp",
		reversed: "pj.onagan.awakustam"
	},
	{
		suffix: "matsumae.hokkaido.jp",
		reversed: "pj.odiakkoh.eamustam"
	},
	{
		suffix: "matsumoto.kagoshima.jp",
		reversed: "pj.amihsogak.otomustam"
	},
	{
		suffix: "matsumoto.nagano.jp",
		reversed: "pj.onagan.otomustam"
	},
	{
		suffix: "matsuno.ehime.jp",
		reversed: "pj.emihe.onustam"
	},
	{
		suffix: "matsusaka.mie.jp",
		reversed: "pj.eim.akasustam"
	},
	{
		suffix: "matsushige.tokushima.jp",
		reversed: "pj.amihsukot.egihsustam"
	},
	{
		suffix: "matsushima.miyagi.jp",
		reversed: "pj.igayim.amihsustam"
	},
	{
		suffix: "matsuura.nagasaki.jp",
		reversed: "pj.ikasagan.aruustam"
	},
	{
		suffix: "matsuyama.ehime.jp",
		reversed: "pj.emihe.amayustam"
	},
	{
		suffix: "matsuzaki.shizuoka.jp",
		reversed: "pj.akouzihs.ikazustam"
	},
	{
		suffix: "matta-varjjat.no",
		reversed: "on.tajjrav-attam"
	},
	{
		suffix: "mattel",
		reversed: "lettam"
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
		suffix: "mazeplay.com",
		reversed: "moc.yalpezam"
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
		suffix: "mb.ca",
		reversed: "ac.bm"
	},
	{
		suffix: "mb.it",
		reversed: "ti.bm"
	},
	{
		suffix: "mba",
		reversed: "abm"
	},
	{
		suffix: "mc",
		reversed: "cm"
	},
	{
		suffix: "mc.ax",
		reversed: "xa.cm"
	},
	{
		suffix: "mc.eu.org",
		reversed: "gro.ue.cm"
	},
	{
		suffix: "mc.it",
		reversed: "ti.cm"
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
		suffix: "mckinsey",
		reversed: "yesnikcm"
	},
	{
		suffix: "mcpe.me",
		reversed: "em.epcm"
	},
	{
		suffix: "mcpre.ru",
		reversed: "ur.erpcm"
	},
	{
		suffix: "md",
		reversed: "dm"
	},
	{
		suffix: "md.ci",
		reversed: "ic.dm"
	},
	{
		suffix: "md.us",
		reversed: "su.dm"
	},
	{
		suffix: "me",
		reversed: "em"
	},
	{
		suffix: "me.eu.org",
		reversed: "gro.ue.em"
	},
	{
		suffix: "me.in",
		reversed: "ni.em"
	},
	{
		suffix: "me.it",
		reversed: "ti.em"
	},
	{
		suffix: "me.ke",
		reversed: "ek.em"
	},
	{
		suffix: "me.so",
		reversed: "os.em"
	},
	{
		suffix: "me.ss",
		reversed: "ss.em"
	},
	{
		suffix: "me.tc",
		reversed: "ct.em"
	},
	{
		suffix: "me.tz",
		reversed: "zt.em"
	},
	{
		suffix: "me.uk",
		reversed: "ku.em"
	},
	{
		suffix: "me.us",
		reversed: "su.em"
	},
	{
		suffix: "me.vu",
		reversed: "uv.em"
	},
	{
		suffix: "med",
		reversed: "dem"
	},
	{
		suffix: "med.br",
		reversed: "rb.dem"
	},
	{
		suffix: "med.ec",
		reversed: "ce.dem"
	},
	{
		suffix: "med.ee",
		reversed: "ee.dem"
	},
	{
		suffix: "med.ht",
		reversed: "th.dem"
	},
	{
		suffix: "med.ly",
		reversed: "yl.dem"
	},
	{
		suffix: "med.om",
		reversed: "mo.dem"
	},
	{
		suffix: "med.pa",
		reversed: "ap.dem"
	},
	{
		suffix: "med.pl",
		reversed: "lp.dem"
	},
	{
		suffix: "med.pro",
		reversed: "orp.dem"
	},
	{
		suffix: "med.sa",
		reversed: "as.dem"
	},
	{
		suffix: "med.sd",
		reversed: "ds.dem"
	},
	{
		suffix: "medecin.fr",
		reversed: "rf.nicedem"
	},
	{
		suffix: "medecin.km",
		reversed: "mk.nicedem"
	},
	{
		suffix: "media",
		reversed: "aidem"
	},
	{
		suffix: "media.aero",
		reversed: "orea.aidem"
	},
	{
		suffix: "media.hu",
		reversed: "uh.aidem"
	},
	{
		suffix: "media.museum",
		reversed: "muesum.aidem"
	},
	{
		suffix: "media.pl",
		reversed: "lp.aidem"
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
		suffix: "medical.museum",
		reversed: "muesum.lacidem"
	},
	{
		suffix: "medicina.bo",
		reversed: "ob.anicidem"
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
		suffix: "medizinhistorisches.museum",
		reversed: "muesum.sehcsirotsihnizidem"
	},
	{
		suffix: "meeres.museum",
		reversed: "muesum.sereem"
	},
	{
		suffix: "meet",
		reversed: "teem"
	},
	{
		suffix: "meguro.tokyo.jp",
		reversed: "pj.oykot.orugem"
	},
	{
		suffix: "mein-iserv.de",
		reversed: "ed.vresi-niem"
	},
	{
		suffix: "mein-vigor.de",
		reversed: "ed.rogiv-niem"
	},
	{
		suffix: "meinforum.net",
		reversed: "ten.murofniem"
	},
	{
		suffix: "meiwa.gunma.jp",
		reversed: "pj.amnug.awiem"
	},
	{
		suffix: "meiwa.mie.jp",
		reversed: "pj.eim.awiem"
	},
	{
		suffix: "mel.cloudlets.com.au",
		reversed: "ua.moc.stelduolc.lem"
	},
	{
		suffix: "meland.no",
		reversed: "on.dnalem"
	},
	{
		suffix: "melbourne",
		reversed: "enruoblem"
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
		suffix: "members.linode.com",
		reversed: "moc.edonil.srebmem"
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
		suffix: "memorial.museum",
		reversed: "muesum.lairomem"
	},
	{
		suffix: "memset.net",
		reversed: "ten.tesmem"
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
		suffix: "meraker.no",
		reversed: "on.rekarem"
	},
	{
		suffix: "merckmsd",
		reversed: "dsmkcrem"
	},
	{
		suffix: "merseine.nu",
		reversed: "un.eniesrem"
	},
	{
		suffix: "meråker.no",
		reversed: "on.auk-rekrem--nx"
	},
	{
		suffix: "mesaverde.museum",
		reversed: "muesum.edrevasem"
	},
	{
		suffix: "messerli.app",
		reversed: "ppa.ilressem"
	},
	{
		suffix: "messina.it",
		reversed: "ti.anissem"
	},
	{
		suffix: "messwithdns.com",
		reversed: "moc.sndhtiwssem"
	},
	{
		suffix: "meteorapp.com",
		reversed: "moc.pparoetem"
	},
	{
		suffix: "mex.com",
		reversed: "moc.xem"
	},
	{
		suffix: "mg",
		reversed: "gm"
	},
	{
		suffix: "mg.gov.br",
		reversed: "rb.vog.gm"
	},
	{
		suffix: "mg.leg.br",
		reversed: "rb.gel.gm"
	},
	{
		suffix: "mh",
		reversed: "hm"
	},
	{
		suffix: "mi.it",
		reversed: "ti.im"
	},
	{
		suffix: "mi.th",
		reversed: "ht.im"
	},
	{
		suffix: "mi.us",
		reversed: "su.im"
	},
	{
		suffix: "miami",
		reversed: "imaim"
	},
	{
		suffix: "miasa.nagano.jp",
		reversed: "pj.onagan.asaim"
	},
	{
		suffix: "miasta.pl",
		reversed: "lp.atsaim"
	},
	{
		suffix: "mibu.tochigi.jp",
		reversed: "pj.igihcot.ubim"
	},
	{
		suffix: "michigan.museum",
		reversed: "muesum.nagihcim"
	},
	{
		suffix: "microlight.aero",
		reversed: "orea.thgilorcim"
	},
	{
		suffix: "microsoft",
		reversed: "tfosorcim"
	},
	{
		suffix: "midatlantic.museum",
		reversed: "muesum.citnaltadim"
	},
	{
		suffix: "midori.chiba.jp",
		reversed: "pj.abihc.irodim"
	},
	{
		suffix: "midori.gunma.jp",
		reversed: "pj.amnug.irodim"
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
		suffix: "mie.jp",
		reversed: "pj.eim"
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
		suffix: "mifune.kumamoto.jp",
		reversed: "pj.otomamuk.enufim"
	},
	{
		suffix: "mihama.aichi.jp",
		reversed: "pj.ihcia.amahim"
	},
	{
		suffix: "mihama.chiba.jp",
		reversed: "pj.abihc.amahim"
	},
	{
		suffix: "mihama.fukui.jp",
		reversed: "pj.iukuf.amahim"
	},
	{
		suffix: "mihama.mie.jp",
		reversed: "pj.eim.amahim"
	},
	{
		suffix: "mihama.wakayama.jp",
		reversed: "pj.amayakaw.amahim"
	},
	{
		suffix: "mihara.hiroshima.jp",
		reversed: "pj.amihsorih.arahim"
	},
	{
		suffix: "mihara.kochi.jp",
		reversed: "pj.ihcok.arahim"
	},
	{
		suffix: "miharu.fukushima.jp",
		reversed: "pj.amihsukuf.urahim"
	},
	{
		suffix: "miho.ibaraki.jp",
		reversed: "pj.ikarabi.ohim"
	},
	{
		suffix: "mikasa.hokkaido.jp",
		reversed: "pj.odiakkoh.asakim"
	},
	{
		suffix: "mikawa.yamagata.jp",
		reversed: "pj.atagamay.awakim"
	},
	{
		suffix: "miki.hyogo.jp",
		reversed: "pj.ogoyh.ikim"
	},
	{
		suffix: "mil",
		reversed: "lim"
	},
	{
		suffix: "mil.ac",
		reversed: "ca.lim"
	},
	{
		suffix: "mil.ae",
		reversed: "ea.lim"
	},
	{
		suffix: "mil.al",
		reversed: "la.lim"
	},
	{
		suffix: "mil.ar",
		reversed: "ra.lim"
	},
	{
		suffix: "mil.az",
		reversed: "za.lim"
	},
	{
		suffix: "mil.ba",
		reversed: "ab.lim"
	},
	{
		suffix: "mil.bo",
		reversed: "ob.lim"
	},
	{
		suffix: "mil.br",
		reversed: "rb.lim"
	},
	{
		suffix: "mil.by",
		reversed: "yb.lim"
	},
	{
		suffix: "mil.cl",
		reversed: "lc.lim"
	},
	{
		suffix: "mil.cn",
		reversed: "nc.lim"
	},
	{
		suffix: "mil.co",
		reversed: "oc.lim"
	},
	{
		suffix: "mil.cy",
		reversed: "yc.lim"
	},
	{
		suffix: "mil.do",
		reversed: "od.lim"
	},
	{
		suffix: "mil.ec",
		reversed: "ce.lim"
	},
	{
		suffix: "mil.eg",
		reversed: "ge.lim"
	},
	{
		suffix: "mil.fj",
		reversed: "jf.lim"
	},
	{
		suffix: "mil.ge",
		reversed: "eg.lim"
	},
	{
		suffix: "mil.gh",
		reversed: "hg.lim"
	},
	{
		suffix: "mil.gt",
		reversed: "tg.lim"
	},
	{
		suffix: "mil.hn",
		reversed: "nh.lim"
	},
	{
		suffix: "mil.id",
		reversed: "di.lim"
	},
	{
		suffix: "mil.in",
		reversed: "ni.lim"
	},
	{
		suffix: "mil.iq",
		reversed: "qi.lim"
	},
	{
		suffix: "mil.jo",
		reversed: "oj.lim"
	},
	{
		suffix: "mil.kg",
		reversed: "gk.lim"
	},
	{
		suffix: "mil.km",
		reversed: "mk.lim"
	},
	{
		suffix: "mil.kr",
		reversed: "rk.lim"
	},
	{
		suffix: "mil.kz",
		reversed: "zk.lim"
	},
	{
		suffix: "mil.lv",
		reversed: "vl.lim"
	},
	{
		suffix: "mil.mg",
		reversed: "gm.lim"
	},
	{
		suffix: "mil.mv",
		reversed: "vm.lim"
	},
	{
		suffix: "mil.my",
		reversed: "ym.lim"
	},
	{
		suffix: "mil.mz",
		reversed: "zm.lim"
	},
	{
		suffix: "mil.ng",
		reversed: "gn.lim"
	},
	{
		suffix: "mil.ni",
		reversed: "in.lim"
	},
	{
		suffix: "mil.no",
		reversed: "on.lim"
	},
	{
		suffix: "mil.nz",
		reversed: "zn.lim"
	},
	{
		suffix: "mil.pe",
		reversed: "ep.lim"
	},
	{
		suffix: "mil.ph",
		reversed: "hp.lim"
	},
	{
		suffix: "mil.pl",
		reversed: "lp.lim"
	},
	{
		suffix: "mil.py",
		reversed: "yp.lim"
	},
	{
		suffix: "mil.qa",
		reversed: "aq.lim"
	},
	{
		suffix: "mil.ru",
		reversed: "ur.lim"
	},
	{
		suffix: "mil.rw",
		reversed: "wr.lim"
	},
	{
		suffix: "mil.sh",
		reversed: "hs.lim"
	},
	{
		suffix: "mil.st",
		reversed: "ts.lim"
	},
	{
		suffix: "mil.sy",
		reversed: "ys.lim"
	},
	{
		suffix: "mil.tj",
		reversed: "jt.lim"
	},
	{
		suffix: "mil.tm",
		reversed: "mt.lim"
	},
	{
		suffix: "mil.to",
		reversed: "ot.lim"
	},
	{
		suffix: "mil.tr",
		reversed: "rt.lim"
	},
	{
		suffix: "mil.tw",
		reversed: "wt.lim"
	},
	{
		suffix: "mil.tz",
		reversed: "zt.lim"
	},
	{
		suffix: "mil.uy",
		reversed: "yu.lim"
	},
	{
		suffix: "mil.vc",
		reversed: "cv.lim"
	},
	{
		suffix: "mil.ve",
		reversed: "ev.lim"
	},
	{
		suffix: "mil.ye",
		reversed: "ey.lim"
	},
	{
		suffix: "mil.za",
		reversed: "az.lim"
	},
	{
		suffix: "mil.zm",
		reversed: "mz.lim"
	},
	{
		suffix: "mil.zw",
		reversed: "wz.lim"
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
		suffix: "military.museum",
		reversed: "muesum.yratilim"
	},
	{
		suffix: "mill.museum",
		reversed: "muesum.llim"
	},
	{
		suffix: "mima.tokushima.jp",
		reversed: "pj.amihsukot.amim"
	},
	{
		suffix: "mimata.miyazaki.jp",
		reversed: "pj.ikazayim.atamim"
	},
	{
		suffix: "minakami.gunma.jp",
		reversed: "pj.amnug.imakanim"
	},
	{
		suffix: "minamata.kumamoto.jp",
		reversed: "pj.otomamuk.atamanim"
	},
	{
		suffix: "minami-alps.yamanashi.jp",
		reversed: "pj.ihsanamay.spla-imanim"
	},
	{
		suffix: "minami.fukuoka.jp",
		reversed: "pj.akoukuf.imanim"
	},
	{
		suffix: "minami.kyoto.jp",
		reversed: "pj.otoyk.imanim"
	},
	{
		suffix: "minami.tokushima.jp",
		reversed: "pj.amihsukot.imanim"
	},
	{
		suffix: "minamiaiki.nagano.jp",
		reversed: "pj.onagan.ikiaimanim"
	},
	{
		suffix: "minamiashigara.kanagawa.jp",
		reversed: "pj.awaganak.aragihsaimanim"
	},
	{
		suffix: "minamiawaji.hyogo.jp",
		reversed: "pj.ogoyh.ijawaimanim"
	},
	{
		suffix: "minamiboso.chiba.jp",
		reversed: "pj.abihc.osobimanim"
	},
	{
		suffix: "minamidaito.okinawa.jp",
		reversed: "pj.awaniko.otiadimanim"
	},
	{
		suffix: "minamiechizen.fukui.jp",
		reversed: "pj.iukuf.nezihceimanim"
	},
	{
		suffix: "minamifurano.hokkaido.jp",
		reversed: "pj.odiakkoh.onarufimanim"
	},
	{
		suffix: "minamiise.mie.jp",
		reversed: "pj.eim.esiimanim"
	},
	{
		suffix: "minamiizu.shizuoka.jp",
		reversed: "pj.akouzihs.uziimanim"
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
		suffix: "minamioguni.kumamoto.jp",
		reversed: "pj.otomamuk.inugoimanim"
	},
	{
		suffix: "minamisanriku.miyagi.jp",
		reversed: "pj.igayim.ukirnasimanim"
	},
	{
		suffix: "minamitane.kagoshima.jp",
		reversed: "pj.amihsogak.enatimanim"
	},
	{
		suffix: "minamiuonuma.niigata.jp",
		reversed: "pj.atagiin.amunouimanim"
	},
	{
		suffix: "minamiyamashiro.kyoto.jp",
		reversed: "pj.otoyk.orihsamayimanim"
	},
	{
		suffix: "minano.saitama.jp",
		reversed: "pj.amatias.onanim"
	},
	{
		suffix: "minato.osaka.jp",
		reversed: "pj.akaso.otanim"
	},
	{
		suffix: "minato.tokyo.jp",
		reversed: "pj.oykot.otanim"
	},
	{
		suffix: "mincom.tn",
		reversed: "nt.mocnim"
	},
	{
		suffix: "mine.nu",
		reversed: "un.enim"
	},
	{
		suffix: "miners.museum",
		reversed: "muesum.srenim"
	},
	{
		suffix: "mini",
		reversed: "inim"
	},
	{
		suffix: "mining.museum",
		reversed: "muesum.gninim"
	},
	{
		suffix: "miniserver.com",
		reversed: "moc.revresinim"
	},
	{
		suffix: "minisite.ms",
		reversed: "sm.etisinim"
	},
	{
		suffix: "minnesota.museum",
		reversed: "muesum.atosennim"
	},
	{
		suffix: "mino.gifu.jp",
		reversed: "pj.ufig.onim"
	},
	{
		suffix: "minobu.yamanashi.jp",
		reversed: "pj.ihsanamay.ubonim"
	},
	{
		suffix: "minoh.osaka.jp",
		reversed: "pj.akaso.honim"
	},
	{
		suffix: "minokamo.gifu.jp",
		reversed: "pj.ufig.omakonim"
	},
	{
		suffix: "minowa.nagano.jp",
		reversed: "pj.onagan.awonim"
	},
	{
		suffix: "mint",
		reversed: "tnim"
	},
	{
		suffix: "mintere.site",
		reversed: "etis.eretnim"
	},
	{
		suffix: "mircloud.host",
		reversed: "tsoh.duolcrim"
	},
	{
		suffix: "mircloud.ru",
		reversed: "ur.duolcrim"
	},
	{
		suffix: "mircloud.us",
		reversed: "su.duolcrim"
	},
	{
		suffix: "misaki.okayama.jp",
		reversed: "pj.amayako.ikasim"
	},
	{
		suffix: "misaki.osaka.jp",
		reversed: "pj.akaso.ikasim"
	},
	{
		suffix: "misasa.tottori.jp",
		reversed: "pj.irottot.asasim"
	},
	{
		suffix: "misato.akita.jp",
		reversed: "pj.atika.otasim"
	},
	{
		suffix: "misato.miyagi.jp",
		reversed: "pj.igayim.otasim"
	},
	{
		suffix: "misato.saitama.jp",
		reversed: "pj.amatias.otasim"
	},
	{
		suffix: "misato.shimane.jp",
		reversed: "pj.enamihs.otasim"
	},
	{
		suffix: "misato.wakayama.jp",
		reversed: "pj.amayakaw.otasim"
	},
	{
		suffix: "misawa.aomori.jp",
		reversed: "pj.iromoa.awasim"
	},
	{
		suffix: "misconfused.org",
		reversed: "gro.desufnocsim"
	},
	{
		suffix: "mishima.fukushima.jp",
		reversed: "pj.amihsukuf.amihsim"
	},
	{
		suffix: "mishima.shizuoka.jp",
		reversed: "pj.akouzihs.amihsim"
	},
	{
		suffix: "missile.museum",
		reversed: "muesum.elissim"
	},
	{
		suffix: "missoula.museum",
		reversed: "muesum.aluossim"
	},
	{
		suffix: "misugi.mie.jp",
		reversed: "pj.eim.igusim"
	},
	{
		suffix: "mit",
		reversed: "tim"
	},
	{
		suffix: "mitaka.tokyo.jp",
		reversed: "pj.oykot.akatim"
	},
	{
		suffix: "mitake.gifu.jp",
		reversed: "pj.ufig.ekatim"
	},
	{
		suffix: "mitane.akita.jp",
		reversed: "pj.atika.enatim"
	},
	{
		suffix: "mito.ibaraki.jp",
		reversed: "pj.ikarabi.otim"
	},
	{
		suffix: "mitou.yamaguchi.jp",
		reversed: "pj.ihcugamay.uotim"
	},
	{
		suffix: "mitoyo.kagawa.jp",
		reversed: "pj.awagak.oyotim"
	},
	{
		suffix: "mitsubishi",
		reversed: "ihsibustim"
	},
	{
		suffix: "mitsue.nara.jp",
		reversed: "pj.aran.eustim"
	},
	{
		suffix: "mitsuke.niigata.jp",
		reversed: "pj.atagiin.ekustim"
	},
	{
		suffix: "miura.kanagawa.jp",
		reversed: "pj.awaganak.aruim"
	},
	{
		suffix: "miyada.nagano.jp",
		reversed: "pj.onagan.adayim"
	},
	{
		suffix: "miyagi.jp",
		reversed: "pj.igayim"
	},
	{
		suffix: "miyake.nara.jp",
		reversed: "pj.aran.ekayim"
	},
	{
		suffix: "miyako.fukuoka.jp",
		reversed: "pj.akoukuf.okayim"
	},
	{
		suffix: "miyako.iwate.jp",
		reversed: "pj.etawi.okayim"
	},
	{
		suffix: "miyakonojo.miyazaki.jp",
		reversed: "pj.ikazayim.ojonokayim"
	},
	{
		suffix: "miyama.fukuoka.jp",
		reversed: "pj.akoukuf.amayim"
	},
	{
		suffix: "miyama.mie.jp",
		reversed: "pj.eim.amayim"
	},
	{
		suffix: "miyashiro.saitama.jp",
		reversed: "pj.amatias.orihsayim"
	},
	{
		suffix: "miyawaka.fukuoka.jp",
		reversed: "pj.akoukuf.akawayim"
	},
	{
		suffix: "miyazaki.jp",
		reversed: "pj.ikazayim"
	},
	{
		suffix: "miyazaki.miyazaki.jp",
		reversed: "pj.ikazayim.ikazayim"
	},
	{
		suffix: "miyazu.kyoto.jp",
		reversed: "pj.otoyk.uzayim"
	},
	{
		suffix: "miyoshi.aichi.jp",
		reversed: "pj.ihcia.ihsoyim"
	},
	{
		suffix: "miyoshi.hiroshima.jp",
		reversed: "pj.amihsorih.ihsoyim"
	},
	{
		suffix: "miyoshi.saitama.jp",
		reversed: "pj.amatias.ihsoyim"
	},
	{
		suffix: "miyoshi.tokushima.jp",
		reversed: "pj.amihsukot.ihsoyim"
	},
	{
		suffix: "miyota.nagano.jp",
		reversed: "pj.onagan.atoyim"
	},
	{
		suffix: "mizuho.tokyo.jp",
		reversed: "pj.oykot.ohuzim"
	},
	{
		suffix: "mizumaki.fukuoka.jp",
		reversed: "pj.akoukuf.ikamuzim"
	},
	{
		suffix: "mizunami.gifu.jp",
		reversed: "pj.ufig.imanuzim"
	},
	{
		suffix: "mizusawa.iwate.jp",
		reversed: "pj.etawi.awasuzim"
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
		suffix: "mk",
		reversed: "km"
	},
	{
		suffix: "mk.eu.org",
		reversed: "gro.ue.km"
	},
	{
		suffix: "mk.ua",
		reversed: "au.km"
	},
	{
		suffix: "ml",
		reversed: "lm"
	},
	{
		suffix: "mlb",
		reversed: "blm"
	},
	{
		suffix: "mlbfan.org",
		reversed: "gro.nafblm"
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
		suffix: "mmafan.biz",
		reversed: "zib.nafamm"
	},
	{
		suffix: "mn",
		reversed: "nm"
	},
	{
		suffix: "mn.it",
		reversed: "ti.nm"
	},
	{
		suffix: "mn.us",
		reversed: "su.nm"
	},
	{
		suffix: "mo",
		reversed: "om"
	},
	{
		suffix: "mo-i-rana.no",
		reversed: "on.anar-i-om"
	},
	{
		suffix: "mo-siemens.io",
		reversed: "oi.snemeis-om"
	},
	{
		suffix: "mo.cn",
		reversed: "nc.om"
	},
	{
		suffix: "mo.it",
		reversed: "ti.om"
	},
	{
		suffix: "mo.us",
		reversed: "su.om"
	},
	{
		suffix: "moareke.no",
		reversed: "on.ekeraom"
	},
	{
		suffix: "mobara.chiba.jp",
		reversed: "pj.abihc.arabom"
	},
	{
		suffix: "mobi",
		reversed: "ibom"
	},
	{
		suffix: "mobi.gp",
		reversed: "pg.ibom"
	},
	{
		suffix: "mobi.ke",
		reversed: "ek.ibom"
	},
	{
		suffix: "mobi.na",
		reversed: "an.ibom"
	},
	{
		suffix: "mobi.ng",
		reversed: "gn.ibom"
	},
	{
		suffix: "mobi.tt",
		reversed: "tt.ibom"
	},
	{
		suffix: "mobi.tz",
		reversed: "zt.ibom"
	},
	{
		suffix: "mobile",
		reversed: "elibom"
	},
	{
		suffix: "mochizuki.nagano.jp",
		reversed: "pj.onagan.ikuzihcom"
	},
	{
		suffix: "mock.pstmn.io",
		reversed: "oi.nmtsp.kcom"
	},
	{
		suffix: "mod.gi",
		reversed: "ig.dom"
	},
	{
		suffix: "moda",
		reversed: "adom"
	},
	{
		suffix: "modalen.no",
		reversed: "on.neladom"
	},
	{
		suffix: "modelling.aero",
		reversed: "orea.gnilledom"
	},
	{
		suffix: "modena.it",
		reversed: "ti.anedom"
	},
	{
		suffix: "modern.museum",
		reversed: "muesum.nredom"
	},
	{
		suffix: "mods.jp",
		reversed: "pj.sdom"
	},
	{
		suffix: "modum.no",
		reversed: "on.mudom"
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
		suffix: "moka.tochigi.jp",
		reversed: "pj.igihcot.akom"
	},
	{
		suffix: "mol.it",
		reversed: "ti.lom"
	},
	{
		suffix: "molde.no",
		reversed: "on.edlom"
	},
	{
		suffix: "molise.it",
		reversed: "ti.esilom"
	},
	{
		suffix: "mom",
		reversed: "mom"
	},
	{
		suffix: "moma.museum",
		reversed: "muesum.amom"
	},
	{
		suffix: "mombetsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustebmom"
	},
	{
		suffix: "monash",
		reversed: "hsanom"
	},
	{
		suffix: "mond.jp",
		reversed: "pj.dnom"
	},
	{
		suffix: "money",
		reversed: "yenom"
	},
	{
		suffix: "money.museum",
		reversed: "muesum.yenom"
	},
	{
		suffix: "mongolian.jp",
		reversed: "pj.nailognom"
	},
	{
		suffix: "monmouth.museum",
		reversed: "muesum.htuomnom"
	},
	{
		suffix: "monster",
		reversed: "retsnom"
	},
	{
		suffix: "monticello.museum",
		reversed: "muesum.ollecitnom"
	},
	{
		suffix: "montreal.museum",
		reversed: "muesum.laertnom"
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
		suffix: "moo.jp",
		reversed: "pj.oom"
	},
	{
		suffix: "moonscale.net",
		reversed: "ten.elacsnoom"
	},
	{
		suffix: "mordovia.ru",
		reversed: "ur.aivodrom"
	},
	{
		suffix: "mordovia.su",
		reversed: "us.aivodrom"
	},
	{
		suffix: "morena.br",
		reversed: "rb.anerom"
	},
	{
		suffix: "moriguchi.osaka.jp",
		reversed: "pj.akaso.ihcugirom"
	},
	{
		suffix: "morimachi.shizuoka.jp",
		reversed: "pj.akouzihs.ihcamirom"
	},
	{
		suffix: "morioka.iwate.jp",
		reversed: "pj.etawi.akoirom"
	},
	{
		suffix: "moriya.ibaraki.jp",
		reversed: "pj.ikarabi.ayirom"
	},
	{
		suffix: "moriyama.shiga.jp",
		reversed: "pj.agihs.amayirom"
	},
	{
		suffix: "moriyoshi.akita.jp",
		reversed: "pj.atika.ihsoyirom"
	},
	{
		suffix: "mormon",
		reversed: "nomrom"
	},
	{
		suffix: "morotsuka.miyazaki.jp",
		reversed: "pj.ikazayim.akustorom"
	},
	{
		suffix: "moroyama.saitama.jp",
		reversed: "pj.amatias.amayorom"
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
		suffix: "moscow.museum",
		reversed: "muesum.wocsom"
	},
	{
		suffix: "moseushi.hokkaido.jp",
		reversed: "pj.odiakkoh.ihsuesom"
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
		suffix: "motegi.tochigi.jp",
		reversed: "pj.igihcot.igetom"
	},
	{
		suffix: "moto",
		reversed: "otom"
	},
	{
		suffix: "motobu.okinawa.jp",
		reversed: "pj.awaniko.ubotom"
	},
	{
		suffix: "motorcycle.museum",
		reversed: "muesum.elcycrotom"
	},
	{
		suffix: "motorcycles",
		reversed: "selcycrotom"
	},
	{
		suffix: "motosu.gifu.jp",
		reversed: "pj.ufig.usotom"
	},
	{
		suffix: "motoyama.kochi.jp",
		reversed: "pj.ihcok.amayotom"
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
		suffix: "movimiento.bo",
		reversed: "ob.otneimivom"
	},
	{
		suffix: "mozilla-iot.org",
		reversed: "gro.toi-allizom"
	},
	{
		suffix: "moåreke.no",
		reversed: "on.auj-ekerom--nx"
	},
	{
		suffix: "mp",
		reversed: "pm"
	},
	{
		suffix: "mp.br",
		reversed: "rb.pm"
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
		suffix: "mr.no",
		reversed: "on.rm"
	},
	{
		suffix: "mragowo.pl",
		reversed: "lp.owogarm"
	},
	{
		suffix: "ms",
		reversed: "sm"
	},
	{
		suffix: "ms.gov.br",
		reversed: "rb.vog.sm"
	},
	{
		suffix: "ms.it",
		reversed: "ti.sm"
	},
	{
		suffix: "ms.kr",
		reversed: "rk.sm"
	},
	{
		suffix: "ms.leg.br",
		reversed: "rb.gel.sm"
	},
	{
		suffix: "ms.us",
		reversed: "su.sm"
	},
	{
		suffix: "msd",
		reversed: "dsm"
	},
	{
		suffix: "msk.ru",
		reversed: "ur.ksm"
	},
	{
		suffix: "msk.su",
		reversed: "us.ksm"
	},
	{
		suffix: "mt",
		reversed: "tm"
	},
	{
		suffix: "mt.eu.org",
		reversed: "gro.ue.tm"
	},
	{
		suffix: "mt.gov.br",
		reversed: "rb.vog.tm"
	},
	{
		suffix: "mt.it",
		reversed: "ti.tm"
	},
	{
		suffix: "mt.leg.br",
		reversed: "rb.gel.tm"
	},
	{
		suffix: "mt.us",
		reversed: "su.tm"
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
		suffix: "mu",
		reversed: "um"
	},
	{
		suffix: "muenchen.museum",
		reversed: "muesum.nehcneum"
	},
	{
		suffix: "muenster.museum",
		reversed: "muesum.retsneum"
	},
	{
		suffix: "mugi.tokushima.jp",
		reversed: "pj.amihsukot.igum"
	},
	{
		suffix: "muika.niigata.jp",
		reversed: "pj.atagiin.akium"
	},
	{
		suffix: "mukawa.hokkaido.jp",
		reversed: "pj.odiakkoh.awakum"
	},
	{
		suffix: "muko.kyoto.jp",
		reversed: "pj.otoyk.okum"
	},
	{
		suffix: "mulhouse.museum",
		reversed: "muesum.esuohlum"
	},
	{
		suffix: "munakata.fukuoka.jp",
		reversed: "pj.akoukuf.atakanum"
	},
	{
		suffix: "muncie.museum",
		reversed: "muesum.eicnum"
	},
	{
		suffix: "muni.il",
		reversed: "li.inum"
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
		suffix: "mup.gov.pl",
		reversed: "lp.vog.pum"
	},
	{
		suffix: "murakami.niigata.jp",
		reversed: "pj.atagiin.imakarum"
	},
	{
		suffix: "murata.miyagi.jp",
		reversed: "pj.igayim.atarum"
	},
	{
		suffix: "murayama.yamagata.jp",
		reversed: "pj.atagamay.amayarum"
	},
	{
		suffix: "murmansk.su",
		reversed: "us.ksnamrum"
	},
	{
		suffix: "muroran.hokkaido.jp",
		reversed: "pj.odiakkoh.narorum"
	},
	{
		suffix: "muroto.kochi.jp",
		reversed: "pj.ihcok.otorum"
	},
	{
		suffix: "mus.br",
		reversed: "rb.sum"
	},
	{
		suffix: "mus.mi.us",
		reversed: "su.im.sum"
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
		suffix: "museet.museum",
		reversed: "muesum.teesum"
	},
	{
		suffix: "museum",
		reversed: "muesum"
	},
	{
		suffix: "museum.mv",
		reversed: "vm.muesum"
	},
	{
		suffix: "museum.mw",
		reversed: "wm.muesum"
	},
	{
		suffix: "museum.no",
		reversed: "on.muesum"
	},
	{
		suffix: "museum.om",
		reversed: "mo.muesum"
	},
	{
		suffix: "museum.tt",
		reversed: "tt.muesum"
	},
	{
		suffix: "museumcenter.museum",
		reversed: "muesum.retnecmuesum"
	},
	{
		suffix: "museumvereniging.museum",
		reversed: "muesum.gniginerevmuesum"
	},
	{
		suffix: "music",
		reversed: "cisum"
	},
	{
		suffix: "music.museum",
		reversed: "muesum.cisum"
	},
	{
		suffix: "musica.ar",
		reversed: "ra.acisum"
	},
	{
		suffix: "musica.bo",
		reversed: "ob.acisum"
	},
	{
		suffix: "musician.io",
		reversed: "oi.naicisum"
	},
	{
		suffix: "mutsu.aomori.jp",
		reversed: "pj.iromoa.ustum"
	},
	{
		suffix: "mutsuzawa.chiba.jp",
		reversed: "pj.abihc.awazustum"
	},
	{
		suffix: "mutual",
		reversed: "lautum"
	},
	{
		suffix: "mutual.ar",
		reversed: "ra.lautum"
	},
	{
		suffix: "mv",
		reversed: "vm"
	},
	{
		suffix: "mw",
		reversed: "wm"
	},
	{
		suffix: "mw.gov.pl",
		reversed: "lp.vog.wm"
	},
	{
		suffix: "mx",
		reversed: "xm"
	},
	{
		suffix: "mx.na",
		reversed: "an.xm"
	},
	{
		suffix: "my",
		reversed: "ym"
	},
	{
		suffix: "my-firewall.org",
		reversed: "gro.llawerif-ym"
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
		suffix: "my-vigor.de",
		reversed: "ed.rogiv-ym"
	},
	{
		suffix: "my-wan.de",
		reversed: "ed.naw-ym"
	},
	{
		suffix: "my.eu.org",
		reversed: "gro.ue.ym"
	},
	{
		suffix: "my.id",
		reversed: "di.ym"
	},
	{
		suffix: "myactivedirectory.com",
		reversed: "moc.yrotceridevitcaym"
	},
	{
		suffix: "myasustor.com",
		reversed: "moc.rotsusaym"
	},
	{
		suffix: "mycd.eu",
		reversed: "ue.dcym"
	},
	{
		suffix: "mycloud.by",
		reversed: "yb.duolcym"
	},
	{
		suffix: "mydatto.com",
		reversed: "moc.ottadym"
	},
	{
		suffix: "mydatto.net",
		reversed: "ten.ottadym"
	},
	{
		suffix: "myddns.rocks",
		reversed: "skcor.snddym"
	},
	{
		suffix: "mydissent.net",
		reversed: "ten.tnessidym"
	},
	{
		suffix: "mydobiss.com",
		reversed: "moc.ssibodym"
	},
	{
		suffix: "mydrobo.com",
		reversed: "moc.obordym"
	},
	{
		suffix: "myds.me",
		reversed: "em.sdym"
	},
	{
		suffix: "myeffect.net",
		reversed: "ten.tceffeym"
	},
	{
		suffix: "myfast.host",
		reversed: "tsoh.tsafym"
	},
	{
		suffix: "myfast.space",
		reversed: "ecaps.tsafym"
	},
	{
		suffix: "myfirewall.org",
		reversed: "gro.llawerifym"
	},
	{
		suffix: "myforum.community",
		reversed: "ytinummoc.murofym"
	},
	{
		suffix: "myfritz.net",
		reversed: "ten.ztirfym"
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
		suffix: "myhome-server.de",
		reversed: "ed.revres-emohym"
	},
	{
		suffix: "myiphost.com",
		reversed: "moc.tsohpiym"
	},
	{
		suffix: "myjino.ru",
		reversed: "ur.onijym"
	},
	{
		suffix: "mykolaiv.ua",
		reversed: "au.vialokym"
	},
	{
		suffix: "mymailer.com.tw",
		reversed: "wt.moc.reliamym"
	},
	{
		suffix: "mymediapc.net",
		reversed: "ten.cpaidemym"
	},
	{
		suffix: "myoko.niigata.jp",
		reversed: "pj.atagiin.okoym"
	},
	{
		suffix: "mypep.link",
		reversed: "knil.pepym"
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
		suffix: "mypi.co",
		reversed: "oc.ipym"
	},
	{
		suffix: "mypsx.net",
		reversed: "ten.xspym"
	},
	{
		suffix: "myqnapcloud.com",
		reversed: "moc.duolcpanqym"
	},
	{
		suffix: "myravendb.com",
		reversed: "moc.bdnevarym"
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
		suffix: "myshopblocks.com",
		reversed: "moc.skcolbpohsym"
	},
	{
		suffix: "myshopify.com",
		reversed: "moc.yfipohsym"
	},
	{
		suffix: "myspreadshop.at",
		reversed: "ta.pohsdaerpsym"
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
		suffix: "myspreadshop.co.uk",
		reversed: "ku.oc.pohsdaerpsym"
	},
	{
		suffix: "myspreadshop.com",
		reversed: "moc.pohsdaerpsym"
	},
	{
		suffix: "myspreadshop.com.au",
		reversed: "ua.moc.pohsdaerpsym"
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
		suffix: "mytis.ru",
		reversed: "ur.sitym"
	},
	{
		suffix: "mytuleap.com",
		reversed: "moc.paelutym"
	},
	{
		suffix: "myvnc.com",
		reversed: "moc.cnvym"
	},
	{
		suffix: "mywire.org",
		reversed: "gro.eriwym"
	},
	{
		suffix: "mz",
		reversed: "zm"
	},
	{
		suffix: "málatvuopmi.no",
		reversed: "on.a4s-impouvtalm--nx"
	},
	{
		suffix: "mátta-várjjat.no",
		reversed: "on.fa7k-tajjrv-attm--nx"
	},
	{
		suffix: "målselv.no",
		reversed: "on.aui-vleslm--nx"
	},
	{
		suffix: "måsøy.no",
		reversed: "on.h0alu-ysm--nx"
	},
	{
		suffix: "māori.nz",
		reversed: "zn.asq-irom--nx"
	},
	{
		suffix: "n.bg",
		reversed: "gb.n"
	},
	{
		suffix: "n.se",
		reversed: "es.n"
	},
	{
		suffix: "n4t.co",
		reversed: "oc.t4n"
	},
	{
		suffix: "na",
		reversed: "an"
	},
	{
		suffix: "na.it",
		reversed: "ti.an"
	},
	{
		suffix: "na4u.ru",
		reversed: "ur.u4an"
	},
	{
		suffix: "naamesjevuemie.no",
		reversed: "on.eimeuvejsemaan"
	},
	{
		suffix: "nab",
		reversed: "ban"
	},
	{
		suffix: "nabari.mie.jp",
		reversed: "pj.eim.iraban"
	},
	{
		suffix: "nachikatsuura.wakayama.jp",
		reversed: "pj.amayakaw.aruustakihcan"
	},
	{
		suffix: "nagahama.shiga.jp",
		reversed: "pj.agihs.amahagan"
	},
	{
		suffix: "nagai.yamagata.jp",
		reversed: "pj.atagamay.iagan"
	},
	{
		suffix: "nagano.jp",
		reversed: "pj.onagan"
	},
	{
		suffix: "nagano.nagano.jp",
		reversed: "pj.onagan.onagan"
	},
	{
		suffix: "naganohara.gunma.jp",
		reversed: "pj.amnug.arahonagan"
	},
	{
		suffix: "nagaoka.niigata.jp",
		reversed: "pj.atagiin.akoagan"
	},
	{
		suffix: "nagaokakyo.kyoto.jp",
		reversed: "pj.otoyk.oykakoagan"
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
		suffix: "nagasaki.jp",
		reversed: "pj.ikasagan"
	},
	{
		suffix: "nagasaki.nagasaki.jp",
		reversed: "pj.ikasagan.ikasagan"
	},
	{
		suffix: "nagasu.kumamoto.jp",
		reversed: "pj.otomamuk.usagan"
	},
	{
		suffix: "nagato.yamaguchi.jp",
		reversed: "pj.ihcugamay.otagan"
	},
	{
		suffix: "nagatoro.saitama.jp",
		reversed: "pj.amatias.orotagan"
	},
	{
		suffix: "nagawa.nagano.jp",
		reversed: "pj.onagan.awagan"
	},
	{
		suffix: "nagi.okayama.jp",
		reversed: "pj.amayako.igan"
	},
	{
		suffix: "nagiso.nagano.jp",
		reversed: "pj.onagan.osigan"
	},
	{
		suffix: "nago.okinawa.jp",
		reversed: "pj.awaniko.ogan"
	},
	{
		suffix: "nagoya",
		reversed: "ayogan"
	},
	{
		suffix: "naha.okinawa.jp",
		reversed: "pj.awaniko.ahan"
	},
	{
		suffix: "nahari.kochi.jp",
		reversed: "pj.ihcok.irahan"
	},
	{
		suffix: "naie.hokkaido.jp",
		reversed: "pj.odiakkoh.eian"
	},
	{
		suffix: "naka.hiroshima.jp",
		reversed: "pj.amihsorih.akan"
	},
	{
		suffix: "naka.ibaraki.jp",
		reversed: "pj.ikarabi.akan"
	},
	{
		suffix: "nakadomari.aomori.jp",
		reversed: "pj.iromoa.iramodakan"
	},
	{
		suffix: "nakagawa.fukuoka.jp",
		reversed: "pj.akoukuf.awagakan"
	},
	{
		suffix: "nakagawa.hokkaido.jp",
		reversed: "pj.odiakkoh.awagakan"
	},
	{
		suffix: "nakagawa.nagano.jp",
		reversed: "pj.onagan.awagakan"
	},
	{
		suffix: "nakagawa.tokushima.jp",
		reversed: "pj.amihsukot.awagakan"
	},
	{
		suffix: "nakagusuku.okinawa.jp",
		reversed: "pj.awaniko.ukusugakan"
	},
	{
		suffix: "nakagyo.kyoto.jp",
		reversed: "pj.otoyk.oygakan"
	},
	{
		suffix: "nakai.kanagawa.jp",
		reversed: "pj.awaganak.iakan"
	},
	{
		suffix: "nakama.fukuoka.jp",
		reversed: "pj.akoukuf.amakan"
	},
	{
		suffix: "nakamichi.yamanashi.jp",
		reversed: "pj.ihsanamay.ihcimakan"
	},
	{
		suffix: "nakamura.kochi.jp",
		reversed: "pj.ihcok.arumakan"
	},
	{
		suffix: "nakaniikawa.toyama.jp",
		reversed: "pj.amayot.awakiinakan"
	},
	{
		suffix: "nakano.nagano.jp",
		reversed: "pj.onagan.onakan"
	},
	{
		suffix: "nakano.tokyo.jp",
		reversed: "pj.oykot.onakan"
	},
	{
		suffix: "nakanojo.gunma.jp",
		reversed: "pj.amnug.ojonakan"
	},
	{
		suffix: "nakanoto.ishikawa.jp",
		reversed: "pj.awakihsi.otonakan"
	},
	{
		suffix: "nakasatsunai.hokkaido.jp",
		reversed: "pj.odiakkoh.ianustasakan"
	},
	{
		suffix: "nakatane.kagoshima.jp",
		reversed: "pj.amihsogak.enatakan"
	},
	{
		suffix: "nakatombetsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustebmotakan"
	},
	{
		suffix: "nakatsugawa.gifu.jp",
		reversed: "pj.ufig.awagustakan"
	},
	{
		suffix: "nakayama.yamagata.jp",
		reversed: "pj.atagamay.amayakan"
	},
	{
		suffix: "nakijin.okinawa.jp",
		reversed: "pj.awaniko.nijikan"
	},
	{
		suffix: "naklo.pl",
		reversed: "lp.olkan"
	},
	{
		suffix: "nalchik.ru",
		reversed: "ur.kihclan"
	},
	{
		suffix: "nalchik.su",
		reversed: "us.kihclan"
	},
	{
		suffix: "namaste.jp",
		reversed: "pj.etsaman"
	},
	{
		suffix: "namdalseid.no",
		reversed: "on.diesladman"
	},
	{
		suffix: "name",
		reversed: "eman"
	},
	{
		suffix: "name.az",
		reversed: "za.eman"
	},
	{
		suffix: "name.eg",
		reversed: "ge.eman"
	},
	{
		suffix: "name.et",
		reversed: "te.eman"
	},
	{
		suffix: "name.fj",
		reversed: "jf.eman"
	},
	{
		suffix: "name.hr",
		reversed: "rh.eman"
	},
	{
		suffix: "name.jo",
		reversed: "oj.eman"
	},
	{
		suffix: "name.mk",
		reversed: "km.eman"
	},
	{
		suffix: "name.mv",
		reversed: "vm.eman"
	},
	{
		suffix: "name.my",
		reversed: "ym.eman"
	},
	{
		suffix: "name.na",
		reversed: "an.eman"
	},
	{
		suffix: "name.ng",
		reversed: "gn.eman"
	},
	{
		suffix: "name.pm",
		reversed: "mp.eman"
	},
	{
		suffix: "name.pr",
		reversed: "rp.eman"
	},
	{
		suffix: "name.qa",
		reversed: "aq.eman"
	},
	{
		suffix: "name.tj",
		reversed: "jt.eman"
	},
	{
		suffix: "name.tr",
		reversed: "rt.eman"
	},
	{
		suffix: "name.tt",
		reversed: "tt.eman"
	},
	{
		suffix: "name.vn",
		reversed: "nv.eman"
	},
	{
		suffix: "namegata.ibaraki.jp",
		reversed: "pj.ikarabi.atageman"
	},
	{
		suffix: "namegawa.saitama.jp",
		reversed: "pj.amatias.awageman"
	},
	{
		suffix: "namerikawa.toyama.jp",
		reversed: "pj.amayot.awakireman"
	},
	{
		suffix: "namie.fukushima.jp",
		reversed: "pj.amihsukuf.eiman"
	},
	{
		suffix: "namikata.ehime.jp",
		reversed: "pj.emihe.atakiman"
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
		suffix: "nanae.hokkaido.jp",
		reversed: "pj.odiakkoh.eanan"
	},
	{
		suffix: "nanao.ishikawa.jp",
		reversed: "pj.awakihsi.oanan"
	},
	{
		suffix: "nanbu.tottori.jp",
		reversed: "pj.irottot.ubnan"
	},
	{
		suffix: "nanbu.yamanashi.jp",
		reversed: "pj.ihsanamay.ubnan"
	},
	{
		suffix: "nango.fukushima.jp",
		reversed: "pj.amihsukuf.ognan"
	},
	{
		suffix: "nanjo.okinawa.jp",
		reversed: "pj.awaniko.ojnan"
	},
	{
		suffix: "nankoku.kochi.jp",
		reversed: "pj.ihcok.ukoknan"
	},
	{
		suffix: "nanmoku.gunma.jp",
		reversed: "pj.amnug.ukomnan"
	},
	{
		suffix: "nannestad.no",
		reversed: "on.datsennan"
	},
	{
		suffix: "nanporo.hokkaido.jp",
		reversed: "pj.odiakkoh.oropnan"
	},
	{
		suffix: "nantan.kyoto.jp",
		reversed: "pj.otoyk.natnan"
	},
	{
		suffix: "nanto.toyama.jp",
		reversed: "pj.amayot.otnan"
	},
	{
		suffix: "nanyo.yamagata.jp",
		reversed: "pj.atagamay.oynan"
	},
	{
		suffix: "naoshima.kagawa.jp",
		reversed: "pj.awagak.amihsoan"
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
		suffix: "nara.jp",
		reversed: "pj.aran"
	},
	{
		suffix: "nara.nara.jp",
		reversed: "pj.aran.aran"
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
		suffix: "naroy.no",
		reversed: "on.yoran"
	},
	{
		suffix: "narusawa.yamanashi.jp",
		reversed: "pj.ihsanamay.awasuran"
	},
	{
		suffix: "naruto.tokushima.jp",
		reversed: "pj.amihsukot.oturan"
	},
	{
		suffix: "narviika.no",
		reversed: "on.akiivran"
	},
	{
		suffix: "narvik.no",
		reversed: "on.kivran"
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
		suffix: "nat.tn",
		reversed: "nt.tan"
	},
	{
		suffix: "natal.br",
		reversed: "rb.latan"
	},
	{
		suffix: "national.museum",
		reversed: "muesum.lanoitan"
	},
	{
		suffix: "nationalfirearms.museum",
		reversed: "muesum.smraeriflanoitan"
	},
	{
		suffix: "nationalheritage.museum",
		reversed: "muesum.egatirehlanoitan"
	},
	{
		suffix: "nativeamerican.museum",
		reversed: "muesum.naciremaevitan"
	},
	{
		suffix: "natori.miyagi.jp",
		reversed: "pj.igayim.irotan"
	},
	{
		suffix: "natura",
		reversed: "arutan"
	},
	{
		suffix: "natural.bo",
		reversed: "ob.larutan"
	},
	{
		suffix: "naturalhistory.museum",
		reversed: "muesum.yrotsihlarutan"
	},
	{
		suffix: "naturalhistorymuseum.museum",
		reversed: "muesum.muesumyrotsihlarutan"
	},
	{
		suffix: "naturalsciences.museum",
		reversed: "muesum.secneicslarutan"
	},
	{
		suffix: "naturbruksgymn.se",
		reversed: "es.nmygskurbrutan"
	},
	{
		suffix: "nature.museum",
		reversed: "muesum.erutan"
	},
	{
		suffix: "naturhistorisches.museum",
		reversed: "muesum.sehcsirotsihrutan"
	},
	{
		suffix: "natuurwetenschappen.museum",
		reversed: "muesum.neppahcsnetewruutan"
	},
	{
		suffix: "naumburg.museum",
		reversed: "muesum.grubmuan"
	},
	{
		suffix: "naustdal.no",
		reversed: "on.ladtsuan"
	},
	{
		suffix: "naval.museum",
		reversed: "muesum.lavan"
	},
	{
		suffix: "navigation.aero",
		reversed: "orea.noitagivan"
	},
	{
		suffix: "navoi.su",
		reversed: "us.iovan"
	},
	{
		suffix: "navuotna.no",
		reversed: "on.antouvan"
	},
	{
		suffix: "navy",
		reversed: "yvan"
	},
	{
		suffix: "nayoro.hokkaido.jp",
		reversed: "pj.odiakkoh.oroyan"
	},
	{
		suffix: "nb.ca",
		reversed: "ac.bn"
	},
	{
		suffix: "nba",
		reversed: "abn"
	},
	{
		suffix: "nc",
		reversed: "cn"
	},
	{
		suffix: "nc.tr",
		reversed: "rt.cn"
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
		suffix: "ne",
		reversed: "en"
	},
	{
		suffix: "ne.jp",
		reversed: "pj.en"
	},
	{
		suffix: "ne.ke",
		reversed: "ek.en"
	},
	{
		suffix: "ne.kr",
		reversed: "rk.en"
	},
	{
		suffix: "ne.pw",
		reversed: "wp.en"
	},
	{
		suffix: "ne.tz",
		reversed: "zt.en"
	},
	{
		suffix: "ne.ug",
		reversed: "gu.en"
	},
	{
		suffix: "ne.us",
		reversed: "su.en"
	},
	{
		suffix: "neat-url.com",
		reversed: "moc.lru-taen"
	},
	{
		suffix: "nebraska.museum",
		reversed: "muesum.aksarben"
	},
	{
		suffix: "nec",
		reversed: "cen"
	},
	{
		suffix: "nedre-eiker.no",
		reversed: "on.rekie-erden"
	},
	{
		suffix: "neko.am",
		reversed: "ma.oken"
	},
	{
		suffix: "nemuro.hokkaido.jp",
		reversed: "pj.odiakkoh.orumen"
	},
	{
		suffix: "nerdpol.ovh",
		reversed: "hvo.lopdren"
	},
	{
		suffix: "nerima.tokyo.jp",
		reversed: "pj.oykot.amiren"
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
		suffix: "nesoddtangen.no",
		reversed: "on.negnatddosen"
	},
	{
		suffix: "nesseby.no",
		reversed: "on.ybessen"
	},
	{
		suffix: "nesset.no",
		reversed: "on.tessen"
	},
	{
		suffix: "net",
		reversed: "ten"
	},
	{
		suffix: "net-freaks.com",
		reversed: "moc.skaerf-ten"
	},
	{
		suffix: "net.ac",
		reversed: "ca.ten"
	},
	{
		suffix: "net.ae",
		reversed: "ea.ten"
	},
	{
		suffix: "net.af",
		reversed: "fa.ten"
	},
	{
		suffix: "net.ag",
		reversed: "ga.ten"
	},
	{
		suffix: "net.ai",
		reversed: "ia.ten"
	},
	{
		suffix: "net.al",
		reversed: "la.ten"
	},
	{
		suffix: "net.am",
		reversed: "ma.ten"
	},
	{
		suffix: "net.ar",
		reversed: "ra.ten"
	},
	{
		suffix: "net.au",
		reversed: "ua.ten"
	},
	{
		suffix: "net.az",
		reversed: "za.ten"
	},
	{
		suffix: "net.ba",
		reversed: "ab.ten"
	},
	{
		suffix: "net.bb",
		reversed: "bb.ten"
	},
	{
		suffix: "net.bh",
		reversed: "hb.ten"
	},
	{
		suffix: "net.bm",
		reversed: "mb.ten"
	},
	{
		suffix: "net.bn",
		reversed: "nb.ten"
	},
	{
		suffix: "net.bo",
		reversed: "ob.ten"
	},
	{
		suffix: "net.br",
		reversed: "rb.ten"
	},
	{
		suffix: "net.bs",
		reversed: "sb.ten"
	},
	{
		suffix: "net.bt",
		reversed: "tb.ten"
	},
	{
		suffix: "net.bz",
		reversed: "zb.ten"
	},
	{
		suffix: "net.ci",
		reversed: "ic.ten"
	},
	{
		suffix: "net.cm",
		reversed: "mc.ten"
	},
	{
		suffix: "net.cn",
		reversed: "nc.ten"
	},
	{
		suffix: "net.co",
		reversed: "oc.ten"
	},
	{
		suffix: "net.cu",
		reversed: "uc.ten"
	},
	{
		suffix: "net.cw",
		reversed: "wc.ten"
	},
	{
		suffix: "net.cy",
		reversed: "yc.ten"
	},
	{
		suffix: "net.dm",
		reversed: "md.ten"
	},
	{
		suffix: "net.do",
		reversed: "od.ten"
	},
	{
		suffix: "net.dz",
		reversed: "zd.ten"
	},
	{
		suffix: "net.ec",
		reversed: "ce.ten"
	},
	{
		suffix: "net.eg",
		reversed: "ge.ten"
	},
	{
		suffix: "net.et",
		reversed: "te.ten"
	},
	{
		suffix: "net.eu.org",
		reversed: "gro.ue.ten"
	},
	{
		suffix: "net.fj",
		reversed: "jf.ten"
	},
	{
		suffix: "net.fm",
		reversed: "mf.ten"
	},
	{
		suffix: "net.ge",
		reversed: "eg.ten"
	},
	{
		suffix: "net.gg",
		reversed: "gg.ten"
	},
	{
		suffix: "net.gl",
		reversed: "lg.ten"
	},
	{
		suffix: "net.gn",
		reversed: "ng.ten"
	},
	{
		suffix: "net.gp",
		reversed: "pg.ten"
	},
	{
		suffix: "net.gr",
		reversed: "rg.ten"
	},
	{
		suffix: "net.gt",
		reversed: "tg.ten"
	},
	{
		suffix: "net.gu",
		reversed: "ug.ten"
	},
	{
		suffix: "net.gy",
		reversed: "yg.ten"
	},
	{
		suffix: "net.hk",
		reversed: "kh.ten"
	},
	{
		suffix: "net.hn",
		reversed: "nh.ten"
	},
	{
		suffix: "net.ht",
		reversed: "th.ten"
	},
	{
		suffix: "net.id",
		reversed: "di.ten"
	},
	{
		suffix: "net.il",
		reversed: "li.ten"
	},
	{
		suffix: "net.im",
		reversed: "mi.ten"
	},
	{
		suffix: "net.in",
		reversed: "ni.ten"
	},
	{
		suffix: "net.iq",
		reversed: "qi.ten"
	},
	{
		suffix: "net.ir",
		reversed: "ri.ten"
	},
	{
		suffix: "net.is",
		reversed: "si.ten"
	},
	{
		suffix: "net.je",
		reversed: "ej.ten"
	},
	{
		suffix: "net.jo",
		reversed: "oj.ten"
	},
	{
		suffix: "net.kg",
		reversed: "gk.ten"
	},
	{
		suffix: "net.ki",
		reversed: "ik.ten"
	},
	{
		suffix: "net.kn",
		reversed: "nk.ten"
	},
	{
		suffix: "net.kw",
		reversed: "wk.ten"
	},
	{
		suffix: "net.ky",
		reversed: "yk.ten"
	},
	{
		suffix: "net.kz",
		reversed: "zk.ten"
	},
	{
		suffix: "net.la",
		reversed: "al.ten"
	},
	{
		suffix: "net.lb",
		reversed: "bl.ten"
	},
	{
		suffix: "net.lc",
		reversed: "cl.ten"
	},
	{
		suffix: "net.lk",
		reversed: "kl.ten"
	},
	{
		suffix: "net.lr",
		reversed: "rl.ten"
	},
	{
		suffix: "net.ls",
		reversed: "sl.ten"
	},
	{
		suffix: "net.lv",
		reversed: "vl.ten"
	},
	{
		suffix: "net.ly",
		reversed: "yl.ten"
	},
	{
		suffix: "net.ma",
		reversed: "am.ten"
	},
	{
		suffix: "net.me",
		reversed: "em.ten"
	},
	{
		suffix: "net.mk",
		reversed: "km.ten"
	},
	{
		suffix: "net.ml",
		reversed: "lm.ten"
	},
	{
		suffix: "net.mo",
		reversed: "om.ten"
	},
	{
		suffix: "net.ms",
		reversed: "sm.ten"
	},
	{
		suffix: "net.mt",
		reversed: "tm.ten"
	},
	{
		suffix: "net.mu",
		reversed: "um.ten"
	},
	{
		suffix: "net.mv",
		reversed: "vm.ten"
	},
	{
		suffix: "net.mw",
		reversed: "wm.ten"
	},
	{
		suffix: "net.mx",
		reversed: "xm.ten"
	},
	{
		suffix: "net.my",
		reversed: "ym.ten"
	},
	{
		suffix: "net.mz",
		reversed: "zm.ten"
	},
	{
		suffix: "net.nf",
		reversed: "fn.ten"
	},
	{
		suffix: "net.ng",
		reversed: "gn.ten"
	},
	{
		suffix: "net.ni",
		reversed: "in.ten"
	},
	{
		suffix: "net.nr",
		reversed: "rn.ten"
	},
	{
		suffix: "net.nz",
		reversed: "zn.ten"
	},
	{
		suffix: "net.om",
		reversed: "mo.ten"
	},
	{
		suffix: "net.pa",
		reversed: "ap.ten"
	},
	{
		suffix: "net.pe",
		reversed: "ep.ten"
	},
	{
		suffix: "net.ph",
		reversed: "hp.ten"
	},
	{
		suffix: "net.pk",
		reversed: "kp.ten"
	},
	{
		suffix: "net.pl",
		reversed: "lp.ten"
	},
	{
		suffix: "net.pn",
		reversed: "np.ten"
	},
	{
		suffix: "net.pr",
		reversed: "rp.ten"
	},
	{
		suffix: "net.ps",
		reversed: "sp.ten"
	},
	{
		suffix: "net.pt",
		reversed: "tp.ten"
	},
	{
		suffix: "net.py",
		reversed: "yp.ten"
	},
	{
		suffix: "net.qa",
		reversed: "aq.ten"
	},
	{
		suffix: "net.ru",
		reversed: "ur.ten"
	},
	{
		suffix: "net.rw",
		reversed: "wr.ten"
	},
	{
		suffix: "net.sa",
		reversed: "as.ten"
	},
	{
		suffix: "net.sb",
		reversed: "bs.ten"
	},
	{
		suffix: "net.sc",
		reversed: "cs.ten"
	},
	{
		suffix: "net.sd",
		reversed: "ds.ten"
	},
	{
		suffix: "net.sg",
		reversed: "gs.ten"
	},
	{
		suffix: "net.sh",
		reversed: "hs.ten"
	},
	{
		suffix: "net.sl",
		reversed: "ls.ten"
	},
	{
		suffix: "net.so",
		reversed: "os.ten"
	},
	{
		suffix: "net.ss",
		reversed: "ss.ten"
	},
	{
		suffix: "net.st",
		reversed: "ts.ten"
	},
	{
		suffix: "net.sy",
		reversed: "ys.ten"
	},
	{
		suffix: "net.th",
		reversed: "ht.ten"
	},
	{
		suffix: "net.tj",
		reversed: "jt.ten"
	},
	{
		suffix: "net.tm",
		reversed: "mt.ten"
	},
	{
		suffix: "net.tn",
		reversed: "nt.ten"
	},
	{
		suffix: "net.to",
		reversed: "ot.ten"
	},
	{
		suffix: "net.tr",
		reversed: "rt.ten"
	},
	{
		suffix: "net.tt",
		reversed: "tt.ten"
	},
	{
		suffix: "net.tw",
		reversed: "wt.ten"
	},
	{
		suffix: "net.ua",
		reversed: "au.ten"
	},
	{
		suffix: "net.uk",
		reversed: "ku.ten"
	},
	{
		suffix: "net.uy",
		reversed: "yu.ten"
	},
	{
		suffix: "net.uz",
		reversed: "zu.ten"
	},
	{
		suffix: "net.vc",
		reversed: "cv.ten"
	},
	{
		suffix: "net.ve",
		reversed: "ev.ten"
	},
	{
		suffix: "net.vi",
		reversed: "iv.ten"
	},
	{
		suffix: "net.vn",
		reversed: "nv.ten"
	},
	{
		suffix: "net.vu",
		reversed: "uv.ten"
	},
	{
		suffix: "net.ws",
		reversed: "sw.ten"
	},
	{
		suffix: "net.ye",
		reversed: "ey.ten"
	},
	{
		suffix: "net.za",
		reversed: "az.ten"
	},
	{
		suffix: "net.zm",
		reversed: "mz.ten"
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
		suffix: "netlify.app",
		reversed: "ppa.yfilten"
	},
	{
		suffix: "network",
		reversed: "krowten"
	},
	{
		suffix: "neues.museum",
		reversed: "muesum.seuen"
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
		suffix: "newhampshire.museum",
		reversed: "muesum.erihspmahwen"
	},
	{
		suffix: "newjersey.museum",
		reversed: "muesum.yesrejwen"
	},
	{
		suffix: "newmexico.museum",
		reversed: "muesum.ocixemwen"
	},
	{
		suffix: "newport.museum",
		reversed: "muesum.tropwen"
	},
	{
		suffix: "news",
		reversed: "swen"
	},
	{
		suffix: "news.hu",
		reversed: "uh.swen"
	},
	{
		suffix: "newspaper.museum",
		reversed: "muesum.repapswen"
	},
	{
		suffix: "newyork.museum",
		reversed: "muesum.kroywen"
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
		suffix: "neyagawa.osaka.jp",
		reversed: "pj.akaso.awagayen"
	},
	{
		suffix: "nf",
		reversed: "fn"
	},
	{
		suffix: "nf.ca",
		reversed: "ac.fn"
	},
	{
		suffix: "nfl",
		reversed: "lfn"
	},
	{
		suffix: "nflfan.org",
		reversed: "gro.naflfn"
	},
	{
		suffix: "nfshost.com",
		reversed: "moc.tsohsfn"
	},
	{
		suffix: "ng",
		reversed: "gn"
	},
	{
		suffix: "ng.eu.org",
		reversed: "gro.ue.gn"
	},
	{
		suffix: "ngo",
		reversed: "ogn"
	},
	{
		suffix: "ngo.lk",
		reversed: "kl.ogn"
	},
	{
		suffix: "ngo.ng",
		reversed: "gn.ogn"
	},
	{
		suffix: "ngo.ph",
		reversed: "hp.ogn"
	},
	{
		suffix: "ngo.za",
		reversed: "az.ogn"
	},
	{
		suffix: "ngrok.io",
		reversed: "oi.korgn"
	},
	{
		suffix: "nh-serv.co.uk",
		reversed: "ku.oc.vres-hn"
	},
	{
		suffix: "nh.us",
		reversed: "su.hn"
	},
	{
		suffix: "nhk",
		reversed: "khn"
	},
	{
		suffix: "nhlfan.net",
		reversed: "ten.naflhn"
	},
	{
		suffix: "nhs.uk",
		reversed: "ku.shn"
	},
	{
		suffix: "ni",
		reversed: "in"
	},
	{
		suffix: "nic.in",
		reversed: "ni.cin"
	},
	{
		suffix: "nic.tj",
		reversed: "jt.cin"
	},
	{
		suffix: "nic.za",
		reversed: "az.cin"
	},
	{
		suffix: "nichinan.miyazaki.jp",
		reversed: "pj.ikazayim.nanihcin"
	},
	{
		suffix: "nichinan.tottori.jp",
		reversed: "pj.irottot.nanihcin"
	},
	{
		suffix: "nico",
		reversed: "ocin"
	},
	{
		suffix: "nid.io",
		reversed: "oi.din"
	},
	{
		suffix: "niepce.museum",
		reversed: "muesum.ecpein"
	},
	{
		suffix: "nieruchomosci.pl",
		reversed: "lp.icsomohcurein"
	},
	{
		suffix: "niigata.jp",
		reversed: "pj.atagiin"
	},
	{
		suffix: "niigata.niigata.jp",
		reversed: "pj.atagiin.atagiin"
	},
	{
		suffix: "niihama.ehime.jp",
		reversed: "pj.emihe.amahiin"
	},
	{
		suffix: "niikappu.hokkaido.jp",
		reversed: "pj.odiakkoh.uppakiin"
	},
	{
		suffix: "niimi.okayama.jp",
		reversed: "pj.amayako.imiin"
	},
	{
		suffix: "niiza.saitama.jp",
		reversed: "pj.amatias.aziin"
	},
	{
		suffix: "nikaho.akita.jp",
		reversed: "pj.atika.ohakin"
	},
	{
		suffix: "nike",
		reversed: "ekin"
	},
	{
		suffix: "niki.hokkaido.jp",
		reversed: "pj.odiakkoh.ikin"
	},
	{
		suffix: "nikita.jp",
		reversed: "pj.atikin"
	},
	{
		suffix: "nikko.tochigi.jp",
		reversed: "pj.igihcot.okkin"
	},
	{
		suffix: "nikolaev.ua",
		reversed: "au.vealokin"
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
		suffix: "ninohe.iwate.jp",
		reversed: "pj.etawi.ehonin"
	},
	{
		suffix: "ninomiya.kanagawa.jp",
		reversed: "pj.awaganak.ayimonin"
	},
	{
		suffix: "nirasaki.yamanashi.jp",
		reversed: "pj.ihsanamay.ikasarin"
	},
	{
		suffix: "nis.za",
		reversed: "az.sin"
	},
	{
		suffix: "nishi.fukuoka.jp",
		reversed: "pj.akoukuf.ihsin"
	},
	{
		suffix: "nishi.osaka.jp",
		reversed: "pj.akaso.ihsin"
	},
	{
		suffix: "nishiaizu.fukushima.jp",
		reversed: "pj.amihsukuf.uziaihsin"
	},
	{
		suffix: "nishiarita.saga.jp",
		reversed: "pj.agas.atiraihsin"
	},
	{
		suffix: "nishiawakura.okayama.jp",
		reversed: "pj.amayako.arukawaihsin"
	},
	{
		suffix: "nishiazai.shiga.jp",
		reversed: "pj.agihs.iazaihsin"
	},
	{
		suffix: "nishigo.fukushima.jp",
		reversed: "pj.amihsukuf.ogihsin"
	},
	{
		suffix: "nishihara.kumamoto.jp",
		reversed: "pj.otomamuk.arahihsin"
	},
	{
		suffix: "nishihara.okinawa.jp",
		reversed: "pj.awaniko.arahihsin"
	},
	{
		suffix: "nishiizu.shizuoka.jp",
		reversed: "pj.akouzihs.uziihsin"
	},
	{
		suffix: "nishikata.tochigi.jp",
		reversed: "pj.igihcot.atakihsin"
	},
	{
		suffix: "nishikatsura.yamanashi.jp",
		reversed: "pj.ihsanamay.arustakihsin"
	},
	{
		suffix: "nishikawa.yamagata.jp",
		reversed: "pj.atagamay.awakihsin"
	},
	{
		suffix: "nishimera.miyazaki.jp",
		reversed: "pj.ikazayim.aremihsin"
	},
	{
		suffix: "nishinomiya.hyogo.jp",
		reversed: "pj.ogoyh.ayimonihsin"
	},
	{
		suffix: "nishinoomote.kagoshima.jp",
		reversed: "pj.amihsogak.etomoonihsin"
	},
	{
		suffix: "nishinoshima.shimane.jp",
		reversed: "pj.enamihs.amihsonihsin"
	},
	{
		suffix: "nishio.aichi.jp",
		reversed: "pj.ihcia.oihsin"
	},
	{
		suffix: "nishiokoppe.hokkaido.jp",
		reversed: "pj.odiakkoh.eppokoihsin"
	},
	{
		suffix: "nishitosa.kochi.jp",
		reversed: "pj.ihcok.asotihsin"
	},
	{
		suffix: "nishiwaki.hyogo.jp",
		reversed: "pj.ogoyh.ikawihsin"
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
		suffix: "nissedal.no",
		reversed: "on.ladessin"
	},
	{
		suffix: "nisshin.aichi.jp",
		reversed: "pj.ihcia.nihssin"
	},
	{
		suffix: "niteroi.br",
		reversed: "rb.ioretin"
	},
	{
		suffix: "nittedal.no",
		reversed: "on.ladettin"
	},
	{
		suffix: "niyodogawa.kochi.jp",
		reversed: "pj.ihcok.awagodoyin"
	},
	{
		suffix: "nj.us",
		reversed: "su.jn"
	},
	{
		suffix: "njs.jelastic.vps-host.net",
		reversed: "ten.tsoh-spv.citsalej.sjn"
	},
	{
		suffix: "nl",
		reversed: "ln"
	},
	{
		suffix: "nl-ams-1.baremetal.scw.cloud",
		reversed: "duolc.wcs.latemerab.1-sma-ln"
	},
	{
		suffix: "nl.ca",
		reversed: "ac.ln"
	},
	{
		suffix: "nl.ci",
		reversed: "ic.ln"
	},
	{
		suffix: "nl.eu.org",
		reversed: "gro.ue.ln"
	},
	{
		suffix: "nl.no",
		reversed: "on.ln"
	},
	{
		suffix: "nm.cn",
		reversed: "nc.mn"
	},
	{
		suffix: "nm.us",
		reversed: "su.mn"
	},
	{
		suffix: "no",
		reversed: "on"
	},
	{
		suffix: "no-ip.biz",
		reversed: "zib.pi-on"
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
		suffix: "no-ip.info",
		reversed: "ofni.pi-on"
	},
	{
		suffix: "no-ip.net",
		reversed: "ten.pi-on"
	},
	{
		suffix: "no-ip.org",
		reversed: "gro.pi-on"
	},
	{
		suffix: "no.com",
		reversed: "moc.on"
	},
	{
		suffix: "no.eu.org",
		reversed: "gro.ue.on"
	},
	{
		suffix: "no.it",
		reversed: "ti.on"
	},
	{
		suffix: "nobeoka.miyazaki.jp",
		reversed: "pj.ikazayim.akoebon"
	},
	{
		suffix: "noboribetsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustebirobon"
	},
	{
		suffix: "nobushi.jp",
		reversed: "pj.ihsubon"
	},
	{
		suffix: "noda.chiba.jp",
		reversed: "pj.abihc.adon"
	},
	{
		suffix: "noda.iwate.jp",
		reversed: "pj.etawi.adon"
	},
	{
		suffix: "nodes.k8s.fr-par.scw.cloud",
		reversed: "duolc.wcs.rap-rf.s8k.sedon"
	},
	{
		suffix: "nodes.k8s.nl-ams.scw.cloud",
		reversed: "duolc.wcs.sma-ln.s8k.sedon"
	},
	{
		suffix: "nodes.k8s.pl-waw.scw.cloud",
		reversed: "duolc.wcs.waw-lp.s8k.sedon"
	},
	{
		suffix: "nog.community",
		reversed: "ytinummoc.gon"
	},
	{
		suffix: "nogata.fukuoka.jp",
		reversed: "pj.akoukuf.atagon"
	},
	{
		suffix: "nogi.tochigi.jp",
		reversed: "pj.igihcot.igon"
	},
	{
		suffix: "noheji.aomori.jp",
		reversed: "pj.iromoa.ijehon"
	},
	{
		suffix: "noho.st",
		reversed: "ts.ohon"
	},
	{
		suffix: "nohost.me",
		reversed: "em.tsohon"
	},
	{
		suffix: "noip.me",
		reversed: "em.pion"
	},
	{
		suffix: "noip.us",
		reversed: "su.pion"
	},
	{
		suffix: "nokia",
		reversed: "aikon"
	},
	{
		suffix: "nom.ad",
		reversed: "da.mon"
	},
	{
		suffix: "nom.ag",
		reversed: "ga.mon"
	},
	{
		suffix: "nom.co",
		reversed: "oc.mon"
	},
	{
		suffix: "nom.es",
		reversed: "se.mon"
	},
	{
		suffix: "nom.fr",
		reversed: "rf.mon"
	},
	{
		suffix: "nom.km",
		reversed: "mk.mon"
	},
	{
		suffix: "nom.mg",
		reversed: "gm.mon"
	},
	{
		suffix: "nom.nc",
		reversed: "cn.mon"
	},
	{
		suffix: "nom.ni",
		reversed: "in.mon"
	},
	{
		suffix: "nom.pa",
		reversed: "ap.mon"
	},
	{
		suffix: "nom.pe",
		reversed: "ep.mon"
	},
	{
		suffix: "nom.pl",
		reversed: "lp.mon"
	},
	{
		suffix: "nom.re",
		reversed: "er.mon"
	},
	{
		suffix: "nom.ro",
		reversed: "or.mon"
	},
	{
		suffix: "nom.tm",
		reversed: "mt.mon"
	},
	{
		suffix: "nom.ve",
		reversed: "ev.mon"
	},
	{
		suffix: "nom.za",
		reversed: "az.mon"
	},
	{
		suffix: "nombre.bo",
		reversed: "ob.erbmon"
	},
	{
		suffix: "nome.cv",
		reversed: "vc.emon"
	},
	{
		suffix: "nome.pt",
		reversed: "tp.emon"
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
		suffix: "noop.app",
		reversed: "ppa.poon"
	},
	{
		suffix: "noor.jp",
		reversed: "pj.roon"
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
		suffix: "nordeste-idc.saveincloud.net",
		reversed: "ten.duolcnievas.cdi-etsedron"
	},
	{
		suffix: "nordkapp.no",
		reversed: "on.ppakdron"
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
		suffix: "nore-og-uvdal.no",
		reversed: "on.ladvu-go-eron"
	},
	{
		suffix: "norfolk.museum",
		reversed: "muesum.klofron"
	},
	{
		suffix: "north-kazakhstan.su",
		reversed: "us.natshkazak-htron"
	},
	{
		suffix: "north.museum",
		reversed: "muesum.htron"
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
		suffix: "nose.osaka.jp",
		reversed: "pj.akaso.eson"
	},
	{
		suffix: "nosegawa.nara.jp",
		reversed: "pj.aran.awageson"
	},
	{
		suffix: "noshiro.akita.jp",
		reversed: "pj.atika.orihson"
	},
	{
		suffix: "not.br",
		reversed: "rb.ton"
	},
	{
		suffix: "notaires.fr",
		reversed: "rf.seriaton"
	},
	{
		suffix: "notaires.km",
		reversed: "mk.seriaton"
	},
	{
		suffix: "noticeable.news",
		reversed: "swen.elbaeciton"
	},
	{
		suffix: "noticias.bo",
		reversed: "ob.saiciton"
	},
	{
		suffix: "noto.ishikawa.jp",
		reversed: "pj.awakihsi.oton"
	},
	{
		suffix: "notodden.no",
		reversed: "on.neddoton"
	},
	{
		suffix: "notogawa.shiga.jp",
		reversed: "pj.agihs.awagoton"
	},
	{
		suffix: "notteroy.no",
		reversed: "on.yoretton"
	},
	{
		suffix: "nov.ru",
		reversed: "ur.von"
	},
	{
		suffix: "nov.su",
		reversed: "us.von"
	},
	{
		suffix: "novara.it",
		reversed: "ti.aravon"
	},
	{
		suffix: "novecore.site",
		reversed: "etis.erocevon"
	},
	{
		suffix: "now",
		reversed: "won"
	},
	{
		suffix: "now-dns.net",
		reversed: "ten.snd-won"
	},
	{
		suffix: "now-dns.org",
		reversed: "gro.snd-won"
	},
	{
		suffix: "now-dns.top",
		reversed: "pot.snd-won"
	},
	{
		suffix: "now.sh",
		reversed: "hs.won"
	},
	{
		suffix: "nowaruda.pl",
		reversed: "lp.adurawon"
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
		suffix: "nozawaonsen.nagano.jp",
		reversed: "pj.onagan.nesnoawazon"
	},
	{
		suffix: "nr",
		reversed: "rn"
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
		suffix: "nrw.museum",
		reversed: "muesum.wrn"
	},
	{
		suffix: "ns.ca",
		reversed: "ac.sn"
	},
	{
		suffix: "nsn.us",
		reversed: "su.nsn"
	},
	{
		suffix: "nsupdate.info",
		reversed: "ofni.etadpusn"
	},
	{
		suffix: "nsw.au",
		reversed: "ua.wsn"
	},
	{
		suffix: "nsw.edu.au",
		reversed: "ua.ude.wsn"
	},
	{
		suffix: "nt.au",
		reversed: "ua.tn"
	},
	{
		suffix: "nt.ca",
		reversed: "ac.tn"
	},
	{
		suffix: "nt.edu.au",
		reversed: "ua.ude.tn"
	},
	{
		suffix: "nt.no",
		reversed: "on.tn"
	},
	{
		suffix: "nt.ro",
		reversed: "or.tn"
	},
	{
		suffix: "ntdll.top",
		reversed: "pot.lldtn"
	},
	{
		suffix: "ntr.br",
		reversed: "rb.rtn"
	},
	{
		suffix: "ntt",
		reversed: "ttn"
	},
	{
		suffix: "nu",
		reversed: "un"
	},
	{
		suffix: "nu.ca",
		reversed: "ac.un"
	},
	{
		suffix: "nu.it",
		reversed: "ti.un"
	},
	{
		suffix: "numata.gunma.jp",
		reversed: "pj.amnug.atamun"
	},
	{
		suffix: "numata.hokkaido.jp",
		reversed: "pj.odiakkoh.atamun"
	},
	{
		suffix: "numazu.shizuoka.jp",
		reversed: "pj.akouzihs.uzamun"
	},
	{
		suffix: "nuoro.it",
		reversed: "ti.oroun"
	},
	{
		suffix: "nv.us",
		reversed: "su.vn"
	},
	{
		suffix: "nx.cn",
		reversed: "nc.xn"
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
		suffix: "ny.us",
		reversed: "su.yn"
	},
	{
		suffix: "nyaa.am",
		reversed: "ma.aayn"
	},
	{
		suffix: "nyan.to",
		reversed: "ot.nayn"
	},
	{
		suffix: "nyc",
		reversed: "cyn"
	},
	{
		suffix: "nyc.mn",
		reversed: "nm.cyn"
	},
	{
		suffix: "nyc.museum",
		reversed: "muesum.cyn"
	},
	{
		suffix: "nyny.museum",
		reversed: "muesum.ynyn"
	},
	{
		suffix: "nysa.pl",
		reversed: "lp.asyn"
	},
	{
		suffix: "nyuzen.toyama.jp",
		reversed: "pj.amayot.nezuyn"
	},
	{
		suffix: "nz",
		reversed: "zn"
	},
	{
		suffix: "nz.basketball",
		reversed: "llabteksab.zn"
	},
	{
		suffix: "nz.eu.org",
		reversed: "gro.ue.zn"
	},
	{
		suffix: "návuotna.no",
		reversed: "on.awh-antouvn--nx"
	},
	{
		suffix: "nååmesjevuemie.no",
		reversed: "on.abct-eimeuvejsemn--nx"
	},
	{
		suffix: "nærøy.no",
		reversed: "on.g5aly-yrn--nx"
	},
	{
		suffix: "nøtterøy.no",
		reversed: "on.eayb-yrettn--nx"
	},
	{
		suffix: "o.bg",
		reversed: "gb.o"
	},
	{
		suffix: "o.se",
		reversed: "es.o"
	},
	{
		suffix: "oamishirasato.chiba.jp",
		reversed: "pj.abihc.otasarihsimao"
	},
	{
		suffix: "oarai.ibaraki.jp",
		reversed: "pj.ikarabi.iarao"
	},
	{
		suffix: "obama.fukui.jp",
		reversed: "pj.iukuf.amabo"
	},
	{
		suffix: "obama.nagasaki.jp",
		reversed: "pj.ikasagan.amabo"
	},
	{
		suffix: "obanazawa.yamagata.jp",
		reversed: "pj.atagamay.awazanabo"
	},
	{
		suffix: "obi",
		reversed: "ibo"
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
		suffix: "obninsk.su",
		reversed: "us.ksninbo"
	},
	{
		suffix: "observer",
		reversed: "revresbo"
	},
	{
		suffix: "obu.aichi.jp",
		reversed: "pj.ihcia.ubo"
	},
	{
		suffix: "obuse.nagano.jp",
		reversed: "pj.onagan.esubo"
	},
	{
		suffix: "oceanographic.museum",
		reversed: "muesum.cihpargonaeco"
	},
	{
		suffix: "oceanographique.museum",
		reversed: "muesum.euqihpargonaeco"
	},
	{
		suffix: "ocelot.mythic-beasts.com",
		reversed: "moc.stsaeb-cihtym.toleco"
	},
	{
		suffix: "ochi.kochi.jp",
		reversed: "pj.ihcok.ihco"
	},
	{
		suffix: "od.ua",
		reversed: "au.do"
	},
	{
		suffix: "odate.akita.jp",
		reversed: "pj.atika.etado"
	},
	{
		suffix: "odawara.kanagawa.jp",
		reversed: "pj.awaganak.arawado"
	},
	{
		suffix: "odda.no",
		reversed: "on.addo"
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
		suffix: "odo.br",
		reversed: "rb.odo"
	},
	{
		suffix: "oe.yamagata.jp",
		reversed: "pj.atagamay.eo"
	},
	{
		suffix: "of.by",
		reversed: "yb.fo"
	},
	{
		suffix: "of.je",
		reversed: "ej.fo"
	},
	{
		suffix: "of.no",
		reversed: "on.fo"
	},
	{
		suffix: "off.ai",
		reversed: "ia.ffo"
	},
	{
		suffix: "office",
		reversed: "eciffo"
	},
	{
		suffix: "office-on-the.net",
		reversed: "ten.eht-no-eciffo"
	},
	{
		suffix: "official.academy",
		reversed: "ymedaca.laiciffo"
	},
	{
		suffix: "official.ec",
		reversed: "ce.laiciffo"
	},
	{
		suffix: "ofunato.iwate.jp",
		reversed: "pj.etawi.otanufo"
	},
	{
		suffix: "og.ao",
		reversed: "oa.go"
	},
	{
		suffix: "og.it",
		reversed: "ti.go"
	},
	{
		suffix: "oga.akita.jp",
		reversed: "pj.atika.ago"
	},
	{
		suffix: "ogaki.gifu.jp",
		reversed: "pj.ufig.ikago"
	},
	{
		suffix: "ogano.saitama.jp",
		reversed: "pj.amatias.onago"
	},
	{
		suffix: "ogasawara.tokyo.jp",
		reversed: "pj.oykot.arawasago"
	},
	{
		suffix: "ogata.akita.jp",
		reversed: "pj.atika.atago"
	},
	{
		suffix: "ogawa.ibaraki.jp",
		reversed: "pj.ikarabi.awago"
	},
	{
		suffix: "ogawa.nagano.jp",
		reversed: "pj.onagan.awago"
	},
	{
		suffix: "ogawa.saitama.jp",
		reversed: "pj.amatias.awago"
	},
	{
		suffix: "ogawara.miyagi.jp",
		reversed: "pj.igayim.arawago"
	},
	{
		suffix: "ogi.saga.jp",
		reversed: "pj.agas.igo"
	},
	{
		suffix: "ogimi.okinawa.jp",
		reversed: "pj.awaniko.imigo"
	},
	{
		suffix: "ogliastra.it",
		reversed: "ti.artsailgo"
	},
	{
		suffix: "ogori.fukuoka.jp",
		reversed: "pj.akoukuf.irogo"
	},
	{
		suffix: "ogose.saitama.jp",
		reversed: "pj.amatias.esogo"
	},
	{
		suffix: "oguchi.aichi.jp",
		reversed: "pj.ihcia.ihcugo"
	},
	{
		suffix: "oguni.kumamoto.jp",
		reversed: "pj.otomamuk.inugo"
	},
	{
		suffix: "oguni.yamagata.jp",
		reversed: "pj.atagamay.inugo"
	},
	{
		suffix: "oh.us",
		reversed: "su.ho"
	},
	{
		suffix: "oharu.aichi.jp",
		reversed: "pj.ihcia.uraho"
	},
	{
		suffix: "ohda.shimane.jp",
		reversed: "pj.enamihs.adho"
	},
	{
		suffix: "ohi.fukui.jp",
		reversed: "pj.iukuf.iho"
	},
	{
		suffix: "ohira.miyagi.jp",
		reversed: "pj.igayim.ariho"
	},
	{
		suffix: "ohira.tochigi.jp",
		reversed: "pj.igihcot.ariho"
	},
	{
		suffix: "ohkura.yamagata.jp",
		reversed: "pj.atagamay.arukho"
	},
	{
		suffix: "ohtawara.tochigi.jp",
		reversed: "pj.igihcot.arawatho"
	},
	{
		suffix: "oi.kanagawa.jp",
		reversed: "pj.awaganak.io"
	},
	{
		suffix: "oirase.aomori.jp",
		reversed: "pj.iromoa.esario"
	},
	{
		suffix: "oirm.gov.pl",
		reversed: "lp.vog.mrio"
	},
	{
		suffix: "oishida.yamagata.jp",
		reversed: "pj.atagamay.adihsio"
	},
	{
		suffix: "oiso.kanagawa.jp",
		reversed: "pj.awaganak.osio"
	},
	{
		suffix: "oita.jp",
		reversed: "pj.atio"
	},
	{
		suffix: "oita.oita.jp",
		reversed: "pj.atio.atio"
	},
	{
		suffix: "oizumi.gunma.jp",
		reversed: "pj.amnug.imuzio"
	},
	{
		suffix: "oji.nara.jp",
		reversed: "pj.aran.ijo"
	},
	{
		suffix: "ojiya.niigata.jp",
		reversed: "pj.atagiin.ayijo"
	},
	{
		suffix: "ok.us",
		reversed: "su.ko"
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
		suffix: "okawa.kochi.jp",
		reversed: "pj.ihcok.awako"
	},
	{
		suffix: "okaya.nagano.jp",
		reversed: "pj.onagan.ayako"
	},
	{
		suffix: "okayama.jp",
		reversed: "pj.amayako"
	},
	{
		suffix: "okayama.okayama.jp",
		reversed: "pj.amayako.amayako"
	},
	{
		suffix: "okazaki.aichi.jp",
		reversed: "pj.ihcia.ikazako"
	},
	{
		suffix: "okegawa.saitama.jp",
		reversed: "pj.amatias.awageko"
	},
	{
		suffix: "oketo.hokkaido.jp",
		reversed: "pj.odiakkoh.oteko"
	},
	{
		suffix: "oki.fukuoka.jp",
		reversed: "pj.akoukuf.iko"
	},
	{
		suffix: "okinawa",
		reversed: "awaniko"
	},
	{
		suffix: "okinawa.jp",
		reversed: "pj.awaniko"
	},
	{
		suffix: "okinawa.okinawa.jp",
		reversed: "pj.awaniko.awaniko"
	},
	{
		suffix: "okinoshima.shimane.jp",
		reversed: "pj.enamihs.amihsoniko"
	},
	{
		suffix: "okoppe.hokkaido.jp",
		reversed: "pj.odiakkoh.eppoko"
	},
	{
		suffix: "oksnes.no",
		reversed: "on.sensko"
	},
	{
		suffix: "okuizumo.shimane.jp",
		reversed: "pj.enamihs.omuziuko"
	},
	{
		suffix: "okuma.fukushima.jp",
		reversed: "pj.amihsukuf.amuko"
	},
	{
		suffix: "okutama.tokyo.jp",
		reversed: "pj.oykot.amatuko"
	},
	{
		suffix: "ol.no",
		reversed: "on.lo"
	},
	{
		suffix: "olawa.pl",
		reversed: "lp.awalo"
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
		suffix: "olbia-tempio.it",
		reversed: "ti.oipmet-aiblo"
	},
	{
		suffix: "olbiatempio.it",
		reversed: "ti.oipmetaiblo"
	},
	{
		suffix: "oldnavy",
		reversed: "yvandlo"
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
		suffix: "ollo",
		reversed: "ollo"
	},
	{
		suffix: "olsztyn.pl",
		reversed: "lp.nytzslo"
	},
	{
		suffix: "om",
		reversed: "mo"
	},
	{
		suffix: "omachi.nagano.jp",
		reversed: "pj.onagan.ihcamo"
	},
	{
		suffix: "omachi.saga.jp",
		reversed: "pj.agas.ihcamo"
	},
	{
		suffix: "omaezaki.shizuoka.jp",
		reversed: "pj.akouzihs.ikazeamo"
	},
	{
		suffix: "omaha.museum",
		reversed: "muesum.ahamo"
	},
	{
		suffix: "omasvuotna.no",
		reversed: "on.antouvsamo"
	},
	{
		suffix: "ome.tokyo.jp",
		reversed: "pj.oykot.emo"
	},
	{
		suffix: "omega",
		reversed: "agemo"
	},
	{
		suffix: "omg.lol",
		reversed: "lol.gmo"
	},
	{
		suffix: "omi.nagano.jp",
		reversed: "pj.onagan.imo"
	},
	{
		suffix: "omi.niigata.jp",
		reversed: "pj.atagiin.imo"
	},
	{
		suffix: "omigawa.chiba.jp",
		reversed: "pj.abihc.awagimo"
	},
	{
		suffix: "omihachiman.shiga.jp",
		reversed: "pj.agihs.namihcahimo"
	},
	{
		suffix: "omitama.ibaraki.jp",
		reversed: "pj.ikarabi.amatimo"
	},
	{
		suffix: "omiya.saitama.jp",
		reversed: "pj.amatias.ayimo"
	},
	{
		suffix: "omniwe.site",
		reversed: "etis.ewinmo"
	},
	{
		suffix: "omotego.fukushima.jp",
		reversed: "pj.amihsukuf.ogetomo"
	},
	{
		suffix: "omura.nagasaki.jp",
		reversed: "pj.ikasagan.arumo"
	},
	{
		suffix: "omuta.fukuoka.jp",
		reversed: "pj.akoukuf.atumo"
	},
	{
		suffix: "on-aptible.com",
		reversed: "moc.elbitpa-no"
	},
	{
		suffix: "on-the-web.tv",
		reversed: "vt.bew-eht-no"
	},
	{
		suffix: "on-web.fr",
		reversed: "rf.bew-no"
	},
	{
		suffix: "on.ca",
		reversed: "ac.no"
	},
	{
		suffix: "onagawa.miyagi.jp",
		reversed: "pj.igayim.awagano"
	},
	{
		suffix: "onavstack.net",
		reversed: "ten.kcatsvano"
	},
	{
		suffix: "oncilla.mythic-beasts.com",
		reversed: "moc.stsaeb-cihtym.allicno"
	},
	{
		suffix: "ondigitalocean.app",
		reversed: "ppa.naecolatigidno"
	},
	{
		suffix: "one",
		reversed: "eno"
	},
	{
		suffix: "onfabrica.com",
		reversed: "moc.acirbafno"
	},
	{
		suffix: "onflashdrive.app",
		reversed: "ppa.evirdhsalfno"
	},
	{
		suffix: "ong",
		reversed: "gno"
	},
	{
		suffix: "ong.br",
		reversed: "rb.gno"
	},
	{
		suffix: "onga.fukuoka.jp",
		reversed: "pj.akoukuf.agno"
	},
	{
		suffix: "onion",
		reversed: "noino"
	},
	{
		suffix: "onjuku.chiba.jp",
		reversed: "pj.abihc.ukujno"
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
		suffix: "online.museum",
		reversed: "muesum.enilno"
	},
	{
		suffix: "online.th",
		reversed: "ht.enilno"
	},
	{
		suffix: "onna.okinawa.jp",
		reversed: "pj.awaniko.anno"
	},
	{
		suffix: "ono.fukui.jp",
		reversed: "pj.iukuf.ono"
	},
	{
		suffix: "ono.fukushima.jp",
		reversed: "pj.amihsukuf.ono"
	},
	{
		suffix: "ono.hyogo.jp",
		reversed: "pj.ogoyh.ono"
	},
	{
		suffix: "onojo.fukuoka.jp",
		reversed: "pj.akoukuf.ojono"
	},
	{
		suffix: "onomichi.hiroshima.jp",
		reversed: "pj.amihsorih.ihcimono"
	},
	{
		suffix: "onporter.run",
		reversed: "nur.retropno"
	},
	{
		suffix: "onred.one",
		reversed: "eno.derno"
	},
	{
		suffix: "onrender.com",
		reversed: "moc.rednerno"
	},
	{
		suffix: "ontario.museum",
		reversed: "muesum.oiratno"
	},
	{
		suffix: "onthewifi.com",
		reversed: "moc.ifiwehtno"
	},
	{
		suffix: "onza.mythic-beasts.com",
		reversed: "moc.stsaeb-cihtym.azno"
	},
	{
		suffix: "ooguy.com",
		reversed: "moc.yugoo"
	},
	{
		suffix: "ookuwa.nagano.jp",
		reversed: "pj.onagan.awukoo"
	},
	{
		suffix: "ooo",
		reversed: "ooo"
	},
	{
		suffix: "oops.jp",
		reversed: "pj.spoo"
	},
	{
		suffix: "ooshika.nagano.jp",
		reversed: "pj.onagan.akihsoo"
	},
	{
		suffix: "open",
		reversed: "nepo"
	},
	{
		suffix: "openair.museum",
		reversed: "muesum.rianepo"
	},
	{
		suffix: "opencraft.hosting",
		reversed: "gnitsoh.tfarcnepo"
	},
	{
		suffix: "opensocial.site",
		reversed: "etis.laicosnepo"
	},
	{
		suffix: "operaunite.com",
		reversed: "moc.etinuarepo"
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
		suffix: "or.at",
		reversed: "ta.ro"
	},
	{
		suffix: "or.bi",
		reversed: "ib.ro"
	},
	{
		suffix: "or.ci",
		reversed: "ic.ro"
	},
	{
		suffix: "or.cr",
		reversed: "rc.ro"
	},
	{
		suffix: "or.id",
		reversed: "di.ro"
	},
	{
		suffix: "or.it",
		reversed: "ti.ro"
	},
	{
		suffix: "or.jp",
		reversed: "pj.ro"
	},
	{
		suffix: "or.ke",
		reversed: "ek.ro"
	},
	{
		suffix: "or.kr",
		reversed: "rk.ro"
	},
	{
		suffix: "or.mu",
		reversed: "um.ro"
	},
	{
		suffix: "or.na",
		reversed: "an.ro"
	},
	{
		suffix: "or.pw",
		reversed: "wp.ro"
	},
	{
		suffix: "or.th",
		reversed: "ht.ro"
	},
	{
		suffix: "or.tz",
		reversed: "zt.ro"
	},
	{
		suffix: "or.ug",
		reversed: "gu.ro"
	},
	{
		suffix: "or.us",
		reversed: "su.ro"
	},
	{
		suffix: "ora.gunma.jp",
		reversed: "pj.amnug.aro"
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
		suffix: "orangecloud.tn",
		reversed: "nt.duolcegnaro"
	},
	{
		suffix: "oregon.museum",
		reversed: "muesum.nogero"
	},
	{
		suffix: "oregontrail.museum",
		reversed: "muesum.liartnogero"
	},
	{
		suffix: "org",
		reversed: "gro"
	},
	{
		suffix: "org.ac",
		reversed: "ca.gro"
	},
	{
		suffix: "org.ae",
		reversed: "ea.gro"
	},
	{
		suffix: "org.af",
		reversed: "fa.gro"
	},
	{
		suffix: "org.ag",
		reversed: "ga.gro"
	},
	{
		suffix: "org.ai",
		reversed: "ia.gro"
	},
	{
		suffix: "org.al",
		reversed: "la.gro"
	},
	{
		suffix: "org.am",
		reversed: "ma.gro"
	},
	{
		suffix: "org.ar",
		reversed: "ra.gro"
	},
	{
		suffix: "org.au",
		reversed: "ua.gro"
	},
	{
		suffix: "org.az",
		reversed: "za.gro"
	},
	{
		suffix: "org.ba",
		reversed: "ab.gro"
	},
	{
		suffix: "org.bb",
		reversed: "bb.gro"
	},
	{
		suffix: "org.bh",
		reversed: "hb.gro"
	},
	{
		suffix: "org.bi",
		reversed: "ib.gro"
	},
	{
		suffix: "org.bm",
		reversed: "mb.gro"
	},
	{
		suffix: "org.bn",
		reversed: "nb.gro"
	},
	{
		suffix: "org.bo",
		reversed: "ob.gro"
	},
	{
		suffix: "org.br",
		reversed: "rb.gro"
	},
	{
		suffix: "org.bs",
		reversed: "sb.gro"
	},
	{
		suffix: "org.bt",
		reversed: "tb.gro"
	},
	{
		suffix: "org.bw",
		reversed: "wb.gro"
	},
	{
		suffix: "org.bz",
		reversed: "zb.gro"
	},
	{
		suffix: "org.ci",
		reversed: "ic.gro"
	},
	{
		suffix: "org.cn",
		reversed: "nc.gro"
	},
	{
		suffix: "org.co",
		reversed: "oc.gro"
	},
	{
		suffix: "org.cu",
		reversed: "uc.gro"
	},
	{
		suffix: "org.cv",
		reversed: "vc.gro"
	},
	{
		suffix: "org.cw",
		reversed: "wc.gro"
	},
	{
		suffix: "org.cy",
		reversed: "yc.gro"
	},
	{
		suffix: "org.dm",
		reversed: "md.gro"
	},
	{
		suffix: "org.do",
		reversed: "od.gro"
	},
	{
		suffix: "org.dz",
		reversed: "zd.gro"
	},
	{
		suffix: "org.ec",
		reversed: "ce.gro"
	},
	{
		suffix: "org.ee",
		reversed: "ee.gro"
	},
	{
		suffix: "org.eg",
		reversed: "ge.gro"
	},
	{
		suffix: "org.es",
		reversed: "se.gro"
	},
	{
		suffix: "org.et",
		reversed: "te.gro"
	},
	{
		suffix: "org.fj",
		reversed: "jf.gro"
	},
	{
		suffix: "org.fm",
		reversed: "mf.gro"
	},
	{
		suffix: "org.ge",
		reversed: "eg.gro"
	},
	{
		suffix: "org.gg",
		reversed: "gg.gro"
	},
	{
		suffix: "org.gh",
		reversed: "hg.gro"
	},
	{
		suffix: "org.gi",
		reversed: "ig.gro"
	},
	{
		suffix: "org.gl",
		reversed: "lg.gro"
	},
	{
		suffix: "org.gn",
		reversed: "ng.gro"
	},
	{
		suffix: "org.gp",
		reversed: "pg.gro"
	},
	{
		suffix: "org.gr",
		reversed: "rg.gro"
	},
	{
		suffix: "org.gt",
		reversed: "tg.gro"
	},
	{
		suffix: "org.gu",
		reversed: "ug.gro"
	},
	{
		suffix: "org.gy",
		reversed: "yg.gro"
	},
	{
		suffix: "org.hk",
		reversed: "kh.gro"
	},
	{
		suffix: "org.hn",
		reversed: "nh.gro"
	},
	{
		suffix: "org.ht",
		reversed: "th.gro"
	},
	{
		suffix: "org.hu",
		reversed: "uh.gro"
	},
	{
		suffix: "org.il",
		reversed: "li.gro"
	},
	{
		suffix: "org.im",
		reversed: "mi.gro"
	},
	{
		suffix: "org.in",
		reversed: "ni.gro"
	},
	{
		suffix: "org.iq",
		reversed: "qi.gro"
	},
	{
		suffix: "org.ir",
		reversed: "ri.gro"
	},
	{
		suffix: "org.is",
		reversed: "si.gro"
	},
	{
		suffix: "org.je",
		reversed: "ej.gro"
	},
	{
		suffix: "org.jo",
		reversed: "oj.gro"
	},
	{
		suffix: "org.kg",
		reversed: "gk.gro"
	},
	{
		suffix: "org.ki",
		reversed: "ik.gro"
	},
	{
		suffix: "org.km",
		reversed: "mk.gro"
	},
	{
		suffix: "org.kn",
		reversed: "nk.gro"
	},
	{
		suffix: "org.kp",
		reversed: "pk.gro"
	},
	{
		suffix: "org.kw",
		reversed: "wk.gro"
	},
	{
		suffix: "org.ky",
		reversed: "yk.gro"
	},
	{
		suffix: "org.kz",
		reversed: "zk.gro"
	},
	{
		suffix: "org.la",
		reversed: "al.gro"
	},
	{
		suffix: "org.lb",
		reversed: "bl.gro"
	},
	{
		suffix: "org.lc",
		reversed: "cl.gro"
	},
	{
		suffix: "org.lk",
		reversed: "kl.gro"
	},
	{
		suffix: "org.lr",
		reversed: "rl.gro"
	},
	{
		suffix: "org.ls",
		reversed: "sl.gro"
	},
	{
		suffix: "org.lv",
		reversed: "vl.gro"
	},
	{
		suffix: "org.ly",
		reversed: "yl.gro"
	},
	{
		suffix: "org.ma",
		reversed: "am.gro"
	},
	{
		suffix: "org.me",
		reversed: "em.gro"
	},
	{
		suffix: "org.mg",
		reversed: "gm.gro"
	},
	{
		suffix: "org.mk",
		reversed: "km.gro"
	},
	{
		suffix: "org.ml",
		reversed: "lm.gro"
	},
	{
		suffix: "org.mn",
		reversed: "nm.gro"
	},
	{
		suffix: "org.mo",
		reversed: "om.gro"
	},
	{
		suffix: "org.ms",
		reversed: "sm.gro"
	},
	{
		suffix: "org.mt",
		reversed: "tm.gro"
	},
	{
		suffix: "org.mu",
		reversed: "um.gro"
	},
	{
		suffix: "org.mv",
		reversed: "vm.gro"
	},
	{
		suffix: "org.mw",
		reversed: "wm.gro"
	},
	{
		suffix: "org.mx",
		reversed: "xm.gro"
	},
	{
		suffix: "org.my",
		reversed: "ym.gro"
	},
	{
		suffix: "org.mz",
		reversed: "zm.gro"
	},
	{
		suffix: "org.na",
		reversed: "an.gro"
	},
	{
		suffix: "org.ng",
		reversed: "gn.gro"
	},
	{
		suffix: "org.ni",
		reversed: "in.gro"
	},
	{
		suffix: "org.nr",
		reversed: "rn.gro"
	},
	{
		suffix: "org.nz",
		reversed: "zn.gro"
	},
	{
		suffix: "org.om",
		reversed: "mo.gro"
	},
	{
		suffix: "org.pa",
		reversed: "ap.gro"
	},
	{
		suffix: "org.pe",
		reversed: "ep.gro"
	},
	{
		suffix: "org.pf",
		reversed: "fp.gro"
	},
	{
		suffix: "org.ph",
		reversed: "hp.gro"
	},
	{
		suffix: "org.pk",
		reversed: "kp.gro"
	},
	{
		suffix: "org.pl",
		reversed: "lp.gro"
	},
	{
		suffix: "org.pn",
		reversed: "np.gro"
	},
	{
		suffix: "org.pr",
		reversed: "rp.gro"
	},
	{
		suffix: "org.ps",
		reversed: "sp.gro"
	},
	{
		suffix: "org.pt",
		reversed: "tp.gro"
	},
	{
		suffix: "org.py",
		reversed: "yp.gro"
	},
	{
		suffix: "org.qa",
		reversed: "aq.gro"
	},
	{
		suffix: "org.ro",
		reversed: "or.gro"
	},
	{
		suffix: "org.rs",
		reversed: "sr.gro"
	},
	{
		suffix: "org.ru",
		reversed: "ur.gro"
	},
	{
		suffix: "org.rw",
		reversed: "wr.gro"
	},
	{
		suffix: "org.sa",
		reversed: "as.gro"
	},
	{
		suffix: "org.sb",
		reversed: "bs.gro"
	},
	{
		suffix: "org.sc",
		reversed: "cs.gro"
	},
	{
		suffix: "org.sd",
		reversed: "ds.gro"
	},
	{
		suffix: "org.se",
		reversed: "es.gro"
	},
	{
		suffix: "org.sg",
		reversed: "gs.gro"
	},
	{
		suffix: "org.sh",
		reversed: "hs.gro"
	},
	{
		suffix: "org.sl",
		reversed: "ls.gro"
	},
	{
		suffix: "org.sn",
		reversed: "ns.gro"
	},
	{
		suffix: "org.so",
		reversed: "os.gro"
	},
	{
		suffix: "org.ss",
		reversed: "ss.gro"
	},
	{
		suffix: "org.st",
		reversed: "ts.gro"
	},
	{
		suffix: "org.sv",
		reversed: "vs.gro"
	},
	{
		suffix: "org.sy",
		reversed: "ys.gro"
	},
	{
		suffix: "org.sz",
		reversed: "zs.gro"
	},
	{
		suffix: "org.tj",
		reversed: "jt.gro"
	},
	{
		suffix: "org.tm",
		reversed: "mt.gro"
	},
	{
		suffix: "org.tn",
		reversed: "nt.gro"
	},
	{
		suffix: "org.to",
		reversed: "ot.gro"
	},
	{
		suffix: "org.tr",
		reversed: "rt.gro"
	},
	{
		suffix: "org.tt",
		reversed: "tt.gro"
	},
	{
		suffix: "org.tw",
		reversed: "wt.gro"
	},
	{
		suffix: "org.ua",
		reversed: "au.gro"
	},
	{
		suffix: "org.ug",
		reversed: "gu.gro"
	},
	{
		suffix: "org.uk",
		reversed: "ku.gro"
	},
	{
		suffix: "org.uy",
		reversed: "yu.gro"
	},
	{
		suffix: "org.uz",
		reversed: "zu.gro"
	},
	{
		suffix: "org.vc",
		reversed: "cv.gro"
	},
	{
		suffix: "org.ve",
		reversed: "ev.gro"
	},
	{
		suffix: "org.vi",
		reversed: "iv.gro"
	},
	{
		suffix: "org.vn",
		reversed: "nv.gro"
	},
	{
		suffix: "org.vu",
		reversed: "uv.gro"
	},
	{
		suffix: "org.ws",
		reversed: "sw.gro"
	},
	{
		suffix: "org.ye",
		reversed: "ey.gro"
	},
	{
		suffix: "org.yt",
		reversed: "ty.gro"
	},
	{
		suffix: "org.za",
		reversed: "az.gro"
	},
	{
		suffix: "org.zm",
		reversed: "mz.gro"
	},
	{
		suffix: "org.zw",
		reversed: "wz.gro"
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
		suffix: "oristano.it",
		reversed: "ti.onatsiro"
	},
	{
		suffix: "orkanger.no",
		reversed: "on.regnakro"
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
		suffix: "orsites.com",
		reversed: "moc.setisro"
	},
	{
		suffix: "orskog.no",
		reversed: "on.goksro"
	},
	{
		suffix: "orsta.no",
		reversed: "on.atsro"
	},
	{
		suffix: "orx.biz",
		reversed: "zib.xro"
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
		suffix: "osaka",
		reversed: "akaso"
	},
	{
		suffix: "osaka.jp",
		reversed: "pj.akaso"
	},
	{
		suffix: "osakasayama.osaka.jp",
		reversed: "pj.akaso.amayasakaso"
	},
	{
		suffix: "osaki.miyagi.jp",
		reversed: "pj.igayim.ikaso"
	},
	{
		suffix: "osakikamijima.hiroshima.jp",
		reversed: "pj.amihsorih.amijimakikaso"
	},
	{
		suffix: "osasco.br",
		reversed: "rb.ocsaso"
	},
	{
		suffix: "osen.no",
		reversed: "on.neso"
	},
	{
		suffix: "oseto.nagasaki.jp",
		reversed: "pj.ikasagan.oteso"
	},
	{
		suffix: "oshima.tokyo.jp",
		reversed: "pj.oykot.amihso"
	},
	{
		suffix: "oshima.yamaguchi.jp",
		reversed: "pj.ihcugamay.amihso"
	},
	{
		suffix: "oshino.yamanashi.jp",
		reversed: "pj.ihsanamay.onihso"
	},
	{
		suffix: "oshu.iwate.jp",
		reversed: "pj.etawi.uhso"
	},
	{
		suffix: "oslo.no",
		reversed: "on.olso"
	},
	{
		suffix: "osoyro.no",
		reversed: "on.oryoso"
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
		suffix: "osøyro.no",
		reversed: "on.auw-oryso--nx"
	},
	{
		suffix: "ot.it",
		reversed: "ti.to"
	},
	{
		suffix: "ota.gunma.jp",
		reversed: "pj.amnug.ato"
	},
	{
		suffix: "ota.tokyo.jp",
		reversed: "pj.oykot.ato"
	},
	{
		suffix: "otago.museum",
		reversed: "muesum.ogato"
	},
	{
		suffix: "otake.hiroshima.jp",
		reversed: "pj.amihsorih.ekato"
	},
	{
		suffix: "otaki.chiba.jp",
		reversed: "pj.abihc.ikato"
	},
	{
		suffix: "otaki.nagano.jp",
		reversed: "pj.onagan.ikato"
	},
	{
		suffix: "otaki.saitama.jp",
		reversed: "pj.amatias.ikato"
	},
	{
		suffix: "otama.fukushima.jp",
		reversed: "pj.amihsukuf.amato"
	},
	{
		suffix: "otari.nagano.jp",
		reversed: "pj.onagan.irato"
	},
	{
		suffix: "otaru.hokkaido.jp",
		reversed: "pj.odiakkoh.urato"
	},
	{
		suffix: "other.nf",
		reversed: "fn.rehto"
	},
	{
		suffix: "oto.fukuoka.jp",
		reversed: "pj.akoukuf.oto"
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
		suffix: "otoyo.kochi.jp",
		reversed: "pj.ihcok.oyoto"
	},
	{
		suffix: "otsu.shiga.jp",
		reversed: "pj.agihs.usto"
	},
	{
		suffix: "otsuchi.iwate.jp",
		reversed: "pj.etawi.ihcusto"
	},
	{
		suffix: "otsuka",
		reversed: "akusto"
	},
	{
		suffix: "otsuki.kochi.jp",
		reversed: "pj.ihcok.ikusto"
	},
	{
		suffix: "otsuki.yamanashi.jp",
		reversed: "pj.ihsanamay.ikusto"
	},
	{
		suffix: "ott",
		reversed: "tto"
	},
	{
		suffix: "ouchi.saga.jp",
		reversed: "pj.agas.ihcuo"
	},
	{
		suffix: "ouda.nara.jp",
		reversed: "pj.aran.aduo"
	},
	{
		suffix: "oum.gov.pl",
		reversed: "lp.vog.muo"
	},
	{
		suffix: "oumu.hokkaido.jp",
		reversed: "pj.odiakkoh.umuo"
	},
	{
		suffix: "outsystemscloud.com",
		reversed: "moc.duolcsmetsystuo"
	},
	{
		suffix: "overhalla.no",
		reversed: "on.allahrevo"
	},
	{
		suffix: "ovh",
		reversed: "hvo"
	},
	{
		suffix: "ovre-eiker.no",
		reversed: "on.rekie-ervo"
	},
	{
		suffix: "owani.aomori.jp",
		reversed: "pj.iromoa.inawo"
	},
	{
		suffix: "owariasahi.aichi.jp",
		reversed: "pj.ihcia.ihasairawo"
	},
	{
		suffix: "own.pm",
		reversed: "mp.nwo"
	},
	{
		suffix: "ownip.net",
		reversed: "ten.pinwo"
	},
	{
		suffix: "ownprovider.com",
		reversed: "moc.redivorpnwo"
	},
	{
		suffix: "ox.rs",
		reversed: "sr.xo"
	},
	{
		suffix: "oxa.cloud",
		reversed: "duolc.axo"
	},
	{
		suffix: "oxford.museum",
		reversed: "muesum.drofxo"
	},
	{
		suffix: "oy.lc",
		reversed: "cl.yo"
	},
	{
		suffix: "oya.to",
		reversed: "ot.ayo"
	},
	{
		suffix: "oyabe.toyama.jp",
		reversed: "pj.amayot.ebayo"
	},
	{
		suffix: "oyama.tochigi.jp",
		reversed: "pj.igihcot.amayo"
	},
	{
		suffix: "oyamazaki.kyoto.jp",
		reversed: "pj.otoyk.ikazamayo"
	},
	{
		suffix: "oyer.no",
		reversed: "on.reyo"
	},
	{
		suffix: "oygarden.no",
		reversed: "on.nedragyo"
	},
	{
		suffix: "oyodo.nara.jp",
		reversed: "pj.aran.odoyo"
	},
	{
		suffix: "oystre-slidre.no",
		reversed: "on.erdils-ertsyo"
	},
	{
		suffix: "oz.au",
		reversed: "ua.zo"
	},
	{
		suffix: "ozora.hokkaido.jp",
		reversed: "pj.odiakkoh.arozo"
	},
	{
		suffix: "ozu.ehime.jp",
		reversed: "pj.emihe.uzo"
	},
	{
		suffix: "ozu.kumamoto.jp",
		reversed: "pj.otomamuk.uzo"
	},
	{
		suffix: "p.bg",
		reversed: "gb.p"
	},
	{
		suffix: "p.se",
		reversed: "es.p"
	},
	{
		suffix: "pa",
		reversed: "ap"
	},
	{
		suffix: "pa.gov.br",
		reversed: "rb.vog.ap"
	},
	{
		suffix: "pa.gov.pl",
		reversed: "lp.vog.ap"
	},
	{
		suffix: "pa.it",
		reversed: "ti.ap"
	},
	{
		suffix: "pa.leg.br",
		reversed: "rb.gel.ap"
	},
	{
		suffix: "pa.us",
		reversed: "su.ap"
	},
	{
		suffix: "paas.beebyte.io",
		reversed: "oi.etybeeb.saap"
	},
	{
		suffix: "paas.datacenter.fi",
		reversed: "if.retnecatad.saap"
	},
	{
		suffix: "paas.hosted-by-previder.com",
		reversed: "moc.rediverp-yb-detsoh.saap"
	},
	{
		suffix: "paas.massivegrid.com",
		reversed: "moc.dirgevissam.saap"
	},
	{
		suffix: "pacific.museum",
		reversed: "muesum.cificap"
	},
	{
		suffix: "paderborn.museum",
		reversed: "muesum.nrobredap"
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
		suffix: "page",
		reversed: "egap"
	},
	{
		suffix: "pagefrontapp.com",
		reversed: "moc.ppatnorfegap"
	},
	{
		suffix: "pages.dev",
		reversed: "ved.segap"
	},
	{
		suffix: "pages.it.hs-heilbronn.de",
		reversed: "ed.nnorblieh-sh.ti.segap"
	},
	{
		suffix: "pages.torproject.net",
		reversed: "ten.tcejorprot.segap"
	},
	{
		suffix: "pages.wiardweb.com",
		reversed: "moc.bewdraiw.segap"
	},
	{
		suffix: "pagespeedmobilizer.com",
		reversed: "moc.rezilibomdeepsegap"
	},
	{
		suffix: "pagexl.com",
		reversed: "moc.lxegap"
	},
	{
		suffix: "palace.museum",
		reversed: "muesum.ecalap"
	},
	{
		suffix: "paleo.museum",
		reversed: "muesum.oelap"
	},
	{
		suffix: "palermo.it",
		reversed: "ti.omrelap"
	},
	{
		suffix: "palmas.br",
		reversed: "rb.samlap"
	},
	{
		suffix: "palmsprings.museum",
		reversed: "muesum.sgnirpsmlap"
	},
	{
		suffix: "panama.museum",
		reversed: "muesum.amanap"
	},
	{
		suffix: "panasonic",
		reversed: "cinosanap"
	},
	{
		suffix: "panel.gg",
		reversed: "gg.lenap"
	},
	{
		suffix: "pantheonsite.io",
		reversed: "oi.etisnoehtnap"
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
		suffix: "parallel.jp",
		reversed: "pj.lellarap"
	},
	{
		suffix: "parasite.jp",
		reversed: "pj.etisarap"
	},
	{
		suffix: "paris",
		reversed: "sirap"
	},
	{
		suffix: "paris.eu.org",
		reversed: "gro.ue.sirap"
	},
	{
		suffix: "paris.museum",
		reversed: "muesum.sirap"
	},
	{
		suffix: "parliament.nz",
		reversed: "zn.tnemailrap"
	},
	{
		suffix: "parma.it",
		reversed: "ti.amrap"
	},
	{
		suffix: "paroch.k12.ma.us",
		reversed: "su.am.21k.hcorap"
	},
	{
		suffix: "pars",
		reversed: "srap"
	},
	{
		suffix: "parti.se",
		reversed: "es.itrap"
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
		suffix: "pasadena.museum",
		reversed: "muesum.anedasap"
	},
	{
		suffix: "passagens",
		reversed: "snegassap"
	},
	{
		suffix: "passenger-association.aero",
		reversed: "orea.noitaicossa-regnessap"
	},
	{
		suffix: "patria.bo",
		reversed: "ob.airtap"
	},
	{
		suffix: "pavia.it",
		reversed: "ti.aivap"
	},
	{
		suffix: "pay",
		reversed: "yap"
	},
	{
		suffix: "pb.ao",
		reversed: "oa.bp"
	},
	{
		suffix: "pb.gov.br",
		reversed: "rb.vog.bp"
	},
	{
		suffix: "pb.leg.br",
		reversed: "rb.gel.bp"
	},
	{
		suffix: "pc.it",
		reversed: "ti.cp"
	},
	{
		suffix: "pc.pl",
		reversed: "lp.cp"
	},
	{
		suffix: "pccw",
		reversed: "wccp"
	},
	{
		suffix: "pcloud.host",
		reversed: "tsoh.duolcp"
	},
	{
		suffix: "pd.it",
		reversed: "ti.dp"
	},
	{
		suffix: "pdns.page",
		reversed: "egap.sndp"
	},
	{
		suffix: "pe",
		reversed: "ep"
	},
	{
		suffix: "pe.ca",
		reversed: "ac.ep"
	},
	{
		suffix: "pe.gov.br",
		reversed: "rb.vog.ep"
	},
	{
		suffix: "pe.it",
		reversed: "ti.ep"
	},
	{
		suffix: "pe.kr",
		reversed: "rk.ep"
	},
	{
		suffix: "pe.leg.br",
		reversed: "rb.gel.ep"
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
		suffix: "penza.su",
		reversed: "us.aznep"
	},
	{
		suffix: "pepper.jp",
		reversed: "pj.reppep"
	},
	{
		suffix: "per.la",
		reversed: "al.rep"
	},
	{
		suffix: "per.nf",
		reversed: "fn.rep"
	},
	{
		suffix: "per.sg",
		reversed: "gs.rep"
	},
	{
		suffix: "perma.jp",
		reversed: "pj.amrep"
	},
	{
		suffix: "perso.ht",
		reversed: "th.osrep"
	},
	{
		suffix: "perso.sn",
		reversed: "ns.osrep"
	},
	{
		suffix: "perso.tn",
		reversed: "nt.osrep"
	},
	{
		suffix: "perspecta.cloud",
		reversed: "duolc.atcepsrep"
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
		suffix: "pet",
		reversed: "tep"
	},
	{
		suffix: "pf",
		reversed: "fp"
	},
	{
		suffix: "pfizer",
		reversed: "rezifp"
	},
	{
		suffix: "pg.in",
		reversed: "ni.gp"
	},
	{
		suffix: "pg.it",
		reversed: "ti.gp"
	},
	{
		suffix: "pgafan.net",
		reversed: "ten.nafagp"
	},
	{
		suffix: "pgfog.com",
		reversed: "moc.gofgp"
	},
	{
		suffix: "ph",
		reversed: "hp"
	},
	{
		suffix: "pharmacien.fr",
		reversed: "rf.neicamrahp"
	},
	{
		suffix: "pharmaciens.km",
		reversed: "mk.sneicamrahp"
	},
	{
		suffix: "pharmacy",
		reversed: "ycamrahp"
	},
	{
		suffix: "pharmacy.museum",
		reversed: "muesum.ycamrahp"
	},
	{
		suffix: "phd",
		reversed: "dhp"
	},
	{
		suffix: "philadelphia.museum",
		reversed: "muesum.aihpledalihp"
	},
	{
		suffix: "philadelphiaarea.museum",
		reversed: "muesum.aeraaihpledalihp"
	},
	{
		suffix: "philately.museum",
		reversed: "muesum.yletalihp"
	},
	{
		suffix: "philips",
		reversed: "spilihp"
	},
	{
		suffix: "phoenix.museum",
		reversed: "muesum.xineohp"
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
		suffix: "photography.museum",
		reversed: "muesum.yhpargotohp"
	},
	{
		suffix: "photos",
		reversed: "sotohp"
	},
	{
		suffix: "phx.enscaled.us",
		reversed: "su.delacsne.xhp"
	},
	{
		suffix: "physio",
		reversed: "oisyhp"
	},
	{
		suffix: "pi.gov.br",
		reversed: "rb.vog.ip"
	},
	{
		suffix: "pi.it",
		reversed: "ti.ip"
	},
	{
		suffix: "pi.leg.br",
		reversed: "rb.gel.ip"
	},
	{
		suffix: "piacenza.it",
		reversed: "ti.aznecaip"
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
		suffix: "piedmont.it",
		reversed: "ti.tnomdeip"
	},
	{
		suffix: "piemonte.it",
		reversed: "ti.etnomeip"
	},
	{
		suffix: "pigboat.jp",
		reversed: "pj.taobgip"
	},
	{
		suffix: "pila.pl",
		reversed: "lp.alip"
	},
	{
		suffix: "pilot.aero",
		reversed: "orea.tolip"
	},
	{
		suffix: "pilots.museum",
		reversed: "muesum.stolip"
	},
	{
		suffix: "pimienta.org",
		reversed: "gro.atneimip"
	},
	{
		suffix: "pin",
		reversed: "nip"
	},
	{
		suffix: "pinb.gov.pl",
		reversed: "lp.vog.bnip"
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
		suffix: "pinoko.jp",
		reversed: "pj.okonip"
	},
	{
		suffix: "pioneer",
		reversed: "reenoip"
	},
	{
		suffix: "pippu.hokkaido.jp",
		reversed: "pj.odiakkoh.uppip"
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
		suffix: "pisz.pl",
		reversed: "lp.zsip"
	},
	{
		suffix: "pittsburgh.museum",
		reversed: "muesum.hgrubsttip"
	},
	{
		suffix: "piw.gov.pl",
		reversed: "lp.vog.wip"
	},
	{
		suffix: "pixolino.com",
		reversed: "moc.oniloxip"
	},
	{
		suffix: "pizza",
		reversed: "azzip"
	},
	{
		suffix: "pk",
		reversed: "kp"
	},
	{
		suffix: "pl",
		reversed: "lp"
	},
	{
		suffix: "pl.eu.org",
		reversed: "gro.ue.lp"
	},
	{
		suffix: "pl.ua",
		reversed: "au.lp"
	},
	{
		suffix: "place",
		reversed: "ecalp"
	},
	{
		suffix: "planetarium.museum",
		reversed: "muesum.muiratenalp"
	},
	{
		suffix: "plantation.museum",
		reversed: "muesum.noitatnalp"
	},
	{
		suffix: "plants.museum",
		reversed: "muesum.stnalp"
	},
	{
		suffix: "platform0.app",
		reversed: "ppa.0mroftalp"
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
		suffix: "play",
		reversed: "yalp"
	},
	{
		suffix: "playstation",
		reversed: "noitatsyalp"
	},
	{
		suffix: "playstation-cloud.com",
		reversed: "moc.duolc-noitatsyalp"
	},
	{
		suffix: "plaza.museum",
		reversed: "muesum.azalp"
	},
	{
		suffix: "plc.co.im",
		reversed: "mi.oc.clp"
	},
	{
		suffix: "plc.ly",
		reversed: "yl.clp"
	},
	{
		suffix: "plc.uk",
		reversed: "ku.clp"
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
		suffix: "plo.ps",
		reversed: "sp.olp"
	},
	{
		suffix: "plumbing",
		reversed: "gnibmulp"
	},
	{
		suffix: "plurinacional.bo",
		reversed: "ob.lanoicanirulp"
	},
	{
		suffix: "plus",
		reversed: "sulp"
	},
	{
		suffix: "pm",
		reversed: "mp"
	},
	{
		suffix: "pmn.it",
		reversed: "ti.nmp"
	},
	{
		suffix: "pn",
		reversed: "np"
	},
	{
		suffix: "pn.it",
		reversed: "ti.np"
	},
	{
		suffix: "pnc",
		reversed: "cnp"
	},
	{
		suffix: "po.gov.pl",
		reversed: "lp.vog.op"
	},
	{
		suffix: "po.it",
		reversed: "ti.op"
	},
	{
		suffix: "poa.br",
		reversed: "rb.aop"
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
		suffix: "podzone.net",
		reversed: "ten.enozdop"
	},
	{
		suffix: "podzone.org",
		reversed: "gro.enozdop"
	},
	{
		suffix: "pohl",
		reversed: "lhop"
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
		suffix: "poivron.org",
		reversed: "gro.norviop"
	},
	{
		suffix: "poker",
		reversed: "rekop"
	},
	{
		suffix: "pokrovsk.su",
		reversed: "us.ksvorkop"
	},
	{
		suffix: "pol.dz",
		reversed: "zd.lop"
	},
	{
		suffix: "pol.ht",
		reversed: "th.lop"
	},
	{
		suffix: "pol.tr",
		reversed: "rt.lop"
	},
	{
		suffix: "police.uk",
		reversed: "ku.ecilop"
	},
	{
		suffix: "politica.bo",
		reversed: "ob.acitilop"
	},
	{
		suffix: "politie",
		reversed: "eitilop"
	},
	{
		suffix: "polkowice.pl",
		reversed: "lp.eciwoklop"
	},
	{
		suffix: "poltava.ua",
		reversed: "au.avatlop"
	},
	{
		suffix: "pomorskie.pl",
		reversed: "lp.eiksromop"
	},
	{
		suffix: "pomorze.pl",
		reversed: "lp.ezromop"
	},
	{
		suffix: "poniatowa.pl",
		reversed: "lp.awotainop"
	},
	{
		suffix: "ponpes.id",
		reversed: "di.sepnop"
	},
	{
		suffix: "pordenone.it",
		reversed: "ti.enonedrop"
	},
	{
		suffix: "porn",
		reversed: "nrop"
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
		suffix: "porsgrunn.no",
		reversed: "on.nnurgsrop"
	},
	{
		suffix: "porsáŋgu.no",
		reversed: "on.f62ats-ugsrop--nx"
	},
	{
		suffix: "port.fr",
		reversed: "rf.trop"
	},
	{
		suffix: "portal.museum",
		reversed: "muesum.latrop"
	},
	{
		suffix: "portland.museum",
		reversed: "muesum.dnaltrop"
	},
	{
		suffix: "portlligat.museum",
		reversed: "muesum.tagilltrop"
	},
	{
		suffix: "post",
		reversed: "tsop"
	},
	{
		suffix: "post.in",
		reversed: "ni.tsop"
	},
	{
		suffix: "postman-echo.com",
		reversed: "moc.ohce-namtsop"
	},
	{
		suffix: "posts-and-telecommunications.museum",
		reversed: "muesum.snoitacinummocelet-dna-stsop"
	},
	{
		suffix: "potager.org",
		reversed: "gro.regatop"
	},
	{
		suffix: "potenza.it",
		reversed: "ti.aznetop"
	},
	{
		suffix: "powiat.pl",
		reversed: "lp.taiwop"
	},
	{
		suffix: "poznan.pl",
		reversed: "lp.nanzop"
	},
	{
		suffix: "pp.az",
		reversed: "za.pp"
	},
	{
		suffix: "pp.ru",
		reversed: "ur.pp"
	},
	{
		suffix: "pp.se",
		reversed: "es.pp"
	},
	{
		suffix: "pp.ua",
		reversed: "au.pp"
	},
	{
		suffix: "ppg.br",
		reversed: "rb.gpp"
	},
	{
		suffix: "pr",
		reversed: "rp"
	},
	{
		suffix: "pr.gov.br",
		reversed: "rb.vog.rp"
	},
	{
		suffix: "pr.it",
		reversed: "ti.rp"
	},
	{
		suffix: "pr.leg.br",
		reversed: "rb.gel.rp"
	},
	{
		suffix: "pr.us",
		reversed: "su.rp"
	},
	{
		suffix: "pramerica",
		reversed: "aciremarp"
	},
	{
		suffix: "prato.it",
		reversed: "ti.otarp"
	},
	{
		suffix: "praxi",
		reversed: "ixarp"
	},
	{
		suffix: "prd.fr",
		reversed: "rf.drp"
	},
	{
		suffix: "prd.km",
		reversed: "mk.drp"
	},
	{
		suffix: "prd.mg",
		reversed: "gm.drp"
	},
	{
		suffix: "prequalifyme.today",
		reversed: "yadot.emyfilauqerp"
	},
	{
		suffix: "preservation.museum",
		reversed: "muesum.noitavreserp"
	},
	{
		suffix: "presidio.museum",
		reversed: "muesum.oidiserp"
	},
	{
		suffix: "press",
		reversed: "sserp"
	},
	{
		suffix: "press.aero",
		reversed: "orea.sserp"
	},
	{
		suffix: "press.cy",
		reversed: "yc.sserp"
	},
	{
		suffix: "press.ma",
		reversed: "am.sserp"
	},
	{
		suffix: "press.museum",
		reversed: "muesum.sserp"
	},
	{
		suffix: "press.se",
		reversed: "es.sserp"
	},
	{
		suffix: "presse.ci",
		reversed: "ic.esserp"
	},
	{
		suffix: "presse.km",
		reversed: "mk.esserp"
	},
	{
		suffix: "presse.ml",
		reversed: "lm.esserp"
	},
	{
		suffix: "pri.ee",
		reversed: "ee.irp"
	},
	{
		suffix: "prime",
		reversed: "emirp"
	},
	{
		suffix: "primetel.cloud",
		reversed: "duolc.letemirp"
	},
	{
		suffix: "principe.st",
		reversed: "ts.epicnirp"
	},
	{
		suffix: "priv.at",
		reversed: "ta.virp"
	},
	{
		suffix: "priv.hu",
		reversed: "uh.virp"
	},
	{
		suffix: "priv.instances.scw.cloud",
		reversed: "duolc.wcs.secnatsni.virp"
	},
	{
		suffix: "priv.me",
		reversed: "em.virp"
	},
	{
		suffix: "priv.no",
		reversed: "on.virp"
	},
	{
		suffix: "priv.pl",
		reversed: "lp.virp"
	},
	{
		suffix: "privatizehealthinsurance.net",
		reversed: "ten.ecnarusnihtlaehezitavirp"
	},
	{
		suffix: "pro",
		reversed: "orp"
	},
	{
		suffix: "pro.az",
		reversed: "za.orp"
	},
	{
		suffix: "pro.br",
		reversed: "rb.orp"
	},
	{
		suffix: "pro.cy",
		reversed: "yc.orp"
	},
	{
		suffix: "pro.ec",
		reversed: "ce.orp"
	},
	{
		suffix: "pro.fj",
		reversed: "jf.orp"
	},
	{
		suffix: "pro.ht",
		reversed: "th.orp"
	},
	{
		suffix: "pro.in",
		reversed: "ni.orp"
	},
	{
		suffix: "pro.mv",
		reversed: "vm.orp"
	},
	{
		suffix: "pro.na",
		reversed: "an.orp"
	},
	{
		suffix: "pro.om",
		reversed: "mo.orp"
	},
	{
		suffix: "pro.pr",
		reversed: "rp.orp"
	},
	{
		suffix: "pro.tt",
		reversed: "tt.orp"
	},
	{
		suffix: "pro.typeform.com",
		reversed: "moc.mrofepyt.orp"
	},
	{
		suffix: "pro.vn",
		reversed: "nv.orp"
	},
	{
		suffix: "prochowice.pl",
		reversed: "lp.eciwohcorp"
	},
	{
		suffix: "prod",
		reversed: "dorp"
	},
	{
		suffix: "production.aero",
		reversed: "orea.noitcudorp"
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
		suffix: "prof.pr",
		reversed: "rp.forp"
	},
	{
		suffix: "profesional.bo",
		reversed: "ob.lanoiseforp"
	},
	{
		suffix: "progressive",
		reversed: "evissergorp"
	},
	{
		suffix: "project.museum",
		reversed: "muesum.tcejorp"
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
		suffix: "protonet.io",
		reversed: "oi.tenotorp"
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
		suffix: "pruszkow.pl",
		reversed: "lp.wokzsurp"
	},
	{
		suffix: "prvcy.page",
		reversed: "egap.ycvrp"
	},
	{
		suffix: "przeworsk.pl",
		reversed: "lp.ksrowezrp"
	},
	{
		suffix: "ps",
		reversed: "sp"
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
		suffix: "psp.gov.pl",
		reversed: "lp.vog.psp"
	},
	{
		suffix: "psse.gov.pl",
		reversed: "lp.vog.essp"
	},
	{
		suffix: "pstmn.io",
		reversed: "oi.nmtsp"
	},
	{
		suffix: "pt",
		reversed: "tp"
	},
	{
		suffix: "pt.eu.org",
		reversed: "gro.ue.tp"
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
		suffix: "pub",
		reversed: "bup"
	},
	{
		suffix: "pub.instances.scw.cloud",
		reversed: "duolc.wcs.secnatsni.bup"
	},
	{
		suffix: "pub.sa",
		reversed: "as.bup"
	},
	{
		suffix: "publ.pt",
		reversed: "tp.lbup"
	},
	{
		suffix: "public-inquiry.uk",
		reversed: "ku.yriuqni-cilbup"
	},
	{
		suffix: "public.museum",
		reversed: "muesum.cilbup"
	},
	{
		suffix: "publishproxy.com",
		reversed: "moc.yxorphsilbup"
	},
	{
		suffix: "pubol.museum",
		reversed: "muesum.lobup"
	},
	{
		suffix: "pubtls.org",
		reversed: "gro.sltbup"
	},
	{
		suffix: "pueblo.bo",
		reversed: "ob.olbeup"
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
		suffix: "pulawy.pl",
		reversed: "lp.ywalup"
	},
	{
		suffix: "punyu.jp",
		reversed: "pj.uynup"
	},
	{
		suffix: "pup.gov.pl",
		reversed: "lp.vog.pup"
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
		suffix: "pv.it",
		reversed: "ti.vp"
	},
	{
		suffix: "pvh.br",
		reversed: "rb.hvp"
	},
	{
		suffix: "pvt.ge",
		reversed: "eg.tvp"
	},
	{
		suffix: "pvt.k12.ma.us",
		reversed: "su.am.21k.tvp"
	},
	{
		suffix: "pw",
		reversed: "wp"
	},
	{
		suffix: "pwc",
		reversed: "cwp"
	},
	{
		suffix: "py",
		reversed: "yp"
	},
	{
		suffix: "pya.jp",
		reversed: "pj.ayp"
	},
	{
		suffix: "pyatigorsk.ru",
		reversed: "ur.ksrogitayp"
	},
	{
		suffix: "pymnt.uk",
		reversed: "ku.tnmyp"
	},
	{
		suffix: "pythonanywhere.com",
		reversed: "moc.erehwynanohtyp"
	},
	{
		suffix: "pz.it",
		reversed: "ti.zp"
	},
	{
		suffix: "q-a.eu.org",
		reversed: "gro.ue.a-q"
	},
	{
		suffix: "q.bg",
		reversed: "gb.q"
	},
	{
		suffix: "qa",
		reversed: "aq"
	},
	{
		suffix: "qa2.com",
		reversed: "moc.2aq"
	},
	{
		suffix: "qbuser.com",
		reversed: "moc.resubq"
	},
	{
		suffix: "qc.ca",
		reversed: "ac.cq"
	},
	{
		suffix: "qc.com",
		reversed: "moc.cq"
	},
	{
		suffix: "qcx.io",
		reversed: "oi.xcq"
	},
	{
		suffix: "qh.cn",
		reversed: "nc.hq"
	},
	{
		suffix: "qld.au",
		reversed: "ua.dlq"
	},
	{
		suffix: "qld.edu.au",
		reversed: "ua.ude.dlq"
	},
	{
		suffix: "qld.gov.au",
		reversed: "ua.vog.dlq"
	},
	{
		suffix: "qoto.io",
		reversed: "oi.otoq"
	},
	{
		suffix: "qpon",
		reversed: "nopq"
	},
	{
		suffix: "qsl.br",
		reversed: "rb.lsq"
	},
	{
		suffix: "qualifioapp.com",
		reversed: "moc.ppaoifilauq"
	},
	{
		suffix: "quebec",
		reversed: "cebeuq"
	},
	{
		suffix: "quebec.museum",
		reversed: "muesum.cebeuq"
	},
	{
		suffix: "quest",
		reversed: "tseuq"
	},
	{
		suffix: "quicksytes.com",
		reversed: "moc.setyskciuq"
	},
	{
		suffix: "r.bg",
		reversed: "gb.r"
	},
	{
		suffix: "r.cdn77.net",
		reversed: "ten.77ndc.r"
	},
	{
		suffix: "r.se",
		reversed: "es.r"
	},
	{
		suffix: "ra.it",
		reversed: "ti.ar"
	},
	{
		suffix: "racing",
		reversed: "gnicar"
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
		suffix: "rade.no",
		reversed: "on.edar"
	},
	{
		suffix: "radio",
		reversed: "oidar"
	},
	{
		suffix: "radio.am",
		reversed: "ma.oidar"
	},
	{
		suffix: "radio.br",
		reversed: "rb.oidar"
	},
	{
		suffix: "radio.fm",
		reversed: "mf.oidar"
	},
	{
		suffix: "radom.pl",
		reversed: "lp.modar"
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
		suffix: "raffleentry.org.uk",
		reversed: "ku.gro.yrtneelffar"
	},
	{
		suffix: "rag-cloud-ch.hosteur.com",
		reversed: "moc.ruetsoh.hc-duolc-gar"
	},
	{
		suffix: "rag-cloud.hosteur.com",
		reversed: "moc.ruetsoh.duolc-gar"
	},
	{
		suffix: "ragusa.it",
		reversed: "ti.asugar"
	},
	{
		suffix: "rahkkeravju.no",
		reversed: "on.ujvarekkhar"
	},
	{
		suffix: "raholt.no",
		reversed: "on.tlohar"
	},
	{
		suffix: "railroad.museum",
		reversed: "muesum.daorliar"
	},
	{
		suffix: "railway.museum",
		reversed: "muesum.yawliar"
	},
	{
		suffix: "raindrop.jp",
		reversed: "pj.pordniar"
	},
	{
		suffix: "raisa.no",
		reversed: "on.asiar"
	},
	{
		suffix: "rakkestad.no",
		reversed: "on.datsekkar"
	},
	{
		suffix: "ralingen.no",
		reversed: "on.negnilar"
	},
	{
		suffix: "rana.no",
		reversed: "on.anar"
	},
	{
		suffix: "randaberg.no",
		reversed: "on.grebadnar"
	},
	{
		suffix: "rankoshi.hokkaido.jp",
		reversed: "pj.odiakkoh.ihsoknar"
	},
	{
		suffix: "ranzan.saitama.jp",
		reversed: "pj.amatias.naznar"
	},
	{
		suffix: "rar.ve",
		reversed: "ev.rar"
	},
	{
		suffix: "ras.ru",
		reversed: "ur.sar"
	},
	{
		suffix: "rauma.no",
		reversed: "on.amuar"
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
		suffix: "ravendb.run",
		reversed: "nur.bdnevar"
	},
	{
		suffix: "ravenna.it",
		reversed: "ti.annevar"
	},
	{
		suffix: "ravpage.co.il",
		reversed: "li.oc.egapvar"
	},
	{
		suffix: "rawa-maz.pl",
		reversed: "lp.zam-awar"
	},
	{
		suffix: "rc.it",
		reversed: "ti.cr"
	},
	{
		suffix: "rdv.to",
		reversed: "ot.vdr"
	},
	{
		suffix: "re",
		reversed: "er"
	},
	{
		suffix: "re.it",
		reversed: "ti.er"
	},
	{
		suffix: "re.kr",
		reversed: "rk.er"
	},
	{
		suffix: "read",
		reversed: "daer"
	},
	{
		suffix: "read-books.org",
		reversed: "gro.skoob-daer"
	},
	{
		suffix: "readmyblog.org",
		reversed: "gro.golbymdaer"
	},
	{
		suffix: "readthedocs.io",
		reversed: "oi.scodehtdaer"
	},
	{
		suffix: "readymade.jp",
		reversed: "pj.edamydaer"
	},
	{
		suffix: "realestate",
		reversed: "etatselaer"
	},
	{
		suffix: "realestate.pl",
		reversed: "lp.etatselaer"
	},
	{
		suffix: "realm.cz",
		reversed: "zc.mlaer"
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
		suffix: "rebun.hokkaido.jp",
		reversed: "pj.odiakkoh.nuber"
	},
	{
		suffix: "rec.br",
		reversed: "rb.cer"
	},
	{
		suffix: "rec.co",
		reversed: "oc.cer"
	},
	{
		suffix: "rec.nf",
		reversed: "fn.cer"
	},
	{
		suffix: "rec.ro",
		reversed: "or.cer"
	},
	{
		suffix: "rec.ve",
		reversed: "ev.cer"
	},
	{
		suffix: "recht.pro",
		reversed: "orp.thcer"
	},
	{
		suffix: "recife.br",
		reversed: "rb.eficer"
	},
	{
		suffix: "recipes",
		reversed: "sepicer"
	},
	{
		suffix: "recreation.aero",
		reversed: "orea.noitaercer"
	},
	{
		suffix: "red",
		reversed: "der"
	},
	{
		suffix: "red.sv",
		reversed: "vs.der"
	},
	{
		suffix: "redirectme.net",
		reversed: "ten.emtcerider"
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
		suffix: "reg.dk",
		reversed: "kd.ger"
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
		suffix: "reklam.hu",
		reversed: "uh.malker"
	},
	{
		suffix: "rel.ht",
		reversed: "th.ler"
	},
	{
		suffix: "rel.pl",
		reversed: "lp.ler"
	},
	{
		suffix: "reliance",
		reversed: "ecnailer"
	},
	{
		suffix: "remotewd.com",
		reversed: "moc.dwetomer"
	},
	{
		suffix: "ren",
		reversed: "ner"
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
		suffix: "rent",
		reversed: "tner"
	},
	{
		suffix: "rentals",
		reversed: "slatner"
	},
	{
		suffix: "rep.br",
		reversed: "rb.per"
	},
	{
		suffix: "rep.kp",
		reversed: "pk.per"
	},
	{
		suffix: "repair",
		reversed: "riaper"
	},
	{
		suffix: "repbody.aero",
		reversed: "orea.ydobper"
	},
	{
		suffix: "repl.co",
		reversed: "oc.lper"
	},
	{
		suffix: "repl.run",
		reversed: "nur.lper"
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
		suffix: "res.aero",
		reversed: "orea.ser"
	},
	{
		suffix: "res.in",
		reversed: "ni.ser"
	},
	{
		suffix: "research.aero",
		reversed: "orea.hcraeser"
	},
	{
		suffix: "research.museum",
		reversed: "muesum.hcraeser"
	},
	{
		suffix: "reservd.com",
		reversed: "moc.dvreser"
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
		suffix: "reserve-online.com",
		reversed: "moc.enilno-evreser"
	},
	{
		suffix: "reserve-online.net",
		reversed: "ten.enilno-evreser"
	},
	{
		suffix: "resindevice.io",
		reversed: "oi.ecivedniser"
	},
	{
		suffix: "resistance.museum",
		reversed: "muesum.ecnatsiser"
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
		suffix: "revista.bo",
		reversed: "ob.atsiver"
	},
	{
		suffix: "rexroth",
		reversed: "htorxer"
	},
	{
		suffix: "rg.it",
		reversed: "ti.gr"
	},
	{
		suffix: "rhcloud.com",
		reversed: "moc.duolchr"
	},
	{
		suffix: "ri.it",
		reversed: "ti.ir"
	},
	{
		suffix: "ri.us",
		reversed: "su.ir"
	},
	{
		suffix: "ribeirao.br",
		reversed: "rb.oariebir"
	},
	{
		suffix: "ric.jelastic.vps-host.net",
		reversed: "ten.tsoh-spv.citsalej.cir"
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
		suffix: "rieti.it",
		reversed: "ti.iteir"
	},
	{
		suffix: "rifu.miyagi.jp",
		reversed: "pj.igayim.ufir"
	},
	{
		suffix: "riik.ee",
		reversed: "ee.kiir"
	},
	{
		suffix: "rikubetsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustebukir"
	},
	{
		suffix: "rikuzentakata.iwate.jp",
		reversed: "pj.etawi.atakatnezukir"
	},
	{
		suffix: "ril",
		reversed: "lir"
	},
	{
		suffix: "rimini.it",
		reversed: "ti.inimir"
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
		suffix: "rio",
		reversed: "oir"
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
		suffix: "riodejaneiro.museum",
		reversed: "muesum.orienajedoir"
	},
	{
		suffix: "riopreto.br",
		reversed: "rb.oterpoir"
	},
	{
		suffix: "rip",
		reversed: "pir"
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
		suffix: "risor.no",
		reversed: "on.rosir"
	},
	{
		suffix: "rissa.no",
		reversed: "on.assir"
	},
	{
		suffix: "risør.no",
		reversed: "on.ari-rsir--nx"
	},
	{
		suffix: "ritto.shiga.jp",
		reversed: "pj.agihs.ottir"
	},
	{
		suffix: "rivne.ua",
		reversed: "au.envir"
	},
	{
		suffix: "rj.gov.br",
		reversed: "rb.vog.jr"
	},
	{
		suffix: "rj.leg.br",
		reversed: "rb.gel.jr"
	},
	{
		suffix: "rl.no",
		reversed: "on.lr"
	},
	{
		suffix: "rm.it",
		reversed: "ti.mr"
	},
	{
		suffix: "rn.gov.br",
		reversed: "rb.vog.nr"
	},
	{
		suffix: "rn.it",
		reversed: "ti.nr"
	},
	{
		suffix: "rn.leg.br",
		reversed: "rb.gel.nr"
	},
	{
		suffix: "ro",
		reversed: "or"
	},
	{
		suffix: "ro.eu.org",
		reversed: "gro.ue.or"
	},
	{
		suffix: "ro.gov.br",
		reversed: "rb.vog.or"
	},
	{
		suffix: "ro.im",
		reversed: "mi.or"
	},
	{
		suffix: "ro.it",
		reversed: "ti.or"
	},
	{
		suffix: "ro.leg.br",
		reversed: "rb.gel.or"
	},
	{
		suffix: "roan.no",
		reversed: "on.naor"
	},
	{
		suffix: "rocher",
		reversed: "rehcor"
	},
	{
		suffix: "rochester.museum",
		reversed: "muesum.retsehcor"
	},
	{
		suffix: "rockart.museum",
		reversed: "muesum.trakcor"
	},
	{
		suffix: "rocks",
		reversed: "skcor"
	},
	{
		suffix: "rocky.page",
		reversed: "egap.ykcor"
	},
	{
		suffix: "rodeo",
		reversed: "oedor"
	},
	{
		suffix: "rodoy.no",
		reversed: "on.yodor"
	},
	{
		suffix: "rogers",
		reversed: "sregor"
	},
	{
		suffix: "rokunohe.aomori.jp",
		reversed: "pj.iromoa.ehonukor"
	},
	{
		suffix: "rollag.no",
		reversed: "on.gallor"
	},
	{
		suffix: "roma.it",
		reversed: "ti.amor"
	},
	{
		suffix: "roma.museum",
		reversed: "muesum.amor"
	},
	{
		suffix: "rome.it",
		reversed: "ti.emor"
	},
	{
		suffix: "romsa.no",
		reversed: "on.asmor"
	},
	{
		suffix: "romskog.no",
		reversed: "on.goksmor"
	},
	{
		suffix: "room",
		reversed: "moor"
	},
	{
		suffix: "roros.no",
		reversed: "on.soror"
	},
	{
		suffix: "rost.no",
		reversed: "on.tsor"
	},
	{
		suffix: "rotorcraft.aero",
		reversed: "orea.tfarcrotor"
	},
	{
		suffix: "router.management",
		reversed: "tnemeganam.retuor"
	},
	{
		suffix: "rovigo.it",
		reversed: "ti.ogivor"
	},
	{
		suffix: "rovno.ua",
		reversed: "au.onvor"
	},
	{
		suffix: "royal-commission.uk",
		reversed: "ku.noissimmoc-layor"
	},
	{
		suffix: "royken.no",
		reversed: "on.nekyor"
	},
	{
		suffix: "royrvik.no",
		reversed: "on.kivryor"
	},
	{
		suffix: "rr.gov.br",
		reversed: "rb.vog.rr"
	},
	{
		suffix: "rr.leg.br",
		reversed: "rb.gel.rr"
	},
	{
		suffix: "rs",
		reversed: "sr"
	},
	{
		suffix: "rs.ba",
		reversed: "ab.sr"
	},
	{
		suffix: "rs.gov.br",
		reversed: "rb.vog.sr"
	},
	{
		suffix: "rs.leg.br",
		reversed: "rb.gel.sr"
	},
	{
		suffix: "rsc.cdn77.org",
		reversed: "gro.77ndc.csr"
	},
	{
		suffix: "rsvp",
		reversed: "pvsr"
	},
	{
		suffix: "ru",
		reversed: "ur"
	},
	{
		suffix: "ru.com",
		reversed: "moc.ur"
	},
	{
		suffix: "ru.eu.org",
		reversed: "gro.ue.ur"
	},
	{
		suffix: "ru.net",
		reversed: "ten.ur"
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
		suffix: "run.app",
		reversed: "ppa.nur"
	},
	{
		suffix: "ruovat.no",
		reversed: "on.tavour"
	},
	{
		suffix: "russia.museum",
		reversed: "muesum.aissur"
	},
	{
		suffix: "rv.ua",
		reversed: "au.vr"
	},
	{
		suffix: "rw",
		reversed: "wr"
	},
	{
		suffix: "rwe",
		reversed: "ewr"
	},
	{
		suffix: "rybnik.pl",
		reversed: "lp.kinbyr"
	},
	{
		suffix: "ryd.wafaicloud.com",
		reversed: "moc.duolciafaw.dyr"
	},
	{
		suffix: "rygge.no",
		reversed: "on.eggyr"
	},
	{
		suffix: "ryokami.saitama.jp",
		reversed: "pj.amatias.imakoyr"
	},
	{
		suffix: "ryugasaki.ibaraki.jp",
		reversed: "pj.ikarabi.ikasaguyr"
	},
	{
		suffix: "ryukyu",
		reversed: "uykuyr"
	},
	{
		suffix: "ryuoh.shiga.jp",
		reversed: "pj.agihs.houyr"
	},
	{
		suffix: "rzeszow.pl",
		reversed: "lp.wozsezr"
	},
	{
		suffix: "rzgw.gov.pl",
		reversed: "lp.vog.wgzr"
	},
	{
		suffix: "ráhkkerávju.no",
		reversed: "on.fa10-ujvrekkhr--nx"
	},
	{
		suffix: "ráisa.no",
		reversed: "on.an5-asir--nx"
	},
	{
		suffix: "råde.no",
		reversed: "on.alu-edr--nx"
	},
	{
		suffix: "råholt.no",
		reversed: "on.arm-tlohr--nx"
	},
	{
		suffix: "rælingen.no",
		reversed: "on.axm-negnilr--nx"
	},
	{
		suffix: "rødøy.no",
		reversed: "on.ban0-ydr--nx"
	},
	{
		suffix: "rømskog.no",
		reversed: "on.ayb-goksmr--nx"
	},
	{
		suffix: "røros.no",
		reversed: "on.arg-sorr--nx"
	},
	{
		suffix: "røst.no",
		reversed: "on.an0-tsr--nx"
	},
	{
		suffix: "røyken.no",
		reversed: "on.auv-nekyr--nx"
	},
	{
		suffix: "røyrvik.no",
		reversed: "on.ayb-kivryr--nx"
	},
	{
		suffix: "s.bg",
		reversed: "gb.s"
	},
	{
		suffix: "s.se",
		reversed: "es.s"
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
		suffix: "s3-website.ap-northeast-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsaehtron-pa.etisbew-3s"
	},
	{
		suffix: "s3-website.ap-south-1.amazonaws.com",
		reversed: "moc.swanozama.1-htuos-pa.etisbew-3s"
	},
	{
		suffix: "s3-website.ca-central-1.amazonaws.com",
		reversed: "moc.swanozama.1-lartnec-ac.etisbew-3s"
	},
	{
		suffix: "s3-website.eu-central-1.amazonaws.com",
		reversed: "moc.swanozama.1-lartnec-ue.etisbew-3s"
	},
	{
		suffix: "s3-website.eu-west-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsew-ue.etisbew-3s"
	},
	{
		suffix: "s3-website.eu-west-3.amazonaws.com",
		reversed: "moc.swanozama.3-tsew-ue.etisbew-3s"
	},
	{
		suffix: "s3-website.fr-par.scw.cloud",
		reversed: "duolc.wcs.rap-rf.etisbew-3s"
	},
	{
		suffix: "s3-website.nl-ams.scw.cloud",
		reversed: "duolc.wcs.sma-ln.etisbew-3s"
	},
	{
		suffix: "s3-website.pl-waw.scw.cloud",
		reversed: "duolc.wcs.waw-lp.etisbew-3s"
	},
	{
		suffix: "s3-website.us-east-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsae-su.etisbew-3s"
	},
	{
		suffix: "s3.amazonaws.com",
		reversed: "moc.swanozama.3s"
	},
	{
		suffix: "s3.ap-northeast-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsaehtron-pa.3s"
	},
	{
		suffix: "s3.ap-south-1.amazonaws.com",
		reversed: "moc.swanozama.1-htuos-pa.3s"
	},
	{
		suffix: "s3.ca-central-1.amazonaws.com",
		reversed: "moc.swanozama.1-lartnec-ac.3s"
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
		suffix: "s3.dualstack.ap-south-1.amazonaws.com",
		reversed: "moc.swanozama.1-htuos-pa.kcatslaud.3s"
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
		suffix: "s3.dualstack.eu-central-1.amazonaws.com",
		reversed: "moc.swanozama.1-lartnec-ue.kcatslaud.3s"
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
		suffix: "s3.dualstack.eu-west-3.amazonaws.com",
		reversed: "moc.swanozama.3-tsew-ue.kcatslaud.3s"
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
		suffix: "s3.eu-central-1.amazonaws.com",
		reversed: "moc.swanozama.1-lartnec-ue.3s"
	},
	{
		suffix: "s3.eu-west-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsew-ue.3s"
	},
	{
		suffix: "s3.eu-west-3.amazonaws.com",
		reversed: "moc.swanozama.3-tsew-ue.3s"
	},
	{
		suffix: "s3.fr-par.scw.cloud",
		reversed: "duolc.wcs.rap-rf.3s"
	},
	{
		suffix: "s3.nl-ams.scw.cloud",
		reversed: "duolc.wcs.sma-ln.3s"
	},
	{
		suffix: "s3.pl-waw.scw.cloud",
		reversed: "duolc.wcs.waw-lp.3s"
	},
	{
		suffix: "s3.teckids.org",
		reversed: "gro.sdikcet.3s"
	},
	{
		suffix: "s3.us-east-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsae-su.3s"
	},
	{
		suffix: "sa",
		reversed: "as"
	},
	{
		suffix: "sa-east-1.elasticbeanstalk.com",
		reversed: "moc.klatsnaebcitsale.1-tsae-as"
	},
	{
		suffix: "sa.au",
		reversed: "ua.as"
	},
	{
		suffix: "sa.com",
		reversed: "moc.as"
	},
	{
		suffix: "sa.cr",
		reversed: "rc.as"
	},
	{
		suffix: "sa.edu.au",
		reversed: "ua.ude.as"
	},
	{
		suffix: "sa.gov.au",
		reversed: "ua.vog.as"
	},
	{
		suffix: "sa.gov.pl",
		reversed: "lp.vog.as"
	},
	{
		suffix: "sa.it",
		reversed: "ti.as"
	},
	{
		suffix: "saarland",
		reversed: "dnalraas"
	},
	{
		suffix: "sabae.fukui.jp",
		reversed: "pj.iukuf.eabas"
	},
	{
		suffix: "sadist.jp",
		reversed: "pj.tsidas"
	},
	{
		suffix: "sado.niigata.jp",
		reversed: "pj.atagiin.odas"
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
		suffix: "safety.aero",
		reversed: "orea.ytefas"
	},
	{
		suffix: "saga.jp",
		reversed: "pj.agas"
	},
	{
		suffix: "saga.saga.jp",
		reversed: "pj.agas.agas"
	},
	{
		suffix: "sagae.yamagata.jp",
		reversed: "pj.atagamay.eagas"
	},
	{
		suffix: "sagamihara.kanagawa.jp",
		reversed: "pj.awaganak.arahimagas"
	},
	{
		suffix: "saigawa.fukuoka.jp",
		reversed: "pj.akoukuf.awagias"
	},
	{
		suffix: "saijo.ehime.jp",
		reversed: "pj.emihe.ojias"
	},
	{
		suffix: "saikai.nagasaki.jp",
		reversed: "pj.ikasagan.iakias"
	},
	{
		suffix: "saiki.oita.jp",
		reversed: "pj.atio.ikias"
	},
	{
		suffix: "saintlouis.museum",
		reversed: "muesum.siuoltnias"
	},
	{
		suffix: "saitama.jp",
		reversed: "pj.amatias"
	},
	{
		suffix: "saitama.saitama.jp",
		reversed: "pj.amatias.amatias"
	},
	{
		suffix: "saito.miyazaki.jp",
		reversed: "pj.ikazayim.otias"
	},
	{
		suffix: "saka.hiroshima.jp",
		reversed: "pj.amihsorih.akas"
	},
	{
		suffix: "sakado.saitama.jp",
		reversed: "pj.amatias.odakas"
	},
	{
		suffix: "sakae.chiba.jp",
		reversed: "pj.abihc.eakas"
	},
	{
		suffix: "sakae.nagano.jp",
		reversed: "pj.onagan.eakas"
	},
	{
		suffix: "sakahogi.gifu.jp",
		reversed: "pj.ufig.igohakas"
	},
	{
		suffix: "sakai.fukui.jp",
		reversed: "pj.iukuf.iakas"
	},
	{
		suffix: "sakai.ibaraki.jp",
		reversed: "pj.ikarabi.iakas"
	},
	{
		suffix: "sakai.osaka.jp",
		reversed: "pj.akaso.iakas"
	},
	{
		suffix: "sakaiminato.tottori.jp",
		reversed: "pj.irottot.otanimiakas"
	},
	{
		suffix: "sakaki.nagano.jp",
		reversed: "pj.onagan.ikakas"
	},
	{
		suffix: "sakata.yamagata.jp",
		reversed: "pj.atagamay.atakas"
	},
	{
		suffix: "sakawa.kochi.jp",
		reversed: "pj.ihcok.awakas"
	},
	{
		suffix: "sakegawa.yamagata.jp",
		reversed: "pj.atagamay.awagekas"
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
		suffix: "sakura",
		reversed: "arukas"
	},
	{
		suffix: "sakura.chiba.jp",
		reversed: "pj.abihc.arukas"
	},
	{
		suffix: "sakura.tochigi.jp",
		reversed: "pj.igihcot.arukas"
	},
	{
		suffix: "sakuragawa.ibaraki.jp",
		reversed: "pj.ikarabi.awagarukas"
	},
	{
		suffix: "sakurai.nara.jp",
		reversed: "pj.aran.iarukas"
	},
	{
		suffix: "sakyo.kyoto.jp",
		reversed: "pj.otoyk.oykas"
	},
	{
		suffix: "salangen.no",
		reversed: "on.negnalas"
	},
	{
		suffix: "salat.no",
		reversed: "on.talas"
	},
	{
		suffix: "sale",
		reversed: "elas"
	},
	{
		suffix: "salem.museum",
		reversed: "muesum.melas"
	},
	{
		suffix: "salerno.it",
		reversed: "ti.onrelas"
	},
	{
		suffix: "salon",
		reversed: "nolas"
	},
	{
		suffix: "saltdal.no",
		reversed: "on.ladtlas"
	},
	{
		suffix: "salud.bo",
		reversed: "ob.dulas"
	},
	{
		suffix: "salvador.br",
		reversed: "rb.rodavlas"
	},
	{
		suffix: "salvadordali.museum",
		reversed: "muesum.iladrodavlas"
	},
	{
		suffix: "salzburg.museum",
		reversed: "muesum.grubzlas"
	},
	{
		suffix: "samegawa.fukushima.jp",
		reversed: "pj.amihsukuf.awagemas"
	},
	{
		suffix: "samnanger.no",
		reversed: "on.regnanmas"
	},
	{
		suffix: "sampa.br",
		reversed: "rb.apmas"
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
		suffix: "samukawa.kanagawa.jp",
		reversed: "pj.awaganak.awakumas"
	},
	{
		suffix: "sanagochi.tokushima.jp",
		reversed: "pj.amihsukot.ihcoganas"
	},
	{
		suffix: "sanda.hyogo.jp",
		reversed: "pj.ogoyh.adnas"
	},
	{
		suffix: "sandcats.io",
		reversed: "oi.stacdnas"
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
		suffix: "sandiego.museum",
		reversed: "muesum.ogeidnas"
	},
	{
		suffix: "sandnes.no",
		reversed: "on.sendnas"
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
		suffix: "sandoy.no",
		reversed: "on.yodnas"
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
		suffix: "sandøy.no",
		reversed: "on.auy-ydnas--nx"
	},
	{
		suffix: "sanfrancisco.museum",
		reversed: "muesum.ocsicnarfnas"
	},
	{
		suffix: "sango.nara.jp",
		reversed: "pj.aran.ognas"
	},
	{
		suffix: "sanjo.niigata.jp",
		reversed: "pj.atagiin.ojnas"
	},
	{
		suffix: "sannan.hyogo.jp",
		reversed: "pj.ogoyh.nannas"
	},
	{
		suffix: "sannohe.aomori.jp",
		reversed: "pj.iromoa.ehonnas"
	},
	{
		suffix: "sano.tochigi.jp",
		reversed: "pj.igihcot.onas"
	},
	{
		suffix: "sanofi",
		reversed: "ifonas"
	},
	{
		suffix: "sanok.pl",
		reversed: "lp.konas"
	},
	{
		suffix: "santabarbara.museum",
		reversed: "muesum.arabrabatnas"
	},
	{
		suffix: "santacruz.museum",
		reversed: "muesum.zurcatnas"
	},
	{
		suffix: "santafe.museum",
		reversed: "muesum.efatnas"
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
		suffix: "sanuki.kagawa.jp",
		reversed: "pj.awagak.ikunas"
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
		suffix: "saotome.st",
		reversed: "ts.emotoas"
	},
	{
		suffix: "sap",
		reversed: "pas"
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
		suffix: "sarl",
		reversed: "lras"
	},
	{
		suffix: "saroma.hokkaido.jp",
		reversed: "pj.odiakkoh.amoras"
	},
	{
		suffix: "sarpsborg.no",
		reversed: "on.grobspras"
	},
	{
		suffix: "sarufutsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustufuras"
	},
	{
		suffix: "sas",
		reversed: "sas"
	},
	{
		suffix: "sasaguri.fukuoka.jp",
		reversed: "pj.akoukuf.irugasas"
	},
	{
		suffix: "sasayama.hyogo.jp",
		reversed: "pj.ogoyh.amayasas"
	},
	{
		suffix: "sasebo.nagasaki.jp",
		reversed: "pj.ikasagan.obesas"
	},
	{
		suffix: "saskatchewan.museum",
		reversed: "muesum.nawehctaksas"
	},
	{
		suffix: "sassari.it",
		reversed: "ti.irassas"
	},
	{
		suffix: "satosho.okayama.jp",
		reversed: "pj.amayako.ohsotas"
	},
	{
		suffix: "satsumasendai.kagoshima.jp",
		reversed: "pj.amihsogak.iadnesamustas"
	},
	{
		suffix: "satte.saitama.jp",
		reversed: "pj.amatias.ettas"
	},
	{
		suffix: "satx.museum",
		reversed: "muesum.xtas"
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
		suffix: "savannahga.museum",
		reversed: "muesum.aghannavas"
	},
	{
		suffix: "save",
		reversed: "evas"
	},
	{
		suffix: "saves-the-whales.com",
		reversed: "moc.selahw-eht-sevas"
	},
	{
		suffix: "savona.it",
		reversed: "ti.anovas"
	},
	{
		suffix: "saxo",
		reversed: "oxas"
	},
	{
		suffix: "sayama.osaka.jp",
		reversed: "pj.akaso.amayas"
	},
	{
		suffix: "sayama.saitama.jp",
		reversed: "pj.amatias.amayas"
	},
	{
		suffix: "sayo.hyogo.jp",
		reversed: "pj.ogoyh.oyas"
	},
	{
		suffix: "sb",
		reversed: "bs"
	},
	{
		suffix: "sb.ua",
		reversed: "au.bs"
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
		suffix: "sc",
		reversed: "cs"
	},
	{
		suffix: "sc.cn",
		reversed: "nc.cs"
	},
	{
		suffix: "sc.gov.br",
		reversed: "rb.vog.cs"
	},
	{
		suffix: "sc.ke",
		reversed: "ek.cs"
	},
	{
		suffix: "sc.kr",
		reversed: "rk.cs"
	},
	{
		suffix: "sc.leg.br",
		reversed: "rb.gel.cs"
	},
	{
		suffix: "sc.ls",
		reversed: "sl.cs"
	},
	{
		suffix: "sc.tz",
		reversed: "zt.cs"
	},
	{
		suffix: "sc.ug",
		reversed: "gu.cs"
	},
	{
		suffix: "sc.us",
		reversed: "su.cs"
	},
	{
		suffix: "sca",
		reversed: "acs"
	},
	{
		suffix: "scalebook.scw.cloud",
		reversed: "duolc.wcs.koobelacs"
	},
	{
		suffix: "scb",
		reversed: "bcs"
	},
	{
		suffix: "sch.ae",
		reversed: "ea.hcs"
	},
	{
		suffix: "sch.id",
		reversed: "di.hcs"
	},
	{
		suffix: "sch.ir",
		reversed: "ri.hcs"
	},
	{
		suffix: "sch.jo",
		reversed: "oj.hcs"
	},
	{
		suffix: "sch.lk",
		reversed: "kl.hcs"
	},
	{
		suffix: "sch.ly",
		reversed: "yl.hcs"
	},
	{
		suffix: "sch.ng",
		reversed: "gn.hcs"
	},
	{
		suffix: "sch.qa",
		reversed: "aq.hcs"
	},
	{
		suffix: "sch.sa",
		reversed: "as.hcs"
	},
	{
		suffix: "sch.so",
		reversed: "os.hcs"
	},
	{
		suffix: "sch.ss",
		reversed: "ss.hcs"
	},
	{
		suffix: "sch.tf",
		reversed: "ft.hcs"
	},
	{
		suffix: "sch.wf",
		reversed: "fw.hcs"
	},
	{
		suffix: "sch.zm",
		reversed: "mz.hcs"
	},
	{
		suffix: "schaeffler",
		reversed: "relffeahcs"
	},
	{
		suffix: "schlesisches.museum",
		reversed: "muesum.sehcsiselhcs"
	},
	{
		suffix: "schmidt",
		reversed: "tdimhcs"
	},
	{
		suffix: "schoenbrunn.museum",
		reversed: "muesum.nnurbneohcs"
	},
	{
		suffix: "schokokeks.net",
		reversed: "ten.skekokohcs"
	},
	{
		suffix: "schokoladen.museum",
		reversed: "muesum.nedalokohcs"
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
		suffix: "school.museum",
		reversed: "muesum.loohcs"
	},
	{
		suffix: "school.na",
		reversed: "an.loohcs"
	},
	{
		suffix: "school.nz",
		reversed: "zn.loohcs"
	},
	{
		suffix: "school.za",
		reversed: "az.loohcs"
	},
	{
		suffix: "schoolbus.jp",
		reversed: "pj.subloohcs"
	},
	{
		suffix: "schools.nsw.edu.au",
		reversed: "ua.ude.wsn.sloohcs"
	},
	{
		suffix: "schule",
		reversed: "eluhcs"
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
		suffix: "schwarz",
		reversed: "zrawhcs"
	},
	{
		suffix: "schweiz.museum",
		reversed: "muesum.ziewhcs"
	},
	{
		suffix: "sci.eg",
		reversed: "ge.ics"
	},
	{
		suffix: "science",
		reversed: "ecneics"
	},
	{
		suffix: "science-fiction.museum",
		reversed: "muesum.noitcif-ecneics"
	},
	{
		suffix: "science.museum",
		reversed: "muesum.ecneics"
	},
	{
		suffix: "scienceandhistory.museum",
		reversed: "muesum.yrotsihdnaecneics"
	},
	{
		suffix: "scienceandindustry.museum",
		reversed: "muesum.yrtsudnidnaecneics"
	},
	{
		suffix: "sciencecenter.museum",
		reversed: "muesum.retnececneics"
	},
	{
		suffix: "sciencecenters.museum",
		reversed: "muesum.sretnececneics"
	},
	{
		suffix: "sciencehistory.museum",
		reversed: "muesum.yrotsihecneics"
	},
	{
		suffix: "sciences.museum",
		reversed: "muesum.secneics"
	},
	{
		suffix: "sciencesnaturelles.museum",
		reversed: "muesum.sellerutansecneics"
	},
	{
		suffix: "scientist.aero",
		reversed: "orea.tsitneics"
	},
	{
		suffix: "scot",
		reversed: "tocs"
	},
	{
		suffix: "scotland.museum",
		reversed: "muesum.dnaltocs"
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
		suffix: "scrysec.com",
		reversed: "moc.cesyrcs"
	},
	{
		suffix: "sd",
		reversed: "ds"
	},
	{
		suffix: "sd.cn",
		reversed: "nc.ds"
	},
	{
		suffix: "sd.us",
		reversed: "su.ds"
	},
	{
		suffix: "sdn.gov.pl",
		reversed: "lp.vog.nds"
	},
	{
		suffix: "sdscloud.pl",
		reversed: "lp.duolcsds"
	},
	{
		suffix: "se",
		reversed: "es"
	},
	{
		suffix: "se.eu.org",
		reversed: "gro.ue.es"
	},
	{
		suffix: "se.gov.br",
		reversed: "rb.vog.es"
	},
	{
		suffix: "se.leg.br",
		reversed: "rb.gel.es"
	},
	{
		suffix: "se.net",
		reversed: "ten.es"
	},
	{
		suffix: "seaport.museum",
		reversed: "muesum.tropaes"
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
		suffix: "sebastopol.ua",
		reversed: "au.lopotsabes"
	},
	{
		suffix: "sec.ps",
		reversed: "sp.ces"
	},
	{
		suffix: "secaas.hk",
		reversed: "kh.saaces"
	},
	{
		suffix: "secret.jp",
		reversed: "pj.terces"
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
		suffix: "securitytactics.com",
		reversed: "moc.scitcatytiruces"
	},
	{
		suffix: "seek",
		reversed: "kees"
	},
	{
		suffix: "seg.br",
		reversed: "rb.ges"
	},
	{
		suffix: "seidat.net",
		reversed: "ten.tadies"
	},
	{
		suffix: "seihi.nagasaki.jp",
		reversed: "pj.ikasagan.ihies"
	},
	{
		suffix: "seika.kyoto.jp",
		reversed: "pj.otoyk.akies"
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
		suffix: "seiyo.ehime.jp",
		reversed: "pj.emihe.oyies"
	},
	{
		suffix: "sejny.pl",
		reversed: "lp.ynjes"
	},
	{
		suffix: "sekd1.beebyteapp.io",
		reversed: "oi.ppaetybeeb.1dkes"
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
		suffix: "sekikawa.niigata.jp",
		reversed: "pj.atagiin.awakikes"
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
		suffix: "select",
		reversed: "tceles"
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
		suffix: "selje.no",
		reversed: "on.ejles"
	},
	{
		suffix: "seljord.no",
		reversed: "on.drojles"
	},
	{
		suffix: "sellfy.store",
		reversed: "erots.yflles"
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
		suffix: "semboku.akita.jp",
		reversed: "pj.atika.ukobmes"
	},
	{
		suffix: "semine.miyagi.jp",
		reversed: "pj.igayim.enimes"
	},
	{
		suffix: "senasa.ar",
		reversed: "ra.asanes"
	},
	{
		suffix: "sener",
		reversed: "renes"
	},
	{
		suffix: "sennan.osaka.jp",
		reversed: "pj.akaso.nannes"
	},
	{
		suffix: "senseering.net",
		reversed: "ten.gnireesnes"
	},
	{
		suffix: "seoul.kr",
		reversed: "rk.luoes"
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
		suffix: "serveexchange.com",
		reversed: "moc.egnahcxeevres"
	},
	{
		suffix: "serveftp.com",
		reversed: "moc.ptfevres"
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
		suffix: "servegame.com",
		reversed: "moc.emagevres"
	},
	{
		suffix: "servegame.org",
		reversed: "gro.emagevres"
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
		suffix: "servehumour.com",
		reversed: "moc.ruomuhevres"
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
		suffix: "servep2p.com",
		reversed: "moc.p2pevres"
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
		suffix: "servers.run",
		reversed: "nur.srevres"
	},
	{
		suffix: "servesarcasm.com",
		reversed: "moc.msacrasevres"
	},
	{
		suffix: "service.gov.scot",
		reversed: "tocs.vog.ecivres"
	},
	{
		suffix: "service.gov.uk",
		reversed: "ku.vog.ecivres"
	},
	{
		suffix: "service.one",
		reversed: "eno.ecivres"
	},
	{
		suffix: "services",
		reversed: "secivres"
	},
	{
		suffix: "services.aero",
		reversed: "orea.secivres"
	},
	{
		suffix: "ses",
		reversed: "ses"
	},
	{
		suffix: "setagaya.tokyo.jp",
		reversed: "pj.oykot.ayagates"
	},
	{
		suffix: "seto.aichi.jp",
		reversed: "pj.ihcia.otes"
	},
	{
		suffix: "setouchi.okayama.jp",
		reversed: "pj.amayako.ihcuotes"
	},
	{
		suffix: "settlement.museum",
		reversed: "muesum.tnemelttes"
	},
	{
		suffix: "settlers.museum",
		reversed: "muesum.srelttes"
	},
	{
		suffix: "settsu.osaka.jp",
		reversed: "pj.akaso.usttes"
	},
	{
		suffix: "sevastopol.ua",
		reversed: "au.lopotsaves"
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
		suffix: "sex.hu",
		reversed: "uh.xes"
	},
	{
		suffix: "sex.pl",
		reversed: "lp.xes"
	},
	{
		suffix: "sexy",
		reversed: "yxes"
	},
	{
		suffix: "sf.no",
		reversed: "on.fs"
	},
	{
		suffix: "sfr",
		reversed: "rfs"
	},
	{
		suffix: "sg",
		reversed: "gs"
	},
	{
		suffix: "sg-1.paas.massivegrid.net",
		reversed: "ten.dirgevissam.saap.1-gs"
	},
	{
		suffix: "sh",
		reversed: "hs"
	},
	{
		suffix: "sh.cn",
		reversed: "nc.hs"
	},
	{
		suffix: "shacknet.nu",
		reversed: "un.tenkcahs"
	},
	{
		suffix: "shakotan.hokkaido.jp",
		reversed: "pj.odiakkoh.natokahs"
	},
	{
		suffix: "shangrila",
		reversed: "alirgnahs"
	},
	{
		suffix: "shari.hokkaido.jp",
		reversed: "pj.odiakkoh.irahs"
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
		suffix: "shell.museum",
		reversed: "muesum.llehs"
	},
	{
		suffix: "sherbrooke.museum",
		reversed: "muesum.ekoorbrehs"
	},
	{
		suffix: "shia",
		reversed: "aihs"
	},
	{
		suffix: "shibata.miyagi.jp",
		reversed: "pj.igayim.atabihs"
	},
	{
		suffix: "shibata.niigata.jp",
		reversed: "pj.atagiin.atabihs"
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
		suffix: "shibukawa.gunma.jp",
		reversed: "pj.amnug.awakubihs"
	},
	{
		suffix: "shibuya.tokyo.jp",
		reversed: "pj.oykot.ayubihs"
	},
	{
		suffix: "shichikashuku.miyagi.jp",
		reversed: "pj.igayim.ukuhsakihcihs"
	},
	{
		suffix: "shichinohe.aomori.jp",
		reversed: "pj.iromoa.ehonihcihs"
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
		suffix: "shiga.jp",
		reversed: "pj.agihs"
	},
	{
		suffix: "shiiba.miyazaki.jp",
		reversed: "pj.ikazayim.abiihs"
	},
	{
		suffix: "shijonawate.osaka.jp",
		reversed: "pj.akaso.etawanojihs"
	},
	{
		suffix: "shika.ishikawa.jp",
		reversed: "pj.awakihsi.akihs"
	},
	{
		suffix: "shikabe.hokkaido.jp",
		reversed: "pj.odiakkoh.ebakihs"
	},
	{
		suffix: "shikama.miyagi.jp",
		reversed: "pj.igayim.amakihs"
	},
	{
		suffix: "shikaoi.hokkaido.jp",
		reversed: "pj.odiakkoh.ioakihs"
	},
	{
		suffix: "shikatsu.aichi.jp",
		reversed: "pj.ihcia.ustakihs"
	},
	{
		suffix: "shiki.saitama.jp",
		reversed: "pj.amatias.ikihs"
	},
	{
		suffix: "shikokuchuo.ehime.jp",
		reversed: "pj.emihe.ouhcukokihs"
	},
	{
		suffix: "shiksha",
		reversed: "ahskihs"
	},
	{
		suffix: "shima.mie.jp",
		reversed: "pj.eim.amihs"
	},
	{
		suffix: "shimabara.nagasaki.jp",
		reversed: "pj.ikasagan.arabamihs"
	},
	{
		suffix: "shimada.shizuoka.jp",
		reversed: "pj.akouzihs.adamihs"
	},
	{
		suffix: "shimamaki.hokkaido.jp",
		reversed: "pj.odiakkoh.ikamamihs"
	},
	{
		suffix: "shimamoto.osaka.jp",
		reversed: "pj.akaso.otomamihs"
	},
	{
		suffix: "shimane.jp",
		reversed: "pj.enamihs"
	},
	{
		suffix: "shimane.shimane.jp",
		reversed: "pj.enamihs.enamihs"
	},
	{
		suffix: "shimizu.hokkaido.jp",
		reversed: "pj.odiakkoh.uzimihs"
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
		suffix: "shimodate.ibaraki.jp",
		reversed: "pj.ikarabi.etadomihs"
	},
	{
		suffix: "shimofusa.chiba.jp",
		reversed: "pj.abihc.asufomihs"
	},
	{
		suffix: "shimogo.fukushima.jp",
		reversed: "pj.amihsukuf.ogomihs"
	},
	{
		suffix: "shimoichi.nara.jp",
		reversed: "pj.aran.ihciomihs"
	},
	{
		suffix: "shimoji.okinawa.jp",
		reversed: "pj.awaniko.ijomihs"
	},
	{
		suffix: "shimokawa.hokkaido.jp",
		reversed: "pj.odiakkoh.awakomihs"
	},
	{
		suffix: "shimokitayama.nara.jp",
		reversed: "pj.aran.amayatikomihs"
	},
	{
		suffix: "shimonita.gunma.jp",
		reversed: "pj.amnug.atinomihs"
	},
	{
		suffix: "shimonoseki.yamaguchi.jp",
		reversed: "pj.ihcugamay.ikesonomihs"
	},
	{
		suffix: "shimosuwa.nagano.jp",
		reversed: "pj.onagan.awusomihs"
	},
	{
		suffix: "shimotsuke.tochigi.jp",
		reversed: "pj.igihcot.ekustomihs"
	},
	{
		suffix: "shimotsuma.ibaraki.jp",
		reversed: "pj.ikarabi.amustomihs"
	},
	{
		suffix: "shinagawa.tokyo.jp",
		reversed: "pj.oykot.awaganihs"
	},
	{
		suffix: "shinanomachi.nagano.jp",
		reversed: "pj.onagan.ihcamonanihs"
	},
	{
		suffix: "shingo.aomori.jp",
		reversed: "pj.iromoa.ognihs"
	},
	{
		suffix: "shingu.fukuoka.jp",
		reversed: "pj.akoukuf.ugnihs"
	},
	{
		suffix: "shingu.hyogo.jp",
		reversed: "pj.ogoyh.ugnihs"
	},
	{
		suffix: "shingu.wakayama.jp",
		reversed: "pj.amayakaw.ugnihs"
	},
	{
		suffix: "shinichi.hiroshima.jp",
		reversed: "pj.amihsorih.ihcinihs"
	},
	{
		suffix: "shinjo.nara.jp",
		reversed: "pj.aran.ojnihs"
	},
	{
		suffix: "shinjo.okayama.jp",
		reversed: "pj.amayako.ojnihs"
	},
	{
		suffix: "shinjo.yamagata.jp",
		reversed: "pj.atagamay.ojnihs"
	},
	{
		suffix: "shinjuku.tokyo.jp",
		reversed: "pj.oykot.ukujnihs"
	},
	{
		suffix: "shinkamigoto.nagasaki.jp",
		reversed: "pj.ikasagan.otogimaknihs"
	},
	{
		suffix: "shinonsen.hyogo.jp",
		reversed: "pj.ogoyh.nesnonihs"
	},
	{
		suffix: "shinshinotsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustonihsnihs"
	},
	{
		suffix: "shinshiro.aichi.jp",
		reversed: "pj.ihcia.orihsnihs"
	},
	{
		suffix: "shinto.gunma.jp",
		reversed: "pj.amnug.otnihs"
	},
	{
		suffix: "shintoku.hokkaido.jp",
		reversed: "pj.odiakkoh.ukotnihs"
	},
	{
		suffix: "shintomi.miyazaki.jp",
		reversed: "pj.ikazayim.imotnihs"
	},
	{
		suffix: "shinyoshitomi.fukuoka.jp",
		reversed: "pj.akoukuf.imotihsoynihs"
	},
	{
		suffix: "shiogama.miyagi.jp",
		reversed: "pj.igayim.amagoihs"
	},
	{
		suffix: "shiojiri.nagano.jp",
		reversed: "pj.onagan.irijoihs"
	},
	{
		suffix: "shioya.tochigi.jp",
		reversed: "pj.igihcot.ayoihs"
	},
	{
		suffix: "shirahama.wakayama.jp",
		reversed: "pj.amayakaw.amaharihs"
	},
	{
		suffix: "shirakawa.fukushima.jp",
		reversed: "pj.amihsukuf.awakarihs"
	},
	{
		suffix: "shirakawa.gifu.jp",
		reversed: "pj.ufig.awakarihs"
	},
	{
		suffix: "shirako.chiba.jp",
		reversed: "pj.abihc.okarihs"
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
		suffix: "shiraoka.saitama.jp",
		reversed: "pj.amatias.akoarihs"
	},
	{
		suffix: "shirataka.yamagata.jp",
		reversed: "pj.atagamay.akatarihs"
	},
	{
		suffix: "shiriuchi.hokkaido.jp",
		reversed: "pj.odiakkoh.ihcuirihs"
	},
	{
		suffix: "shiroi.chiba.jp",
		reversed: "pj.abihc.iorihs"
	},
	{
		suffix: "shiroishi.miyagi.jp",
		reversed: "pj.igayim.ihsiorihs"
	},
	{
		suffix: "shiroishi.saga.jp",
		reversed: "pj.agas.ihsiorihs"
	},
	{
		suffix: "shirosato.ibaraki.jp",
		reversed: "pj.ikarabi.otasorihs"
	},
	{
		suffix: "shishikui.tokushima.jp",
		reversed: "pj.amihsukot.iukihsihs"
	},
	{
		suffix: "shiso.hyogo.jp",
		reversed: "pj.ogoyh.osihs"
	},
	{
		suffix: "shisui.chiba.jp",
		reversed: "pj.abihc.iusihs"
	},
	{
		suffix: "shitara.aichi.jp",
		reversed: "pj.ihcia.aratihs"
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
		suffix: "shizuoka.jp",
		reversed: "pj.akouzihs"
	},
	{
		suffix: "shizuoka.shizuoka.jp",
		reversed: "pj.akouzihs.akouzihs"
	},
	{
		suffix: "shobara.hiroshima.jp",
		reversed: "pj.amihsorih.arabohs"
	},
	{
		suffix: "shoes",
		reversed: "seohs"
	},
	{
		suffix: "shonai.fukuoka.jp",
		reversed: "pj.akoukuf.ianohs"
	},
	{
		suffix: "shonai.yamagata.jp",
		reversed: "pj.atagamay.ianohs"
	},
	{
		suffix: "shoo.okayama.jp",
		reversed: "pj.amayako.oohs"
	},
	{
		suffix: "shop",
		reversed: "pohs"
	},
	{
		suffix: "shop.brendly.rs",
		reversed: "sr.yldnerb.pohs"
	},
	{
		suffix: "shop.ht",
		reversed: "th.pohs"
	},
	{
		suffix: "shop.hu",
		reversed: "uh.pohs"
	},
	{
		suffix: "shop.pl",
		reversed: "lp.pohs"
	},
	{
		suffix: "shop.ro",
		reversed: "or.pohs"
	},
	{
		suffix: "shop.th",
		reversed: "ht.pohs"
	},
	{
		suffix: "shoparena.pl",
		reversed: "lp.anerapohs"
	},
	{
		suffix: "shopitsite.com",
		reversed: "moc.etistipohs"
	},
	{
		suffix: "shopping",
		reversed: "gnippohs"
	},
	{
		suffix: "shopselect.net",
		reversed: "ten.tcelespohs"
	},
	{
		suffix: "shopware.store",
		reversed: "erots.erawpohs"
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
		suffix: "show.aero",
		reversed: "orea.wohs"
	},
	{
		suffix: "showa.fukushima.jp",
		reversed: "pj.amihsukuf.awohs"
	},
	{
		suffix: "showa.gunma.jp",
		reversed: "pj.amnug.awohs"
	},
	{
		suffix: "showa.yamanashi.jp",
		reversed: "pj.ihsanamay.awohs"
	},
	{
		suffix: "showtime",
		reversed: "emitwohs"
	},
	{
		suffix: "shunan.yamaguchi.jp",
		reversed: "pj.ihcugamay.nanuhs"
	},
	{
		suffix: "shw.io",
		reversed: "oi.whs"
	},
	{
		suffix: "si",
		reversed: "is"
	},
	{
		suffix: "si.eu.org",
		reversed: "gro.ue.is"
	},
	{
		suffix: "si.it",
		reversed: "ti.is"
	},
	{
		suffix: "sibenik.museum",
		reversed: "muesum.kinebis"
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
		suffix: "siellak.no",
		reversed: "on.kalleis"
	},
	{
		suffix: "siena.it",
		reversed: "ti.aneis"
	},
	{
		suffix: "sigdal.no",
		reversed: "on.ladgis"
	},
	{
		suffix: "siiites.com",
		reversed: "moc.setiiis"
	},
	{
		suffix: "siljan.no",
		reversed: "on.najlis"
	},
	{
		suffix: "silk",
		reversed: "klis"
	},
	{
		suffix: "silk.museum",
		reversed: "muesum.klis"
	},
	{
		suffix: "simple-url.com",
		reversed: "moc.lru-elpmis"
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
		suffix: "sina",
		reversed: "anis"
	},
	{
		suffix: "sinaapp.com",
		reversed: "moc.ppaanis"
	},
	{
		suffix: "singles",
		reversed: "selgnis"
	},
	{
		suffix: "siracusa.it",
		reversed: "ti.asucaris"
	},
	{
		suffix: "sirdal.no",
		reversed: "on.ladris"
	},
	{
		suffix: "site",
		reversed: "etis"
	},
	{
		suffix: "site.tb-hosting.com",
		reversed: "moc.gnitsoh-bt.etis"
	},
	{
		suffix: "site.transip.me",
		reversed: "em.pisnart.etis"
	},
	{
		suffix: "siteleaf.net",
		reversed: "ten.faeletis"
	},
	{
		suffix: "sites.static.land",
		reversed: "dnal.citats.setis"
	},
	{
		suffix: "sj",
		reversed: "js"
	},
	{
		suffix: "sjc.br",
		reversed: "rb.cjs"
	},
	{
		suffix: "sk",
		reversed: "ks"
	},
	{
		suffix: "sk.ca",
		reversed: "ac.ks"
	},
	{
		suffix: "sk.eu.org",
		reversed: "gro.ue.ks"
	},
	{
		suffix: "skanit.no",
		reversed: "on.tinaks"
	},
	{
		suffix: "skanland.no",
		reversed: "on.dnalnaks"
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
		suffix: "skedsmokorset.no",
		reversed: "on.tesrokomsdeks"
	},
	{
		suffix: "ski",
		reversed: "iks"
	},
	{
		suffix: "ski.museum",
		reversed: "muesum.iks"
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
		suffix: "skierva.no",
		reversed: "on.avreiks"
	},
	{
		suffix: "skiervá.no",
		reversed: "on.atu-vreiks--nx"
	},
	{
		suffix: "skin",
		reversed: "niks"
	},
	{
		suffix: "skiptvet.no",
		reversed: "on.tevtpiks"
	},
	{
		suffix: "skjak.no",
		reversed: "on.kajks"
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
		suffix: "skjåk.no",
		reversed: "on.aos-kjks--nx"
	},
	{
		suffix: "sklep.pl",
		reversed: "lp.pelks"
	},
	{
		suffix: "sko.gov.pl",
		reversed: "lp.vog.oks"
	},
	{
		suffix: "skoczow.pl",
		reversed: "lp.wozcoks"
	},
	{
		suffix: "skodje.no",
		reversed: "on.ejdoks"
	},
	{
		suffix: "skole.museum",
		reversed: "muesum.eloks"
	},
	{
		suffix: "sky",
		reversed: "yks"
	},
	{
		suffix: "skydiving.aero",
		reversed: "orea.gnividyks"
	},
	{
		suffix: "skygearapp.com",
		reversed: "moc.pparaegyks"
	},
	{
		suffix: "skype",
		reversed: "epyks"
	},
	{
		suffix: "skánit.no",
		reversed: "on.aqy-tinks--nx"
	},
	{
		suffix: "skånland.no",
		reversed: "on.axf-dnalnks--nx"
	},
	{
		suffix: "sl",
		reversed: "ls"
	},
	{
		suffix: "slask.pl",
		reversed: "lp.ksals"
	},
	{
		suffix: "slattum.no",
		reversed: "on.muttals"
	},
	{
		suffix: "sld.do",
		reversed: "od.dls"
	},
	{
		suffix: "sld.pa",
		reversed: "ap.dls"
	},
	{
		suffix: "slg.br",
		reversed: "rb.gls"
	},
	{
		suffix: "sling",
		reversed: "gnils"
	},
	{
		suffix: "slupsk.pl",
		reversed: "lp.kspuls"
	},
	{
		suffix: "slz.br",
		reversed: "rb.zls"
	},
	{
		suffix: "sm",
		reversed: "ms"
	},
	{
		suffix: "sm.ua",
		reversed: "au.ms"
	},
	{
		suffix: "small-web.org",
		reversed: "gro.bew-llams"
	},
	{
		suffix: "smart",
		reversed: "trams"
	},
	{
		suffix: "smartlabeling.scw.cloud",
		reversed: "duolc.wcs.gnilebaltrams"
	},
	{
		suffix: "smile",
		reversed: "elims"
	},
	{
		suffix: "smola.no",
		reversed: "on.aloms"
	},
	{
		suffix: "smushcdn.com",
		reversed: "moc.ndchsums"
	},
	{
		suffix: "smøla.no",
		reversed: "on.arh-alms--nx"
	},
	{
		suffix: "sn",
		reversed: "ns"
	},
	{
		suffix: "sn.cn",
		reversed: "nc.ns"
	},
	{
		suffix: "snaase.no",
		reversed: "on.esaans"
	},
	{
		suffix: "snasa.no",
		reversed: "on.asans"
	},
	{
		suffix: "sncf",
		reversed: "fcns"
	},
	{
		suffix: "snillfjord.no",
		reversed: "on.drojfllins"
	},
	{
		suffix: "snoasa.no",
		reversed: "on.asaons"
	},
	{
		suffix: "snåase.no",
		reversed: "on.arn-esans--nx"
	},
	{
		suffix: "snåsa.no",
		reversed: "on.aor-asns--nx"
	},
	{
		suffix: "so",
		reversed: "os"
	},
	{
		suffix: "so.gov.pl",
		reversed: "lp.vog.os"
	},
	{
		suffix: "so.it",
		reversed: "ti.os"
	},
	{
		suffix: "sobetsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustebos"
	},
	{
		suffix: "soc.dz",
		reversed: "zd.cos"
	},
	{
		suffix: "soc.lk",
		reversed: "kl.cos"
	},
	{
		suffix: "soc.srcf.net",
		reversed: "ten.fcrs.cos"
	},
	{
		suffix: "soccer",
		reversed: "reccos"
	},
	{
		suffix: "sochi.su",
		reversed: "us.ihcos"
	},
	{
		suffix: "social",
		reversed: "laicos"
	},
	{
		suffix: "society.museum",
		reversed: "muesum.yteicos"
	},
	{
		suffix: "sodegaura.chiba.jp",
		reversed: "pj.abihc.aruagedos"
	},
	{
		suffix: "soeda.fukuoka.jp",
		reversed: "pj.akoukuf.adeos"
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
		suffix: "software.aero",
		reversed: "orea.erawtfos"
	},
	{
		suffix: "sogndal.no",
		reversed: "on.ladngos"
	},
	{
		suffix: "sogne.no",
		reversed: "on.engos"
	},
	{
		suffix: "sohu",
		reversed: "uhos"
	},
	{
		suffix: "soja.okayama.jp",
		reversed: "pj.amayako.ajos"
	},
	{
		suffix: "soka.saitama.jp",
		reversed: "pj.amatias.akos"
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
		suffix: "solar",
		reversed: "ralos"
	},
	{
		suffix: "sologne.museum",
		reversed: "muesum.engolos"
	},
	{
		suffix: "solund.no",
		reversed: "on.dnulos"
	},
	{
		suffix: "solutions",
		reversed: "snoitulos"
	},
	{
		suffix: "soma.fukushima.jp",
		reversed: "pj.amihsukuf.amos"
	},
	{
		suffix: "somna.no",
		reversed: "on.anmos"
	},
	{
		suffix: "sondre-land.no",
		reversed: "on.dnal-erdnos"
	},
	{
		suffix: "sondrio.it",
		reversed: "ti.oirdnos"
	},
	{
		suffix: "song",
		reversed: "gnos"
	},
	{
		suffix: "songdalen.no",
		reversed: "on.neladgnos"
	},
	{
		suffix: "soni.nara.jp",
		reversed: "pj.aran.inos"
	},
	{
		suffix: "sony",
		reversed: "ynos"
	},
	{
		suffix: "soo.kagoshima.jp",
		reversed: "pj.amihsogak.oos"
	},
	{
		suffix: "sopot.pl",
		reversed: "lp.topos"
	},
	{
		suffix: "sor-aurdal.no",
		reversed: "on.ladrua-ros"
	},
	{
		suffix: "sor-fron.no",
		reversed: "on.norf-ros"
	},
	{
		suffix: "sor-odal.no",
		reversed: "on.lado-ros"
	},
	{
		suffix: "sor-varanger.no",
		reversed: "on.regnarav-ros"
	},
	{
		suffix: "sorfold.no",
		reversed: "on.dlofros"
	},
	{
		suffix: "sorocaba.br",
		reversed: "rb.abacoros"
	},
	{
		suffix: "sorreisa.no",
		reversed: "on.asierros"
	},
	{
		suffix: "sortland.no",
		reversed: "on.dnaltros"
	},
	{
		suffix: "sorum.no",
		reversed: "on.muros"
	},
	{
		suffix: "sos.pl",
		reversed: "lp.sos"
	},
	{
		suffix: "sosa.chiba.jp",
		reversed: "pj.abihc.asos"
	},
	{
		suffix: "sosnowiec.pl",
		reversed: "lp.ceiwonsos"
	},
	{
		suffix: "soundandvision.museum",
		reversed: "muesum.noisivdnadnuos"
	},
	{
		suffix: "soundcast.me",
		reversed: "em.tsacdnuos"
	},
	{
		suffix: "southcarolina.museum",
		reversed: "muesum.anilorachtuos"
	},
	{
		suffix: "southwest.museum",
		reversed: "muesum.tsewhtuos"
	},
	{
		suffix: "sowa.ibaraki.jp",
		reversed: "pj.ikarabi.awos"
	},
	{
		suffix: "soy",
		reversed: "yos"
	},
	{
		suffix: "sp.gov.br",
		reversed: "rb.vog.ps"
	},
	{
		suffix: "sp.it",
		reversed: "ti.ps"
	},
	{
		suffix: "sp.leg.br",
		reversed: "rb.gel.ps"
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
		suffix: "space-to-rent.com",
		reversed: "moc.tner-ot-ecaps"
	},
	{
		suffix: "space.museum",
		reversed: "muesum.ecaps"
	},
	{
		suffix: "spacekit.io",
		reversed: "oi.tikecaps"
	},
	{
		suffix: "spb.ru",
		reversed: "ur.bps"
	},
	{
		suffix: "spb.su",
		reversed: "us.bps"
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
		suffix: "spdns.org",
		reversed: "gro.sndps"
	},
	{
		suffix: "sphinx.mythic-beasts.com",
		reversed: "moc.stsaeb-cihtym.xnihps"
	},
	{
		suffix: "spjelkavik.no",
		reversed: "on.kivaklejps"
	},
	{
		suffix: "sport",
		reversed: "trops"
	},
	{
		suffix: "sport.hu",
		reversed: "uh.trops"
	},
	{
		suffix: "spot",
		reversed: "tops"
	},
	{
		suffix: "spy.museum",
		reversed: "muesum.yps"
	},
	{
		suffix: "spydeberg.no",
		reversed: "on.grebedyps"
	},
	{
		suffix: "square.museum",
		reversed: "muesum.erauqs"
	},
	{
		suffix: "square7.ch",
		reversed: "hc.7erauqs"
	},
	{
		suffix: "square7.de",
		reversed: "ed.7erauqs"
	},
	{
		suffix: "square7.net",
		reversed: "ten.7erauqs"
	},
	{
		suffix: "sr",
		reversed: "rs"
	},
	{
		suffix: "sr.gov.pl",
		reversed: "lp.vog.rs"
	},
	{
		suffix: "sr.it",
		reversed: "ti.rs"
	},
	{
		suffix: "srht.site",
		reversed: "etis.thrs"
	},
	{
		suffix: "srl",
		reversed: "lrs"
	},
	{
		suffix: "srv.br",
		reversed: "rb.vrs"
	},
	{
		suffix: "ss",
		reversed: "ss"
	},
	{
		suffix: "ss.it",
		reversed: "ti.ss"
	},
	{
		suffix: "ssl.origin.cdn77-secure.org",
		reversed: "gro.eruces-77ndc.nigiro.lss"
	},
	{
		suffix: "st",
		reversed: "ts"
	},
	{
		suffix: "st.no",
		reversed: "on.ts"
	},
	{
		suffix: "staba.jp",
		reversed: "pj.abats"
	},
	{
		suffix: "stackhero-network.com",
		reversed: "moc.krowten-orehkcats"
	},
	{
		suffix: "stada",
		reversed: "adats"
	},
	{
		suffix: "stadt.museum",
		reversed: "muesum.tdats"
	},
	{
		suffix: "stage.nodeart.io",
		reversed: "oi.traedon.egats"
	},
	{
		suffix: "staging.onred.one",
		reversed: "eno.derno.gnigats"
	},
	{
		suffix: "stalbans.museum",
		reversed: "muesum.snablats"
	},
	{
		suffix: "stalowa-wola.pl",
		reversed: "lp.alow-awolats"
	},
	{
		suffix: "stange.no",
		reversed: "on.egnats"
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
		suffix: "starachowice.pl",
		reversed: "lp.eciwohcarats"
	},
	{
		suffix: "stargard.pl",
		reversed: "lp.dragrats"
	},
	{
		suffix: "starnberg.museum",
		reversed: "muesum.grebnrats"
	},
	{
		suffix: "starostwo.gov.pl",
		reversed: "lp.vog.owtsorats"
	},
	{
		suffix: "stat.no",
		reversed: "on.tats"
	},
	{
		suffix: "state.museum",
		reversed: "muesum.etats"
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
		suffix: "stateofdelaware.museum",
		reversed: "muesum.erawaledfoetats"
	},
	{
		suffix: "stathelle.no",
		reversed: "on.ellehtats"
	},
	{
		suffix: "static-access.net",
		reversed: "ten.ssecca-citats"
	},
	{
		suffix: "static.land",
		reversed: "dnal.citats"
	},
	{
		suffix: "static.observableusercontent.com",
		reversed: "moc.tnetnocresuelbavresbo.citats"
	},
	{
		suffix: "station.museum",
		reversed: "muesum.noitats"
	},
	{
		suffix: "stavanger.no",
		reversed: "on.regnavats"
	},
	{
		suffix: "stavern.no",
		reversed: "on.nrevats"
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
		suffix: "steam.museum",
		reversed: "muesum.maets"
	},
	{
		suffix: "steiermark.museum",
		reversed: "muesum.kramreiets"
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
		suffix: "sth.ac.at",
		reversed: "ta.ca.hts"
	},
	{
		suffix: "stjohn.museum",
		reversed: "muesum.nhojts"
	},
	{
		suffix: "stjordal.no",
		reversed: "on.ladrojts"
	},
	{
		suffix: "stjordalshalsen.no",
		reversed: "on.neslahsladrojts"
	},
	{
		suffix: "stjørdal.no",
		reversed: "on.a1s-ladrjts--nx"
	},
	{
		suffix: "stjørdalshalsen.no",
		reversed: "on.bqs-neslahsladrjts--nx"
	},
	{
		suffix: "stockholm",
		reversed: "mlohkcots"
	},
	{
		suffix: "stockholm.museum",
		reversed: "muesum.mlohkcots"
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
		suffix: "storage",
		reversed: "egarots"
	},
	{
		suffix: "storage.yandexcloud.net",
		reversed: "ten.duolcxednay.egarots"
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
		suffix: "store",
		reversed: "erots"
	},
	{
		suffix: "store.bb",
		reversed: "bb.erots"
	},
	{
		suffix: "store.dk",
		reversed: "kd.erots"
	},
	{
		suffix: "store.nf",
		reversed: "fn.erots"
	},
	{
		suffix: "store.ro",
		reversed: "or.erots"
	},
	{
		suffix: "store.st",
		reversed: "ts.erots"
	},
	{
		suffix: "store.ve",
		reversed: "ev.erots"
	},
	{
		suffix: "storebase.store",
		reversed: "erots.esaberots"
	},
	{
		suffix: "storfjord.no",
		reversed: "on.drojfrots"
	},
	{
		suffix: "storj.farm",
		reversed: "mraf.jrots"
	},
	{
		suffix: "stpetersburg.museum",
		reversed: "muesum.grubsretepts"
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
		suffix: "stream",
		reversed: "maerts"
	},
	{
		suffix: "streamlitapp.com",
		reversed: "moc.ppatilmaerts"
	},
	{
		suffix: "stripper.jp",
		reversed: "pj.reppirts"
	},
	{
		suffix: "stryn.no",
		reversed: "on.nyrts"
	},
	{
		suffix: "student.aero",
		reversed: "orea.tneduts"
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
		suffix: "stuff-4-sale.org",
		reversed: "gro.elas-4-ffuts"
	},
	{
		suffix: "stuff-4-sale.us",
		reversed: "su.elas-4-ffuts"
	},
	{
		suffix: "stufftoread.com",
		reversed: "moc.daerotffuts"
	},
	{
		suffix: "stuttgart.museum",
		reversed: "muesum.tragttuts"
	},
	{
		suffix: "style",
		reversed: "elyts"
	},
	{
		suffix: "su",
		reversed: "us"
	},
	{
		suffix: "su.paba.se",
		reversed: "es.abap.us"
	},
	{
		suffix: "sub.jp",
		reversed: "pj.bus"
	},
	{
		suffix: "sucks",
		reversed: "skcus"
	},
	{
		suffix: "sue.fukuoka.jp",
		reversed: "pj.akoukuf.eus"
	},
	{
		suffix: "suedtirol.it",
		reversed: "ti.loritdeus"
	},
	{
		suffix: "suginami.tokyo.jp",
		reversed: "pj.oykot.imanigus"
	},
	{
		suffix: "sugito.saitama.jp",
		reversed: "pj.amatias.otigus"
	},
	{
		suffix: "suifu.ibaraki.jp",
		reversed: "pj.ikarabi.ufius"
	},
	{
		suffix: "suisse.museum",
		reversed: "muesum.essius"
	},
	{
		suffix: "suita.osaka.jp",
		reversed: "pj.akaso.atius"
	},
	{
		suffix: "sukagawa.fukushima.jp",
		reversed: "pj.amihsukuf.awagakus"
	},
	{
		suffix: "sukumo.kochi.jp",
		reversed: "pj.ihcok.omukus"
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
		suffix: "suli.hu",
		reversed: "uh.ilus"
	},
	{
		suffix: "sumida.tokyo.jp",
		reversed: "pj.oykot.adimus"
	},
	{
		suffix: "sumita.iwate.jp",
		reversed: "pj.etawi.atimus"
	},
	{
		suffix: "sumoto.hyogo.jp",
		reversed: "pj.ogoyh.otomus"
	},
	{
		suffix: "sumoto.kumamoto.jp",
		reversed: "pj.otomamuk.otomus"
	},
	{
		suffix: "sumy.ua",
		reversed: "au.ymus"
	},
	{
		suffix: "sunagawa.hokkaido.jp",
		reversed: "pj.odiakkoh.awaganus"
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
		suffix: "sunnyday.jp",
		reversed: "pj.yadynnus"
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
		suffix: "supersale.jp",
		reversed: "pj.elasrepus"
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
		suffix: "surgeonshall.museum",
		reversed: "muesum.llahsnoegrus"
	},
	{
		suffix: "surgery",
		reversed: "yregrus"
	},
	{
		suffix: "surnadal.no",
		reversed: "on.ladanrus"
	},
	{
		suffix: "surrey.museum",
		reversed: "muesum.yerrus"
	},
	{
		suffix: "susaki.kochi.jp",
		reversed: "pj.ihcok.ikasus"
	},
	{
		suffix: "susono.shizuoka.jp",
		reversed: "pj.akouzihs.onosus"
	},
	{
		suffix: "suwa.nagano.jp",
		reversed: "pj.onagan.awus"
	},
	{
		suffix: "suwalki.pl",
		reversed: "lp.iklawus"
	},
	{
		suffix: "suzaka.nagano.jp",
		reversed: "pj.onagan.akazus"
	},
	{
		suffix: "suzu.ishikawa.jp",
		reversed: "pj.awakihsi.uzus"
	},
	{
		suffix: "suzuka.mie.jp",
		reversed: "pj.eim.akuzus"
	},
	{
		suffix: "suzuki",
		reversed: "ikuzus"
	},
	{
		suffix: "sv",
		reversed: "vs"
	},
	{
		suffix: "sv.it",
		reversed: "ti.vs"
	},
	{
		suffix: "svalbard.no",
		reversed: "on.drablavs"
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
		suffix: "svizzera.museum",
		reversed: "muesum.arezzivs"
	},
	{
		suffix: "svn-repos.de",
		reversed: "ed.soper-nvs"
	},
	{
		suffix: "swatch",
		reversed: "hctaws"
	},
	{
		suffix: "sweden.museum",
		reversed: "muesum.nedews"
	},
	{
		suffix: "sweetpepper.org",
		reversed: "gro.reppepteews"
	},
	{
		suffix: "swidnica.pl",
		reversed: "lp.acindiws"
	},
	{
		suffix: "swidnik.pl",
		reversed: "lp.kindiws"
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
		suffix: "swiss",
		reversed: "ssiws"
	},
	{
		suffix: "sx",
		reversed: "xs"
	},
	{
		suffix: "sx.cn",
		reversed: "nc.xs"
	},
	{
		suffix: "sy",
		reversed: "ys"
	},
	{
		suffix: "sydney",
		reversed: "yendys"
	},
	{
		suffix: "sydney.museum",
		reversed: "muesum.yendys"
	},
	{
		suffix: "sykkylven.no",
		reversed: "on.nevlykkys"
	},
	{
		suffix: "syncloud.it",
		reversed: "ti.duolcnys"
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
		suffix: "synology.me",
		reversed: "em.ygolonys"
	},
	{
		suffix: "systems",
		reversed: "smetsys"
	},
	{
		suffix: "sytes.net",
		reversed: "ten.setys"
	},
	{
		suffix: "sz",
		reversed: "zs"
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
		suffix: "szex.hu",
		reversed: "uh.xezs"
	},
	{
		suffix: "szkola.pl",
		reversed: "lp.alokzs"
	},
	{
		suffix: "sálat.no",
		reversed: "on.an5-tals--nx"
	},
	{
		suffix: "sálát.no",
		reversed: "on.bale-tls--nx"
	},
	{
		suffix: "søgne.no",
		reversed: "on.arg-engs--nx"
	},
	{
		suffix: "sømna.no",
		reversed: "on.arg-anms--nx"
	},
	{
		suffix: "søndre-land.no",
		reversed: "on.bc0-dnal-erdns--nx"
	},
	{
		suffix: "sør-aurdal.no",
		reversed: "on.a8l-ladrua-rs--nx"
	},
	{
		suffix: "sør-fron.no",
		reversed: "on.a1q-norf-rs--nx"
	},
	{
		suffix: "sør-odal.no",
		reversed: "on.a1q-lado-rs--nx"
	},
	{
		suffix: "sør-varanger.no",
		reversed: "on.bgg-regnarav-rs--nx"
	},
	{
		suffix: "sørfold.no",
		reversed: "on.ayb-dlofrs--nx"
	},
	{
		suffix: "sørreisa.no",
		reversed: "on.a1q-asierrs--nx"
	},
	{
		suffix: "sørum.no",
		reversed: "on.arg-murs--nx"
	},
	{
		suffix: "südtirol.it",
		reversed: "ti.a2n-loritds--nx"
	},
	{
		suffix: "t.bg",
		reversed: "gb.t"
	},
	{
		suffix: "t.se",
		reversed: "es.t"
	},
	{
		suffix: "t3l3p0rt.net",
		reversed: "ten.tr0p3l3t"
	},
	{
		suffix: "ta.it",
		reversed: "ti.at"
	},
	{
		suffix: "taa.it",
		reversed: "ti.aat"
	},
	{
		suffix: "tab",
		reversed: "bat"
	},
	{
		suffix: "tabayama.yamanashi.jp",
		reversed: "pj.ihsanamay.amayabat"
	},
	{
		suffix: "tabitorder.co.il",
		reversed: "li.oc.redrotibat"
	},
	{
		suffix: "tabuse.yamaguchi.jp",
		reversed: "pj.ihcugamay.esubat"
	},
	{
		suffix: "tachiarai.fukuoka.jp",
		reversed: "pj.akoukuf.iaraihcat"
	},
	{
		suffix: "tachikawa.tokyo.jp",
		reversed: "pj.oykot.awakihcat"
	},
	{
		suffix: "tadaoka.osaka.jp",
		reversed: "pj.akaso.akoadat"
	},
	{
		suffix: "tado.mie.jp",
		reversed: "pj.eim.odat"
	},
	{
		suffix: "tadotsu.kagawa.jp",
		reversed: "pj.awagak.ustodat"
	},
	{
		suffix: "tagajo.miyagi.jp",
		reversed: "pj.igayim.ojagat"
	},
	{
		suffix: "tagami.niigata.jp",
		reversed: "pj.atagiin.imagat"
	},
	{
		suffix: "tagawa.fukuoka.jp",
		reversed: "pj.akoukuf.awagat"
	},
	{
		suffix: "tahara.aichi.jp",
		reversed: "pj.ihcia.arahat"
	},
	{
		suffix: "taifun-dns.de",
		reversed: "ed.snd-nufiat"
	},
	{
		suffix: "taiji.wakayama.jp",
		reversed: "pj.amayakaw.ijiat"
	},
	{
		suffix: "taiki.hokkaido.jp",
		reversed: "pj.odiakkoh.ikiat"
	},
	{
		suffix: "taiki.mie.jp",
		reversed: "pj.eim.ikiat"
	},
	{
		suffix: "tainai.niigata.jp",
		reversed: "pj.atagiin.ianiat"
	},
	{
		suffix: "taipei",
		reversed: "iepiat"
	},
	{
		suffix: "taira.toyama.jp",
		reversed: "pj.amayot.ariat"
	},
	{
		suffix: "taishi.hyogo.jp",
		reversed: "pj.ogoyh.ihsiat"
	},
	{
		suffix: "taishi.osaka.jp",
		reversed: "pj.akaso.ihsiat"
	},
	{
		suffix: "taishin.fukushima.jp",
		reversed: "pj.amihsukuf.nihsiat"
	},
	{
		suffix: "taito.tokyo.jp",
		reversed: "pj.oykot.otiat"
	},
	{
		suffix: "taiwa.miyagi.jp",
		reversed: "pj.igayim.awiat"
	},
	{
		suffix: "tajimi.gifu.jp",
		reversed: "pj.ufig.imijat"
	},
	{
		suffix: "tajiri.osaka.jp",
		reversed: "pj.akaso.irijat"
	},
	{
		suffix: "taka.hyogo.jp",
		reversed: "pj.ogoyh.akat"
	},
	{
		suffix: "takagi.nagano.jp",
		reversed: "pj.onagan.igakat"
	},
	{
		suffix: "takahagi.ibaraki.jp",
		reversed: "pj.ikarabi.igahakat"
	},
	{
		suffix: "takahama.aichi.jp",
		reversed: "pj.ihcia.amahakat"
	},
	{
		suffix: "takahama.fukui.jp",
		reversed: "pj.iukuf.amahakat"
	},
	{
		suffix: "takaharu.miyazaki.jp",
		reversed: "pj.ikazayim.urahakat"
	},
	{
		suffix: "takahashi.okayama.jp",
		reversed: "pj.amayako.ihsahakat"
	},
	{
		suffix: "takahata.yamagata.jp",
		reversed: "pj.atagamay.atahakat"
	},
	{
		suffix: "takaishi.osaka.jp",
		reversed: "pj.akaso.ihsiakat"
	},
	{
		suffix: "takamatsu.kagawa.jp",
		reversed: "pj.awagak.ustamakat"
	},
	{
		suffix: "takamori.kumamoto.jp",
		reversed: "pj.otomamuk.iromakat"
	},
	{
		suffix: "takamori.nagano.jp",
		reversed: "pj.onagan.iromakat"
	},
	{
		suffix: "takanabe.miyazaki.jp",
		reversed: "pj.ikazayim.ebanakat"
	},
	{
		suffix: "takanezawa.tochigi.jp",
		reversed: "pj.igihcot.awazenakat"
	},
	{
		suffix: "takaoka.toyama.jp",
		reversed: "pj.amayot.akoakat"
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
		suffix: "takasaki.gunma.jp",
		reversed: "pj.amnug.ikasakat"
	},
	{
		suffix: "takashima.shiga.jp",
		reversed: "pj.agihs.amihsakat"
	},
	{
		suffix: "takasu.hokkaido.jp",
		reversed: "pj.odiakkoh.usakat"
	},
	{
		suffix: "takata.fukuoka.jp",
		reversed: "pj.akoukuf.atakat"
	},
	{
		suffix: "takatori.nara.jp",
		reversed: "pj.aran.irotakat"
	},
	{
		suffix: "takatsuki.osaka.jp",
		reversed: "pj.akaso.ikustakat"
	},
	{
		suffix: "takatsuki.shiga.jp",
		reversed: "pj.agihs.ikustakat"
	},
	{
		suffix: "takayama.gifu.jp",
		reversed: "pj.ufig.amayakat"
	},
	{
		suffix: "takayama.gunma.jp",
		reversed: "pj.amnug.amayakat"
	},
	{
		suffix: "takayama.nagano.jp",
		reversed: "pj.onagan.amayakat"
	},
	{
		suffix: "takazaki.miyazaki.jp",
		reversed: "pj.ikazayim.ikazakat"
	},
	{
		suffix: "takehara.hiroshima.jp",
		reversed: "pj.amihsorih.arahekat"
	},
	{
		suffix: "taketa.oita.jp",
		reversed: "pj.atio.atekat"
	},
	{
		suffix: "taketomi.okinawa.jp",
		reversed: "pj.awaniko.imotekat"
	},
	{
		suffix: "taki.mie.jp",
		reversed: "pj.eim.ikat"
	},
	{
		suffix: "takikawa.hokkaido.jp",
		reversed: "pj.odiakkoh.awakikat"
	},
	{
		suffix: "takino.hyogo.jp",
		reversed: "pj.ogoyh.onikat"
	},
	{
		suffix: "takinoue.hokkaido.jp",
		reversed: "pj.odiakkoh.euonikat"
	},
	{
		suffix: "takko.aomori.jp",
		reversed: "pj.iromoa.okkat"
	},
	{
		suffix: "tako.chiba.jp",
		reversed: "pj.abihc.okat"
	},
	{
		suffix: "taku.saga.jp",
		reversed: "pj.agas.ukat"
	},
	{
		suffix: "talk",
		reversed: "klat"
	},
	{
		suffix: "tama.tokyo.jp",
		reversed: "pj.oykot.amat"
	},
	{
		suffix: "tamakawa.fukushima.jp",
		reversed: "pj.amihsukuf.awakamat"
	},
	{
		suffix: "tamaki.mie.jp",
		reversed: "pj.eim.ikamat"
	},
	{
		suffix: "tamamura.gunma.jp",
		reversed: "pj.amnug.arumamat"
	},
	{
		suffix: "tamano.okayama.jp",
		reversed: "pj.amayako.onamat"
	},
	{
		suffix: "tamatsukuri.ibaraki.jp",
		reversed: "pj.ikarabi.irukustamat"
	},
	{
		suffix: "tamayu.shimane.jp",
		reversed: "pj.enamihs.uyamat"
	},
	{
		suffix: "tamba.hyogo.jp",
		reversed: "pj.ogoyh.abmat"
	},
	{
		suffix: "tana.no",
		reversed: "on.anat"
	},
	{
		suffix: "tanabe.kyoto.jp",
		reversed: "pj.otoyk.ebanat"
	},
	{
		suffix: "tanabe.wakayama.jp",
		reversed: "pj.amayakaw.ebanat"
	},
	{
		suffix: "tanagura.fukushima.jp",
		reversed: "pj.amihsukuf.aruganat"
	},
	{
		suffix: "tananger.no",
		reversed: "on.regnanat"
	},
	{
		suffix: "tank.museum",
		reversed: "muesum.knat"
	},
	{
		suffix: "tanohata.iwate.jp",
		reversed: "pj.etawi.atahonat"
	},
	{
		suffix: "taobao",
		reversed: "oaboat"
	},
	{
		suffix: "tara.saga.jp",
		reversed: "pj.agas.arat"
	},
	{
		suffix: "tarama.okinawa.jp",
		reversed: "pj.awaniko.amarat"
	},
	{
		suffix: "taranto.it",
		reversed: "ti.otnarat"
	},
	{
		suffix: "target",
		reversed: "tegrat"
	},
	{
		suffix: "targi.pl",
		reversed: "lp.igrat"
	},
	{
		suffix: "tarnobrzeg.pl",
		reversed: "lp.gezrbonrat"
	},
	{
		suffix: "tarui.gifu.jp",
		reversed: "pj.ufig.iurat"
	},
	{
		suffix: "tarumizu.kagoshima.jp",
		reversed: "pj.amihsogak.uzimurat"
	},
	{
		suffix: "tas.au",
		reversed: "ua.sat"
	},
	{
		suffix: "tas.edu.au",
		reversed: "ua.ude.sat"
	},
	{
		suffix: "tas.gov.au",
		reversed: "ua.vog.sat"
	},
	{
		suffix: "tashkent.su",
		reversed: "us.tnekhsat"
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
		suffix: "tatebayashi.gunma.jp",
		reversed: "pj.amnug.ihsayabetat"
	},
	{
		suffix: "tateshina.nagano.jp",
		reversed: "pj.onagan.anihsetat"
	},
	{
		suffix: "tateyama.chiba.jp",
		reversed: "pj.abihc.amayetat"
	},
	{
		suffix: "tateyama.toyama.jp",
		reversed: "pj.amayot.amayetat"
	},
	{
		suffix: "tatsuno.hyogo.jp",
		reversed: "pj.ogoyh.onustat"
	},
	{
		suffix: "tatsuno.nagano.jp",
		reversed: "pj.onagan.onustat"
	},
	{
		suffix: "tattoo",
		reversed: "oottat"
	},
	{
		suffix: "tawaramoto.nara.jp",
		reversed: "pj.aran.otomarawat"
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
		suffix: "taxi.br",
		reversed: "rb.ixat"
	},
	{
		suffix: "tbits.me",
		reversed: "em.stibt"
	},
	{
		suffix: "tc",
		reversed: "ct"
	},
	{
		suffix: "tc.br",
		reversed: "rb.ct"
	},
	{
		suffix: "tci",
		reversed: "ict"
	},
	{
		suffix: "tcm.museum",
		reversed: "muesum.mct"
	},
	{
		suffix: "tcp4.me",
		reversed: "em.4pct"
	},
	{
		suffix: "td",
		reversed: "dt"
	},
	{
		suffix: "tdk",
		reversed: "kdt"
	},
	{
		suffix: "te.it",
		reversed: "ti.et"
	},
	{
		suffix: "te.ua",
		reversed: "au.et"
	},
	{
		suffix: "teaches-yoga.com",
		reversed: "moc.agoy-sehcaet"
	},
	{
		suffix: "team",
		reversed: "maet"
	},
	{
		suffix: "tec.br",
		reversed: "rb.cet"
	},
	{
		suffix: "tec.mi.us",
		reversed: "su.im.cet"
	},
	{
		suffix: "tec.ve",
		reversed: "ev.cet"
	},
	{
		suffix: "tech",
		reversed: "hcet"
	},
	{
		suffix: "tech.orange",
		reversed: "egnaro.hcet"
	},
	{
		suffix: "technology",
		reversed: "ygolonhcet"
	},
	{
		suffix: "technology.museum",
		reversed: "muesum.ygolonhcet"
	},
	{
		suffix: "tecnologia.bo",
		reversed: "ob.aigoloncet"
	},
	{
		suffix: "tel",
		reversed: "let"
	},
	{
		suffix: "tel.tr",
		reversed: "rt.let"
	},
	{
		suffix: "tele.amune.org",
		reversed: "gro.enuma.elet"
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
		suffix: "telekommunikation.museum",
		reversed: "muesum.noitakinummokelet"
	},
	{
		suffix: "television.museum",
		reversed: "muesum.noisivelet"
	},
	{
		suffix: "temasek",
		reversed: "kesamet"
	},
	{
		suffix: "temp-dns.com",
		reversed: "moc.snd-pmet"
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
		suffix: "tempurl.host",
		reversed: "tsoh.lrupmet"
	},
	{
		suffix: "tendo.yamagata.jp",
		reversed: "pj.atagamay.odnet"
	},
	{
		suffix: "tenei.fukushima.jp",
		reversed: "pj.amihsukuf.ienet"
	},
	{
		suffix: "tenkawa.nara.jp",
		reversed: "pj.aran.awaknet"
	},
	{
		suffix: "tennis",
		reversed: "sinnet"
	},
	{
		suffix: "tenri.nara.jp",
		reversed: "pj.aran.irnet"
	},
	{
		suffix: "teo.br",
		reversed: "rb.oet"
	},
	{
		suffix: "teramo.it",
		reversed: "ti.omaret"
	},
	{
		suffix: "termez.su",
		reversed: "us.zemret"
	},
	{
		suffix: "terni.it",
		reversed: "ti.inret"
	},
	{
		suffix: "ternopil.ua",
		reversed: "au.liponret"
	},
	{
		suffix: "teshikaga.hokkaido.jp",
		reversed: "pj.odiakkoh.agakihset"
	},
	{
		suffix: "test-iserv.de",
		reversed: "ed.vresi-tset"
	},
	{
		suffix: "test.ru",
		reversed: "ur.tset"
	},
	{
		suffix: "test.tj",
		reversed: "jt.tset"
	},
	{
		suffix: "teva",
		reversed: "avet"
	},
	{
		suffix: "texas.museum",
		reversed: "muesum.saxet"
	},
	{
		suffix: "textile.museum",
		reversed: "muesum.elitxet"
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
		suffix: "tgory.pl",
		reversed: "lp.yrogt"
	},
	{
		suffix: "th",
		reversed: "ht"
	},
	{
		suffix: "thd",
		reversed: "dht"
	},
	{
		suffix: "the.br",
		reversed: "rb.eht"
	},
	{
		suffix: "theater",
		reversed: "retaeht"
	},
	{
		suffix: "theater.museum",
		reversed: "muesum.retaeht"
	},
	{
		suffix: "theatre",
		reversed: "ertaeht"
	},
	{
		suffix: "theshop.jp",
		reversed: "pj.pohseht"
	},
	{
		suffix: "theworkpc.com",
		reversed: "moc.cpkroweht"
	},
	{
		suffix: "thick.jp",
		reversed: "pj.kciht"
	},
	{
		suffix: "thingdustdata.com",
		reversed: "moc.atadtsudgniht"
	},
	{
		suffix: "thruhere.net",
		reversed: "ten.erehurht"
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
		suffix: "tickets.io",
		reversed: "oi.stekcit"
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
		suffix: "time.museum",
		reversed: "muesum.emit"
	},
	{
		suffix: "time.no",
		reversed: "on.emit"
	},
	{
		suffix: "timekeeping.museum",
		reversed: "muesum.gnipeekemit"
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
		suffix: "tj",
		reversed: "jt"
	},
	{
		suffix: "tj.cn",
		reversed: "nc.jt"
	},
	{
		suffix: "tjeldsund.no",
		reversed: "on.dnusdlejt"
	},
	{
		suffix: "tjmaxx",
		reversed: "xxamjt"
	},
	{
		suffix: "tjome.no",
		reversed: "on.emojt"
	},
	{
		suffix: "tjx",
		reversed: "xjt"
	},
	{
		suffix: "tjøme.no",
		reversed: "on.arh-emjt--nx"
	},
	{
		suffix: "tk",
		reversed: "kt"
	},
	{
		suffix: "tkmaxx",
		reversed: "xxamkt"
	},
	{
		suffix: "tksat.bo",
		reversed: "ob.taskt"
	},
	{
		suffix: "tl",
		reversed: "lt"
	},
	{
		suffix: "tlon.network",
		reversed: "krowten.nolt"
	},
	{
		suffix: "tm",
		reversed: "mt"
	},
	{
		suffix: "tm.cy",
		reversed: "yc.mt"
	},
	{
		suffix: "tm.dz",
		reversed: "zd.mt"
	},
	{
		suffix: "tm.fr",
		reversed: "rf.mt"
	},
	{
		suffix: "tm.hu",
		reversed: "uh.mt"
	},
	{
		suffix: "tm.km",
		reversed: "mk.mt"
	},
	{
		suffix: "tm.mc",
		reversed: "cm.mt"
	},
	{
		suffix: "tm.mg",
		reversed: "gm.mt"
	},
	{
		suffix: "tm.no",
		reversed: "on.mt"
	},
	{
		suffix: "tm.pl",
		reversed: "lp.mt"
	},
	{
		suffix: "tm.ro",
		reversed: "or.mt"
	},
	{
		suffix: "tm.se",
		reversed: "es.mt"
	},
	{
		suffix: "tm.za",
		reversed: "az.mt"
	},
	{
		suffix: "tmall",
		reversed: "llamt"
	},
	{
		suffix: "tmp.br",
		reversed: "rb.pmt"
	},
	{
		suffix: "tn",
		reversed: "nt"
	},
	{
		suffix: "tn.it",
		reversed: "ti.nt"
	},
	{
		suffix: "tn.oxa.cloud",
		reversed: "duolc.axo.nt"
	},
	{
		suffix: "tn.us",
		reversed: "su.nt"
	},
	{
		suffix: "to",
		reversed: "ot"
	},
	{
		suffix: "to.gov.br",
		reversed: "rb.vog.ot"
	},
	{
		suffix: "to.gt",
		reversed: "tg.ot"
	},
	{
		suffix: "to.it",
		reversed: "ti.ot"
	},
	{
		suffix: "to.leg.br",
		reversed: "rb.gel.ot"
	},
	{
		suffix: "to.md",
		reversed: "dm.ot"
	},
	{
		suffix: "toba.mie.jp",
		reversed: "pj.eim.abot"
	},
	{
		suffix: "tobe.ehime.jp",
		reversed: "pj.emihe.ebot"
	},
	{
		suffix: "tobetsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustebot"
	},
	{
		suffix: "tobishima.aichi.jp",
		reversed: "pj.ihcia.amihsibot"
	},
	{
		suffix: "tochigi.jp",
		reversed: "pj.igihcot"
	},
	{
		suffix: "tochigi.tochigi.jp",
		reversed: "pj.igihcot.igihcot"
	},
	{
		suffix: "tochio.niigata.jp",
		reversed: "pj.atagiin.oihcot"
	},
	{
		suffix: "toda.saitama.jp",
		reversed: "pj.amatias.adot"
	},
	{
		suffix: "today",
		reversed: "yadot"
	},
	{
		suffix: "toei.aichi.jp",
		reversed: "pj.ihcia.ieot"
	},
	{
		suffix: "toga.toyama.jp",
		reversed: "pj.amayot.agot"
	},
	{
		suffix: "togakushi.nagano.jp",
		reversed: "pj.onagan.ihsukagot"
	},
	{
		suffix: "togane.chiba.jp",
		reversed: "pj.abihc.enagot"
	},
	{
		suffix: "togitsu.nagasaki.jp",
		reversed: "pj.ikasagan.ustigot"
	},
	{
		suffix: "togliatti.su",
		reversed: "us.ittailgot"
	},
	{
		suffix: "togo.aichi.jp",
		reversed: "pj.ihcia.ogot"
	},
	{
		suffix: "togura.nagano.jp",
		reversed: "pj.onagan.arugot"
	},
	{
		suffix: "tohma.hokkaido.jp",
		reversed: "pj.odiakkoh.amhot"
	},
	{
		suffix: "tohnosho.chiba.jp",
		reversed: "pj.abihc.ohsonhot"
	},
	{
		suffix: "toho.fukuoka.jp",
		reversed: "pj.akoukuf.ohot"
	},
	{
		suffix: "tokai.aichi.jp",
		reversed: "pj.ihcia.iakot"
	},
	{
		suffix: "tokai.ibaraki.jp",
		reversed: "pj.ikarabi.iakot"
	},
	{
		suffix: "tokamachi.niigata.jp",
		reversed: "pj.atagiin.ihcamakot"
	},
	{
		suffix: "tokashiki.okinawa.jp",
		reversed: "pj.awaniko.ikihsakot"
	},
	{
		suffix: "toki.gifu.jp",
		reversed: "pj.ufig.ikot"
	},
	{
		suffix: "tokigawa.saitama.jp",
		reversed: "pj.amatias.awagikot"
	},
	{
		suffix: "tokke.no",
		reversed: "on.ekkot"
	},
	{
		suffix: "tokoname.aichi.jp",
		reversed: "pj.ihcia.emanokot"
	},
	{
		suffix: "tokorozawa.saitama.jp",
		reversed: "pj.amatias.awazorokot"
	},
	{
		suffix: "tokushima.jp",
		reversed: "pj.amihsukot"
	},
	{
		suffix: "tokushima.tokushima.jp",
		reversed: "pj.amihsukot.amihsukot"
	},
	{
		suffix: "tokuyama.yamaguchi.jp",
		reversed: "pj.ihcugamay.amayukot"
	},
	{
		suffix: "tokyo",
		reversed: "oykot"
	},
	{
		suffix: "tokyo.jp",
		reversed: "pj.oykot"
	},
	{
		suffix: "tolga.no",
		reversed: "on.aglot"
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
		suffix: "tome.miyagi.jp",
		reversed: "pj.igayim.emot"
	},
	{
		suffix: "tomi.nagano.jp",
		reversed: "pj.onagan.imot"
	},
	{
		suffix: "tomigusuku.okinawa.jp",
		reversed: "pj.awaniko.ukusugimot"
	},
	{
		suffix: "tomika.gifu.jp",
		reversed: "pj.ufig.akimot"
	},
	{
		suffix: "tomioka.gunma.jp",
		reversed: "pj.amnug.akoimot"
	},
	{
		suffix: "tomisato.chiba.jp",
		reversed: "pj.abihc.otasimot"
	},
	{
		suffix: "tomiya.miyagi.jp",
		reversed: "pj.igayim.ayimot"
	},
	{
		suffix: "tomobe.ibaraki.jp",
		reversed: "pj.ikarabi.ebomot"
	},
	{
		suffix: "tonaki.okinawa.jp",
		reversed: "pj.awaniko.ikanot"
	},
	{
		suffix: "tonami.toyama.jp",
		reversed: "pj.amayot.imanot"
	},
	{
		suffix: "tondabayashi.osaka.jp",
		reversed: "pj.akaso.ihsayabadnot"
	},
	{
		suffix: "tone.ibaraki.jp",
		reversed: "pj.ikarabi.enot"
	},
	{
		suffix: "tonkotsu.jp",
		reversed: "pj.ustoknot"
	},
	{
		suffix: "tono.iwate.jp",
		reversed: "pj.etawi.onot"
	},
	{
		suffix: "tonosho.kagawa.jp",
		reversed: "pj.awagak.ohsonot"
	},
	{
		suffix: "tonsberg.no",
		reversed: "on.grebsnot"
	},
	{
		suffix: "toolforge.org",
		reversed: "gro.egrofloot"
	},
	{
		suffix: "tools",
		reversed: "sloot"
	},
	{
		suffix: "toon.ehime.jp",
		reversed: "pj.emihe.noot"
	},
	{
		suffix: "top",
		reversed: "pot"
	},
	{
		suffix: "topology.museum",
		reversed: "muesum.ygolopot"
	},
	{
		suffix: "torahime.shiga.jp",
		reversed: "pj.agihs.emiharot"
	},
	{
		suffix: "toray",
		reversed: "yarot"
	},
	{
		suffix: "toride.ibaraki.jp",
		reversed: "pj.ikarabi.edirot"
	},
	{
		suffix: "torino.it",
		reversed: "ti.onirot"
	},
	{
		suffix: "torino.museum",
		reversed: "muesum.onirot"
	},
	{
		suffix: "torproject.net",
		reversed: "ten.tcejorprot"
	},
	{
		suffix: "torsken.no",
		reversed: "on.neksrot"
	},
	{
		suffix: "tos.it",
		reversed: "ti.sot"
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
		suffix: "toscana.it",
		reversed: "ti.anacsot"
	},
	{
		suffix: "toshiba",
		reversed: "abihsot"
	},
	{
		suffix: "toshima.tokyo.jp",
		reversed: "pj.oykot.amihsot"
	},
	{
		suffix: "tosu.saga.jp",
		reversed: "pj.agas.usot"
	},
	{
		suffix: "total",
		reversed: "latot"
	},
	{
		suffix: "tottori.jp",
		reversed: "pj.irottot"
	},
	{
		suffix: "tottori.tottori.jp",
		reversed: "pj.irottot.irottot"
	},
	{
		suffix: "touch.museum",
		reversed: "muesum.hcuot"
	},
	{
		suffix: "tourism.pl",
		reversed: "lp.msiruot"
	},
	{
		suffix: "tourism.tn",
		reversed: "nt.msiruot"
	},
	{
		suffix: "tours",
		reversed: "sruot"
	},
	{
		suffix: "towada.aomori.jp",
		reversed: "pj.iromoa.adawot"
	},
	{
		suffix: "town",
		reversed: "nwot"
	},
	{
		suffix: "town.museum",
		reversed: "muesum.nwot"
	},
	{
		suffix: "townnews-staging.com",
		reversed: "moc.gnigats-swennwot"
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
		suffix: "toyama.jp",
		reversed: "pj.amayot"
	},
	{
		suffix: "toyama.toyama.jp",
		reversed: "pj.amayot.amayot"
	},
	{
		suffix: "toyo.kochi.jp",
		reversed: "pj.ihcok.oyot"
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
		suffix: "toyonaka.osaka.jp",
		reversed: "pj.akaso.akanoyot"
	},
	{
		suffix: "toyone.aichi.jp",
		reversed: "pj.ihcia.enoyot"
	},
	{
		suffix: "toyono.osaka.jp",
		reversed: "pj.akaso.onoyot"
	},
	{
		suffix: "toyooka.hyogo.jp",
		reversed: "pj.ogoyh.akooyot"
	},
	{
		suffix: "toyosato.shiga.jp",
		reversed: "pj.agihs.otasoyot"
	},
	{
		suffix: "toyota",
		reversed: "atoyot"
	},
	{
		suffix: "toyota.aichi.jp",
		reversed: "pj.ihcia.atoyot"
	},
	{
		suffix: "toyota.yamaguchi.jp",
		reversed: "pj.ihcugamay.atoyot"
	},
	{
		suffix: "toyotomi.hokkaido.jp",
		reversed: "pj.odiakkoh.imotoyot"
	},
	{
		suffix: "toyotsu.fukuoka.jp",
		reversed: "pj.akoukuf.ustoyot"
	},
	{
		suffix: "toyoura.hokkaido.jp",
		reversed: "pj.odiakkoh.aruoyot"
	},
	{
		suffix: "toys",
		reversed: "syot"
	},
	{
		suffix: "tozawa.yamagata.jp",
		reversed: "pj.atagamay.awazot"
	},
	{
		suffix: "tozsde.hu",
		reversed: "uh.edszot"
	},
	{
		suffix: "tp.it",
		reversed: "ti.pt"
	},
	{
		suffix: "tr",
		reversed: "rt"
	},
	{
		suffix: "tr.eu.org",
		reversed: "gro.ue.rt"
	},
	{
		suffix: "tr.it",
		reversed: "ti.rt"
	},
	{
		suffix: "tr.no",
		reversed: "on.rt"
	},
	{
		suffix: "tra.kp",
		reversed: "pk.art"
	},
	{
		suffix: "trade",
		reversed: "edart"
	},
	{
		suffix: "trader.aero",
		reversed: "orea.redart"
	},
	{
		suffix: "trading",
		reversed: "gnidart"
	},
	{
		suffix: "trading.aero",
		reversed: "orea.gnidart"
	},
	{
		suffix: "traeumtgerade.de",
		reversed: "ed.edaregtmueart"
	},
	{
		suffix: "trafficplex.cloud",
		reversed: "duolc.xelpciffart"
	},
	{
		suffix: "trainer.aero",
		reversed: "orea.reniart"
	},
	{
		suffix: "training",
		reversed: "gniniart"
	},
	{
		suffix: "trana.no",
		reversed: "on.anart"
	},
	{
		suffix: "tranby.no",
		reversed: "on.ybnart"
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
		suffix: "tranoy.no",
		reversed: "on.yonart"
	},
	{
		suffix: "translate.goog",
		reversed: "goog.etalsnart"
	},
	{
		suffix: "translated.page",
		reversed: "egap.detalsnart"
	},
	{
		suffix: "transport.museum",
		reversed: "muesum.tropsnart"
	},
	{
		suffix: "transporte.bo",
		reversed: "ob.etropsnart"
	},
	{
		suffix: "tranøy.no",
		reversed: "on.auy-ynart--nx"
	},
	{
		suffix: "trapani.it",
		reversed: "ti.inapart"
	},
	{
		suffix: "travel",
		reversed: "levart"
	},
	{
		suffix: "travel.in",
		reversed: "ni.levart"
	},
	{
		suffix: "travel.pl",
		reversed: "lp.levart"
	},
	{
		suffix: "travel.tt",
		reversed: "tt.levart"
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
		suffix: "trd.br",
		reversed: "rb.drt"
	},
	{
		suffix: "tree.museum",
		reversed: "muesum.eert"
	},
	{
		suffix: "trentin-sud-tirol.it",
		reversed: "ti.lorit-dus-nitnert"
	},
	{
		suffix: "trentin-sudtirol.it",
		reversed: "ti.loritdus-nitnert"
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
		suffix: "trentin-süd-tirol.it",
		reversed: "ti.bzr-lorit-ds-nitnert--nx"
	},
	{
		suffix: "trentin-südtirol.it",
		reversed: "ti.bv7-loritds-nitnert--nx"
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
		suffix: "trentino-sudtirol.it",
		reversed: "ti.loritdus-onitnert"
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
		suffix: "trentino-süd-tirol.it",
		reversed: "ti.b3c-lorit-ds-onitnert--nx"
	},
	{
		suffix: "trentino-südtirol.it",
		reversed: "ti.bzs-loritds-onitnert--nx"
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
		suffix: "trentinosudtirol.it",
		reversed: "ti.loritdusonitnert"
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
		suffix: "trentinosüd-tirol.it",
		reversed: "ti.bzr-lorit-dsonitnert--nx"
	},
	{
		suffix: "trentinosüdtirol.it",
		reversed: "ti.bv7-loritdsonitnert--nx"
	},
	{
		suffix: "trentinsud-tirol.it",
		reversed: "ti.lorit-dusnitnert"
	},
	{
		suffix: "trentinsudtirol.it",
		reversed: "ti.loritdusnitnert"
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
		suffix: "trentinsüd-tirol.it",
		reversed: "ti.bv6-lorit-dsnitnert--nx"
	},
	{
		suffix: "trentinsüdtirol.it",
		reversed: "ti.bsn-loritdsnitnert--nx"
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
		suffix: "troandin.no",
		reversed: "on.nidnaort"
	},
	{
		suffix: "trogstad.no",
		reversed: "on.datsgort"
	},
	{
		suffix: "troitsk.su",
		reversed: "us.kstiort"
	},
	{
		suffix: "trolley.museum",
		reversed: "muesum.yellort"
	},
	{
		suffix: "tromsa.no",
		reversed: "on.asmort"
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
		suffix: "trondheim.no",
		reversed: "on.miehdnort"
	},
	{
		suffix: "trust",
		reversed: "tsurt"
	},
	{
		suffix: "trust.museum",
		reversed: "muesum.tsurt"
	},
	{
		suffix: "trustee.museum",
		reversed: "muesum.eetsurt"
	},
	{
		suffix: "trv",
		reversed: "vrt"
	},
	{
		suffix: "try-snowplow.com",
		reversed: "moc.wolpwons-yrt"
	},
	{
		suffix: "trycloudflare.com",
		reversed: "moc.eralfduolcyrt"
	},
	{
		suffix: "trysil.no",
		reversed: "on.lisyrt"
	},
	{
		suffix: "træna.no",
		reversed: "on.aow-anrt--nx"
	},
	{
		suffix: "trøgstad.no",
		reversed: "on.a1r-datsgrt--nx"
	},
	{
		suffix: "ts.it",
		reversed: "ti.st"
	},
	{
		suffix: "ts.net",
		reversed: "ten.st"
	},
	{
		suffix: "tselinograd.su",
		reversed: "us.dargonilest"
	},
	{
		suffix: "tsk.tr",
		reversed: "rt.kst"
	},
	{
		suffix: "tsu.mie.jp",
		reversed: "pj.eim.ust"
	},
	{
		suffix: "tsubame.niigata.jp",
		reversed: "pj.atagiin.emabust"
	},
	{
		suffix: "tsubata.ishikawa.jp",
		reversed: "pj.awakihsi.atabust"
	},
	{
		suffix: "tsubetsu.hokkaido.jp",
		reversed: "pj.odiakkoh.ustebust"
	},
	{
		suffix: "tsuchiura.ibaraki.jp",
		reversed: "pj.ikarabi.aruihcust"
	},
	{
		suffix: "tsuga.tochigi.jp",
		reversed: "pj.igihcot.agust"
	},
	{
		suffix: "tsugaru.aomori.jp",
		reversed: "pj.iromoa.uragust"
	},
	{
		suffix: "tsuiki.fukuoka.jp",
		reversed: "pj.akoukuf.ikiust"
	},
	{
		suffix: "tsukigata.hokkaido.jp",
		reversed: "pj.odiakkoh.atagikust"
	},
	{
		suffix: "tsukiyono.gunma.jp",
		reversed: "pj.amnug.onoyikust"
	},
	{
		suffix: "tsukuba.ibaraki.jp",
		reversed: "pj.ikarabi.abukust"
	},
	{
		suffix: "tsukui.kanagawa.jp",
		reversed: "pj.awaganak.iukust"
	},
	{
		suffix: "tsukumi.oita.jp",
		reversed: "pj.atio.imukust"
	},
	{
		suffix: "tsumagoi.gunma.jp",
		reversed: "pj.amnug.iogamust"
	},
	{
		suffix: "tsunan.niigata.jp",
		reversed: "pj.atagiin.nanust"
	},
	{
		suffix: "tsuno.kochi.jp",
		reversed: "pj.ihcok.onust"
	},
	{
		suffix: "tsuno.miyazaki.jp",
		reversed: "pj.ikazayim.onust"
	},
	{
		suffix: "tsuru.yamanashi.jp",
		reversed: "pj.ihsanamay.urust"
	},
	{
		suffix: "tsuruga.fukui.jp",
		reversed: "pj.iukuf.agurust"
	},
	{
		suffix: "tsurugashima.saitama.jp",
		reversed: "pj.amatias.amihsagurust"
	},
	{
		suffix: "tsurugi.ishikawa.jp",
		reversed: "pj.awakihsi.igurust"
	},
	{
		suffix: "tsuruoka.yamagata.jp",
		reversed: "pj.atagamay.akourust"
	},
	{
		suffix: "tsuruta.aomori.jp",
		reversed: "pj.iromoa.aturust"
	},
	{
		suffix: "tsushima.aichi.jp",
		reversed: "pj.ihcia.amihsust"
	},
	{
		suffix: "tsushima.nagasaki.jp",
		reversed: "pj.ikasagan.amihsust"
	},
	{
		suffix: "tsuwano.shimane.jp",
		reversed: "pj.enamihs.onawust"
	},
	{
		suffix: "tsuyama.okayama.jp",
		reversed: "pj.amayako.amayust"
	},
	{
		suffix: "tt",
		reversed: "tt"
	},
	{
		suffix: "tt.im",
		reversed: "mi.tt"
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
		suffix: "tula.su",
		reversed: "us.alut"
	},
	{
		suffix: "tuleap-partners.com",
		reversed: "moc.srentrap-paelut"
	},
	{
		suffix: "tunes",
		reversed: "senut"
	},
	{
		suffix: "tunk.org",
		reversed: "gro.knut"
	},
	{
		suffix: "tur.ar",
		reversed: "ra.rut"
	},
	{
		suffix: "tur.br",
		reversed: "rb.rut"
	},
	{
		suffix: "turek.pl",
		reversed: "lp.kerut"
	},
	{
		suffix: "turin.it",
		reversed: "ti.nirut"
	},
	{
		suffix: "turystyka.pl",
		reversed: "lp.akytsyrut"
	},
	{
		suffix: "tuscany.it",
		reversed: "ti.ynacsut"
	},
	{
		suffix: "tushu",
		reversed: "uhsut"
	},
	{
		suffix: "tuva.su",
		reversed: "us.avut"
	},
	{
		suffix: "tuxfamily.org",
		reversed: "gro.ylimafxut"
	},
	{
		suffix: "tv",
		reversed: "vt"
	},
	{
		suffix: "tv.bb",
		reversed: "bb.vt"
	},
	{
		suffix: "tv.bo",
		reversed: "ob.vt"
	},
	{
		suffix: "tv.br",
		reversed: "rb.vt"
	},
	{
		suffix: "tv.im",
		reversed: "mi.vt"
	},
	{
		suffix: "tv.in",
		reversed: "ni.vt"
	},
	{
		suffix: "tv.it",
		reversed: "ti.vt"
	},
	{
		suffix: "tv.kg",
		reversed: "gk.vt"
	},
	{
		suffix: "tv.na",
		reversed: "an.vt"
	},
	{
		suffix: "tv.sd",
		reversed: "ds.vt"
	},
	{
		suffix: "tv.tr",
		reversed: "rt.vt"
	},
	{
		suffix: "tv.tz",
		reversed: "zt.vt"
	},
	{
		suffix: "tvedestrand.no",
		reversed: "on.dnartsedevt"
	},
	{
		suffix: "tvs",
		reversed: "svt"
	},
	{
		suffix: "tw",
		reversed: "wt"
	},
	{
		suffix: "tw.cn",
		reversed: "nc.wt"
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
		suffix: "tx.us",
		reversed: "su.xt"
	},
	{
		suffix: "tychy.pl",
		reversed: "lp.yhcyt"
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
		suffix: "typedream.app",
		reversed: "ppa.maerdepyt"
	},
	{
		suffix: "tysfjord.no",
		reversed: "on.drojfsyt"
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
		suffix: "tz",
		reversed: "zt"
	},
	{
		suffix: "tønsberg.no",
		reversed: "on.a1q-grebsnt--nx"
	},
	{
		suffix: "u.bg",
		reversed: "gb.u"
	},
	{
		suffix: "u.channelsdvr.net",
		reversed: "ten.rvdslennahc.u"
	},
	{
		suffix: "u.se",
		reversed: "es.u"
	},
	{
		suffix: "u2-local.xnbay.com",
		reversed: "moc.yabnx.lacol-2u"
	},
	{
		suffix: "u2.xnbay.com",
		reversed: "moc.yabnx.2u"
	},
	{
		suffix: "ua",
		reversed: "au"
	},
	{
		suffix: "ua.rs",
		reversed: "sr.au"
	},
	{
		suffix: "ubank",
		reversed: "knabu"
	},
	{
		suffix: "ube.yamaguchi.jp",
		reversed: "pj.ihcugamay.ebu"
	},
	{
		suffix: "uber.space",
		reversed: "ecaps.rebu"
	},
	{
		suffix: "ubs",
		reversed: "sbu"
	},
	{
		suffix: "uchihara.ibaraki.jp",
		reversed: "pj.ikarabi.arahihcu"
	},
	{
		suffix: "uchiko.ehime.jp",
		reversed: "pj.emihe.okihcu"
	},
	{
		suffix: "uchinada.ishikawa.jp",
		reversed: "pj.awakihsi.adanihcu"
	},
	{
		suffix: "uchinomi.kagawa.jp",
		reversed: "pj.awagak.imonihcu"
	},
	{
		suffix: "ud.it",
		reversed: "ti.du"
	},
	{
		suffix: "uda.nara.jp",
		reversed: "pj.aran.adu"
	},
	{
		suffix: "udi.br",
		reversed: "rb.idu"
	},
	{
		suffix: "udine.it",
		reversed: "ti.enidu"
	},
	{
		suffix: "udono.mie.jp",
		reversed: "pj.eim.onodu"
	},
	{
		suffix: "ueda.nagano.jp",
		reversed: "pj.onagan.adeu"
	},
	{
		suffix: "ueno.gunma.jp",
		reversed: "pj.amnug.oneu"
	},
	{
		suffix: "uenohara.yamanashi.jp",
		reversed: "pj.ihsanamay.arahoneu"
	},
	{
		suffix: "ufcfan.org",
		reversed: "gro.nafcfu"
	},
	{
		suffix: "ug",
		reversed: "gu"
	},
	{
		suffix: "ug.gov.pl",
		reversed: "lp.vog.gu"
	},
	{
		suffix: "ugim.gov.pl",
		reversed: "lp.vog.migu"
	},
	{
		suffix: "uhren.museum",
		reversed: "muesum.nerhu"
	},
	{
		suffix: "ui.nabu.casa",
		reversed: "asac.uban.iu"
	},
	{
		suffix: "uji.kyoto.jp",
		reversed: "pj.otoyk.iju"
	},
	{
		suffix: "ujiie.tochigi.jp",
		reversed: "pj.igihcot.eiiju"
	},
	{
		suffix: "ujitawara.kyoto.jp",
		reversed: "pj.otoyk.arawatiju"
	},
	{
		suffix: "uk",
		reversed: "ku"
	},
	{
		suffix: "uk.com",
		reversed: "moc.ku"
	},
	{
		suffix: "uk.eu.org",
		reversed: "gro.ue.ku"
	},
	{
		suffix: "uk.in",
		reversed: "ni.ku"
	},
	{
		suffix: "uk.kg",
		reversed: "gk.ku"
	},
	{
		suffix: "uk.net",
		reversed: "ten.ku"
	},
	{
		suffix: "uk.oxa.cloud",
		reversed: "duolc.axo.ku"
	},
	{
		suffix: "uk.primetel.cloud",
		reversed: "duolc.letemirp.ku"
	},
	{
		suffix: "uk.reclaim.cloud",
		reversed: "duolc.mialcer.ku"
	},
	{
		suffix: "uk0.bigv.io",
		reversed: "oi.vgib.0ku"
	},
	{
		suffix: "uki.kumamoto.jp",
		reversed: "pj.otomamuk.iku"
	},
	{
		suffix: "ukiha.fukuoka.jp",
		reversed: "pj.akoukuf.ahiku"
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
		suffix: "ulm.museum",
		reversed: "muesum.mlu"
	},
	{
		suffix: "ulsan.kr",
		reversed: "rk.naslu"
	},
	{
		suffix: "ulvik.no",
		reversed: "on.kivlu"
	},
	{
		suffix: "um.gov.pl",
		reversed: "lp.vog.mu"
	},
	{
		suffix: "umaji.kochi.jp",
		reversed: "pj.ihcok.ijamu"
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
		suffix: "umi.fukuoka.jp",
		reversed: "pj.akoukuf.imu"
	},
	{
		suffix: "umig.gov.pl",
		reversed: "lp.vog.gimu"
	},
	{
		suffix: "unazuki.toyama.jp",
		reversed: "pj.amayot.ikuzanu"
	},
	{
		suffix: "under.jp",
		reversed: "pj.rednu"
	},
	{
		suffix: "undersea.museum",
		reversed: "muesum.aesrednu"
	},
	{
		suffix: "uni5.net",
		reversed: "ten.5inu"
	},
	{
		suffix: "unicloud.pl",
		reversed: "lp.duolcinu"
	},
	{
		suffix: "unicom",
		reversed: "mocinu"
	},
	{
		suffix: "union.aero",
		reversed: "orea.noinu"
	},
	{
		suffix: "univ.sn",
		reversed: "ns.vinu"
	},
	{
		suffix: "university",
		reversed: "ytisrevinu"
	},
	{
		suffix: "university.museum",
		reversed: "muesum.ytisrevinu"
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
		suffix: "unnan.shimane.jp",
		reversed: "pj.enamihs.nannu"
	},
	{
		suffix: "uno",
		reversed: "onu"
	},
	{
		suffix: "unusualperson.com",
		reversed: "moc.nosreplausunu"
	},
	{
		suffix: "unzen.nagasaki.jp",
		reversed: "pj.ikasagan.neznu"
	},
	{
		suffix: "uol",
		reversed: "lou"
	},
	{
		suffix: "uonuma.niigata.jp",
		reversed: "pj.atagiin.amunou"
	},
	{
		suffix: "uozu.toyama.jp",
		reversed: "pj.amayot.uzou"
	},
	{
		suffix: "up.in",
		reversed: "ni.pu"
	},
	{
		suffix: "upaas.kazteleport.kz",
		reversed: "zk.tropeletzak.saapu"
	},
	{
		suffix: "upli.io",
		reversed: "oi.ilpu"
	},
	{
		suffix: "upow.gov.pl",
		reversed: "lp.vog.wopu"
	},
	{
		suffix: "upper.jp",
		reversed: "pj.reppu"
	},
	{
		suffix: "uppo.gov.pl",
		reversed: "lp.vog.oppu"
	},
	{
		suffix: "ups",
		reversed: "spu"
	},
	{
		suffix: "urakawa.hokkaido.jp",
		reversed: "pj.odiakkoh.awakaru"
	},
	{
		suffix: "urasoe.okinawa.jp",
		reversed: "pj.awaniko.eosaru"
	},
	{
		suffix: "urausu.hokkaido.jp",
		reversed: "pj.odiakkoh.usuaru"
	},
	{
		suffix: "urawa.saitama.jp",
		reversed: "pj.amatias.awaru"
	},
	{
		suffix: "urayasu.chiba.jp",
		reversed: "pj.abihc.usayaru"
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
		suffix: "ureshino.mie.jp",
		reversed: "pj.eim.onihseru"
	},
	{
		suffix: "uri.arpa",
		reversed: "apra.iru"
	},
	{
		suffix: "url.tw",
		reversed: "wt.lru"
	},
	{
		suffix: "urn.arpa",
		reversed: "apra.nru"
	},
	{
		suffix: "urown.cloud",
		reversed: "duolc.nworu"
	},
	{
		suffix: "uruma.okinawa.jp",
		reversed: "pj.awaniko.amuru"
	},
	{
		suffix: "uryu.hokkaido.jp",
		reversed: "pj.odiakkoh.uyru"
	},
	{
		suffix: "us",
		reversed: "su"
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
		suffix: "us-east-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsae-su"
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
		suffix: "us.ax",
		reversed: "xa.su"
	},
	{
		suffix: "us.com",
		reversed: "moc.su"
	},
	{
		suffix: "us.eu.org",
		reversed: "gro.ue.su"
	},
	{
		suffix: "us.gov.pl",
		reversed: "lp.vog.su"
	},
	{
		suffix: "us.in",
		reversed: "ni.su"
	},
	{
		suffix: "us.kg",
		reversed: "gk.su"
	},
	{
		suffix: "us.na",
		reversed: "an.su"
	},
	{
		suffix: "us.org",
		reversed: "gro.su"
	},
	{
		suffix: "us.platform.sh",
		reversed: "hs.mroftalp.su"
	},
	{
		suffix: "us.reclaim.cloud",
		reversed: "duolc.mialcer.su"
	},
	{
		suffix: "usa.museum",
		reversed: "muesum.asu"
	},
	{
		suffix: "usa.oita.jp",
		reversed: "pj.atio.asu"
	},
	{
		suffix: "usantiques.museum",
		reversed: "muesum.seuqitnasu"
	},
	{
		suffix: "usarts.museum",
		reversed: "muesum.strasu"
	},
	{
		suffix: "uscountryestate.museum",
		reversed: "muesum.etatseyrtnuocsu"
	},
	{
		suffix: "usculture.museum",
		reversed: "muesum.erutlucsu"
	},
	{
		suffix: "usdecorativearts.museum",
		reversed: "muesum.straevitarocedsu"
	},
	{
		suffix: "user.aseinet.ne.jp",
		reversed: "pj.en.teniesa.resu"
	},
	{
		suffix: "user.party.eus",
		reversed: "sue.ytrap.resu"
	},
	{
		suffix: "user.srcf.net",
		reversed: "ten.fcrs.resu"
	},
	{
		suffix: "usercontent.jp",
		reversed: "pj.tnetnocresu"
	},
	{
		suffix: "users.scale.virtualcloud.com.br",
		reversed: "rb.moc.duolclautriv.elacs.sresu"
	},
	{
		suffix: "usgarden.museum",
		reversed: "muesum.nedragsu"
	},
	{
		suffix: "ushiku.ibaraki.jp",
		reversed: "pj.ikarabi.ukihsu"
	},
	{
		suffix: "ushistory.museum",
		reversed: "muesum.yrotsihsu"
	},
	{
		suffix: "ushuaia.museum",
		reversed: "muesum.aiauhsu"
	},
	{
		suffix: "uslivinghistory.museum",
		reversed: "muesum.yrotsihgnivilsu"
	},
	{
		suffix: "usr.cloud.muni.cz",
		reversed: "zc.inum.duolc.rsu"
	},
	{
		suffix: "ustka.pl",
		reversed: "lp.aktsu"
	},
	{
		suffix: "usui.fukuoka.jp",
		reversed: "pj.akoukuf.iusu"
	},
	{
		suffix: "usuki.oita.jp",
		reversed: "pj.atio.ikusu"
	},
	{
		suffix: "ut.us",
		reversed: "su.tu"
	},
	{
		suffix: "utah.museum",
		reversed: "muesum.hatu"
	},
	{
		suffix: "utashinai.hokkaido.jp",
		reversed: "pj.odiakkoh.ianihsatu"
	},
	{
		suffix: "utazas.hu",
		reversed: "uh.sazatu"
	},
	{
		suffix: "utazu.kagawa.jp",
		reversed: "pj.awagak.uzatu"
	},
	{
		suffix: "uto.kumamoto.jp",
		reversed: "pj.otomamuk.otu"
	},
	{
		suffix: "utsira.no",
		reversed: "on.aristu"
	},
	{
		suffix: "utsunomiya.tochigi.jp",
		reversed: "pj.igihcot.ayimonustu"
	},
	{
		suffix: "utwente.io",
		reversed: "oi.etnewtu"
	},
	{
		suffix: "uvic.museum",
		reversed: "muesum.civu"
	},
	{
		suffix: "uw.gov.pl",
		reversed: "lp.vog.wu"
	},
	{
		suffix: "uwajima.ehime.jp",
		reversed: "pj.emihe.amijawu"
	},
	{
		suffix: "uwu.ai",
		reversed: "ia.uwu"
	},
	{
		suffix: "uy",
		reversed: "yu"
	},
	{
		suffix: "uy.com",
		reversed: "moc.yu"
	},
	{
		suffix: "uz",
		reversed: "zu"
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
		suffix: "uzs.gov.pl",
		reversed: "lp.vog.szu"
	},
	{
		suffix: "v-info.info",
		reversed: "ofni.ofni-v"
	},
	{
		suffix: "v.bg",
		reversed: "gb.v"
	},
	{
		suffix: "v.ua",
		reversed: "au.v"
	},
	{
		suffix: "va",
		reversed: "av"
	},
	{
		suffix: "va.it",
		reversed: "ti.av"
	},
	{
		suffix: "va.no",
		reversed: "on.av"
	},
	{
		suffix: "va.us",
		reversed: "su.av"
	},
	{
		suffix: "vaapste.no",
		reversed: "on.etspaav"
	},
	{
		suffix: "vacations",
		reversed: "snoitacav"
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
		suffix: "vaga.no",
		reversed: "on.agav"
	},
	{
		suffix: "vagan.no",
		reversed: "on.nagav"
	},
	{
		suffix: "vagsoy.no",
		reversed: "on.yosgav"
	},
	{
		suffix: "vaksdal.no",
		reversed: "on.ladskav"
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
		suffix: "valer.hedmark.no",
		reversed: "on.kramdeh.relav"
	},
	{
		suffix: "valer.ostfold.no",
		reversed: "on.dloftso.relav"
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
		suffix: "valle.no",
		reversed: "on.ellav"
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
		suffix: "vallee-d-aoste.it",
		reversed: "ti.etsoa-d-eellav"
	},
	{
		suffix: "valleeaoste.it",
		reversed: "ti.etsoaeellav"
	},
	{
		suffix: "valleedaoste.it",
		reversed: "ti.etsoadeellav"
	},
	{
		suffix: "valley.museum",
		reversed: "muesum.yellav"
	},
	{
		suffix: "vallée-aoste.it",
		reversed: "ti.bbe-etsoa-ellav--nx"
	},
	{
		suffix: "vallée-d-aoste.it",
		reversed: "ti.bhe-etsoa-d-ellav--nx"
	},
	{
		suffix: "valléeaoste.it",
		reversed: "ti.a7e-etsoaellav--nx"
	},
	{
		suffix: "valléedaoste.it",
		reversed: "ti.bbe-etsoadellav--nx"
	},
	{
		suffix: "vana",
		reversed: "anav"
	},
	{
		suffix: "vang.no",
		reversed: "on.gnav"
	},
	{
		suffix: "vanguard",
		reversed: "draugnav"
	},
	{
		suffix: "vantaa.museum",
		reversed: "muesum.aatnav"
	},
	{
		suffix: "vanylven.no",
		reversed: "on.nevlynav"
	},
	{
		suffix: "vao.it",
		reversed: "ti.oav"
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
		suffix: "vardo.no",
		reversed: "on.odrav"
	},
	{
		suffix: "vardø.no",
		reversed: "on.arj-drav--nx"
	},
	{
		suffix: "varese.it",
		reversed: "ti.eserav"
	},
	{
		suffix: "varggat.no",
		reversed: "on.taggrav"
	},
	{
		suffix: "varoy.no",
		reversed: "on.yorav"
	},
	{
		suffix: "vb.it",
		reversed: "ti.bv"
	},
	{
		suffix: "vc",
		reversed: "cv"
	},
	{
		suffix: "vc.it",
		reversed: "ti.cv"
	},
	{
		suffix: "vda.it",
		reversed: "ti.adv"
	},
	{
		suffix: "ve",
		reversed: "ev"
	},
	{
		suffix: "ve.it",
		reversed: "ti.ev"
	},
	{
		suffix: "vefsn.no",
		reversed: "on.nsfev"
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
		suffix: "vegas",
		reversed: "sagev"
	},
	{
		suffix: "vegårshei.no",
		reversed: "on.a0c-iehsrgev--nx"
	},
	{
		suffix: "velvet.jp",
		reversed: "pj.tevlev"
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
		suffix: "venezia.it",
		reversed: "ti.aizenev"
	},
	{
		suffix: "venice.it",
		reversed: "ti.ecinev"
	},
	{
		suffix: "vennesla.no",
		reversed: "on.alsennev"
	},
	{
		suffix: "ventures",
		reversed: "serutnev"
	},
	{
		suffix: "verbania.it",
		reversed: "ti.ainabrev"
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
		suffix: "vercelli.it",
		reversed: "ti.illecrev"
	},
	{
		suffix: "verdal.no",
		reversed: "on.ladrev"
	},
	{
		suffix: "verisign",
		reversed: "ngisirev"
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
		suffix: "verona.it",
		reversed: "ti.anorev"
	},
	{
		suffix: "verran.no",
		reversed: "on.narrev"
	},
	{
		suffix: "versailles.museum",
		reversed: "muesum.selliasrev"
	},
	{
		suffix: "verse.jp",
		reversed: "pj.esrev"
	},
	{
		suffix: "versicherung",
		reversed: "gnurehcisrev"
	},
	{
		suffix: "versus.jp",
		reversed: "pj.susrev"
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
		suffix: "vet",
		reversed: "tev"
	},
	{
		suffix: "vet.br",
		reversed: "rb.tev"
	},
	{
		suffix: "veterinaire.fr",
		reversed: "rf.erianiretev"
	},
	{
		suffix: "veterinaire.km",
		reversed: "mk.erianiretev"
	},
	{
		suffix: "vevelstad.no",
		reversed: "on.datslevev"
	},
	{
		suffix: "vf.no",
		reversed: "on.fv"
	},
	{
		suffix: "vfs.cloud9.af-south-1.amazonaws.com",
		reversed: "moc.swanozama.1-htuos-fa.9duolc.sfv"
	},
	{
		suffix: "vfs.cloud9.ap-east-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsae-pa.9duolc.sfv"
	},
	{
		suffix: "vfs.cloud9.ap-northeast-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsaehtron-pa.9duolc.sfv"
	},
	{
		suffix: "vfs.cloud9.ap-northeast-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsaehtron-pa.9duolc.sfv"
	},
	{
		suffix: "vfs.cloud9.ap-northeast-3.amazonaws.com",
		reversed: "moc.swanozama.3-tsaehtron-pa.9duolc.sfv"
	},
	{
		suffix: "vfs.cloud9.ap-south-1.amazonaws.com",
		reversed: "moc.swanozama.1-htuos-pa.9duolc.sfv"
	},
	{
		suffix: "vfs.cloud9.ap-southeast-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsaehtuos-pa.9duolc.sfv"
	},
	{
		suffix: "vfs.cloud9.ap-southeast-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsaehtuos-pa.9duolc.sfv"
	},
	{
		suffix: "vfs.cloud9.ca-central-1.amazonaws.com",
		reversed: "moc.swanozama.1-lartnec-ac.9duolc.sfv"
	},
	{
		suffix: "vfs.cloud9.eu-central-1.amazonaws.com",
		reversed: "moc.swanozama.1-lartnec-ue.9duolc.sfv"
	},
	{
		suffix: "vfs.cloud9.eu-north-1.amazonaws.com",
		reversed: "moc.swanozama.1-htron-ue.9duolc.sfv"
	},
	{
		suffix: "vfs.cloud9.eu-south-1.amazonaws.com",
		reversed: "moc.swanozama.1-htuos-ue.9duolc.sfv"
	},
	{
		suffix: "vfs.cloud9.eu-west-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsew-ue.9duolc.sfv"
	},
	{
		suffix: "vfs.cloud9.eu-west-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsew-ue.9duolc.sfv"
	},
	{
		suffix: "vfs.cloud9.eu-west-3.amazonaws.com",
		reversed: "moc.swanozama.3-tsew-ue.9duolc.sfv"
	},
	{
		suffix: "vfs.cloud9.me-south-1.amazonaws.com",
		reversed: "moc.swanozama.1-htuos-em.9duolc.sfv"
	},
	{
		suffix: "vfs.cloud9.sa-east-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsae-as.9duolc.sfv"
	},
	{
		suffix: "vfs.cloud9.us-east-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsae-su.9duolc.sfv"
	},
	{
		suffix: "vfs.cloud9.us-east-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsae-su.9duolc.sfv"
	},
	{
		suffix: "vfs.cloud9.us-west-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsew-su.9duolc.sfv"
	},
	{
		suffix: "vfs.cloud9.us-west-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsew-su.9duolc.sfv"
	},
	{
		suffix: "vg",
		reversed: "gv"
	},
	{
		suffix: "vgs.no",
		reversed: "on.sgv"
	},
	{
		suffix: "vi",
		reversed: "iv"
	},
	{
		suffix: "vi.it",
		reversed: "ti.iv"
	},
	{
		suffix: "vi.us",
		reversed: "su.iv"
	},
	{
		suffix: "viajes",
		reversed: "sejaiv"
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
		suffix: "vic.au",
		reversed: "ua.civ"
	},
	{
		suffix: "vic.edu.au",
		reversed: "ua.ude.civ"
	},
	{
		suffix: "vic.gov.au",
		reversed: "ua.vog.civ"
	},
	{
		suffix: "vicenza.it",
		reversed: "ti.azneciv"
	},
	{
		suffix: "video",
		reversed: "oediv"
	},
	{
		suffix: "video.hu",
		reversed: "uh.oediv"
	},
	{
		suffix: "vig",
		reversed: "giv"
	},
	{
		suffix: "vik.no",
		reversed: "on.kiv"
	},
	{
		suffix: "viking",
		reversed: "gnikiv"
	},
	{
		suffix: "viking.museum",
		reversed: "muesum.gnikiv"
	},
	{
		suffix: "vikna.no",
		reversed: "on.ankiv"
	},
	{
		suffix: "village.museum",
		reversed: "muesum.egalliv"
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
		suffix: "vindafjord.no",
		reversed: "on.drojfadniv"
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
		suffix: "vip",
		reversed: "piv"
	},
	{
		suffix: "vip.jelastic.cloud",
		reversed: "duolc.citsalej.piv"
	},
	{
		suffix: "vipsinaapp.com",
		reversed: "moc.ppaanispiv"
	},
	{
		suffix: "virgin",
		reversed: "nigriv"
	},
	{
		suffix: "virginia.museum",
		reversed: "muesum.ainigriv"
	},
	{
		suffix: "virtual-user.de",
		reversed: "ed.resu-lautriv"
	},
	{
		suffix: "virtual.museum",
		reversed: "muesum.lautriv"
	},
	{
		suffix: "virtualserver.io",
		reversed: "oi.revreslautriv"
	},
	{
		suffix: "virtualuser.de",
		reversed: "ed.resulautriv"
	},
	{
		suffix: "virtuel.museum",
		reversed: "muesum.leutriv"
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
		suffix: "viterbo.it",
		reversed: "ti.obretiv"
	},
	{
		suffix: "viva",
		reversed: "aviv"
	},
	{
		suffix: "vivian.jp",
		reversed: "pj.naiviv"
	},
	{
		suffix: "vivo",
		reversed: "oviv"
	},
	{
		suffix: "vix.br",
		reversed: "rb.xiv"
	},
	{
		suffix: "vlaanderen",
		reversed: "nerednaalv"
	},
	{
		suffix: "vlaanderen.museum",
		reversed: "muesum.nerednaalv"
	},
	{
		suffix: "vladikavkaz.ru",
		reversed: "ur.zakvakidalv"
	},
	{
		suffix: "vladikavkaz.su",
		reversed: "us.zakvakidalv"
	},
	{
		suffix: "vladimir.ru",
		reversed: "ur.rimidalv"
	},
	{
		suffix: "vladimir.su",
		reversed: "us.rimidalv"
	},
	{
		suffix: "vlog.br",
		reversed: "rb.golv"
	},
	{
		suffix: "vm.bytemark.co.uk",
		reversed: "ku.oc.krametyb.mv"
	},
	{
		suffix: "vn",
		reversed: "nv"
	},
	{
		suffix: "vn.ua",
		reversed: "au.nv"
	},
	{
		suffix: "voagat.no",
		reversed: "on.tagaov"
	},
	{
		suffix: "vodka",
		reversed: "akdov"
	},
	{
		suffix: "volda.no",
		reversed: "on.adlov"
	},
	{
		suffix: "volkenkunde.museum",
		reversed: "muesum.ednukneklov"
	},
	{
		suffix: "volkswagen",
		reversed: "negawsklov"
	},
	{
		suffix: "vologda.su",
		reversed: "us.adgolov"
	},
	{
		suffix: "volvo",
		reversed: "ovlov"
	},
	{
		suffix: "volyn.ua",
		reversed: "au.nylov"
	},
	{
		suffix: "voorloper.cloud",
		reversed: "duolc.repolroov"
	},
	{
		suffix: "voss.no",
		reversed: "on.ssov"
	},
	{
		suffix: "vossevangen.no",
		reversed: "on.negnavessov"
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
		suffix: "vp4.me",
		reversed: "em.4pv"
	},
	{
		suffix: "vpndns.net",
		reversed: "ten.sndnpv"
	},
	{
		suffix: "vpnplus.to",
		reversed: "ot.sulpnpv"
	},
	{
		suffix: "vps-host.net",
		reversed: "ten.tsoh-spv"
	},
	{
		suffix: "vps.mcdir.ru",
		reversed: "ur.ridcm.spv"
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
		suffix: "vs.mythic-beasts.com",
		reversed: "moc.stsaeb-cihtym.sv"
	},
	{
		suffix: "vt.it",
		reversed: "ti.tv"
	},
	{
		suffix: "vt.us",
		reversed: "su.tv"
	},
	{
		suffix: "vu",
		reversed: "uv"
	},
	{
		suffix: "vuelos",
		reversed: "soleuv"
	},
	{
		suffix: "vv.it",
		reversed: "ti.vv"
	},
	{
		suffix: "vxl.sh",
		reversed: "hs.lxv"
	},
	{
		suffix: "várggát.no",
		reversed: "on.daqx-tggrv--nx"
	},
	{
		suffix: "vågan.no",
		reversed: "on.aoq-nagv--nx"
	},
	{
		suffix: "vågsøy.no",
		reversed: "on.j0aoq-ysgv--nx"
	},
	{
		suffix: "vågå.no",
		reversed: "on.baiy-gv--nx"
	},
	{
		suffix: "våler.hedmark.no",
		reversed: "on.kramdeh.aoq-relv--nx"
	},
	{
		suffix: "våler.østfold.no",
		reversed: "on.ax9-dlofts--nx.aoq-relv--nx"
	},
	{
		suffix: "værøy.no",
		reversed: "on.g5aly-yrv--nx"
	},
	{
		suffix: "w.bg",
		reversed: "gb.w"
	},
	{
		suffix: "w.se",
		reversed: "es.w"
	},
	{
		suffix: "wa.au",
		reversed: "ua.aw"
	},
	{
		suffix: "wa.edu.au",
		reversed: "ua.ude.aw"
	},
	{
		suffix: "wa.gov.au",
		reversed: "ua.vog.aw"
	},
	{
		suffix: "wa.us",
		reversed: "su.aw"
	},
	{
		suffix: "wada.nagano.jp",
		reversed: "pj.onagan.adaw"
	},
	{
		suffix: "wafflecell.com",
		reversed: "moc.llecelffaw"
	},
	{
		suffix: "wajiki.tokushima.jp",
		reversed: "pj.amihsukot.ikijaw"
	},
	{
		suffix: "wajima.ishikawa.jp",
		reversed: "pj.awakihsi.amijaw"
	},
	{
		suffix: "wakasa.fukui.jp",
		reversed: "pj.iukuf.asakaw"
	},
	{
		suffix: "wakasa.tottori.jp",
		reversed: "pj.irottot.asakaw"
	},
	{
		suffix: "wakayama.jp",
		reversed: "pj.amayakaw"
	},
	{
		suffix: "wakayama.wakayama.jp",
		reversed: "pj.amayakaw.amayakaw"
	},
	{
		suffix: "wake.okayama.jp",
		reversed: "pj.amayako.ekaw"
	},
	{
		suffix: "wakkanai.hokkaido.jp",
		reversed: "pj.odiakkoh.ianakkaw"
	},
	{
		suffix: "wakuya.miyagi.jp",
		reversed: "pj.igayim.ayukaw"
	},
	{
		suffix: "walbrzych.pl",
		reversed: "lp.hcyzrblaw"
	},
	{
		suffix: "wales",
		reversed: "selaw"
	},
	{
		suffix: "wales.museum",
		reversed: "muesum.selaw"
	},
	{
		suffix: "wallonie.museum",
		reversed: "muesum.einollaw"
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
		suffix: "wanouchi.gifu.jp",
		reversed: "pj.ufig.ihcuonaw"
	},
	{
		suffix: "war.museum",
		reversed: "muesum.raw"
	},
	{
		suffix: "warabi.saitama.jp",
		reversed: "pj.amatias.ibaraw"
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
		suffix: "washingtondc.museum",
		reversed: "muesum.cdnotgnihsaw"
	},
	{
		suffix: "washtenaw.mi.us",
		reversed: "su.im.wanethsaw"
	},
	{
		suffix: "wassamu.hokkaido.jp",
		reversed: "pj.odiakkoh.umassaw"
	},
	{
		suffix: "watarai.mie.jp",
		reversed: "pj.eim.iarataw"
	},
	{
		suffix: "watari.miyagi.jp",
		reversed: "pj.igayim.irataw"
	},
	{
		suffix: "watch",
		reversed: "hctaw"
	},
	{
		suffix: "watch-and-clock.museum",
		reversed: "muesum.kcolc-dna-hctaw"
	},
	{
		suffix: "watchandclock.museum",
		reversed: "muesum.kcolcdnahctaw"
	},
	{
		suffix: "watches",
		reversed: "sehctaw"
	},
	{
		suffix: "watson.jp",
		reversed: "pj.nostaw"
	},
	{
		suffix: "waw.pl",
		reversed: "lp.waw"
	},
	{
		suffix: "wazuka.kyoto.jp",
		reversed: "pj.otoyk.akuzaw"
	},
	{
		suffix: "we.bs",
		reversed: "sb.ew"
	},
	{
		suffix: "we.tc",
		reversed: "ct.ew"
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
		suffix: "web.app",
		reversed: "ppa.bew"
	},
	{
		suffix: "web.bo",
		reversed: "ob.bew"
	},
	{
		suffix: "web.co",
		reversed: "oc.bew"
	},
	{
		suffix: "web.do",
		reversed: "od.bew"
	},
	{
		suffix: "web.gu",
		reversed: "ug.bew"
	},
	{
		suffix: "web.id",
		reversed: "di.bew"
	},
	{
		suffix: "web.in",
		reversed: "ni.bew"
	},
	{
		suffix: "web.lk",
		reversed: "kl.bew"
	},
	{
		suffix: "web.nf",
		reversed: "fn.bew"
	},
	{
		suffix: "web.ni",
		reversed: "in.bew"
	},
	{
		suffix: "web.pk",
		reversed: "kp.bew"
	},
	{
		suffix: "web.tj",
		reversed: "jt.bew"
	},
	{
		suffix: "web.tr",
		reversed: "rt.bew"
	},
	{
		suffix: "web.ve",
		reversed: "ev.bew"
	},
	{
		suffix: "web.za",
		reversed: "az.bew"
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
		suffix: "webhop.biz",
		reversed: "zib.pohbew"
	},
	{
		suffix: "webhop.info",
		reversed: "ofni.pohbew"
	},
	{
		suffix: "webhop.me",
		reversed: "em.pohbew"
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
		suffix: "webhosting.be",
		reversed: "eb.gnitsohbew"
	},
	{
		suffix: "weblike.jp",
		reversed: "pj.ekilbew"
	},
	{
		suffix: "webredirect.org",
		reversed: "gro.tceriderbew"
	},
	{
		suffix: "website",
		reversed: "etisbew"
	},
	{
		suffix: "website.yandexcloud.net",
		reversed: "ten.duolcxednay.etisbew"
	},
	{
		suffix: "webspace.rocks",
		reversed: "skcor.ecapsbew"
	},
	{
		suffix: "webthings.io",
		reversed: "oi.sgnihtbew"
	},
	{
		suffix: "webview-assets.cloud9.af-south-1.amazonaws.com",
		reversed: "moc.swanozama.1-htuos-fa.9duolc.stessa-weivbew"
	},
	{
		suffix: "webview-assets.cloud9.ap-east-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsae-pa.9duolc.stessa-weivbew"
	},
	{
		suffix: "webview-assets.cloud9.ap-northeast-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsaehtron-pa.9duolc.stessa-weivbew"
	},
	{
		suffix: "webview-assets.cloud9.ap-northeast-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsaehtron-pa.9duolc.stessa-weivbew"
	},
	{
		suffix: "webview-assets.cloud9.ap-northeast-3.amazonaws.com",
		reversed: "moc.swanozama.3-tsaehtron-pa.9duolc.stessa-weivbew"
	},
	{
		suffix: "webview-assets.cloud9.ap-south-1.amazonaws.com",
		reversed: "moc.swanozama.1-htuos-pa.9duolc.stessa-weivbew"
	},
	{
		suffix: "webview-assets.cloud9.ap-southeast-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsaehtuos-pa.9duolc.stessa-weivbew"
	},
	{
		suffix: "webview-assets.cloud9.ap-southeast-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsaehtuos-pa.9duolc.stessa-weivbew"
	},
	{
		suffix: "webview-assets.cloud9.ca-central-1.amazonaws.com",
		reversed: "moc.swanozama.1-lartnec-ac.9duolc.stessa-weivbew"
	},
	{
		suffix: "webview-assets.cloud9.eu-central-1.amazonaws.com",
		reversed: "moc.swanozama.1-lartnec-ue.9duolc.stessa-weivbew"
	},
	{
		suffix: "webview-assets.cloud9.eu-north-1.amazonaws.com",
		reversed: "moc.swanozama.1-htron-ue.9duolc.stessa-weivbew"
	},
	{
		suffix: "webview-assets.cloud9.eu-south-1.amazonaws.com",
		reversed: "moc.swanozama.1-htuos-ue.9duolc.stessa-weivbew"
	},
	{
		suffix: "webview-assets.cloud9.eu-west-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsew-ue.9duolc.stessa-weivbew"
	},
	{
		suffix: "webview-assets.cloud9.eu-west-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsew-ue.9duolc.stessa-weivbew"
	},
	{
		suffix: "webview-assets.cloud9.eu-west-3.amazonaws.com",
		reversed: "moc.swanozama.3-tsew-ue.9duolc.stessa-weivbew"
	},
	{
		suffix: "webview-assets.cloud9.me-south-1.amazonaws.com",
		reversed: "moc.swanozama.1-htuos-em.9duolc.stessa-weivbew"
	},
	{
		suffix: "webview-assets.cloud9.sa-east-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsae-as.9duolc.stessa-weivbew"
	},
	{
		suffix: "webview-assets.cloud9.us-east-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsae-su.9duolc.stessa-weivbew"
	},
	{
		suffix: "webview-assets.cloud9.us-east-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsae-su.9duolc.stessa-weivbew"
	},
	{
		suffix: "webview-assets.cloud9.us-west-1.amazonaws.com",
		reversed: "moc.swanozama.1-tsew-su.9duolc.stessa-weivbew"
	},
	{
		suffix: "webview-assets.cloud9.us-west-2.amazonaws.com",
		reversed: "moc.swanozama.2-tsew-su.9duolc.stessa-weivbew"
	},
	{
		suffix: "wedding",
		reversed: "gniddew"
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
		suffix: "weeklylottery.org.uk",
		reversed: "ku.gro.yrettolylkeew"
	},
	{
		suffix: "wegrow.pl",
		reversed: "lp.worgew"
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
		suffix: "wellbeingzone.co.uk",
		reversed: "ku.oc.enozgniebllew"
	},
	{
		suffix: "wellbeingzone.eu",
		reversed: "ue.enozgniebllew"
	},
	{
		suffix: "west1-us.cloudjiffy.net",
		reversed: "ten.yffijduolc.su-1tsew"
	},
	{
		suffix: "western.museum",
		reversed: "muesum.nretsew"
	},
	{
		suffix: "westeurope.azurestaticapps.net",
		reversed: "ten.sppacitatseruza.eporuetsew"
	},
	{
		suffix: "westfalen.museum",
		reversed: "muesum.nelaftsew"
	},
	{
		suffix: "westus2.azurestaticapps.net",
		reversed: "ten.sppacitatseruza.2sutsew"
	},
	{
		suffix: "wf",
		reversed: "fw"
	},
	{
		suffix: "whaling.museum",
		reversed: "muesum.gnilahw"
	},
	{
		suffix: "whitesnow.jp",
		reversed: "pj.wonsetihw"
	},
	{
		suffix: "whm.fr-par.scw.cloud",
		reversed: "duolc.wcs.rap-rf.mhw"
	},
	{
		suffix: "whm.nl-ams.scw.cloud",
		reversed: "duolc.wcs.sma-ln.mhw"
	},
	{
		suffix: "whoswho",
		reversed: "ohwsohw"
	},
	{
		suffix: "wi.us",
		reversed: "su.iw"
	},
	{
		suffix: "wielun.pl",
		reversed: "lp.nuleiw"
	},
	{
		suffix: "wien",
		reversed: "neiw"
	},
	{
		suffix: "wien.funkfeuer.at",
		reversed: "ta.reuefknuf.neiw"
	},
	{
		suffix: "wif.gov.pl",
		reversed: "lp.vog.fiw"
	},
	{
		suffix: "wiih.gov.pl",
		reversed: "lp.vog.hiiw"
	},
	{
		suffix: "wiki",
		reversed: "ikiw"
	},
	{
		suffix: "wiki.bo",
		reversed: "ob.ikiw"
	},
	{
		suffix: "wiki.br",
		reversed: "rb.ikiw"
	},
	{
		suffix: "wildlife.museum",
		reversed: "muesum.efildliw"
	},
	{
		suffix: "williamhill",
		reversed: "llihmailliw"
	},
	{
		suffix: "williamsburg.museum",
		reversed: "muesum.grubsmailliw"
	},
	{
		suffix: "win",
		reversed: "niw"
	},
	{
		suffix: "winb.gov.pl",
		reversed: "lp.vog.bniw"
	},
	{
		suffix: "windmill.museum",
		reversed: "muesum.llimdniw"
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
		suffix: "wios.gov.pl",
		reversed: "lp.vog.soiw"
	},
	{
		suffix: "witd.gov.pl",
		reversed: "lp.vog.dtiw"
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
		suffix: "wiw.gov.pl",
		reversed: "lp.vog.wiw"
	},
	{
		suffix: "wixsite.com",
		reversed: "moc.etisxiw"
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
		suffix: "wmcloud.org",
		reversed: "gro.duolcmw"
	},
	{
		suffix: "wme",
		reversed: "emw"
	},
	{
		suffix: "wmflabs.org",
		reversed: "gro.sbalfmw"
	},
	{
		suffix: "wnext.app",
		reversed: "ppa.txenw"
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
		suffix: "wolterskluwer",
		reversed: "rewulksretlow"
	},
	{
		suffix: "woltlab-demo.com",
		reversed: "moc.omed-baltlow"
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
		suffix: "workers.dev",
		reversed: "ved.srekrow"
	},
	{
		suffix: "workinggroup.aero",
		reversed: "orea.puorggnikrow"
	},
	{
		suffix: "workisboring.com",
		reversed: "moc.gnirobsikrow"
	},
	{
		suffix: "works",
		reversed: "skrow"
	},
	{
		suffix: "works.aero",
		reversed: "orea.skrow"
	},
	{
		suffix: "workshop.museum",
		reversed: "muesum.pohskrow"
	},
	{
		suffix: "world",
		reversed: "dlrow"
	},
	{
		suffix: "worse-than.tv",
		reversed: "vt.naht-esrow"
	},
	{
		suffix: "wow",
		reversed: "wow"
	},
	{
		suffix: "wpdevcloud.com",
		reversed: "moc.duolcvedpw"
	},
	{
		suffix: "wpenginepowered.com",
		reversed: "moc.derewopenignepw"
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
		suffix: "wpmudev.host",
		reversed: "tsoh.vedumpw"
	},
	{
		suffix: "writesthisblog.com",
		reversed: "moc.golbsihtsetirw"
	},
	{
		suffix: "wroc.pl",
		reversed: "lp.corw"
	},
	{
		suffix: "wroclaw.pl",
		reversed: "lp.walcorw"
	},
	{
		suffix: "ws",
		reversed: "sw"
	},
	{
		suffix: "ws.na",
		reversed: "an.sw"
	},
	{
		suffix: "wsa.gov.pl",
		reversed: "lp.vog.asw"
	},
	{
		suffix: "wskr.gov.pl",
		reversed: "lp.vog.rksw"
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
		suffix: "wuoz.gov.pl",
		reversed: "lp.vog.zouw"
	},
	{
		suffix: "wv.us",
		reversed: "su.vw"
	},
	{
		suffix: "www.ro",
		reversed: "or.www"
	},
	{
		suffix: "wy.us",
		reversed: "su.yw"
	},
	{
		suffix: "wzmiuw.gov.pl",
		reversed: "lp.vog.wuimzw"
	},
	{
		suffix: "x.bg",
		reversed: "gb.x"
	},
	{
		suffix: "x.mythic-beasts.com",
		reversed: "moc.stsaeb-cihtym.x"
	},
	{
		suffix: "x.se",
		reversed: "es.x"
	},
	{
		suffix: "x443.pw",
		reversed: "wp.344x"
	},
	{
		suffix: "xbox",
		reversed: "xobx"
	},
	{
		suffix: "xen.prgmr.com",
		reversed: "moc.rmgrp.nex"
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
		suffix: "xj.cn",
		reversed: "nc.jx"
	},
	{
		suffix: "xnbay.com",
		reversed: "moc.yabnx"
	},
	{
		suffix: "xs4all.space",
		reversed: "ecaps.lla4sx"
	},
	{
		suffix: "xx.gl",
		reversed: "lg.xx"
	},
	{
		suffix: "xxx",
		reversed: "xxx"
	},
	{
		suffix: "xy.ax",
		reversed: "xa.yx"
	},
	{
		suffix: "xyz",
		reversed: "zyx"
	},
	{
		suffix: "xz.cn",
		reversed: "nc.zx"
	},
	{
		suffix: "y.bg",
		reversed: "gb.y"
	},
	{
		suffix: "y.se",
		reversed: "es.y"
	},
	{
		suffix: "yabu.hyogo.jp",
		reversed: "pj.ogoyh.ubay"
	},
	{
		suffix: "yabuki.fukushima.jp",
		reversed: "pj.amihsukuf.ikubay"
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
		suffix: "yachiyo.ibaraki.jp",
		reversed: "pj.ikarabi.oyihcay"
	},
	{
		suffix: "yachts",
		reversed: "sthcay"
	},
	{
		suffix: "yaese.okinawa.jp",
		reversed: "pj.awaniko.eseay"
	},
	{
		suffix: "yahaba.iwate.jp",
		reversed: "pj.etawi.abahay"
	},
	{
		suffix: "yahiko.niigata.jp",
		reversed: "pj.atagiin.okihay"
	},
	{
		suffix: "yahoo",
		reversed: "oohay"
	},
	{
		suffix: "yaita.tochigi.jp",
		reversed: "pj.igihcot.atiay"
	},
	{
		suffix: "yaizu.shizuoka.jp",
		reversed: "pj.akouzihs.uziay"
	},
	{
		suffix: "yakage.okayama.jp",
		reversed: "pj.amayako.egakay"
	},
	{
		suffix: "yakumo.hokkaido.jp",
		reversed: "pj.odiakkoh.omukay"
	},
	{
		suffix: "yakumo.shimane.jp",
		reversed: "pj.enamihs.omukay"
	},
	{
		suffix: "yali.mythic-beasts.com",
		reversed: "moc.stsaeb-cihtym.ilay"
	},
	{
		suffix: "yalta.ua",
		reversed: "au.atlay"
	},
	{
		suffix: "yamada.fukuoka.jp",
		reversed: "pj.akoukuf.adamay"
	},
	{
		suffix: "yamada.iwate.jp",
		reversed: "pj.etawi.adamay"
	},
	{
		suffix: "yamada.toyama.jp",
		reversed: "pj.amayot.adamay"
	},
	{
		suffix: "yamaga.kumamoto.jp",
		reversed: "pj.otomamuk.agamay"
	},
	{
		suffix: "yamagata.gifu.jp",
		reversed: "pj.ufig.atagamay"
	},
	{
		suffix: "yamagata.ibaraki.jp",
		reversed: "pj.ikarabi.atagamay"
	},
	{
		suffix: "yamagata.jp",
		reversed: "pj.atagamay"
	},
	{
		suffix: "yamagata.nagano.jp",
		reversed: "pj.onagan.atagamay"
	},
	{
		suffix: "yamagata.yamagata.jp",
		reversed: "pj.atagamay.atagamay"
	},
	{
		suffix: "yamaguchi.jp",
		reversed: "pj.ihcugamay"
	},
	{
		suffix: "yamakita.kanagawa.jp",
		reversed: "pj.awaganak.atikamay"
	},
	{
		suffix: "yamamoto.miyagi.jp",
		reversed: "pj.igayim.otomamay"
	},
	{
		suffix: "yamanakako.yamanashi.jp",
		reversed: "pj.ihsanamay.okakanamay"
	},
	{
		suffix: "yamanashi.jp",
		reversed: "pj.ihsanamay"
	},
	{
		suffix: "yamanashi.yamanashi.jp",
		reversed: "pj.ihsanamay.ihsanamay"
	},
	{
		suffix: "yamanobe.yamagata.jp",
		reversed: "pj.atagamay.ebonamay"
	},
	{
		suffix: "yamanouchi.nagano.jp",
		reversed: "pj.onagan.ihcuonamay"
	},
	{
		suffix: "yamashina.kyoto.jp",
		reversed: "pj.otoyk.anihsamay"
	},
	{
		suffix: "yamato.fukushima.jp",
		reversed: "pj.amihsukuf.otamay"
	},
	{
		suffix: "yamato.kanagawa.jp",
		reversed: "pj.awaganak.otamay"
	},
	{
		suffix: "yamato.kumamoto.jp",
		reversed: "pj.otomamuk.otamay"
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
		suffix: "yamatsuri.fukushima.jp",
		reversed: "pj.amihsukuf.irustamay"
	},
	{
		suffix: "yamaxun",
		reversed: "nuxamay"
	},
	{
		suffix: "yamazoe.nara.jp",
		reversed: "pj.aran.eozamay"
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
		suffix: "yanaizu.fukushima.jp",
		reversed: "pj.amihsukuf.uzianay"
	},
	{
		suffix: "yandex",
		reversed: "xednay"
	},
	{
		suffix: "yandexcloud.net",
		reversed: "ten.duolcxednay"
	},
	{
		suffix: "yao.osaka.jp",
		reversed: "pj.akaso.oay"
	},
	{
		suffix: "yaotsu.gifu.jp",
		reversed: "pj.ufig.ustoay"
	},
	{
		suffix: "yasaka.nagano.jp",
		reversed: "pj.onagan.akasay"
	},
	{
		suffix: "yashio.saitama.jp",
		reversed: "pj.amatias.oihsay"
	},
	{
		suffix: "yashiro.hyogo.jp",
		reversed: "pj.ogoyh.orihsay"
	},
	{
		suffix: "yasu.shiga.jp",
		reversed: "pj.agihs.usay"
	},
	{
		suffix: "yasuda.kochi.jp",
		reversed: "pj.ihcok.adusay"
	},
	{
		suffix: "yasugi.shimane.jp",
		reversed: "pj.enamihs.igusay"
	},
	{
		suffix: "yasuoka.nagano.jp",
		reversed: "pj.onagan.akousay"
	},
	{
		suffix: "yatomi.aichi.jp",
		reversed: "pj.ihcia.imotay"
	},
	{
		suffix: "yatsuka.shimane.jp",
		reversed: "pj.enamihs.akustay"
	},
	{
		suffix: "yatsushiro.kumamoto.jp",
		reversed: "pj.otomamuk.orihsustay"
	},
	{
		suffix: "yawara.ibaraki.jp",
		reversed: "pj.ikarabi.araway"
	},
	{
		suffix: "yawata.kyoto.jp",
		reversed: "pj.otoyk.ataway"
	},
	{
		suffix: "yawatahama.ehime.jp",
		reversed: "pj.emihe.amahataway"
	},
	{
		suffix: "yazu.tottori.jp",
		reversed: "pj.irottot.uzay"
	},
	{
		suffix: "ybo.faith",
		reversed: "htiaf.oby"
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
		suffix: "ye",
		reversed: "ey"
	},
	{
		suffix: "yk.ca",
		reversed: "ac.ky"
	},
	{
		suffix: "yn.cn",
		reversed: "nc.ny"
	},
	{
		suffix: "ynh.fr",
		reversed: "rf.hny"
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
		suffix: "yoichi.hokkaido.jp",
		reversed: "pj.odiakkoh.ihcioy"
	},
	{
		suffix: "yoita.niigata.jp",
		reversed: "pj.atagiin.atioy"
	},
	{
		suffix: "yoka.hyogo.jp",
		reversed: "pj.ogoyh.akoy"
	},
	{
		suffix: "yokaichiba.chiba.jp",
		reversed: "pj.abihc.abihciakoy"
	},
	{
		suffix: "yokawa.hyogo.jp",
		reversed: "pj.ogoyh.awakoy"
	},
	{
		suffix: "yokkaichi.mie.jp",
		reversed: "pj.eim.ihciakkoy"
	},
	{
		suffix: "yokohama",
		reversed: "amahokoy"
	},
	{
		suffix: "yokoshibahikari.chiba.jp",
		reversed: "pj.abihc.irakihabihsokoy"
	},
	{
		suffix: "yokosuka.kanagawa.jp",
		reversed: "pj.awaganak.akusokoy"
	},
	{
		suffix: "yokote.akita.jp",
		reversed: "pj.atika.etokoy"
	},
	{
		suffix: "yokoze.saitama.jp",
		reversed: "pj.amatias.ezokoy"
	},
	{
		suffix: "yolasite.com",
		reversed: "moc.etisaloy"
	},
	{
		suffix: "yombo.me",
		reversed: "em.obmoy"
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
		suffix: "yonago.tottori.jp",
		reversed: "pj.irottot.oganoy"
	},
	{
		suffix: "yonaguni.okinawa.jp",
		reversed: "pj.awaniko.inuganoy"
	},
	{
		suffix: "yonezawa.yamagata.jp",
		reversed: "pj.atagamay.awazenoy"
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
		suffix: "york.museum",
		reversed: "muesum.kroy"
	},
	{
		suffix: "yorkshire.museum",
		reversed: "muesum.erihskroy"
	},
	{
		suffix: "yoro.gifu.jp",
		reversed: "pj.ufig.oroy"
	},
	{
		suffix: "yosemite.museum",
		reversed: "muesum.etimesoy"
	},
	{
		suffix: "yoshida.saitama.jp",
		reversed: "pj.amatias.adihsoy"
	},
	{
		suffix: "yoshida.shizuoka.jp",
		reversed: "pj.akouzihs.adihsoy"
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
		suffix: "yoshino.nara.jp",
		reversed: "pj.aran.onihsoy"
	},
	{
		suffix: "yoshinogari.saga.jp",
		reversed: "pj.agas.iragonihsoy"
	},
	{
		suffix: "yoshioka.gunma.jp",
		reversed: "pj.amnug.akoihsoy"
	},
	{
		suffix: "yotsukaido.chiba.jp",
		reversed: "pj.abihc.odiakustoy"
	},
	{
		suffix: "you",
		reversed: "uoy"
	},
	{
		suffix: "youth.museum",
		reversed: "muesum.htuoy"
	},
	{
		suffix: "youtube",
		reversed: "ebutuoy"
	},
	{
		suffix: "yt",
		reversed: "ty"
	},
	{
		suffix: "yuasa.wakayama.jp",
		reversed: "pj.amayakaw.asauy"
	},
	{
		suffix: "yufu.oita.jp",
		reversed: "pj.atio.ufuy"
	},
	{
		suffix: "yugawa.fukushima.jp",
		reversed: "pj.amihsukuf.awaguy"
	},
	{
		suffix: "yugawara.kanagawa.jp",
		reversed: "pj.awaganak.arawaguy"
	},
	{
		suffix: "yuki.ibaraki.jp",
		reversed: "pj.ikarabi.ikuy"
	},
	{
		suffix: "yukuhashi.fukuoka.jp",
		reversed: "pj.akoukuf.ihsahukuy"
	},
	{
		suffix: "yun",
		reversed: "nuy"
	},
	{
		suffix: "yura.wakayama.jp",
		reversed: "pj.amayakaw.aruy"
	},
	{
		suffix: "yurihonjo.akita.jp",
		reversed: "pj.atika.ojnohiruy"
	},
	{
		suffix: "yusuhara.kochi.jp",
		reversed: "pj.ihcok.arahusuy"
	},
	{
		suffix: "yusui.kagoshima.jp",
		reversed: "pj.amihsogak.iusuy"
	},
	{
		suffix: "yuu.yamaguchi.jp",
		reversed: "pj.ihcugamay.uuy"
	},
	{
		suffix: "yuza.yamagata.jp",
		reversed: "pj.atagamay.azuy"
	},
	{
		suffix: "yuzawa.niigata.jp",
		reversed: "pj.atagiin.awazuy"
	},
	{
		suffix: "z.bg",
		reversed: "gb.z"
	},
	{
		suffix: "z.se",
		reversed: "es.z"
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
		suffix: "za.net",
		reversed: "ten.az"
	},
	{
		suffix: "za.org",
		reversed: "gro.az"
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
		suffix: "zakopane.pl",
		reversed: "lp.enapokaz"
	},
	{
		suffix: "zama.kanagawa.jp",
		reversed: "pj.awaganak.amaz"
	},
	{
		suffix: "zamami.okinawa.jp",
		reversed: "pj.awaniko.imamaz"
	},
	{
		suffix: "zao.miyagi.jp",
		reversed: "pj.igayim.oaz"
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
		suffix: "zappos",
		reversed: "soppaz"
	},
	{
		suffix: "zapto.org",
		reversed: "gro.otpaz"
	},
	{
		suffix: "zapto.xyz",
		reversed: "zyx.otpaz"
	},
	{
		suffix: "zara",
		reversed: "araz"
	},
	{
		suffix: "zarow.pl",
		reversed: "lp.woraz"
	},
	{
		suffix: "zentsuji.kagawa.jp",
		reversed: "pj.awagak.ijustnez"
	},
	{
		suffix: "zero",
		reversed: "orez"
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
		suffix: "zhitomir.ua",
		reversed: "au.rimotihz"
	},
	{
		suffix: "zhytomyr.ua",
		reversed: "au.rymotyhz"
	},
	{
		suffix: "zip",
		reversed: "piz"
	},
	{
		suffix: "zj.cn",
		reversed: "nc.jz"
	},
	{
		suffix: "zlg.br",
		reversed: "rb.glz"
	},
	{
		suffix: "zm",
		reversed: "mz"
	},
	{
		suffix: "zombie.jp",
		reversed: "pj.eibmoz"
	},
	{
		suffix: "zone",
		reversed: "enoz"
	},
	{
		suffix: "zoological.museum",
		reversed: "muesum.lacigolooz"
	},
	{
		suffix: "zoology.museum",
		reversed: "muesum.ygolooz"
	},
	{
		suffix: "zp.gov.pl",
		reversed: "lp.vog.pz"
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
		suffix: "zuerich",
		reversed: "hcireuz"
	},
	{
		suffix: "zushi.kanagawa.jp",
		reversed: "pj.awaganak.ihsuz"
	},
	{
		suffix: "zw",
		reversed: "wz"
	},
	{
		suffix: "ákŋoluokta.no",
		reversed: "on.h75ay7-atkoulok--nx"
	},
	{
		suffix: "álaheadju.no",
		reversed: "on.ay7-ujdaehal--nx"
	},
	{
		suffix: "áltá.no",
		reversed: "on.cail-tl--nx"
	},
	{
		suffix: "åfjord.no",
		reversed: "on.arl-drojf--nx"
	},
	{
		suffix: "åkrehamn.no",
		reversed: "on.axd-nmaherk--nx"
	},
	{
		suffix: "ål.no",
		reversed: "on.af1-l--nx"
	},
	{
		suffix: "ålesund.no",
		reversed: "on.auh-dnusel--nx"
	},
	{
		suffix: "ålgård.no",
		reversed: "on.caop-drgl--nx"
	},
	{
		suffix: "åmli.no",
		reversed: "on.alt-ilm--nx"
	},
	{
		suffix: "åmot.no",
		reversed: "on.alt-tom--nx"
	},
	{
		suffix: "årdal.no",
		reversed: "on.aop-ladr--nx"
	},
	{
		suffix: "ås.no",
		reversed: "on.af1-s--nx"
	},
	{
		suffix: "åseral.no",
		reversed: "on.arl-lares--nx"
	},
	{
		suffix: "åsnes.no",
		reversed: "on.aop-sens--nx"
	},
	{
		suffix: "øksnes.no",
		reversed: "on.auu-sensk--nx"
	},
	{
		suffix: "ørland.no",
		reversed: "on.auu-dnalr--nx"
	},
	{
		suffix: "ørskog.no",
		reversed: "on.auu-goksr--nx"
	},
	{
		suffix: "ørsta.no",
		reversed: "on.arf-atsr--nx"
	},
	{
		suffix: "østre-toten.no",
		reversed: "on.bcz-netot-erts--nx"
	},
	{
		suffix: "øvre-eiker.no",
		reversed: "on.a8k-rekie-erv--nx"
	},
	{
		suffix: "øyer.no",
		reversed: "on.anz-rey--nx"
	},
	{
		suffix: "øygarden.no",
		reversed: "on.a1p-nedragy--nx"
	},
	{
		suffix: "øystre-slidre.no",
		reversed: "on.bju-erdils-ertsy--nx"
	},
	{
		suffix: "čáhcesuolo.no",
		reversed: "on.b53ay7-olousech--nx"
	},
	{
		suffix: "ελ",
		reversed: "maxq--nx"
	},
	{
		suffix: "ευ",
		reversed: "a6axq--nx"
	},
	{
		suffix: "ак.срб",
		reversed: "ca3a09--nx.ua08--nx"
	},
	{
		suffix: "бг",
		reversed: "ea09--nx"
	},
	{
		suffix: "бел",
		reversed: "sia09--nx"
	},
	{
		suffix: "биз.рус",
		reversed: "fca1p--nx.cma09--nx"
	},
	{
		suffix: "дети",
		reversed: "b3jca1d--nx"
	},
	{
		suffix: "ею",
		reversed: "c4a1e--nx"
	},
	{
		suffix: "иком.museum",
		reversed: "muesum.hgea1h--nx"
	},
	{
		suffix: "католик",
		reversed: "a1rdceqa08--nx"
	},
	{
		suffix: "ком",
		reversed: "fea1j--nx"
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
		suffix: "мкд",
		reversed: "fla1d--nx"
	},
	{
		suffix: "мон",
		reversed: "cca1l--nx"
	},
	{
		suffix: "москва",
		reversed: "skhxda08--nx"
	},
	{
		suffix: "мск.рус",
		reversed: "fca1p--nx.pda1j--nx"
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
		suffix: "онлайн",
		reversed: "bdhesa08--nx"
	},
	{
		suffix: "орг",
		reversed: "gva1c--nx"
	},
	{
		suffix: "орг.рус",
		reversed: "fca1p--nx.gva1c--nx"
	},
	{
		suffix: "орг.срб",
		reversed: "ca3a09--nx.gva1c--nx"
	},
	{
		suffix: "пр.срб",
		reversed: "ca3a09--nx.ca1o--nx"
	},
	{
		suffix: "рус",
		reversed: "fca1p--nx"
	},
	{
		suffix: "рф",
		reversed: "ia1p--nx"
	},
	{
		suffix: "сайт",
		reversed: "gwsa08--nx"
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
		suffix: "срб",
		reversed: "ca3a09--nx"
	},
	{
		suffix: "укр",
		reversed: "hma1j--nx"
	},
	{
		suffix: "упр.срб",
		reversed: "ca3a09--nx.hca1o--nx"
	},
	{
		suffix: "я.рус",
		reversed: "fca1p--nx.a14--nx"
	},
	{
		suffix: "қаз",
		reversed: "a12oa08--nx"
	},
	{
		suffix: "հայ",
		reversed: "qa3a9y--nx"
	},
	{
		suffix: "אקדמיה.ישראל",
		reversed: "ec0krbd4--nx.c6ytdgbd4--nx"
	},
	{
		suffix: "ירושלים.museum",
		reversed: "muesum.id6glbhbd9--nx"
	},
	{
		suffix: "ישוב.ישראל",
		reversed: "ec0krbd4--nx.d8lhbd5--nx"
	},
	{
		suffix: "ישראל",
		reversed: "ec0krbd4--nx"
	},
	{
		suffix: "ממשל.ישראל",
		reversed: "ec0krbd4--nx.b8adbeh--nx"
	},
	{
		suffix: "צהל.ישראל",
		reversed: "ec0krbd4--nx.a2qbd8--nx"
	},
	{
		suffix: "קום",
		reversed: "a2qbd9--nx"
	},
	{
		suffix: "ابوظبي",
		reversed: "odzd7acbgm--nx"
	},
	{
		suffix: "اتصالات",
		reversed: "fvd7ckaabgm--nx"
	},
	{
		suffix: "ارامكو",
		reversed: "tje3a3abgm--nx"
	},
	{
		suffix: "الاردن",
		reversed: "apg7hyabgm--nx"
	},
	{
		suffix: "البحرين",
		reversed: "a1apg6qpcbgm--nx"
	},
	{
		suffix: "الجزائر",
		reversed: "j8da1tabbgl--nx"
	},
	{
		suffix: "السعودية",
		reversed: "ra4d5a4prebgm--nx"
	},
	{
		suffix: "السعوديه",
		reversed: "rfavc7ylqbgm--nx"
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
		suffix: "العليان",
		reversed: "a0nbb0c7abgm--nx"
	},
	{
		suffix: "المغرب",
		reversed: "gcza9a0cbgm--nx"
	},
	{
		suffix: "اليمن",
		reversed: "sedd2bgm--nx"
	},
	{
		suffix: "امارات",
		reversed: "h8a7maabgm--nx"
	},
	{
		suffix: "ايران",
		reversed: "arf4a3abgm--nx"
	},
	{
		suffix: "ايران.ir",
		reversed: "ri.arf4a3abgm--nx"
	},
	{
		suffix: "ایران",
		reversed: "a61f4a3abgm--nx"
	},
	{
		suffix: "ایران.ir",
		reversed: "ri.a61f4a3abgm--nx"
	},
	{
		suffix: "بارت",
		reversed: "a1hbbgm--nx"
	},
	{
		suffix: "بازار",
		reversed: "db2babgm--nx"
	},
	{
		suffix: "بيتك",
		reversed: "a0e9ebgn--nx"
	},
	{
		suffix: "بھارت",
		reversed: "e17a1hbbgm--nx"
	},
	{
		suffix: "تونس",
		reversed: "hd0sbgp--nx"
	},
	{
		suffix: "سودان",
		reversed: "hf2lpbgm--nx"
	},
	{
		suffix: "سوريا",
		reversed: "lf8ftbgm--nx"
	},
	{
		suffix: "سورية",
		reversed: "lf8fpbgo--nx"
	},
	{
		suffix: "شبكة",
		reversed: "dza5cbgn--nx"
	},
	{
		suffix: "عراق",
		reversed: "b2xtbgm--nx"
	},
	{
		suffix: "عرب",
		reversed: "xrbgn--nx"
	},
	{
		suffix: "عمان",
		reversed: "fbwa9bgm--nx"
	},
	{
		suffix: "فلسطين",
		reversed: "xmma2ibgy--nx"
	},
	{
		suffix: "قطر",
		reversed: "a6lbgw--nx"
	},
	{
		suffix: "كاثوليك",
		reversed: "pxece4ibgm--nx"
	},
	{
		suffix: "كوم",
		reversed: "iebhf--nx"
	},
	{
		suffix: "مصر",
		reversed: "c1hbgw--nx"
	},
	{
		suffix: "مليسيا",
		reversed: "ba0dc4xbgm--nx"
	},
	{
		suffix: "موريتانيا",
		reversed: "drkjh3a1habgm--nx"
	},
	{
		suffix: "موقع",
		reversed: "mirbg4--nx"
	},
	{
		suffix: "همراه",
		reversed: "dhd3tbgm--nx"
	},
	{
		suffix: "پاكستان",
		reversed: "b00ave5a9iabgm--nx"
	},
	{
		suffix: "پاکستان",
		reversed: "j6pqgza9iabgm--nx"
	},
	{
		suffix: "ڀارت",
		reversed: "a28ugbgm--nx"
	},
	{
		suffix: "कॉम",
		reversed: "d3c4b11--nx"
	},
	{
		suffix: "नेट",
		reversed: "g7rb2c--nx"
	},
	{
		suffix: "भारत",
		reversed: "c9jrb2h--nx"
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
		suffix: "संगठन",
		reversed: "e2a6a1b6b1i--nx"
	},
	{
		suffix: "বাংলা",
		reversed: "cc0atf7b45--nx"
	},
	{
		suffix: "ভারত",
		reversed: "c9jrb54--nx"
	},
	{
		suffix: "ভাৰত",
		reversed: "lyc5rb54--nx"
	},
	{
		suffix: "ਭਾਰਤ",
		reversed: "c9jrb9s--nx"
	},
	{
		suffix: "ભારત",
		reversed: "c9jrceg--nx"
	},
	{
		suffix: "ଭାରତ",
		reversed: "c9jrch3--nx"
	},
	{
		suffix: "இந்தியா",
		reversed: "h0ee5a3ld2ckx--nx"
	},
	{
		suffix: "இலங்கை",
		reversed: "a2eyh3la2ckx--nx"
	},
	{
		suffix: "சிங்கப்பூர்",
		reversed: "dcg9a2g2b0ae0chclc--nx"
	},
	{
		suffix: "భారత్",
		reversed: "d3c9jrcpf--nx"
	},
	{
		suffix: "ಭಾರತ",
		reversed: "c9jrcs2--nx"
	},
	{
		suffix: "ഭാരതം",
		reversed: "e3ma0e1cvr--nx"
	},
	{
		suffix: "ලංකා",
		reversed: "c2e9c2czf--nx"
	},
	{
		suffix: "คอม",
		reversed: "a9d2c24--nx"
	},
	{
		suffix: "ทหาร.ไทย",
		reversed: "h4wc3o--nx.a2xyc3o--nx"
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
		suffix: "ศึกษา.ไทย",
		reversed: "h4wc3o--nx.rb0ef1c21--nx"
	},
	{
		suffix: "องค์กร.ไทย",
		reversed: "h4wc3o--nx.l8bxi8ifc21--nx"
	},
	{
		suffix: "เน็ต.ไทย",
		reversed: "h4wc3o--nx.a3j0hc3m--nx"
	},
	{
		suffix: "ไทย",
		reversed: "h4wc3o--nx"
	},
	{
		suffix: "ລາວ",
		reversed: "a6ec7q--nx"
	},
	{
		suffix: "გე",
		reversed: "edon--nx"
	},
	{
		suffix: "みんな",
		reversed: "c4byj9q--nx"
	},
	{
		suffix: "アマゾン",
		reversed: "dtexcwkcc--nx"
	},
	{
		suffix: "クラウド",
		reversed: "f0f3rkcg--nx"
	},
	{
		suffix: "グーグル",
		reversed: "cmp1akcq--nx"
	},
	{
		suffix: "コム",
		reversed: "ewkct--nx"
	},
	{
		suffix: "ストア",
		reversed: "b3b2kcc--nx"
	},
	{
		suffix: "セール",
		reversed: "b1e2kc1--nx"
	},
	{
		suffix: "ファッション",
		reversed: "c4erd5a9b1kcb--nx"
	},
	{
		suffix: "ポイント",
		reversed: "d9ctdvkce--nx"
	},
	{
		suffix: "三重.jp",
		reversed: "pj.n65zqhe--nx"
	},
	{
		suffix: "世界",
		reversed: "g69vqhr--nx"
	},
	{
		suffix: "个人.hk",
		reversed: "kh.npqic--nx"
	},
	{
		suffix: "中信",
		reversed: "b46qif--nx"
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
		suffix: "中文网",
		reversed: "sh5c822qif--nx"
	},
	{
		suffix: "亚马逊",
		reversed: "gr2n084qlj--nx"
	},
	{
		suffix: "京都.jp",
		reversed: "pj.n30sql1--nx"
	},
	{
		suffix: "企业",
		reversed: "vuqhv--nx"
	},
	{
		suffix: "佐賀.jp",
		reversed: "pj.m11tqqq--nx"
	},
	{
		suffix: "佛山",
		reversed: "a32wqq1--nx"
	},
	{
		suffix: "信息",
		reversed: "b168quv--nx"
	},
	{
		suffix: "個人.hk",
		reversed: "kh.a5wqmg--nx"
	},
	{
		suffix: "個人.香港",
		reversed: "g391w6j--nx.a5wqmg--nx"
	},
	{
		suffix: "健康",
		reversed: "a62yqyn--nx"
	},
	{
		suffix: "八卦",
		reversed: "c11q54--nx"
	},
	{
		suffix: "公司",
		reversed: "d5xq55--nx"
	},
	{
		suffix: "公司.cn",
		reversed: "nc.d5xq55--nx"
	},
	{
		suffix: "公司.hk",
		reversed: "kh.d5xq55--nx"
	},
	{
		suffix: "公司.香港",
		reversed: "g391w6j--nx.d5xq55--nx"
	},
	{
		suffix: "公益",
		reversed: "g24wq55--nx"
	},
	{
		suffix: "兵庫.jp",
		reversed: "pj.a35xq6f--nx"
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
		suffix: "台湾",
		reversed: "d31wrpk--nx"
	},
	{
		suffix: "台灣",
		reversed: "d75yrpk--nx"
	},
	{
		suffix: "和歌山.jp",
		reversed: "pj.nn7p7qrt0--nx"
	},
	{
		suffix: "商城",
		reversed: "d2urzc--nx"
	},
	{
		suffix: "商店",
		reversed: "t0srzc--nx"
	},
	{
		suffix: "商标",
		reversed: "b496rzc--nx"
	},
	{
		suffix: "商業.tw",
		reversed: "wt.b82wrzc--nx"
	},
	{
		suffix: "嘉里",
		reversed: "l04sr4w--nx"
	},
	{
		suffix: "嘉里大酒店",
		reversed: "arnd5uhf8le58r4w--nx"
	},
	{
		suffix: "在线",
		reversed: "g344sd3--nx"
	},
	{
		suffix: "埼玉.jp",
		reversed: "pj.d540sj5--nx"
	},
	{
		suffix: "大分.jp",
		reversed: "pj.o7qrbk--nx"
	},
	{
		suffix: "大拿",
		reversed: "u2yssp--nx"
	},
	{
		suffix: "大阪.jp",
		reversed: "pj.l33ussp--nx"
	},
	{
		suffix: "天主教",
		reversed: "jyqx94qit--nx"
	},
	{
		suffix: "奈良.jp",
		reversed: "pj.g71qstn--nx"
	},
	{
		suffix: "娱乐",
		reversed: "a027qjf--nx"
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
		suffix: "家電",
		reversed: "k924tcf--nx"
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
		suffix: "岐阜.jp",
		reversed: "pj.k522tin--nx"
	},
	{
		suffix: "岡山.jp",
		reversed: "pj.d3thr--nx"
	},
	{
		suffix: "岩手.jp",
		reversed: "pj.k4ytjd--nx"
	},
	{
		suffix: "島根.jp",
		reversed: "pj.x5ytlk--nx"
	},
	{
		suffix: "广东",
		reversed: "b125qhx--nx"
	},
	{
		suffix: "広島.jp",
		reversed: "pj.a9xtlk--nx"
	},
	{
		suffix: "微博",
		reversed: "a00trk9--nx"
	},
	{
		suffix: "徳島.jp",
		reversed: "pj.d7ptlk--nx"
	},
	{
		suffix: "愛媛.jp",
		reversed: "pj.m41s3c--nx"
	},
	{
		suffix: "愛知.jp",
		reversed: "pj.c204ugv--nx"
	},
	{
		suffix: "慈善",
		reversed: "y7rr03--nx"
	},
	{
		suffix: "我爱你",
		reversed: "lx3b689qq6--nx"
	},
	{
		suffix: "手机",
		reversed: "i3tupk--nx"
	},
	{
		suffix: "招聘",
		reversed: "d697uto--nx"
	},
	{
		suffix: "政务",
		reversed: "b461rfz--nx"
	},
	{
		suffix: "政府",
		reversed: "m1qtxm--nx"
	},
	{
		suffix: "政府.hk",
		reversed: "kh.m1qtxm--nx"
	},
	{
		suffix: "政府.香港",
		reversed: "g391w6j--nx.m1qtxm--nx"
	},
	{
		suffix: "敎育.hk",
		reversed: "kh.d23rvcl--nx"
	},
	{
		suffix: "教育.hk",
		reversed: "kh.d22svcw--nx"
	},
	{
		suffix: "教育.香港",
		reversed: "g391w6j--nx.d22svcw--nx"
	},
	{
		suffix: "新加坡",
		reversed: "o76i4orfy--nx"
	},
	{
		suffix: "新潟.jp",
		reversed: "pj.s9nvfe--nx"
	},
	{
		suffix: "新闻",
		reversed: "h88yvfe--nx"
	},
	{
		suffix: "时尚",
		reversed: "u25te9--nx"
	},
	{
		suffix: "書籍",
		reversed: "b88uvor--nx"
	},
	{
		suffix: "机构",
		reversed: "f7vqn--nx"
	},
	{
		suffix: "東京.jp",
		reversed: "pj.d17sql1--nx"
	},
	{
		suffix: "栃木.jp",
		reversed: "pj.sxvp4--nx"
	},
	{
		suffix: "沖縄.jp",
		reversed: "pj.a85uwuu--nx"
	},
	{
		suffix: "淡马锡",
		reversed: "dref506w4b--nx"
	},
	{
		suffix: "游戏",
		reversed: "y4punu--nx"
	},
	{
		suffix: "滋賀.jp",
		reversed: "pj.d520xbz--nx"
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
		suffix: "点看",
		reversed: "k8uxp3--nx"
	},
	{
		suffix: "熊本.jp",
		reversed: "pj.u4rvp8--nx"
	},
	{
		suffix: "石川.jp",
		reversed: "pj.c94ptr5--nx"
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
		suffix: "移动",
		reversed: "g28zrf6--nx"
	},
	{
		suffix: "箇人.hk",
		reversed: "kh.i050qmg--nx"
	},
	{
		suffix: "組織.hk",
		reversed: "kh.vta0cu--nx"
	},
	{
		suffix: "組織.tw",
		reversed: "wt.vta0cu--nx"
	},
	{
		suffix: "組織.香港",
		reversed: "g391w6j--nx.vta0cu--nx"
	},
	{
		suffix: "組织.hk",
		reversed: "kh.a4ya0cu--nx"
	},
	{
		suffix: "網絡.cn",
		reversed: "nc.gla0do--nx"
	},
	{
		suffix: "網絡.hk",
		reversed: "kh.gla0do--nx"
	},
	{
		suffix: "網絡.香港",
		reversed: "g391w6j--nx.gla0do--nx"
	},
	{
		suffix: "網络.hk",
		reversed: "kh.xva0fz--nx"
	},
	{
		suffix: "網路.tw",
		reversed: "wt.a46oa0fz--nx"
	},
	{
		suffix: "组織.hk",
		reversed: "kh.ixa0km--nx"
	},
	{
		suffix: "组织.hk",
		reversed: "kh.ga0nt--nx"
	},
	{
		suffix: "组织机构",
		reversed: "ame00sf7vqn--nx"
	},
	{
		suffix: "网址",
		reversed: "g455ses--nx"
	},
	{
		suffix: "网店",
		reversed: "e418txh--nx"
	},
	{
		suffix: "网站",
		reversed: "g5mzt5--nx"
	},
	{
		suffix: "网絡.hk",
		reversed: "kh.b3qa0do--nx"
	},
	{
		suffix: "网络",
		reversed: "i7a0oi--nx"
	},
	{
		suffix: "网络.cn",
		reversed: "nc.i7a0oi--nx"
	},
	{
		suffix: "网络.hk",
		reversed: "kh.i7a0oi--nx"
	},
	{
		suffix: "群馬.jp",
		reversed: "pj.c462a0t7--nx"
	},
	{
		suffix: "联通",
		reversed: "a360a0y8--nx"
	},
	{
		suffix: "臺灣",
		reversed: "a883xnn--nx"
	},
	{
		suffix: "茨城.jp",
		reversed: "pj.h22tsiu--nx"
	},
	{
		suffix: "诺基亚",
		reversed: "b7w9u16qlj--nx"
	},
	{
		suffix: "谷歌",
		reversed: "e153wlf--nx"
	},
	{
		suffix: "购物",
		reversed: "c84xx2g--nx"
	},
	{
		suffix: "通販",
		reversed: "e1ta3kg--nx"
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
		suffix: "集团",
		reversed: "m00tsb3--nx"
	},
	{
		suffix: "電訊盈科",
		reversed: "mgvu96d8syzf--nx"
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
		suffix: "飞利浦",
		reversed: "a4x1d77xrck--nx"
	},
	{
		suffix: "食品",
		reversed: "m981rvj--nx"
	},
	{
		suffix: "餐厅",
		reversed: "n315rmi--nx"
	},
	{
		suffix: "香川.jp",
		reversed: "pj.k43qtr5--nx"
	},
	{
		suffix: "香格里拉",
		reversed: "gsgb639j43us5--nx"
	},
	{
		suffix: "香港",
		reversed: "g391w6j--nx"
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
		suffix: "닷넷",
		reversed: "a65b06t--nx"
	},
	{
		suffix: "닷컴",
		reversed: "c44ub1km--nx"
	},
	{
		suffix: "삼성",
		reversed: "ikb4gc--nx"
	},
	{
		suffix: "한국",
		reversed: "e707b0e3--nx"
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
		var x;