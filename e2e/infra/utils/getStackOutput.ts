import * as fs from 'fs'
import * as path from 'path'

export function getStackOutput<T>(stackDirectory: string) {
  const exportPath = path.resolve(stackDirectory, 'stack.json')

  if (!fs.existsSync(exportPath)) {
    throw new Error(`Stack output file not found at ${exportPath}`)
  }

  const stackExport = JSON.parse(fs.readFileSync(exportPath, 'utf8'))
  const result = stackExport?.deployment?.resources?.[0]?.outputs

  if (!result) {
    throw new Error(`Stack output file does not contain any outputs at ${exportPath}`)
  }

  return result as T
}
