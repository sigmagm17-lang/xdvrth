# JJK Pixel Cursed Clash V16 — COMPLETE UPDATE

This is the **entire** working game project, not just a CSS file. It includes:

- JJK Pixel Cursed Clash story campaign, bots, skins and existing 1–4 ability controls.
- 1v1, 2v2, 3v3 real-time multiplayer with private room codes.
- V16 phone controls: **big left/right movement buttons (92px tall)** in multiplayer; jump, dash, blocking and attacks retain their normal size.
- Latest standalone story HTML (which also includes its larger movement controls).
- Browser refresh fix: versioned CSS URL prevents old phone styles from being cached.
- All included sprites, server code and tests.

## HOW TO REPLACE YOUR GITHUB VERSION

1. Unzip **JJK_V16_FULL_MOBILE_MULTIPLAYER.zip** on your MacBook.
2. Open https://github.com/sigmagm17-lang/xdvrth/upload/main
3. In Finder, open the unzipped folder; drag **all the items INSIDE it** into GitHub's upload box. Keep `public` and `tests` folders intact. Do **not** upload the ZIP itself.
4. At the repo root, you should see `server.js`, `package.json`, `render.yaml`, `JJK_Pixel_Cursed_Clash_Private_V10.html`, and the `public` and `tests` folders. Within `public/` should be `style.css`, `game.js`, `index.html`, and `sprites/`.
5. Click **Commit changes**. When your connected Render service deploys the latest commit, open the game in a phone browser. If the buttons still look old, refresh the page.

**You don't need a new Render service.** Your existing Render Web Service continues to use `node server.js`.

## YOUR GAME LINKS AFTER DEPLOYING

- **Multiplayer 1v1/2v2/3v3:** https://vexelbound-online.onrender.com/index.html
- **Story / bots:** https://vexelbound-online.onrender.com/story

These links are to your existing server; uploading this ZIP does not change the live website until you commit and Render finishes deploying.

## LOCAL TESTING (OPTIONAL)

Install Node.js 20 or later, open Terminal in this folder, run `node server.js`, then open http://localhost:3000/index.html for multiplayer or http://localhost:3000/story for single player. Run `npm test` to execute automated multiplayer / combat tests.

## PRIVACY / COPYRIGHT

This is a fan-made JJK project, not an official release; public distribution of recognizable copyrighted characters and story material can lead to a takedown. Private match codes limit room admission, not public access to the Render website.
