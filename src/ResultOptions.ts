export interface ResultOptions {
  apiEndpoint: string,
  method: string,
  headers: {[key: string]: string},
  body: any,
  domain: string
}