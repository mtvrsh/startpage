import type { Action } from 'svelte/action'

export interface EditGestureParams {
  onEdit: () => void
  clickToEdit?: boolean
}

const LONG_PRESS_MS = 500
const MOVE_TOLERANCE_PX = 10
const SUPPRESS_CLICK_MS = 500

/**
 * Starts editing on right-click (desktop), long-press (touch), or optionally
 * a normal click. A long-press swallows the click it would otherwise produce,
 * so the label's primary action (filter/open) does not also run.
 */
export const editGesture: Action<HTMLElement, EditGestureParams> = (node, params) => {
  let options = params
  let pressStartedAt = 0
  let startX = 0
  let startY = 0
  let pressTimer: ReturnType<typeof setTimeout> | undefined
  let suppressTimer: ReturnType<typeof setTimeout> | undefined
  let timerFired = false
  let editStarted = false

  let clearPressTimer = () => {
    if (pressTimer === undefined) return

    clearTimeout(pressTimer)
    pressTimer = undefined
  }

  let removeClickSuppressor = () => {
    window.removeEventListener('click', swallowClick, true)

    if (suppressTimer === undefined) return

    clearTimeout(suppressTimer)
    suppressTimer = undefined
  }

  let swallowClick = (event: MouseEvent) => {
    event.preventDefault()
    event.stopImmediatePropagation()
    removeClickSuppressor()
  }

  let suppressNextClick = () => {
    window.addEventListener('click', swallowClick, true)

    if (suppressTimer !== undefined)
      clearTimeout(suppressTimer)

    suppressTimer = setTimeout(removeClickSuppressor, SUPPRESS_CLICK_MS)
  }

  let startEdit = () => {
    if (editStarted) return

    editStarted = true
    options.onEdit()
  }

  let onPointerDown = (event: PointerEvent) => {
    editStarted = false

    // Mouse presses are handled by contextmenu/click, not long-press.
    if (event.pointerType === 'mouse') return

    pressStartedAt = Date.now()
    startX = event.clientX
    startY = event.clientY
    timerFired = false

    clearPressTimer()
    pressTimer = setTimeout(() => {
      timerFired = true
      navigator.vibrate?.(10)
    }, LONG_PRESS_MS)
  }

  let onPointerMove = (event: PointerEvent) => {
    if (!pressStartedAt) return
    if (Math.hypot(event.clientX - startX, event.clientY - startY) <= MOVE_TOLERANCE_PX) return

    clearPressTimer()
    timerFired = false
    pressStartedAt = 0
  }

  let onPointerUp = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') return

    let isLongPress = timerFired || (!!pressStartedAt && Date.now() - pressStartedAt >= LONG_PRESS_MS)

    clearPressTimer()
    timerFired = false
    pressStartedAt = 0

    if (!isLongPress || editStarted) return

    // Editing starts on release so focus still counts as a user gesture on iOS.
    suppressNextClick()
    startEdit()
  }

  let onPointerCancel = () => {
    clearPressTimer()
    timerFired = false
    pressStartedAt = 0
  }

  let onContextMenu = (event: MouseEvent) => {
    event.preventDefault()

    if (editStarted) return

    // Touch long-press: wait for pointerup so the label is not unmounted
    // while the finger is still down. The click suppressor is armed there.
    if (pressStartedAt) return

    startEdit()
  }

  let onClick = (event: MouseEvent) => {
    if (!options.clickToEdit) return

    event.preventDefault()
    startEdit()
  }

  node.addEventListener('pointerdown', onPointerDown)
  node.addEventListener('pointermove', onPointerMove)
  node.addEventListener('pointerup', onPointerUp)
  node.addEventListener('pointercancel', onPointerCancel)
  node.addEventListener('contextmenu', onContextMenu)
  node.addEventListener('click', onClick)

  return {
    update(next: EditGestureParams) {
      options = next
    },
    destroy() {
      clearPressTimer()
      // Do not remove the click suppressor here: starting an edit unmounts
      // the label, and the trailing long-press click still needs swallowing.
      // It removes itself on the next click or after SUPPRESS_CLICK_MS.
      node.removeEventListener('pointerdown', onPointerDown)
      node.removeEventListener('pointermove', onPointerMove)
      node.removeEventListener('pointerup', onPointerUp)
      node.removeEventListener('pointercancel', onPointerCancel)
      node.removeEventListener('contextmenu', onContextMenu)
      node.removeEventListener('click', onClick)
    }
  }
}
