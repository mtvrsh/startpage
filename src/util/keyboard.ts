/**
 * True when the event is a plain character that a focused editable element
 * consumes as input. Named keys (Escape, Tab, F1, …) and modifier combos
 * return false, so shortcuts keep working from inside fields.
 */
export function isTypedCharacter(event: KeyboardEvent): boolean {
  if (event.key.length !== 1) return false
  if (event.ctrlKey || event.metaKey || event.altKey) return false

  const target = event.target

  if (!(target instanceof HTMLElement)) return false

  if (target.isContentEditable) return true

  const tagName = target.tagName.toLowerCase()
  if (tagName === 'textarea') return true
  if (tagName !== 'input') return false

  const type = (target as HTMLInputElement).type
  return !['button', 'submit', 'checkbox', 'radio'].includes(type)
}
