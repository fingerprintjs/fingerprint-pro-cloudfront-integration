import { CloudFrontResultResponse } from 'aws-lambda'
import { CustomerVariables } from '../utils/customer-variables/customer-variables'
import { CustomerVariableType, CustomerVariableValue } from '../utils/customer-variables/types'

interface EnvVarInfo {
  envVarName: string
  value: CustomerVariableValue
  isSet: boolean
}

async function getEnvInfo(customerVariables: CustomerVariables) {
  const infoArray: EnvVarInfo[] = await Promise.all(
    Object.values(CustomerVariableType).map(async (variable) => {
      let value = await customerVariables.getVariable(variable)

      if (variable === CustomerVariableType.PreSharedSecret && value) {
        value = '********'
      }

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
