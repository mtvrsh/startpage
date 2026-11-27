import config from '../config'

// `clients.claim()` in a newly activated worker fires `controllerchange` on the
// pages it takes over, but does not reload them: without this the deployed code
// only shows up on the *next* load. The very first install also claims the page,
// so only reload when a previous controller existed.
export function watchForServiceWorkerUpdates(reload: () => void) {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return

  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return
    reloading = true
    reload()
  })
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return

  // Attach before registering: the update check triggered by register() can
  // activate the new worker before register() resolves.
  watchForServiceWorkerUpdates(() => window.location.reload())
  navigator.serviceWorker.register(config.base + '/sw.js')
}
