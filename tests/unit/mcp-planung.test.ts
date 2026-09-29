import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/client'
import { InMemoryTransport } from '@modelcontextprotocol/server'
import { createServer } from '../../src/mcp/tools'
import { planungAktion } from '../../src/main/planung/aktionen'
import { ladeKarten } from '../../src/main/planung/karten'

/** Werkzeug `planning` (ROADMAP 7.7), wenn MoinStudio geschlossen ist: arbeitet direkt im Datenordner. */
describe('MCP-Werkzeug planning ohne laufende App', () => {
  let einstellungen: string
  let daten: string
  let client: Client
  const rufe = async (args: Record<string, unknown>): Promise<{ text: string; fehler: boolean }> => {
    const r = await client.callTool({ name: 'planning', arguments: args })
    return { text: (r.content as { text: string }[])[0]!.text, fehler: !!r.isError }
  }

  beforeAll(async () => {
    einstellungen = await mkdtemp(join(tmpdir(), 'moin-mcp-plan-'))
    daten = await mkdtemp(join(tmpdir(), 'moin-mcp-daten-'))
    await writeFile(join(einstellungen, 'settings.json'), JSON.stringify({ dataDir: daten }))
    process.env['MOINSTUDIO_PIPE_FILE'] = join(einstellungen, 'pipe.json') // gibt es nicht: App läuft nicht
    process.env['MOINSTUDIO_NO_AUTOSTART'] = '1'
    const [c, s] = InMemoryTransport.createLinkedPair()
    await createServer('9.9.9').connect(s)
    client = new Client({ name: 'test', version: '1.0.0' })
    await client.connect(c)
  })
  afterAll(async () => {
    await client.close()
    delete process.env['MOINSTUDIO_PIPE_FILE']
    delete process.env['MOINSTUDIO_NO_AUTOSTART']
    await rm(einstellungen, { recursive: true, force: true })
    await rm(daten, { recursive: true, force: true })
  })

  it('legt Karten an, plant sie ein, verschiebt und listet sie', async () => {
    const neu = await rufe({ aktion: 'anlegen', kanal: 'MoinMornhart', titel: 'Minecraft, aber alles ist Lava', notizen: 'mit SimPell' })
    expect(neu.fehler).toBe(false)
    const id = (JSON.parse(neu.text) as { id: string }).id
    expect((await rufe({ aktion: 'aendern', karte: id, termin: '2099-10-03' })).text).toContain('2099-10-03T17:00')
    expect((await rufe({ aktion: 'verschieben', karte: id, spalte: 'aufnahme' })).text).toContain('"stand": "aufnahme"')
    const liste = JSON.parse((await rufe({ aktion: 'liste', kanal: 'MoinMornhart' })).text) as { karten: { titel: string; notizen: string }[] }
    expect(liste.karten).toEqual([expect.objectContaining({ titel: 'Minecraft, aber alles ist Lava', notizen: 'mit SimPell' })])
    const [k] = await ladeKarten(daten)
    expect(k).toMatchObject({ spalte: 'aufnahme', termin: '2099-10-03T17:00', updatedBy: 'Claude Desktop' })
  })

  it('zeigt freie Upload-Termine laut Rhythmus im Kalender', async () => {
    await rufe({ aktion: 'rhythmus_setzen', rhythmus: { MoinMorni: [{ tag: 5, zeit: '18:00' }] } })
    const k = JSON.parse((await rufe({ aktion: 'kalender', von: '2099-10-01', bis: '2099-10-07' })).text) as { freieTermine: { kanal: string; tag: string }[]; termine: unknown[] }
    expect(k.freieTermine).toEqual([{ kanal: 'MoinMorni', tag: '2099-10-02', zeit: '18:00' }])
    expect(k.termine).toHaveLength(1)
  })

  it('meldet verständliche Fehler', async () => {
    expect(await rufe({ aktion: 'aendern', karte: 'gibtsnicht1234', titel: 'x' })).toMatchObject({ fehler: true, text: expect.stringContaining('nicht gefunden') })
    expect(await rufe({ aktion: 'aendern', karte: 'x', termin: 'morgen' })).toMatchObject({ fehler: true, text: expect.stringContaining('2026-10-03T17:00') })
    expect(await rufe({ aktion: 'ideen', kanal: 'MoinMorni' })).toMatchObject({ fehler: true, text: expect.stringContaining('MoinStudio läuft nicht') })
  })

  it('löscht Karten', async () => {
    const [k] = await ladeKarten(daten)
    expect((await rufe({ aktion: 'loeschen', karte: k!.id })).text).toContain('Minecraft, aber alles ist Lava')
    expect(await ladeKarten(daten)).toEqual([])
  })

  it('gibt Claude-Aufträge an die laufende App weiter', async () => {
    const gestartet: unknown[] = []
    const r = await planungAktion(daten, { aktion: 'ideen', kanal: 'MoinMorni', wunsch: 'Reactions' }, { starte: async (art, o) => (gestartet.push({ art, ...o }), 'auftrag1'), stand: async () => null })
    expect(r).toMatchObject({ auftrag: 'auftrag1' })
    expect(gestartet).toEqual([{ art: 'ideen', kanal: 'MoinMorni', wunsch: 'Reactions' }])
  })
})
