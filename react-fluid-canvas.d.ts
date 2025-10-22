import * as React from 'react';

export interface FluidSimulationConfig {
  SIM_RESOLUTION?: number;
  DYE_RESOLUTION?: number;
  DENSITY_DISSIPATION?: number;
  VELOCITY_DISSIPATION?: number;
  PRESSURE_ITERATIONS?: number;
  CURL?: number;
  SPLAT_RADIUS?: number;
  SPLAT_FORCE?: number;
  SHADING?: boolean;
  COLORFUL?: boolean;
  COLOR_THEME?: 'default' | [number, number] | number;
  BACK_COLOR?: { r: number; g: number; b: number };
  TRANSPARENT?: boolean;
  AURA?: boolean;
  AURA_RESOLUTION?: number;
  AURA_WEIGHT?: number;
  RAY_AURA?: boolean;
  RAY_AURA_RESOLUTION?: number;
  RAY_AURA_WEIGHT?: number;
  BRIGHTNESS?: number;
  // Allow any other properties for extensibility, though they won't have auto-suggestion
  [key: string]: any;
}

declare const FluidSimulation: React.ForwardRefExoticComponent<
  React.PropsWithoutRef<{
    config?: Partial<FluidSimulationConfig>;
    style?: React.CSSProperties;
  }> & React.RefAttributes<HTMLCanvasElement>
>;

export { FluidSimulation };
export default FluidSimulation;