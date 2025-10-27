import FluidSimulation from "./index.jsx";
import { config as defaultConfig } from "./config/simulationConfig";

function App() {
  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", zIndex: 0 }}>
      <FluidSimulation config={defaultConfig} />
    </div>
  );
}

export default App;
