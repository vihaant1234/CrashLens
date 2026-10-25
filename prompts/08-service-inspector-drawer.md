Read AGENTS.md first and follow it strictly.

# Prompt 08: Service Inspector Drawer, Real-Time Sparklines & Log Stream

## Objective
Build the slide-over Service Inspector Drawer that opens when a user clicks any node in the topology radar, rendering real-time metric gauges, a 60-second p99 latency sparkline from the circular ring buffer, a dependency breakdown, and a live log stream.

## Negative Constraints
- **Do not implement the AI recommendation engine yet.**
- **Do not install heavy graphing libraries (e.g. Chart.js, Recharts)**; use a lightweight SVG sparkline component for maximum speed and zero bundle bloat.
- Focus on fast, responsive UI feedback when inspecting services under normal and degraded conditions.

## Step-by-Step Instructions

1. **Build the Lightweight SVG Sparkline Component (`src/components/inspector/MetricSparkline.tsx`)**:
   - Props: `data: number[]`, `color?: string`, `height?: number`, `baseline?: number`.
   - Normalize the last 60 numbers into an SVG `<polyline>` path:
     $$y_i = \text{height} - \left(\frac{v_i - \min}{\max - \min + \epsilon}\right) \times \text{height}$$
   - Render a subtle gradient area fill underneath the curve.
   - Render a horizontal dashed line at the baseline value for visual threshold reference.

2. **Construct the Service Inspector Drawer (`src/components/inspector/ServiceInspector.tsx`)**:
   - Fixed slide-over or right-hand panel (`w-96`, background `rgba(13, 15, 22, 0.95)`, `backdrop-blur-md`):
   - **Header Section**:
     - Service Name (`payments-svc`), Role badge (`CORE-LOGIC`), Status badge (`CRITICAL`).
     - Close button (`[X]`).
   - **Key Metrics Grid (2x2)**:
     - p99 Latency: e.g. `842ms` (vs baseline `55ms`, +1430%).
     - Error Rate: e.g. `14.2%`.
     - CPU Saturation: e.g. `88%`.
     - Connection / Thread Queue: e.g. `48/50 (96%)`.
   - **Historical Sparklines**:
     - 60-second p99 Latency trend line.
     - 60-second CPU & Memory trend line.
   - **Dependency Cross-Reference**:
     - Upstream Callers: List services calling this node (e.g., `orders-svc`).
     - Downstream Dependencies: List services called by this node with live edge latency (e.g., `payments-db: 920ms`, `fraud-svc: 42ms`).
   - **Live Log Terminal**:
     - Compact dark terminal box showing the last 8 log lines from `NodeTelemetry.recentLogs`.
     - Color-coded log tags (`[INFO]` cyan, `[WARN]` amber, `[ERROR]` red).

3. **Wire Selected Node State**:
   - In `TopologyCanvas`, clicking any node sets `useClusterStore.getState().selectService(serviceId)`.
   - When `selectedServiceId` is non-null, display `<ServiceInspector />` on the right side of the screen.

## Documentation Injection
(Here paste SVG polyline normalization algorithms and React slide-over transitions)

## Visual Grounding
Refer to the inspector drawer layout in `@prompt_material/08-service-inspector.png`:
```
+------------------------------------------+
| PAYMENTS-SVC              [ CRITICAL ] X |
| Core Saga Payment Processor              |
+------------------------------------------+
| [ p99 Latency ]        [ Error Rate ]    |
|   842 ms (+1430%)         14.2%          |
| [ CPU Load ]           [ Conn Pool ]     |
|   88%                     48/50 (96%)    |
+------------------------------------------+
| 60-SECOND LATENCY TREND                  |
|   _/\__/\______/\/\/\/\------- 842ms     |
|   ............................  55ms baseline
+------------------------------------------+
| DEPENDENCIES                             |
|  ▲ Upstream: orders-svc (842ms)          |
|  ▼ Downstream: payments-db (920ms ⚠)     |
|  ▼ Downstream: fraud-svc (42ms ✓)        |
+------------------------------------------+
| LIVE LOGS                                |
| 11:32:04 [WARN] Pool checkout timeout    |
| 11:32:05 [ERROR] Conn pool exhausted!    |
+------------------------------------------+
```

## Verification
- Click `payments-svc` during an active incident: confirm the drawer slides open.
- Confirm sparkline updates every second with incoming ring buffer telemetry.
- Confirm downstream culprit `payments-db` is flagged with a warning icon in the dependency list.
