import { CloudFrontRequest } from 'aws-lambda'
import { CustomerVariables } from '../../../utils/customer-variables/customer-variables'
import { HeaderCustomerVariables } from '../../../utils/customer-variables/header-customer-variables'
import { getAgentUri, getResultUri, getStatusUri } from '../../../utils'
import { SecretsManagerVariables } from '../../../utils/customer-variables/secrets-manager/secrets-manager-variables'
import { CustomerVariablesRecord, CustomerVariableType } from '../../../utils/customer-variables/types'
import { Blob } from 'buffer'
import { clearSecretsCache } from '../../../utils/customer-variables/secrets-manager/retrieve-secret'
import { getMockSecretsManager } from '../../aws'
import { getBehaviorPath } from '../../../utils/customer-variables/selectors'

describe('customer variables selectors', () => {
  describe('from headers', () => {
    const getHeaderCustomerVariables = (request: CloudFrontRequest) =>
      new CustomerVariables([new HeaderCustomerVariables(request)])

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

  describe('from secrets manager', () => {
    const { getSecretValue, MockSecretsManager, mockSecret } = getMockSecretsManager()

    const getSecretsManagerCustomerVariables = (request: CloudFrontRequest) =>
      new CustomerVariables([new SecretsManagerVariables(request, MockSecretsManager as any)])

    const stringToArrayBuffer = (str: string) => {
      const buf = new ArrayBuffer(str.length)
      const bufView = new Uint8Array(buf)
      for (let i = 0, strLen = str.length; i < strLen; i++) {
        bufView[i] = str.charCodeAt(i)
      }
      return bufView
    }

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
            fpjs_secret_name: [
              {
                key: 'fpjs_secret_name',
                value: 'my_secret',
              },
            ],
            fpjs_secret_region: [
              {
                key: 'fpjs_secret_region',
                value: 'eu-west-1',
              },
            ],
          },
        },
      },
    }

    const runAssertions = async (request = req) => {
      const customerVariables = getSecretsManagerCustomerVariables(request)

      const checkVariables = async () => {
        expect(await getAgentUri(customerVariables)).toBe('/behaviour/download')
        expect(await getResultUri(customerVariables)).toBe('/behaviour/result')
        expect(await getStatusUri(customerVariables)).toBe('/behaviour/status')
      }

      await checkVariables()

      expect(MockSecretsManager).toHaveBeenCalledWith({
        region: 'eu-west-1',
      })
      expect(getSecretValue).toHaveBeenCalledTimes(1)
      expect(getSecretValue).toHaveBeenCalledWith({
        SecretId: 'my_secret',
      })

      await checkVariables()

      // Ensure that the secret is only fetched once
      expect(getSecretValue).toHaveBeenCalledTimes(1)
    }

    beforeEach(() => {
      clearSecretsCache()

      MockSecretsManager.mockClear()
      getSecretValue.mockClear()
    })

    const variablesRecord = {
      [CustomerVariableType.AgentDownloadPath]: 'download',
      [CustomerVariableType.GetResultPath]: 'result',
      [CustomerVariableType.PreSharedSecret]: 'abcd',
      [CustomerVariableType.BehaviourPath]: 'behaviour',
    } as CustomerVariablesRecord
    const variablesRecordStr = JSON.stringify(variablesRecord)

    test.each([
      new Blob([variablesRecordStr]),
      stringToArrayBuffer(variablesRecordStr),
      Buffer.from(variablesRecordStr),
    ])('positive scenario for custom origin with buffer secret', async (buffer) => {
      mockSecret.asBuffer(buffer)

      await runAssertions()
    })

    test('positive scenario for custom origin with string secret', async () => {
      mockSecret.asString(variablesRecordStr)

      await runAssertions()
    })

    test('positive scenerio for s3 origin with string secret', async () => {
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
              fpjs_secret_name: [
                {
                  key: 'fpjs_secret_name',
                  value: 'my_secret',
                },
              ],
              fpjs_secret_region: [
                {
                  key: 'fpjs_secret_region',
                  value: 'eu-west-1',
                },
              ],
            },
          },
        },
      }

      mockSecret.asString(variablesRecordStr)

      await runAssertions(req)
    })
  })

  describe('from secrets manager and headers', () => {
    const { getSecretValue, MockSecretsManager, mockSecret } = getMockSecretsManager()

    const getCustomerVariables = (request: CloudFrontRequest) =>
      new CustomerVariables([
        new SecretsManagerVariables(request, MockSecretsManager as any),
        new HeaderCustomerVariables(request),
      ])

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
            fpjs_secret_name: [
              {
                key: 'fpjs_secret_name',
                value: 'my_secret',
              },
            ],
            fpjs_secret_region: [
              {
                key: 'fpjs_secret_region',
                value: 'eu-west-1',
              },
            ],
          },
        },
      },
    }

    beforeEach(() => {
      clearSecretsCache()

      MockSecretsManager.mockClear()
      getSecretValue.mockClear()
    })

    it('should fallback to headers if secrets manager value is empty', async () => {
      mockSecret.asUndefined()

      const result = await getBehaviorPath(getCustomerVariables(req))

      expect(result).toBe('eifjdsnmzxcn')
      expect(getSecretValue).toHaveBeenCalledTimes(1)
    })

    it('should fallback to headers if secrets manager constructor throws', async () => {
      MockSecretsManager.mockImplementation(() => {
        throw new Error('error')
      })

      const result = await getBehaviorPath(getCustomerVariables(req))

      expect(result).toBe('eifjdsnmzxcn')
      expect(getSecretValue).toHaveBeenCalledTimes(0)
    })

    it('should fallback to headers if secrets manager related headers are empty', async () => {
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

      const result = await getBehaviorPath(getCustomerVariables(req))

      expect(result).toBe('eifjdsnmzxcn')
      expect(getSecretValue).toHaveBeenCalledTimes(0)
    })
  })
})
