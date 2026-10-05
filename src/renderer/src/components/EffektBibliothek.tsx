import { useEffect, useState } from "react";
import type { BibChroma, BibEffektDaten, BibLage } from "@shared/app";
import { Card } from "./Panel";

/**
 * Effekt-Bibliothek (Philip, 05.10.): eigene Effekte anlegen – Abo-Animation, Vine-Boom, Meme-Einblendung … – aus
 * Video mit Transparenz, Greenscreen-Video, Bild und/oder Sound. Alles per Knopf: wie oft, in welchem Kanal und
 * Videotyp, wann und wo im Bild. Greenscreen wird mit FFmpeg entfernt, Regler und Pipette mit Live-Vorschau.
 */

type Entwurf = Omit<BibEffektDaten, "erstellt"> & { erstellt?: string };

const STANDARD_CHROMA: BibChroma = {
  farbe: "#00ff00",
  toleranz: 0.3,
  weichheit: 0.1,
  spill: 0.5,
};
const neuerEntwurf = (): Entwurf => ({
  id: "",
  name: "",
  haeufigkeit: { modus: "manuell" },
  kanaele: ["MoinMornhart", "MoinMorni"],
  typen: ["reaction", "gaming"],
  platzierung: { modus: "ki" },
  lage: "unten-rechts",
  groesse: 0.35,
});

const RASTER: BibLage[] = [
  "oben-links",
  "oben",
  "oben-rechts",
  "links",
  "mitte",
  "rechts",
  "unten-links",
  "unten",
  "unten-rechts",
];
const fehlerText = (e: unknown): string =>
  e instanceof Error
    ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "")
    : String(e);

