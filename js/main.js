/* main.js — one human (seat 0) + four identical NPCs in the canteen. Roles reshuffle every round. */
import * as Rules from "./rules.js";
import { createScene } from "./scene.js";
import { Sound } from "./sound.js";

const $ = (s) => document.querySelector(s);
const SEATS = [
  { seatId: 0, name: "You",   isHuman: true,  score: 0 },
  { seatId: 1, name: "Ada",   isHuman: false, score: 0 },
  { seatId: 2, name: "Chidi", isHuman: false, score: 0 },
  { seatId: 3, name: "Ngozi", isHuman: false, score: 0 },
  { seatId: 4, name: "Emeka", isHuman: false, score: 0 },
];
const META = {
  king:     { ico: "👑", color: "#ffcf5a" }, queen: { ico: "👸", color: "#ff8ad8" }, minister: { ico: "🎩", color: "#9d8cff" },
  police:   { ico: "👮", color: "#4cc3ff" }, thief: { ico: "🦹", color: "#ff4d5e" },
};
const OUTFITS = {
  "Canteen casual": {},
  "Street":  { topStyle: "hoodie", topColor: "#374151", bottomStyle: "cargo", bottomColor: "#1f2937", shoeStyle: "sneakers", shoeColor: "#e5e7eb" },
  "Smart":   { topStyle: "polo", topColor: "#0f766e", bottomStyle: "jeans", bottomColor: "#1e293b", shoeStyle: "formal", shoeColor: "#111827" },
  "Naija":   { topStyle: "dashiki", topColor: "#b45309", topPattern: "ankara", bottomStyle: "baggy", bottomColor: "#1f2937" },
  "Sport":   { topStyle: "jersey", topColor: "#dc2626", bottomStyle: "shorts", bottomColor: "#111827", shoeStyle: "sneakers" },
};
const K = { scores: "pct.scores.v1", hist: "pct.hist.v1", outfit: "pct.outfit.v1", haptics: "pct.haptics", help: "pct.seenHelp" };
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const buzz = (p) => { if (load(K.haptics, true) && navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} };

let seats = SEATS.map((s) => ({ ...s }));
const sv = load(K.scores, null); if (sv && sv.length === seats.length) seats.forEach((s, i) => (s.score = +sv[i] || 0));
let history = load(K.hist, []);
let outfitName = load(K.outfit, "Canteen casual"); if (!OUTFITS[outfitName]) outfitName = "Canteen casual";
let roundNo = 0, round = null, policeSeat = -1;

/* ── scene ── */
let world;
try { world = createScene($("#stage"), seats.map((s) => s.name), OUTFITS[outfitName]); }
catch (e) { console.error(e); $("#loading").innerHTML = "<b>Sorry — this device can't start 3D (WebGL unavailable).</b>"; throw e; }
setTimeout(() => $("#loading").classList.add("done"), 700);

/* ── UI helpers ── */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function prompt(t) { const p = $("#prompt"); p.textContent = t; p.classList.remove("swap"); void p.offsetWidth; p.classList.add("swap"); }
function toast(t) { const d = document.createElement("div"); d.className = "toast"; d.textContent = t; $("#toasts").appendChild(d); setTimeout(() => d.remove(), 2700); }
function step(s) {
  const order = ["deal", "police", "shot", "result"], at = order.indexOf(s);
  document.querySelectorAll("#steps li").forEach((li) => { const i = order.indexOf(li.dataset.s); li.classList.toggle("on", i === at); li.classList.toggle("done", i < at); });
}
const shown = {};
function renderBoard(list, polId = -1, bumpId = -1) {
  const top = Math.max(...list.map((s) => s.score));
  $("#board").innerHTML = list.map((s) => `<div class="chip${s.isHuman ? " you" : ""}${top > 0 && s.score === top ? " lead" : ""}${s.seatId === polId ? " pol" : ""}${s.seatId === bumpId ? " bump" : ""}" data-id="${s.seatId}">
    <span class="av">${s.name[0]}</span><span><div class="nm">${s.name}</div><div class="sc" data-to="${s.score}">${shown[s.seatId] ?? s.score}</div></span></div>`).join("");
  list.forEach((s) => {
    const el = document.querySelector(`.chip[data-id="${s.seatId}"] .sc`), from = shown[s.seatId] ?? s.score; shown[s.seatId] = s.score;
    if (from === s.score || !el) return;
    const t0 = performance.now();
    (function tick() { const t = Math.min(1, (performance.now() - t0) / 900); el.textContent = Math.round(from + (s.score - from) * t); if (t < 1) requestAnimationFrame(tick); })();
  });
}
function popup(seatId, text) {
  const p = world.screenPos(seatId), d = document.createElement("div"); d.className = "pop"; d.textContent = text;
  d.style.left = p.x + "px"; d.style.top = p.y + "px"; document.body.appendChild(d); setTimeout(() => d.remove(), 1700);
}

