import { spawn } from 'node:child_process'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { WhisperChoice } from '@shared/hardware'
import type { JobContext } from '../jobs/queue'
import { sicherePakete, sichereUmgebung } from '../python'
import { ladeProjekt, projektOrdner, speichereProjekt } from './projekt'

/**
 * Transkript lokal (ROADMAP 6.3) mit faster-whisper: kostenlos, ohne Cloud, auf jeder Hardware (CUDA wenn möglich,
 * sonst CPU). Abschnitte landen laufend in transkript.jsonl – nach Pause oder Neustart geht es dort weiter.
 * Beim ersten Einsatz wird die Geschwindigkeit gemessen: ist das Modell langsamer als Echtzeit, nimmt MoinStudio
 * beim nächsten Mal das nächstkleinere.
 */

export interface TranskriptPayload {
  daten: string
  projekt: string
  ffmpeg: string
  uv: string
  pyDir: string
  skript: string
  whisper: WhisperChoice
  /** Ablage der Whisper-Modelle und der Messung (lokaler Programmordner, nicht der Datenordner) */
  lokal: string
}

export interface Abschnitt {
  start: number
  ende: number
  text: string
  woerter: { start: number; ende: number; wort: string; p: number }[]
}

export interface Messung {
  modell: string
  geraet: string
  /** Rechenzeit ÷ Videolänge; < 1 = schneller als Echtzeit */
  faktor: number
}

const KLEINER: Record<string, WhisperChoice['model'] | undefined> = { 'large-v3-turbo': 'medium', medium: 'small', small: 'base' }

/** Modellwahl: Hardware-Profil, korrigiert durch die Messung beim ersten Einsatz. */
export function whisperWahl(profil: WhisperChoice, messung: Messung | null): WhisperChoice {
  if (!messung || messung.modell !== profil.model || messung.geraet !== profil.device || messung.faktor <= 1) return profil
  const kleiner = KLEINER[profil.model]
  return kleiner ? { ...profil, model: kleiner } : profil
}

export function liesAbschnitte(jsonl: string): Abschnitt[] {
  return jsonl
    .split(/\r?\n/)
    .filter((z) => z.trim())
    .map((z) => JSON.parse(z) as Abschnitt)
}

/** CUDA-Bibliotheken (cuBLAS, cuDNN) aus den nvidia-Paketen auf den Suchpfad legen. */
async function cudaPfade(pyDir: string): Promise<string[]> {
  const basis = join(pyDir, 'Lib', 'site-packages', 'nvidia')
  const teile = await readdir(basis).catch(() => [] as string[])
  return teile.map((t) => join(basis, t, 'bin'))
}

export async function transkriptJob(p: TranskriptPayload, ctx: JobContext<unknown>): Promise<{ projekt: string; abschnitte: number }> {
  const pr = await ladeProjekt(p.daten, p.projekt)
  if (!pr?.quelle?.dauer) throw new Error('Das Video ist noch nicht importiert.')
  const dauer = pr.quelle.dauer
  const ordner = projektOrdner(p.daten, p.projekt)
  const messDatei = join(p.lokal, 'whisper-messung.json')
  const messung = JSON.parse(await readFile(messDatei, 'utf8').catch(() => 'null')) as Messung | null
  const wahl = whisperWahl(p.whisper, messung)

  const python = await sichereUmgebung(p.uv, p.pyDir, ctx)
  await sicherePakete(p.uv, python, 'faster_whisper', ['faster-whisper'], ctx, 'Richte die Spracherkennung ein (einmalig) …')
  let env: NodeJS.ProcessEnv = { ...process.env, HF_HUB_DISABLE_SYMLINKS_WARNING: '1' }
  if (wahl.device === 'cuda') {
    await sicherePakete(p.uv, python, 'nvidia.cublas, nvidia.cudnn', ['nvidia-cublas-cu12', 'nvidia-cudnn-cu12==9.*'], ctx, 'Richte die Spracherkennung für deine Grafikkarte ein (einmalig) …').catch(() => undefined)
    env = { ...env, PATH: [...(await cudaPfade(p.pyDir)), process.env['PATH'] ?? ''].join(';') }
  }

  ctx.progress(1, `Transkript mit Whisper ${wahl.model} (${wahl.device === 'cuda' ? 'Grafikkarte' : 'Prozessor'}) …`)
  const ziel = join(ordner, 'transkript.jsonl')
  const beginn = Date.now()
  let rechenzeit = 0
  await new Promise<void>((resolve, reject) => {
    const child = spawn(python, [p.skript, pr.quelle!.pfad, ziel, wahl.model, wahl.device, wahl.compute, p.ffmpeg, String(dauer), `--modelle=${join(p.lokal, 'py', 'modelle', 'whisper')}`], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env })
    ctx.track(child)
    let fehler = ''
    child.stdout.on('data', (d: Buffer) => {
      for (const zeile of d.toString().split(/\r?\n/)) {
        const f = /^MOIN_FORTSCHRITT ([\d.]+)/.exec(zeile)
        if (f) ctx.progress(Math.min(99, 2 + (Number(f[1]) / dauer) * 97), `Transkript: ${Math.round((Number(f[1]) / dauer) * 100)} % (Whisper ${wahl.model})`)
        const e = /^MOIN_FERTIG ([\d.]+) ([\d.]+)/.exec(zeile)
        if (e) rechenzeit = Number(e[2])
      }
    })
    child.stderr.on('data', (d: Buffer) => (fehler = (fehler + d.toString()).slice(-4000)))
    child.once('error', reject)
    child.once('exit', (code) => (code === 0 ? resolve() : reject(new Error(`Transkript fehlgeschlagen: ${fehler.trim().split(/\r?\n/).slice(-1)[0]}`))))
  })
  // Messung beim ersten Einsatz (nur wenn das Video lang genug für eine sinnvolle Aussage ist)
  if (!messung && dauer >= 30) {
    await writeFile(messDatei, JSON.stringify({ modell: wahl.model, geraet: wahl.device, faktor: Math.round(((rechenzeit || (Date.now() - beginn) / 1000) / dauer) * 100) / 100 } satisfies Messung))
  }
  const abschnitte = liesAbschnitte(await readFile(ziel, 'utf8'))
  const neu = await ladeProjekt(p.daten, p.projekt)
  if (neu) await speichereProjekt(p.daten, { ...neu, transkript: true, transkriptModell: wahl.model })
  ctx.progress(100, 'Fertig')
  return { projekt: p.projekt, abschnitte: abschnitte.length }
}
