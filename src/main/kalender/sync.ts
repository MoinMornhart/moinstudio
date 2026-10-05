import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { writeJsonAtomic } from '../data/jsonfile'
import { aendereKarte, ladeKarten, type Karte } from '../planung/karten'
import { CalDav, DavFehler, type DavKalender } from './caldav'
import { leseIcs, schreibeIcs } from './ics'
import type { KalenderLink, KalenderStand, FremderTermin } from '@shared/app'

/**
 * Kalender-Abgleich (Philip, 05.10.): Planung ↔ Apple Kalender (iCloud, beide Richtungen) und fremde Kalender per
 * iCal-Link (Google, Outlook, alles mit ICS) zum Anzeigen. Läuft alle 5 Minuten und kurz nach jeder Kartenänderung.
 *
 * - Upload-Termine landen im iCloud-Kalender „MoinStudio“ (Termin `moinstudio-<karte>.ics`). Verschiebt Philip dort
 *   einen Termin (iPhone, Mac), übernimmt die Planung ihn; sonst gilt die Karte.
 * - Einstellungen (Apple-ID, Links) liegen im Datenordner und gelten für PC und Laptop; das app-spezifische Passwort ist
 *   mit Windows verschlüsselt und bleibt auf dem Gerät.
 */

export const TAKT_MS = 5 * 60_000
const MOIN_PFAD = 'moinstudio'
const MOIN_NAME = 'MoinStudio'
const MOIN_FARBE = '#F5A623'
const PRAEFIX = 'moinstudio-'

interface Gemeinsam {
  apple: { benutzer: string; eintragen: boolean; ausgeblendet: string[] } | null
  links: KalenderLink[]
}

export interface SyncHilfe {
  daten: () => Promise<string>
  /** Geräte-Ordner (%APPDATA%\MoinStudio) */
  geraet: string
  verschluessele: (t: string) => string
  entschluessele: (t: string) => string
  melde: () => void
  abruf?: typeof fetch
  jetzt?: () => number
}

const tag = 86_400_000
const hash = (t: string): string => createHash('sha1').update(t).digest('hex').slice(0, 12)

/** Termin einer Karte im Kalender: Titel mit Kanal, Dauer 30 Minuten, Stand in der Beschreibung */
export function kartenTermin(k: Pick<Karte, 'id' | 'kanal' | 'titel' | 'termin' | 'spalte' | 'notizen' | 'updatedAt'>): { uid: string; titel: string; start: string; minuten: number; beschreibung: string; geaendert: string } {
  const SPALTE: Record<string, string> = { idee: 'Idee', aufnahme: 'Aufnahme', schnitt: 'Schnitt', thumbnail: 'Thumbnail', upload: 'Upload', veroeffentlicht: 'Veröffentlicht' }
  return {
    uid: `${PRAEFIX}${k.id}@moinstudio`,
    titel: `${k.spalte === 'veroeffentlicht' ? '✓ ' : '▶ '}${k.kanal}: ${k.titel}`,
    start: k.termin!,
    minuten: 30,
    beschreibung: `Upload ${k.kanal} · Stand: ${SPALTE[k.spalte] ?? k.spalte}${k.notizen.trim() ? `\n\n${k.notizen.trim()}` : ''}\n\nAus MoinStudio (Planung).`,
    geaendert: k.updatedAt
  }
}

/** Kartenzeit „YYYY-MM-DDTHH:MM“ (Termine ohne Uhrzeit bekommen 17:00 wie in der Planung) */
const kartenZeit = (t: string): string => (t.length >= 16 ? t.slice(0, 16) : `${t.slice(0, 10)}T17:00`)

export class KalenderSync {
  private laeuft: Promise<void> | null = null
  private nochmal = false
  private takt: NodeJS.Timeout | null = null
  private anstoss: NodeJS.Timeout | null = null
  private cache: KalenderStand = { apple: null, links: [], termine: [], stand: null, laeuft: false }

  constructor(private readonly h: SyncHilfe) {}

