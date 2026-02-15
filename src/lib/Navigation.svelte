<script lang="ts">
  import config from '../config'
  import strings from '../share/strings'
  import { app } from './state/app.svelte'
  import { preventDefault } from '../util/wrappers';
  import BookmarksAdd from './BookmarksAdd.svelte';
  import ChannelsFilter from './ChannelsFilter.svelte';
  import ChannelsSync from './ChannelsSync.svelte';
  import Closeable from './Closeable.svelte';
  import Dropdown from './Dropdown.svelte';
  import IconArrowLeft from './icons/ArrowLeft.svelte';
  import IconMenu from './icons/Menu.svelte';
  import Search from './Search.svelte';

  let isRightMenuOpen = $state(false)

  let toggle = () =>
    isRightMenuOpen = !isRightMenuOpen

  let close = () =>
    isRightMenuOpen = false
</script>

{#snippet link(path: string, name: string)}
  <a
    href={config.base + path}
    class="nav__menu-right-list-link"
    class:active={app.route.path == path}
    onclick={preventDefault(() => { app.route.path = path; close() })}
  >{name}</a>
{/snippet}

<nav class="nav">
  <div class="nav__menu-left">
    {#if app.route.path == strings.paths.home}
      <ChannelsFilter />
      <ChannelsSync />
    {:else}
      <a
        href={config.base + strings.paths.home}
        class="nav__item"
        onclick={preventDefault(() => app.route.path = strings.paths.home)}
      >
        <IconArrowLeft />
      </a>
    {/if}
  </div>

  <Search />

  <div class="nav__menu-right">
    <Closeable bind:open={isRightMenuOpen}>
      <button
        class="nav__menu-right-toggler nav__item nav__item--icon"
        class:expand={isRightMenuOpen}
        onclick={toggle}
        aria-label={strings.menu}
      >
        <IconMenu />
      </button>

      <ul class="nav__menu-right-list" class:expand={isRightMenuOpen}>
        <li>
          <Dropdown value={strings.addBookmark}>
            <BookmarksAdd />
          </Dropdown>
        </li>

        <li>
          {@render link(strings.paths.settings, strings.settings)}
        </li>
      </ul>
    </Closeable>
  </div>
</nav>

<style lang="scss">
  @use 'scss/variables' as *;
  @use 'scss/breakpoints' as *;

  .nav {
    display: grid;
    grid-template-columns: minmax(auto, 1fr) minmax(0, 30rem) minmax(auto, 1fr);
    gap: $nav-gap;
    margin: $nav-gap;
    font-size: 1rem;
    font-weight: $font-bold;
    color: var(--color-accent);
    background: var(--color-bg);

    &__menu {
      &-left {
        display: flex;
        gap: $nav-gap;
      }

      &-right {
        position: relative;
        justify-self: right;

        &-toggler {
          &.expand {
            background: var(--color-surface);
          }
        }

        &-list {
          position: absolute;
          top: 100%;
          right: 0;
          z-index: $nav-z-index;
          display: none;
          background: var(--color-surface);

          &.expand {
            display: initial;
          }

          &-link {
            display: block;
            padding: $gap-2;
            text-decoration: none;

            &:focus,
            &:hover {
              background: var(--color-surface-light);
              cursor: pointer;
            }
          }
        }
      }
    }
  }

  @include breakpoint-md {
    .nav {
      &__menu {
        &-right {
          &-toggler {
            display: none;
          }

          &-list {
            position: unset;
            display: flex;
            gap: $nav-gap;
            background: inherit;

            &.expand {
              display: flex;
            }

            &-link {
              &:focus,
              &:hover {
                background: var(--color-bg-light);
              }
            }
          }
        }
      }
    }
  }

  :global(.nav__item) {
    padding: $gap-2;
    font-size: 1rem;
    font-weight: $font-bold;
    color: var(--color-accent);
    background: var(--color-bg);
    border: none;
    outline: none;
  }

  :global(.nav__item.focus),
  :global(.nav__item:focus),
  :global(.nav__item:hover) {
    background: var(--color-bg-light);
    cursor: pointer;
  }

  :global(.nav__item--input) {
    height: calc(1lh + 2*$gap-2 + .26rem);
    font-size: .8rem;

    &:hover {
      cursor: text;
    }
  }
</style>
