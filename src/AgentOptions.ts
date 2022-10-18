import { OutgoingHttpHeaders } from "http";

export interface AgentOptions {
  host: string,
  path: string,
  method: string,
  headers: OutgoingHttpHeaders,
  domain: string
}