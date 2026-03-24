import dotenv from 'dotenv';
dotenv.config({ path: '/Users/dho@servicetitan.com/Documents/Code/.connectors/.env', override: true });
import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import { runAgentStream, ProspectingState } from './agUiBridge.js';
import { runGenericAgentStream, GenericState } from './genericAgUiBridge.js';
import { buildAssistantConfig } from './assistantConfig.js';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

app.use(cors());
app.use(express.json());

// Azure AI Foundry expects `api-key` header; Anthropic SDK sends `x-api-key`.
const client = new Anthropic({
  baseURL: process.env.CLAUDE_FOUNDRY_ENDPOINT,
  apiKey: process.env.CLAUDE_FOUNDRY_API_KEY,
  defaultHeaders: { 'api-key': process.env.CLAUDE_FOUNDRY_API_KEY },
});

// Per-session state — keyed by sessionId
const prospectingSessions = new Map<
  string,
  { apiMessages: Anthropic.MessageParam[]; prospectingState: ProspectingState }
>();

const genericSessions = new Map<
  string,
  { apiMessages: Anthropic.MessageParam[]; state: GenericState }
>();

app.post('/api/chat', async (req, res) => {
  const { messages, sessionId, assistantId: rawAssistantId } = req.body as {
    messages: Anthropic.MessageParam[];
    sessionId: string;
    assistantId?: string;
  };

  if (!sessionId || !messages) {
    res.status(400).json({ error: 'sessionId and messages are required' });
    return;
  }

  const assistantId = rawAssistantId ?? 'commercial_prospecting_assistant';

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const config = await buildAssistantConfig(assistantId, client);

    if (config.type === 'prospecting') {
      const session = prospectingSessions.get(sessionId) ?? {
        apiMessages: [] as Anthropic.MessageParam[],
        prospectingState: { query: null, contacts: null, addedLeads: [] },
      };
      const newApiMessages = [...session.apiMessages, ...messages];
      const result = await runAgentStream(client, newApiMessages, session.prospectingState, res);
      prospectingSessions.set(sessionId, result);
    } else {
      const session = genericSessions.get(sessionId) ?? {
        apiMessages: [] as Anthropic.MessageParam[],
        state: { lastResults: [], completedSteps: [] },
      };
      const newApiMessages = [...session.apiMessages, ...messages];
      const result = await runGenericAgentStream(
        client,
        newApiMessages,
        session.state,
        config.mockData,
        config.systemPrompt,
        config.tools,
        res,
      );
      genericSessions.set(sessionId, result);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.write(`data: ${JSON.stringify({ type: 'RUN_ERROR', error: message })}\n\n`);
  } finally {
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Express API server running on http://localhost:${PORT}`);
});
