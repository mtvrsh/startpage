<script lang="ts">
  import { flushSync } from 'svelte'
  import strings from '../share/strings'
  import { Channels, channels } from '../share/channels'
  import { app } from './state/app.svelte'
  import Closeable from './Closeable.svelte'
  import { editGesture } from './gestures'
  import { inlineRename } from './inline-rename'

  let isDropdownOpen = $state(false)
  let renamingId = $state('')
  let renameValue = $state('')

  let filtered = $derived($channels.get(app.filter))
  let filteredName = $derived(filtered?.displayName || filtered?.name)
  let channelsSortedByName = $derived([...$channels].sort(Channels.BY_NAME))

  let toggleDropdown = () =>
    isDropdownOpen = !isDropdownOpen

  let select = (id: string) => {
    app.filter = id
    isDropdownOpen = false
  }

  let remove = (id: string) => {
    Channels.remove(id)

    if (app.filter === id)
      app.filter = strings.allKebabCase
  }

  let startRename = (id: string, displayName: string) => {
    renamingId = id
    renameValue = displayName

    // Flush before the input mounts so focus happens inside the gesture
    // (needed for the mobile keyboard).
    flushSync()
  }

  let commitRename = (id: string, value: string) => {
    if (renamingId !== id) return

    Channels.update(id, { displayName: value.trim() })
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
      <span class="filter__name">{filteredName || strings.all}</span>
    </button>

    {#if isDropdownOpen}
      <ul class="filter__list">
        {#if app.filter !== strings.allKebabCase}
          <li class="filter__item">
            <button
              class="filter__select"
              type="button"
              onclick={() => select(strings.allKebabCase)}
            >{strings.all}</button>
          </li>
        {/if}

        {#each channelsSortedByName as [id, {name, displayName}] (id)}
          <li class="filter__item" class:active={app.filter === id}>
            {#if renamingId === id}
              <input
                class="filter__rename"
                bind:value={renameValue}
                placeholder={name}
                aria-label={strings.renameChannel}
                use:inlineRename={{
                  onSave: value => commitRename(id, value),
                  onCancel: () => cancelRename(id)
                }}
              >
            {:else}
              <button
                class="filter__select"
                type="button"
                title={`${displayName || name} - ${strings.renameChannelHint}`}
                onclick={() => select(id)}
                use:editGesture={{ onEdit: () => startRename(id, displayName || '') }}
              >{displayName || name}</button>
            {/if}

            <button
              class="column__remove"
              type="button"
              title={strings.remove}
              aria-label={`${strings.remove} ${displayName || name}`}
              onclick={() => remove(id)}
            >×</button>
          </li>
        {/each}
      </ul>
    {/if}
  </Closeable>
</div>

<style lang="scss">
  @use 'scss/variables' as *;

  .filter {
    position: relative;
    min-width: 0;
    max-width: 14rem;

    &__toggler {
      max-width: 100%;

      &.focus {
        color: var(--color-accent-fg);
        background: var(--color-accent);
      }
    }

    &__name {
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
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
      display: flex;
      align-items: stretch;
      background: var(--color-surface);

      // Match the channel button's hover/focus background while the delete
      // action is inactive; the global hover/focus rules still make it red.
      &:hover > .column__remove:not(:hover):not(:focus),
      &:focus-within > .column__remove:not(:hover):not(:focus) {
        background: var(--color-surface-light);
      }

      &.active .filter__select {
        color: var(--color-accent);
      }
    }

    &__select {
      flex: 1;
      min-width: 0;
      padding: $gap-1;
      overflow: hidden;
      font: inherit;
      font-size: .8rem;
      color: var(--color-surface-fg);
      text-align: left;
      white-space: nowrap;
      text-overflow: ellipsis;
      background: inherit;
      border: none;
      cursor: pointer;

      &:hover,
      &:focus {
        background: var(--color-surface-light);
        outline: none;
      }
    }

    &__rename {
      flex: 1;
      min-width: 0;
      padding: $gap-1;
      font: inherit;
      font-size: .8rem;
      color: var(--color-surface-fg);
      background: var(--color-bg);
      border: none;
      outline: $outline var(--color-accent);
      // The dropdown clips outlines at its edges, so draw this one inside the
      // input to keep the whole ring visible.
      outline-offset: -$outline-size;
    }
  }
</style>
