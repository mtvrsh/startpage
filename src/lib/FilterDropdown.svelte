<script lang="ts">
  import { flushSync } from 'svelte'
  import strings from '../share/strings'
  import Closeable from './Closeable.svelte'
  import { editGesture } from './gestures'
  import { inlineRename } from './inline-rename'

  export interface FilterItem {
    id: string
    label: string
    /** Show a loading indicator dot. */
    loading?: boolean
    /** Show an error indicator dot with this message as its tooltip. */
    error?: string
    /** Placeholder for the rename input (e.g. the raw URL when renamed). */
    placeholder?: string
  }

  let {
    items,
    selectedId,
    allId,
    allLabel = strings.all,
    onselect,
    onremove,
    onrename,
    renameLabel,
    renameHint
  }: {
    items: FilterItem[]
    selectedId: string
    /** The "show everything" id; when set, an "All" row is shown unless selected. */
    allId?: string
    allLabel?: string
    onselect: (id: string) => void
    onremove?: (id: string) => void
    onrename?: (id: string, value: string) => void
    /** aria-label / placeholder for the rename input. */
    renameLabel?: string
    /** Hint appended to a row's title (e.g. how to rename it). */
    renameHint?: string
  } = $props()

  let isDropdownOpen = $state(false)
  let renamingId = $state('')
  let renameValue = $state('')

  let selectedLabel = $derived(
    items.find(item => item.id === selectedId)?.label ?? allLabel
  )

  // Aggregate signal on the collapsed toggler: the list may never be opened,
  // so failing items are announced even then.
  let failedLabels = $derived(
    items.filter(item => item.error).map(item => item.label)
  )

  let toggleDropdown = () =>
    isDropdownOpen = !isDropdownOpen

  let select = (id: string) => {
    onselect(id)
    isDropdownOpen = false
  }

  let remove = (id: string, event: MouseEvent) => {
    // The row is removed synchronously, detaching the click target
    // before the event bubbles to Closeable's window listener,
    // where container.contains() would fail and close the dropdown.
    event.stopPropagation()
    onremove?.(id)
  }

  let startRename = (id: string, value: string) => {
    renamingId = id
    renameValue = value

    // Flush before the input mounts so focus happens inside the gesture
    // (needed for the mobile keyboard).
    flushSync()
  }

  let commitRename = (id: string, value: string) => {
    if (onrename && renamingId === id) onrename(id, value)
    renamingId = ''
    renameValue = ''
  }

  let cancelRename = (id: string) => {
    if (renamingId !== id) return

    renamingId = ''
    renameValue = ''
  }
</script>

