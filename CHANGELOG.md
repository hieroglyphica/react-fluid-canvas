# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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