# Agentic Booking POC

A proof-of-concept demonstrating an agentic workflow where Claude drives a 3-step service call booking process through a chat interface — and selects its own UI components at runtime by querying the live Anvil2 design system documentation via MCP.

## What makes this agentic

- **The agent decides what to do next** — no hardcoded step logic. The agent reads the conversation, reasons about what it knows, and calls tools when it has enough information.
- **Tool calls drive state transitions** — the right panel updates because the agent called `set_service_intent` or `collect_contact_details`, not because the UI parsed chat text.
- **The agent queries Anvil2 docs in real time** — before rendering any UI component, the agent calls `query_anvil` which proxies to the live [Anvil2 MCP server](https://anvil.servicetitan.com/mcp). It reads the actual documentation and picks the component name from there. No component names are hardcoded in the agent's instructions.
- **Flexible input handling** — give the agent all your info in one message and it will complete multiple steps in a single turn.

## Architecture

```
Browser (React + Anvil2)
    ↕ SSE (AG-UI events)
Express server
    ↕ Streaming tool use
Claude claude-sonnet-4-6 (Anthropic API)
    ↕ MCP (HTTP)
Anvil2 MCP server (anvil.servicetitan.com/mcp)
```

### Agent tools

| Tool | Purpose |
|---|---|
| `set_service_intent` | Marks Step 1 complete — classifies the service type |
| `collect_contact_details` | Marks Step 2 complete — name, phone, address |
| `query_anvil` | Queries live Anvil2 MCP docs to discover the right UI component |
| `render_ui` | Renders the Anvil2 component the agent discovered |
| `schedule_call` | Marks Step 3 complete — records the chosen time slot |

### Event flow (AG-UI over SSE)

```
Client sends message → POST /api/chat
Server streams AG-UI events:
  RUN_STARTED
  TEXT_MESSAGE_START / CONTENT / END   ← streaming assistant text
  TOOL_CALL_START / ARGS / END         ← agent calling a tool
  TOOL_CALL_RESULT                     ← tool result (incl. Anvil MCP docs)
  STATE_SNAPSHOT                       ← booking state updated
  CUSTOM { name: 'RENDER_UI', ... }    ← agent-chosen Anvil2 component
  RUN_FINISHED
```

### Frontend component resolution

The frontend maintains a registry of Anvil2 component renderers. When the agent emits a `RENDER_UI` event with a component name it discovered from the docs, the frontend resolves it case-insensitively and falls back to `Dialog` for unknown names:

```typescript
const COMPONENT_REGISTRY = {
  drawer: DrawerRenderer,
  dialog: DialogRenderer,
  popover: PopoverRenderer,
};

const Renderer = COMPONENT_REGISTRY[componentName.toLowerCase()] ?? DialogRenderer;
```

## Tech stack

- **React 18 + TypeScript** via Vite
- **Node.js + Express** — thin backend, bridges Claude → AG-UI SSE
- **[@servicetitan/anvil2](https://anvil.servicetitan.com)** — all UI components and tokens
- **[@anthropic-ai/sdk](https://github.com/anthropic-ai/anthropic-sdk-node)** — Claude streaming API
- **[@ag-ui/core + @ag-ui/client](https://github.com/ag-ui-protocol/ag-ui)** — AG-UI event protocol
- **Model** — `claude-sonnet-4-6`

## Getting started

### Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com) with credits

### Install

```bash
npm install
```

### Configure

Create a `.env` file in the project root:

```
ANTHROPIC_API_KEY=sk-ant-...
PORT=3001
```

### Run

```bash
npm start
```

This starts both the Vite dev server (`localhost:5173`) and the Express API server (`localhost:3001`) concurrently.

Or run them separately:

```bash
npm run dev     # Vite frontend
npm run server  # Express backend
```

## Project structure

```
├── server/
│   ├── index.ts           # Express app, /api/chat SSE endpoint
│   ├── agentTools.ts      # Claude tool definitions + system prompt
│   ├── agUiBridge.ts      # Claude streaming → AG-UI event translator
│   └── mcpAnvilClient.ts  # Live Anvil2 MCP client (query_anvil tool)
└── src/
    ├── App.tsx
    ├── types.ts
    ├── hooks/
    │   └── useBookingAgent.ts     # SSE client, state management
    └── components/
        ├── AgentUIOverlay.tsx     # Agent-driven component renderer
        ├── BookingProgress.tsx    # Right panel — step tracker
        ├── ChatWindow.tsx
        ├── MessageBubble.tsx
        ├── ChatInput.tsx
        └── StepCard.tsx
```
