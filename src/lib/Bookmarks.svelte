<script lang="ts">
  import { bookmarks } from '../share/bookmarks'
  import strings from '../share/strings'
</script>

<div class="container">
{#if $bookmarks.size}
	{#each Map.groupBy($bookmarks.values(), ({tag}) => tag) as [tag, tagBookmarks]}
  <ul>
    <h3 class="tag-name">{tag}</h3>
    {#each tagBookmarks as {url, name}}
    <li class="tag-bookmark">
      <a class="" href={url}>{name}</a>
    </li>
    {/each}
  </ul>
  {/each}
{:else}
  <p class="no-bookmarks">{strings.noBookmarksFound}</p>
{/if}
</div>

<style lang="scss">
  @use 'scss/variables' as *;

  .container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, max-content));
    align-content: center;
    justify-content: center;
    height: 100%;
    gap: $gap-1;
    padding: $gap-3;
    overflow-y: scroll;
  }

  .container:has(.no-bookmarks) {
    grid-template-columns: none;;
  }

  .no-bookmarks {
    color: var(--color-fg-inactive);
    user-select: none;
  }

  .tag-name {
    margin-bottom: 1rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tag-bookmark {
    margin-bottom: .5rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
