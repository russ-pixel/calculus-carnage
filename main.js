// Calculus Carnage — prototype
// Physics sandbox with math-gated unlocks. Single file, no build step.

const { Engine, Render, Runner, World, Bodies, Body, Composite, Composites, Constraint, Mouse, MouseConstraint, Events } = Matter;

// ---------- State ----------

const state = {
  solved: 0,
  skips: 0,
  correctStreak: 0,
  levelCorrect: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
  unlocked: new Set(['spawn-box', 'spawn-dummy', 'spawn-diver', 'spawn-astro', 'spawn-bug']), // default tools
  pendingUnlock: null,                  // tool id awaiting math gate
  currentProblem: null,
  hintTier: 0,
  tool: 'spawn-box',
  world: 'surface',
};

// Tool catalog. Each tool either spawns something or modifies behavior.
// `level` is the math difficulty required to unlock. `world` controls which
// world's toolbar it appears in ('surface' | 'abyss' | 'both').
const TOOLS = [
  { id: 'spawn-box',     label: 'Crate',         level: 0, kind: 'spawn',  spawn: 'crate',   world: 'both' },
  { id: 'spawn-dummy',   label: 'Dummy',         level: 0, kind: 'spawn',  spawn: 'dummy',   world: 'surface' },
  { id: 'spawn-ball',    label: 'Cannonball',    level: 1, kind: 'spawn',  spawn: 'ball',    world: 'both' },
  { id: 'spawn-bomb',    label: 'Bomb',          level: 2, kind: 'spawn',  spawn: 'bomb',    world: 'surface' },
  { id: 'spawn-duck',    label: 'Mutant Duck',   level: 3, kind: 'spawn',  spawn: 'duck',    world: 'both' },
  { id: 'spawn-parasite',label: 'Parasite',      level: 3, kind: 'spawn',  spawn: 'parasite', world: 'surface' },
  { id: 'spawn-shark',   label: 'Laser Shark',   level: 3, kind: 'spawn',  spawn: 'shark',   world: 'both' },
  { id: 'grav-flip',     label: 'Flip Gravity',  level: 2, kind: 'action', action: 'flip-gravity', world: 'both' },
  { id: 'spawn-cluster', label: 'Crate Stack',   level: 3, kind: 'spawn',  spawn: 'cluster', world: 'surface' },
  { id: 'fatality',      label: 'Fatality Slam', level: 3, kind: 'action', action: 'fatality', world: 'both' },
  { id: 'black-hole',    label: 'Black Hole',    level: 3, kind: 'action', action: 'black-hole', world: 'surface' },
  { id: 'machine-gun',   label: 'Machine Gun',   level: 3, kind: 'action', action: 'machine-gun', world: 'surface' },
  { id: 'tornado',       label: 'Tornado',       level: 3, kind: 'action', action: 'tornado', world: 'surface' },
  { id: 'freeze',        label: 'Freeze',        level: 2, kind: 'action', action: 'freeze',  world: 'both' },
  // --- The Abyss ---
  { id: 'spawn-diver',   label: 'Diver',         level: 0, kind: 'spawn',  spawn: 'diver',   world: 'abyss' },
  { id: 'spawn-jelly',   label: 'Jellyfish',     level: 2, kind: 'spawn',  spawn: 'jelly',   world: 'abyss' },
  { id: 'spawn-charge',  label: 'Depth Charge',  level: 2, kind: 'spawn',  spawn: 'charge',  world: 'abyss' },
  { id: 'spawn-piranha', label: 'Piranha Swarm', level: 3, kind: 'spawn',  spawn: 'piranhas', world: 'abyss' },
  { id: 'spawn-angler',  label: 'Anglerfish',    level: 3, kind: 'spawn',  spawn: 'angler',  world: 'abyss' },
  { id: 'spawn-eel',     label: 'Electric Eel',  level: 4, kind: 'spawn',  spawn: 'eel',     world: 'abyss' },
  { id: 'harpoon',       label: 'Harpoon Volley', level: 4, kind: 'action', action: 'harpoon', world: 'abyss' },
  { id: 'whirlpool',     label: 'Whirlpool',     level: 4, kind: 'action', action: 'whirlpool', world: 'abyss' },
  { id: 'kraken',        label: 'Kraken',        level: 4, kind: 'action', action: 'kraken', world: 'abyss' },
  // --- Mars ---
  { id: 'spawn-astro',   label: 'Astronaut',     level: 0, kind: 'spawn',  spawn: 'astro',   world: 'mars' },
  { id: 'spawn-tank',    label: 'Oxygen Tank',   level: 2, kind: 'spawn',  spawn: 'tank',    world: 'mars' },
  { id: 'spawn-alien',   label: 'Grey Alien',    level: 3, kind: 'spawn',  spawn: 'alien',   world: 'mars' },
  { id: 'meteor-shower', label: 'Meteor Shower', level: 3, kind: 'action', action: 'meteors', world: 'mars' },
  { id: 'dust-storm',    label: 'Dust Storm',    level: 4, kind: 'action', action: 'storm',  world: 'mars' },
  { id: 'ufo',           label: 'UFO Abduction', level: 5, kind: 'action', action: 'ufo',    world: 'mars' },
  // --- The Yard ---
  { id: 'spawn-bug',     label: 'Ladybug',        level: 0, kind: 'spawn',  spawn: 'bug',       world: 'yard' },
  { id: 'spawn-poop',    label: 'Dog Poop',       level: 2, kind: 'spawn',  spawn: 'poop',      world: 'yard' },
  { id: 'spawn-ants',    label: 'Ant Column',     level: 3, kind: 'spawn',  spawn: 'ants',      world: 'yard' },
  { id: 'spawn-spider',  label: 'Garden Spider',  level: 3, kind: 'spawn',  spawn: 'spider',    world: 'yard' },
  { id: 'sprinkler',     label: 'Sprinkler',      level: 3, kind: 'action', action: 'sprinkler', world: 'yard' },
  { id: 'spawn-spore',   label: 'Cordyceps Spore', level: 4, kind: 'spawn', spawn: 'spore',     world: 'yard' },
  { id: 'magnify',       label: 'Magnifying Glass', level: 4, kind: 'action', action: 'magnify', world: 'yard' },
  { id: 'spawn-lizard',  label: 'Fire Lizard',    level: 5, kind: 'spawn',  spawn: 'lizard',    world: 'yard' },
  { id: 'mower',         label: 'Lawnmower',      level: 6, kind: 'action', action: 'mower',    world: 'yard' },
];

// Worlds. Each world filters the toolbar and restyles the stage. Locked
// worlds are math-gated — their tab behaves like a locked tool until solved.
const ABYSS_GATE = { id: 'world-abyss', label: 'The Abyss', level: 4, onUnlock: () => switchWorld('abyss') };
const MARS_GATE  = { id: 'world-mars',  label: 'Mars',      level: 5, onUnlock: () => switchWorld('mars') };
const YARD_GATE  = { id: 'world-yard',  label: 'The Yard',  level: 6, onUnlock: () => switchWorld('yard') };
const WORLDS = [
  { id: 'surface', label: 'Surface',   bg: '#0a0c10', wall: '#1a1f26', gravity: 1 },
  { id: 'abyss',   label: 'The Abyss', bg: '#03111d', wall: '#0c2231', gravity: 1, gate: ABYSS_GATE },
  { id: 'mars',    label: 'Mars',      bg: '#1c0d07', wall: '#4a2418', gravity: 0.38, gate: MARS_GATE },
  { id: 'yard',    label: 'The Yard',  bg: '#0c1506', wall: '#28380f', gravity: 1, gate: YARD_GATE },
];

// ---------- Problem generator ----------

function randInt(lo, hi) { return Math.floor(Math.random() * (hi - lo + 1)) + lo; }

// Generate a problem of a given level. Returns { text, answer, level, method }.
function makeProblem(level) {
  if (level <= 1) {
    // x ± a = b
    const x = randInt(2, 25);
    const a = randInt(2, 20);
    const op = Math.random() < 0.5 ? '+' : '−';
    const rhs = op === '+' ? x + a : x - a;
    return {
      text: `x ${op} ${a} = ${rhs}`,
      answer: x,
      level: 1,
      method: op === '+'
        ? `Subtract ${a} from both sides: x = ${rhs} − ${a} = ${x}.`
        : `Add ${a} to both sides: x = ${rhs} + ${a} = ${x}.`,
    };
  }
  if (level === 2) {
    // ax = b  or  x/a = b
    const x = randInt(2, 12);
    const a = randInt(2, 9);
    if (Math.random() < 0.5) {
      return {
        text: `${a}x = ${a * x}`,
        answer: x,
        level: 2,
        method: `Divide both sides by ${a}: x = ${a * x} ÷ ${a} = ${x}.`,
      };
    } else {
      return {
        text: `x ÷ ${a} = ${x}`,
        answer: a * x,
        level: 2,
        method: `Multiply both sides by ${a}: x = ${x} × ${a} = ${a * x}.`,
      };
    }
  }
  if (level === 3) {
    // Level 3: ax + b = c   (always solves to a whole number)
    const x = randInt(2, 10);
    const a = randInt(2, 6);
    const b = randInt(2, 15);
    const c = a * x + b;
    return {
      text: `${a}x + ${b} = ${c}`,
      answer: x,
      level: 3,
      method:
        `Step 1 — subtract ${b}: ${a}x = ${c - b}. ` +
        `Step 2 — divide by ${a}: x = ${(c - b) / a}.`,
    };
  }
  if (level === 4) {
    // Level 4: ax + b = cx + d — variable on both sides (whole-number solution)
    const x = randInt(2, 12);
    const a = randInt(3, 9);
    const c = randInt(1, a - 1);
    const b = randInt(2, 15);
    const d = (a - c) * x + b;
    const k = a - c;
    const kx = k === 1 ? 'x' : `${k}x`;
    const lastStep = k === 1 ? '' : ` Step 3 — divide by ${k}: x = ${x}.`;
    return {
      text: `${a}x + ${b} = ${c}x + ${d}`,
      answer: x,
      level: 4,
      method:
        `Step 1 — subtract ${c}x from both sides: ${kx} + ${b} = ${d}. ` +
        `Step 2 — subtract ${b}: ${kx} = ${d - b}.` + lastStep,
    };
  }
  if (level === 5) {
    // Level 5: a(x + b) = c — distributive property (whole-number solution)
    const x = randInt(2, 10);
    const a = randInt(2, 6);
    const b = randInt(1, 9);
    const c = a * (x + b);
    return {
      text: `${a}(x + ${b}) = ${c}`,
      answer: x,
      level: 5,
      method:
        `Step 1 — divide both sides by ${a}: x + ${b} = ${c / a}. ` +
        `Step 2 — subtract ${b}: x = ${x}. ` +
        `(Or distribute first: ${a}x + ${a * b} = ${c}, then solve as a two-step.)`,
    };
  }
  // Level 6: a(x + b) = cx + d — distribute, then variables on both sides
  const x = randInt(2, 9);
  const a = randInt(2, 5);
  const c = randInt(1, a - 1);
  const b = randInt(1, 8);
  const d = (a - c) * x + a * b;
  const k = a - c;
  const kx = k === 1 ? 'x' : `${k}x`;
  const cx = c === 1 ? 'x' : `${c}x`;
  const lastStep = k === 1 ? '' : ` Step 4 — divide by ${k}: x = ${x}.`;
  return {
    text: `${a}(x + ${b}) = ${cx} + ${d}`,
    answer: x,
    level: 6,
    method:
      `Step 1 — distribute: ${a}x + ${a * b} = ${cx} + ${d}. ` +
      `Step 2 — subtract ${cx} from both sides: ${kx} + ${a * b} = ${d}. ` +
      `Step 3 — subtract ${a * b}: ${kx} = ${d - a * b}.` + lastStep,
  };
}

// ---------- Physics setup ----------

const canvas = document.getElementById('canvas');
const stage = document.getElementById('stage');
const engine = Engine.create();
engine.gravity.y = 1;

let W = stage.clientWidth, H = stage.clientHeight;
const render = Render.create({
  canvas,
  engine,
  options: {
    width: W, height: H,
    wireframes: false,
    background: '#0a0c10',
  },
});
Render.run(render);
Runner.run(Runner.create(), engine);

function rebuildWalls() {
  W = stage.clientWidth; H = stage.clientHeight;
  render.canvas.width = W; render.canvas.height = H;
  render.options.width = W; render.options.height = H;
  Render.setPixelRatio(render, window.devicePixelRatio);

  // Remove existing static "walls"
  const old = Composite.allBodies(engine.world).filter(b => b.isStatic && b.label === 'wall');
  Composite.remove(engine.world, old);

  // Thick walls so high-speed bodies (duck lunges, bullets, etc.) don't tunnel through.
  const t = 240;
  const worldDef = WORLDS.find(w => w.id === state.world) || WORLDS[0];
  const opts = { isStatic: true, label: 'wall', render: { fillStyle: worldDef.wall } };
  World.add(engine.world, [
    Bodies.rectangle(W / 2, H + t / 2 - 1, W * 3, t, opts),   // floor
    Bodies.rectangle(-t / 2 + 1, H / 2, t, H * 3, opts),       // left
    Bodies.rectangle(W + t / 2 - 1, H / 2, t, H * 3, opts),    // right
    Bodies.rectangle(W / 2, -t / 2 + 1, W * 3, t, opts),       // ceiling
  ]);
}
rebuildWalls();
window.addEventListener('resize', rebuildWalls);

// The stage can resize without a window resize — e.g. on phones the tool
// drawer grows when the toolbar populates, shrinking the stage after boot.
// Watch the stage element itself so the floor always sits at its bottom.
if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(() => {
    if (stage.clientWidth !== W || stage.clientHeight !== H) rebuildWalls();
  }).observe(stage);
}

// Mouse drag
const mouse = Mouse.create(render.canvas);
const mouseConstraint = MouseConstraint.create(engine, {
  mouse,
  constraint: { stiffness: 0.18, render: { visible: false } },
});
World.add(engine.world, mouseConstraint);
render.mouse = mouse;

// ---------- Spawners ----------

function spawnCrate(x, y) {
  return Bodies.rectangle(x, y, 50, 50, {
    render: { fillStyle: '#8a6a3d', strokeStyle: '#3a2c1a', lineWidth: 2 },
    friction: 0.4, restitution: 0.1,
  });
}

function spawnBall(x, y) {
  return Bodies.circle(x, y, 22, {
    density: 0.02,
    render: { fillStyle: '#3a3f48', strokeStyle: '#1a1d22', lineWidth: 2 },
    restitution: 0.4,
  });
}

let nextDummyId = 1;
const dummies = new Map(); // id -> { parts, constraints, damage, dead }

function spawnDummy(x, y) {
  const id = nextDummyId++;
  const group = Body.nextGroup(true);
  const tag = (b, part) => { b.label = 'flesh'; b.dummyId = id; b.bodyPart = part; return b; };

  const head = tag(Bodies.circle(x, y - 60, 14, { collisionFilter: { group }, render: { fillStyle: '#d6c2a8' } }), 'head');
  const torso = tag(Bodies.rectangle(x, y - 20, 26, 60, { collisionFilter: { group }, render: { fillStyle: '#5a6470' } }), 'back');
  const armL = tag(Bodies.rectangle(x - 22, y - 20, 14, 50, { collisionFilter: { group }, render: { fillStyle: '#5a6470' } }), 'armL');
  const armR = tag(Bodies.rectangle(x + 22, y - 20, 14, 50, { collisionFilter: { group }, render: { fillStyle: '#5a6470' } }), 'armR');
  const legL = tag(Bodies.rectangle(x - 8, y + 30, 14, 50, { collisionFilter: { group }, render: { fillStyle: '#36404a' } }), 'legL');
  const legR = tag(Bodies.rectangle(x + 8, y + 30, 14, 50, { collisionFilter: { group }, render: { fillStyle: '#36404a' } }), 'legR');

  const parts = [head, torso, armL, armR, legL, legR];
  const joinOpts = { stiffness: 0.9, damping: 0.3, length: 0, render: { visible: false } };

  const joints = {
    // Two-point neck so the head can't rotate or flop off when the torso is forced upright.
    neck:      Constraint.create({ bodyA: head, bodyB: torso, pointA: { x: -6, y: 12 }, pointB: { x: -6, y: -28 }, ...joinOpts }),
    neck2:     Constraint.create({ bodyA: head, bodyB: torso, pointA: { x: 6,  y: 12 }, pointB: { x: 6,  y: -28 }, ...joinOpts }),
    shoulderL: Constraint.create({ bodyA: torso, bodyB: armL, pointA: { x: -10, y: -22 }, pointB: { x: 0, y: -20 }, ...joinOpts }),
    shoulderR: Constraint.create({ bodyA: torso, bodyB: armR, pointA: { x: 10, y: -22 }, pointB: { x: 0, y: -20 }, ...joinOpts }),
    hipL:      Constraint.create({ bodyA: torso, bodyB: legL, pointA: { x: -7, y: 28 }, pointB: { x: 0, y: -20 }, ...joinOpts }),
    hipR:      Constraint.create({ bodyA: torso, bodyB: legR, pointA: { x: 7, y: 28 }, pointB: { x: 0, y: -20 }, ...joinOpts }),
  };
  const constraints = Object.values(joints);

  dummies.set(id, {
    kind: 'human',
    parts, constraints, joints,
    limbs: { head, torso, armL, armR, legL, legR },
    damage: 0,                                  // total damage (drives final dismemberment)
    partDamage: { back: 0, legL: 0, legR: 0, neck: 0, armL: 0, armR: 0 },
    legsOk: { L: true, R: true },
    backOk: true,
    standing: true,
    dead: false,
  });
  World.add(engine.world, [...parts, ...constraints]);
  return null;
}

// ---------- Mutant Evil Duck ----------
// Ragdoll with body / head / beak / two stubby legs. Same damage + uprighting
// system as the human dummy, plus a seek-and-lunge AI that hunts the nearest
// living human. The beak is its own body — bite hard enough and it pops off.

function spawnDuck(x, y) {
  const id = nextDummyId++;
  const group = Body.nextGroup(true);
  const tag = (b, part) => { b.label = 'flesh'; b.dummyId = id; b.bodyPart = part; return b; };

  const sickly = '#5e7d3a';
  const sicklyDark = '#3f5524';
  const beakColor = '#d97a1c';

  // Body is wider than tall (waddle shape). "back" tag so existing back-break logic applies.
  const body  = tag(Bodies.rectangle(x, y, 50, 30, { collisionFilter: { group }, render: { fillStyle: sickly, strokeStyle: sicklyDark, lineWidth: 2 } }), 'back');
  const head  = tag(Bodies.circle(x + 26, y - 22, 14, { collisionFilter: { group }, render: { fillStyle: sickly, strokeStyle: sicklyDark, lineWidth: 2 } }), 'head');
  const beak  = tag(Bodies.fromVertices(x + 46, y - 20, [[
    { x: 0, y: -4 }, { x: 14, y: 0 }, { x: 0, y: 6 }
  ]], { collisionFilter: { group }, render: { fillStyle: beakColor, strokeStyle: '#7a3f0a', lineWidth: 1.5 } }), 'beak');
  const legL = tag(Bodies.rectangle(x - 10, y + 22, 8, 22, { collisionFilter: { group }, render: { fillStyle: sicklyDark } }), 'legL');
  const legR = tag(Bodies.rectangle(x + 10, y + 22, 8, 22, { collisionFilter: { group }, render: { fillStyle: sicklyDark } }), 'legR');

  const parts = [body, head, beak, legL, legR];
  const joinOpts = { stiffness: 0.95, damping: 0.4, length: 0, render: { visible: false } };

  const joints = {
    neck:  Constraint.create({ bodyA: head, bodyB: body, pointA: { x: -10, y: 10 }, pointB: { x: 18, y: -10 }, ...joinOpts }),
    neck2: Constraint.create({ bodyA: head, bodyB: body, pointA: { x: -10, y: -2 }, pointB: { x: 18, y: -2 }, ...joinOpts }),
    beak:  Constraint.create({ bodyA: beak, bodyB: head, pointA: { x: -2, y: -2 }, pointB: { x: 10, y: -2 }, ...joinOpts }),
    beak2: Constraint.create({ bodyA: beak, bodyB: head, pointA: { x: -2, y: 4 }, pointB: { x: 10, y: 4 }, ...joinOpts }),
    hipL:  Constraint.create({ bodyA: body, bodyB: legL, pointA: { x: -10, y: 12 }, pointB: { x: 0, y: -8 }, ...joinOpts }),
    hipR:  Constraint.create({ bodyA: body, bodyB: legR, pointA: { x: 10, y: 12 }, pointB: { x: 0, y: -8 }, ...joinOpts }),
  };
  const constraints = Object.values(joints);

  dummies.set(id, {
    kind: 'duck',
    parts, constraints, joints,
    // Map duck-anatomy onto the same fields the existing systems use.
    // 'torso' alias points at the body so generic code (AI search, posture) works unchanged.
    limbs: { body, torso: body, head, beak, legL, legR },
    damage: 0,
    partDamage: { back: 0, legL: 0, legR: 0, neck: 0, beak: 0, head: 0 },
    legsOk: { L: true, R: true },
    backOk: true,
    standing: true,
    dead: false,
    // AI state
    lungeReadyAt: 0,
  });
  World.add(engine.world, [...parts, ...constraints]);
  return null;
}

// ---------- Laser Sharks ----------

function spawnShark(x, y) {
  const id = nextDummyId++;
  const body = Bodies.rectangle(x, y, 90, 36, {
    density: 0.006,
    frictionAir: 0.06,
    friction: 0.1,
    render: { visible: false },
  });
  body.label = 'flesh';
  body.dummyId = id;
  body.bodyPart = 'back';

  dummies.set(id, {
    kind: 'shark',
    parts: [body],
    constraints: [],
    joints: {},
    limbs: { torso: body },
    damage: 0,
    partDamage: { back: 0 },
    legsOk: { L: true, R: true },
    backOk: true,
    standing: false,
    dead: false,
    facing: 1,
    hoverY: Math.min(y, H * 0.55),
    laserTarget: null,
    laserNextFire: performance.now() + 1200,
    laserBeamUntil: 0,
    laserDamageAt: 0,
  });

  World.add(engine.world, body);
  return null;
}

// Shark AI: hover, drift toward targets, fire laser
Events.on(engine, 'beforeUpdate', () => {
  const now = performance.now();
  const targets = [...dummies.values()].filter(d =>
    (d.kind === 'human' || d.kind === 'duck' || d.kind === 'monster') && !d.dead
  );

  for (const shark of dummies.values()) {
    if (shark.kind !== 'shark' || shark.dead) continue;
    const body = shark.limbs.torso;

    // Hover: cancel gravity + spring toward hoverY
    const hoverErr = shark.hoverY - body.position.y;
    Body.applyForce(body, body.position, {
      x: 0,
      y: -0.001 * body.mass + hoverErr * 0.00004 * body.mass,
    });

    if (targets.length === 0) continue;

    let nearest = null, bestD = Infinity;
    for (const t of targets) {
      const d = Math.hypot(t.limbs.torso.position.x - body.position.x,
                           t.limbs.torso.position.y - body.position.y);
      if (d < bestD) { bestD = d; nearest = t; }
    }
    if (!nearest) continue;

    const dx = nearest.limbs.torso.position.x - body.position.x;
    if (Math.abs(dx) > 8) shark.facing = Math.sign(dx);

    Body.applyForce(body, body.position, { x: shark.facing * 0.006 * body.mass, y: 0 });

    if (bestD < 450 && now >= shark.laserNextFire) {
      shark.laserTarget = nearest;
      shark.laserBeamUntil = now + 800;
      shark.laserNextFire = now + 2500;
      shark.laserDamageAt = now + 80;
      log('Laser locked.', 'hint');
    }

    if (shark.laserTarget && now < shark.laserBeamUntil && now >= shark.laserDamageAt) {
      const tgt = shark.laserTarget;
      if (!tgt.dead) {
        const dmg = 4;
        tgt.damage += dmg;
        tgt.partDamage.back = (tgt.partDamage.back || 0) + dmg;
        spurt(tgt.limbs.torso.position.x, tgt.limbs.torso.position.y, 5, 0, -1);
        addDecal(tgt.limbs.torso.position.x, tgt.limbs.torso.position.y, 3);
        if (tgt.partDamage.back > 18 && tgt.backOk) breakBack(tgt);
        if (tgt.damage > (tgt.maxDamage || 45)) dismember(tgt);
      } else {
        shark.laserBeamUntil = 0;
      }
      shark.laserDamageAt = now + 120;
    }
  }
});

