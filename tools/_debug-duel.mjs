import { CONFIG } from '../src/data/config.js';
import { createArenaBattle } from '../src/core/arena.js';
const { mulberry32 } = await import('../src/core/rng.js');

const b = createArenaBattle(
  [{ troop: 'wudang', level: 1, col: 2, row: 2 }],
  [{ troop: 'yuanyong', level: 3, col: 2, row: 2 }],
  mulberry32(20),
);
const log = [];
for (let i = 0; i < 600 && !b.over; i++) {
  const events = b.step(CONFIG.combat.step);
  for (const e of events) log.push({ tm: i / 30, e });
}
console.log('over', b.over, b.winner, b.time.toFixed(1));
console.log('player', b.entities.filter((e) => e.side === 'player').map((e) => ({
  hp: Math.round(e.hp), alive: e.alive, atk: e.atk, range: e.range, dodge: e.auraDodge,
})));
console.log('enemy', b.entities.filter((e) => e.side === 'enemy').map((e) => ({
  hp: Math.round(e.hp), alive: e.alive, atk: e.atk, range: e.range, burst: e.burstLeft,
})));
const attacks = log.filter((r) => r.e.t === 'attack');
console.log('attacks', attacks.length);
for (const a of attacks.slice(0, 20)) {
  console.log(`t=${a.tm.toFixed(1)} ${a.e.actorTroop}->${a.e.targetTroop} dmg=${Math.round(a.e.damage)} poison=${a.e.poison} miss=${a.e.miss}`);
}
const poison = log.filter((r) => r.e.t === 'poison');
console.log('poison ticks', poison.length);
