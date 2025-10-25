import FluidSimulation from "./index.jsx";
// import shared default config
import { config as defaultConfig } from "./config/simulationConfig";

function App() {
  // App uses shared default config (single source of truth).
  // Use a fixed, inset container and hide overflow to avoid scrollbars on resize.
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        // ensure it sits behind other UI if used as a background
        zIndex: 0,
      }}
    >
      <h1
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          color: "white",
          zIndex: 1,
        }}
      >
        {/* React Fluid Canvas */}
      </h1>
      <FluidSimulation config={defaultConfig} />
    </div>
  );
}

export default App;
