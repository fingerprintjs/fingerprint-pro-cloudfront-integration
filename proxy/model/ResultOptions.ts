import { OutgoingHttpHeaders } from 'http'
import { Logger } from '../logger'

export interface ResultOptions {
  region: string
  querystring: string
  method: string
  headers: OutgoingHttpHeaders
  body: string
  domain: string
  logger: Logger
  suffix: string
}
