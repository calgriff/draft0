<template>
  <div
    v-if="visible"
    class="fountain-block-handle"
    :style="handleStyle"
  >
    <button
      class="handle-button"
      :title="t('fountain.blockMenu.title')"
      @mousedown.prevent
      @click="toggleMenu"
    >
      <span class="grip" />
    </button>
    <ul
      v-if="menuOpen"
      class="handle-menu"
    >
      <li
        v-for="item in items"
        :key="item.type"
        @mousedown.prevent
        @click="choose(item.type)"
      >
        <span class="name">{{ t(`fountain.blockMenu.${item.key}`) }}</span>
        <span class="hint">{{ item.hint }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { applyBlockType, type FountainBlockType } from 'common/fountain/blocks'

// CodeMirror 5 ships no first-party types; the wrapper keeps the surface loose.
type CMInstance = any

const props = defineProps<{
  editor: CMInstance
  /** Only shown for screenplays; markdown has muya's own block handles. */
  enabled: boolean
}>()

const { t } = useI18n()

const items: { type: FountainBlockType; key: string; hint: string }[] = [
  { type: 'scene_heading', key: 'sceneHeading', hint: 'INT. / EXT.' },
  { type: 'action', key: 'action', hint: '' },
  { type: 'character', key: 'character', hint: 'CAPS' },
  { type: 'dialogue', key: 'dialogue', hint: '' },
  { type: 'parenthetical', key: 'parenthetical', hint: '( )' },
  { type: 'transition', key: 'transition', hint: 'CUT TO:' },
  { type: 'section', key: 'section', hint: '#' },
  { type: 'synopsis', key: 'synopsis', hint: '=' },
  { type: 'note', key: 'note', hint: '[[ ]]' },
  { type: 'page_break', key: 'pageBreak', hint: '===' }
]

const menuOpen = ref(false)
const top = ref(0)
const left = ref(0)
const hasCursor = ref(false)

const visible = computed(() => props.enabled && hasCursor.value)
const handleStyle = computed(() => ({ top: `${top.value}px`, left: `${left.value}px` }))

/**
 * Park the handle beside the caret's line. `local` coordinates are relative to
 * the editor's content, which is also what the handle is positioned against,
 * so it stays put as the document scrolls.
 */
const reposition = () => {
  const cm = props.editor
  if (!cm || !props.enabled) {
    hasCursor.value = false
    return
  }
  const wrapper = cm.getWrapperElement() as HTMLElement
  const coords = cm.cursorCoords(null, 'local') as { top: number; left: number }
  top.value = wrapper.offsetTop + coords.top
  left.value = wrapper.offsetLeft - 26
  hasCursor.value = true
}

const toggleMenu = () => {
  menuOpen.value = !menuOpen.value
}

const choose = (type: FountainBlockType) => {
  const cm = props.editor
  menuOpen.value = false
  if (!cm) return

  const cursor = cm.getCursor()
  const result = applyBlockType(cm.getValue(), cursor.line, type)
  cm.setValue(result.text)
  const line = Math.min(result.line, cm.lineCount() - 1)
  cm.setCursor({ line, ch: result.ch ?? cm.getLine(line).length })
  cm.focus()
}

const closeMenu = () => {
  menuOpen.value = false
}

watch(
  () => props.enabled,
  (value) => {
    if (!value) {
      menuOpen.value = false
      hasCursor.value = false
    } else {
      reposition()
    }
  }
)

watch(
  () => props.editor,
  (cm, previous) => {
    if (previous) previous.off('cursorActivity', reposition)
    if (cm) {
      cm.on('cursorActivity', reposition)
      reposition()
    }
  },
  { immediate: true }
)

onMounted(() => {
  document.addEventListener('click', closeMenu)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeMenu)
  if (props.editor) props.editor.off('cursorActivity', reposition)
})
</script>

<style scoped>
.fountain-block-handle {
  position: absolute;
  z-index: 5;
  user-select: none;
}

.handle-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: var(--radiusSm);
  background: transparent;
  color: var(--editorColor30);
  cursor: pointer;
  opacity: 0.5;
  transition:
    opacity var(--transitionFast),
    background var(--transitionFast);
}

.handle-button:hover {
  opacity: 1;
  background: var(--floatHoverColor);
}

/* Two columns of dots, echoing the markdown editor's block handle. */
.grip {
  width: 8px;
  height: 12px;
  background-image: radial-gradient(currentColor 1px, transparent 1px);
  background-size: 4px 4px;
  color: var(--editorColor50);
}

.handle-menu {
  position: absolute;
  top: 22px;
  left: 0;
  z-index: 10;
  min-width: 210px;
  margin: 0;
  padding: var(--space1);
  list-style: none;
  background: var(--floatBgColor);
  border: 1px solid var(--floatBorderColor);
  border-radius: var(--radiusMd);
  box-shadow: var(--shadowMd);
}

.handle-menu li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space3);
  padding: 6px var(--space2);
  border-radius: var(--radiusSm);
  font-size: 13px;
  color: var(--editorColor);
  cursor: pointer;
}

.handle-menu li:hover {
  background: var(--floatHoverColor);
}

.handle-menu .hint {
  font-family: var(--codeFontFamily, monospace);
  font-size: 11px;
  color: var(--editorColor40);
}
</style>
