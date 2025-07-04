import { CloudFrontResultResponse } from 'aws-lambda'
import { CustomerVariables } from '../utils/customer-variables/customer-variables'
import { CustomerVariableType, CustomerVariableValue, internalVariables } from '../utils/customer-variables/types'
import { maybeObfuscateVariable } from '../utils/customer-variables/maybe-obfuscate-variable'

export interface EnvVarInfo {
  envVarName: string
  value: CustomerVariableValue
  isSet: boolean
  isInternal: boolean
  // If null, the variable was resolved with the default value, otherwise it was resolved by the provider with the given name
  resolvedBy: string | null
}

export interface StatusInfo {
  version: string
  envInfo: EnvVarInfo[]
  styleNonce: string
}

async function getEnvInfo(customerVariables: CustomerVariables) {
  const infoArray: EnvVarInfo[] = await Promise.all(
    Object.values(CustomerVariableType).map(async (variable) => {
      const value = await maybeObfuscateVariable(customerVariables, variable)

      return {
        envVarName: variable,
        value: value.value,
        isSet: Boolean(value.value),
        isInternal: internalVariables.has(variable),
        resolvedBy: value.resolvedBy,
      }
    })
  )

  return infoArray
}

function renderEnvInfo(envInfo: EnvVarInfo[]) {
  const isAllCustomerDefinedVariablesSet = envInfo
    .filter((info) => !info.isInternal)
    .every((info) => info.isSet && info.resolvedBy)

  if (isAllCustomerDefinedVariablesSet) {
    return `
      <div>
        ✅ All environment variables are set
      </div>
    `
  }

  const children = envInfo
    .filter((info) => (!info.isSet || !info.resolvedBy) && !info.isInternal)
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

function renderHtml({ version, envInfo, styleNonce }: StatusInfo) {
  return `
    <html lang="en-US">
      <head>
        <title>CloudFront integration status</title>
        <meta charset="utf-8">
        <style nonce='${styleNonce}'>
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

export async function getStatusInfo(customerVariables: CustomerVariables, styleNonce: string): Promise<StatusInfo> {
  return {
    version: '__lambda_func_version__',
    envInfo: await getEnvInfo(customerVariables),
    styleNonce,
  }
}

export async function handleStatus(
  customerVariables: CustomerVariables,
  styleNonce: string
): Promise<CloudFrontResultResponse> {
  const body = await getStatusInfo(customerVariables, styleNonce)

  return {
    status: '200',
    body: renderHtml(body).trim(),
    headers: {
      'content-type': [{ key: 'Content-Type', value: 'text/html' }],
      'content-security-policy': [
        {
          key: 'Content-Security-Policy',
          value: `default-src 'none'; img-src https://fingerprint.com; style-src 'nonce-${styleNonce}'`,
        },
      ],
    },
  }
}