// Draw sharks + laser beams
Events.on(render, 'afterRender', () => {
  const ctx = render.context;
  const now = performance.now();

  for (const shark of dummies.values()) {
    if (shark.kind !== 'shark' || shark.dead) continue;
    const body = shark.limbs.torso;
    const bx = body.position.x, by = body.position.y;
    const a = body.angle;
    const f = shark.facing;
    const wounded = shark.damage > 20;

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(a);
    ctx.scale(f, 1);

    // Tail fins
    ctx.fillStyle = wounded ? '#1a2030' : '#1a3a5a';
    ctx.beginPath();
    ctx.moveTo(-44, -2);
    ctx.lineTo(-62, -24);
    ctx.lineTo(-50, -4);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-44, 2);
    ctx.lineTo(-62, 24);
    ctx.lineTo(-50, 4);
    ctx.closePath();
    ctx.fill();

    // Main body
    const bodyGrad = ctx.createLinearGradient(0, -18, 0, 18);
    bodyGrad.addColorStop(0, wounded ? '#3a2030' : '#2a5a7a');
    bodyGrad.addColorStop(0.55, wounded ? '#4a304a' : '#3a7a9a');
    bodyGrad.addColorStop(1, '#b8ccd4');
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = wounded ? '#1a0818' : '#0a2a3a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 2, 46, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Dorsal fin
    ctx.fillStyle = wounded ? '#180a18' : '#1a3a5a';
    ctx.strokeStyle = '#0a1828';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-6, -17);
    ctx.lineTo(10, -17);
    ctx.lineTo(4, -40);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Pectoral fin
    ctx.fillStyle = wounded ? '#201020' : '#1f4a6a';
    ctx.beginPath();
    ctx.moveTo(12, 16);
    ctx.lineTo(24, 36);
    ctx.lineTo(-4, 18);
    ctx.closePath();
    ctx.fill();

    // Gill slits
    ctx.strokeStyle = 'rgba(10,40,60,0.55)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) {
      const gx = 16 - i * 7;
      ctx.beginPath();
      ctx.moveTo(gx, -10 + i * 0.5);
      ctx.bezierCurveTo(gx - 1, -2, gx - 2, 4, gx - 3, 10 - i * 0.5);
      ctx.stroke();
    }

    // Mouth + teeth
    ctx.strokeStyle = '#08202e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(36, -3);
    ctx.quadraticCurveTo(47, 2, 36, 8);
    ctx.stroke();
    ctx.fillStyle = '#ddd8c8';
    for (let i = 0; i < 5; i++) {
      const tx = 37 + i * 2;
      ctx.beginPath();
      ctx.moveTo(tx, -2);
      ctx.lineTo(tx + 1.2, 2.5);
      ctx.lineTo(tx + 2.4, -2);
      ctx.closePath();
      ctx.fill();
    }

    // Laser eye — glows brighter when beam is active
    const beamActive = shark.laserTarget && now < shark.laserBeamUntil;
    const eyePulse = beamActive
      ? 1.2 + 0.6 * Math.sin(now / 60)
      : 1 + 0.25 * Math.sin(now / 220);
    const eyeX = 22, eyeY = -8;
    const eyeR = 5 * eyePulse;
    const eyeGrad = ctx.createRadialGradient(eyeX, eyeY, 0, eyeX, eyeY, eyeR * 2.6);
    eyeGrad.addColorStop(0, 'rgba(0,255,100,0.95)');
    eyeGrad.addColorStop(0.4, 'rgba(0,200,70,0.5)');
    eyeGrad.addColorStop(1, 'rgba(0,200,70,0)');
    ctx.fillStyle = eyeGrad;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeR * 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#00ff66';
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeR * 0.65, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#001a08';
    ctx.beginPath();
    ctx.arc(eyeX + 0.8, eyeY, eyeR * 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Laser beam in world space
    if (beamActive && !shark.laserTarget.dead) {
      const cos = Math.cos(a), sin = Math.sin(a);
      const snoutX = bx + f * 46 * cos;
      const snoutY = by + f * 46 * sin;
      const tgt = shark.laserTarget.limbs.torso;
      const tx = tgt.position.x, ty = tgt.position.y;
      const fade = Math.max(0, (shark.laserBeamUntil - now) / 800);
      const flicker = 0.88 + 0.12 * Math.sin(now / 16);
      const alpha = fade * flicker;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.15 * alpha;
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 16;
      ctx.shadowColor = '#00ff44';
      ctx.shadowBlur = 22;
      ctx.beginPath(); ctx.moveTo(snoutX, snoutY); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.globalAlpha = 0.45 * alpha;
      ctx.lineWidth = 5;
      ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(snoutX, snoutY); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.globalAlpha = 0.95 * alpha;
      ctx.strokeStyle = '#ccffee';
      ctx.lineWidth = 1.8;
      ctx.shadowBlur = 4;
      ctx.beginPath(); ctx.moveTo(snoutX, snoutY); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      const bloom = ctx.createRadialGradient(tx, ty, 0, tx, ty, 20 * fade);
      bloom.addColorStop(0, `rgba(180,255,220,${0.85 * alpha})`);
      bloom.addColorStop(1, 'rgba(0,255,100,0)');
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.arc(tx, ty, 20 * fade, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
});

// Safety: any body that escapes the world bounds gets removed so it doesn't
// fall forever and so dummies/duck state doesn't get stranded.
Events.on(engine, 'afterUpdate', () => {
  const margin = 400;
  for (const body of Composite.allBodies(engine.world)) {
    if (body.isStatic) continue;
    const { x, y } = body.position;
    if (x < -margin || x > W + margin || y < -margin || y > H + margin) {
      if (body.label === 'flesh') {
        const d = dummies.get(body.dummyId);
        if (d && !d.dead) {
          d.dead = true;
          for (const c of d.constraints) Composite.remove(engine.world, c);
          d.constraints = [];
        }
      }
      Composite.remove(engine.world, body);
    }
  }
});

// AI: pursue the nearest living human dummy and lunge when close.
Events.on(engine, 'beforeUpdate', () => {
  const now = performance.now();
  const humans = [...dummies.values()].filter(d => (d.kind === 'human' || d.kind === 'monster') && !d.dead);
  if (humans.length === 0) return;
  for (const duck of dummies.values()) {
    if (duck.kind !== 'duck' || duck.dead) continue;
    if (duck.paralyzedUntil && now < duck.paralyzedUntil) continue;
    const body = duck.limbs.body;

    let target = null, bestD = Infinity;
    for (const h of humans) {
      const t = h.limbs.torso;
      const d = Math.hypot(t.position.x - body.position.x, t.position.y - body.position.y);
      if (d < bestD) { bestD = d; target = h; }
    }
    if (!target) continue;

    const dx = target.limbs.torso.position.x - body.position.x;
    const dir = Math.sign(dx) || 1;

    // Waddle toward the target (only when legs work).
    if (duck.standing && (duck.legsOk.L || duck.legsOk.R) && Math.abs(dx) > 6) {
      Body.applyForce(body, body.position, { x: dir * 0.008 * body.mass, y: 0 });
    }

    // Lunge when close.
    if (bestD < 90 && now > duck.lungeReadyAt && duck.standing) {
      Body.applyForce(body, body.position, { x: dir * 0.04 * body.mass, y: -0.03 * body.mass });
      duck.lungeReadyAt = now + 1400;
    }
  }
});

// Draw the duck's glowing red eyes.
Events.on(render, 'afterRender', () => {
  const ctx = render.context;
  const now = performance.now();
  for (const duck of dummies.values()) {
    if (duck.kind !== 'duck' || duck.dead) continue;
    const head = duck.limbs.head;
    const a = head.angle;
    const cos = Math.cos(a), sin = Math.sin(a);
    // Two eyes offset in head-local space (slightly forward, above center)
    const eyeLocal = [{ x: 4, y: -4 }, { x: 4, y: 4 }];
    for (const e of eyeLocal) {
      const ex = head.position.x + e.x * cos - e.y * sin;
      const ey = head.position.y + e.x * sin + e.y * cos;
      // halo
      const grad = ctx.createRadialGradient(ex, ey, 0, ex, ey, 8);
      grad.addColorStop(0, 'rgba(255,40,40,0.9)');
      grad.addColorStop(1, 'rgba(255,40,40,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(ex, ey, 8, 0, Math.PI * 2);
      ctx.fill();
      // pupil
      ctx.fillStyle = '#ffd0d0';
      ctx.beginPath();
      ctx.arc(ex, ey, 2 + 0.4 * Math.sin(now / 200 + duck.parts[0].id), 0, Math.PI * 2);
      ctx.fill();
    }
  }
});

// ---------- Standing / posture control ----------
// Apply restoring torque each tick to keep alive dummies upright. When
// structural joints break (back or either leg), the dummy collapses.

const STAND_K = 0.0009;   // angular spring strength
const STAND_D = 0.04;     // angular damping
const LEG_K   = 0.0006;
const LEG_D   = 0.03;

function uprightTorque(body, stiffness, damping) {
  let err = body.angle;
  err = Math.atan2(Math.sin(err), Math.cos(err)); // normalize to [-PI, PI]
  body.torque += (-err * stiffness - body.angularVelocity * damping) * body.mass * 100;
}

Events.on(engine, 'beforeUpdate', () => {
  const now = performance.now();
  for (const d of dummies.values()) {
    if (d.dead || !d.standing) continue;
    if (d.paralyzedUntil && now < d.paralyzedUntil) continue; // stung/zapped — crumple
    if (d.backOk) {
      uprightTorque(d.limbs.torso, STAND_K, STAND_D);
      uprightTorque(d.limbs.head, STAND_K * 0.6, STAND_D);
    }
    if (d.legsOk.L) uprightTorque(d.limbs.legL, LEG_K, LEG_D);
    if (d.legsOk.R) uprightTorque(d.limbs.legR, LEG_K, LEG_D);
  }
});

function popJoint(dummy, jointName) {
  const j = dummy.joints[jointName];
  if (!j) return;
  Composite.remove(engine.world, j);
  delete dummy.joints[jointName];
  dummy.constraints = dummy.constraints.filter(c => c !== j);
}

function breakLeg(dummy, side) {
  if (!dummy.legsOk[side]) return;
  dummy.legsOk[side] = false;
  popJoint(dummy, side === 'L' ? 'hipL' : 'hipR');
  dummy.standing = false; // can't stand on one leg in this prototype
  const leg = dummy.limbs[side === 'L' ? 'legL' : 'legR'];
  woundLimb(leg);
  spurt(leg.position.x, leg.position.y - 20, 8, 0, -1);
  log(`Leg broken.`, 'hint');
}

function breakBack(dummy) {
  if (!dummy.backOk) return;
  dummy.backOk = false;
  dummy.standing = false;
  woundLimb(dummy.limbs.torso);
  spurt(dummy.limbs.torso.position.x, dummy.limbs.torso.position.y, 10, 0, -1);
  log(`Back broken.`, 'hint');
}

// ---------- Gore system ----------

const MAX_DECALS = 220;
const decals = [];     // { x, y, r, color, alpha }
const droplets = [];   // { x, y, vx, vy, r, color, life }

const BLOOD_COLORS = ['#6d0a0a', '#8a1010', '#a31818', '#5a0606'];
const WOUND_COLORS = ['#3a0606', '#4a0808'];

function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

function addDecal(x, y, intensity) {
  const count = 1 + Math.floor(intensity * 0.6);
  for (let i = 0; i < count; i++) {
    decals.push({
      x: x + rand(-6, 6) * intensity * 0.3,
      y: y + rand(-6, 6) * intensity * 0.3,
      r: rand(2, 5 + intensity * 0.8),
      color: pick(BLOOD_COLORS),
      alpha: rand(0.55, 0.9),
    });
  }
  while (decals.length > MAX_DECALS) decals.shift();
}

function spurt(x, y, intensity, dirX = 0, dirY = -1) {
  const count = Math.min(28, 4 + Math.floor(intensity));
  for (let i = 0; i < count; i++) {
    const angle = Math.atan2(dirY, dirX) + rand(-1.2, 1.2);
    const speed = rand(2, 4 + intensity * 0.4);
    droplets.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - rand(0, 2),
      r: rand(1.5, 3.5),
      color: pick(BLOOD_COLORS),
      life: rand(40, 80),
    });
  }
}

function woundLimb(part) {
  part.render.fillStyle = pick(WOUND_COLORS);
}

function dismember(dummy) {
  if (dummy.dead) return;
  dummy.dead = true;
  for (const c of dummy.constraints) Composite.remove(engine.world, c);
  for (const p of dummy.parts) {
    woundLimb(p);
    spurt(p.position.x, p.position.y, 10, rand(-1, 1), rand(-1, 0));
    addDecal(p.position.x, p.position.y, 8);
  }
  triggerKillCam();
  log('Fatality.', 'solve');
}

// Slow-mo kill cam + red vignette
let killCamUntil = 0;
function triggerKillCam() {
  engine.timing.timeScale = 0.25;
  killCamUntil = performance.now() + 1400;
  setTimeout(() => { engine.timing.timeScale = 1; }, 1400);
}

// Collision damage
Events.on(engine, 'collisionStart', (e) => {
  for (const pair of e.pairs) {
    const a = pair.bodyA, b = pair.bodyB;
    const aFlesh = a.label === 'flesh';
    const bFlesh = b.label === 'flesh';
    if (!aFlesh && !bFlesh) continue;
    // Speed of the non-flesh body relative to the flesh body, or relative speed if both flesh
    const dvx = a.velocity.x - b.velocity.x;
    const dvy = a.velocity.y - b.velocity.y;
    const speed = Math.hypot(dvx, dvy);
    if (speed < 5) continue;
    const support = (pair.collision && pair.collision.supports && pair.collision.supports[0]) || a.position;
    const intensity = Math.min(14, speed - 4);
    addDecal(support.x, support.y, intensity);
    spurt(support.x, support.y, intensity, -dvx, -dvy);

    for (const body of [a, b]) {
      if (body.label !== 'flesh') continue;
      const dummy = dummies.get(body.dummyId);
      if (!dummy || dummy.dead) continue;
      dummy.damage += intensity;
      const part = body.bodyPart;
      if (part && dummy.partDamage[part] !== undefined) {
        dummy.partDamage[part] += intensity;
      }
      if (intensity > 6) woundLimb(body);

      // Structural breaks come BEFORE full dismemberment
      if (part === 'legL' && dummy.partDamage.legL > 14) breakLeg(dummy, 'L');
      if (part === 'legR' && dummy.partDamage.legR > 14) breakLeg(dummy, 'R');
      if (part === 'back' && dummy.partDamage.back > 18) breakBack(dummy);

      if (dummy.damage > (dummy.maxDamage || 45)) dismember(dummy);
    }
  }
});

// Render decals, droplets, vignette
Events.on(render, 'afterRender', () => {
  const ctx = render.context;

  // Decals (persistent blood pools)
  for (const d of decals) {
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fillStyle = d.color;
    ctx.globalAlpha = d.alpha;
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Droplets (flying particles)
  for (let i = droplets.length - 1; i >= 0; i--) {
    const p = droplets[i];
    if (state.world === 'abyss') {
      p.vy += 0.08; p.vx *= 0.97; p.vy *= 0.97;  // blood drifts in water
    } else if (state.world === 'mars') {
      p.vy += 0.13;          // 0.38g
    } else {
      p.vy += 0.35;          // gravity
    }
    p.x += p.vx; p.y += p.vy;
    p.life -= 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    // Settle: when slow + low, leave decal and remove
    if (p.life <= 0 || p.y > H - 8) {
      addDecal(p.x, Math.min(p.y, H - 4), 2);
      droplets.splice(i, 1);
    }
  }

  // Kill-cam vignette
  if (performance.now() < killCamUntil) {
    const t = (killCamUntil - performance.now()) / 1400;
    const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.7);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(120,0,0,${0.55 * t})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
});

function spawnBomb(x, y) {
  const b = Bodies.circle(x, y, 18, {
    render: { fillStyle: '#d64545', strokeStyle: '#5a1010', lineWidth: 2 },
    label: 'bomb',
  });
  setTimeout(() => detonate(b), 1200);
  return b;
}

function spawnCluster(x, y) {
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      World.add(engine.world, spawnCrate(x + col * 52 - 52, y + row * 52 - 100));
    }
  }
  return null;
}

function boom(bx, by, radius, force) {
  for (const body of Composite.allBodies(engine.world)) {
    if (body.isStatic) continue;
    const dx = body.position.x - bx, dy = body.position.y - by;
    const dist = Math.hypot(dx, dy);
    if (dist > radius || dist < 1) continue;
    const f = (1 - dist / radius) * force;
    Body.applyForce(body, body.position, { x: (dx / dist) * f * body.mass, y: (dy / dist) * f * body.mass });
  }
}

function detonate(bomb) {
  if (!Composite.allBodies(engine.world).includes(bomb)) return;
  boom(bomb.position.x, bomb.position.y, 220, 0.18);
  flash(bomb.position.x, bomb.position.y);
  Composite.remove(engine.world, bomb);
}

function flash(x, y) {
  const ring = { x, y, r: 0, alpha: 1 };
  const draw = () => {
    const ctx = render.context;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(232,163,61,${ring.alpha})`;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();
  };
  const tick = () => {
    ring.r += 14; ring.alpha -= 0.04;
    if (ring.alpha <= 0) { Events.off(render, 'afterRender', draw); return; }
    requestAnimationFrame(tick);
  };
  Events.on(render, 'afterRender', draw);
  tick();
}

// ---------- Black Hole ----------
// Spawns a pull-point that drags everything inward, consumes bodies that reach
// its event horizon, and fades out after a few seconds.

const blackHoles = []; // { x, y, born, life, radius, pull }

function spawnBlackHole() {
  const bh = {
    x: W / 2 + (Math.random() - 0.5) * W * 0.3,
    y: H / 2 + (Math.random() - 0.5) * H * 0.3,
    born: performance.now(),
    life: 5000,
    radius: 28,
    pull: 0.0025,
  };
  blackHoles.push(bh);
  log('Black Hole forming.', 'hint');
}

Events.on(engine, 'beforeUpdate', () => {
  if (blackHoles.length === 0) return;
  const now = performance.now();
  for (let i = blackHoles.length - 1; i >= 0; i--) {
    const bh = blackHoles[i];
    if (now - bh.born > bh.life) { blackHoles.splice(i, 1); continue; }
    for (const body of Composite.allBodies(engine.world)) {
      if (body.isStatic) continue;
      const dx = bh.x - body.position.x, dy = bh.y - body.position.y;
      const dist = Math.hypot(dx, dy);
      if (dist < bh.radius) {
        // Consumed. If it's a flesh part, mark the dummy lost.
        if (body.label === 'flesh') {
          const d = dummies.get(body.dummyId);
          if (d) { d.dead = true; for (const c of d.constraints) Composite.remove(engine.world, c); d.constraints = []; }
        }
        Composite.remove(engine.world, body);
        continue;
      }
      const falloff = 1 / Math.max(dist * 0.015, 1);
      const f = bh.pull * body.mass * falloff;
      Body.applyForce(body, body.position, { x: (dx / dist) * f, y: (dy / dist) * f });
    }
  }
});

Events.on(render, 'afterRender', () => {
  if (blackHoles.length === 0) return;
  const ctx = render.context;
  const now = performance.now();
  for (const bh of blackHoles) {
    const age = (now - bh.born) / bh.life;
    const swirl = (now / 90) % (Math.PI * 2);
    // outer accretion glow
    const grad = ctx.createRadialGradient(bh.x, bh.y, bh.radius, bh.x, bh.y, bh.radius * 6);
    grad.addColorStop(0, 'rgba(80,20,120,0.55)');
    grad.addColorStop(0.5, 'rgba(40,8,60,0.25)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bh.x, bh.y, bh.radius * 6, 0, Math.PI * 2);
    ctx.fill();
    // event horizon
    ctx.beginPath();
    ctx.arc(bh.x, bh.y, bh.radius * (1 + 0.05 * Math.sin(now / 80)), 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    // swirling ring
    ctx.strokeStyle = `rgba(180,120,220,${0.6 * (1 - age)})`;
    ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.arc(bh.x, bh.y, bh.radius * (1.6 + k * 0.5), swirl + k, swirl + k + 1.8);
      ctx.stroke();
    }
  }
});

// ---------- Machine Gun ----------
// 3 seconds of bullets streaming in from random edge points toward the center
// region. Bullets are small, fast, lethal — collision damage handles the gore.

function machineGunBarrage() {
  const duration = 2800;
  const interval = 45; // ms between shots
  const start = performance.now();
  log('Incoming fire.', 'hint');
  const fire = () => {
    if (performance.now() - start > duration) return;
    if (state.world !== 'surface') return; // stop if the player left the world
    const side = Math.floor(Math.random() * 4);
    let x, y;
    if (side === 0) { x = Math.random() * W; y = -10; }
    else if (side === 1) { x = W + 10; y = Math.random() * H; }
    else if (side === 2) { x = Math.random() * W; y = H + 10; }
    else                 { x = -10; y = Math.random() * H; }
    const tx = W / 2 + (Math.random() - 0.5) * W * 0.6;
    const ty = H / 2 + (Math.random() - 0.5) * H * 0.4;
    const dx = tx - x, dy = ty - y;
    const d = Math.hypot(dx, dy) || 1;
    const speed = 20;
    const bullet = Bodies.circle(x, y, 5, {
      density: 0.06,
      frictionAir: 0,
      render: { fillStyle: '#f5d76b', strokeStyle: '#8a6a18', lineWidth: 1 },
      label: 'bullet',
    });
    Body.setVelocity(bullet, { x: (dx / d) * speed, y: (dy / d) * speed });
    World.add(engine.world, bullet);
    // tracer effect: small spurt at muzzle direction
    droplets.push({
      x, y,
      vx: (dx / d) * 6, vy: (dy / d) * 6,
      r: 1.5, color: '#f5d76b', life: 8,
    });
    // cleanup after a couple seconds in case it goes flying
    setTimeout(() => {
      if (Composite.allBodies(engine.world).includes(bullet)) Composite.remove(engine.world, bullet);
    }, 2500);
    setTimeout(fire, interval);
  };
  fire();
}

function fatalitySlam() {
  // Slam everything up, crush down, and guarantee dismemberment of any living dummy.
  const bodies = Composite.allBodies(engine.world).filter(b => !b.isStatic);
  for (const b of bodies) {
    Body.applyForce(b, b.position, { x: (Math.random() - 0.5) * 0.6 * b.mass, y: -0.5 * b.mass });
  }
  const original = engine.gravity.y;
  engine.gravity.y = 3.5;
  setTimeout(() => { engine.gravity.y = original; }, 900);

  // Pre-emptively dismember every living dummy after a brief windup.
  const living = [...dummies.values()].filter(d => !d.dead);
  if (living.length > 0) {
    setTimeout(() => {
      for (const d of living) dismember(d);
    }, 250);
  } else {
    triggerKillCam();
  }
}

// ---------- Tornado ----------
// Sustained vortex that spins, lifts, and shreds anything in range.
// Spawns at ground level and drifts slowly across the stage.

const tornadoes = [];

function spawnTornado() {
  tornadoes.push({
    x: W * 0.2 + Math.random() * W * 0.6,
    cx: 0,
    born: performance.now(),
    life: 6000,
    driftDir: Math.random() < 0.5 ? 1 : -1,
  });
  log('Tornado touching down.', 'hint');
}

Events.on(engine, 'beforeUpdate', () => {
  if (tornadoes.length === 0) return;
  const now = performance.now();
  for (let i = tornadoes.length - 1; i >= 0; i--) {
    const t = tornadoes[i];
    if (now - t.born > t.life) { tornadoes.splice(i, 1); continue; }

    const age = (now - t.born) / t.life;
    t.cx = t.x + Math.sin(age * Math.PI * 3) * 70 * t.driftDir;
    const baseY = H;
    const R = 230;

    for (const body of Composite.allBodies(engine.world)) {
      if (body.isStatic) continue;
      const dx = body.position.x - t.cx;
      const dy = body.position.y - baseY;
      const dist = Math.hypot(dx, dy);
      if (dist > R || dist < 1) continue;

      const str = 1 - dist / R;

      // Tangential spin (counterclockwise)
      const tx = -dy / dist, ty = dx / dist;
      Body.applyForce(body, body.position, { x: tx * 0.0045 * body.mass * str, y: ty * 0.0045 * body.mass * str });

      // Upward lift
      Body.applyForce(body, body.position, { x: 0, y: -0.014 * body.mass * str });

      // Gentle inward pull to keep bodies from escaping the funnel immediately
      Body.applyForce(body, body.position, { x: (-dx / dist) * 0.001 * body.mass * str, y: (-dy / dist) * 0.001 * body.mass * str });
    }
  }
});

Events.on(render, 'afterRender', () => {
  if (tornadoes.length === 0) return;
  const ctx = render.context;
  const now = performance.now();
  for (const t of tornadoes) {
    const age = (now - t.born) / t.life;
    const cx = t.cx;
    const baseY = H;
    const funnelH = Math.min(H * 0.85, 420);
    const topY = baseY - funnelH;
    const baseW = 14;
    const topW = 115;
    const alpha = age < 0.85 ? 1 : 1 - (age - 0.85) / 0.15;

    // Funnel fill
    const grad = ctx.createLinearGradient(cx, baseY, cx, topY);
    grad.addColorStop(0, `rgba(180,190,200,${0.55 * alpha})`);
    grad.addColorStop(0.5, `rgba(200,210,220,${0.3 * alpha})`);
    grad.addColorStop(1, `rgba(220,230,240,${0.08 * alpha})`);

    ctx.beginPath();
    ctx.moveTo(cx - baseW, baseY);
    ctx.bezierCurveTo(cx - baseW - 22, baseY - funnelH * 0.4, cx - topW * 0.6, topY + funnelH * 0.3, cx - topW, topY);
    ctx.lineTo(cx + topW, topY);
    ctx.bezierCurveTo(cx + topW * 0.6, topY + funnelH * 0.3, cx + baseW + 22, baseY - funnelH * 0.4, cx + baseW, baseY);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Swirling horizontal bands clipped to the funnel
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - baseW, baseY);
    ctx.bezierCurveTo(cx - baseW - 22, baseY - funnelH * 0.4, cx - topW * 0.6, topY + funnelH * 0.3, cx - topW, topY);
    ctx.lineTo(cx + topW, topY);
    ctx.bezierCurveTo(cx + topW * 0.6, topY + funnelH * 0.3, cx + baseW + 22, baseY - funnelH * 0.4, cx + baseW, baseY);
    ctx.closePath();
    ctx.clip();

    const spin = (now / 110) % (Math.PI * 2);
    for (let b = 0; b < 8; b++) {
      const frac = b / 8;
      const bandY = baseY - frac * funnelH;
      const bandW = baseW + (topW - baseW) * frac;
      const phase = spin + b * 0.85;
      ctx.beginPath();
      ctx.ellipse(cx, bandY, bandW, bandW * 0.22, 0, phase, phase + Math.PI);
      ctx.strokeStyle = `rgba(100,120,145,${0.45 * alpha})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();

    // Dust ring at contact point
    const dustR = baseW + 20 + Math.sin(now / 75) * 5;
    const dustGrad = ctx.createRadialGradient(cx, baseY, baseW, cx, baseY, dustR + 22);
    dustGrad.addColorStop(0, `rgba(160,145,120,${0.55 * alpha})`);
    dustGrad.addColorStop(1, 'rgba(160,145,120,0)');
    ctx.beginPath();
    ctx.arc(cx, baseY, dustR + 22, 0, Math.PI * 2);
    ctx.fillStyle = dustGrad;
    ctx.fill();
  }
});

// ---------- Freeze ----------
// Stops all dynamic bodies in place. Grabbing a frozen limb unfreezes it so
// you can drag it; stretched constraints between a moving and a frozen body
// snap, letting you rip characters apart mid-freeze.

const frozenIds = new Set();
let freezeActive = false;
let freezeTimer = null;

function activateFreeze() {
  clearTimeout(freezeTimer);
  frozenIds.clear();
  for (const body of Composite.allBodies(engine.world)) {
    if (body.isStatic) continue;
    Body.setVelocity(body, { x: 0, y: 0 });
    Body.setAngularVelocity(body, 0);
    body.force  = { x: 0, y: 0 };
    body.torque = 0;
    frozenIds.add(body.id);
  }
  freezeActive = true;
  log('Everything frozen.', 'hint');
  freezeTimer = setTimeout(thawAll, 8000);
}

function thawAll() {
  // Small scatter impulse so bodies don't just drop straight down.
  for (const body of Composite.allBodies(engine.world)) {
    if (!frozenIds.has(body.id) || body.isStatic) continue;
    Body.applyForce(body, body.position, {
      x: (Math.random() - 0.5) * 0.04 * body.mass,
      y: -0.015 * body.mass,
    });
  }
  frozenIds.clear();
  freezeActive = false;
}

// Unfreeze a body the moment the player grabs it.
Events.on(mouseConstraint, 'startdrag', (e) => {
  frozenIds.delete(e.body.id);
});

// Helper: world-space position of a constraint anchor point.
function worldAnchor(body, pt) {
  const cos = Math.cos(body.angle), sin = Math.sin(body.angle);
  return {
    x: body.position.x + pt.x * cos - pt.y * sin,
    y: body.position.y + pt.x * sin + pt.y * cos,
  };
}

