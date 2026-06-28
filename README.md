# 🌌 AEON PULSE

**Aeon Pulse** is a high-fidelity, side-scrolling arcade space shooter built with **Three.js**, **TypeScript**, and **Vite**. The game features a polished, retro-futuristic dark mode theme, procedural graphics generation, customized synthesizer audio using the Web Audio API, and a dynamic campaign system organized into visually and mechanically distinct chapters.

> [!TIP]
> Aeon Pulse is fully responsive and rendered in 3D using Three.js with post-processing effects, overlaid with a premium glassmorphic HTML interface.

---

## 🤖 Built with AI

**Aeon Pulse was built with AI.** Most of the code, architecture, documentation, level design, and gameplay tuning in this repository was produced through iterative collaboration with AI coding agents, directed by human creative and technical oversight. If you're curious how a project like this comes together, explore [AGENTS.md](AGENTS.md) for the conventions that guide agent contributions and [CONTEXT.md](CONTEXT.md) for the project's domain language.

---

## 🚀 Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) installed (the project is pinned to Node 22 via [`.nvmrc`](.nvmrc)).

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd aeon-pulse
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Game

Use the following npm scripts to run, test, build, or preview the application:

```bash
npm run dev          # Starts the dev server at http://localhost:5173 (with Hot Module Replacement)
npm test             # Runs the Vitest module-test suite
npm run test:watch   # Runs Vitest in watch mode
npm run build        # Compiles the production build into the dist/ directory
npm run preview      # Serves the compiled production build locally
npm run test:e2e     # Builds and runs the Playwright end-to-end test suite
npm run profile      # Runs the render-baseline profiler project
```

---

## 🎮 How to Play

Navigate your ship and battle through the campaign using the following default controls:

| Action | Key Mapping |
| :--- | :--- |
| **Move Ship / Select Option** | `W` / `S` / `A` / `D` or **Arrow Keys** |
| **Fire Bullet / Charge Weapon / Confirm** | `Spacebar` |
| **Confirm / Next Screen** | `Enter` |
| **Pause / Unpause Game / Exit Database** | `Escape` or `P` |
| **Tactical Database Viewer** | `V` (from the Title Screen) |

---

## 🌌 Campaign Structure & Glossary

The campaign in **Aeon Pulse** follows a structured glossary to maintain design consistency:

* **Chapter**: A campaign family sharing a visual identity and gameplay grammar (e.g., *Megastructure*, *Industrial*, *Hive*, *Volcanic*).
* **Level**: A single playable run, identified by its Level ID (e.g., `1-5`, `2-5`).
* **Level ID**: The structured format of `[Chapter]-[Level]`.
* **Chapter Finale**: The final, climactic level of a chapter (typically ending in `-5`) concluding with a **Finale Boss**.

### Current Chapter Archetypes

1. **Chapter 1: Megastructure** ("The Outer Array") — An alien construct background with precise movement and initial combat challenges.
2. **Chapter 2: Industrial** ("Iron Vein") — An industrial corridor featuring narrow metallic corridors, moving machinery, and walls that react to collisions.
3. **Chapter 3: Hive** ("Hive Womb") — An organic, biological cavern filled with fleshy obstacles, spore-bursting enemies, and pulsing vein shaders.
4. **Chapter 4: Volcanic** ("Cinder Core") — A dangerous, asymmetric volcanic cavern containing lava hazards, stalactites, and high-intensity lava pulses.

---

## 🛠️ Architecture & Technical Stack

* **Rendering Engine**: **Three.js** is used for 3D asset rendering, using orthographic cameras to maintain classic 2D gameplay math within a dynamic 3D space.
* **Post-Processing**: A custom Three.js `EffectComposer` pipeline handles **UnrealBloomPass** (for neon glows) and custom chromatic aberration shaders.
* **Graphics Generation**: Most visuals are built from procedural Three.js geometry and materials at startup, with select entities (such as the player craft) using asynchronously loaded GLB models. A shared resource cache keeps runtime geometry and material allocation low.
* **Audio Synthesis**: The sound effects and music are dynamically synthesized via the browser's native **Web Audio API** in real-time. No static `.mp3` or `.wav` files are loaded.
* **UI Overlay**: Standard HTML/CSS layout layered on top of the Three.js canvas utilizing custom glassmorphic properties and custom theme typography.
* **Campaign System**: Progression is chapter/level based, driven by `src/campaign/Campaign.ts`. Each Level maps to a Sector (`src/level/sectors/`) that defines terrain, props, and corridor identity.

> [!IMPORTANT]
> The game utilizes a structured, modular design system with dependency injection for audio assets (`IAudio`) and strict separation between gameplay logic (`src/Game.ts` orchestrating `src/systems/GameplayRun.ts`, `src/systems/Gameplay.ts`, `src/systems/Collisions.ts`, and `src/systems/CombatResolution.ts`) and spatial rendering (`src/Scene.ts`).

---

## 📜 Development Guidelines

For developers looking to contribute or modify the codebase, please review the rules in [AGENTS.md](AGENTS.md) and design principles in [CONTEXT.md](CONTEXT.md).

* **Architecture Decision Records (ADRs)**: Important architectural decisions are documented in `docs/adr/`.
* **String Enums**: Discriminators such as `GameState` and `EnemyType` must be defined using string enums in `src/types.ts`.
* **Tactical Database**: Any newly added enemy or boss must be registered in `src/entities/EntityCatalog.ts` so it appears in the **Tactical Database Viewer** (`src/viewer/TacticalDatabase.ts`) with correct ordering, scale, and model-readiness hooks.
* **Continuous Integration**: `.github/workflows/build-and-test.yml` runs `npm test` and `npm run build` on every pull request and push to `master`.
