<script lang="ts">
  import strings from '../share/strings'
  import Bookmarks from './Bookmarks.svelte';
  import Channels from './Channels.svelte';

  let tabs = [
    strings.channels,
    strings.bookmarks
  ]

  let focused = $state(0)
</script>

<main class="home">
  <div class="home__content">
    <div class="home__content-item" class:show={focused == 0} tabindex="-1">
      <Channels />
    </div>
    <div class="home__content-item" class:show={focused == 1} tabindex="-1">
      <Bookmarks />
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
    background: var(--color-surface);
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
      display: initial;
      overflow-y: inherit;
    }

    .home__navigation {
      display: none;
    }
  }

  @include breakpoint-lg {
    .home__content {
      grid-template-columns: 36rem 1fr;
    }
  }
</style>
