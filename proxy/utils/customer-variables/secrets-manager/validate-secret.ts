import { CustomerVariablesRecord, CustomerVariableType, CustomerVariableValue } from '../types'

const allowedKeys = Object.values(CustomerVariableType)

function assertIsCustomerVariableValue(value: unknown, key: string): asserts value is CustomerVariableValue {
  if (typeof value !== 'string' && value !== null && value !== undefined) {
    throw new TypeError(`Secrets Manager secret contains an invalid value ${key}: ${value}`)
  }
}

// TODO Update notion documentation to contain correct keys
export function validateSecret(obj: unknown): asserts obj is CustomerVariablesRecord {
  if (!obj || typeof obj !== 'object') {
    throw new TypeError('Secrets Manager secret is not an object')
  }

  const secret = obj as Record<CustomerVariableType, CustomerVariableValue>

  for (const [key, value] of Object.entries(secret)) {
    if (!allowedKeys.includes(key as CustomerVariableType)) {
      console.warn(`Secrets Manager secret contains an invalid key: ${key}`)
      continue
    }

    assertIsCustomerVariableValue(value, key)
  }
}
