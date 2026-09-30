import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runClaude, type ClaudeRunOptions } from '../claude/run'
import type { Katalog } from './katalog'

/**
 * Thumbnail-Planung durch Claude (ROADMAP 5.1): Philips Beschreibung → mehrere Szenen für den Blender-Szenen-Bauer.
 * Jede Variante nennt das Vorbild-Thumbnail, an dem sie sich orientiert. Claude läuft über das Abo (Claude Code
 * headless), nie über einen API-Key.
 */

export interface Vorbild {
  id: string
  kanal: string
  titel: string
  video: string
  zeigt: string
  rezept: string
}

export interface PlanFigur {
  id: string
  /** Anzeigename für Claude, z. B. „Philip (MoinMornhart)“ oder „SimPell“ */
  name: string
}

export interface Variante {
  titel: string
  vorbild: string
  warum: string
  szene: Szene
  /** höchstens ein kurzer Text (1–3 Wörter), meist leer */
  text?: { text: string; farbe?: string }[]
}

export interface Szene {
  welt: { art: string; bloecke?: { art: string; von: number[]; bis?: number[]; waende?: string }[]; [k: string]: unknown }
  himmel?: string
  figuren: { id: string; pose: string; position?: number[]; blick?: number | 'auto'; hoehe?: number; item?: { name: string; hand?: string }; [k: string]: unknown }[]
  mobs?: { art: string; position?: number[]; blick?: number | string; groesse?: number; [k: string]: unknown }[]
  objekte?: { block: string; position?: number[]; drehung?: number[]; groesse?: number; wichtig?: boolean }[]
  kamera?: { modus?: string; seite?: string; thema?: string | number[]; [k: string]: unknown }
  [k: string]: unknown
}

export interface Plan {
  varianten: Variante[]
}

/** JSON-Schema für die strukturierte Antwort (--json-schema); Details der Szene prüft `pruefeSzene`. */
export const PLAN_SCHEMA = {
  type: 'object',
  required: ['varianten'],
  properties: {
    varianten: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['titel', 'vorbild', 'warum', 'szene'],
        properties: {
          titel: { type: 'string' },
          vorbild: { type: 'string' },
          warum: { type: 'string' },
          text: { type: 'array', items: { type: 'object', required: ['text'], properties: { text: { type: 'string' }, farbe: { type: 'string' } } } },
          szene: {
            type: 'object',
            required: ['welt', 'figuren', 'kamera'],
            properties: {
              welt: { type: 'object', required: ['art'] },
              himmel: { type: 'string' },
              figuren: { type: 'array', minItems: 1, items: { type: 'object', required: ['id', 'pose'] } },
              mobs: { type: 'array' },
              objekte: { type: 'array' },
              kamera: { type: 'object' }
            }
          }
        }
      }
    }
  }
} as const

export async function ladeVorbilder(configDir: string): Promise<Vorbild[]> {
  const roh = JSON.parse(await readFile(join(configDir, 'vorbilder.json'), 'utf8')) as { vorbilder: Vorbild[] }
  return roh.vorbilder
}

function katalogText(k: Katalog): string {
  return [
    `Posen: ${k.posen.map((p) => (p.hinweis ? `${p.name} (${p.hinweis})` : p.name)).join('; ')}`,
    `Mimik (Feld „mimik“ je Figur, Augen bleiben die Skin-Augen): ${k.mimiken.join(', ')}`,
    `Welten: ${k.welten.map((w) => `${w.name} (${w.hinweis})`).join('; ')}`,
    `Himmel: ${k.himmel.join(', ')}`,
    `Kamera-Modi: ${k.kameraModi.join(', ')}`,
    `Mobs: ${k.mobs.join(', ')}`,
    // Vollständige Liste: sonst greift Claude zu ähnlichen Blöcken (oak_leaves statt cherry_leaves)
    `Blöcke für „bloecke“ und „objekte“ (jede Block-ID des Spiels, ${k.bloecke.length} Stück; zum Graben: luft): ${k.bloecke.join(', ')}`
  ].join('\n')
}

function vorbilderText(v: Vorbild[]): string {
  return v.map((x) => `- id ${x.id} – ${x.kanal}: „${x.titel}“. Zeigt: ${x.zeigt}. Rezept: ${x.rezept}`).join('\n')
}

