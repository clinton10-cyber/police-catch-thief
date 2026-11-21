/* rules.js — pure game logic (no 3D, no DOM). */
export const ROLES = {
  KING:     { id: "king",     label: "King",     points: 1000 },
  QUEEN:    { id: "queen",    label: "Queen",    points: 800 },
  MINISTER: { id: "minister", label: "Minister", points: 600 },
  POLICE:   { id: "police",   label: "Police",   points: 500 },
  THIEF:    { id: "thief",    label: "Thief",    points: 0 },
};
export const POT = ROLES.POLICE.points;
const DECK = [ROLES.KING, ROLES.QUEEN, ROLES.MINISTER, ROLES.POLICE, ROLES.THIEF];

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Seats never move; the folded papers are reshuffled and dealt every round. */
/* The shuffled papers lie face-down in a row. The human takes paper `pick`; the rest go to the NPCs at random. */
export function createRound(seats, rng = Math.random, pick = null) {
  if (seats.length !== DECK.length) throw new Error(`Needs exactly ${DECK.length} seats`);
  const papers = shuffle(DECK, rng);
  let roles = papers;
  if (pick !== null && pick >= 0 && pick < papers.length) {
    const rest = shuffle(papers.filter((_, k) => k !== pick), rng);
    const humanSeat = seats.findIndex((s) => s.isHuman);
    roles = []; let r = 0;
    seats.forEach((_, i) => { roles[i] = i === humanSeat ? papers[pick] : rest[r++]; });
  }
  const dealt = seats.map((s, i) => ({ ...s, role: roles[i] }));
  return {
    seats: dealt,
    police: dealt.find((s) => s.role.id === "police"),
    thief: dealt.find((s) => s.role.id === "thief"),
    resolved: false,
  };
}

/* NPC Police: a pure guess among the four other seats. */
export function npcPickTarget(round, rng = Math.random) {
  const others = round.seats.filter((s) => s.seatId !== round.police.seatId);
  return others[Math.floor(rng() * others.length)].seatId;
}

/* Correct → Police banks the pot. Wrong → the person shot banks the pot. Nobody ever loses points. */
export function resolveShot(round, targetSeatId) {
  if (round.resolved) throw new Error("Round already resolved");
  const police = round.police;
  const target = round.seats.find((s) => s.seatId === targetSeatId);
  if (!target) throw new Error("No such seat");
  if (target.seatId === police.seatId) throw new Error("Police cannot shoot themselves");
  round.resolved = true;
  if (target.role.id === "thief") {
    police.score += POT;
    return { correct: true, pot: POT, police, target, winner: police,
      message: `${police.name} (Police) caught ${target.name} — the Thief! ${police.isHuman ? "You bank" : "Police banks"} ${POT}.` };
  }
  target.score += POT;
  return { correct: false, pot: POT, police, target, winner: target,
    message: `${police.name} (Police) shot ${target.name} — a ${target.role.label}, not the Thief. ${target.name} ${target.isHuman ? "take" : "takes"} ${POT}.` };
}
