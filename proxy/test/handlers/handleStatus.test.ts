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

    expect(result.body).toMatchSnapshot()
  })

  it('returns correct status info in html if some variables are using default values', async () => {
    const { customerVariables, variables } = getInMemoryCustomerVariables()

    variables.fpjs_pre_shared_secret = null
    variables.fpjs_agent_download_path = null
    variables.fpjs_get_result_path = null

    const result = await handleStatus(customerVariables)

    expect(result.headers).toEqual({
      'content-type': [{ key: 'Content-Type', value: 'text/html' }],
    })

    expect(result.body).toMatchSnapshot()
  })

  it('returns correct status info in html if some variables are missing', async () => {
    const { customerVariables, variables } = getInMemoryCustomerVariables()

    variables.fpjs_pre_shared_secret = null

    const result = await handleStatus(customerVariables)

    expect(result.headers).toEqual({
      'content-type': [{ key: 'Content-Type', value: 'text/html' }],
    })

    expect(result.body).toMatchSnapshot()
  })
})

describe('Get status info', () => {
  it('returns correct status info', async () => {
    const { customerVariables } = getInMemoryCustomerVariables()

    const result = await getStatusInfo(customerVariables)

    expect(result).toMatchSnapshot()
  })

  it('returns correct response with empty pre shared secret', async () => {
    const { customerVariables, variables } = getInMemoryCustomerVariables()
    variables[CustomerVariableType.PreSharedSecret] = null

    const result = await getStatusInfo(customerVariables)

    expect(result).toMatchSnapshot()
  })

  it('returns correct response with empty non obfuscated variable', async () => {
    const { customerVariables } = getInMemoryCustomerVariables()

    const result = await getStatusInfo(customerVariables)

    expect(result).toMatchSnapshot()
  })
})
