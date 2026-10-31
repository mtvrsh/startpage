import config from '../config'

export function getRedirectPathSetBy404Page() {
  const redirectPath = localStorage[config.GH_PAGES_REDIRECT]

  if (!redirectPath) return

  localStorage.removeItem(config.GH_PAGES_REDIRECT)

  return redirectPath
}
