# Startpage - Agent Knowledge Base

## Overview

Svelte-based startpage/homepage with YouTube feed powered by Piped API.
Originally used node with npm, I use deno now instead.

## Tech Stack

- **Framework**: Svelte 5 (SvelteKit-like structure)
- **Build**: Deno + Vite (`npm:vite`)
- **Language**: TypeScript
- **Styling**: SCSS
- **Storage**: LocalStorage (custom abstraction)
- **Testing**: Vitest with jsdom

## Commands

```bash
# Build
deno run -A npm:vite build
# or
deno task build

# Dev server
deno run -A npm:vite dev
# or
deno task dev
```

## Project Structure

- `src/lib/` - Svelte components
- `src/share/` - Stores (config, channels, bookmarks, status)
- `src/util/` - Utilities
- `src/lib/scss/` - Shared SCSS (variables, themes, mixins, breakpoints)
- `src/lib/inputs/` - Input components
- `src/lib/icons/` - Icon components
- `tests/` - Vitest tests

---

## Code Style Guidelines

### TypeScript

- **Always use TypeScript** in `.ts` files and `<script lang="ts">` in Svelte components
- **Explicit return types** are not required but encouraged for utility functions
- **Use interfaces** for object shapes (e.g., `Channel`, `Video`)
- **Use type exports** for shared types: `export type URL = string`
- **Avoid `any`** - use `unknown` or proper typing instead

### Svelte 5 Patterns

- **Use runes** (`$state`, `$derived`, `$effect`) for component state
- **Prefer `$derived`** over reactive `$:` statements
- **Use `$state()`** for mutable local state
- **Event handlers** should be defined as arrow functions in the script block

Example:
```svelte
<script lang="ts">
  let count = $state(0)
  let doubled = $derived(count * 2)

  let increment = () => count++
</script>
```

### SCSS/Styling

- **Use SCSS** with `lang="scss"` in Svelte components
- **Import variables** using: `@use 'scss/variables' as *;`
- **Use BEM naming** for component-scoped styles
- **Use nesting** for BEM child selectors
- **Use CSS custom properties** for theming (`var(--color-surface)`)
- **Use SCSS variables** for spacing (`$gap-0` through `$gap-4`)
- **Avoid absolute values** where possible - use variables

Example:
```scss
.search {
  position: relative;

  &__input {
    position: relative;
    z-index: 1;

    &:hover { ... }
    &:focus { ... }
  }

  &__output { ... }
}
```

### Testing

- **Use Vitest** with `describe`, `it`, `expect`
- **Mock browser APIs** - jsdom is configured by default in `vite.config.js`
- **Use `vi.spyOn`** for mocking console methods
- **Clean up** with `afterEach` to reset state between tests

Example:
```typescript
import { describe, it, expect, vi, afterEach } from 'vitest'

describe('LocalStorage', () => {
  it('Returns LS_NAME set in child class', () => {
    expect(Storage.ls_name()).toBe(STORAGE_NAME)
  })
})

afterEach(() => {
  localStorage.removeItem(STORAGE_NAME)
})
```

### Git Conventions

- **Commit messages** should be concise and descriptive
- **AI commits** should include attribution footer:
  ```
  Assisted-by: Model Name via Tool Name
  ```
- **Never commit secrets** - use environment variables or local configs

