/**
 * Vergleichsbild (ROADMAP 3.3): unser Thumbnail links, ein Vorbild-Thumbnail rechts, beide 1280×720.
 *
 *   node scripts/vergleich.mts <unser-bild> <kanal>/<nummer-oder-video-id> [ausgabe.jpg]
 *   node scripts/vergleich.mts test-output/v1.png gommehd/01 test-output/vergleich.jpg
 *
 * Die Vorbilder liegen nur lokal unter %LOCALAPPDATA%\MoinStudio\stil-referenzen\<kanal>\ (nie im Repo).
 * Ohne Ausgabe-Pfad landet das Bild neben unserem Bild als <name>.vergleich.jpg.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

export const REFERENZEN = join(process.env['LOCALAPPDATA'] ?? '', 'MoinStudio', 'stil-referenzen')

/** Findet das Vorbild-Bild: `<kanal>/<nummer>` (z. B. gommehd/01) oder `<kanal>/<video-id>` */
export function findReference(spec: string, root = REFERENZEN): string {
  const [kanal, key] = spec.split('/')
  if (!kanal || !key) throw new Error(`Vorbild als <kanal>/<nummer-oder-id> angeben, nicht „${spec}“`)
  const dir = join(root, kanal)
  if (!existsSync(dir)) throw new Error(`Kein Vorbild-Ordner für „${kanal}“ (${dir})`)
  const files = readdirSync(dir).filter((f) => /\.jpe?g$/i.test(f))
  const nr = /^\d+$/.test(key) ? key.padStart(2, '0') : null
  const hit = files.find((f) => (nr ? f.startsWith(`${nr}-`) || f.startsWith(`${nr}_`) : f.includes(key)))
  if (!hit) throw new Error(`Vorbild „${spec}“ nicht gefunden`)
  return join(dir, hit)
}

function ffmpegPath(): string {
  const tools = JSON.parse(readFileSync(join(process.env['LOCALAPPDATA'] ?? '', 'MoinStudio', 'tools.json'), 'utf8')) as Record<string, { path: string; exe: string }>
  const e = tools['ffmpeg@9.0']
  if (!e) throw new Error('FFmpeg ist nicht installiert (Einstellungen → Werkzeuge).')
  return join(e.path, e.exe)
}

/** Baut das Vergleichsbild (2560×720 + Kopfzeile) und gibt den Pfad zurück. */
export function compare(ours: string, reference: string, out: string): string {
  const ff = ffmpegPath()
  const scale = 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x16191c,setsar=1'
  execFileSync(ff, ['-y', '-loglevel', 'error', '-i', ours, '-i', reference, '-filter_complex', `[0:v]${scale}[a];[1:v]${scale}[b];[a][b]hstack=inputs=2,pad=iw:ih+8:0:0:color=0x16191c[v]`, '-map', '[v]', '-frames:v', '1', '-q:v', '3', out], { windowsHide: true })
  return out
}

if (process.argv[1] && basename(process.argv[1]).startsWith('vergleich')) {
  const [ours, spec, out] = process.argv.slice(2)
  if (!ours || !spec) {
    console.error('Aufruf: node scripts/vergleich.mts <unser-bild> <kanal>/<nummer-oder-id> [ausgabe.jpg]')
    process.exit(2)
  }
  const target = out ?? join(dirname(ours), `${basename(ours).replace(/\.[^.]+$/, '')}.vergleich.jpg`)
  console.log(compare(ours, findReference(spec), target))
}
