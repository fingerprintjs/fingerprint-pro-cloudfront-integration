import * as path from 'path'
import * as fs from 'fs'

export type TerraformOutputValue = {
  sensitive: boolean
  value: string
}

export type TerraformOutput = {
  cloudfront_with_headers_url: TerraformOutputValue
  cloudfront_with_secret_url: TerraformOutputValue
}

const FILE_NAME = 'infra.json'
const terraformDirectory = path.resolve(__dirname, '../../../infra/terraform')

export function readTerraformOutput() {
  const filePath = path.join(terraformDirectory, FILE_NAME)
  if (!fs.existsSync(filePath)) {
    throw new Error(`File ${filePath} does not exist. Did you forgot to run: terraform output -json > ./infra.json ?`)
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as TerraformOutput
}
