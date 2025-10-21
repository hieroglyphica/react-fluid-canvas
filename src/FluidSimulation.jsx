import { useRef, useMemo } from "react";
import { useFluidSimulation } from "./hooks/useFluidSimulation";
import { config as defaultConfig } from "./config/simulationConfig";

const FluidSimulation = ({ config: userConfig, style, ...rest }) => {
  const canvasRef = useRef(null);

  const simulationConfig = useMemo(() => {
    return { ...defaultConfig, ...userConfig };
  }, [userConfig]);

  useFluidSimulation(canvasRef, simulationConfig);

  return (
    <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", ...style }} {...rest} />
  );
};

export default FluidSimulation;
