import { CloudFrontResultResponse } from 'aws-lambda'
import { CustomerVariables } from '../utils/customer-variables/customer-variables'
import { CustomerVariableType, CustomerVariableValue } from '../utils/customer-variables/types'
import { maybeObfuscateVariable } from '../utils/customer-variables/maybe-obfuscate-variable'

interface EnvVarInfo {
  envVarName: string
  value: CustomerVariableValue
  isSet: boolean
}

async function getEnvInfo(customerVariables: CustomerVariables) {
  const infoArray: EnvVarInfo[] = await Promise.all(
    Object.values(CustomerVariableType).map(async (variable) => {
      const value = await maybeObfuscateVariable(customerVariables, variable)

      return {
        envVarName: variable,
        value,
        isSet: Boolean(value),
      }
    }),
  )

  return infoArray
}

export async function handleStatus(customerVariables: CustomerVariables): Promise<CloudFrontResultResponse> {
  const body = {
    version: '__lambda_func_version__',
    envInfo: await getEnvInfo(customerVariables),
  }

  return {
    status: '200',
    body: JSON.stringify(body),
  }
}
