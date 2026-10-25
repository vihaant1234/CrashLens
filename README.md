# CrashLens — Predictive Failure Radar for Distributed Systems

> **ORCATHON 2026 | Track 01: Software & AI**  
> A self-contained chaos sandbox and predictive failure radar that flags microservice failures before they crash production, traces blast radius across the dependency graph, pinpoints root cause with System 1 models, and executes automated recovery with dual-timeline validation.

---

## Repository Structure
- `AGENTS.md` — Core architectural specification, coding standards, System 1 decision contracts, and 3-key rotation protocols.
- `context.md` — Detailed problem statement context, 12-service topology, telemetry schemas, incident scenarios, and judge rubric.
- `prompts/` — Phased 16-step JS Mastery prompt sequence for autonomous agentic implementation.

## Embedding the Radar

The radar is available as a client component and fills its parent when `standalone` is `false`:

```tsx
import { CrashLensRadar } from '@/components/radar/CrashLensRadar';

export function ZeroAuthPlayground() {
  return (
    <div className="h-[750px] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#07080a]">
      <CrashLensRadar standalone={false} />
    </div>
  );
}
```

The parent must provide a measurable height. For a standalone screen, use `<CrashLensRadar />`.
Set OpenRouter credentials in `.env.local` using the server-only variable names in `.env.example`.
Never expose provider keys through `NEXT_PUBLIC_*`. The optional `apiKeys` prop supports explicit runtime
injection for controlled deployments, but these values are sent to the same-origin server route and should
only be used when the embedding application already has a secure way to provide them.
