# pool-game2 — After Hours: The Pool Club

A responsive browser pool game built with Svelte 5, TypeScript, Vite, Canvas 2D, and Web Audio. No backend or account required.

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
- Keyboard: left/right to aim, Shift for fine aiming, up/down for power, Space to shoot, Escape to pause. Focus the table first.
- Ball in hand: point and click to place, or use arrows and Space.
- Solo practice: clear all 15 balls in the fewest shots. Personal best is saved on this browser.
- Vs computer: choose **Play the computer** or **New game → Vs computer**. You break; the computer handles its own aiming, power, and ball-in-hand placement. It follows the same eight-ball rules as local two-player. Human shot controls are disabled during its turn. Pause and help also pause its thinking time.
- Choose **Easy**, **Medium**, or **Hard** in the New game dialog before starting a computer match. Medium is the initial default. Easy considers 6 shots and has greater aim/power variation; Medium considers 12 with smaller errors; Hard considers 24 with precise execution. Your chosen level is remembered in this browser. Use **Change** beside the active difficulty to start a new match at another level; canceling keeps the current match unchanged.
- Local two-player: simplified eight-ball, alternating on the same device. Groups are assigned by the first legal pot after the break. Pocket your group, then the eight on a subsequent shot. A legal pot keeps your turn. Scratches, incorrect first contact, and no cushion/pot after contact give the opponent ball in hand. An early eight or eight with a foul loses; an eight on the break is re-spotted. Pockets are not called.

## Checks

```sh
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm run preview` serves the production build. Deploy `dist/` to any static host.

The production app is hosted on Vercel as `sodaportals-projects/pool-game2`. `vercel.json` configures the Vite build. After logging in and linking this project with the Vercel CLI, run `npx vercel deploy --prod` to publish updates. Automatic deployments from GitHub require connecting the repository in the Vercel project's Git settings.

Physics runs at a fixed 240 Hz independently of rendering, with equal-mass collision impulses, cushion restitution, rolling resistance, pocket detection, and collision-safe placement. Rendering scales to the display pixel ratio. Audio is synthesized after user interaction. The game pauses when its tab is hidden. Google Fonts are optional; local fallbacks work without network access.

The computer ranks clear potting paths, contact shots, and one-cushion escapes, then evaluates up to 24 candidates using cloned instances of the same physics and rules. It tries to pot its group and avoids scratches and early eights. All computation happens locally; no service or API key is needed.

This is a local game without online matchmaking. Physics approximates a flat table and does not simulate jump shots or cue spin.
