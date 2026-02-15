<script lang="ts">
  import strings from '../share/strings'

  let { error = $bindable(), value = $bindable(), placeholder } = $props()
</script>

<input type="text" class:error={error} bind:value={value} {placeholder} title={error ? strings.empty : ''}>

<style>
  input[type=text] {
    width: 20rem;
    max-width: 100vw;
    padding: .5rem;
    margin-bottom: .5rem;
    color: var(--color-fg);
    background-color: var(--color-surface);
    border: none;
    outline: none;
  }

  input[type=text]:hover {
    background-color: var(--color-surface-light);
  }

  input[type=text]:focus {
    outline: 0.2rem solid var(--color-accent);
  }

  input[type=text].error {
    color: var(--color-error);
  }
</style>
