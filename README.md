# comfyui-p5js-node
Custom node for ComfyUI to run p5.js sketches and output single frames or animation sequences as `IMAGE` and `MASK` tensors.

## What this is

A lightweight node to render a p5.js canvas inside ComfyUI and pass single frames or multi-frame animations directly into image-to-image, ControlNet, masking, or video pipelines.

## What this isn't

A full-blown p5.js IDE. If a sketch throws a JavaScript error, the preview frame displays the error message, but full step-by-step debugging is best done in the p5.js Web Editor first.

## Installation

Clone this repository into your `ComfyUI/custom_nodes` directory:

```sh
git clone https://github.com/hellonearthis/comfyui-p5js-node.git
```

Restart ComfyUI and reload your browser tab.

## Tutorial Walkthrough

### 1. Add the node
1. Double-click the ComfyUI canvas (or right-click **Add Node**) and search for **`p5js image`** under the **`p5js`** category.
2. You will see:
   * **`script`** — multiline text box containing your p5.js code.
   * **`frame_count`** — number of frames to capture (`1` for a single image, `2–240` for an animation batch).
   * **`preset`** — dropdown to load saved `.js` sketches from `sketches/`.
   * **Save Preset** — saves the current `script` as a reusable `.js` preset in `sketches/`.
   * **Run Sketch** — renders the sketch in the live preview frame below.
   * Outputs: **`image`** (`IMAGE`) and **`mask`** (`MASK`, extracted from canvas alpha if transparent).

### 2. Write and preview a sketch (or pick a preset)
Select a starter preset from **`preset`** (such as `concentric_circles.js`, `transparent_mask.js`, or `animated_wave.js`) or paste a standard p5.js sketch into **`script`**, then click **Run Sketch**:

```javascript
function setup() {
  createCanvas(512, 512);
  noLoop();
}

function draw() {
  background(20);
  noStroke();
  for (let i = 0; i < 12; i++) {
    fill(40 + i * 18, 140, 240);
    circle(256, 256, 420 - i * 32);
  }
}
```

> **Tip:** If you forget to click **Run Sketch** before clicking **Queue Prompt**, the node automatically runs your current `script` and waits for the canvas before queuing.

### 3. Capture an animation batch (including seamless loops)
1. Write a sketch that uses `frameCount` (or pick a looping preset like `loop_orbiting_rings.js`, `loop_hypnotic_tunnel.js`, or `loop_lissajous_ribbon.js`).
2. Set **`frame_count`** to the number of frames you want (e.g. `48`).
3. Click **Queue Prompt**. The node steps through the sketch frame-by-frame and outputs a `[B, H, W, C]` image batch and `[B, H, W]` mask batch ready for video nodes (`CreateVideo` / `SaveVideo` / MiniMax H3 `ref_video`).

> **Seamless Loop Tip:** The preview frame exposes `window.COMFY_FRAME_COUNT` (set to your node's `frame_count` value). Compute normalized loop progress as:
> ```javascript
> const totalFrames = Math.max(2, window.COMFY_FRAME_COUNT || 48);
> const t = ((frameCount - 1) % totalFrames) / totalFrames; // 0.0 -> <1.0
> const angle = t * TWO_PI;
> ```
> When `t` completes a full `TWO_PI` cycle over `totalFrames`, the last frame transitions seamlessly back to frame 1.

### 4. Connect it to a workflow
* **Img2Img / Color Guide:** Connect **`image`** → `VAE Encode` → `KSampler` (`denoise` around `0.55–0.75`).
* **ControlNet / Composition Guide:** Connect **`image`** → a preprocessor (such as Canny or Depth) or directly into `Apply ControlNet` for clean geometric layouts.
* **Transparency / Alpha Mask:** Use `clear()` in `setup()` or `draw()` to leave parts of the canvas transparent. The **`mask`** output automatically captures the alpha channel so you can feed it into `Set Latent Noise Mask` or `InpaintModelConditioning`.

## How it works

* **Presets:** Saved as `.js` files inside `custom_nodes/comfyui-p5js-node/sketches/` and served via `/p5js/sketches` and `/p5js/sketch`.
* **Preview:** Clicking **Run Sketch** saves your code to `temp/p5js/<sketch>.js` and reloads the preview iframe.
* **Single or Batch Capture:** Clicking **Queue Prompt** captures 1 frame (or steps `frame_count` frames via `redraw()`), uploads the PNG(s) to `temp/p5js/`, and loads them into batched `IMAGE` and `MASK` tensors.
