import { Plugin } from '../utils/registerPlugin'
import { logVisitor } from './logVisitor'

export default [
  {
    name: 'Log visitor ID',
    callback: logVisitor,
    type: 'processOpenClientResponse',
  },
] satisfies Plugin[]
