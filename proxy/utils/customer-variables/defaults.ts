import { CustomerVariableValue, CustomerVariableType } from './types'

const defaultCustomerVariables: Record<CustomerVariableType, CustomerVariableValue> = {
  [CustomerVariableType.BehaviourPath]: 'fpjs',
  [CustomerVariableType.GetResultPath]: 'resultId',
  [CustomerVariableType.PreSharedSecret]: null,
  [CustomerVariableType.AgentDownloadPath]: 'agent',
}

export function getDefaultCustomerVariable(variable: CustomerVariableType): CustomerVariableValue {
  return defaultCustomerVariables[variable]
}
