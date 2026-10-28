<script lang="ts">
  import strings from '../share/strings'
  import Bookmarks from './Bookmarks.svelte'
  import Channels from './Channels.svelte'
  import Feeds from './Feeds.svelte'

  let tabs = [
    strings.channels,
    strings.bookmarks,
    strings.feeds
  ]

  let focused = $state(0)
</script>

<main class="home">
  <div class="home__content">
    <div class="home__content-item" class:show={focused == 0}>
      <Channels />
    </div>
    <div class="home__content-item" class:show={focused == 1}>
      <Bookmarks />
    </div>
    <div class="home__content-item" class:show={focused == 2}>
      <Feeds />
    </div>
  </div>

  <nav class="home__navigation">
    {#each tabs as tab, i}
      <button
        class="home__navigation-button"
        class:focus={focused == i}
        type="button"
        onclick={() => focused = i}
      >{tab}</button>
    {/each}
  </nav>
</main>

<style lang="scss">
  @use 'scss/breakpoints' as *;

  .home {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .home__content {
    flex: 1;
    min-height: 0;
  }

  .home__content-item {
    display: none;
    height: 100%;
    min-height: 0;
  }

  .home__content-item.show {
    display: block;
  }

  .home__navigation {
    display: grid;
    grid-auto-flow: column;
    color: var(--color-surface-fg);
    background: var(--color-surface);
  }

  .home__navigation-button {
    // Match the compact column header actions (e.g. the bookmark "+").
    height: 1.5rem;
    padding: 0 var(--gap-1);
    color: var(--color-accent);
    background: inherit;
    border: none;
  }

  .home__navigation-button:hover,
  .home__navigation-button:focus {
    color: var(--color-accent-fg);
    background: var(--color-accent);
    outline: none;
    cursor: pointer;
  }

  // Selected tab: same "open/active" tint as the column "+" while its form
  // is open, so hover and selection stay distinguishable.
  .home__navigation-button.focus {
    color: var(--color-accent-fg);
    background: var(--color-accent-light);
  }

  @include breakpoint-xl {
    .home__navigation {
      display: none;
    }

    .home__content {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .home__content-item {
      display: block;
    }
  }
</style>
