<script lang="ts">
  import { untrack } from 'svelte'
  import Image from './icons/Image.svelte'
  import Spinner from './icons/Spinner.svelte'

  let { src, alt, ...args } = $props()

  let ok: boolean | undefined = $state(undefined)
  let pv = ''

  $effect(() => {
    // Skip reset loading state when src changes but has the same value.
    // Svelte doesn't update image attribute in that case.
    // Avoides endless animation screen.
    if (src == untrack(() => pv)) return

    pv = src
    ok = undefined
  })
</script>

<img
  class="image"
  class:hidden={!ok}
  onload={() => (ok = true)}
  onerror={() => (ok = false)}
  {src}
  {alt}
  {...args}
/>

{#if ok === undefined}
  <Spinner />
{:else if ok === false}
  <Image />
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
</style>
