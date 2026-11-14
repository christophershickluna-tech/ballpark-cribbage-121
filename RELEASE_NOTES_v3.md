# Ballpark Cribbage 121 — World Series Edition (v3)

## Included in this update

- Full baseball ballpark presentation: grandstands, striped field turf, scoreboard, baselines and bases.
- An actual **diamond-shaped cribbage scoring route**: 120 scoring holes per player around all four bases, followed by a World Series championship trophy at point 121.
- Two team-coloured sets of baseball and bat pegs, with a lead marker and previous-score marker.
- Cleveland Indians / Guardians history collection for first player; Detroit Tigers collection for second player.
- **Exactly 52 unique historical player names per team**, one name for each rank/suit pair. Images are stylized archetypal illustrations (eight portrait artworks per team) and can repeat across different named cards; official likenesses are not claimed.
- Illustrated baseball trading cards, custom team-inspired C/D monograms, baseball app icon, mobile swipeable hand, in-game bullpen / inning / box-score language.
- Existing authoritative server, private hands, live two-player rooms, scoring and rematch flow preserved.
- Automatic rules tests including 29-point hand, multiple runs, crib flush, server auth and full random matches.

## What still requires action

The code is deployment-ready, but no public host has been provisioned. Connect Render or another Node.js-compatible deployment service to create the public URL; instructions are in `DEPLOY_ONLINE.md`.

## Testing

Run `npm test` for the scoring and networking regression suite. Desktop and phone-size presentation was also rendered in a browser using game-state snapshots. This validates layout but is not a substitute for testing a deployed game over two remote networks.
