const colors = ['#5de4c7', '#f48fb1', '#ffd166', '#70a5ff', '#c9a7ff', '#ff9b71', '#a4e57e', '#eff5ff'];
const g = 9.81, dt = 0.008;
export function createWorld({ seed = 42, count = 3, width = 80, height = 30 } = {}) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('seed must be unsigned 32-bit');
  if (!Number.isInteger(count) || count < 1 || count > 8) throw new Error('count must be 1–8');
  if (!Number.isInteger(width) || width < 20 || width > 120 || !Number.isInteger(height) || height < 10 || height > 60) throw new Error('width must be 20–120 and height 10–60');
  const angle = 1.8 + ((Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296 * 0.8;
  const pendulums = Array.from({ length: count }, (_, i) => {
    const state = [angle + i * 0.0005, angle - 0.3, 0, 0];
    return { state, initialEnergy: energy(state), trail: [], color: colors[i] };
  });
  return { seed, width, height, frame: 0, pendulums };
}
export function energy([a, b, u, v]) { return u * u + v * v / 2 + u * v * Math.cos(a - b) - g * (2 * Math.cos(a) + Math.cos(b)); }
function derivative([a, b, u, v]) {
  const d = a - b, den = 3 - Math.cos(2 * d);
  return [u, v, (-3 * g * Math.sin(a) - g * Math.sin(a - 2 * b) - 2 * Math.sin(d) * (v * v + u * u * Math.cos(d))) / den,
    2 * Math.sin(d) * (2 * u * u + 2 * g * Math.cos(a) + v * v * Math.cos(d)) / den];
}
export function position([a, b]) { const x = Math.sin(a), y = Math.cos(a); return { x, y, tipX: x + Math.sin(b), tipY: y + Math.cos(b) }; }
export function step(world, count = 1) {
  if (!Number.isInteger(count) || count < 0 || count > 100000) throw new Error('step count must be 0–100000');
  for (let k = 0; k < count; k++) {
    for (const p of world.pendulums) {
      const s = p.state, mix = (d, f) => s.map((n, i) => n + d[i] * dt * f);
      const a = derivative(s), b = derivative(mix(a, 0.5)), c = derivative(mix(b, 0.5)), d = derivative(mix(c, 1));
      p.state = s.map((n, i) => n + dt / 6 * (a[i] + 2 * b[i] + 2 * c[i] + d[i]));
      if (world.frame % 3 === 0) { const tip = position(p.state); p.trail.push([tip.tipX, tip.tipY]); if (p.trail.length > 220) p.trail.shift(); }
    }
    world.frame++;
  }
  return world;
}
export function analyze(world) {
  const tips = world.pendulums.map(p => position(p.state));
  return { seed: world.seed, frame: world.frame, time: world.frame * dt, count: tips.length,
    tipSeparation: Math.hypot(tips[0].tipX - tips.at(-1).tipX, tips[0].tipY - tips.at(-1).tipY),
    pendulums: world.pendulums.map(p => ({ angles: p.state.slice(0, 2), angularVelocities: p.state.slice(2), energy: energy(p.state), energyDrift: energy(p.state) - p.initialEnergy })) };
}
export function render(world, { color = false, trails = true } = {}) {
  const { width, height } = world, grid = Array.from({ length: height }, () => Array(width).fill(' '));
  const point = (x, y) => [Math.round(width / 2 + x * (width - 3) / 4.4), Math.round((height - 1) / 2 + y * (height - 3) / 4.4)];
  const put = (x, y, ch, i) => { const [cx, cy] = point(x, y); if (grid[cy]?.[cx] !== undefined) grid[cy][cx] = color ? `\x1b[${[36, 35, 33, 34, 95, 31, 32, 37][i]}m${ch}\x1b[0m` : ch; };
  world.pendulums.forEach((p, i) => {
    if (trails) for (const [x, y] of p.trail) put(x, y, '.', i);
    const q = position(p.state);
    for (let n = 0; n <= 40; n++) { const t = n / 40; put(q.x * t, q.y * t, ':', i); put(q.x + (q.tipX - q.x) * t, q.y + (q.tipY - q.y) * t, ':', i); }
    put(q.x, q.y, 'o', i); put(q.tipX, q.tipY, String(i + 1), i);
  });
  put(0, 0, '+', 0); return grid.map(r => r.join('')).join('\n');
}
export function renderSVG(world) {
  const xy = (x, y) => `${400 + x * 105},${300 + y * 105}`;
  const shapes = world.pendulums.map(p => { const q = position(p.state); return `<polyline points="${p.trail.map(([x, y]) => xy(x, y)).join(' ')}" fill="none" stroke="${p.color}" stroke-opacity="0.55"/><polyline points="400,300 ${xy(q.x, q.y)} ${xy(q.tipX, q.tipY)}" fill="none" stroke="${p.color}" stroke-width="2"/><circle cx="${400 + q.tipX * 105}" cy="${300 + q.tipY * 105}" r="5" fill="${p.color}"/>`; }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="570" viewBox="0 0 800 570"><rect width="800" height="570" rx="18" fill="#0d1525"/><g font-family="monospace"><text x="32" y="38" font-size="24" fill="#eff5ff">TERMINAL PENDULUM LAB</text><text x="32" y="64" fill="#93a4bc">seed ${world.seed} / time ${(world.frame * dt).toFixed(2)} / almost identical starts</text>${shapes}<circle cx="400" cy="300" r="4" fill="white"/><text x="32" y="548" fill="#93a4bc">Deterministic chaos / RK4 / p pause . step n seed r reset t trails q quit</text></g></svg>\n`;
}
