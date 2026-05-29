#!/usr/bin/env node
/**
 * 릴리즈 자동화 스크립트
 *
 * 사용법:
 *   node scripts/release.mjs <major|minor|patch|auto> [--push] [--dry-run]
 *
 * 동작:
 *   1) 직전 태그(vX.Y.Z) 이후의 커밋을 모은다.
 *   2) bump 레벨(major/minor/patch)을 적용해 다음 버전을 계산한다.
 *      - 'auto'면 커밋 메시지(conventional commits)로 추정: BREAKING/`!` -> major, feat -> minor, 그 외 -> patch.
 *   3) CHANGELOG.md 상단(releases 마커 바로 아래)에 새 버전 섹션을 추가한다.
 *   4) package.json 버전을 올리고 `chore(release): vX.Y.Z` 커밋 + `vX.Y.Z` 태그를 만든다.
 *   5) --push 를 주면 `git push --follow-tags` 까지 수행한다.
 *
 * 메모: 기능/수정 작업은 이 스크립트 실행 전에 먼저 커밋되어 있어야 한다.
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkgPath = join(root, 'package.json')
const changelogPath = join(root, 'CHANGELOG.md')

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const doPush = args.includes('--push')
let level = args.find(a => ['major', 'minor', 'patch', 'auto'].includes(a)) || 'auto'

const sh = cmd => execSync(cmd, { cwd: root, encoding: 'utf8' }).trim()
const shTry = cmd => {
  try {
    return sh(cmd)
  } catch {
    return ''
  }
}

// 1) 워킹트리 확인 (릴리즈 전 모든 작업은 커밋되어 있어야 함)
const dirty = shTry('git status --porcelain')
if (dirty && !dryRun) {
  console.error('커밋되지 않은 변경사항이 있습니다. 릴리즈 전에 먼저 커밋하세요:\n' + dirty)
  process.exit(1)
}

// 2) 현재 버전 / 직전 태그 / 커밋 수집 (해시와 제목을 0x1f 바이트로 구분)
const SEP = '\x1f'
const pkgText = readFileSync(pkgPath, 'utf8')
const current = JSON.parse(pkgText).version
const lastTag = shTry('git describe --tags --abbrev=0')
const range = lastTag ? `${lastTag}..HEAD` : ''
const rawLog = shTry(`git log ${range} --no-merges --pretty=format:%H%x1f%s`)
const commits = rawLog
  ? rawLog.split('\n').map(line => {
      const [hash, ...rest] = line.split(SEP)
      return { hash: (hash || '').slice(0, 7), subject: rest.join(SEP) }
    })
  : []

// 3) bump 레벨 자동 판단
const typeOf = c => (c.subject.match(/^(\w+)(\(.+?\))?!?:/) || [, ''])[1]
const isBreaking = c => /!:/.test(c.subject) || /BREAKING[ -]CHANGE/.test(c.subject)
if (level === 'auto') {
  if (commits.some(isBreaking)) level = 'major'
  else if (commits.some(c => typeOf(c) === 'feat')) level = 'minor'
  else level = 'patch'
}

// 4) 다음 버전 계산
const [maj, min, pat] = current.split('.').map(Number)
const next =
  level === 'major'
    ? `${maj + 1}.0.0`
    : level === 'minor'
      ? `${maj}.${min + 1}.0`
      : `${maj}.${min}.${pat + 1}`

// 5) 릴리즈 노트 분류
const SECTIONS = [
  { key: 'feat', title: '기능 (Features)' },
  { key: 'fix', title: '버그 수정 (Fixes)' },
  { key: 'perf', title: '성능 (Performance)' },
  { key: 'refactor', title: '리팩터링 (Refactor)' },
  { key: 'docs', title: '문서 (Docs)' },
]
const stripType = s => s.replace(/^\w+(\(.+?\))?!?:\s*/, '')
const used = new Set()
const noteLines = []
for (const sec of SECTIONS) {
  const items = commits.filter(c => typeOf(c) === sec.key)
  if (!items.length) continue
  noteLines.push(`### ${sec.title}`, '')
  for (const c of items) {
    used.add(c.hash)
    noteLines.push(`- ${stripType(c.subject)} (${c.hash})`)
  }
  noteLines.push('')
}
const others = commits.filter(c => !used.has(c.hash))
if (others.length) {
  noteLines.push('### 기타 (Other)', '')
  for (const c of others) noteLines.push(`- ${c.subject} (${c.hash})`)
  noteLines.push('')
}
if (!commits.length) noteLines.push('- (직전 릴리즈 이후 기록된 커밋이 없습니다)', '')

const date = new Date().toISOString().slice(0, 10)
const entry = `## [${next}] - ${date}\n\n${noteLines.join('\n').trim()}\n`

console.log(
  [
    '',
    `현재 버전 : ${current}`,
    `다음 버전 : ${next}  (bump: ${level})`,
    `직전 태그 : ${lastTag || '(없음)'}`,
    `커밋 수   : ${commits.length}`,
    '',
    '--- 릴리즈 노트 미리보기 ---',
    entry,
  ].join('\n')
)

if (dryRun) {
  console.log('[dry-run] 파일을 수정하지 않았습니다.')
  process.exit(0)
}

// 6) CHANGELOG / package.json 갱신
const MARKER = '<!-- releases -->'
let changelog = readFileSync(changelogPath, 'utf8')
changelog = changelog.includes(MARKER)
  ? changelog.replace(MARKER, `${MARKER}\n\n${entry}`)
  : `${changelog}\n${entry}`
writeFileSync(changelogPath, changelog)
writeFileSync(pkgPath, pkgText.replace(/("version":\s*")[^"]+(")/, `$1${next}$2`))

// 7) 커밋 + 태그
sh('git add package.json CHANGELOG.md')
sh(`git commit -m "chore(release): v${next}"`)
sh(`git tag -a v${next} -m "v${next}"`)
console.log(`\nv${next} 커밋 및 태그 생성 완료`)

if (doPush) {
  sh('git push --follow-tags')
  console.log('origin 에 push 완료 (--follow-tags)')
} else {
  console.log('push 하려면: git push --follow-tags   (또는 이 스크립트에 --push 추가)')
}
