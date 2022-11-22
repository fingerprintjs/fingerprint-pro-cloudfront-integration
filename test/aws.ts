import { SecretsManager } from 'aws-sdk'

export function toAwsResponse<T>(value: T) {
  return {
    promise: () => Promise.resolve(value),
  }
}

export function getMockSecretsManager() {
  const getSecretValue = jest.fn()

  const MockSecretsManager = jest.fn(() => ({
    getSecretValue,
  }))

  const mockSecret = {
    asString: (value: string) => {
      getSecretValue.mockReturnValue(toAwsResponse({ SecretString: value }))
    },
    asBuffer: (value: SecretsManager.SecretBinaryType) => {
      getSecretValue.mockReturnValue(toAwsResponse({ SecretBinary: value }))
    },
    asUndefined: () => {
      getSecretValue.mockReturnValue(
        toAwsResponse({
          SecretString: undefined,
          SecretBinary: undefined,
        }),
      )
    },
    asError: (error: Error) => {
      getSecretValue.mockReturnValueOnce(toAwsResponse(Promise.reject(error)))
    },
  }

  return {
    MockSecretsManager,
    getSecretValue,
    mockSecret,
  }
}
