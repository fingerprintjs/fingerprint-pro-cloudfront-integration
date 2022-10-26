import typescript from '@rollup/plugin-typescript'
import jsonPlugin from '@rollup/plugin-json'
import external from 'rollup-plugin-peer-deps-external'
import licensePlugin from 'rollup-plugin-license'
import dtsPlugin from 'rollup-plugin-dts'
import { join } from 'path'

const { dependencies = {} } = require('./package.json')
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
  plugins: [    
    jsonPlugin(),
    typescript(),
    external(),
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
    plugins: [dtsPlugin(), commonBanner],
    output: {
      file: `${outputDirectory}/${artifactName}.d.ts`,
      format: 'es',
    },
  },
]
