import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { inlineRename } from '../src/lib/inline-rename'

let input: HTMLInputElement
let saved: string[]
let cancelled: number
let cleanup: (() => void) | undefined

beforeEach(() => {
  saved = []
  cancelled = 0
  input = document.createElement('input')
  input.value = 'initial'
  document.body.append(input)

  let result = inlineRename(input, {
    onSave: value => saved.push(value),
    onCancel: () => cancelled++
  })

  cleanup = () => {
    if (result && typeof result === 'object')
      result.destroy?.()

    input.remove()
  }
})

afterEach(() => {
  cleanup?.()
  cleanup = undefined
})

describe('inlineRename', () => {
  test('focuses and selects the input on mount', () => {
    expect(document.activeElement).toBe(input)
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe('initial'.length)
  })

  test('saves on Enter', () => {
    input.value = 'changed'

    let event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    input.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(saved).toEqual(['changed'])
  })

  test('saves on blur', () => {
    input.value = 'changed'
    input.blur()

    expect(saved).toEqual(['changed'])
  })

  test('cancels on Escape keyup', () => {
    input.value = 'changed'

    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true, cancelable: true }))

    expect(cancelled).toBe(1)
    expect(saved).toEqual([])
  })
})
