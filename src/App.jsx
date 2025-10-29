import FluidSimulation from "./index.jsx";

export default function App() {
	return (
		<div style={{ width: "100vw", height: "100vh", position: "relative" }}>
			{/* Minimal usage: consumers can pass `config`, `preset`, `coordinates`, etc. when needed */}
			<FluidSimulation style={{ width: "100%", height: "100%" }} />
		</div>
	);
}


