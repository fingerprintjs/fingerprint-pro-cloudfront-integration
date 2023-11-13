export function arrayBufferToString(buffer: ArrayBuffer) {
  return Buffer.from(buffer).toString('utf8')
}
