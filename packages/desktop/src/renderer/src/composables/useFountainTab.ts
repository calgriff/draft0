import { computed, type ComputedRef } from 'vue'
import { storeToRefs } from 'pinia'
import { useEditorStore } from '@/store/editor'

/**
 * Whether the active tab holds a Fountain screenplay.
 *
 * Fountain is edited as source rather than in the WYSIWYG engine — muya would
 * reflow it as markdown — so several components need to agree on this without
 * routing it through the global `sourceCode` preference, which the user owns.
 */
export const useFountainTab = (): { isFountainTab: ComputedRef<boolean> } => {
  const { currentFile } = storeToRefs(useEditorStore())

  const isFountainTab = computed(() => {
    const pathname = currentFile.value?.pathname
    return !!pathname && window.fileUtils.isFountainFile(pathname)
  })

  return { isFountainTab }
}
