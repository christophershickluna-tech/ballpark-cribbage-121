# Ballpark Cribbage 121 — Launch Checklist

Status as of November 14, 2026: source tested locally; no live host or public game URL yet.

## Account setup and publishing

1. Install and connect the **Render** app in ChatGPT or sign in at https://dashboard.render.com/.
2. Create an empty GitHub repository named `ballpark-cribbage-121` (private or public). You can use https://github.com/new. Upload the **unpacked contents of this ZIP** to the repository root, so `server.js`, `package.json`, `game.js`, `render.yaml`, `public/` and `test/` appear at the top level. Do not upload only the ZIP itself.
3. In Render, choose **New → Blueprint** (or **New → Web Service**), authorize access to the repository, and select `ballpark-cribbage-121`. The included `render.yaml` explicitly requests a **free** Node 22 web service with one instance.
4. If creating a Web Service manually instead: Runtime Node, Build `npm install`, Start `npm start`, Health check `/api/health`, Node >=20, Free instance, one instance.
5. After Render reports a successful deployment, open `https://YOUR-SERVICE.onrender.com/api/health`. A healthy server returns JSON beginning `{"ok":true`.
6. Open the site in an ordinary browser. Create a six-character room on one device, join using its invite link from another device, verify that each player sees only their own baseball player cards and that both scores synchronize. Test full pegging and rematch.

## Limitations to know before public launch

- The game is unofficial baseball-inspired fan software, **not** an MLB, Cleveland Guardians, or Detroit Tigers product. Illustrated portraits are interpretive art, not exact player likenesses.
- On a free service, the server can spin down when idle. Sessions may be interrupted during spin-up and game data is **not reliably persistent across restarts/deploys** because the free filesystem is ephemeral.
- This release uses an in-process room manager and must run on **exactly one server instance**. It is suitable for a private beta and small-scale play, not for high-scale simultaneous game hosting without backend upgrades.
- Do not share the private session token. Sharing the room invitation URL is intended, and the second seat is capped at one opponent.

## Local verification

```sh
npm test
npm start
# Health: http://localhost:3000/api/health
# Lobby: http://localhost:3000/
```

Deployment docs: https://render.com/docs/your-first-deploy and https://render.com/docs/blueprint-spec
