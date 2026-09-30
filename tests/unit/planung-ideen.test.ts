import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { JobContext } from '../../src/main/jobs/queue'
import { aehnlichkeit, ideenPrompt, ohneWiederholung, planungClaudeJob, pruefeWoche, titelPrompt, transkriptProbe, wochenPrompt } from '../../src/main/planung/ideen'
import { neueKarte, type Karte } from '../../src/main/planung/karten'

const ROOT = resolve(__dirname, '../..')
const FAKE = resolve(__dirname, '../fixtures/fake-claude.mjs')

const karte = (x: Partial<Karte>): Karte => ({
  id: 'k1',
  kanal: 'MoinMornhart',
  spalte: 'idee',
  ordnung: 1,
  titel: 'Titel',
  notizen: '',
  checkliste: [],
  termin: null,
  thumbnail: null,
  schnitt: null,
  youtube: null,
  erstellt: '',
  rev: 1,
  updatedAt: '',
  updatedBy: 'PC',
  felder: {},
  ...x
})

function ctx(): JobContext<{ claudeSession?: string; claudePrompted?: boolean }> {
  let cp: { claudeSession?: string; claudePrompted?: boolean } | undefined
  return {
    id: 'test',
    get checkpoint() {
      return cp
    },
    save: async (c) => {
      cp = c
    },
    progress: () => undefined,
    yield: async () => undefined,
    signal: new AbortController().signal,
    track: () => undefined,
    waitUntil: () => {
      throw new Error('Limit')
    }
  }
}

