<script lang="ts">
  import strings from '../share/strings'
  import { Config, config } from '../share/config'
  import { app } from './state/app.svelte'
  import IconSearch from './icons/Search.svelte'
  import IconSettings from './icons/Settings.svelte'

  let searchKeybind = Config.getUsedKeybind($config.keybind.focusSearch)
  let settingsKeybind = Config.getUsedKeybind($config.keybind.openSettings)

  let openSettings = () =>
    app.route.path = strings.paths.settings

  let handleKeydown = (event: KeyboardEvent) => {
    if (event.key !== settingsKeybind) return

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

    event.preventDefault()
    openSettings()
  }
</script>

<svelte:document onkeydown={handleKeydown} />

<div class="dock">
  <button
    class="dock__button"
    type="button"
    title={`${strings.searchForChannel} [${searchKeybind}]`}
    aria-label={strings.searchForChannel}
    onclick={() => app.searchOpen = true}
  >
    <IconSearch />
  </button>

  <button
    class="dock__button"
    type="button"
    title={`${strings.settings} [${settingsKeybind}]`}
    aria-label={strings.settings}
    onclick={openSettings}
  >
    <IconSettings />
  </button>
</div>

<style lang="scss">
  @use 'scss/variables' as *;
  @use 'scss/breakpoints' as *;

  .dock {
    position: fixed;
    right: var(--gap-1);
    bottom: calc(3rem + var(--gap-1));
    z-index: $nav-z-index;
    display: flex;
    gap: var(--gap-0);
    opacity: .45;
    transition: opacity .1618s;

    &:hover,
    &:focus-within {
      opacity: 1;
    }

    &__button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      padding: 0;
      font-size: .85rem;
      color: var(--color-accent);
      background: var(--color-surface);
      border: none;
      cursor: pointer;

      &:hover,
      &:focus {
        color: var(--color-accent-fg);
        background: var(--color-accent);
        outline: none;
      }
    }
  }

  @include breakpoint-xl {
    .dock {
      bottom: var(--gap-1);
    }
  }
</style>

