import config from '../../config'
import strings from '../../share/strings'
import { getRedirectPathSetBy404Page } from '../../util/github'

export const app = $state({
  route: {
    path: getRedirectPathSetBy404Page() || window.location.pathname.replace(config.base, '') || '/'
  },
  // Same sentinel as the "All" entry in the channel filter dropdown, so an
  // unfiltered boot looks identical to picking "All" (which hides that row).
  filter: strings.allKebabCase,
  searchOpen: false
})
