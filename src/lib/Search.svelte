<script lang="ts">
  import global from '../config'
  import strings from '../share/strings'
  import { Channels } from '../share/channels'
  import { Config, config } from '../share/config'
  import { getAdapter } from '../lib/api/adapter'
  import { FocusNavigator } from '../util/focus.svelte';
  import { preventDefault } from '../util/wrappers';
  import Closeable from './Closeable.svelte';
  import Image from './Image.svelte';
  import IconSearch from './icons/Search.svelte'
  import type { SearchChannelsResult } from '../lib/api/adapter';
  import { getDirectThumbnail } from '../util/youtube'

  let focus = new FocusNavigator();
  let isOutputOpen = $state(false)
  let suggestions: SearchChannelsResult[] = $state([])
  let focusKeybind = Config.getUsedKeybind($config.keybind.focusSearch)
  let timeout = 0
  let query = $state('')

  let isUrl = $derived(
    query.includes('youtube.com') || query.includes('youtu.be')
  )

  let suggestionsSortedBySubscribers = $derived(
    [...suggestions].sort((a,b) => b.subscribers - a.subscribers)
  )

  let openOutput = () =>
    isOutputOpen = true

  let closeOutput = () =>
    isOutputOpen = false

  let clearSuggestions = () =>
    suggestions = [];

  let search = () => {
    if (!query) {
      clearSuggestions();
      return;
    };

    getAdapter().search(query)
      .then(results => suggestions = results)
      .then(_ => openOutput())
  }

  let searchDelayed = () => {
    if (timeout)
      clearTimeout(timeout)

    if (!isUrl)
      timeout = setTimeout(search, global.search.delayInMs)
  }

  let addChannel = (url: string) => {
    Channels.add(url)
      .then(() => {
        query = ''
        clearSuggestions()
        closeOutput()
      })
  }

  let handleSubmit = (e: Event) => {
    e.preventDefault()

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

  let AddChannelAndClose = (e: MouseEvent) => {
    addChannel((e.currentTarget as HTMLAnchorElement).href)
  }

  let handleGlobalKeybinds = (e: KeyboardEvent) => {
    // Block when typing in text areas or content-editable elements
    // and allow buttons/checkboxes/radios
    const target = e.target as HTMLElement
    const tag = target.tagName.toLowerCase()
    if (tag === 'textarea' || target.isContentEditable)
      return
    if (tag === 'input') {
      const type = (target as HTMLInputElement).type
      if (type !== 'button' && type !== 'submit' && type !== 'checkbox' && type !== 'radio')
        return
    }

    switch (e.key) {
      case focusKeybind:
        e.preventDefault();
        focus.at(0);
        break;
    }
  }

  let handleLocalKeybinds = (e: KeyboardEvent) => {
    e.stopPropagation()

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        focus.prev();
        break;
      case 'ArrowDown':
        e.preventDefault();
        focus.next();
        break;
    }
  }
</script>

<svelte:document onkeydown={handleGlobalKeybinds} />

<search class="search" role="presentation" onkeydown={handleLocalKeybinds}>
  <Closeable bind:open={isOutputOpen} onClose={() => focus.items[0]?.blur()}>
    <form onsubmit={handleSubmit}>
      <div class="search__field">
        <span class="search__icon">
          <IconSearch />
        </span>
        <input
          class="search__input nav__item nav__item--input"
          type="search"
          placeholder={strings.searchForChannel}
          oninput={searchDelayed}
          onfocus={openOutput}
          bind:value={query}
          bind:this={focus.items[0]}
        >
        <span class="search__keybind">[{focusKeybind}]</span>
      </div>
    </form>

    {#if isOutputOpen}
      {#if isUrl}
        <ul class="search__output" tabindex="-1">
          <li>
            <a
              class="search__output-link"
              href={query}
              onclick={preventDefault(() => addChannel(query))}
              bind:this={focus.items[1]}
              tabindex="-1"
            >
              <p class="search__output-name">Add {query}</p>
            </a>
          </li>
        </ul>
      {:else if suggestionsSortedBySubscribers.length}
        <ul class="search__output" tabindex="-1">
          {#each suggestionsSortedBySubscribers.slice(0, 5) as {
            url, name, thumbnail
          }, i }
            <li>
              <a
                class="search__output-link"
                href={url}
                onclick={preventDefault(AddChannelAndClose)}
                bind:this={focus.items[i+1]}
                tabindex="-1"
              >
                <div class="search__output-thumbnail">
                  <Image
                    src={$config.useDirectThumbnails ? getDirectThumbnail(thumbnail) : thumbnail}
                    alt={strings.thumbnail}
                    crossorigin="anonymous"
                  />
                </div>
                <p
                  class="search__output-name"
                  title={name}
                >{name}</p>
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  </Closeable>
</search>

<style lang="scss">
  @use 'scss/variables' as *;

  .search {
    position: relative;

    &:focus-within .search__keybind {
      display: none;
    }

    &__field {
      position: relative;
    }

    &__icon {
      position: absolute;
      top: 50%;
      left: $gap-1;
      transform: translateY(-50%);
      z-index: 2;
      color: var(--color-fg-inactive);
      pointer-events: none;
    }

    &__keybind {
      position: absolute;
      right: $gap-1;
      top: 50%;
      transform: translateY(-50%);
      z-index: 2;
      color: var(--color-fg-inactive);
      pointer-events: none;
    }

    &__input {
      position: relative;
      z-index: 1;
      width: 100%;
      padding-left: calc($gap-1 + 2rem);
      padding-right: calc($gap-1 + 2.5rem);
      color: var(--color-surface-fg);
      background: var(--color-surface);

      // Hide X button in searchbox in Chromium
      &::-webkit-search-cancel-button {
        display: none;
      }

      &::placeholder {
        color: var(--color-fg-inactive);
        opacity: 1;
      }

      &:hover {
        background: var(--color-surface-light);
      }

      &:focus {
        outline: $outline var(--color-accent);
      }
    }

    &__output {
      position: absolute;
      top: 100%;
      z-index: $nav-z-index;
      width: 100%;
      max-height: calc($search-thumbnail-height * 5);
      color: var(--color-surface-fg);
      background: var(--color-surface);
      overflow-y: scroll;

      &-link {
        display: flex;
        align-items: center;
        text-decoration: none;

        &:hover,
        &:focus {
          background: var(--color-surface-light);
        }
      }

      &-name {
        width: 100%;
        padding: $gap-0;
        overflow: hidden;
        text-wrap: nowrap;
        text-overflow: ellipsis;
      }

      &-thumbnail {
        display: flex;
        align-items: center;
        justify-content: center;
        width: $search-thumbnail-height;
        height: $search-thumbnail-height;
        padding: $gap-1 $gap-0;
        border-radius: 50%;
      }
    }
  }
</style>
