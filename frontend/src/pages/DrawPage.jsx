import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Eraser,
  Trash2,
  Undo2,
  X,
  Pencil,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Sparkles,
  Cpu
} from "lucide-react";
import ModelBar from "../components/ModelBar";
import { predictUrl, predictWith } from "../api";
import { dims, shortName } from "../modelUtils";

const CANVAS_WIDTH = 760;
const CANVAS_HEIGHT = 520;
const STROKE_WIDTH = 22;
const CANVAS_BG = "#ffffff";

function DrawPage({
  models,
  status,
  activeModel,
  onSelectModel,
  onRetry,
  onAbout
}) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const pointsRef = useRef([]);
  const strokesRef = useRef([]);
  const bboxRef = useRef(null);

  const [tool, setTool] = useState("pen");
  const [lineWidth, setLineWidth] = useState(STROKE_WIDTH);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedAlternative, setSelectedAlternative] = useState(null);
  const [usedModel, setUsedModel] = useState(null);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_WIDTH * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    // Display size is handled by CSS so the canvas can shrink on small screens.

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = CANVAS_BG;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  useEffect(() => {
    setupCanvas();
    const onResize = () => setupCanvas();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [setupCanvas]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = CANVAS_BG;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    for (const stroke of strokesRef.current) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      ctx.strokeStyle = "#181818";
      ctx.lineWidth = lineWidth;
      ctx.globalCompositeOperation = "source-over";
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }, [lineWidth]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // Maps pointer position to logical canvas coordinates, even when CSS
  // has scaled the canvas down (small screens).
  const getPoint = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    const source = event.touches?.[0] || event;
    return {
      x: Math.max(0, Math.min(CANVAS_WIDTH, (source.clientX - rect.left) * scaleX)),
      y: Math.max(0, Math.min(CANVAS_HEIGHT, (source.clientY - rect.top) * scaleY))
    };
  };

  const updateBBox = (point) => {
    const half = lineWidth / 2 + 2;
    if (!bboxRef.current) {
      bboxRef.current = {
        minX: point.x - half,
        minY: point.y - half,
        maxX: point.x + half,
        maxY: point.y + half
      };
      return;
    }
    bboxRef.current.minX = Math.min(bboxRef.current.minX, point.x - half);
    bboxRef.current.minY = Math.min(bboxRef.current.minY, point.y - half);
    bboxRef.current.maxX = Math.max(bboxRef.current.maxX, point.x + half);
    bboxRef.current.maxY = Math.max(bboxRef.current.maxY, point.y + half);
  };

  const startDrawing = (event) => {
    event.preventDefault();
    const point = getPoint(event);

    drawingRef.current = true;
    pointsRef.current = [point];
    updateBBox(point);

    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const draw = (event) => {
    if (!drawingRef.current) return;
    event.preventDefault();

    const point = getPoint(event);
    pointsRef.current.push(point);
    updateBBox(point);

    const ctx = canvasRef.current.getContext("2d");
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = lineWidth;

    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "#181818";
    }

    const previous = pointsRef.current[pointsRef.current.length - 2];
    ctx.beginPath();
    ctx.moveTo(previous.x, previous.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  };

  const stopDrawing = (event) => {
    if (!drawingRef.current) return;
    event?.preventDefault?.();

    drawingRef.current = false;
    if (pointsRef.current.length > 0) {
      if (tool === "pen") {
        strokesRef.current.push([...pointsRef.current]);
      }
    }
    pointsRef.current = [];
  };

  const undo = () => {
    if (strokesRef.current.length === 0) return;
    strokesRef.current.pop();
    recomputeBBox();
    redraw();
  };

  const recomputeBBox = () => {
    bboxRef.current = null;
    for (const stroke of strokesRef.current) {
      for (const point of stroke) updateBBox(point);
    }
  };

  const clearCanvas = () => {
    strokesRef.current = [];
    pointsRef.current = [];
    bboxRef.current = null;
    setPrediction(null);
    setSelectedAlternative(null);
    setError("");
    setDrawerOpen(false);
    setupCanvas();
  };

  const makeCroppedBlob = () =>
    new Promise((resolve, reject) => {
      const source = canvasRef.current;
      const box = bboxRef.current;

      if (!box) {
        reject(new Error("Draw a character before predicting."));
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      const padding = 28;

      // Logical/CSS coordinates
      const minX = Math.max(0, Math.floor(box.minX - padding));
      const minY = Math.max(0, Math.floor(box.minY - padding));
      const maxX = Math.min(CANVAS_WIDTH, Math.ceil(box.maxX + padding));
      const maxY = Math.min(CANVAS_HEIGHT, Math.ceil(box.maxY + padding));

      const logicalWidth = Math.max(1, maxX - minX);
      const logicalHeight = Math.max(1, maxY - minY);

      const crop = document.createElement("canvas");
      crop.width = Math.round(logicalWidth * dpr);
      crop.height = Math.round(logicalHeight * dpr);

      const ctx = crop.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, crop.width, crop.height);

      // The source canvas is in physical pixels, so use physical coordinates.
      ctx.drawImage(
        source,
        minX * dpr,
        minY * dpr,
        logicalWidth * dpr,
        logicalHeight * dpr,
        0,
        0,
        crop.width,
        crop.height
      );

      crop.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Could not create cropped image."));
          return;
        }
        resolve(blob);
      }, "image/png");
    });

  const predict = async () => {
    setError("");

    if (!activeModel) {
      setError("No model is available yet. Check that the backend is running.");
      setDrawerOpen(true);
      return;
    }

    setLoading(true);

    try {
      const blob = await makeCroppedBlob();
      const data = await predictWith(activeModel.id, blob);
      setPrediction(data);
      setUsedModel(activeModel);
      setSelectedAlternative(null);
      setDrawerOpen(true);
    } catch (err) {
      setError(err.message || "Prediction failed.");
      setDrawerOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const topFive = prediction?.top_five
    ? Object.values(prediction.top_five).sort((a, b) => a.rank - b.rank)
    : [];

  return (
    <div className="draw-page">
      <main className="workspace">
        <section className="hero-copy">
          <div className="hero-chip">
            <Sparkles size={16} />
            CNN-powered
          </div>
          <h1>Draw a kana and I'll read it!</h1>
          <p>
            Write one Japanese character in the box. Only the part of the
            canvas around your strokes is sent to the model.
          </p>
          <ul className="tips">
            <li>One character at a time</li>
            <li>Draw big and centered</li>
            <li>Use undo to fix a stroke</li>
          </ul>
        </section>

        <section className="canvas-card">
          <div className="canvas-header">
            <div className="canvas-title">
              <span className="canvas-label">Drawing area</span>
              <span className="canvas-hint">Write one character</span>
            </div>

            <div className="toolbar">
              <button
                className={`tool-button ${tool === "pen" ? "active" : ""}`}
                onClick={() => setTool("pen")}
                title="Pen"
                aria-label="Pen"
              >
                <Pencil size={18} />
              </button>
              <button
                className={`tool-button ${tool === "eraser" ? "active" : ""}`}
                onClick={() => setTool("eraser")}
                title="Eraser"
                aria-label="Eraser"
              >
                <Eraser size={18} />
              </button>
              <button
                className="tool-button"
                onClick={undo}
                title="Undo"
                aria-label="Undo"
              >
                <Undo2 size={18} />
              </button>
              <button
                className="tool-button danger"
                onClick={clearCanvas}
                title="Clear"
                aria-label="Clear"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>

          <ModelBar
            models={models}
            status={status}
            activeModelId={activeModel?.id}
            onSelect={onSelectModel}
            onRetry={onRetry}
            onAbout={onAbout}
          />

          <div className="canvas-shell">
            <canvas
              ref={canvasRef}
              className="drawing-canvas"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
            <div className="canvas-guide" aria-hidden="true" />
          </div>

          <div className="canvas-footer">
            <label className="stroke-control">
              <span>Brush</span>
              <input
                type="range"
                min="8"
                max="38"
                value={lineWidth}
                onChange={(e) => setLineWidth(Number(e.target.value))}
              />
              <span className="stroke-value">{lineWidth}px</span>
            </label>

            <button
              className="predict-button"
              onClick={predict}
              disabled={loading || !activeModel}
            >
              {loading ? (
                <>
                  <span className="spinner" /> Analyzing
                </>
              ) : (
                <>
                  {activeModel
                    ? `Predict with ${shortName(activeModel)}`
                    : "Predict character"}{" "}
                  <ChevronRight size={20} />
                </>
              )}
            </button>
          </div>

          <div className="privacy-note">
            <CheckCircle2 size={16} />
            Only the area around your drawing is sent to the Flask API.
          </div>
        </section>
      </main>

      {drawerOpen && (
        <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} />
      )}

      <aside className={`result-drawer ${drawerOpen ? "open" : ""}`}>
        <div className="drawer-header">
          <div>
            <span className="drawer-kicker">Recognition result</span>
            <h2>What I see</h2>
          </div>
          <button
            className="close-button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close results"
          >
            <X size={20} />
          </button>
        </div>

        {!error && prediction && usedModel && (
          <div className="used-model">
            <Cpu size={16} />
            Read by <strong>{shortName(usedModel)}</strong>
            <span>
              {dims(usedModel).w}×{dims(usedModel).h} input
            </span>
          </div>
        )}

        {error ? (
          <div className="error-card">
            <AlertCircle size={24} />
            <div>
              <strong>Couldn’t read this drawing</strong>
              <p>{error}</p>
              <small>
                Make sure Flask is running and reachable at{" "}
                <code>{predictUrl(activeModel?.id || "model-name")}</code>.
              </small>
            </div>
          </div>
        ) : prediction ? (
          <>
            <div className="primary-result">
              <div className="character-orb">
                <span>{prediction.native}</span>
              </div>
              <div className="primary-details">
                <span className="match-label">Best match</span>
                <div className="primary-row">
                  <strong>{prediction.native}</strong>
                  <span className="romaji-pill">{prediction.romaji}</span>
                </div>
                <p>
                  Your drawing most closely matches{" "}
                  <strong>{prediction.native}</strong>, pronounced{" "}
                  <strong>{prediction.romaji}</strong>.
                </p>
              </div>
            </div>

            <div className="confidence-card">
              <div className="confidence-top">
                <span>Model confidence</span>
                <strong>{Number(prediction.confidence).toFixed(1)}%</strong>
              </div>
              <div className="confidence-track">
                <div
                  className="confidence-fill"
                  style={{
                    width: `${Math.min(100, Math.max(0, prediction.confidence))}%`
                  }}
                />
              </div>
              <div className="confidence-bottom">
                <span>Class #{prediction.predicted_index + 1}</span>
                <span>Top prediction</span>
              </div>
            </div>

            <div className="alternatives">
              <div className="section-heading">
                <div>
                  <h3>Other possible matches</h3>
                </div>
                <span className="tiny-count">Top 5</span>
              </div>

              <div className="prediction-list">
                {topFive.map((item) => {
                  const isSelected =
                    selectedAlternative?.rank === item.rank ||
                    (!selectedAlternative && item.rank === 1);

                  return (
                    <button
                      className={`prediction-item ${isSelected ? "selected" : ""}`}
                      key={item.rank}
                      onClick={() => setSelectedAlternative(item)}
                    >
                      <span className="rank">#{item.rank}</span>
                      <span className="mini-character">{item.native}</span>
                      <span className="prediction-name">
                        <strong>{item.native}</strong>
                        <small>{item.class_names}</small>
                      </span>
                      <span className="prediction-score">
                        <span className="score-bar">
                          <i style={{ width: `${Math.min(100, item.prediction)}%` }} />
                        </span>
                        {Number(item.prediction).toFixed(1)}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedAlternative && selectedAlternative.rank !== 1 && (
              <div className="selected-note">
                <span className="selected-symbol">{selectedAlternative.native}</span>
                <div>
                  <strong>Interesting alternative</strong>
                  <p>
                    You picked <b>{selectedAlternative.native}</b> (
                    {selectedAlternative.class_names}) from the model’s ranked
                    possibilities.
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="empty-result">
            <div className="empty-icon">あ</div>
            <h3>Ready when you are</h3>
            <p>Draw a character and press Predict. Your result will appear here.</p>
          </div>
        )}

        <div className="drawer-footer">
          <span>Flask API</span>
          <code>/api/predict/{(usedModel || activeModel)?.id || "…"}</code>
        </div>
      </aside>
    </div>
  );
}

export default DrawPage;