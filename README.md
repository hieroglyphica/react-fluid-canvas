# React Fluid Canvas

A lightweight GPU-powered fluid simulation component for React using WebGL shaders with optional post-processing (bloom, rays) and iOS-friendly fallbacks.

![React Fluid Canvas Demo](https://raw.githubusercontent.com/hieroglyphica/react-fluid-canvas/main/docs/assets/demo.gif)

[![npm version](https://img.shields.io/npm/v/react-fluid-canvas.svg)](https://www.npmjs.com/package/react-fluid-canvas)
[![React 19](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![build manual](https://img.shields.io/badge/build-manual-yellow.svg)](#)

Repository: https://github.com/hieroglyphica/react-fluid-canvas

Table of Contents
- [Quickstart](#quickstart)
- [Configuration](#configuration)
- [Highlights](#highlights)
- [Status](#status)
- **Last Stable**: 0.1.17
- [Publishing](#publishing)
- [Contributing](#contributing)

Live demo: https://temporal-codex.web.app/fluid

## Quickstart

1. Install:
   ```bash
   yarn add react-fluid-canvas
   # or
   npm install react-fluid-canvas
   ```

2. Use:
```jsx
import FluidSimulation from "react-fluid-canvas";

function App() {
  return (
    <div style={{ height: "100vh" }}>
      <FluidSimulation
        config={{
          SIM_RESOLUTION: 128,
          DYE_RESOLUTION: 1024,
          DENSITY_DISSIPATION: 0.97,
          VELOCITY_DISSIPATION: 0.98,
          PRESSURE_ITERATIONS: 20,
          CURL: 20,
          SPLAT_RADIUS: 0.01,
        }}
      />
    </div>
  );
}
```

New props overview
- config: Override canonical defaults (see `src/config/simulationConfig.js`).
- coordinates: Single object or array of { x, y, dx?, dy?, color? } (x,y normalized 0..1 origin top-left). dx/dy are normalized motion deltas; they will be scaled by config.SPLAT_FORCE by the library.
- preset: Start a built-in animation preset automatically when used with autoPlay. Supported presets: "orbiting", "globalDrift". Additionally, `preset` may be a factory function (see "Custom preset functions" below).
- presetOptions: Object passed to the preset factory (e.g. { count, center, driftSpeed }).
- autoPlay: boolean to start the selected preset automatically.

Example — start a built-in preset on mount (declarative)
```jsx
<!-- filepath: c:\Sandbox\react-fluid-canvas\README.md -->
<FluidSimulation
  preset="orbiting"
  autoPlay={true}
  presetOptions={{ count: 4, center: { x: 0.5, y: 0.5 }, backstep: 0.002 }}
  config={{ COLORFUL: true }}
/>
```
Note: Because the component accepts `preset` + `autoPlay` props, the preset will be started by the hook when the simulation is ready — you do not need a useEffect just to auto-start a preset.

Custom preset functions (declarative or imperative)
- You can pass a factory function as the `preset` prop (declarative + autoPlay), or call `startPreset(fn, opts)` imperatively on the component ref.
- A preset factory receives the simulation instance and options and should return an object with start() and stop().

Note: memoize presetOptions and preset factories
- To avoid restarting an active preset accidentally, keep `presetOptions` and any custom preset factory references stable with React hooks:
```jsx
// filepath: c:\Sandbox\react-fluid-canvas\README.md
const presetOptions = useMemo(() => ({ count: 4, center: { x: 0.5, y: 0.5 } }), []);
const myPresetFactory = useCallback((sim, opts) => { /* ... */ }, []);
<FluidSimulation preset="orbiting" presetOptions={presetOptions} />
```

Example custom preset factory (clean, copy/paste-ready):
```jsx
// filepath: c:\Sandbox\react-fluid-canvas\README.md
function myCustomPreset(sim, opts = {}) {
  // gentle wandering pointer-like splats
  const speed = Number(opts.speed) || 0.7;
  const amplitude = Number(opts.amplitude) || 0.2;
  let raf = null;
  let t0 = 0;
  let prev = null;

  const hsvToRgbSimple = (h) => {
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = 0, q = 1 - f, t = f;
    switch (i % 6) {
      case 0: return [1, t, p];
      case 1: return [q, 1, p];
      case 2: return [p, 1, t];
      case 3: return [p, q, 1];
      case 4: return [t, p, 1];
      default: return [1, p, q];
    }
  };

  function step(now) {
    if (!t0) t0 = now;
    const tt = (now - t0) / 1000;
    const x = 0.5 + Math.sin(tt * speed * 0.7) * amplitude;
    const y = 0.5 + Math.cos(tt * speed * 1.1) * amplitude * 0.7;
    const nx = Math.max(0.02, Math.min(0.98, x));
    const ny = Math.max(0.02, Math.min(0.98, y));
    if (!prev) prev = { x: nx, y: ny };
    const rawDx = nx - prev.x;
    const rawDy = ny - prev.y;
    prev = { x: nx, y: ny };

    try {
      const forceMul = Number((sim.config && sim.config.SPLAT_FORCE) || 1);
      const dx = rawDx * forceMul;
      const dy = rawDy * forceMul;
      const motion = Math.hypot(rawDx, rawDy);
      const speedVal = Math.min(motion * 4.0 * 1.15, 1.0); // slight brightness bump

      let color = [0.3 * speedVal, 0.3 * speedVal, 0.3 * speedVal];
      if (sim.config && sim.config.COLORFUL) {
        let angle = Math.atan2(rawDy, rawDx);
        if (!Number.isFinite(angle)) angle = 0;
        const hue = (angle / (2 * Math.PI) + 0.5) % 1.0;
        const rgb = hsvToRgbSimple(hue);
        color = [rgb[0] * speedVal, rgb[1] * speedVal, rgb[2] * speedVal];
      }

      sim.addSplat({
        texcoordX: nx,
        texcoordY: 1.0 - ny,
        deltaX: dx,
        deltaY: dy,
        color,
      });
    } catch (_e) {
      // ignore if sim not ready
    }

    raf = requestAnimationFrame(step);
  }

  return {
    start() {
      if (raf) return;
      prev = null;
      t0 = 0;
      raf = requestAnimationFrame(step);
    },
    stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    },
  };
}
```

Presets
- orbiting: a small set of particles orbiting a center.
  - options: { count = 3, center = { x: 0.5, y: 0.5 }, backstep = 0.002 }
- globalDrift: many particles drifting across the whole canvas.
  - options: { count = 10, driftSpeed = 0.02 }
- bouncingRoamer: a single gentle agent that traverses the whole canvas, bounces off edges, and slightly varies speed.
  - options: { speed = 0.4, jitter = 0.006, damping = 0.98, color = null }
- tempoPulse: beat-driven center pulses (good for music with clear beats).
  - options: { bpm = 60, beatIntensity = 0.8, radius = 0.08 }
- frequencyBands: map frequency-band amplitudes to horizontal bands of splats (good for electronic / spectral visuals).
  - options: { count = 6, audioBands = [a0,a1,...], color = null }
- classicalFlow: slow, graceful arcs tuned for classical music dynamics.
  - options: { count = 4, amplitude = 0.28, speed = 0.25, color = null }
- bassPulse: low-frequency center pulses / crescendos.
  - options: { center = {x:0.5,y:0.6}, pulseRate = 0.6, strength = 0.9 }
- ambientDrift: very slow, soft motion for ambient/chill music.
  - options: { count = 6, speed = 0.08, amplitude = 0.35 }

Audio integration hint
- The presets accept simple opts (bpm, beatIntensity, audioBands, bass/mids/highs). To make them truly audio-reactive, feed an audio analyzer (WebAudio AnalyserNode / FFT) and pass aggregated features into presetOptions or call controller.splat(...) from an rAF-driven audio callback.

## Configuration

The simulation config object is passed to the `FluidSimulation` component and can be overridden by the `config` prop. It contains the following fields:

- SIM_RESOLUTION: The resolution of the simulation grid (default: 128).
- DYE_RESOLUTION: The resolution of the dye grid (default: 1024).
- DENSITY_DISSIPATION: The density dissipation rate (default: 0.97).
- VELOCITY_DISSIPATION: The velocity dissipation rate (default: 0.98).
- PRESSURE_ITERATIONS: The number of pressure iterations (default: 20).
- CURL: The number of curl iterations (default: 20).
- SPLAT_RADIUS: The radius of the splat (default: 0.01).
- COLORFUL: Whether the simulation is colorful (default: false).
- SPLAT_FORCE: The force applied to the splats (default: 1).

Important: heavy config changes
- Some config keys require framebuffer or quality changes that reinitialize parts of the simulation pipeline. These updates are applied in-place (the WebGL context and simulation instance are preserved), but you may observe a brief visual reinit. Keys that commonly trigger a reinit:
  - SIM_RESOLUTION, DYE_RESOLUTION, QUALITY
  - AURA, AURA_RESOLUTION, RAY_AURA, RAY_AURA_RESOLUTION
  - DISPLAY_TO_RGBA8, IOS_DPR_CAP
- For interactive testing prefer runtime-friendly keys (DENSITY_DISSIPATION, CURL, SPLAT_FORCE). Memoize presetOptions and preset factory functions to avoid restarting an active preset when updating other props.

## Status

The simulation is running and updating the canvas in real-time. The component will automatically stop when the canvas is unmounted.

## Publishing

The simulation is published on the web and available for public use.

## Contributing

The simulation is open source and available for public contribution. Please see the [CONTRIBUTING.md](CONTRIBUTING.md) file for details.

Live demo: https://temporal-codex.web.app/fluid
