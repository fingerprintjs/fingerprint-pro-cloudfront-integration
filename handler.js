'use strict';

const https = require('https');

//TODO set the main route
const FINGERPRINT_PATH = 'fpjs';
//TODO set the agent download path
const AGENT_DOWNLOAD_PATH = 'agent';
//TODO set the result path
const GET_RESULT_PATH = 'visitorId';


const Defaults = {
    AGENT_DOWNLOAD_ROUTE: 'agent_default',
    VISITOR_ID_ROUTE: 'visitorId_default'
};

const REGION = 'us';
const HEALTH_CHECK_URI = `${FINGERPRINT_PATH}/health`;

const ALLOWED_RESPONSE_HEADER = [
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
    const { request } = event.Records[0].cf;    
    const headers = Object.entries(request.headers)
        .reduce((acc, [name, [{ value }]]) => {
            acc[name] = value;
            return acc;
        }, {});    

    headers['x-forwarded-for'] = updateXForwardedFor(headers['x-forwarded-for'], request.clientIp);

    const filteredHeaders = filterHeaders(headers);
    if (filteredHeaders.cookie) {
        filteredHeaders.cookie = filteredHeaders.cookie
            .split(/; */)
            .filter(isAllowedCookie)
            .join('; ');
    }

    const customHeaders = Object.entries(request.origin.custom.customHeaders)
        .reduce((acc, [name, [{value}]]) => {
            acc[name] = value;
            return acc;
        }, {});
    const config = getConfiguration(customHeaders);

    const AGENT_URI = `/${FINGERPRINT_PATH}/${config.AGENT_DOWNLOAD_ROUTE}`;
    const RESULT_URI = `/${FINGERPRINT_PATH}/${config.VISITOR_ID_ROUTE}`;

    const domainName = headers['host'];

    console.info(`handle ${request.uri}`);
    if (request.uri === AGENT_URI) {
        const apiKey = getApiKey(request.querystring);
        const loaderVersion = getLoaderVersion(request.querystring);
        const endpoint = `/v3/${apiKey}/loader_v${loaderVersion}.js`;
        console.info(`agent endpoint ${endpoint}`);
        return downloadAgent({
            host: 'fpcdn.io',
            path: endpoint,
            method: request.method,
            headers: filteredHeaders,
        }, domainName);
    } else if (request.uri === RESULT_URI) {
        const url = `${getFpApiHost()}?${request.querystring}`;
        return handleResult(url, {
            method: request.method,
            headers: filteredHeaders,
        }, request.body, domainName);
    } else if (request.uri === HEALTH_CHECK_URI) {
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

function getConfiguration(headers) {
    console.info(JSON.stringify(headers));
    const config = {
        AGENT_DOWNLOAD_ROUTE: Defaults.AGENT_DOWNLOAD_ROUTE,
        VISITOR_ID_ROUTE: Defaults.VISITOR_ID_ROUTE,
        DOMAIN: '',
        PRE_SHARED_SECRET: ''
    };
    if (headers.hasOwnProperty('fpjs_agent_download_route')) {
        config.AGENT_DOWNLOAD_ROUTE = headers['fpjs_agent_download_route'];
    }
    if (headers.hasOwnProperty('fpjs_visitor_route')) {
        config.VISITOR_ID_ROUTE = headers['fpjs_visitor_route'];
    }
    config.DOMAIN = headers['fpjs_domain'];
    config.PRE_SHARED_SECRET = headers['fpjs_pre_shared_secret'];

    return config;
}

function getFpApiHost() {
    const region = REGION === 'us' ? '' : `${REGION}.`;
    return `https://${region}api.fpjs.io`
}

function getApiKey(qs) {
    const params = qs.split('&');
    for (let i = 0; i < params.length; i++) {
        const kv = params[i].split('=');
        if (kv[0] === 'apiKey') {
            return kv[1];
        }
    }  
    return undefined;
}

function getLoaderVersion(qs) {
    const params = qs.split('&');
    for (let i = 0; i < params.length; i++) {
        const kv = params[i].split('=');
        if (kv[0] === 'loaderVersion') {
            return kv[1];
        }
    }    
    return undefined;
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

    for (let name of ALLOWED_RESPONSE_HEADER) {        
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
