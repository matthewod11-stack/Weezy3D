# Weezy3D — Princess Eloise in 3D (Three.js Exploration Fork)

> **This is a non-git fork of Weezy2** for exploring a 3D browser-native version of Princess Eloise, inspired by Fable's Three.js worldbuilding demo (June 2026).
>
> **Start here:**
> - `docs/3d-transition/2d-to-3d-guide.md` — full migration guide: what carries forward, what changes, suggested phase plan
> - `docs/art-direction/scenery-prompt-library.md` — world-by-world Three.js scene prompts + the master style anchor
>
> The 2D game below is still runnable — it's the reference baseline.

---

# Princess Eloise — Bedroom World (V1, 2D Baseline)

Mario-style pixel platformer: **Phaser 3**, **TypeScript**, **Vite**. Run entirely in the browser (e.g. Cursor’s preview).

## Setup

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Controls

- **Move:** Arrow keys or A / D  
- **Jump:** Space  
- **Pause:** Esc  

If keys do nothing, **click the game canvas** once (focus). The game scales to fit the window.

## Progress / replay

Progress is stored in `localStorage`. In the browser console:

```js
eloiseReset()
```

This clears save data and reloads the page.

## Scripts

| Command          | Description              |
| ---------------- | ------------------------ |
| `npm run dev`    | Dev server + HMR         |
| `npm run build`  | Typecheck + production build |
| `npm run preview`| Serve `dist/`            |
| `npm run typecheck` | `tsc --noEmit` only |

## Structure

- `src/scenes/` — Boot (textures), Game (level + entities), UI (HUD, pause)
- `src/entities/` — Player, enemies, tokens, companion
- `src/levels/bedroomLevels.ts` — Three bedroom levels (validated with Zod at load)
- `src/config/` — Resolution, physics tuning, texture keys
