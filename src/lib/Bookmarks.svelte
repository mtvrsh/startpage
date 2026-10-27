<script lang="ts">
  import { flushSync } from 'svelte'
  import strings from '../share/strings'
  import Bookmarks, { bookmarks, type Bookmark } from '../share/bookmarks'
  import Column from './Column.svelte'
  import Empty from './Empty.svelte'
  import { editGesture } from './gestures'
  import { hasSafeScheme, safeHref } from '../util/scheme'

  let adding = $state(false)
  let url = $state('')
  let tag = $state('')
  let name = $state('')
  let errorUrl = $state(false)
  let errorTag = $state(false)
  let errorName = $state(false)

  let editingUrl = $state('')
  let editUrl = $state('')
  let editTag = $state('')
  let editName = $state('')
  let editError = $state('')
  let editNameInput = $state<HTMLInputElement>()

  let groups = $derived(
    [...Map.groupBy([...$bookmarks.values()], bookmark => bookmark.tag)]
      .sort(([tagA], [tagB]) => tagA.localeCompare(tagB))
  )

  let submit = (event: SubmitEvent) => {
    event.preventDefault()

    errorUrl = errorTag = errorName = false

    if (!url.trim())
      errorUrl = true

    if (url.trim() && !hasSafeScheme(url.trim()))
      errorUrl = true

    if (!tag.trim())
      errorTag = true

    if (!name.trim())
      errorName = true

    if (errorUrl || errorTag || errorName)
      return

    Bookmarks.set({
      url: url.trim(),
      tag: tag.trim(),
      name: name.trim()
    })

    url = tag = name = ''
    adding = false
  }

  let startEdit = (bookmark: Bookmark) => {
    editingUrl = bookmark.url
    editUrl = bookmark.url
    editTag = bookmark.tag
    editName = bookmark.name
    editError = ''

    // Flush before the input mounts so focus happens inside the gesture
    // (needed for the mobile keyboard).
    flushSync()
    editNameInput?.focus()
    editNameInput?.select()
  }

  let cancelEdit = () => {
    editingUrl = ''
    editError = ''
  }

  let saveEdit = (event: SubmitEvent) => {
    event.preventDefault()

    if (!editingUrl) return

    let nextUrl = editUrl.trim()
    let nextName = editName.trim()
    let nextTag = editTag.trim()

    if (!nextUrl || !nextName || !nextTag) {
      editError = strings.requiredFields
      return
    }

    if (!hasSafeScheme(nextUrl)) {
      editError = strings.invalidScheme
      return
    }

    if (nextUrl === editingUrl) {
      Bookmarks.update(editingUrl, { name: nextName, tag: nextTag })
    } else if (!Bookmarks.replace(editingUrl, { url: nextUrl, name: nextName, tag: nextTag })) {
      editError = strings.bookmarkExists
      return
    }

    editingUrl = ''
    editError = ''
  }

  let handleEditKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return

    event.preventDefault()
    cancelEdit()
  }

  let clearEditError = () => editError = ''

  let remove = (bookmarkUrl: string) =>
    Bookmarks.delete(bookmarkUrl)
</script>

