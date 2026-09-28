# Claude-Integration in MoinStudio (Abo statt API-Key)

Stand: 2026-09-26 · Recherche in offizieller Anthropic-Doku + lokaler Test mit Claude Code 2.1.283

Legende:
- **[BELEGT]** = wörtlich/inhaltlich aus offizieller Quelle (URL im Text bzw. in der Quellenliste) oder lokal getestet
- **[LOKAL GETESTET]** = auf Philips Rechner am 2026-09-26 ausgeführt
- **[EINSCHÄTZUNG]** = eigene Bewertung, nicht von Anthropic bestätigt
- **[DRITTQUELLE]** = nur in GitHub-Issues/Blogs gefunden, nicht in offizieller Doku

---

## 1. Kurzfazit

**Erlaubt (belegt):**
- Claude Code mit Pro/Max-Login per `claude -p` zu nutzen ist ein offiziell dokumentierter und abgerechneter Nutzungsweg. Der Support-Artikel „Use the Claude Agent SDK with your Claude plan“ (Update 15.06.2026) sagt ausdrücklich: *„Claude Agent SDK, `claude -p`, and third-party app usage still draw from your subscription's usage limits.“* `claude -p` mit Abo ist also vorgesehen und zählt gegen die normalen Abo-Limits.
- Die Legal-Seite von Claude Code erlaubt einem Endnutzer ausdrücklich, *„signing in to the unmodified Claude Code binary with their own Claude subscription“*.
- Lokale MCP-Server in Claude Desktop (stdio, per `claude_desktop_config.json` oder als `.mcpb`-Extension) sind der Standardweg; Abo-Nutzung ist dort unproblematisch.

**Nicht erlaubt (belegt):**
- Drittanbieter-Entwickler dürfen **keinen claude.ai-Login in ihre eigenen Apps einbauen** und keine Anfragen *„through Free, Pro, or Max plan credentials on behalf of their users“* leiten. Sie dürfen Claude-Zugangsdaten/Session-Tokens nicht *„collect, store, or intermediate“*.
- Account teilen / Account anderen zugänglich machen ist nach Consumer Terms verboten.
- Das unveränderte Claude-Code-Binary darf nicht modifiziert werden (gilt formal für Produkte, die Claude Code ausliefern).

**Einordnung für MoinStudio [EINSCHÄTZUNG]:**
MoinStudio ist eine rein private App eines einzelnen Nutzers, die das **offizielle, unveränderte** `claude`-Binary als Kindprozess startet; Philip hat sich selbst über Anthropics eigenen Login-Flow angemeldet; MoinStudio bietet **keinen** eigenen claude.ai-Login an, liest/speichert **keine** Tokens und hat **keine** anderen Nutzer. Das entspricht dem Fall „eigene private Nutzung“ und nicht dem verbotenen Fall „Produkt für andere, das Abo-Login anbietet“. Ich sehe **kein AGB-Problem**, solange die Regeln in Abschnitt 7 eingehalten werden.

**Risiken / Graubereiche:**
1. **Consumer Terms, Automatisierungsklausel** [BELEGT]: Verboten ist, *„Except when you are accessing our Services via an Anthropic API Key or where we otherwise explicitly permit it, to access the Services through automated or non-human means, whether through a bot, script, or otherwise.“* Für `claude -p` gibt es diese ausdrückliche Erlaubnis in Form der Doku (headless-Seite, Support-Artikel zu `claude -p` mit Abo). [EINSCHÄTZUNG] Deshalb gedeckt; vollautomatische Dauerschleifen ohne Menschen (z. B. 24/7-Bot) würde ich trotzdem vermeiden.
2. **„Ordinary, individual usage“** [BELEGT]: *„Advertised usage limits for Pro and Max plans assume ordinary, individual usage of Claude Code and the Agent SDK.“* Massiver Dauerbetrieb kann als nicht-gewöhnlich gelten. Außerdem behält sich Anthropic vor, Beschränkungen *„without prior notice“* durchzusetzen.
3. **Die Politik ändert sich** [BELEGT]: Für den 15.06.2026 war geplant, dass `claude -p` und das Agent SDK **nicht mehr** aus den Abo-Limits kommen, sondern aus einem separaten Monatsguthaben (Pro 20 $, Max 5x 100 $, Max 20x 200 $). Das wurde **pausiert**: *„When we have an update, we'll share it before anything takes effect.“* → MoinStudio muss damit rechnen, dass headless-Nutzung künftig anders abgerechnet oder begrenzt wird. Architektur so bauen, dass der MCP-Weg über Claude Desktop auch allein trägt.
4. **Nutzungsguthaben (Usage Credits)**: Wenn in claude.ai „Usage credits“ aktiviert sind, kann Nutzung über das Limit hinaus **kostenpflichtig** zu API-Preisen weiterlaufen. Für die „keine Kosten“-Regel: Usage Credits in claude.ai → Settings → Usage **deaktiviert lassen**. [BELEGT, siehe Abschnitt 4]
5. **Agent SDK (Python/TypeScript-Pakete)** [BELEGT]: Die Agent-SDK-Übersicht sagt, Drittentwickler dürfen claude.ai-Login nicht anbieten, und das SDK unterliegt den **Commercial Terms**. [EINSCHÄTZUNG] Für MoinStudio deshalb das CLI (`claude -p`) direkt aufrufen statt das SDK-Paket einzubinden. Das ist ohnehin der dokumentierte Weg für „andere Sprachen/Subprozess“. Rechtlich ist der Unterschied gering, weil beide dasselbe Binary nutzen, aber so bleibt die Architektur am klarsten.

---

## 2. Rechtliche Lage im Detail (wörtliche Zitate)

### 2.1 Claude Code – Legal and compliance
Quelle: https://code.claude.com/docs/en/legal-and-compliance

