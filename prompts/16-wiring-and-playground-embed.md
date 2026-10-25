Read AGENTS.md first and follow it strictly.

# Prompt 16: Exportable Embed Component & Wiring into Orcathon Playground

## Objective
Package the completed CrashLens Failure Radar into a self-contained, embeddable component (`<CrashLensRadar />`) that can either run standalone on port 3000/3001 or mount seamlessly inside Stage 4 (Zero-Auth Playground) of the Orcathon landing page, complete with environment variable contracts.

## Negative Constraints
- **Do not introduce global CSS side-effects** that clash with or override parent application styles.
- **Do not hardcode dimensions**; allow the component to fill its parent container responsively (`w-full h-full`).
- Ensure all 3 OpenRouter API keys can be passed via props or loaded via `.env.local`.

## Step-by-Step Instructions

1. **Construct the Exportable Wrapper (`src/components/radar/CrashLensRadar.tsx`)**:
   - Create the clean public interface:
     ```typescript
     export interface CrashLensRadarProps {
       standalone?: boolean;             // If false, fits inside Stage 4 container
       initialScenario?: ScenarioId;     // Optional auto-detonated incident
       compactMode?: boolean;            // Minimalist mode for mobile/embedded views
       apiKeys?: [string, string, string]; // Optional explicit key injection
       onIncidentResolved?: () => void;
     }

     export function CrashLensRadar({
       standalone = true,
       initialScenario,
       compactMode = false,
       apiKeys,
       onIncidentResolved,
     }: CrashLensRadarProps) { ... }
     ```
   - Encapsulate the `ClusterSimulator` lifecycle inside the component so it starts when mounted and cleanly cleans up its timer loops on unmount.

2. **Configure Environment Variables Contract (`.env.example`)**:
   - Provide a template file:
     ```bash
     # OpenRouter API Key Pool (3-Key Autonomous Failover)
     OPENROUTER_API_KEY_1=sk-or-v1-xxxxxxxxxxxxxxxxxxxx
     OPENROUTER_API_KEY_2=sk-or-v1-yyyyyyyyyyyyyyyyyyyy
     OPENROUTER_API_KEY_3=sk-or-v1-zzzzzzzzzzzzzzzzzzzz

     # Model Preferences (Free Tier Defaults)
     NEXT_PUBLIC_PRIMARY_MODEL=inception/mercury-decide:free
     NEXT_PUBLIC_SECONDARY_MODEL=liquid/lfm-2.5-2.6b:free
     ```

3. **Provide Parent UI Wiring Snippet**:
   - Document how the user or teammate mounts CrashLens into Stage 4 of Orcathon:
     ```tsx
     // Inside Orcathon Stage 4 Zero-Auth Playground:
     import { CrashLensRadar } from '@/components/radar/CrashLensRadar';

     export function ZeroAuthPlayground() {
       return (
         <div className="w-full h-[750px] rounded-2xl border border-white/10 bg-[#07080a] overflow-hidden">
           <CrashLensRadar standalone={false} />
         </div>
       );
     }
     ```

4. **Verify TypeScript & Production Build**:
   - Run `npx tsc --noEmit` and confirm 0 errors.
   - Run `npm run build` and ensure clean bundle generation with no SSR hydration mismatches.

## Documentation Injection
(Here paste Next.js 15 client component dynamic import guidelines: ssr: false)

## Verification
- Mount `<CrashLensRadar standalone={false} />` in a container with dimensions 1200x700: confirm full responsiveness.
- Verify simulation runs cleanly, key rotator initializes from environment variables, and the entire self-healing workflow is accessible without authentication.
