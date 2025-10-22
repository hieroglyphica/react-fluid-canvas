import { useRef, useMemo, forwardRef } from "react";
import { useFluidSimulation } from "./hooks/useFluidSimulation.js";
import { config as defaultConfig } from "./config/simulationConfig";

/**
 * @typedef {import('./config/simulationConfig').FluidSimulationConfig} FluidSimulationConfig
 */

/**
 * @param {object} props
 * @param {Partial<FluidSimulationConfig>} [props.config]
 * @param {React.CSSProperties} [props.style]
 * @param {React.Ref<HTMLCanvasElement>} ref
 */
const FluidSimulation = forwardRef(({ config: userConfig, style, ...rest }, ref) => {
  const canvasRef = useRef(null);

  const simulationConfig = useMemo(() => { 
    return { ...defaultConfig, ...userConfig };
  }, [userConfig]);

  useFluidSimulation(ref || canvasRef, simulationConfig);
  
  return (
    <canvas ref={ref || canvasRef} style={{ width: "100%", height: "100%", display: "block", ...style }} {...rest} />
  );
});

FluidSimulation.displayName = 'FluidSimulation';

export default FluidSimulation;
