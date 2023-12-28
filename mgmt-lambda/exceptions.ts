export enum ErrorCode {
  UnknownError = 'E1000',
  AWSResourceNotFound = 'E2100',
  AWSAccessDenied = 'E2200',
  LambdaFunctionNotFound = 'E3100',
  LambdaFunctionAssociationNotFound = 'E6100',
  CloudFrontDistributionNotFound = 'E4100',
  CacheBehaviorNotFound = 'E5100',
  CacheBehaviorPatternNotDefined = 'E5200',
  FunctionARNNotFound = 'E7100',
}

export class ApiException extends Error {
  protected _code: ErrorCode
  constructor(code: ErrorCode = ErrorCode.UnknownError) {
    super()
    this._code = code
  }

  get code() {
    return this._code
  }
  get name() {
    return this._code
  }
}
