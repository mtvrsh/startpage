import { describe, it, expect, beforeAll } from 'vitest'
import { Config, config, defaults } from '../src/share/config'

describe('Config', () => {
  it('Updates local storage after store update', () => {
    config.update(s => ({...s, sto_zlotych: 'bierz'}))

    expect(
      Config.get()
    ).toHaveProperty('sto_zlotych', 'bierz')
  })

  it('Hides feed entry summaries by default', () => {
    expect(defaults.feedShowSummary).toBe(false)
  })
})

beforeAll(() => {
  Config.saveOnUpdate()
})