/* ── role card: hold to peek (tap toggles) ── */
const card = $("#rolecard"); let held = 0, locked = false;
function setCard(role) {
  const m = META[role.id]; card.style.setProperty("--rc", m.color);
  $("#r-ico").textContent = m.ico; $("#r-name").textContent = role.label; $("#r-pts").textContent = `Worth ${role.points} pts`;
  card.classList.remove("peek", "nodeal"); locked = false;
}
const peek = (on) => { if (card.classList.contains("peek") !== on) { card.classList.toggle("peek", on); Sound.flip(); } };
card.addEventListener("pointerdown", (e) => { e.preventDefault(); Sound.unlock(); held = performance.now(); peek(true); });
card.addEventListener("pointerup", () => { if (performance.now() - held < 260) { locked = !locked; peek(locked); } else if (!locked) peek(false); });
card.addEventListener("pointerleave", () => { if (!locked) peek(false); });
card.addEventListener("pointercancel", () => { if (!locked) peek(false); });

/* ── buttons ── */
let nextResolve = null;
const nextBtn = $("#next");
nextBtn.onclick = () => { Sound.unlock(); Sound.tick(); nextBtn.hidden = true; if (nextResolve) { const r = nextResolve; nextResolve = null; r(); } };
$("#fire").onclick = () => world.confirmFire();

/* ── the round ── */
async function playRound() {
  roundNo++; locked = false; peek(false); card.classList.add("nodeal");
  world.clearTags(); hideResult(); step("deal"); world.clearPapers();
  prompt("Spreading the folded papers…");
  await world.spreadPapers();
  prompt("Pick any folded paper — tap one to take it.");
  const pick = await world.pickPaper(); Sound.flip(); buzz(15);
  round = Rules.createRound(seats, Math.random, pick);
  prompt("Papers going round…");
  const me = round.seats.find((s) => s.isHuman), youPolice = round.police.isHuman;
  policeSeat = round.police.seatId;
  renderBoard(seats);
  setCard(me.role);
  await world.dealRest(pick); Sound.flip();
  prompt(`Round ${roundNo} — everyone has a paper. Hold your card to peek.`);
  if (roundNo === 1) { await wait(500); peek(true); await wait(1700); if (!locked) peek(false); } else await wait(2000);

  step("police"); renderBoard(seats, policeSeat);
  prompt(youPolice ? "You drew Police! Step forward…" : `${round.police.name} is the Police and steps forward…`);
  toast(youPolice ? "👮 You are the Police" : `👮 ${round.police.name} is the Police`);
  await world.openPaper(policeSeat, "POLICE", META.police.color === "#4cc3ff" ? "#1b6fd1" : "#1b6fd1"); Sound.flip();
  await world.policeOut(policeSeat);

  step("shot");
  let targetId;
  if (youPolice) {
    prompt("Tap a player to lock on — tap again or press FIRE.");
    targetId = await world.humanAim(policeSeat, {
      onSelect: (t) => { Sound.lock(); buzz(15); $("#t-name").textContent = round.seats[t].name; $("#target").hidden = false; $("#fire").hidden = false; prompt(`Locked on ${round.seats[t].name}. Fire when ready.`); },
      onFire: () => { Sound.shot(); buzz([30, 40, 70]); $("#fire").hidden = true; $("#target").hidden = true; },
    });
  } else {
    prompt(me.role.id === "thief" ? `${round.police.name} is choosing… hope it isn't you.` : `${round.police.name} is choosing a suspect…`);
    targetId = Rules.npcPickTarget(round);
    setTimeout(() => { Sound.shot(); buzz([30, 40, 70]); }, 950);
    await world.npcFire(policeSeat, targetId);
  }

  const res = Rules.resolveShot(round, targetId);
  seats = round.seats.map((s) => ({ seatId: s.seatId, name: s.name, isHuman: s.isHuman, score: s.score }));
  store(K.scores, seats.map((s) => s.score));
  step("result");
  round.seats.forEach((s) => world.openPaper(s.seatId, s.role.label.toUpperCase(), s.role.id === "thief" ? "#c4162a" : "#6b4a00"));
  world.flash(targetId, res.correct ? 0x1fae6b : 0xc0201a);
  round.seats.forEach((s) => world.setTag(s.seatId, `${META[s.role.id].ico} ${s.role.label}`, s.role.id === "police" ? "police" : s.role.id === "thief" ? "thief" : ""));
  renderBoard(seats, policeSeat, res.winner.seatId);
  popup(res.winner.seatId, `+${res.pot}`); res.correct ? Sound.win() : Sound.lose(); setTimeout(() => Sound.coin(), 450); buzz(res.correct ? [20, 30, 20] : 60);
  const mine = res.winner.isHuman;
  showResult(res, round, mine);
  prompt(res.correct ? "Thief caught!" : "Wrong target!");
  history.unshift({ n: roundNo, ok: res.correct, text: `${round.police.name} → ${res.target.name} (${res.target.role.label})`, win: res.winner.name });
  history = history.slice(0, 8); store(K.hist, history); renderHistory();

  await wait(1800);
  await world.policeBack(policeSeat);
  nextBtn.hidden = false; await new Promise((r) => (nextResolve = r));
  return playRound();
}
function showResult(res, rd, mine) {
  const r = $("#result"); r.hidden = false; r.className = res.correct ? "good" : "bad";
  r.querySelector(".rtitle").textContent = res.correct ? "🚔 THIEF CAUGHT!" : "❌ WRONG TARGET";
  r.querySelector(".rmsg").textContent = res.message;
  requestAnimationFrame(() => r.classList.add("show"));
}
function hideResult() { const r = $("#result"); r.classList.remove("show"); r.hidden = true; }

