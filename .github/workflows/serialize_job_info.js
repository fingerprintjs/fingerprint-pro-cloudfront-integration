const fs = require('fs')

// console.log(Object.keys(process.env).filter(key => key.includes('GITHUB')));
// console.log(process.env.GITHUB_REPOSITORY_OWNER);
// console.log(process.env.GITHUB_REPOSITORY);
// console.log(process.env.GITHUB_JOB);
// console.log(process.env.GITHUB_SERVER_URL);
// console.log(process.env.GITHUB_RUN_ID);
// console.log(process.env.GITHUB_BASE_REF);
// console.log(process.env.GITHUB_HEAD_REF);
// console.log(process.env.GITHUB_WORKSPACE);
// console.log(process.env.GITHUB_SHA);
//

// process.exit(0);
const serializedData = JSON.stringify({
    sha: process.env.GITHUB_SHA
}, null, ' ')

fs.writeFile('./dist/meta.json', serializedData, (err) => {
    if (err) {
        console.error(err);
    }
    // file written successfully
});