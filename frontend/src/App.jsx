import React, { useCallback, useEffect, useMemo, useState } from "react";
import DrawPage from "./pages/DrawPage";
import ModelsPage from "./pages/ModelsPage";
import { fetchModels } from "./api";

const NAV_ITEMS = [
  { id: "draw", label: "Draw", enabled: true },
  { id: "models", label: "Models", enabled: true },
  { id: "practice", label: "Practice", enabled: false },
  { id: "library", label: "Library", enabled: false },
  { id: "progress", label: "Progress", enabled: false }
];

const ROUTES = ["draw", "models"];
const STORAGE_KEY = "kana-vision:model";

const readRoute = () => {
  const id = window.location.hash.replace(/^#\/?/, "");
  return ROUTES.includes(id) ? id : "draw";
};

function useRoute() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const onChange = () => {
      setRoute(readRoute());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  const go = useCallback((id) => {
    window.location.hash = `/${id}`;
  }, []);
  return [route, go];
}

function useModels() {
  const [state, setState] = useState({ status: "loading", models: [], error: "" });

  const load = useCallback(() => {
    const controller = new AbortController();
    setState((prev) => ({ ...prev, status: "loading", error: "" }));

    fetchModels(controller.signal)
      .then((models) => setState({ status: "ready", models, error: "" }))
      .catch((err) => {
        if (err.name === "AbortError") return;
        setState({
          status: "error",
          models: [],
          error: err.message || "Could not reach the model server."
        });
      });

    return () => controller.abort();
  }, []);

  useEffect(() => load(), [load]);

  return { ...state, reload: load };
}

function App() {
  const [route, go] = useRoute();
  const { models, status, error, reload } = useModels();
  const [storedId, setStoredId] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const activeModel = useMemo(
    () => models.find((m) => m.id === storedId) || models[0] || null,
    [models, storedId]
  );

  const selectModel = useCallback((id) => {
    setStoredId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* storage unavailable, selection still works for this session */
    }
  }, []);

  const useModel = useCallback(
    (id) => {
      selectModel(id);
      go("draw");
    },
    [selectModel, go]
  );

  return (
    <div className="app">
      <div className="bg-bubbles" aria-hidden="true">
        <span className="bubble b1" />
        <span className="bubble b2" />
        <span className="bubble b3" />
        <span className="bubble b4" />
      </div>

      <header className="navbar">
        <a
          className="brand"
          href="#/draw"
          onClick={(e) => {
            e.preventDefault();
            go("draw");
          }}
        >
          <span className="brand-mark">あ</span>
          <span className="brand-text">
            <span className="brand-title">Kana Vision</span>
            <span className="brand-subtitle">Japanese character recognizer</span>
          </span>
        </a>

        <nav className="nav-links" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-link ${route === item.id ? "active" : ""}`}
              disabled={!item.enabled}
              title={item.enabled ? item.label : "Coming soon"}
              aria-current={route === item.id ? "page" : undefined}
              onClick={() => item.enabled && go(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {status === "error" ? (
          <button
            type="button"
            className="server-status status-error"
            onClick={reload}
            title="Retry connecting"
          >
            <span className="status-dot" />
            Backend offline · retry
          </button>
        ) : (
          <div className="server-status" role="status">
            <span className={`status-dot ${status === "loading" ? "busy" : ""}`} />
            {status === "loading"
              ? "Waking models..."
              : `${models.length} model${models.length === 1 ? "" : "s"} ready`}
          </div>
        )}
      </header>

      {/* Draw page stays mounted so your drawing survives a trip to Models. */}
      <div hidden={route !== "draw"}>
        <DrawPage
          models={models}
          status={status}
          activeModel={activeModel}
          onSelectModel={selectModel}
          onRetry={reload}
          onAbout={() => go("models")}
        />
      </div>

      {route === "models" && (
        <ModelsPage
          models={models}
          status={status}
          error={error}
          onRetry={reload}
          activeModelId={activeModel?.id}
          onUseModel={useModel}
        />
      )}
    </div>
  );
}

export default App;
