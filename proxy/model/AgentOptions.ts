import { OutgoingHttpHeaders } from 'http'
import { Logger } from '../logger'

export interface AgentOptions {
  apiKey: string | undefined
  version: string
  loaderVersion: string | undefined
  method: string
  headers: OutgoingHttpHeaders
  domain: string
  logger: Logger
}
