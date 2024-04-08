import { getInMemoryCustomerVariables } from '../utils/customer-variables/in-memory-customer-variables'
import { CustomerVariableType } from '../../utils/customer-variables/types'
import { getStatusInfo, handleStatus } from '../../handlers/handleStatus'

describe('Handle status', () => {
  it('returns correct status info in html if all variables are set', async () => {
    const { customerVariables } = getInMemoryCustomerVariables()

    const result = await handleStatus(customerVariables)

    expect(result.headers).toEqual({
      'content-type': [{ key: 'Content-Type', value: 'text/html' }],
    })

    expect(result.body).toMatchInlineSnapshot(`
      "<html lang="en-US">
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
                Lambda function version: __lambda_func_version__
              </div>
              
            <div>
              ✅ All environment variables are set
            </div>
          
                <span>
                  Please reach out our support via <a href="mailto:support@fingerprint.com">support@fingerprint.com</a> if you have any issues
                </span>
            </body>
          </html>"
    `)
  })

  it('returns correct status info in html if some variables are using default values', async () => {
    const { customerVariables, variables } = getInMemoryCustomerVariables()

    variables.fpjs_pre_shared_secret = null
    variables.fpjs_agent_download_path = null
    variables.fpjs_get_result_path = null
    variables.fpjs_behavior_path = null

    const result = await handleStatus(customerVariables)

    expect(result.headers).toEqual({
      'content-type': [{ key: 'Content-Type', value: 'text/html' }],
    })

    expect(result.body).toMatchInlineSnapshot(`
      "<html lang="en-US">
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
                Lambda function version: __lambda_func_version__
              </div>
              
          <div class="env-info">
            
              <div class="env-info-item">
                  ⚠️ <strong>fpjs_behavior_path </strong> is not defined and uses default value
              </div>
              <div class="env-info-item">
                  ⚠️ <strong>fpjs_get_result_path </strong> is not defined and uses default value
              </div>
              <div class="env-info-item">
                  ⚠️ <strong>fpjs_pre_shared_secret </strong> is not defined
              </div>
              <div class="env-info-item">
                  ⚠️ <strong>fpjs_agent_download_path </strong> is not defined and uses default value
              </div>
          </div>
        
                <span>
                  Please reach out our support via <a href="mailto:support@fingerprint.com">support@fingerprint.com</a> if you have any issues
                </span>
            </body>
          </html>"
    `)
  })

  it('returns correct status info in html if some variables are missing', async () => {
    const { customerVariables, variables } = getInMemoryCustomerVariables()

    variables.fpjs_pre_shared_secret = null

    const result = await handleStatus(customerVariables)

    expect(result.headers).toEqual({
      'content-type': [{ key: 'Content-Type', value: 'text/html' }],
    })

    expect(result.body).toMatchInlineSnapshot(`
      "<html lang="en-US">
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
                Lambda function version: __lambda_func_version__
              </div>
              
          <div class="env-info">
            
              <div class="env-info-item">
                  ⚠️ <strong>fpjs_pre_shared_secret </strong> is not defined
              </div>
          </div>
        
                <span>
                  Please reach out our support via <a href="mailto:support@fingerprint.com">support@fingerprint.com</a> if you have any issues
                </span>
            </body>
          </html>"
    `)
  })
})

describe('Get status info', () => {
  it('returns correct status info', async () => {
    const { customerVariables } = getInMemoryCustomerVariables()

    const result = await getStatusInfo(customerVariables)

    expect(result).toMatchInlineSnapshot(`
      {
        "envInfo": [
          {
            "envVarName": "fpjs_behavior_path",
            "isInternal": false,
            "isSet": true,
            "resolvedBy": "test provider",
            "value": "behaviour",
          },
          {
            "envVarName": "fpjs_get_result_path",
            "isInternal": false,
            "isSet": true,
            "resolvedBy": "test provider",
            "value": "result",
          },
          {
            "envVarName": "fpjs_pre_shared_secret",
            "isInternal": false,
            "isSet": true,
            "resolvedBy": "test provider",
            "value": "********",
          },
          {
            "envVarName": "fpjs_agent_download_path",
            "isInternal": false,
            "isSet": true,
            "resolvedBy": "test provider",
            "value": "download",
          },
          {
            "envVarName": "fpjs_cdn_url",
            "isInternal": true,
            "isSet": true,
            "resolvedBy": "test provider",
            "value": "fpcdn.io",
          },
          {
            "envVarName": "fpjs_ingress_base_host",
            "isInternal": true,
            "isSet": true,
            "resolvedBy": "test provider",
            "value": "api.fpjs.io",
          },
        ],
        "version": "__lambda_func_version__",
      }
    `)
  })

  it('returns correct response with empty pre shared secret', async () => {
    const { customerVariables, variables } = getInMemoryCustomerVariables()
    variables[CustomerVariableType.PreSharedSecret] = null

    const result = await getStatusInfo(customerVariables)

    expect(result).toMatchInlineSnapshot(`
      {
        "envInfo": [
          {
            "envVarName": "fpjs_behavior_path",
            "isInternal": false,
            "isSet": true,
            "resolvedBy": "test provider",
            "value": "behaviour",
          },
          {
            "envVarName": "fpjs_get_result_path",
            "isInternal": false,
            "isSet": true,
            "resolvedBy": "test provider",
            "value": "result",
          },
          {
            "envVarName": "fpjs_pre_shared_secret",
            "isInternal": false,
            "isSet": false,
            "resolvedBy": null,
            "value": null,
          },
          {
            "envVarName": "fpjs_agent_download_path",
            "isInternal": false,
            "isSet": true,
            "resolvedBy": "test provider",
            "value": "download",
          },
          {
            "envVarName": "fpjs_cdn_url",
            "isInternal": true,
            "isSet": true,
            "resolvedBy": "test provider",
            "value": "fpcdn.io",
          },
          {
            "envVarName": "fpjs_ingress_base_host",
            "isInternal": true,
            "isSet": true,
            "resolvedBy": "test provider",
            "value": "api.fpjs.io",
          },
        ],
        "version": "__lambda_func_version__",
      }
    `)
  })

  it('returns correct response with empty non obfuscated variable', async () => {
    const { customerVariables, variables } = getInMemoryCustomerVariables()
    variables[CustomerVariableType.BehaviourPath] = null

    const result = await getStatusInfo(customerVariables)

    expect(result).toMatchInlineSnapshot(`
      {
        "envInfo": [
          {
            "envVarName": "fpjs_behavior_path",
            "isInternal": false,
            "isSet": true,
            "resolvedBy": null,
            "value": "fpjs",
          },
          {
            "envVarName": "fpjs_get_result_path",
            "isInternal": false,
            "isSet": true,
            "resolvedBy": "test provider",
            "value": "result",
          },
          {
            "envVarName": "fpjs_pre_shared_secret",
            "isInternal": false,
            "isSet": true,
            "resolvedBy": "test provider",
            "value": "********",
          },
          {
            "envVarName": "fpjs_agent_download_path",
            "isInternal": false,
            "isSet": true,
            "resolvedBy": "test provider",
            "value": "download",
          },
          {
            "envVarName": "fpjs_cdn_url",
            "isInternal": true,
            "isSet": true,
            "resolvedBy": "test provider",
            "value": "fpcdn.io",
          },
          {
            "envVarName": "fpjs_ingress_base_host",
            "isInternal": true,
            "isSet": true,
            "resolvedBy": "test provider",
            "value": "api.fpjs.io",
          },
        ],
        "version": "__lambda_func_version__",
      }
    `)
  })
})
