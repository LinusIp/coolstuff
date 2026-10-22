// Browsers only allow audio after a user gesture, so the context is created on tap.
let ctx: AudioContext | null = null;

document.querySelector('#start')!.addEventListener('click', () => {
  ctx ??= new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  // A limiter-ish master keeps phone speakers from clipping.
  const comp = ctx.createDynamicsCompressor();
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1);
  osc.connect(gain).connect(comp).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 1);
});
