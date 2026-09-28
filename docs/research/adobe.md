# Adobe-Integration für MoinStudio – Recherche (Premiere, After Effects, Photoshop)

Stand: 2026-09-26 · Alle Quellen abgerufen am 2026-09-26 · Adobe ist auf dem Entwicklungsrechner **nicht installiert**, deshalb ist hier nichts praktisch getestet.

**Kennzeichnung im ganzen Dokument**
- **[BELEGT]**: steht so in einer offiziellen Quelle (Adobe-Doku, Adobe-Repo, Adobe-Blog) oder im Code eines gepflegten Open-Source-Projekts. Die Quelle ist jeweils angegeben.
- **[COMMUNITY]**: stammt aus Foren, Issues oder Drittprojekten. Das ist ein Hinweis, aber keine Zusage von Adobe.
- **[EINSCHÄTZUNG]**: eigene Schlussfolgerung. Nach der Installation prüfen (siehe Abschnitt 9).

---

## 0. Kurzfazit

1. **UXP ist der zukunftssichere Weg für Premiere und Photoshop.** In Premiere ist UXP seit **v25.6** offiziell freigegeben („Official Release of UXP extensibility“). Die öffentliche Beta startete mit v25.2 am 2024-12-04. Aktuell dokumentiert ist die **API v26.5** [BELEGT, Premiere-UXP-Changelog]. Photoshop hat UXP schon seit 2020 [BELEGT, Adobe-Blog 2026/09].
2. **After Effects hat noch keine UXP-Plugins.** Adobe kündigt eine „Public beta UXP plugins by November 2026“ an [BELEGT, Adobe-Blog 2026/09]. Heute heißt das für AE: **ExtendScript (`.jsx`) plus `aerender`**.
3. **Zeitplan für CEP:**

   | App | Keine neuen CEP-Einreichungen im Marketplace ab | CEP standardmäßig deaktiviert ab |
   |---|---|---|
   | Photoshop | 03/2027 | 12/2027 |
   | Premiere | 12/2027 | 12/2028 |
   | After Effects | 12/2028 | 12/2028 |

   Ab **Dezember 2029** ist CEP in diesen Apps gar nicht mehr enthalten. „Deaktiviert“ heißt dabei: Nutzer können CEP wieder einschalten. Adobe schreibt: „ExtendScripts are not affected by this transition“ [BELEGT, Adobe-Blog 2026/09].
   **Achtung, Widerspruch:** Der Premiere Pro Scripting Guide sagt, ExtendScript in Premiere werde „through September 2026“ unterstützt, also nur bis zu diesem Monat [BELEGT, ppro-scripting.docsforadobe.dev]. **Premiere-ExtendScript ist deshalb nur noch als Fallback geeignet.**
