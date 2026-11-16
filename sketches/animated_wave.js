function setup() {
  createCanvas(512, 512);
}

function draw() {
  background(16, 18, 28);
  noFill();
  strokeWeight(3);
  const t = frameCount * 0.12;
  for (let i = 0; i < 10; i++) {
    stroke(80 + i * 16, 180, 255 - i * 12);
    beginShape();
    for (let x = 0; x <= width; x += 16) {
      const y = height / 2 + sin(x * 0.02 + t + i * 0.4) * (60 + i * 8);
      vertex(x, y);
    }
    endShape();
  }
}
