/* main.js — one human (seat 0) + four identical NPCs. Roles reshuffle every round. */
import * as Rules from "./rules.js";
import { createScene } from "./scene.js";

const $ = (s) => document.querySelector(s);
const SEATS = [
  { seatId: 0, name: "You",   isHuman: true,  score: 0 },
  { seatId: 1, name: "Ada",   isHuman: false, score: 0 },
  { seatId: 2, name: "Chidi", isHuman: false, score: 0 },
  { seatId: 3, name: "Ngozi", isHuman: false, score: 0 },
  { seatId: 4, name: "Emeka", isHuman: false, score: 0 },
];
const KEY = "pct.scores.v1";
let seats = SEATS.map((s) => ({ ...s }));
try { const sv = JSON.parse(localStorage.getItem(KEY) || "null"); if (sv && sv.length === seats.length) seats.forEach((s, i) => (s.score = +sv[i] || 0)); } catch (e) {}

const world = createScene($("#stage"), seats.map((s) => s.name));
let roundNo = 0, log = [];

const ui = {
  prompt: (t) => { $("#prompt").textContent = t; },
  board(list, round) {
    $("#board").innerHTML = list.map((s) => `<div class="pl${s.isHuman ? " you" : ""}">${s.name}<b>${s.score}</b></div>`).join("");
  },
  role(r) {
    const c = $("#role");
    if (!r) { c.classList.remove("on"); return; }
    c.innerHTML = `<small>YOUR ROLE · ROUND ${roundNo}</small><strong>${r.label}</strong><span>Worth ${r.points} pts</span>`;
    c.classList.add("on");
  },
  log(t) { log.unshift(t); log = log.slice(0, 3); $("#log").innerHTML = log.map((l) => `<div>${l}</div>`).join(""); },
  button(text) {
    return new Promise((res) => { const b = $("#btn"); b.textContent = text; b.hidden = false; b.onclick = () => { b.hidden = true; res(); }; });
  },
};
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(seats.map((s) => s.score))); } catch (e) {} };

async function playRound() {
  roundNo++;
  world.clearTags();
  const round = Rules.createRound(seats);
  const me = round.seats.find((s) => s.isHuman);
  ui.board(seats); ui.role(me.role);
  ui.prompt(`Round ${roundNo} — papers dealt. You are the ${me.role.label}.`);
  await world.wait(1800);

  const pIdx = round.police.seatId;
  const youPolice = round.police.isHuman;
  ui.prompt(youPolice ? "You are the Police! Walking out…" : `${round.police.name} is the Police and steps forward…`);
  await world.policeOut(pIdx);

  let targetId;
  if (youPolice) {
    ui.prompt("Aim and tap the player you think is the Thief.");
    targetId = await world.humanAim(pIdx);
  } else {
    ui.prompt(me.role.id === "thief" ? `${round.police.name} is choosing… hope it isn't you.` : `${round.police.name} is choosing a suspect…`);
    targetId = Rules.npcPickTarget(round);
    await world.npcFire(pIdx, targetId);
  }

  const res = Rules.resolveShot(round, targetId);
  seats = round.seats.map((s) => ({ seatId: s.seatId, name: s.name, isHuman: s.isHuman, score: s.score }));
  save(); ui.board(seats);
  world.flash(targetId, res.correct ? 0x44ff88 : 0xff4444);
  round.seats.forEach((s) => world.setTag(s.seatId, s.role.label, s.role.id === "police" ? "police" : s.role.id === "thief" ? "thief" : ""));
  ui.prompt(res.correct ? "Thief caught!" : "Wrong target!");
  ui.log(res.message);
  await world.wait(1600);
  await world.policeBack(pIdx);
  await ui.button("Next round");
  return playRound();
}

/* help sheet */
const help = $("#help");
$("#help-btn").onclick = () => (help.hidden = false);
$("#help-close").onclick = () => { help.hidden = true; try { localStorage.setItem("pct.seenHelp", "1"); } catch (e) {} };
try { if (!localStorage.getItem("pct.seenHelp")) help.hidden = false; } catch (e) {}

playRound();
