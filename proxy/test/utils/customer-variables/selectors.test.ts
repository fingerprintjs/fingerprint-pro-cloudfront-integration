import { CloudFrontRequest } from 'aws-lambda'
import { CustomerVariables } from '../../../utils/customer-variables/customer-variables'
import { HeaderCustomerVariables } from '../../../utils/customer-variables/header-customer-variables'
import { getAgentUri, getResultUri, getStatusUri } from '../../../utils'
import { SecretsManagerVariables } from '../../../utils/customer-variables/secrets-manager/secrets-manager-variables'
import { CustomerVariablesRecord, CustomerVariableType } from '../../../utils/customer-variables/types'
import { clearSecretsCache } from '../../../utils/customer-variables/secrets-manager/retrieve-secret'
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import { getBehaviorPath } from '../../../utils/customer-variables/selectors'
import { mockClient } from 'aws-sdk-client-mock'
import 'aws-sdk-client-mock-jest'

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
    const mock = mockClient(SecretsManagerClient)

    const getSecretsManagerCustomerVariables = (request: CloudFrontRequest) =>
      new CustomerVariables([new SecretsManagerVariables(request)])

    const stringToArrayBuffer = (str: string) => {
      const buf = new ArrayBuffer(str.length)
      const bufView = new Uint8Array(buf)
      for (let i = 0, strLen = str.length; i < strLen; i++) {
        bufView[i] = str.charCodeAt(i)
      }
      return bufView
    }

    const secretName = 'my_secret'
    const secretRegion = 'us-east-1'

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
                value: secretName,
              },
            ],
            fpjs_secret_region: [
              {
                key: 'fpjs_secret_region',
                value: secretRegion,
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

      expect(mock).toHaveReceivedCommandTimes(GetSecretValueCommand, 1)
      expect(mock).toHaveReceivedCommandWith(GetSecretValueCommand, {
        SecretId: secretName,
      })

      await checkVariables()

      // Ensure that the secret is only fetched once
      expect(mock).toHaveReceivedCommandTimes(GetSecretValueCommand, 1)
    }

    beforeEach(() => {
      clearSecretsCache()

      mock.reset()
    })

    const variablesRecord = {
      [CustomerVariableType.AgentDownloadPath]: 'download',
      [CustomerVariableType.GetResultPath]: 'result',
      [CustomerVariableType.PreSharedSecret]: 'abcd',
      [CustomerVariableType.BehaviourPath]: 'behaviour',
    } as CustomerVariablesRecord
    const variablesRecordStr = JSON.stringify(variablesRecord)

    test.each([
      stringToArrayBuffer(variablesRecordStr),
      new TextEncoder().encode(variablesRecordStr),
      Buffer.from(variablesRecordStr),
    ])('positive scenario for custom origin with buffer secret', async (buffer) => {
      mock
        .on(GetSecretValueCommand, {
          SecretId: secretName,
        })
        .resolves({
          SecretBinary: buffer,
        })

      await runAssertions()
    })

    test('positive scenario for custom origin with string secret', async () => {
      mock
        .on(GetSecretValueCommand, {
          SecretId: secretName,
        })
        .resolves({
          SecretString: variablesRecordStr,
        })

      await runAssertions()
    })

    test('positive scenario for s3 origin with string secret', async () => {
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
                  value: secretName,
                },
              ],
              fpjs_secret_region: [
                {
                  key: 'fpjs_secret_region',
                  value: secretRegion,
                },
              ],
            },
          },
        },
      }

      mock
        .on(GetSecretValueCommand, {
          SecretId: secretName,
        })
        .resolves({
          SecretString: variablesRecordStr,
        })

      await runAssertions(req)
    })
  })

  describe('from secrets manager and headers', () => {
    const mock = mockClient(SecretsManagerClient)
    //const client = new SecretsManagerClient({})

    const getCustomerVariables = (request: CloudFrontRequest) =>
      new CustomerVariables([new SecretsManagerVariables(request), new HeaderCustomerVariables(request)])

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

      mock.reset()
    })

    it('should fallback to headers if secrets manager value is empty', async () => {
      mock
        .on(GetSecretValueCommand, {
          SecretId: 'my_secret',
        })
        .resolves({})

      const result = await getBehaviorPath(getCustomerVariables(req))

      expect(result).toBe('eifjdsnmzxcn')
      expect(mock).toHaveReceivedCommandTimes(GetSecretValueCommand, 1)
    })

    it('should fallback to headers if secrets manager constructor throws', async () => {
      mock
        .on(GetSecretValueCommand, {
          SecretId: 'my_secret',
        })
        .rejects({})

      const result = await getBehaviorPath(getCustomerVariables(req))

      expect(result).toBe('eifjdsnmzxcn')
      expect(mock).toHaveReceivedCommandTimes(GetSecretValueCommand, 1)
    })

    it('should fallback to headers if secrets manager related headers are empty', async () => {
      mock
        .on(GetSecretValueCommand, {
          SecretId: 'my_secret',
        })
        .resolves({})

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
      expect(mock).toHaveReceivedCommandTimes(GetSecretValueCommand, 0)
    })
  })
})
