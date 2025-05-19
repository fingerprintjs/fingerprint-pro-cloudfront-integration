import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Zip from 'adm-zip'

const config = {
  owner: 'fingerprintjs',
  repo: 'fingerprint-pro-cloudfront-integration',
}

const dirname = path.dirname(fileURLToPath(import.meta.url))

const legacyPackageName = "package.zip"

const assetsToFind = [
  'mgmt_lambda_latest.zip',
  'lambda_latest.zip',
  
  // Legacy package
  legacyPackageName,
]

console.debug('dirname', dirname)

async function main() {
  const release = await getGitHubRelease()

  if (!release) {
    console.warn('No release found')

    return
  }

  console.info('Release', release.tag_name)

  const assets = await findAssets(release.assets)

  if (!assets?.length) {
    console.warn('No assets found')
    return
  }
  
  for (const asset of assets) {
    const zip = await downloadReleaseAsset(asset.url)
    const fileName = asset.name === legacyPackageName ? 'lambda_latest.zip' : asset.name

    if (process.env.UNPACK_TO_DIST) {
      new Zip(zip).extractAllTo(path.resolve(dirname, '../dist'), true)
    } else {
      fs.writeFileSync(path.resolve(dirname, '../', fileName), zip)
    }
  }
}

async function getGitHubRelease() {
  const tag = process.env.TAG

  if (!tag) {
    return getLatestGitHubRelease()
  }

  console.info('Using tag', tag)

  return getGitHubReleaseByTag(tag)
}
async function getGitHubReleaseByTag(tag) {
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/releases/tags/${tag}`

  console.debug('getGitHubReleaseByTag url', url)

  return await doGitHubGetRequest(url)
}
async function getLatestGitHubRelease() {
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/releases/latest`

  console.info('getLatestGitHubRelease url', url)

  return await doGitHubGetRequest(url)
}

async function doGitHubGetRequest(url) {
  const response = await fetch(url)

  return await response.json()
}

async function downloadReleaseAsset(url) {
  console.info('Downloading asset', url)
  
  const headers = {
    Accept: 'application/octet-stream',
    'User-Agent': 'fingerprint-pro-cloudfront-integration',
  }

  console.info('Downloading release asset...', url)

  const response = await fetch(url, { headers })

  const arrayBuffer = await response.arrayBuffer()

  console.info('Downloaded release asset')

  return Buffer.from(arrayBuffer)
}

export async function findAssets(assets) {
  return assets?.filter(
    (asset) =>  assetsToFind.includes(asset.name) && asset.state === 'uploaded' && asset.content_type === 'application/zip',
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
