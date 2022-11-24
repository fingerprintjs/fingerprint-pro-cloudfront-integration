import { OutgoingHttpHeaders } from 'http'

export interface AgentOptions {
  apiKey: string | undefined
  version: string | undefined
  loaderVersion: string | undefined
  method: string
  headers: OutgoingHttpHeaders
  domain: string
}
