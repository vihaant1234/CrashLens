Read AGENTS.md first and follow it strictly.

# Prompt 07: Dynamic Radar Motion, Glowing Bezier Pulses & Blast Radius Waves

## Objective
Elevate the static SVG topology into a high-fidelity dynamic radar visualization: animate particle flows along dependency edges, dynamically transition node status colors (Green -> Amber -> Red), and render expanding radial blast-radius shockwaves centered on failing services.

## Negative Constraints
- **Do not write AI mitigation logic or recovery actions yet.**
- **Do not make external API calls.**
- **Avoid heavy Canvas/WebGL libraries that hurt performance**; use performant SVG filters, CSS keyframes, or requestAnimationFrame.
- Focus strictly on visual feedback, edge particle animations, node health state transitions, and the blast radius ripple effect.

## Step-by-Step Instructions

1. **Implement Dynamic Node Health Styling (`src/components/radar/TopologyNodeItem.tsx`)**:
   Connect `NodeTelemetry` from the active snapshot:
   - Calculate node visual state based on metrics:
     - `HEALTHY`: Green badge (`#22c55e`), subtle dark border.
     - `DEGRADED` (p99 > 2x baseline or errorRate > 2%): Amber border (`#ff8539`), glowing box-shadow, pulsing warning glyph.
     - `CRITICAL` (p99 > 5x baseline or errorRate > 15%): Red border (`#ef4444`), rapid pulsing glow, blinking alert icon.
     - `DEAD` (errorRate > 80%): Desaturated dark red, warning banner `[SERVICE TIMEOUT]`.
   - Display live real-time p99 latency (`"842ms"`) and CPU (`"94%"`) directly inside the node card.

2. **Implement Animated Edge Pulses (`src/components/radar/AnimatedEdge.tsx`)**:
   - Render SVG `<path>` with dynamic styling based on edge telemetry:
     - Stroke color: Transitions from cyan/white (`rgba(56, 189, 248, 0.3)`) to amber (`#ff8539`) when degraded, to red (`#ef4444`) when saturated.
     - Animated particle stream: Use SVG `<circle>` elements with `<animateMotion>` along the bezier path or CSS `stroke-dashoffset` animation to represent live request packets flowing from caller to callee.
     - If the edge error rate > 10%, render red packet particles that dissolve mid-flight.

3. **Render Expanding Blast Radius Shockwave (`src/components/radar/BlastRadiusRipple.tsx`)**:
   - When an incident is active and a root-cause service is identified:
     - Render an expanding SVG radial ring centered at the culprit node's $(x, y)$:
       $$\text{radius}(t) = r_0 + v \times (t \pmod{2.5\text{s}})$$
       $$\text{opacity}(t) = 1.0 - \frac{\text{radius}}{\text{maxRadius}}$$
     - Concentric dashed circles in amber (`#ff8539`) expand outward, visually indicating the cascade wavefront reaching downstream dependent nodes.

4. **Mount Dynamic Layers into `TopologyCanvas`**:
   - Verify smooth 60fps rendering during 1Hz telemetry updates.

## Documentation Injection
(Here paste SVG animateMotion and stroke-dashoffset animation best practices)

## Visual Grounding
Refer to the dynamic failure state in `@prompt_material/07-blast-radius-radar.png`:
```
                   [ api-gateway ] (Warning amber pulse)
                   /      |      \
        [ auth-svc ]   [ cart ]   [ recommendations ]
                        /      \
            [ orders-svc ]    [ redis-cache ]
              (Red pulse)
              /    |    \
     [ payments ] [inv]  [ notifications ]
      (Critical red)
          /    \
   [payments-db]  <--- (((( Expanding Amber Ripple ))))
     (ROOT CAUSE: 98% Conns, 1200ms p99)
```

## Verification
- Trigger Scenario A (`DB_POOL_LEAK`).
- Confirm that `payments-db` transitions to Red first with expanding amber ripple rings.
- Confirm downstream edges (`payments-svc`, `orders-svc`) transition to amber/red within 15–20 seconds.
- Confirm packet flow along degraded edges visibly shifts to amber/red.
