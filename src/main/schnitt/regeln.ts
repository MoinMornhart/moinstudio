/**
 * Schnitt-Regeln je Videotyp (Philip, 05.10.: Recherche zu Reaction- und Gaming-Schnitt, freigegeben mit Pausen
 * Reaction 0,5 s / Gaming 0,6 s). Den Typ wählt Philip per Knopf nach dem Hochladen – die KI rät ihn nicht.
 * Die Handcam ist fest im Bild: Reaktionen werden über Zooms, Freezes und Replays des ganzen Bildes betont.
 */

export const VIDEO_TYPEN = ['reaction', 'gaming'] as const
export type VideoTyp = (typeof VIDEO_TYPEN)[number]

export const KANAELE = ['MoinMornhart', 'MoinMorni'] as const

const GEMEINSAM = `Gemeinsame Regeln (Recherche erfolgreicher Creator):
- Hook 0–15 s: Cold Open mit dem besten Moment (2–5 s), dann ein Satz, der das Versprechen von Titel/Thumbnail bestätigt,
  dann direkt Inhalt. Kein Logo-Intro, kein „Hallo Leute“ vor Sekunde 10.
- Rhythmus: in den ersten 3 Minuten alle 10–20 s eine sichtbare Veränderung (Zoom, Text, Sound), danach alle 25–40 s.
  Erstes bewusstes Element bei 25–35 s. Etwa alle 2 Minuten auf etwas Kommendes vorgreifen.
- Fast nur harte Schnitte; höchstens kurze Whip-/Zoom-Übergänge (0,2–0,4 s) mit Whoosh.
- Sounds framegenau auf die Bildänderung, nie lauter als ~3 dB über der Stimme, denselben Sound nicht ständig.
- Text 1–4 Wörter, mindestens 0,7 s sichtbar, nie in den unteren 12 % (Player-Leiste).
- Abo-Hinweis erst nach dem ersten Höhepunkt (30–90 s) oder am Ende, unter 3 s – nie im Hook.
- Kein „Das war's“-Outro; der Inhalt läuft bis zum Ende, die Endcard liegt in den letzten 5–20 s.`

const REACTION = `Videotyp REACTION (Streaming-Highlight, Philip reagiert auf ein Video; Handcam ist fest im Bild):
- Nach spätestens 15–30 s Original muss eine Reaktion kommen – lange Original-Passagen ohne Kommentar kürzen.
  Ziel 40–50 % Kommentar (schützt auch vor YouTubes Regel gegen wiederverwendete Inhalte).
- Reaktion betonen: erst den Auslöser zeigen, dann die Reaktion mit schnellem Zoom (110–130 %), bei Bedarf
  Vine-Boom oder kurzer Freeze; starke Momente als Replay.
- Stream-Leerlauf rigoros raus: Chat vorlesen ohne Pointe, Warten, Laden, Werbung, „ich schau mir das jetzt an“.
- Meme-/Text-Einblendungen höchstens etwa eine alle 20–30 s.`

const GAMING = `Videotyp GAMING (Minecraft oder andere Spiele; Handcam fest im Bild):
- Highlights: Lautstärkespitzen in Stimme und Spiel; bei Minecraft zählen Gespräche, Lachen, „Nein!“, Fluchen oft mehr.
- Pro Highlight 3–8 s Vorlauf, der Moment, 1–3 s Reaktion. Farmen, Bauen, Laufen raffen.
- Zoom-Punch 115–150 % in 2–4 Frames mit Boom/Whoosh, höchstens alle 10–20 s.
- Zeitlupe (25–50 %) beim entscheidenden Moment, Replay bei Fails und Kills, Freeze mit Text vor einem Fail.
- Story statt Liste: Ziel in den ersten 15 s, Zwischenstände als Text („Tag 3“, „2/5 Diamanten“), Finale am Ende.`

/** Regeltext für Claude-Aufträge (Rohschnitt, Wünsche, Highlights) */
export function regelText(typ: VideoTyp | undefined): string {
  return `${GEMEINSAM}\n\n${typ === 'reaction' ? REACTION : GAMING}`
}

export const typName = (typ: VideoTyp | undefined): string => (typ === 'reaction' ? 'Reaction' : 'Gaming')
