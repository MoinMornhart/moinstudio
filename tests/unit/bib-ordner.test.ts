import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ladeOrdner, ordnerHinzu, pruefeOrdner, rolleVon, streamInfo } from '../../src/main/schnitt/bib-ordner'

describe('Effekt-Ordner: Art erkennen (05.10.)', () => {
  it('liest Alphakanal und Ton aus der FFmpeg-Ausgabe', () => {
    expect(streamInfo('  Stream #0:0: Video: prores (4444) (ap4h), yuva444p12le(tv, bt709), 1920x1080\n  Stream #0:1: Audio: pcm_s16le')).toEqual({ alpha: true, ton: true })
    expect(streamInfo('  Stream #0:0: Video: vp9, yuv420p(tv), 1920x1080\n    Metadata:\n      alpha_mode      : 1')).toEqual({ alpha: true, ton: false })
    expect(streamInfo('  Stream #0:0: Video: h264 (High), yuv420p(progressive), 1920x1080\n  Stream #0:1: Audio: aac')).toEqual({ alpha: false, ton: true })
    expect(streamInfo('  Stream #0:0: Video: png, rgba(pc), 400x200')).toEqual({ alpha: true, ton: false })
  })

  it('ordnet Endungen Rollen zu', () => {
    expect(rolleVon('Abo Animation.MOV')).toBe('video')
    expect(rolleVon('vine boom.mp3')).toBe('sound')
    expect(rolleVon('logo.png')).toBe('bild')
    expect(rolleVon('notizen.txt')).toBeNull()
  })
})

// Echter Durchlauf mit FFmpeg aus %LOCALAPPDATA%\MoinStudio\ffmpeg (läuft nur, wenn es installiert ist)
const ffBasis = join(process.env['LOCALAPPDATA'] ?? '', 'MoinStudio', 'ffmpeg')
const ffmpeg = existsSync(ffBasis) ? readdirSync(ffBasis).map((v) => join(ffBasis, v, 'bin', 'ffmpeg.exe')).find((f) => existsSync(f)) : undefined

describe.runIf(!!ffmpeg)('Effekt-Ordner: echte Dateien (05.10.)', () => {
  let daten: string
  let quelle: string
  beforeAll(async () => {
    daten = await mkdtemp(join(tmpdir(), 'moin-bib-'))
    quelle = join(daten, 'meine animationen')
    await mkdir(join(quelle, 'unterordner'), { recursive: true })
    const ff = (args: string[]): void => void execFileSync(ffmpeg!, ['-y', '-v', 'error', ...args])
    // Greenscreen: grüner Hintergrund mit rotem Kasten in der Mitte
    ff(['-f', 'lavfi', '-i', 'color=c=0x00ff00:s=320x180:d=1', '-vf', 'drawbox=x=120:y=60:w=80:h=60:color=red:t=fill', join(quelle, 'Like_Button.mp4')])
    // Transparenz (ProRes 4444 mit Alpha)
    ff(['-f', 'lavfi', '-i', 'color=c=red@0.0:s=320x180:d=1,format=yuva444p', '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', join(quelle, 'Abo Animation.mov')])
    // Normales Video, Bild, Sound (im Unterordner)
    ff(['-f', 'lavfi', '-i', 'testsrc2=s=320x180:d=1', join(quelle, 'unterordner', 'Clip.mp4')])
    ff(['-f', 'lavfi', '-i', 'color=c=blue:s=64x64', '-frames:v', '1', join(quelle, 'Logo.png')])
    ff(['-f', 'lavfi', '-i', 'sine=d=0.5', join(quelle, 'Vine Boom.wav')])
    await ordnerHinzu(daten, quelle)
  }, 60_000)
  afterAll(async () => {
    await rm(daten, { recursive: true, force: true })
  })

  it('legt für jede neue Datei einen Effekt an: Name = Dateiname, Art erkannt, nur manuell', async () => {
    const neu = await pruefeOrdner(daten, ffmpeg!)
    const art = Object.fromEntries(neu.map((n) => [n.effekt.name, n.art]))
    expect(art).toEqual({ 'Like Button': 'greenscreen', 'Abo Animation': 'transparenz', Clip: 'video', Logo: 'bild', 'Vine Boom': 'sound' })
    for (const n of neu) expect(n.effekt.haeufigkeit.modus).toBe('manuell')
    const gruen = neu.find((n) => n.art === 'greenscreen')!.effekt
    expect(gruen.video?.greenscreen).toBe(true)
    expect(gruen.chroma?.farbe.toLowerCase()).toMatch(/^#0[0-9a-f]f[ef]0[0-9a-f]$/) // Grün, je nach Farbumrechnung #00fe00/#00ff00
    expect(neu.find((n) => n.art === 'video')!.effekt.lage).toBe('voll')
    // Bibliothek und Merkliste sind geschrieben – ein zweiter Durchlauf findet nichts Neues
    expect(Object.keys((await ladeOrdner(daten)).bekannt)).toHaveLength(5)
    expect(JSON.parse(await readFile(join(daten, 'effekte', gruen.id, 'effekt.json'), 'utf8')).name).toBe('Like Button')
    expect(await pruefeOrdner(daten, ffmpeg!)).toEqual([])
  }, 120_000)
})
