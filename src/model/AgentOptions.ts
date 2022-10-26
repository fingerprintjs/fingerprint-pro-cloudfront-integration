import { OutgoingHttpHeaders } from 'http'

export interface AgentOptions {
  path: string
  method: string
  headers: OutgoingHttpHeaders
  domain: string
}
