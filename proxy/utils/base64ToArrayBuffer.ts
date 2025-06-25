export function base64ToArrayBuffer(body: string): ArrayBuffer {
  const buf = Buffer.from(body, 'base64')
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}
