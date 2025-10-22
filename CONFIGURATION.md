# Configuration Options

You can override the default simulation settings by passing a `config` object prop to the `<FluidSimulation />` component.

```jsx
const customConfig = {
  DENSITY_DISSIPATION: 0.98,
  SPLAT_RADIUS: 0.005,
  COLOR_THEME: [0.8, 0.9] // Cycle between pink and purple hues
};

<FluidSimulation config={customConfig} />
```

The following table lists all available configuration options, their descriptions, and their default values.

| Option | Description | Default Value |
|---|---|---|
| `SIM_RESOLUTION` | Resolution of the velocity simulation grid. (Range: 32, 64, 128, 256) | `128` |
| `DYE_RESOLUTION` | Resolution of the dye texture. (Range: 256, 512, 1024, 2048) | `1024` |
| `DENSITY_DISSIPATION` | How quickly the dye fades. (Range: 0.9 - 1) | `0.99` |
| `VELOCITY_DISSIPATION` | How quickly the velocity fades. (Range: 0.9 - 1) | `0.99` |
| `PRESSURE_ITERATIONS` | Number of iterations for pressure calculation. (Range: 10 - 60) | `20` |
| `CURL` | Strength of the curl noise, adds turbulence. (Range: 0 - 50) | `20` |
| `SPLAT_RADIUS` | Radius of the interactive splats. (Range: 0.001 - 0.01) | `0.0021` |
| `SPLAT_FORCE` | Force multiplier for interactive splats. (Range: 1000 - 10000) | `3500` |
| `SHADING` | Enables pseudo-3D shading. | `true` |
| `COLORFUL` | Enables automatic color cycling on interaction. | `true` |
| `COLOR_THEME` | Sets the color behavior: `'default'` for time-based cycling, a `number` (0-1) for a fixed hue, or `[min, max]` for a random hue within a range. | `'default'` |
| `BACK_COLOR` | Background color of the canvas. | `{ r: 0, g: 0, b: 0 }` |
| `TRANSPARENT` | Renders a transparent background if true. | `false` |
| `AURA` | Bloom/glow effect. | `false` |
| `AURA_RESOLUTION` | Resolution of the bloom effect texture. (Range: 64, 128, 196, 256) | `196` |
| `AURA_WEIGHT` | Intensity of the bloom effect. (Range: 1.0 - 8.0) | `2.5` |
| `RAY_AURA` | Volumetric light rays effect. | `false` |
| `RAY_AURA_RESOLUTION` | Resolution of the ray effect texture. (Range: 64, 128, 196, 256) | `196` |
| `RAY_AURA_WEIGHT` | Intensity of the ray effect. (Range: 0.1 - 1.0) | `0.5` |
| `BRIGHTNESS` | Global brightness multiplier. (Range: 0.5 - 2.5) | `1.5` |