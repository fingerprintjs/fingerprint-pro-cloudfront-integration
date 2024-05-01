import { OutgoingHttpHeaders } from 'http'

export interface AgentOptions {
  querystring: string
  fpCdnUrl: string
  apiKey: string | undefined
  version: string
  loaderVersion: string | undefined
  method: string
  headers: OutgoingHttpHeaders
}
