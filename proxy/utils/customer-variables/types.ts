export enum CustomerVariableType {
  BehaviourPath = 'fpjs_behavior_path',
  GetResultPath = 'fpjs_get_result_path',
  PreSharedSecret = 'fpjs_pre_shared_secret',
  AgentDownloadPath = 'fpjs_agent_download_path',
  FpCdnUrl = 'fpjs_cdn_url',
  FpIngressBaseHost = 'fpjs_ingress_base_host',
}

export const internalVariables: Set<CustomerVariableType> = new Set<CustomerVariableType>([
  CustomerVariableType.FpCdnUrl,
  CustomerVariableType.FpIngressBaseHost,
])

export type CustomerVariableValue = string | null | undefined

export type CustomerVariablesRecord = Record<CustomerVariableType, CustomerVariableValue>

export interface CustomerVariableProvider {
  readonly name: string

  getVariable: (variable: CustomerVariableType) => Promise<CustomerVariableValue>
}
