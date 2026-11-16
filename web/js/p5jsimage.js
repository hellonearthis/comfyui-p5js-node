import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";

const P5JS_PREVIEW_SRC = new URL("../preview/index.html", import.meta.url).href;
const DEFAULT_WIDGET_WIDTH = 512;
const DEFAULT_WIDGET_HEIGHT = 400;
const CANVAS_POLL_INTERVAL_MS = 50;
const CANVAS_WAIT_TIMEOUT_MS = 5000;
const NONE_PRESET_OPTION = "(none)";
const MAX_FRAME_COUNT = 240;

function formatSketchFilename(date, randomSuffix) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  return `${year}_${month}_${day}_${randomSuffix}`;
}

function buildPreviewUrl(baseUrl, sketchFilename) {
  return `${baseUrl}?sketch=${encodeURIComponent(`${sketchFilename}.js`)}`;
}

function buildTempUploadFormData(file, subfolder, overwrite) {
  const body = new FormData();
  body.append("image", file);
  body.append("subfolder", subfolder);
  body.append("type", "temp");
  if (overwrite) {
    body.append("overwrite", "true");
  }
  return body;
}

function clampFrameCount(rawValue) {
  const parsed = Number.parseInt(String(rawValue ?? 1), 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return 1;
  }
  return Math.min(parsed, MAX_FRAME_COUNT);
}

function buildPresetOptions(sketches) {
  return [NONE_PRESET_OPTION, ...sketches];
}

function findSketchCanvas(iframe) {
  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    return null;
  }
  return iframeDoc.getElementById("defaultCanvas0") || iframeDoc.querySelector("canvas");
}

function createPreviewContainer(iframe) {
  const container = document.createElement("div");
  Object.assign(container.style, {
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
    overflow: "hidden",
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: "4px",
  });
  container.appendChild(iframe);
  return container;
}

function createPreviewIframe(initialSrc) {
  const iframe = document.createElement("iframe");
  iframe.src = initialSrc;
  Object.assign(iframe.style, {
    width: "100%",
    height: "100%",
    border: "0",
    display: "block",
    background: "#1a1a1a",
  });
  return iframe;
}

async function uploadTempFile(file, overwrite) {
  const body = buildTempUploadFormData(file, "p5js", overwrite);
  const resp = await api.fetchApi("/upload/image", {
    method: "POST",
    body,
  });
  if (resp.status !== 200) {
    throw new Error(`Upload failed (${resp.status} ${resp.statusText})`);
  }
  return resp;
}

async function saveTempSketch(filename, srcCode) {
  const blob = new Blob([srcCode], { type: "text/plain" });
  const file = new File([blob], `${filename}.js`);
  return uploadTempFile(file, true);
}

async function fetchPresetList() {
  const resp = await api.fetchApi("/p5js/sketches");
  if (!resp.ok) {
    return [];
  }
  const data = await resp.json();
  return Array.isArray(data.sketches) ? data.sketches : [];
}

async function fetchPresetScript(name) {
  const resp = await api.fetchApi(`/p5js/sketch?name=${encodeURIComponent(name)}`);
  if (!resp.ok) {
    throw new Error(`Failed to load preset: ${name}`);
  }
  const data = await resp.json();
  return String(data.script ?? "");
}

async function savePresetScript(name, script) {
  const resp = await api.fetchApi("/p5js/sketch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, script }),
  });
  if (!resp.ok) {
    throw new Error(`Failed to save preset (${resp.status})`);
  }
  return resp.json();
}

function waitForCanvas(iframe, timeoutMs) {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const canvas = findSketchCanvas(iframe);
      if (canvas) {
        resolve(canvas);
        return;
      }
      if (Date.now() - startTime >= timeoutMs) {
        reject(new Error("p5.js sketch did not produce a canvas within timeout."));
        return;
      }
      setTimeout(check, CANVAS_POLL_INTERVAL_MS);
    };
    check();
  });
}

