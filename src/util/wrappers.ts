// https://svelte.dev/docs/svelte/v5-migration-guide#Event-changes-Event-modifiers

export function preventDefault(f: Function) {
  return function (this: HTMLElement, e: MouseEvent) {
    e.preventDefault()
    f.call(this, e)
  }
}
