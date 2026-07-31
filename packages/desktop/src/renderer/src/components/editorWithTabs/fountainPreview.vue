<template>
  <div class="fountain-preview">
    <!-- Safe: `fountainToHtml` escapes every character of the source before
         building the markup, so nothing user-authored reaches the DOM as HTML. -->
    <!-- eslint-disable vue/no-v-html -->
    <div
      class="fountain-preview-page"
      v-html="html"
    />
    <!-- eslint-enable vue/no-v-html -->
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { fountainToHtml } from 'common/fountain/toHtml'

const props = defineProps<{
  markdown: string
}>()

// Cheap enough to render synchronously: the parser is a single line-oriented
// pass and a feature screenplay is on the order of 10k lines.
const html = computed(() => fountainToHtml(props.markdown ?? ''))
</script>

<style>
@import '@/assets/themes/export/screenplay.theme.css';

.fountain-preview {
  height: calc(100vh - var(--titleBarHeight));
  box-sizing: border-box;
  overflow: auto;
  padding: 40px 24px;
  border-left: 1px solid var(--floatBorderColor);
  background: var(--editorBgColor);
}

/* The screenplay stylesheet fixes ink to black for print; on screen it has to
   follow the editor theme instead. */
.fountain-preview .fountain-script,
.fountain-preview .fountain-script .scene-heading {
  color: var(--editorColor);
}

/* Screenplays are single-spaced on paper, which is right for the PDF but tight
   to read on a screen. Loosen it here only — the exported document keeps the
   standard measure. */
.fountain-preview .fountain-script {
  line-height: 1.3;
}

.fountain-preview .fountain-script .section,
.fountain-preview .fountain-script .synopsis {
  color: var(--editorColor50);
}

.fountain-preview .fountain-script .title-page {
  min-height: auto;
  padding-bottom: 24pt;
  border-bottom: 1px solid var(--floatBorderColor);
}

.fountain-preview .fountain-script .title-page-title {
  margin-top: 0;
}

.fountain-preview .fountain-script .title-page-meta:first-of-type {
  margin-top: 24pt;
}

.fountain-preview .fountain-script .page-break {
  margin: 24pt 0;
  border-top: 1px dashed var(--floatBorderColor);
}
</style>