async function runSketchInIframe(iframe, sketchFilename, srcCode) {
  await saveTempSketch(sketchFilename, srcCode);
  const loaded = new Promise((resolve) => {
    iframe.addEventListener("load", () => resolve(), { once: true });
  });
  iframe.src = buildPreviewUrl(P5JS_PREVIEW_SRC, sketchFilename);
  await loaded;
  return waitForCanvas(iframe, CANVAS_WAIT_TIMEOUT_MS);
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to capture PNG from p5.js canvas."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

async function captureFrameSequence(iframe, sketchFilename, scriptText, frameCount) {
  const canvas = await runSketchInIframe(iframe, sketchFilename, scriptText);
  const batchId = Date.now();

  const captureOne = async (frameIndex) => {
    if (frameIndex > 0) {
      iframe.contentWindow?.__p5StepFrame?.();
    }
    const blob = await canvasToPngBlob(canvas);
    const filename = `${batchId}_${String(frameIndex).padStart(4, "0")}.png`;
    const file = new File([blob], filename, { type: "image/png" });
    await uploadTempFile(file, false);
    return `p5js/${filename} [temp]`;
  };

  const frameIndices = Array.from({ length: frameCount }, (_, idx) => idx);
  const uploadedPaths = await frameIndices.reduce(
    async (accPromise, idx) => [...(await accPromise), await captureOne(idx)],
    Promise.resolve([])
  );

  return JSON.stringify(uploadedPaths);
}

async function captureAndUploadCanvas(iframe, sketchFilename, getScriptText, getFrameCount) {
  const frameCount = clampFrameCount(getFrameCount());
  if (frameCount > 1) {
    return captureFrameSequence(iframe, sketchFilename, getScriptText(), frameCount);
  }

  const existingCanvas = findSketchCanvas(iframe);
  const canvas =
    existingCanvas || (await runSketchInIframe(iframe, sketchFilename, getScriptText()));
  const blob = await canvasToPngBlob(canvas);
  const imageFilename = `${Date.now()}.png`;
  const file = new File([blob], imageFilename, { type: "image/png" });
  await uploadTempFile(file, false);
  return `p5js/${imageFilename} [temp]`;
}

function createP5jsWidget(node, inputName) {
  const sketchFilename = formatSketchFilename(new Date(), Math.floor(Math.random() * 100000));
  const iframe = createPreviewIframe(P5JS_PREVIEW_SRC);
  const container = createPreviewContainer(iframe);

  const getScriptWidget = () => node.widgets?.find((w) => w.name === "script");
  const getScriptText = () => String(getScriptWidget()?.value ?? "");
  const getFrameCount = () => node.widgets?.find((w) => w.name === "frame_count")?.value ?? 1;

  const presetWidget = node.addWidget(
    "combo",
    "preset",
    NONE_PRESET_OPTION,
    (selectedName) => {
      if (!selectedName || selectedName === NONE_PRESET_OPTION) {
        return;
      }
      fetchPresetScript(selectedName)
        .then((script) => {
          const scriptWidget = getScriptWidget();
          if (scriptWidget) {
            scriptWidget.value = script;
          }
          return runSketchInIframe(iframe, sketchFilename, script);
        })
        .catch((err) => console.error("[comfyui-p5js-node]", err));
    },
    { values: [NONE_PRESET_OPTION] }
  );
  presetWidget.serializeValue = () => undefined;

  fetchPresetList()
    .then((sketches) => {
      presetWidget.options.values = buildPresetOptions(sketches);
    })
    .catch((err) => console.error("[comfyui-p5js-node]", err));

  const savePresetButton = node.addWidget("button", "Save Preset", "save_p5js_preset", () => {
    const defaultName =
      presetWidget.value && presetWidget.value !== NONE_PRESET_OPTION
        ? presetWidget.value
        : "my_sketch.js";
    const chosenName = window.prompt("Save p5.js preset as:", defaultName);
    if (!chosenName) {
      return;
    }
    savePresetScript(chosenName, getScriptText())
      .then((result) => {
        if (Array.isArray(result.sketches)) {
          presetWidget.options.values = buildPresetOptions(result.sketches);
        }
        if (result.name) {
          presetWidget.value = result.name;
        }
      })
      .catch((err) => console.error("[comfyui-p5js-node]", err));
  });
  savePresetButton.serializeValue = () => undefined;

  const runButton = node.addWidget("button", "Run Sketch", "run_p5js_sketch", () => {
    runSketchInIframe(iframe, sketchFilename, getScriptText()).catch((err) => {
      console.error("[comfyui-p5js-node]", err);
    });
  });
  runButton.serializeValue = () => undefined;

  const domWidget = node.addDOMWidget(inputName, "P5JS", container, {
    hideOnZoom: false,
  });

  domWidget.computeSize = (width) => [
    Math.max(Number(width) || DEFAULT_WIDGET_WIDTH, DEFAULT_WIDGET_WIDTH),
    DEFAULT_WIDGET_HEIGHT,
  ];

  domWidget.serializeValue = () =>
    captureAndUploadCanvas(iframe, sketchFilename, getScriptText, getFrameCount);

  return domWidget;
}

app.registerExtension({
  name: "HYPE_P5JSImage",
  getCustomWidgets() {
    return {
      P5JS(node, inputName) {
        return createP5jsWidget(node, inputName);
      },
    };
  },
});
