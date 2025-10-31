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
    return (angle / (2 * Math.PI) + 0.5 + (Date.now() / 1000.0) * 0.1) % 1.0;
  }
  if (typeof theme === "number") return theme;
  if (Array.isArray(theme)) {
    const [min, max] = theme;
    const baseHue = (angle / (2 * Math.PI) + 0.5 + (Date.now() / 1000.0) * 0.1) % 1.0;

    // Handle the full spectrum case [0, 1] or [1, 0]
    if (Math.abs(max - min) >= 1.0) {
      return baseHue;
    }

    // Calculate range, handling wrapped cases (e.g., 0.9 to 0.2)
    let range = max - min;
    if (range < 0) {
      range += 1.0;
    }
    return (min + baseHue * range) % 1.0;
  }
  return Math.random();
}

function pushSplatToSim(sim, x, y, rawDx, rawDy, colorHint) {
  const cfg = sim && sim.config ? sim.config : {};
  const forceMul = Number(cfg.SPLAT_FORCE || 1);
  const dx = rawDx * forceMul;
  const dy = rawDy * forceMul;

  const speed = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
  const brightness = Math.min(speed * 8.0, 1.0);

  let colorArr = null;
  if (Array.isArray(colorHint) && colorHint.length >= 3) {
    colorArr = [
      Number(colorHint[0]) * brightness,
      Number(colorHint[1]) * brightness,
      Number(colorHint[2]) * brightness,
    ];
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
    const speed =
      (Math.random() * 1.4 + 0.4) * 0.55 * (Math.random() < 0.5 ? -1 : 1);
    const cx = center.x;
    const cy = center.y;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    return {
      angle,
      radius,
      speed,
      cx,
      cy,
      prev: {
        x: x - Math.cos(angle) * backstep,
        y: y - Math.sin(angle) * backstep,
      },
    };
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

// New: Bouncing roamer preset — single agent that traverses full canvas, bounces off edges,
// slightly modulates its speed, and emits splats via pushSplatToSim.
// createBouncingRoamerPreset(sim, { speed = 0.4, jitter = 0.01, damping = 0.9, color = null })
export function createBouncingRoamerPreset(sim, opts = {}) {
	const {
		speed = 0.4, // normalized units/sec baseline (smaller -> slower)
		jitter = 0.006, // per-frame random velocity jitter (normalized)
		damping = 0.98, // velocity retention on bounce (1.0 = perfect elastic)
		color = null,
	} = opts;

	let raf = null;
	let lastTime = 0;

	// start near center with random direction
	let x = 0.5 + (Math.random() - 0.5) * 0.2;
	let y = 0.5 + (Math.random() - 0.5) * 0.2;
	let vx = (Math.random() * 2 - 1) * speed;
	let vy = (Math.random() * 2 - 1) * speed;

	function step(now) {
		if (!lastTime) lastTime = now;
		const dt = Math.min(0.032, (now - lastTime) / 1000);
		lastTime = now;

		// slight velocity modulation + jitter
		vx += (Math.random() - 0.5) * jitter;
		vy += (Math.random() - 0.5) * jitter;

		// apply small acceleration/decay so speed breathes a little
		const speedFactor = 1.0 + Math.sin(now * 0.001) * 0.02;
		vx *= speedFactor;
		vy *= speedFactor;

		// integrate
		x += vx * dt;
		y += vy * dt;

		// bounce on edges with damping
		if (x < 0.02) { x = 0.02; vx = -vx * damping; }
		if (x > 0.98) { x = 0.98; vx = -vx * damping; }
		if (y < 0.02) { y = 0.02; vy = -vy * damping; }
		if (y > 0.98) { y = 0.98; vy = -vy * damping; }

		// emit a splat scaled to instantaneous motion (use pushSplatToSim to reuse color logic)
		const dx = vx * dt;
		const dy = vy * dt;
		try {
			pushSplatToSim(sim, x, y, dx, dy, color);
		} catch (_e) {
			/* ignore if sim not ready */
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

// --- music-friendly presets ---
// expected opts.audio = { bpm, beatIntensity, bass, mids, highs } (all optional, 0..1 or numbers)
// fallback behavior: if no audio provided, presets use their own gentle defaults.

// Tempo/beat pulse: emits periodic center splats synced to bpm / beatIntensity
export function createTempoPulsePreset(sim, opts = {}) {
	const { bpm = 60, beatIntensity = 0.8, radius = 0.08, color = null } = opts;
	let raf = null;
	let last = 0;
	let phase = 0;
	const beatPeriod = 60 / Math.max(1, bpm);

	function step(now) {
		if (!last) last = now;
		const t = (now - last) / 1000;
		last = now;
		phase += t;
		// when phase crosses beatPeriod, emit a stronger pulse
		if (phase >= beatPeriod) {
			const strength = Math.min(1, beatIntensity);
			phase = phase % beatPeriod;
			try {
				// emit a few concentric splats for a richer pulse
				for (let i = 0; i < 3; i++) {
					// scale per-splat jitter by radius (and an index-based multiplier) so radius is used
					const scale = radius * (1 + i * 0.6);
					pushSplatToSim(
						sim,
						0.5,
						0.5,
						(Math.random() - 0.5) * 0.001 * strength * scale,
						(Math.random() - 0.5) * 0.001 * strength * scale,
						color
					);
				}
			} catch (_e) {
				/* ignore */
			}
		}
		raf = requestAnimationFrame(step);
	}
	return {
		start() { if (raf) return; last = 0; phase = 0; raf = requestAnimationFrame(step); },
		stop() { if (raf) cancelAnimationFrame(raf); raf = null; },
	};
}

// Frequency bands mapped across width — good for electronic / rhythmic music.
// opts.count = number of bands; opts.audioBands = [b0,b1,..] amplitudes 0..1, or provide audio:{bass,mids,highs}
export function createFrequencyBandsPreset(sim, opts = {}) {
	const { count = 6, audioBands = null, color = null } = opts;
	let raf = null;
	let last = 0;

	function step(now) {
		if (!last) last = now;
		// removed unused 'dt' variable
		last = now;
		// derive band amplitudes from audioBands or synthetic motion
		const bands = Array.from({ length: count }).map((_, i) => {
			if (Array.isArray(audioBands) && audioBands[i] != null) return Math.min(1, Math.max(0, audioBands[i]));
			// fallback: slow oscillation per band
			return 0.25 + 0.2 * Math.sin(now * 0.001 * (0.5 + i * 0.3));
		});

		for (let i = 0; i < count; i++) {
			const amp = bands[i];
			if (amp < 0.02) continue;
			const x = (i + 0.5) / count;
			const y = 0.5 + (Math.random() - 0.5) * 0.12;
			// dx/dy scale with amp to make higher amplitude bands look more energetic
			const dx = (Math.random() - 0.5) * 0.002 * amp;
			const dy = (Math.random() - 0.5) * 0.002 * amp;
			// emit multiple small splats per band
			try {
				pushSplatToSim(sim, x, y, dx, dy, color);
				if (amp > 0.5) pushSplatToSim(sim, x + (Math.random()-0.5)*0.02, y + (Math.random()-0.5)*0.02, dx*0.5, dy*0.5, color);
			} catch (_e) {
				/* ignore */
			}
		}

		raf = requestAnimationFrame(step);
	}

	return {
		start() { if (raf) return; last = 0; raf = requestAnimationFrame(step); },
		stop() { if (raf) cancelAnimationFrame(raf); raf = null; },
	};
}

// ClassicalFlow: slow, wide, graceful arcs — suited to classical music.
// Emits slow orbiting splats with gentle brightness modulation.
export function createClassicalFlowPreset(sim, opts = {}) {
	const { count = 4, amplitude = 0.28, speed = 0.25, color = null } = opts;
	let raf = null;
	let last = 0;
	const parts = Array.from({ length: count }).map((i) => {
		const angle = (i / count) * Math.PI * 2;
		const radius = 0.25 * (0.6 + Math.random() * 0.8);
		const phase = Math.random() * Math.PI * 2;
		return { angle, radius, phase, offset: 0.1 * (Math.random() - 0.5) };
	});

	function step(now) {
		if (!last) last = now;
		const dt = (now - last) / 1000;
		last = now;
		for (const p of parts) {
			p.phase += dt * speed * (0.6 + Math.random() * 0.8);
			const x = 0.5 + Math.cos(p.phase + p.angle) * p.radius * amplitude;
			const y = 0.5 + Math.sin(p.phase + p.angle) * p.radius * amplitude * 0.8 + p.offset;
			const dx = (Math.cos(p.phase) * 0.0008) * (Math.random() * 0.6 + 0.7);
			const dy = (Math.sin(p.phase) * 0.0008) * (Math.random() * 0.6 + 0.7);
			try { pushSplatToSim(sim, x, y, dx, dy, color); } catch (_e) { /* ignore */ }
		}
		raf = requestAnimationFrame(step);
	}
	return {
		start() { if (raf) return; last = 0; raf = requestAnimationFrame(step); },
		stop() { if (raf) cancelAnimationFrame(raf); raf = null; },
	};
}

// BassPulse: heavy low-frequency pulsing (good for classical crescendos or electronic bass)
export function createBassPulsePreset(sim, opts = {}) {
	const { center = { x: 0.5, y: 0.6 }, pulseRate = 0.6, strength = 0.9, color = null } = opts;
	let raf = null;
	let last = 0;
	let phase = 0;

	function step(now) {
		if (!last) last = now;
		const dt = (now - last) / 1000;
		last = now;
		phase += dt;
		// gentle sinusoidal pulse
		const val = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2 * pulseRate);
		if (val > 0.6) {
			const intensity = (val - 0.6) / 0.4 * strength;
			try {
				// emit a focused splat whose delta scales with intensity
				pushSplatToSim(sim, center.x + (Math.random()-0.5)*0.02, center.y + (Math.random()-0.5)*0.02, (Math.random()-0.5)*0.004*intensity, (Math.random()-0.5)*0.004*intensity, color);
			} catch (_e) { /* ignore */ }
		}
		raf = requestAnimationFrame(step);
	}
	return {
		start() { if (raf) return; last = 0; phase = 0; raf = requestAnimationFrame(step); },
		stop() { if (raf) cancelAnimationFrame(raf); raf = null; },
	};
}

// Ambient drift: very slow, soft splats across the whole surface for ambient / chill music
export function createAmbientDriftPreset(sim, opts = {}) {
	const { count = 6, speed = 0.08, amplitude = 0.35, color = null } = opts;
	let raf = null;
	let last = 0;
	const parts = Array.from({ length: count }).map(() => ({
		angle: Math.random() * Math.PI * 2,
		radius: 0.1 + Math.random() * amplitude,
		speed: speed * (0.6 + Math.random() * 0.8),
		phase: Math.random() * Math.PI * 2,
	}));

	function step(now) {
		if (!last) last = now;
		const dt = (now - last) / 1000;
		last = now;
		for (const p of parts) {
			p.phase += dt * p.speed;
			const x = 0.5 + Math.cos(p.phase + p.angle) * p.radius;
			const y = 0.5 + Math.sin(p.phase + p.angle) * p.radius * 0.9;
			const dx = (Math.cos(p.phase) * 0.0004) * (Math.random() * 0.6 + 0.6);
			const dy = (Math.sin(p.phase) * 0.0004) * (Math.random() * 0.6 + 0.6);
			try { pushSplatToSim(sim, x, y, dx, dy, color); } catch (_e) { /* ignore */ }
		}
		raf = requestAnimationFrame(step);
	}
	return {
		start() { if (raf) return; last = 0; raf = requestAnimationFrame(step); },
		stop() { if (raf) cancelAnimationFrame(raf); raf = null; },
	};
}

// add new presets to export map (insert into existing presets object)
export const presets = {
	orbiting: createOrbitingPreset,
	globalDrift: createGlobalDriftPreset,
	bouncingRoamer: createBouncingRoamerPreset,
	tempoPulse: createTempoPulsePreset,
	frequencyBands: createFrequencyBandsPreset,
	classicalFlow: createClassicalFlowPreset,
	bassPulse: createBassPulsePreset,
	ambientDrift: createAmbientDriftPreset,
};

// export helper so consumers (hooks) can reuse same color logic
export { hsvToRgb, getHue };
