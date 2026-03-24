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
  systemPrompt: string;
  mockData: GenericResult[];
  searchDescription: string;
}

// In-memory cache. Populated lazily on first request per use case.
export const USE_CASE_REGISTRY = new Map<string, BootstrappedConfig>();

const GENERATION_PROMPT = `You are given a use-case description for an AI assistant. Generate a JSON object with three fields:

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

/**
 * Lazy bootstrap: reads the MD file for the given assistantId, calls Claude to generate
 * systemPrompt + mockData + searchDescription, and caches the result.
 * Returns null if the file is not found or generation fails.
 */
export async function bootstrapUseCase(
  assistantId: string,
  client: Anthropic,
): Promise<BootstrappedConfig | null> {
  // Return cached result if available
  const cached = USE_CASE_REGISTRY.get(assistantId);
  if (cached) return cached;

  // Read the MD file
  const mdPath = path.join(USE_CASES_DIR, `${assistantId}.md`);
  let mdContent: string;
  try {
    mdContent = await fs.readFile(mdPath, 'utf-8');
  } catch {
    console.warn(`[bootstrapper] No MD file found for assistantId: "${assistantId}" at ${mdPath}`);
    return null;
  }

  // Call Claude to generate the config
  try {
    const response = await client.messages.create({
      model: process.env.CLAUDE_FOUNDRY_DEPLOYMENT ?? 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `${GENERATION_PROMPT}\n\n---\n\n${mdContent}`,
        },
      ],
    });

    const rawText = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    const parsed = JSON.parse(rawText) as {
      systemPrompt: string;
      mockData: GenericResult[];
      searchDescription: string;
    };

    if (
      typeof parsed.systemPrompt !== 'string' ||
      !Array.isArray(parsed.mockData) ||
      typeof parsed.searchDescription !== 'string'
    ) {
      throw new Error('Generated JSON is missing required fields');
    }

    const config: BootstrappedConfig = {
      systemPrompt: parsed.systemPrompt,
      mockData: parsed.mockData,
      searchDescription: parsed.searchDescription,
    };

    USE_CASE_REGISTRY.set(assistantId, config);
    console.log(
      `[bootstrapper] Generated config for "${assistantId}": ${config.mockData.length} mock items`,
    );
    return config;
  } catch (err) {
    console.warn(
      `[bootstrapper] Failed to generate config for "${assistantId}": ${err instanceof Error ? err.message : err}`,
    );
    return null;
  }
}
