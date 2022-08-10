'use strict';

const https = require('https');

//TODO set the main route
const FINGERPRINT_PATH = 'fpjs';
//TODO set the agent download path
const AGENT_DOWNLOAD_PATH = 'agent';
//TODO set the result path
const GET_RESULT_PATH = 'visitorId';

//TODO set domain name
const DOMAIN_NAME = 'example.com';


const REGION = 'us';
const AGENT_URI = `/${FINGERPRINT_PATH}/${AGENT_DOWNLOAD_PATH}`;
const RESULT_URI = `/${FINGERPRINT_PATH}/${GET_RESULT_PATH}`;
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
            headers: filteredHeaders
        });
    } else if (request.uri === RESULT_URI) {
        const url = `${getFpApiHost()}?${request.querystring}`;
        return handleResult(url, {
            method: request.method,
            headers: filteredHeaders,
        }, request.body);
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

function downloadAgent(options) {
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
                resolve(respond(res, body.toString('base64'), 'base64'));
            });
        });

        req.on('error', e => {
            resolve(error(e, req.statusCode));
        });

        req.end();
    });
}

function handleResult(url, options, body) {
    return new Promise(resolve => {
        const data = [];
        const req = https.request(url, options, res => {
            res.on('data', chunk => {
                data.push(chunk)
            });

            res.on('end', () => {
                const payload = Buffer.concat(data);
                resolve(respond(res, payload.toString('base64'), 'base64'));
            });
        });

        req.write(Buffer.from(body.data, 'base64'));

        req.on('error', e => {
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

function updateCookie(cookieValue) {
    const parts = cookieValue.split(';');
    for (let i = 0; i < parts.length; i++) {
        const s = parts[i].trim();
        const kv = s.split('=');
        if (kv[0].toLowerCase() === 'domain') {
            kv[1] = DOMAIN_NAME;
            parts[i] = `${kv[0]}=${kv[1]}`
        } else {
            parts[i] = s;
        }
    }
    return parts.join('; ');
}

function respond(internalResponse, body, bodyEncoding) {
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
            headerValue = updateCookie(strVal);
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
