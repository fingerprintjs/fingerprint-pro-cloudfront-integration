import { OutgoingHttpHeaders } from 'http'

export interface ResultOptions {
  region: string
  querystring: string
  method: string
  headers: OutgoingHttpHeaders
  body: string
  domain: string
}
