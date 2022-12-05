const fs = require('fs')

const serializedData = JSON.stringify({
    sha: process.env.GITHUB_REAL_COMMIT_SHA
}, null, ' ')

fs.writeFile('./e2e/meta.json', serializedData, (err) => {
  if (err) {
    console.error(err)
  }
  // file written successfully
})
