<script lang="ts">
  import { status } from '../share/status'

  /* In order to animate progress bar we will manually control <max>:
   * 1. While fetching, use current value
   * 2. After fetching is done, reset
   */

  let max = $state(0)
  let now = $derived(max - $status.feed.fetching.now.length)
  let width = $derived(max ? Math.max((now / max) * 100, 5) + 'vw' : 0)

  let isFetching = () => $status.feed.fetching.max

  let isFetchingDone = () => now === max

  let resetMaxIfFetchingIsDone = () => {
    if (isFetchingDone()) max = 0
  }

  $effect(() => {
    if (isFetching()) max = $status.feed.fetching.max
  })
</script>

<aside
  class="progress-bar"
  class:animate={width}
  style:width
  ontransitionend={resetMaxIfFetchingIsDone}
  role="progressbar"
  aria-valuemax={max}
  aria-valuenow={now}
></aside>

<style lang="scss">
  .progress-bar {
    position: fixed;
    height: 0.2em;
    background: var(--color-accent);

    &.animate {
      transition: width 0.1618s;
    }
  }
</style>
