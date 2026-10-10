# Japanese Character Recognizer — React Frontend

A React/Vite frontend for a Flask-based Japanese character CNN recognizer.

## Features

- Draw directly on a canvas.
- Pen, eraser, undo, clear.
- Tracks the bounding box of the user's strokes.
- On prediction, crops only the relevant drawing region with a small padding.
- Sends the cropped PNG as `multipart/form-data`.
- Animated result drawer enters from the right.
- Uses the complete prediction response:
  - predicted native character
  - romaji
  - confidence
  - ranked top-five alternatives
- Interactive alternative predictions.
- Responsive UI.

## Models

- On load the app calls `GET http://localhost:5000/models` and builds the UI from the response.
- **Draw page:** a model bar above the canvas lets you switch models; Predict posts to `/api/predict/<model-id>`. The choice is remembered in `localStorage`.
- **Models page (`#/models`):** a story-style breakdown of each model (dataset, input, preprocessing, output) plus a side-by-side comparison, all generated from the `/models` JSON. New models added in the backend appear automatically.
- Change the backend address with `VITE_API_ORIGIN` (e.g. in `.env`). CORS must be enabled for both `/models` and `/api/predict/*`.

## Flask API

The frontend posts to:

`POST http://localhost:5000/api/predict/<model-id>` (e.g. `rud-nano`)

The uploaded image is sent with this field name:

`image`

Example Flask access:

```python
image = request.files["image"]
```

If your backend expects a different key, change this line in `src/App.jsx`:

```javascript
formData.append("image", blob, "japanese-character.png");
```

## Run

Install Node.js, then:

```bash
npm install
npm run dev
```

Vite will print the local frontend URL, usually:

`http://localhost:5173`

## CORS

Because React and Flask normally run on different ports, your Flask server must allow the frontend origin.

For development, if you use Flask-CORS:

```python
from flask_cors import CORS

CORS(app, origins=["http://localhost:5173"])
```

If you don't want Flask-CORS, configure the appropriate CORS headers in your Flask application.

## Expected response

The frontend expects JSON shaped like:

```json
{
  "confidence": 95.13408660888672,
  "native": "あ",
  "predicted_index": 0,
  "romaji": "aa",
  "top_five": {
    "1": {
      "class_names": "aa",
      "native": "あ",
      "prediction": 95.13408660888672,
      "rank": 1
    }
  }
}
```

## Important image-processing note

The frontend crops the actual canvas bounding box before uploading. This reduces irrelevant blank canvas pixels.

The current crop adds 28px padding around the detected stroke bounds. If your CNN expects a specific image size, normalization, inversion, or centered square input, keep that preprocessing in your Flask/CNN pipeline.
