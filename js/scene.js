/* scene.js — canteen interior, five identical faceted characters (the game's wardrobe), the game's pistol. */
import * as THREE from "three";
import { buildCanteen } from "./canteen.js";
import { buildCharacter, groundLeg, groundArm, setGrip, makeBlob } from "./engine/characters/lowpoly.js";
import { Wardrobe } from "./engine/core/wardrobe.js";
import { buildPistol3D, POSE, LEGS_AIM } from "./gun.js";

const RADIUS = 3.3;
const CENTER = { x: 0, z: 1 };
const lerpArr = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const ease = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const tween = (ms, fn) => new Promise((res) => {
  const t0 = performance.now();
  (function step() { const t = Math.min(1, (performance.now() - t0) / ms); fn(t); t < 1 ? requestAnimationFrame(step) : res(); })();
});

export function createScene(container, names, outfit = {}) {
  const n = names.length;
  const scene = new THREE.Scene();
  const room = buildCanteen(scene);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 90);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  /* ── characters: every seat is built from the SAME wardrobe config, so nothing leaks a role ── */
  const avatars = [], homes = [];
  let outfitCfg = outfit;
  function makeAvatar(i) {
    const cfg = Object.assign({}, Wardrobe.config, { look: "faceted", bodyStyle: "faceted" }, outfitCfg);
    const { root, rig } = buildCharacter(cfg);
    const g = new THREE.Group(); g.add(root);
    const blob = makeBlob(); blob.scale.set(1.3, 1.3, 1); g.add(blob);
    const gun = buildPistol3D(); gun.rotation.set(Math.PI / 2, 0, 0); gun.visible = false;
    if (rig.armR && rig.armR.grip) rig.armR.grip.add(gun);
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.0, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 1.0; hit.userData.index = i; g.add(hit);
    const mats = new Set();
    root.traverse((o) => { if (o.isMesh) [].concat(o.material).forEach((m) => m && m.emissive && mats.add(m)); });
    g.userData = { index: i, root, rig, gun, mats: [...mats], st: { armed: false, aim: 0, move: 0, phase: 0 } };
    return g;
  }
  function disposeAvatar(g) { g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  for (let i = 0; i < n; i++) {
    const a = Math.PI / 2 + (i / n) * Math.PI * 2;      /* seat 0 (You) is nearest the camera */
    const x = CENTER.x + Math.cos(a) * RADIUS, z = CENTER.z + Math.sin(a) * RADIUS;
    const g = makeAvatar(i);
    g.position.set(x, 0, z); g.rotation.y = Math.atan2(CENTER.x - x, CENTER.z - z);
    scene.add(g); avatars.push(g); homes.push(new THREE.Vector3(x, 0, z));
  }

  /* ── name / role tags (DOM, projected each frame) ── */
  const tags = names.map((nm, i) => {
    const d = document.createElement("div"); d.className = "tag" + (i === 0 ? " me" : "");
    d.innerHTML = `<b>${nm}</b><i></i>`; document.body.appendChild(d); return d;
  });
  const cross = document.createElement("div"); cross.id = "cross"; document.body.appendChild(cross);

  const glow = (i, hex) => avatars[i].userData.mats.forEach((m) => m.emissive.setHex(hex));
  const face = (i, tx, tz) => { const p = avatars[i].position; avatars[i].rotation.y = Math.atan2(tx - p.x, tz - p.z); };

  /* ── pose driver (called every frame) ── */
  function applyPose(g, t) {
    const { rig, st } = g.userData;
    const L = rig.armL, R = rig.armR;
    const mv = st.move, ph = st.phase;
    const SL = 0.55 * mv, legL = groundLeg(ph, SL, 0.9, mv), legR = groundLeg(ph + Math.PI, SL, 0.9, mv);
    let lh = legL.thigh, lk = legL.knee, rh = legR.thigh, rk = legR.knee;
    if (st.armed) {
      const p = lerpArr(POSE.carry, POSE.aim, st.aim);
      R.shoulder.rotation.set(p[0], p[1], p[2]); R.elbow.rotation.x = p[3]; if (R.wrist) R.wrist.rotation.x = p[4];
      L.shoulder.rotation.set(p[5], p[6], p[7]); L.elbow.rotation.x = p[8]; if (L.wrist) L.wrist.rotation.x = p[9];
      rig.spine.rotation.x = p[10]; rig.spine.rotation.y = p[11]; rig.hips.rotation.y = p[12] * st.aim * (1 - mv);
      rig.head.rotation.set(p[13], p[14], p[15] * 0);
      const k = st.aim * (1 - mv);
      lh += (LEGS_AIM.lh - lh) * k; lk += (LEGS_AIM.lk - lk) * k; rh += (LEGS_AIM.rh - rh) * k; rk += (LEGS_AIM.rk - rk) * k;
    } else {
      const aL = groundArm(ph + Math.PI, 0.5 * mv, 0, mv), aR = groundArm(ph, 0.5 * mv, 0, mv);
      L.shoulder.rotation.set(aL.swing, 0, aL.spread * 0.6); L.elbow.rotation.x = aL.elbow;
      R.shoulder.rotation.set(aR.swing, 0, -aR.spread * 0.6); R.elbow.rotation.x = aR.elbow;
      rig.spine.rotation.x = Math.sin(t * 1.6 + g.userData.index) * 0.012; rig.spine.rotation.y = 0; rig.hips.rotation.y = 0;
      rig.head.rotation.set(0, Math.sin(t * 0.7 + g.userData.index * 2) * 0.12, 0);
    }
    rig.legL.hip.rotation.x = lh; rig.legL.knee.rotation.x = lk; rig.legR.hip.rotation.x = rh; rig.legR.knee.rotation.x = rk;
    const an = (l) => l.ankle || l.ank;
    if (an(rig.legL)) an(rig.legL).rotation.x = groundLeg(ph, SL, 0.9, mv).ankle * (1 - st.aim * 0.8);
    if (an(rig.legR)) an(rig.legR).rotation.x = groundLeg(ph + Math.PI, SL, 0.9, mv).ankle * (1 - st.aim * 0.8);
  }

  async function walk(i, to, ms) {
    const g = avatars[i], st = g.userData.st, from = g.position.clone();
    face(i, to.x, to.z); st.move = 1;
    const cycles = from.distanceTo(to) * 0.55;
    await tween(ms, (t) => { g.position.lerpVectors(from, to, ease(t)); st.phase = t * cycles * Math.PI * 2; });
    st.move = 0; st.phase = 0;
  }
  const draw = (i) => { const g = avatars[i]; g.userData.gun.visible = true; g.userData.st.armed = true; setGrip(g.userData.rig, -1, 1); setGrip(g.userData.rig, 1, 1); };
  const holster = (i) => { const g = avatars[i]; g.userData.gun.visible = false; g.userData.st.armed = false; g.userData.st.aim = 0; setGrip(g.userData.rig, -1, 0); setGrip(g.userData.rig, 1, 0); };
  const raise = (i, ms = 420) => { const st = avatars[i].userData.st; const a0 = st.aim; return tween(ms, (t) => { st.aim = a0 + (1 - a0) * ease(t); }); };

  /* ── camera: drag to orbit, wheel / pinch to zoom, always inside the canteen ── */
  let theta = 0, phi = 0.74, zoom = 1, shakeUntil = 0, shakeAmt = 0, focus = null;
  const look = new THREE.Vector3(CENTER.x, 1.0, CENTER.z);
  function placeCamera() {
    const aspect = container.clientWidth / Math.max(1, container.clientHeight);
    const base = aspect < 1 ? 13.5 : aspect < 1.5 ? 12.2 : 10.8;
    const d = base * zoom;
    const tgt = focus ? focus : { x: CENTER.x, y: 1.0, z: CENTER.z };
    look.lerp(new THREE.Vector3(tgt.x, tgt.y, tgt.z), 0.08);
    camera.position.set(look.x + Math.sin(theta) * Math.cos(phi) * d, look.y + Math.sin(phi) * d + 0.6, look.z + Math.cos(theta) * Math.cos(phi) * d);
    camera.position.z = Math.min(camera.position.z, room.HZ - 0.6); camera.position.x = Math.max(-room.HX + 0.6, Math.min(room.HX - 0.6, camera.position.x));
    camera.lookAt(look);
    if (performance.now() < shakeUntil) camera.position.addScalar((Math.random() - 0.5) * shakeAmt);
  }
  /* ── graphics quality: render-resolution levels, plus an Auto mode that adapts to the device's frame rate ── */
  const DPR = Math.min(devicePixelRatio || 1, 2);
  const LEVELS = [{ n: "Minimum", pr: 0.55 }, { n: "Low", pr: 0.8 }, { n: "Medium", pr: Math.min(DPR, 1.0) }, { n: "High", pr: DPR }];
  let qMode = "auto", level = DPR > 1.5 ? 2 : 2, onQ = null, accT = 0, accN = 0, good = 0, cool = 0, fps = 0, onFps = null;
  function applyLevel(l) {
    level = Math.max(0, Math.min(LEVELS.length - 1, l));
    renderer.setPixelRatio(LEVELS[level].pr); resize(); if (onQ) onQ(qMode, LEVELS[level].n);
  }
  function autoStep(dt) {
    accT += dt; accN++; cool -= dt;
    if (accT < 1.5) return;
    fps = accN / accT; accT = 0; accN = 0; if (onFps) onFps(fps);
    if (qMode !== "auto" || cool > 0) return;
    if (fps < 38 && level > 0) { applyLevel(level - 1); cool = 3; good = 0; }
    else if (fps > 56 && level < LEVELS.length - 1) { if (++good >= 3) { applyLevel(level + 1); cool = 3; good = 0; } }
    else if (fps <= 56) good = 0;
  }
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h; camera.fov = w / h < 1 ? 62 : 50; camera.updateProjectionMatrix(); renderer.setSize(w, h);
  }
  addEventListener("resize", resize); resize();

  /* ── shot effects ── */
  async function fireFx(from, to) {
    const gun = avatars[from].userData.gun; gun.updateMatrixWorld(true);
    const a = gun.localToWorld(gun.userData.muzzleLocal.clone()), b = avatars[to].position.clone().setY(1.25);
    const flash = new THREE.PointLight(0xffaa33, 5, 6); flash.position.copy(a); scene.add(flash);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true }));
    ball.position.copy(a); scene.add(ball);
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const mat = new THREE.LineBasicMaterial({ color: 0xfff1b0, transparent: true });
    const line = new THREE.Line(geo, mat); scene.add(line);
    shakeAmt = 0.2; shakeUntil = performance.now() + 220;
    const kick = avatars[from].userData.st;
    await tween(280, (t) => { ball.material.opacity = 1 - t; ball.scale.setScalar(1 + t * 3); mat.opacity = 1 - t; flash.intensity = 5 * (1 - t); kick.aim = 1 - Math.sin(t * Math.PI) * 0.18; });
    [flash, ball, line].forEach((o) => scene.remove(o)); ball.geometry.dispose(); ball.material.dispose(); geo.dispose(); mat.dispose();
  }

  /* ── aiming (human Police): tap selects, tap again / confirm fires ── */
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let aim = null, hover = -1;
  function pick(x, y, exclude) {
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    for (const h of ray.intersectObjects(avatars, true)) { let o = h.object; while (o && o.userData.index === undefined) o = o.parent; if (o && o.userData.index !== exclude) return o.userData.index; }
    return -1;
  }
  function paintGlow() { avatars.forEach((_, i) => glow(i, aim && i === aim.sel ? 0xc0201a : i === hover ? 0x5a4208 : 0)); }
  function setHover(i) { if (i === hover) return; hover = i; if (aim && aim.onHover) aim.onHover(i); cross.classList.toggle("lock", i >= 0); paintGlow(); }
  function select(t) {
    if (!aim) return;
    aim.sel = t; face(aim.police, avatars[t].position.x, avatars[t].position.z); paintGlow();
    focus = { x: avatars[t].position.x * 0.5 + CENTER.x * 0.5, y: 1.1, z: avatars[t].position.z * 0.5 + CENTER.z * 0.5 };
    if (aim.onSelect) aim.onSelect(t);
  }
  async function confirmFire() {
    if (!aim || aim.sel < 0) return;
    const a = aim; aim = null; cross.style.display = "none"; cross.classList.remove("lock");
    if (a.onFire) a.onFire();
    await fireFx(a.police, a.sel); focus = null; hover = -1; glow(a.sel, 0); a.resolve(a.sel);
  }
  let down = false, dragged = false, lx = 0, ly = 0, sx = 0, sy = 0;
  const cv = renderer.domElement, pts = new Map();
  cv.addEventListener("pointerdown", (e) => { pts.set(e.pointerId, e); down = true; dragged = false; lx = sx = e.clientX; ly = sy = e.clientY; });
  addEventListener("pointermove", (e) => {
    if (pts.has(e.pointerId)) pts.set(e.pointerId, e);
    if (pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); if (cv._pd) zoom = Math.max(0.6, Math.min(1.3, zoom * (cv._pd / d))); cv._pd = d; dragged = true; return; }
    if (pickMode && e.pointerType === "mouse") hoverPaper(paperAt(e.clientX, e.clientY));
    if (aim && e.pointerType === "mouse") { cross.style.left = e.clientX + "px"; cross.style.top = e.clientY + "px"; setHover(pick(e.clientX, e.clientY, aim.police)); }
    if (!down) return;
    if (!dragged && Math.hypot(e.clientX - sx, e.clientY - sy) > 8) dragged = true;
    if (dragged) { theta -= (e.clientX - lx) * 0.006; phi = Math.max(0.22, Math.min(1.15, phi + (e.clientY - ly) * 0.004)); }
    lx = e.clientX; ly = e.clientY;
  });
  addEventListener("pointerup", (e) => {
    pts.delete(e.pointerId); cv._pd = 0;
    if (!down) return; down = pts.size > 0;
    if (!dragged && pickMode) { takePaper(e.clientX, e.clientY); return; }
    if (dragged || !aim) return;
    const t = pick(e.clientX, e.clientY, aim.police);
    if (t < 0) return;
    if (aim.sel === t) confirmFire(); else select(t);
  });
  cv.addEventListener("wheel", (e) => { zoom = Math.max(0.6, Math.min(1.3, zoom + e.deltaY * 0.001)); e.preventDefault(); }, { passive: false });

  /* ── folded papers: dealt face-down; only the Police opens theirs ── */
  const papers = [];
  const paperMat = new THREE.MeshLambertMaterial({ color: 0xf1ead6 }), creaseMat = new THREE.MeshLambertMaterial({ color: 0xc9bf9f });
  function makePaper() {
    const g = new THREE.Group(), fold = new THREE.Group(); g.add(fold);
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.05, 0.21), paperMat); fold.add(a);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.012, 0.02), creaseMat); b.position.y = 0.03; fold.add(b);
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.21), creaseMat); c.position.y = 0.03; fold.add(c);
    g.userData = { fold, open: null, state: "folded", rest: new THREE.Vector3() };
    return g;
  }
  function paperTexture(text, color) {
    const c = document.createElement("canvas"); c.width = 320; c.height = 214; const x = c.getContext("2d");
    x.fillStyle = "#f6f0dc"; x.fillRect(0, 0, 320, 214);
    x.strokeStyle = "#cdbf94"; x.lineWidth = 6; x.strokeRect(8, 8, 304, 198);
    x.fillStyle = color; x.font = "900 54px system-ui,sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(text, 160, 112);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const slot = (i) => { const h = homes[i], d = new THREE.Vector3(CENTER.x - h.x, 0, CENTER.z - h.z).normalize(); return h.clone().addScaledVector(d, 0.75).setY(1.2); };
  /* Spread the shuffled folded papers on the table; the human taps any one, the NPCs take the rest. */
  let row = [], pickMode = null, hoverP = -1;
  async function spreadPapers() {
    await clearPapers(); row = [];
    const pile = new THREE.Vector3(CENTER.x, 0.95, CENTER.z);
    const jobs = [...Array(n).keys()].map((k) => new Promise(async (res) => {
      const p = makePaper(); p.userData.pi = k; p.position.copy(pile); scene.add(p); row[k] = p;
      const to = new THREE.Vector3(CENTER.x + (k - (n - 1) / 2) * 0.62, 1.0, CENTER.z + 0.1); p.userData.rest.copy(to);
      await wait(k * 120);
      await tween(560, (t) => { const e = ease(t); p.position.lerpVectors(pile, to, e); p.position.y += Math.sin(t * Math.PI) * 0.6; p.rotation.set(0, (1 - e) * 3, 0); });
      p.rotation.set(0, 0, 0); res();
    }));
    await Promise.all(jobs);
  }
  function pickPaper() { return new Promise((resolve) => { pickMode = { resolve }; row.forEach((p) => (p.userData.attn = true)); }); }
  function paperAt(x, y) {
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1); ray.setFromCamera(ptr, camera);
    const hits = ray.intersectObjects(row.filter(Boolean), true);
    for (const h of hits) { let o = h.object; while (o && o.userData.pi === undefined) o = o.parent; if (o) return o.userData.pi; }
    return -1;
  }
  function hoverPaper(i) { hoverP = i; }
  function takePaper(x, y) {
    if (!pickMode) return false;
    const k = paperAt(x, y); if (k < 0) return true;
    const m = pickMode; pickMode = null; hoverP = -1; row.forEach((p) => (p.userData.attn = false)); m.resolve(k); return true;
  }
  async function dealRest(pick) {
    const move = (k, seat) => new Promise(async (res) => {
      const p = row[k], from = p.position.clone(), to = slot(seat); p.userData.rest.copy(to); papers[seat] = p;
      await tween(620, (t) => { const e = ease(t); p.position.lerpVectors(from, to, e); p.position.y += Math.sin(t * Math.PI) * 0.7; p.rotation.set(0, t * Math.PI * 2, 0); p.scale.setScalar(p.scale.x + (1 - p.scale.x) * 0.2); });
      p.rotation.set(0, Math.atan2(CENTER.x - homes[seat].x, CENTER.z - homes[seat].z), 0); res();
    });
    await move(pick, 0);
    const rest = [...Array(n).keys()].filter((k) => k !== pick), seatsLeft = [1, 2, 3, 4].slice(0, rest.length).sort(() => Math.random() - 0.5);
    await Promise.all(rest.map((k, idx) => wait(idx * 150).then(() => move(k, seatsLeft[idx]))));
    row = [];
  }
  async function openPaper(i, text, color) {
    const p = papers[i]; if (!p || p.userData.state !== "folded") return;
    p.userData.state = "open";
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), new THREE.MeshBasicMaterial({ map: paperTexture(text, color), side: THREE.DoubleSide, transparent: true }));
    m.scale.setScalar(0.01); p.add(m); p.userData.open = m;
    const from = p.position.clone(), to = p.userData.rest.clone().setY(1.75);
    await tween(520, (t) => { const e = ease(t); p.position.lerpVectors(from, to, e); p.userData.fold.scale.setScalar(Math.max(0.001, 1 - e)); m.scale.setScalar(0.01 + e * 0.99); });
    p.userData.rest.copy(to);
  }
  async function clearPapers() {
    const ps = papers.filter(Boolean); papers.length = 0;
    if (!ps.length) return;
    await tween(280, (t) => ps.forEach((p) => p.scale.setScalar(1 - ease(t))));
    ps.forEach((p) => { scene.remove(p); p.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map) { o.material.map.dispose(); o.material.dispose(); } }); });
  }

  /* ── loop ── */
  const v = new THREE.Vector3();
  let lastT = performance.now();
  function frame() {
    requestAnimationFrame(frame);
    const nowT = performance.now(), t = nowT * 0.001; autoStep(Math.min(0.25, (nowT - lastT) / 1000)); lastT = nowT;
    avatars.forEach((g) => applyPose(g, t));
    row.forEach((p, k) => { if (!p || !p.userData.attn) return; const hv = k === hoverP; p.position.y = p.userData.rest.y + Math.sin(t * 3 + k) * 0.04 + (hv ? 0.08 : 0); p.scale.setScalar(hv ? 2.4 : 1.9 + Math.sin(t * 3 + k) * 0.08); });
    papers.forEach((p, i) => {
      if (!p) return;
      if (p.userData.state === "folded" && p.userData.rest.y && p.position.distanceTo(p.userData.rest) < 0.2) p.position.y = p.userData.rest.y + Math.sin(t * 2 + i) * 0.015;
      if (p.userData.state === "open" && p.userData.open) p.userData.open.lookAt(camera.position);
    });
    placeCamera();
    renderer.render(scene, camera);
    const w = container.clientWidth, h = container.clientHeight;
    tags.forEach((d, i) => {
      v.copy(avatars[i].position); v.y += 2.1; v.project(camera);
      d.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px,${(-v.y * 0.5 + 0.5) * h}px) translate(-50%,-100%)`;
    });
  }
  frame();

  return {
    wait,
    setOutfit(cfg) {
      outfitCfg = cfg;
      avatars.forEach((old, i) => {
        const g = makeAvatar(i); g.position.copy(old.position); g.rotation.copy(old.rotation);
        scene.remove(old); disposeAvatar(old); scene.add(g); avatars[i] = g;
      });
    },
    paperPos(k) { const p = row[k]; if (!p) return null; v.copy(p.position); v.project(camera); return { x: (v.x * 0.5 + 0.5) * container.clientWidth, y: (-v.y * 0.5 + 0.5) * container.clientHeight }; },
    spreadPapers, pickPaper, dealRest, openPaper, clearPapers,
    async policeOut(i) {
      draw(i);
      const inward = homes[i].clone().sub(new THREE.Vector3(CENTER.x, 0, CENTER.z)).negate().normalize();
      await walk(i, homes[i].clone().addScaledVector(inward, 1.6), 1100);
      await raise(i);
    },
    async npcFire(i, target) {
      face(i, avatars[target].position.x, avatars[target].position.z);
      glow(target, 0xc0201a); await wait(950);
      await fireFx(i, target); glow(target, 0);
    },
    /* Human Police. Resolves with the confirmed seat. onSelect(i) fires when a suspect is picked. */
    humanAim(i, { onSelect, onHover, onFire } = {}) {
      return new Promise((resolve) => {
        aim = { police: i, resolve, sel: -1, onSelect, onHover, onFire }; hover = -1;
        cross.style.display = "block"; cross.style.left = innerWidth / 2 + "px"; cross.style.top = innerHeight / 2 + "px";
      });
    },
    confirmFire,
    clearSelection() { if (aim) { aim.sel = -1; focus = null; paintGlow(); } },
    async policeBack(i) {
      const st = avatars[i].userData.st; const a0 = st.aim;
      await tween(300, (t) => { st.aim = a0 * (1 - t); });
      await walk(i, homes[i], 1000);
      holster(i); face(i, CENTER.x, CENTER.z);
    },
    async flash(i, hex) { glow(i, hex); await wait(1000); glow(i, 0); },
    setTag(i, text, cls = "") { tags[i].className = "tag" + (i === 0 ? " me" : "") + (cls ? " " + cls : ""); tags[i].querySelector("i").textContent = text || ""; },
    clearTags() { tags.forEach((d, i) => { d.className = "tag" + (i === 0 ? " me" : ""); d.querySelector("i").textContent = ""; }); },
    setQuality(mode) { qMode = mode; if (mode === "auto") { cool = 0; good = 0; applyLevel(level); } else applyLevel(["minimum", "low", "medium", "high"].indexOf(mode)); },
    onQuality(fn) { onQ = fn; fn(qMode, LEVELS[level].n); },
    onFps(fn) { onFps = fn; },
    cam(o) { if (o.theta !== undefined) theta = o.theta; if (o.phi !== undefined) phi = o.phi; if (o.zoom !== undefined) zoom = o.zoom; if (o.seat !== undefined) { const p = avatars[o.seat].position; focus = { x: p.x, y: 1.2, z: p.z }; } },
    resetCamera() { theta = 0; phi = 0.74; zoom = 1; focus = null; },
    screenPos(i) { v.copy(avatars[i].position); v.y += 1.2; v.project(camera); return { x: (v.x * 0.5 + 0.5) * container.clientWidth, y: (-v.y * 0.5 + 0.5) * container.clientHeight }; },
  };
}
