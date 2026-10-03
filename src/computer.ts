import { Physics, R, bounds, pockets, type Ball } from './physics';
import { evaluate, inGroup, type Group } from './rules';

type Point = { x: number; y: number };
export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES = {
  easy: { label: 'Easy', description: 'A relaxed rival. Simpler choices and forgiving mistakes.', candidates: 6, aimError: .045, powerError: .18 },
  medium: { label: 'Medium', description: 'A balanced challenge. Thoughtful shots with room to miss.', candidates: 12, aimError: .014, powerError: .07 },
  hard: { label: 'Hard', description: 'Bring your best. Precise aim and deeper shot selection.', candidates: 24, aimError: 0, powerError: 0 }
} as const;
export const difficultyLevels: Difficulty[] = ['easy', 'medium', 'hard'];
export function isDifficulty(value: unknown): value is Difficulty {
  return value === 'easy' || value === 'medium' || value === 'hard';
}
export interface ComputerShot {
  angle: number;
  power: number;
  position: Point;
  target: number;
}
interface Candidate extends ComputerShot { quality: number }

function canPlace(point: Point, balls: Ball[]) {
  return point.x >= bounds.left + R && point.x <= bounds.right - R &&
    point.y >= bounds.top + R && point.y <= bounds.bottom - R &&
    !pockets.some(p => Math.hypot(p.x - point.x, p.y - point.y) < 27) &&
    !balls.some(b => b.id !== 0 && !b.sunk && Math.hypot(b.x - point.x, b.y - point.y) < R * 2 + 2);
}

function clearPath(from: Point, to: Point, balls: Ball[], ignore: number) {
  const dx = to.x - from.x, dy = to.y - from.y, length2 = dx * dx + dy * dy;
  if (length2 < 1) return false;
  return !balls.some(b => {
    if (!b.id || b.id === ignore || b.sunk) return false;
    const t = Math.max(0, Math.min(1, ((b.x - from.x) * dx + (b.y - from.y) * dy) / length2));
    return Math.hypot(b.x - from.x - dx * t, b.y - from.y - dy * t) < R * 2 + .5;
  });
}

