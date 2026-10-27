import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mount, tick, unmount } from 'svelte'
import App from '../src/App.svelte'

let target: HTMLDivElement
let component: ReturnType<typeof mount>

let settingsButton = () =>
  target.querySelector<HTMLButtonElement>('button[aria-label="Settings"]')!

let hasSettings = () =>
  target.querySelector('[role="dialog"]') !== null

let historyGo = async (direction: 'back' | 'forward', path: string) => {
  history[direction]()
  await vi.waitFor(() => expect(location.pathname).toBe(path))
  await tick()
}

beforeEach(async () => {
  history.replaceState(null, '', '/startpage/')

  target = document.createElement('div')
  document.body.append(target)

  component = mount(App, { target })
  await tick()
})

afterEach(() => {
  unmount(component)
  target.remove()
})

// One `App` per file: `navaid` registers global history listeners on `listen()`
// and never removes them, so a second mount would double-handle navigation.
describe('App routing', () => {
  test('keeps route state in sync with browser navigation', async () => {
    settingsButton().click()
    await tick()

    expect(location.pathname).toBe('/startpage/settings')
    expect(hasSettings()).toBe(true)

    await historyGo('back', '/startpage/')
    expect(hasSettings()).toBe(false)

    await historyGo('forward', '/startpage/settings')
    expect(hasSettings()).toBe(true)

    await historyGo('back', '/startpage/')
    settingsButton().click()
    await tick()

    expect(location.pathname).toBe('/startpage/settings')
    expect(hasSettings()).toBe(true)
  })
})
