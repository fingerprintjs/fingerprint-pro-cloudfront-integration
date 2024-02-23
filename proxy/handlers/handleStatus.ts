import { CloudFrontResultResponse } from 'aws-lambda'
import { CustomerVariables } from '../utils/customer-variables/customer-variables'
import { CustomerVariableType, CustomerVariableValue } from '../utils/customer-variables/types'
import { maybeObfuscateVariable } from '../utils/customer-variables/maybe-obfuscate-variable'

export interface EnvVarInfo {
  envVarName: string
  value: CustomerVariableValue
  isSet: boolean
  // If null, the variable was resolved with the default value, otherwise it was resolved by the provider with the given name
  resolvedBy: string | null
}

export interface StatusInfo {
  version: string
  envInfo: EnvVarInfo[]
}

async function getEnvInfo(customerVariables: CustomerVariables) {
  const infoArray: EnvVarInfo[] = await Promise.all(
    Object.values(CustomerVariableType).map(async (variable) => {
      const value = await maybeObfuscateVariable(customerVariables, variable)

      return {
        envVarName: variable,
        value: value.value,
        isSet: Boolean(value.value),
        resolvedBy: value.resolvedBy,
      }
    })
  )

  return infoArray
}

function renderEnvInfo(envInfo: EnvVarInfo[]) {
  const isAlSet = envInfo.every((info) => info.isSet && info.resolvedBy)

  if (isAlSet) {
    return `
      <div>
        ✅ All environment variables are set
      </div>
    `
  }

  const children = envInfo
    .filter((info) => !info.isSet || !info.resolvedBy)
    .map(
      (info) => `
        <div class="env-info-item">
            ⚠️ <strong>${info.envVarName} </strong> is not defined${info.isSet ? ' and uses default value' : ''}
        </div>`
    )

  return `
    <div class="env-info">
      ${children.join('')}
    </div>
  `
}

function renderHtml({ version, envInfo }: StatusInfo) {
  return `
    <html lang="en-US">
      <head>
        <title>CloudFront integration status</title>
        <meta charset="utf-8">
        <style>
          body, .env-info {
            display: flex;
          }
          
          body {
            flex-direction: column;
            align-items: center;
          }
          
          body > * {
            margin-bottom: 1em;
          }
        </style>
      </head>
      <body>
        <h1>CloudFront integration status</h1>
        <div>
          Lambda function version: ${version}
        </div>
        ${renderEnvInfo(envInfo)}
          <span>
            Please reach out our support via <a href="mailto:support@fingerprint.com">support@fingerprint.com</a> if you have any issues
          </span>
      </body>
    </html>
  `
}

export async function getStatusInfo(customerVariables: CustomerVariables): Promise<StatusInfo> {
  return {
    version: '__lambda_func_version__',
    envInfo: await getEnvInfo(customerVariables),
  }
}

export async function handleStatus(customerVariables: CustomerVariables): Promise<CloudFrontResultResponse> {
  const body = await getStatusInfo(customerVariables)

  return {
    status: '200',
    body: renderHtml(body).trim(),
    headers: {
      'content-type': [{ key: 'Content-Type', value: 'text/html' }],
    },
  }
}
