import { CustomerVariables } from './customer-variables'
import { CustomerVariableType } from './types'

export const OBFUSCATED_VALUE = '********'

export async function maybeObfuscateVariable(customerVariables: CustomerVariables, variable: CustomerVariableType) {
  let value = await customerVariables.getVariable(variable)

  if (variable === CustomerVariableType.PreSharedSecret && value) {
    value = OBFUSCATED_VALUE
  }

  return value
}
