# Tank Maze — קרב טנקים במבוך

Two tanks, a maze that regenerates every round, ricocheting shells and 19 power-ups.
Single player against a bot, two players on one device, or two players anywhere over
an invite link. First to 3/5/7 rounds wins (configurable in the menu).

Also playable as a hosted link — see **Sharing it** below.

## Features

- Bot (3 difficulty levels), local two-player mode, or online play over an invite link
- 19 power-ups, including disguised traps that only reveal themselves on pickup
- Configurable win target (3/5/7 rounds), tank color picker, light/dark theme
- Pause menu (`Esc` or the ⏸ button), power-up legend, lifetime stats (wins,
  shots fired, accuracy) saved locally per browser
- Touch controls with portrait/landscape layouts, keyboard + mouse on desktop
- Procedural WebAudio sound design (explosions, win/lose stingers, an ambient
  loop) — no audio files

## Run it

Just open `index.html` in a browser — no build step, no dependencies.

The files are plain `<script>` tags rather than ES modules specifically so that
`file://` works. If you'd rather serve it (and you'll want to for mobile testing
over your LAN):

```
python3 -m http.server 8000
# then http://localhost:8000
```

## Structure

```
index.html        markup + script tags (load order matters)
css/style.css     all styling, including the portrait/landscape control layouts
js/config.js      constants, difficulty table, POWERS catalogue, shared state
js/maze.js        maze generation, wall collision, BFS pathfinding
js/audio.js       the whole sound engine (one WebAudio oscillator per blip)
js/input.js       keyboard, mouse, canvas twin-stick, on-screen pads, layout()
js/entities.js    tanks, bullets, mines, power-ups, rockets — all the game rules
js/ai.js          the bot: ricochet shot solving, dodging, navigation
js/render.js      every draw call, including the laser-sight preview
js/game.js        main loop, HUD, menu wiring, boot
```

The files are classic scripts, so top-level `let`/`const` in one file is visible
to all the others — there are no imports or exports to keep in sync. The tradeoff
is that **load order in `index.html` matters**: `config.js` must come first and
`game.js` last, since `game.js` boots the game on its final line.

## Where to change things

**Power-ups** — `POWERS` in `js/config.js`. Each entry is
`{icon, label, col, dur, w}` where `w` is the spawn weight (relative, so a `w:7`
box is seven times likelier than a `w:1` one). Adding `fake:'speed'` makes it a
trap: it renders in the maze as the power-up it names and only reveals itself on
pickup. The effect itself lives in `grant()` in `js/entities.js`, and timed
effects are read wherever they matter — `t.buffs.sludge` in `moveTank`,
`t.buffs.jam` in `fire`, and so on.

**Difficulty** — `DIFF` in `js/config.js`: reaction time, aim jitter, speed,
how many ricochets the bot will solve for, dodge skill, fire gap.

**Maze size** — `COLS` / `ROWS` / `TILE` in `js/config.js`. Keep `COLS` and
`ROWS` odd; the generator carves cells on odd coordinates. The `0.30` in
`genMaze()` is how much of the maze gets knocked out afterwards — raise it for
open arenas, lower it for a tighter labyrinth.

**Bullets** — `BLIFE`, `BBOUNCE`, `BSPEED` and the laser constants in
`js/config.js`.

## Controls

Single player: `WASD` to drive, mouse to aim, click or `Space` to fire, `E` for a
mine. On touch, one half of the board drives and the other aims; in landscape you
get proper on-screen pads instead.

Two players: blue is `WASD` + `Space` + `E`, orange is the arrow keys + `Enter` +
`/`. In this mode the turret follows the direction of travel — you aim by
driving. On touch each player gets their own pad.

## Playing online

Pick **אונליין** in the menu, then **צור קישור הזמנה** (create invite link) and send
the generated link to whoever you want to play against. When they open it, they
connect straight to your game and the match starts automatically. You (the host)
control the blue tank with the same controls as solo mode (`WASD` + mouse, or
touch sticks); your opponent controls orange the same way on their own screen.

Under the hood this is peer-to-peer WebRTC (via [PeerJS](https://peerjs.com)) — your
browser and theirs talk directly, there's no game server. Your machine runs the
actual simulation and streams it to them; theirs just sends back stick/mouse input.
That means:

- **It needs to be served over `http(s)://`, not opened as a bare `file://` page** —
  WebRTC signaling and clipboard-copy both need a real origin. `node serve.js` (or
  any static file server) is enough locally; a GitHub Pages / Netlify / similar
  deploy works for sharing with someone remote.
- It only needs an internet connection at connect time, after that it's direct.
  Very restrictive corporate NATs can occasionally block the peer-to-peer
  handshake entirely (no TURN relay is configured) — if a link won't connect,
  try a different network.
- If the host loses the tab/connection, the match ends for both sides; either
  side can create/join a fresh link to start over.

## Sharing it

`index.html` + `css/` + `js/` is the source you edit. `artifact_content.html`
is a single-file bundle of the same game (styles and scripts inlined) meant
for publishing as a Claude Artifact, so it can be opened as a plain link
instead of a folder of files. Rebuild it after any source change with:

```
node build-artifact.js
```

then republish `artifact_content.html` to push the update live. Artifacts are
private until shared from the page's share menu.

Note: the Artifact bundle can't do WebRTC — published Artifacts block loading scripts
from a CDN (Claude Artifacts only allow Google Fonts as an external host), so PeerJS
never loads there and the **אונליין** mode shows a "network library failed to load"
message instead of connecting. Bot mode and local two-player both work fine in the
Artifact; online play only works from the real `index.html`/`js` source served over
`http(s)`.

Note: don't add the Artifact `db` capability to this page for something like
a shared leaderboard — declaring `db` makes the artifact organization-internal
only (every reader/writer must be signed in to the owner's org), which breaks
sharing it as a casual public link. Lifetime stats are kept in each player's
own browser (`localStorage`) instead, precisely to avoid that tradeoff.
