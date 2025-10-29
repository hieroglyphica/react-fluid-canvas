# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Demo: in-repo App.jsx test UI with runtime sliders for quick config testing (DENSITY_DISSIPATION, CURL).
- New built-in presets: `bouncingRoamer`, `tempoPulse`, `frequencyBands`, `classicalFlow`, `bassPulse`, `ambientDrift`.
- Example: cleaned custom preset factory added to README for copy/paste usage.
- Hook: controller.startSplatStream helper for programmatic per-frame splats.

### Changed
- Hook: useFluidSimulation now updates simulation config at runtime (simulation.updateConfig) instead of recreating the WebGL simulation on every config prop change.
- Hook: processCoordItems and scheduleCoordFlush stabilized (useCallback) and configRef introduced to avoid stale closures and lint warnings.
- Presets: brightness/speed tuning and new music-friendly preset behaviors.
- Demo: memoized presetOptions in App.jsx to avoid unintended preset restarts when other props change.
- Docs: update README demo URL to https://react-fluid-canvas.web.app/ and add pointer to CONFIGURATION.md.
- Scripts: make the release `scripts/version.js` tolerant when cross-env / env var is missing by falling back to package.json version.

### Fixed
- ESLint: fixed no-empty / unused-var issues in presetAnimations and related modules.
- WebGL: safer fallback checks for format support and improved framebuffer handling.
- Misc: improved defensive layout/resizing logic and more robust pointer handling.

### Notes
- The runtime config path keeps the existing updateConfig/initFramebuffers behavior for heavy changes (QUALITY, SIM_RESOLUTION, DYE_RESOLUTION, AURA/RAY_AURA resolution) which may trigger a brief visual reinit but does not recreate the simulation instance.
- Consumers should memoize presetOptions and preset factory functions (useMemo/useCallback) to avoid restarting an active preset inadvertently.

## [0.1.17] - 2025-10-29

### Added
- New presets for richer demo and music-reactive visuals:
  - bouncingRoamer — roaming, edge-bouncing agent with gentle speed modulation.
  - tempoPulse — beat-synced center pulses (bpm/beatIntensity driven).
  - frequencyBands — horizontal band-driven splats (audio band input support).
  - classicalFlow — slow, graceful arc motion for classical music.
  - bassPulse — low-frequency pulses for strong beats/crescendos.
  - ambientDrift — slow, soft ambient motion for chill backgrounds.
- Demo improvements:
  - Runtime sliders in App.jsx to adjust DENSITY_DISSIPATION and CURL without reloading the canvas.
  - Memoized presetOptions example to prevent accidental preset restarts.
- Documentation:
  - README includes cleaned custom preset example and lists new presets and usage hints.

### Changed
- useFluidSimulation: changed initialization so the FluidSimulation instance is created once; config prop updates are applied via simulation.updateConfig to avoid full recreation of WebGL contexts.
- Preset animation tuning: reduced built-in preset brightness and motion aggressiveness; custom preset brightened slightly to stand out.
- PresetAnimations: added several music-friendly presets and ensured color/brightness logic is consistent with config.COLORFUL and MIN_PRESET_BRIGHTNESS support.

### Fixed
- Lint & stability:
  - Resolved hook memoization warnings by using refs and useCallback (processCoordItems, scheduleCoordFlush).
  - Replaced empty catch blocks with explicit ignore comments to satisfy ESLint.
  - Removed accidental recreation triggers (memoized presetOptions in demo).
- WebGL safety:
  - Improved format detection and fallback when float/half-float formats are not supported.
  - Safer framebuffer and blit handling for diverse environments (including iOS fallbacks).

### Notes
- This release focuses on stability, runtime configurability, and expanding presets for creative/musical use-cases.
- Consumers upgrading should:
  - Memoize presetOptions and preset factory references (useMemo/useCallback) to avoid restarting presets.
  - Expect heavier config changes (SIM/DYE/QUALITY/AURA) to reinitialize framebuffers—this is done in-place and preserves the sim instance.
  - Use the demo App.jsx for quick local testing before packaging.

## [0.1.16] - 2025-10-27

### Added
- Public props: `coordinates`, `preset`, `presetOptions`, `autoPlay` to allow declarative animation control.
- Built-in presets: `orbiting`, `globalDrift` (preset factories available internally).
- `coordinates` prop accepts single or multiple splat descriptors: { x, y, dx?, dy?, color? }.

### Changed
- Simplified public API: prefer props for configuration and animation control.
- Removed previous dev-only helpers and DOM exposure used during development (no longer expose simulation on canvas DOM).
- Demo/test UI removed from example app to present a clean consumer-facing surface.
- Added a minimal imperative controller (ref) with safe methods: startPreset, stopPreset, splat, multipleSplats, setConfig, getDiagnostics, pause, resume.

### Notes
- Consumers can now choose between:
  - declarative splats via `coordinates`,
  - canned animations via `preset` + `presetOptions` (use with `autoPlay`),
  - or no built-in animations (pure interactive via mouse/touch).
- Programmatic control via onReady/ref was removed to keep the public surface minimal; it can be reintroduced if needed.

## [0.1.15] - 2025-10-27

### Changed
- Added an automated `version` script to update documentation on publish.

## [0.1.14] - 2024-10-28

### Changed
- Upgraded all project dependencies to their latest versions, including support for **React 19**.
- Added `Dependabot` to automate future dependency updates.
- Corrected ESLint configuration to properly handle unused variables in `catch` blocks.
- Corrected Vite build configuration to resolve library build warnings.

## [0.1.13] - 2024-10-27

### Changed
- Upgraded project dependencies to their latest versions.
- Migrated ESLint configuration to the modern flat config format (`eslint.config.js`).
- Implemented pre-commit hooks with `husky` and `lint-staged` to enforce code style.
- Refined JSDoc and TypeScript definitions for better type safety and autocompletion.

## [0.1.0] - 2024-XX-XX

### Added
- Initial release of `react-fluid-canvas`.
- Core WebGL-based fluid simulation engine.
- Interactive splats via mouse and touch events.
- Post-processing effects: `AURA` (bloom) and `RAY_AURA` (glow rays).

### Changed
- Converted project into a public library structure.
- `FluidSimulation` component now accepts a `config` prop for customization.
- Removed initial random splats for a clean start on component mount.