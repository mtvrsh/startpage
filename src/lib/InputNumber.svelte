<script>
  let { id, label, min = undefined, max = undefined, value = $bindable() } = $props()

  // `min`/`max` only constrain the spinner and form validation; typed values
  // still reach the store. Normalize on change so out-of-range numbers (a
  // negative feed limit, a zero timeout) cannot leak into persisted config.
  let normalize = () => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return

    if (typeof min === 'number' && value < min) value = min
    else if (typeof max === 'number' && value > max) value = max
  }
</script>

<label for={id}>{label}</label>
<input type="number" bind:value onchange={normalize} {id} {min} {max} />

<style lang="scss">
  @use 'scss/variables' as *;
  @use 'scss/mixins' as *;

  label {
    user-select: none;
  }

  input {
    // Asymmetric padding leaves room for the number spinners.
    @include input-base($gap-1 $gap-0 $gap-1 $gap-1);
    width: 3.5rem;
  }
</style>
