"""Match catalog photos using normalized color and spatial appearance."""
import base64
import io
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1] / "frontend/public/products"


def descriptor(image):
    image.thumbnail((192, 192))
    rgba = image.convert("RGBA")
    canvas = Image.new("RGB", rgba.size, "white")
    canvas.paste(rgba, mask=rgba.getchannel("A"))
    square = ImageOps.pad(canvas, (32, 32), color="white")
    pixels = np.asarray(square, dtype=float) / 255
    hist = np.concatenate([np.histogram(channel, bins=12, range=(0, 1))[0]
                           for channel in pixels.transpose(2, 0, 1)]) / 1024
    return pixels, hist


def visual_search(encoded, products):
    try:
        with Image.open(io.BytesIO(base64.b64decode(encoded, validate=True))) as photo:
            if max(photo.size) > 1024:
                raise ValueError("Photo exceeds the search size limit")
            query, colors = descriptor(ImageOps.exif_transpose(photo))
    except (OSError, ValueError, Image.DecompressionBombError):
        return {"error": "Choose a valid product photo."}
    scores = []
    cache = {}
    for product in products:
        src = product.get("image") or ""
        if not src.startswith("/products/"):
            continue
        path = (ROOT / src[len("/products/"):]).resolve()
        if not path.is_relative_to(ROOT) or not path.is_file():
            continue
        if path not in cache:
            try:
                with Image.open(path) as image:
                    pixels, hist = descriptor(image)
                cache[path] = np.mean(abs(query - pixels)) + np.mean(abs(colors - hist))
            except (OSError, ValueError):
                continue
        scores.append((cache[path], product["slug"]))
    return {"matches": [slug for _, slug in sorted(scores)[:5]]}