/* ── menu / settings / history ── */
const drawer = $("#drawer");
const openMenu = (v) => { drawer.hidden = !v; Sound.tick(); };
$("#menu-btn").onclick = () => openMenu(true); $("#drawer-close").onclick = () => openMenu(false); drawer.querySelector(".dscrim").onclick = () => openMenu(false);
$("#opt-sound").checked = Sound.on; $("#opt-sound").onchange = (e) => { Sound.set(e.target.checked); Sound.tick(); };
$("#opt-haptics").checked = load(K.haptics, true); $("#opt-haptics").onchange = (e) => { store(K.haptics, e.target.checked); buzz(20); };
$("#opt-cam").onclick = () => { world.resetCamera(); toast("Camera reset"); };
$("#opt-reset").onclick = () => { if (confirm("Reset all scores and history?")) { seats.forEach((s) => (s.score = 0)); history = []; store(K.scores, seats.map(() => 0)); store(K.hist, []); renderBoard(seats, policeSeat); renderHistory(); toast("Scores reset"); } };
function renderOutfits() {
  const box = $("#outfits"); box.innerHTML = "";
  Object.keys(OUTFITS).forEach((n) => {
    const b = document.createElement("button"); b.textContent = n; b.className = n === outfitName ? "on" : "";
    b.onclick = () => { outfitName = n; store(K.outfit, n); world.setOutfit(OUTFITS[n]); renderOutfits(); Sound.tick(); toast(`Everyone now wears: ${n}`); };
    box.appendChild(b);
  });
}
function renderHistory() {
  $("#history").innerHTML = history.length ? history.map((h) => `<div class="${h.ok ? "ok" : ""}">R${h.n} · ${h.text}<br><span class="dim">${h.ok ? "Caught — Police banks" : "Missed —"} 500 → ${h.win}</span></div>`).join("") : `<div class="dim">No rounds yet.</div>`;
}
renderOutfits(); renderHistory();

/* help + keyboard */
const help = $("#help");
$("#help-btn").onclick = () => { help.hidden = false; Sound.tick(); };
$("#help-close").onclick = () => { help.hidden = true; store(K.help, 1); Sound.unlock(); };
if (!load(K.help, 0)) help.hidden = false;
addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "Enter") { if (!nextBtn.hidden) { e.preventDefault(); nextBtn.click(); } else if (!$("#fire").hidden) { e.preventDefault(); world.confirmFire(); } }
  else if (e.key === "m" || e.key === "M") { Sound.set(!Sound.on); $("#opt-sound").checked = Sound.on; toast(Sound.on ? "Sound on" : "Sound off"); }
  else if (e.key === "r" || e.key === "R") world.resetCamera();
  else if (e.key === "Escape") { drawer.hidden = true; help.hidden = true; }
});
addEventListener("pointerdown", () => Sound.unlock(), { once: true });

if (location.search.includes("debug")) window.__pct = { world };
renderBoard(seats);
playRound();
