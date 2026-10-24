import type { Action } from 'svelte/action'

export interface InlineRenameParams {
  onSave: (value: string) => void
  onCancel: () => void
}

/**
 * Focuses the rename input on mount and provides the shared
 * Enter/Escape/blur behavior for feeds and channels.
 */
export const inlineRename: Action<HTMLInputElement, InlineRenameParams> = (node, params) => {
  let options = params

  node.focus()
  node.select()

  let save = () => options.onSave(node.value)
  let cancel = () => options.onCancel()

  let onKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter') return

    event.preventDefault()
    save()
  }

  // Keyup for Escape keeps the input mounted long enough for Closeable's
  // input guard to ignore the same key event.
  let onKeyup = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return

    event.preventDefault()
    event.stopPropagation()
    cancel()
  }

  let onBlur = () => save()

  node.addEventListener('keydown', onKeydown)
  node.addEventListener('keyup', onKeyup)
  node.addEventListener('blur', onBlur)

  return {
    update(next: InlineRenameParams) {
      options = next
    },
    destroy() {
      node.removeEventListener('keydown', onKeydown)
      node.removeEventListener('keyup', onKeyup)
      node.removeEventListener('blur', onBlur)
    }
  }
}
