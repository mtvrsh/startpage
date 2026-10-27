import { describe, expect, test } from 'vitest'
import { parseStoredStatus } from '../src/share/status'

const idle = { feed: { fetching: { now: [], max: 0 }, fetchedAt: 0 } }

describe('parseStoredStatus', () => {
  test('returns idle defaults for missing or malformed data', () => {
    for (const raw of [
      undefined,
      null,
      'junk',
      [],
      { feed: null },
      { feed: { fetching: 'x' } },
      { feed: { fetching: { now: 'x', max: 'y' }, fetchedAt: 'z' } }
    ]) {
      expect(parseStoredStatus(raw)).toEqual(idle)
    }
  })

  test('keeps well-formed values and drops non-string ids', () => {
    expect(parseStoredStatus({
      feed: { fetching: { now: ['a', 1, null, 'b'], max: 3 }, fetchedAt: 123 }
    })).toEqual({ feed: { fetching: { now: ['a', 'b'], max: 3 }, fetchedAt: 123 } })
  })

  test('clamps negative numbers', () => {
    expect(parseStoredStatus({
      feed: { fetching: { now: [], max: -1 }, fetchedAt: -5 }
    })).toEqual(idle)
  })
})
