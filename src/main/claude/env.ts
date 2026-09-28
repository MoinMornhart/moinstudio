/**
 * Umgebungsvariablen, mit denen Claude Code statt des Abo-Logins einen API-Key oder einen
 * anderen Anbieter verwenden würde. Sie werden für jeden Claude-Kindprozess entfernt
 * (docs/claude-integration.md, Regel 1). Im `-p`-Modus hätte ein gesetzter API-Key sonst
 * ohne Rückfrage Vorrang vor dem Abo.
 */
export const BLOCKED_ENV = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
  'CLAUDE_CODE_USE_FOUNDRY',
  'ANTHROPIC_PROFILE',
  'ANTHROPIC_FEDERATION_RULE_ID',
  'ANTHROPIC_ORGANIZATION_ID',
  'CLAUDE_CODE_OAUTH_TOKEN'
] as const

/** Kopie der Umgebung ohne die gesperrten Variablen (Groß-/Kleinschreibung egal wie unter Windows). */
export function cleanClaudeEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const blocked = new Set<string>(BLOCKED_ENV.map((k) => k.toUpperCase()))
  const env: NodeJS.ProcessEnv = {}
  for (const [key, value] of Object.entries(base)) {
    if (!blocked.has(key.toUpperCase()) && key.toUpperCase() !== 'ELECTRON_RUN_AS_NODE') env[key] = value
  }
  return env
}

/** Welche gesperrten Variablen sind im System gesetzt? (für eine Warnung in der App) */
export function blockedEnvPresent(base: NodeJS.ProcessEnv = process.env): string[] {
  const blocked = new Set<string>(BLOCKED_ENV.map((k) => k.toUpperCase()))
  return Object.keys(base).filter((k) => blocked.has(k.toUpperCase()) && base[k])
}
