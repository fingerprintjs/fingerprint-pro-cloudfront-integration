export enum ErrorCode {
  UnknownError = 'E1000',
  AWSResourceNotFound = 'E2100',
  AWSAccessDenied = 'E2200',
  LambdaFunctionNotFound = 'E3100',
  CloudFrontDistributionNotFound = 'E4100',
  CacheBehaviorNotFound = 'E5100',
  CacheBehaviorPatternNotDefined = 'E5200',
  LambdaFunctionAssociationNotFound = 'E6100',
  LambdaFunctionARNNotFound = 'E7100',
  LambdaFunctionWrongNewVersionsCount = 'E8000',
  LambdaFunctionNewVersionNotActive = 'E8100',
}

export class ApiException extends Error {
  public readonly code: ErrorCode
  constructor(code: ErrorCode = ErrorCode.UnknownError) {
    super()
    this.code = code
  }
  get name() {
    return this.code
  }
}
