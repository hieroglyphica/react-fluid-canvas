import * as React from 'react';

export interface FluidSimulationConfig {
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