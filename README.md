# React Fluid Canvas

A lightweight GPU-powered fluid simulation component for React. Uses WebGL shaders for simulation and rendering with optional post-processing (bloom, rays) and iOS-friendly fallbacks.

Demo: see repository or packaged demo page.

Quickstart
- npm install react-fluid-canvas
- Import and mount the component; it fills its parent container.

Usage
```jsx
import FluidSimulation from "react-fluid-canvas";
// optional: import a shared config (single source of truth)
import { config as defaultConfig } from "./config/simulationConfig";

function App() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <FluidSimulation config={defaultConfig} />
    </div>
  );
}
```

Configuration and defaults
- All runtime configuration lives in `src/config/simulationConfig.js`. Edit that file to change defaults for the packaged component.
- You may still pass a `config` prop to override defaults per instance.

New and notable options
- DISPLAY_TO_RGBA8 — Render to an 8-bit intermediate (useful on iOS to leverage HW filtering).
- IOS_SHARPEN_AMOUNT — Small unsharp-mask applied when using 8-bit fallback.
- DISPLAY_USE_BICUBIC / DISPLAY_USE_BICUBIC_UPSCALE_ONLY — Optional higher-quality resampling for final display.
- AUTO_DYE_RESOLUTION / MAX_DYE_UPSCALE — Avoid extreme upscaling artifacts by sizing dye buffers sensibly.

See CONFIGURATION.md below for a full table of options (description, allowed ranges, and defaults).

Notes
- The component auto-detects WebGL capabilities; on devices lacking float-linear support it will use the configured fallback path.
- A runtime debug overlay is available but disabled by default; enable it by setting `DEBUG_OVERLAY: true` in src/config/simulationConfig.js to inspect renderer and config diagnostics.
- Developer/testing flags (for example `IOS_SIMULATE_NO_FLOAT_LINEAR`) remain available for debugging purposes but are OFF by default in the shipped config.
- The repo includes shaders and a small debug overlay to help diagnose platform-specific rendering problems.

License: MIT
