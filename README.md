# React Fluid Canvas

A lightweight GPU-powered fluid simulation component for React using WebGL shaders with optional post-processing (bloom, rays) and iOS-friendly fallbacks.

![React Fluid Canvas Demo](https://raw.githubusercontent.com/hieroglyphica/react-fluid-canvas/main/docs/assets/demo.gif)

[![npm version](https://img.shields.io/npm/v/react-fluid-canvas.svg)](https://www.npmjs.com/package/react-fluid-canvas)
[![React 19](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![build manual](https://img.shields.io/badge/build-manual-yellow.svg)](#)

Repository: https://github.com/hieroglyphica/react-fluid-canvas

Table of Contents
- Quickstart
- Configuration
- Highlights
- Status
- Publishing
- Contributing

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
import Fluid from "react-fluid-canvas";

function App() {
  return (
    <div style={{ height: "100vh" }}>
      <Fluid
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
- preset: Start a built-in animation preset automatically when used with autoPlay. Supported presets: "orbiting", "globalDrift".
- presetOptions: Object passed to the preset factory (e.g. { count, center, driftSpeed }).
- autoPlay: boolean to start the selected preset automatically.

Example — start a built-in preset on mount
```jsx
// PresetAutoPlay.jsx
import Fluid from "react-fluid-canvas";

export default function PresetAutoPlay() {
  return (
    <div style={{height: "100vh"}}>
      <Fluid
        preset="orbiting"
        autoPlay={true}
        presetOptions={{ count: 4, center: { x: 0.5, y: 0.5 }, backstep: 0.002 }}
        config={{ COLORFUL: true }}
      />
    </div>
  );
}
```

Example — animate programmatically by updating coordinates prop
```jsx
// CoordinatesDemo.jsx
import { useState, useEffect } from "react";
import Fluid from "react-fluid-canvas";

export default function CoordinatesDemo() {
  const [coords, setCoords] = useState({ x: 0.5, y: 0.5, dx: 0, dy: 0 });

  useEffect(() => {
    let t = 0;
    const id = setInterval(() => {
      t += 0.06;
      const x = 0.5 + 0.35 * Math.cos(t);
      const y = 0.5 + 0.35 * Math.sin(t);
      const dx = Math.cos(t) * 0.002;
      const dy = Math.sin(t) * 0.002;
      setCoords({ x, y, dx, dy, color: [1, 0.6, 0.2] });
    }, 60);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{height: "100vh"}}>
      <Fluid config={{ SPLAT_FORCE: 3500 }} coordinates={coords} />
    </div>
  );
}
```

Programmatic controller (optional, recommended)
- Use a component ref to call imperative methods (startPreset, stopPreset, splat, multipleSplats, setConfig, getDiagnostics, pause, resume).

Example:
```jsx
import { useRef, useEffect } from "react";
import Fluid from "react-fluid-canvas";

export default function WithController() {
  const fluidRef = useRef(null);

  useEffect(() => {
    if (!fluidRef.current) return;
    // start built-in preset
    fluidRef.current.startPreset("orbiting", { count: 4, center: { x: 0.5, y: 0.5 } });
    // after 5s pause, then resume
    const t = setTimeout(() => { fluidRef.current.pause(); }, 5000);
    const t2 = setTimeout(() => { fluidRef.current.resume(); }, 8000);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, []);

  return <Fluid ref={fluidRef} config={{ COLORFUL: true }} />;
}
```

Notes
- For multi-splat frames pass an array to `coordinates`.
- The library now favors props for configuration and simple animations. Programmatic control via callbacks/refs is intentionally minimal in this release; presets are the recommended reusable building blocks.

Highlights
- Hardware-accelerated fluid simulation with optional bloom (AURA) and volumetric rays (RAY_AURA).
- iOS-friendly fallbacks (8-bit intermediate path, manual filtering).
- Fine-grained runtime config via the `config` prop or by editing `src/config/simulationConfig.js`.
- Now compatible with React 19!

Status
- **Next Version**: Unreleased
- **Last Stable**: 0.1.16
- Live demo: https://temporal-codex.web.app/fluid
- Demo GIF included at: `docs/assets/demo.gif` (this folder is included in published packages).

Publish checklist
Before publishing:
- Update package version (e.g. `yarn version --patch`).
- Install and lint: `yarn install && yarn lint`.
- Build: `yarn build`.
- Verify packaged files: `yarn pack` and inspect the .tgz (ensure `dist`, types and `docs/assets/demo.gif` are present).
- Smoke test in a fresh project if possible.

Contributing
- See `CONTRIBUTING.md` (if present) or open an issue/PR on the repo.
- Keep changelog entries minimal and link to the release tag when publishing.

License: MIT
