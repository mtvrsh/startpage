import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { get } from 'svelte/store'
import { mount, tick, unmount } from 'svelte'
import BookmarksColumn from '../src/lib/Bookmarks.svelte'
import Bookmarks, { bookmarks, type Bookmark } from '../src/share/bookmarks'

const first: Bookmark = {
  url: 'https://example.com/first',
  name: 'First',
  tag: 'one'
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
      tag: 'two'
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
    input!.dispatchEvent(new KeyboardEvent('keyup', {
      key: 'Escape',
      bubbles: true,
      cancelable: true
    }))
    await tick()

    expect(target.querySelector('.column__form')).toBeNull()
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
      tag: 'two'
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
