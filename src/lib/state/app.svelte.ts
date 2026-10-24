import config from '../../config'
import { getRedirectPathSetBy404Page } from '../../util/github'

export const app = $state({
  route: {
    path: getRedirectPathSetBy404Page() || window.location.pathname.replace(config.base, '') || '/'
  },
  filter: '',
  searchOpen: false
})
