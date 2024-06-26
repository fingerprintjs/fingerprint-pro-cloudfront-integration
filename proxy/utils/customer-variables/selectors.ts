import { CustomerVariables, GetVariableResult } from './customer-variables'
import { CustomerVariableType } from './types'

const extractVariable = (result: GetVariableResult) => result.value

export const getAgentUri = async (variables: CustomerVariables) => `/${await getAgentDownloadPath(variables)}`

export const getResultUri = async (variables: CustomerVariables) => `/${await getResultPath(variables)}(/.*)?`

export const getStatusUri = () => `/status`

export const getAgentDownloadPath = async (variables: CustomerVariables) =>
  variables.getVariable(CustomerVariableType.AgentDownloadPath).then(extractVariable)

export const getResultPath = async (variables: CustomerVariables) =>
  variables.getVariable(CustomerVariableType.GetResultPath).then(extractVariable)

export const getPreSharedSecret = async (variables: CustomerVariables) =>
  variables.getVariable(CustomerVariableType.PreSharedSecret).then(extractVariable)

export const getFpCdnUrl = async (variables: CustomerVariables) =>
  variables.getVariable(CustomerVariableType.FpCdnUrl).then(extractVariable)

export const getFpIngressBaseHost = async (variables: CustomerVariables) =>
  variables.getVariable(CustomerVariableType.FpIngressBaseHost).then(extractVariable)
