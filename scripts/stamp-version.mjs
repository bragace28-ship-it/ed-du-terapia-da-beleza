import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
const short = (value = '') => value.trim().slice(0, 8)
const commit = short(
  process.env.CF_PAGES_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  process.env.VITE_APP_COMMIT ||
  (() => { try { return execSync('git rev-parse HEAD', { encoding: 'utf8' }) } catch { return 'local' } })(),
) || 'local'
if (existsSync('dist/index.html')) {
  let html = readFileSync('dist/index.html', 'utf8')
  html = html.replace(/<title>[^<]*<\/title>/i, '<title>ED & DU — V33.0.0</title>')
  html = html.replace(/V28(?:\.0)?(?:\s+Teste Final Funcional)?/g, 'V33.0.0')
  writeFileSync('dist/index.html', html)
}
writeFileSync('dist/version.json', JSON.stringify({ version: '33.0.0', commit }) + '\n')
console.log(`Stamped dist/version.json: 33.0.0 (${commit})`)
