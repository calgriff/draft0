<template>
  <div class="about-dialog">
    <el-dialog
      v-model="showAboutDialog"
      :show-close="false"
      :modal="true"
      custom-class="ag-dialog-table"
      width="400px"
    >
      <img
        class="logo"
        :src="Draft0Logo"
        alt=""
      >
      <el-row>
        <el-col :span="24">
          <h3 class="title wordmark">
            draft<span class="zero">0</span><span class="caret" />
          </h3>
        </el-col>
        <el-col :span="24">
          <div class="text">
            {{ store.appVersion }}
          </div>
        </el-col>
        <el-col :span="24">
          <div
            class="text"
            style="min-height: auto"
          >
            {{ copyright }}
          </div>
        </el-col>
        <el-col :span="24">
          <div class="text">
            {{ copyrightContributors }}
          </div>
        </el-col>
      </el-row>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useMainStore } from '@/store'
import bus from '../../bus'
import Draft0Logo from '../../assets/images/logo.png'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const copyright = t('about.copyright', { year: new Date().getFullYear() })
const copyrightContributors = t('about.copyrightContributors')
const showAboutDialog = ref(false)

const store = useMainStore()

const showDialog = () => {
  showAboutDialog.value = true
  bus.emit('editor-blur')
}

onMounted(() => {
  bus.on('aboutDialog', showDialog)
})

onBeforeUnmount(() => {
  bus.off('aboutDialog', showDialog)
})
</script>

<style>
.about-dialog el-row,
.about-dialog el-col {
  display: block;
}

.about-dialog img.logo {
  width: 80px;
  height: 80px;
  display: inherit;
  margin: 0 auto;
  border-radius: 18px;
}

/* Live text rather than an image, so the wordmark stays crisp at any zoom and
   picks up the theme colours. Mirrors the icon: Plex Mono with a caret. */
.about-dialog .wordmark {
  font-family: 'IBM Plex Mono', monospace;
  font-weight: 600;
  font-size: 22px;
  letter-spacing: -0.02em;
  color: var(--editorColor80);
}

.about-dialog .wordmark .caret {
  display: inline-block;
  width: 2px;
  height: 0.95em;
  margin-left: 4px;
  vertical-align: -0.12em;
  border-radius: 1px;
  background: var(--themeColor);
}

.about-dialog .title,
.about-dialog .text {
  min-height: 32px;
  text-align: center;
}

.about-dialog .title {
  color: var(--floatFontColor);
}

.about-dialog .text {
  color: var(--floatFontColor);
}
</style>
