# Sol Pod — Forge mechanics validation matrix (v0.40)

**Scope:** End-to-end Commander matches, Forge Android backend, custom Sol Pod UI. **Status:** scenario design and UI/trace instrumentation, **NOT** a claim that every rule has been proven correct. Always inspect **Forge's authoritative state** before changing a rule. The full-screen target picker must submit only engine-provided target IDs.

## How to run

For each scenario, start a manual 1v1 game with known decks/cards and note **turn, phase, controller, exact card, casting mode and targets**. Open Match options → Match history → **Copy Forge rules diagnostics**. Save the trace with a screenshot of any failed decision. The trace contains public zone counts, life, stack identities and UI prompts but does **not** expose opponents' hidden cards. It samples published GameView updates: missing intermediate events may require native Forge instrumented tests.

Classify failures:

- **E — Engine**: Forge itself produces a wrong zone/life/stack result when the legal action is confirmed.
- **B — Bridge**: Forge issues a real choice but proxy/dispatcher cannot represent/answer it; errors like "Missing ... choice handler".
- **U — UI**: GameView is correct but Sol Pod shows an incorrect card, counter, life, zone, target or option.
- **R — Recovery**: native request timing, deadlocks, stale decisions, timeout or repeated commands.

Never fake a result by modifying `libraryCount`, `graveyard`, `stack` or player loss in the browser. It must come from Forge.

## Core mechanics — repeatable acceptance tests

