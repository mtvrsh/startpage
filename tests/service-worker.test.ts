import { afterEach, describe, expect, test, vi } from 'vitest'
import { registerServiceWorker, watchForServiceWorkerUpdates } from '../src/lib/service-worker'

type Listener = () => void

function stubNavigator(controller: unknown) {
  const listeners: Listener[] = []
  const register = vi.fn(async () => ({}) as ServiceWorkerRegistration)

  vi.stubGlobal('navigator', {
    serviceWorker: {
      controller,
      addEventListener: (_type: string, listener: Listener) => listeners.push(listener),
      register,
    },
  })

  return {
    listeners,
    register,
    emit: () => listeners.forEach((listener) => listener()),
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('watchForServiceWorkerUpdates', () => {
  test('ignores the claim of a first install', () => {
    const { listeners, emit } = stubNavigator(null)
    const reload = vi.fn()

    watchForServiceWorkerUpdates(reload)
    emit()

    expect(listeners).toHaveLength(0)
    expect(reload).not.toHaveBeenCalled()
  })

  test('reloads once when a new worker takes over', () => {
    const { emit } = stubNavigator({})
    const reload = vi.fn()

    watchForServiceWorkerUpdates(reload)
    emit()
    emit()

    expect(reload).toHaveBeenCalledTimes(1)
  })
})

describe('registerServiceWorker', () => {
  test('does not register outside production', () => {
    const { register } = stubNavigator(null)

    registerServiceWorker()

    expect(register).not.toHaveBeenCalled()
  })

  test('registers at the app base in production', () => {
    vi.stubEnv('PROD', true)
    const { register } = stubNavigator(null)

    registerServiceWorker()

    expect(register).toHaveBeenCalledWith('/startpage/sw.js')
  })
})
