/**
 * Bildprüfung mit echtem Claude: findet sie sichtbare Fehler, und lässt sie gute Bilder durch?
 * MOIN_SICHT=<ordner> mit Paaren <name>.png + <name>.handy.png (handy_vorschau.py); Ergebnis je Bild in der Konsole.
 * Start: MOIN_SICHT=… npx vitest run -c vitest.echt.config.ts tests/echt/sichtpruefung.test.ts
 */
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { runClaude } from '../../src/main/claude/run'
import { findClaudeCli } from '../../src/main/claude/cli'
import { liesSichtUrteil, SICHT_SCHEMA, sichtPrompt } from '../../src/main/thumbnail/sichtpruefung'

const ORDNER = process.env['MOIN_SICHT']
const BESCHREIBUNG = process.env['MOIN_SICHT_TEXT'] ?? 'Wer baut die größere Burg: ich oder SimPell?'

it.skipIf(!ORDNER)('Bildprüfung urteilt über jedes Bild im Ordner', async () => {
  const cli = await findClaudeCli()
  expect(cli, 'Claude Code CLI nicht gefunden').toBeTruthy()
  const bilder = (await readdir(ORDNER!)).filter((f) => f.endsWith('.png') && !f.endsWith('.handy.png'))
  for (const f of bilder) {
    const bild = join(ORDNER!, f)
    const res = await runClaude({
      cli: cli!,
      prompt: sichtPrompt({ bild, handy: bild.replace(/\.png$/, '.handy.png'), beschreibung: BESCHREIBUNG, titel: 'Philip und SimPell vor ihren Burgen' }),
      workDir: ORDNER!,
      tools: ['Read'],
      allowedTools: ['Read'],
      addDirs: [ORDNER!],
      maxTurns: 6,
      jsonSchema: SICHT_SCHEMA
    })
    const urteil = liesSichtUrteil(res.structured ?? JSON.parse(/\{[\s\S]*\}/.exec(res.text)?.[0] ?? '{}'))
    console.log(`SICHT ${f}: ${JSON.stringify(urteil)}`)
  }
}, 900_000)
