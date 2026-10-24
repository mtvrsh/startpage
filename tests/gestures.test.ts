import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { editGesture, type EditGestureParams } from '../src/lib/gestures'

let node: HTMLButtonElement
let cleanup: (() => void) | undefined
let edits: number

let setup = (params: Partial<EditGestureParams> = {}) => {
  edits = 0
  node = document.createElement('button')
  document.body.append(node)

  let result = editGesture(node, { onEdit: () => edits++, ...params })

  cleanup = () => {
    if (result && typeof result === 'object')
      result.destroy?.()

    node.remove()
  }
}

let pointer = (type: string, init: PointerEventInit = {}) =>
  node.dispatchEvent(new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerType: 'touch',
    ...init
  }))

beforeEach(() => vi.useFakeTimers())

afterEach(() => {
  cleanup?.()
  cleanup = undefined
  vi.useRealTimers()
})

describe('editGesture', () => {
  test('starts editing on a normal click when clickToEdit is set', () => {
    setup({ clickToEdit: true })

    let click = new MouseEvent('click', { bubbles: true, cancelable: true })
    node.dispatchEvent(click)

    expect(edits).toBe(1)
    expect(click.defaultPrevented).toBe(true)
  })

  test('starts editing on right-click and prevents the context menu', () => {
    setup()

    let contextMenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    node.dispatchEvent(contextMenu)

    expect(edits).toBe(1)
    expect(contextMenu.defaultPrevented).toBe(true)
  })

  test('long-press starts editing and swallows the trailing click', () => {
    setup()

    pointer('pointerdown', { clientX: 0, clientY: 0 })
    vi.advanceTimersByTime(500)
    pointer('pointerup', { clientX: 0, clientY: 0 })

    expect(edits).toBe(1)

    let click = new MouseEvent('click', { bubbles: true, cancelable: true })
    node.dispatchEvent(click)

    expect(click.defaultPrevented).toBe(true)
    expect(edits).toBe(1)
  })

  test('does not start editing on a short tap', () => {
    setup()

    pointer('pointerdown', { clientX: 0, clientY: 0 })
    pointer('pointerup', { clientX: 0, clientY: 0 })

    expect(edits).toBe(0)
  })

  test('cancels a long-press when the pointer moves', () => {
    setup()

    pointer('pointerdown', { clientX: 0, clientY: 0 })
    pointer('pointermove', { clientX: 20, clientY: 0 })
    pointer('pointerup', { clientX: 20, clientY: 0 })

    expect(edits).toBe(0)
  })

  test('keeps suppressing the trailing click after the label is destroyed', () => {
    setup()

    pointer('pointerdown', { clientX: 0, clientY: 0 })
    vi.advanceTimersByTime(500)
    pointer('pointerup', { clientX: 0, clientY: 0 })

    // Starting the edit unmounts the label and destroys the action.
    cleanup?.()
    cleanup = undefined

    let click = new MouseEvent('click', { bubbles: true, cancelable: true })
    document.body.dispatchEvent(click)

    expect(click.defaultPrevented).toBe(true)
  })
})
