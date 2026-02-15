<script lang="ts">
  let { value, onclick = $bindable(), disabled = $bindable() } = $props()
</script>

<div class="container">
  <input type="submit" value={disabled ? '' : value} {onclick} {disabled}>
  {#if disabled}
  <div class="gg-spinner-container">
    <i class="gg-spinner"></i>
  </div>
  {/if}
</div>

<style>
  .container {
    display: grid;
    position: relative;
  }

  input[type=submit] {
    width: 20rem;
    max-width: 100vw;
    padding: .5rem;
    color: var(--color-fg);
    background-color: var(--color-accent);
    border: none;
  }

  input[type=submit]:hover {
    background-color: var(--color-surface-light);
    cursor: pointer;
  }

  input[type=submit]:disabled {
    cursor: default;
    background-color: var(--color-bg);
  }

  .gg-spinner-container {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .gg-spinner {
    transform: scale(var(--ggs, 1));
  }

  .gg-spinner,
  .gg-spinner::after,
  .gg-spinner::before {
    box-sizing: border-box;
    position: relative;
    display: block;
    width: 20px;
    height: 20px;
  }

  .gg-spinner::after,
  .gg-spinner::before {
    content: "";
    position: absolute;
    border-radius: 100px;
  }

  .gg-spinner::before {
    animation: spinner 1s cubic-bezier(0.6, 0, 0.4, 1) infinite;
    border: 3px solid transparent;
    border-top-color: currentColor;
  }

  .gg-spinner::after {
    border: 3px solid;
    opacity: 0.2;
  }

  @keyframes spinner {
    0% {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(359deg);
    }
  }
</style>
