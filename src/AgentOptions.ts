export interface AgentOptions {
  host: string,
  path: string,
  method: string,
  headers: {[key: string]: string},
  domain: string
}