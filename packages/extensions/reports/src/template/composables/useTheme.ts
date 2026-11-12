/**
 * 主题（插件版 shim）
 *
 * 模板预览只需要 resolvedTheme：从宿主 ctx.theme 同步，跟随宿主主题切换。
 */
import { inject, onBeforeUnmount, onMounted, ref } from 'vue'

// ponytail: 只暴露 resolvedTheme，编辑器/预览用到其余主题能力时再补
export function useTheme() {
  const ctx = inject('cordis')
  const resolvedTheme = ref(ctx.get('theme').get().resolved)
  let off = null

  onMounted(() => {
    off = ctx.get('theme').onChange((theme) => {
      resolvedTheme.value = theme?.resolved || ctx.get('theme').get().resolved
    })
  })

  onBeforeUnmount(() => off?.())

  return { resolvedTheme }
}
