import assert from 'node:assert/strict'
import test from 'node:test'
import { readGitPrepareBuilds } from '../apps/server/plugins.ts'

// pnpm 12 的真实输出：帮示例按终端宽度折行，键本身跨了两行。
const output = `
Error: ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED

  × adding a new package
  ╰─▶ The git-hosted package "la-proxy-cli@1.0.1" needs to execute build
      scripts but is not in the "allowBuilds" allowlist.
  help: Add the package to "allowBuilds" in your project's pnpm-workspace.yaml
        to allow it to run scripts. For example:
        allowBuilds:
          la-proxy-cli@git+https://github.com/owner/repo.git/
        abcdef123456: true
`

test('restores wrapped git prepare allowBuilds keys', () => {
  assert.deepEqual(readGitPrepareBuilds(output), [
    'la-proxy-cli@git+https://github.com/owner/repo.git/abcdef123456',
  ])
})

test('strips quotes around scoped keys', () => {
  assert.deepEqual(readGitPrepareBuilds(`
Error: ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED
        allowBuilds:
          "@scope/plugin@git+https://github.com/owner/repo.git#abcdef": true
`), ['@scope/plugin@git+https://github.com/owner/repo.git#abcdef'])
})

test('ignores the ignored-builds hint from ordinary dependencies', () => {
  assert.deepEqual(readGitPrepareBuilds(`
Error: ERR_PNPM_IGNORED_BUILDS
hint: To allow the execution of build scripts for a package, add its name to "allowBuilds" and set to "true".
hint: For example:
hint: allowBuilds:
hint:   esbuild: true
`), [])
})

test('returns nothing for unrelated failures', () => {
  assert.deepEqual(readGitPrepareBuilds('Error: ERR_PNPM_FETCH_404'), [])
})
