# pool-game2 — After Hours: The Pool Club

A responsive browser pool game built with Svelte 5, TypeScript, Vite, Canvas 2D, and Web Audio. Play solo, against the computer, on one device, or online with a friend. No player accounts required.

**Play live:** https://pool-game2.vercel.app

## Run

Requires Node.js 22.12+ (or Node.js 24).

```sh
npm install
npm run dev
```

On Windows PowerShell with restricted execution policies, use `npm.cmd` instead of `npm`.

## Play

- Point at the table to aim, drag back to set power, and release to shoot. A click alone only aims.
- Alternatively, use the power slider and **Take shot**.
- Cue spin: drag the red dot on the cue-ball target, or use the two spin sliders. Top applies follow after contact, bottom applies draw, and left/right changes cushion rebound angles. Diagonal positions combine these effects, with total spin limited to the target circle. The focused spin target supports arrow keys (Shift for fine adjustment); Home or Space centers it. **Reset spin** also centers it.
- Spin locks while a shot is in progress and resets after it settles or when starting a new game. The aim guide previews first contact, not the later spin-influenced path. The computer uses center-ball shots.
- Keyboard: left/right to aim, Shift for fine aiming, up/down for power, Space to shoot, Escape to pause. Focus the table first.
- Ball in hand: point and click to place, or use arrows and Space.
- Solo practice: clear all 15 balls in the fewest shots. Personal best is saved on this browser.
- Vs computer: choose **Play the computer** or **New game → Vs computer**. You break; the computer handles its own aiming, power, and ball-in-hand placement. It follows the same eight-ball rules as local two-player. Human shot controls are disabled during its turn. Pause and help also pause its thinking time.
- Choose **Easy**, **Medium**, or **Hard** in the New game dialog before starting a computer match. Medium is the initial default. Easy considers 6 shots and has greater aim/power variation; Medium considers 12 with smaller errors; Hard considers 24 with precise execution. Your chosen level is remembered in this browser. Use **Change** beside the active difficulty to start a new match at another level; canceling keeps the current match unchanged.
- Local two-player: simplified eight-ball, alternating on the same device. Groups are assigned by the first legal pot after the break. Pocket your group, then the eight on a subsequent shot. A legal pot keeps your turn. Scratches, incorrect first contact, and no cushion/pot after contact give the opponent ball in hand. An early eight or eight with a foul loses; an eight on the break is re-spotted. Pockets are not called.

## Online play

Choose **Play online → Create room**, then **Copy invite** and send the link to a friend. They can open it on any modern browser or enter the eight-character room code. The host breaks. Shots, cue spin, fouls, groups, and turns are synchronized. After a match, both players can request a rematch.

During ball in hand, the waiting player sees the opponent's cue-ball position update as they move it, with a dashed placement ring. Clicking or pressing Space confirms the location and changes the ring to solid. The preview clears when the shot begins; it does not change the table's official state until the shot is submitted.

Refreshing restores your seat in the same browser; a temporary connection loss reconnects automatically. Keep the same browser profile and its site storage to retain your seat. **Leave room** closes the table for both players. Rooms expire after 24 hours without a game action. These are private two-player rooms; there is no public matchmaking or spectator mode.

The server validates and simulates each shot, then clients animate it and settle onto the authoritative result. Turn-based polling works with Vercel Functions without a separate WebSocket server. Online games continue when a tab is hidden and catch up when you return.

### Development and hosting

`npm run dev` provides an in-memory room service for local testing. Restarting the development server clears those rooms. Production uses the `/api/room` Vercel Function and Upstash Redis, with atomic room updates and expiring records. Configure these server-only environment variables through Vercel's Upstash integration:

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are also supported. Never prefix these variables with `VITE_` or commit their values. Seat credentials stay in each browser's local storage and are stored only as hashes on the server; invite links contain only the room code.

The deployed database uses Upstash's Free plan with automatic paid upgrades disabled. Online availability is subject to the hosting and database quotas. Static-only hosting supports the local modes but requires a compatible room backend for online play.

## Checks

```sh
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm run preview` serves the static production build; use `npm run dev` or Vercel to exercise the room API.

The production app is hosted on Vercel as `sodaportals-projects/pool-game2`, connected to the GitHub repository `SodaPortal/pool-game2`. Pushes to `main` automatically deploy to https://pool-game2.vercel.app; other branches receive preview deployments. `vercel.json` configures the Vite build. For a manual deployment after logging in and linking this project with the Vercel CLI, run `npx vercel deploy --prod`.

Physics runs at a fixed 240 Hz independently of rendering, with equal-mass collision impulses, cushion restitution, rolling resistance, pocket detection, and collision-safe placement. Cue spin uses a simplified decaying rotational reserve: draw/follow develops progressively through cloth traction after ball contact, and side spin exchanges tangential speed with cushions. Rendering scales to the display pixel ratio. Audio is synthesized after user interaction. The game pauses when its tab is hidden. Google Fonts are optional; local fallbacks work without network access.

The computer ranks clear potting paths, contact shots, and one-cushion escapes, then evaluates up to 24 candidates using cloned instances of the same physics and rules. It tries to pot its group and avoids scratches and early eights. All computation happens locally; no service or API key is needed.

Physics approximates a flat table; jump shots, masse, swerve, and spin-induced object-ball throw are not simulated.
