import typescript from '@rollup/plugin-typescript'
import jsonPlugin from '@rollup/plugin-json'
import licensePlugin from 'rollup-plugin-license'
import dtsPlugin from 'rollup-plugin-dts'
import replace from '@rollup/plugin-replace'
import { join } from 'path'
import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import packageJson from './package.json'
import dotenv from 'dotenv'

dotenv.config()

const outputDirectory = 'dist'

function makeConfig(entryFile, artifactName) {
  const commonBanner = licensePlugin({
    banner: {
      content: {
        file: join('assets', 'license_banner.txt'),
      },
    },
  })

  /**
   * @type {import('rollup').RollupOptions}
   * */
  const commonInput = {
    input: entryFile,
    external: ['aws-sdk', 'https'],
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

  /**
   * @type {import('rollup').OutputOptions}
   * */
  const commonOutput = {
    exports: 'named',
    sourcemap: true,
  }

  return [
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
}

export default [
  ...makeConfig('proxy/app.ts', 'fingerprintjs-pro-cloudfront-lambda-function'),
  ...makeConfig('mgmt-lambda/app.ts', 'fingerprintjs-pro-cloudfront-mgmt-lambda-function'),
]
