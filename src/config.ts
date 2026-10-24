import { BASE, NAME } from './constants'

export default {
  name: NAME,
  base: BASE,
  GH_PAGES_REDIRECT: 'redirect',
  search: {
    max: 5,
    delayInMs: 300,
  },
  fetching: {
    widthInVw: 5
  },
  version: import.meta.env.VITE_GIT_COMMIT,
}
