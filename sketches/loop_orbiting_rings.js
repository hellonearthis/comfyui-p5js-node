// Seamless loop over COMFY_FRAME_COUNT frames (falls back to 48 standalone)
function setup() {
  createCanvas(512, 512);
}

function draw() {
  const totalFrames = Math.max(2, window.COMFY_FRAME_COUNT || 48);
  const t = ((frameCount - 1) % totalFrames) / totalFrames;
  const angle = t * TWO_PI;

  background(12, 16, 28);
  translate(width / 2, height / 2);
  noFill();
  strokeWeight(3);

  for (let i = 0; i < 10; i++) {
    const dir = i % 2 === 0 ? 1 : -1;
    const radius = 56 + i * 20;
    stroke(60 + i * 18, 175, 255 - i * 12);

    push();
    rotate(angle * dir * (1 + (i % 3)));
    arc(0, 0, radius * 2, radius * 2, 0, PI * 1.45);
    pop();

    const orbX = cos(angle * dir + i * 0.6) * radius;
    const orbY = sin(angle * dir + i * 0.6) * radius;
    fill(255, 220, 120);
    noStroke();
    circle(orbX, orbY, 8);
    noFill();
    strokeWeight(3);
  }
}
