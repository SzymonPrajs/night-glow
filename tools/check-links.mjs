import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '*.md'], {
  encoding: 'utf8',
}).trim().split('\n').filter(Boolean)

const broken = []
let checked = 0

for (const file of files) {
  // During large rename operations, the Git index can still list the deleted
  // side of an unstaged move. Only the working tree is authoritative here.
  if (!existsSync(file)) continue
  const markdown = readFileSync(file, 'utf8')
  for (const match of markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const link = match[1]
    if (/^(https?:|mailto:|#)/.test(link)) continue
    const path = link.split('#', 1)[0]
    if (!path) continue
    checked += 1
    if (!existsSync(resolve(dirname(file), path))) broken.push(`${file}: ${link}`)
  }
}

if (broken.length) {
  console.error(broken.join('\n'))
  process.exit(1)
}

console.log(`Markdown links: ${checked} local links valid`)
