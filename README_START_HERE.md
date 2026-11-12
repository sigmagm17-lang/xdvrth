# JJK Pixel Cursed Clash — public Render edition

Fan-made JJK-inspired browser fighting game, bundled with classic V10 story/bot mode and a separate real-time online arena. Public link supports PCs and phone browsers.

## Deploy to Render

1. Unzip this ZIP on your Mac, then upload all files **inside the extracted folder** to a GitHub repository. `server.js`, `package.json`, `render.yaml`, `JJK_Pixel_Cursed_Clash_Private_V10.html`, and `public/` must be at the repo root. The GitHub repository can stay **private**.
2. Visit https://dashboard.render.com/ → New → Web Service → connect that GitHub repository (or reuse an existing Render Web Service connected to it).
3. Select `Node` as the runtime and `Free` as the instance plan.
4. Use build command: `echo "No dependencies"` and start command: `node server.js`.
5. No password variable is needed. If you are upgrading the earlier password-protected version, this version's source no longer requires `GAME_PASSWORD`.
6. Deploy, wait for Live status, then open your assigned `https://...onrender.com` address.
7. The homepage is the online arena. Click **STORY MODE + BOTS** for the single-player game. In online arena: private room codes allow invited matches, and quick match is public.

## What is public?

Anyone with your game URL can open it; private room codes only limit individual matches, NOT website access. GitHub visibility is separate from game visibility. The free Render plan may sleep during inactivity; see https://render.com/docs/free.

## IMPORTANT before public release

This is an unofficial fan game using recognizable JJK characters and original JJK story ideas. Publicly distributing it may draw a copyright or trademark complaint even if free. A safer public release requires replacing protected art, names, and story elements or obtaining appropriate permissions. Be careful with privacy: usernames and chat content you share in multiplayer may be visible to others.

## Technical

Server: plain Node.js >=20, no npm dependencies, server-authoritative WebSocket matches. Story mode is served from `/story` and doesn't require a WebSocket. `npm test` runs test suites; multiplayer and story systems are separate.
