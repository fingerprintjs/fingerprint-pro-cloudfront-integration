'use strict';

const https = require('https');

const FINGERPRINT_PATH = 'fpjs';
const AGENT_DOWNLOAD_PATH = 'agent';
const GET_RESULT_PATH = 'visitorId';
const REGION = 'us';

const AGENT_URI = `/${FINGERPRINT_PATH}/${AGENT_DOWNLOAD_PATH}`;
const RESULT_URI = `/${FINGERPRINT_PATH}/${GET_RESULT_PATH}`;

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
    } else {
        return request;
    }
};

function getFpApiHost() {
    const region = REGION === 'us' ? '' : `${REGION}.`;
    return `https://${region}api.fpjs.io`
}

function getApiKey(qs) {
    const params = qs.split('&');
    params.forEach(p => {
        const kv = p.split('=');
        if (kv[0] === 'apiKey') {
            return kv[1];
        }
    });    
    return undefined;
}

function getLoaderVersion(qs) {
    const params = qs.split('&');
    params.forEach(p => {
        const kv = p.split('=');
        if (kv[0] === 'loaderVersion') {
            return kv[1];
        }
    });
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

function respond(internalResponse, body, bodyEncoding) {
    const response = {
        status: internalResponse.statusCode,
        body,
        bodyEncoding,
        headers: {}
    };

    for (let name of ALLOWED_RESPONSE_HEADER) {
        let headerValue = internalResponse.headers[name];
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
