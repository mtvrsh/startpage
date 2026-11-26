<script lang="ts">
  import { untrack } from 'svelte'
  import strings from '../share/strings'
  import Image from './icons/Image.svelte'
  import Spinner from './icons/Spinner.svelte'

  let { src, alt, ...args } = $props()

  let ok: boolean | undefined = $state(undefined)
  // A separate flag (instead of comparing against a `pv` initialized to '')
  // makes the first run apply the initial state even when src is empty/unset.
  let pv: string | undefined
  let initialized = false

  $effect(() => {
    // Skip reset loading state when src changes but has the same value.
    // Svelte doesn't update the image attribute in that case.
    // Avoids an endless animation screen.
    if (initialized && src === untrack(() => pv)) return
    initialized = true

    pv = src
    // An empty/blank/missing src never fires load/error in browsers, so
    // treating it as "still loading" would leave the spinner up forever.
    // Show the fallback instead.
    const hasSource = typeof src === 'string' ? src.trim().length > 0 : !!src
    ok = hasSource ? undefined : false
  })
</script>

<img
  class="image"
  class:hidden={!ok}
  onload={() => (ok = true)}
  onerror={() => (ok = false)}
  {src}
  alt={ok === false ? '' : alt}
  {...args}
/>

{#if ok === undefined}
  <Spinner />
{:else if ok === false}
  <span class="image__fallback" role="img" aria-label={strings.imageFailed}>
    <Image />
  </span>
{/if}

<style lang="scss">
  .image {
    display: block;
    max-width: 100%;
    max-height: 100%;
    object-fit: cover;
    user-select: none;
    border-radius: inherit;

    &.hidden {
      width: 0;
      height: 0;
      overflow: hidden;
    }
  }

  .image__fallback {
    display: flex;
  }
</style>
