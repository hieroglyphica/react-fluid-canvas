// src/config/simulationConfig.js
/*
 * COLOR_THEME:
 *  - 'default' : time+angle hue cycling
 *  - number    : fixed hue (0..1)
 *  - [min,max] : range to sample hues
 */

/**
 * @typedef {object} FluidSimulationConfig
 * @property {32 | 64 | 128 | 256} [SIM_RESOLUTION]
 * @property {256 | 512 | 1024 | 2048} [DYE_RESOLUTION]
 * @property {number} [DENSITY_DISSIPATION]
 * @property {number} [VELOCITY_DISSIPATION]
 * @property {number} [PRESSURE_ITERATIONS]
 * @property {number} [CURL]
 * @property {number} [SPLAT_RADIUS]
 * @property {number} [SPLAT_FORCE]
 * @property {boolean} [SHADING]
 * @property {boolean} [COLORFUL]
 * @property {'default' | number | [number, number]} [COLOR_THEME]
 * @property {{ r: number; g: number; b: number }} [BACK_COLOR]
 * @property {boolean} [TRANSPARENT]
 * @property {boolean} [AURA]
 * @property {64 | 128 | 196 | 256} [AURA_RESOLUTION]
 * @property {number} [AURA_WEIGHT]
 * @property {boolean} [RAY_AURA]
 * @property {64 | 128 | 196 | 256} [RAY_AURA_RESOLUTION]
 * @property {number} [RAY_AURA_WEIGHT]
 * @property {number} [BRIGHTNESS]
 * @property {number} [IOS_SHARPEN_AMOUNT]
 * @property {number} [IOS_SHARPEN_BOOST]
 * @property {'normal' | 'strong'} [IOS_SHARPEN_MODE]
 * @property {boolean} [IOS_SHARPEN_STRONG]
 * @property {boolean} [DISPLAY_USE_BICUBIC]
 * @property {boolean} [IOS_ENABLE_BICUBIC_ON_IOS]
 * @property {number} [IOS_DPR_CAP]
 * @property {boolean} [IOS_SIMULATE_NO_FLOAT_LINEAR]
 * @property {'low' | 'medium' | 'high' | 'ultra'} [QUALITY]  Preset quality level that adjusts several simulation parameters
 * @property {boolean} [AUTO_DYE_RESOLUTION]  // If true, pick dye FBO size from canvas backing (up to DYE_RESOLUTION)
 * @property {boolean} [DISPLAY_USE_BICUBIC_UPSCALE_ONLY] // If true, use bicubic only when upscaling final output
 */

export const config = {
  SIM_RESOLUTION: 128,          // Velocity grid size (px) — options: 32 | 64 | 128 | 256
  DYE_RESOLUTION: 2048,         // Dye texture size (px) — options: 256 | 512 | 1024 | 2048
  DENSITY_DISSIPATION: 0.97,    // Dye fade rate (0..1)
  VELOCITY_DISSIPATION: 0.97,   // Velocity decay (0..1)
  PRESSURE_ITERATIONS: 20,      // Jacobi iterations — typical: 8..48
  CURL: 10,                     // Vorticity strength (0..50)
  SPLAT_RADIUS: 0.005,           // Splat radius (normalized, ~0.001..0.03)
  SPLAT_FORCE: 3500,            // Splat force multiplier (1000..10000)
  SHADING: false,               // Pseudo-3D shading (bool)
  COLORFUL: true,              // Auto color cycling (bool)
  COLOR_THEME: "default",       // 'default' | number (0..1) | [min,max]
  BACK_COLOR: { r: 0, g: 0, b: 0 }, // Background color RGB (0..255)
  TRANSPARENT: false,           // Render transparent background (bool)
  AURA: false,                  // Bloom/glow enabled (bool)
  AURA_RESOLUTION: 196,         // Aura texture size (px) — options: 64 | 128 | 196 | 256
  AURA_WEIGHT: 2.5,             // Aura intensity (0..8)
  RAY_AURA: false,              // Volumetric light rays (bool)
  RAY_AURA_RESOLUTION: 196,     // Ray texture size (px) — options: 64 | 128 | 196 | 256
  RAY_AURA_WEIGHT: 0.5,         // Ray intensity (0..1)
  BRIGHTNESS: 1.5,              // Global brightness multiplier (0.5..2.5)
  IOS_FILTER: null,             // Manual filter mode: null=auto, true=force on, false=force off
  DISPLAY_USE_BICUBIC: true,    // Use bicubic resampling for display (bool)
  IOS_DPR_CAP: null,            // Cap devicePixelRatio on iOS (null or number)
  IOS_SIMULATE_NO_FLOAT_LINEAR: false, // Developer testing flag (default: OFF)
  IOS_ENABLE_BICUBIC_ON_IOS: true, // Allow bicubic specifically on iOS (bool)
  QUALITY: "medium",            // Preset: 'low' | 'medium' | 'high' | 'ultra'
  DISPLAY_TO_RGBA8: true,       // Render to 8-bit intermediate for final blit (bool)
  DEBUG_OVERLAY: false,         // Show runtime diagnostics overlay (disabled by default)
  AUTO_DYE_RESOLUTION: true,    // Auto-derive dye size from canvas backing (bool)
  DISPLAY_USE_BICUBIC_UPSCALE_ONLY: true, // Bicubic only when upscaling (bool)
  MAX_DYE_UPSCALE: 3.0,         // Max allowed display/dye upscale factor (>=1.0)
  FINAL_NEAREST_UPSCALE: false, // Use NEAREST for final upscale when true (bool)
  IOS_SHARPEN_AMOUNT: 0.18,     // Sharpen amount for 8-bit fallback (0.0..1.0)
};
