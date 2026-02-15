import config from '../../config.ts'
import { getRedirectPathSetBy404Page } from '../../util/github.ts'

export const app = $state({
  route: {
    path: getRedirectPathSetBy404Page() || window.location.pathname.replace(config.base, '') || '/'
  },
  filter: ''
})
