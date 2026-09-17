import { writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const short = (value = '') => value.trim().slice(0, 8)
const commit = short(
  process.env.CF_PAGES_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  process.env.VITE_APP_COMMIT ||
  (() => {
    try { return execSync('git rev-parse HEAD', { encoding: 'utf8' }) } catch { return 'local' }
  })(),
) || 'local'

writeFileSync('dist/version.json', JSON.stringify({ version: '33.0.0', commit }) + '\n')
console.log(`Stamped dist/version.json: 33.0.0 (${commit})`)
