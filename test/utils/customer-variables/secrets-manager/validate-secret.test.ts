import { validateSecret } from '../../../../src/utils/customer-variables/secrets-manager/validate-secret'
import { CustomerVariableType } from '../../../../src/utils/customer-variables/types'

describe('Validate secret', () => {
  it.each(['not_a_secret', null])('throws if secret is not an object', (value) => {
    expect(() => validateSecret(value)).toThrow('Secrets Manager secret is not an object')
  })

  it('throws if object contains invalid keys', () => {
    const object = {
      invalid_key: 'value',
    }

    expect(() => validateSecret(object)).toThrow('Secrets Manager secret contains an invalid key: invalid_key')
  })

  it('throws if object contains invalid values', () => {
    const object = {
      [CustomerVariableType.BehaviourPath]: {},
    }

    expect(() => validateSecret(object)).toThrow(
      'Secrets Manager secret contains an invalid value fpjs_behavior_path: [object Object]',
    )
  })

  it('does not throw for object with partial values', () => {
    const object = {
      [CustomerVariableType.BehaviourPath]: undefined,
      [CustomerVariableType.PreSharedSecret]: null,
      [CustomerVariableType.GetResultPath]: 'result',
    }

    expect(() => validateSecret(object)).not.toThrow()
  })
})
