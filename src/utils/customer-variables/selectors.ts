import { CustomerVariables } from './customer-variables'
import { CustomerVariableType } from './types'

export const getAgentUri = async (variables: CustomerVariables) =>
  `/${await getBehaviorPath(variables)}/${await getAgentDownloadPath(variables)}`

export const getResultUri = async (variables: CustomerVariables) =>
  `/${await getBehaviorPath(variables)}/${await getResultPath(variables)}`

export const getStatusUri = async (variables: CustomerVariables) => `/${await getBehaviorPath(variables)}/status`

export const getAgentDownloadPath = async (variables: CustomerVariables) =>
  variables.getVariable(CustomerVariableType.AgentDownloadPath)

export const getBehaviorPath = async (variables: CustomerVariables) =>
  variables.getVariable(CustomerVariableType.BehaviourPath)

export const getResultPath = async (variables: CustomerVariables) =>
  variables.getVariable(CustomerVariableType.GetResultPath)

export const getPreSharedSecret = async (variables: CustomerVariables) =>
  variables.getVariable(CustomerVariableType.PreSharedSecret)
