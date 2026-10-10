import cv2
import numpy as np
from PIL import Image
def preprocess_nano(image_bytes, target_size=43, canvas_size=64, thicken=0):
    if target_size > canvas_size:
        raise ValueError("target_size cannot be larger than canvas_size")

    # 1. Decode, keeping the alpha channel if there is one
    arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise ValueError("Could not decode image bytes")

    # 2. Flatten transparency onto white (canvas.toDataURL gives transparent PNGs)
    if img.ndim == 3 and img.shape[2] == 4:
        alpha = img[:, :, 3:4].astype(np.float32) / 255.0
        rgb = img[:, :, :3].astype(np.float32)
        img = (rgb * alpha + 255.0 * (1.0 - alpha)).astype(np.uint8)
    if img.ndim == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 3. Force dark strokes on a light background (matches training data)
    if np.median(img) < 127:
        img = 255 - img

    # 4. Binarize only to locate the character (strokes -> 255)
    _, binary = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    pts = cv2.findNonZero(binary)
    if pts is None:
        raise ValueError("No character detected in the image.")
    x, y, w, h = cv2.boundingRect(pts)

    # 5. Crop the grayscale image and stretch contrast (background -> 255, strokes -> 0)
    character = img[y:y + h, x:x + w]
    character = cv2.normalize(character, None, 0, 255, cv2.NORM_MINMAX)

    # 6. Scale the longest side to target_size, keeping aspect ratio
    scale = target_size / max(h, w)
    new_w = max(1, round(w * scale))
    new_h = max(1, round(h * scale))
    character = cv2.resize(character, (new_w, new_h), interpolation=cv2.INTER_AREA)

    # 7. Optional: thicken strokes if canvas drawings look thinner than training images
    if thicken > 0:
        character = cv2.erode(character, np.ones((2, 2), np.uint8), iterations=thicken)

    # 8. Center on a white canvas
    canvas = np.full((canvas_size, canvas_size), 255, np.uint8)
    xo = (canvas_size - new_w) // 2
    yo = (canvas_size - new_h) // 2
    canvas[yo:yo + new_h, xo:xo + new_w] = character

    # 9. Normalize and add batch + channel dims -> (1, 64, 64, 1)
    return (canvas.astype(np.float32) / 255.0).reshape(1, canvas_size, canvas_size, 1)


def preprocess_lite(image,target_size):
    # 1. Open as grayscale
    img = cv2.imdecode(
        np.frombuffer(image,np.uint8),
        cv2.IMREAD_GRAYSCALE)

    if img is None:
        raise ValueError("Failed to decode image")
    
    img_array=img
    # 3. Find non-white pixels
    # Adjust threshold if necessary
    mask = img_array < 240

    # 4. Find bounding box of character
    coords = np.argwhere(mask)

    if coords.size == 0:
        raise ValueError("No character detected")

    y_min, x_min = coords.min(axis=0)
    y_max, x_max = coords.max(axis=0)

    # 5. Crop character
    cropped_array = img[y_min:y_max + 1, x_min:x_max + 1]
    cropped = Image.fromarray(cropped_array)

    # 6. Add some padding
    w, h = cropped.size
    padding = int(max(w, h) * 0.2)
    canvas_size = max(w, h) + 2 * padding

    canvas = Image.new("L", (canvas_size, canvas_size), 255)

    x = (canvas_size - w) // 2
    y = (canvas_size - h) // 2

    canvas.paste(cropped, (x, y))

    # 7. Resize to model input
    canvas = canvas.resize((28, 28), Image.Resampling.LANCZOS)

    # 8. Convert to numpy
    img_array = np.array(canvas).astype("float32")/255.0
    img_array = 1-img_array

    # 10. Add channel dimension
    img_array = np.expand_dims(img_array, axis=-1)

    # 11. Add batch dimension
    img_array = np.expand_dims(img_array, axis=0)

    return img_array