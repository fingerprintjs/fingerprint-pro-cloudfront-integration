import { CustomerVariableProvider, CustomerVariableType } from './types'
import { CloudFrontRequest } from 'aws-lambda'
import { getOriginForHeaders } from '../headers'

export class HeaderCustomerVariables implements CustomerVariableProvider {
  readonly name = 'HeaderCustomerVariables'

  constructor(private readonly request: CloudFrontRequest) {}

  async getVariable(variable: CustomerVariableType): Promise<string | null> {
    const origin = getOriginForHeaders(this.request)
    const headers = origin?.customHeaders

    if (!headers?.[variable]) {
      return null
    }
    return headers[variable][0].value
  }
}
