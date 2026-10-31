import { describe, it, expect, vi, afterAll, afterEach } from 'vitest'
import { LocalStorage } from '../src/util/storage'

const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation((m) => m)

const STORAGE_NAME = 'studnia_maklowicza'
const STORAGE_VALUE = { hohoho: 'https://youtu.be/iVgI6_h0LkU?t=569' }
const STORAGE_VALUE_SERIALIZED = JSON.stringify(STORAGE_VALUE)

class Storage extends LocalStorage {
  static LS_NAME = STORAGE_NAME
}
class StorageWithoutName extends LocalStorage {}

describe('LocalStorage', () => {
  it('Returns LS_NAME set in child class', () => {
    expect(Storage.ls_name()).toBe(STORAGE_NAME)
  })

  it('Throws error when LS_NAME is not set in child class', () => {
    expect(() => StorageWithoutName.ls_name()).toThrow('undefined')
  })

  it('Returns local storage value', () => {
    localStorage.setItem(STORAGE_NAME, STORAGE_VALUE_SERIALIZED)

    expect(Storage.get()).toStrictEqual(STORAGE_VALUE)
  })

  it('Returns undefined when local storage value is not set', () => {
    /* Local storage value resets after each test */

    expect(Storage.get()).toBeUndefined()
  })

  it('Returns undefined when local storage value has syntax error', () => {
    localStorage.setItem(STORAGE_NAME, STORAGE_VALUE_SERIALIZED + 'awdgb')

    expect(Storage.get()).toBeUndefined()
  })

  it('Prints error message when local storage value has syntax error', () => {
    localStorage.setItem(STORAGE_NAME, STORAGE_VALUE_SERIALIZED + 'awdgb')

    Storage.get()

    expect(consoleErrorMock).toHaveBeenCalledWith('Failed to parse Storage local storage')
  })

  it('Sets serializable object in local storage', () => {
    Storage.set(STORAGE_VALUE)

    expect(localStorage.getItem(STORAGE_NAME)).toBe(STORAGE_VALUE_SERIALIZED)
  })
})

afterAll(() => {
  vi.resetAllMocks()
})

afterEach(() => {
  localStorage.removeItem(STORAGE_NAME)
})
