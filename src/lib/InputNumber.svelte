<script lang="ts">
  let {
    id,
    label,
    min = undefined,
    max = undefined,
    value = $bindable(),
    fallback = 0,
  }: {
    id: string
    label: string
    min?: number
    max?: number
    value: number
    fallback?: number
  } = $props()

  // A number input writes `null` while its field is being cleared, which would
  // put an invalid value into the config store (and blank both feeds). Keep the
  // field's text locally and only ever write valid numbers to the store.
  let text = $state(value == null ? '' : String(value))
  let lastValue = value

  $effect(() => {
    if (value === lastValue) return
    lastValue = value
    text = value == null ? '' : String(value)
  })

  let clamp = (number: number) => {
    if (typeof min === 'number' && number < min) return min
    if (typeof max === 'number' && number > max) return max
    return number
  }

  let onInput = (event: Event) => {
    text = (event.currentTarget as HTMLInputElement).value
    if (text.trim() === '') return

    const parsed = Number(text)
    if (Number.isFinite(parsed)) value = clamp(parsed)
  }

  let onBlur = () => {
    const parsed = Number(text)
    if (text.trim() === '' || !Number.isFinite(parsed)) {
      value = fallback
      text = String(fallback)
      return
    }

    value = clamp(parsed)
    text = String(value)
  }
</script>

<label for={id}>{label}</label>
<input type="number" {id} {min} {max} value={text} oninput={onInput} onblur={onBlur} />

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

    &:disabled {
      color: var(--color-fg-inactive);
      cursor: default;
    }
  }
</style>
