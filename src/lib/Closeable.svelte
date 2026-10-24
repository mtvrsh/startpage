<script lang="ts">
  import { config } from '../share/config'

  let {
    children,
    open = $bindable(),
    onClose = undefined
  } = $props()

  let container: HTMLElement;

  let close = () => {
    open = false;
    onClose?.();
  }

  let closeIfPressedCloseKey = (e: KeyboardEvent) => {
    // Let inputs (e.g. inline rename) handle the key themselves.
    if ((e.target as HTMLElement)?.closest?.('input, textarea, select, [contenteditable]'))
      return

    if (e.key == $config.keybind.close)
      close()
  }

  let closeIfClickedElementNotInContainer = (e: MouseEvent) =>
    container.contains(e.target as HTMLElement) || close()
</script>

<svelte:window
  onkeyup={closeIfPressedCloseKey}
  onclick={closeIfClickedElementNotInContainer}
/>

<div bind:this={container}>
  {@render children()}
</div>
