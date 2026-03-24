# Spec 02: Eval Harness

**Status**: Pending
**Depends on**: Spec 01 (MD Bootstrapper)

## Goal

Run every sample query from every use case MD file through the full agent stream and
produce a markdown component choice matrix: `use case × query → query_anvil query sent
→ Anvil2 component returned → render_ui component chosen → target → status`. The output
makes it possible to evaluate whether `query_anvil` picks appropriate Anvil2 components
across diverse domains without manually testing each one.

## Deliverables

- [ ] `server/evalHarness.ts` — standalone script, runs all use cases, writes report
- [ ] `use-cases/salespro.md` — eval use case
- [ ] `use-cases/marketing.md` — eval use case
- [ ] `use-cases/invoicing.md` — eval use case (multi-step, stress test)
- [ ] `use-cases/hr-onboarding.md` — eval use case (novel domain, not in Atlas today)
- [ ] `eval-report-{timestamp}.md` — output artifact (gitignored)

## API Surface

```typescript
// server/evalHarness.ts — run with: tsx server/evalHarness.ts

interface EvalRow {
  useCaseId: string;
  query: string;
  queryAnvilQuery: string | null;      // what the agent sent to query_anvil
  anvil2ComponentSuggested: string | null; // component name from Anvil2 docs
  renderUiComponent: string | null;    // what the agent passed to render_ui
  renderUiTarget: string | null;       // "panel" | "overlay"
  registryHit: boolean;                // true if component was in COMPONENT_REGISTRY
  status: 'ok' | 'fallback' | 'error'; // ok=registry hit, fallback=DialogRenderer used
}

// Main entry point
async function runEval(): Promise<void>
// For each use case: bootstrap config, run each sample query, collect EvalRows
// Write eval-report-{timestamp}.md to project root
```

## Eval Mechanism

The SSE stream already emits all needed data — no interception or middleware required:

```
TOOL_CALL_ARGS (tool: query_anvil)   → captures query_anvil input query
TOOL_CALL_RESULT (tool: query_anvil) → captures Anvil2 docs returned (extract component name)
TOOL_CALL_ARGS (tool: render_ui)     → captures component + target chosen by agent
CUSTOM { name: "RENDER_UI" }         → confirms render fired; cross-check component name
```

Parse these events from the stream sequentially per query run. No changes to
`agUiBridge.ts` needed.

## Output Format

```markdown
# Generative UI Eval Report — {date}

## Summary
- Use cases tested: N
- Total queries: M
- Registry hits: X/M (Y%)
- Fallbacks to Dialog: Z/M
- Errors: 0/M

## Fleet Pro (fleet-pro.md)
| Query | query_anvil sent | Component chosen | Target | Status |
|-------|-----------------|-----------------|--------|--------|
| Average cost of oil changes | scrollable list with cost summaries and totals | Drawer | panel | ✓ ok |
| Vehicles overdue | list with alert badges for overdue items | List | panel | ? fallback: Dialog |
| Most frequent service types | ranked list with frequency counts | Drawer | panel | ✓ ok |

## CCPro (ccpro.md)
...

## Invoicing (invoicing.md)
...

## HR Onboarding (hr-onboarding.md)
...

## Observations
[Written manually after reviewing the report]
```

## Acceptance Criteria

1. `tsx server/evalHarness.ts` runs to completion without crashing, even if individual
   queries fail (errors captured in `status: 'error'` rows)
2. Output file written to project root as `eval-report-{timestamp}.md`
3. Every sample query from every MD file in `use-cases/` appears as a row in the report
4. `queryAnvilQuery` is populated for every row where `query_anvil` was called —
   empty only if the agent skipped the tool call entirely
5. `registryHit` correctly reflects whether the chosen component exists in
   `COMPONENT_REGISTRY` (check `AgentUIOverlay.tsx` at runtime)
6. The 4 new MD files (`salespro.md`, `marketing.md`, `invoicing.md`, `hr-onboarding.md`)
   each have 3–5 sample queries and cover meaningfully different display patterns
7. At least one query in the full run produces `status: 'fallback'` — confirming the
   harness can detect component misses, not just successes

## Design Decisions

### Parse SSE stream, don't modify agUiBridge

The existing SSE stream emits `TOOL_CALL_ARGS` and `CUSTOM/RENDER_UI` events that carry
all needed data. Adding eval hooks to `agUiBridge.ts` would couple production code to
test infrastructure. The harness makes a normal HTTP POST to `/api/chat` and reads the
stream like any client would.

### Sequential runs, no parallelism

Queries run sequentially (one at a time) to avoid hammering the Anvil2 MCP server and
to keep the eval log readable in order. With ~6 use cases × ~4 queries each = ~24
round-trips, sequential is fast enough (under 2 minutes total).

### `invoicing.md` as stress test

Invoicing is a multi-step workflow (build → review → send), unlike the search/results
pattern all other use cases share. Including it tests whether the agent's `query_anvil`
queries and component choices remain appropriate when the use case description implies
state transitions rather than a single results panel.