export function plane(vorlage: string, o: { beschreibung: string; kanal: string; figuren: PlanFigur[]; anzahl: number; katalog: Katalog; vorbilder: Vorbild[] }): string {
  const figuren = o.figuren.map((f, i) => `- id „${f.id}“: ${f.name}${i === 0 ? ' (Hauptfigur)' : ''}`).join('\n')
  return vorlage
    .replaceAll('{{kanal}}', o.kanal)
    .replaceAll('{{beschreibung}}', o.beschreibung.replaceAll('“', '"'))
    .replaceAll('{{figuren}}', figuren)
    .replaceAll('{{anzahl}}', String(o.anzahl))
    .replaceAll('{{katalog}}', katalogText(o.katalog))
    .replaceAll('{{vorbilder}}', vorbilderText(o.vorbilder))
}

/**
 * Prüft und repariert eine geplante Szene gegen den Katalog. Gibt die Fehler zurück, die sich nicht sicher
 * reparieren lassen (dann wird neu geplant); kleine Abweichungen werden still korrigiert.
 */
export function pruefeSzene(s: Szene, k: Katalog, figurIds: string[]): string[] {
  const fehler: string[] = []
  const posen = new Set(k.posen.map((p) => p.name))
  const welten = new Set(k.welten.map((w) => w.name))
  const bloecke = new Set([...k.bloecke, 'luft'])
  if (!s.welt || !welten.has(s.welt.art)) fehler.push(`Unbekannte Welt „${s.welt?.art}“`)
  for (const b of s.welt?.bloecke ?? []) if (!bloecke.has(b.art)) fehler.push(`Unbekannter Block „${b.art}“`)
  if (s.himmel && !k.himmel.includes(s.himmel)) s.himmel = 'tag'
  if (!s.figuren?.length) fehler.push('Keine Figur')
  const ids = new Set<string>()
  for (const f of s.figuren ?? []) {
    if (!figurIds.includes(f.id)) fehler.push(`Unbekannte Figur „${f.id}“`)
    ids.add(f.id)
    if (!posen.has(f.pose)) fehler.push(`Unbekannte Pose „${f.pose}“ bei ${f.id}`)
    if (f['mimik'] !== undefined && !k.mimiken.includes(String(f['mimik']))) f['mimik'] = 'neutral'
    if (f.item && !/^[a-z0-9_]+$/.test(f.item.name)) fehler.push(`Ungültiges Item „${f.item.name}“`)
    if (f.item && f.item.hand !== 'r' && f.item.hand !== 'l') f.item.hand = 'l'
  }
  if (s.figuren?.[0] && s.figuren[0].id !== figurIds[0]) fehler.push(`Die erste Figur muss „${figurIds[0]}“ sein`)
  for (const m of s.mobs ?? []) if (!k.mobs.includes(m.art)) fehler.push(`Unbekannter Mob „${m.art}“`)
  for (const o of s.objekte ?? []) if (!bloecke.has(o.block) || o.block === 'luft') fehler.push(`Unbekannter Block „${o.block}“`)
  s.kamera = s.kamera ?? {}
  if (!s.kamera.modus || !k.kameraModi.includes(s.kamera.modus)) s.kamera.modus = 'nah'
  const mobs = s.mobs ?? []
  if (typeof s.kamera.thema === 'string') {
    const t = s.kamera.thema
    const mobIndex = /^mob:(\d+)$/.exec(t)?.[1]
    const istMob = mobIndex !== undefined ? Number(mobIndex) < mobs.length : mobs.some((m) => m.art === t)
    const objektIndex = /^objekt:(\d+)$/.exec(t)?.[1]
    const istObjekt = objektIndex !== undefined && Number(objektIndex) < (s.objekte ?? []).length
    if (!ids.has(t) && !istMob && !istObjekt) fehler.push(`Kamera-Thema „${t}“ ist weder Figur noch Mob oder Objekt der Szene`)
  }
  if (s.kamera.thema === undefined) s.kamera.thema = s.figuren?.[1]?.id ?? (mobs.length ? 'mob:0' : [4, 4, 1.5])
  return fehler
}

/** Nimmt die Antwort von Claude (strukturiert oder als JSON im Text) und prüft jede Variante. */
export function liesPlan(structured: unknown, text: string, k: Katalog, figurIds: string[], vorbilder: Vorbild[]): { plan: Plan; fehler: string[] } {
  let roh: unknown = structured
  if (!roh) {
    const m = /\{[\s\S]*\}/.exec(text)
    if (!m) throw new Error('Claude hat keinen Plan geliefert.')
    roh = JSON.parse(m[0])
  }
  const plan = roh as Plan
  if (!Array.isArray(plan.varianten) || plan.varianten.length === 0) throw new Error('Der Plan enthält keine Varianten.')
  const fehler: string[] = []
  const bekannt = new Set(vorbilder.map((v) => v.id))
  plan.varianten.forEach((v, i) => {
    if (!bekannt.has(v.vorbild)) fehler.push(`Variante ${i + 1}: unbekanntes Vorbild „${v.vorbild}“`)
    // Stilbuch: höchstens ein Text mit 1–4 Wörtern – längere Texte werden gekürzt statt abgelehnt
    v.text = (v.text ?? []).slice(0, 1).map((t) => ({ ...t, text: t.text.split(/\s+/).slice(0, 4).join(' ') }))
    for (const f of pruefeSzene(v.szene, k, figurIds)) fehler.push(`Variante ${i + 1}: ${f}`)
  })
  return { plan, fehler }
}

