export enum CustomerVariableType {
  BehaviourPath = 'fpjs_behavior_path',
  GetResultPath = 'fpjs_get_result_path',
  PreSharedSecret = 'fpjs_pre_shared_secret',
  AgentDownloadPath = 'fpjs_agent_download_path',
}

export type CustomerVariableValue = string | null | undefined

export type CustomerVariablesRecord = Record<CustomerVariableType, CustomerVariableValue>

export interface CustomerVariableProvider {
  readonly name: string

  getVariable: (variable: CustomerVariableType) => Promise<CustomerVariableValue>
}
