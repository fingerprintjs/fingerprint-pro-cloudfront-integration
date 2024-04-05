import { CustomerVariableValue, CustomerVariableType } from './types'

const defaultCustomerVariables: Record<CustomerVariableType, CustomerVariableValue> = {
  [CustomerVariableType.BehaviourPath]: 'fpjs',
  [CustomerVariableType.GetResultPath]: 'resultId',
  [CustomerVariableType.PreSharedSecret]: null,
  [CustomerVariableType.AgentDownloadPath]: 'agent',
  [CustomerVariableType.FpCdnUrl]: '__FPCDN__',
  [CustomerVariableType.FpIngressBaseHost]: '__INGRESS_API__',
}

export function getDefaultCustomerVariable(variable: CustomerVariableType): CustomerVariableValue {
  return defaultCustomerVariables[variable]
}

export const DEFAULT_REGION = 'us-east-1'
export const SECRET_NAME_HEADER_KEY = 'fpjs_secret_name'
