import { describe, expect, test } from 'vitest'
import { isTypedCharacter } from '../src/util/keyboard'

function eventFor(
  target: HTMLElement,
  key: string,
  init: KeyboardEventInit = {}
) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, ...init })
  // KeyboardEvent.target is read-only and only set while dispatching.
  Object.defineProperty(event, 'target', { value: target, configurable: true })
  return event
}

describe('isTypedCharacter', () => {
  test('is true for characters typed into text-like inputs', () => {
    for (const type of ['text', 'number', 'url', 'search', 'email', 'password']) {
      const input = document.createElement('input')
      input.type = type
      document.body.append(input)

      expect(isTypedCharacter(eventFor(input, 'q'))).toBe(true)

      input.remove()
    }
  })

  test('is true inside textareas and contenteditable elements', () => {
    const textarea = document.createElement('textarea')
    const editable = document.createElement('div')
    editable.contentEditable = 'true'
    // jsdom does not implement isContentEditable.
    Object.defineProperty(editable, 'isContentEditable', { value: true })
    document.body.append(textarea, editable)

    expect(isTypedCharacter(eventFor(textarea, 'q'))).toBe(true)
    expect(isTypedCharacter(eventFor(editable, 'q'))).toBe(true)

    textarea.remove()
    editable.remove()
  })

  test('is false for buttons, checkboxes, radios, and other targets', () => {
    const button = document.createElement('button')
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    const div = document.createElement('div')
    document.body.append(button, checkbox, div)

    expect(isTypedCharacter(eventFor(button, 'q'))).toBe(false)
    expect(isTypedCharacter(eventFor(checkbox, 'q'))).toBe(false)
    expect(isTypedCharacter(eventFor(div, 'q'))).toBe(false)

    button.remove()
    checkbox.remove()
    div.remove()
  })

  test('is false for named keys and modifier combos, so shortcuts survive', () => {
    const input = document.createElement('input')
    document.body.append(input)

    expect(isTypedCharacter(eventFor(input, 'Escape'))).toBe(false)
    expect(isTypedCharacter(eventFor(input, 'Tab'))).toBe(false)
    expect(isTypedCharacter(eventFor(input, 'ArrowDown'))).toBe(false)
    expect(isTypedCharacter(eventFor(input, 'q', { ctrlKey: true }))).toBe(false)
    expect(isTypedCharacter(eventFor(input, 'q', { altKey: true }))).toBe(false)
    expect(isTypedCharacter(eventFor(input, 'q', { metaKey: true }))).toBe(false)

    input.remove()
  })
})
