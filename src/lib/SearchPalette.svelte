<script lang="ts">
  import { tick } from 'svelte'
  import global from '../config'
  import strings from '../share/strings'
  import { Channels } from '../share/channels'
  import { Config, config } from '../share/config'
  import { app } from './state/app.svelte'
  import { backend } from '../lib/api/backend'
  import { FocusNavigator } from '../util/focus.svelte'
  import { preventDefault } from '../util/wrappers'
  import Image from './Image.svelte'
  import IconSearch from './icons/Search.svelte'
  import type { SearchChannelsResult } from '../lib/api/backend'
  import { getDirectThumbnail } from '../util/youtube'

  let focus = new FocusNavigator()
  let suggestions: SearchChannelsResult[] = $state([])
  let query = $state('')
  let errorMessage = $state('')
  let previousFocus: HTMLElement | null = null
  let wasOpen = false
  let timeout = 0

  let focusKeybind = Config.getUsedKeybind($config.keybind.focusSearch)
  let closeKeybind = $config.keybind.close

  let isUrl = $derived(
    query.includes('youtube.com') || query.includes('youtu.be')
  )

  let suggestionsSortedBySubscribers = $derived(
    [...suggestions].sort((channelA, channelB) => channelB.subscribers - channelA.subscribers)
  )

  let open = () =>
    app.searchOpen = true

  let close = () => {
    if (timeout)
      clearTimeout(timeout)

    app.searchOpen = false
  }

  let clearSuggestions = () =>
    suggestions = []

  let search = () => {
    const currentQuery = query

    if (!currentQuery) {
      clearSuggestions()
      return
    }

    $backend.search(currentQuery)
      .then(channelResults => {
        if (query === currentQuery)
          suggestions = channelResults
      })
      .catch(() => {
        if (query === currentQuery)
          clearSuggestions()
      })
  }

  let searchDelayed = () => {
    if (timeout)
      clearTimeout(timeout)

    if (!isUrl)
      timeout = window.setTimeout(search, global.search.delayInMs)
  }

  let addChannel = (url: string) => {
    Channels.add(url)
      .then(close)
      .catch(error => {
        errorMessage = typeof error === 'string'
          ? error
          : error instanceof Error
            ? error.message
            : String(error)
      })
  }

  let handleSubmit = (event: Event) => {
    event.preventDefault()

    if (!query) {
      clearSuggestions()
      return
    }

    if (isUrl) {
      addChannel(query)
      return
    }

    search()
  }

  let handleInput = () => {
    errorMessage = ''
    focus.index = 0
    searchDelayed()
  }

  let addChannelAndClose = (event: MouseEvent) =>
    addChannel((event.currentTarget as HTMLAnchorElement).href)

  let handleGlobalKeybinds = (event: KeyboardEvent) => {
    // Block when typing in text areas or content-editable elements
    // and allow buttons/checkboxes/radios
    const target = event.target

    if (target instanceof HTMLElement) {
      const tagName = target.tagName.toLowerCase()
      if (tagName === 'textarea' || target.isContentEditable)
        return
      if (tagName === 'input') {
        const type = (target as HTMLInputElement).type
        if (!['button', 'submit', 'checkbox', 'radio'].includes(type))
          return
      }
    }

    if (app.searchOpen && event.key === closeKeybind) {
      event.preventDefault()
      close()
      return
    }

    if (event.key !== focusKeybind) return

    event.preventDefault()

    if (app.searchOpen)
      close()
    else
      open()
  }

  let handlePanelKeybinds = (event: KeyboardEvent) => {
    event.stopPropagation()

    if (event.key === closeKeybind) {
      event.preventDefault()
      close()
      return
    }

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault()
        if (focus.items.length) focus.prev()
        break
      case 'ArrowDown':
        event.preventDefault()
        if (focus.items.length) focus.next()
        break
    }
  }

  $effect(() => {
    if (app.searchOpen && !wasOpen) {
      previousFocus = document.activeElement as HTMLElement | null
      query = ''
      errorMessage = ''
      clearSuggestions()
      focus.index = 0
      tick().then(() => focus.items[0]?.focus())
    }

    if (!app.searchOpen && wasOpen) {
      previousFocus?.focus?.()
      previousFocus = null
    }

    wasOpen = app.searchOpen
  })
