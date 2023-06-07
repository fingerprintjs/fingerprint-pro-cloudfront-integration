export function getMockSecretsManager() {
  const send = jest.fn()

  const MockSecretsManager = jest.fn(() => ({
    send,
  })) as jest.Mock

  const mockSecret = {
    asString: (value: string) => {
      send.mockReturnValue({ SecretString: value })
    },
    asBuffer: (value: Buffer) => {
      send.mockReturnValue({ SecretBinary: value })
    },
    asUndefined: () => {
      send.mockReturnValue({
        SecretString: undefined,
        SecretBinary: undefined,
      })
    },
    asError: (error: Error) => {
      send.mockReturnValueOnce(Promise.reject(error))
    },
  }

  return {
    MockSecretsManager,
    send,
    mockSecret,
  }
}
