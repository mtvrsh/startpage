import { describe, it, expect } from 'vitest'
import { defaults, parseConfig } from '../src/share/config'

describe('Config', () => {
  it('Hides feed entry summaries by default', () => {
    expect(defaults.feedShowSummary).toBe(false)
  })
})

describe('parseConfig', () => {
  it('falls back to defaults for missing or non-object payloads', () => {
    for (const raw of [undefined, null, 'junk', 42, [], true]) {
      expect(parseConfig(raw)).toEqual(defaults)
    }
  })

  it('drops unknown keys', () => {
    expect(parseConfig({ unknown: true, keybind: { close: 'x', extra: 'y' } })).toEqual({
      ...defaults,
      keybind: { ...defaults.keybind, close: 'x' }
    })
  })

  it('rejects unknown backend types', () => {
    expect(parseConfig({ instanceType: 'unknown-backend' }).instanceType).toBe(defaults.instanceType)
    expect(parseConfig({ instanceType: 42 }).instanceType).toBe(defaults.instanceType)
  })

  it('demotes malformed instances and keeps valid ones', () => {
    const parsed = parseConfig({
      instance: { value: 'javascript:alert(1)', label: 'bad' },
      instances: [
        'junk',
        { value: 'javascript:alert(1)' },
        { value: 'https://ok.example', label: 'ok' },
        { value: 'https://unlabelled.example' }
      ]
    })

    expect(parsed.instance).toEqual(defaults.instance)
    expect(parsed.instances).toEqual([
      { value: 'https://ok.example', label: 'ok' },
      { value: 'https://unlabelled.example', label: 'https://unlabelled.example' }
    ])
  })

  it('falls back to default instances when none are valid', () => {
    expect(parseConfig({ instances: 'junk' }).instances).toEqual(defaults.instances)
    expect(parseConfig({ instances: [] }).instances).toEqual(defaults.instances)
    expect(parseConfig({ instances: [{ value: 'data:text/html,x' }] }).instances)
      .toEqual(defaults.instances)
  })

  it('coerces malformed scalars to their defaults', () => {
    const parsed = parseConfig({
      feedLimit: '5',
      readerLimit: -3,
      cacheLifetimeInMinutes: NaN,
      timeoutInSeconds: Infinity,
      feedShowSummary: 'yes',
      feedProtocolName: 42,
      backendUrl: null
    })

    expect(parsed.feedLimit).toBe(defaults.feedLimit)
    expect(parsed.readerLimit).toBe(0)
    expect(parsed.cacheLifetimeInMinutes).toBe(defaults.cacheLifetimeInMinutes)
    expect(parsed.timeoutInSeconds).toBe(defaults.timeoutInSeconds)
    expect(parsed.feedShowSummary).toBe(defaults.feedShowSummary)
    expect(parsed.feedProtocolName).toBe(defaults.feedProtocolName)
    expect(parsed.backendUrl).toBe(defaults.backendUrl)
  })

  it('raises a zero or negative timeout to the smallest usable value', () => {
    const issues: string[] = []

    expect(parseConfig({ timeoutInSeconds: 0 }, issues).timeoutInSeconds).toBe(1)
    expect(issues).toEqual(['config.timeoutInSeconds: expected a number of at least 1'])

    expect(parseConfig({ timeoutInSeconds: -5 }).timeoutInSeconds).toBe(1)
  })

  it('falls back to the default for non-integer numbers', () => {
    const issues: string[] = []

    expect(parseConfig({ feedLimit: 1.5 }, issues).feedLimit).toBe(defaults.feedLimit)
    expect(parseConfig({ readerLimit: NaN }, issues).readerLimit).toBe(defaults.readerLimit)
    expect(parseConfig({ cacheLifetimeInMinutes: null }, issues).cacheLifetimeInMinutes).toBe(defaults.cacheLifetimeInMinutes)
    expect(issues).toEqual(['config.feedLimit: expected a number', 'config.readerLimit: expected a number'])
    expect(parseConfig({ feedLimit: 3 }).feedLimit).toBe(3)
  })

  it('merges keybind fields individually', () => {
    const parsed = parseConfig({ keybind: { close: 42, focusSearch: { user: 'k' } } })

    expect(parsed.keybind.close).toBe(defaults.keybind.close)
    expect(parsed.keybind.focusSearch).toEqual({ user: 'k', default: 's' })
    expect(parsed.keybind.openSettings).toEqual(defaults.keybind.openSettings)
  })

  it('accepts a valid partial payload and fills the rest', () => {
    const parsed = parseConfig({
      instanceType: 'startpage',
      feedLimit: 5,
      useDirectThumbnails: true,
      keybind: { close: 'q', openSettings: { user: ',', default: ',' } }
    })

    expect(parsed).toEqual({
      ...defaults,
      instanceType: 'startpage',
      feedLimit: 5,
      useDirectThumbnails: true,
      keybind: {
        close: 'q',
        focusSearch: defaults.keybind.focusSearch,
        openSettings: { user: ',', default: ',' }
      }
    })
  })
})

describe('parseConfig strict mode', () => {
  it('reports nothing for a valid config', () => {
    const issues: string[] = []

    parseConfig(structuredClone(defaults), issues)

    expect(issues).toEqual([])
  })

  it('reports missing fields as fine and malformed fields as issues', () => {
    const issues: string[] = []
    const parsed = parseConfig({
      instanceType: 'unknown-backend',
      instance: null,
      instances: [1, { value: 'javascript:alert(1)' }],
      keybind: 'nope',
      feedLimit: 'many',
      readerLimit: -1,
      feedShowSummary: 'yes'
    }, issues)

    expect(issues).toEqual([
      'config.keybind: expected an object',
      'config.instanceType: expected a known backend',
      'config.instance: expected an object',
      'config.instances[0]: expected an object',
      'config.instances[1].value: expected an http(s) url',
      'config.feedLimit: expected a number',
      'config.readerLimit: expected a non-negative number',
      'config.feedShowSummary: expected a boolean'
    ])
    expect(parsed).toEqual({ ...defaults, readerLimit: 0 })
  })

  it('treats cleared number fields (null) as unset, not malformed', () => {
    const issues: string[] = []
    const parsed = parseConfig({
      feedLimit: null,
      readerLimit: null,
      cacheLifetimeInMinutes: null
    }, issues)

    expect(issues).toEqual([])
    expect(parsed.feedLimit).toBe(defaults.feedLimit)
    expect(parsed.readerLimit).toBe(defaults.readerLimit)
    expect(parsed.cacheLifetimeInMinutes).toBe(defaults.cacheLifetimeInMinutes)
  })
})
