import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USE_CASES_DIR = path.join(__dirname, '..', 'use-cases');

export interface GenericResult {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  badge?: string;
}

export interface BootstrappedConfig {
  type: 'search' | 'wizard';
  systemPrompt: string;
  mockData: GenericResult[];
  searchDescription: string; // empty string for wizard type
}

// In-memory cache. Populated lazily on first request per use case.
export const USE_CASE_REGISTRY = new Map<string, BootstrappedConfig>();

// ─── Generation prompts ────────────────────────────────────────────────────────

const SEARCH_GENERATION_PROMPT = `You are given a use-case description for an AI assistant. Generate a JSON object with three fields:

1. "systemPrompt" — A system prompt for the assistant. It MUST include these workflow instructions:
   - Call \`search\` first to retrieve relevant items based on the user's query.
   - Then call \`query_anvil\` to discover the right Anvil2 component for displaying the results.
   - Then call \`render_ui\` with the component name from query_anvil. Always set target: "panel".
   - The server injects the result items automatically — do not include data in render_ui props.
   - Be concise and professional.

2. "mockData" — An array of 15-25 realistic mock items for this domain. Each item must have:
   - "id": unique string (e.g. "item-1")
   - "title": primary display text (specific, realistic — not "Item 1")
   - "subtitle": secondary line (optional but recommended)
   - "meta": small metadata label (optional, e.g. a date, cost, or count)
   - "badge": status badge text (optional, e.g. "Overdue", "Active", "Pending")

3. "searchDescription" — A single sentence describing what the search tool finds, starting with an action verb.
   Example: "Search fleet maintenance records by vehicle, service type, cost, or status."

Respond with ONLY valid JSON, no markdown, no code fences.`;

const WIZARD_GENERATION_PROMPT = `You are given a wizard use-case description for an AI assistant. Generate a JSON object with two fields:

1. "systemPrompt" — A system prompt for the assistant. It MUST include these workflow instructions:

   INITIAL LOAD (when user says "start" or any greeting):
   - Call \`query_anvil\` to find a to-do list or checklist component.
   - Call \`render_ui\` with target: "panel" to show the full step list. Server injects step data.
   - Tell the user what the wizard does and invite them to begin Step 1. STOP — do not execute any steps yet.

   WHEN USER BEGINS A STEP (user says "begin", "next", "proceed", "go", or similar):
   - Immediately call \`execute_step\` with the current step number — no confirmation needed.
   - After \`execute_step\` returns, call \`render_ui\` again to refresh the panel (server updates badges).
   - Briefly describe what was done. Then invite the user to begin the next step. STOP and wait.

   RULES:
   - Never auto-advance steps. Always wait for the user to explicitly say they want to proceed.
   - Walk steps sequentially (1 → 2 → 3 ...). Do not skip or combine steps.
   - Keep text responses short — the panel carries the progress state, not the chat.
   - After step 5 completes, call \`render_ui\` one final time and congratulate the user.

2. "mockData" — An array with exactly one item per step defined in the use case. Each item must have:
   - "id": "step-N" (e.g. "step-1")
   - "title": the step name (short, matches the step list in the use case description)
   - "subtitle": one sentence describing what this step does
   - "badge": "Pending" for all steps (the server will update this to "Active" or "Complete" at runtime)

Respond with ONLY valid JSON, no markdown, no code fences.`;

// ─── MD parsing helpers ────────────────────────────────────────────────────────

function detectUseCaseType(mdContent: string): 'search' | 'wizard' {
  const typeMatch = mdContent.match(/^##\s+Type\s*\n([^\n]+)/m);
  if (typeMatch && typeMatch[1].trim().toLowerCase() === 'wizard') {
    return 'wizard';
  }
  return 'search';
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

/**
 * Lazy bootstrap: reads the MD file for the given assistantId, calls Claude to generate
 * config, and caches the result. Returns null if file not found or generation fails.
 */
export async function bootstrapUseCase(
  assistantId: string,
  client: Anthropic,
): Promise<BootstrappedConfig | null> {
  const cached = USE_CASE_REGISTRY.get(assistantId);
  if (cached) return cached;

  const mdPath = path.join(USE_CASES_DIR, `${assistantId}.md`);
  let mdContent: string;
  try {
    mdContent = await fs.readFile(mdPath, 'utf-8');
  } catch {
    console.warn(`[bootstrapper] No MD file found for assistantId: "${assistantId}" at ${mdPath}`);
    return null;
  }

  const useCaseType = detectUseCaseType(mdContent);
  const generationPrompt =
    useCaseType === 'wizard' ? WIZARD_GENERATION_PROMPT : SEARCH_GENERATION_PROMPT;

  try {
    const response = await client.messages.create({
      model: process.env.CLAUDE_FOUNDRY_DEPLOYMENT ?? 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: `${generationPrompt}\n\n---\n\n${mdContent}` }],
    });

    const rawText = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    const parsed = JSON.parse(rawText) as {
      systemPrompt: string;
      mockData: GenericResult[];
      searchDescription?: string;
    };

    if (typeof parsed.systemPrompt !== 'string' || !Array.isArray(parsed.mockData)) {
      throw new Error('Generated JSON is missing required fields');
    }

    const config: BootstrappedConfig = {
      type: useCaseType,
      systemPrompt: parsed.systemPrompt,
      mockData: parsed.mockData,
      searchDescription: parsed.searchDescription ?? '',
    };

    USE_CASE_REGISTRY.set(assistantId, config);
    console.log(
      `[bootstrapper] Generated ${useCaseType} config for "${assistantId}": ${config.mockData.length} items`,
    );
    return config;
  } catch (err) {
    console.warn(
      `[bootstrapper] Failed to generate config for "${assistantId}": ${err instanceof Error ? err.message : err}`,
    );
    return null;
  }
}
