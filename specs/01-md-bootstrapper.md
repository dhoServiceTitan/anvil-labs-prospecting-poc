# Spec 01: MD Bootstrapper

**Status**: Pending
**Depends on**: —

## Goal

Allow any domain use case to be registered as a working assistant by dropping a single
markdown file into `use-cases/`. On first request for that assistant, the server reads
the MD file, calls Claude to generate a system prompt, mock data, and search tool
description, and caches the result. No custom code per use case. The existing chat UI
and frontend are unchanged.

## Deliverables

- [ ] `use-cases/fleet-pro.md` — sample use case (fleet maintenance)
- [ ] `use-cases/ccpro.md` — sample use case (call center)
- [ ] `server/bootstrapper.ts` — MD reader + Claude generation call + USE_CASE_REGISTRY
- [ ] `server/assistantConfig.ts` — `buildAssistantConfig()` checks USE_CASE_REGISTRY before falling back to hardcoded prospecting config
- [ ] `server/index.ts` — no startup changes needed (lazy generation handles it)

## MD File Format

```markdown
# Use Case: Fleet Pro

## Task
Help fleet managers answer questions about vehicle maintenance —
costs, service history, and upcoming needs across their fleet.

## Entities
- Vehicle: make, model, year, mileage, license_plate, driver
- MaintenanceRecord: service_type, date, cost, technician, status
- UpcomingService: vehicle, service_type, due_date, estimated_cost

## Sample Queries
- Show me the average cost of oil changes across my fleet
- Which vehicles are due for maintenance next quarter?
- Which vehicles are overdue right now?

## User Journey
1. User asks a question about their fleet
2. Results appear in the panel — each row shows vehicle info +
   service details + a status badge (Overdue / Upcoming / Done)
3. User can click "Schedule" on an overdue item to book maintenance
4. After scheduling, agent re-renders the panel with updated status
```

The filename (minus `.md`) becomes the assistant ID. `fleet-pro.md` → `fleet-pro`.

## API Surface

```typescript
// server/bootstrapper.ts

export interface BootstrappedConfig {
  systemPrompt: string;
  mockData: GenericResult[];       // GenericResult from src/types.ts
  searchDescription: string;
}

// Lazy: reads MD and calls Claude on first request, caches result.
// Returns null if file not found or generation fails.
export async function bootstrapUseCase(
  assistantId: string,
  client: Anthropic,
): Promise<BootstrappedConfig | null>

// In-memory cache. Populated by bootstrapUseCase().
export const USE_CASE_REGISTRY: Map<string, BootstrappedConfig>
```

```typescript
// Generation prompt sent to Claude (within bootstrapUseCase):
// Returns JSON: { systemPrompt, mockData, searchDescription }
// mockData items: { id, title, subtitle?, meta?, badge? }
// systemPrompt includes: search → query_anvil → render_ui (target: panel) workflow
// searchDescription: one sentence, becomes the `search` tool's description field
```

```typescript
// server/assistantConfig.ts — updated buildAssistantConfig()

export async function buildAssistantConfig(
  assistantId: string,
  client: Anthropic,        // needed for lazy bootstrap generation
): Promise<AssistantBuildResult>
// Checks USE_CASE_REGISTRY first → bootstrapUseCase() if not cached
// Falls back to hardcoded prospecting config if assistantId === 'commercial_prospecting_assistant'
// Returns generic config with empty mock data if bootstrap fails
```

## Acceptance Criteria

1. Dropping `fleet-pro.md` into `use-cases/` and selecting "fleet-pro" in the chat UI
   produces a working assistant — no server restart, no code changes
2. First request triggers generation (1–3s delay); subsequent requests use the cache
3. The generated `mockData` contains 15–25 items with realistic domain-specific content
   (not generic "Item 1", "Item 2" placeholders)
4. The generated `systemPrompt` includes the `search → query_anvil → render_ui` workflow
   and sets `target: "panel"`
5. If Claude generation fails or returns malformed JSON, `bootstrapUseCase` returns `null`,
   a `console.warn` is emitted, and the chat UI shows a graceful error — server does not crash
6. `USE_CASE_REGISTRY` is never consulted for `commercial_prospecting_assistant` —
   that assistant keeps its hardcoded config
7. Two sample MD files (`fleet-pro.md`, `ccpro.md`) exist and each produces a working
   assistant end to end

## Design Decisions

### Lazy generation, not startup preload

Bootstrap runs on first request per use case, not at server startup. This avoids adding
3–5s per MD file to cold start time, and makes iteration fast — edit an MD file, clear
the cache entry, re-request to regenerate without restarting the server.

### Claude generates all three artifacts in one call

A single Claude call returns `{ systemPrompt, mockData, searchDescription }` as JSON.
One round-trip keeps latency low and ensures the three outputs are coherent with each
other (the system prompt references the same domain as the mock data).

### MD file ID derived from filename

`fleet-pro.md` → assistant ID `fleet-pro`. Simple, no config needed. The AssistantPicker
reads IDs from the registry; bootstrapped use cases will need a thin entry added to
`src/registry.ts` for the picker to show them (or the picker can auto-discover `use-cases/`
via a `/api/use-cases` endpoint — defer this to Spec 02).
