import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWorld, step, analyze, render, renderSVG, energy, position } from '../src/index.js';
const cli = args => spawnSync(process.execPath, ['src/cli.js', ...args], { encoding: 'utf8' });
test('seeds reproduce and batched updates equal incremental updates', () => { const a = createWorld(), b = createWorld(); step(a, 80); for (let i = 0; i < 80; i++) step(b); assert.deepEqual(a, b); assert.notDeepEqual(a, step(createWorld({ seed: 123 }), 80)); });
test('RK4 conserves energy, rods stay unit length, and near starts diverge', () => {
  const w = createWorld();
  let peakSeparation = 0;
  // Chaotic trajectories can meet again at one instant, and floating-point math
  // varies by platform. Check divergence over the trajectory, not just its end.
  for (let i = 0; i < 50; i++) {
    step(w, 100);
    peakSeparation = Math.max(peakSeparation, analyze(w).tipSeparation);
  }
  for (const p of w.pendulums) {
    assert.ok(Math.abs(energy(p.state) - p.initialEnergy) < 0.02);
    assert.ok(p.state.every(Number.isFinite));
    assert.ok(p.trail.length <= 220);
    const q = position(p.state);
    assert.ok(Math.abs(Math.hypot(q.x, q.y) - 1) < 1e-12);
    assert.ok(Math.abs(Math.hypot(q.tipX - q.x, q.tipY - q.y) - 1) < 1e-12);
  }
  assert.ok(peakSeparation > 0.1);
});
test('validation, no-op steps, and renderer dimensions', () => { for (const o of [{ seed: -1 }, { seed: 2.5 }, { width: 0 }, { height: 1000 }, { count: 0 }]) assert.throws(() => createWorld(o)); const w = createWorld(); const before = structuredClone(w); step(w, 0); assert.deepEqual(w, before); assert.throws(() => step(w, -1)); assert.throws(() => step(w, 0.5)); const rows = render(w).split('\n'); assert.equal(rows.length, w.height); assert.ok(rows.every(row => row.length === w.width)); assert.ok(!render(w).includes('\x1b')); assert.match(renderSVG(w), /^<svg/); });
test('CLI exports, errors, and plain output', () => { const result = cli(['--steps', '20', '--json']); assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).frame, 20); const plain = cli(['--steps', '0']); assert.equal(plain.status, 0); assert.ok(!plain.stdout.includes('\x1b')); assert.equal(cli(['--help']).status, 0); for (const args of [['--seed'], ['--seed', '-1'], ['--width', '0'], ['--steps', 'wat'], ['--json', '--frames', '1'], ['--wat']]) assert.equal(cli(args).status, 2); const dir = mkdtempSync(join(tmpdir(), 'terminal-pendulum-lab-')); try { const file = join(dir, 'out.svg'); const r = cli(['--steps', '0', '--svg', file, '--json']); assert.equal(r.status, 0, r.stderr); assert.equal(JSON.parse(r.stdout).frame, 0); assert.match(readFileSync(file, 'utf8'), /PENDULUM LAB/); assert.equal(cli(['--steps', '0', '--svg', join(dir, 'missing', 'out.svg')]).status, 2); } finally { rmSync(dir, { recursive: true, force: true }); } });
