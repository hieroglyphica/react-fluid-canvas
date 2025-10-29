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

  // Ensure canvas is visible and fills parent even if WebGL hasn't initialized.
  const bgColor = simulationConfig && simulationConfig.TRANSPARENT
    ? "transparent"
    : simulationConfig && simulationConfig.BACK_COLOR
    ? `rgb(${simulationConfig.BACK_COLOR.r}, ${simulationConfig.BACK_COLOR.g}, ${simulationConfig.BACK_COLOR.b})`
    : "#000";

  const defaultStyle = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    display: "block",
    backgroundColor: bgColor,
    ...style,
  };

  return (
    <canvas ref={canvasRef} style={defaultStyle} {...rest} />
  );
});

FluidSimulation.displayName = 'FluidSimulation';
export { FluidSimulation };
export default FluidSimulation;
