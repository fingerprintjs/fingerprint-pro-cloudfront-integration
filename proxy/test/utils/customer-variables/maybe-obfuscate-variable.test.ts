import { CustomerVariableType } from '../../../utils/customer-variables/types'
import { maybeObfuscateVariable, OBFUSCATED_VALUE } from '../../../utils/customer-variables/maybe-obfuscate-variable'
import { getInMemoryCustomerVariables } from './in-memory-customer-variables'

const { variables, customerVariables } = getInMemoryCustomerVariables()

describe('maybe obfuscate variable', () => {
  it('should obfuscate pre shared secret', async () => {
    const result = await maybeObfuscateVariable(customerVariables, CustomerVariableType.PreSharedSecret)

    expect(result.value).toBe(OBFUSCATED_VALUE)
  })

  it.each([
    CustomerVariableType.GetResultPath,
    CustomerVariableType.BehaviourPath,
    CustomerVariableType.AgentDownloadPath,
  ])('should not obfuscate other variables', async (variable) => {
    const result = await maybeObfuscateVariable(customerVariables, variable)

    expect(result.value).toBe(variables[variable])
  })
})
