# Trade Organism Design

## Concept

`Trade Organism` is an abstract 3D data sculpture of the global supply chain as one living system.

It should not look like a map. It should feel like a breathing network: bright hubs, flowing streams, pressure points, jams, surges, and sudden rerouting.

Data metaphor:

- Ports are organs.
- Trade flows are bloodstream.
- Chokepoints are constrictions.
- Delays or disruption signals are turbulence.
- Commodities are different materials moving through the body.

Real public data anchors the piece, but the final form is artistic rather than a literal logistics dashboard.

## Visual System

The main view is a full-screen Three.js scene.

Core visual rules:

- No globe, country borders, or literal map.
- Hundreds of glowing nodes suspended in 3D.
- Larger nodes represent high-volume ports or trade regions.
- Curved particle streams connect nodes.
- Streams constantly move, split, merge, and thicken.
- Chokepoints appear as compressed knots that bend nearby flows.
- Stress states create flicker, turbulence, slowdown, or rerouting.

Color language:

- Containers and general trade: electric blue-white.
- Energy and fuel: amber-red.
- Food and agriculture: green-gold.
- Manufacturing and electronics: violet-cyan.
- Congestion and stress: hot red or white flare.

Motion is the main emotion: overwhelming, alive, and mesmerizing.

## Data

Target public data sources:

- UN Comtrade for commodity and country flow structure.
- World Bank or public port datasets for node weight.
- Public chokepoint references for Suez, Panama, Malacca, Hormuz, Gibraltar, and Singapore.
- Optional disruption layer only if a stable public source is found.

If no stable disruption source is available, stress is derived from volume concentration and chokepoint pressure.

The app must ship with local cached JSON so the piece can run without live API calls.

## Interaction

First-version controls:

- Drag to rotate.
- Scroll or pinch to zoom.
- Pause and resume animation.
- Reset view.
- Toggle material layers.
- Hover nodes or streams to show simple labels: port or region, flow type, and relative intensity.
- Time control for yearly or monthly snapshots if the data supports it.

## Project Shape

Create a new project at:

`projects/trade-organism`

Use Vite and Three.js, following the structure and local-data approach already used by `projects/varna-weather-galaxy`.

Suggested module boundaries:

- `data/`: fetch and prepare public datasets into local JSON.
- `scene/`: Three.js setup, camera, lighting, and post-processing.
- `network/`: node and edge layout, flow paths, chokepoint influence.
- `particles/`: moving stream particles and turbulence behavior.
- `ui/`: controls, hover labels, and layer toggles.

Audio is out of scope for the first build unless explicitly added later.

## First Build Priorities

The first implementation should prioritize:

- A strong full-screen 3D organism.
- Real-data-backed nodes and flows.
- Smooth moving particle streams.
- Clear explanation of what is real versus artistic.
- Local cached data so the artwork is stable offline.

## Verification

Before calling the first build complete:

- Data scripts produce valid local JSON.
- App loads from cached local data.
- Desktop and mobile browser sizes render a nonblank animated canvas.
- Rotation, zoom, pause, reset, layer toggles, and hover labels work.
- The README explains the data sources and artistic mapping clearly.
