import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mount, tick, unmount } from 'svelte'
import SearchPalette from '../src/lib/SearchPalette.svelte'
import { app } from '../src/lib/state/app.svelte'
import { Channels } from '../src/share/channels'
import { config, defaults } from '../src/share/config'
import strings from '../src/share/strings'

const CHANNEL_URL = 'https://www.youtube.com/@AsmonTV/'

let target: HTMLDivElement
let component: ReturnType<typeof mount>

beforeEach(() => {
  // The palette debounces typing; fake timers keep the pending timer from
  // firing after the test and hitting a real network.
  vi.useFakeTimers()
  config.set({ ...structuredClone(defaults), instanceType: 'startpage' })
  app.searchOpen = false
  target = document.createElement('div')
  document.body.append(target)
  component = mount(SearchPalette, { target })
})

afterEach(() => {
  unmount(component)
  target.remove()
  app.searchOpen = false
  Channels.restore([])
  config.set(structuredClone(defaults))
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

async function openAndType(value: string) {
  app.searchOpen = true
  await tick()

  let input = target.querySelector<HTMLInputElement>('.palette__input')

  input!.value = value
  input!.dispatchEvent(new Event('input', { bubbles: true }))
  await tick()
}

async function submit() {
  target
    .querySelector('form')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

  // Flush the fetch promise chain without advancing to the debounce timer.
  for (let index = 0; index < 20; index++) await Promise.resolve()
  await tick()
}

describe('SearchPalette feedback', () => {
  test('shows the backend error when the search request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({ error: 'not found' }) })),
    )

    await openAndType('query')
    await submit()

    expect(target.querySelector('.palette__error')?.textContent).toBe('Search failed (HTTP 404)')
  })

  test('clears the error when a retry of the same query succeeds', async () => {
    let failing = true
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        failing
          ? { ok: false, status: 500, json: async () => ({}) }
          : { ok: true, status: 200, json: async () => [] },
      ),
    )

    await openAndType('query')
    await submit()
    expect(target.querySelector('.palette__error')?.textContent).toBe('Search failed (HTTP 500)')

    // Enter again without editing: the retry replaces both the error and the
    // stale empty state with the new outcome.
    failing = false
    await submit()

    expect(target.querySelector('.palette__error')).toBeNull()
    expect(target.querySelector('.palette__empty')?.textContent).toBe(strings.noChannelsFound)
  })

  test('shows a no-results message for a successful search with no channels', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => [] })),
    )

    await openAndType('query')
    await submit()

    expect(target.querySelector('.palette__error')).toBeNull()
    expect(target.querySelector('.palette__empty')?.textContent).toBe(strings.noChannelsFound)
  })

  test('does not show a stale no-results message after reopening', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => [] })),
    )

    await openAndType('query')
    await submit()
    expect(target.querySelector('.palette__empty')).not.toBeNull()

    app.searchOpen = false
    await tick()
    await openAndType('query')

    // The reopened palette knows nothing about the previous session's result:
    // the empty state must wait for this search, not reuse the old marker.
    expect(target.querySelector('.palette__empty')).toBeNull()
  })

  test('shows a failed channel add in the same error area', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('NetworkError when attempting to fetch resource.')
      }),
    )

    await openAndType(CHANNEL_URL)
    await submit()

    expect(target.querySelector('.palette__error')?.textContent).toBe(
      'NetworkError when attempting to fetch resource.',
    )
  })
})
