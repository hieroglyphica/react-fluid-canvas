import { useRef, useMemo, forwardRef, useImperativeHandle } from "react";
import { useFluidSimulation } from "./hooks/useFluidSimulation.js";
import { config as defaultConfig } from "./config/simulationConfig";

/**
 * @typedef {import('./config/simulationConfig').FluidSimulationConfig} FluidSimulationConfig
 */

/**
 * The forwarded ref receives a controller object with methods:
 * { startPreset, stopPreset, splat, multipleSplats, setConfig, getDiagnostics, pause, resume, canvas }
 */
const FluidSimulation = forwardRef(({ config: userConfig, coordinates, preset, presetOptions, autoPlay = false, style, ...rest }, ref) => {
  const canvasRef = useRef(null);

  const simulationConfig = useMemo(() => { 
    return { ...defaultConfig, ...userConfig };
  }, [userConfig]);

  // receive controller from the hook
  const controller = useFluidSimulation(canvasRef, simulationConfig, coordinates, { preset, presetOptions, autoPlay });

  // expose imperative controller via forwarded ref
  useImperativeHandle(ref, () => {
    return {
      ...controller,
      canvas: canvasRef.current,
    };
  }, [controller]);

  return (
    <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", ...style }} {...rest} />
  );
});

FluidSimulation.displayName = 'FluidSimulation';
export { FluidSimulation };
export default FluidSimulation;
