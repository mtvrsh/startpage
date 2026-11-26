import { afterEach, describe, expect, test } from 'vitest'
import { mount, tick, unmount } from 'svelte'
import Image from '../src/lib/Image.svelte'

let target: HTMLDivElement
let component: ReturnType<typeof mount>

function render(src: string) {
  target = document.createElement('div')
  document.body.append(target)
  component = mount(Image, { target, props: { src, alt: 'thumbnail' } })
}

afterEach(() => {
  unmount(component)
  target.remove()
})

describe('Image', () => {
  test('shows the fallback instead of a spinner for an empty src', async () => {
    render('')
    await tick()

    expect(target.querySelector('.image__fallback')).not.toBeNull()
    expect(target.querySelector('svg[viewBox="0 0 24 24"]')).toBeNull()
  })

  test('shows the fallback instead of a spinner for a missing src', async () => {
    render(undefined as unknown as string)
    await tick()

    expect(target.querySelector('.image__fallback')).not.toBeNull()
    expect(target.querySelector('svg[viewBox="0 0 24 24"]')).toBeNull()
  })

  test('shows a spinner until a real image loads', async () => {
    render('https://example.com/thumbnail.jpg')
    await tick()

    expect(target.querySelector('.image__fallback')).toBeNull()
    expect(target.querySelector('svg[viewBox="0 0 24 24"]')).not.toBeNull()

    target.querySelector('img')!.dispatchEvent(new Event('load'))
    await tick()

    expect(target.querySelector('svg[viewBox="0 0 24 24"]')).toBeNull()
  })
})
