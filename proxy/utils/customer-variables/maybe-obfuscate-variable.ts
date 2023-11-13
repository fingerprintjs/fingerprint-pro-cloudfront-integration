import { CustomerVariables } from './customer-variables'
import { CustomerVariableType } from './types'

export const OBFUSCATED_VALUE = '********'

export async function maybeObfuscateVariable(customerVariables: CustomerVariables, variable: CustomerVariableType) {
  const result = await customerVariables.getVariable(variable)

  if (variable === CustomerVariableType.PreSharedSecret && result.value) {
    result.value = OBFUSCATED_VALUE
  }

  return result
}