- Lizenz: Nutzung unterliegt *„Consumer Terms of Service - for Free, Pro, and Max users“*.
- *„Advertised usage limits for Pro and Max plans assume ordinary, individual usage of Claude Code and the Agent SDK.“*
- *„**OAuth authentication** is intended exclusively for purchasers of Claude Free, Pro, Max, Team, and Enterprise subscription plans and is designed to support ordinary use of Claude Code and other native Anthropic applications.“*
- *„**Developers** building products or services that interact with Claude's capabilities, including those using the Agent SDK, should use API key authentication […]. Anthropic does not permit third-party developers to offer Claude.ai login into their own applications, or to route requests through Free, Pro, or Max plan credentials on behalf of their users. Moreover, developers may not collect, store, or intermediate Claude.ai credentials or session tokens — sign-in to a Claude account must complete through Anthropic's own flow.“*
- *„[…] Nor does it prevent an end user from signing in to the unmodified Claude Code binary with their own Claude subscription […]“*
- Für Produkte, die Claude Code ausliefern: *„The Claude Code binary must not be modified.“* und *„Customers may not pay for, resell, or intermediate Claude usage on their end users' behalf.“*
- *„Anthropic reserves the right to take measures to enforce these restrictions and may do so without prior notice.“*

**Bedeutung für MoinStudio [EINSCHÄTZUNG]:** Die Verbote richten sich an **Entwickler, die Produkte/Dienste für andere Nutzer** bauen („on behalf of their users“, „into their own applications“). Philip ist Entwickler **und** einziger Endnutzer; er nutzt sein eigenes Abo mit dem unveränderten Binary. Kritisch wäre MoinStudio erst, wenn es (a) weitergegeben würde und andere darüber das Abo von Philip nutzen, (b) einen eigenen Login-Dialog für claude.ai anbieten würde oder (c) `.credentials.json`/OAuth-Tokens ausliest, kopiert oder selbst an die API schickt.

### 2.2 Agent SDK – Overview
Quelle: https://code.claude.com/docs/en/agent-sdk/overview

- *„Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK. Use the API key authentication methods described in the Quickstart instead.“*
- *„Use of the Claude Agent SDK is governed by Anthropic's Commercial Terms of Service […]“*
- Sprachen ohne SDK: *„To drive the same agent loop from a language other than Python or TypeScript, run the CLI as a subprocess with the `-p` flag and `--output-format json`.“*

### 2.3 Support: „Use the Claude Agent SDK with your Claude plan“
Quelle: https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan (letzte Aktualisierung laut Seite: 16.06.2026)

- *„Update June 15: We're pausing the changes to Claude Agent SDK usage described below. For now, nothing has changed: Claude Agent SDK, `claude -p`, and third-party app usage still draw from your subscription's usage limits. […] We're working to update the plan to better support how users build with Claude subscriptions. When we have an update, we'll share it before anything takes effect.“*
- Der (pausierte) Plan nannte ausdrücklich als abgedeckt: *„The `claude -p` command in Claude Code (non-interactive mode)“* und *„Third-party apps that authenticate with your Claude subscription through the Agent SDK“*, und beschrieb das Guthaben als *„sized for individual experimentation and automation“*.

→ **[BELEGT]** Anthropic erkennt `claude -p` mit Abo ausdrücklich als Nutzungsform an. **[EINSCHÄTZUNG]** Das ist die „explicit permission“, die die Consumer-Terms-Automatisierungsklausel verlangt, jedenfalls für private Automatisierung im normalen Umfang.

### 2.4 Consumer Terms
Quelle: https://www.anthropic.com/legal/consumer-terms (gültig ab 08.10.2025 laut Seite)

- Einleitung der Verbotsliste: *„You may not access or use, or help another person to access or use, our Services in the following ways:“*
- *„Except when you are accessing our Services via an Anthropic API Key or where we otherwise explicitly permit it, to access the Services through automated or non-human means, whether through a bot, script, or otherwise.“*
- *„You may not share your Account login information, Anthropic API key, or Account credentials with anyone else or make your Account available to anyone else.“*
- Nutzungslimits: *„[…] may have technical restrictions associated with them, for example, the number of Inputs you may submit to the Service or the number of Outputs you may receive within a certain period of time.“*

### 2.5 Usage Policy
Quelle: https://www.anthropic.com/legal/aup (gültig ab 15.09.2025 laut Seite)

Laut Abruf nichts Spezifisches zu Skripten mit Abo. Relevant nur allgemein: kein *„Intentionally bypass capabilities, restrictions, or guardrails established within our products […] without prior authorization“* → **keine Limit-Umgehung** (z. B. mehrere Accounts rotieren).

---

## 3. Sicherstellen, dass das Abo genutzt wird (nicht ein API-Key)

### 3.1 Auth-Reihenfolge [BELEGT]
Quelle: https://code.claude.com/docs/en/authentication („Authentication precedence“). Reihenfolge, erste gewinnt:
1. Cloud-Provider (`CLAUDE_CODE_USE_BEDROCK` / `_VERTEX` / `_FOUNDRY`)
2. `ANTHROPIC_AUTH_TOKEN`
3. `ANTHROPIC_API_KEY`: *„In non-interactive mode (`-p`), the key is always used when present.“*
4. `apiKeyHelper` (Settings)
5. `CLAUDE_CODE_OAUTH_TOKEN` (aus `claude setup-token`, Abo-gebunden)
6. Anthropic-Profile / Federation (`ANTHROPIC_PROFILE`, `ANTHROPIC_FEDERATION_RULE_ID` + `ANTHROPIC_ORGANIZATION_ID`, aktives Profil in `%APPDATA%\Anthropic`)
7. Abo-OAuth aus `/login`: *„This is the default for Claude Pro, Max, Team, and Enterprise users.“*

