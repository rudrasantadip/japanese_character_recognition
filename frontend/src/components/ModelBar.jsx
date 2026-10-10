import React from "react";
import { Cpu, Info, RefreshCw } from "lucide-react";
import { dims, shortName } from "../modelUtils";

export default function ModelBar({
  models,
  status,
  activeModelId,
  onSelect,
  onRetry,
  onAbout
}) {
  return (
    <div className="model-bar" role="group" aria-label="Choose a model">
      <span className="model-bar-label">
        <Cpu size={18} /> Model
      </span>

      <div className="model-options">
        {status === "loading" && <span className="model-note">Loading models…</span>}

        {status === "error" && (
          <button type="button" className="model-retry" onClick={onRetry}>
            <RefreshCw size={15} /> Couldn’t load models — retry
          </button>
        )}

        {status === "ready" &&
          models.map((model) => {
            const { w, h } = dims(model);
            const active = model.id === activeModelId;
            return (
              <button
                key={model.id}
                type="button"
                className={`model-option ${active ? "active" : ""}`}
                aria-pressed={active}
                onClick={() => onSelect(model.id)}
              >
                <span className="model-radio" aria-hidden="true" />
                <span className="model-option-name">{shortName(model)}</span>
                <small>{w}×{h}</small>
              </button>
            );
          })}
      </div>

      <button type="button" className="model-info-link" onClick={onAbout}>
        <Info size={15} /> About models
      </button>
    </div>
  );
}
