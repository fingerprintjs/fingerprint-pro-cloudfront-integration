import { Context, CloudFrontRequestEvent, CloudFrontRequest, CloudFrontResultResponse, CloudFrontHeaders } from 'aws-lambda';
import { AgentOptions } from './AgentOptions';
import { ResultOptions } from './ResultOptions';

import https from 'https';
import { IncomingHttpHeaders, OutgoingHttpHeaders } from 'http';

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


export const handler = async (event: CloudFrontRequestEvent, context: Context): Promise<CloudFrontResultResponse> => {  
  console.info(`Config: ${JSON.stringify(event.Records[0].cf.config, null, 2)}`);
  console.info(`Request: ${JSON.stringify(event.Records[0].cf.request, null, 2)}`)
  console.info(`Context: ${JSON.stringify(context, null, 2)}`);

  const request = event.Records[0].cf.request;

  console.info(`agent download = ${getAgentDownloadPath(request)}`);
  console.info(`behavior = ${getBehaviorPath(request)}`);
  console.info(`result path = ${getResultPath(request)}`);
  console.info(`pre shared secret = ${getPreSharedSecret(request)}`);

  const agentUri = `/${getBehaviorPath(request)}/${getAgentDownloadPath(request)}`;
  const getResultUri = `/${getBehaviorPath(request)}/${getResultPath(request)}`;

  console.info(`handle ${request.uri}`);
  if (request.uri === agentUri) {
    const endpoint = `/v3/${getApiKey(request)}/loader_v${getLoaderVersion(request)}.js`;
    return downloadAgent({
      host: 'fpcdn.io',
      path: endpoint,
      method: request.method,
      headers: filterHeaders(request),
      domain: getHost(request)
    });
  } else if (request.uri === getResultUri) {
    const endpoint = `${getIngressAPIEndpoint(getRegion(request))}?${request.querystring}`;
    return handleResult({
      apiEndpoint: endpoint,
      method: request.method,
      headers: prepareHeadersForIngressAPI(request),
      body: request.body?.data || '',
      domain: getHost(request)
    });
  } else {
    return {
      status: '200',
      body: JSON.stringify({
          message: 'hello world',
      }),
  };
  }
};

const getAgentDownloadPath = (request: CloudFrontRequest) => getCustomHeader(request, 'fpjs_agent_download_path');

const getBehaviorPath = (request: CloudFrontRequest) => getCustomHeader(request, 'fpjs_behavior_path');

const getResultPath = (request: CloudFrontRequest) => getCustomHeader(request, 'fpjs_get_result_path');

const getPreSharedSecret = (request: CloudFrontRequest) => getCustomHeader(request, 'fpjs_pre_shared_secret');

function getCustomHeader(request: CloudFrontRequest, headerName: string): string | undefined {  
  const headers = request.origin?.custom?.customHeaders;
  if (headers === undefined) {
    return undefined;
  }
  return headers[headerName][0].value;
}

function getHost(request: CloudFrontRequest): string {
  return request.headers['host'][0].value;
}

function filterHeaders(request: CloudFrontRequest): OutgoingHttpHeaders {
  return Object.entries(request.headers).reduce((result: {[key: string]: string}, [name, value]) => {
    const headerName = name.toLowerCase();
    if (!BLACKLISTED_REQUEST_HEADERS.includes(headerName)) {
        let headerValue = value[0].value;
        if (headerName === 'cookie') {
          headerValue = headerValue.split(/; */).filter(isAllowedCookie).join('; ');
        }

        result[headerName] = headerValue;
    }
    return result;
}, {});
}

function prepareHeadersForIngressAPI(request: CloudFrontRequest): OutgoingHttpHeaders {
  const headers = filterHeaders(request);

  headers['fpjs-client-ip'] = request.clientIp;
  headers['fpjs-proxy-identification'] = getPreSharedSecret(request) || 'secret-is-not-defined';

  return headers;
}

function isAllowedCookie(cookie: string) {    
  cookie;
  return true;
}

const getApiKey = (request: CloudFrontRequest) => getQueryParameter(request, 'apiKey');

const getLoaderVersion = (request: CloudFrontRequest) => getQueryParameter(request, 'loaderVersion');

const getRegion = (request: CloudFrontRequest) => {
  const value = getQueryParameter(request, 'region');
  return value === undefined ? 'us' : value;
};

function getQueryParameter(request: CloudFrontRequest, key: string): string | undefined {
  const params = request.querystring.split('&');
  for (let i = 0; i < params.length; i++) {
      const kv = params[i].split('=');
      if (kv[0] === key) {
          return kv[1];
      }
  }
  return undefined;
}

function getIngressAPIEndpoint(region: string): string {
  const prefix = region === 'us' ? '' : region;
  return `https://${prefix}api.fpjs.io`
}

function downloadAgent(options: AgentOptions): Promise<CloudFrontResultResponse> {
    return new Promise(resolve => {
        const data: any[] = [];

        const request = https.request({
          host: options.host,
          method: options.method,
          path: options.path,
          headers: options.headers
        }, response => {
          let binary = false;
          if (response.headers['content-encoding']) {
            binary = true;
          }
          
          response.setEncoding(binary ? 'binary' : 'utf8');

          response.on('data', chunk => data.push(Buffer.from(chunk, 'binary')));

          response.on('end', () => {
            const body = Buffer.concat(data);
            resolve({
              status: response.statusCode ? response.statusCode.toString() : '500',
              statusDescription: response.statusMessage,
              headers: updateResponseHeaders(response.headers, options.domain),
              bodyEncoding: 'base64',
              body: body.toString('base64')
            });
          });
        });

        request.on('error', e => {          
          console.info(`error ${JSON.stringify(e)}`);
          resolve({
            status: '500',
            statusDescription: 'Bad request',
            headers: {},
            bodyEncoding: 'text',
            body: 'error'
          });
        });

        request.end();
    });
}

function handleResult(options: ResultOptions): Promise<CloudFrontResultResponse> {
  return new Promise(resolve => {
    const data: any[] = [];

    const request = https.request(options.apiEndpoint, {      
      method: options.method,
      headers: options.headers
    }, response => {
      response.on('data', chunk => data.push(chunk));

      response.on('end', () => {
        const payload = Buffer.concat(data);
        resolve({
          status: response.statusCode ? response.statusCode.toString() : '500',
              statusDescription: response.statusMessage,
              headers: updateResponseHeaders(response.headers, options.domain),
              bodyEncoding: 'base64',
              body: payload.toString('base64')
        });
      });
    });

    request.write(Buffer.from(options.body, 'base64'));

    request.on('error', e => {
      console.info(`error ${JSON.stringify(e)}`);
      resolve({
        status: '500',
        statusDescription: 'Bad request',
        headers: {},
        bodyEncoding: 'text',
        body: 'error'
      });
    });

    request.end();
  });
}

function updateCookie(cookieValue: string, domainName: string): string {
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

function updateResponseHeaders(headers: IncomingHttpHeaders, domain: string): CloudFrontHeaders {
  const resultHeaders: CloudFrontHeaders = {};

  for (const name of ALLOWED_RESPONSE_HEADERS) {
    const headerValue = headers[name];

    if (headerValue !== undefined) {
      let value = Array.isArray(headerValue) ? headerValue.join("; ") : headerValue;
      if (name === 'set-cookie') {
        value = updateCookie(value, domain)
      }
      
      resultHeaders[name] = [{
        key: name,
        value: value
      }];
    }            
  }

  return resultHeaders;
}
