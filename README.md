# Police & Thief — 3D

The classic paper-chit game (King · Queen · Minister · Police · Thief) in 3D, played against four NPCs.
Roles are reshuffled every round. The Police walks forward and shoots who they think is the Thief.

**Play:** https://clinton10-cyber.github.io/police-catch-thief/

| Role | Points |
|---|---|
| King | 1000 |
| Queen | 800 |
| Minister | 600 |
| Police | 500 |
| Thief | 0 |

Scoring: Police shoots the Thief → Police banks 500. Police shoots anyone else → that player banks 500.
No one ever loses points. Scores are kept in your browser (localStorage).

Set in the **Everyday-in-PH canteen**. The five players are built with the main game's **faceted lowpoly wardrobe** (everyone wears the same outfit so nobody can be read) and carry the main game's **pistol** with its solved two-handed stance. Pick a shared outfit in the menu. UI: glass HUD, hold-to-peek role card, lock-on + FIRE, synth sound, haptics, round history.

No build step: static `index.html` + ES modules + a bundled three.js (r169, MIT). Run locally with `python3 -m http.server 8080`.
