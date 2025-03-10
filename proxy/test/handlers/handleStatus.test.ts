import { getInMemoryCustomerVariables } from '../utils/customer-variables/in-memory-customer-variables'
import { CustomerVariableType } from '../../utils/customer-variables/types'
import { getStatusInfo, handleStatus } from '../../handlers/handleStatus'

const styleNonce = 'hardcodedStyleNonce'

describe('Handle status', () => {
  it('returns correct status info in html if all variables are set', async () => {
    const { customerVariables } = getInMemoryCustomerVariables()

    const result = await handleStatus(customerVariables, styleNonce)

    expect(result.headers).toEqual({
      'content-type': [{ key: 'Content-Type', value: 'text/html' }],
      'content-security-policy': [
        {
          key: 'Content-Security-Policy',
          value: `default-src 'none'; img-src https://fingerprint.com; style-src 'nonce-${styleNonce}'`,
        },
      ],
    })

    expect(result.body).toMatchSnapshot()
  })

  it('returns correct status info in html if some variables are using default values', async () => {
    const { customerVariables, variables } = getInMemoryCustomerVariables()

    variables.fpjs_pre_shared_secret = null
    variables.fpjs_agent_download_path = null
    variables.fpjs_get_result_path = null

    const result = await handleStatus(customerVariables, styleNonce)

    expect(result.headers).toEqual({
      'content-type': [{ key: 'Content-Type', value: 'text/html' }],
      'content-security-policy': [
        {
          key: 'Content-Security-Policy',
          value: `default-src 'none'; img-src https://fingerprint.com; style-src 'nonce-${styleNonce}'`,
        },
      ],
    })

    expect(result.body).toMatchSnapshot()
  })

  it('returns correct status info in html if some variables are missing', async () => {
    const { customerVariables, variables } = getInMemoryCustomerVariables()

    variables.fpjs_pre_shared_secret = null

    const result = await handleStatus(customerVariables, styleNonce)

    expect(result.headers).toEqual({
      'content-type': [{ key: 'Content-Type', value: 'text/html' }],
      'content-security-policy': [
        {
          key: 'Content-Security-Policy',
          value: `default-src 'none'; img-src https://fingerprint.com; style-src 'nonce-${styleNonce}'`,
        },
      ],
    })

    expect(result.body).toMatchSnapshot()
  })
})

describe('Get status info', () => {
  it('returns correct status info', async () => {
    const { customerVariables } = getInMemoryCustomerVariables()

    const result = await getStatusInfo(customerVariables, styleNonce)

    expect(result).toMatchSnapshot()
  })

  it('returns correct response with empty pre shared secret', async () => {
    const { customerVariables, variables } = getInMemoryCustomerVariables()
    variables[CustomerVariableType.PreSharedSecret] = null

    const result = await getStatusInfo(customerVariables, styleNonce)

    expect(result).toMatchSnapshot()
  })

  it('returns correct response with empty non obfuscated variable', async () => {
    const { customerVariables } = getInMemoryCustomerVariables()

    const result = await getStatusInfo(customerVariables, styleNonce)

    expect(result).toMatchSnapshot()
  })
})
