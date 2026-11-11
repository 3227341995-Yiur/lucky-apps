/**
 * 主题（插件版 shim）
 *
 * 模板预览只需要 resolvedTheme：从宿主 api.theme 同步，跟随宿主主题切换。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useWeekReport } from '@lucky-apps/plugin-api'

// ponytail: 只暴露 resolvedTheme，编辑器/预览用到其余主题能力时再补
export function useTheme() {
  const api = useWeekReport()
  const resolvedTheme = ref(api.theme.get().resolved)
  let off = null

  onMounted(() => {
    off = api.theme.onChange((theme) => {
      resolvedTheme.value = theme?.resolved || api.theme.get().resolved
    })
  })

  onBeforeUnmount(() => off?.())

  return { resolvedTheme }
}
