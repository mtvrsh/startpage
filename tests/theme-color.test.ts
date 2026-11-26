import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { mount, tick, unmount } from 'svelte'
import { compile } from 'sass-embedded'
import App from '../src/App.svelte'
import { app } from '../src/lib/state/app.svelte'

let target: HTMLDivElement
let component: ReturnType<typeof mount>

const themeMeta = () => document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!

function addThemeMeta() {
  const meta = document.createElement('meta')
  meta.name = 'theme-color'
  meta.content = ''
  document.head.append(meta)
  // The app reads the tokens through getComputedStyle; jsdom does not load
  // app.scss, so mirror the light values here. The token test below guards the
  // stylesheet itself.
  document.documentElement.style.setProperty('--color-bg', '#fbf1c7')
  document.documentElement.style.setProperty('--theme-color-overlay', '#7e7964')
}

// One `App` per file: `navaid` registers global history listeners on `listen()`
// and never removes them, so mounting twice would double-handle navigation.
// This is why the theme-color test lives here instead of routing.test.ts.
describe('theme-color meta', () => {
  beforeEach(async () => {
    history.replaceState(null, '', '/startpage/')

    target = document.createElement('div')
    document.body.append(target)
    addThemeMeta()

    component = mount(App, { target })
    await tick()
  })

  afterEach(() => {
    unmount(component)
    app.searchOpen = false
    target.remove()
    document.head.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.remove())
    document.documentElement.style.removeProperty('--color-bg')
    document.documentElement.style.removeProperty('--theme-color-overlay')
  })

  test('signals both modal overlays through theme-color', async () => {
    expect(themeMeta().content).toBe('#fbf1c7')

    target.querySelector<HTMLButtonElement>('button[aria-label="Settings"]')!.click()
    await tick()
    expect(themeMeta().content).toBe('#7e7964')

    target.querySelector<HTMLButtonElement>('.settings__close')!.click()
    await tick()
    expect(themeMeta().content).toBe('#fbf1c7')

    target.querySelector<HTMLButtonElement>('button[aria-label="Search"]')!.click()
    await tick()
    expect(themeMeta().content).toBe('#7e7964')
  })
})

// Guards the tokens the effect above reads: a rename or typo in app.scss would
// make the effect write an empty `content`, and the test above would still pass
// because it injects the values inline.
test('app.scss defines both theme-color tokens in light and dark schemes', () => {
  const { css } = compile('src/app.scss')
  const [light, dark] = css.split('@media (prefers-color-scheme: dark)')

  expect(dark).toBeDefined()

  for (const block of [light, dark])
    for (const token of ['--color-bg', '--theme-color-overlay'])
      expect(block).toMatch(new RegExp(`${token}:\\s*[^;}]+`))
})
