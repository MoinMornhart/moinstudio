import { useEffect, useState } from "react";
import type { SchnittEffekt, SchnittProjekt } from "@shared/app";

const BEISPIELE = [
  "Mach mir ein geiles Intro",
  "Zeitlupe, wenn der Creeper explodiert",
  "Mehr Action!",
  "Schreib WAS?! drauf, wenn ich erschrecke",
  "Am Ende schwarz ausblenden",
  "Nimm die Stelle mit den Fackeln raus",
];

const zeit = (s: number): string =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const zahl = (x: unknown): string =>
  typeof x === "number"
    ? String(Math.round(x * 100) / 100).replace(".", ",")
    : "";

/** Effekt in einfachen Worten (für Philip) */
export function effektText(e: SchnittEffekt): string {
  switch (e.art) {
    case "tempo":
      return (e["faktor"] as number) < 1
        ? `Zeitlupe (×${zahl(e["faktor"])})`
        : `Zeitraffer (×${zahl(e["faktor"])})`;
    case "einfrieren":
      return `Standbild ${zahl(e["dauer"])} s`;
    case "zoom":
      return `Zoom ×${zahl(e["faktor"])}`;
    case "wackeln":
      return "Wackeln";
    case "farbe":
      return `Farbe: ${[e["schwarzweiss"] ? "Schwarzweiß" : "", typeof e["ton"] === "string" ? e["ton"] : "", e["saettigung"] !== undefined ? `Sättigung ${zahl(e["saettigung"])}` : "", e["kontrast"] !== undefined ? `Kontrast ${zahl(e["kontrast"])}` : ""].filter(Boolean).join(", ") || "angepasst"}`;
    case "blitz":
      return e["farbe"] === "schwarz" ? "Schwarzer Blitz" : "Blitz";
    case "uebergang":
      return e["farbe"] === "weiss" ? "Weiße Blende" : "Abblende";
    case "abblende":
      return e["richtung"] === "ein" ? "Einblenden" : "Ausblenden";
    case "text":
      return `Text „${String(e["text"] ?? "")}“`;
    case "bild":
      return "Bild-Einblendung";
    case "geraeusch":
      return `Geräusch: ${String(e["klang"] ?? "")}`;
    case "zensur":
      return "Zensur mit Piep";
    case "lautstaerke":
      return `Lautstärke ×${zahl(e["faktor"])}`;
    case "intro": {
      const teile =
        (e["teile"] as { art: string; text?: string }[] | undefined) ?? [];
      const karte = teile.find((t) => t.art === "karte");
      return `Intro: ${teile.filter((t) => t.art === "clip").length} Momente${karte ? ` + Titelkarte „${karte.text}“` : ""}`;
    }
    default:
      return e.art;
  }
}

function effektZeit(e: SchnittEffekt): {
  text: string;
  springen: number | null;
} {
  if (e.art === "intro") return { text: "vor dem Video", springen: null };
  if (typeof e.von === "number" && typeof e.bis === "number")
    return { text: `${zeit(e.von)}–${zeit(e.bis)}`, springen: e.von };
  if (typeof e.bei === "number") return { text: zeit(e.bei), springen: e.bei };
  return { text: "", springen: null };
}

/** „Was soll passieren?“ – Schnitt und Effekte in Worten (ROADMAP E.4/E.5) */
export function WunschFeld({
  p,
  neuLaden,
}: {
  p: SchnittProjekt;
  neuLaden: () => void;
}): React.JSX.Element {
  const [wunsch, setWunsch] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const senden = (text: string): void => {
    if (!text.trim()) return;
    setFehler(null);
    window.moin.schnittWunsch(p.id, text).then(
      () => {
        setWunsch("");
        neuLaden();
      },
      (e: unknown) => setFehler(e instanceof Error ? e.message : String(e)),
    );
  };
  const laeuft = !!p.auftrag && p.auftrag.state !== "failed";
  return (
    <div className="wunsch-feld">
      <h2>Was soll passieren?</h2>
      <p className="muted small">
        Schreib einfach, was du willst: schneiden, Effekte, Intro, Texte,
        Geräusche. Claude setzt es um, danach entsteht die Vorschau von selbst.
      </p>
      <div className="row" style={{ marginTop: 6 }}>
        <input
          className="input"
          placeholder="z. B. mach mir ein geiles Intro"
          value={wunsch}
          disabled={laeuft}
          onChange={(e) => setWunsch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && senden(wunsch)}
        />
        <button
          className="btn primary"
          disabled={!wunsch.trim() || laeuft}
          onClick={() => senden(wunsch)}
        >
          Los
        </button>
      </div>
      <div className="wunsch-beispiele">
        {BEISPIELE.map((b) => (
          <button
            key={b}
            className="chip"
            disabled={laeuft}
            onClick={() => setWunsch(b)}
          >
            {b}
          </button>
        ))}
      </div>
      {laeuft && (
        <p className="muted small claude-laeuft">
          <span className="spinner" aria-hidden="true" />
          {p.auftrag?.step || "Läuft …"}
        </p>
      )}
      {!laeuft && p.antwort && (
        <p className="wunsch-antwort">
          <span className="muted small">„{p.antwort.wunsch}“</span>
          <span>{p.antwort.text}</span>
        </p>
      )}
      {fehler && <p className="warn small">{fehler}</p>}
    </div>
  );
}

/** Effektliste unter dem fertigen Schnitt: ansehen, hinspringen, an/aus, löschen (ROADMAP E.5) */
export function EffektListe({
  p,
  springe,
  neuLaden,
}: {
  p: SchnittProjekt;
  springe: (s: number) => void;
  neuLaden: () => void;
}): React.JSX.Element | null {
  const [liste, setListe] = useState<SchnittEffekt[]>([]);
  useEffect(() => {
    if (!p.auftrag) void window.moin.schnittEffekte(p.id).then(setListe);
  }, [p.id, p.auftrag, p.antwort?.zeit]);
  if (!liste.length) return null;
  const aendern = (i: number, a: { aus: boolean } | null): void =>
    void window.moin.schnittEffektAendern(p.id, i, a).then((l) => {
      setListe(l);
      neuLaden();
    });
  return (
    <div className="effekt-liste">
      <div
        className="row"
        style={{
          marginTop: 0,
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <strong>Effekte ({liste.filter((e) => !e.aus).length})</strong>
        <span className="muted small">Nach Änderungen „Vorschau rendern“</span>
      </div>
      {liste
        .map((e, i) => ({ e, i, z: effektZeit(e) }))
        .sort((a, b) => (a.z.springen ?? -1) - (b.z.springen ?? -1))
        .map(({ e, i, z }) => {
          return (
            <div key={i} className={`effekt${e.aus ? " aus" : ""}`}>
              <button
                className="satz"
                disabled={z.springen === null}
                onClick={() => z.springen !== null && springe(z.springen)}
              >
                <span className="muted small">{z.text}</span>
                <span>{effektText(e)}</span>
              </button>
              <span className="row" style={{ marginTop: 0 }}>
                <button
                  className="btn small"
                  onClick={() => aendern(i, { aus: !e.aus })}
                >
                  {e.aus ? "an" : "aus"}
                </button>
                <button
                  className="btn small"
                  aria-label="Effekt löschen"
                  onClick={() => aendern(i, null)}
                >
                  ✕
                </button>
              </span>
            </div>
          );
        })}
    </div>
  );
}
