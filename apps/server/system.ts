import { execFileSync } from 'node:child_process'

export interface AutostartState {
  supported: boolean
  enabled: boolean
  exe: string
}

export interface AutostartState {
  supported: boolean
  enabled: boolean
  exe: string
}

const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
const VALUE_NAME = 'WeekReport'

function appExe() {
  return process.env.WR_APP_EXE || process.execPath
}

export function getAutostart(): AutostartState {
  if (process.platform !== 'win32') return { supported: false, enabled: false, exe: appExe() }
  try {
    const output = execFileSync('reg', ['query', RUN_KEY, '/v', VALUE_NAME], { encoding: 'utf8' })
    return { supported: true, enabled: output.includes(VALUE_NAME), exe: appExe() }
  } catch {
    return { supported: true, enabled: false, exe: appExe() }
  }
}

export function setAutostart(enabled: boolean): AutostartState {
  if (process.platform !== 'win32') throw new Error('当前系统暂不支持开机自启动')
  if (enabled) {
    execFileSync('reg', [
      'add', RUN_KEY, '/v', VALUE_NAME, '/t', 'REG_SZ',
      '/d', `"${appExe()}"`, '/f'
    ], { stdio: 'ignore' })
  } else {
    try {
      execFileSync('reg', ['delete', RUN_KEY, '/v', VALUE_NAME, '/f'], { stdio: 'ignore' })
    } catch {}
  }
  return getAutostart()
}
