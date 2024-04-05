import { OutgoingHttpHeaders } from 'http'
import { Region } from './'

export interface ResultOptions {
  fpIngressBaseHost: string
  region: Region
  querystring: string
  method: string
  headers: OutgoingHttpHeaders
  body: string
  suffix: string
}