</script>

<svelte:document onkeydown={handleGlobalKeybinds} />

{#if app.searchOpen}
  <div class="palette">
    <button
      class="palette__backdrop"
      type="button"
      tabindex="-1"
      aria-label={strings.close}
      onclick={close}
    ></button>

    <div
      class="palette__panel"
      role="dialog"
      aria-modal="true"
      aria-label={strings.searchForChannel}
      tabindex="-1"
      onkeydown={handlePanelKeybinds}
    >
      <form class="palette__form" onsubmit={handleSubmit}>
        <span class="palette__icon">
          <IconSearch />
        </span>

        <input
          class="palette__input"
          type="search"
          placeholder={strings.searchForChannel}
          aria-label={strings.searchForChannel}
          autocomplete="off"
          spellcheck="false"
          oninput={handleInput}
          bind:value={query}
          bind:this={focus.items[0]}
        >
      </form>

      {#if errorMessage}
        <p class="palette__error">{errorMessage}</p>
      {/if}

      {#if isUrl}
        <ul class="palette__list">
          <li>
            <a
              class="palette__link"
              href={query}
              onclick={preventDefault(() => addChannel(query))}
              bind:this={focus.items[1]}
              tabindex="-1"
            >
              <p class="palette__name">Add {query}</p>
            </a>
          </li>
        </ul>
      {:else if suggestionsSortedBySubscribers.length}
        <ul class="palette__list">
          {#each suggestionsSortedBySubscribers.slice(0, global.search.max) as {
            url, name, thumbnail
          }, index }
            <li>
              <a
                class="palette__link"
                href={url}
                onclick={preventDefault(addChannelAndClose)}
                bind:this={focus.items[index + 1]}
                tabindex="-1"
              >
                <div class="palette__thumbnail">
                  <Image
                    src={$config.useDirectThumbnails ? getDirectThumbnail(thumbnail) : thumbnail}
                    alt={strings.thumbnail}
                    crossorigin="anonymous"
                  />
                </div>
                <p class="palette__name" title={name}>{name}</p>
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
{/if}

<style lang="scss">
  @use 'scss/variables' as *;

  .palette {
    position: fixed;
    inset: 0;
    z-index: $overlay-z-index;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 12vh var(--gap-2) var(--gap-2);

    &__backdrop {
      position: absolute;
      inset: 0;
      padding: 0;
      background: rgb(0 0 0 / .45);
      border: none;
      cursor: default;
    }

    &__panel {
      position: relative;
      display: flex;
      flex-direction: column;
      width: min(100%, 40rem);
      max-height: min(70vh, 36rem);
      overflow: hidden;
      background: var(--color-bg);
      border: $border var(--color-surface);
      box-shadow: 0 1rem 3rem rgb(0 0 0 / .35);
    }

    &__form {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      gap: var(--gap-1);
      padding: var(--gap-1);
      border-bottom: $border var(--color-surface);
    }

    &__icon {
      flex-shrink: 0;
      color: var(--color-fg-inactive);
    }

    &__input {
      flex: 1;
      min-width: 0;
      padding: var(--gap-1);
      font: inherit;
      color: var(--color-fg);
      background: var(--color-surface);
      border: none;

      // Hide X button in searchbox in Chromium
      &::-webkit-search-cancel-button {
        display: none;
      }

      &:focus {
        outline: $outline var(--color-accent);
      }
    }

    &__error {
      padding: var(--gap-1);
      font-size: .75rem;
      color: var(--color-error);
      border-bottom: $border var(--color-surface);
    }

    &__list {
      overflow-y: auto;
    }

    &__link {
      display: flex;
      align-items: center;
      gap: var(--gap-1);
      padding: var(--gap-0) var(--gap-1);
      color: var(--color-surface-fg);
      text-decoration: none;

      &:hover,
      &:focus {
        background: var(--color-surface-light);
        outline: none;
      }
    }

    &__thumbnail {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      width: $search-thumbnail-height;
      height: $search-thumbnail-height;
      padding: $gap-1 $gap-0;
      border-radius: 50%;
    }

    &__name {
      min-width: 0;
      overflow: hidden;
      font-size: .85rem;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
  }
</style>
