/**
 * Eval Harness — Spec 02
 *
 * Run with: tsx server/evalHarness.ts
 *
 * Requires the server to be running on http://localhost:3001
 * Start with: npm run server
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USE_CASES_DIR = path.join(__dirname, '..', 'use-cases');
const SERVER_URL = process.env.EVAL_SERVER_URL ?? 'http://localhost:3001';

// Components known to be in COMPONENT_REGISTRY (from AgentUIOverlay.tsx)
const KNOWN_REGISTRY_COMPONENTS = new Set(['drawer', 'dialog', 'popover']);

// ─── Types ─────────────────────────────────────────────────────────────────────

interface EvalRow {
  useCaseId: string;
  query: string;
  queryAnvilQuery: string | null;
  anvil2ComponentSuggested: string | null;
  renderUiComponent: string | null;
  renderUiTarget: string | null;
  registryHit: boolean;
  status: 'ok' | 'fallback' | 'error';
}

// ─── MD file parsing ───────────────────────────────────────────────────────────

interface UseCaseInfo {
  id: string;
  sampleQueries: string[];
}

function parseSampleQueries(mdContent: string): string[] {
  const lines = mdContent.split('\n');
  const queries: string[] = [];
  let inSampleQueries = false;

  for (const line of lines) {
    if (line.trim().startsWith('## Sample Queries')) {
      inSampleQueries = true;
      continue;
    }
    if (inSampleQueries) {
      if (line.trim().startsWith('## ')) {
        // New section — stop
        break;
      }
      const match = line.match(/^[-*]\s+(.+)/);
      if (match) {
        queries.push(match[1].trim());
      }
    }
  }

  return queries;
}

async function loadUseCases(): Promise<UseCaseInfo[]> {
  const files = await fs.readdir(USE_CASES_DIR);
  const mdFiles = files.filter((f) => f.endsWith('.md'));

  const useCases: UseCaseInfo[] = [];
  for (const file of mdFiles) {
    const id = file.replace('.md', '');
    const content = await fs.readFile(path.join(USE_CASES_DIR, file), 'utf-8');
    const sampleQueries = parseSampleQueries(content);
    if (sampleQueries.length > 0) {
      useCases.push({ id, sampleQueries });
    }
  }

  return useCases;
}

// ─── SSE stream parsing ────────────────────────────────────────────────────────

interface SSEEvent {
  type: string;
  [key: string]: unknown;
}

async function parseSSEStream(response: Response): Promise<SSEEvent[]> {
  const text = await response.text();
  const events: SSEEvent[] = [];

  for (const line of text.split('\n')) {
    if (line.startsWith('data: ')) {
      try {
        const parsed = JSON.parse(line.slice(6)) as SSEEvent;
        events.push(parsed);
      } catch {
        // skip malformed lines
      }
    }
  }

  return events;
}

// ─── Single query evaluation ───────────────────────────────────────────────────

async function runQuery(useCaseId: string, query: string): Promise<EvalRow> {
  const row: EvalRow = {
    useCaseId,
    query,
    queryAnvilQuery: null,
    anvil2ComponentSuggested: null,
    renderUiComponent: null,
    renderUiTarget: null,
    registryHit: false,
    status: 'error',
  };

  try {
    const sessionId = `eval-${useCaseId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const response = await fetch(`${SERVER_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        assistantId: useCaseId,
        messages: [{ role: 'user', content: query }],
      }),
    });

    if (!response.ok) {
      console.error(`  [${useCaseId}] HTTP ${response.status} for query: "${query}"`);
      return row;
    }

    const events = await parseSSEStream(response);

    // Accumulate TOOL_CALL_ARGS deltas by toolCallId
    const toolArgsAccum: Record<string, string> = {};
    const toolNames: Record<string, string> = {};

    for (const event of events) {
      if (event.type === 'TOOL_CALL_START') {
        const toolCallId = event.toolCallId as string;
        const toolName = event.toolName as string;
        toolNames[toolCallId] = toolName;
        toolArgsAccum[toolCallId] = '';
      }

      if (event.type === 'TOOL_CALL_ARGS') {
        const toolCallId = event.toolCallId as string;
        toolArgsAccum[toolCallId] = (toolArgsAccum[toolCallId] ?? '') + (event.delta as string ?? '');
      }

      if (event.type === 'TOOL_CALL_END') {
        const toolCallId = event.toolCallId as string;
        const toolName = toolNames[toolCallId];
        const argsJson = toolArgsAccum[toolCallId] ?? '{}';

        try {
          const args = JSON.parse(argsJson) as Record<string, unknown>;

          if (toolName === 'query_anvil' || toolName === 'search_contacts') {
            if (row.queryAnvilQuery === null && toolName === 'query_anvil') {
              row.queryAnvilQuery = (args.query as string) ?? null;
            }
          }
        } catch {
          // ignore parse errors
        }
      }

      // Extract query_anvil result to get suggested component name
      if (event.type === 'TOOL_CALL_RESULT') {
        const toolCallId = event.toolCallId as string;
        const toolName = toolNames[toolCallId];

        if (toolName === 'query_anvil') {
          try {
            const result = JSON.parse(event.result as string) as { documentation?: string };
            const docs = result.documentation ?? '';
            // Extract first component name mentioned in docs (look for "## ComponentName" or "**ComponentName**")
            const componentMatch = docs.match(/##\s+([A-Z][a-zA-Z]+)/);
            if (componentMatch) {
              row.anvil2ComponentSuggested = componentMatch[1];
            }
          } catch {
            // ignore
          }
        }
      }

      // Capture render_ui from CUSTOM RENDER_UI event
      if (event.type === 'CUSTOM' && event.name === 'RENDER_UI') {
        const value = event.value as {
          component: string;
          target: string;
        };
        row.renderUiComponent = value.component ?? null;
        row.renderUiTarget = value.target ?? null;
      }
    }

    // Determine status
    if (row.renderUiComponent) {
      const isRegistryHit = KNOWN_REGISTRY_COMPONENTS.has(row.renderUiComponent.toLowerCase());
      row.registryHit = isRegistryHit;
      row.status = isRegistryHit ? 'ok' : 'fallback';
    } else {
      row.status = 'error';
    }

  } catch (err) {
    console.error(
      `  [${useCaseId}] Error running query "${query}": ${err instanceof Error ? err.message : err}`,
    );
  }

  return row;
}

// ─── Report generation ─────────────────────────────────────────────────────────

function statusIcon(status: EvalRow['status']): string {
  if (status === 'ok') return '✓ ok';
  if (status === 'fallback') return '? fallback: Dialog';
  return '✗ error';
}

function buildReport(rows: EvalRow[], timestamp: string): string {
  const total = rows.length;
  const hits = rows.filter((r) => r.registryHit).length;
  const fallbacks = rows.filter((r) => r.status === 'fallback').length;
  const errors = rows.filter((r) => r.status === 'error').length;
  const hitPct = total > 0 ? ((hits / total) * 100).toFixed(0) : '0';

  const useCaseIds = [...new Set(rows.map((r) => r.useCaseId))];

  const sections = useCaseIds.map((id) => {
    const useCaseRows = rows.filter((r) => r.useCaseId === id);
    const tableRows = useCaseRows
      .map((r) => {
        const query = r.query.length > 60 ? r.query.slice(0, 57) + '...' : r.query;
        const anvil = r.queryAnvilQuery
          ? r.queryAnvilQuery.length > 50 ? r.queryAnvilQuery.slice(0, 47) + '...' : r.queryAnvilQuery
          : '—';
        const component = r.renderUiComponent ?? '—';
        const target = r.renderUiTarget ?? '—';
        return `| ${query} | ${anvil} | ${component} | ${target} | ${statusIcon(r.status)} |`;
      })
      .join('\n');

    return `## ${id}\n| Query | query_anvil sent | Component chosen | Target | Status |\n|-------|-----------------|-----------------|--------|--------|\n${tableRows}`;
  });

  return [
    `# Generative UI Eval Report — ${timestamp}`,
    '',
    '## Summary',
    `- Use cases tested: ${useCaseIds.length}`,
    `- Total queries: ${total}`,
    `- Registry hits: ${hits}/${total} (${hitPct}%)`,
    `- Fallbacks to Dialog: ${fallbacks}/${total}`,
    `- Errors: ${errors}/${total}`,
    '',
    ...sections.flatMap((s) => [s, '']),
    '## Observations',
    '[Written manually after reviewing the report]',
  ].join('\n');
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function runEval(): Promise<void> {
  console.log(`[eval] Loading use cases from ${USE_CASES_DIR}...`);
  const useCases = await loadUseCases();
  console.log(`[eval] Found ${useCases.length} use cases`);

  const allRows: EvalRow[] = [];

  for (const useCase of useCases) {
    console.log(`\n[eval] Running ${useCase.sampleQueries.length} queries for "${useCase.id}"...`);

    for (const query of useCase.sampleQueries) {
      console.log(`  → "${query}"`);
      const row = await runQuery(useCase.id, query);
      console.log(`    status: ${row.status}, component: ${row.renderUiComponent ?? 'none'}`);
      allRows.push(row);
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const reportPath = path.join(__dirname, '..', `eval-report-${timestamp}.md`);
  const report = buildReport(allRows, timestamp);

  await fs.writeFile(reportPath, report, 'utf-8');
  console.log(`\n[eval] Report written to ${reportPath}`);

  // Summary
  const total = allRows.length;
  const hits = allRows.filter((r) => r.registryHit).length;
  const fallbacks = allRows.filter((r) => r.status === 'fallback').length;
  const errors = allRows.filter((r) => r.status === 'error').length;
  console.log(`[eval] Results: ${hits}/${total} registry hits, ${fallbacks} fallbacks, ${errors} errors`);
}

runEval().catch((err) => {
  console.error('[eval] Fatal error:', err);
  process.exit(1);
});
