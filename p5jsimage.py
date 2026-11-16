import json
import os
import re

import folder_paths
import nodes
import torch
from aiohttp import web
from server import PromptServer

SKETCHES_DIR = os.path.realpath(os.path.join(os.path.dirname(__file__), "sketches"))
SAFE_NAME_RE = re.compile(r"[^a-zA-Z0-9._-]+")


def _ensure_sketches_dir() -> str:
    os.makedirs(SKETCHES_DIR, exist_ok=True)
    return SKETCHES_DIR


def _sanitize_sketch_name(raw_name: str) -> str:
    base = os.path.basename(str(raw_name).strip())
    cleaned = SAFE_NAME_RE.sub("_", base).strip("._")
    if not cleaned:
        return ""
    if not cleaned.endswith(".js"):
        cleaned = f"{cleaned}.js"
    return cleaned


def _resolve_sketch_path(raw_name: str) -> str | None:
    safe_name = _sanitize_sketch_name(raw_name)
    if not safe_name:
        return None
    root = _ensure_sketches_dir()
    candidate = os.path.realpath(os.path.join(root, safe_name))
    if not candidate.startswith(root + os.sep):
        return None
    return candidate


def _list_sketches() -> list[str]:
    root = _ensure_sketches_dir()
    return sorted(
        entry
        for entry in os.listdir(root)
        if entry.endswith(".js") and os.path.isfile(os.path.join(root, entry))
    )


def _parse_image_paths(image_value: str) -> list[str]:
    raw = str(image_value or "").strip()
    if raw.startswith("["):
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return [str(item) for item in parsed if item]
    return [raw] if raw else []


def _register_routes() -> None:
    server = getattr(PromptServer, "instance", None)
    if server is None:
        return

    @server.routes.get("/p5js/sketches")
    async def list_p5js_sketches(request):
        return web.json_response({"sketches": _list_sketches()})

    @server.routes.get("/p5js/sketch")
    async def get_p5js_sketch(request):
        name = request.query.get("name", "")
        path = _resolve_sketch_path(name)
        if path is None or not os.path.isfile(path):
            return web.json_response({"error": "Sketch not found"}, status=404)
        with open(path, "r", encoding="utf-8") as handle:
            return web.json_response({"name": os.path.basename(path), "script": handle.read()})

    @server.routes.post("/p5js/sketch")
    async def save_p5js_sketch(request):
        data = await request.json()
        path = _resolve_sketch_path(data.get("name", ""))
        if path is None:
            return web.json_response({"error": "Invalid sketch name"}, status=400)
        script = str(data.get("script", ""))
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(script)
        return web.json_response(
            {"status": "ok", "name": os.path.basename(path), "sketches": _list_sketches()}
        )


_register_routes()


class HYPE_P5JSImage(nodes.LoadImage):
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "script": (
                    "STRING",
                    {
                        "default": (
                            "function setup() {\n"
                            "  createCanvas(512, 512);\n"
                            "}\n\n"
                            "function draw() {\n"
                            "  background(220);\n"
                            "}"
                        ),
                        "multiline": True,
                        "dynamicPrompts": False,
                    },
                ),
                "image": ("P5JS", {}),
            },
            "optional": {
                "frame_count": ("INT", {"default": 1, "min": 1, "max": 240, "step": 1}),
            },
        }

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float("nan")

    @classmethod
    def VALIDATE_INPUTS(cls, image, **kwargs):
        paths = _parse_image_paths(image)
        if not paths:
            return "Invalid or missing p5.js canvas image."
        for item in paths:
            if not folder_paths.exists_annotated_filepath(item):
                return f"Invalid or missing p5.js canvas image: {item}"
        return True

    RETURN_TYPES = ("IMAGE", "MASK")
    RETURN_NAMES = ("image", "mask")
    FUNCTION = "run"
    CATEGORY = "p5js"

    def run(self, script, image, frame_count=1, **kwargs):
        paths = _parse_image_paths(image)
        if len(paths) == 1:
            return super().load_image(paths[0])

        frames = [super(HYPE_P5JSImage, self).load_image(item) for item in paths]
        images = torch.cat([img for img, _ in frames], dim=0)
        masks = torch.cat([mask for _, mask in frames], dim=0)
        return (images, masks)
