import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Contrast,
  Crop,
  Database,
  ExternalLink,
  Eye,
  Focus,
  Frame,
  Layers,
  PencilLine,
  RefreshCw,
  Scaling,
  Sigma,
  Sparkles,
  Wand2
} from "lucide-react";
import { dims, humanize, lower, pixelCount, shortName } from "../modelUtils";

const KANA_SAMPLES = ["あ", "さ", "ね", "ん", "ひ", "を"];
const SOFTMAX_DEMO = [
  { label: "1st guess", value: 72 },
  { label: "2nd", value: 14 },
  { label: "3rd", value: 7 },
  { label: "4th", value: 4 },
  { label: "5th", value: 3 }
];

const fmt = (value) =>
  value === null || value === undefined ? null : Number(value).toLocaleString();

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

// Renders a kana at the model's true input resolution, then scales it up
// with nearest-neighbour so you can see the actual pixels the model gets.
function PixelGlyph({ width, height, invert, glyph, scale }) {
  const ref = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const paint = () => {
      const canvas = ref.current;
      if (!canvas || cancelled) return;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = invert ? "#000" : "#fff";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = invert ? "#fff" : "#000";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `800 ${Math.round(height * 0.78)}px "M PLUS Rounded 1c", sans-serif`;
      ctx.fillText(glyph, width / 2, height / 2 + height * 0.04);
    };

    paint();
    document.fonts
      ?.load('800 40px "M PLUS Rounded 1c"', glyph)
      .then(paint)
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [width, height, invert, glyph]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      className="pixel-canvas"
      style={scale ? { width: width * scale } : undefined}
      role="img"
      aria-label={`${glyph} rendered at ${width} by ${height} pixels`}
    />
  );
}

function Fact({ label, value, mono }) {
  return (
    <div className="fact">
      <span className="fact-label">{label}</span>
      {value === null || value === undefined || value === "" ? (
        <span className="fact-value unknown">Not published</span>
      ) : (
        <span className={`fact-value ${mono ? "mono" : ""}`}>{value}</span>
      )}
    </div>
  );
}

