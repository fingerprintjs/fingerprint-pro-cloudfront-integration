import { OutgoingHttpHeaders } from 'http'

export interface ResultOptions {
  apiEndpoint: string
  method: string
  headers: OutgoingHttpHeaders
  body: string
  domain: string
}
