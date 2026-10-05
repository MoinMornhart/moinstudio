import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { KalenderSync } from '../../src/main/kalender/sync'
import { aendereKarte, ladeKarten, neueKarte } from '../../src/main/planung/karten'

/** Kleiner Nachbau von iCloud-CalDAV: Umleitung auf einen Partition-Server, Kalender, Termine */
function icloud(passwort = 'abcd-efgh-ijkl-mnop'): { abruf: typeof fetch; kalender: Map<string, { name: string; termine: Map<string, string> }>; anfragen: string[] } {
  const kalender = new Map<string, { name: string; termine: Map<string, string> }>()
  kalender.set('/123/calendars/home/', {
    name: 'Privat',
    termine: new Map([['/123/calendars/home/x.ics', 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:x\r\nSUMMARY:Geburtstag Oma\r\nDTSTART:20261010T120000Z\r\nDTEND:20261010T150000Z\r\nEND:VEVENT\r\nEND:VCALENDAR']])
  })
  const anfragen: string[] = []
  const ms = (href: string, prop: string): string => `<response><href>${href}</href><propstat><prop>${prop}</prop><status>HTTP/1.1 200 OK</status></propstat></response>`
  const multi = (inhalt: string): Response => new Response(`<?xml version="1.0"?><multistatus xmlns="DAV:">${inhalt}</multistatus>`, { status: 207 })
  const abruf = (async (eingabe: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(eingabe))
    const methode = init?.method ?? 'GET'
    const h = (init?.headers ?? {}) as Record<string, string>
    anfragen.push(`${methode} ${url.host}${url.pathname}`)
    if (h['Authorization'] !== `Basic ${Buffer.from(`philip@icloud.com:${passwort}`).toString('base64')}`) return new Response('', { status: 401 })
    if (url.host === 'caldav.icloud.com') {
      if (url.pathname === '/' && methode === 'PROPFIND') return multi(ms('/', '<current-user-principal><href>/123/principal/</href></current-user-principal>'))
      return new Response('', { status: 301, headers: { location: `https://p01-caldav.icloud.com${url.pathname}` } })
    }
    if (url.pathname === '/123/principal/') return multi(ms('/123/principal/', '<C:calendar-home-set xmlns:C="urn:ietf:params:xml:ns:caldav"><href>https://p01-caldav.icloud.com:443/123/calendars/</href></C:calendar-home-set>'))
    if (url.pathname === '/123/calendars/' && methode === 'PROPFIND')
      return multi(
        ms('/123/calendars/', '<resourcetype><collection/></resourcetype>') +
          [...kalender].map(([href, k]) => ms(href, `<displayname>${k.name}</displayname><resourcetype><collection/><C:calendar xmlns:C="urn:ietf:params:xml:ns:caldav"/></resourcetype><A:calendar-color xmlns:A="http://apple.com/ns/ical/">#FF2968FF</A:calendar-color>`)).join('')
      )
    if (methode === 'MKCALENDAR') {
      kalender.set(url.pathname, { name: /<d:displayname>([^<]*)/.exec(String(init?.body))![1]!, termine: new Map() })
      return new Response('', { status: 201 })
    }
    const kal = [...kalender].find(([href]) => url.pathname.startsWith(href))
    if (methode === 'REPORT' && kal) return multi([...kal[1].termine].map(([href, ics]) => ms(href, `<getetag>"1"</getetag><C:calendar-data xmlns:C="urn:ietf:params:xml:ns:caldav">${ics.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</C:calendar-data>`)).join(''))
    if (methode === 'PUT' && kal) {
      kal[1].termine.set(url.pathname, String(init?.body))
      return new Response('', { status: 201, headers: { etag: '"2"' } })
    }
    if (methode === 'DELETE' && kal) {
      kal[1].termine.delete(url.pathname)
      return new Response('', { status: 204 })
    }
    return new Response('', { status: 404 })
  }) as typeof fetch
  return { abruf, kalender, anfragen }
}

async function aufbau(server = icloud()): Promise<{ sync: KalenderSync; daten: string; server: ReturnType<typeof icloud>; meldungen: number[] }> {
  const daten = await mkdtemp(join(tmpdir(), 'kal-'))
  const geraet = await mkdtemp(join(tmpdir(), 'kalg-'))
  const meldungen: number[] = []
  const sync = new KalenderSync({ daten: async () => daten, geraet, verschluessele: (t) => `geheim:${t}`, entschluessele: (t) => t.replace(/^geheim:/, ''), melde: () => meldungen.push(1), abruf: server.abruf, jetzt: () => new Date('2026-10-05T10:00:00Z').getTime() })
  return { sync, daten, server, meldungen }
}

describe('Kalender-Abgleich mit iCloud', () => {
  it('lehnt ein falsches Passwort verständlich ab', async () => {
    const { sync } = await aufbau()
    await expect(sync.verbindeApple('philip@icloud.com', 'falsch')).rejects.toThrow(/app-spezifisches Passwort/)
  })

  it('trägt Upload-Termine in „MoinStudio“ ein, zeigt andere Termine, übernimmt Verschiebungen und räumt auf', async () => {
    const { sync, daten, server } = await aufbau()
    const k = await neueKarte(daten, { kanal: 'MoinMorni', titel: 'Creeper-Chaos', termin: '2026-10-12T17:00' })
    await neueKarte(daten, { kanal: 'MoinMornhart', titel: 'Ohne Termin' })
    await sync.verbindeApple('philip@icloud.com', 'abcd efgh ijkl mnop')
    sync.stopp()
    await sync.synchronisiere()

    // Kalender angelegt, ein Termin (nur die Karte mit Termin), Anmeldung über die Umleitung behalten
    const moin = server.kalender.get('/123/calendars/moinstudio/')!
    expect(moin.name).toBe('MoinStudio')
    expect([...moin.termine.keys()]).toEqual([`/123/calendars/moinstudio/moinstudio-${k.id}.ics`])
    expect([...moin.termine.values()][0]).toContain('SUMMARY:▶ MoinMorni: Creeper-Chaos')
    // fremder Termin sichtbar, eigener Kalender nicht doppelt
    const stand = await sync.stand()
    expect(stand.termine.map((t) => t.titel)).toEqual(['Geburtstag Oma'])
    expect(stand.apple?.verbunden).toBe(true)
    expect(stand.apple?.kalender.map((x) => [x.name, x.moin])).toEqual([
      ['Privat', false],
      ['MoinStudio', true]
    ])

    // zweiter Abgleich ohne Änderung schreibt nichts
    const vorher = server.anfragen.filter((a) => a.startsWith('PUT')).length
    await sync.synchronisiere()
    expect(server.anfragen.filter((a) => a.startsWith('PUT')).length).toBe(vorher)

    // Philip verschiebt den Termin am iPhone (neuere Änderung) → Karte bekommt die neue Zeit
    const href = `/123/calendars/moinstudio/moinstudio-${k.id}.ics`
    moin.termine.set(href, moin.termine.get(href)!.replace(/DTSTART:\d+T\d+Z/, `DTSTART:${utc('2026-10-14T18:30')}`).replace(/LAST-MODIFIED:\d+T\d+Z/, 'LAST-MODIFIED:20991231T000000Z'))
    await sync.synchronisiere()
    expect((await ladeKarten(daten)).find((x) => x.id === k.id)!.termin).toBe('2026-10-14T18:30')

    // Karte ohne Termin → Termin verschwindet aus dem Kalender
    await aendereKarte(daten, k.id, { termin: null })
    await sync.synchronisiere()
    expect(moin.termine.size).toBe(0)
  })

  it('ausgeblendete iCloud-Kalender und Links', async () => {
    const { sync, server } = await aufbau()
    await sync.verbindeApple('philip@icloud.com', 'abcd-efgh-ijkl-mnop')
    sync.stopp()
    await sync.einstellen({ ausgeblendet: ['https://p01-caldav.icloud.com/123/calendars/home/'], eintragen: false })
    sync.stopp()
    await sync.synchronisiere()
    expect((await sync.stand()).termine).toEqual([])
    expect(server.kalender.has('/123/calendars/moinstudio/')).toBe(false) // „eintragen“ aus → kein eigener Kalender
  })
})

function utc(lokal: string): string {
  return new Date(lokal).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}
