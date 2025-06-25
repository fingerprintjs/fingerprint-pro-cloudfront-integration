import { ProcessOpenClientResponseContext } from '../utils/registerPlugin'

export function logVisitor(context: ProcessOpenClientResponseContext) {
  if (!context.event?.products.identification?.data) {
    console.log('[Plugin.logVisitor] identification data not found')
    return
  }

  const visitorId = context.event.products.identification.data.visitorId
  const requestId = context.event.products.identification.data.requestId
  console.log(`[Plugin.logVisitor] visitorId:${visitorId}, requestId:(${requestId}).`)
}
