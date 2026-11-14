# Publish Ballpark Cribbage 121 to the internet

**Status:** The game is tested locally. It is not yet deployed to a publicly accessible URL.

## Recommended: Render Node.js Web Service

1. Connect a Render account for deployment, or open [Render](https://render.com/) in your browser.
2. Put this entire project **at the root** of a new GitHub repository. This means `server.js`, `game.js`, `package.json`, `public/` and `render.yaml` must appear at the root (not nested inside another directory).
3. In Render: **New** → **Web Service** → connect the GitHub repository. Choose the Node.js runtime.
4. Build command: `npm install` (no external production dependencies). Start command: `npm start`. Node version: at least 20. `render.yaml` is a starting blueprint.
5. The server should respond at the host's `/api/health` URL with `{"ok":true,...}`. Open the root HTTPS address and verify the game lobby.
6. Person 1 creates a game room and shares its invite link; person 2 opens the link in another device or browser to join as Detroit. Player 1 is Cleveland.

**Keep the service at a single instance.** The server's in-memory room events are not currently designed for autoscaled, multi-instance deployment.

**Storage persistence:** By default, game data lives in `data/rooms.json`. On a host with an ephemeral filesystem, rooms may disappear on a restart or redeploy. For persistent games on Render, an appropriate paid plan with a persistent disk can mount `/var/data`, and you can set `DATA_FILE=/var/data/rooms.json`. Check current plan pricing before enabling paid hosting.

**Free-tier hosting:** Render's free service can spin down after inactivity and wake when a user connects. SSE connection delays or interruptions are possible during warm-up. See [Render's deployment guide](https://render.com/docs/your-first-deploy).

## Local smoke test

```
npm test
npm start
```

Then navigate to `http://localhost:3000`. The game requires the actual Node server to let two separate devices play together; uploading `index.html` to a static-only host is not sufficient.

## IP and public release notes

- This is an **unofficial fan-made baseball-inspired game**, not endorsed by Major League Baseball, the Cleveland Guardians or the Detroit Tigers.
- The franchise names and 52 historically associated player names in each deck are textual tributes; the original monogram badges are team-inspired, not copies of official protected logos.
- The 16 painted portrait illustrations are **interpretive art**, reused across cards. They are not authenticated portraits or exact depictions of the people named on the cards.
- If you plan a commercial public release with official player likenesses, MLB logos, or branded team materials, secure the relevant rights first.
