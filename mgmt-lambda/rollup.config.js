import typescript from '@rollup/plugin-typescript'
import jsonPlugin from '@rollup/plugin-json'
import external from 'rollup-plugin-peer-deps-external'
import dtsPlugin from 'rollup-plugin-dts'
const dotenv = require('dotenv')
dotenv.config()

const { dependencies = {} } = require('./package.json')

const inputFile = 'src/app.ts'
const outputDirectory = 'dist'
const artifactName = 'fingerprintjs-pro-cloudfront-mgmt-lambda-function'

const commonInput = {
  input: inputFile,
  plugins: [
    jsonPlugin(),
    typescript(),
    external(),
  ],
}

const commonOutput = {
  name: 'fingerprintjs-pro-cloudfront-mgmt-lambda-function',
  exports: 'named',
}

export default [
  {
    ...commonInput,
    external: Object.keys(dependencies),
    output: [
      {
        ...commonOutput,
        file: `${outputDirectory}/${artifactName}.js`,
        format: 'cjs',
      },
    ],
  },
  {
    ...commonInput,
    plugins: [dtsPlugin()],
    output: {
      file: `${outputDirectory}/${artifactName}.d.ts`,
      format: 'es',
    },
  },
]