function Chapter({ number, icon: Icon, title, color, children, visual }) {
  return (
    <section className="chapter">
      <div className="chapter-text">
        <div className="chapter-head">
          <span className="chapter-num" style={{ background: `var(--${color})` }}>
            {number}
          </span>
          <Icon size={22} />
        </div>
        <h3>{title}</h3>
        {children}
      </div>
      <div className="chapter-visual">{visual}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function ModelCard({ model, selected, active, onExplore, onUse }) {
  const { w, h } = dims(model);
  return (
    <article className={`model-card ${selected ? "selected" : ""}`}>
      <div className="model-card-top">
        <span className="version-pill">v{model.version}</span>
        {active && <span className="active-pill">In use on Draw</span>}
      </div>

      <div className="pixel-frame lineup-frame">
        <PixelGlyph
          width={w}
          height={h}
          invert={model.input?.invert_colors}
          glyph="あ"
          scale={3}
        />
      </div>
      <p className="frame-caption">
        Actual size ×3 · {w}×{h} px
      </p>

      <h3>{shortName(model)}</h3>
      <p className="model-task">{humanize(model.task)}</p>

      <div className="chip-row">
        <span className="chip sky">{w}×{h} input</span>
        {model.dataset?.short_name && (
          <span className="chip pink">{model.dataset.short_name}</span>
        )}
        {model.output?.size != null && (
          <span className="chip mint">{model.output.size} outputs</span>
        )}
      </div>

      <div className="card-actions">
        <button type="button" className="soft-button" onClick={onExplore}>
          <BookOpen size={16} /> Read the story
        </button>
        <button type="button" className="soft-button primary" onClick={onUse}>
          <PencilLine size={16} /> Draw with it
        </button>
      </div>
    </article>
  );
}

function PipelineStep({ step, index }) {
  const Icon = step.icon;
  return (
    <li className={`pipe-step ${step.on ? "" : "off"}`}>
      <span className="pipe-icon">
        <Icon size={20} />
      </span>
      <div>
        <div className="pipe-title">
          <span className="pipe-index">{index}</span>
          {step.title}
          {!step.on && <span className="skipped">skipped</span>}
        </div>
        <p>{step.desc}</p>
      </div>
    </li>
  );
}

function buildPipeline(model) {
  const p = model.preprocessing || {};
  const input = model.input || {};
  const { w, h } = dims(model);
  const resize = Array.isArray(p.resize) ? p.resize : [w, h];

  return [
    {
      icon: Wand2,
      title: p.threshold != null ? `Clean the paper (threshold ${p.threshold})` : "Clean the paper",
      desc: "Anything brighter than the threshold counts as blank paper, so faint smudges don’t sneak in as ink.",
      on: p.threshold != null
    },
    {
      icon: Crop,
      title: "Crop to the character",
      desc: "Empty margins are trimmed away so the model studies your strokes, not your whitespace.",
      on: !!p.crop_character
    },
    {
      icon: Frame,
      title: "Add padding",
      desc: "A little breathing room goes back around the edges, so strokes never touch the frame.",
      on: !!p.add_padding
    },
    {
      icon: Focus,
      title: "Center it",
      desc: "The character is moved to the middle of the frame, just like the examples it trained on.",
      on: !!p.center_character
    },
    {
      icon: Scaling,
      title: `Shrink to ${resize[0]}×${resize[1]}`,
      desc: "Your drawing is squeezed down to the exact thumbnail size the network expects.",
      on: Array.isArray(p.resize)
    },
    {
      icon: Contrast,
      title: "Invert colors",
      desc: "Ink becomes bright and paper becomes dark, matching the way the training images were stored.",
      on: !!input.invert_colors
    },
    {
      icon: Sigma,
      title: "Normalize to 0–1",
      desc: "Pixel brightness is rescaled from 0–255 to a tidy 0–1 range, which neural networks digest best.",
      on: input.normalization === "zero_to_one"
    }
  ];
}

function Story({ model }) {
  const [glyph, setGlyph] = useState(KANA_SAMPLES[0]);
  const { w, h } = dims(model);
  const px = pixelCount(model);
  const ds = model.dataset || {};
  const input = model.input || {};
  const output = model.output || {};
  const steps = useMemo(() => buildPipeline(model), [model]);
  const shape = (input.shape || [null, h, w, input.channels || 1]).map((n) =>
    n === null ? "batch" : n
  );

  return (
    <div className="story">
      <Chapter
        number="01"
        icon={Database}
        color="pink"
        title="What it studied"
        visual={
          <div className="facts-card">
            <Fact label="Dataset" value={ds.name} />
            <Fact label="Source" value={ds.source} />
            <Fact label="Kind of data" value={humanize(lower(ds.type))} />
            <Fact label="Classes" value={fmt(ds.number_of_classes)} />
            <Fact label="Samples" value={fmt(ds.number_of_samples)} />
            <Fact
              label="Image shape"
              value={ds.image_shape ? ds.image_shape.join(" × ") : null}
              mono
            />
            {ds.url && (
              <a className="ext-link" href={ds.url} target="_blank" rel="noreferrer">
                Browse the dataset <ExternalLink size={15} />
              </a>
            )}
          </div>
        }
      >
        <p>
          Before it ever met your handwriting, <b>{shortName(model)}</b> spent
          its training days flipping through{" "}
          <b>{ds.name || "a collection of character images"}</b>
          {ds.source ? <> from {ds.source}</> : null}: a stack of{" "}
          {lower(ds.type) || "handwritten character images"} labelled with the
          character each one shows.
        </p>
        <p className="aside">
          Everything it knows about kana comes from these examples, which is why
          neat, centered strokes tend to be read more confidently.
        </p>
      </Chapter>

      <Chapter
        number="02"
        icon={Eye}
        color="sky"
        title="How it sees"
        visual={
          <div className="see-card">
            <div className="pixel-frame big-frame">
              <PixelGlyph
                width={w}
                height={h}
                invert={input.invert_colors}
                glyph={glyph}
              />
            </div>
            <div className="glyph-picker" role="group" aria-label="Try a character">
              {KANA_SAMPLES.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`glyph-chip ${k === glyph ? "active" : ""}`}
                  onClick={() => setGlyph(k)}
                >
                  {k}
                </button>
              ))}
            </div>
            <p className="frame-caption">
              {glyph} at {w}×{h}, blown up so you can see every pixel
            </p>
          </div>
        }
      >
        <p>
          Your canvas is big and crisp, but <b>{shortName(model)}</b> only gets
          a tiny {lower(input.color_mode) || "grayscale"} thumbnail:{" "}
          <b>
            {w} × {h}
          </b>
          , which is just <b>{px.toLocaleString()} pixels</b>. Pick a character
          on the right to see what survives the squeeze.
        </p>

        <div className="tensor">
          <span className="tensor-label">What the network receives</span>
          <div className="tensor-chips">
            {shape.map((part, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="times">×</span>}
                <span className={`tensor-chip ${part === "batch" ? "soft" : ""}`}>
                  {part}
                </span>
              </React.Fragment>
            ))}
          </div>
          <span className="tensor-legend">
            <Layers size={14} /> {input.dtype || "float32"} · {input.channels ?? 1}{" "}
            channel · batch = how many images at once
          </span>
        </div>
      </Chapter>

      <Chapter
        number="03"
        icon={Sparkles}
        color="sun"
        title="Tidying your drawing"
        visual={
          <ol className="pipeline">
            {steps.map((step, i) => (
              <PipelineStep key={step.title} step={step} index={i + 1} />
            ))}
          </ol>
        }
      >
        <p>
          Hitting Predict doesn’t hand your sketch straight to the network. The
          backend first runs it through a short recipe
          {model.preprocessing?.function ? (
            <>
              {" "}
              called <code>{model.preprocessing.function}</code>
            </>
          ) : null}
          , so every drawing looks as much as possible like the images the
          model learned from.
        </p>
        <p className="aside">
          Steps are listed in a typical order. Greyed-out steps are switched off
          for this model.
        </p>
      </Chapter>

      <Chapter
        number="04"
        icon={Brain}
        color="mint"
        title="What it says back"
        visual={
          <div className="softmax-card">
            <span className="tensor-label">Illustration: how a softmax spreads 100%</span>
            <div className="softmax-bars">
              {SOFTMAX_DEMO.map((row, i) => (
                <div className="softmax-row" key={row.label}>
                  <span>{row.label}</span>
                  <div className="softmax-track">
                    <i
                      className={i === 0 ? "top" : ""}
                      style={{ width: `${row.value}%` }}
                    />
                  </div>
                  <b>{row.value}%</b>
                </div>
              ))}
            </div>
            <div className="facts-card flat">
              <Fact label="Activation" value={humanize(output.activation)} />
              <Fact label="Task type" value={humanize(lower(output.type))} />
              <Fact label="Possible answers" value={fmt(output.size)} />
              <Fact label="Label file" value={output.label} mono />
            </div>
          </div>
        }
      >
        <p>
          The last layer is a <b>{output.activation || "softmax"}</b>: it
          shares out 100% of its confidence across{" "}
          <b>{output.size ?? "all"} possible characters</b>. The biggest slice
          is the best guess you see in big letters, and the runners-up become
          your top five.
        </p>
        <p className="aside">
          It always picks something, even for a scribble, so keep an eye on the
          confidence number.
        </p>
      </Chapter>
    </div>
  );
}

