'use strict';

const https = require('https');


const Defaults = {
    FPJS_BEHAVIOR_PATH: 'fpjs',
    AGENT_DOWNLOAD_PATH: 'agent',
    GET_RESULT_PATH: 'visitorId'
};

const ALLOWED_RESPONSE_HEADERS = [
    'access-control-allow-credentials',
    'access-control-allow-origin',
    'access-control-expose-headers',
    'cache-control',
    'content-encoding',
    'content-type',
    'cross-origin-resource-policy',
    'etag',
    'set-cookie',
    'vary'
];

const BLACKLISTED_REQUEST_HEADERS = [
    'content-length',
    'host',
    'transfer-encoding',
    'via'
];

exports.handler = event => {
    console.info(JSON.stringify(event));
    const { request } = event.Records[0].cf;    
    
    const requestHeaders = extractHeaders(request.headers);
    requestHeaders['x-forwarded-for'] = updateXForwardedFor(requestHeaders['x-forwarded-for'], request.clientIp);
    const domainName = requestHeaders['host'];

    const filteredHeaders = filterHeaders(requestHeaders);
    if (filteredHeaders.cookie) {
        filteredHeaders.cookie = filteredHeaders.cookie
            .split(/; */)
            .filter(isAllowedCookie)
            .join('; ');
    }

    const configHeaders = extractHeaders(request.origin.custom.customHeaders);
    const config = getConfiguration(configHeaders);

    const agentUri = `/${config.FPJS_BEHAVIOR_PATH}/${config.AGENT_DOWNLOAD_PATH}`;
    const getResultUri = `/${config.FPJS_BEHAVIOR_PATH}/${config.GET_RESULT_PATH}`;    
    const healthCheckUri = `/${config.FPJS_BEHAVIOR_PATH}/health`;

    console.info(`handle ${request.uri}`);
    if (request.uri === agentUri) {
        const apiKey = findQueryParam(request.querystring, 'apiKey');
        const loaderVersion = findQueryParam(request.querystring, 'loaderVersion');
        const endpoint = `/v3/${apiKey}/loader_v${loaderVersion}.js`;
        console.info(`agent endpoint ${endpoint}`);
        return downloadAgent({
            host: 'fpcdn.io',
            path: endpoint,
            method: request.method,
            headers: filteredHeaders,
        }, domainName);
    } else if (request.uri === getResultUri) {
        const region = getRegion(request.querystring);
        const url = `${getFpApiHost(region)}?${request.querystring}`;
        return handleResult(url, {
            method: request.method,
            headers: filteredHeaders,
        }, request.body, domainName);
    } else if (request.uri === healthCheckUri) {
        const response = {
            status: 200,
            body: {
                status: 'ok',
            },
            headers: {
                'Content-Type': 'application/json'
            }
        };
        return response;
    }
    return request;
};

function extractHeaders(headers) {
    return Object.entries(headers)
    .reduce((acc, [name, [{value}]]) => {
        acc[name] = value;
        return acc;
    }, {});
}

function getConfiguration(headers) {    
    const config = {
        FPJS_BEHAVIOR_PATH: Defaults.FPJS_BEHAVIOR_PATH,
        AGENT_DOWNLOAD_PATH: Defaults.AGENT_DOWNLOAD_PATH,
        GET_RESULT_PATH: Defaults.GET_RESULT_PATH,
        PRE_SHARED_SECRET: ''
    };
    if (headers.hasOwnProperty('fpjs_behavior_path')) {
        config.FPJS_BEHAVIOR_PATH = headers['fpjs_behavior_path'];
    }
    if (headers.hasOwnProperty('fpjs_agent_download_path')) {
        config.AGENT_DOWNLOAD_PATH = headers['fpjs_agent_download_path'];
    }
    if (headers.hasOwnProperty('fpjs_visitor_path')) {
        config.VISITOR_ID_ROUTE = headers['fpjs_visitor_path'];
    }
    config.PRE_SHARED_SECRET = headers['fpjs_pre_shared_secret'];

    return config;
}

