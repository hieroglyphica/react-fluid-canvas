# Configuration Options

Edit `src/config/simulationConfig.js` to set global defaults. You can also pass a `config` prop to <FluidSimulation /> to override per instance.

Below is the full list of options, a short description, allowed ranges / options, and the default value.

| Option | Description | Range / Options | Default |
|---|---:|---|---:|
| SIM_RESOLUTION | Velocity simulation grid size | 32 \| 64 \| 128 \| 256 | 256 |
| DYE_RESOLUTION | Dye texture resolution | 256 \| 512 \| 1024 \| 2048 | 2048 |
| DENSITY_DISSIPATION | How quickly dye fades | 0.0 .. 1.0 | 0.99 |
| VELOCITY_DISSIPATION | How quickly velocity decays | 0.0 .. 1.0 | 0.99 |
| PRESSURE_ITERATIONS | Jacobi iterations for pressure solve | ~8 .. 48 | 30 |
| CURL | Vorticity strength (turbulence) | 0 .. 50 | 1 |
| SPLAT_RADIUS | Interactive splat radius (normalized) | ~0.001 .. 0.03 | 0.005 |
| SPLAT_FORCE | Force multiplier for splats | 1000 .. 10000 | 3500 |
| SHADING | Enable pseudo-3D shading | boolean | true |
| COLORFUL | Enable automatic color cycling | boolean | true |
| COLOR_THEME | Color behavior: 'default' \| number \| [min,max] | 'default' \| 0..1 \| [min,max] | 'default' |
| BACK_COLOR | Background color RGB | object {r,g,b} 0..255 | { r:0, g:0, b:0 } |
| TRANSPARENT | Render transparent background | boolean | false |
| AURA | Enable bloom / glow effect | boolean | false |
| AURA_RESOLUTION | Aura (bloom) texture resolution | 64 \| 128 \| 196 \| 256 | 196 |
| AURA_WEIGHT | Aura / bloom intensity | 0.0 .. 8.0 | 2.5 |
| RAY_AURA | Enable volumetric light rays | boolean | false |
| RAY_AURA_RESOLUTION | Ray aura texture resolution | 64 \| 128 \| 196 \| 256 | 196 |
| RAY_AURA_WEIGHT | Ray aura intensity | 0.0 .. 1.0 | 0.5 |
| BRIGHTNESS | Global brightness multiplier | 0.5 .. 2.5 | 1.7 |
| IOS_FILTER | Manual filter selection: null=auto, true/false overrides | null \| true \| false | null |
| DISPLAY_USE_BICUBIC | Use bicubic resampling in display shader | boolean | true |
| DISPLAY_USE_BICUBIC_UPSCALE_ONLY | Bicubic only when upscaling final output | boolean | true |
| IOS_ENABLE_BICUBIC_ON_IOS | Allow bicubic specifically on iOS | boolean | true |
| IOS_SIMULATE_NO_FLOAT_LINEAR | Simulate missing float-linear (testing) | boolean | false |
| IOS_DPR_CAP | Cap devicePixelRatio on iOS (null = default cap) | null or number (e.g. 1, 1.5, 2) | null |
| DISPLAY_TO_RGBA8 | Render display output to 8-bit intermediate (helps iOS) | boolean | true |
| FINAL_NEAREST_UPSCALE | Use NEAREST for final upscale (crisper) | boolean | false |
| AUTO_DYE_RESOLUTION | Auto-pick dye texture size from canvas backing | boolean | true |
| MAX_DYE_UPSCALE | Max allowed display/dye upscale factor | >= 1.0 (typ. 2..4) | 3.0 |
| IOS_SHARPEN_AMOUNT | Sharpen amount for 8-bit fallback (unsharp mask) | 0.0 .. 1.0 | 0.18 |
| QUALITY | Preset quality level (applies SIM/DYE/PRESSURE/CURL) | 'low' \| 'medium' \| 'high' \| 'ultra' | 'medium' |
| DEBUG_OVERLAY | Show on-screen diagnostic overlay | boolean | ~true~ false |
| COORDINATE_THROTTLE_MS | Milliseconds between processing incoming `coordinates` prop batches (throttling) | number >= 0 | 40 |
| COORDINATE_MIN_DELTA | Minimum motion magnitude (after SPLAT_FORCE scaling) required to emit a splat; tiny moves are ignored | number >= 0 | 1e-5 |
| COORDINATE_MAX_STEP | Maximum normalized coordinate distance per emitted sub-splat when smoothing consumer coordinates (smaller => more substeps) | number > 0 | 0.02 |
| COORDINATE_MAX_SUBSTEPS | Hard cap on the number of interpolation substeps emitted for a single coordinate update (prevents runaway splats) | integer >= 1 | 8 |

Notes:
- Ranges above are informational only (no runtime enforcement) — use them as guidance.
- Developer/testing flags:
  - `IOS_SIMULATE_NO_FLOAT_LINEAR` is a development helper (default OFF). It can be enabled in local builds to exercise the 8-bit fallback path.
  - `DEBUG_OVERLAY` is available but defaults to OFF in the canonical config; toggle it via `src/config/simulationConfig.js`.
- For production builds keep test flags disabled. To enable dev-only behavior locally set NODE_ENV=development or set the option directly in `src/config/simulationConfig.js`.

Examples
- To force manual filter mode on all devices: `IOS_FILTER: true`
- To avoid large upscales on small dye buffers: enable `AUTO_DYE_RESOLUTION` and/or lower `MAX_DYE_UPSCALE`.

New: component props and animation presets

Props summary
- config: object overriding defaults from `src/config/simulationConfig.js`.
- coordinates: object or array of objects with shape:
  - x: number (0..1) — horizontal position (origin top-left)
  - y: number (0..1) — vertical position (origin top-left)
  - dx?: number — normalized delta X between frames (will be scaled by config.SPLAT_FORCE)
  - dy?: number — normalized delta Y between frames
  - color?: [r,g,b] — optional RGB (0..1) color hint; otherwise computed from config.COLORFUL/ COLOR_THEME

Notes on coordinates:
- Passing a single object will enqueue one splat; passing an array enqueues multiple splats in the same update.
- The hook applies SPLAT_FORCE from the config to scale raw dx/dy into simulation velocity.
- The library converts consumer-space (x,y) into internal texcoords (y is flipped) before adding splats.

Presets
- orbiting: a small set of particles orbiting a center.
  - options: { count = 3, center = { x: 0.5, y: 0.5 }, backstep = 0.002 }
- globalDrift: many particles drifting across the whole canvas.
  - options: { count = 10, driftSpeed = 0.02 }

Usage
- To auto-start a preset set `preset` and `autoPlay: true` on the component.
- Example: `<FluidSimulation preset="orbiting" presetOptions={{count:4, center:{x:0.5,y:0.5}}} autoPlay />`

Props vs programmatic control
- The primary public surface is props. Use `config`, `coordinates`, and `preset` for most use-cases.
- Presets provide reusable animations without requiring consumers to implement per-frame logic.
- If you need finer runtime control in the future, consider adding an explicit callback/ref API; for now props keep the public API small and declarative.

Controller API (ref)
- If you need imperative control, pass a ref to the component and call methods:
  - startPreset(name, opts) — start a built-in preset
  - stopPreset() — stop active preset
  - splat(x, y, dx?, dy?, color?) — programmatic splat (x,y in 0..1; dx/dy normalized deltas)
  - multipleSplats(n) — emit n random splats
  - setConfig(partial) — apply runtime config changes