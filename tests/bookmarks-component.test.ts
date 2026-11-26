import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { get } from 'svelte/store'
import { mount, tick, unmount } from 'svelte'
import BookmarksColumn from '../src/lib/Bookmarks.svelte'
import Bookmarks, { bookmarks, type Bookmark } from '../src/share/bookmarks'
import { config, defaults } from '../src/share/config'

const first: Bookmark = {
  url: 'https://example.com/first',
  name: 'First',
  tag: 'one',
}

let target: HTMLDivElement
let component: ReturnType<typeof mount>

beforeEach(() => {
  Bookmarks.restore([[first.url, first]])
  target = document.createElement('div')
  document.body.append(target)
  component = mount(BookmarksColumn, { target })
})

afterEach(() => {
  unmount(component)
  target.remove()
  Bookmarks.restore([])
})

describe('Bookmarks column editor', () => {
  test('normalizes a schemeless URL so the SPA router does not swallow it', async () => {
    const addButton = target.querySelector<HTMLButtonElement>('.column__add')!
    addButton.click()
    await tick()

    const [nameInput, tagInput, urlInput] =
      target.querySelectorAll<HTMLInputElement>('.column__form input')
    nameInput.value = 'Example'
    tagInput.value = 'News'
    urlInput.value = 'example.com/foo'
    for (const input of [nameInput, tagInput, urlInput])
      input.dispatchEvent(new Event('input', { bubbles: true }))

    target
      .querySelector<HTMLFormElement>('.column__form form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await tick()

    expect(get(bookmarks).has('https://example.com/foo')).toBe(true)
    const link = [...target.querySelectorAll<HTMLAnchorElement>('.bookmarks__link')].find(
      (a) => a.textContent === 'Example',
    )!
    expect(link.getAttribute('href')).toBe('https://example.com/foo')
  })

  test('accepts a schemeless URL with a port', async () => {
    const addButton = target.querySelector<HTMLButtonElement>('.column__add')!
    addButton.click()
    await tick()

    const [nameInput, tagInput, urlInput] =
      target.querySelectorAll<HTMLInputElement>('.column__form input')
    nameInput.value = 'Local'
    tagInput.value = 'Dev'
    urlInput.value = 'localhost:3000/dashboard'
    for (const input of [nameInput, tagInput, urlInput])
      input.dispatchEvent(new Event('input', { bubbles: true }))

    target
      .querySelector<HTMLFormElement>('.column__form form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await tick()

    expect(get(bookmarks).has('https://localhost:3000/dashboard')).toBe(true)
    const link = [...target.querySelectorAll<HTMLAnchorElement>('.bookmarks__link')].find(
      (a) => a.textContent === 'Local',
    )!
    expect(link.getAttribute('href')).toBe('https://localhost:3000/dashboard')
  })

  test('opens on right-click and saves name, tag, and URL changes', async () => {
    let link = target.querySelector<HTMLAnchorElement>('.bookmarks__link')

    expect(link).not.toBeNull()

    let contextMenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    link!.dispatchEvent(contextMenu)

    expect(contextMenu.defaultPrevented).toBe(true)

    let form = target.querySelector<HTMLFormElement>('.bookmarks__edit')

    expect(form).not.toBeNull()

    let [nameInput, tagInput, urlInput] = [...form!.querySelectorAll('input')] as HTMLInputElement[]

    expect(document.activeElement).toBe(nameInput)

    nameInput.value = 'Renamed'
    nameInput.dispatchEvent(new Event('input', { bubbles: true }))

    tagInput.value = 'two'
    tagInput.dispatchEvent(new Event('input', { bubbles: true }))

    urlInput.value = 'https://example.com/second'
    urlInput.dispatchEvent(new Event('input', { bubbles: true }))

    form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await tick()

    expect(get(bookmarks).has(first.url)).toBe(false)
    expect(get(bookmarks).get('https://example.com/second')).toEqual({
      url: 'https://example.com/second',
      name: 'Renamed',
      tag: 'two',
    })
  })

  test('closes the add form when the close key is pressed', async () => {
    let addButton = target.querySelector<HTMLButtonElement>('.column__add')

    expect(addButton).not.toBeNull()

    addButton!.click()
    await tick()

    let form = target.querySelector<HTMLFormElement>('.column__form form')
    let input = form?.querySelector<HTMLInputElement>('input')

    expect(form).not.toBeNull()
    expect(input).not.toBeNull()

    input!.focus()
    input!.dispatchEvent(
      new KeyboardEvent('keyup', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    )
    await tick()

    expect(target.querySelector('.column__form')).toBeNull()
  })

  test('does not close the add form while typing a plain-character close key', async () => {
    config.set({
      ...structuredClone(defaults),
      keybind: { ...structuredClone(defaults.keybind), close: 'q' },
    })
    const addButton = target.querySelector<HTMLButtonElement>('.column__add')!
    addButton.click()
    await tick()

    const input = target.querySelector<HTMLInputElement>('.column__form input')!
    input.focus()
    input.value = 'q'
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'q', bubbles: true, cancelable: true }))
    await tick()

    expect(target.querySelector('.column__form')).not.toBeNull()
    config.set(structuredClone(defaults))
  })

  test('closes the add form when clicking outside', async () => {
    let addButton = target.querySelector<HTMLButtonElement>('.column__add')

    expect(addButton).not.toBeNull()

    addButton!.click()
    await tick()

    let input = target.querySelector<HTMLInputElement>('.column__form input')

    expect(input).not.toBeNull()

    input!.click()
    await tick()

    expect(target.querySelector('.column__form')).not.toBeNull()

    target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await tick()

    expect(target.querySelector('.column__form')).toBeNull()
  })

  test('refuses a URL that belongs to another bookmark', async () => {
    let other: Bookmark = {
      url: 'https://example.com/other',
      name: 'Other',
      tag: 'two',
    }

    Bookmarks.set(other)

    let link = target.querySelector<HTMLAnchorElement>('.bookmarks__link')
    link!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))

    let form = target.querySelector<HTMLFormElement>('.bookmarks__edit')!
    let urlInput = form.querySelectorAll<HTMLInputElement>('input')[2]

    urlInput.value = other.url
    urlInput.dispatchEvent(new Event('input', { bubbles: true }))
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await tick()

    expect(get(bookmarks).get(first.url)).toEqual(first)
    expect(get(bookmarks).get(other.url)).toEqual(other)
    expect(target.querySelector('.column__error')?.textContent).toBe('Bookmark already exists')
  })
})
