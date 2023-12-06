import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Zip from 'adm-zip'

const config = {
  token: process.env.GITHUB_TOKEN,
  owner: 'fingerprintjs',
  repo: 'fingerprint-pro-cloudfront-integration',
}

const dirname = path.dirname(fileURLToPath(import.meta.url))

console.debug('dirname', dirname)

async function main() {
  const release = await getGitHubRelease()

  if (!release) {
    console.warn('No release found')

    return
  }

  console.info('Release', release.tag_name)

  const asset = await findFunctionZip(release.assets)

  if (!asset) {
    console.warn('No package.zip asset found')
    return
  }

  const zip = await downloadReleaseAsset(asset.url, config.token)

  if (process.env.UNPACK_TO_DIST) {
    new Zip(zip).extractAllTo(path.resolve(dirname, '../dist'), true)
  } else {
    fs.writeFileSync(path.resolve(dirname, '../package.zip'), zip)
  }
}

function bearer(token) {
  return `Bearer ${token}`
}

async function getGitHubRelease() {
  const commitId = process.env.COMMIT_ID

  if (!commitId) {
    return getLatestGitHubRelease()
  }

  console.info('Using commit id', commitId)

  return getGitHubReleaseByCommitId(commitId)
}

async function listTags() {
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/tags`

  console.debug('fetchTags url', url)

  return await doGitHubGetRequest(url)
}

async function getGitHubReleaseByCommitId(commitId) {
  const tag = await listTags().then((response) => findTagByCommitId(response, commitId))

  if (!tag) {
    throw new Error(`Tag for commit ${commitId} not found`)
  }

  return await getGitHubReleaseByTag(tag.name)
}

async function getGitHubReleaseByTag(tag) {
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/releases/tags/${tag}`

  console.debug('getGitHubReleaseByTag url', url)

  return await doGitHubGetRequest(url)
}

function findTagByCommitId(tags, commitId) {
  return tags.find((tag) => tag?.commit?.sha === commitId)
}

async function getLatestGitHubRelease() {
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/releases/latest`

  console.info('getLatestGitHubRelease url', url)

  return await doGitHubGetRequest(url)
}

async function doGitHubGetRequest(url) {
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
    'User-Agent': 'fingerprint-pro-cloudfront-integration',
  }
  if (token) {
    headers['Authorization'] = bearer(token)
  }

  console.info('Downloading release asset...', url)

  const response = await fetch(url, { headers })

  const arrayBuffer = await response.arrayBuffer()

  console.info('Downloaded release asset')

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
