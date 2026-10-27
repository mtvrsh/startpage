import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { get } from 'svelte/store'
import { mount, tick, unmount } from 'svelte'
import SettingsGeneral from '../src/lib/SettingsGeneral.svelte'
import { config, defaults } from '../src/share/config'

let target: HTMLDivElement
let component: ReturnType<typeof mount>

beforeEach(() => {
  config.set(structuredClone(defaults))
  target = document.createElement('div')
  document.body.append(target)
  component = mount(SettingsGeneral, { target })
})

afterEach(() => {
  unmount(component)
  target.remove()
  config.set(structuredClone(defaults))
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

  test('falls back to the default for an unknown backend type', async () => {
    await importConfig({ config: { instanceType: 'unknown-backend' } })

    expect(get(config).instanceType).toBe(defaults.instanceType)
    expect(backendSelect().value).toBe(defaults.instanceType)
  })
})
