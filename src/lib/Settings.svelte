<script lang="ts">
  import config from '../config'
  import strings from '../share/strings'
  import { preventDefault } from '../util/wrappers'
  import { app } from './state/app.svelte'
  import SettingsGeneral from './SettingsGeneral.svelte'
  import SettingsChannels from './SettingsChannels.svelte'
  import SettingsBookmarks from './SettingsBookmarks.svelte'

  let {
    tabIndex
  } = $props()

  let tabs = [
    {name: strings.general, path: strings.paths.settings, view: SettingsGeneral},
    {name: strings.channels, path: strings.paths.channels, view: SettingsChannels},
    {name: strings.bookmarks, path: strings.paths.bookmarks, view: SettingsBookmarks}
  ]

  let tab = $derived(tabs[tabIndex])
</script>

<div class="settings">
  <ul class="settings__tabs">
    {#each tabs as {name, path}}
      <li class="settings__tabs-item">
        {#if tab.name == name}
          <p class="settings__tabs-button focus">{name}</p>
        {:else}
          <a
            href={config.base + path}
            class="settings__tabs-button"
            onclick={preventDefault(() => app.route.path = path)}
          >{name}</a>
        {/if}
      </li>
    {/each}
  </ul>

  <div class="settings__list">
    <tab.view />
  </div>
</div>

<style lang="scss">
  @use 'scss/breakpoints' as *;
  @use 'scss/variables' as *;
  
  .settings {
    display: grid;
    grid-template-rows: auto 1fr auto;
    overflow-y: scroll;

    &__tabs {
      display: grid;
      grid-template-columns: repeat(3, 1fr);

      &-item {
        display: grid;
      }

      &-button {
        padding: $gap-3;
        color: inherit;
        text-align: center;
        text-decoration: none;

        &:hover,
        &:focus {
          background-color: var(--color-surface);
          outline: none;
        }

        &.focus {
          color: var(--color-accent-fg);
          background-color: var(--color-accent);
          cursor: default;
        }
      }
    }

    &__list {
      display: grid;
      overflow-y: scroll;
    }
  }

  @include breakpoint-md {
    .settings {
      grid-template-rows: 1fr auto;
      grid-template-columns: 10rem 1fr;

      &__tabs {
        grid-row: 1 / span 2;
        grid-template-rows: repeat(3, auto) 1fr;
        grid-template-columns: auto;
        overflow-y: scroll;

        &-button {
          padding: 2 * $gap-3 + .51rem;
        }
      }
    }
  }
</style>
