import { getInMemoryCustomerVariables } from '../utils/customer-variables/in-memory-customer-variables'
import { handleStatus } from '../../src/handlers'
import { CustomerVariableType } from '../../src/utils/customer-variables/types'

describe('Handle status', () => {
  it('returns correct response with all variables set', async () => {
    const { customerVariables } = getInMemoryCustomerVariables()

    const result = await handleStatus(customerVariables)
    const body = JSON.parse(result.body ?? '')

    expect(body).toMatchInlineSnapshot(`
      {
        "envInfo": [
          {
            "envVarName": "fpjs_behavior_path",
            "isSet": true,
            "value": "behaviour",
          },
          {
            "envVarName": "fpjs_get_result_path",
            "isSet": true,
            "value": "result",
          },
          {
            "envVarName": "fpjs_pre_shared_secret",
            "isSet": true,
            "value": "********",
          },
          {
            "envVarName": "fpjs_agent_download_path",
            "isSet": true,
            "value": "download",
          },
        ],
        "version": "__lambda_func_version__",
      }
    `)
  })

  it('returns correct response with empty pre shared secret', async () => {
    const { customerVariables, variables } = getInMemoryCustomerVariables()
    variables[CustomerVariableType.PreSharedSecret] = null

    const result = await handleStatus(customerVariables)
    const body = JSON.parse(result.body ?? '')

    expect(body).toMatchInlineSnapshot(`
      {
        "envInfo": [
          {
            "envVarName": "fpjs_behavior_path",
            "isSet": true,
            "value": "behaviour",
          },
          {
            "envVarName": "fpjs_get_result_path",
            "isSet": true,
            "value": "result",
          },
          {
            "envVarName": "fpjs_pre_shared_secret",
            "isSet": false,
            "value": null,
          },
          {
            "envVarName": "fpjs_agent_download_path",
            "isSet": true,
            "value": "download",
          },
        ],
        "version": "__lambda_func_version__",
      }
    `)
  })

  it('returns correct response with empty non obfuscated variable', async () => {
    const { customerVariables, variables } = getInMemoryCustomerVariables()
    variables[CustomerVariableType.BehaviourPath] = null

    const result = await handleStatus(customerVariables)
    const body = JSON.parse(result.body ?? '')

    expect(body).toMatchInlineSnapshot(`
      {
        "envInfo": [
          {
            "envVarName": "fpjs_behavior_path",
            "isSet": true,
            "value": "fpjs",
          },
          {
            "envVarName": "fpjs_get_result_path",
            "isSet": true,
            "value": "result",
          },
          {
            "envVarName": "fpjs_pre_shared_secret",
            "isSet": true,
            "value": "********",
          },
          {
            "envVarName": "fpjs_agent_download_path",
            "isSet": true,
            "value": "download",
          },
        ],
        "version": "__lambda_func_version__",
      }
    `)
  })
})