/** Warnungen der Selbstprüfung, die einen Neubau auslösen (ROADMAP 5.3). Leichte Abweichungen bleiben Hinweise. */
export function ernsteWarnungen(warnungen: string[]): string[] {
  return warnungen.filter((w) => {
    if (/^Kamera trifft/.test(w)) return Number(/Abweichung ([\d.]+)/.exec(w)?.[1] ?? 0) > 0.5
    if (/^Item .* kaum sichtbar/.test(w)) return Number(/\((\d+) %/.exec(w)?.[1] ?? 0) < 60
    return /^(Gesicht|Etwas versperrt|Gegner|Mob|Objekt|Kopf|Text|Bild)/.test(w)
  })
}

export const SZENE_SCHEMA = { type: 'object', required: ['szene'], properties: { szene: PLAN_SCHEMA.properties.varianten.items.properties.szene } } as const

/** Auftrag an Claude: eine gerenderte Szene anhand des Prüfberichts verbessern (gleiche Bildidee, gleiches Vorbild). */
export function korrekturPrompt(vorlage: string, o: { beschreibung: string; kanal: string; figuren: PlanFigur[]; katalog: Katalog; vorbilder: Vorbild[] }, variante: Variante, warnungen: string[], bericht: unknown): string {
  return `${plane(vorlage, { ...o, anzahl: 1 })}

# Korrektur nach dem Render

Diese Variante wurde gerendert, aber die automatische Bildprüfung meldet Fehler. Behalte Bildidee und Vorbild
(„${variante.vorbild}“) bei und ändere die Szene so, dass die Fehler verschwinden (Positionen, Blick, Kamera, Pose,
Größe, störende Blöcke entfernen). Antworte nur mit {"szene": …}.

Titel: ${variante.titel}
Szene:
${JSON.stringify(variante.szene)}

Fehler der Bildprüfung:
${warnungen.map((w) => `- ${w}`).join('\n')}

Messwerte (Bildkoordinaten 0–1, 0,0 = oben links):
${JSON.stringify(bericht)}

Hilfen: Ist ein Gesicht verdeckt, stelle die Figur weiter zur Seite oder ändere den Blick. Ist ein Gegner oder Mob zu
klein oder nicht im Bild, stelle ihn näher (y kleiner) und näher zur Bildmitte. Versperrt etwas die Sicht, entferne
Blöcke oder Objekte zwischen Kamera (−Y vor der Figur) und Figur. Ist ein Item kaum sichtbar, nimm die andere Hand oder
eine andere Pose.`
}

export interface PlanungsOptionen {
  beschreibung: string
  kanal: string
  figuren: PlanFigur[]
  anzahl?: number
  katalog: Katalog
  vorbilder: Vorbild[]
  vorlage: string
  claude: Pick<ClaudeRunOptions, 'cli' | 'cliPrefix' | 'workDir' | 'model' | 'ctx' | 'signal'>
  /** Wie oft bei ungültigem Plan neu gefragt wird */
  versuche?: number
}

/** Plant Varianten; bei Fehlern bekommt Claude sie zurück und plant noch einmal. */
export async function planeThumbnail(o: PlanungsOptionen): Promise<{ plan: Plan; fehler: string[] }> {
  const ids = o.figuren.map((f) => f.id)
  let prompt = plane(o.vorlage, { ...o, anzahl: o.anzahl ?? 3 })
  let letzte: { plan: Plan; fehler: string[] } | null = null
  for (let versuch = 0; versuch < (o.versuche ?? 2); versuch++) {
    const res = await runClaude({ ...o.claude, prompt, tools: [], maxTurns: 3, jsonSchema: PLAN_SCHEMA })
    if (!res.ok) throw new Error(`Claude-Planung fehlgeschlagen: ${res.errors.join(' | ') || res.subtype}`)
    letzte = liesPlan(res.structured, res.text, o.katalog, ids, o.vorbilder)
    if (!letzte.fehler.length) return letzte
    prompt = `${plane(o.vorlage, { ...o, anzahl: o.anzahl ?? 3 })}\n\n# Korrektur\n\nDein letzter Plan hatte diese Fehler, behebe sie:\n${letzte.fehler.map((f) => `- ${f}`).join('\n')}`
  }
  return letzte!
}
