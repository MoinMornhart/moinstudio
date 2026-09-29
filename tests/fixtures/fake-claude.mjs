// Attrappe der Claude-Code-CLI für Tests: liest den Prompt von stdin und antwortet im
// stream-json-Format. Enthält der Prompt „LIMIT“, meldet sie ein erreichtes Abo-Limit.
const args = process.argv.slice(2)
const sessionId = args[args.indexOf('--session-id') + 1] ?? args[args.indexOf('--resume') + 1] ?? 'none'
let input = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (d) => (input += d))
process.stdin.on('end', () => {
  const out = (o) => process.stdout.write(`${JSON.stringify(o)}\n`)
  out({ type: 'system', subtype: 'init', session_id: sessionId })
  if (input.includes('LIMIT')) {
    out({ type: 'rate_limit_event', rate_limit_info: { status: 'rejected', resetsAt: 1790000000 } })
    out({ type: 'result', subtype: 'error_during_execution', is_error: true, result: "You've hit your session limit · resets 3:45pm", session_id: sessionId })
    process.exit(1)
  }
  if (input.includes('Thumbnail-Planer')) {
    // Planungsauftrag: beim ersten Mal ein Plan mit Fehler (unbekannte Pose), nach der Korrektur ein gültiger
    const korrigiert = input.includes('# Korrektur')
    const plan = {
      varianten: [
        {
          titel: 'Kampf an der Klippe',
          vorbild: 'gomme-helden3-schmockyyy',
          warum: 'Zwei Kämpfer, Gegner fällt',
          szene: {
            welt: { art: 'klippe', kante: 2 },
            himmel: 'regenbogen',
            figuren: [
              { id: 'ich', pose: korrigiert ? 'sturmangriff' : 'tanzen', position: [0, 0], blick: 70, item: { name: 'diamond_sword', hand: 'r' } },
              { id: 'simpell', pose: 'getroffen', position: [2.8, 3], blick: -60, hoehe: 0.5 }
            ],
            kamera: { modus: 'kampf', thema: 'simpell' }
          }
        }
      ]
    }
    out({ type: 'result', subtype: 'success', is_error: false, result: '', structured_output: plan, session_id: sessionId })
    return
  }
  const keyPresent = Object.keys(process.env).some((k) => k.toUpperCase() === 'ANTHROPIC_API_KEY')
  out({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'mcp__moinstudio__render' }] } })
  out({ type: 'assistant', message: { content: [{ type: 'text', text: 'Hallo Philip' }] } })
  out({
    type: 'result',
    subtype: 'success',
    is_error: false,
    result: `prompt=${input.trim()} key=${keyPresent ? 'JA' : 'nein'} bare=${args.includes('--bare')}`,
    session_id: sessionId,
    usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 30000 },
    modelUsage: { 'claude-haiku-4-5': {} }
  })
})
