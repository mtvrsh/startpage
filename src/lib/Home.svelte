<script lang="ts">
  import strings from '../share/strings'
  import Bookmarks from './Bookmarks.svelte';
  import Channels from './Channels.svelte';
  import Feeds from './Feeds.svelte';

  let tabs = [
    strings.channels,
    strings.bookmarks,
    strings.feeds
  ]

  let focused = $state(0)
</script>

<main class="home">
  <div class="home__content" class:feeds-open={focused == 2}>
    <div class="home__content-item" class:show={focused == 0} tabindex="-1">
      <Channels />
    </div>
    <div class="home__content-item" class:show={focused == 1} tabindex="-1">
      <Bookmarks />
    </div>
    <div class="home__content-item" class:show={focused == 2} tabindex="-1">
      <Feeds />
    </div>
  </div>

  <nav class="home__navigation">
    {#each tabs as tab, i}
      <input
        class="home__navigation-button"
        class:focus={focused == i}
        type="button"
        value={tab}
        onclick={() => focused = i}>
    {/each}
  </nav>
</main>

<style lang="scss">
  @use 'scss/breakpoints' as *;

  .home {
    display: grid;
    grid-template-rows: 1fr auto;
    overflow-y: scroll;
  }

  .home__content {
    overflow-y: inherit;
  }

  .home__content-item {
    display: none;
  }

  .home__content-item.show {
    display: initial;
  }

  .home__navigation {
    display: grid;
    grid-auto-flow: column;
    gap: var(--gap-0);
    padding: var(--gap-0);
    color: var(--color-surface-fg);
    background: var(--color-surface);
  }

  .home__navigation-button {
    padding: var(--gap-2);
    font-weight: bold;
    color: inherit;
    background: inherit;
    border: none;
  }

  .home__navigation-button:hover,
  .home__navigation-button:focus {
    background: var(--color-surface-light);
    outline: none;
    cursor: pointer;
  }

  .home__navigation-button.focus {
    color: var(--color-accent);
  }

  @include breakpoint-md {
    .home__content {
      display: grid;
      grid-template-rows: none;
      grid-template-columns: 32rem 1fr;
    }

    .home__content-item {
      overflow-y: inherit;
    }

    .home__content-item:nth-child(1),
    .home__content-item:nth-child(2) {
      display: initial;
    }

    // The reader is a tab until there is room for a third column.
    .home__content-item:nth-child(3) {
      display: none;
    }

    .home__content.feeds-open {
      grid-template-columns: 1fr;
    }

    .home__content.feeds-open .home__content-item:nth-child(1),
    .home__content.feeds-open .home__content-item:nth-child(2) {
      display: none;
    }

    .home__content.feeds-open .home__content-item:nth-child(3) {
      display: initial;
    }
  }

  @include breakpoint-lg {
    .home__content {
      grid-template-columns: 36rem 1fr;
    }
  }

  @include breakpoint-xl {
    .home__navigation {
      display: none;
    }

    .home__content,
    .home__content.feeds-open {
      grid-template-columns: 36rem minmax(0, 1fr) minmax(0, 1fr);
    }

    .home__content-item:nth-child(3),
    .home__content.feeds-open .home__content-item:nth-child(1),
    .home__content.feeds-open .home__content-item:nth-child(2),
    .home__content.feeds-open .home__content-item:nth-child(3) {
      display: initial;
    }
  }
</style>