/** Plan against cloned physics, so considering a shot never changes the live table. */
export function chooseComputerShot(balls: Ball[], group: Group | null, ballInHand = false, difficulty: Difficulty = 'hard', random: () => number = Math.random): ComputerShot {
  const settings = DIFFICULTIES[difficulty];
  const cue = balls[0];
  const remaining = balls.filter(b => !b.sunk && (group ? inGroup(b.id, group) : b.id > 0 && b.id !== 8));
  const targets = remaining.length ? remaining : balls.filter(b => b.id === 8 && !b.sunk);
  const positions: Point[] = [];
  if (!ballInHand || canPlace(cue, balls)) positions.push({ x: cue.x, y: cue.y });
  if (ballInHand) {
    // Prefer a straight pot, placing the cue behind the intended contact point.
    for (const target of targets) for (const pocket of pockets) {
      const distance = Math.hypot(target.x - pocket.x, target.y - pocket.y);
      for (const setback of [100, 180]) {
        const position = { x: target.x + (target.x - pocket.x) / distance * setback, y: target.y + (target.y - pocket.y) / distance * setback };
        if (canPlace(position, balls)) positions.push(position);
      }
    }
    // A crowded table still needs a legal placement if straight pots are blocked.
    if (!positions.length) for (let x = 110; x < 1000; x += 55) for (let y = 110; y < 530; y += 55) {
      const position = { x, y };
      if (canPlace(position, balls)) positions.push(position);
    }
  }

  const candidates: Candidate[] = [];
  for (const position of positions) for (const target of targets) {
    const directAngle = Math.atan2(target.y - position.y, target.x - position.x);
    const distance = Math.hypot(target.x - position.x, target.y - position.y);
    const directClear = clearPath(position, target, balls, target.id);
    // Contact-first fallback, including small cuts when a pot is unavailable.
    for (const offset of [0, -.025, .025]) candidates.push({ position, target: target.id, angle: directAngle + offset, power: Math.min(85, Math.max(42, Math.sqrt(190 * distance + 420 ** 2) / 12)), quality: (directClear ? 0 : -2000) - distance / 100 - Math.abs(offset) });

    for (const pocket of pockets) {
      const objectDistance = Math.hypot(pocket.x - target.x, pocket.y - target.y);
      const nx = (pocket.x - target.x) / objectDistance, ny = (pocket.y - target.y) / objectDistance;
      const ghost = { x: target.x - nx * R * 2, y: target.y - ny * R * 2 };
      if (ghost.x < bounds.left + R || ghost.x > bounds.right - R || ghost.y < bounds.top + R || ghost.y > bounds.bottom - R) continue;
      const cueDistance = Math.hypot(ghost.x - position.x, ghost.y - position.y);
      const alignment = ((ghost.x - position.x) * nx + (ghost.y - position.y) * ny) / cueDistance;
      if (alignment < .3 || !clearPath(position, ghost, balls, target.id) || !clearPath(target, pocket, balls, target.id)) continue;
      const speed = Math.sqrt(190 * cueDistance + (190 * objectDistance + 150 ** 2) / (alignment * alignment));
      const quality = 100 + alignment * 100 - (cueDistance + objectDistance) / 25;
      for (const multiplier of [1, 1.12]) candidates.push({ position, target: target.id, angle: Math.atan2(ghost.y - position.y, ghost.x - position.x), power: Math.min(100, Math.max(18, speed * multiplier / 12)), quality });
    }

    // One-cushion kick candidates provide an escape when direct contact is blocked.
    if (!directClear) for (const mirror of [
      { x: 2 * (bounds.left + R) - target.x, y: target.y },
      { x: 2 * (bounds.right - R) - target.x, y: target.y },
      { x: target.x, y: 2 * (bounds.top + R) - target.y },
      { x: target.x, y: 2 * (bounds.bottom - R) - target.y }
    ]) candidates.push({ position, target: target.id, angle: Math.atan2(mirror.y - position.y, mirror.x - position.x), power: 75, quality: -500 - Math.hypot(mirror.x - position.x, mirror.y - position.y) / 100 });
  }

  candidates.sort((a, b) => b.quality - a.quality);
  const shortlist = candidates.slice(0, settings.candidates);
  let best = shortlist[0];
  let bestScore = -Infinity;
  const simulation = new Physics();
  for (const candidate of shortlist) {
    simulation.balls = balls.map(b => ({ ...b, vx: 0, vy: 0 }));
    Object.assign(simulation.balls[0], candidate.position, { sunk: false });
    simulation.shoot(candidate.angle, candidate.power * 12);
    for (let step = 0; step < 240 * 14 && simulation.moving; step++) simulation.step(1 / 240);
    const ruling = evaluate(simulation.shot, simulation.balls, group, false);
    const pots = simulation.shot.sunk.filter(id => id > 0 && id !== 8 && (!group || inGroup(id, group))).length;
    const score = (ruling.winner === 'shooter' ? 100000 : ruling.winner === 'opponent' ? -100000 : 0) +
      (ruling.foul ? -5000 : 0) + pots * 1500 + (ruling.keepTurn ? 300 : 0) + candidate.quality / 10;
    if (score > bestScore) { bestScore = score; best = candidate; }
  }
  // Defensive fallback for an already-finished or otherwise empty table.
  const plan = best ?? { angle: 0, power: 40, position: positions[0] ?? { x: cue.x, y: cue.y }, target: 0 };
  // Execution errors happen after planning: easier opponents really can miss.
  // They still choose legal targets and collision-free ball-in-hand placements.
  if (difficulty === 'hard') return plan;
  return {
    ...plan,
    angle: plan.angle + (random() * 2 - 1) * settings.aimError,
    power: Math.max(5, Math.min(100, plan.power * (1 + (random() * 2 - 1) * settings.powerError)))
  };
}
