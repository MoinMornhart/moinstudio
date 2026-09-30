import { thumbnailDateiname } from '../dateinamen'
import type { JobQueue } from '../jobs/queue'
import { ladeKarten } from '../planung/karten'
import type { AenderungPayload } from './aenderung'

/**
 * Vorschlag für „Speichern unter“ eines Thumbnails (Philip, 30.09.2026): „Thumbnail_2026-09-30_19-05.png“ mit Datum
 * und Uhrzeit des Auftrags bzw. der Änderung, „_V2“ bei mehreren Varianten, „_Aenderung3“ für die dritte Änderung im
 * Verlauf. Hängt der Auftrag an einem Video (aus dem Schnitt oder einer Planungskarte), steht dessen Name vorne.
 */
export async function thumbDateiname(queue: JobQueue, daten: string | null, jobId: string, index: number, endung: string): Promise<string> {
  const job = queue.get(jobId)
  const zeit = job ? new Date(job.createdAt) : new Date()
  const varianten = queue.result<{ varianten: unknown[] }>(jobId)?.varianten.length ?? 1
  let ursprung = jobId
  let aenderung: number | null = null
  if (job?.kind === 'aenderung') {
    ursprung = queue.payload<AenderungPayload>(jobId)?.eltern ?? jobId
    const verlauf = queue
      .state()
      .jobs.filter((j) => j.kind === 'aenderung' && queue.payload<AenderungPayload>(j.id)?.eltern === ursprung)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    aenderung = verlauf.findIndex((j) => j.id === jobId) + 1 || null
  }
  let video = queue.payload<{ videoName?: string }>(ursprung)?.videoName ?? null
  if (!video && daten) video = (await ladeKarten(daten).catch(() => [])).find((k) => k.thumbnail?.auftrag === ursprung)?.titel ?? null
  return thumbnailDateiname({ video, zeit, variante: index, varianten, aenderung, endung })
}
