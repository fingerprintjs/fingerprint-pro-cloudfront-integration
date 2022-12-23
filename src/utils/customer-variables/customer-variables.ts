import { CustomerVariableProvider, CustomerVariableType, CustomerVariableValue } from './types'
import { getDefaultCustomerVariable } from './defaults'

export interface GetVariableResult {
  value: CustomerVariableValue
  resolvedBy: string | null
}

/**
 * Allows access to customer defined variables using multiple providers.
 * Variables will be resolved in order in which providers are set.
 * */
export class CustomerVariables {
  constructor(private readonly providers: CustomerVariableProvider[]) {}

  /**
   * Attempts to resolve customer variable using providers.
   * If no provider can resolve the variable, the default value is returned.
   * */
  async getVariable(variable: CustomerVariableType): Promise<GetVariableResult> {
    const providerResult = await this.getValueFromProviders(variable)

    if (providerResult) {
      return providerResult
    }

    const defaultValue = getDefaultCustomerVariable(variable)

    console.info(`Resolved customer variable ${variable} with default value ${defaultValue}`)

    return {
      value: defaultValue,
      resolvedBy: null,
    }
  }

  private async getValueFromProviders(variable: CustomerVariableType): Promise<GetVariableResult | null> {
    for (const provider of this.providers) {
      try {
        const result = await provider.getVariable(variable)

        if (result) {
          console.info(`Resolved customer variable ${variable} with provider ${provider.name}`)

          return {
            value: result,
            resolvedBy: provider.name,
          }
        }
      } catch (error) {
        console.error(`Error while resolving customer variable ${variable} with provider ${provider.name}`, error)
      }
    }

    return null
  }
}
