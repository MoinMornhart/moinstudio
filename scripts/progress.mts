// Erzeugt die Daten für die Fortschrittsseite (Fernkontrolle) aus ROADMAP.md und CHANGELOG.md.
// Aufruf: node scripts/progress.mts → test-output/progress/{roadmap,versions}.json
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

type Status = 'done' | 'open'
interface Step {
  code: string
  title: string
  status: Status
}
interface Milestone {
  code: string
  name: string
  target: string
  steps: Step[]
}

const root = join(import.meta.dirname, '..')
const roadmap = readFileSync(join(root, 'ROADMAP.md'), 'utf8').split(/\r?\n/)
const milestones: Milestone[] = []
let current: Milestone | null = null
let pending: { code: string; title: string } | null = null

const clean = (s: string): string => s.replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ').trim()

for (const line of roadmap) {
  const ms = /^## (M\d+) – (.+?)(?: → (.+))?$/.exec(line)
  if (ms) {
    current = { code: ms[1]!, name: clean(ms[2]!), target: clean(ms[3] ?? ''), steps: [] }
    milestones.push(current)
    pending = null
    continue
  }
  if (/^## /.test(line)) {
    current = null
    continue
  }
  if (!current) continue
  const sub = /^### (\d+\.\d+) (.+)$/.exec(line)
  if (sub) {
    pending = { code: sub[1]!, title: clean(sub[2]!) }
    continue
  }
  const box = /^- \[( |x)\] (.*)$/.exec(line)
  if (!box) continue
  const status: Status = box[1] === 'x' ? 'done' : 'open'
  if (pending) {
    current.steps.push({ ...pending, status })
    pending = null
    continue
  }
  const bold = /^\*\*(\d+\.\d+) (.+?):?\*\*/.exec(box[2]!)
  if (bold) current.steps.push({ code: bold[1]!, title: clean(bold[2]!), status })
}

// M0/M1 tragen die Zielversion nur in der Übersichtstabelle
for (const row of roadmap) {
  const m = /^\| (M\d+) [^|]+\| ([^|]+) \|/.exec(row)
  const ms = m && milestones.find((x) => x.code === m[1] && !x.target)
  if (ms) ms.target = clean(m[2]!)
}

const versions: { version: string; date: string; summary: string }[] = []
const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8').split(/\r?\n/)
for (let i = 0; i < changelog.length; i++) {
  const v = /^## \[(\d+\.\d+\.\d+)\] - (\S+)/.exec(changelog[i]!)
  if (!v) continue
  const summary = changelog.slice(i + 1, i + 4).find((l) => l.startsWith('> '))
  versions.push({ version: v[1]!, date: v[2]!, summary: summary ? summary.slice(2).trim() : '' })
}

const out = join(root, 'test-output', 'progress')
mkdirSync(out, { recursive: true })

// --log "Text": Eintrag vorn an den Verlauf hängen (lokale Kopie, höchstens 40 Einträge)
const logAt = process.argv.indexOf('--log')
if (logAt > 0 && process.argv[logAt + 1]) {
  const file = join(out, 'log.json')
  let entries: { at: string; text: string }[] = []
  try {
    entries = (JSON.parse(readFileSync(file, 'utf8')) as { entries: typeof entries }).entries
  } catch {
    // noch kein Verlauf
  }
  const now = new Date()
  const off = -now.getTimezoneOffset()
  const pad = (n: number): string => String(Math.abs(n)).padStart(2, '0')
  const local = new Date(now.getTime() + off * 60_000).toISOString().slice(0, 19)
  const at = `${local}${off >= 0 ? '+' : '-'}${pad(Math.trunc(off / 60))}:${pad(off % 60)}`
  entries.unshift({ at, text: process.argv[logAt + 1]! })
  writeFileSync(file, JSON.stringify({ entries: entries.slice(0, 40) }))
}
writeFileSync(join(out, 'roadmap.json'), JSON.stringify({ milestones }, null, 1))
writeFileSync(join(out, 'versions.json'), JSON.stringify({ list: versions.slice(0, 40) }, null, 1))
const steps = milestones.flatMap((m) => m.steps)
console.log(`${milestones.length} Meilensteine, ${steps.filter((s) => s.status === 'done').length}/${steps.length} Schritte erledigt, ${versions.length} Versionen → ${out}`)
