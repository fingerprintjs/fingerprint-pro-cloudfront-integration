import { OutgoingHttpHeaders } from 'http'
import { Region } from './'

export interface ResultOptions {
  region: Region
  querystring: string
  method: string
  headers: OutgoingHttpHeaders
  body: string
  suffix: string
}
