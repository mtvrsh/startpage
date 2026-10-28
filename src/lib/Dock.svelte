<script lang="ts">
  import strings from '../share/strings'
  import { Config, config } from '../share/config'
  import { app } from './state/app.svelte'
  import { isTypedCharacter } from '../util/keyboard'
  import IconSearch from './icons/Search.svelte'
  import IconSettings from './icons/Settings.svelte'

  let searchKeybind = $derived(Config.getUsedKeybind($config.keybind.focusSearch))
  let settingsKeybind = $derived(Config.getUsedKeybind($config.keybind.openSettings))

  let openSettings = () =>
    app.route.path = strings.paths.settings

  let handleKeydown = (event: KeyboardEvent) => {
    if (event.key !== settingsKeybind) return

    // A character being typed into a field must not trigger the keybind;
    // named keys like Escape still work from anywhere.
    if (isTypedCharacter(event)) return

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
      font-size: $font-size-item-title;
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

