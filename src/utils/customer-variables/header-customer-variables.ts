import { CustomerVariableProvider, CustomerVariableType } from './types'
import { CloudFrontRequest } from 'aws-lambda'
import { getHeaderValue } from '../headers'

export class HeaderCustomerVariables implements CustomerVariableProvider {
  readonly name = 'HeaderCustomerVariables'

  constructor(private readonly request: CloudFrontRequest) {}

  async getVariable(variable: CustomerVariableType): Promise<string | null> {
    return getHeaderValue(this.request, variable)
  }
}
