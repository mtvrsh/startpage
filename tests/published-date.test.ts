import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { parseRelativeMs } from '../startpage-api/src/router'

const NOW = new Date('2026-10-27T12:00:00Z').getTime()
const SEC = 1000
const MIN = 60 * SEC
const HOUR = 60 * MIN
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const MONTH = 30 * DAY
const YEAR = 365 * DAY

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

function expectAgo(text: string, ms: number) {
  expect(parseRelativeMs(text)).toBe(NOW - ms)
}

describe('parseRelativeMs', () => {
  test('parses the plain YouTube form', () => {
    expectAgo('1 day ago', DAY)
    expectAgo('3 days ago', 3 * DAY)
  })

  test('parses streamed / premiered prefixes', () => {
    expectAgo('Streamed 2 years ago', 2 * YEAR)
    expectAgo('Premiered 5 hours ago', 5 * HOUR)
    expectAgo('Streamed 11 months ago', 11 * MONTH)
    expectAgo('Premiered 2 weeks ago', 2 * WEEK)
    expectAgo('Streamed 3 minutes ago', 3 * MIN)
    expectAgo('Premiered 20 seconds ago', 20 * SEC)
  })

  test('parses compact abbreviations', () => {
    expectAgo('2y ago', 2 * YEAR)
    expectAgo('3mo ago', 3 * MONTH)
    expectAgo('1w ago', WEEK)
    expectAgo('4d ago', 4 * DAY)
    expectAgo('6h ago', 6 * HOUR)
    expectAgo('5m ago', 5 * MIN)
    expectAgo('45s ago', 45 * SEC)
  })

  test('distinguishes months (mo) from minutes (m)', () => {
    expectAgo('2 mo ago', 2 * MONTH)
    expectAgo('2 m ago', 2 * MIN)
    expectAgo('2 months ago', 2 * MONTH)
    expectAgo('2 minutes ago', 2 * MIN)
  })

  test('accepts singular, plural and alternate spellings', () => {
    expectAgo('1 hour ago', HOUR)
    expectAgo('2 hrs ago', 2 * HOUR)
    expectAgo('2 hr ago', 2 * HOUR)
    expectAgo('30 mins ago', 30 * MIN)
    expectAgo('30 secs ago', 30 * SEC)
    expectAgo('1 wk ago', WEEK)
    expectAgo('1 yr ago', YEAR)
  })

  test('skips leading non-unit tokens', () => {
    expectAgo('12K views 2 days ago', 2 * DAY)
    expectAgo('1.5M views, 3 hours ago', 3 * HOUR)
  })

  test('returns 0 when no date is present', () => {
    expect(parseRelativeMs('')).toBe(0)
    expect(parseRelativeMs('Live now')).toBe(0)
    expect(parseRelativeMs('12K views')).toBe(0)
    expect(parseRelativeMs('no date')).toBe(0)
  })
})
