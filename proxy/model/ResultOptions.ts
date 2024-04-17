import { OutgoingHttpHeaders } from 'http'
import { Logger } from '../logger'
import { Region } from './'

export interface ResultOptions {
  region: Region
  querystring: string
  method: string
  headers: OutgoingHttpHeaders
  body: string
  logger: Logger
  suffix: string
}
