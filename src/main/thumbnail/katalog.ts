import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Baukasten für die Thumbnail-Planung (ROADMAP 5.1): was der Blender-Szenen-Bauer kann. Wird zur Laufzeit direkt aus
 * den Blender-Skripten und der Mob-Tabelle gelesen, damit Claude nie etwas plant, das es nicht (mehr) gibt.
 */
export interface Katalog {
  posen: { name: string; hinweis: string }[]
  kameraModi: string[]
  himmel: string[]
  welten: { name: string; hinweis: string }[]
  mobs: string[]
  bloecke: string[]
}

/** Welt-Arten des Szenen-Bauers (blender/moin/szene.py `_welt`) mit kurzer Erklärung für Claude. */
export const WELTEN: Katalog['welten'] = [
  { name: 'wiese', hinweis: 'Ebene mit Gras, Blumen und Bäumen (Spawn, Plains, Wald)' },
  { name: 'klippe', hinweis: 'Plateau mit senkrechtem Abgrund nach +X, gegenüber Hügel; kante = x der Kante, tiefe in Blöcken' },
  { name: 'schlucht', hinweis: 'wie klippe' },
  { name: 'meeresklippe', hinweis: 'Klippe mit offenem Meer bis zum Horizont' },
  { name: 'dorf', hinweis: 'Ebenen-Dorf mit Häusern, Wegen, Brunnen, Feld (Dorfbewohner als Mobs dazu)' },
  { name: 'lavameer', hinweis: 'Lavasee bis zum Horizont, Figur auf einer Erdsäule bei (0, 0); weitere Säulen über „bloecke“' },
  { name: 'meer', hinweis: 'Wasser bis zum Horizont, Figur auf einer Säule' },
  { name: 'hoehle', hinweis: 'geschlossene Höhle mit Erzen und Lava- oder Wasserbecken auf der Themenseite' },
  { name: 'nether', hinweis: 'Nether mit Netherrack, Glowstone, Magma und Lavameer' }
]

/** Liest die Namen aus einem Python-Dict-Block: Zeilen der Form `    "name": {` bzw. `    "name": {"schlüssel"`. */
function schluessel(quelle: string, block: string, muster = /^ {4}"([a-z0-9_]+)": \{/): { name: string; hinweis: string }[] {
  const start = quelle.indexOf(`${block} = {`)
  if (start < 0) return []
  const ende = quelle.indexOf('\n}', start)
  const zeilen = quelle.slice(start, ende).split('\n')
  const ergebnis: { name: string; hinweis: string }[] = []
  let kommentar = ''
  for (const z of zeilen) {
    const k = /^ {4}# ?(.*)$/.exec(z)
    if (k) {
      kommentar = k[1]!.trim()
      continue
    }
    const m = muster.exec(z)
    if (m) {
      const inline = /\{\s*#\s*(.*)$/.exec(z)?.[1]?.trim()
      ergebnis.push({ name: m[1]!, hinweis: inline ?? kommentar })
      kommentar = ''
    }
  }
  return ergebnis
}

export async function ladeKatalog(blenderDir: string, minecraftDir: string): Promise<Katalog> {
  const lies = (f: string): Promise<string> => readFile(join(blenderDir, 'moin', f), 'utf8')
  const [posen, kamera, himmel, bloecke, mobs] = await Promise.all([
    lies('posen.py'),
    lies('kamera.py'),
    lies('himmel.py'),
    lies('bloecke.py'),
    readFile(join(minecraftDir, 'mobs.json'), 'utf8')
  ])
  return {
    posen: schluessel(posen, 'POSEN'),
    kameraModi: schluessel(kamera, 'MODI').map((e) => e.name),
    himmel: schluessel(himmel, 'VARIANTEN').map((e) => e.name),
    welten: WELTEN,
    mobs: Object.keys(JSON.parse(mobs) as Record<string, unknown>).filter((k) => !k.startsWith('_')),
    bloecke: schluessel(bloecke, 'ARTEN').map((e) => e.name)
  }
}
