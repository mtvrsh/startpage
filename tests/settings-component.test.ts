import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { get } from 'svelte/store'
import { mount, tick, unmount } from 'svelte'
import SettingsGeneral from '../src/lib/SettingsGeneral.svelte'
import { config, defaults } from '../src/share/config'
import Bookmarks, { bookmarks } from '../src/share/bookmarks'
import { Channels, channels } from '../src/share/channels'
import { Feeds, feeds } from '../src/share/feeds'
import { buildConfigFile } from '../src/share/config-file'

let target: HTMLDivElement
let component: ReturnType<typeof mount>

function resetStores() {
  config.set(structuredClone(defaults))
  Bookmarks.restore([])
  Channels.restore([])
  Feeds.restore([])
}

beforeEach(() => {
  resetStores()
  target = document.createElement('div')
  document.body.append(target)
  component = mount(SettingsGeneral, { target })
})

afterEach(() => {
  unmount(component)
  target.remove()
  resetStores()
})

const backendSelect = () =>
  target.querySelector<HTMLSelectElement>('#settings-instance-type')!

async function importConfig(data: unknown) {
  const input = target.querySelector<HTMLInputElement>('input[type="file"]')!
  const file = new File([JSON.stringify(data)], 'config.json', {
    type: 'application/json'
  })
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  input.dispatchEvent(new Event('change', { bubbles: true }))
  await tick()
  await new Promise(resolve => setTimeout(resolve, 0))
  await tick()
}

describe('Settings config import', () => {
  test('applies and displays the imported backend type', async () => {
    expect(backendSelect().value).toBe('piped')

    await importConfig({ config: { instanceType: 'startpage' } })

    expect(get(config).instanceType).toBe('startpage')
    expect(backendSelect().value).toBe('startpage')
  })

  test('rejects an unknown backend type', async () => {
    await importConfig({ config: { instanceType: 'unknown-backend' } })

    expect(get(config).instanceType).toBe(defaults.instanceType)
    expect(backendSelect().value).toBe(defaults.instanceType)
    expect(target.querySelector('.general__error')).not.toBeNull()
  })

  test('rejects the whole payload when one section is malformed', async () => {
    config.set({ ...structuredClone(defaults), feedLimit: 12 })

    await importConfig({
      config: { instanceType: 'startpage' },
      bookmarks: [['https://key.example', { url: 'https://example.com', name: 'Example', tag: 't' }]],
      channels: [['https://youtube.com/@ok', { url: 'https://youtube.com/@ok', name: 'ok', displayName: 'Ok' }]],
      feeds: [null, 42, ['https://example.com/feed', null]]
    })

    expect(get(config).instanceType).toBe(defaults.instanceType)
    expect(get(config).feedLimit).toBe(12)
    expect(get(bookmarks).size).toBe(0)
    expect(get(channels).size).toBe(0)
    expect(get(feeds).size).toBe(0)
    expect(target.querySelector('.general__error')).not.toBeNull()
  })

  test('rejects malformed config fields without applying anything', async () => {
    config.set({ ...structuredClone(defaults), feedLimit: 12 })

    await importConfig({
      config: { instance: null, instances: 5, feedLimit: 'many', keybind: 'nope' }
    })

    const applied = get(config)
    expect(applied.instance).toEqual(defaults.instance)
    expect(applied.instances).toEqual(defaults.instances)
    expect(applied.feedLimit).toBe(12)
    expect(applied.keybind).toEqual(defaults.keybind)
    expect(target.querySelector('.general__error')).not.toBeNull()
  })

  test('rejects entries with unsafe urls', async () => {
    await importConfig({
      config: { instanceType: 'startpage' },
      bookmarks: [['javascript:alert(1)', { url: 'javascript:alert(1)', name: 'x' }]]
    })

    expect(get(config).instanceType).toBe(defaults.instanceType)
    expect(get(bookmarks).size).toBe(0)
    expect(target.querySelector('.general__error')).not.toBeNull()
  })

  test('leaves the stores untouched when the payload has no sections', async () => {
    config.set({ ...structuredClone(defaults), feedLimit: 12 })

    await importConfig(null)

    expect(get(config).feedLimit).toBe(12)
    expect(target.querySelector('.general__error')).toBeNull()
  })

  test('keeps config when the payload only carries other sections', async () => {
    config.set({ ...structuredClone(defaults), feedLimit: 12 })

    await importConfig({
      bookmarks: [['https://key.example', { url: 'https://example.com', name: 'E', tag: 't' }]]
    })

    expect(get(config).feedLimit).toBe(12)
    expect([...get(bookmarks).keys()]).toEqual(['https://example.com'])
    expect(target.querySelector('.general__error')).toBeNull()
  })

  test('accepts cleared number fields written by the settings inputs', async () => {
    await importConfig({ config: { feedLimit: null, readerLimit: null, cacheLifetimeInMinutes: null } })

    expect(get(config).feedLimit).toBe(defaults.feedLimit)
    expect(get(config).readerLimit).toBe(defaults.readerLimit)
    expect(get(config).cacheLifetimeInMinutes).toBe(defaults.cacheLifetimeInMinutes)
    expect(target.querySelector('.general__error')).toBeNull()
  })

  test('accepts legacy channels stored without a url', async () => {
    await importConfig({ channels: [['@legacy', { name: 'legacy', displayName: 'Legacy' }]] })

    expect(get(channels).get('@legacy')).toMatchObject({ url: '', name: 'legacy' })
    expect(target.querySelector('.general__error')).toBeNull()
  })

  test('imports a backup produced by the export helper', async () => {
    config.set({ ...structuredClone(defaults), feedLimit: null as unknown as number })
    Bookmarks.set({ url: 'javascript:alert(1)', tag: 't', name: 'unsafe' })
    Bookmarks.set({ url: 'https://example.com', tag: 't', name: 'ok' })
    Channels.addExisting('@legacy', { url: '', name: 'legacy', displayName: 'L', videos: [] })
    Feeds.restore([['https://example.com/feed', { url: 'https://example.com/feed', name: 'F' }]])

    await importConfig(buildConfigFile())

    expect(target.querySelector('.general__error')).toBeNull()
    expect(get(config).feedLimit).toBe(defaults.feedLimit)
    expect([...get(bookmarks).keys()]).toEqual(['https://example.com'])
    expect(get(channels).get('@legacy')?.url).toBe('')
    expect([...get(feeds).keys()]).toEqual(['https://example.com/feed'])
  })
})
