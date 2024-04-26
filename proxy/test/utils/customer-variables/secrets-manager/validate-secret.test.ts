import { validateSecret } from '../../../../utils/customer-variables/secrets-manager/validate-secret'
import { CustomerVariableType } from '../../../../utils/customer-variables/types'

describe('Validate secret', () => {
  it.each(['not_a_secret', null])('throws if secret is not an object', (value) => {
    expect(() => validateSecret(value)).toThrow('Secrets Manager secret is not an object')
  })

  it('does not throw if object contains unexpected keys', () => {
    const object = {
      invalid_key: 'value',
    }

    expect(() => validateSecret(object)).not.toThrow()
  })

  it('throws if object contains invalid values', () => {
    const object = {
      [CustomerVariableType.AgentDownloadPath]: {},
    }

    expect(() => validateSecret(object)).toThrow(
      'Secrets Manager secret contains an invalid value fpjs_agent_download_path: [object Object]'
    )
  })

  it('does not throw for object with partial values', () => {
    const object = {
      [CustomerVariableType.PreSharedSecret]: null,
      [CustomerVariableType.GetResultPath]: 'result',
    }

    expect(() => validateSecret(object)).not.toThrow()
  })
})
