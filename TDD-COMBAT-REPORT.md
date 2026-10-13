# Combat expansion — TDD evidence

Source plan: user-approved combat-and-world expansion derived in this session.

| Guarantee | Test | Result |
| --- | --- | --- |
| All nine original Aspects have distinct IDs, controls and cooldown behavior | `tests/combat.test.mjs` | PASS |
| Giants patrol, pursue nearby pilots and remain within the city boundary | `tests/combat.test.mjs` | PASS |
| Blade damage only applies at a glowing weak point and can defeat a giant | `tests/combat.test.mjs` | PASS |
| Walking, boost, cables, landing, collision recovery and camera safety remain stable | `tests/movement.test.mjs` | PASS |
| Real WebGL city renders movement, Aspects and giant-enemy systems | `tests/browser.html` | PASS when run in the local browser |

RED evidence: `node --test tests/combat.test.mjs` initially failed because `src/aspects.js` did not exist. The failing import was the intended proof that combat systems were absent.

GREEN evidence: `npm run verify` passed 10 tests after `aspects.js`, `enemies.js`, player integration and UI integration were added. `npm run build` completed successfully.

Coverage note: this repository uses Node's built-in test runner without configured coverage collection. The behavior suite covers the newly introduced pure state machines and the browser regression page exercises the real Three.js scene. Visual art quality, full enemy encounter balance and every camera angle still need manual playtesting.
