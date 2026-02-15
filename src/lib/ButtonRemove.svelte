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

  input:hover {
    background-color: var(--color-surface);
  }

  input.removed {
    color: var(--color-warrning);
  }

  input.removed:hover {
    background-color: var(--color-surface-light);
  }
</style>