function Compare({ models }) {
  const pixels = models.map(pixelCount);
  const max = Math.max(...pixels, 1);
  const min = Math.min(...pixels.filter(Boolean));
  const ratio = max / (min || 1);

  const rows = [
    ["Version", (m) => `v${m.version}`],
    ["Input size", (m) => `${dims(m).w}×${dims(m).h}`],
    ["Dataset", (m) => m.dataset?.name],
    ["Possible answers", (m) => fmt(m.output?.size)],
    ["Label file", (m) => m.output?.label],
    ["Preprocessing", (m) => m.preprocessing?.function]
  ];

  return (
    <section className="compare">
      <div className="section-title">
        <span className="hero-chip">Head to head</span>
        <h2>Which one should I pick?</h2>
      </div>

      {ratio > 1 && (
        <div className="fun-callout">
          <span className="fun-number">{ratio.toFixed(1)}×</span>
          <p>
            more pixels in the biggest model’s view than in the smallest.
            Bigger thumbnails keep finer stroke detail, smaller ones are
            lighter and quicker. Try the same drawing on each and compare.
          </p>
        </div>
      )}

      <div className="compare-scroll">
        <table>
          <thead>
            <tr>
              <th />
              {models.map((m) => (
                <th key={m.id}>{shortName(m)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Pixels it sees</th>
              {models.map((m, i) => (
                <td key={m.id}>
                  <div className="px-bar">
                    <i style={{ width: `${(pixels[i] / max) * 100}%` }} />
                  </div>
                  <span className="px-num">{pixels[i].toLocaleString()}</span>
                </td>
              ))}
            </tr>
            {rows.map(([label, get]) => (
              <tr key={label}>
                <th>{label}</th>
                {models.map((m) => (
                  <td key={m.id}>{get(m) || <span className="muted">Not published</span>}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function ModelsPage({
  models,
  status,
  error,
  onRetry,
  activeModelId,
  onUseModel
}) {
  const [selectedId, setSelectedId] = useState(activeModelId);
  const storyRef = useRef(null);
  const selected = models.find((m) => m.id === selectedId) || models[0];

  const explore = (id) => {
    setSelectedId(id);
    requestAnimationFrame(() =>
      storyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  };

  return (
    <main className="page models-page">
      <header className="models-hero">
        <div>
          <span className="hero-chip">
            <Layers size={16} /> Under the hood
          </span>
          <h1>Meet the brains behind the brush</h1>
          <p>
            Every character you draw is read by a small neural network. Here’s
            what each one studied, how it sees your handwriting, and how it
            answers back.
          </p>
        </div>
        <div className="hero-glyphs" aria-hidden="true">
          <span className="hg hg1">あ</span>
          <span className="hg hg2">か</span>
          <span className="hg hg3">さ</span>
        </div>
      </header>

      {status === "loading" && (
        <div className="state-card">
          <span className="spinner dark" /> Fetching model details from the backend…
        </div>
      )}

      {status === "error" && (
        <div className="state-card error">
          <div>
            <strong>Couldn’t reach the model server</strong>
            <p>{error}</p>
          </div>
          <button type="button" className="soft-button primary" onClick={onRetry}>
            <RefreshCw size={16} /> Try again
          </button>
        </div>
      )}

      {status === "ready" && models.length === 0 && (
        <div className="state-card">The backend didn’t list any models.</div>
      )}

      {status === "ready" && selected && (
        <>
          <section className="lineup" aria-label="Available models">
            {models.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                selected={model.id === selected.id}
                active={model.id === activeModelId}
                onExplore={() => explore(model.id)}
                onUse={() => onUseModel(model.id)}
              />
            ))}
          </section>

          <section className="story-section" ref={storyRef}>
            <div className="section-title">
              <span className="hero-chip">The story</span>
              <h2>
                Inside <span className="hl">{shortName(selected)}</span>
              </h2>
              {models.length > 1 && (
                <div className="story-tabs" role="tablist">
                  {models.map((m) => (
                    <button
                      key={m.id}
                      role="tab"
                      type="button"
                      aria-selected={m.id === selected.id}
                      className={`story-tab ${m.id === selected.id ? "active" : ""}`}
                      onClick={() => setSelectedId(m.id)}
                    >
                      {shortName(m)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Story key={selected.id} model={selected} />

            <div className="story-cta">
              <button
                type="button"
                className="predict-button"
                onClick={() => onUseModel(selected.id)}
              >
                Try {shortName(selected)} on the canvas <ArrowRight size={20} />
              </button>
            </div>
          </section>

          {models.length > 1 && <Compare models={models} />}
        </>
      )}
    </main>
  );
}
