import fs from 'fs'
import path from 'path'

const config = {
  token: process.env.GITHUB_TOKEN,
  owner: 'fingerprintjs',
  repo: 'fingerprint-pro-cloudfront-integration',
}

const dirname = import.meta.url.replace('file://', '')

console.debug('dirname', dirname)

async function main() {
  const release = await getLatestGithubRelease()

  if (!release) {
    console.warn('No release found')

    return
  }

  console.info('Release', release)

  const asset = await findFunctionZip(release.assets)

  if (!asset) {
    console.warn('No package.zip asset found')
    return
  }

  const zip = await downloadReleaseAsset(asset.url, config.token)

  fs.writeFileSync(path.resolve(dirname, 'package.zip'), zip)
}

function bearer() {
  return `Bearer ${token}`
}

async function getLatestGithubRelease() {
  const url = `https://api.github.com/repos/${config.owner}/${config.reoo}/releases/latest`

  console.info('url', url)

  const response = await fetch(url, {
    headers: config.token
      ? {
          Authorization: bearer(config.token),
        }
      : undefined,
  })

  return await response.json()
}

async function downloadReleaseAsset(url, token) {
  const headers = {
    Accept: 'application/octet-stream',
    'User-Agent': 'fingerprint-pro-azure-integration',
  }
  if (token) {
    headers['Authorization'] = bearer(token)
  }

  const response = await fetch(url, { headers })

  const arrayBuffer = await response.arrayBuffer()

  return Buffer.from(arrayBuffer)
}

export async function findFunctionZip(assets) {
  return assets?.find(
    (asset) => asset.name === 'package.zip' && asset.state === 'uploaded' && asset.content_type === 'application/zip',
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