function Knopf({
  an,
  onClick,
  children,
  disabled,
}: {
  an: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}): React.JSX.Element {
  return (
    <button
      type="button"
      className={`kanal-knopf${an ? " on" : ""}`}
      aria-pressed={an}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function kurzInfo(e: BibEffektDaten): string {
  const teile = [
    e.video ? (e.video.greenscreen ? "Greenscreen" : "Video") : null,
    e.bild ? "Bild" : null,
    e.sound ? "Sound" : null,
  ].filter(Boolean);
  const wie =
    e.haeufigkeit.modus === "immer"
      ? "in jedem Video"
      : e.haeufigkeit.modus === "manuell"
        ? "nur manuell"
        : e.haeufigkeit.prozent
          ? `in ${e.haeufigkeit.prozent} % der Videos`
          : `jedes ${e.haeufigkeit.jedes ?? 3}. Video`;
  const wann =
    e.platzierung.modus === "ki"
      ? "KI entscheidet"
      : e.platzierung.bezug === "ende"
        ? `${e.platzierung.sekunden} s vor Ende`
        : `nach ${e.platzierung.sekunden} s`;
  return `${teile.join(" + ")} · ${wie} · ${wann}`;
}

/** Vorschau mit Chroma-Reglern und Pipette */
function Vorschau({
  e,
  setE,
}: {
  e: Entwurf;
  setE: (f: (x: Entwurf) => Entwurf) => void;
}): React.JSX.Element | null {
  const [bild, setBild] = useState<string | null>(null);
  const [pipette, setPipette] = useState(false);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [zeit, setZeit] = useState(0.5);
  const chroma = e.video?.greenscreen ? (e.chroma ?? STANDARD_CHROMA) : null;
  const schluessel = JSON.stringify([
    e.id,
    e.video?.datei,
    e.bild?.datei,
    chroma,
    zeit,
    pipette,
  ]);
  useEffect(() => {
    if (!e.id || (!e.video && !e.bild)) return;
    // kurz warten, damit beim Ziehen eines Reglers nicht jedes Zwischenbild gerendert wird
    const t = setTimeout(() => {
      setLaedt(true);
      window.moin
        .schnittBibVorschau(e.id, {
          video: e.video?.datei,
          bild: e.video ? undefined : e.bild?.datei,
          chroma,
          zeit,
          roh: pipette,
        })
        .then(
          (b) => {
            setBild(b);
            setFehler(null);
          },
          (err: unknown) => setFehler(fehlerText(err)),
        )
        .finally(() => setLaedt(false));
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel]);
  if (!e.id || (!e.video && !e.bild)) return null;
  const klick = (ev: React.MouseEvent<HTMLImageElement>): void => {
    if (!pipette || !e.video) return;
    const r = ev.currentTarget.getBoundingClientRect();
    const x = (ev.clientX - r.left) / r.width;
    const y = (ev.clientY - r.top) / r.height;
    void window.moin.schnittBibPipette(e.id, e.video.datei, x, y, zeit).then(
      (farbe) => {
        setE((a) => ({
          ...a,
          chroma: { ...(a.chroma ?? STANDARD_CHROMA), farbe },
        }));
        setPipette(false);
      },
      (err: unknown) => setFehler(fehlerText(err)),
    );
  };
  const regler = (
    k: "toleranz" | "weichheit" | "spill",
    name: string,
    info: string,
  ): React.JSX.Element => (
    <label className="bib-regler">
      <span>
        {name} <span className="muted small">{info}</span>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={chroma![k]}
        onChange={(ev) =>
          setE((a) => ({
            ...a,
            chroma: {
              ...(a.chroma ?? STANDARD_CHROMA),
              [k]: Number(ev.target.value),
            },
          }))
        }
      />
      <span className="mono small">{Math.round(chroma![k] * 100)}</span>
    </label>
  );
  return (
    <div className="bib-vorschau">
      <div className={`bib-bild${pipette ? " pipette" : ""}`}>
        {bild ? (
          <img src={bild} alt="Vorschau des Effekts" onClick={klick} />
        ) : (
          <div className="thumb-placeholder">Vorschau wird erstellt …</div>
        )}
        {laedt && bild && <span className="bib-laedt">…</span>}
      </div>
      {fehler && <p className="warn small">{fehler}</p>}
      {e.video && (
        <label className="bib-regler">
          <span>Stelle im Effekt</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={Math.min(1, zeit / 4)}
            onChange={(ev) => setZeit(Number(ev.target.value) * 4)}
          />
          <span className="mono small">{zeit.toFixed(1)} s</span>
        </label>
      )}
      {chroma && (
        <div className="bib-chroma">
          <div
            className="row wrap"
            style={{ marginTop: 0, alignItems: "center" }}
          >
            <span
              className="bib-farbe"
              style={{ background: chroma.farbe }}
              title={chroma.farbe}
            />
            <span className="mono small">{chroma.farbe}</span>
            <button
              type="button"
              className={`btn small${pipette ? " primary" : ""}`}
              onClick={() => setPipette(!pipette)}
            >
              {pipette ? "Jetzt ins Bild klicken …" : "Pipette"}
            </button>
            {pipette && (
              <span className="muted small">
                Klick auf den grünen/blauen Hintergrund im Original.
              </span>
            )}
          </div>
          {regler("toleranz", "Toleranz", "wie viel Grün weg soll")}
          {regler("weichheit", "Kantenweichheit", "weicher Rand")}
          {regler("spill", "Spill", "Grünstich am Rand entfernen")}
        </div>
      )}
    </div>
  );
}

function Bearbeiten({
  start,
  fertig,
}: {
  start: Entwurf;
  fertig: () => void;
}): React.JSX.Element {
  const [e, setE] = useState<Entwurf>(start);
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [sicher, setSicher] = useState(false);
  const [laedt, setLaedt] = useState(false);
  const neu = !start.erstellt;

  const hochladen = async (
    rolle: "video" | "bild" | "sound",
    greenscreen = false,
  ): Promise<void> => {
    setFehler(null);
    setLaedt(true);
    try {
      const r = await window.moin.schnittBibDatei(
        e.id || null,
        rolle,
        greenscreen,
      );
      if (!r) return;
      setE((a) => {
        const b = { ...a, id: r.id };
        if (rolle === "video") {
          b.video = { datei: r.datei, greenscreen, ton: a.video?.ton ?? false };
          b.chroma = greenscreen ? (r.chroma ?? STANDARD_CHROMA) : undefined;
        } else if (rolle === "bild")
          b.bild = { datei: r.datei, dauer: a.bild?.dauer ?? 2 };
        else
          b.sound = { datei: r.datei, lautstaerke: a.sound?.lautstaerke ?? 1 };
        if (!b.name.trim()) b.name = "";
        return b;
      });
      if (rolle === "video" && greenscreen)
        setHinweis(
          r.erkannt
            ? `Hintergrundfarbe automatisch erkannt (${r.chroma?.farbe}).`
            : "Hintergrundfarbe nicht eindeutig – Standard-Grün gesetzt. Mit der Pipette kannst du sie im Bild wählen.",
        );
    } catch (err) {
      setFehler(fehlerText(err));
    } finally {
      setLaedt(false);
    }
  };
  const entfernen = (rolle: "video" | "bild" | "sound"): void =>
    setE((a) => ({
      ...a,
      [rolle]: undefined,
      ...(rolle === "video" ? { chroma: undefined } : {}),
    }));

  const speichern = (): void => {
    setFehler(null);
    // fehlende Teile ausdrücklich als null schicken, damit sie auch im gespeicherten Effekt wegfallen
    const daten = {
      ...e,
      video: e.video ?? null,
      bild: e.bild ?? null,
      sound: e.sound ?? null,
      chroma: e.chroma ?? null,
    } as unknown as Partial<BibEffektDaten>;
    window.moin
      .schnittBibSpeichern(daten)
      .then(fertig, (err: unknown) => setFehler(fehlerText(err)));
  };
  const loeschen = (): void => {
    if (!sicher) return setSicher(true);
    void window.moin
      .schnittBibLoeschen(e.id)
      .then(fertig, (err: unknown) => setFehler(fehlerText(err)));
  };
  const umschalten = <T,>(liste: T[], x: T): T[] =>
    liste.includes(x)
      ? liste.length > 1
        ? liste.filter((y) => y !== x)
        : liste
      : [...liste, x];
  const h = e.haeufigkeit;
  const p = e.platzierung;

  return (
    <div className="bib-edit">
      <label className="bib-zeile">
        <span className="muted small">Name</span>
        <input
          className="input"
          value={e.name}
          placeholder="z. B. Abonnieren-Animation, Vine-Boom"
          maxLength={60}
          onChange={(ev) => setE({ ...e, name: ev.target.value })}
        />
      </label>

      <div className="bib-zeile">
        <span className="muted small">Dateien (kombinierbar)</span>
        <div className="kanal-wahl">
          <Knopf
            an={!!e.video && !e.video.greenscreen}
            disabled={laedt}
            onClick={() => void hochladen("video")}
          >
            <strong>Video mit Transparenz</strong>
            <span className="muted small">
              {e.video && !e.video.greenscreen
                ? "hochgeladen – neu wählen"
                : ".webm / .mov mit Alpha"}
            </span>
          </Knopf>
          <Knopf
            an={!!e.video?.greenscreen}
            disabled={laedt}
            onClick={() => void hochladen("video", true)}
          >
            <strong>Greenscreen-Video</strong>
            <span className="muted small">
              {e.video?.greenscreen
                ? "hochgeladen – neu wählen"
                : "Grün/Blau wird entfernt"}
            </span>
          </Knopf>
          <Knopf
            an={!!e.bild}
            disabled={laedt}
            onClick={() => void hochladen("bild")}
          >
            <strong>Bild</strong>
            <span className="muted small">
              {e.bild ? "hochgeladen – neu wählen" : "PNG, JPG, GIF"}
            </span>
          </Knopf>
          <Knopf
            an={!!e.sound}
            disabled={laedt}
            onClick={() => void hochladen("sound")}
          >
            <strong>Sound</strong>
            <span className="muted small">
              {e.sound ? "hochgeladen – neu wählen" : "MP3, WAV …"}
            </span>
          </Knopf>
        </div>
        {laedt && <span className="muted small">Datei wird übernommen …</span>}
        {hinweis && <span className="muted small">{hinweis}</span>}
        <div className="row wrap" style={{ marginTop: 0 }}>
          {e.video && (
            <>
              <label
                className="row"
                style={{ alignItems: "center", marginTop: 0 }}
              >
                <input
                  type="checkbox"
                  checked={e.video.ton}
                  onChange={(ev) =>
                    setE({
                      ...e,
                      video: { ...e.video!, ton: ev.target.checked },
                    })
                  }
                />{" "}
                Ton des Videos mitnehmen
              </label>
              <button
                type="button"
                className="btn small"
                onClick={() => entfernen("video")}
              >
                Video entfernen
              </button>
            </>
          )}
          {e.bild && (
            <>
              <label
                className="row"
                style={{ alignItems: "center", marginTop: 0 }}
              >
                Bild sichtbar
                <input
                  className="input small"
                  type="number"
                  min={0.3}
                  max={30}
                  step={0.1}
                  style={{ width: 70 }}
                  value={e.bild.dauer}
                  onChange={(ev) =>
                    setE({
                      ...e,
                      bild: { ...e.bild!, dauer: Number(ev.target.value) },
                    })
                  }
                />{" "}
                s
              </label>
              <button
                type="button"
                className="btn small"
                onClick={() => entfernen("bild")}
              >
                Bild entfernen
              </button>
            </>
          )}
          {e.sound && (
            <>
              <label
                className="row"
                style={{ alignItems: "center", marginTop: 0 }}
              >
                Lautstärke
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.05}
                  value={e.sound.lautstaerke}
                  onChange={(ev) =>
                    setE({
                      ...e,
                      sound: {
                        ...e.sound!,
                        lautstaerke: Number(ev.target.value),
                      },
                    })
                  }
                />
                <span className="mono small">
                  {Math.round(e.sound.lautstaerke * 100)} %
                </span>
              </label>
              <button
                type="button"
                className="btn small"
                onClick={() => entfernen("sound")}
              >
                Sound entfernen
              </button>
            </>
          )}
        </div>
      </div>

      <Vorschau e={e} setE={setE} />

      <div className="bib-zeile">
        <span className="muted small">Häufigkeit</span>
        <div className="kanal-wahl">
          <Knopf
            an={h.modus === "immer"}
            onClick={() => setE({ ...e, haeufigkeit: { modus: "immer" } })}
          >
            In jedem Video
          </Knopf>
          <Knopf
            an={h.modus === "manchmal"}
            onClick={() =>
              setE({
                ...e,
                haeufigkeit: { modus: "manchmal", jedes: h.jedes ?? 3 },
              })
            }
          >
            Nur in manchen
          </Knopf>
          <Knopf
            an={h.modus === "manuell"}
            onClick={() => setE({ ...e, haeufigkeit: { modus: "manuell" } })}
          >
            Nur manuell
          </Knopf>
        </div>
        {h.modus === "manchmal" && (
          <div
            className="row wrap"
            style={{ marginTop: 0, alignItems: "center" }}
          >
            <Knopf
              an={!h.prozent}
              onClick={() =>
                setE({
                  ...e,
                  haeufigkeit: { modus: "manchmal", jedes: h.jedes ?? 3 },
                })
              }
            >
              Jedes n-te Video
            </Knopf>
            <Knopf
              an={!!h.prozent}
              onClick={() =>
                setE({
                  ...e,
                  haeufigkeit: { modus: "manchmal", prozent: h.prozent ?? 50 },
                })
              }
            >
              X % der Videos
            </Knopf>
            {h.prozent ? (
              <label
                className="row"
                style={{ alignItems: "center", marginTop: 0 }}
              >
                <input
                  className="input small"
                  type="number"
                  min={1}
                  max={100}
                  style={{ width: 70 }}
                  value={h.prozent}
                  onChange={(ev) =>
                    setE({
                      ...e,
                      haeufigkeit: {
                        modus: "manchmal",
                        prozent: Number(ev.target.value),
                      },
                    })
                  }
                />{" "}
                %
              </label>
            ) : (
              <label
                className="row"
                style={{ alignItems: "center", marginTop: 0 }}
              >
                jedes
                <input
                  className="input small"
                  type="number"
                  min={2}
                  max={50}
                  style={{ width: 60 }}
                  value={h.jedes ?? 3}
                  onChange={(ev) =>
                    setE({
                      ...e,
                      haeufigkeit: {
                        modus: "manchmal",
                        jedes: Number(ev.target.value),
                      },
                    })
                  }
                />
                . Video
              </label>
            )}
          </div>
        )}
      </div>

      <div className="bib-zeile">
        <span className="muted small">Kanal</span>
        <div className="kanal-wahl">
          {["MoinMornhart", "MoinMorni"].map((k) => (
            <Knopf
              key={k}
              an={e.kanaele.includes(k)}
              onClick={() => setE({ ...e, kanaele: umschalten(e.kanaele, k) })}
            >
              {k}
            </Knopf>
          ))}
        </div>
      </div>
      <div className="bib-zeile">
        <span className="muted small">Videotyp</span>
        <div className="kanal-wahl">
          {(["reaction", "gaming"] as const).map((t) => (
            <Knopf
              key={t}
              an={e.typen.includes(t)}
              onClick={() => setE({ ...e, typen: umschalten(e.typen, t) })}
            >
              {t === "reaction" ? "Reaction" : "Gaming"}
            </Knopf>
          ))}
        </div>
      </div>

      <div className="bib-zeile">
        <span className="muted small">Platzierung</span>
        <div className="kanal-wahl">
          <Knopf
            an={p.modus === "fest"}
            onClick={() =>
              setE({
                ...e,
                platzierung: {
                  modus: "fest",
                  bezug: p.bezug ?? "start",
                  sekunden: p.sekunden ?? 30,
                },
              })
            }
          >
            Fester Zeitpunkt
          </Knopf>
          <Knopf
            an={p.modus === "ki"}
            onClick={() => setE({ ...e, platzierung: { modus: "ki" } })}
          >
            KI entscheidet
          </Knopf>
        </div>
        {p.modus === "fest" ? (
          <div
            className="row wrap"
            style={{ marginTop: 0, alignItems: "center" }}
          >
            <input
              className="input small"
              type="number"
              min={0}
              step={1}
              style={{ width: 70 }}
              value={p.sekunden ?? 30}
              onChange={(ev) =>
                setE({
                  ...e,
                  platzierung: { ...p, sekunden: Number(ev.target.value) },
                })
              }
            />{" "}
            s
            <Knopf
              an={p.bezug !== "ende"}
              onClick={() =>
                setE({ ...e, platzierung: { ...p, bezug: "start" } })
              }
            >
              nach dem Start
            </Knopf>
            <Knopf
              an={p.bezug === "ende"}
              onClick={() =>
                setE({ ...e, platzierung: { ...p, bezug: "ende" } })
              }
            >
              vor dem Ende
            </Knopf>
          </div>
        ) : (
          <span className="muted small">
            Die KI setzt ihn an eine passende Stelle: nicht in
            Schlüsselmomenten, nicht zu oft und nie zwei Effekte gleichzeitig.
          </span>
        )}
      </div>

      {(e.video || e.bild) && (
        <div className="bib-zeile">
          <span className="muted small">Position und Größe</span>
          <div
            className="row wrap"
            style={{ marginTop: 0, alignItems: "center" }}
          >
            <div
              className="bib-raster"
              role="group"
              aria-label="Position im Bild"
            >
              {RASTER.map((l) => (
                <button
                  key={l}
                  type="button"
                  className={e.lage === l ? "on" : ""}
                  aria-pressed={e.lage === l}
                  title={l}
                  onClick={() => setE({ ...e, lage: l })}
                />
              ))}
            </div>
            <Knopf
              an={e.lage === "voll"}
              onClick={() => setE({ ...e, lage: "voll" })}
            >
              Ganzes Bild
            </Knopf>
            {e.lage !== "voll" && (
              <label
                className="row"
                style={{ alignItems: "center", marginTop: 0 }}
              >
                Größe
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={e.groesse}
                  onChange={(ev) =>
                    setE({ ...e, groesse: Number(ev.target.value) })
                  }
                />
                <span className="mono small">
                  {Math.round(e.groesse * 100)} % der Breite
                </span>
              </label>
            )}
          </div>
        </div>
      )}

      {fehler && <p className="warn small">{fehler}</p>}
      <div className="row wrap">
        <button
          type="button"
          className="btn primary"
          disabled={!e.name.trim() || (!e.video && !e.bild && !e.sound)}
          onClick={speichern}
        >
          Speichern
        </button>
        <button type="button" className="btn" onClick={fertig}>
          Abbrechen
        </button>
        {!neu && (
          <button type="button" className="btn" onClick={loeschen}>
            {sicher ? "Wirklich löschen?" : "Effekt löschen"}
          </button>
        )}
      </div>
    </div>
  );
}

export function EffektBibliothek(): React.JSX.Element {
  const [liste, setListe] = useState<BibEffektDaten[]>([]);
  const [offen, setOffen] = useState<Entwurf | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const laden = (): void =>
    void window.moin
      .schnittBib()
      .then(setListe, (e: unknown) => setFehler(fehlerText(e)));
  useEffect(laden, []);
  return (
    <Card title="Effekt-Bibliothek" badge={`${liste.length}`}>
      {fehler && <p className="warn small">{fehler}</p>}
      {offen ? (
        <Bearbeiten
          start={offen}
          fertig={() => {
            setOffen(null);
            laden();
          }}
        />
      ) : (
        <>
          <p className="muted small">
            Deine eigenen Effekte. MoinStudio setzt sie beim Schneiden
            automatisch ein, je nachdem was du hier einstellst. Du kannst sie
            auch per Wunsch einfügen, z. B. „Füge bei 2:14 den Vine-Boom ein“.
          </p>
          {liste.length === 0 && <p className="muted">Noch keine Effekte.</p>}
          <div className="bib-liste">
            {liste.map((x) => (
              <button
                key={x.id}
                type="button"
                className="schnitt-projekt"
                onClick={() => {
                  setOffen({ ...x });
                }}
              >
                <span>
                  <strong>{x.name}</strong>
                  <span className="muted small">{kurzInfo(x)}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="row wrap">
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                setOffen(neuerEntwurf());
              }}
            >
              Neuer Effekt
            </button>
          </div>
        </>
      )}
    </Card>
  );
}
