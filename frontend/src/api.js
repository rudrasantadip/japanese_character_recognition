// Backend location. Override with VITE_API_ORIGIN in a .env file if needed.
export const API_ORIGIN =
  import.meta.env.VITE_API_ORIGIN || "http://localhost:5000";

export const MODELS_URL = `${API_ORIGIN}/models`;
export const predictUrl = (modelId) =>
  `${API_ORIGIN}/api/predict/${encodeURIComponent(modelId)}`;

// GET /models returns an object keyed by model id. We turn it into an array
// of { id, ...info } so the UI can map over it and stay data-driven.
export async function fetchModels(signal) {
  const response = await fetch(MODELS_URL, { signal });
  if (!response.ok) {
    throw new Error(`Model list request failed (HTTP ${response.status}).`);
  }
  const data = await response.json();
  return Object.entries(data).map(([id, info]) => ({ id, ...info }));
}

export async function predictWith(modelId, blob) {
  const formData = new FormData();
  // Flask endpoint expects the uploaded image under "image".
  formData.append("image", blob, "japanese-character.png");

  const response = await fetch(predictUrl(modelId), {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      text || `Prediction server returned HTTP ${response.status}`
    );
  }
  return response.json();
}
