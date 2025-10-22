# React Fluid Canvas

A lightweight and performant React component for creating beautiful, interactive fluid simulations on a canvas using WebGL. Perfect for animated backgrounds, headers, or creative interactive elements.

![React Fluid Canvas Demo](https://raw.githubusercontent.com/hieroglyphica/react-fluid-canvas/main/docs/assets/demo.gif)

**[Live Demo](https://temporal-codex.web.app/fluid)**

## Features

- **High Performance**: Offloads all simulation and rendering to the GPU with WebGL shaders.
- **Interactive**: Responds to mouse and touch movements.
- **Highly Customizable**: Easily tweak simulation parameters like dissipation, curl, splat radius, colors, and more.
- **Special Effects**: Includes optional post-processing effects like bloom (Aura) and glow rays (Ray Aura).
- **Easy to Use**: Drop the `<FluidSimulation />` component into your React app and customize with props.
- **Lightweight**: Minimal dependencies.

## Installation

```bash
npm install react-fluid-canvas
# or
yarn add react-fluid-canvas
```

## Usage

Import the component and place it in your application. It will automatically fill its parent container.

```jsx
import FluidSimulation from "react-fluid-canvas";

function App() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <FluidSimulation />
    </div>
  );
}
```

### Customization

You can override the default simulation settings by passing a `config` object prop.

```jsx
import FluidSimulation from "react-fluid-canvas";

function MyComponent() {
  const customConfig = {
    DENSITY_DISSIPATION: 0.98,
    VELOCITY_DISSIPATION: 0.99,
    PRESSURE_ITERATIONS: 25,
    CURL: 30,
    SPLAT_RADIUS: 0.005,
    COLOR_THEME: [0.8, 0.9], // Cycle between pink and purple hues
    AURA: true,
    AURA_WEIGHT: 3.0,
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: -1,
      }}
    >
      <FluidSimulation config={customConfig} />
    </div>
  );
}
```

For a full list of available configuration options, please see the **`CONFIGURATION.md`** file.

## Acknowledgements

This project is inspired by and based on the concepts from Pavel Dobryakov's excellent WebGL Fluid Simulation.

## License

MIT
