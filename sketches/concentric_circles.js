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