  private jetzt(): number {
    return this.h.jetzt?.() ?? Date.now()
  }
  private async gemeinsamDatei(): Promise<string> {
    return join(await this.h.daten(), 'planning', 'kalender.json')
  }
  private async gemeinsam(): Promise<Gemeinsam> {
    try {
      const g = JSON.parse(await readFile(await this.gemeinsamDatei(), 'utf8')) as Partial<Gemeinsam>
      return { apple: g.apple ?? null, links: Array.isArray(g.links) ? g.links : [] }
    } catch {
      return { apple: null, links: [] }
    }
  }
  private async speichereGemeinsam(g: Gemeinsam): Promise<void> {
    await writeJsonAtomic(await this.gemeinsamDatei(), g)
  }
  private geheimDatei = (): string => join(this.h.geraet, 'kalender-geheim.json')
  private zustandDatei = (): string => join(this.h.geraet, 'kalender-zustand.json')
  private async passwort(): Promise<string | null> {
    try {
      const g = JSON.parse(await readFile(this.geheimDatei(), 'utf8')) as { passwort?: string }
      return g.passwort ? this.h.entschluessele(g.passwort) : null
    } catch {
      return null
    }
  }
  private async zustand(): Promise<{ gesendet: Record<string, string>; termine?: FremderTermin[]; stand?: string | null }> {
    try {
      return JSON.parse(await readFile(this.zustandDatei(), 'utf8')) as { gesendet: Record<string, string> }
    } catch {
      return { gesendet: {} }
    }
  }

  /** Stand für die Oberfläche (sofort, aus dem Zwischenspeicher) */
  async stand(): Promise<KalenderStand> {
    if (!this.cache.stand) {
      const z = await this.zustand()
      if (z.termine) this.cache = { ...this.cache, termine: z.termine, stand: z.stand ?? null }
    }
    const g = await this.gemeinsam()
    const pw = await this.passwort()
    return {
      ...this.cache,
      laeuft: !!this.laeuft,
      apple: g.apple ? { ...(this.cache.apple ?? { kalender: [] }), benutzer: g.apple.benutzer, eintragen: g.apple.eintragen, verbunden: !!pw, ausgeblendet: g.apple.ausgeblendet } : null,
      links: g.links.map((l) => ({ ...l, fehler: this.cache.links.find((x) => x.id === l.id)?.fehler }))
    }
  }

  /** Apple-ID prüfen und speichern (Passwort verschlüsselt auf diesem Gerät) */
  async verbindeApple(benutzer: string, passwort: string): Promise<void> {
    const b = benutzer.trim()
    // Apple zeigt app-spezifische Passwörter als „abcd-efgh-ijkl-mnop“; mit Leerzeichen oder ohne Trenner eingetippt → Apple-Form
    const roh = passwort.trim()
    const buchstaben = roh.replace(/[\s-]+/g, '')
    const p = /^[a-z]{16}$/i.test(buchstaben) ? buchstaben.match(/.{4}/g)!.join('-') : roh
    if (!b || !p) throw new Error('Bitte Apple-ID und app-spezifisches Passwort eingeben.')
    const dav = new CalDav({ benutzer: b, passwort: p }, this.h.abruf)
    await dav.heim() // wirft bei falschem Passwort
    await writeJsonAtomic(this.geheimDatei(), { passwort: this.h.verschluessele(p) })
    const g = await this.gemeinsam()
    await this.speichereGemeinsam({ ...g, apple: { benutzer: b, eintragen: g.apple?.eintragen ?? true, ausgeblendet: g.apple?.ausgeblendet ?? [] } })
    this.anstossen(0)
  }

  async trenneApple(): Promise<void> {
    await writeJsonAtomic(this.geheimDatei(), {})
    const g = await this.gemeinsam()
    await this.speichereGemeinsam({ ...g, apple: null })
    this.cache = { ...this.cache, apple: null, termine: this.cache.termine.filter((t) => !t.quelle.startsWith('apple:')) }
    this.h.melde()
  }