const RIP_DIST = 45; // px stretch before a frozen joint snaps

Events.on(engine, 'afterUpdate', () => {
  // Pin all frozen bodies — override whatever physics just computed.
  if (frozenIds.size > 0) {
    for (const body of Composite.allBodies(engine.world)) {
      if (!frozenIds.has(body.id)) continue;
      Body.setVelocity(body, { x: 0, y: 0 });
      Body.setAngularVelocity(body, 0);
      body.force  = { x: 0, y: 0 };
      body.torque = 0;
    }
  }

  // Rip check: snap any flesh constraint whose ends have diverged far enough.
  if (!freezeActive) return;
  const toSnap = [];
  for (const c of Composite.allConstraints(engine.world)) {
    if (!c.bodyA || !c.bodyB) continue;
    if (c.bodyA.label !== 'flesh' || c.bodyB.label !== 'flesh') continue;
    const aFrozen = frozenIds.has(c.bodyA.id);
    const bFrozen = frozenIds.has(c.bodyB.id);
    if (aFrozen === bFrozen) continue; // both same state, no tension from drag
    const pA = worldAnchor(c.bodyA, c.pointA || { x: 0, y: 0 });
    const pB = worldAnchor(c.bodyB, c.pointB || { x: 0, y: 0 });
    if (Math.hypot(pB.x - pA.x, pB.y - pA.y) > RIP_DIST) toSnap.push(c);
  }
  for (const c of toSnap) {
    Composite.remove(engine.world, c);
    // Update the dummy's own constraint list so damage/dismember logic stays clean.
    for (const d of dummies.values()) {
      d.constraints = d.constraints.filter(x => x !== c);
      for (const [k, v] of Object.entries(d.joints)) {
        if (v === c) delete d.joints[k];
      }
    }
    // Blood at the tear point.
    const pA = worldAnchor(c.bodyA, c.pointA || { x: 0, y: 0 });
    const pB = worldAnchor(c.bodyB, c.pointB || { x: 0, y: 0 });
    const mx = (pA.x + pB.x) / 2, my = (pA.y + pB.y) / 2;
    spurt(mx, my, 6, 0, -1);
  }
});

// Ice visual: blue-white glow + crystal sparkles on every frozen body.
Events.on(render, 'afterRender', () => {
  if (frozenIds.size === 0) return;
  const ctx = render.context;
  const now = performance.now();
  const pulse = 0.55 + 0.2 * Math.sin(now / 280);
  for (const body of Composite.allBodies(engine.world)) {
    if (!frozenIds.has(body.id)) continue;
    const { x, y } = body.position;
    const r = (body.circleRadius || Math.max(body.bounds.max.x - body.bounds.min.x, body.bounds.max.y - body.bounds.min.y) / 2) + 4;

    // Icy glow
    const grad = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 1.6);
    grad.addColorStop(0, `rgba(160,220,255,${pulse * 0.55})`);
    grad.addColorStop(0.6, `rgba(100,180,255,${pulse * 0.25})`);
    grad.addColorStop(1, 'rgba(80,160,255,0)');
    ctx.beginPath();
    ctx.arc(x, y, r * 1.6, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Crystal sparkles — 6-pointed stars at fixed offsets, slowly rotating
    const spin = (now / 2200 + body.id * 1.3) % (Math.PI * 2);
    const starPositions = [
      { ox: 0, oy: -r * 1.2 },
      { ox: r * 1.05, oy: r * 0.6 },
      { ox: -r * 1.05, oy: r * 0.6 },
    ];
    for (const sp of starPositions) {
      const sx = x + sp.ox * Math.cos(spin) - sp.oy * Math.sin(spin);
      const sy = y + sp.ox * Math.sin(spin) + sp.oy * Math.cos(spin);
      const sr = 2.5 + 1.2 * Math.sin(now / 320 + sp.ox);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(spin + sp.ox);
      ctx.strokeStyle = `rgba(200,240,255,${pulse * 0.85})`;
      ctx.lineWidth = 1;
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * sr, Math.sin(a) * sr);
        ctx.lineTo(-Math.cos(a) * sr, -Math.sin(a) * sr);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
});

// ---------- Tool execution ----------

function placeAt(x, y) {
  const tool = TOOLS.find(t => t.id === state.tool);
  if (!tool) return;
  if (tool.kind === 'action') return; // actions fire via toolbar click, not stage click
  let body = null;
  switch (tool.spawn) {
    case 'crate':   body = spawnCrate(x, y); break;
    case 'ball':    body = spawnBall(x, y); break;
    case 'dummy':   body = spawnDummy(x, y); break;
    case 'bomb':    body = spawnBomb(x, y); break;
    case 'cluster': body = spawnCluster(x, y); break;
    case 'duck':    body = spawnDuck(x, y); break;
    case 'parasite': body = spawnParasite(x, y); break;
    case 'shark':    spawnShark(x, y); break;
    case 'diver':    spawnDiver(x, y); break;
    case 'jelly':    spawnJelly(x, y); break;
    case 'charge':   body = spawnCharge(x, y); break;
    case 'piranhas': spawnPiranhas(x, y); break;
    case 'angler':   spawnAngler(x, y); break;
    case 'eel':      spawnEel(x, y); break;
    case 'astro':    spawnAstro(x, y); break;
    case 'alien':    spawnAlien(x, y); break;
    case 'tank':     body = spawnTank(x, y); break;
    case 'bug':      spawnBug(x, y); break;
    case 'poop':     body = spawnPoop(x, y); break;
    case 'ants':     spawnAnts(x, y); break;
    case 'spider':   spawnSpider(x, y); break;
    case 'spore':    spawnSpore(x, y); break;
    case 'lizard':   spawnLizard(x, y); break;
  }
  if (body) World.add(engine.world, body);
}

// Stage click → spawn. We use mousedown so it works whether or not user drags.
let lastDown = null;
Events.on(mouseConstraint, 'mousedown', (e) => {
  lastDown = { x: e.mouse.position.x, y: e.mouse.position.y };
});
Events.on(mouseConstraint, 'mouseup', (e) => {
  if (!lastDown) return;
  const dx = e.mouse.position.x - lastDown.x, dy = e.mouse.position.y - lastDown.y;
  // Only spawn on near-click (not drag). And only if we didn't grab a body.
  if (Math.hypot(dx, dy) < 5 && !mouseConstraint.body) {
    placeAt(e.mouse.position.x, e.mouse.position.y);
  }
  lastDown = null;
});

// ---------- Toolbar UI ----------

const toolbar = document.getElementById('toolbar');
function renderToolbar() {
  toolbar.innerHTML = '';
  for (const t of TOOLS) {
    if (t.world !== 'both' && t.world !== state.world) continue;
    const btn = document.createElement('button');
    btn.className = 'tool';
    btn.dataset.id = t.id;
    btn.textContent = t.label;
    if (!state.unlocked.has(t.id)) btn.classList.add('locked');
    if (state.tool === t.id) btn.classList.add('active');
    btn.addEventListener('click', () => onToolClick(t));
    toolbar.appendChild(btn);
  }
}

function onToolClick(t) {
  if (!state.unlocked.has(t.id)) {
    openMathGate(t);
    return;
  }
  if (t.kind === 'action') {
    if (t.action === 'flip-gravity') engine.gravity.y = -engine.gravity.y;
    if (t.action === 'fatality') fatalitySlam();
    if (t.action === 'black-hole') spawnBlackHole();
    if (t.action === 'machine-gun') machineGunBarrage();
    if (t.action === 'tornado') spawnTornado();
    if (t.action === 'freeze') activateFreeze();
    if (t.action === 'harpoon') harpoonVolley();
    if (t.action === 'whirlpool') spawnWhirlpool();
    if (t.action === 'kraken') summonKraken();
    if (t.action === 'meteors') meteorShower();
    if (t.action === 'storm') spawnDustStorm();
    if (t.action === 'ufo') summonUFO();
    if (t.action === 'sprinkler') startSprinkler();
    if (t.action === 'magnify') startMagnify();
    if (t.action === 'mower') launchMower();
    log(`Action: ${t.label}`);
    return;
  }
  state.tool = t.id;
  renderToolbar();
  saveState();
}

// ---------- Math gate ----------

const overlay = document.getElementById('overlay');
const lockName = document.getElementById('lock-name');
const lvlEl = document.getElementById('lvl');
const problemEl = document.getElementById('problem');
const answerEl = document.getElementById('answer');
const feedbackEl = document.getElementById('feedback');
const hintEl = document.getElementById('hint');
const hintBtn = document.getElementById('hint-btn');
const skipBtn = document.getElementById('skip-btn');
const submitBtn = document.getElementById('submit-btn');
const cancelBtn = document.getElementById('cancel-btn');

function openMathGate(tool) {
  state.pendingUnlock = tool;
  state.hintTier = 0;
  state.currentProblem = makeProblem(tool.level);
  lockName.textContent = tool.label;
  lvlEl.textContent = state.currentProblem.level;
  problemEl.textContent = state.currentProblem.text;
  answerEl.value = '';
  feedbackEl.textContent = '';
  feedbackEl.className = '';
  hintEl.className = '';
  hintEl.innerHTML = '';
  hintBtn.textContent = 'Break it down';
  skipBtn.textContent = `Use skip token (${state.skips})`;
  skipBtn.disabled = state.skips <= 0;
  overlay.classList.add('show');
  setTimeout(() => answerEl.focus(), 50);
}

function closeMathGate() {
  overlay.classList.remove('show');
  state.pendingUnlock = null;
  state.currentProblem = null;
}

function submitAnswer() {
  const p = state.currentProblem;
  if (!p) return;
  const raw = answerEl.value.trim().replace(/^x\s*=\s*/i, '');
  const v = Number(raw);
  if (raw === '' || Number.isNaN(v)) {
    feedbackEl.textContent = 'Enter a number for x.';
    feedbackEl.className = 'nope';
    return;
  }
  if (v === p.answer) {
    feedbackEl.textContent = `Correct. x = ${p.answer}.`;
    feedbackEl.className = 'ok';
    const tool = state.pendingUnlock;
    const usedHint = state.hintTier > 0;
    state.solved += 1;
    if (!usedHint) {
      state.correctStreak += 1;
      if (state.correctStreak >= 10) { state.skips += 1; state.correctStreak = 0; log('Earned a skip token.', 'solve'); }
    } else {
      state.correctStreak = 0;
    }
    state.unlocked.add(tool.id);
    state.levelCorrect[p.level] = (state.levelCorrect[p.level] || 0) + 1;
    log(`Unlocked: ${tool.label} (${p.text})`, 'solve');
    refreshHUD();
    refreshProficiency();
    saveState();
    setTimeout(() => {
      closeMathGate();
      renderToolbar();
      renderWorldTabs();
      const el = toolbar.querySelector(`[data-id="${tool.id}"]`);
      if (el) { el.classList.add('unlocked-flash'); setTimeout(() => el.classList.remove('unlocked-flash'), 1100); }
      if (tool.onUnlock) tool.onUnlock();
    }, 700);
  } else {
    feedbackEl.textContent = 'Not quite — want a breakdown?';
    feedbackEl.className = 'nope';
  }
}

function showHint() {
  const p = state.currentProblem;
  if (!p) return;
  state.hintTier = Math.min(state.hintTier + 1, 3);
  log(`Hint tier ${state.hintTier} on "${p.text}"`, 'hint');

  if (state.hintTier === 1) {
    hintEl.innerHTML = `
      <h4>Reframe</h4>
      The goal is always the same: get <code>x</code> alone on one side.
      Whatever you do to one side, do to the other.
    `;
    hintBtn.textContent = 'Walk through the reasoning';
  } else if (state.hintTier === 2) {
    hintEl.innerHTML = `
      <h4>Reasoning walkthrough</h4>
      For <code>${p.text}</code> — ${p.method}<br><br>
      The logic: undo whatever was done to <code>x</code>, using the opposite operation.
    `;
    hintBtn.textContent = 'Worked example + new problem';
  } else {
    // Tier 3: explain fully, then swap in a structurally identical new problem.
    const fresh = makeProblem(p.level);
    state.currentProblem = fresh;
    problemEl.textContent = fresh.text;
    answerEl.value = '';
    feedbackEl.textContent = 'New problem — same shape, different numbers.';
    feedbackEl.className = '';
    hintEl.innerHTML = `
      <h4>Worked example</h4>
      The original: <code>${p.text}</code> → ${p.method}<br><br>
      <b>The rule:</b> work backwards from the order of operations — undo addition/subtraction first, then multiplication/division.<br><br>
      Try this one using the same method: <code>${fresh.text}</code>
    `;
    hintBtn.textContent = 'Break it down';
    state.hintTier = 0; // reset for the new problem
  }
  hintEl.className = 'show';
}

function useSkip() {
  if (state.skips <= 0 || !state.pendingUnlock) return;
  state.skips -= 1;
  const tool = state.pendingUnlock;
  state.unlocked.add(tool.id);
  log(`Skipped: ${tool.label} (used token)`, 'solve');
  refreshHUD();
  saveState();
  closeMathGate();
  renderToolbar();
  renderWorldTabs();
  if (tool.onUnlock) tool.onUnlock();
}

hintBtn.addEventListener('click', showHint);
submitBtn.addEventListener('click', submitAnswer);
skipBtn.addEventListener('click', useSkip);
cancelBtn.addEventListener('click', closeMathGate);
answerEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitAnswer();
});
overlay.addEventListener('click', (e) => { if (e.target === overlay) closeMathGate(); });

// ---------- HUD + log ----------

const tierEl = document.getElementById('tier');
const solvedEl = document.getElementById('solved');
const skipsEl = document.getElementById('skips');
const nextUnlockEl = document.getElementById('next-unlock');
const barEl = document.getElementById('bar');
const logEl = document.getElementById('log');
const gradeEl = document.getElementById('grade-display');
const standardEl = document.getElementById('standard-display');
const lbar1El = document.getElementById('lbar1');
const lbar2El = document.getElementById('lbar2');
const lbar3El = document.getElementById('lbar3');
const lbar4El = document.getElementById('lbar4');
const lbar5El = document.getElementById('lbar5');
const lcount1El = document.getElementById('lcount1');
const lcount2El = document.getElementById('lcount2');
const lcount3El = document.getElementById('lcount3');
const lcount4El = document.getElementById('lcount4');
const lcount5El = document.getElementById('lcount5');
const lbar6El = document.getElementById('lbar6');
const lcount6El = document.getElementById('lcount6');

const GRADE_DATA = {
  1: { grade: 'Grade 6', topic: 'One-Step Equations (+/−)', standard: 'AL CCRS 6.EE.B.7' },
  2: { grade: 'Grade 6', topic: 'One-Step Equations (×/÷)', standard: 'AL CCRS 6.EE.B.7' },
  3: { grade: 'Grade 7', topic: 'Two-Step Equations',        standard: 'AL CCRS 7.EE.B.4' },
  4: { grade: 'Grade 8', topic: 'Variables on Both Sides',   standard: 'AL CCRS 8.EE.C.7' },
  5: { grade: 'Grade 8', topic: 'Distributive Equations',    standard: 'AL CCRS 8.EE.C.7b' },
  6: { grade: 'Grade 8', topic: 'Multi-Step: Distribute + Collect', standard: 'AL CCRS 8.EE.C.7b' },
};
const PROFICIENCY_AT = 3; // correct answers to establish proficiency at a level

function refreshProficiency() {
  const lc = state.levelCorrect;
  const pct = lvl => Math.min(100, Math.round((lc[lvl] / PROFICIENCY_AT) * 100));
  lbar1El.style.width = pct(1) + '%';
  lbar2El.style.width = pct(2) + '%';
  lbar3El.style.width = pct(3) + '%';
  lbar4El.style.width = pct(4) + '%';
  lbar5El.style.width = pct(5) + '%';
  lbar6El.style.width = pct(6) + '%';
  lcount1El.textContent = lc[1];
  lcount2El.textContent = lc[2];
  lcount3El.textContent = lc[3];
  lcount4El.textContent = lc[4];
  lcount5El.textContent = lc[5];
  lcount6El.textContent = lc[6];

  let highestProficient = 0;
  for (let lvl = 6; lvl >= 1; lvl--) {
    if (lc[lvl] >= PROFICIENCY_AT) { highestProficient = lvl; break; }
  }

  if (highestProficient > 0) {
    const { grade, topic, standard } = GRADE_DATA[highestProficient];
    gradeEl.textContent = `${grade} · ${topic}`;
    standardEl.textContent = standard;
  } else {
    const active = lc[6] > 0 ? 6 : lc[5] > 0 ? 5 : lc[4] > 0 ? 4 : lc[3] > 0 ? 3 : lc[2] > 0 ? 2 : lc[1] > 0 ? 1 : 0;
    if (active > 0) {
      gradeEl.textContent = `${GRADE_DATA[active].grade} · In Progress`;
      standardEl.textContent = GRADE_DATA[active].standard;
    } else {
      gradeEl.textContent = '—';
      standardEl.textContent = 'Solve a problem to see your level';
    }
  }
}

function tierLabel(n) {
  if (n < 9) return 'Civilian';
  if (n < 21) return 'Operative';
  if (n < 41) return 'Tactician';
  if (n < 66) return 'Warlord';
  return 'Carnage Master';
}

function refreshHUD() {
  tierEl.textContent = tierLabel(state.solved);
  solvedEl.textContent = state.solved;
  skipsEl.textContent = state.skips;
  const avail = TOOLS.filter(t => t.world === 'both' || t.world === state.world);
  const next = avail.find(t => !state.unlocked.has(t.id));
  nextUnlockEl.textContent = next ? next.label : 'all unlocked';
  const unlockedHere = avail.filter(t => state.unlocked.has(t.id)).length;
  barEl.style.width = `${Math.round((unlockedHere / avail.length) * 100)}%`;
}

function log(msg, kind = '') {
  const div = document.createElement('div');
  div.className = `entry ${kind}`;
  const time = new Date().toLocaleTimeString();
  div.innerHTML = `<b>${time}</b> &nbsp; ${msg}`;
  logEl.prepend(div);
  while (logEl.children.length > 60) logEl.lastChild.remove();
}

// ---------- Boot ----------

renderToolbar();
refreshHUD();
refreshProficiency();
log('Click a locked tool to unlock it. Click the stage to spawn.');

// Drop a few starter crates so the sandbox isn't empty.
for (let i = 0; i < 4; i++) {
  World.add(engine.world, spawnCrate(W * 0.3 + i * 60, H - 100 - i * 60));
}
World.add(engine.world, spawnCrate(W * 0.6, H - 100));
spawnDummy(W * 0.7, H - 140);

// ---------- Parasite + Tentacled Monster ----------
// Parasites crawl toward the nearest living human, latch on, and begin a
// 3-second transformation. Mid-transform the dummy grows extra eyes and
// tentacles, color shifts purple. When complete the host becomes a "monster"
// — aggressive AI, hunts non-monsters, and on death erupts into 2 new
// parasites that spread the infection.

const parasites = [];
const INFECTION_MS = 3000;

function hexToRgb(h) {
  const s = h.replace('#', '');
  return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) };
}
function lerpColor(a, b, t) {
  const pa = hexToRgb(a), pb = hexToRgb(b);
  const r = Math.round(pa.r + (pb.r - pa.r) * t);
  const g = Math.round(pa.g + (pb.g - pa.g) * t);
  const bl = Math.round(pa.b + (pb.b - pa.b) * t);
  return `rgb(${r},${g},${bl})`;
}

function spawnParasite(x, y) {
  const p = Bodies.circle(x, y, 11, {
    density: 0.0008,
    frictionAir: 0.04,
    friction: 0.6,
    // Physics body is invisible — the headcrab is drawn procedurally in afterRender.
    render: { visible: false },
    label: 'parasite',
  });
  p.parasiteData = { attached: false, scuttlePhase: Math.random() * Math.PI * 2 };
  parasites.push(p);
  return p;
}

