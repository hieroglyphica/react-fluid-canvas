// src/config/simulationConfig.js
  /*
  * COLOR_THEME can be:
  * - 'default': The original, time-based hue cycling.
  * - A single number (0 to 1): A monochromatic theme based on that hue.
  * - An array of two numbers [min, max]: A theme that cycles hues within that range.
  */
export const config = {
  SIM_RESOLUTION: 128,          // Resolution of the velocity simulation grid. (Range: 32, 64, 128, 256)
  DYE_RESOLUTION: 1024,         // Resolution of the dye texture. (Range: 256, 512, 1024, 2048)
  DENSITY_DISSIPATION: 1,       // How quickly the dye fades. (Range: 0.9 - 1)
  VELOCITY_DISSIPATION: 0.99,   // How quickly the velocity fades. (Range: 0.9 - 1)
  PRESSURE_ITERATIONS: 20,      // Number of iterations for pressure calculation. (Range: 10 - 60)
  CURL: 20,                     // Strength of the curl noise, adds turbulence. (Range: 0 - 50)
  SPLAT_RADIUS: 0.0021,         // Radius of the interactive splats. (Range: 0.001 - 0.01)
  SPLAT_FORCE: 3500,            // Force multiplier for interactive splats. (Range: 1000 - 10000)
  SHADING: true,                // Enables pseudo-3D shading. (Values: true, false)
  COLORFUL: true,               // Enables automatic color cycling. (Values: true, false)
  COLOR_THEME: "default",       // See comment at top of file. (Values: 'default', number, [min, max])
  BACK_COLOR: { r: 0, g: 0, b: 0 }, // Background color of the canvas. (Values: {r, g, b} from 0-255)
  TRANSPARENT: false,           // Renders a transparent background if true. (Values: true, false)
  AURA: false,                  // Bloom/glow effect. (Values: true, false)
  AURA_RESOLUTION: 196,         // Resolution of the bloom effect texture. (Range: 64, 128, 196, 256)
  AURA_WEIGHT: 2.5,             // Intensity of the bloom effect. (Range: 1.0 - 8.0)
  RAY_AURA: false,              // Volumetric light rays effect. (Values: true, false)
  RAY_AURA_RESOLUTION: 196,     // Resolution of the ray effect texture. (Range: 64, 128, 196, 256)
  RAY_AURA_WEIGHT: 0.5,         // Intensity of the ray effect. (Range: 0.1 - 1.0)
  BRIGHTNESS: 1.5,              // Global brightness multiplier. (Range: 0.5 - 2.5)
};
