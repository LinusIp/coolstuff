// Placeholder: a single neuron learning y = x > 0.5, trained live so the
// template shows the "make the model visible" loop end to end.
const canvas = document.querySelector<HTMLCanvasElement>('#viz')!;
const ctx = canvas.getContext('2d')!;
let w = Math.random() - 0.5;
let b = 0;
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

function step(): void {
  for (let i = 0; i < 32; i++) {
    const x = Math.random();
    const y = x > 0.5 ? 1 : 0;
    const p = sigmoid(w * 10 * x + b);
    w -= 0.05 * (p - y) * x * 10;
    b -= 0.05 * (p - y);
  }
  ctx.clearRect(0, 0, 320, 320);
  for (let px = 0; px < 320; px += 4) {
    const p = sigmoid(w * 10 * (px / 320) + b);
    ctx.fillStyle = `hsl(${200 - p * 160} 80% 55%)`;
    ctx.fillRect(px, 320 - p * 300, 4, p * 300);
  }
  requestAnimationFrame(step);
}
requestAnimationFrame(step);
