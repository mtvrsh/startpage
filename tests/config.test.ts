import { describe, it, expect } from 'vitest'
import { defaults } from '../src/share/config'

describe('Config', () => {
  it('Hides feed entry summaries by default', () => {
    expect(defaults.feedShowSummary).toBe(false)
  })
})