<div class="filter">
  <Closeable bind:open={isDropdownOpen}>
    <button
      class="column__action filter__toggler"
      class:focus={isDropdownOpen}
      type="button"
      aria-haspopup="listbox"
      aria-expanded={isDropdownOpen}
      onclick={toggleDropdown}
    >
      <span class="filter__name">{selectedLabel}</span>
      {#if failedLabels.length}
        <span class="filter__alert" title={failedLabels.join(', ')}></span>
      {/if}
    </button>

    {#if isDropdownOpen}
      <ul class="filter__list">
        {#if allId !== undefined && selectedId !== allId}
          <li class="filter__item">
            <button
              class="filter__select"
              type="button"
              onclick={() => select(allId)}
            >{allLabel}</button>
          </li>
        {/if}

        {#each items as item (item.id)}
          <li class="filter__item" class:active={selectedId === item.id}>
            <!-- The select button stays mounted while renaming: it holds the
                 row's width, so swapping it for the editor would resize the
                 whole dropdown to the input's intrinsic width. The editor
                 overlays it instead. -->
            <span class="filter__label">
              <button
                class="filter__select"
                class:hidden={renamingId === item.id}
                type="button"
                title={renameHint ? `${item.label} - ${renameHint}` : item.label}
                onclick={() => select(item.id)}
                use:editGesture={{ onEdit: () => startRename(item.id, item.label) }}
              >{item.label}</button>

              {#if renamingId === item.id}
                <input
                  class="filter__rename"
                  bind:value={renameValue}
                  placeholder={item.placeholder}
                  aria-label={renameLabel}
                  use:inlineRename={{
                    onSave: value => commitRename(item.id, value),
                    onCancel: () => cancelRename(item.id)
                  }}
                >
              {/if}
            </span>

            {#if item.loading || item.error}
              <span
                class="filter__state"
                class:filter__state--error={item.error}
                title={item.error}
              ></span>
            {/if}

            {#if onremove}
              <button
                class="column__remove"
                type="button"
                title={strings.remove}
                aria-label={`${strings.remove} ${item.label}`}
                onclick={(e) => remove(item.id, e)}
              >×</button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </Closeable>
</div>

<style lang="scss">
  @use 'scss/variables' as *;
  @use 'scss/mixins' as *;

  .filter {
    position: relative;
    min-width: 0;
    max-width: 14rem;

    &__toggler {
      display: flex;
      align-items: center;
      gap: $gap-0;
      max-width: 100%;
      font-size: $font-size-ui;

      // Open state: same "active" tint as the column "+" while its form is
      // open, so it stays distinct from hover/focus.
      &.focus {
        color: var(--color-accent-fg);
        background: var(--color-accent-light);
      }
    }

    &__name {
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    // Red square on the collapsed toggler listing the failing feed names as
    // its tooltip; per-item dots live inside the dropdown.
    &__alert {
      flex: none;
      width: .45rem;
      aspect-ratio: 1;
      background: var(--color-error);
    }

    &__list {
      position: absolute;
      top: 100%;
      right: 0;
      z-index: $nav-z-index;
      min-width: 12rem;
      max-width: min(20rem, 80vw);
      max-height: 50vh;
      overflow-y: auto;
      background: var(--color-surface);
    }

    &__item {
      position: relative;
      display: flex;
      align-items: stretch;
      background: var(--color-surface);

      // Selected row: mark it with a foreground-colored bar. Drawing it on
      // the row keeps it visible while the rename editor covers the label
      // button.
      &.active::before {
        position: absolute;
        inset: 0 auto 0 0;
        z-index: 1;
        width: .2rem;
        content: '';
        background: var(--color-accent);
      }

      // Match the select button's hover/focus background while the delete
      // action is inactive; the global hover/focus rules still make it red.
      &:hover > .column__remove:not(:hover):not(:focus),
      &:focus-within > .column__remove:not(:hover):not(:focus) {
        background: var(--color-surface-light);
      }
    }

    &__label {
      position: relative;
      display: flex;
      flex: 1;
      min-width: 0;
    }

    &__select {
      flex: 1;
      min-width: 0;
      padding: $gap-1;
      overflow: hidden;
      font: inherit;
      font-size: $font-size-column-title;
      color: var(--color-accent);
      text-align: left;
      white-space: nowrap;
      text-overflow: ellipsis;
      background: inherit;
      border: none;
      cursor: pointer;

      // Still occupies its row while the rename editor overlays it.
      &.hidden {
        visibility: hidden;
      }

      &:hover,
      &:focus {
        background: var(--color-surface-light);
        outline: none;
      }
    }

    // Small state square: dim for loading, red for an error. The span copies
    // .column__remove's horizontal padding so its slot matches the button's
    // footprint; the square itself is drawn by ::before.
    &__state {
      flex: none;
      display: flex;
      align-self: stretch;
      align-items: center;
      padding: 0 $gap-1;

      &::before {
        width: .45rem;
        aspect-ratio: 1;
        content: '';
        background: var(--color-fg-inactive);
      }

      &--error::before {
        background: var(--color-error);
      }
    }

    &__rename {
      position: absolute;
      inset: 0;
      width: 100%;
      @include input-base;
      // Inline editor inside a surface-colored dropdown: flip to the page
      // background so the field still reads as a field. The dropdown clips
      // outer outlines, so draw the editable ring inside.
      background: var(--color-bg);
      outline: $outline var(--color-accent);
      outline-offset: -$outline-size;
    }
  }
</style>