Wichtig: Ein gesetzter `ANTHROPIC_API_KEY` **überschreibt im `-p`-Modus immer** das Abo, ohne Rückfrage. Support-Artikel 11145838: *„If you have an ANTHROPIC_API_KEY environment variable set on your system, Claude Code will use this API key for authentication instead of your Claude subscription.“*

**`--bare` NICHT verwenden** [BELEGT, headless-Doku]: *„In bare mode, Claude Code never reads OAuth credentials or the system keychain.“* und *„Bare mode does not read `CLAUDE_CODE_OAUTH_TOKEN`.“* `--bare` funktioniert also nur mit API-Key und ist für MoinStudio tabu, obwohl die Doku es für Skripte empfiehlt (*„will become the default for `-p` in a future release“*). **Risiko:** Sollte `--bare` künftig Standard für `-p` werden, muss MoinStudio beim Update prüfen, ob es ein Opt-out gibt. [EINSCHÄTZUNG]

### 3.2 Login prüfen per CLI [BELEGT + LOKAL GETESTET]
CLI-Referenz: *„`claude auth status` – Show authentication status as JSON. Exit code 0 if logged in, 1 if not“*, `--text` für Klartext.

Lokales Ergebnis (2.1.283, E-Mail/Org-ID hier gekürzt):
```json
{
  "loggedIn": true,
  "authMethod": "claude.ai",
  "apiProvider": "firstParty",
  "configDirectory": "C:\\Users\\Morni\\.claude",
  "email": "…",
  "orgId": "…",
  "subscriptionType": "max"
}
```
`claude auth status --text` → `Login method: Claude Max account`. Exit-Code 0.

→ MoinStudio prüft vor jedem Job: Exit 0, `loggedIn === true`, `authMethod === "claude.ai"`, `apiProvider === "firstParty"`, `subscriptionType` ∈ {`pro`,`max`}. [Die Feldnamen stammen aus dem lokalen Test, nicht aus der Doku. Die Doku sagt nur „JSON“. Daher defensiv parsen.]

