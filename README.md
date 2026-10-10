# Japanese Character Recognizer

A Japanese handwritten character recognition system built from scratch.

Draw a character in the browser and a custom **Convolutional Neural Network (CNN)** reads it. No pre-trained or existing machine-learning models are used. The frontend is built with **React**, and **Flask** serves the models and the prediction API.

## Current Status

- Hiragana recognition with **two selectable models** (Rud Lite and Rud Nano)
- Draw a character directly in the browser, with pen, eraser, undo and clear
- Switch models from a toolbar on the drawing page, then predict
- A dedicated **Models page** that explains each model (dataset, input, preprocessing, output) using data fetched from the backend
- Download links for the model files
- Top-5 predictions with confidence, native character and romaji
- Custom CNNs trained from scratch
- Image preprocessing before prediction
- REST API for model discovery, prediction and download

## The Models

| | Rud Lite | Rud Nano |
|---|---|---|
| Model id | `rud-lite` | `rud-nano` |
| Input | 28 × 28 grayscale | 64 × 64 grayscale |
| Dataset | [Kuzushiji-49](https://github.com/rois-codh/kmnist) (K49) | [Handwritten Japanese Hiragana Characters](https://www.kaggle.com/datasets/farukece/handwritten-japanese-hiragana-characters) (Kaggle) |
| Preprocessing | `preprocess_lite` | `preprocess_nano` |
| Label file | `hiragana_classes_lite.csv` | `hiragana_classes_nano.csv` |
| Output | Softmax, multiclass | Softmax, multiclass |

Both models share the same preprocessing ideas: threshold, crop to the character, add padding, center, resize, invert colors and normalize to 0–1. The exact settings for each model are published by the backend at `GET /models`, and the Models page in the frontend is generated from that response.

## Tech Stack

### Frontend
- React 18 and Vite
- JavaScript, HTML/CSS
- Canvas API for drawing and for rendering the pixel previews
- `lucide-react` for icons

### Backend
- Python
- Flask
- OpenCV
- NumPy
- Custom CNNs

### Machine Learning
- Convolutional Neural Networks (CNNs)
- Trained specifically for handwritten Hiragana
- No pre-trained models

## Architecture

```text
                    User
                     |
                     v
             +----------------+
             | React Frontend |
             |                |
             | Draw page      |
             | Models page    |
             +---+--------+---+
                 |        |
     GET /models |        | POST /api/predict/<model-id>
                 v        v
             +----------------+
             | Flask Backend  |
             |                |
             | Model registry |
             | REST API       |
             +-------+--------+
                     |
                     v
             +----------------+
             | Preprocessing  |
             | (per model)    |
             | OpenCV / NumPy |
             +-------+--------+
                     |
                     v
             +----------------+
             | Selected CNN   |
             | rud-lite or    |
             | rud-nano       |
             +-------+--------+
                     |
                     v
             +----------------+
             | Prediction     |
             | Top-5 classes  |
             +-------+--------+
                     |
                     v
                React UI
```

### 1. React Frontend

The frontend has two pages, switched with a hash route (`#/draw` and `#/models`).

**Draw page**
- A canvas for drawing one character.
- A model bar above the canvas to choose the model. The choice is remembered in `localStorage`.
- Only the area around the strokes is cropped and sent to the backend.
- Results appear in a drawer: best match, confidence and the top five alternatives.
- The drawing is kept when you visit the Models page and come back.

**Models page**
- Cards for every model returned by `GET /models`, each showing the character at the model's real input resolution.
- A four-chapter story for the selected model: what it studied, how it sees, how your drawing is prepared, and what it says back.
- A side-by-side comparison table when more than one model is available.
- A download button for each model.
- Models added in the backend appear automatically. Fields that are `null` are shown as "Not published".

```text
User Drawing
     ↓
Canvas (cropped to the strokes)
     ↓
PNG image + chosen model id
     ↓
POST /api/predict/<model-id>
```

### 2. Flask Backend

Flask is the API layer between the frontend and the neural networks. It keeps a registry of models, and each entry points to a model file, a label file and a preprocessing function.

```text
POST /api/predict/<model-id>
      ↓
Look up the model
      ↓
Receive image ("image" form field)
      ↓
Run that model's preprocessing
      ↓
CNN prediction
      ↓
Return top-5 predictions as JSON
```

### 3. Image Preprocessing

The raw drawing cannot be passed straight to a network. Each model has its own preprocessing function so the input matches its training data (size, color inversion and normalization).

```text
Input Image
    ↓
Threshold (treat near-white as paper)
    ↓
Crop to the character
    ↓
Add padding
    ↓
Center the character
    ↓
Resize (28×28 or 64×64)
    ↓
Invert colors
    ↓
Normalize to 0–1
    ↓
Tensor [1, H, W, 1]
```

### 4. CNN Architecture

Each model is a custom Convolutional Neural Network for handwritten character classification:

```text
Input Image
     ↓
Convolution → Activation → Pooling
     ↓
Convolution → Activation → Pooling
     ↓
Flatten
     ↓
Fully Connected Layer
     ↓
Softmax Output
```

- **Convolutional layers** learn strokes, curves, edges and how they relate spatially.
- **Pooling layers** shrink the spatial size while keeping the important features.
- **Fully connected layers** perform the final classification.
- The **softmax output** spreads 100% of the confidence across the available classes. The highest score is the recognized character.

## Why CNN?

CNNs learn spatial patterns from images automatically. For handwritten Japanese characters that includes:

- Stroke direction and structure
- Curves and edges
- Intersections
- Relative position of strokes
- Overall character shape

Instead of defining those features by hand, the network learns them during training.

## API Reference

Base URL (development): `http://localhost:5000`

CORS must be enabled for these routes so the Vite dev server can call them.

### `GET /models`

Returns an object keyed by model id. Abbreviated example:

```json
{
  "rud-nano": {
    "display_name": "Rud Nano",
    "version": "1.0.0",
    "task": "handwritten_hiragana_classification",
    "dataset": { "name": "Hiragana Images", "source": "Kaggle", "url": "..." },
    "input": { "width": 64, "height": 64, "channels": 1, "invert_colors": true,
               "normalization": "zero_to_one", "shape": [null, 64, 64, 1] },
    "preprocessing": { "function": "preprocess_nano", "crop_character": true,
                       "add_padding": true, "center_character": true,
                       "resize": [64, 64], "threshold": 240 },
    "output": { "activation": "softmax", "label": "hiragana_classes_nano.csv", "size": 64 }
  }
}
```

An optional `download_url` field on a model overrides the default download path.

### `POST /api/predict/<model-id>`

Send `multipart/form-data` with the drawing under the field name `image`.

```python
image = request.files["image"]
```

The response contains the predicted character (`native`), `romaji`, `confidence`, `predicted_index`, and a `top_five` object with ranked alternatives.

### `GET /models/<model-id>/download`

Returns the model file as an attachment. The frontend's Download buttons link here, unless the model's JSON provides a `download_url`.

Example Flask route (adjust the file names and paths to your setup):

```python
from flask import abort, send_from_directory

MODEL_FILES = {
    "rud-lite": "rud_lite.keras",
    "rud-nano": "rud_nano.keras",
}
MODEL_DIR = "model"

@app.get("/models/<model_id>/download")
def download_model(model_id):
    filename = MODEL_FILES.get(model_id)
    if not filename:
        abort(404)
    return send_from_directory(MODEL_DIR, filename, as_attachment=True)
```

Keep the lookup table (instead of building paths from user input) so only the listed files can ever be served.

## Project Structure

```text
japanese-character-recognizer/
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # navbar, hash routing, model loading
│   │   ├── api.js                  # /models, predict and download URLs
│   │   ├── modelUtils.js           # small helpers for model info
│   │   ├── components/
│   │   │   └── ModelBar.jsx        # model selector above the canvas
│   │   ├── pages/
│   │   │   ├── DrawPage.jsx        # canvas, prediction, result drawer
│   │   │   └── ModelsPage.jsx      # model story and comparison
│   │   └── styles.css
│   ├── package.json
│   └── ...
│
├── backend/
│   ├── app.py
│   ├── preprocessing.py            # preprocess_lite, preprocess_nano
│   ├── model/                      # trained model files and label CSVs
│   └── ...
│
├── dataset/
│
├── README.md
└── ...
```

The exact structure may vary depending on the development setup.

## Running the Project

### Backend

Create and activate a Python virtual environment:

```bash
python -m venv .venv
```

Windows:

```bash
.venv\Scripts\activate
```

macOS / Linux:

```bash
source .venv/bin/activate
```

Install the dependencies and start the server:

```bash
pip install -r requirements.txt
python app.py
```

The backend listens on `http://localhost:5000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the address (usually `http://localhost:5173`).



## Prediction Flow

When a user draws a character:

```text
       User
        |
        v
   Choose a model (toolbar)
        |
        v
   Draw Hiragana
        |
        v
   React Canvas (crop around strokes)
        |
        v
   POST /api/predict/<model-id>
        |
        v
   Flask API
        |
        v
   Model-specific preprocessing
        |
        v
   Selected CNN
        |
        v
   Top-5 predictions (JSON)
        |
        v
   Result drawer in React
```

## Datasets

- **Rud Lite** uses [Kuzushiji-49](https://github.com/rois-codh/kmnist) (28 × 28 grayscale, 49 classes).
- **Rud Nano** uses [Handwritten Japanese Hiragana Characters](https://www.kaggle.com/datasets/farukece/handwritten-japanese-hiragana-characters) from Kaggle.
