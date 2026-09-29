/**
 * Echter Import aller Mobs aus der neuesten bedrock-samples-Vorschau.
 * Start: npx vitest run -c vitest.echt.config.ts tests/echt/mobimport.test.ts
 */
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { sichereMobs } from '../../src/main/thumbnail/mobimport'

it('importiert alle Mobs der neuesten Vorschau', async () => {
  const lokal = join(process.env['LOCALAPPDATA'] ?? '', 'MoinStudio')
  const r = await sichereMobs(lokal, { onProgress: console.log })
  console.log(`Version ${r.version}: ${r.anzahl} Entities, ${r.fehler.length} Fehler`)
  console.log(r.fehler.join('\n'))
  console.log(r.tabelle)
  expect(r.anzahl).toBeGreaterThan(100)
})
