import { OutgoingHttpHeaders } from 'http'

export interface AgentOptions {
  apiKey: string | undefined
  version: string
  loaderVersion: string | undefined
  method: string
  headers: OutgoingHttpHeaders
}
