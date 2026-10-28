<script lang="ts">
  import type { Snippet } from 'svelte'
  import { config } from '../share/config'
  import strings from '../share/strings'

  let {
    title,
    addTitle = strings.add,
    adding = $bindable(false),
    form,
    actions,
    children
  }: {
    title: string
    addTitle?: string
    adding?: boolean
    form?: Snippet
    actions?: Snippet
    children: Snippet
  } = $props()

  let formContainer = $state<HTMLElement>()
  let addButton = $state<HTMLButtonElement>()

  let closeFormIfPressedCloseKey = (event: KeyboardEvent) => {
    if (!adding || event.key !== $config.keybind.close) return

    event.preventDefault()
    adding = false
  }

  let closeFormIfClickedOutside = (event: MouseEvent) => {
    if (!adding) return

    let target = event.target as Node

    if (formContainer?.contains(target) || addButton?.contains(target)) return

    adding = false
  }
</script>

<svelte:window
  onkeyup={closeFormIfPressedCloseKey}
  onclick={closeFormIfClickedOutside}
/>

<section class="column">
  <header class="column__header">
    <h2 class="column__title">{title}</h2>

    <div class="column__actions">
      {@render actions?.()}

      {#if form}
        <button
          bind:this={addButton}
          class="column__action column__add"
          class:open={adding}
          type="button"
          title={addTitle}
          aria-label={addTitle}
          aria-expanded={adding}
          onclick={() => adding = !adding}
        >{adding ? '−' : '+'}</button>
      {/if}
    </div>
  </header>

  {#if adding && form}
    <div class="column__form" bind:this={formContainer}>
      {@render form()}
    </div>
  {/if}

  <div class="column__body">
    {@render children()}
  </div>
</section>

<style lang="scss">
  @use 'scss/variables' as *;

  .column {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;

    &__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: $gap-1;
      padding: $gap-1;
      border-bottom: $border var(--color-surface);
    }

    &__title {
      min-width: 0;
      overflow: hidden;
      font-size: $font-size-item-title;
      color: var(--color-fg-inactive);
      white-space: nowrap;
      text-overflow: ellipsis;
      user-select: none;
    }

    &__actions {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      gap: $gap-0;
    }

    &__add {
      width: 1.5rem;
      padding: 0;
      justify-content: center;
      font-size: $font-size-icon;

      &.open {
        color: var(--color-accent-fg);
        background: var(--color-accent-light);
      }
    }

    &__form {
      padding: $gap-1;
      border-bottom: $border var(--color-surface);
    }

    &__body {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
      overflow-y: auto;
    }
  }
</style>
