<script lang="ts">
  import navaid from 'navaid'
  import config from './config'
  import strings from './share/strings'
  import bookmarks from './share/bookmarks'
  import { app } from './lib/state/app.svelte'
  import { routes } from './routes'
  import { Channels } from './share/channels'
  import { Feeds } from './share/feeds'
  import { Config, config as userConfig } from './share/config'
  import { Status } from './share/status'
  import { isTypedCharacter } from './util/keyboard'
  import Dock from './lib/Dock.svelte'
  import FetchProgress from './lib/FetchProgress.svelte'
  import Home from './lib/Home.svelte'
  import SearchPalette from './lib/SearchPalette.svelte'

  if ('serviceWorker' in navigator && import.meta.env.PROD)
    navigator.serviceWorker.register(config.base + '/sw.js')

  let main = $state(routes.home)
  let router = navaid(config.base, uri => {
    main = routes.notFound
    app.route.path = uri
  })

  for (let [_, route] of Object.entries(routes))
    router.on(route.path, args => {
      main = {...route, args: {...route.args, ...args}}
      app.route.path = route.path
    })

  // Legacy settings tabs: channel/bookmark management now lives in the columns.
  router.on(strings.paths.channels, () => app.route.path = strings.paths.settings)
  router.on(strings.paths.bookmarks, () => app.route.path = strings.paths.settings)

  // Render the requested route right away. Listening on the current URL would
  // let the route callbacks overwrite the redirect path stored by `404.html`.
  router.listen(config.base + app.route.path)

  $effect(() => {
    let path = app.route.path

    // `router.route` always pushes when a base is configured, so skip when the
    // location already matches; otherwise back/forward would truncate history.
    if (router.format(location.pathname) !== path)
      router.route(path)
  })

  let title = $derived(
    main.name
    ? main.name.replace(/%(\w)+%/g, arg => main.args[arg.slice(1,-1)])
    : config.name
  )

  let settingsPaths = [
    strings.paths.settings
  ]

  let isHome = $derived(main.path === strings.paths.home)
  let isSettings = $derived(settingsPaths.includes(main.path))

  let closeSettings = () =>
    app.route.path = strings.paths.home

  let previousFocus: HTMLElement | null = null
  let wasSettings = false

  $effect(() => {
    if (isSettings && !wasSettings)
      previousFocus = document.activeElement as HTMLElement | null

    if (!isSettings && wasSettings)
      previousFocus?.focus?.()

    wasSettings = isSettings

    document.body.style.overflow = isSettings || app.searchOpen ? 'hidden' : ''
  })

  let handleGlobalKeydown = (event: KeyboardEvent) => {
    if (!isSettings) return

    if (event.key !== $userConfig.keybind.close) return

    // A close key that is a plain character (a custom keybind like `q`) must
    // not close settings while that character is being typed into a field.
    // Named keys such as Escape still close from anywhere.
    if (isTypedCharacter(event)) return

    event.preventDefault()
    closeSettings()
  }

  Status.saveOnUpdate()
  Config.saveOnUpdate()
  Channels.saveOnUpdate()
  Feeds.saveOnUpdate()
  bookmarks.subscribeToLocalStorage()
</script>

<svelte:document onkeydown={handleGlobalKeydown} />

<svelte:head>
  <title>{title}</title>
</svelte:head>

<div class="app">
  <FetchProgress />

  {#if isHome || isSettings}
    <Home />
  {/if}

  {#if isSettings}
    <div class="overlay">
      <button
        class="overlay__backdrop"
        type="button"
        tabindex="-1"
        aria-label={strings.close}
        onclick={closeSettings}
      ></button>

      <div
        class="overlay__panel"
        role="dialog"
        aria-modal="true"
        aria-label={strings.settings}
      >
        <main.view {...main.args} />
      </div>
    </div>
  {:else if !isHome}
    <main.view {...main.args} />
  {/if}

  <SearchPalette />
  <Dock />
</div>

<style lang="scss">
  @use 'lib/scss/variables' as *;

  .app {
    display: grid;
    grid-template-rows: 1fr;
    height: 100dvh;
    min-height: 0;
  }

  .overlay {
    position: fixed;
    inset: 0;
    z-index: $overlay-z-index;
    display: grid;
    place-items: center;
    padding: var(--gap-2);

    &__backdrop {
      position: absolute;
      inset: 0;
      padding: 0;
      background: $overlay-backdrop;
      border: none;
      cursor: default;
    }

    &__panel {
      position: relative;
      display: flex;
      width: min(100%, 52rem);
      height: min(100%, 90dvh);
      overflow: hidden;
      background: var(--color-bg);
      border: $border var(--color-surface);
      box-shadow: 0 1rem 3rem rgb(0 0 0 / .35);
    }
  }
</style>