function getFpApiHost(region) {
    const prefix = region === 'us' ? '' : region;
    return `https://${prefix}api.fpjs.io`
}

function findQueryParam(querystring, key) {
    const params = querystring.split('&');
    for (let i = 0; i < params.length; i++) {
        const kv = params[i].split('=');
        if (kv[0] === key) {
            return kv[1];
        }
    }
    return undefined;
}

function getApiKey(qs) {
    return findQueryParam(qs, 'apiKey');
}

function getLoaderVersion(qs) {
    return findQueryParam(qs, 'loaderVersion');    
}

function getRegion(querystring) {
    const value = findQueryParam(querystring, 'region');
    return value === undefined || value === null ? 'us' : value;
}

function filterHeaders(headers) {
    return Object.entries(headers).reduce((result, [name, value]) => {
        if (!BLACKLISTED_REQUEST_HEADERS.includes(name)) {
            result[name] = value;
        }
        return result;
    }, {});
}

function updateXForwardedFor(currentValue, remoteAddr) {
    return currentValue ? `${currentValue}, ${remoteAddr}` : remoteAddr;
}

function isAllowedCookie(cookie) {    
    return true;
}

function downloadAgent(options, domainName) {
    return new Promise(resolve => {
        let data = [];
        const req = https.request(options, res => {
            let binary = false;
            if (res.headers['content-encoding']) {
                binary = true;
            }

            res.setEncoding(binary ? 'binary' : 'utf8');

            res.on('data', chunk => {
                data.push(Buffer.from(chunk, 'binary'));
            });

            res.on('end', () => {
                const body = Buffer.concat(data);
                resolve(respond(res, body.toString('base64'), 'base64', domainName));
            });
        });

        req.on('error', e => {
            resolve(error(e, req.statusCode));
        });

        req.end();
    });
}

function handleResult(url, options, body, domainName) {
    console.info('handle result');
    return new Promise(resolve => {
        const data = [];
        const req = https.request(url, options, res => {
            res.on('data', chunk => {
                data.push(chunk)
            });

            res.on('end', () => {
                const payload = Buffer.concat(data);                                
                resolve(respond(res, payload.toString('base64'), 'base64', domainName));
            });
        });

        req.write(Buffer.from(body.data, 'base64'));

        req.on('error', e => {
            console.info(`error happened ${e}`);
            console.error(e);
            resolve(error(e, req.statusCode));
        });

        req.end();
    });
}

function error(e, statusCode) {
    return Promise.resolve({
        status: 200,
        body: `Error processing request ${statusCode} ${e.message}`,        
        headers: {
        }
    });
}

function updateCookie(cookieValue, domainName) {
    const parts = cookieValue.split(';');
    for (let i = 0; i < parts.length; i++) {
        const s = parts[i].trim();
        const kv = s.split('=');
        if (kv[0].toLowerCase() === 'domain') {
            kv[1] = domainName;
            parts[i] = `${kv[0]}=${kv[1]}`
        } else {
            parts[i] = s;
        }
    }
    return parts.join('; ');
}

function respond(internalResponse, body, bodyEncoding, domainName) {
    const response = {
        status: internalResponse.statusCode,
        body,
        bodyEncoding,
        headers: {}
    };

    for (let name of ALLOWED_RESPONSE_HEADERS) {        
        let headerValue = internalResponse.headers[name];

        if (name === 'set-cookie' && headerValue) {
            const strVal = Array.isArray(headerValue) ? headerValue[0] : headerValue;
            headerValue = updateCookie(strVal, domainName);
        }

        if (headerValue) {
            if (!Array.isArray(headerValue)) {
                headerValue = [headerValue];
            }
            response.headers[name] = headerValue.map(v => ({
                value: v
            }));
        }
    }
    return response;
}
