/* sound.js — tiny WebAudio synth (no audio files). */
let ctx = null, on = true;
try { on = localStorage.getItem("pct.sound") !== "0"; } catch (e) {}
const ac = () => { if (!ctx) { if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return null; try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (ctx && ctx.state === "suspended") ctx.resume(); return ctx; };
function tone(f, d, type = "sine", vol = 0.12, when = 0, slide = 0) {
  const c = ac(); if (!c || !on) return;
  const t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + 0.02);
}
function noise(d, vol = 0.3, hp = 600) {
  const c = ac(); if (!c || !on) return;
  const n = Math.floor(c.sampleRate * d), b = c.createBuffer(1, n, c.sampleRate), x = b.getChannelData(0);
  for (let i = 0; i < n; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.2);
  const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
  f.type = "highpass"; f.frequency.value = hp; g.gain.value = vol; s.buffer = b; s.connect(f).connect(g).connect(c.destination); s.start();
}
export const Sound = {
  get on() { return on; },
  set(v) { on = !!v; try { localStorage.setItem("pct.sound", on ? "1" : "0"); } catch (e) {} },
  unlock() { ac(); },
  tick() { tone(880, 0.05, "square", 0.04); },
  flip() { tone(300, 0.14, "triangle", 0.08, 0, 500); },
  step() { tone(140, 0.07, "sine", 0.06); },
  lock() { tone(520, 0.08, "square", 0.06); tone(780, 0.1, "square", 0.06, 0.07); },
  shot() { noise(0.28, 0.5, 400); tone(120, 0.22, "sawtooth", 0.2, 0, -80); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, "triangle", 0.1, i * 0.09)); },
  lose() { [392, 330, 262].forEach((f, i) => tone(f, 0.28, "sawtooth", 0.07, i * 0.12)); },
  coin() { tone(988, 0.07, "square", 0.06); tone(1319, 0.2, "square", 0.06, 0.07); },
};
