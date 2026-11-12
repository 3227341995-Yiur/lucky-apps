/// <reference path="./vue-shim.d.ts" />
import type { DefineComponent } from 'vue'
import AppDialogComponent from './AppDialog.vue'

export interface AppDialogProps {
  modelValue?: boolean
  title?: string
  subtitle?: string
  icon?: string
  width?: string
  /** 撑满视口高度（IDE / 设计器） */
  fillHeight?: boolean
  fullscreen?: boolean
  showFooter?: boolean
  closeOnClickModal?: boolean
  closeOnPressEscape?: boolean
  destroyOnClose?: boolean
  beforeClose?: ((done: () => void) => void) | null
}

export const AppDialog = AppDialogComponent as unknown as DefineComponent<AppDialogProps, {}, any>
