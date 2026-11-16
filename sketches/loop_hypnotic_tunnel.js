// Seamless zooming tunnel loop over COMFY_FRAME_COUNT frames
function setup() {
  createCanvas(512, 512);
}

function draw() {
  const totalFrames = Math.max(2, window.COMFY_FRAME_COUNT || 48);
  const t = ((frameCount - 1) % totalFrames) / totalFrames;
  const layers = 12;

  background(10, 12, 22);
  translate(width / 2, height / 2);
  rectMode(CENTER);
  noFill();

  for (let i = 0; i < layers; i++) {
    const progress = (i / layers + t) % 1.0;
    const size = pow(progress, 1.8) * 580;
    const alpha = sin(progress * PI) * 255;

    push();
    rotate(progress * PI * 0.5 + t * TWO_PI * 0.25);
    stroke(80 + progress * 170, 210, 255, alpha);
    strokeWeight(1.5 + progress * 4);
    rect(0, 0, size, size, 16 * progress);
    pop();
  }
}
