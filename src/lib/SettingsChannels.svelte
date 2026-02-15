<script lang="ts">
  import strings from '../share/strings'
  import { Channels, channels, type Channel } from '../share/channels'
  import ButtonRemove from './ButtonRemove.svelte';

  type ChannelItem = {
    id: string
    channel: Channel
    isRemoved: boolean
  }

  let items: ChannelItem[] = $state(
    [...$channels].sort(Channels.BY_NAME).map(([id, channel]) => ({
      id,
      channel,
      isRemoved: false
    }))
  )
</script>

<div class="channels">
  {#if items.length}
    <ul class="channels__list">
      {#each items as item (item.id)}
        <li class="channels__list-item">
          <input
            class="channels__input"
            value={item.channel.displayName}
            placeholder={item.channel.name}
            onchange={(e) => {
              const newValue = e.currentTarget.value
              item.channel.displayName = newValue
              Channels.update(item.id, { displayName: newValue })
            }}
          >
          <ButtonRemove
            isRemoved={item.isRemoved}
            remove={() => {
              Channels.remove(item.id)
              item.isRemoved = true
            }}
            restore={() => {
              Channels.addExisting(item.id, item.channel)
              item.isRemoved = false
            }}
          />
        </li>
      {/each}
    </ul>
  {:else}
    <p class="channels__empty">{strings.noChannelsFound}</p>
  {/if}
</div>

<style lang="scss">
  .channels {
    display: grid;
    overflow-y: scroll;
    user-select: none;

    &__list {
      overflow-y: scroll;

      &-item {
        display: grid;
        grid-template-columns: 1fr auto;

        &:hover {
          background-color: var(--color-surface-light);
        }
      }
    }

    &__input {
      padding: 1rem;
      color: inherit;
      background: inherit;
      border: none;
      outline: none;
    }

    &__empty {
      align-self: center;
      justify-self: center;
      color: var(--color-fg-inactive);
    }
  }
</style>
