const fs = require('fs')
const pkg = require('../../package.json')

const meta = {
  sha: process.env.GITHUB_REAL_COMMIT_SHA,
  version: pkg.version,
}

console.info('job info', meta)

const serializedData = JSON.stringify(meta, null, ' ')

fs.writeFile('./e2e/meta.json', serializedData, (err) => {
  if (err) {
    console.error(err)
  }
  // file written successfully
})
