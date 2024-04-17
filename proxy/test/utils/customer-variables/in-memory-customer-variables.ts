import {
  CustomerVariableProvider,
  CustomerVariablesRecord,
  CustomerVariableType,
} from '../../../utils/customer-variables/types'
import { CustomerVariables } from '../../../utils/customer-variables/customer-variables'

export function getInMemoryCustomerVariables() {
  const variables: CustomerVariablesRecord = {
    [CustomerVariableType.AgentDownloadPath]: 'download',
    [CustomerVariableType.PreSharedSecret]: 'secret',
    [CustomerVariableType.GetResultPath]: 'result',
    [CustomerVariableType.BehaviourPath]: 'behaviour',
  }
  const provider: CustomerVariableProvider = {
    name: 'test provider',
    getVariable: async (variable) => variables[variable],
  }
  const customerVariables = new CustomerVariables([provider])
  return { variables, customerVariables }
}
