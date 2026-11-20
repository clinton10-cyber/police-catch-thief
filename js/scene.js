/* scene.js — Three.js circle of identical avatars, walk-out, aiming, shot effects. */
import * as THREE from "../vendor/three.module.min.js";

const SKIN = 0x8d5524, SHIRT = 0x3a3a5a, PANTS = 0x22223a, HAIR = 0x1a1a1a;
const RADIUS = 3.3;

/* One avatar recipe for EVERY seat — nothing about the look can leak a role. */
function buildAvatar(shared) {
  const g = new THREE.Group();
  const mk = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 });
  const m = { skin: mk(SKIN), shirt: mk(SHIRT), pants: mk(PANTS), hair: mk(HAIR) };
  g.userData.mats = Object.values(m);
  const add = (geo, mat, x, y, z, parent = g) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  add(shared.torso, m.shirt, 0, 1.15, 0);
  add(shared.head, m.skin, 0, 1.78, 0);
  add(shared.hair, m.hair, 0, 1.9, -0.02);
  const pivot = (x, y) => { const p = new THREE.Group(); p.position.set(x, y, 0); g.add(p); return p; };
  const legL = pivot(-0.14, 0.72), legR = pivot(0.14, 0.72);
  add(shared.leg, m.pants, 0, -0.36, 0, legL); add(shared.leg, m.pants, 0, -0.36, 0, legR);
  const armL = pivot(-0.4, 1.46), armR = pivot(0.4, 1.46);
  add(shared.arm, m.shirt, 0, -0.3, 0, armL); add(shared.arm, m.shirt, 0, -0.3, 0, armR);
  add(shared.hand, m.skin, 0, -0.62, 0, armL); add(shared.hand, m.skin, 0, -0.62, 0, armR);
  const gun = new THREE.Mesh(shared.gun, new THREE.MeshStandardMaterial({ color: 0x15151c, roughness: 0.4, metalness: 0.5 }));
  gun.position.set(0, -0.62, 0.16); gun.visible = false; armR.add(gun);
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 2.3, 8), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 1.15; g.add(hit);
  g.userData.parts = { legL, legR, armL, armR, gun, hit };
  return g;
}

