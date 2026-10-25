Read AGENTS.md first and follow it strictly.

# Prompt 03: Design System Tokens, Noir Shell & Radar Viewport Layout

## Objective
Establish the CrashLens visual foundation: configure Tailwind CSS tokens for the deep noir CAD aesthetic, build the persistent radar application shell, header telemetry ribbon, and bottom simulation control dock.

## Negative Constraints
- **Do not render dynamic SVG nodes or live telemetry updates yet** (keep layout static).
- **Do not implement incident injection logic or AI reasoning yet.**
- **No white screen defaults** — enforce `#07080a` pitch background with warm cream text.
- Focus strictly on styling tokens, container layout, header metrics ribbon, and controls dock.

## Step-by-Step Instructions

1. **Configure Theme Tokens (`tailwind.config.ts` or CSS Variables)**:
   Add custom colors, typography, and box shadows to match the Oryzo/Orcathon CAD aesthetic:
   - `--bg-pitch: #07080a`
   - `--bg-card: #0d0f16`
   - `--border-cad: rgba(255, 237, 214, 0.08)`
   - `--accent-amber: #ff8539`
   - `--accent-cyan: #38bdf8`
   - `--text-cream: #ffedd6`
   - `--text-muted: #94a3b8`
   - Fonts: Sans-serif (Geist/Inter) + Monospace (Outfit Mono / Geist Mono for telemetry calipers).

2. **Build the Persistent Radar Shell Component (`src/components/radar/RadarShell.tsx`)**:
   Construct the full-viewport grid layout:
   - Header Bar (`h-14`):
     - Left: CrashLens brand logo + badge `[TRACK 01: SOFTWARE & AI]`.
     - Center: Global cluster health badge (`HEALTHY - 12/12 ONLINE`), global error rate (`0.02%`), cluster RPS (`5,240 req/s`), simulation tick counter.
     - Right: Live telemetry status indicator (pulsing green dot) and OpenRouter System 1 model indicator (`MERCURY-DECIDE: STANDBY`).
   - Center Canvas Area:
     - 16:9 aspect-ratio radar viewport with CAD hairline grid, coordinate corner ticks (`[+000, +000]`, `[+1000, +750]`), and subtle crosshairs.
   - Bottom Dock (`h-16`):
     - Floating glassmorphic dock: `[PAUSE / RESUME]`, Speed selector `[1x | 2x | 5x]`, `[RESET CLUSTER]`, and `[DETONATE SCENARIO]` trigger menu.
   - Right Side Rail (`w-96`):
     - Collapsible container reserved for the Service Inspector and AI Recovery Advisor.

3. **Assemble Static Page (`src/app/page.tsx` or standalone radar view)**:
   Mount `RadarShell` with placeholder static data to verify layout integrity on desktop (1536×864) and laptop viewports.

## Documentation Injection
(Here paste Tailwind CSS v3.4 configuration and custom font definitions)

## Visual Grounding
Refer to the CAD grid and corner caliper styling in `@prompt_material/03-radar-shell-wireframe.png`:
```
+-----------------------------------------------------------------------------------+
| CRASHLENS [SYS-1 RADAR]  |  CLUSTER: HEALTHY (0.02% ERR)  |  MERCURY: READY [KEY 1] |
+-----------------------------------------------------------------------------------+
|  [+000, +000]                                                        [+1000, +000] |
|                                                                                   |
|                                ( SVG RADAR CANVAS )                               |
|                                                                                   |
|  [+000, +750]                                                        [+1000, +750] |
+-----------------------------------------------------------------------------------+
|               [ ▶ PLAY ] [ 1x | 2x ] [ ⚠ INJECT CHAOS ] [ RESET ]                 |
+-----------------------------------------------------------------------------------+
```

## Verification
- Verify that the page loads with zero layout shifts (CLS < 0.05).
- Inspect color palette in browser: ensure deep pitch background (`#07080a`) with high-contrast warm cream text.
