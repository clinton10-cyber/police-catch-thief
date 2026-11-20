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

No build step: static `index.html` + ES modules + a bundled three.js (r169, MIT). Run locally with `python3 -m http.server 8080`.
