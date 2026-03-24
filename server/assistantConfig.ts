import Anthropic from '@anthropic-ai/sdk';
import { TOOLS, SYSTEM_PROMPT } from './agentTools.js';
import { bootstrapUseCase, USE_CASE_REGISTRY, GenericResult } from './bootstrapper.js';

export type { GenericResult };

// ─── Tool definitions shared across both assistant types ──────────────────────

const QUERY_ANVIL_TOOL: Anthropic.Tool = {
  name: 'query_anvil',
  description: `Query the Anvil2 design system documentation to discover the right component for a UI interaction.

Call this BEFORE render_ui whenever you need to present a richer UI interaction to the user.
Describe the interaction pattern you need — the tool returns real Anvil2 documentation including
component names, usage guidance, props, and code examples.`,
  input_schema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Describe the UI interaction pattern you need to implement.',
      },
    },
    required: ['query'],
  },
};

const RENDER_UI_TOOL: Anthropic.Tool = {
  name: 'render_ui',
  description: `Render an Anvil2 component showing the results.

ALWAYS call query_anvil first to determine the correct component name and understand its props.
Use the exact component name from the Anvil2 documentation.
The server will automatically inject the result items into the props — you do not need to include them yourself.`,
  input_schema: {
    type: 'object' as const,
    properties: {
      component: {
        type: 'string',
        description: 'Exact Anvil2 component name as returned by query_anvil (e.g., "Drawer", "Dialog").',
      },
      target: {
        type: 'string',
        enum: ['panel', 'overlay'],
        description: 'Where to render: "panel" renders inline; "overlay" opens a floating drawer or dialog.',
      },
      title: {
        type: 'string',
        description: 'Title shown in the component header.',
      },
      props: {
        type: 'object',
        description: 'Additional component props. Do not include data items — the server injects them.',
      },
    },
    required: ['component', 'target', 'props'],
  },
};

function buildSearchTool(description: string): Anthropic.Tool {
  return {
    name: 'search',
    description,
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query describing what to find.',
        },
      },
      required: ['query'],
    },
  };
}

const EXECUTE_STEP_TOOL: Anthropic.Tool = {
  name: 'execute_step',
  description: `Execute a wizard step immediately. Call this as soon as the user indicates they want to begin a step.
Do not ask for confirmation — execute immediately and then call render_ui to refresh the to-do list.`,
  input_schema: {
    type: 'object' as const,
    properties: {
      step_number: {
        type: 'number',
        description: 'The step number to execute (1-based).',
      },
    },
    required: ['step_number'],
  },
};

// ─── Result types ─────────────────────────────────────────────────────────────

export interface ProspectingBuildResult {
  type: 'prospecting';
  systemPrompt: string;
  tools: Anthropic.Tool[];
}

export interface GenericBuildResult {
  type: 'generic';
  systemPrompt: string;
  tools: Anthropic.Tool[];
  mockData: GenericResult[];
}

export type AssistantBuildResult = ProspectingBuildResult | GenericBuildResult;

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * Build the assistant config for a given assistantId.
 * - 'commercial_prospecting_assistant' → hardcoded prospecting config (never checks registry)
 * - Any other id → checks USE_CASE_REGISTRY, bootstraps if not cached
 * - Returns generic config with empty mockData if bootstrap fails
 */
export async function buildAssistantConfig(
  assistantId: string,
  client: Anthropic,
): Promise<AssistantBuildResult> {
  // AC 6: commercial_prospecting_assistant always uses hardcoded config
  if (assistantId === 'commercial_prospecting_assistant') {
    return {
      type: 'prospecting',
      systemPrompt: SYSTEM_PROMPT,
      tools: TOOLS,
    };
  }

  // Check registry first (may already be populated)
  let config = USE_CASE_REGISTRY.get(assistantId) ?? null;

  // Lazy bootstrap if not cached
  if (!config) {
    config = await bootstrapUseCase(assistantId, client);
  }

  if (!config) {
    // Bootstrap failed — return empty generic config so server doesn't crash
    return {
      type: 'generic',
      systemPrompt:
        'You are a helpful assistant. Tell the user that this assistant could not be loaded.',
      tools: [QUERY_ANVIL_TOOL, RENDER_UI_TOOL],
      mockData: [],
    };
  }

  const tools =
    config.type === 'wizard'
      ? [EXECUTE_STEP_TOOL, QUERY_ANVIL_TOOL, RENDER_UI_TOOL]
      : [buildSearchTool(config.searchDescription), QUERY_ANVIL_TOOL, RENDER_UI_TOOL];

  return {
    type: 'generic',
    systemPrompt: config.systemPrompt,
    tools,
    mockData: config.mockData,
  };
}
