/**
 * Adobe-Test (ROADMAP 8.5/8.6) für einen Rechner mit Adobe. Erzeugt neutrale Proben und prüft Photoshop automatisch;
 * für Premiere entsteht eine Checkliste. Ohne Adobe endet der Photoshop-Teil mit „übersprungen“.
 * Start: npx vitest run -c vitest.adobe.config.ts   (Ergebnis: test-output/adobe/)
 * Ohne Entwicklerwerkzeuge geht dasselbe in der App: Einstellungen → Adobe → „Selbsttest“.
 */
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { expect, it } from 'vitest'
import { findeAdobe } from '../../src/main/adobe/erkennung'
import { erzeugeProben, premiereCheckliste, pruefePhotoshop } from '../../src/main/adobe/selbsttest'

const AUS = resolve(__dirname, '../../test-output/adobe')
const FFMPEG = join(process.env['LOCALAPPDATA'] ?? '', 'MoinStudio', 'ffmpeg', '9.0', 'bin', 'ffmpeg.exe')

it('erzeugt die Proben und prüft Photoshop (falls installiert)', async () => {
  expect(existsSync(FFMPEG), 'FFmpeg von MoinStudio fehlt – App einmal starten, damit die Werkzeuge geladen werden').toBe(true)
  const programme = await findeAdobe()
  console.log('Gefunden:', programme.map((p) => `${p.name} ${p.version ?? ''}${p.beta ? ' (Beta)' : ''}`).join(', ') || 'kein Adobe')
  const erwartung = await erzeugeProben(AUS, FFMPEG)
  expect(await readFile(join(AUS, 'sequenz.xml'), 'utf8')).toContain('<xmeml version="5">')
  await writeFile(join(AUS, 'premiere-checkliste.md'), premiereCheckliste(erwartung.premiere, AUS))
  const ps = await pruefePhotoshop(join(AUS, 'ebenen.psd'), erwartung.photoshop)
  console.log('Photoshop:', ps.status, '–', ps.details)
  await writeFile(join(AUS, 'ergebnis.json'), JSON.stringify({ programme, photoshop: ps, zeit: new Date().toISOString() }, null, 2))
  expect(ps.status).not.toBe('fehler')
}, 300_000)
