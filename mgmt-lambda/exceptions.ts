export enum ErrorCode {
  UnknownError = 'E1000',
  AWSResourceNotFound = 'E2100',
  AWSAccessDenied = 'E2200',
  LambdaFunctionNotFound = 'E3100',
  CloudFrontDistributionNotFound = 'E4100',
  CacheBehaviorNotFound = 'E5100',
  CacheBehaviorPatternNotDefined = 'E5200',
  LambdaFunctionAssociationNotFound = 'E6100',
  FunctionARNNotFound = 'E7100',
}

export class ApiException extends Error {
  protected _xErrorCode: ErrorCode
  constructor(code: ErrorCode = ErrorCode.UnknownError) {
    super()
    this._xErrorCode = code
  }

  get xErrorCode() {
    return this._xErrorCode
  }
  get name() {
    return this._xErrorCode
  }
}
