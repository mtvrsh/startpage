<script lang="ts">
  import global from '../config'
  import strings from '../share/strings'
  import { Channels } from '../share/channels'
  import { Config, config } from '../share/config'
  import { Piped } from '../util/piped';
  import { rejectIfResponseIsNotOk } from '../util/fetch';
  import { FocusNavigator } from '../util/focus.svelte';
  import { preventDefault } from '../util/wrappers';
  import Closeable from './Closeable.svelte';
  import Image from './Image.svelte';
  import IconSearch from './icons/Search.svelte'
  import type { SearchChannelsResult } from '../util/piped';

  let focus = new FocusNavigator();
  let isOutputOpen = $state(false)
  let error = $state('')
  let suggestions: SearchChannelsResult[] = $state([])
  let focusKeybind = Config.getUsedKeybind($config.keybind.focusSearch)
  let timeout = 0
  let query = $state('')
  let placeholder = `${strings.searchForChannel} (ctrl+${focusKeybind})`

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

    Piped.search(query, {filter: Piped.FILTER_CHANNELS})
    .then(rejectIfResponseIsNotOk)
    .then(r => r.json())
    .then(r => suggestions = r.items || [])
    .then(_ => openOutput())
    .catch(e => error = e)
  }

  let searchDelayed = () => {
    if (timeout)
      clearTimeout(timeout)

    timeout = setTimeout(search, global.search.delayInMs)
  }

  let AddChannelAndClose = (e: MouseEvent) => {
    Channels.add((e.currentTarget as HTMLAnchorElement).href)
    closeOutput()
  }

  let handleGlobalKeybinds = (e: KeyboardEvent) => {
    if (!e.ctrlKey)
      return

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
  <Closeable bind:open={isOutputOpen}>
    <form>
      <input
        class="search__input nav__item nav__item--input"
        type="search"
        placeholder={placeholder}
        oninput={searchDelayed}
        onfocus={openOutput}
        bind:value={query}
        bind:this={focus.items[0]}
      >
    </form>

    {#if isOutputOpen}
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
                  src={thumbnail}
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
  </Closeable>
</search>

<style lang="scss">
  @use 'scss/variables' as *;

  .search {
    position: relative;

    &__input {
      position: relative;
      z-index: 1;
      width: 100%;
      color: var(--color-surface-fg);
      background: var(--color-surface);

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
