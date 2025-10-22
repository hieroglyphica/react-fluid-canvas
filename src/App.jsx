import FluidSimulation from './index.jsx';

function App() {
  // Example of overriding the default configuration
  const customConfig = {
    DENSITY_DISSIPATION: 0.99,
    SPLAT_RADIUS: 0.002,
    CURL: 10,
    COLOR_THEME:"default", // Cycle between pink and purple hues
  };

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <h1 style={{ position: 'absolute', top: '20px', left: '20px', color: 'white', zIndex: 1 }}>
        React Fluid Canvas
      </h1>
      <FluidSimulation config={customConfig} />
    </div>
  )
}

export default App
