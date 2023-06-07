import typescript from '@rollup/plugin-typescript'
import jsonPlugin from '@rollup/plugin-json'
import licensePlugin from 'rollup-plugin-license'
import dtsPlugin from 'rollup-plugin-dts'
import replace from '@rollup/plugin-replace'
import { join } from 'path'
import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'

const dotenv = require('dotenv')
dotenv.config()

const packageJson = require('./package.json')

const inputFile = 'src/app.ts'
const outputDirectory = 'dist'
const artifactName = 'fingerprintjs-pro-cloudfront-lambda-function'

const commonBanner = licensePlugin({
  banner: {
    content: {
      file: join(__dirname, 'assets', 'license_banner.txt'),
    },
  },
})

const commonInput = {
  input: inputFile,
  external: ['@aws-sdk/client-secrets-manager', 'https'],
  plugins: [
    jsonPlugin(),
    typescript(),
    nodeResolve({ preferBuiltins: false }),
    commonjs(),
    replace({
      __FPCDN__: process.env.FPCDN,
      __INGRESS_API__: process.env.INGRESS_API,
      __lambda_func_version__: packageJson.version,
      preventAssignment: true,
    }),
    commonBanner,
  ],
}

const commonOutput = {
  name: 'fingerprintjs-pro-cloudfront-lambda-function',
  exports: 'named',
}

export default [
  {
    ...commonInput,
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
    plugins: [dtsPlugin(), commonBanner],
    output: {
      file: `${outputDirectory}/${artifactName}.d.ts`,
      format: 'es',
    },
  },
]
