import Anthropic from '@anthropic-ai/sdk';
import { Response } from 'express';
import { TOOLS, SYSTEM_PROMPT, Contact, searchContacts } from './agentTools.js';
import { searchAnvil } from './mcpAnvilClient.js';

export interface ProspectingState {
  query: string | null;
  contacts: Contact[] | null;
  addedLeads: string[];
}

// AG-UI event type constants (matching @ag-ui/core EventType enum values)
const EventType = {
  RUN_STARTED: 'RUN_STARTED',
  RUN_FINISHED: 'RUN_FINISHED',
  RUN_ERROR: 'RUN_ERROR',
  TEXT_MESSAGE_START: 'TEXT_MESSAGE_START',
  TEXT_MESSAGE_CONTENT: 'TEXT_MESSAGE_CONTENT',
  TEXT_MESSAGE_END: 'TEXT_MESSAGE_END',
  TOOL_CALL_START: 'TOOL_CALL_START',
  TOOL_CALL_ARGS: 'TOOL_CALL_ARGS',
  TOOL_CALL_END: 'TOOL_CALL_END',
  TOOL_CALL_RESULT: 'TOOL_CALL_RESULT',
  STATE_SNAPSHOT: 'STATE_SNAPSHOT',
  CUSTOM: 'CUSTOM',
} as const;

function sendEvent(res: Response, type: string, data: Record<string, unknown>) {
  const event = JSON.stringify({ type, timestamp: Date.now(), ...data });
  res.write(`data: ${event}\n\n`);
}

export async function runAgentStream(
  client: Anthropic,
  apiMessages: Anthropic.MessageParam[],
  prospectingState: ProspectingState,
  res: Response
): Promise<{ apiMessages: Anthropic.MessageParam[]; prospectingState: ProspectingState }> {
  let msgs = [...apiMessages];
  let state = { ...prospectingState };

  sendEvent(res, EventType.RUN_STARTED, { runId: crypto.randomUUID() });

  // Inner loop: keep going while the agent is calling tools
  while (true) {
    const messageId = crypto.randomUUID();
    let currentTextId: string | null = null;

    // Accumulate blocks manually as the stream arrives
    const blockAccum: Record<number, {
      type: 'text' | 'tool_use';
      id?: string;
      name?: string;
      text: string;
      inputJson: string;
    }> = {};

    const stream = await client.messages.stream({
      model: process.env.CLAUDE_FOUNDRY_DEPLOYMENT ?? 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: msgs,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        const block = event.content_block;
        const idx = event.index;

        if (block.type === 'text') {
          blockAccum[idx] = { type: 'text', text: '', inputJson: '' };
          currentTextId = crypto.randomUUID();
          sendEvent(res, EventType.TEXT_MESSAGE_START, {
            messageId,
            textMessageId: currentTextId,
            role: 'assistant',
          });
        } else if (block.type === 'tool_use') {
          blockAccum[idx] = { type: 'tool_use', id: block.id, name: block.name, text: '', inputJson: '' };
          sendEvent(res, EventType.TOOL_CALL_START, {
            toolCallId: block.id,
            toolName: block.name,
            messageId,
          });
        }
      } else if (event.type === 'content_block_delta') {
        const delta = event.delta;
        const idx = event.index;
        const acc = blockAccum[idx];

        if (delta.type === 'text_delta' && currentTextId && acc) {
          acc.text += delta.text;
          sendEvent(res, EventType.TEXT_MESSAGE_CONTENT, {
            textMessageId: currentTextId,
            delta: delta.text,
          });
        } else if (delta.type === 'input_json_delta' && acc) {
          acc.inputJson += delta.partial_json;
          sendEvent(res, EventType.TOOL_CALL_ARGS, {
            toolCallId: acc.id ?? `tool-${idx}`,
            delta: delta.partial_json,
          });
        }
      } else if (event.type === 'content_block_stop') {
        const idx = event.index;
        const acc = blockAccum[idx];
        if (!acc) continue;

        if (acc.type === 'text' && currentTextId) {
          sendEvent(res, EventType.TEXT_MESSAGE_END, {
            textMessageId: currentTextId,
            messageId,
          });
          currentTextId = null;
        } else if (acc.type === 'tool_use' && acc.id && acc.name) {
          sendEvent(res, EventType.TOOL_CALL_END, {
            toolCallId: acc.id,
            toolName: acc.name,
          });
        }
      }
    }

    // Build the final assistant content from accumulated blocks
    const assistantContent: Anthropic.ContentBlock[] = Object.entries(blockAccum)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([, acc]) => {
        if (acc.type === 'text') {
          return { type: 'text' as const, text: acc.text };
        }
        return {
          type: 'tool_use' as const,
          id: acc.id!,
          name: acc.name!,
          input: JSON.parse(acc.inputJson || '{}'),
        };
      });

    const toolUseBlocks = assistantContent.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    );

    msgs = [...msgs, { role: 'assistant', content: assistantContent }];

    const finalMessage = await stream.finalMessage();

    if (finalMessage.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) {
      break;
    }

    // Process tool calls
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of toolUseBlocks) {
      const input = block.input as Record<string, unknown>;
      let resultContent = '{"success":true}';

      if (block.name === 'search_contacts') {
        const query = input.query as string;
        console.log(`[search_contacts] query: "${query}"`);
        const contacts = searchContacts(query);
        console.log(`[search_contacts] found ${contacts.length} contacts`);
        state = { ...state, query, contacts };
        resultContent = JSON.stringify({ count: contacts.length, contacts });
        sendEvent(res, EventType.TOOL_CALL_RESULT, { toolCallId: block.id, result: resultContent });
        sendEvent(res, EventType.STATE_SNAPSHOT, { snapshot: state });

      } else if (block.name === 'query_anvil') {
        const query = input.query as string;
        console.log(`[query_anvil] querying Anvil MCP: "${query}"`);
        const docs = await searchAnvil(query);
        console.log(`[query_anvil] result length: ${docs.length} chars`);
        resultContent = JSON.stringify({ documentation: docs });
        sendEvent(res, EventType.TOOL_CALL_RESULT, { toolCallId: block.id, result: resultContent });

      } else if (block.name === 'render_ui') {
        const component = input.component as string;
        const uiProps = ((input.props ?? {}) as Record<string, unknown>);

        // Inject server-authoritative contact data
        uiProps.contacts = state.contacts ?? [];
        uiProps.addedLeads = state.addedLeads;

        sendEvent(res, EventType.TOOL_CALL_RESULT, { toolCallId: block.id, result: resultContent });
        sendEvent(res, EventType.CUSTOM, {
          name: 'RENDER_UI',
          value: {
            component,
            target: (input.target as string | undefined) ?? 'panel',
            title: input.title as string | undefined,
            props: uiProps,
          },
        });

      } else if (block.name === 'add_to_leads') {
        const contactIds = input.contact_ids as string[];
        console.log(`[add_to_leads] adding: ${contactIds.join(', ')}`);
        state = {
          ...state,
          addedLeads: [...new Set([...state.addedLeads, ...contactIds])],
        };
        resultContent = JSON.stringify({ success: true, addedIds: contactIds });
        sendEvent(res, EventType.TOOL_CALL_RESULT, { toolCallId: block.id, result: resultContent });
        sendEvent(res, EventType.STATE_SNAPSHOT, { snapshot: state });
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: resultContent,
      });
    }

    // Append tool results and loop again
    msgs = [...msgs, { role: 'user', content: toolResults }];
  }

  sendEvent(res, EventType.RUN_FINISHED, {});
  return { apiMessages: msgs, prospectingState: state };
}
