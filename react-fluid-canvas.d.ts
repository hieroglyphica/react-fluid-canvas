import * as React from 'react';

declare module "react-fluid-canvas" {
  export type SplatColor = [number, number, number];

  export interface SplatDescriptor {
    x: number; // 0..1 (origin top-left)
    y: number; // 0..1 (origin top-left)
    dx?: number; // normalized delta x (will be scaled by SPLAT_FORCE)
    dy?: number; // normalized delta y
    color?: SplatColor; // optional RGB 0..1
  }

  export type QualityPreset = "low" | "medium" | "high" | "ultra";

  export interface FluidSimulationConfig {
    SIM_RESOLUTION?: 32 | 64 | 128 | 256;
    DYE_RESOLUTION?: 256 | 512 | 1024 | 2048;
    DENSITY_DISSIPATION?: number;
    VELOCITY_DISSIPATION?: number;
    PRESSURE_ITERATIONS?: number;
    CURL?: number;
    SPLAT_RADIUS?: number;
    SPLAT_FORCE?: number;
    SHADING?: boolean;
    COLORFUL?: boolean;
    COLOR_THEME?: "default" | number | [number, number];
    BACK_COLOR?: { r: number; g: number; b: number };
    TRANSPARENT?: boolean;
    AURA?: boolean;
    AURA_RESOLUTION?: 64 | 128 | 196 | 256;
    AURA_WEIGHT?: number;
    RAY_AURA?: boolean;
    RAY_AURA_RESOLUTION?: 64 | 128 | 196 | 256;
    RAY_AURA_WEIGHT?: number;
    BRIGHTNESS?: number;
    IOS_FILTER?: null | boolean;
    DISPLAY_USE_BICUBIC?: boolean;
    DISPLAY_USE_BICUBIC_UPSCALE_ONLY?: boolean;
    IOS_ENABLE_BICUBIC_ON_IOS?: boolean;
    IOS_SIMULATE_NO_FLOAT_LINEAR?: boolean;
    IOS_DPR_CAP?: number | null;
    DISPLAY_TO_RGBA8?: boolean;
    FINAL_NEAREST_UPSCALE?: boolean;
    AUTO_DYE_RESOLUTION?: boolean;
    MAX_DYE_UPSCALE?: number;
    IOS_SHARPEN_AMOUNT?: number;
    QUALITY?: QualityPreset;
    DEBUG_OVERLAY?: boolean;
    // ...other cfg keys are allowed but not enumerated here
    [key: string]: any;
  }

  export interface FluidController {
    // presets
    startPreset(name: string, opts?: Record<string, any>): any | null;
    stopPreset(): void;

    // programmatic splats
    splat(x: number, y: number, dx?: number, dy?: number, color?: SplatColor): void;
    multipleSplats(n?: number): void;

    // runtime config update
    setConfig(partial: Partial<FluidSimulationConfig>): void;

    // diagnostics & lifecycle
    getDiagnostics(): any | null;
    pause(): void;
    resume(): void;

    // optional DOM access (may be null)
    canvas?: HTMLCanvasElement | null;
  }

  export interface FluidProps {
    config?: Partial<FluidSimulationConfig>;
    coordinates?: SplatDescriptor | SplatDescriptor[];
    preset?: string; // built-in presets: "orbiting" | "globalDrift" (others allowed)
    presetOptions?: Record<string, any>;
    autoPlay?: boolean;
    style?: React.CSSProperties;
    className?: string;
    // any other standard canvas props
    [key: string]: any;
  }

  const FluidSimulation: React.ForwardRefExoticComponent<
    FluidProps & React.RefAttributes<FluidController>
  >;

  export default FluidSimulation;
}