describe('Planung mit Claude (ROADMAP 7.6)', () => {
  it('erkennt Wiederholungen an gemeinsamen Wörtern', () => {
    expect(aehnlichkeit('Ich überlebe 100 Tage im Nether', '100 TAGE im NETHER überleben?')).toBeGreaterThanOrEqual(0.75)
    expect(aehnlichkeit('Minecraft, aber jeder Block explodiert', 'Jeder Block explodiert in Minecraft!')).toBe(1)
    expect(aehnlichkeit('Ich baue eine Falle für SimPell', 'Der Warden jagt mich')).toBe(0)
    const ideen = ohneWiederholung(
      [
        { titel: ' Ich überlebe 100 Tage im Nether ', idee: 'a', warum: 'b' },
        { titel: 'Minecraft, aber jeder Block explodiert', idee: 'a', warum: 'b' },
        { titel: 'Jeder Block explodiert in Minecraft!', idee: 'a', warum: 'b' },
        { titel: '', idee: 'a', warum: 'b' }
      ],
      ['100 Tage Nether überleben']
    )
    expect(ideen.map((i) => i.titel)).toEqual(['Minecraft, aber jeder Block explodiert'])
  })

  it('gibt Claude Kanal, vorhandene Karten, Mitspieler und Wunsch mit', () => {
    const p = ideenPrompt({ kanal: 'MoinMornhart', karten: [karte({ titel: 'Duell gegen SimPell', spalte: 'upload' })], freunde: ['SimPell'], vorbilder: ['GommeHD: X'], wunsch: 'Halloween', heute: '2026-10-01', anzahl: 12 })
    expect(p).toContain('Finde 12 neue Video-Ideen')
    expect(p).toContain('Oktober 2026')
    expect(p).toContain('Philips Wunsch dazu: Halloween')
    expect(p).toContain('- [Upload] Duell gegen SimPell')
    expect(p).toContain('Mitspieler nur aus dieser Liste nennen: SimPell')
    expect(p).toContain('Nur Minecraft.')
    const morni = ideenPrompt({ kanal: 'MoinMorni', karten: [], andere: [karte({ titel: 'Creeper-Challenge' })], freunde: [], vorbilder: [], heute: '2026-10-01', anzahl: 12 })
    expect(morni).toContain('mindestens 4 Ideen sind Reactions')
    expect(morni).toContain('Videos des anderen Kanals (nicht wiederholen):\n- [Idee] Creeper-Challenge')
    expect(titelPrompt({ karte: karte({ titel: 'Arbeitstitel', notizen: 'Creeper' }), transkript: 'Hallo Leute', vorbilder: [], andere: ['Anderes Video'] })).toContain('Anfang des Transkripts:\nHallo Leute')
    const w = wochenPrompt({ karten: [karte({ id: 'abc', titel: 'Grube' })], frei: [{ kanal: 'MoinMornhart', tag: '2026-10-03', zeit: '17:00' }], heute: '2026-09-29' })
    expect(w).toContain('- MoinMornhart: Sa 03.10. 17:00 → Termin "2026-10-03T17:00"')
    expect(w).toContain('- abc: MoinMornhart, Idee, Grube')
  })

  it('lässt im Wochenplan nur freie Termine des richtigen Kanals und jede Karte einmal zu', () => {
    const karten = [karte({ id: 'a' }), karte({ id: 'b' }), karte({ id: 'c', kanal: 'MoinMorni' })]
    const frei = [
      { kanal: 'MoinMornhart', tag: '2026-10-03', zeit: '17:00' },
      { kanal: 'MoinMornhart', tag: '2026-10-07', zeit: '17:00' },
      { kanal: 'MoinMorni', tag: '2026-10-02', zeit: '18:00' }
    ]
    const w = pruefeWoche(
      {
        plan: [
          { karte: 'a', termin: '2026-10-03T17:00', grund: '' },
          { karte: 'a', termin: '2026-10-07T17:00', grund: 'doppelt' },
          { karte: 'b', termin: '2026-10-03T17:00', grund: 'Termin belegt' },
          { karte: 'c', termin: '2026-10-07T17:00', grund: 'falscher Kanal' },
          { karte: 'x', termin: '2026-10-02T18:00', grund: 'unbekannt' },
          { karte: 'c', termin: '2026-10-02T18:00', grund: '' },
          { karte: 'b', termin: '2026-10-04T17:00', grund: 'kein freier Termin' }
        ],
        aufnehmen: [{ karte: 'b', grund: '' }, { karte: 'b', grund: '' }, { karte: 'x', grund: '' }],
        hinweis: 'ok'
      },
      karten,
      frei
    )
    expect(w.plan.map((p) => `${p.karte}@${p.termin}`)).toEqual(['a@2026-10-03T17:00', 'c@2026-10-02T18:00'])
    expect(w.aufnehmen.map((a) => a.karte)).toEqual(['b'])
  })

  it('findet Ideen über das Abo und wirft Wiederholungen heraus', async () => {
    const daten = await mkdtemp(join(tmpdir(), 'moin-ideen-'))
    await mkdir(join(daten, 'skins'), { recursive: true })
    await writeFile(join(daten, 'skins', 'skins.json'), JSON.stringify([{ id: 's', name: 'SimPell', datei: 's.png', rolle: 'freund', slim: false }]))
    await neueKarte(daten, { kanal: 'MoinMornhart', titel: '100 Tage im Nether überleben' }, 'PC')
    const e = await planungClaudeJob({ art: 'ideen', daten, claudeCli: process.execPath, claudePrefix: [FAKE], configDir: join(ROOT, 'config'), kanal: 'MoinMornhart', heute: '2026-09-29' }, ctx())
    expect(e.art).toBe('ideen')
    if (e.art === 'ideen') expect(e.ideen.map((i) => i.titel)).toEqual(['Minecraft, aber jeder Block explodiert', 'Ich baue eine Falle für SimPell'])
  })
})

describe('Namen fürs Video (Schnitt)', () => {
  it('nimmt Sätze über die ganze Länge, nicht nur den Anfang', () => {
    const saetze = Array.from({ length: 200 }, (_, i) => `Satz Nummer ${i} im Video.`)
    const probe = transkriptProbe(saetze, 500)
    expect(probe.length).toBeLessThanOrEqual(500)
    expect(probe).toContain('Satz Nummer 0 ')
    expect(Number(/Nummer (\d+)[^N]*$/.exec(probe)?.[1])).toBeGreaterThan(150)
    expect(transkriptProbe(['kurz', '', 'da'], 500)).toBe('kurz da')
  })
  it('sagt Claude, dass der Arbeitstitel nur der Dateiname sein kann', () => {
    const p = titelPrompt({ karte: { kanal: 'MoinMorni', titel: '2026-09-30 19-00-01', notizen: '' }, transkript: 'Hallo Leute', vorbilder: [], andere: [], ganz: true })
    expect(p).toContain('MoinMorni')
    expect(p).toContain('Dateiname')
    expect(p).toContain('ganze Länge')
  })
})
