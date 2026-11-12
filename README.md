# VEXELBOUND // ONLINE — Browser Multiplayer Beta

**Original pixel-art arena fighter — playable in Chrome, Safari, Edge, and Firefox with a Node.js server.**

This is the **original, multiplayer branch** of our earlier anime-inspired fighting-game experiments, not a claim that the old 35-mission story and original anime-character sprites have been merged or legally cleared for public release. To prepare for a public web release, this branch uses **original fighter names, a new world, and programmatically drawn pixel-art characters**.

## What works in this version

- Real browser-to-browser multiplayer over a WebSocket server.
- 1v1 (2 players), 2v2 (4 players), and 3v3 (6 players).
- Create private room -> six-character room code -> copy invite URL -> friends join that same live room.
- Public **Find Match** queues for 1v1/2v2/3v3. This is a simple same-server queue, not a global ranked matchmaker.
- Two balanced teams, character selection, ready checks, best-of-three rounds, win/lose, and rematch.
- 12 original playable fighters: Solis, Ember, Noct, Atlas, Rook, Volt, Fortune, Verdant, Aegis, Frost, Prism, and Gale.
- **Atlas is a playable hero, never a curse/enemy.** Fang Wraith is a separate, non-playable monster fought in solo training.
- Punch combos, heavy attacks, blocking, perfect parry, counterattack, jump, dash, two abilities and an ultimate for each fighter.
- Server-managed movement, health, cooldowns, damage, hitboxes, projectiles, energy, teams, and scoring.
- Keyboard/mouse and touchscreen controls.
- Does not require npm packages or a database. No accounts or player chat.

## Local play on a Mac

1. Install **Node.js 20 or later** from https://nodejs.org if you do not already have it.
2. Extract this ZIP file. Double-click `START_MAC.command` (macOS may ask you to confirm opening a downloaded script). Or open Terminal in this folder and run:

   ```sh
   node server.js
   ```

3. Open **http://localhost:3000** in Chrome or Safari.
4. Choose a nickname, match size, and **Create Private Room**. The code is shown in the lobby.

**Important:** `localhost` only points to *your own computer*. Friends in other houses cannot open your `localhost` URL. For friends across the internet, deploy to an HTTPS Node web service below.

On Windows: double-click `START_WINDOWS.bat` (Node.js must be installed). On Linux: run `node server.js`.

## Put it online and invite friends (Render example)

1. Create a repository on [GitHub](https://github.com) and upload the extracted project files (`server.js`, `public/`, `package.json`, and `render.yaml` at the root).
2. Sign in to [Render](https://dashboard.render.com/), choose **New → Web Service**, and connect that repository. Use the Node runtime.
3. **Build command:** `echo No dependencies`
4. **Start command:** `node server.js`
5. Set the health-check path to `/health`. Deploy as one web-service instance.
6. Open the HTTPS address Render gives you (it will look like `https://your-service.onrender.com`). It must show **SERVER CONNECTED**. Choose a match size, create a room, and use **COPY LINK**.
7. Your friends visit the *same deployed website*, using the invite URL or room code. When both sides are full and all players are ready, the round starts automatically.

The browser upgrades to `wss://` automatically on HTTPS. A static-only host is **not enough** for these online matches; you need the Node server to be running. Render's free service can sleep after inactivity, so the first visit may take a little longer. Consult Render's current plans for pricing and limits.

Official docs: https://render.com/docs/websocket and https://render.com/docs/web-services

### Can people find the game on Google?

After you deploy, it is a real browser website, and people can use its URL. To appear in Google search results, give Google time to index it; optionally verify your domain in Google Search Console and submit a sitemap. **This ZIP has not been deployed on your behalf, and there is no live public URL yet.**

## Controls

| Key / input | Action |
|---|---|
| A / D | Move |
| W / Space | Jump |
| Shift | Dash |
| Left mouse button / J | Punch combo |
| Right mouse button / K | Heavy attack |
| F (hold) | Block; the first ~175 ms can parry attacks |
| Q | Counterattack just after a successful parry |
| 1 | Unique technique one |
| 2 | Unique technique two |
| R | Ultimate when energy is full |

Mobile players use the on-screen buttons. Landscape mode is recommended for better visibility.

## Testing

With Node 20+ installed, run:

```sh
npm test
```

This starts a temporary game server and tests three match sizes, room codes, real-time movement, combat parries/counters, and enemy-only training.

## Technical notes / beta limits

- **Up to 6 real players per room**, single server process. No shared-room database, cross-instance matchmaking, or rejoin tokens yet.
- A server restart clears room codes, matches, and scores. Rematches work while the original server/room is alive.
- Expect some network latency over long distances; this is a server-authoritative beta with simple rendering interpolation, not rollback netcode.
- Public queue matches users on the **same server instance**. For early testing, private codes are more reliable.
- Room codes are invitations, not strong authentication. Share them only with players you want in the room.
- Not fully tested on all physical phones, browsers, and internet connections. Automated network tests have passed; keep a copy of any bug reports for improvements.
- No commercial-ready moderation, anti-abuse infrastructure, persistent user profiles, progression, or payment system. Do not call this a finished commercial release.
- This online branch does **not** include the previous anime-canon story campaign or its copied designs. Keeping original story and artwork matters for public publishing: **renaming copyrighted characters alone does not clear the underlying artwork/story rights**.

## File guide

- `server.js` — HTTP server, WebSocket protocol, rooms, server-authoritative simulation, solo monster AI.
- `public/index.html` — responsive homepage, lobby, roster, and fight UI.
- `public/style.css` — typography, pixel-style UI, mobile layout.
- `public/game.js` — browser networking, inputs, original pixel-art fighter renderer, arena effects.
- `render.yaml` — optional Render deployment settings.
- `tests/` — Node multiplayer/combat integration tests.

Enjoy building your world! ⚔️
