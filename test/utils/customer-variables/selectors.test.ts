import { CloudFrontRequest } from 'aws-lambda'
import { CustomerVariables } from '../../../src/utils/customer-variables/customer-variables'
import { HeaderCustomerVariables } from '../../../src/utils/customer-variables/header-customer-variables'
import { getAgentUri, getResultUri, getStatusUri } from '../../../src/utils'

const getHeaderCustomerVariables = (request: CloudFrontRequest) =>
  new CustomerVariables([new HeaderCustomerVariables(request)])

describe('customer variables selectors', () => {
  describe('from headers', () => {
    test('positive scenario for custom origin', async () => {
      const req: CloudFrontRequest = {
        clientIp: '1.1.1.1',
        method: 'GET',
        uri: 'fpjs/agent',
        querystring: 'apiKey=ujKG34hUYKLJKJ1F&version=3&loaderVersion=3.6.2',
        headers: {},
        origin: {
          custom: {
            domainName: 'adewe.cloudfront.net',
            keepaliveTimeout: 60,
            path: '/',
            port: 443,
            protocol: 'https',
            readTimeout: 60,
            sslProtocols: ['TLSv2'],
            customHeaders: {
              fpjs_pre_shared_secret: [
                {
                  key: 'fpjs_pre_shared_secret',
                  value: 'qwertyuio1356767',
                },
              ],
              fpjs_agent_download_path: [
                {
                  key: 'fpjs_agent_download_path',
                  value: 'greiodsfkljlds',
                },
              ],
              fpjs_behavior_path: [
                {
                  key: 'fpjs_behavior_path',
                  value: 'eifjdsnmzxcn',
                },
              ],
              fpjs_get_result_path: [
                {
                  key: 'fpjs_get_result_path',
                  value: 'eiwflsdkadlsjdsa',
                },
              ],
            },
          },
        },
      }

      const customerVariables = getHeaderCustomerVariables(req)

      expect(await getAgentUri(customerVariables)).toBe('/eifjdsnmzxcn/greiodsfkljlds')
      expect(await getResultUri(customerVariables)).toBe('/eifjdsnmzxcn/eiwflsdkadlsjdsa')
      expect(await getStatusUri(customerVariables)).toBe('/eifjdsnmzxcn/status')
    })

    test('positive scenario for s3 origin', async () => {
      const req: CloudFrontRequest = {
        clientIp: '1.1.1.1',
        method: 'GET',
        uri: 'fpjs/agent',
        querystring: 'apiKey=ujKG34hUYKLJKJ1F&version=3&loaderVersion=3.6.2',
        headers: {},
        origin: {
          s3: {
            domainName: 'adewe.cloudfront.net',
            path: '/',
            region: 'us',
            authMethod: 'none',
            customHeaders: {
              fpjs_pre_shared_secret: [
                {
                  key: 'fpjs_pre_shared_secret',
                  value: 'qwertyuio1356767',
                },
              ],
              fpjs_agent_download_path: [
                {
                  key: 'fpjs_agent_download_path',
                  value: 'greiodsfkljlds',
                },
              ],
              fpjs_behavior_path: [
                {
                  key: 'fpjs_behavior_path',
                  value: 'eifjdsnmzxcn',
                },
              ],
              fpjs_get_result_path: [
                {
                  key: 'fpjs_get_result_path',
                  value: 'eiwflsdkadlsjdsa',
                },
              ],
            },
          },
        },
      }

      const customerVariables = getHeaderCustomerVariables(req)

      expect(await getAgentUri(customerVariables)).toBe('/eifjdsnmzxcn/greiodsfkljlds')
      expect(await getResultUri(customerVariables)).toBe('/eifjdsnmzxcn/eiwflsdkadlsjdsa')
      expect(await getStatusUri(customerVariables)).toBe('/eifjdsnmzxcn/status')
    })

    test('no headers', async () => {
      const req: CloudFrontRequest = {
        clientIp: '1.1.1.1',
        method: 'GET',
        uri: 'fpjs/agent',
        querystring: 'apiKey=ujKG34hUYKLJKJ1F&version=3&loaderVersion=3.6.2',
        headers: {},
        origin: {
          custom: {
            domainName: 'adewe.cloudfront.net',
            keepaliveTimeout: 60,
            path: '/',
            port: 443,
            protocol: 'https',
            readTimeout: 60,
            sslProtocols: ['TLSv2'],
            customHeaders: {},
          },
        },
      }

      const customerVariables = getHeaderCustomerVariables(req)

      expect(await getAgentUri(customerVariables)).toBe('/fpjs/agent')
      expect(await getResultUri(customerVariables)).toBe('/fpjs/resultId')
      expect(await getStatusUri(customerVariables)).toBe('/fpjs/status')
    })
  })
})
