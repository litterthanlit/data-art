# Solar Wind Breath Design

## Concept

`Solar Wind Breath` is an abstract 3D data sculpture of the Sun's plasma stream as it arrives near Earth.

It should not look like a Sun disk, Earth globe, or space-weather dashboard. It should feel like a living heliospheric organism: luminous filaments, magnetic ribbons, quiet breathing, then sudden CME eruptions that reorganize the field.

Data metaphor:

- Quiet solar wind is the organism's steady breath.
- Proton density is body mass / particle thickness.
- Flow speed is stream urgency.
- Magnetic field orientation is ribbon twist.
- Temperature is heat color.
- Coronal mass ejections are eruptions.
- Geomagnetic storm Kp peaks are whole-body convulsions when Earth answers.

Real NASA DONKI event catalogs and geomagnetic storm indices anchor the piece. Continuous plasma values for the first build are a storm-window reconstruction driven by those real events and typical OMNI parameter ranges — not a literal raw OMNI dump. The final form is artistic.

## Visual System

The main view is a full-screen Three.js scene.

Core visual rules:

- No Sun, no Earth, no orbit diagrams.
- A suspended stream of glowing particles and ribbons.
- Density thickens the body.
- Speed stretches and accelerates the flow.
- Magnetic field bends and twists ribbons.
- Quiet hours: cool indigo–cyan breathing.
- Storm hours: amber–white compression, flicker, turbulence.
- CME launches appear as brief radial flares upstream.
- CME/shock arrivals flash through the whole organism.

Color language:

- Quiet plasma: deep indigo to cyan.
- Dense plasma: brighter white-cyan mass.
- Fast streams: stretched electric blue.
- Hot plasma: amber to white.
- CME eruption: gold-white flare.
- Geomagnetic response: hot coral pulse.

Motion is the main emotion: cosmic, patient, then violently alive.

## Data

Primary public sources:

- NASA DONKI CME catalog for eruption timing, speed, half-angle, and Earth-impact forecasts.
- NASA DONKI GST catalog for geomagnetic storm windows and NOAA Kp indices.
- NASA OMNIWeb as the intended continuous plasma archive for later builds.

First-build window:

- `2024-05-01` to `2024-05-15` — the May 2024 solar storm sequence, including the Gannon storm.

The app must ship with local cached JSON so the piece can run without live API calls.

## Interaction

First-version controls:

- Drag to rotate.
- Scroll or pinch to zoom.
- Pause and resume animation.
- Reset view.
- Time scrubber across the storm window.
- Toggle CME flares and geomagnetic pulse layers.
- Hover to show timestamp, density/speed proxy, CME or storm labels.

## Project Shape

Create a new project at:

`projects/solar-wind-breath`

Use Vite and Three.js, following `projects/trade-organism`.

Suggested module boundaries:

- `scripts/`: fetch/prepare DONKI-backed local JSON.
- `scene/`: Three.js setup, camera, lighting, controls.
- `plasma/`: stream layout, particle field, storm response.
- `ui/`: controls, inspector readouts, time labels.

Audio is out of scope for the first build.

## First Build Priorities

- A strong full-screen 3D plasma organism.
- Real DONKI CME + GST event anchors.
- Smooth time-evolving particle stream.
- Clear explanation of what is real versus reconstructed.
- Local cached data so the artwork is stable offline.

## Verification

Before calling the first build complete:

- Data scripts produce valid local JSON.
- App loads from cached local data.
- Desktop and mobile browser sizes render a nonblank animated canvas.
- Rotation, zoom, pause, reset, time scrub, and hover labels work.
- The README explains the data sources and artistic mapping clearly.
