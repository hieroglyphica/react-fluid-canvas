# React Fluid Canvas

A lightweight GPU-powered fluid simulation component for React using WebGL shaders with optional post-processing (bloom, rays) and iOS-friendly fallbacks.

<!-- Demo screenshot -->
<p align="center">
  <img src="./docs/assets/demo.gif" alt="React Fluid Canvas demo" style="max-width:100%; height:auto; border-radius:8px; box-shadow:0 8px 30px rgba(0,0,0,0.6)" />
</p>

<!-- Badges -->
+[![npm version](https://img.shields.io/npm/v/react-fluid-canvas.svg)](https://www.npmjs.com/package/react-fluid-canvas)
+[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
+[![build status](https://img.shields.io/badge/build-manual-yellow.svg)](#) <!-- replace with CI badge when available -->

<!-- Table of Contents -->
+- [Quickstart](#quickstart)
+- [Configuration and defaults](#configuration-and-defaults)
+- [Highlights](#highlights)
+- [Status](#status)
+- [Publish checklist](#publish-checklist)
+- [Contributing / notes](#contributing--notes)

Live demo: https://temporal-codex.web.app/fluid

Quickstart
- Install: yarn add react-fluid-canvas  (or npm install react-fluid-canvas)
- Use:
```jsx
import FluidSimulation from "react-fluid-canvas";
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
- Canonical defaults: `src/config/simulationConfig.js`
- Human-readable option reference: [CONFIGURATION.md](./CONFIGURATION.md)
- Runtime changelog / release notes: [CHANGELOG.md](./CHANGELOG.md)

Highlights
- Hardware-accelerated fluid simulation with optional bloom (AURA) and volumetric rays (RAY_AURA).
- iOS-friendly fallbacks (8-bit intermediate path, manual filtering).
- Fine-grained runtime config via the `config` prop or by editing `src/config/simulationConfig.js`.

Status
- Last updated: 2025-10.
- Live demo: https://temporal-codex.web.app/fluid (screenshot above taken from `./docs/assets/demo.gif`).
- CHANGELOG.md present: see [CHANGELOG.md](./CHANGELOG.md) for release notes (Unreleased section included).
- Recommended pre-publish checks: bump version, run `yarn lint`, run `yarn build`, then smoke-test with `yarn dev`.

## Publish checklist
Follow these steps before publishing a release to npm:

- Update package version:
  - yarn version --patch  # or --minor / --major
  - OR edit package.json.version directly
- Install and lint:
  - yarn install
  - yarn lint
- Build and verify artifacts:
  - yarn build
  - yarn pack   # creates a .tgz to inspect package contents
  - tar -tf react-fluid-canvas-*.tgz  # verify dist, types, README included
- Smoke test locally:
  - yarn dev (run app and check console for errors)
  - In a fresh project: yarn add /path/to/react-fluid-canvas-<version>.tgz and run a minimal example
- Tag & publish:
  - git tag vX.Y.Z && git push --tags
  - yarn publish (or npm publish) — ensure auth/registry is correct

Keep a short entry in CHANGELOG.md for the release and push the built commit/tags before publishing.

Contributing / notes
- The demo screenshot is expected at `./docs/assets/demo.gif`. Update the path if your asset uses a different filename.
- For publishing: ensure package.json.version is bumped and build artifacts are produced before publishing.

License: MIT
