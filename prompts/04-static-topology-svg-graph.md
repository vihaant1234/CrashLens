Read AGENTS.md first and follow it strictly.

# Prompt 04: Static 12-Node Topology SVG Graph & Dependency Edges

## Objective
Render the 12-service microservice cluster as an interactive SVG canvas within the radar viewport, displaying all service nodes, role glyphs, status badges, and curved cubic bezier dependency edges.

## Negative Constraints
- **Do not connect live 1Hz telemetry updates to the nodes yet.**
- **Do not animate glowing edge pulses or blast radius waves yet.**
- **Do not write AI mitigation triggers yet.**
- Focus strictly on clean SVG layout rendering, node styling, and bezier dependency geometry.

## Step-by-Step Instructions

1. **Implement Bezier Edge Geometry Helper (`src/components/radar/svgHelpers.ts`)**:
   - Write a function `computeBezierPath(x1: number, y1: number, x2: number, y2: number): string` that calculates smooth cubic bezier curves between parent and child nodes:
     $$\text{path} = M(x_1, y_1) \quad C\left(x_1, y_1 + \frac{\Delta y}{2}, x_2, y_2 - \frac{\Delta y}{2}, x_2, y_2\right)$$
   - Ensure curves have gentle vertical curvature appropriate for top-to-bottom DAG flow.

2. **Build Static Node Component (`src/components/radar/TopologyNodeItem.tsx`)**:
   - Create the node card within an SVG `<g>` element or absolute-positioned glass container:
     - Dimensions: Width 140px, Height 64px, rounded corners (`rx="8"`).
     - Visuals: Dark glass fill `rgba(13, 15, 22, 0.85)` with 1px border `rgba(255, 237, 214, 0.12)`.
     - Header: Service icon (Lucide `Server`, `Database`, `Key`, `ShoppingCart`, `Cpu`, etc.) + Service Name.
     - Telemetry pill: Baseline p99 latency (`18ms`) + Status indicator (pulsing green circle).
     - Hover & Click feedback: Subtle scale and amber border glow on `:hover`.

3. **Build Topology Graph Canvas (`src/components/radar/TopologyCanvas.tsx`)**:
   - ViewBox: `0 0 1000 750` with responsive preserveAspectRatio `xMidYMid meet`.
   - Render two distinct SVG layers:
     - **Layer 1 (Bottom - Edges)**: Render all 14 dependency edges using `<path>` with stroke `rgba(255, 237, 214, 0.15)`, stroke-width `1.5`, and arrow markers.
     - **Layer 2 (Top - Nodes)**: Render all 12 nodes positioned at their assigned $(x, y)$ coordinates from `CLUSTER_NODES`.
   - Implement `onSelectNode(serviceId: ServiceId)` callback prop.

4. **Mount within `RadarShell`**:
   - Replace the radar stage placeholder with `<TopologyCanvas />`.
   - Verify that all 12 services are visible and clearly spaced without edge overlap.

## Documentation Injection
(Here paste SVG responsive viewBox and vector-effect non-scaling-stroke documentation)

## Visual Grounding
Refer to the node layout in `@prompt_material/04-topology-svg-layout.png`:
```
                   [ api-gateway ] (500, 80)
                   /      |      \
        [ auth-svc ]   [ cart ]   [ recommendations ]
          (240, 220)   (500, 220)     (760, 220)
                       /      \
            [ orders-svc ]    [ redis-cache ]
              (360, 380)        (640, 380)
              /    |    \
     [ payments ] [inv]  [ notifications ]
      (220, 520) (460,520)   (700, 520)
         /    \      |           |
  [payments-db] [fraud] [wh-db] [kafka]
    (140, 680) (300,680)(520,680)(760,680)
```

## Verification
- Confirm all 12 nodes and 14 connecting edges render cleanly inside the SVG viewBox.
- Confirm clicking a node triggers the `onSelectNode` handler without throwing runtime errors.
