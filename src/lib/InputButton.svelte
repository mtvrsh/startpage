<script lang="ts">
  let {
    value,
    focus = undefined,
    onclick
  } = $props()
</script>

<input type="button" class:focus {value} {onclick}>

<style>
  input {
    padding: .75rem;
    font-size: 1rem;
    font-weight: bold;
    color: inherit;
    background-color: inherit;
    border: none;
    cursor: pointer;
  }

  input.focus,
  input:focus,
  input:hover {
    background-color: var(--color-surface);
    outline: none;
  }
</style>
