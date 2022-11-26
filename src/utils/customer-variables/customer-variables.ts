import { CustomerVariableProvider, CustomerVariableType } from './types'
import { getDefaultCustomerVariable } from './defaults'

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
  async getVariable(variable: CustomerVariableType) {
    const providerResult = await this.getValueFromProviders(variable)

    if (providerResult) {
      return providerResult
    }

    const defaultValue = getDefaultCustomerVariable(variable)

    console.info(`Resolved customer variable ${variable} with default value ${defaultValue}`)

    return defaultValue
  }

  private async getValueFromProviders(variable: CustomerVariableType) {
    for (const provider of this.providers) {
      try {
        const result = await provider.getVariable(variable)

        if (result) {
          console.info(`Resolved customer variable ${variable} with provider ${provider.name}`)

          return result
        }
      } catch (error) {
        console.error(`Error while resolving customer variable ${variable} with provider ${provider.name}`, error)
      }
    }

    return null
  }
}
