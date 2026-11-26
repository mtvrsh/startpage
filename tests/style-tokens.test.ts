import { describe, expect, test } from 'vitest'

// Raw component sources, including their style blocks. Vite's glob keeps this
// test independent of the Node fs typings, which the app tsconfig does not use.
const components = Object.entries(
  import.meta.glob('../src/**/*.svelte', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>,
)

const declarations = (source: string, property: string) =>
  source.matchAll(new RegExp(`${property}:\\s*([^;]+);`, 'g'))

// Global tokens and mixins own the palette, the font scale and font weight.
// Component styles must consume them instead of growing their own variants.
describe('component style tokens', () => {
  test('uses only the font-size scale', () => {
    for (const [file, source] of components) {
      for (const match of declarations(source, 'font-size')) {
        expect(match[1].trim(), `${file}: ${match[0]}`).toMatch(/^\$font-size-/)
      }
    }
  })

  test('uses only the line-height scale', () => {
    for (const [file, source] of components) {
      for (const match of declarations(source, 'line-height')) {
        expect(match[1].trim(), `${file}: ${match[0]}`).toMatch(/^\$line-height-/)
      }
    }
  })

  test('does not hardcode colors', () => {
    for (const [file, source] of components) {
      expect(source, file).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/)
    }
  })

  test('leaves font weight to the global stylesheet', () => {
    for (const [file, source] of components) {
      expect([...declarations(source, 'font-weight')], file).toEqual([])
    }
  })
})
