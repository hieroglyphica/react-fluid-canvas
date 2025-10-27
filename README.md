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
Notes
- Canonical defaults live at: `src/config/simulationConfig.js`
- Human-readable option reference: [CONFIGURATION.md](./CONFIGURATION.md)
- Runtime changelog: [CHANGELOG.md](./CHANGELOG.md)

Highlights
- Hardware-accelerated fluid simulation with optional bloom (AURA) and volumetric rays (RAY_AURA).
- iOS-friendly fallbacks (8-bit intermediate path, manual filtering).
- Fine-grained runtime config via the `config` prop or by editing `src/config/simulationConfig.js`.
- Now compatible with React 19!

Status
- **Next Version**: Unreleased
- **Last Stable**: 0.1.14
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
