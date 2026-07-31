<template>
  <div
    class="editor-with-tabs"
    :style="{ 'max-width': `calc(100vw - ${effectiveSideBarWidth}px)` }"
  >
    <tabs v-show="showTabBar" />
    <div class="container">
      <editor
        :markdown="markdown"
        :cursor="cursor"
        :text-direction="textDirection"
        :platform="platform"
      />
      <div
        v-if="sourceCode || isFountainTab"
        class="source-pane"
      >
        <source-code
          :markdown="markdown"
          :muya-index-cursor="muyaIndexCursor"
          :text-direction="textDirection"
        />
        <fountain-preview
          v-if="isFountainTab && showScreenplayPreview"
          :markdown="markdown"
        />
      </div>
    </div>
    <tab-notifications />
  </div>
</template>

<script setup lang="ts">
import { useLayoutStore } from '@/store/layout'
import { storeToRefs } from 'pinia'
import Tabs from './tabs.vue'
import Editor from './editor.vue'
import SourceCode from './sourceCode.vue'
import TabNotifications from './notifications.vue'
import FountainPreview from './fountainPreview.vue'
import { useFountainTab } from '@/composables/useFountainTab'

defineProps<{
  markdown: string
  // `cursor` originates as `IFileState.cursor` which is `unknown`
  // (see src/shared/types/files.ts); align here instead of forcing every
  // caller to widen.
  cursor: unknown
  muyaIndexCursor?: unknown
  sourceCode: boolean
  showTabBar: boolean
  textDirection: string
  platform: string
}>()

const { effectiveSideBarWidth, showScreenplayPreview } = storeToRefs(useLayoutStore())
const { isFountainTab } = useFountainTab()
</script>

<style scoped>
.editor-with-tabs {
  position: relative;
  height: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;

  overflow: hidden;
  background: var(--editorBgColor);
  & > .container {
    flex: 1;
    overflow: hidden;
  }
}

/* Side-by-side source and screenplay preview. Each child owns its own
   scrolling, so the two panes scroll independently. */
.source-pane {
  display: flex;
  height: 100%;
}

.source-pane > * {
  flex: 1;
  min-width: 0;
}
</style>