  async einstellen(e: { eintragen?: boolean; ausgeblendet?: string[]; links?: KalenderLink[] }): Promise<void> {
    const g = await this.gemeinsam()
    if (g.apple && e.eintragen !== undefined) g.apple.eintragen = e.eintragen
    if (g.apple && e.ausgeblendet) g.apple.ausgeblendet = e.ausgeblendet.filter((x) => typeof x === 'string')
    if (e.links) {
      g.links = e.links
        .filter((l) => l && typeof l.url === 'string' && l.url.trim())
        .map((l) => ({ id: String(l.id || hash(l.url + this.jetzt())), name: String(l.name || 'Kalender').slice(0, 40), url: l.url.trim().replace(/^webcal:\/\//i, 'https://'), farbe: /^#[0-9a-f]{6}$/i.test(l.farbe ?? '') ? l.farbe : '#7c8a99', an: l.an !== false }))
    }
    await this.speichereGemeinsam(g)
    this.anstossen(0)
  }

  /** Link vor dem Speichern prüfen: lädt und zählt die Termine */
  async pruefeLink(url: string): Promise<number> {
    const u = url.trim().replace(/^webcal:\/\//i, 'https://')
    if (!/^https?:\/\//i.test(u)) throw new Error('Bitte einen Link mit https:// (oder webcal://) eingeben.')
    const text = await this.ladeLink(u)
    return leseIcs(text, this.jetzt() - 62 * tag, this.jetzt() + 365 * tag).length
  }

  private async ladeLink(url: string): Promise<string> {
    const res = await (this.h.abruf ?? fetch)(url, { signal: AbortSignal.timeout(30_000), headers: { Accept: 'text/calendar, */*' } })
    if (!res.ok) throw new Error(`Kalender-Link antwortet mit ${res.status}.`)
    const text = await res.text()
    if (!text.includes('BEGIN:VCALENDAR')) throw new Error('Unter dem Link liegt kein Kalender (iCal/ICS).')
    return text
  }

  /** Zeitplan: alle 5 Minuten; `anstossen` nach Kartenänderungen */
  start(): void {
    if (this.takt) return
    this.takt = setInterval(() => void this.synchronisiere(), TAKT_MS)
    this.anstossen(5_000)
  }
  stopp(): void {
    if (this.takt) clearInterval(this.takt)
    if (this.anstoss) clearTimeout(this.anstoss)
    this.takt = this.anstoss = null
  }
  anstossen(ms = 10_000): void {
    if (this.anstoss) clearTimeout(this.anstoss)
    this.anstoss = setTimeout(() => void this.synchronisiere(), ms)
  }

  /** Ein Abgleich; läuft schon einer, folgt direkt danach noch einer */
  async synchronisiere(): Promise<void> {
    if (this.laeuft) {
      this.nochmal = true
      return this.laeuft
    }
    this.laeuft = this.runde().finally(() => {
      this.laeuft = null
      if (this.nochmal) {
        this.nochmal = false
        void this.synchronisiere()
      }
    })
    this.h.melde()
    return this.laeuft
  }

  private async runde(): Promise<void> {
    const g = await this.gemeinsam()
    const von = this.jetzt() - 62 * tag
    const bis = this.jetzt() + 365 * tag
    const termine: FremderTermin[] = []
    const z = await this.zustand()
    let apple: KalenderStand['apple'] = null
    const linkStand: KalenderStand['links'] = []

    // 1. Apple Kalender (iCloud)
    const pw = g.apple ? await this.passwort() : null
    if (g.apple) {
      apple = { benutzer: g.apple.benutzer, eintragen: g.apple.eintragen, verbunden: !!pw, ausgeblendet: g.apple.ausgeblendet, kalender: [] }
      if (pw) {
        try {
          const dav = new CalDav({ benutzer: g.apple.benutzer, passwort: pw }, this.h.abruf)
          const heim = await dav.heim()
          const alle = await dav.kalender(heim)
          apple.kalender = alle.map((k) => ({ href: k.href, name: k.name, farbe: k.farbe ?? '#3b82f6', moin: this.istMoin(k, heim) }))
          for (const k of alle) {
            if (this.istMoin(k, heim) || g.apple.ausgeblendet.includes(k.href)) continue
            for (const roh of await dav.termine(k.href, von, bis)) {
              for (const t of leseIcs(roh.ics, von, bis)) termine.push({ ...t, id: `apple:${k.href}#${t.uid}`, quelle: `apple:${k.href}`, quelleName: k.name, farbe: k.farbe ?? '#3b82f6' })
            }
          }
          if (g.apple.eintragen) {
            z.gesendet = await this.abgleichMoin(dav, heim, alle, z.gesendet)
            // gerade erst angelegt → gleich in der Liste zeigen
            if (!apple.kalender.some((k) => k.moin)) apple.kalender.push({ href: new URL(`${MOIN_PFAD}/`, heim).toString(), name: MOIN_NAME, farbe: MOIN_FARBE, moin: true })
          }
        } catch (err) {
          apple.fehler = err instanceof DavFehler || err instanceof Error ? err.message : String(err)
        }
      }
    }

    // 2. Links (Google, Outlook, andere)
    for (const l of g.links) {
      if (!l.an) {
        linkStand.push(l)
        continue
      }
      try {
        const text = await this.ladeLink(l.url)
        for (const t of leseIcs(text, von, bis)) termine.push({ ...t, id: `link:${l.id}#${t.uid}`, quelle: `link:${l.id}`, quelleName: l.name, farbe: l.farbe ?? '#7c8a99' })
        linkStand.push(l)
      } catch (err) {
        linkStand.push({ ...l, fehler: err instanceof Error ? err.message : String(err) })
      }
    }

    const stand = new Date(this.jetzt()).toISOString()
    // Termine einer Quelle mit Fehler aus dem letzten Stand behalten, statt sie verschwinden zu lassen
    const fehlerQuellen = new Set([...(apple?.fehler ? this.cache.termine.filter((t) => t.quelle.startsWith('apple:')).map((t) => t.quelle) : []), ...linkStand.filter((l) => l.fehler).map((l) => `link:${l.id}`)])
    const behalten = this.cache.termine.filter((t) => fehlerQuellen.has(t.quelle))
    this.cache = { apple, links: linkStand, termine: [...termine, ...behalten].sort((a, b) => a.start.localeCompare(b.start)), stand, laeuft: false }
    await writeJsonAtomic(this.zustandDatei(), { gesendet: z.gesendet, termine: this.cache.termine, stand })
    this.h.melde()
  }

  private istMoin(k: DavKalender, heim: string): boolean {
    return k.href.replace(/\/$/, '') === new URL(`${MOIN_PFAD}/`, heim).toString().replace(/\/$/, '') || k.name === MOIN_NAME
  }

  /**
   * Upload-Termine ↔ Kalender „MoinStudio“: fehlende/geänderte Karten schreiben, Termine ohne Karte (gelöscht oder ohne
   * Termin) entfernen. Hat Philip einen Termin im Kalender verschoben (später geändert als die Karte), bekommt die Karte
   * die neue Zeit.
   */
  private async abgleichMoin(dav: CalDav, heim: string, alle: DavKalender[], gesendet: Record<string, string>): Promise<Record<string, string>> {
    const daten = await this.h.daten()
    const vorhanden = alle.find((k) => this.istMoin(k, heim))
    const kal = vorhanden?.href ?? (await dav.neuerKalender(heim, MOIN_PFAD, MOIN_NAME, MOIN_FARBE))
    const imKalender = new Map<string, { href: string; start: string; geaendert?: string }>()
    for (const roh of await dav.termine(kal, this.jetzt() - 400 * tag, this.jetzt() + 800 * tag)) {
      const t = leseIcs(roh.ics, this.jetzt() - 400 * tag, this.jetzt() + 800 * tag)[0]
      const id = t?.uid.match(/^moinstudio-([a-z0-9]+)@/)?.[1]
      if (t && id) imKalender.set(id, { href: roh.href, start: t.start, ...(t.geaendert ? { geaendert: t.geaendert } : {}) })
    }
    const karten = await ladeKarten(daten)
    const neu: Record<string, string> = {}
    for (const k of karten) {
      if (!k.termin) continue
      const ist = imKalender.get(k.id)
      const soll = kartenZeit(k.termin)
      // im Kalender verschoben? → Karte übernimmt (nur wenn der Kalender-Termin jünger ist als die letzte Kartenänderung)
      if (ist && ist.start !== soll && ist.geaendert && new Date(ist.geaendert).getTime() > new Date(k.updatedAt).getTime() + 5_000) {
        const geaendert = await aendereKarte(daten, k.id, { termin: ist.start })
        neu[k.id] = hash(JSON.stringify(kartenTermin(geaendert)).replace(/"geaendert":"[^"]*"/, ''))
        continue
      }
      const ics = kartenTermin(k)
      const h = hash(JSON.stringify(ics).replace(/"geaendert":"[^"]*"/, ''))
      if (ist && ist.start === soll && gesendet[k.id] === h) {
        neu[k.id] = h
        continue
      }
      await dav.schreibe(ist?.href ?? new URL(`${PRAEFIX}${k.id}.ics`, kal.endsWith('/') ? kal : `${kal}/`).toString(), schreibeIcs({ ...ics, start: soll }))
      neu[k.id] = h
    }
    // Termine ohne passende Karte (gelöscht, Termin entfernt) wieder raus – aber nie alles auf einmal, nur weil der
    // Datenordner gerade nicht lesbar war (iCloud lädt noch)
    if (!karten.length) return { ...gesendet, ...neu }
    for (const [id, t] of imKalender) if (!karten.some((k) => k.id === id && k.termin)) await dav.loesche(t.href)
    return neu
  }
}