4. **Eine externe Anwendung kann ein UXP-Plugin nicht direkt ansprechen.** Ein UXP-Plugin kann nur **Client** sein, es kann keinen Server öffnen: „Plugins can connect to WebSocket servers, but cannot host or accept incoming connections“ [BELEGT, Premiere-UXP Network-Recipe]. Daraus folgt: **MoinStudio (Node) stellt einen lokalen Server bereit, und das Plugin verbindet sich dorthin.** So ist auch das Adobe-nahe Projekt `mikechambers/adb-mcp` gebaut [BELEGT, Code].
5. **Wichtiger Fallstrick unter Windows:** In Premiere (gemeldet mit 26.3.0.93) stürzt die App ab, wenn ein Plugin eine WebSocket-Verbindung aufbaut. Der Workaround in adb-mcp ist HTTP-Polling statt WebSocket (Commit vom 2026-07-08, Issue #32). Der Maintainer schreibt dazu: „Its a premiere pro bug when connecting to websockets on windows“ [COMMUNITY/Code].
6. **Schnitt-Übergabe an Premiere ohne Scripting: FCP7 XML (xmeml).** Laut Adobe übernimmt Premiere dabei Sequenz-Marker, Spur-Layout, Titel sowie „basic motion and opacity effects, and motion and opacity keyframes“ [BELEGT, Adobe Helpx]. **FCPXML (von FCP X) kann Premiere nicht importieren** [BELEGT]. OTIO wird importiert und exportiert, aber ohne dokumentierte Effekte oder Keyframes.

### Empfehlung pro App

| App | Primär | Fallback | Begründung |
|---|---|---|---|
| **Premiere** (2025 = 25.x, 2026 = 26.x) | **FCP7-XML erzeugen** (Schnitt, Zoom-Keyframes, Marker) **plus UXP-Panel-Plugin** (manifest v5, Mindestversion 25.6). Das Plugin verbindet sich per HTTP-Polling mit MoinStudio und übernimmt Import, Marker, Export (`EncoderManager`) und Transkription. | CEP-Panel mit ExtendScript und QE-DOM, nur für Lücken wie Rasierklinge oder Caption-Import aus SRT. Oder rein manueller XML-Import durch den Nutzer. | UXP ist offiziell und asynchron, blockiert die Oberfläche nicht, und jede Aktion landet in der Undo-Historie. Das XML trägt die Keyframes, die sich per API nur umständlich setzen lassen. |
| **Photoshop** (2025 = 26.x, 2026 = 27.x) | **UXP-Panel-Plugin** mit DOM und `batchPlay` innerhalb von `executeAsModal` | ExtendScript-`.jsx` über `Photoshop.exe <script.jsx>` oder COM (`Photoshop.Application`, `DoJavaScript`). Alternativ UXP-Script `.psjs`. | UXP ist ausgereift. COM und JSX werden weiterhin unterstützt (Helpx, Stand 23.12.2025) und brauchen kein Plugin. |
| **After Effects** (2025 = 25.x) | **ExtendScript `.jsx` über `AfterFX.exe -r`** (läuft in der bereits geöffneten Instanz) plus **`aerender`** zum Rendern | CEP-Panel (Muster: adb-mcp). Auf UXP umsteigen, sobald die Public Beta erscheint (angekündigt für 11/2026). | Heute gibt es keine UXP-API für AE. |

---

## 1. Methoden-Tabelle

| Methode | App | ab Version | Status | Quelle-URL | Abrufdatum |
|---|---|---|---|---|---|
| UXP-Plugin (Panel/Command), `require("premierepro")` | Premiere | 25.6 GA (Beta ab 25.2, 2024-12-04) | aktuell | https://developer.adobe.com/premiere-pro/uxp/changelog/ | 2026-09-26 |
| UXP Hybrid Plugins (C++ `.uxpaddon`) | Premiere | 26.2 | aktuell | https://developer.adobe.com/premiere-pro/uxp/changelog/ | 2026-09-26 |
| UXP `EncoderManager.exportSequence/encodeFile` | Premiere | 25.6 (`startBatchEncode` u. a. 26.3) | aktuell | https://github.com/AdobeDocs/uxp-premiere-pro (src/pages/ppro-reference/classes/encodermanager.md) | 2026-09-26 |
| UXP `Transcript.transcribeClipProjectItem` | Premiere | 25.6 (laut Referenz; im Changelog unter 26.5 aufgeführt) | aktuell | …/classes/transcript.md (gleiches Repo) | 2026-09-26 |
| UXP `ProjectConverter.exportAsFinalCutProXML / exportAsOpenTimelineIO` | Premiere | 26.2; `exportAAF` 26.3 | aktuell | …/classes/projectconverter.md | 2026-09-26 |
| ExtendScript-DOM (`app.project…`), QE-DOM | Premiere | alt | **veraltet**, laut Guide „supported … through September 2026“ | https://ppro-scripting.docsforadobe.dev/ | 2026-09-26 |
| CEP-Panel (CEP 12, Node im Panel) | Premiere / PS / AE | PPRO 25.0, AEFT 25.0, PHXS 25.12 | **veraltet**, Abschaltplan siehe Kurzfazit | https://github.com/Adobe-CEP/CEP-Resources (CEP_12.x Cookbook) · https://blog.developer.adobe.com/en/publish/2026/09/investing-in-the-future-of-creative-cloud-extensibility-uxp-comes-to-our-flagship-applications | 2026-09-26 |
| FCP7 XML (xmeml) importieren | Premiere | seit Langem (Helpx-Seite Stand 2023-09-25) | aktuell | https://helpx.adobe.com/premiere-pro/using/importing-xml-project-files-final.html | 2026-09-26 |
| FCPXML (FCP X) importieren | Premiere | – | **nicht unterstützt**, nur über XtoCC | wie oben | 2026-09-26 |
| OTIO importieren/exportieren | Premiere | Beta ab 10/2024; UXP-Export ab 26.2 | aktuell, Umfang begrenzt | https://community.adobe.com/announcements-732/now-released-otio-import-and-export-311699 | 2026-09-26 |
| UXP-Plugin plus `batchPlay` / `executeAsModal` | Photoshop | 22/23.0 (Interactive Mode ab 23.3, Timeout ab 25.10) | aktuell | https://developer.adobe.com/photoshop/uxp/2022/ps_reference/media/executeasmodal/ | 2026-09-26 |
| UXP-Scripts `.psjs` | Photoshop | (siehe Doku) | aktuell, keine Argumente möglich | https://developer.adobe.com/photoshop/uxp/2022/scripting/ · https://forums.creativeclouddeveloper.com/t/run-script-using-cmd-with-parameters/6548 | 2026-09-26 |
| ExtendScript `.jsx`, COM/VBScript (`DoJavaScript`) | Photoshop | alt | unterstützt (Helpx, Stand 23.12.2025) | https://helpx.adobe.com/photoshop/using/scripting.html (über web.archive.org, Snapshot 2026-01-30) | 2026-09-26 |
| `Photoshop.exe "<script.jsx>"` | Photoshop | alt | [COMMUNITY] | https://community.adobe.com/t5/photoshop-ecosystem-discussions/run-a-jsx-file-through-a-bat-file/td-p/12715573 | 2026-09-26 |
| ExtendScript `AfterFX.exe -r script.jsx` / `-s "code"` | After Effects | alt | aktuell (ExtendScript ist nicht abgekündigt) | https://ae-scripting.docsforadobe.dev/introduction/overview/ | 2026-09-26 |
| `aerender.exe` (Kommandozeilen-Render) | After Effects | alt | aktuell | https://helpx.adobe.com/after-effects/using/automated-rendering-network-rendering.html (über web.archive.org, Snapshot 2026-05-27) | 2026-09-26 |
| UXP für After Effects | After Effects | angekündigt: Public Beta bis 11/2026 | **noch nicht verfügbar**. Das Repo AdobeDocs/uxp-after-effects wurde am 2026-09-23 angelegt und enthält nur Platzhalter. | Blog 2026/09 (s. o.) · https://github.com/AdobeDocs/uxp-after-effects | 2026-09-26 |
| `.ccx` per Doppelklick oder UPIA-CLI | Premiere / PS | UXP | aktuell | https://github.com/AdobeDocs/uxp-premiere-pro (plugins/distribution/install) | 2026-09-26 |
| UXP Developer Tool (UDT) | alle UXP-Apps | – | nur für die Entwicklung | wie oben | 2026-09-26 |
| ZXP plus ZXPSignCmd, `PlayerDebugMode` | CEP-Apps | CEP | veraltet (CEP) | https://github.com/Adobe-CEP/CEP-Resources | 2026-09-26 |

---

## 2. Stand pro App (Detail)

### 2.1 Premiere (ab 26.0 unter dem Namen „Adobe Premiere“)

**Versionen [BELEGT, Changelog]:**
- 25.2: UXP-Public-Beta (2024-12-04)
- 25.6: UXP offiziell freigegeben. Adobe schreibt dazu: „Premiere Pro's UXP APIs are approaching parity with what was previously possible, via CEP and ExtendScript.“
- 26.2: Hybrid-Plugins
- 26.3: Breaking Changes
- 26.5: aktuellste dokumentierte API

Laut dem Scripting Guide ist Premiere „as of November 2025“ auf UXP umgestiegen. Die Umbenennung in „Adobe Premiere“ mit 26.0 im Januar 2026 steht nur bei Wikipedia, das ist also nicht offiziell geprüft [EINSCHÄTZUNG]. Die Adobe-Doku verwendet ab 26.5 selbst den Namen „Premiere“.

**Grundprinzip der API [BELEGT, ppro-reference/index.md]:** „all ExtendScript calls to Premiere were synchronous … blocked the Premiere UI … In UXP, a method call is asynchronous, and does not block the UI thread.“ Änderungen laufen immer nach demselben Muster:

```ts
project.lockedAccess(() => {
  const action = /* z. B. */ markers.createAddMarkerAction(name, type, startTime /* , … */);
  project.executeTransaction((compound) => compound.addAction(action), "MoinStudio: Marker");
});
```

- `executeTransaction(callback, undoString)` erzeugt einen Schritt in der Undo-Historie [BELEGT].
- Seit 26.3 **muss** jedes `create*Action` innerhalb von `lockedAccess` erzeugt werden [BELEGT, Breaking Change 26.3]. Adobe begründet das so: „an editor is making changes that might conflict with a UXP plugin operating at the same time“. Dafür gibt es auch ein ESLint-Plugin: `@adobe/eslint-plugin-premierepro`.

**Funktionsumfang laut Referenz (Repo AdobeDocs/uxp-premiere-pro, Commit vom 2026-09-21) [BELEGT]:**

| Bedarf | UXP-API | seit |
|---|---|---|
| Projekt erstellen / öffnen / speichern | `Project.createProject(path)`, `Project.open(path, OpenProjectOptions)`, `save`, `saveAs`, `close` | 25.6 |
| Dateien importieren | `project.importFiles(filePaths[], suppressUI, targetBin)`; zusätzlich `importSequences(projectPath, ids)`, `importAEComps`, `importAllAEComps` | 25.6 |
| Sequenz anlegen | `createSequence(name, presetPath*)` (presetPath ist veraltet), `createSequenceWithPresetPath` (26.3), `createSequenceFromMedia` | 25.6 / 26.3 |
| Clips einfügen / überschreiben / entfernen | `SequenceEditor.createInsertProjectItemAction`, `createOverwriteItemAction`, `createRemoveItemsAction`, `createCloneTrackItemAction` | 25.6 |
| Trimmen / Verschieben | `VideoClipTrackItem.createSetInPointAction`, `createSetOutPointAction`, `createSetStartAction`, `createSetEndAction`, `createMoveAction` | 25.6 |
| **Rasierklinge / Split** | **Kein eigener Aufruf in der Referenz gefunden.** Nachbauen per Clone plus In/Out-Punkte wäre denkbar [EINSCHÄTZUNG]. In ExtendScript ging das nur über das **undokumentierte** QE-DOM [EINSCHÄTZUNG]. | – |
| Marker | `Markers.getMarkers(obj)`, `createAddMarkerAction`, `createMoveMarkerAction`, `createRemoveMarkerAction`; `Marker.guid` (26.3) | 25.6 |
| Effekte | `VideoFilterFactory.createComponent(matchName)`, `VideoComponentChain.createAppendComponentAction` / `createInsertComponentAction` / `createRemoveComponentAction`; Übergänge über `TransitionFactory` / `createAddVideoTransitionAction` | 25.6 |
| **Keyframes (Motion Scale/Position)** | `ComponentParam.createKeyframe(value)`, `createAddKeyframeAction`, `createSetTimeVaryingAction`, `createSetValueAction`, `createSetInterpolationAtKeyframeAction`; `PointKeyframe` für Position. Das Adobe-Sample `sample-panels/premiere-api/src/keyframe.ts` greift über Indizes zu: `getComponentAtIndex(1).getParam(1)`. Welcher Index genau „Scale“ bzw. „Position“ ist, ist nicht dokumentiert [EINSCHÄTZUNG]. | 25.6 |
| Captions / Untertitel | `Sequence.getCaptionTrack`, `CaptionTrack` (Name, Mute, Items lesen). **Keine dokumentierte Möglichkeit, eine Caption-Spur aus SRT anzulegen.** In ExtendScript gibt es dafür `sequence.createCaptionTrack(projectItem, startAtTime, [format])` [BELEGT, ppro-scripting]. | 25.6 |
| Export | `EncoderManager.exportSequence(sequence, ExportType.IMMEDIATELY \| QUEUE_TO_AME, outputFile, presetFile (.epr), exportFull)`, `encodeFile`, `encodeProjectItem`, `launchEncoder`, `startBatchEncode` (26.3); `Exporter.exportSequenceFrame` (Standbild) | 25.6 / 26.3 |
| Transkription | `Transcript.transcribeClipProjectItem(clip, {language})`, `querySupportedLanguages`, `hasTranscript` (26.3), `isLanguagePackAvailable` (26.5), `exportToJSON`, `importFromJSON`, `createImportTextSegmentsAction` | 25.6+ |
| Interchange-Export | `ProjectConverter.exportAsFinalCutProXML`, `exportAsOpenTimelineIO` (26.2), `exportAAF` (26.3) | 26.2 / 26.3 |
| Sonstiges | `SequenceUtils.performSceneEditDetectionOnSelection`, `WorkAreaUtils` (26.5), MOGRT einfügen (`insertMogrtFromPath`), `EventManager` | – |

**Was gegenüber ExtendScript/QE fehlt bzw. nicht dokumentiert ist:**
- Rasierklinge
- Captions aus Datei erzeugen
- Direkter Zugriff über Parameter-Namen: nur über Indizes und `displayName`

Hyper Brew schreibt dazu (Blog vom 2026-03-31): „Most APIs are stable. Some are still missing.“ [COMMUNITY]. Eine **offizielle Liste mit Lücken gibt es nicht**. Die Migration-Guides in der Doku sind noch Platzhalter („Stuff goes here...“) [BELEGT, Repo-Stand 2026-09-21].

**Plugin-Arten [BELEGT, panels-and-commands]:**
- Panels sind „Non-blocking: users can interact with both the panel and Premiere simultaneously“ und haben Lifecycle-Hooks.
- Commands laufen einmal durch und beenden sich. Modale Dialoge blockieren Premiere.
- Das Panel muss geöffnet sein, damit es Befehle annehmen kann. Ob es beim Start von Premiere automatisch geladen wird, ist nicht dokumentiert [EINSCHÄTZUNG, prüfen].

### 2.2 After Effects

- **UXP gibt es noch nicht.** Adobe kündigt „Public beta UXP plugins by November 2026“ an [BELEGT, Blog 2026/09]. Im Doku-Repo `AdobeDocs/uxp-after-effects` (angelegt 2026-09-23) liegen nur Template-Platzhalter [BELEGT].
- **ExtendScript** ist der Weg, der heute funktioniert:
  - `afterfx.exe -r c:\pfad\script.jsx`. Adobe schreibt: „does not open a new instance … it runs the script in the existing instance“.
  - `afterfx.exe -s "code"` führt Code direkt aus.
  - Damit Skripte Dateien schreiben und aufs Netzwerk zugreifen dürfen, muss der Nutzer in den Voreinstellungen „Allow Scripts To Write Files And Access Network“ aktivieren [BELEGT, ae-scripting.docsforadobe.dev].
- **aerender** [BELEGT, Helpx per Archiv]:
  - Liegt im selben Ordner wie die App. Laut Helpx unter Windows `\Program Files\Adobe\Adobe After Effects CC\Support Files`, die Ordnerbenennung dort ist veraltet.
  - Argumente: `-project`, `-comp`, `-rqindex`, `-output`, `-OMtemplate`, `-RStemplate`, `-s`/`-e`/`-i`, `-mem_usage`, `-mfr ON|OFF max_cpu`, `-reuse`, `-close DO_NOT_SAVE_CHANGES|SAVE_CHANGES|DO_NOT_CLOSE`, `-log`, `-v ERRORS|ERRORS_AND_PROGRESS`, `-sound`, `-continueOnMissingFootage`, `-version`.
  - Standardmäßig startet aerender eine **neue** AE-Instanz. Mit `-reuse` rendert die bereits laufende.
  - Es gibt eigene Render-Only-Nodes über die Datei `ae_render_only_node.txt`.
- **CEP für AE** ist bis 12/2028 unbedenklich [BELEGT, Blog]. adb-mcp nutzt für AE ein CEP-Panel, das per Symlink nach `…\Adobe\CEP\extensions` eingebunden wird [BELEGT, Repo].

### 2.3 Photoshop

- **Versionen:** 26.0 = Okt 2024 (PS 2025), 27.2 = Dez 2025, 27.4 = Feb 2026 [BELEGT, PS-UXP-Changelog]. Daraus folgt: **PS 2026 = 27.x** [EINSCHÄTZUNG, aus den Daten abgeleitet].
- **UXP plus batchPlay:**
  - Alle Änderungen müssen in `require("photoshop").core.executeAsModal(fn, {commandName})` laufen.
  - Während ein Plugin modal arbeitet, zeigt PS einen Fortschrittsbalken und der Nutzer kann nichts bedienen. Ausnahme: der „Interactive Mode“ (ab 23.3).
  - Der Nutzer kann mit Esc abbrechen. Code sollte deshalb regelmäßig `isCancelled` abfragen.
  - Ab 25.10 wird gewartet, wenn ein anderes Plugin gerade modal ist (Timeout, Standard 1 s) [BELEGT, executeAsModal-Doku].
  - `batchPlay` entspricht `executeAction` aus ExtendScript und nimmt ein Array von Deskriptoren [BELEGT].
- **ExtendScript/COM:** Die Helpx-Seite „Scripting in Photoshop“ (zuletzt aktualisiert 2025-12-23) beschreibt weiterhin JavaScript (`.js`/`.jsx` unter `Presets\Scripts`), COM/VBScript unter Windows und den Script Events Manager. Sie verweist zusätzlich auf UXP-Scripting [BELEGT]. Das gepflegte Projekt `photoshop-python-api` (letzter Push 2026-09-25) steuert PS per COM und nennt PS 2025 als getestet [BELEGT, README].
- **UXP-Scripts (`.psjs`):**
  - Keine Panel-Oberfläche, nur Dialoge.
  - Argumente lassen sich nicht übergeben. Ein Adobe-Mitarbeiter schrieb am 2023-07-24: „Passing arguments are currently impossible“. Der Workaround ist eine Config-Datei, die das Script per `fs` liest [COMMUNITY/Adobe-Staff im Forum].

---

## 3. Externe Steuerung aus MoinStudio (Node/Electron)

### 3.1 Architektur (empfohlen)

```
MoinStudio (Electron-Main)
  └─ Bridge-Server 127.0.0.1:<port>  (HTTP, optional WS; zufälliges Token)
        ▲  Polling / WS (Plugin ist Client)
        │
  UXP-Panel „MoinStudio Bridge“ in Premiere  ──> premierepro-API (lockedAccess / executeTransaction)
  UXP-Panel „MoinStudio Bridge“ in Photoshop ──> photoshop-API (executeAsModal / batchPlay)
  After Effects: MoinStudio startet AfterFX.exe -r job.jsx; das Ergebnis kommt als JSON-Datei zurück
```

- **Das Plugin muss Client sein** [BELEGT, Network-Recipe]. Zum Vergleich: adb-mcp betreibt einen Node-Proxy auf `http://localhost:3001` mit Socket.IO. Auf Windows nutzt es `transports: ["polling"]`, auf macOS `["websocket"]` [BELEGT, Code `uxp/pr/main.js`].
- **Netzwerk-Permission** [BELEGT, Manifest-Referenz]:
  - Eintrag in `manifest.json` (manifestVersion 5): `"requiredPermissions": { "network": { "domains": [ "https://…", "wss://…" ] } }` oder `"domains": "all"`.
  - Anfragen an Domains, die nicht gelistet sind, schlagen fehl.
  - Laut Recipe braucht das mindestens Premiere 25.6, UDT 2.2 und Manifest v5.
  - **`localhost` ist in der offiziellen Doku nicht ausdrücklich erwähnt.** Ein offenes Issue von 2022 berichtet „Permission denied“ trotz `"http://localhost:3000"` [COMMUNITY, AdobeDocs/uxp-photoshop#321]. adb-mcp verbindet sich erfolgreich mit `http://localhost:3001`, verwendet dafür aber **`"domains": "all"`** [BELEGT, Code].
  - Empfehlung: zuerst `"http://127.0.0.1:<port>"` testen und bei Fehlern auf `"all"` zurückfallen [EINSCHÄTZUNG].
  - Hinweis aus der Doku: „macOS restricts `http://`“. Unter Windows ist das kein Problem.
- **Bekannter Fehler:** Premiere unter Windows stürzt ab, wenn ein Plugin eine WebSocket-Verbindung öffnet (26.3.0.93, adb-mcp #32, Juli 2026). **Standard-Transport deshalb: HTTP-Long-Polling.** WebSocket nur über ein Feature-Flag einschalten [COMMUNITY].
- **Dateizugriff im Plugin:** `localFileSystem: "plugin" | "request" | "fullAccess"`. Absolute Pfade (`file:/C:/…`) gehen nur mit `"fullAccess"`. Das `fs`-Modul arbeitet pfadbasiert [BELEGT, Filesystem-Recipe]. Weil MoinStudio mit beliebigen Projektpfaden arbeitet, braucht das Plugin **`fullAccess`** [EINSCHÄTZUNG]. Die Installationswarnung fällt dadurch stärker aus.
- **Prozesse starten aus UXP:** `shell.openPath` / `openExternal` fragen den Nutzer um Erlaubnis. Parameter lassen sich nicht übergeben und Ausgaben nicht lesen [BELEGT]. Der Kanal läuft also immer von MoinStudio zum Plugin und nicht umgekehrt.

### 3.2 Alternativen

| Weg | App | Bewertung |
|---|---|---|
| CEP-Panel mit `--enable-nodejs` (Node im Panel kann selbst Server sein) und ExtendScript über `CSInterface.evalScript` | PR, AE, PS | Funktioniert heute und bietet QE-DOM-Zugriff. Es ist aber ein Auslaufmodell (siehe Kurzfazit). Unsignierte Panels brauchen `PlayerDebugMode` [BELEGT, CEP-12-Cookbook]. |
| `AfterFX.exe -r job.jsx` | AE | Einfach und offiziell. Rückgabe nur über Dateien. Welche Dialoge dabei erscheinen, ist unbekannt [EINSCHÄTZUNG]. |
| `Photoshop.exe job.jsx` bzw. COM `DoJavaScript` (z. B. über `winax` in Node oder über PowerShell/VBScript) | PS | Offiziell belegt ist COM/VBScript [BELEGT]. Das Starten per Kommandozeilen-Argument kommt aus der Community. Möglicherweise erscheint die Warnung „You should only run scripts from a trusted source“ [COMMUNITY]. |
| `BridgeTalk` | App ↔ App (ExtendScript) | Funktioniert nur zwischen Adobe-Apps. Für einen externen Node-Prozess hilft es nicht direkt [EINSCHÄTZUNG]. |
| Premiere-ExtendScript von außen | PR | Einen offiziell dokumentierten Kommandozeilen-Schalter wie `-r` gibt es für Premiere nicht [EINSCHÄTZUNG, keine Quelle gefunden]. Es braucht ein CEP-Panel. |

### 3.3 „Sichtbar steuern, Nutzer kann jederzeit übernehmen“ in Premiere

**Das geht am besten mit einem UXP-Panel.** Die Gründe:
- Die Aufrufe laufen asynchron und blockieren die Oberfläche nicht.
- Jede Änderung ist ein benannter Undo-Schritt (`executeTransaction(…, "MoinStudio: …")`).
- `lockedAccess` sorgt dafür, dass Aktionen und Nutzereingaben nicht durcheinandergeraten [BELEGT].

ExtendScript blockiert dagegen die Oberfläche [BELEGT]. MoinStudio sollte zusätzlich kleine Schritte mit Rückmeldung senden und einen „Pause/Abbrechen“-Befehl anbieten [EINSCHÄTZUNG].

In Photoshop ist das nur eingeschränkt möglich, weil `executeAsModal` die Bedienung sperrt. Kurze, einzelne Modal-Blöcke halten die Sperren klein [EINSCHÄTZUNG].

---

## 4. Plugin-Installation ohne Marketplace

**UXP (`.ccx`)** [BELEGT, Install- und Package-Doku]:
- Eine `.ccx`-Datei ist ein ZIP. Die UDT kann sie erzeugen („Package“). Bolt UXP kann das per `yarn ccx` [BELEGT, Bolt-UXP-README].
- **Eine digitale Signatur ist nicht nötig.**
- Der Host im Manifest muss für Produktivpakete **ein Objekt** sein, kein Array. Premiere: `"app": "premierepro"`, Photoshop: `"app": "PS"`.
- Pro Host entsteht eine eigene `.ccx`-Datei.
- **Installation per Doppelklick:** Die Creative Cloud Desktop App öffnet sich und zeigt eine Warnung, weil das Plugin nicht aus dem Marketplace stammt. Je nach Permissions (Network, FileSystem) „users may need to grant administrative privileges“.
- **Installation per Kommandozeile:** `"C:\Program Files\Common Files\Adobe\Adobe Desktop Common\RemoteComponents\UPI\UnifiedPluginInstallerAgent\UnifiedPluginInstallerAgent.exe" /install "<pfad>.ccx"`, außerdem `/remove <id>`, `/list all`, `/version`, `/help`. Laut Doku sind dafür „admin privileges may be required“.
- Adobe empfiehlt, die Host-App vor der Installation einmal gestartet zu haben.
- In Premiere erscheinen die Plugins unter **Window > UXP Plugins**.
- **UDT** ist nur für die Entwicklung gedacht und braucht den Developer Mode in UDT und in der App: in Premiere unter „Settings > Plugins > Enable Developer Mode“, danach Neustart [BELEGT, FAQ plus adb-mcp].

**CEP** [BELEGT, CEP-12-Cookbook]:
- Nutzer-Ordner: `C:\Users\<USER>\AppData\Roaming\Adobe\CEP\extensions`. Dafür sind keine Adminrechte nötig [EINSCHÄTZUNG].
- System-Ordner: `C:\Program Files (x86)\Common Files\Adobe\CEP\extensions` bzw. `C:\Program Files\Common Files\Adobe\CEP\extensions`. Dafür sind Adminrechte nötig.
- Unsignierte Panels: `HKEY_CURRENT_USER\Software\Adobe\CSXS.12`, Wert `PlayerDebugMode` vom Typ REG_SZ auf `"1"` setzen. Die Zahl hinter `CSXS.` hängt von der CEP-Version ab.
- Signieren mit ZXPSignCmd, das in `Adobe-CEP/CEP-Resources/ZXPSignCMD` liegt. Der Extension Manager ist End of Life. Drittanbieter-Tools: Anastasiy's Extension Manager, ZXPInstaller.

---

## 5. Projektaustausch ohne Scripting (Premiere)

| Format | Import in Premiere | Schnitte / Spuren | Marker | Motion-Keyframes (Zoom) | Übergänge | Titel | Quelle |
|---|---|---|---|---|---|---|---|
| **FCP7 XML (xmeml)** | **ja** (Datei > Importieren) | ja | **Sequenz-Marker ja** | **ja**: „basic motion and opacity effects, and motion and opacity keyframes“ | Dip to White/Black, Edge Wipe → Wipe, alle anderen → Cross Dissolve | Text-Generatoren werden zu Titeln | Helpx [BELEGT] |
| FCPXML (FCP X) | **nein**, nur per XtoCC-Konverter | – | – | – | – | – | Helpx [BELEGT] |
| OTIO (`.otio`) | ja (Datei > Importieren). Die UXP-API kann ab 26.2 auch exportieren. | ja, inkl. linearer Geschwindigkeit | Sequenz-Marker ja | **nicht genannt** | nicht genannt | – | Adobe-Community-Ankündigung [BELEGT/COMMUNITY]. Laut Adobe „some sequence settings may not transfer“. |
| EDL | Import möglich [EINSCHÄTZUNG, hier nicht geprüft] | nur eine Videospur, keine Keyframes (Einschränkung des Formats) | eingeschränkt | nein | Blenden eingeschränkt | nein | – |
| AAF | Premiere importiert AAF [EINSCHÄTZUNG]; UXP `exportAAF` ab 26.3 [BELEGT] | ja | eingeschränkt | eingeschränkt | – | – | – |

**Empfehlung: FCP7 XML (xmeml, Version 4 oder 5) aus MoinStudio erzeugen.**

- **Enthalten sein sollten:**
  - Clips mit `<file>`-Pfaden (`pathurl` als `file://localhost/C:/…`)
  - V/A-Spuren
  - Sequenz-Marker für Kapitel
  - Basic-Motion-Filter mit `<parameter>` „scale“/„center“ und `<keyframe>`-Einträgen für Zooms
- **Spezifikation:** Apple, „Final Cut Pro 7 XML Interchange Format“, https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/FinalCutPro_XML/ . Das Kapitel „Basics of Encoding“ verwendet `<xmeml version="5">` und beschreibt Effekt-Parameter mit Keyframes (`<when>`, `<value>`, Interpolation) [BELEGT]. Die genauen Motion-Parameter-IDs stehen im Anhang zu den Effekt-IDs und wurden hier nicht einzeln geprüft [EINSCHÄTZUNG].
- **Sicherster Weg zur Absicherung:** Nach der Installation in Premiere von Hand einen Zoom mit Markern bauen, über `ProjectConverter.exportAsFinalCutProXML` (26.2) oder das Menü exportieren und die Struktur als **Golden File** übernehmen [EINSCHÄTZUNG].
- **Import automatisieren:** über das UXP-Plugin mit `project.importFiles([xmlPath], true)`. Ob `importFiles` ein XML als Sequenz importiert, ist **nicht dokumentiert** und muss geprüft werden [EINSCHÄTZUNG]. Alternativ importiert der Nutzer von Hand.
- **OTIO** eignet sich als Zweitformat für DaVinci Resolve, aber nicht für Zooms, weil Keyframes dort nicht dokumentiert sind.
- Captions als SRT neben der Sequenz ablegen. Der Nutzer importiert sie, oder das CEP/ExtendScript-Fallback nutzt `createCaptionTrack`.

---

## 6. Erkennung installierter Adobe-Apps (Windows)

| Datenpunkt | Wert | Status |
|---|---|---|
| Premiere-Beta-exe (Beispiel aus der Adobe-Doku 26.5, `host.applicationPath`) | `C:\Program Files\Adobe\Adobe Premiere Pro (Beta)\Adobe Premiere Pro (Beta).exe` | [BELEGT] |
| Premiere-Release-exe | `C:\Program Files\Adobe\Adobe Premiere Pro 2025\Adobe Premiere Pro.exe`. Für 2026 lautet der Ordner **entweder** „Adobe Premiere Pro 2026“ **oder** „Adobe Premiere 2026“, weil das Produkt umbenannt wurde. | [EINSCHÄTZUNG], deshalb mit Glob suchen |
| Photoshop | `C:\Program Files\Adobe\Adobe Photoshop 20xx\Photoshop.exe` (Community-Beispiel mit „2022“) | [COMMUNITY] |
| After Effects | `C:\Program Files\Adobe\Adobe After Effects 20xx\Support Files\AfterFX.exe` und `aerender.exe`. Helpx nennt „…\Adobe After Effects CC\Support Files“. | teilweise [BELEGT], Jahresordner [EINSCHÄTZUNG] |
| Registry | `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\Adobe Premiere Pro.exe` (bzw. `Photoshop.exe`, `AfterFX.exe`), außerdem die Uninstall-Schlüssel unter `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*` (DisplayName/DisplayVersion) | [COMMUNITY/EINSCHÄTZUNG] |
| Versionsschema | Premiere: 2025 = 25.x, 2026 = 26.x. AE: 2025 = 25.x (CEP-Tabelle: AEFT 25.0), 2026 = 26.x [EINSCHÄTZUNG]. **Photoshop ist um eins verschoben: 2025 = 26.x, 2026 = 27.x.** | PR/PS [BELEGT] über die Changelogs, AE 2026 [EINSCHÄTZUNG] |
| Laufende Prozesse | `Adobe Premiere Pro.exe`, `Photoshop.exe`, `AfterFX.exe` | [EINSCHÄTZUNG] |
| UXP-Plugins | `UnifiedPluginInstallerAgent.exe /list all` | [BELEGT] |
| CEP-Unterstützung | Registry `HKCU\Software\Adobe\CSXS.<n>` | [BELEGT] |

**Vorgehen beim Erkennen:**
1. `C:\Program Files\Adobe\*` nach `Adobe Premiere*`, `Adobe Photoshop*` und `Adobe After Effects*` durchsuchen (Glob).
2. Die `FileVersion` der exe auslesen.
3. App-Paths- und Uninstall-Schlüssel gegenprüfen.
4. Beta-Versionen erkennen und markieren.

Die Version wird **immer aus der exe gelesen, nie aus dem Ordnernamen**.

---

## 7. Photoshop-Thumbnails per UXP/batchPlay

| Schritt | API | Status |
|---|---|---|
| Dokument anlegen / öffnen | `app.documents.add({width,height,resolution,mode,fill})`, `app.open(entry)` (23.0) | [BELEGT, PS-Referenz] |
| PNG als Ebene platzieren (Smart Object) | batchPlay `placeEvent` („Place“ steht in den Event-Codes). Der Deskriptor braucht ein Session-Token aus `localFileSystem.createSessionToken(entry)`. | Event [BELEGT], Deskriptor-Aufbau [EINSCHÄTZUNG] → mit dem Alchemist-Plugin oder „Copy as JavaScript“ aus dem Actions-Panel mitschneiden |
| Smart Object erkennen | `Constants.LayerKind.SMARTOBJECT` | [BELEGT] |
| Ebene transformieren | `layer.scale()`, `translate()`, `rotate()`, `bringToFront()` | [BELEGT] |
| Text | `document.createTextLayer(TextLayerCreateOptions)` (ab 24.2); `layer.textItem.characterStyle` (Schrift, Größe, Farbe) | [BELEGT] |
| **Kontur (Stroke) am Text** | Kein DOM-Aufruf gefunden. Lösung: batchPlay `set` auf `layerEffects` (Ebenenstil „Kontur“) | [EINSCHÄTZUNG], Deskriptor mitschneiden |
| Export | `document.saveAs.png(entry, PNGSaveOptions, asCopy)`, `saveAs.jpg(entry, {quality}, asCopy)`, `saveAs.psd(...)` | [BELEGT] |
| Schließen | `document.closeWithoutSaving()` | [BELEGT] |

Alles läuft **in einem** `executeAsModal`-Block pro Thumbnail. Für ein sauberes Undo mit `document.suspendHistory` arbeiten [BELEGT: Methode vorhanden].

---

## 8. Bekannte Fallstricke

1. **Sandbox und Dateien (UXP):**
   - Ohne `fullAccess` sind nur `plugin-data:/`, `plugin-temp:/` und vom Nutzer gewählte Dateien erreichbar.
   - `fullAccess` bedeutet eine deutlichere Installationswarnung und laut Doku eventuell eine Admin-Abfrage [BELEGT].
   - UXP-Scripts (`.psjs`) haben laut Forum uneingeschränkten `fs`-Zugriff [COMMUNITY].
2. **Netzwerk:**
   - Das Plugin kann keinen Server öffnen.
   - Nicht gelistete Domains werden geblockt.
   - Ob `localhost`-Einträge funktionieren, ist unklar.
   - WebSocket führt in Premiere unter Windows zum Absturz (26.3). Details in Abschnitt 3.1.
3. **Threading und Locks (Premiere):**
   - Seit 26.3 müssen Actions innerhalb von `lockedAccess` erzeugt werden.
   - Properties sind synchron, Methoden meist asynchron. Einige Methoden wurden nachträglich synchron gemacht (`setSelection`, `Media.getDuration` in 26.5). **Die API verändert sich also noch.**
   - Die Premiere-Mindestversion im Manifest festlegen und die Versionen im Code abfragen [BELEGT, Changelog].
4. **Photoshop-Modalität:** Während `executeAsModal` ist die Bedienung gesperrt. Ist ein anderes Plugin modal, schlägt der Aufruf fehl bzw. läuft ab 25.10 in einen Timeout. `batchPlay` wirft seit 23.4.1 öfter Fehler, deshalb immer try/catch [BELEGT, Known Issues].
5. **Developer Mode** braucht man nur für UDT. Endnutzer installieren `.ccx` [BELEGT].
6. **Premiere-ExtendScript** läuft laut Guide nur bis 09/2026. Adobe schreibt aber auch „ExtendScripts are not affected“ durch die CEP-Abkündigung. **Das ist widersprüchlich, also nicht darauf bauen.**
7. **AE-Skripte:** Die Einstellung „Allow Scripts To Write Files And Access Network“ muss aktiv sein. Ohne sie kann MoinStudio keine Ergebnisdateien zurückbekommen [BELEGT].
8. **PS-JSX per Kommandozeile:** Es kann ein Sicherheitsdialog („trusted source“) erscheinen. Argumente nur über Dateien übergeben [COMMUNITY].
9. **Lizenz / Bedingungen:**
   - Die Adobe-Beispiele tragen Lizenz-Header, die auf die jeweilige Lizenzvereinbarung verweisen. Keinen Code ungeprüft übernehmen [BELEGT: Header in `keyframe.ts`].
   - Die Adobe Developer Terms und die Marketplace-Review-Guidelines (`plugins/distribution/review-guidelines`) vor einer Weitergabe lesen. **Der Inhalt der Developer Terms wurde hier nicht geprüft** (Seite nicht abrufbar).
   - Bolt UXP, Bolt CEP und adb-mcp stehen unter MIT-Lizenz [BELEGT: adb-mcp].
   - Gegenüber dem Nutzer nicht so auftreten, als sei MoinStudio „von Adobe“.
10. **Pflegezustand der Open-Source-Projekte (Stand 2026-09-26):**

    | Projekt | Letzter Push | Einordnung |
    |---|---|---|
    | adb-mcp | 2026-07-08 | MIT, Proof of Concept |
    | leancoderkavy/premiere-pro-mcp | 2026-09-26 | CEP-Bridge plus optional UXP, sehr umfangreich |
    | Bolt UXP | 2026-09-14 | – |
    | Bolt CEP | 2026-06-28 | – |
    | photoshop-python-api | 2026-09-25 | – |
    | **pymiere** | **2025-03-05** | nutzt CEP/ExtendScript, **nicht mehr gepflegt → nicht verwenden** |

---

## 9. Entwurf der Modulschnittstelle `adobe/`

```ts
// adobe/types.ts
export type AdobeApp = "premiere" | "photoshop" | "aftereffects";

export interface InstalledApp {
  app: AdobeApp;
  exePath: string;
  version: string;          // aus der exe-FileVersion, z. B. "26.5.0"
  marketingYear?: number;   // 2025/2026 – abgeleitet, nicht verlässlich
  isBeta: boolean;
  running: boolean;
}

export interface Capabilities {
  uxpBridge: boolean;       // Plugin installiert und verbunden
  uxpApiVersion?: string;   // vom Plugin gemeldet (host.version)
  cepAvailable: boolean;    // CSXS.<n> vorhanden
  extendScriptCli: boolean; // AE: AfterFX.exe -r
  aerender?: string;        // Pfad zu aerender.exe
}

export interface RunOptions {
  dryRun?: boolean;         // nichts ausführen, nur Plan/Payload zurückgeben
  timeoutMs?: number;
  signal?: AbortSignal;     // Nutzer übernimmt → abbrechen
}

export interface Planned<T = unknown> {
  dryRun: boolean;
  steps: Array<{ app: AdobeApp; method: string; payload: unknown; transport: "uxp-http" | "cli" | "file" }>;
  result?: T;
  warnings: string[];
}

export type Tick = string; // Premiere TickTime als String (254016000000 Ticks/s) [prüfen]

// adobe/index.ts
export interface AdobeModule {
  detect(): Promise<InstalledApp[]>;
  capabilities(app: AdobeApp): Promise<Capabilities>;
  connect(app: "premiere" | "photoshop", opts?: { port?: number; transport?: "poll" | "ws" }): Promise<BridgeSession>;
  installPlugin(ccxPath: string, opts?: RunOptions): Promise<Planned<{ exitCode: number }>>; // UPIA /install

  premiere: {
    openProject(path: string, o?: RunOptions): Promise<Planned>;
    createProject(path: string, o?: RunOptions): Promise<Planned>;
    importFiles(paths: string[], o?: RunOptions & { bin?: string }): Promise<Planned>;
    importTimeline(xmlPath: string, o?: RunOptions): Promise<Planned<{ sequenceName?: string }>>; // FCP7-XML
    createSequence(name: string, o?: RunOptions & { presetPath?: string }): Promise<Planned<{ sequenceId: string }>>;
    insertClip(a: { sequenceId: string; mediaPath: string; track: number; at: Tick; overwrite?: boolean }, o?: RunOptions): Promise<Planned>;
    trimClip(a: { sequenceId: string; track: number; clipIndex: number; inPoint?: Tick; outPoint?: Tick }, o?: RunOptions): Promise<Planned>;
    addMarker(a: { sequenceId: string; name: string; at: Tick; duration?: Tick; comment?: string; color?: string }, o?: RunOptions): Promise<Planned>;
    setMotionKeyframes(a: { sequenceId: string; track: number; clipIndex: number; keys: Array<{ at: Tick; scale?: number; position?: [number, number] }> }, o?: RunOptions): Promise<Planned>;
    transcribe(a: { mediaPath: string; language?: string }, o?: RunOptions): Promise<Planned<{ json?: string }>>;
    exportSequence(a: { sequenceId: string; outputPath: string; presetPath: string; viaAME?: boolean }, o?: RunOptions): Promise<Planned>;
    exportFcpXml(a: { sequenceId: string; outputPath: string }, o?: RunOptions): Promise<Planned>; // ab 26.2
  };

  photoshop: {
    composeThumbnail(spec: ThumbnailSpec, o?: RunOptions): Promise<Planned<{ outputPath: string }>>;
  };

  aftereffects: {
    runScript(jsxPath: string, args: Record<string, unknown>, o?: RunOptions): Promise<Planned<{ resultJson?: unknown }>>; // AfterFX.exe -r, Args/Result über JSON-Dateien
    renderTemplate(a: { projectPath: string; comp: string; outputPath: string; omTemplate?: string; rsTemplate?: string; replacements?: Record<string, string>; reuse?: boolean }, o?: RunOptions): Promise<Planned<{ exitCode: number; log: string }>>;
  };

  // Offline-Erzeuger, ohne Adobe testbar
  interchange: {
    buildFcp7Xml(timeline: MoinTimeline): string;
    validateFcp7Xml(xml: string): { ok: boolean; errors: string[] };
  };
}

export interface ThumbnailSpec {
  width: number; height: number; outputPath: string; format: "png" | "jpg"; jpgQuality?: number;
  layers: Array<
    | { kind: "image"; path: string; x: number; y: number; scale?: number; asSmartObject?: boolean }
    | { kind: "text"; text: string; font: string; size: number; color: string; x: number; y: number; stroke?: { size: number; color: string } }
  >;
}

export interface BridgeSession { app: AdobeApp; send<T>(method: string, payload: unknown, o?: RunOptions): Promise<T>; close(): Promise<void>; }
export interface MoinTimeline { fps: number; width: number; height: number; tracks: unknown[]; markers: unknown[] }
```

**Regeln für die Umsetzung [EINSCHÄTZUNG]:**
- `dryRun: true` gibt nur `steps` zurück, ohne Prozessstart und ohne Netzwerk. Das ist der Standardmodus in Tests und in der ersten Ausbaustufe.
- Jede Premiere-Mutation ist genau eine `executeTransaction` mit dem Präfix „MoinStudio:“ im Undo-Text.
- Der Bridge-Server lauscht nur auf `127.0.0.1` und verlangt ein Token pro Sitzung.
- Standard-Transport ist `poll`.

---

## 10. Annahmen, die nach der Installation zu prüfen sind

1. `localhost` / `127.0.0.1` in `network.domains` funktioniert, oder es geht nur mit `"all"` (PR und PS).
2. Tritt der WebSocket-Absturz in der installierten Premiere-Version (26.x) unter Windows noch auf? Funktioniert HTTP-Polling (`fetch`) zuverlässig?
3. `project.importFiles([fcp7.xml])` importiert das XML als Sequenz, ohne Dialog, wenn `suppressUI=true`.
4. Premiere übernimmt aus dem selbst erzeugten FCP7-XML Scale- und Center-Keyframes (Zoom) sowie Sequenz-Marker als Kapitel. Welche Marker-Farbe oder welcher Marker-Typ dabei entsteht, muss sich zeigen.
5. Index und `displayName` der Motion-Parameter (Scale, Position) in `getComponentChain()` sind in der deutschen UI stabil. Es wird nicht per Name über lokalisierte Strings gesucht.
6. Der Installationsordner und die exe-Namen für Premiere 2026 („Adobe Premiere Pro 2026“ oder „Adobe Premiere 2026“), Photoshop 2026 (27.x) und AE 2026. Außerdem die App-Paths-Registry-Einträge.
7. Wird das UXP-Panel nach einem Neustart automatisch geladen, wenn es im Workspace angedockt war?
8. Braucht UPIA `/install` Adminrechte? Welche Dialoge erscheinen bei `.ccx` mit `fullAccess` und `network: all`?
9. Unterstützt `EncoderManager.exportSequence(... IMMEDIATELY ...)` beliebige `.epr`-Presets? Ist Media Encoder dafür nötig?
10. Ist `transcribeClipProjectItem` für Deutsch („de-DE“) verfügbar, und muss das Sprachpaket installiert sein?
11. Läuft `AfterFX.exe -r` ohne Dialog, wenn AE schon offen ist? Was passiert, wenn AE nicht läuft (startet es dann)? Wirkt die Voreinstellung „Allow Scripts…“?
12. `aerender -reuse` gegenüber einer neuen Instanz: Lizenz-/Anmeldeverhalten und Laufzeit.
13. Erscheint bei `Photoshop.exe script.jsx` bzw. COM `DoJavaScript` ein Sicherheitsdialog? Lässt sich COM aus Node registrieren (`winax`)?
14. Die batchPlay-Deskriptoren für `placeEvent` (Smart Object) und für die Text-Kontur (`layerEffects`) funktionieren in PS 27.x.
15. Premiere-ExtendScript/CEP läuft in der installierten Version noch (Supportende laut Guide 09/2026).
16. Mit welchem Wert pro Sekunde rechnet `TickTime` (üblich sind 254016000000 Ticks/s)? Welche Hilfsfunktionen gibt es dafür (`TickTime.createWithSeconds`)?
17. Der Status der UXP-Public-Beta für AE (angekündigt bis 11/2026) nach Erscheinen.

---

## 11. Tests für `tests/adobe/`

**Ohne Adobe lauffähig (CI):**
- `detect.test.ts`: Dateisystem und Registry werden gemockt. Geprüft wird das Erkennen von Release und Beta, von „Premiere Pro 2026“ und „Premiere 2026“, das Einlesen der Version aus der exe, das PS-Schema 27.x = 2026 und das Verhalten, wenn nichts installiert ist.
- `fcp7xml.build.test.ts`: MoinTimeline wird zu xmeml. Geprüft werden Spuren, Clips (In/Out/Start/Ende in Frames), `pathurl` mit Windows-Pfaden, Umlauten und Leerzeichen, Marker, Scale/Center-Keyframes und Timebase/NTSC. Grundlage ist ein Snapshot gegen ein Golden File.
- `fcp7xml.validate.test.ts`: fehlerhafte Timelines (negative Dauer, überlappende Clips, fehlende Datei) liefern verständliche Fehler.
- `ticktime.test.ts`: Umrechnung Sekunden ↔ Frames ↔ Ticks bei 25, 29,97 und 60 fps.
- `dryrun.premiere.test.ts`: Jede `premiere.*`-Methode liefert mit `dryRun` den erwarteten Plan (Methode, Payload), ohne Netzwerk.
- `dryrun.photoshop.test.ts`: `composeThumbnail` erzeugt die erwarteten Schritte bzw. batchPlay-Deskriptoren (Snapshot).
- `aerender.args.test.ts`: Argumente werden korrekt gebaut und gequotet (`-project`, `-comp`, `-output`, `-OMtemplate`, `-RStemplate`, `-reuse`, `-close`, `-v ERRORS_AND_PROGRESS`), auch bei Pfaden mit Leerzeichen.
- `aftereffects.runScript.test.ts`: Die Job-JSX wird mit einem JSON-Args-Datei-Mechanismus erzeugt. Gegen Injection wird ohne String-Konkatenation des Nutzertexts im JSX-Code gearbeitet.
- `bridge.server.test.ts`: Der Server hört nur auf 127.0.0.1. Anfragen ohne Token werden abgewiesen. Long-Polling liefert Befehle der Reihe nach aus, Antworten werden zugeordnet, Timeout und Abbruch (AbortSignal) funktionieren.
- `bridge.protocol.test.ts`: Das Protokoll ist versioniert (`protocolVersion`), unbekannte Methoden liefern einen Fehler, und die Minimalversion wird geprüft (Premiere < 25.6 → Fehlermeldung).
- `manifest.test.ts`: Die UXP-Manifeste (PR/PS) haben manifestVersion 5, `host` ist ein Objekt (nicht Array), die IDs sind eindeutig, die Permissions sind so klein wie möglich, und `minVersion` ist gesetzt (PR ≥ 25.6.0).
- `upia.args.test.ts`: Der UPIA-Aufruf wird gebaut (`/install`, `/remove`, `/list all`), mit Dry-Run.

**Nur mit Adobe (manuell/opt-in, `ADOBE_E2E=1`, auf Windows-Rechner mit Installation):**
- `e2e.premiere.import-xml.test.ts`: Golden-XML importieren, dann Sequenz-Dauer, Anzahl Marker und Scale-Keyframes über die UXP-Bridge zurücklesen.
- `e2e.premiere.markers-export.test.ts`: Marker setzen, Undo-Eintrag prüfen, Export mit Preset starten und prüfen, dass die Datei existiert.
- `e2e.premiere.transport.test.ts`: Polling gegenüber WebSocket. Darf nicht abstürzen (Regression zu adb-mcp #32).
- `e2e.photoshop.thumbnail.test.ts`: Thumbnail mit 2 PNG-Ebenen und Text mit Kontur erzeugen. PNG und JPG existieren und haben die erwarteten Maße.
- `e2e.aftereffects.render.test.ts`: Template-Projekt über `aerender` rendern. Exit-Code 0, die Ausgabedatei existiert.
- `e2e.install.test.ts`: `.ccx` per UPIA installieren, `/list all` enthält die ID, danach wieder `/remove`.

---

## 12. Quellenliste (alle abgerufen 2026-09-26)

- Premiere UXP Changelog: https://developer.adobe.com/premiere-pro/uxp/changelog/
- Premiere UXP Referenz (Quellcode der Doku): https://github.com/AdobeDocs/uxp-premiere-pro (Commit 2026-09-21), dort `src/pages/ppro-reference/classes/*.md`, `resources/recipes/network`, `resources/recipes/filesystem-operations`, `resources/recipes/external-process`, `plugins/concepts/manifest`, `plugins/concepts/panels-and-commands`, `plugins/distribution/{install,package,independent-distribution}`
- Premiere UXP Samples: https://github.com/AdobeDocs/uxp-premiere-pro-samples (Commit 2026-09-22), `sample-panels/premiere-api/src/keyframe.ts`
- Adobe-Blog CEP→UXP-Zeitplan (09/2026): https://blog.developer.adobe.com/en/publish/2026/09/investing-in-the-future-of-creative-cloud-extensibility-uxp-comes-to-our-flagship-applications
- Adobe-Blog UXP Hub (09/2026): https://blog.developer.adobe.com/en/publish/2026/09/introducing-the-uxp-hub
- Premiere Pro Scripting Guide (ExtendScript): https://ppro-scripting.docsforadobe.dev/ und https://ppro-scripting.docsforadobe.dev/sequence/sequence/
- After Effects Scripting Guide: https://ae-scripting.docsforadobe.dev/introduction/overview/
- aerender (Helpx, über Archiv-Snapshot 2026-05-27): https://helpx.adobe.com/after-effects/using/automated-rendering-network-rendering.html
- AE-UXP-Doku-Repo (Platzhalter): https://github.com/AdobeDocs/uxp-after-effects
- Photoshop UXP Doku-Repo: https://github.com/AdobeDocs/uxp-photoshop (Commit 2026-08-15), `ps-reference/changelog`, `classes/document.md`, `known-issues`, `media/eventcodes.md`
- Photoshop executeAsModal: https://developer.adobe.com/photoshop/uxp/2022/ps_reference/media/executeasmodal/
- Photoshop UXP Scripting: https://developer.adobe.com/photoshop/uxp/2022/scripting/
- Photoshop Scripting (Helpx, Stand 2025-12-23, Archiv-Snapshot 2026-01-30): https://helpx.adobe.com/photoshop/using/scripting.html
- Forum `.psjs` ohne Argumente: https://forums.creativeclouddeveloper.com/t/run-script-using-cmd-with-parameters/6548
- Issue localhost-Permissions: https://github.com/AdobeDocs/uxp-photoshop/issues/321
- PS-WebSocket-Sample: https://github.com/AdobeDocs/uxp-photoshop-plugin-samples/tree/main/io-websocket-example
- CEP 12 Cookbook und ZXPSignCmd: https://github.com/Adobe-CEP/CEP-Resources
- FCP-XML-Import in Premiere (Helpx, Stand 2023-09-25, Archiv-Snapshot 2026-01-23): https://helpx.adobe.com/premiere-pro/using/importing-xml-project-files-final.html
- Apple FCP7 XML Interchange Format: https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/FinalCutPro_XML/Basics/Basics.html
- OTIO in Premiere: https://community.adobe.com/announcements-732/now-released-otio-import-and-export-311699
- adb-mcp (MIT): https://github.com/mikechambers/adb-mcp, Issue #32: https://github.com/mikechambers/adb-mcp/issues/32
- premiere-pro-mcp: https://github.com/leancoderkavy/premiere-pro-mcp
- Bolt UXP: https://github.com/hyperbrew/bolt-uxp · Bolt CEP: https://github.com/hyperbrew/bolt-cep · Hyper Brew Blog: https://hyperbrew.co/blog/uxp-plugins-in-premiere-2026/
- photoshop-python-api: https://github.com/loonghao/photoshop-python-api · pymiere: https://github.com/qmasingarbe/pymiere
- PS-JSX per Kommandozeile (Community): https://community.adobe.com/t5/photoshop-ecosystem-discussions/run-a-jsx-file-through-a-bat-file/td-p/12715573
- Umbenennung in „Adobe Premiere“ (nur Sekundärquelle): https://en.wikipedia.org/wiki/Adobe_Premiere_Pro
