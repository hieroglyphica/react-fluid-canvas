function hsvToRgb(h, s, v) {
  let r, g, b;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0:
      [r, g, b] = [v, t, p];
      break;
    case 1:
      [r, g, b] = [q, v, p];
      break;
    case 2:
      [r, g, b] = [p, v, t];
      break;
    case 3:
      [r, g, b] = [p, q, v];
      break;
    case 4:
      [r, g, b] = [t, p, v];
      break;
    case 5:
      [r, g, b] = [v, p, q];
      break;
    default:
      // Should not happen if h is in [0, 1]
      [r, g, b] = [v, v, v];
      break;
  }
  return { r, g, b };
}

function getHue(theme, angle) {
  if (theme === "default") {
    return (angle / (2 * Math.PI) + 0.5 + Date.now() / 1000.0 * 0.1) % 1.0;
  }
  if (typeof theme === "number") return theme;
  if (Array.isArray(theme)) {
    const [min, max] = theme;
    return (Math.random() * (max - min) + min) % 1.0;
  }
  return Math.random();
}

function pushSplatToSim(sim, x, y, rawDx, rawDy, colorHint) {
  const cfg = sim && sim.config ? sim.config : {};
  const forceMul = Number(cfg.SPLAT_FORCE || 1);
  const dx = rawDx * forceMul;
  const dy = rawDy * forceMul;

  const speed = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
  const brightness = Math.min(speed * 4.0, 1.0);

  let colorArr = null;
  if (Array.isArray(colorHint) && colorHint.length >= 3) {
    colorArr = [Number(colorHint[0]) * brightness, Number(colorHint[1]) * brightness, Number(colorHint[2]) * brightness];
  } else if (cfg.COLORFUL) {
    const angle = Math.atan2(rawDy, rawDx) || Math.random() * Math.PI * 2;
    const hue = getHue(cfg.COLOR_THEME, angle);
    const c = hsvToRgb(hue, 0.8, 1.0);
    colorArr = [c.r * brightness, c.g * brightness, c.b * brightness];
  } else {
    colorArr = [0.3 * brightness, 0.3 * brightness, 0.3 * brightness];
  }

  sim.addSplat({
    texcoordX: Math.max(0, Math.min(1, x)),
    texcoordY: 1.0 - Math.max(0, Math.min(1, y)), // addSplat expects texcoords like previous usage (y flipped)
    deltaX: dx,
    deltaY: dy,
    color: colorArr,
  });
}

/**
 * Orbiting preset — a few particles orbit a fixed center producing drag-like splats.
 * createOrbitingPreset(sim, { count = 3, center = {x:0.5,y:0.5}, backstep = 0.002 })
 * returns { start(), stop() }
 */
export function createOrbitingPreset(sim, opts = {}) {
  const { count = 3, center = { x: 0.5, y: 0.5 }, backstep = 0.002 } = opts;
  let raf = null;
  let lastTime = 0;
  const parts = Array.from({ length: count }).map((_, i) => {
    const angle = (i / count) * Math.PI * 2;
    const radius = 0.12 + Math.random() * 0.18;
    const speed = (Math.random() * 1.4 + 0.4) * (Math.random() < 0.5 ? -1 : 1);
    const cx = center.x;
    const cy = center.y;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    return { angle, radius, speed, cx, cy, prev: { x: x - Math.cos(angle) * backstep, y: y - Math.sin(angle) * backstep } };
  });

  function step(now) {
    if (!lastTime) lastTime = now;
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    //const coords = [];
    for (const p of parts) {
      p.angle += p.speed * dt;
      const x = p.cx + Math.cos(p.angle) * p.radius;
      const y = p.cy + Math.sin(p.angle) * p.radius;
      const prev = p.prev || { x, y };
      const dx = x - prev.x;
      const dy = y - prev.y;
      p.prev = { x, y };
      pushSplatToSim(sim, x, y, dx, dy, null);
    }
    raf = requestAnimationFrame(step);
  }

  return {
    start() {
      if (raf) return;
      lastTime = 0;
      raf = requestAnimationFrame(step);
    },
    stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    },
  };
}

/**
 * Global drift preset — many small particles drift across the whole canvas with local orbiting motion.
 * createGlobalDriftPreset(sim, { count = 10, driftSpeed = 0.02 })
 * returns { start(), stop() }
 */
export function createGlobalDriftPreset(sim, opts = {}) {
  const { count = 10, driftSpeed = 0.02 } = opts;
  let raf = null;
  let lastTime = 0;
  const parts = Array.from({ length: count }).map(() => {
    const cx = Math.random();
    const cy = Math.random();
    const vx = (Math.random() * 2 - 1) * driftSpeed;
    const vy = (Math.random() * 2 - 1) * driftSpeed;
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.015 + Math.random() * 0.06;
    const speed = (Math.random() * 1.5 + 0.2) * (Math.random() < 0.5 ? 1 : -1);
    return { cx, cy, vx, vy, angle, radius, speed, prev: { x: cx, y: cy } };
  });

  function step(now) {
    if (!lastTime) lastTime = now;
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    for (const p of parts) {
      p.cx = (p.cx + p.vx * dt + 1.0) % 1.0;
      p.cy = (p.cy + p.vy * dt + 1.0) % 1.0;
      p.angle += p.speed * dt;
      const x = p.cx + Math.cos(p.angle) * p.radius;
      const y = p.cy + Math.sin(p.angle) * p.radius;
      const prev = p.prev || { x, y };
      const dx = x - prev.x;
      const dy = y - prev.y;
      p.prev = { x, y };
      pushSplatToSim(sim, x, y, dx, dy, null);
    }
    raf = requestAnimationFrame(step);
  }

  return {
    start() {
      if (raf) return;
      lastTime = 0;
      raf = requestAnimationFrame(step);
    },
    stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    },
  };
}

// Convenience export of available presets
export const presets = {
  orbiting: createOrbitingPreset,
  globalDrift: createGlobalDriftPreset,
};

// export helper so consumers (hooks) can reuse same color logic
export { hsvToRgb, getHue };
