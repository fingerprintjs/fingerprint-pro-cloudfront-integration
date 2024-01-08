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
}

export class ApiException extends Error {
  protected readonly code: ErrorCode
  constructor(code: ErrorCode = ErrorCode.UnknownError) {
    super()
    this.code = code
  }
  get name() {
    return this.code
  }
}
