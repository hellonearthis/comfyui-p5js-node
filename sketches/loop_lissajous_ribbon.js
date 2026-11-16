// Seamless Lissajous ribbon loop over COMFY_FRAME_COUNT frames
function setup() {
  createCanvas(512, 512);
}

function draw() {
  const totalFrames = Math.max(2, window.COMFY_FRAME_COUNT || 48);
  const t = ((frameCount - 1) % totalFrames) / totalFrames;
  const phase = t * TWO_PI;

  background(14, 14, 24);
  translate(width / 2, height / 2);
  noFill();

  const points = 160;
  for (let r = 0; r < 5; r++) {
    stroke(100 + r * 35, 160 + r * 15, 255 - r * 20, 210);
    strokeWeight(3.5 - r * 0.5);
    beginShape();
    for (let i = 0; i <= points; i++) {
      const u = (i / points) * TWO_PI;
      const x = sin(3 * u + phase + r * 0.2) * 190;
      const y = sin(2 * u - phase * 1.0 + r * 0.15) * 190;
      vertex(x, y);
    }
    endShape(CLOSE);
  }
}
