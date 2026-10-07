# Quantum Ludo

**Ludo, evolved.**

Quantum Ludo is a quantum-inspired take on the family board game. You still roll the die, race four tokens around the board and send rivals back to the yard. On top of that you manage a small pool of **Quantum charges** and use four simple quantum-inspired mechanics: splitting a token across two squares, linking two tokens together, turning a token into an untouchable ghost, and observing an opponent's token to force it into place.

It is built as a competition. The aim is to reward strategic thinking, good decisions under uncertainty, probability awareness and the ability to adapt when the board changes. This isn't about waiting on a lucky roll. It turns a family game of chance into a ruthless tactical knife fight. Manage your economy, manipulate probability, and collapse the board to your advantage

> **Status:** playable in the browser: hot-seat, bots, and same-Wi-Fi multiplayer. Rules are draft v0.2, balance-tested with bot simulations. Online rooms are next.

## Contents
- [Highlights](#highlights)
- [The basics](#the-basics)
- [Quantum charges and Nodes](#quantum-charges-and-nodes)
- [Quantum mechanics](#quantum-mechanics)
- [Turn sequence](#turn-sequence)
- [Legal actions and limits](#legal-actions-and-limits)
- [Scoring](#scoring)
- [Important game situations](#important-game-situations)
- [Skills it tests](#skills-it-tests)
- [Bot opponents](#bot-opponents)
- [Platforms and modes](#platforms-and-modes)
- [Tech stack](#tech-stack)
- [Roadmap](#roadmap)

## Highlights
- 2 to 4 players, any seat can be a human or a bot.
- Familiar Ludo rules, so it is easy to pick up.
- Four quantum mechanics, all powered by one resource.
- Two Observation modes: **Chaos** (coin flip) or **Tactical** (your choice).
- Points-based scoring suited to tournaments.
- Plays in a browser on desktop and on a phone, and installs as a web app.
- Planned offline play on the same Wi-Fi, and online rooms.

## The basics
- Each player has **4 tokens**, which start in their yard.
- Roll a **6** to bring a token out onto your start square.
- Tokens travel clockwise around the shared 52-square loop, then up their own colour's home column.
- To get a token **home** you must roll the exact number needed.
- Land on a lone opposing token to **capture** it and send it back to its yard.
- **Safe squares** (the four start squares and the four star squares) cannot be captured on, and tokens of different colours may share them.
- Two of your tokens on one normal (non-safe) square form a **blockade** that opponents cannot land on or pass.
- Rolling a **6** gives you another roll, up to two extra in a row. A third consecutive 6 is forfeited.
- If you have no legal move, you pass.

## Quantum charges and Nodes
Quantum actions cost **Q** (Quantum charges).

- You start with **1 Q** and can hold at most **4 Q**.
- The eight safe squares are also **Quantum Nodes**. Landing **exactly** on a Node with a normal move earns **+1 Q**. Passing over a Node earns nothing, and leaving the yard onto your own start square does not count.
- After a Node pays out it goes **dormant until the next round**, so busy Nodes become a race.
- You also gain **+1 Q whenever one of your tokens is captured**, a small comeback boost.

Because Q only comes from landing on Nodes, every roll becomes a choice: move your lead token for raw speed, or put a rear token on a Node to gather charge.

## Quantum mechanics
Each of these costs **1 Q**.

### 1. Superposition(Split)
Instead of moving a token by the number you rolled (`r`), place it on **two squares at once**: `r` squares ahead and `7 − r` squares ahead (the opposite face of the die).

- Example: you roll a 2. The token can be a 2-step marker and a 5-step marker.
- The token stays in both places until it **collapses**.
- **Your collapse:** at the start of your next turn you choose which marker becomes real, or **hold** the superposition open for one more round. At the start of the turn after that you must collapse. Keeping your options open is the benefit; the price is that the token cannot move and stays exposed to hits and Force while it waits.
- **Opponent hits a marker:** if an opponent lands on one of the markers, flip a coin. If it matches that marker, your token is captured. Otherwise your token collapses to the other marker and the attacker stays where they landed. Only the first hit counts.
- Only one superposed token per player at a time.

### 2. Entanglement(Link)
Link two of your tokens that are both on the track. Linking is a **free action**: you link after rolling, then still make your move.

- Whenever you move one, its partner moves **half the roll, rounded down**, for free (if that move is legal).
- Risk: if either token is captured, the partner is knocked back **6 squares** (never behind its own start square) and the link ends.
- You can break the link for free at the start of your turn. It also ends when either token enters the home column.
- One link per player at a time.

### 3. Ghost(Drift)
Move a token normally and turn it into a ghost. Until the start of your next turn it is **completely immune**: it cannot be captured, hit or knocked back.

The price of that protection:
- A drifting token **cannot capture**. If it lands on an opponent, nothing happens and both tokens share the square.
- A drifting token **cannot enter the home column**, on this move or on a bonus roll.
- It does not form blockades. It does pass through and land on them, because it is a ghost.

When the drift ends, the token simply becomes solid where it stands. If it is sharing a square with an opponent, the next token to land there captures every lone token on it.

### 4. Observation(Force)
Pick an opponent's superposed token and force it to collapse now. Force is a **free action**: you still make your move with the same roll. The Observation mode is chosen in the lobby:

| | **Chaos mode** | **Tactical mode** |
|---|---|---|
| Who decides the marker | A coin flip | **You** choose |
| Signature play | Gamble on where it lands, then react | **Measure then strike**: force the token onto a square your roll reaches, then capture it with no coin flip |
| Feel | Gamble, swings and upsets | Calculation, forcing the opponent onto the worst square |

Superposition (your own choice when you collapse) and the 50% hit coin are the same in both modes. You can Force at most once per roll.

## Turn sequence
1. **Upkeep:** collapse your own superposed token (you choose the marker) or hold it open one more round, and optionally break an entanglement.
2. **Roll** the die.
3. **Free actions (optional):** Link two tokens, and/or Force an opponent's superposed token.
4. **Use your roll:** a normal move, a Split, or a Ghost move. If no normal move exists, you pass.
5. **Resolve:** captures, blockades, collapses, entangled partners and Node payouts.
6. **Bonus roll** if you rolled a 6 (up to two extra).
7. **End** your turn.

## Legal actions and limits
- A token cannot enter superposition from the yard or from the home column.
- Both superposition markers must be legal landing squares: they cannot overshoot home, cannot sit on a non-safe square held by an opponent, and cannot be placed past an opposing blockade.
- Markers do not capture and do not form blockades.
- A token in superposition cannot be entangled, and a drifting token cannot be split.
- A Ghost move must stay on the shared track: it can never enter the home column.
- A marker on a safe square cannot be hit.
- Retreats (for example an entangled partner being knocked back) never capture.
- You cannot spend Q you do not have, and Q above 4 is lost.

## Scoring

| Event | Points |
|---|---|
| A token reaches home | +10 |
| Progress at game end (tokens not yet home) | +1 per 5 squares advanced |
| Capturing an opponent | +3 (+4 if the target was in superposition) |
| Being captured | −1 |
| Placement | 1st +15, 2nd +8, 3rd +4 |
| Unspent Q at the end | +1 each, up to 2 |

**The game ends** when the first player gets all four tokens home. A **120-round mercy cap** stops a stalled game, but in testing fewer than 1 game in 200 reaches it.

**Placement:** the player who got all four tokens home is 1st. Everyone else is placed by **number of tokens home**, then by **distance to home** (total squares their tokens still have to travel, shorter is better). If the mercy cap is reached, everyone is placed this way.

In a tournament, points are added up across several games. Both Observation modes score the same, so results are comparable.

## Important game situations
- **Hit on a marker:** the first attacker to land on a marker flips the coin. Once resolved, nobody else gets a second flip.
- **Collapse onto a Node:** collapsing a superposed token onto a Node does not pay Q, only normal landings do.
- **Chain reaction:** capturing an entangled token also hurts its partner, but the partner is only pushed back, not sent home.
- **Q starvation:** with 0 Q you cannot use any quantum action, so deciding when to spend or save matters.
- **Ghost sharing a square:** a drifting token and an opponent can share a normal square. Neither captures the other, and the next token to land there captures every lone token on it.
- **Holding a Split:** a held superposition gives opponents a second round to hit it or Force it, so hold only when both markers are worth keeping.
- **Measure then strike:** in Tactical mode, Force an opponent's token onto the square your roll reaches, then land on it for a guaranteed capture.
- **Endgame exactness:** entering home needs an exact roll, and superposition gives two chances at the same roll.
- **No collapse before the game ends:** a token still in superposition is scored at the marker with less progress.

## Skills it tests
- **Strategic thinking:** planning how to gather and spend Q, and when to entangle.
- **Decision-making:** each turn weighs a normal move against several quantum options.
- **Probability awareness:** coin flips, die faces and the `r` / `7 − r` pairing.
- **Adaptability:** you choose which marker becomes real after seeing what opponents did.

## Bot opponents
Four bots, each with a different personality and strategy:

| Bot | Style |
|---|---|
| **The Hunter** | Aggressive. Chases captures and uses Observation to force bad squares. |
| **The Racer** | Pure speed. Rushes tokens home and only spends Q on Ghost to shield a runner. |
| **The Gambler** | Quantum-heavy. Superposes often, entangles pairs and farms Nodes. |
| **The Banker** | Defensive. Hoards Q, sits on safe squares and Nodes, and spends only on clear gains. |

## Platforms and modes
- **Web and desktop browser:** the UI is designed mobile-first and scales to a desktop window while keeping the same look and feel.
- **Phone:** installable as a web app (PWA).
- **Hot-seat:** 2 to 4 players on one device, with any seat switchable to a bot.
- **Same-Wi-Fi games**: up to 4 devices play together on one Wi-Fi network or a phone hotspot, with no internet and no accounts. See [Playing over Wi-Fi](#playing-over-wi-fi).
- **Online rooms** (planned): join a friend's room with a code.

## Playing over Wi-Fi
1. **Host:** in the lobby, set a seat to **Remote** for each friend joining from their own device, then tap **Host Wi-Fi game**.
2. **Host:** tap **Invite player**. An invite QR code appears.
3. **Friend:** open the game, tap **Join a game on this Wi-Fi**, enter a name and scan the invite. A reply code appears.
4. **Host:** tap **Read their reply** and scan the friend's reply. You are connected; repeat for each friend, then **Start game**.

The host's device runs the game, rolls the dice and checks every move, so the result is the same on every screen. If a friend drops out, the host can invite them again or swap in a bot from **Players**. Codes can also be copied and pasted instead of scanned.

Everyone must be on the same network. A phone hotspot works well; some public or guest Wi-Fi networks block devices from talking to each other.

## Tech stack
- **Frontend:** React, Vite and Tailwind CSS
- **Game logic:** TypeScript, a pure rules engine shared by client and server
- **Online and real-time:** Supabase
- **Same-Wi-Fi multiplayer:** WebRTC data channels, paired by QR codes (no server)
- **Package manager:** pnpm

## Getting started
Requires Node 20+ and pnpm (`corepack enable pnpm`).

```bash
pnpm install
pnpm dev        # play at http://localhost:5199 (also reachable from a phone on the same Wi-Fi)
pnpm dev:https  # same, over https, so phones can use the camera to scan pairing codes
pnpm test       # rules engine, bots and UI unit tests
pnpm e2e        # browser smoke tests on phone and desktop viewports
pnpm sim -- --games=1000 --players=4 --mode=both   # bot-vs-bot balance report
pnpm build      # production build with offline support
```

## Roadmap
1. **M0:** rules engine, tests and bot-vs-bot balance simulations
2. **M1:** playable app with hot-seat, bots, lobby settings and offline-capable PWA
3. **M2:** offline Wi-Fi lobbies and online rooms
4. **M3:** polish, animation, sound, stats and rematch
5. **M4 (optional):** native wrapper for Bluetooth play
