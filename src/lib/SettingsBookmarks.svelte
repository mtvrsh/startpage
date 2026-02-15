<script lang="ts">
  import strings from '../share/strings'
  import Bookmarks, { bookmarks, type Bookmark } from '../share/bookmarks'
  import ButtonRemove from './ButtonRemove.svelte';

  type BookmarkItem = {
    url: string
    bookmark: Bookmark
    isRemoved: boolean
  }

  let items: BookmarkItem[] = $state(
    [...$bookmarks].map(([url, bookmark]) => ({
      url,
      bookmark,
      isRemoved: false
    }))
  )
</script>

<div class="bookmarks">
  {#if items.length}
    <ul class="bookmarks__list">
      {#each items as item (item.url)}
        <li class="bookmarks__list-item">
          <input
            class="bookmarks__input"
            value={`${item.bookmark.tag}: ${item.bookmark.name}`}
            disabled
          >
          <ButtonRemove
            isRemoved={item.isRemoved}
            remove={() => {
              Bookmarks.delete(item.url)
              item.isRemoved = true
            }}
            restore={() => {
              Bookmarks.set(item.bookmark)
              item.isRemoved = false
            }}
          />
        </li>
      {/each}
    </ul>
  {:else}
    <p class="bookmarks__empty">{strings.noBookmarksFound}</p>
  {/if}
</div>

<style lang="scss">
  .bookmarks {
    display: grid;
    overflow-y: scroll;
    user-select: none;

    &__list {
      overflow-y: scroll;

      &-item {
        display: grid;
        grid-template-columns: 1fr auto;

        &:hover {
          background-color: var(--color-surface);
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
