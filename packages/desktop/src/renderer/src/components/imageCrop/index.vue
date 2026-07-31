<template>
  <div class="image-crop">
    <el-dialog
      v-model="visible"
      :show-close="false"
      :modal="true"
      :close-on-click-modal="false"
      custom-class="ag-dialog-table"
      width="620px"
      @closed="onClosed"
    >
      <h3>{{ t('imageCrop.title') }}</h3>
      <div class="stage">
        <!-- Shrink-wraps the image so the selection overlay can be positioned
             in the image's own coordinate space. -->
        <div
          class="frame"
          @pointerdown="onPointerDown"
        >
          <img
            ref="image"
            :src="displaySrc"
            alt=""
            draggable="false"
            @load="onImageLoad"
          >
          <div
            v-if="ready"
            class="shade"
            :style="selectionStyle"
          />
        </div>
      </div>
      <div class="hint">
        {{ t('imageCrop.hint') }}
      </div>
      <div class="button-controlls">
        <button
          class="button"
          @click="resetSelection"
        >
          {{ t('imageCrop.reset') }}
        </button>
        <button
          class="button"
          @click="cancel"
        >
          {{ t('imageCrop.cancel') }}
        </button>
        <button
          class="button-primary"
          :disabled="!ready"
          @click="confirm"
        >
          {{ t('imageCrop.crop') }}
        </button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import bus from '../../bus'

const { t } = useI18n()

/** Crop rectangle in *displayed* pixels, relative to the <img> box. */
interface Rect {
  x: number
  y: number
  width: number
  height: number
}

interface CropRequest {
  /** Src to display — already resolved to something the renderer can load. */
  displaySrc: string
  /** Mime type to encode the result as. */
  mime: string
  resolve: (blob: Blob | null) => void
}

const visible = ref(false)
const ready = ref(false)
const displaySrc = ref('')
const image = ref<HTMLImageElement | null>(null)
const selection = ref<Rect>({ x: 0, y: 0, width: 0, height: 0 })

let request: CropRequest | null = null

const selectionStyle = computed(() => {
  const { x, y, width, height } = selection.value
  return {
    left: `${x}px`,
    top: `${y}px`,
    width: `${width}px`,
    height: `${height}px`
  }
})

const showDialog = (payload: unknown) => {
  request = payload as CropRequest
  displaySrc.value = request.displaySrc
  ready.value = false
  visible.value = true
  bus.emit('editor-blur')
}

const onImageLoad = () => {
  nextTick(resetSelection)
}

const resetSelection = () => {
  const el = image.value
  if (!el) return
  selection.value = { x: 0, y: 0, width: el.clientWidth, height: el.clientHeight }
  ready.value = el.clientWidth > 0 && el.clientHeight > 0
}

/**
 * Drag anywhere on the image to define the crop rectangle. Deliberately the
 * only interaction — no handles, no aspect presets: re-dragging is as fast as
 * nudging an edge would be.
 */
const onPointerDown = (event: PointerEvent) => {
  const el = image.value
  if (!el) return

  const bounds = el.getBoundingClientRect()
  const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max)
  const originX = clamp(event.clientX - bounds.left, bounds.width)
  const originY = clamp(event.clientY - bounds.top, bounds.height)

  const onMove = (moveEvent: PointerEvent) => {
    const currentX = clamp(moveEvent.clientX - bounds.left, bounds.width)
    const currentY = clamp(moveEvent.clientY - bounds.top, bounds.height)
    selection.value = {
      x: Math.min(originX, currentX),
      y: Math.min(originY, currentY),
      width: Math.abs(currentX - originX),
      height: Math.abs(currentY - originY)
    }
  }

  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    // A click without a drag is a mis-click, not a request for an empty crop.
    if (selection.value.width < 4 || selection.value.height < 4) {
      resetSelection()
    }
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  event.preventDefault()
}

const cancel = () => {
  visible.value = false
}

const confirm = async () => {
  const el = image.value
  if (!el || !request) return cancel()

  // The image is displayed scaled to fit the dialog; crop at natural
  // resolution so the result loses nothing but the cropped-away pixels.
  const scaleX = el.naturalWidth / el.clientWidth
  const scaleY = el.naturalHeight / el.clientHeight
  const { x, y, width, height } = selection.value

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scaleX))
  canvas.height = Math.max(1, Math.round(height * scaleY))
  const context = canvas.getContext('2d')
  if (!context) return cancel()

  context.drawImage(
    el,
    Math.round(x * scaleX),
    Math.round(y * scaleY),
    canvas.width,
    canvas.height,
    0,
    0,
    canvas.width,
    canvas.height
  )

  const mime = request.mime
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mime, mime === 'image/jpeg' ? 0.92 : undefined)
  })

  request.resolve(blob)
  request = null
  visible.value = false
}

// Resolve the pending promise on any close path so the caller never hangs.
const onClosed = () => {
  if (request) {
    request.resolve(null)
    request = null
  }
  displaySrc.value = ''
  ready.value = false
}

onMounted(() => {
  bus.on('showImageCropDialog', showDialog)
})

onBeforeUnmount(() => {
  bus.off('showImageCropDialog', showDialog)
})
</script>

<style scoped>
.image-crop .stage {
  position: relative;
  display: flex;
  justify-content: center;
  max-height: 420px;
  overflow: hidden;
  background: var(--floatHoverColor);
  user-select: none;
  cursor: crosshair;
}

.image-crop .frame {
  position: relative;
  display: inline-block;
  line-height: 0;
}

.image-crop .stage img {
  max-width: 100%;
  max-height: 420px;
  object-fit: contain;
}

/* The selection is drawn as a hole punched in a dimming overlay. */
.image-crop .shade {
  position: absolute;
  box-shadow: 0 0 0 9999px var(--maskColor);
  border: 1px solid var(--themeColor);
  pointer-events: none;
}

.image-crop .hint {
  margin-top: 10px;
  font-size: 13px;
  color: var(--editorColor50);
}

.image-crop .button-controlls {
  margin-top: 12px;
  text-align: right;
}

.image-crop .button-controlls button {
  margin-left: 8px;
}
</style>