| # | Rules area | Concrete scenario | What Forge should do | Required evidence |
|---|---|---|---|---|
| 01 | Replacement: mill | Bruvac on your battlefield; cast **Maddening Cacophony** kicked, opponent with N cards | Opponent mills `min(N,2*ceil(N/2)) = N`; **Bruvac itself does NOT trigger on the stack** | Before/after opponent library+graveyard, source controller, kicker choice, stack leave |
| 02 | Replacement: mill | Same, Cacophony not kicked | Each opponent mills up to 16, not necessarily entire library | Before/after library and graveyard |
| 03 | Odd-count rounding | Bruvac + **Cut Your Losses** on an opponent with 41 cards | Mills 2×floor(41/2)=40; one library card remains (unless another replacement applies) | Exact target, pre/post counts |
| 04 | Cycling trigger vs replacement | Bruvac + cycle **Fractured Sanity** | Trigger that makes each opponent mill four goes on stack; Bruvac modifies resulting mill from 4 to 8; cycling draw is separate | Trigger appearance, stack order, each opponent's delta |
| 05 | Draw-from-empty loss | Opponent library is zero, next mandatory draw | Player loses when attempted draw from empty library under state-based actions, not when mill itself empties library (unless another effect intervenes) | Library count, draw attempt, `hasLost` / gameOver |
| 06 | Multiple replacement effects | Bruvac + another mill replacement controlled by relevant players | Affected player gets the engine-prescribed replacement ordering choices; no incorrect repeated application | Every choice sheet, deltas |
| 07 | ETB triggers | **Panharmonicon** + relevant artifact/creature ETB | Appropriate triggers happen additional times on stack, with legal target choices | Stack item IDs, chosen targets, final state |
| 08 | Death triggers | **Solemn Simulacrum** dies | Dies trigger placed on stack and draw happens if it resolves | Battlefield exit, stack enter/leave, hand/library deltas |
| 09 | Token replacement | **Anointed Procession** + create multiple tokens | Token count doubled *without a separate stack trigger from the replacement* | Exact battlefield instance count |
| 10 | Damage replacement | **Torbran, Thane of Red Fell** + your red noncombat damage | Damage modified in Forge, without a fake "Torbran trigger" on the stack | Life/damage after resolution |
| 11 | Exile replacement | **Rest in Peace** + destroy creature or mill cards | Cards exiled instead of going to graveyard; dies trigger conditions evaluated by Forge | Exile/graveyard/battlefield changes |
| 12 | Ward | Spell targets creature with ward, target otherwise legal | Target is allowed, ward triggered cost/counter follows; no pre-emptive target rejection | Target sheet, ward stack item, cost choice |
| 13 | Hexproof / shroud / protection | Try target creature with each restriction | Only legally targetable objects offered by Forge | Legal target IDs, rejected illegal attempts |
| 14 | Multiple targets | Spell requiring two distinct targets | Correct min/max, selection order and exact IDs; no auto-resolve before all chosen | Selection updates, stack item targets |
| 15 | Optional targets | Spell that says "up to" / "any number" | Skip/zero target valid only when Forge allows, not simply when picker closes | Selection and Forge prompt |
| 16 | Trigger order | Multiple upkeep/ETB/death triggers owned by same player | Controller can choose permitted order; stack is last-in-first-out | Explicit order chooser, stack item order |
| 17 | APNAP | Simultaneous triggers from you and one to three opponents | Correct Active Player / Non-Active Player ordering and priority windows | Trace of ordered stack entry |
| 18 | Trigger timing | Trigger during a spell's resolution | New triggers placed on stack at correct rules time, not immediately when underlying action happens | Stack transitions and prompt events |
| 19 | Copy spell | **Narset's Reversal** or another copy effect | Copy on stack with separate ID, correct targets/resolution, original handled correctly | Stack IDs and public results |
| 20 | Counterspell | Counter an opponent spell already on stack | Legal spell selected, priority correctly offered, countered spell does not resolve | Exact stack target, public zone change |
| 21 | Kicker / alternate costs | Kick Cacophony, escape/flashback another spell | Alternative/additional cost choices respected; no fake local "can't cast" logic | Source cast mode, mana/choice prompts |
| 22 | Reanimation | **Reanimate** target creature card in either graveyard | Public-zone target selected by exact Forge ID; creature moves and other effects happen | Target ID and zones |
| 23 | Graveyard/exile casting | **Faithless Looting** flashback / another explicitly castable exile spell | Forge enables correct zone/permission/cost; effect goes to correct zone | Source zone and resulting game state |
| 24 | Combat timing | Two blockers, one attacker; first strike/trample/deathtouch | Correct declaration, damage assignment, damage steps, losses, triggered abilities | Combat assignments and final creatures/life |
| 25 | Combat targeting | Attack player, planeswalker and battle | Each legally available defending entity selectable; blocker/defender IDs preserved | Attacker and defender IDs |
| 26 | Draw and replacement | **Rhystic Study**, **Smothering Tithe**, draw prevention | Appropriate triggers/choices, player may pay costs; draw prevention before actual draw | Stack choices and hand/library changes |
| 27 | Commander | Recast commander after death/counter/exile | Optional command-zone move under rules, tax increments, commander damage remains authoritative | Command zone, casts, life/damage |
| 28 | Scry / surveil / search | Scry multiple, surveil graveyard placement, search/shuffle | All requested card ordering, zones, reveals and shuffle choices accessible | Choice event IDs and zone changes |
| 29 | Copies, control, attachments | Clone, aura, equipment, gain control | View and engine distinguish instance IDs, controllers, attachment host and abilities | Battlefield state + visual projection |
| 30 | Multiplayer elimination | 3/4 player pod, opponent loses with stack unresolved | State-based cleanup, controlled permanents, other players' priority and match ending remain correct | `hasLost`, stack, controller IDs |
| 31 | Continuous effects | **Bruvac** leaves battlefield before a mill spell resolves | Replacement applies only when present at the relevant event, subject to layers and state at resolution | Battlefield snapshot at actual resolution |
| 32 | Replacement vs trigger | Multiple replacements and triggers for the same event | Replacement modifies the event **before** triggered abilities are checked; one event may cause several triggers | Zone and stack events; real Forge replay |

## Instrumentation limitations and future engine tests

The v0.40 JavaScript trace is **observational**: it records visible snapshot changes and choices but cannot prove whether an effect was replaced, prevented or countered. For true engine confidence, build deterministic Forge **headless integration tests** with fixed decks, controlled hands/library order, known priority sequence and assertions against Java Game/Player/Stack objects at resolution. Test all 32 scenarios directly against the pinned Forge revision and distinguish an upstream Forge defect from a Sol Pod bridge defect. Android emulator startup tests alone do not prove these mechanics.

Review every IGuiGame callback used by real Forge matches. Any callback whose result is needed to continue play must be supported by the native `CommandTableChoiceDispatcher` or surface a recoverable explicit failure, never a silently selected default.

For user bug reports, always collect the *exact card name and mode* (e.g. `Maddening Cacophony — kicked` versus `Cut Your Losses — casualty`), source controller, affected player, library size before resolving, and whether opponents later attempted to draw. A spell with “half rounded **down**” can leave a card with Bruvac when the library size is odd.