Weitere Prüfwege: `/status` in interaktiver Session (zeigt aktive Methode; *„When a login and an API key are both configured, `/status` marks the credential that isn't in use.“*). `/login` ist in `-p` **nicht** verfügbar (headless-Doku) → Login muss Philip einmal interaktiv (`claude` im Terminal oder `claude auth login`) machen.

Zugangsdaten liegen unter Windows in `%USERPROFILE%\.claude\.credentials.json` [BELEGT]. **MoinStudio darf diese Datei nicht lesen oder kopieren** (siehe 2.1 „collect, store, or intermediate“).

### 3.3 Weitere Kontrolle nach dem Lauf
- Das `result`-JSON enthält `modelUsage.<modell>.provider: "firstParty"` und `total_cost_usd`. **`total_cost_usd` ist bei Abo-Nutzung nur eine Schätzung zu Listenpreisen**, keine Rechnung [BELEGT: *„The `total_cost_usd` and `costUSD` fields are client-side estimates, not authoritative billing data.“*; costs-Seite: *„Claude Max and Pro subscribers have usage included in their subscription, so the session cost figure isn't relevant for billing purposes.“*]. Im lokalen Test war `costBasis: "list"`. Einen Abo-Indikator im Result-JSON gibt es nicht; die Abo-Prüfung geht nur über `claude auth status`.
- `--max-budget-usd` greift auf diese Schätzung zu; für Abo-Nutzer höchstens als grober „Verbrauchsdeckel“ sinnvoll. [EINSCHÄTZUNG]

---

## 4. Nutzungslimits des Abos

### 4.1 Funktionsweise [BELEGT]
- Gemeinsames Kontingent: *„Your usage of all different Claude product surfaces (claude.ai, Claude Code, Claude Desktop) counts towards the same usage limit.“* (Support 11647753). Also teilen sich Claude-Desktop-MCP-Nutzung, `claude -p` und normaler Chat dasselbe Budget.
- Session-Fenster: *„Your session-based usage limit will reset every five hours.“* (Support 8325606, Pro)
- Wochenlimit: *„Pro plans also have a weekly usage limit that applies across all models. Weekly limits reset at a fixed time each week that is assigned to your account.“* Reset-Zeit unter claude.ai → Settings → Usage.
- Max: Max 5x = 5-fache, Max 20x = 20-fache Pro-Session-Menge (Suchergebnis-Auszug aus Support 11049741; Seite selbst nicht einzeln abgerufen).
- Claude-Code-Fehlerreferenz: Es gibt Session-, Wochen- sowie modellfamilienspezifische Limits (Opus, Sonnet). *„Usage counts against the session and weekly allowances at the same time. A single burst of heavy activity, such as a large workflow fanout, can exhaust the weekly allowance before the session window resets.“*
- Verbrauch hängt ab von *„length and complexity of your conversations, the features you use, which Claude model […], and the effort level“* (Support 11647753). Bilder kosten ebenfalls Kontingent. [EINSCHÄTZUNG: Bild-Tokens sind bei vielen Renders ein relevanter Faktor]
- **Usage Credits**: über das Limit hinaus kostenpflichtig zu API-Preisen, nur wenn aktiviert. Die Doku zu `/usage-credits` bestätigt das. **Für MoinStudio: deaktiviert lassen.** Im lokalen Test stand `fast_mode_disabled_reason: "extra_usage_disabled"`, ein Hinweis, dass Extra-Usage derzeit aus ist [LOKAL, Deutung = EINSCHÄTZUNG].

### 4.2 Limit-Treffer erkennen [BELEGT]
Fehlerreferenz https://code.claude.com/docs/en/errors, Abschnitt „You've hit your session limit“: Meldungstexte
```
You've hit your session limit · resets 3:45pm
You've hit your weekly limit · resets Mon 12:00am
You've hit your Opus limit · resets 3:45pm
You've hit your Sonnet limit · resets 3:45pm
```
Vorwarnung: `You've used 85% of your session limit · resets 3:45pm`.
Die Opus/Sonnet-Limits gelten nur für die jeweilige Modellfamilie (Modellwechsel hilft), Session/Woche gelten modellübergreifend.

Maschinell lesbar (Doku Agent SDK TypeScript, gleiche Nachrichten wie `stream-json`):
- **`rate_limit_event`** (Typ `SDKRateLimitEvent`): `{"type":"rate_limit_event","rate_limit_info":{"status":"allowed"|"allowed_warning"|"rejected","resetsAt"?:number,"utilization"?:number,"errorCode"?:"credits_required",…}}`. *„When `errorCode` is `"credits_required"`, the rejection is from a claude.ai subscription whose included usage is exhausted […]“*
- **Assistant-Message-Feld `error`**: u. a. `'rate_limit'` (*„a 429 against your quota“*), `'overloaded'` (529), `'authentication_failed'`, `'billing_error'`, `'account_on_hold'`.
- **`system/api_retry`-Event** mit `error` = `rate_limit` usw. und `retry_delay_ms` (headless-Doku).
- **Result-Nachricht**: `is_error`, `subtype` (`success` | `error_max_turns` | `error_during_execution` | `error_max_budget_usd` | …), `api_error_status`, `terminal_reason` (u. a. `api_error`, `blocking_limit`, `budget_exhausted`), bei Fehler `errors: string[]`.
- **Exit-Code**: *„exits with code 0 on success and a non-zero code when the run fails“*; *„When a failure happens inside the run, such as missing authentication, Claude Code prints the failure as the result on stdout.“* SIGTERM → Exit 143.

**Nicht belegt:** Ein spezieller Exit-Code nur für „Limit erreicht“ ist nicht dokumentiert. Wie genau `resetsAt` kodiert ist (Unix-Sekunden vs. ms), steht nicht in der Doku → beim ersten echten Limit-Treffer das Roh-Event loggen. [EINSCHÄTZUNG]

Das automatische „continuing automatically at …“ gilt laut Doku für **interaktive** Sessions; für `-p` muss MoinStudio selbst warten und fortsetzen.

### 4.3 Strategie für lange Jobs [EINSCHÄTZUNG, gestützt auf belegte Mechanismen]
1. **Etappen statt Monster-Prompt:** Jeder Job wird in Schritte zerlegt (z. B. „Skript entwerfen“, „Thumbnail-Varianten bewerten“), jeder Schritt = ein `claude -p`-Aufruf mit `--max-turns` als Sicherung.
2. **Checkpoints in MoinStudio:** Ergebnis jedes Schritts in der App-Datenbank/Datei ablegen, nicht nur im Claude-Kontext. Ein abgebrochener Schritt wird wiederholt, erledigte nicht.
3. **Session-Resume:** `session_id` aus dem Result speichern (ist *„present on every result regardless of success or error“*) und mit `--resume <id>` fortsetzen. Alternativ mit `--session-id <uuid>` selbst eine UUID vorgeben, dann kennt die App die ID schon vor dem Start. Kein `--no-session-persistence`, wenn Resume gewünscht ist. Transkripte liegen unter `~/.claude/projects/` und werden nach `cleanupPeriodDays` gelöscht.
4. **Limit-Handling:** Bei `rate_limit_event` mit `status: "rejected"` oder Assistant-`error: "rate_limit"` oder Result-Text `You've hit your … limit`: Job auf „pausiert bis <resetsAt/geparste Zeit>“ setzen, Prozess sauber beenden (SIGINT bzw. stdin schließen statt SIGTERM, damit der Turn abgeschlossen wird), nach Reset mit `--resume` fortsetzen. Bei `allowed_warning` (z. B. 85 %): keine neuen großen Jobs starten, Nutzer informieren.
5. **Kein Retry-Sturm:** `overloaded`/`api_retry` handhabt Claude Code selbst. MoinStudio startet nicht parallel neu.
6. **Modellwahl:** Für einfache Schritte `--model sonnet`/`haiku`, Opus nur wo nötig, um Wochen- und Opus-Limit zu schonen. Bei „Opus limit“ auf Sonnet ausweichen (Doku bestätigt, dass das hilft).
7. **Nicht parallelisieren:** max. 1 headless-Prozess gleichzeitig (Burst kann Wochenlimit leeren, s. o.).
8. **Kontext klein halten:** Im lokalen Test erzeugte schon „antworte nur mit OK“ ~31 000 Cache-Creation-Tokens, weil Standard-System-Prompt, Tools, CLAUDE.md usw. geladen werden. Deshalb Kindprozess in einem **eigenen, leeren Arbeitsverzeichnis** starten, `--tools` auf das Nötige begrenzen, `--strict-mcp-config` nutzen und wenige, dafür größere Schritte machen.

---

## 5. Claude Desktop + lokale MCP-Server (Windows)

### 5.1 Konfigurationsdatei
- **[BELEGT]** Offizielle MCP-Doku: `%APPDATA%\Claude\claude_desktop_config.json`; Logs: `%APPDATA%\Claude\logs` (`mcp.log`, `mcp-server-<NAME>.log` mit stderr des Servers). Nach Änderung Claude Desktop **komplett beenden und neu starten**. Pfade **absolut**.
- **[LOKAL GETESTET]** Auf Philips Rechner ist Claude Desktop als **MSIX** installiert. `%APPDATA%\Claude` existiert **nicht**; die tatsächliche Datei liegt unter
  `%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json` (daneben `logs\`).
- **[DRITTQUELLE]** GitHub-Issues anthropics/claude-code #25579, #26073, #29100 beschreiben genau diese MSIX-Umleitung und dass Konfigurationen im „falschen“ Pfad stillschweigend ignoriert werden. **In offizieller Anthropic-Doku habe ich den MSIX-Pfad nicht gefunden** (Support-Artikel „Deploy Claude Desktop for Windows“ nennt MSIX, aber keinen Config-Pfad).
- **Implementierungsregel:** MoinStudio ermittelt den Pfad so: existiert `%LOCALAPPDATA%\Packages\Claude_*\LocalCache\Roaming\Claude\` → dort schreiben; sonst `%APPDATA%\Claude\`. Am sichersten: in Claude Desktop Settings → Developer → „Edit Config“ öffnen lassen und prüfen, welche Datei aufgeht. Vorhandene Einträge immer **mergen**, nie überschreiben; vorher Backup.
- **[BELEGT]** code.claude.com/docs/en/desktop: Server aus `claude_desktop_config.json` stehen auch im Code-Tab von Claude Desktop zur Verfügung; *„The standalone CLI does not read `claude_desktop_config.json`.“* → Für `claude -p` braucht MoinStudio eine eigene `--mcp-config`-Datei.

Beispiel (stdio, Format aus der offiziellen Doku):
```json
{
  "mcpServers": {
    "moinstudio": {
      "command": "C:\\Pfad\\zu\\MoinStudio\\moinstudio-mcp.exe",
      "args": ["--stdio"],
      "env": { "MOINSTUDIO_DATA": "C:\\Users\\Morni\\MoinStudio" }
    }
  }
}
```
Bei Electron-App als MCP-Server: z. B. `"command": "node"` + absoluter Pfad zum Server-Skript, oder die App-EXE mit `ELECTRON_RUN_AS_NODE=1` in `env`. [EINSCHÄTZUNG, nicht in Anthropic-Doku]
stdio-Regel [allg. MCP, EINSCHÄTZUNG]: stdout ausschließlich für JSON-RPC, Logging nur auf stderr (die Doku bestätigt, dass stderr in `mcp-server-NAME.log` landet).

### 5.2 Desktop Extensions (.mcpb, früher .dxt) [BELEGT]
- Anthropic Engineering-Blog: Seit 11.09.2025 heißt das Format `.mcpb` (MCP Bundle); *„Existing .dxt extensions will continue to work, but we recommend developers use .mcpb for new extensions going forward.“* Pflichtdatei: `manifest.json`. Packen: `npx @anthropic-ai/mcpb pack`. Server-Typen `node`, `python`, `binary`. Claude Desktop bringt Node.js mit. Als sensitiv markierte `user_config`-Werte landen im OS-Schlüsselspeicher.
- Installation (Support 10949351): *„Navigate to Settings > Extensions on Claude Desktop. Click 'Advanced settings' and find the Extension Developer section. Click 'Install Extension…' and select the .mcpb file.“* Alternativ Doppelklick/Drag&Drop.
- **Empfehlung [EINSCHÄTZUNG]:** Für MoinStudio ist `.mcpb` der robustere Installationsweg, weil er das MSIX-Pfadproblem umgeht. Manuelle JSON-Konfiguration als Fallback/Entwicklermodus.

### 5.3 Bilder als Tool-Result
- MCP-Tool-Results dürfen Content-Blöcke vom Typ `image` enthalten (MCP-Typ `"text" | "image" | "audio" | "resource" | "resource_link"`, Agent-SDK-TS-Doku) [BELEGT]. Format nach MCP-Spezifikation: `{ "type": "image", "data": "<base64>", "mimeType": "image/png" }`.
- **Claude Code** [BELEGT, mcp-Doku „Images in tool results“]: *„When an MCP tool returns a PNG, JPEG, GIF, or WebP image, Claude sees the image inline in the conversation. The inline copy may be scaled down or compressed to fit the model's image size limits.“* Ab v2.1.283 wird zusätzlich das Original in `tool-results` gespeichert.
- **Claude Desktop:** Dass Desktop Bild-Content aus MCP-Tools anzeigt/versteht, ist in der offiziellen Doku, die ich gefunden habe, **nicht explizit** beschrieben. [DRITTQUELLE] Mehrere GitHub-Diskussionen berichten, dass es funktioniert, aber mit einem **harten 1-MB-Limit** pro Tool-Result („Tool result is too large. Maximum size is 1MB.“), inkl. ~33 % Base64-Overhead.

### 5.4 Größenlimits für Tool-Results
- **Claude Code [BELEGT]:** Warnung ab 10 000 Tokens, Standardlimit **25 000 Tokens** (`MAX_MCP_OUTPUT_TOKENS`, änderbar). Text-Results über dem Limit werden in eine Datei ausgelagert; Tools können per `anthropic/maxResultSizeChars` für Text ein eigenes Limit deklarieren. *„Tools that return image data are still subject to `MAX_MCP_OUTPUT_TOKENS`“.* Read-Tool: Bilder > 500 KB nach Resize werden als JPEG neu kodiert.
- **Claude Desktop [DRITTQUELLE]:** ~1 MB pro Tool-Result, nicht offiziell dokumentiert gefunden.
- **Implementierungsregel [EINSCHÄTZUNG]:** Renders im MCP-Tool auf max. ~1568 px lange Kante skalieren, als JPEG (Qualität ~80) oder kleines PNG, Ziel < 700 KB Rohdaten. Zusätzlich immer den **Dateipfad** als Text mitliefern, damit Claude Code das Original bei Bedarf per Read-Tool öffnen kann. Mehrere Bilder lieber auf mehrere Aufrufe verteilen.

---

## 6. Claude Code headless – relevante Flags (belegt)

Alle Flags unten sind in https://code.claude.com/docs/en/cli-reference bzw. /headless dokumentiert und (außer wo vermerkt) in `claude --help` von 2.1.283 lokal vorhanden.

| Flag | Zweck (laut Doku) | Hinweis für MoinStudio |
|---|---|---|
| `-p`, `--print` | nicht-interaktiv, Antwort ausgeben und beenden | Basis |
| `--output-format text\|json\|stream-json` | `json`: *„structured JSON with result, session ID, and metadata“*; `stream-json`: NDJSON-Events | `stream-json` + `--verbose` für Fortschritt/Limit-Events |
| `--verbose` | im Print-Modus u. a. Streaming-Events | für `stream-json` nötig (laut Doku-Beispielen) |
| `--include-partial-messages` | Token-Deltas (nur mit `-p` + `stream-json`) | optional für Live-Text |
| `--input-format text\|stream-json` | Eingabeformat im Print-Modus | für Mehrfach-Nachrichten/Bilder |
| `--replay-user-messages` | User-Messages zurückspiegeln (braucht stream-json in/out) | optional |
| `--json-schema '<schema>'` | validierte strukturierte Ausgabe in `structured_output` | ideal für Bewertungen (Scores) |
| `-c`, `--continue` | letzte Konversation fortsetzen | lieber `--resume` mit ID |
| `-r`, `--resume <id\|name\|pfad.jsonl>` | bestimmte Session fortsetzen | Checkpoint-Resume |
| `--session-id <uuid>` | *„Use a specific session ID for the conversation (must be a valid UUID)“* | App vergibt ID selbst |
| `--fork-session` | beim Resume neue ID | Varianten ausprobieren |
| `--no-session-persistence` | nichts speichern, kein Resume | nur für Wegwerf-Abfragen |
| `--mcp-config <datei\|json>` | MCP-Server laden | MoinStudio-MCP für headless |
| `--strict-mcp-config` | *„Only use MCP servers from `--mcp-config`, ignoring all other MCP configurations.“* | immer setzen |
| `--allowedTools` | ohne Rückfrage erlaubte Tools, Regel-Syntax z. B. `Bash(git diff *)` | z. B. `Read,mcp__moinstudio__*` |
| `--disallowedTools` | Deny-Regeln; bloßer Name entfernt Tool; `"mcp__*"` entfernt alle MCP-Tools | `Bash,Edit,Write` sperren, wo unnötig |
| `--tools` | verfügbare Tools einschränken | Kontext/Tokens sparen |
| `--permission-mode` | `default`/`manual`, `acceptEdits`, `plan`, `auto`, `dontAsk`, `bypassPermissions` | `dontAsk` für abgeschlossene Jobs |
| `--permission-prompts host\|none` | Rückfragen im Print-Modus abschalten (ab v2.1.259) | `none` für unbeaufsichtigte Läufe |
| `--max-turns <n>` | Anzahl agentischer Turns begrenzen, *„Exits with an error when the limit is reached“* | **in Doku, aber nicht in `--help` gelistet** |
| `--max-budget-usd` | Kostengrenze (Schätzwert) | bei Abo nur grob |
| `--append-system-prompt` / `-file` | an Standard-Systemprompt anhängen | MoinStudio-Regeln |
| `--system-prompt` / `-file` | Systemprompt ersetzen | nur wenn nötig |
| `--model` / `--fallback-model` | Modell-Alias oder voller Name | `sonnet`, `opus`, `haiku` |
| `--effort` | `low` … `max` | Kontingent sparen |
| `--add-dir` | zusätzliche Arbeitsverzeichnisse | Render-Ordner freigeben |
| `--settings <datei\|json>` | Settings nur für diese Session | z. B. Permissions |
| `--bare` | minimaler Start, **liest aber keinen OAuth-Login** | **nicht verwenden** |

Nicht als eigenes Flag gefunden: ein `--image`-Flag. **Bilder übergibt man über Dateipfad im Prompt (Read-Tool) oder über `--input-format stream-json` mit Image-Content-Blöcken** (siehe 7).

Weitere Befunde aus der Doku: Piped stdin max. 10 MB; `-p` zeigt **keinen Workspace-Trust-Dialog** und lädt ohne `--bare` Hooks/`.mcp.json` des Arbeitsverzeichnisses → MoinStudio startet `claude` in einem kontrollierten eigenen Arbeitsordner.

### 6.1 Lokaler Formattest [LOKAL GETESTET]
Befehl (in leerem Scratch-Ordner, `ANTHROPIC_API_KEY` entfernt):
`claude -p "antworte nur mit OK" --output-format json --max-turns 1 --model haiku --no-session-persistence` → Exit 0. Gekürzte Ausgabe:
```json
{"type":"result","subtype":"success","is_error":false,"api_error_status":null,
 "result":"OK","num_turns":1,"stop_reason":"end_turn","terminal_reason":"completed",
 "session_id":"2cca54bd-…","duration_ms":1881,"duration_api_ms":2470,
 "total_cost_usd":0.063246,
 "usage":{"input_tokens":10,"cache_creation_input_tokens":30904,"output_tokens":92,…},
 "modelUsage":{"claude-haiku-4-5-20251001":{"costUSD":0.063246,"provider":"firstParty","costBasis":"list",…}},
 "permission_denials":[],"fast_mode_disabled_reason":"extra_usage_disabled", …}
```
`total_cost_usd` ist eine Listenpreis-Schätzung und wurde **nicht** abgerechnet (Abo). Der hohe `cache_creation_input_tokens`-Wert zeigt den Grund-Overhead jedes Aufrufs.

---

## 7. Bilder (PNG-Renders) im headless-Modus ansehen/bewerten

**[BELEGT]** Drei Wege:
1. **Read-Tool auf Dateipfad** (tools-reference): *„PNG, JPG, and other image formats are returned as visual content that Claude can see, not as raw bytes. Claude Code resizes and recompresses large images […]“* → Prompt z. B. „Bewerte C:\…\render_03.png nach …“, dazu `--allowedTools Read` und ggf. `--add-dir <Render-Ordner>`. **Einfachster Weg für MoinStudio.**
2. **MCP-Tool, das `image`-Content liefert** (mcp-Doku, siehe 5.3): Claude sieht das Bild inline. Gut, wenn MoinStudio Renders on-the-fly erzeugt oder vorab verkleinert.
3. **Streaming-Input mit Bildblöcken**: Die Agent-SDK-Doku (streaming-vs-single-mode) zeigt User-Messages mit `{"type":"image","source":{"type":"base64","media_type":"image/png","data":…}}`. [EINSCHÄTZUNG] Das SDK nutzt dafür intern `--input-format stream-json`; direkt über die CLI ist das Nachrichtenformat nicht separat dokumentiert → nur nutzen, wenn 1 und 2 nicht reichen.

Für strukturierte Bewertungen: `--json-schema` mit z. B. `{score, begruendung, verbesserungen[]}`. Die Doku warnt, dass große Bilder verkleinert werden; für Detailprüfung Ausschnitte vorher croppen.

---

## 8. Implementierungsregeln für MoinStudio

**Auth & Recht**
1. Vor jedem Start eines `claude`-Kindprozesses: Kind-Umgebung **ohne** `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`, `CLAUDE_CODE_USE_FOUNDRY`, `ANTHROPIC_PROFILE`, `ANTHROPIC_FEDERATION_RULE_ID`, `ANTHROPIC_ORGANIZATION_ID` aufbauen (Kopie von `process.env`, diese Schlüssel löschen). Ist einer davon in Philips System gesetzt, zeigt die App eine Warnung.
2. Kein `apiKeyHelper`: MoinStudio prüft `~/.claude/settings.json` (und Projekt-Settings im Arbeitsordner) lesend auf `apiKeyHelper` und warnt; eigene `--settings` enthalten nie `apiKeyHelper`.
3. Vorab `claude auth status` ausführen: Exit 0 **und** `authMethod == "claude.ai"` **und** `subscriptionType` in (`pro`,`max`), sonst Abbruch mit Hinweis „Bitte im Terminal `claude auth login` ausführen“. MoinStudio startet nur Anthropics eigenen Login-Flow (Terminal öffnen), baut **keinen** eigenen Login-Dialog.
4. MoinStudio liest, kopiert oder überträgt **nie** `.credentials.json`, OAuth-Tokens oder `CLAUDE_CODE_OAUTH_TOKEN`; `claude setup-token` wird nicht verwendet (nicht nötig, da interaktiver Login vorhanden).
5. Nur das **unveränderte** offizielle Binary aufrufen (Pfad konfigurierbar; Standard: `claude` im PATH bzw. die VS-Code-Extension-Binary). Nie `--bare`.
6. MoinStudio bleibt Einzelnutzer-App: keine Weitergabe, kein Server-/Mehrbenutzerbetrieb, kein Fernzugriff durch andere. Falls MoinStudio je veröffentlicht wird → Nutzer müssen ihr **eigenes** Abo über Anthropics Flow anmelden bzw. API-Key; Rechtslage dann neu prüfen.
7. In claude.ai Settings → Usage die **Usage Credits deaktiviert** lassen → kein Kostenrisiko über das Abo hinaus.

**Prozess & Sicherheit**
8. Arbeitsverzeichnis des Kindprozesses: eigener Ordner, z. B. `%LOCALAPPDATA%\MoinStudio\claude-work\` (keine fremden `.claude/`-Hooks, kein fremdes `.mcp.json`).
9. Standardaufruf: `claude -p --output-format stream-json --verbose --strict-mcp-config --mcp-config <moinstudio-mcp.json> --permission-mode dontAsk --permission-prompts none --allowedTools "Read,mcp__moinstudio__*" --max-turns <n> --model <alias> --session-id <uuid>`; Prompt über stdin oder Argument (Windows-Quoting beachten → stdin bevorzugt).
10. Streams zeilenweise parsen (NDJSON), stdout/stderr getrennt loggen; unbekannte Event-Typen ignorieren (Doku: neue Werte können hinzukommen).
11. Abbruch durch Nutzer: stdin schließen/SIGINT statt Kill; Exit 143 = per SIGTERM beendet, Turn unvollständig.

**Limit-Handling**
12. Events `rate_limit_event`, `system/api_retry`, Assistant-`error`, Result `is_error`/`subtype`/`terminal_reason` auswerten; zusätzlich Textmuster `You've hit your (session|weekly|Opus|Sonnet) limit · resets …` und `You've used \d+% of your`.
13. Bei Limit: Job-Status „wartet auf Reset“ + Uhrzeit, `session_id` sichern, nach Reset automatisch (oder per Klick) `--resume`. Nie mehrere Prozesse parallel. Bei Opus-Limit optional auf Sonnet wechseln.
14. Jobs als Etappen mit persistierten Zwischenergebnissen; jede Etappe idempotent wiederholbar.
15. Verbrauchsanzeige in der App aus `usage`/`modelUsage` (Tokens), **nicht** aus `total_cost_usd` als „Kosten“ bezeichnen.

**MCP für Claude Desktop**
16. Primär als `.mcpb`-Extension ausliefern; Fallback: Eintrag in `claude_desktop_config.json` unter dem **tatsächlich genutzten** Pfad (MSIX: `%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\`), mit Merge + Backup, danach Hinweis „Claude Desktop komplett neu starten“.
17. MCP-Server: stdout nur JSON-RPC, Logs auf stderr; Bilder verkleinert (< ~700 KB) + Dateipfad als Text; große Textdaten paginieren (Claude Code: 25 000-Token-Standardlimit).
18. Dieselbe MCP-Server-Binary für Claude Desktop und für `claude -p --mcp-config` verwenden.

---

## 9. Offene Punkte / nicht belegt
- Offizieller Nachweis des MSIX-Config-Pfads: nicht in Anthropic-Doku gefunden (nur GitHub-Issues + lokaler Befund).
- Offizielles Tool-Result-Größenlimit von Claude Desktop (1 MB): nur Drittquellen.
- Explizite offizielle Aussage, dass Claude Desktop MCP-`image`-Results dem Modell zeigt: nicht gefunden (für Claude Code belegt).
- Exakte JSON-Felder von `claude auth status`: nur lokal beobachtet, Doku sagt nur „JSON“.
- Kodierung von `resetsAt` im `rate_limit_event` nicht dokumentiert.
- Künftige Änderung der Abrechnung von `claude -p` mit Abo ist angekündigt, aber pausiert. Support-Artikel 15036540 regelmäßig prüfen.
- Die Max-Plan-Seite (Support 11049741) wurde nicht separat abgerufen; Multiplikatoren stammen aus dem Suchergebnis-Auszug.
- Support-Artikel 11647753 und 10949351 wurden über ein Zusammenfassungstool gelesen. Zitate daraus sind dessen Wiedergabe, nicht vollständig roh geprüft. Alle code.claude.com-Seiten und der Artikel 15036540 wurden roh (Markdown/HTML) gelesen.
- Alle Seiten waren erreichbar; keine Abruffehler.

---

## 10. Quellen (alle abgerufen am 2026-09-26)

Offiziell Anthropic:
- Claude Code – Legal and compliance: https://code.claude.com/docs/en/legal-and-compliance
- Claude Code – Run programmatically (headless): https://code.claude.com/docs/en/headless
- Claude Code – CLI reference: https://code.claude.com/docs/en/cli-reference
- Claude Code – Authentication: https://code.claude.com/docs/en/authentication
- Claude Code – Error reference: https://code.claude.com/docs/en/errors
- Claude Code – Costs: https://code.claude.com/docs/en/costs
- Claude Code – MCP: https://code.claude.com/docs/en/mcp
- Claude Code – Tools reference: https://code.claude.com/docs/en/tools-reference
- Claude Code – Environment variables: https://code.claude.com/docs/en/env-vars
- Claude Code – Desktop: https://code.claude.com/docs/en/desktop
- Agent SDK – Overview: https://code.claude.com/docs/en/agent-sdk/overview
- Agent SDK – TypeScript reference: https://code.claude.com/docs/en/agent-sdk/typescript
- Agent SDK – Sessions: https://code.claude.com/docs/en/agent-sdk/sessions
- Agent SDK – Cost tracking: https://code.claude.com/docs/en/agent-sdk/cost-tracking
- Agent SDK – MCP: https://code.claude.com/docs/en/agent-sdk/mcp
- Agent SDK – Streaming vs single mode: https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode
- Support – Use the Claude Agent SDK with your Claude plan: https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan
- Support – Use Claude Code with your Pro or Max plan: https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan
- Support – How do usage and length limits work?: https://support.claude.com/en/articles/11647753-how-do-usage-and-length-limits-work
- Support – What is the Pro plan?: https://support.claude.com/en/articles/8325606-what-is-the-pro-plan
- Support – What is the Max plan? (nur Suchergebnis-Auszug): https://support.claude.com/en/articles/11049741-what-is-the-max-plan
- Support – Getting Started with Local MCP Servers on Claude Desktop: https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop
- Support – Deploy Claude Desktop for Windows: https://support.claude.com/en/articles/12622703-deploy-claude-desktop-for-windows
- Anthropic Engineering – Desktop Extensions: https://www.anthropic.com/engineering/desktop-extensions
- Consumer Terms of Service: https://www.anthropic.com/legal/consumer-terms
- Usage Policy: https://www.anthropic.com/legal/aup
- MCP-Doku (Model Context Protocol, von Anthropic initiiert): https://modelcontextprotocol.io/docs/2026-07-28/develop/connect-local-servers

Drittquellen (nur als Hinweis, nicht maßgeblich):
- GitHub anthropics/claude-code Issue #25579 (MSIX userData-Pfad): https://github.com/anthropics/claude-code/issues/25579
- GitHub anthropics/claude-code Issue #26073 (MSIX „Edit Config“ öffnet falsche Datei): https://github.com/anthropics/claude-code/issues/26073
- GitHub anthropics/claude-code Issue #29100 (MSIX Config ignoriert): https://github.com/anthropics/claude-code/issues/29100
- GitHub tableau/tableau-mcp Discussion #319 („Tool result is too large. Maximum size is 1MB.“): https://github.com/tableau/tableau-mcp/discussions/319

Lokal: `claude.exe` 2.1.283 unter `C:\Users\Morni\.vscode\extensions\anthropic.claude-code-2.1.283-win32-x64\resources\native-binary\claude.exe` (`--version`, `--help`, `auth status`, ein Mini-Prompt mit Haiku).

---

## 11. Umsetzung in MoinStudio (Stand 0.0.19) [LOKAL GETESTET]

- `src/main/claude/env.ts`: Kind-Umgebung ohne API-Key-/Anbieter-Variablen (Regel 1), Warnung wenn im System gesetzt.
- `src/main/claude/cli.ts`: CLI-Suche (PATH → `~/.local/bin` → npm global → VS-Code/Cursor/Windsurf-Erweiterung), Login-Prüfung per `claude auth status` (Regel 3), Warnung bei `apiKeyHelper` (Regel 2). Anmeldedaten werden nie gelesen (Regel 4).
- `src/main/claude/run.ts`: `-p --output-format stream-json --verbose --permission-mode dontAsk --strict-mcp-config`, Prompt über stdin, nie `--bare` (Regeln 5, 9). Limit-Erkennung aus `rate_limit_event`, Assistant-`error` und Meldungstext mit Reset-Zeit (Regel 12). Im Job: Session merken, bis zum Reset warten, dann fortsetzen (Regel 13).
- **Messung 2026-09-26 (Haiku, „Antworte nur mit: Moin“):** Mit eigenem leerem Arbeitsordner und `--tools ""` (keine eingebauten Werkzeuge) sank die Grundlast auf **4 726 Cache-Creation-Tokens** statt ~31 000 wie im Recherche-Test. Dauer 3,6 s. Konsequenz: Werkzeuge immer auf das Nötige begrenzen.
