export function isVisitorIdValid(visitorId: string) {
  return /^[a-zA-Z\d]{20}$/.test(visitorId)
}

export function isRequestIdValid(requestId: string) {
  return /^\d{13}\.[a-zA-Z\d]{6}$/.test(requestId)
}
