# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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