function drawHeadcrab(ctx, p, now) {
  const x = p.position.x, y = p.position.y;
  const vx = p.velocity.x, vy = p.velocity.y;
  const speed = Math.hypot(vx, vy);
  // Face the direction of motion; sticky facing so it doesn't flip every frame at rest.
  if (Math.abs(vx) > 0.15) p.parasiteData.facing = vx >= 0 ? 1 : -1;
  const facing = p.parasiteData.facing || 1;
  const airborne = Math.abs(vy) > 1.5;
  const r = 11;

  // Advance scuttle phase based on speed (faster movement = faster legs)
  p.parasiteData.scuttlePhase += Math.min(0.35, 0.04 + speed * 0.12);
  const phase = p.parasiteData.scuttlePhase;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  ctx.rotate(p.angle * facing);

  // Subtle bloody halo so it pops against the dark stage
  const halo = ctx.createRadialGradient(0, 0, r, 0, 0, r * 2.2);
  halo.addColorStop(0, 'rgba(140,30,20,0.35)');
  halo.addColorStop(1, 'rgba(140,30,20,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2);
  ctx.fill();

  // Four legs, each at its own scuttle phase. When airborne they splay out.
  const legs = [
    { hipX: -5,  baseFoot: -11, phaseOff: 0,                kneeDx: -3 },
    { hipX: -2,  baseFoot: -5,  phaseOff: Math.PI,          kneeDx: -2 },
    { hipX:  2,  baseFoot:  6,  phaseOff: Math.PI * 0.5,    kneeDx:  2 },
    { hipX:  5,  baseFoot: 12,  phaseOff: Math.PI * 1.5,    kneeDx:  3 },
  ];
  ctx.strokeStyle = '#4a1a10';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  for (const leg of legs) {
    const swing = airborne
      ? Math.sin(leg.phaseOff) * 9
      : Math.sin(phase + leg.phaseOff) * 4;
    const lift = airborne
      ? -4
      : Math.max(0, Math.cos(phase + leg.phaseOff)) * 5;
    const hx = leg.hipX, hy = 2;
    const fx = leg.baseFoot + swing;
    const fy = r * 0.9 - lift;
    const mx = (hx + fx) / 2 + leg.kneeDx;
    const my = (hy + fy) / 2 - 4 - (airborne ? 3 : 0);
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(mx, my);
    ctx.lineTo(fx, fy);
    ctx.stroke();
    // claw tip
    ctx.beginPath();
    ctx.arc(fx, fy, 1.4, 0, Math.PI * 2);
    ctx.fillStyle = '#2a0808';
    ctx.fill();
  }

  // Body dome — slightly flattened ellipse, fleshy pink
  ctx.fillStyle = '#b56a5a';
  ctx.strokeStyle = '#5a2818';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.88, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Top highlight (wet sheen)
  ctx.fillStyle = 'rgba(228,150,130,0.7)';
  ctx.beginPath();
  ctx.ellipse(-2.5, -3.5, r * 0.55, r * 0.35, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Mottled spots
  ctx.fillStyle = 'rgba(80,30,20,0.55)';
  ctx.beginPath(); ctx.arc(3, -1, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-4, 3, 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(5, 4, 1, 0, Math.PI * 2); ctx.fill();

  // Forward-facing mouth — opens and closes
  const chomp = 0.5 + Math.abs(Math.sin(now / 180));
  ctx.fillStyle = '#0a0202';
  ctx.beginPath();
  ctx.ellipse(r * 0.55, r * 0.05, 3.5, 2.4 * chomp, 0, 0, Math.PI * 2);
  ctx.fill();
  // teeth (top + bottom rows)
  ctx.fillStyle = '#f0e8d4';
  for (let i = -2; i <= 2; i++) {
    const tx = r * 0.55 + i * 1.2;
    const th = 1.6 * chomp;
    // top
    ctx.beginPath();
    ctx.moveTo(tx - 0.6, r * 0.05 - 1 * chomp);
    ctx.lineTo(tx + 0.6, r * 0.05 - 1 * chomp);
    ctx.lineTo(tx, r * 0.05 - 1 * chomp + th);
    ctx.closePath();
    ctx.fill();
    // bottom
    ctx.beginPath();
    ctx.moveTo(tx - 0.6, r * 0.05 + 1 * chomp);
    ctx.lineTo(tx + 0.6, r * 0.05 + 1 * chomp);
    ctx.lineTo(tx, r * 0.05 + 1 * chomp - th);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

// Parasite seek: glide toward nearest uninfected human flesh
Events.on(engine, 'beforeUpdate', () => {
  const worldBodies = Composite.allBodies(engine.world);
  for (let i = parasites.length - 1; i >= 0; i--) {
    const p = parasites[i];
    if (!worldBodies.includes(p)) { parasites.splice(i, 1); continue; }
    if (p.parasiteData.attached) continue;

    let target = null, bestD = Infinity;
    for (const d of dummies.values()) {
      if (d.kind !== 'human' || d.dead || d.infected) continue;
      const t = d.limbs.torso;
      const dd = Math.hypot(t.position.x - p.position.x, t.position.y - p.position.y);
      if (dd < bestD) { bestD = dd; target = d; }
    }
    if (!target) continue;
    const dx = target.limbs.torso.position.x - p.position.x;
    const dy = target.limbs.torso.position.y - p.position.y;
    const d = Math.hypot(dx, dy) || 1;
    Body.applyForce(p, p.position, {
      x: (dx / d) * 0.0009 * p.mass,
      y: (dy / d) * 0.0009 * p.mass - 0.0006 * p.mass, // slight lift to fight gravity
    });
  }
});

// On contact with flesh, infect
Events.on(engine, 'collisionStart', (e) => {
  for (const pair of e.pairs) {
    let parasite = null, flesh = null;
    if (pair.bodyA.label === 'parasite' && pair.bodyB.label === 'flesh') { parasite = pair.bodyA; flesh = pair.bodyB; }
    else if (pair.bodyB.label === 'parasite' && pair.bodyA.label === 'flesh') { parasite = pair.bodyB; flesh = pair.bodyA; }
    if (!parasite || !flesh) continue;
    const dummy = dummies.get(flesh.dummyId);
    if (!dummy || dummy.dead || dummy.kind !== 'human' || dummy.infected) continue;
    dummy.infected = true;
    dummy.infectionStart = performance.now();
    dummy.infectionProgress = 0;
    dummy.monster = false;
    parasite.parasiteData.attached = true;
    Composite.remove(engine.world, parasite);
    log('Parasite latched on.', 'hint');
  }
});

// Original colors so we can lerp back/forth cleanly
const HUMAN_COLORS = {
  head: '#d6c2a8', torso: '#5a6470', armL: '#5a6470', armR: '#5a6470', legL: '#36404a', legR: '#36404a',
};
const MONSTER_COLORS = {
  head: '#5a1a7a', torso: '#3a0a5a', armL: '#3a0a5a', armR: '#3a0a5a', legL: '#1a0530', legR: '#1a0530',
};

// Infection progression + transform-complete trigger
Events.on(engine, 'beforeUpdate', () => {
  const now = performance.now();
  for (const d of dummies.values()) {
    if (!d.infected || d.dead) continue;
    const elapsed = now - d.infectionStart;
    const progress = Math.min(1, elapsed / INFECTION_MS);
    d.infectionProgress = progress;

    // Color shift each tick (only if part still exists)
    for (const part of ['head', 'torso', 'armL', 'armR', 'legL', 'legR']) {
      const limb = d.limbs[part];
      if (!limb) continue;
      limb.render.fillStyle = lerpColor(HUMAN_COLORS[part], MONSTER_COLORS[part], progress);
    }

    if (progress >= 1 && !d.monster) {
      d.monster = true;
      d.kind = 'monster';
      d.lungeReadyAt = 0;
      log('Transformation complete.', 'solve');
    }
  }
});

// Monster AI: hunt nearest non-monster, lunge when close
Events.on(engine, 'beforeUpdate', () => {
  const targets = [...dummies.values()].filter(d => !d.dead && d.kind !== 'monster');
  for (const m of dummies.values()) {
    if (m.kind !== 'monster' || m.dead) continue;
    if (!m.standing) continue;
    if (m.paralyzedUntil && performance.now() < m.paralyzedUntil) continue;
    let target = null, bestD = Infinity;
    for (const t of targets) {
      const tt = t.limbs.torso;
      const dist = Math.hypot(tt.position.x - m.limbs.torso.position.x, tt.position.y - m.limbs.torso.position.y);
      if (dist < bestD) { bestD = dist; target = t; }
    }
    if (!target) continue;
    const dx = target.limbs.torso.position.x - m.limbs.torso.position.x;
    const dir = Math.sign(dx) || 1;
    if (Math.abs(dx) > 6) {
      Body.applyForce(m.limbs.torso, m.limbs.torso.position, { x: dir * 0.018 * m.limbs.torso.mass, y: 0 });
    }
    const now = performance.now();
    if (bestD < 85 && now > m.lungeReadyAt) {
      Body.applyForce(m.limbs.torso, m.limbs.torso.position, { x: dir * 0.09 * m.limbs.torso.mass, y: -0.06 * m.limbs.torso.mass });
      m.lungeReadyAt = now + 1300;
    }
  }
});

// On monster death (dismember), erupt parasites that spread the infection
const _origDismember = dismember;
dismember = function (dummy) {
  const wasMonster = dummy.kind === 'monster' && !dummy.dead;
  _origDismember(dummy);
  if (wasMonster) {
    const t = dummy.limbs.torso;
    for (let k = 0; k < 2; k++) {
      const px = t.position.x + (Math.random() - 0.5) * 30;
      const py = t.position.y - 20 + (Math.random() - 0.5) * 20;
      const parasite = spawnParasite(px, py);
      Body.setVelocity(parasite, { x: (Math.random() - 0.5) * 6, y: -3 - Math.random() * 3 });
      World.add(engine.world, parasite);
    }
    log('The host bursts — parasites scatter.', 'hint');
  }
};

// Render: tentacles, gross pulsing eyes, parasite halos
Events.on(render, 'afterRender', () => {
  const ctx = render.context;
  const now = performance.now();

  // Tentacles + eyes on infected/monster dummies
  for (const d of dummies.values()) {
    if (!d.infected || d.dead) continue;
    const progress = d.infectionProgress || 0;
    const t = d.limbs.torso;
    if (!t) continue;
    const a = t.angle;
    const cos = Math.cos(a), sin = Math.sin(a);

    // Tentacles emerging from torso (count grows with progress)
    const tentCount = Math.floor(progress * 6);
    for (let i = 0; i < tentCount; i++) {
      const seed = i * 1.91 + (d.parts[0].id % 7);
      const baseAngle = a + (i / Math.max(tentCount, 1)) * Math.PI * 2 + Math.sin(now / 600 + seed) * 0.3;
      const len = 20 + progress * 30 + Math.sin(now / 320 + seed) * 6;
      const ox = Math.cos(baseAngle) * 10;
      const oy = Math.sin(baseAngle) * 18;
      const startX = t.position.x + ox;
      const startY = t.position.y + oy;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      const segs = 8;
      let lastX = startX, lastY = startY;
      for (let s = 1; s <= segs; s++) {
        const tFrac = s / segs;
        const wiggle = Math.sin(now / 220 + seed + tFrac * 5) * 10 * tFrac;
        const px = startX + Math.cos(baseAngle) * len * tFrac + Math.cos(baseAngle + Math.PI / 2) * wiggle;
        const py = startY + Math.sin(baseAngle) * len * tFrac + Math.sin(baseAngle + Math.PI / 2) * wiggle;
        ctx.lineTo(px, py);
        lastX = px; lastY = py;
      }
      ctx.strokeStyle = '#3a0a5a';
      ctx.lineWidth = 5 * (1 - i / (tentCount + 2));
      ctx.lineCap = 'round';
      ctx.stroke();
      // highlight stroke for slimy sheen
      ctx.strokeStyle = 'rgba(180,80,200,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // tip blob
      ctx.beginPath();
      ctx.arc(lastX, lastY, 3 + progress * 2, 0, Math.PI * 2);
      ctx.fillStyle = '#6a1a8a';
      ctx.fill();
    }

    // Gross pulsing eyes scattered on the body
    const eyeCount = Math.floor(progress * 7);
    for (let i = 0; i < eyeCount; i++) {
      const seed = i * 2.37;
      const lx = Math.sin(seed * 3.1) * 9;
      const ly = Math.cos(seed * 4.7) * 24;
      const ex = t.position.x + lx * cos - ly * sin;
      const ey = t.position.y + lx * sin + ly * cos;
      const pulse = 1 + 0.35 * Math.sin(now / 220 + seed);
      const r = (2 + (i % 3) * 0.8) * pulse;
      // sclera
      ctx.beginPath();
      ctx.arc(ex, ey, r, 0, Math.PI * 2);
      ctx.fillStyle = '#f0e0d8';
      ctx.fill();
      // bloodshot veins
      ctx.strokeStyle = 'rgba(150,20,20,0.55)';
      ctx.lineWidth = 0.5;
      for (let k = 0; k < 4; k++) {
        const ang = seed + k * 1.7;
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex + Math.cos(ang) * r * 0.95, ey + Math.sin(ang) * r * 0.95);
        ctx.stroke();
      }
      // pupil — looks at nearest non-monster
      let lookX = 0, lookY = 0;
      let bestD = Infinity, lookT = null;
      for (const o of dummies.values()) {
        if (o === d || o.dead || o.kind === 'monster') continue;
        const tx = o.limbs.torso.position.x, ty = o.limbs.torso.position.y;
        const dd = Math.hypot(tx - ex, ty - ey);
        if (dd < bestD) { bestD = dd; lookT = { x: tx, y: ty }; }
      }
      if (lookT) {
        const dx = lookT.x - ex, dy = lookT.y - ey, dd = Math.hypot(dx, dy) || 1;
        lookX = (dx / dd) * r * 0.4;
        lookY = (dy / dd) * r * 0.4;
      }
      ctx.beginPath();
      ctx.arc(ex + lookX, ey + lookY, r * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0510';
      ctx.fill();
    }
  }

  // Free-roaming parasites drawn as headcrabs
  for (const p of parasites) {
    if (p.parasiteData.attached) continue;
    drawHeadcrab(ctx, p, now);
  }
});

// ====================================================================
// ---------- WORLD 2: THE ABYSS ----------
// Deep-ocean stage. Buoyancy + drag make everything float and drift;
// the world has its own bestiary (diver, jellyfish, piranhas, angler,
// eel) and weapons (depth charge, harpoons, whirlpool, kraken).
// ====================================================================

// ---------- World switching ----------

const worldTabsEl = document.getElementById('world-tabs');

function renderWorldTabs() {
  worldTabsEl.innerHTML = '';
  for (const w of WORLDS) {
    const btn = document.createElement('button');
    btn.className = 'world-tab';
    const locked = w.gate && !state.unlocked.has(w.gate.id);
    if (locked) btn.classList.add('locked');
    if (state.world === w.id) btn.classList.add('active');
    btn.textContent = w.label;
    btn.addEventListener('click', () => {
      if (locked) { openMathGate(w.gate); return; }
      switchWorld(w.id);
    });
    worldTabsEl.appendChild(btn);
  }
}

function clearStage() {
  for (const c of Composite.allConstraints(engine.world)) {
    if (c.label === 'Mouse Constraint') continue;
    Composite.remove(engine.world, c);
  }
  for (const b of Composite.allBodies(engine.world)) {
    if (b.isStatic) continue;
    Composite.remove(engine.world, b);
  }
  dummies.clear();
  parasites.length = 0;
  blackHoles.length = 0;
  tornadoes.length = 0;
  whirlpools.length = 0;
  krakens.length = 0;
  charges.length = 0;
  bubbles.length = 0;
  ufos.length = 0;
  marsStorms.length = 0;
  tanks.length = 0;
  gasPuffs.length = 0;
  mowers.length = 0;
  sprinklers.length = 0;
  sunbeams.length = 0;
  spores.length = 0;
  flames.length = 0;
  smokes.length = 0;
  grassBits.length = 0;
  waterDrops.length = 0;
  webs.length = 0;
  poops.length = 0;
  decals.length = 0;
  droplets.length = 0;
  frozenIds.clear();
  freezeActive = false;
  clearTimeout(freezeTimer);
  engine.timing.timeScale = 1;
  killCamUntil = 0;
}

function switchWorld(id) {
  if (state.world === id) return;
  state.world = id;
  const w = WORLDS.find(x => x.id === id);
  clearStage();
  render.options.background = w.bg;
  rebuildWalls();
  engine.gravity.y = w.gravity ?? 1;
  const tool = TOOLS.find(t => t.id === state.tool);
  if (!tool || (tool.world !== 'both' && tool.world !== id)) state.tool = 'spawn-box';
  renderToolbar();
  renderWorldTabs();
  refreshHUD();
  if (id === 'abyss') {
    World.add(engine.world, spawnCrate(W * 0.35, H - 140));
    spawnDiver(W * 0.62, H - 160);
    log('Descending into The Abyss.', 'solve');
  } else if (id === 'mars') {
    World.add(engine.world, spawnCrate(W * 0.35, H - 140));
    spawnAstro(W * 0.62, H - 160);
    log('Touchdown on Mars.', 'solve');
  } else if (id === 'yard') {
    World.add(engine.world, spawnCrate(W * 0.3, H - 120));
    spawnBug(W * 0.55, H - 80);
    spawnBug(W * 0.72, H - 90);
    log('Shrunk to bug size. The lawn looms overhead.', 'solve');
  } else {
    for (let i = 0; i < 3; i++) World.add(engine.world, spawnCrate(W * 0.3 + i * 60, H - 100));
    spawnDummy(W * 0.7, H - 140);
    log('Surfacing.', 'solve');
  }
  saveState();
}

// ---------- Water physics ----------
// Buoyancy scales with body AREA (not mass), so dense things — cannonballs,
// depth charges, harpoons — sink while default-density bodies go floaty.

const WATER_BUOYANCY = 8e-7;
const WATER_DRAG = 0.985;

Events.on(engine, 'beforeUpdate', () => {
  if (state.world !== 'abyss') return;
  for (const body of Composite.allBodies(engine.world)) {
    if (body.isStatic || frozenIds.has(body.id)) continue;
    Body.applyForce(body, body.position, { x: 0, y: -engine.gravity.y * WATER_BUOYANCY * body.area });
    Body.setVelocity(body, { x: body.velocity.x * WATER_DRAG, y: body.velocity.y * WATER_DRAG });
    Body.setAngularVelocity(body, body.angularVelocity * 0.98);
    if (Math.hypot(body.velocity.x, body.velocity.y) > 7 && Math.random() < 0.25) {
      spawnBubble(body.position.x, body.position.y, rand(1, 2.5));
    }
  }
});

const bubbles = [];
function spawnBubble(x, y, r) {
  bubbles.push({ x, y, r, vy: -rand(0.5, 1.4), wob: Math.random() * Math.PI * 2, life: rand(90, 220) });
  if (bubbles.length > 170) bubbles.shift();
}

// ---------- Abyss ambience: light shafts, marine snow, bubbles ----------

const motes = Array.from({ length: 46 }, () => ({
  x: Math.random(), y: Math.random(), r: rand(0.6, 1.8), v: rand(0.0001, 0.00035),
}));

Events.on(render, 'afterRender', () => {
  if (state.world !== 'abyss') return;
  const ctx = render.context;
  const now = performance.now();

  // Light shafts from the surface, slowly swaying
  for (let i = 0; i < 3; i++) {
    const sway = Math.sin(now / 5200 + i * 2.1) * 80;
    const topX = W * (0.2 + i * 0.3) + sway;
    const grad = ctx.createLinearGradient(topX, 0, topX + 60, H);
    grad.addColorStop(0, 'rgba(120,200,230,0.07)');
    grad.addColorStop(1, 'rgba(120,200,230,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(topX - 30, 0);
    ctx.lineTo(topX + 50, 0);
    ctx.lineTo(topX + 170 + sway * 0.4, H);
    ctx.lineTo(topX - 120 + sway * 0.4, H);
    ctx.closePath();
    ctx.fill();
  }

  // Marine snow
  ctx.fillStyle = 'rgba(200,225,235,0.16)';
  for (const m of motes) {
    m.y += m.v;
    if (m.y > 1) { m.y = 0; m.x = Math.random(); }
    ctx.beginPath();
    ctx.arc(m.x * W, m.y * H, m.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Bubbles
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.wob += 0.07;
    b.x += Math.sin(b.wob) * 0.35;
    b.y += b.vy;
    b.life -= 1;
    if (b.life <= 0 || b.y < -10) { bubbles.splice(i, 1); continue; }
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(190,230,245,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(230,250,255,0.35)';
    ctx.fill();
  }
});

// ---------- Diver ----------
// The Abyss's resident victim. Same skeleton + damage model as the dummy;
// brass helmet and bubble trail are drawn in afterRender.

function spawnDiver(x, y) {
  const id = nextDummyId++;
  const group = Body.nextGroup(true);
  const tag = (b, part) => { b.label = 'flesh'; b.dummyId = id; b.bodyPart = part; return b; };

  const suit = '#9a7f4a', suitDark = '#6e5a34';
  const head = tag(Bodies.circle(x, y - 60, 15, { collisionFilter: { group }, render: { fillStyle: '#c9a84a' } }), 'head');
  const torso = tag(Bodies.rectangle(x, y - 20, 26, 60, { collisionFilter: { group }, render: { fillStyle: suit } }), 'back');
  const armL = tag(Bodies.rectangle(x - 22, y - 20, 14, 50, { collisionFilter: { group }, render: { fillStyle: suit } }), 'armL');
  const armR = tag(Bodies.rectangle(x + 22, y - 20, 14, 50, { collisionFilter: { group }, render: { fillStyle: suit } }), 'armR');
  const legL = tag(Bodies.rectangle(x - 8, y + 30, 14, 50, { collisionFilter: { group }, render: { fillStyle: suitDark } }), 'legL');
  const legR = tag(Bodies.rectangle(x + 8, y + 30, 14, 50, { collisionFilter: { group }, render: { fillStyle: suitDark } }), 'legR');

  const parts = [head, torso, armL, armR, legL, legR];
  const joinOpts = { stiffness: 0.9, damping: 0.3, length: 0, render: { visible: false } };

  const joints = {
    neck:      Constraint.create({ bodyA: head, bodyB: torso, pointA: { x: -6, y: 12 }, pointB: { x: -6, y: -28 }, ...joinOpts }),
    neck2:     Constraint.create({ bodyA: head, bodyB: torso, pointA: { x: 6,  y: 12 }, pointB: { x: 6,  y: -28 }, ...joinOpts }),
    shoulderL: Constraint.create({ bodyA: torso, bodyB: armL, pointA: { x: -10, y: -22 }, pointB: { x: 0, y: -20 }, ...joinOpts }),
    shoulderR: Constraint.create({ bodyA: torso, bodyB: armR, pointA: { x: 10, y: -22 }, pointB: { x: 0, y: -20 }, ...joinOpts }),
    hipL:      Constraint.create({ bodyA: torso, bodyB: legL, pointA: { x: -7, y: 28 }, pointB: { x: 0, y: -20 }, ...joinOpts }),
    hipR:      Constraint.create({ bodyA: torso, bodyB: legR, pointA: { x: 7, y: 28 }, pointB: { x: 0, y: -20 }, ...joinOpts }),
  };
  const constraints = Object.values(joints);

  dummies.set(id, {
    kind: 'human',
    isDiver: true,
    bubbleAt: 0,
    parts, constraints, joints,
    limbs: { head, torso, armL, armR, legL, legR },
    damage: 0,
    partDamage: { back: 0, legL: 0, legR: 0, neck: 0, armL: 0, armR: 0 },
    legsOk: { L: true, R: true },
    backOk: true,
    standing: true,
    dead: false,
  });
  World.add(engine.world, [...parts, ...constraints]);
  return null;
}

// Diver helmet + bubble trail
Events.on(render, 'afterRender', () => {
  const ctx = render.context;
  const now = performance.now();
  for (const d of dummies.values()) {
    if (!d.isDiver) continue;
    const head = d.limbs.head;
    if (!head) continue;
    const { x, y } = head.position;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(head.angle);
    // Brass dome
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.strokeStyle = d.dead ? '#5a4a28' : '#e0bc5a';
    ctx.lineWidth = 3;
    ctx.stroke();
    // Porthole
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fillStyle = d.dead ? 'rgba(40,15,15,0.85)' : 'rgba(28,48,68,0.85)';
    ctx.fill();
    ctx.strokeStyle = '#8a7038';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Glass glint
    ctx.beginPath();
    ctx.arc(-3, -3, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(200,230,250,0.6)';
    ctx.fill();
    // Rivets
    ctx.fillStyle = '#8a7038';
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.3;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 13, Math.sin(a) * 13, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Air bubbles from the helmet valve
    if (!d.dead && state.world === 'abyss' && now > d.bubbleAt) {
      spawnBubble(x + 8, y - 8, rand(1.5, 3));
      d.bubbleAt = now + rand(500, 900);
    }
  }
});

// ---------- Jellyfish ----------
// Drifts upward in slow pulses. Touch one and it stings: a few damage plus
// a couple seconds of paralysis (posture + AI both respect paralyzedUntil).

function spawnJelly(x, y) {
  const id = nextDummyId++;
  const body = Bodies.circle(x, y, 15, {
    density: 0.0006, frictionAir: 0.06, render: { visible: false },
  });
  body.label = 'flesh'; body.dummyId = id; body.bodyPart = 'back';
  dummies.set(id, {
    kind: 'jelly',
    parts: [body], constraints: [], joints: {},
    limbs: { torso: body },
    damage: 0, partDamage: { back: 0 },
    legsOk: { L: true, R: true }, backOk: true,
    standing: false, dead: false,
    pulseAt: performance.now() + rand(0, 1500),
    lastPulse: 0,
    stingReadyAt: 0,
    stingFlashUntil: 0,
    drift: rand(-1, 1),
  });
  World.add(engine.world, body);
  return null;
}

// Jelly propulsion
Events.on(engine, 'beforeUpdate', () => {
  const now = performance.now();
  for (const j of dummies.values()) {
    if (j.kind !== 'jelly' || j.dead) continue;
    const body = j.limbs.torso;
    if (now > j.pulseAt) {
      Body.applyForce(body, body.position, { x: j.drift * 0.004 * body.mass, y: -0.014 * body.mass });
      j.lastPulse = now;
      j.pulseAt = now + rand(1300, 2100);
      if (Math.random() < 0.3) j.drift = rand(-1, 1);
    }
  }
});

// Jelly sting on contact
Events.on(engine, 'collisionStart', (e) => {
  const now = performance.now();
  for (const pair of e.pairs) {
    const combos = [[pair.bodyA, pair.bodyB], [pair.bodyB, pair.bodyA]];
    for (const [jb, other] of combos) {
      if (jb.label !== 'flesh' || other.label !== 'flesh') continue;
      const jelly = dummies.get(jb.dummyId);
      if (!jelly || jelly.kind !== 'jelly' || jelly.dead || now < jelly.stingReadyAt) continue;
      const victim = dummies.get(other.dummyId);
      if (!victim || victim === jelly || victim.kind === 'jelly' || victim.dead) continue;
      victim.paralyzedUntil = now + 2400;
      victim.damage += 5;
      victim.partDamage.back = (victim.partDamage.back || 0) + 3;
      jelly.stingReadyAt = now + 1600;
      jelly.stingFlashUntil = now + 350;
      spurt(other.position.x, other.position.y, 2, 0, -1);
      if (victim.damage > (victim.maxDamage || 45)) dismember(victim);
      log('Stung — paralyzed.', 'hint');
    }
  }
});

// Jelly render: translucent pulsing bell + trailing tentacles
Events.on(render, 'afterRender', () => {
  const ctx = render.context;
  const now = performance.now();
  for (const j of dummies.values()) {
    if (j.kind !== 'jelly') continue;
    const body = j.limbs.torso;
    const { x, y } = body.position;
    const dead = j.dead;
    // Bell contracts right after a pulse, relaxes after
    const sincePulse = now - j.lastPulse;
    const squish = dead ? 0.7 : 1 - 0.25 * Math.exp(-sincePulse / 300);
    const r = 16;

    // Tentacles
    ctx.lineCap = 'round';
    for (let t = 0; t < 6; t++) {
      const ox = -10 + t * 4;
      ctx.beginPath();
      ctx.moveTo(x + ox, y + 6);
      const len = 24 + (t % 3) * 8;
      for (let s = 1; s <= 5; s++) {
        const f = s / 5;
        const wig = dead ? 0 : Math.sin(now / 350 + t * 1.3 + f * 4) * 5 * f;
        ctx.lineTo(x + ox + wig, y + 6 + len * f);
      }
      ctx.strokeStyle = dead ? 'rgba(120,120,130,0.3)' : `rgba(140,210,235,${0.4 - t * 0.04})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    // Bell
    const grad = ctx.createRadialGradient(x, y - 2, 1, x, y, r * 1.3);
    if (dead) {
      grad.addColorStop(0, 'rgba(150,150,160,0.4)');
      grad.addColorStop(1, 'rgba(150,150,160,0.05)');
    } else {
      grad.addColorStop(0, 'rgba(150,230,250,0.55)');
      grad.addColorStop(0.7, 'rgba(110,190,230,0.3)');
      grad.addColorStop(1, 'rgba(110,190,230,0.04)');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * squish, 0, Math.PI, 0);
    ctx.quadraticCurveTo(x + r * 0.5, y + 6, x, y + 5);
    ctx.quadraticCurveTo(x - r * 0.5, y + 6, x - r, y);
    ctx.fill();
    // Rim
    ctx.strokeStyle = dead ? 'rgba(140,140,150,0.4)' : 'rgba(180,240,255,0.6)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * squish, 0, Math.PI, 0);
    ctx.stroke();

    // Sting flash
    if (now < j.stingFlashUntil) {
      const f = (j.stingFlashUntil - now) / 350;
      ctx.beginPath();
      ctx.arc(x, y, r + (1 - f) * 26, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(120,255,255,${0.7 * f})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
});

// ---------- Piranha Swarm ----------
// Six of them at once. Each darts at the nearest living thing and nibbles
// chunks off limb by limb — death by a thousand bites.

function spawnPiranhas(x, y) {
  for (let i = 0; i < 6; i++) spawnPiranha(x + rand(-36, 36), y + rand(-26, 26));
  log('The water churns.', 'hint');
  return null;
}

function spawnPiranha(x, y) {
  const id = nextDummyId++;
  const body = Bodies.circle(x, y, 8, {
    density: 0.0025, frictionAir: 0.03, render: { visible: false },
  });
  body.label = 'flesh'; body.dummyId = id; body.bodyPart = 'back';
  dummies.set(id, {
    kind: 'piranha',
    parts: [body], constraints: [], joints: {},
    limbs: { torso: body },
    damage: 0, partDamage: { back: 0 },
    legsOk: { L: true, R: true }, backOk: true,
    standing: false, dead: false,
    facing: 1,
    biteReadyAt: 0,
    jitterSeed: rand(0, 10),
  });
  World.add(engine.world, body);
}

// Piranha AI
Events.on(engine, 'beforeUpdate', () => {
  const now = performance.now();
  let prey = null;
  for (const pir of dummies.values()) {
    if (pir.kind !== 'piranha' || pir.dead) continue;
    if (!prey) {
      prey = [...dummies.values()].filter(d =>
        (d.kind === 'human' || d.kind === 'duck' || d.kind === 'monster') && !d.dead);
    }
    if (prey.length === 0) return;
    const body = pir.limbs.torso;

    let nearest = null, bestD = Infinity;
    for (const t of prey) {
      const tt = t.limbs.torso;
      const dd = Math.hypot(tt.position.x - body.position.x, tt.position.y - body.position.y);
      if (dd < bestD) { bestD = dd; nearest = t; }
    }
    if (!nearest) continue;

    const dx = nearest.limbs.torso.position.x - body.position.x;
    const dy = nearest.limbs.torso.position.y - body.position.y;
    const d = Math.hypot(dx, dy) || 1;
    const jx = Math.sin(now / 130 + pir.jitterSeed) * 0.0025;
    const jy = Math.cos(now / 110 + pir.jitterSeed * 1.7) * 0.0025;
    Body.applyForce(body, body.position, {
      x: (dx / d) * 0.0055 * body.mass + jx * body.mass,
      y: (dy / d) * 0.0055 * body.mass + jy * body.mass,
    });
    if (Math.abs(body.velocity.x) > 0.4) pir.facing = Math.sign(body.velocity.x);

    // Bite the nearest limb of the target
    if (now > pir.biteReadyAt) {
      let limb = null, ld = Infinity;
      for (const part of nearest.parts) {
        const dd = Math.hypot(part.position.x - body.position.x, part.position.y - body.position.y);
        if (dd < ld) { ld = dd; limb = part; }
      }
      if (limb && ld < 30) {
        const dmg = 3;
        nearest.damage += dmg;
        const bp = limb.bodyPart;
        if (bp && nearest.partDamage[bp] !== undefined) nearest.partDamage[bp] += dmg;
        spurt(limb.position.x, limb.position.y, 3, rand(-1, 1), rand(-1, 0));
        addDecal(limb.position.x, limb.position.y, 2);
        if (bp === 'legL' && nearest.partDamage.legL > 14) breakLeg(nearest, 'L');
        if (bp === 'legR' && nearest.partDamage.legR > 14) breakLeg(nearest, 'R');
        if (bp === 'back' && nearest.partDamage.back > 18) breakBack(nearest);
        if (nearest.damage > (nearest.maxDamage || 45)) dismember(nearest);
        // dart backwards after the bite
        Body.applyForce(body, body.position, { x: -(dx / d) * 0.01 * body.mass, y: rand(-0.008, 0) * body.mass });
        pir.biteReadyAt = now + rand(550, 1100);
      }
    }
  }
});

// Piranha render
Events.on(render, 'afterRender', () => {
  const ctx = render.context;
  const now = performance.now();
  for (const pir of dummies.values()) {
    if (pir.kind !== 'piranha') continue;
    const body = pir.limbs.torso;
    const f = pir.facing;
    const dead = pir.dead;
    ctx.save();
    ctx.translate(body.position.x, body.position.y);
    ctx.scale(f, dead ? -1 : 1);
    // Tail flick
    const flick = dead ? 0 : Math.sin(now / 90 + pir.jitterSeed * 3) * 0.4;
    ctx.fillStyle = dead ? '#5a6068' : '#4a6478';
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.lineTo(-13, -4 + flick * 4);
    ctx.lineTo(-13, 4 + flick * 4);
    ctx.closePath();
    ctx.fill();
    // Body — gray-blue top, red belly
    const grad = ctx.createLinearGradient(0, -7, 0, 7);
    grad.addColorStop(0, dead ? '#666c74' : '#54707f');
    grad.addColorStop(0.6, dead ? '#787e85' : '#8a9aa5');
    grad.addColorStop(1, dead ? '#8a8f95' : '#c05a4a');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Jaw — underbite with teeth
    ctx.fillStyle = dead ? '#777' : '#a04438';
    ctx.beginPath();
    ctx.moveTo(4, 2);
    ctx.quadraticCurveTo(10, 3, 9, 0);
    ctx.lineTo(4, -1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#eee6d4';
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(5 + k * 1.6, 1);
      ctx.lineTo(5.8 + k * 1.6, -1.4);
      ctx.lineTo(6.6 + k * 1.6, 1);
      ctx.closePath();
      ctx.fill();
    }
    // Eye
    ctx.beginPath();
    ctx.arc(3.5, -2.5, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = dead ? '#999' : '#e8d44a';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3.9, -2.5, 0.9, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0a0a';
    ctx.fill();
    ctx.restore();
  }
});

// ---------- Anglerfish ----------
// Lurks, drifts toward prey, then lunges with a wide-open needle-toothed
// jaw. The lure glows brighter the closer it gets to a meal.

function spawnAngler(x, y) {
  const id = nextDummyId++;
  const body = Bodies.rectangle(x, y, 76, 38, {
    density: 0.005, frictionAir: 0.03, render: { visible: false },
  });
  body.label = 'flesh'; body.dummyId = id; body.bodyPart = 'back';
  dummies.set(id, {
    kind: 'angler',
    parts: [body], constraints: [], joints: {},
    limbs: { torso: body },
    damage: 0, partDamage: { back: 0 },
    legsOk: { L: true, R: true }, backOk: true,
    standing: false, dead: false,
    facing: 1,
    lungeReadyAt: 0,
    lungeUntil: 0,
    lureSeed: rand(0, 10),
  });
  World.add(engine.world, body);
  return null;
}

// Angler AI
Events.on(engine, 'beforeUpdate', () => {
  const now = performance.now();
  let targets = null;
  for (const ang of dummies.values()) {
    if (ang.kind !== 'angler' || ang.dead) continue;
    if (!targets) {
      targets = [...dummies.values()].filter(d =>
        (d.kind === 'human' || d.kind === 'duck' || d.kind === 'monster') && !d.dead);
    }
    if (targets.length === 0) return;
    const body = ang.limbs.torso;

    let nearest = null, bestD = Infinity;
    for (const t of targets) {
      const tt = t.limbs.torso;
      const dd = Math.hypot(tt.position.x - body.position.x, tt.position.y - body.position.y);
      if (dd < bestD) { bestD = dd; nearest = t; }
    }
    if (!nearest) continue;

    const dx = nearest.limbs.torso.position.x - body.position.x;
    const dy = nearest.limbs.torso.position.y - body.position.y;
    const d = Math.hypot(dx, dy) || 1;
    if (Math.abs(dx) > 8) ang.facing = Math.sign(dx);

    // Slow stalk
    Body.applyForce(body, body.position, {
      x: (dx / d) * 0.0045 * body.mass,
      y: (dy / d) * 0.0025 * body.mass,
    });

    // Lunge-bite
    if (d < 190 && now > ang.lungeReadyAt) {
      Body.applyForce(body, body.position, {
        x: (dx / d) * 0.075 * body.mass,
        y: (dy / d) * 0.06 * body.mass,
      });
      ang.lungeReadyAt = now + 2400;
      ang.lungeUntil = now + 450;
      log('The angler strikes.', 'hint');
    }
  }
});

// Angler render
Events.on(render, 'afterRender', () => {
  const ctx = render.context;
  const now = performance.now();
  for (const ang of dummies.values()) {
    if (ang.kind !== 'angler') continue;
    const body = ang.limbs.torso;
    const f = ang.facing;
    const dead = ang.dead;
    const lunging = !dead && now < ang.lungeUntil;
    const bx = body.position.x, by = body.position.y;

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(body.angle);
    ctx.scale(f, dead ? -1 : 1);

    // Tail
    ctx.fillStyle = dead ? '#3a4040' : '#15231b';
    ctx.beginPath();
    ctx.moveTo(-34, 0);
    ctx.lineTo(-50, -14);
    ctx.lineTo(-50, 14);
    ctx.closePath();
    ctx.fill();

    // Body — bulbous teardrop
    const grad = ctx.createLinearGradient(0, -22, 0, 22);
    grad.addColorStop(0, dead ? '#454c4c' : '#16241c');
    grad.addColorStop(0.6, dead ? '#565d5d' : '#243428');
    grad.addColorStop(1, dead ? '#666c6c' : '#31453a');
    ctx.fillStyle = grad;
    ctx.strokeStyle = dead ? '#2a3030' : '#0a140e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(-4, 0, 36, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Jaw — gapes wide during a lunge
    const gape = lunging ? 11 : 3.5 + 1.5 * Math.sin(now / 400 + ang.lureSeed);
    ctx.fillStyle = '#0c0604';
    ctx.beginPath();
    ctx.moveTo(14, -gape * 0.5);
    ctx.quadraticCurveTo(34, 0, 14, gape);
    ctx.closePath();
    ctx.fill();
    // Needle teeth
    ctx.fillStyle = '#e8e4d0';
    for (let k = 0; k < 5; k++) {
      const tx = 16 + k * 3.4;
      ctx.beginPath();
      ctx.moveTo(tx, -gape * 0.45);
      ctx.lineTo(tx + 0.9, -gape * 0.45 + gape * 0.55);
      ctx.lineTo(tx + 1.8, -gape * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(tx + 1.2, gape * 0.85);
      ctx.lineTo(tx + 2.1, gape * 0.85 - gape * 0.5);
      ctx.lineTo(tx + 3, gape * 0.85);
      ctx.closePath();
      ctx.fill();
    }

    // Eye — small, mean
    ctx.beginPath();
    ctx.arc(8, -9, 3, 0, Math.PI * 2);
    ctx.fillStyle = dead ? '#888' : '#d8e8a0';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(9, -9, 1.4, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0a06';
    ctx.fill();

    // Lure — stalk arcing forward from the forehead, glowing orb at the tip
    if (!dead) {
      const bob = Math.sin(now / 380 + ang.lureSeed) * 3;
      ctx.strokeStyle = '#31453a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(2, -18);
      ctx.quadraticCurveTo(14, -38, 28, -30 + bob);
      ctx.stroke();
      const pulse = 1 + 0.3 * Math.sin(now / 160 + ang.lureSeed);
      const lureGrad = ctx.createRadialGradient(28, -30 + bob, 0, 28, -30 + bob, 14 * pulse);
      lureGrad.addColorStop(0, 'rgba(210,255,170,0.95)');
      lureGrad.addColorStop(0.3, 'rgba(170,240,120,0.45)');
      lureGrad.addColorStop(1, 'rgba(170,240,120,0)');
      ctx.fillStyle = lureGrad;
      ctx.beginPath();
      ctx.arc(28, -30 + bob, 14 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8ffc8';
      ctx.beginPath();
      ctx.arc(28, -30 + bob, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
});

// ---------- Electric Eel ----------
// Swims in sinuous arcs toward prey. Every few seconds it discharges:
// chain lightning hits up to 3 nearby creatures — damage, knockback,
// and a second and a half of paralysis.

function spawnEel(x, y) {
  const id = nextDummyId++;
  const body = Bodies.rectangle(x, y, 110, 16, {
    density: 0.004, frictionAir: 0.04, render: { visible: false },
  });
  body.label = 'flesh'; body.dummyId = id; body.bodyPart = 'back';
  dummies.set(id, {
    kind: 'eel',
    parts: [body], constraints: [], joints: {},
    limbs: { torso: body },
    damage: 0, partDamage: { back: 0 },
    legsOk: { L: true, R: true }, backOk: true,
    standing: false, dead: false,
    facing: 1,
    swimSeed: rand(0, 10),
    zapNextAt: performance.now() + 2200,
    zapUntil: 0,
    zapVictims: [],
  });
  World.add(engine.world, body);
  return null;
}

// Eel AI + discharge
Events.on(engine, 'beforeUpdate', () => {
  const now = performance.now();
  for (const eel of dummies.values()) {
    if (eel.kind !== 'eel' || eel.dead) continue;
    const body = eel.limbs.torso;
    const targets = [...dummies.values()].filter(d => d !== eel && d.kind !== 'eel' && !d.dead);
    if (targets.length === 0) continue;

    let nearest = null, bestD = Infinity;
    for (const t of targets) {
      const tt = t.limbs.torso;
      const dd = Math.hypot(tt.position.x - body.position.x, tt.position.y - body.position.y);
      if (dd < bestD) { bestD = dd; nearest = t; }
    }
    if (!nearest) continue;

    const dx = nearest.limbs.torso.position.x - body.position.x;
    const dy = nearest.limbs.torso.position.y - body.position.y;
    if (Math.abs(dx) > 10) eel.facing = Math.sign(dx);

    // Sinuous swim toward the target
    Body.applyForce(body, body.position, {
      x: eel.facing * 0.0035 * body.mass,
      y: Math.sin(now / 300 + eel.swimSeed) * 0.0018 * body.mass + Math.sign(dy) * 0.0008 * body.mass,
    });

    // Discharge
    if (bestD < 240 && now >= eel.zapNextAt) {
      const victims = targets
        .map(t => ({ t, d: Math.hypot(t.limbs.torso.position.x - body.position.x, t.limbs.torso.position.y - body.position.y) }))
        .filter(v => v.d < 260)
        .sort((p, q) => p.d - q.d)
        .slice(0, 3);
      eel.zapVictims = victims.map(v => v.t);
      for (const { t } of victims) {
        t.damage += 9;
        t.partDamage.back = (t.partDamage.back || 0) + 6;
        t.paralyzedUntil = now + 1500;
        const tb = t.limbs.torso;
        spurt(tb.position.x, tb.position.y, 4, 0, -1);
        Body.applyForce(tb, tb.position, { x: rand(-0.02, 0.02) * tb.mass, y: -0.02 * tb.mass });
        if (t.partDamage.back > 18 && t.backOk) breakBack(t);
        if (t.damage > (t.maxDamage || 45)) dismember(t);
      }
      eel.zapUntil = now + 420;
      eel.zapNextAt = now + 3400;
      log('Discharge.', 'hint');
    }
  }
});

// Eel render: wavy ribbon body + chain lightning
Events.on(render, 'afterRender', () => {
  const ctx = render.context;
  const now = performance.now();
  for (const eel of dummies.values()) {
    if (eel.kind !== 'eel') continue;
    const body = eel.limbs.torso;
    const dead = eel.dead;
    const bx = body.position.x, by = body.position.y;
    const zapping = !dead && now < eel.zapUntil;

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(body.angle);
    ctx.scale(eel.facing, 1);

    // Ribbon body — series of points along a sine wave, head at +x
    const segs = 11, len = 100;
    const pts = [];
    for (let i = 0; i < segs; i++) {
      const fr = i / (segs - 1);
      pts.push({
        x: -len / 2 + len * fr,
        y: dead ? 0 : Math.sin(now / 180 + i * 0.7 + eel.swimSeed) * 6 * (1 - fr * 0.5),
      });
    }
    // Main body stroke (tapers toward tail)
    for (let i = 0; i < segs - 1; i++) {
      const w = 4 + (i / segs) * 10;
      ctx.strokeStyle = dead ? '#5c6258' : (zapping ? '#8aa83a' : '#5a6b2a');
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
      ctx.stroke();
    }
    // Belly stripe
    ctx.strokeStyle = dead ? 'rgba(180,180,170,0.4)' : 'rgba(201,217,106,0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pts[2].x, pts[2].y + 4);
    for (let i = 3; i < segs; i++) ctx.lineTo(pts[i].x, pts[i].y + 4);
    ctx.stroke();
    // Head + eye
    const head = pts[segs - 1];
    ctx.beginPath();
    ctx.arc(head.x, head.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = dead ? '#5c6258' : '#66782f';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(head.x + 3, head.y - 2.5, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = dead ? '#999' : '#f0e8c0';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(head.x + 3.5, head.y - 2.5, 0.9, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0a06';
    ctx.fill();
    ctx.restore();

    // Chain lightning in world space
    if (zapping) {
      const fade = (eel.zapUntil - now) / 420;
      for (const v of eel.zapVictims) {
        if (!v || !v.limbs.torso) continue;
        const tx = v.limbs.torso.position.x, ty = v.limbs.torso.position.y;
        // Jagged bolt: midpoints offset randomly each frame
        const boltSegs = 7;
        const draw = (width, color, alpha) => {
          ctx.save();
          ctx.globalAlpha = alpha * fade;
          ctx.strokeStyle = color;
          ctx.lineWidth = width;
          ctx.lineCap = 'round';
          ctx.shadowColor = '#aef';
          ctx.shadowBlur = width * 3;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          for (let s = 1; s < boltSegs; s++) {
            const f = s / boltSegs;
            const px = bx + (tx - bx) * f + rand(-14, 14) * Math.sin(f * Math.PI);
            const py = by + (ty - by) * f + rand(-14, 14) * Math.sin(f * Math.PI);
            ctx.lineTo(px, py);
          }
          ctx.lineTo(tx, ty);
          ctx.stroke();
          ctx.restore();
        };
        draw(5, 'rgba(120,200,255,0.5)', 0.5);
        draw(1.6, '#eaffff', 0.95);
        // Impact flash at the victim
        const bloomGrad = ctx.createRadialGradient(tx, ty, 0, tx, ty, 18 * fade);
        bloomGrad.addColorStop(0, `rgba(200,240,255,${0.8 * fade})`);
        bloomGrad.addColorStop(1, 'rgba(120,200,255,0)');
        ctx.fillStyle = bloomGrad;
        ctx.beginPath();
        ctx.arc(tx, ty, 18 * fade, 0, Math.PI * 2);
        ctx.fill();
      }
      // Crackle halo around the eel itself
      const halo = ctx.createRadialGradient(bx, by, 0, bx, by, 60 * fade);
      halo.addColorStop(0, `rgba(160,220,255,${0.35 * fade})`);
      halo.addColorStop(1, 'rgba(160,220,255,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(bx, by, 60 * fade, 0, Math.PI * 2);
      ctx.fill();
    }
  }
});

// ---------- Depth Charge ----------
// Sinks (it's denser than the buoyancy cutoff), arms with a blinking light,
// and detonates on the seafloor — or after 4.5s, whichever comes first.

const charges = [];

function spawnCharge(x, y) {
  const c = Bodies.rectangle(x, y, 24, 38, {
    density: 0.035, friction: 0.6, frictionAir: 0.01,
    render: { fillStyle: '#46525e', strokeStyle: '#222a32', lineWidth: 2 },
    label: 'charge',
  });
  c.chargeBorn = performance.now();
  charges.push(c);
  log('Depth charge away.', 'hint');
  return c;
}

Events.on(engine, 'beforeUpdate', () => {
  if (charges.length === 0) return;
  const now = performance.now();
  const worldBodies = Composite.allBodies(engine.world);
  for (let i = charges.length - 1; i >= 0; i--) {
    const c = charges[i];
    if (!worldBodies.includes(c)) { charges.splice(i, 1); continue; }
    const onFloor = c.position.y > H - 60 && Math.abs(c.velocity.y) < 0.8;
    if (onFloor || now - c.chargeBorn > 4500) {
      boom(c.position.x, c.position.y, 300, 0.26);
      flash(c.position.x, c.position.y);
      for (let k = 0; k < 36; k++) {
        spawnBubble(c.position.x + rand(-50, 50), c.position.y + rand(-40, 20), rand(1.5, 4.5));
      }
      Composite.remove(engine.world, c);
      charges.splice(i, 1);
    }
  }
});

// Blinking arming light on each charge
Events.on(render, 'afterRender', () => {
  if (charges.length === 0) return;
  const ctx = render.context;
  const now = performance.now();
  const blink = Math.sin(now / 130) > 0;
  if (!blink) return;
  for (const c of charges) {
    const cos = Math.cos(c.angle), sin = Math.sin(c.angle);
    const lx = c.position.x + 0 * cos - (-21) * sin;
    const ly = c.position.y + 0 * sin + (-21) * cos;
    const grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, 8);
    grad.addColorStop(0, 'rgba(255,80,60,0.9)');
    grad.addColorStop(1, 'rgba(255,80,60,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(lx, ly, 8, 0, Math.PI * 2);
    ctx.fill();
  }
});

// ---------- Harpoon Volley ----------
// 2.4 seconds of heavy steel bolts streaking in from the left and right
// edges. Drag slows them mid-water and they sink as they lose speed.

function harpoonVolley() {
  const duration = 2400, interval = 240;
  const start = performance.now();
  log('Harpoons inbound.', 'hint');
  const fire = () => {
    if (state.world !== 'abyss') return;
    if (performance.now() - start > duration) return;
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft ? -16 : W + 16;
    const y = rand(H * 0.15, H * 0.85);
    const h = Bodies.rectangle(x, y, 40, 5, {
      density: 0.05, frictionAir: 0,
      render: { fillStyle: '#b7c0c8', strokeStyle: '#57616b', lineWidth: 1 },
      label: 'bullet',
    });
    Body.setVelocity(h, { x: (fromLeft ? 1 : -1) * 19, y: rand(-0.6, 0.6) });
    World.add(engine.world, h);
    spawnBubble(x + (fromLeft ? 20 : -20), y, 2.5);
    setTimeout(() => {
      if (Composite.allBodies(engine.world).includes(h)) Composite.remove(engine.world, h);
    }, 3000);
    setTimeout(fire, interval);
  };
  fire();
}

// ---------- Whirlpool ----------
// Mid-water vortex — the tornado's drowned cousin. Pulls everything into
// a spinning orbit and drifts across the stage.

const whirlpools = [];

function spawnWhirlpool() {
  whirlpools.push({
    x: rand(W * 0.25, W * 0.75),
    y: rand(H * 0.3, H * 0.6),
    born: performance.now(),
    life: 5200,
    driftDir: Math.random() < 0.5 ? 1 : -1,
  });
  log('Whirlpool opening.', 'hint');
}

Events.on(engine, 'beforeUpdate', () => {
  if (whirlpools.length === 0) return;
  const now = performance.now();
  for (let i = whirlpools.length - 1; i >= 0; i--) {
    const wp = whirlpools[i];
    const age = (now - wp.born) / wp.life;
    if (age > 1) { whirlpools.splice(i, 1); continue; }
    const cx = wp.x + Math.sin(age * Math.PI * 2) * 50 * wp.driftDir;
    const R = 250;
    for (const body of Composite.allBodies(engine.world)) {
      if (body.isStatic) continue;
      const dx = body.position.x - cx, dy = body.position.y - wp.y;
      const dist = Math.hypot(dx, dy);
      if (dist > R || dist < 1) continue;
      const str = 1 - dist / R;
      const tx = -dy / dist, ty = dx / dist;
      Body.applyForce(body, body.position, {
        x: (tx * 0.0065 + (-dx / dist) * 0.0035) * body.mass * str,
        y: (ty * 0.0065 + (-dy / dist) * 0.0035) * body.mass * str,
      });
    }
    if (Math.random() < 0.4) {
      spawnBubble(cx + rand(-R * 0.5, R * 0.5), wp.y + rand(-R * 0.4, R * 0.4), rand(1, 3));
    }
  }
});

Events.on(render, 'afterRender', () => {
  if (whirlpools.length === 0) return;
  const ctx = render.context;
  const now = performance.now();
  for (const wp of whirlpools) {
    const age = (now - wp.born) / wp.life;
    const alpha = age < 0.85 ? 1 : 1 - (age - 0.85) / 0.15;
    const cx = wp.x + Math.sin(age * Math.PI * 2) * 50 * wp.driftDir;
    // Dark heart
    const heart = ctx.createRadialGradient(cx, wp.y, 0, cx, wp.y, 70);
    heart.addColorStop(0, `rgba(2,10,18,${0.65 * alpha})`);
    heart.addColorStop(1, 'rgba(2,10,18,0)');
    ctx.fillStyle = heart;
    ctx.beginPath();
    ctx.arc(cx, wp.y, 70, 0, Math.PI * 2);
    ctx.fill();
    // Rotating rings — inner rings spin faster
    for (let k = 0; k < 5; k++) {
      const r = 28 + k * 38;
      const spin = (now / (160 + k * 90)) % (Math.PI * 2);
      ctx.strokeStyle = `rgba(140,200,230,${(0.5 - k * 0.08) * alpha})`;
      ctx.lineWidth = 2 - k * 0.25;
      for (let arc = 0; arc < 2; arc++) {
        ctx.beginPath();
        ctx.ellipse(cx, wp.y, r, r * 0.55, 0, spin + arc * Math.PI, spin + arc * Math.PI + 2.1);
        ctx.stroke();
      }
    }
  }
});

// ---------- Kraken ----------
// Three colossal tentacles rise from the seafloor, drag anything nearby
// toward their tips, and periodically slam it all into the bottom.

const krakens = [];

function summonKraken() {
  const now = performance.now();
  const arms = [];
  for (let i = 0; i < 3; i++) {
    arms.push({
      x: W * (0.22 + 0.28 * i) + rand(-50, 50),
      phase: rand(0, Math.PI * 2),
      len: rand(H * 0.45, H * 0.68),
      slamAt: now + 1400 + i * 700,
      slamFlashUntil: 0,
    });
  }
  krakens.push({ born: now, life: 7500, arms });
  log('Something vast stirs below.', 'hint');
}

function armReach(k, arm, now) {
  const t = now - k.born;
  const riseIn = Math.min(1, t / 1000);
  const fadeOut = Math.max(0, Math.min(1, (k.life - t) / 800));
  return arm.len * riseIn * fadeOut;
}

function armTip(k, arm, now) {
  const reach = armReach(k, arm, now);
  return {
    x: arm.x + Math.sin(now / 650 + arm.phase) * 70,
    y: H - reach + Math.sin(now / 420 + arm.phase * 2) * 18,
    reach,
  };
}

Events.on(engine, 'beforeUpdate', () => {
  if (krakens.length === 0) return;
  const now = performance.now();
  for (let i = krakens.length - 1; i >= 0; i--) {
    const k = krakens[i];
    if (now - k.born > k.life) { krakens.splice(i, 1); continue; }
    for (const arm of k.arms) {
      const tip = armTip(k, arm, now);
      if (tip.reach < 40) continue;
      for (const body of Composite.allBodies(engine.world)) {
        if (body.isStatic) continue;
        const dx = tip.x - body.position.x, dy = tip.y - body.position.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 110 && dist > 1) {
          Body.applyForce(body, body.position, {
            x: (dx / dist) * 0.014 * body.mass,
            y: (dy / dist) * 0.014 * body.mass,
          });
        }
      }
      if (now > arm.slamAt) {
        for (const body of Composite.allBodies(engine.world)) {
          if (body.isStatic) continue;
          const dist = Math.hypot(tip.x - body.position.x, tip.y - body.position.y);
          if (dist < 130) Body.setVelocity(body, { x: rand(-5, 5), y: 26 });
        }
        arm.slamFlashUntil = now + 300;
        arm.slamAt = now + rand(1800, 2800);
      }
    }
  }
});

Events.on(render, 'afterRender', () => {
  if (krakens.length === 0) return;
  const ctx = render.context;
  const now = performance.now();
  for (const k of krakens) {
    for (const arm of k.arms) {
      const tip = armTip(k, arm, now);
      if (tip.reach < 5) continue;
      const baseX = arm.x, baseY = H + 20;

      // Tentacle: chain of segments, tapering, with sideways sway
      const segs = 14;
      const pts = [];
      for (let s = 0; s <= segs; s++) {
        const f = s / segs;
        pts.push({
          x: baseX + (tip.x - baseX) * f + Math.sin(now / 500 + arm.phase + f * 4) * 52 * f * (1 - f),
          y: baseY + (tip.y - baseY) * f,
          w: 30 * (1 - f) + 6,
        });
      }
      for (let s = 0; s < segs; s++) {
        ctx.strokeStyle = '#321048';
        ctx.lineWidth = pts[s].w;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(pts[s].x, pts[s].y);
        ctx.lineTo(pts[s + 1].x, pts[s + 1].y);
        ctx.stroke();
      }
      // Suckers along the inner edge
      ctx.fillStyle = '#8a5aaa';
      for (let s = 2; s < segs; s += 2) {
        ctx.beginPath();
        ctx.arc(pts[s].x + pts[s].w * 0.32, pts[s].y, Math.max(1.5, pts[s].w * 0.16), 0, Math.PI * 2);
        ctx.fill();
      }
      // Curled tip
      ctx.fillStyle = '#46186a';
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 7, 0, Math.PI * 2);
      ctx.fill();

      // Slam shockwave
      if (now < arm.slamFlashUntil) {
        const f = (arm.slamFlashUntil - now) / 300;
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, 40 + (1 - f) * 90, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(180,220,250,${0.6 * f})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Silt cloud where the arm breaks the floor
      const silt = ctx.createRadialGradient(baseX, H, 8, baseX, H, 60);
      silt.addColorStop(0, 'rgba(90,80,70,0.4)');
      silt.addColorStop(1, 'rgba(90,80,70,0)');
      ctx.fillStyle = silt;
      ctx.beginPath();
      ctx.arc(baseX, H, 60, 0, Math.PI * 2);
      ctx.fill();
    }
  }
});

// ====================================================================
// ---------- WORLD 3: MARS ----------
// 0.38g, rust skies, and everything that wants an astronaut dead:
// suit breaches, grey aliens with telekinesis, UFO abductions,
// meteor showers, dust storms, and rocketing oxygen tanks.
// ====================================================================

const ufos = [];
const marsStorms = [];
const tanks = [];
const gasPuffs = []; // venting air / thruster exhaust { x, y, vx, vy, r, life }

function spawnGas(x, y, vx, vy, r) {
  gasPuffs.push({ x, y, vx, vy, r, life: rand(20, 45) });
  if (gasPuffs.length > 200) gasPuffs.shift();
}

// ---------- Astronaut ----------
// Mars's resident victim. Same skeleton as the dummy, white EVA suit,
// glass dome helmet. Damage punctures the suit: air vents, and 8 seconds
// later they quietly asphyxiate — no gore, just a slow collapse.

const SUIT_BREACH_AT = 10;   // total damage that punctures the suit
const SUFFOCATE_MS = 8000;

function spawnAstro(x, y) {
  const id = nextDummyId++;
  const group = Body.nextGroup(true);
  const tag = (b, part) => { b.label = 'flesh'; b.dummyId = id; b.bodyPart = part; return b; };

  const suit = '#d8dde2', suitDark = '#aab4bc';
  const head = tag(Bodies.circle(x, y - 60, 15, { collisionFilter: { group }, render: { fillStyle: '#e8ecf0' } }), 'head');
  const torso = tag(Bodies.rectangle(x, y - 20, 26, 60, { collisionFilter: { group }, render: { fillStyle: suit } }), 'back');
  const armL = tag(Bodies.rectangle(x - 22, y - 20, 14, 50, { collisionFilter: { group }, render: { fillStyle: suit } }), 'armL');
  const armR = tag(Bodies.rectangle(x + 22, y - 20, 14, 50, { collisionFilter: { group }, render: { fillStyle: suit } }), 'armR');
  const legL = tag(Bodies.rectangle(x - 8, y + 30, 14, 50, { collisionFilter: { group }, render: { fillStyle: suitDark } }), 'legL');
  const legR = tag(Bodies.rectangle(x + 8, y + 30, 14, 50, { collisionFilter: { group }, render: { fillStyle: suitDark } }), 'legR');

  const parts = [head, torso, armL, armR, legL, legR];
  const joinOpts = { stiffness: 0.9, damping: 0.3, length: 0, render: { visible: false } };
  const joints = {
    neck:      Constraint.create({ bodyA: head, bodyB: torso, pointA: { x: -6, y: 12 }, pointB: { x: -6, y: -28 }, ...joinOpts }),
    neck2:     Constraint.create({ bodyA: head, bodyB: torso, pointA: { x: 6,  y: 12 }, pointB: { x: 6,  y: -28 }, ...joinOpts }),
    shoulderL: Constraint.create({ bodyA: torso, bodyB: armL, pointA: { x: -10, y: -22 }, pointB: { x: 0, y: -20 }, ...joinOpts }),
    shoulderR: Constraint.create({ bodyA: torso, bodyB: armR, pointA: { x: 10, y: -22 }, pointB: { x: 0, y: -20 }, ...joinOpts }),
    hipL:      Constraint.create({ bodyA: torso, bodyB: legL, pointA: { x: -7, y: 28 }, pointB: { x: 0, y: -20 }, ...joinOpts }),
    hipR:      Constraint.create({ bodyA: torso, bodyB: legR, pointA: { x: 7, y: 28 }, pointB: { x: 0, y: -20 }, ...joinOpts }),
  };
  const constraints = Object.values(joints);

  dummies.set(id, {
    kind: 'human',
    isAstro: true,
    suitBreachedAt: 0,
    parts, constraints, joints,
    limbs: { head, torso, armL, armR, legL, legR },
    damage: 0,
    partDamage: { back: 0, legL: 0, legR: 0, neck: 0, armL: 0, armR: 0 },
    legsOk: { L: true, R: true },
    backOk: true,
    standing: true,
    dead: false,
  });
  World.add(engine.world, [...parts, ...constraints]);
  return null;
}

// Suit breach + suffocation
Events.on(engine, 'beforeUpdate', () => {
  const now = performance.now();
  for (const d of dummies.values()) {
    if (!d.isAstro || d.dead) continue;
    if (!d.suitBreachedAt && d.damage > SUIT_BREACH_AT) {
      d.suitBreachedAt = now;
      log('Suit breach — oxygen venting.', 'hint');
    }
    if (d.suitBreachedAt) {
      // Air hisses out of the torso
      if (Math.random() < 0.45) {
        const t = d.limbs.torso;
        spawnGas(t.position.x + rand(-8, 8), t.position.y + rand(-20, 10), rand(-0.6, 0.6), rand(-1.4, -0.5), rand(2, 4));
      }
      if (now - d.suitBreachedAt > SUFFOCATE_MS) {
        d.dead = true;
        d.standing = false;
        for (const p of d.parts) p.render.fillStyle = '#7a8694'; // gone grey
        log('Asphyxiated.', 'solve');
      }
    }
  }
});

// Astronaut helmet + breach light
Events.on(render, 'afterRender', () => {
  const ctx = render.context;
  const now = performance.now();
  for (const d of dummies.values()) {
    if (!d.isAstro) continue;
    const head = d.limbs.head;
    if (!head) continue;
    const { x, y } = head.position;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(head.angle);
    // Glass dome
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.fillStyle = d.dead ? 'rgba(150,160,175,0.25)' : 'rgba(160,200,235,0.18)';
    ctx.fill();
    ctx.strokeStyle = d.dead ? '#7a8694' : '#f0f4f8';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Fogged interior once dead
    if (d.dead && d.isAstro && d.suitBreachedAt) {
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(220,228,235,0.5)';
      ctx.fill();
    }
    // Glint
    ctx.beginPath();
    ctx.arc(-5, -5, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();
    ctx.restore();
    // Blinking red breach warning above the helmet
    if (d.suitBreachedAt && !d.dead && Math.sin(now / 120) > 0) {
      const grad = ctx.createRadialGradient(x, y - 26, 0, x, y - 26, 7);
      grad.addColorStop(0, 'rgba(255,60,40,0.95)');
      grad.addColorStop(1, 'rgba(255,60,40,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y - 26, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
});

// ---------- Grey Alien ----------
// Small ragdoll with a big head. Walks toward the nearest victim and,
// in range, telekinetically lifts them for a second — then hurls them.

function spawnAlien(x, y) {
  const id = nextDummyId++;
  const group = Body.nextGroup(true);
  const tag = (b, part) => { b.label = 'flesh'; b.dummyId = id; b.bodyPart = part; return b; };

  const skin = '#8a9498', skinDark = '#5e686c';
  const head = tag(Bodies.circle(x, y - 44, 15, { collisionFilter: { group }, render: { fillStyle: skin } }), 'head');
  const torso = tag(Bodies.rectangle(x, y - 12, 16, 36, { collisionFilter: { group }, render: { fillStyle: skin } }), 'back');
  const legL = tag(Bodies.rectangle(x - 5, y + 20, 8, 28, { collisionFilter: { group }, render: { fillStyle: skinDark } }), 'legL');
  const legR = tag(Bodies.rectangle(x + 5, y + 20, 8, 28, { collisionFilter: { group }, render: { fillStyle: skinDark } }), 'legR');

  const parts = [head, torso, legL, legR];
  const joinOpts = { stiffness: 0.92, damping: 0.35, length: 0, render: { visible: false } };
  const joints = {
    neck:  Constraint.create({ bodyA: head, bodyB: torso, pointA: { x: -5, y: 12 }, pointB: { x: -5, y: -16 }, ...joinOpts }),
    neck2: Constraint.create({ bodyA: head, bodyB: torso, pointA: { x: 5, y: 12 }, pointB: { x: 5, y: -16 }, ...joinOpts }),
    hipL:  Constraint.create({ bodyA: torso, bodyB: legL, pointA: { x: -4, y: 16 }, pointB: { x: 0, y: -12 }, ...joinOpts }),
    hipR:  Constraint.create({ bodyA: torso, bodyB: legR, pointA: { x: 4, y: 16 }, pointB: { x: 0, y: -12 }, ...joinOpts }),
  };
  const constraints = Object.values(joints);

  dummies.set(id, {
    kind: 'alien',
    parts, constraints, joints,
    limbs: { head, torso, legL, legR },
    damage: 0,
    partDamage: { back: 0, legL: 0, legR: 0, neck: 0, head: 0 },
    legsOk: { L: true, R: true },
    backOk: true,
    standing: true,
    dead: false,
    tkReadyAt: 0,
    tkTarget: null,
    tkUntil: 0,
  });
  World.add(engine.world, [...parts, ...constraints]);
  return null;
}

// Alien AI: approach, then telekinetic lift + hurl
Events.on(engine, 'beforeUpdate', () => {
  const now = performance.now();
  for (const al of dummies.values()) {
    if (al.kind !== 'alien' || al.dead) continue;
    if (al.paralyzedUntil && now < al.paralyzedUntil) continue;
    const torso = al.limbs.torso;

    // Active lift: hold the victim aloft, then hurl at the end
    if (al.tkTarget) {
      const t = al.tkTarget;
      if (t.dead || now > al.tkUntil) {
        if (!t.dead) {
          const dir = Math.sign(t.limbs.torso.position.x - torso.position.x) || 1;
          Body.setVelocity(t.limbs.torso, { x: dir * rand(14, 22), y: -rand(6, 12) });
          log('Hurled.', 'hint');
        }
        al.tkTarget = null;
        al.tkReadyAt = now + rand(2800, 4200);
        continue;
      }
      const tt = t.limbs.torso;
      const hoverY = torso.position.y - 90;
      Body.applyForce(tt, tt.position, {
        x: (torso.position.x - tt.position.x) * 0.00002 * tt.mass,
        y: (-engine.gravity.y * 0.0012 + (hoverY - tt.position.y) * 0.00004) * tt.mass,
      });
      continue;
    }

    if (!al.standing) continue;
    const targets = [...dummies.values()].filter(d =>
      (d.kind === 'human' || d.kind === 'duck' || d.kind === 'monster') && !d.dead);
    if (targets.length === 0) continue;

    let nearest = null, bestD = Infinity;
    for (const t of targets) {
      const tt = t.limbs.torso;
      const dd = Math.hypot(tt.position.x - torso.position.x, tt.position.y - torso.position.y);
      if (dd < bestD) { bestD = dd; nearest = t; }
    }
    if (!nearest) continue;

    const dx = nearest.limbs.torso.position.x - torso.position.x;
    if (bestD > 170) {
      Body.applyForce(torso, torso.position, { x: Math.sign(dx) * 0.006 * torso.mass, y: 0 });
    } else if (now > al.tkReadyAt) {
      al.tkTarget = nearest;
      al.tkUntil = now + 1100;
      log('Telekinetic grip.', 'hint');
    }
  }
});

// Alien render: big black almond eyes + telekinesis aura
Events.on(render, 'afterRender', () => {
  const ctx = render.context;
  const now = performance.now();
  for (const al of dummies.values()) {
    if (al.kind !== 'alien') continue;
    const head = al.limbs.head;
    if (!head) continue;
    const a = head.angle;
    ctx.save();
    ctx.translate(head.position.x, head.position.y);
    ctx.rotate(a);
    // Cranium bulge
    ctx.fillStyle = al.dead ? '#666e70' : '#8a9498';
    ctx.beginPath();
    ctx.ellipse(0, -4, 14, 11, 0, Math.PI, 0);
    ctx.fill();
    // Almond eyes
    ctx.fillStyle = '#0a0c0e';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * 7, 0, 5.5, 3, s * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!al.dead) {
      ctx.fillStyle = 'rgba(190,210,230,0.7)';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(s * 6, -1, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Telekinesis aura: pulsing rings around alien head + victim
    if (al.tkTarget && !al.dead) {
      const t = al.tkTarget.limbs.torso;
      for (const [px, py] of [[head.position.x, head.position.y], [t.position.x, t.position.y]]) {
        for (let k = 0; k < 2; k++) {
          const ph = ((now / 500 + k * 0.5) % 1);
          ctx.beginPath();
          ctx.arc(px, py, 12 + ph * 26, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(190,120,255,${0.55 * (1 - ph)})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
      ctx.strokeStyle = 'rgba(190,120,255,0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(head.position.x, head.position.y);
      ctx.lineTo(t.position.x, t.position.y);
      ctx.stroke();
    }
  }
});

// ---------- Oxygen Tank ----------
// Pressurized canister. Puncture it (hard hit or bullet) and it becomes an
// unguided rocket for 2.5 seconds, then explodes.

function spawnTank(x, y) {
  const t = Bodies.rectangle(x, y, 20, 44, {
    density: 0.008, friction: 0.4,
    render: { fillStyle: '#e8ecf0', strokeStyle: '#8a949c', lineWidth: 2 },
    label: 'tank',
  });
  t.tankData = { punctured: 0, thrustUntil: 0 };
  tanks.push(t);
  return t;
}

// Puncture on hard impact
Events.on(engine, 'collisionStart', (e) => {
  const now = performance.now();
  for (const pair of e.pairs) {
    for (const [t, other] of [[pair.bodyA, pair.bodyB], [pair.bodyB, pair.bodyA]]) {
      if (t.label !== 'tank' || !t.tankData || t.tankData.punctured) continue;
      const speed = Math.hypot(t.velocity.x - other.velocity.x, t.velocity.y - other.velocity.y);
      if (speed > 8 || other.label === 'bullet' || other.label === 'meteor') {
        t.tankData.punctured = now;
        t.tankData.thrustUntil = now + 2500;
        log('Tank punctured — thrust unstable.', 'hint');
      }
    }
  }
});

// Tank thrust + detonation
Events.on(engine, 'beforeUpdate', () => {
  if (tanks.length === 0) return;
  const now = performance.now();
  const worldBodies = Composite.allBodies(engine.world);
  for (let i = tanks.length - 1; i >= 0; i--) {
    const t = tanks[i];
    if (!worldBodies.includes(t)) { tanks.splice(i, 1); continue; }
    if (!t.tankData.punctured) continue;
    if (now < t.tankData.thrustUntil) {
      // Thrust out of the nozzle (top of the canister, along its axis)
      const ax = Math.sin(t.angle), ay = -Math.cos(t.angle);
      Body.applyForce(t, t.position, { x: ax * 0.012 * t.mass, y: ay * 0.012 * t.mass });
      Body.setAngularVelocity(t, t.angularVelocity + rand(-0.04, 0.04));
      const nx = t.position.x - ax * 24, ny = t.position.y - ay * 24;
      spawnGas(nx, ny, -ax * 2 + rand(-0.5, 0.5), -ay * 2 + rand(-0.5, 0.5), rand(2.5, 4.5));
    } else {
      boom(t.position.x, t.position.y, 170, 0.15);
      flash(t.position.x, t.position.y);
      Composite.remove(engine.world, t);
      tanks.splice(i, 1);
    }
  }
});

// ---------- Meteor Shower ----------
// 3 seconds of flaming rocks streaking in from the top. Each explodes on
// first contact, leaving a scorch mark.

function meteorShower() {
  const duration = 3000, interval = 300;
  const start = performance.now();
  log('Meteor shower incoming.', 'hint');
  const drop = () => {
    if (state.world !== 'mars') return;
    if (performance.now() - start > duration) return;
    const m = Bodies.circle(rand(W * 0.05, W * 0.95), -30, rand(9, 15), {
      density: 0.04,
      render: { fillStyle: '#6a4a3a', strokeStyle: '#3a2418', lineWidth: 2 },
      label: 'meteor',
    });
    Body.setVelocity(m, { x: rand(-6, 6), y: rand(13, 19) });
    World.add(engine.world, m);
    setTimeout(() => {
      if (Composite.allBodies(engine.world).includes(m)) Composite.remove(engine.world, m);
    }, 6000);
    setTimeout(drop, interval);
  };
  drop();
}

// Meteors explode on first contact
Events.on(engine, 'collisionStart', (e) => {
  for (const pair of e.pairs) {
    for (const m of [pair.bodyA, pair.bodyB]) {
      if (m.label !== 'meteor') continue;
      const mx = m.position.x, my = m.position.y;
      boom(mx, my, 130, 0.11);
      flash(mx, my);
      // Scorch mark
      for (let k = 0; k < 4; k++) {
        decals.push({ x: mx + rand(-12, 12), y: my + rand(-6, 10), r: rand(5, 12), color: '#2a1a10', alpha: 0.6 });
      }
      Composite.remove(engine.world, m);
    }
  }
});

// Meteor fire trails
Events.on(render, 'afterRender', () => {
  const ctx = render.context;
  for (const m of Composite.allBodies(engine.world)) {
    if (m.label !== 'meteor') continue;
    const v = Math.hypot(m.velocity.x, m.velocity.y);
    if (v < 2) continue;
    const tx = m.position.x - (m.velocity.x / v) * 55;
    const ty = m.position.y - (m.velocity.y / v) * 55;
    const grad = ctx.createLinearGradient(m.position.x, m.position.y, tx, ty);
    grad.addColorStop(0, 'rgba(255,180,60,0.8)');
    grad.addColorStop(0.5, 'rgba(230,90,30,0.35)');
    grad.addColorStop(1, 'rgba(200,60,20,0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = m.circleRadius * 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(m.position.x, m.position.y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
  }
});

// ---------- Dust Storm ----------
// Screen-wide lateral wind for 6 seconds. Knocks ragdolls over, carries
// crates, and drops visibility behind a rust haze.

function spawnDustStorm() {
  marsStorms.push({
    born: performance.now(),
    life: 6000,
    dir: Math.random() < 0.5 ? 1 : -1,
    streaks: Array.from({ length: 70 }, () => ({
      x: Math.random() * 1.2 - 0.1, y: Math.random(),
      len: rand(20, 70), speed: rand(0.012, 0.03),
    })),
  });
  log('Dust storm rolling in.', 'hint');
}

Events.on(engine, 'beforeUpdate', () => {
  if (marsStorms.length === 0) return;
  const now = performance.now();
  for (let i = marsStorms.length - 1; i >= 0; i--) {
    const s = marsStorms[i];
    const age = (now - s.born) / s.life;
    if (age > 1) { marsStorms.splice(i, 1); continue; }
    const ramp = Math.min(1, age * 4) * Math.min(1, (1 - age) * 4); // ease in/out
    for (const body of Composite.allBodies(engine.world)) {
      if (body.isStatic || frozenIds.has(body.id)) continue;
      Body.applyForce(body, body.position, {
        x: s.dir * 0.0022 * body.mass * ramp,
        y: Math.sin(now / 180 + body.id) * 0.0006 * body.mass * ramp,
      });
    }
  }
});

Events.on(render, 'afterRender', () => {
  if (marsStorms.length === 0) return;
  const ctx = render.context;
  const now = performance.now();
  for (const s of marsStorms) {
    const age = (now - s.born) / s.life;
    const ramp = Math.min(1, age * 4) * Math.min(1, (1 - age) * 4);
    // Haze
    ctx.fillStyle = `rgba(160,80,40,${0.16 * ramp})`;
    ctx.fillRect(0, 0, W, H);
    // Wind streaks
    ctx.strokeStyle = `rgba(220,150,100,${0.35 * ramp})`;
    ctx.lineWidth = 1.5;
    for (const st of s.streaks) {
      st.x += s.dir * st.speed;
      if (s.dir > 0 && st.x > 1.1) st.x = -0.1;
      if (s.dir < 0 && st.x < -0.1) st.x = 1.1;
      const sx = st.x * W, sy = st.y * H;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - s.dir * st.len, sy + Math.sin(now / 300 + st.y * 9) * 4);
      ctx.stroke();
    }
  }
});

// ---------- UFO Abduction ----------
// A saucer sweeps across the sky with a tractor beam. Anything caught in
// the cone floats upward; anything that reaches the hull is taken.

function summonUFO() {
  const dir = Math.random() < 0.5 ? 1 : -1;
  ufos.push({
    x: dir > 0 ? -80 : W + 80,
    y: H * 0.13,
    dir,
    born: performance.now(),
    life: 9500,
    taken: 0,
  });
  log('They’re here.', 'hint');
}

Events.on(engine, 'beforeUpdate', () => {
  if (ufos.length === 0) return;
  const now = performance.now();
  for (let i = ufos.length - 1; i >= 0; i--) {
    const u = ufos[i];
    const age = now - u.born;
    if (age > u.life || u.x < -120 || u.x > W + 120) {
      if (age > 600) { ufos.splice(i, 1); continue; }
    }
    // Sweep, slowing over the middle of the stage
    const mid = Math.abs(u.x - W / 2) / (W / 2);
    u.x += u.dir * (0.6 + 1.8 * mid);

    // Tractor beam: cone from the saucer down to the floor
    const beamHalfTop = 26, beamHalfBot = 95;
    for (const body of Composite.allBodies(engine.world)) {
      if (body.isStatic || frozenIds.has(body.id)) continue;
      if (body.position.y < u.y) continue;
      const fr = (body.position.y - u.y) / (H - u.y);
      const half = beamHalfTop + (beamHalfBot - beamHalfTop) * fr;
      if (Math.abs(body.position.x - u.x) > half) continue;
      // Lift + center
      Body.applyForce(body, body.position, {
        x: (u.x - body.position.x) * 0.00003 * body.mass,
        y: -engine.gravity.y * 0.0013 * body.mass,
      });
      // Taken
      if (body.position.y < u.y + 40) {
        if (body.label === 'flesh') {
          const d = dummies.get(body.dummyId);
          if (d && !d.dead) {
            d.dead = true;
            for (const c of d.constraints) Composite.remove(engine.world, c);
            d.constraints = [];
            log('Abducted.', 'solve');
          }
        }
        Composite.remove(engine.world, body);
        u.taken += 1;
      }
    }
  }
});

Events.on(render, 'afterRender', () => {
  if (ufos.length === 0) return;
  const ctx = render.context;
  const now = performance.now();
  for (const u of ufos) {
    // Beam
    const flicker = 0.75 + 0.25 * Math.sin(now / 90);
    const beam = ctx.createLinearGradient(u.x, u.y, u.x, H);
    beam.addColorStop(0, `rgba(120,255,160,${0.28 * flicker})`);
    beam.addColorStop(1, 'rgba(120,255,160,0.03)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(u.x - 26, u.y + 10);
    ctx.lineTo(u.x + 26, u.y + 10);
    ctx.lineTo(u.x + 95, H);
    ctx.lineTo(u.x - 95, H);
    ctx.closePath();
    ctx.fill();

    // Saucer
    ctx.save();
    ctx.translate(u.x, u.y);
    // Hull
    ctx.fillStyle = '#9aa6b2';
    ctx.strokeStyle = '#4a545e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 55, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Dome
    ctx.fillStyle = 'rgba(150,220,190,0.55)';
    ctx.beginPath();
    ctx.ellipse(0, -10, 22, 14, 0, Math.PI, 0);
    ctx.fill();
    // Running lights
    for (let k = 0; k < 5; k++) {
      const lx = -40 + k * 20;
      const on = Math.floor(now / 200 + k) % 5 === 0;
      ctx.beginPath();
      ctx.arc(lx, 5, 3, 0, Math.PI * 2);
      ctx.fillStyle = on ? '#aef2c0' : '#3a4a44';
      ctx.fill();
    }
    ctx.restore();
  }
});

// ---------- Mars ambience: butterscotch sky, twin moons, drifting dust ----------

const marsDust = Array.from({ length: 36 }, () => ({
  x: Math.random(), y: Math.random(), r: rand(0.5, 1.6), v: rand(0.00008, 0.00028),
}));

Events.on(render, 'afterRender', () => {
  if (state.world !== 'mars') return;
  const ctx = render.context;
  const now = performance.now();

  // Horizon glow
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, 'rgba(0,0,0,0)');
  sky.addColorStop(0.75, 'rgba(190,100,50,0.05)');
  sky.addColorStop(1, 'rgba(210,120,60,0.13)');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Phobos + Deimos, creeping across the sky
  const moons = [
    { fr: (now / 240000) % 1.2 - 0.1, y: H * 0.12, r: 9, c: '#b8aa9a' },
    { fr: (now / 410000 + 0.45) % 1.2 - 0.1, y: H * 0.2, r: 5, c: '#9a8e80' },
  ];
  for (const m of moons) {
    ctx.beginPath();
    ctx.arc(m.fr * W, m.y, m.r, 0, Math.PI * 2);
    ctx.fillStyle = m.c;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(m.fr * W - m.r * 0.3, m.y + m.r * 0.2, m.r * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();
  }

  // Drifting dust motes
  ctx.fillStyle = 'rgba(220,160,110,0.18)';
  for (const m of marsDust) {
    m.x += m.v;
    if (m.x > 1) m.x = 0;
    ctx.beginPath();
    ctx.arc(m.x * W, m.y * H, m.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Gas puffs (suit breaches + tank thrust) — white, expanding, fading
  for (let i = gasPuffs.length - 1; i >= 0; i--) {
    const g = gasPuffs[i];
    g.x += g.vx; g.y += g.vy;
    g.r += 0.12;
    g.life -= 1;
    if (g.life <= 0) { gasPuffs.splice(i, 1); continue; }
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(235,242,248,${Math.min(0.5, g.life / 60)})`;
    ctx.fill();
  }
});

// ---------- Mobile: tool-drawer toggle ----------
// Hiding the drawer changes the stage size, so rebuild walls after reflow.

document.getElementById('panel-toggle').addEventListener('click', () => {
  document.body.classList.toggle('panel-hidden');
  requestAnimationFrame(() => rebuildWalls());
});

// ---------- WORLD 4: THE YARD ----------
// Bug-scale front lawn at dusk. Towering grass, pollen, fireflies — and
// everything suburbia throws at an insect: dog poop, ant columns, garden
// spiders, cordyceps spores, a kid's magnifying glass, a fire-breathing
// lizard the size of a kaiju, and the lawnmower.
// ====================================================================

const mowers = [];
const sprinklers = [];
const sunbeams = [];
const spores = [];      // cordyceps spores seeking a host { x, y, wob, life }
const flames = [];      // fire particles { x, y, vx, vy, r, life, srcId }
const smokes = [];      // grey puffs { x, y, vx, vy, r, life }
const grassBits = [];   // mower clippings { x, y, vx, vy, life }
const waterDrops = [];  // sprinkler spray { x, y, vx, vy, life }
const webs = [];        // spider silk { sid, tid, until }
const poops = [];       // poop bodies (stickiness + fly orbits)

const CHAR_COLORS = ['#241c14', '#181410', '#2e241a'];

function spawnSmoke(x, y, r) {
  smokes.push({ x, y, vx: rand(-0.3, 0.3), vy: -rand(0.5, 1.1), r, life: rand(30, 60) });
  if (smokes.length > 160) smokes.shift();
}

// ---------- Burning ----------
// Shared by the magnifying glass and the lizard's breath. Burning bodies
// take damage over time, char, smoke, and shed flames that can spread to
// anything flammable they touch.

function igniteDummy(d, ms = 3200) {
  if (!d || d.dead || d.kind === 'lizard') return;
  const now = performance.now();
  if (!d.burningUntil || d.burningUntil < now) d.burnTickAt = now;
  d.burningUntil = Math.max(d.burningUntil || 0, now + ms);
}

Events.on(engine, 'beforeUpdate', () => {
  const now = performance.now();
  for (const [id, d] of dummies) {
    if (!d.burningUntil || now > d.burningUntil || d.dead) continue;
    // Shed flames from random limbs — these can spread to neighbours
    if (Math.random() < 0.5) {
      const p = pick(d.parts);
      flames.push({
        x: p.position.x + rand(-6, 6), y: p.position.y + rand(-8, 4),
        vx: rand(-0.4, 0.4), vy: -rand(0.8, 1.8),
        r: rand(3, 6), life: rand(18, 32), srcId: id,
      });
    }
    if (Math.random() < 0.2) spawnSmoke(d.limbs.torso.position.x, d.limbs.torso.position.y - 14, rand(3, 5));
    if (now > d.burnTickAt) {
      d.burnTickAt = now + 420;
      const limb = pick(d.parts);
      const dmg = 3;
      d.damage += dmg;
      const bp = limb.bodyPart;
      if (bp && d.partDamage[bp] !== undefined) d.partDamage[bp] += dmg;
      limb.render.fillStyle = pick(CHAR_COLORS);
      if (bp === 'legL' && d.partDamage.legL > 14) breakLeg(d, 'L');
      if (bp === 'legR' && d.partDamage.legR > 14) breakLeg(d, 'R');
      if (bp === 'back' && d.partDamage.back > 18) breakBack(d);
      if (d.damage > (d.maxDamage || 45)) dismember(d);
    }
  }

  // Flame particles: drift, rise, and ignite flesh they touch
  const fleshBodies = flames.length
    ? Composite.allBodies(engine.world).filter(b => b.label === 'flesh')
    : [];
  for (let i = flames.length - 1; i >= 0; i--) {
    const f = flames[i];
    f.x += f.vx; f.y += f.vy;
    f.vy -= 0.03;
    f.r *= 0.97;
    f.life -= 1;
    if (f.life <= 0 || f.r < 1) { flames.splice(i, 1); continue; }
    for (const body of fleshBodies) {
      if (body.dummyId === f.srcId) continue;
      const dd = Math.hypot(body.position.x - f.x, body.position.y - f.y);
      if (dd < f.r + 12) {
        const d = dummies.get(body.dummyId);
        if (d && !d.dead && (!d.burningUntil || now > d.burningUntil)) {
          igniteDummy(d, 3200);
          if (d.kind !== 'lizard') log('Caught fire.', 'hint');
        }
      }
    }
  }
  if (flames.length > 170) flames.splice(0, flames.length - 170);
});

// ---------- Ladybug ----------
// The Yard's resident victim. Wide chamfered shell, side-mounted head,
// stubby legs. kind 'human' so every existing predator AI hunts it.

function spawnBug(x, y) {
  const id = nextDummyId++;
  const group = Body.nextGroup(true);
  const tag = (b, part) => { b.label = 'flesh'; b.dummyId = id; b.bodyPart = part; return b; };

  // Density bumped: limbs this small explode the constraint solver at
  // default density when something heavy slams them.
  const shell = '#c23b2a', chitin = '#15161a';
  const bugOpts = { collisionFilter: { group }, density: 0.0016 };
  const head = tag(Bodies.circle(x - 19, y - 4, 9, { ...bugOpts, render: { fillStyle: chitin } }), 'head');
  const torso = tag(Bodies.rectangle(x, y - 4, 34, 20, { chamfer: { radius: 9 }, ...bugOpts, render: { fillStyle: shell } }), 'back');
  const legL = tag(Bodies.rectangle(x - 8, y + 12, 7, 16, { ...bugOpts, render: { fillStyle: chitin } }), 'legL');
  const legR = tag(Bodies.rectangle(x + 8, y + 12, 7, 16, { ...bugOpts, render: { fillStyle: chitin } }), 'legR');

  // The posture controller's torque scales with mass but stability scales
  // with inertia — parts this small spin up unstably unless inertia is
  // raised to the same envelope as the standard dummy's limbs.
  Body.setInertia(head, 50);
  Body.setInertia(legL, 45);
  Body.setInertia(legR, 45);

  const parts = [head, torso, legL, legR];
  const joinOpts = { stiffness: 0.8, damping: 0.35, length: 0, render: { visible: false } };
  // Legs get paired constraints (quasi-welded): the generic leg-posture
  // torque is unstable on limbs this stubby, so the bug opts out of the
  // standard posture system and keeps itself upright with its own handler.
  const joints = {
    neck:  Constraint.create({ bodyA: head, bodyB: torso, pointA: { x: 6, y: -4 }, pointB: { x: -15, y: -4 }, ...joinOpts }),
    neck2: Constraint.create({ bodyA: head, bodyB: torso, pointA: { x: 6, y: 4 },  pointB: { x: -15, y: 4 },  ...joinOpts }),
    hipL:  Constraint.create({ bodyA: torso, bodyB: legL, pointA: { x: -11, y: 8 }, pointB: { x: -3, y: -7 }, ...joinOpts }),
    hipL2: Constraint.create({ bodyA: torso, bodyB: legL, pointA: { x: -5, y: 8 },  pointB: { x: 3, y: -7 }, ...joinOpts }),
    hipR:  Constraint.create({ bodyA: torso, bodyB: legR, pointA: { x: 5, y: 8 },   pointB: { x: -3, y: -7 }, ...joinOpts }),
    hipR2: Constraint.create({ bodyA: torso, bodyB: legR, pointA: { x: 11, y: 8 },  pointB: { x: 3, y: -7 }, ...joinOpts }),
  };
  const constraints = Object.values(joints);

  dummies.set(id, {
    kind: 'human',
    isBug: true,
    parts, constraints, joints,
    limbs: { head, torso, legL, legR },
    damage: 0,
    partDamage: { back: 0, legL: 0, legR: 0, neck: 0, head: 0 },
    legsOk: { L: true, R: true },
    backOk: true,
    standing: false, // opts out of the humanoid posture controller
    dead: false,
  });
  World.add(engine.world, [...parts, ...constraints]);
  return null;
}

// Bug posture: a single gentle upright torque on the torso, tuned for its
// mass/inertia ratio (the shared STAND_K/STAND_D constants overshoot here).
Events.on(engine, 'beforeUpdate', () => {
  const now = performance.now();
  for (const d of dummies.values()) {
    if (!d.isBug || d.dead || !d.backOk || !d.legsOk.L || !d.legsOk.R) continue;
    if (d.paralyzedUntil && now < d.paralyzedUntil) continue;
    uprightTorque(d.limbs.torso, 0.0005, 0.013);
  }
});

// Ladybug render: elytra dome, spots, seam, antennae
Events.on(render, 'afterRender', () => {
  const ctx = render.context;
  const now = performance.now();
  for (const d of dummies.values()) {
    if (!d.isBug) continue;
    const torso = d.limbs.torso, head = d.limbs.head;
    if (torso) {
      ctx.save();
      ctx.translate(torso.position.x, torso.position.y);
      ctx.rotate(torso.angle);
      // Dome
      ctx.beginPath();
      ctx.ellipse(0, -3, 16, 10, 0, Math.PI, 0);
      ctx.fillStyle = d.dead ? 'rgba(90,30,22,0.7)' : 'rgba(160,40,28,0.8)';
      ctx.fill();
      // Seam
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(0, 5);
      ctx.strokeStyle = 'rgba(20,10,8,0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Spots
      ctx.fillStyle = '#15161a';
      for (const [sx, sy] of [[-8, -4], [-3, -9], [5, -8], [10, -2]]) {
        ctx.beginPath();
        ctx.arc(sx, sy, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (head && !d.dead) {
      ctx.save();
      ctx.translate(head.position.x, head.position.y);
      ctx.rotate(head.angle);
      const wig = Math.sin(now / 250 + head.position.x) * 0.18;
      ctx.strokeStyle = '#15161a';
      ctx.lineWidth = 1.4;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(-3, s * 2 - 4);
        ctx.quadraticCurveTo(-10, -8 + s * 2 + wig * 4, -13, -10 + s * 3 + wig * 6);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
});

// ---------- Dog Poop ----------
// Sticky hazard. Anything that wanders close gets bogged down; flesh that
// touches it picks up flies for a while. Mowing it is a mistake.

function spawnPoop(x, y) {
  const p = Bodies.circle(x, y, 16, {
    density: 0.004, friction: 1, frictionStatic: 2, restitution: 0,
    render: { fillStyle: '#5a3a1e', strokeStyle: '#3a2410', lineWidth: 2 },
    label: 'poop',
  });
  p.poopData = { flies: Array.from({ length: 4 }, () => rand(0, Math.PI * 2)) };
  poops.push(p);
  return p;
}

// Stickiness + fly-fouling
Events.on(engine, 'beforeUpdate', () => {
  if (poops.length === 0) return;
  const now = performance.now();
  const worldBodies = Composite.allBodies(engine.world);
  for (let i = poops.length - 1; i >= 0; i--) {
    const p = poops[i];
    if (!worldBodies.includes(p)) { poops.splice(i, 1); continue; }
    for (const body of worldBodies) {
      if (body.isStatic || body === p) continue;
      const dd = Math.hypot(body.position.x - p.position.x, body.position.y - p.position.y);
      if (dd > 38) continue;
      Body.setVelocity(body, { x: body.velocity.x * 0.86, y: body.velocity.y * 0.86 });
      Body.setAngularVelocity(body, body.angularVelocity * 0.9);
      if (body.label === 'flesh') {
        const d = dummies.get(body.dummyId);
        if (d) d.fouledUntil = now + 4000;
      }
    }
  }
});

// Poop render: mound texture, orbiting flies, stink lines
Events.on(render, 'afterRender', () => {
  if (state.world !== 'yard') return;
  const ctx = render.context;
  const now = performance.now();
  const drawFlies = (cx, cy, phases) => {
    ctx.fillStyle = '#1a1c1e';
    for (const ph of phases) {
      const fx = cx + Math.cos(now / 300 + ph) * (16 + Math.sin(now / 700 + ph) * 7);
      const fy = cy - 14 + Math.sin(now / 220 + ph * 2) * 10;
      ctx.beginPath();
      ctx.arc(fx, fy, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  for (const p of poops) {
    const { x, y } = p.position;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.angle);
    // Swirl tip + bumps
    ctx.fillStyle = '#4c3018';
    ctx.beginPath();
    ctx.ellipse(-5, -10, 8, 5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(2, -15, 5, 3.5, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Stink lines
    ctx.strokeStyle = 'rgba(150,170,90,0.35)';
    ctx.lineWidth = 1.3;
    for (const s of [-1, 0, 1]) {
      const rise = (now / 14 + s * 37) % 46;
      ctx.beginPath();
      ctx.moveTo(x + s * 8 + Math.sin(now / 200 + s) * 2, y - 16 - rise);
      ctx.quadraticCurveTo(x + s * 8 + 4, y - 24 - rise, x + s * 8, y - 32 - rise);
      ctx.globalAlpha = 1 - rise / 46;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    drawFlies(x, y, p.poopData.flies);
  }
  // Flies follow fouled creatures
  for (const d of dummies.values()) {
    if (!d.fouledUntil || now > d.fouledUntil || d.dead) continue;
    const t = d.limbs.torso;
    drawFlies(t.position.x, t.position.y, [0.5, 2.6, 4.4]);
  }
});

// ---------- Ant Column ----------
// Six workers. Each marches at the nearest victim and bites the closest
// limb, piranha-style, then backs off for another pass.

function spawnAnts(x, y) {
  for (let i = 0; i < 6; i++) spawnAnt(x + rand(-50, 50), y + rand(-10, 10));
  return null;
}

function spawnAnt(x, y) {
  const id = nextDummyId++;
  const body = Bodies.circle(x, y, 5, {
    density: 0.0015, friction: 0.6, frictionAir: 0.02,
    render: { visible: false },
  });
  body.label = 'flesh'; body.dummyId = id; body.bodyPart = 'back';
  dummies.set(id, {
    kind: 'ant',
    parts: [body], constraints: [], joints: {},
    limbs: { torso: body },
    damage: 0, partDamage: { back: 0 },
    legsOk: { L: false, R: false }, backOk: true,
    standing: false, dead: false,
    facing: 1,
    biteReadyAt: 0,
    gait: rand(0, Math.PI * 2),
  });
  World.add(engine.world, body);
  return null;
}

// Ant AI: march, bite, back off
Events.on(engine, 'beforeUpdate', () => {
  const now = performance.now();
  let prey = null;
  for (const ant of dummies.values()) {
    if (ant.kind !== 'ant' || ant.dead) continue;
    if (ant.paralyzedUntil && now < ant.paralyzedUntil) continue;
    if (!prey) {
      prey = [...dummies.values()].filter(d =>
        (d.kind === 'human' || d.kind === 'duck' || d.kind === 'monster') && !d.dead);
    }
    if (prey.length === 0) return;
    const body = ant.limbs.torso;

    let nearest = null, bestD = Infinity;
    for (const t of prey) {
      const tt = t.limbs.torso;
      const dd = Math.hypot(tt.position.x - body.position.x, tt.position.y - body.position.y);
      if (dd < bestD) { bestD = dd; nearest = t; }
    }
    if (!nearest) continue;

    const dx = nearest.limbs.torso.position.x - body.position.x;
    if (Math.abs(dx) > 4) ant.facing = Math.sign(dx);
    Body.applyForce(body, body.position, { x: ant.facing * 0.0045 * body.mass, y: -0.0004 * body.mass });

    if (now > ant.biteReadyAt) {
      let limb = null, ld = Infinity;
      for (const part of nearest.parts) {
        const dd = Math.hypot(part.position.x - body.position.x, part.position.y - body.position.y);
        if (dd < ld) { ld = dd; limb = part; }
      }
      if (limb && ld < 24) {
        const dmg = 2.5;
        nearest.damage += dmg;
        const bp = limb.bodyPart;
        if (bp && nearest.partDamage[bp] !== undefined) nearest.partDamage[bp] += dmg;
        spurt(limb.position.x, limb.position.y, 2, rand(-1, 1), rand(-1, 0));
        if (bp === 'legL' && nearest.partDamage.legL > 14) breakLeg(nearest, 'L');
        if (bp === 'legR' && nearest.partDamage.legR > 14) breakLeg(nearest, 'R');
        if (bp === 'back' && nearest.partDamage.back > 18) breakBack(nearest);
        if (nearest.damage > (nearest.maxDamage || 45)) dismember(nearest);
        Body.applyForce(body, body.position, { x: -ant.facing * 0.008 * body.mass, y: -0.003 * body.mass });
        ant.biteReadyAt = now + rand(700, 1300);
      }
    }
  }
});

// Ant render: three segments + scurrying legs
Events.on(render, 'afterRender', () => {
  const ctx = render.context;
  const now = performance.now();
  for (const ant of dummies.values()) {
    if (ant.kind !== 'ant') continue;
    const b = ant.limbs.torso;
    const { x, y } = b.position;
    const f = ant.facing || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(f, 1);
    ctx.fillStyle = ant.dead ? '#3a2c20' : '#5a2e10';
    // Abdomen, thorax, head
    ctx.beginPath(); ctx.ellipse(-5, 0, 4.5, 3.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -1, 2.6, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(4.5, -1, 2.4, 0, Math.PI * 2); ctx.fill();
    // Legs
    if (!ant.dead) {
      ctx.strokeStyle = '#3a2010';
      ctx.lineWidth = 1;
      for (let k = 0; k < 3; k++) {
        const sw = Math.sin(now / 70 + ant.gait + k * 2.1) * 2;
        ctx.beginPath();
        ctx.moveTo(-3 + k * 3, 1);
        ctx.lineTo(-4 + k * 3 + sw, 5.5);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
});

// ---------- Garden Spider ----------
// Stalks the nearest victim. At range it shoots a web — paralysis plus a
// silk wrap — then scuttles in to bite.

function spawnSpider(x, y) {
  const id = nextDummyId++;
  const body = Bodies.circle(x, y, 12, {
    density: 0.0022, friction: 0.7, frictionAir: 0.03,
    render: { visible: false },
  });
  body.label = 'flesh'; body.dummyId = id; body.bodyPart = 'back';
  dummies.set(id, {
    kind: 'spider',
    parts: [body], constraints: [], joints: {},
    limbs: { torso: body },
    damage: 0, partDamage: { back: 0 },
    legsOk: { L: false, R: false }, backOk: true,
    standing: false, dead: false,
    facing: 1,
    webReadyAt: 0,
    biteReadyAt: 0,
  });
  World.add(engine.world, body);
  return null;
}

// Spider AI
Events.on(engine, 'beforeUpdate', () => {
  const now = performance.now();
  for (const [sid, sp] of dummies) {
    if (sp.kind !== 'spider' || sp.dead) continue;
    if (sp.paralyzedUntil && now < sp.paralyzedUntil) continue;
    const body = sp.limbs.torso;
    const prey = [...dummies.values()].filter(d =>
      (d.kind === 'human' || d.kind === 'duck' || d.kind === 'monster') && !d.dead);
    if (prey.length === 0) continue;

    let nearest = null, tid = null, bestD = Infinity;
    for (const [did, t] of dummies) {
      if (!prey.includes(t)) continue;
      const tt = t.limbs.torso;
      const dd = Math.hypot(tt.position.x - body.position.x, tt.position.y - body.position.y);
      if (dd < bestD) { bestD = dd; nearest = t; tid = did; }
    }
    if (!nearest) continue;

    const dx = nearest.limbs.torso.position.x - body.position.x;
    if (Math.abs(dx) > 4) sp.facing = Math.sign(dx);

    // Web shot: paralyze at range
    if (bestD < 240 && bestD > 50 && now > sp.webReadyAt) {
      nearest.paralyzedUntil = now + 2400;
      webs.push({ sid, tid, until: now + 2400 });
      sp.webReadyAt = now + rand(4200, 6200);
      log('Webbed.', 'hint');
    }

    if (bestD > 45) {
      Body.applyForce(body, body.position, { x: sp.facing * 0.007 * body.mass, y: 0 });
    } else if (now > sp.biteReadyAt) {
      let limb = null, ld = Infinity;
      for (const part of nearest.parts) {
        const dd = Math.hypot(part.position.x - body.position.x, part.position.y - body.position.y);
        if (dd < ld) { ld = dd; limb = part; }
      }
      if (limb && ld < 45) {
        const dmg = 4;
        nearest.damage += dmg;
        const bp = limb.bodyPart;
        if (bp && nearest.partDamage[bp] !== undefined) nearest.partDamage[bp] += dmg;
        spurt(limb.position.x, limb.position.y, 3, rand(-1, 1), rand(-1, 0));
        addDecal(limb.position.x, limb.position.y, 2);
        if (bp === 'legL' && nearest.partDamage.legL > 14) breakLeg(nearest, 'L');
        if (bp === 'legR' && nearest.partDamage.legR > 14) breakLeg(nearest, 'R');
        if (bp === 'back' && nearest.partDamage.back > 18) breakBack(nearest);
        if (nearest.damage > (nearest.maxDamage || 45)) dismember(nearest);
        sp.biteReadyAt = now + rand(650, 1000);
      }
    }
  }
});

// Spider render: body, eyes, eight animated legs; silk strands + wraps
Events.on(render, 'afterRender', () => {
  const ctx = render.context;
  const now = performance.now();
  for (const sp of dummies.values()) {
    if (sp.kind !== 'spider') continue;
    const b = sp.limbs.torso;
    const { x, y } = b.position;
    const moving = Math.abs(b.velocity.x) > 0.3;
    ctx.save();
    ctx.translate(x, y);
    // Legs: four per side, bent outward
    ctx.strokeStyle = sp.dead ? '#2c241c' : '#3a2e20';
    ctx.lineWidth = 2;
    for (let k = 0; k < 4; k++) {
      for (const s of [-1, 1]) {
        const base = -0.9 + k * 0.6;
        const step = moving && !sp.dead ? Math.sin(now / 80 + k * 1.7 + s) * 0.18 : 0;
        const a = base + step;
        const kx = s * Math.cos(a) * 16, ky = Math.sin(a) * 8 - 2;
        ctx.beginPath();
        ctx.moveTo(s * 4, -2);
        ctx.quadraticCurveTo(kx * 0.7, ky - 8, kx, ky + 12);
        ctx.stroke();
      }
    }
    // Abdomen + cephalothorax
    ctx.fillStyle = sp.dead ? '#2c241c' : '#46301c';
    ctx.beginPath(); ctx.ellipse(-(sp.facing || 1) * 6, -1, 9, 7.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = sp.dead ? '#241e16' : '#332414';
    ctx.beginPath(); ctx.arc((sp.facing || 1) * 6, 0, 6, 0, Math.PI * 2); ctx.fill();
    // Eyes
    if (!sp.dead) {
      ctx.fillStyle = '#c43c2c';
      for (const e of [-2, 2]) {
        ctx.beginPath();
        ctx.arc((sp.facing || 1) * (7 + Math.abs(e) * 0.4), -2 + e * 0.5, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // Silk strands + wraps
  for (let i = webs.length - 1; i >= 0; i--) {
    const w = webs[i];
    if (now > w.until) { webs.splice(i, 1); continue; }
    const sp = dummies.get(w.sid), t = dummies.get(w.tid);
    if (!sp || !t) { webs.splice(i, 1); continue; }
    const a = sp.limbs.torso.position, b = t.limbs.torso.position;
    ctx.strokeStyle = 'rgba(230,235,240,0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + 14, b.x, b.y);
    ctx.stroke();
    // Wrap on the victim
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(t.limbs.torso.angle);
    ctx.strokeStyle = 'rgba(235,240,245,0.55)';
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath();
      ctx.ellipse(0, k * 7, 18, 4, 0.15 * k, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
});

// ---------- Cordyceps ----------
// A spore drifts to the nearest victim's head and takes root. The host
// staggers as the stalk grows, gets eaten from the head down, fungifies,
// and finally the cap bursts — releasing fresh spores.

const FUNGUS_KILL_AT = 4200;   // ms from infection to head fully consumed
const FUNGUS_SPORE_AT = 9000;  // ms until the cap bursts

function spawnSpore(x, y) {
  spores.push({ x, y, wob: rand(0, Math.PI * 2), life: 1400 });
  return null;
}

// Spore drift + infection progression
Events.on(engine, 'beforeUpdate', () => {
  const now = performance.now();

  for (let i = spores.length - 1; i >= 0; i--) {
    const s = spores[i];
    s.life -= 1;
    s.wob += 0.05;
    if (s.life <= 0) { spores.splice(i, 1); continue; }

    let target = null, bestD = Infinity;
    for (const d of dummies.values()) {
      if (d.dead || d.fungus) continue;
      if (d.kind !== 'human' && d.kind !== 'duck' && d.kind !== 'monster') continue;
      const h = d.limbs.head || d.limbs.torso;
      const dd = Math.hypot(h.position.x - s.x, h.position.y - s.y);
      if (dd < bestD) { bestD = dd; target = d; }
    }
    if (target) {
      const h = target.limbs.head || target.limbs.torso;
      const dx = h.position.x - s.x, dy = h.position.y - s.y;
      const dd = Math.hypot(dx, dy) || 1;
      s.x += (dx / dd) * 1.25 + Math.sin(s.wob) * 0.5;
      s.y += (dy / dd) * 1.25 + Math.cos(s.wob * 0.8) * 0.5;
      if (dd < 16) {
        target.fungus = { at: now, tickAt: 0, spent: false, grew: {} };
        log('Spore took root.', 'hint');
        spores.splice(i, 1);
      }
    } else {
      s.x += Math.sin(s.wob) * 0.7;
      s.y += Math.cos(s.wob * 0.6) * 0.5 - 0.15;
    }
  }

  for (const d of dummies.values()) {
    if (!d.fungus) continue;
    const ft = now - d.fungus.at;
    const head = d.limbs.head || d.limbs.torso;

    if (!d.dead && ft < FUNGUS_KILL_AT) {
      // Staggering host: twitchy, lurching, losing the fight
      if (Math.random() < 0.1) {
        Body.applyForce(d.limbs.torso, d.limbs.torso.position,
          { x: rand(-0.01, 0.01) * d.limbs.torso.mass, y: 0 });
        Body.setAngularVelocity(head, head.angularVelocity + rand(-0.12, 0.12));
      }
      if (now > d.fungus.tickAt) {
        d.fungus.tickAt = now + 600;
        d.damage += 2;
        if (d.partDamage.head !== undefined) d.partDamage.head += 2;
      }
    } else if (!d.dead && ft >= FUNGUS_KILL_AT) {
      d.dead = true;
      d.standing = false;
      head.render.fillStyle = '#d8d2bc';
      log('Consumed from the head down.', 'solve');
    }

    // Post-mortem overgrowth, head down
    if (d.dead && !d.fungus.grew.torso && ft > 5500) {
      d.fungus.grew.torso = true;
      d.limbs.torso.render.fillStyle = '#c9c2a8';
    }
    if (d.dead && !d.fungus.grew.limbs && ft > 7000) {
      d.fungus.grew.limbs = true;
      for (const p of d.parts) {
        if (p === head || p === d.limbs.torso) continue;
        p.render.fillStyle = '#b5ae94';
      }
    }
    if (!d.fungus.spent && ft > FUNGUS_SPORE_AT) {
      d.fungus.spent = true;
      spawnSpore(head.position.x + rand(-6, 6), head.position.y - 30);
      spawnSpore(head.position.x + rand(-6, 6), head.position.y - 36);
      log('The cap bursts — spores adrift.', 'hint');
    }
  }
});

// Cordyceps render: drifting spores, growing stalk + cap, shelf fungi
Events.on(render, 'afterRender', () => {
  const ctx = render.context;
  const now = performance.now();

  for (const s of spores) {
    const halo = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 8);
    halo.addColorStop(0, 'rgba(225,218,185,0.8)');
    halo.addColorStop(1, 'rgba(225,218,185,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#e5dcb8';
    ctx.fill();
  }

  for (const d of dummies.values()) {
    if (!d.fungus) continue;
    const ft = now - d.fungus.at;
    const head = d.limbs.head || d.limbs.torso;
    if (ft < 1200) continue;

    const len = Math.min(34, (ft - 1200) / 160);
    const hx = head.position.x, hy = head.position.y;
    const sway = Math.sin(now / 900 + hx) * 3;
    // Stalk
    ctx.strokeStyle = '#cfc6a0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.quadraticCurveTo(hx + sway, hy - len * 0.6, hx + sway * 1.5, hy - len);
    ctx.stroke();
    // Cap
    const capR = Math.min(9, len * 0.32);
    if (capR > 2) {
      ctx.fillStyle = d.fungus.spent ? '#9a9176' : '#c2552e';
      ctx.beginPath();
      ctx.ellipse(hx + sway * 1.5, hy - len, capR, capR * 0.65, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#e8dfc0';
      ctx.beginPath();
      ctx.ellipse(hx + sway * 1.5, hy - len + 1, capR * 0.8, capR * 0.25, 0, 0, Math.PI);
      ctx.fill();
    }
    // Shelf fungi sprouting along the dead host
    if (d.dead && ft > 5500) {
      ctx.fillStyle = '#d8d0b0';
      for (const p of d.parts) {
        if (p === head) continue;
        const n = ((p.id * 7919) % 3) + 1;
        for (let k = 0; k < n; k++) {
          const a = (p.id * 31 + k * 137) % 360 / 57.3;
          ctx.beginPath();
          ctx.ellipse(p.position.x + Math.cos(a) * 8, p.position.y + Math.sin(a) * 6, 3.5, 2, a, Math.PI, 0);
          ctx.fill();
        }
      }
    }
  }
});

// ---------- Fire Lizard ----------
// The Yard's villain. At bug scale a backyard lizard is a kaiju: heavy,
// hard to kill (maxDamage 140), and it breathes cones of fire.

function spawnLizard(x, y) {
  const id = nextDummyId++;
  const group = Body.nextGroup(true);
  const tag = (b, part) => { b.label = 'flesh'; b.dummyId = id; b.bodyPart = part; return b; };

  const hide = '#4a6a2e', hideDark = '#33491e', belly = '#7a8a4e';
  const opts = { collisionFilter: { group }, density: 0.0022, frictionAir: 0.02 };
  const head = tag(Bodies.circle(x + 44, y - 14, 15, { ...opts, render: { fillStyle: hide } }), 'head');
  const torso = tag(Bodies.rectangle(x, y - 8, 66, 30, { chamfer: { radius: 12 }, ...opts, render: { fillStyle: hide } }), 'back');
  const legL = tag(Bodies.rectangle(x - 20, y + 16, 11, 26, { ...opts, render: { fillStyle: hideDark } }), 'legL');
  const legR = tag(Bodies.rectangle(x + 20, y + 16, 11, 26, { ...opts, render: { fillStyle: hideDark } }), 'legR');
  const tail = tag(Bodies.rectangle(x - 52, y - 12, 40, 10, { chamfer: { radius: 5 }, ...opts, render: { fillStyle: belly } }), 'tail');

  const parts = [head, torso, legL, legR, tail];
  const joinOpts = { stiffness: 0.9, damping: 0.3, length: 0, render: { visible: false } };
  // Paired hip constraints keep the stubby legs planted without the generic
  // leg-posture torque, which is unstable on limbs with this mass/inertia
  // ratio (legsOk false below opts them out; torso + head posture still apply).
  const joints = {
    neck:  Constraint.create({ bodyA: head, bodyB: torso, pointA: { x: -10, y: -5 }, pointB: { x: 30, y: -10 }, ...joinOpts }),
    neck2: Constraint.create({ bodyA: head, bodyB: torso, pointA: { x: -10, y: 5 },  pointB: { x: 30, y: 2 },  ...joinOpts }),
    hipL:  Constraint.create({ bodyA: torso, bodyB: legL, pointA: { x: -24, y: 13 }, pointB: { x: -4, y: -11 }, ...joinOpts }),
    hipL2: Constraint.create({ bodyA: torso, bodyB: legL, pointA: { x: -16, y: 13 }, pointB: { x: 4, y: -11 }, ...joinOpts }),
    hipR:  Constraint.create({ bodyA: torso, bodyB: legR, pointA: { x: 16, y: 13 },  pointB: { x: -4, y: -11 }, ...joinOpts }),
    hipR2: Constraint.create({ bodyA: torso, bodyB: legR, pointA: { x: 24, y: 13 },  pointB: { x: 4, y: -11 }, ...joinOpts }),
    tailJ: Constraint.create({ bodyA: torso, bodyB: tail, pointA: { x: -32, y: -4 }, pointB: { x: 18, y: 0 }, stiffness: 0.6, damping: 0.2, length: 2, render: { visible: false } }),
  };
  const constraints = Object.values(joints);

  dummies.set(id, {
    kind: 'lizard',
    maxDamage: 140,
    parts, constraints, joints,
    limbs: { head, torso, legL, legR, tail },
    damage: 0,
    partDamage: { back: 0, legL: 0, legR: 0, neck: 0, head: 0, tail: 0 },
    legsOk: { L: false, R: false }, // legs are welded, not posture-driven
    backOk: true,
    standing: true,
    dead: false,
    facing: 1,
    breathUntil: 0,
    breathReadyAt: performance.now() + 1800,
  });
  World.add(engine.world, [...parts, ...constraints]);
  log('Something large stirs in the grass.', 'hint');
  return null;
}

// Lizard AI: stalk, then breathe fire
Events.on(engine, 'beforeUpdate', () => {
  const now = performance.now();
  for (const [id, lz] of dummies) {
    if (lz.kind !== 'lizard' || lz.dead) continue;
    if (lz.paralyzedUntil && now < lz.paralyzedUntil) continue;
    const torso = lz.limbs.torso, head = lz.limbs.head;

    // Breathing fire: spew particles from the mouth
    if (now < lz.breathUntil) {
      const mx = head.position.x + lz.facing * 18, my = head.position.y + 2;
      for (let k = 0; k < 4; k++) {
        flames.push({
          x: mx, y: my,
          vx: lz.facing * rand(4, 7.5) + rand(-0.6, 0.6),
          vy: rand(-1.2, 0.6),
          r: rand(4, 8), life: rand(26, 44), srcId: id,
        });
      }
      if (Math.random() < 0.3) spawnSmoke(mx + lz.facing * 20, my - 6, rand(3, 5));
      Body.applyForce(torso, torso.position, { x: -lz.facing * 0.002 * torso.mass, y: 0 });
      continue;
    }

    if (!lz.standing) continue;
    const prey = [...dummies.values()].filter(d =>
      (d.kind === 'human' || d.kind === 'duck' || d.kind === 'monster') && !d.dead);
    if (prey.length === 0) continue;

    let nearest = null, bestD = Infinity;
    for (const t of prey) {
      const tt = t.limbs.torso;
      const dd = Math.hypot(tt.position.x - torso.position.x, tt.position.y - torso.position.y);
      if (dd < bestD) { bestD = dd; nearest = t; }
    }
    if (!nearest) continue;

    const dx = nearest.limbs.torso.position.x - torso.position.x;
    if (Math.abs(dx) > 10) lz.facing = Math.sign(dx);

    if (bestD > 200) {
      // Speed-capped stalk: an uncapped charge hits hard enough to blow
      // up the bug's constraint solver.
      if (Math.abs(torso.velocity.x) < 4.5) {
        Body.applyForce(torso, torso.position, { x: lz.facing * 0.009 * torso.mass, y: 0 });
      }
    } else if (now > lz.breathReadyAt) {
      lz.breathUntil = now + 1400;
      lz.breathReadyAt = now + 4400;
      log('The lizard draws breath.', 'hint');
    }
  }
});

// Lizard render: eye, dorsal spikes, flicking tongue
Events.on(render, 'afterRender', () => {
  const ctx = render.context;
  const now = performance.now();
  for (const lz of dummies.values()) {
    if (lz.kind !== 'lizard') continue;
    const head = lz.limbs.head, torso = lz.limbs.torso;
    const f = lz.facing || 1;
    // Dorsal spikes along the back
    ctx.save();
    ctx.translate(torso.position.x, torso.position.y);
    ctx.rotate(torso.angle);
    ctx.fillStyle = lz.dead ? '#2c3a1c' : '#33491e';
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath();
      ctx.moveTo(k * 13 - 5, -14);
      ctx.lineTo(k * 13, -23);
      ctx.lineTo(k * 13 + 5, -14);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // Head details
    ctx.save();
    ctx.translate(head.position.x, head.position.y);
    ctx.rotate(head.angle);
    ctx.scale(f, 1);
    // Eye: slit pupil, glows while breathing
    const breathing = now < lz.breathUntil;
    ctx.beginPath();
    ctx.arc(2, -5, 4, 0, Math.PI * 2);
    ctx.fillStyle = lz.dead ? '#3a3a2c' : breathing ? '#ffb030' : '#d8c040';
    ctx.fill();
    if (!lz.dead) {
      ctx.fillStyle = '#181410';
      ctx.fillRect(1.2, -8, 1.6, 6);
    }
    // Nostril + jawline
    ctx.fillStyle = '#22301a';
    ctx.beginPath(); ctx.arc(12, -2, 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#33491e';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(4, 5); ctx.lineTo(13, 3); ctx.stroke();
    // Tongue flick when idle
    if (!lz.dead && !breathing && Math.sin(now / 400) > 0.92) {
      ctx.strokeStyle = '#c44a4a';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(15, 1);
      ctx.lineTo(24, -1);
      ctx.lineTo(27, -4);
      ctx.moveTo(24, -1);
      ctx.lineTo(27, 1);
      ctx.stroke();
    }
    ctx.restore();
  }
});

// ---------- Sprinkler ----------
// Pops up from the lawn and sweeps a high-pressure jet back and forth.

function startSprinkler() {
  sprinklers.push({ x: rand(W * 0.25, W * 0.75), born: performance.now(), life: 6500 });
  log('Sprinkler hiss.', 'hint');
}

Events.on(engine, 'beforeUpdate', () => {
  if (sprinklers.length === 0) return;
  const now = performance.now();
  for (let i = sprinklers.length - 1; i >= 0; i--) {
    const s = sprinklers[i];
    if (now - s.born > s.life) { sprinklers.splice(i, 1); continue; }
    const ang = -Math.PI / 2 + Math.sin(now / 700 + s.born) * 1.0;
    const jx = Math.cos(ang), jy = Math.sin(ang);
    const nx = s.x, ny = H - 14;
    // Push bodies caught in the jet
    for (const body of Composite.allBodies(engine.world)) {
      if (body.isStatic || frozenIds.has(body.id)) continue;
      const dx = body.position.x - nx, dy = body.position.y - ny;
      const dist = Math.hypot(dx, dy);
      if (dist < 12 || dist > 470) continue;
      const da = Math.abs(Math.atan2(dy, dx) - ang);
      if (Math.min(da, Math.PI * 2 - da) > 0.14) continue;
      const fall = 1 - dist / 470;
      Body.applyForce(body, body.position, { x: jx * 0.005 * body.mass * fall, y: jy * 0.005 * body.mass * fall });
    }
    // Spray particles
    for (let k = 0; k < 5; k++) {
      const sp = rand(8, 12);
      waterDrops.push({
        x: nx, y: ny,
        vx: jx * sp + rand(-0.7, 0.7),
        vy: jy * sp + rand(-0.7, 0.7),
        life: rand(40, 70),
      });
    }
    if (waterDrops.length > 400) waterDrops.splice(0, waterDrops.length - 400);
  }
});

// ---------- Magnifying Glass ----------
// A focused sunbeam wanders to the nearest creature and lingers. Linger
// long enough and they ignite.

function startMagnify() {
  sunbeams.push({ x: rand(W * 0.2, W * 0.8), y: rand(40, H * 0.4), born: performance.now(), life: 8000, heat: 0 });
  log('Someone found a magnifying glass.', 'hint');
}

Events.on(engine, 'beforeUpdate', () => {
  if (sunbeams.length === 0) return;
  const now = performance.now();
  for (let i = sunbeams.length - 1; i >= 0; i--) {
    const sb = sunbeams[i];
    if (now - sb.born > sb.life) { sunbeams.splice(i, 1); continue; }

    let target = null, bestD = Infinity;
    for (const d of dummies.values()) {
      if (d.dead || d.kind === 'lizard') continue;
      const t = d.limbs.torso;
      const dd = Math.hypot(t.position.x - sb.x, t.position.y - sb.y);
      if (dd < bestD) { bestD = dd; target = d; }
    }
    if (!target) { sb.y += Math.sin(now / 500) * 0.6; continue; }

    const t = target.limbs.torso;
    const dx = t.position.x - sb.x, dy = t.position.y - sb.y;
    const dd = Math.hypot(dx, dy) || 1;
    const step = Math.min(3.2, dd * 0.06);
    sb.x += (dx / dd) * step;
    sb.y += (dy / dd) * step;

    if (dd < 26) {
      sb.heat += 16.7;
      if (Math.random() < 0.25) spawnSmoke(sb.x + rand(-3, 3), sb.y - 4, rand(1.5, 3));
      if (sb.heat > 650) {
        igniteDummy(target, 3500);
        log('Ignition.', 'hint');
        sb.heat = -500; // cool-down before it can re-ignite
      }
    } else {
      sb.heat = Math.max(0, sb.heat - 8);
    }
  }
});

// ---------- Lawnmower ----------
// The apex hazard. Rolls in from one side at deck height; anything made
// of flesh that meets the blade is shredded instantly. Mulches poop too.

function launchMower() {
  const dir = Math.random() < 0.5 ? 1 : -1;
  // Spawn flush with the stage edge — any deeper and the thick walls
  // catapult it across the stage during overlap resolution.
  const x = dir > 0 ? 50 : W - 50;
  const m = Bodies.rectangle(x, H - 30, 96, 40, {
    density: 0.05, friction: 0.1, frictionAir: 0,
    render: { visible: false },
    label: 'mower',
  });
  m.mowerData = { dir };
  mowers.push(m);
  World.add(engine.world, m);
  for (let k = 0; k < 5; k++) spawnSmoke(x - dir * rand(10, 40), H - rand(20, 50), rand(4, 7));
  log('Mower day. Run.', 'hint');
}

Events.on(engine, 'beforeUpdate', () => {
  if (mowers.length === 0) return;
  const worldBodies = Composite.allBodies(engine.world);
  for (let i = mowers.length - 1; i >= 0; i--) {
    const m = mowers[i];
    if (!worldBodies.includes(m)) { mowers.splice(i, 1); continue; }
    const dir = m.mowerData.dir;
    // The side walls are solid — despawn on contact, behind a puff of exhaust
    if ((dir > 0 && m.position.x > W - 52) || (dir < 0 && m.position.x < 52)) {
      for (let k = 0; k < 5; k++) spawnSmoke(m.position.x + rand(-20, 20), m.position.y - rand(0, 24), rand(4, 7));
      Composite.remove(engine.world, m);
      mowers.splice(i, 1);
      continue;
    }
    Body.setVelocity(m, { x: dir * 5, y: m.velocity.y });
    Body.setAngle(m, 0);
    Body.setAngularVelocity(m, 0);

    // Blade zone: ahead of the deck, at grass height
    const bx = m.position.x + dir * 30;
    for (const body of worldBodies) {
      if (body.isStatic || body === m) continue;
      if (Math.abs(body.position.x - bx) > 45 || body.position.y < H - 75) continue;
      if (body.label === 'flesh') {
        const d = dummies.get(body.dummyId);
        if (d && !d.dead) {
          d.damage = 999;
          spurt(body.position.x, body.position.y, 14, dir, -1.2);
          spurt(body.position.x, body.position.y - 10, 12, -dir * 0.4, -1);
          addDecal(body.position.x, body.position.y, 10);
          dismember(d);
        }
        Body.setVelocity(body, { x: dir * rand(-3, 9), y: -rand(7, 15) });
      } else if (body.label === 'poop') {
        // You knew this would happen
        for (let k = 0; k < 22; k++) {
          droplets.push({
            x: body.position.x, y: body.position.y,
            vx: rand(-5, 5) + dir * 3, vy: -rand(2, 9),
            r: rand(2, 4), color: pick(['#5a3a1e', '#4c3018', '#6a4626']),
            life: rand(40, 80),
          });
        }
        decals.push({ x: body.position.x, y: H - 6, r: rand(10, 16), color: '#4c3018', alpha: 0.7 });
        Composite.remove(engine.world, body);
        log('Oh no. The poop.', 'hint');
      }
    }
    // Clippings + exhaust
    for (let k = 0; k < 3; k++) {
      grassBits.push({
        x: m.position.x - dir * rand(20, 48), y: H - rand(8, 30),
        vx: -dir * rand(1, 4), vy: -rand(3, 8),
        life: rand(25, 50),
      });
    }
    if (grassBits.length > 220) grassBits.splice(0, grassBits.length - 220);
    if (Math.random() < 0.3) spawnSmoke(m.position.x - dir * 40, m.position.y - 26, rand(2.5, 4.5));
  }
});

// Mower render: deck, engine, handle, wheels, blade blur
Events.on(render, 'afterRender', () => {
  if (mowers.length === 0) return;
  const ctx = render.context;
  const now = performance.now();
  for (const m of mowers) {
    const dir = m.mowerData.dir;
    const { x, y } = m.position;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    // Blade blur under the deck
    ctx.fillStyle = `rgba(60,60,70,${0.35 + 0.25 * Math.sin(now / 18)})`;
    ctx.beginPath();
    ctx.ellipse(14, 16, 34, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Deck
    ctx.fillStyle = '#b03020';
    ctx.strokeStyle = '#5a1410';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-44, -6, 88, 22, 6);
    ctx.fill();
    ctx.stroke();
    // Engine block
    ctx.fillStyle = '#6a6e74';
    ctx.beginPath();
    ctx.roundRect(-16, -24, 32, 20, 4);
    ctx.fill();
    ctx.fillStyle = '#3a3e44';
    ctx.fillRect(-6, -30, 12, 7);
    // Handle, slanting back
    ctx.strokeStyle = '#2a2e34';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-38, -4);
    ctx.lineTo(-78, -52);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-78, -52);
    ctx.lineTo(-92, -52);
    ctx.stroke();
    // Wheels
    const roll = (x / 11) * dir;
    for (const wx of [-32, 34]) {
      ctx.beginPath();
      ctx.arc(wx, 18, 11, 0, Math.PI * 2);
      ctx.fillStyle = '#1c1e22';
      ctx.fill();
      ctx.strokeStyle = '#4a4e54';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(wx, 18);
      ctx.lineTo(wx + Math.cos(roll) * 8, 18 + Math.sin(roll) * 8);
      ctx.stroke();
    }
    ctx.restore();
  }
});

// ---------- Yard ambience: dusk light, grass, pollen, fireflies ----------
// Plus the yard's particle systems (flames, smoke, water, clippings).

const GRASS_BACK = Array.from({ length: 16 }, (_, i) => ({
  x: (i + rand(0.1, 0.9)) / 16, h: rand(90, 240), w: rand(10, 18),
  ph: rand(0, Math.PI * 2), tone: rand(0, 1),
}));
const GRASS_FRONT = Array.from({ length: 6 }, () => ({
  x: Math.random() < 0.5 ? rand(0, 0.2) : rand(0.8, 1), h: rand(160, 300), w: rand(14, 24),
  ph: rand(0, Math.PI * 2), tone: rand(0, 1),
}));
const pollen = Array.from({ length: 30 }, () => ({
  x: Math.random(), y: Math.random(), r: rand(0.7, 1.8), v: rand(0.00006, 0.0002),
}));
const fireflies = Array.from({ length: 7 }, () => ({
  x: Math.random(), y: rand(0.2, 0.8), ph: rand(0, Math.PI * 2), sp: rand(0.6, 1.4),
}));

function drawGrassBlade(ctx, gx, h, w, sway, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(gx - w / 2, H);
  ctx.quadraticCurveTo(gx - w * 0.2, H - h * 0.55, gx + sway, H - h);
  ctx.quadraticCurveTo(gx + w * 0.25, H - h * 0.5, gx + w / 2, H);
  ctx.closePath();
  ctx.fill();
}

Events.on(render, 'afterRender', () => {
  if (state.world !== 'yard') return;
  const ctx = render.context;
  const now = performance.now();

  // Dusk sky: warm glow up top, deep green settling below
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, 'rgba(255,170,70,0.10)');
  sky.addColorStop(0.45, 'rgba(120,90,30,0.03)');
  sky.addColorStop(1, 'rgba(10,30,5,0.12)');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Low sun, top-right
  const sun = ctx.createRadialGradient(W * 0.85, H * 0.1, 0, W * 0.85, H * 0.1, 90);
  sun.addColorStop(0, 'rgba(255,210,120,0.35)');
  sun.addColorStop(1, 'rgba(255,210,120,0)');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(W * 0.85, H * 0.1, 90, 0, Math.PI * 2);
  ctx.fill();

  // Background grass
  for (const g of GRASS_BACK) {
    const sway = Math.sin(now / 1600 + g.ph) * 8;
    drawGrassBlade(ctx, g.x * W, g.h, g.w, sway, `rgba(${26 + g.tone * 14 | 0},${52 + g.tone * 16 | 0},${16 + g.tone * 8 | 0},0.32)`);
  }

  // Pollen, drifting up and left
  ctx.fillStyle = 'rgba(235,225,150,0.22)';
  for (const m of pollen) {
    m.x -= m.v; m.y -= m.v * 0.7;
    if (m.x < 0) m.x = 1;
    if (m.y < 0) m.y = 1;
    ctx.beginPath();
    ctx.arc(m.x * W, m.y * H, m.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fireflies, blinking
  for (const ff of fireflies) {
    const fx = (ff.x + Math.sin(now / 4000 * ff.sp + ff.ph) * 0.06) * W;
    const fy = (ff.y + Math.cos(now / 5200 * ff.sp + ff.ph * 2) * 0.05) * H;
    const blink = Math.max(0, Math.sin(now / 800 + ff.ph * 3));
    if (blink < 0.25) continue;
    const glow = ctx.createRadialGradient(fx, fy, 0, fx, fy, 7);
    glow.addColorStop(0, `rgba(200,255,120,${0.7 * blink})`);
    glow.addColorStop(1, 'rgba(200,255,120,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(fx, fy, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sprinkler hardware + spray
  for (const s of sprinklers) {
    ctx.fillStyle = '#2a4a20';
    ctx.fillRect(s.x - 5, H - 18, 10, 18);
    ctx.fillStyle = '#3a5a2c';
    ctx.fillRect(s.x - 7, H - 22, 14, 5);
  }
  ctx.fillStyle = 'rgba(150,200,240,0.7)';
  for (let i = waterDrops.length - 1; i >= 0; i--) {
    const wd = waterDrops[i];
    wd.vy += 0.3;
    wd.x += wd.vx; wd.y += wd.vy;
    wd.life -= 1;
    if (wd.life <= 0 || wd.y > H - 4) { waterDrops.splice(i, 1); continue; }
    ctx.beginPath();
    ctx.arc(wd.x, wd.y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Grass clippings
  ctx.fillStyle = 'rgba(90,160,50,0.8)';
  for (let i = grassBits.length - 1; i >= 0; i--) {
    const gb = grassBits[i];
    gb.vy += 0.3;
    gb.x += gb.vx; gb.y += gb.vy;
    gb.life -= 1;
    if (gb.life <= 0 || gb.y > H - 2) { grassBits.splice(i, 1); continue; }
    ctx.fillRect(gb.x, gb.y, 3, 1.5);
  }

  // Sunbeam focal points + floating magnifier
  for (const sb of sunbeams) {
    // Light shaft from the sun to the focal point
    ctx.strokeStyle = 'rgba(255,230,150,0.13)';
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.moveTo(W * 0.85, H * 0.1);
    ctx.lineTo(sb.x, sb.y);
    ctx.stroke();
    // Focal dot
    const hot = sb.heat > 0 ? Math.min(1, sb.heat / 650) : 0;
    const core = ctx.createRadialGradient(sb.x, sb.y, 0, sb.x, sb.y, 10 + hot * 6);
    core.addColorStop(0, `rgba(255,255,230,${0.85})`);
    core.addColorStop(0.4, `rgba(255,220,120,${0.5 + hot * 0.4})`);
    core.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(sb.x, sb.y, 10 + hot * 6, 0, Math.PI * 2);
    ctx.fill();
    // The lens itself, hovering above
    const lx = sb.x - 30, ly = sb.y - 46;
    ctx.strokeStyle = '#8a6a3a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(lx, ly, 17, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(200,230,250,0.18)';
    ctx.beginPath();
    ctx.arc(lx, ly, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#6a4a24';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(lx - 13, ly - 13);
    ctx.lineTo(lx - 28, ly - 28);
    ctx.stroke();
  }

  // Foreground grass: brighter, drawn over everything for depth
  for (const g of GRASS_FRONT) {
    const sway = Math.sin(now / 1400 + g.ph) * 10;
    drawGrassBlade(ctx, g.x * W, g.h, g.w, sway, `rgba(${38 + g.tone * 14 | 0},${78 + g.tone * 18 | 0},${22 + g.tone * 8 | 0},0.5)`);
  }
});

// Flames + smoke render in every world (fires can outlive a hazard)
Events.on(render, 'afterRender', () => {
  const ctx = render.context;
  for (const f of flames) {
    const a = Math.min(0.85, f.life / 25);
    const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
    grad.addColorStop(0, `rgba(255,235,150,${a})`);
    grad.addColorStop(0.5, `rgba(255,140,40,${a * 0.8})`);
    grad.addColorStop(1, 'rgba(200,60,20,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = smokes.length - 1; i >= 0; i--) {
    const s = smokes[i];
    s.x += s.vx; s.y += s.vy;
    s.r += 0.1;
    s.life -= 1;
    if (s.life <= 0) { smokes.splice(i, 1); continue; }
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(70,70,75,${Math.min(0.4, s.life / 90)})`;
    ctx.fill();
  }
});

// ====================================================================
// ---------- PERSISTENCE ----------
// Progress (unlocks, solves, tokens, proficiency, last world) survives
// reload via localStorage. Wrapped in try/catch so private browsing or
// blocked storage just means a fresh session, never a crash.
// ====================================================================

const SAVE_KEY = 'calculus-carnage-save-v1';

function saveState() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      solved: state.solved,
      skips: state.skips,
      correctStreak: state.correctStreak,
      levelCorrect: state.levelCorrect,
      unlocked: [...state.unlocked],
      world: state.world,
      tool: state.tool,
    }));
  } catch (e) { /* storage unavailable — play on without saving */ }
}

// Returns the saved world id (to restore last) or null.
function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    const validIds = new Set([
      ...TOOLS.map(t => t.id),
      ...WORLDS.filter(w => w.gate).map(w => w.gate.id),
    ]);
    if (Array.isArray(s.unlocked)) {
      for (const id of s.unlocked) if (validIds.has(id)) state.unlocked.add(id);
    }
    if (typeof s.solved === 'number') state.solved = s.solved;
    if (typeof s.skips === 'number') state.skips = s.skips;
    if (typeof s.correctStreak === 'number') state.correctStreak = s.correctStreak;
    if (s.levelCorrect) {
      for (const k of [1, 2, 3, 4, 5, 6]) {
        if (typeof s.levelCorrect[k] === 'number') state.levelCorrect[k] = s.levelCorrect[k];
      }
    }
    if (state.unlocked.has(s.tool) && TOOLS.some(t => t.id === s.tool)) state.tool = s.tool;
    return WORLDS.some(w => w.id === s.world) ? s.world : null;
  } catch (e) {
    return null;
  }
}

// Reset link in the sidebar
document.getElementById('reset-save').addEventListener('click', (e) => {
  e.preventDefault();
  if (!confirm('Wipe all progress — unlocks, solves, and skip tokens?')) return;
  try { localStorage.removeItem(SAVE_KEY); } catch (err) {}
  location.reload();
});

// ---------- World 2 + 3 + persistence boot ----------

const savedWorld = loadState();
const hadSave = state.solved > 0 || state.unlocked.size > 5;
renderToolbar();
renderWorldTabs();
refreshHUD();
refreshProficiency();
if (savedWorld && savedWorld !== state.world) {
  switchWorld(savedWorld); // re-renders + reseeds the stage
}
if (hadSave) log('Progress restored.', 'solve');