export function createScene(container, names) {
  const n = names.length;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x15152a);
  scene.fog = new THREE.Fog(0x15152a, 14, 34);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xbfc8ff, 0x20203a, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(5, 10, 6); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7 });
  scene.add(key);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(8, 64), new THREE.MeshStandardMaterial({ color: 0x24243e, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.06, 64), new THREE.MeshBasicMaterial({ color: 0x4a4a78, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; scene.add(ring);

  const shared = {
    torso: new THREE.CylinderGeometry(0.3, 0.26, 0.8, 12), head: new THREE.SphereGeometry(0.22, 16, 14),
    hair: new THREE.SphereGeometry(0.235, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    leg: new THREE.BoxGeometry(0.2, 0.72, 0.22), arm: new THREE.BoxGeometry(0.15, 0.6, 0.17),
    hand: new THREE.SphereGeometry(0.085, 8, 8), gun: new THREE.BoxGeometry(0.07, 0.12, 0.34),
  };

  const avatars = [], homes = [], walking = names.map(() => false);
  for (let i = 0; i < n; i++) {
    const a = Math.PI / 2 + (i / n) * Math.PI * 2;          /* seat 0 (You) sits nearest the camera */
    const x = Math.cos(a) * RADIUS, z = Math.sin(a) * RADIUS;
    const av = buildAvatar(shared);
    av.position.set(x, 0, z); av.rotation.y = Math.atan2(-x, -z);
    av.userData.index = i; av.userData.parts.hit.userData.index = i;
    scene.add(av); avatars.push(av); homes.push(new THREE.Vector3(x, 0, z));
  }

  /* ── name / role tags (DOM, projected each frame) ── */
  const tags = names.map((nm) => {
    const d = document.createElement("div"); d.className = "tag";
    d.innerHTML = `${nm}<i></i>`; document.body.appendChild(d); return d;
  });
  const cross = document.createElement("div"); cross.id = "cross"; document.body.appendChild(cross);

  /* ── helpers ── */
  const ease = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const tween = (ms, fn) => new Promise((res) => {
    const t0 = performance.now();
    (function step() { const t = Math.min(1, (performance.now() - t0) / ms); fn(t); t < 1 ? requestAnimationFrame(step) : res(); })();
  });
  const glow = (i, hex) => avatars[i].userData.mats.forEach((m) => m.emissive.setHex(hex));
  const face = (i, tx, tz) => { const p = avatars[i].position; avatars[i].rotation.y = Math.atan2(tx - p.x, tz - p.z); };

  async function walk(i, to, ms = 750) {
    const av = avatars[i], from = av.position.clone(), P = av.userData.parts;
    walking[i] = true; face(i, to.x, to.z);
    await tween(ms, (t) => {
      av.position.lerpVectors(from, to, ease(t));
      const s = Math.sin(t * Math.PI * 6) * 0.7;
      P.legL.rotation.x = s; P.legR.rotation.x = -s; P.armL.rotation.x = -s * 0.6;
      if (!P.gun.visible) P.armR.rotation.x = s * 0.6;
      av.position.y = Math.abs(Math.sin(t * Math.PI * 6)) * 0.05;
    });
    P.legL.rotation.x = P.legR.rotation.x = P.armL.rotation.x = 0;
    if (!P.gun.visible) P.armR.rotation.x = 0;
    av.position.y = 0; walking[i] = false;
  }

  /* ── camera (drag to look around) ── */
  let theta = 0, phi = 0.62, dist = 10.5, shakeUntil = 0, shakeAmt = 0;
  function placeCamera() {
    const aspect = container.clientWidth / Math.max(1, container.clientHeight);
    dist = aspect < 1 ? 15 : aspect < 1.5 ? 12 : 10;
    camera.position.set(Math.sin(theta) * Math.cos(phi) * dist, Math.sin(phi) * dist + 1.2, Math.cos(theta) * Math.cos(phi) * dist);
    camera.lookAt(0, 1.0, 0);
    if (performance.now() < shakeUntil) camera.position.addScalar((Math.random() - 0.5) * shakeAmt);
  }
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
  }
  addEventListener("resize", resize); resize();

  /* ── shot effects ── */
  function tip(i) { const v = new THREE.Vector3(0, -0.62, 0.36); avatars[i].userData.parts.armR.localToWorld(v); return v; }
  async function fireFx(from, to) {
    const a = tip(from), b = avatars[to].position.clone().setY(1.2);
    const flash = new THREE.PointLight(0xffaa00, 4, 6); flash.position.copy(a); scene.add(flash);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffdd44, transparent: true }));
    ball.position.copy(a); scene.add(ball);
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const mat = new THREE.LineBasicMaterial({ color: 0xffee88, transparent: true });
    const line = new THREE.Line(geo, mat); scene.add(line);
    shakeAmt = 0.22; shakeUntil = performance.now() + 220;
    await tween(260, (t) => { ball.material.opacity = 1 - t; ball.scale.setScalar(1 + t * 2); mat.opacity = 1 - t; flash.intensity = 4 * (1 - t); });
    [flash, ball, line].forEach((o) => scene.remove(o)); ball.geometry.dispose(); ball.material.dispose(); geo.dispose(); mat.dispose();
  }

  /* ── aiming (human Police) ── */
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let aim = null, hover = -1;
  function pick(x, y, exclude) {
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hits = ray.intersectObjects(avatars, true);
    for (const h of hits) { let o = h.object; while (o && o.userData.index === undefined) o = o.parent; if (o && o.userData.index !== exclude) return o.userData.index; }
    return -1;
  }
  function setHover(i) {
    if (i === hover) return;
    if (hover >= 0) glow(hover, 0);
    hover = i; if (i >= 0) glow(i, 0xff4444);
    cross.classList.toggle("lock", i >= 0);
    if (aim && i >= 0) face(aim.police, avatars[i].position.x, avatars[i].position.z);
  }
  let down = null, dragged = false, lx = 0, ly = 0;
  const cv = renderer.domElement;
  cv.addEventListener("pointerdown", (e) => { down = e.pointerId; dragged = false; lx = e.clientX; ly = e.clientY; sx = lx; sy = ly; });
  let sx = 0, sy = 0;
  addEventListener("pointermove", (e) => {
    if (aim) { cross.style.left = e.clientX + "px"; cross.style.top = e.clientY + "px"; setHover(pick(e.clientX, e.clientY, aim.police)); }
    if (down === null) return;
    if (!dragged && Math.hypot(e.clientX - sx, e.clientY - sy) > 8) dragged = true;
    if (dragged) { theta -= (e.clientX - lx) * 0.006; phi = Math.max(0.25, Math.min(1.1, phi + (e.clientY - ly) * 0.004)); }
    lx = e.clientX; ly = e.clientY;
  });
  addEventListener("pointerup", (e) => {
    if (down === null) return; down = null;
    if (dragged || !aim) return;
    const t = pick(e.clientX, e.clientY, aim.police);
    if (t < 0) return;
    const a = aim; aim = null; cross.style.display = "none"; cross.classList.remove("lock");
    face(a.police, avatars[t].position.x, avatars[t].position.z);
    glow(t, 0xff4444); hover = t;
    fireFx(a.police, t).then(() => { glow(t, 0); hover = -1; a.resolve(t); });
  });

  /* ── loop ── */
  const v = new THREE.Vector3();
  function frame() {
    requestAnimationFrame(frame);
    const t = performance.now() * 0.002;
    avatars.forEach((a, i) => { if (!walking[i]) a.position.y = Math.sin(t + i) * 0.025; });
    placeCamera();
    renderer.render(scene, camera);
    const w = container.clientWidth, h = container.clientHeight;
    tags.forEach((d, i) => {
      v.copy(avatars[i].position); v.y += 2.25; v.project(camera);
      d.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px,${(-v.y * 0.5 + 0.5) * h}px) translate(-50%,-100%)`;
    });
  }
  frame();

  /* ── API ── */
  return {
    async policeOut(i) {
      const inward = homes[i].clone().negate().normalize();
      await walk(i, homes[i].clone().addScaledVector(inward, 1.7));
      const P = avatars[i].userData.parts; P.gun.visible = true; P.armR.rotation.x = -Math.PI / 2;
    },
    /* NPC Police: aim at target, beat, fire. */
    async npcFire(i, target) {
      face(i, avatars[target].position.x, avatars[target].position.z);
      glow(target, 0xff4444); await wait(900);
      await fireFx(i, target); glow(target, 0);
    },
    /* Human Police: resolves with the seat index tapped. */
    humanAim(i) {
      return new Promise((resolve) => {
        aim = { police: i, resolve }; hover = -1;
        cross.style.display = "block"; cross.style.left = innerWidth / 2 + "px"; cross.style.top = innerHeight / 2 + "px";
      });
    },
    async policeBack(i) {
      const P = avatars[i].userData.parts; P.gun.visible = false; P.armR.rotation.x = 0;
      await walk(i, homes[i], 700);
      face(i, 0, 0);
    },
    async flash(i, hex) { glow(i, hex); await wait(900); glow(i, 0); },
    setTag(i, text, cls = "") { tags[i].className = "tag " + cls; tags[i].querySelector("i").textContent = text || ""; },
    clearTags() { tags.forEach((d) => { d.className = "tag"; d.querySelector("i").textContent = ""; }); },
    wait,
  };
}
