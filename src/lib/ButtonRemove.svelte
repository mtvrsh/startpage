<script lang="ts">
  import strings from '../share/strings'

  let {
    isRemoved,
    remove,
    restore
  } = $props()

  function toggle() {
    if (isRemoved) {
      restore()
    } else {
      remove()
    }
  }
</script>

<input
  type="button"
  class:removed={isRemoved}
  value={isRemoved ? strings.restore : strings.remove}
  onclick={toggle}>

<style>
  input {
    width: 4.5rem;
    padding: .5rem;
    font-weight: bold;
    color: var(--color-accent);
    background-color: var(--color-bg);
    border: none;
    outline: none;
    cursor: pointer;
  }

  input:hover,
  input:focus {
    color: var(--color-fg);
    background-color: var(--color-accent);
  }

  input.removed {
    color: var(--color-warrning);
  }

  input.removed:hover,
  input.removed:focus {
    color: var(--color-warrning-fg);
    background-color: var(--color-warrning);
  }
</style>