<Column title={strings.bookmarks} bind:adding addTitle={strings.addBookmark}>
  {#snippet form()}
    <form onsubmit={submit}>
      <input
        class="column__input"
        class:error={errorUrl}
        bind:value={url}
        placeholder={strings.url}
        aria-label={strings.url}
        aria-invalid={errorUrl}
      >
      <input
        class="column__input"
        class:error={errorTag}
        bind:value={tag}
        placeholder={strings.tag}
        aria-label={strings.tag}
        aria-invalid={errorTag}
      >
      <input
        class="column__input"
        class:error={errorName}
        bind:value={name}
        placeholder={strings.name}
        aria-label={strings.name}
        aria-invalid={errorName}
      >
      <button class="column__submit" type="submit">{strings.add}</button>
    </form>
  {/snippet}

  {#if groups.length}
    <div class="bookmarks">
      {#each groups as [tagName, items] (tagName)}
        <section class="bookmarks__group">
          <h3 class="bookmarks__tag" title={tagName}>{tagName}</h3>

          <ul class="bookmarks__items">
            {#each items as bookmark (bookmark.url)}
              <li
                class="bookmarks__item"
                class:editing={editingUrl === bookmark.url}
              >
                {#if editingUrl === bookmark.url}
                  <form
                    class="bookmarks__edit"
                    aria-label={strings.editBookmark}
                    onsubmit={saveEdit}
                  >
                    <input
                      class="column__input"
                      class:error={!!editError}
                      bind:this={editNameInput}
                      bind:value={editName}
                      oninput={clearEditError}
                      onkeydown={handleEditKeydown}
                      placeholder={strings.name}
                      aria-label={strings.name}
                      aria-invalid={!!editError}
                    >
                    <input
                      class="column__input"
                      class:error={!!editError}
                      bind:value={editTag}
                      oninput={clearEditError}
                      onkeydown={handleEditKeydown}
                      placeholder={strings.tag}
                      aria-label={strings.tag}
                      aria-invalid={!!editError}
                    >
                    <input
                      class="column__input"
                      class:error={!!editError}
                      bind:value={editUrl}
                      oninput={clearEditError}
                      onkeydown={handleEditKeydown}
                      placeholder={strings.url}
                      aria-label={strings.url}
                      aria-invalid={!!editError}
                    >
                    {#if editError}
                      <p class="column__error">{editError}</p>
                    {/if}
                    <div class="bookmarks__edit-actions">
                      <button class="column__submit bookmarks__edit-save" type="submit">
                        {strings.save}
                      </button>
                      <button
                        class="bookmarks__edit-cancel"
                        type="button"
                        onclick={cancelEdit}
                      >{strings.cancel}</button>
                    </div>
                  </form>
                {:else}
                  {#if safeHref(bookmark.url) === undefined}
                    <span
                      class="bookmarks__link bookmarks__link--unsafe"
                      title={`${strings.unsafeScheme} - ${strings.editBookmarkHint}`}
                      use:editGesture={{ onEdit: () => startEdit(bookmark) }}
                    >{bookmark.name}</span>
                  {:else}
                    <a
                      class="bookmarks__link"
                      href={bookmark.url}
                      title={`${bookmark.url} - ${strings.editBookmarkHint}`}
                      use:editGesture={{ onEdit: () => startEdit(bookmark) }}
                    >{bookmark.name}</a>
                  {/if}

                  <button
                    class="column__remove"
                    type="button"
                    title={strings.remove}
                    aria-label={`${strings.remove} ${bookmark.name}`}
                    onclick={() => remove(bookmark.url)}
                  >×</button>
                {/if}
              </li>
            {/each}
          </ul>
        </section>
      {/each}
    </div>
  {:else}
    <Empty message={strings.noBookmarksFound} />
  {/if}
</Column>

<style lang="scss">
  @use 'scss/variables' as *;

  .bookmarks {
    display: flex;
    flex-direction: column;
    gap: $gap-1;
    padding: $gap-1;

    &__group {
      display: flex;
      flex-direction: column;
      gap: $gap-0;
    }

    &__tag {
      padding: 0 $gap-1;
      overflow: hidden;
      font-size: .75rem;
      font-weight: bold;
      color: var(--color-accent);
      white-space: nowrap;
      text-overflow: ellipsis;
      user-select: none;
    }

    &__items {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0 $gap-1;
    }

    &__item {
      display: flex;
      flex: 0 1 auto;
      align-items: center;
      gap: $gap-0;
      min-width: 0;
      max-width: 100%;

      &.editing {
        flex: 1 1 100%;
      }
    }

    &__link {
      flex: 0 1 auto;
      min-width: 0;
      padding: $gap-0 $gap-1;
      overflow: hidden;
      font-size: .85rem;
      white-space: nowrap;
      text-overflow: ellipsis;
      user-select: none;
      -webkit-touch-callout: none;
    }

    &__link--unsafe {
      opacity: .6;
    }

    &__edit {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: $gap-0;
      min-width: 0;
    }

    &__edit-actions {
      display: flex;
      gap: $gap-0;
    }

    &__edit-save,
    &__edit-cancel {
      flex: 1;
      justify-content: center;
    }

    &__edit-cancel {
      padding: $gap-1;
      font: inherit;
      font-weight: bold;
      color: var(--color-accent);
      background: var(--color-surface);
      border: none;
      cursor: pointer;

      &:hover,
      &:focus {
        color: var(--color-accent-fg);
        background: var(--color-accent);
        outline: none;
      }
    }
  }
</style>
