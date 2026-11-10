import { execFileSync } from 'node:child_process'

export interface AutostartState {
  supported: boolean
  enabled: boolean
  exe: string
}

const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
const VALUE_NAME = 'LuckyApps'
// 旧产品名写入的自启动项，读取兼容、关闭时一并清理
const LEGACY_VALUE_NAMES = ['WeekReport']

function appExe() {
  return process.env.WR_APP_EXE || process.execPath
}

function hasRunValue(name: string) {
  try {
    const output = execFileSync('reg', ['query', RUN_KEY, '/v', name], { encoding: 'utf8' })
    return output.includes(name)
  } catch {
    return false
  }
}

export function getAutostart(): AutostartState {
  if (process.platform !== 'win32') return { supported: false, enabled: false, exe: appExe() }
  const enabled = [VALUE_NAME, ...LEGACY_VALUE_NAMES].some(hasRunValue)
  return { supported: true, enabled, exe: appExe() }
}

export function setAutostart(enabled: boolean): AutostartState {
  if (process.platform !== 'win32') throw new Error('当前系统暂不支持开机自启动')
  if (enabled) {
    execFileSync('reg', [
      'add', RUN_KEY, '/v', VALUE_NAME, '/t', 'REG_SZ',
      '/d', `"${appExe()}"`, '/f',
    ], { stdio: 'ignore' })
  }
  for (const name of enabled ? LEGACY_VALUE_NAMES : [VALUE_NAME, ...LEGACY_VALUE_NAMES]) {
    try {
      execFileSync('reg', ['delete', RUN_KEY, '/v', name, '/f'], { stdio: 'ignore' })
    } catch {}
  }
  return getAutostart()
}
