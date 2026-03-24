import Anthropic from '@anthropic-ai/sdk';
import { Response } from 'express';
import { searchAnvil } from './mcpAnvilClient.js';
import { GenericResult } from './bootstrapper.js';

export interface GenericState {
  lastResults: GenericResult[];
  completedSteps: number[]; // 1-based step numbers that have been completed (wizard use cases)
}

// AG-UI event type constants
const EventType = {
  RUN_STARTED: 'RUN_STARTED',
  RUN_FINISHED: 'RUN_FINISHED',
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

export async function runGenericAgentStream(
  client: Anthropic,
  apiMessages: Anthropic.MessageParam[],
  state: GenericState,
  mockData: GenericResult[],
  systemPrompt: string,
  tools: Anthropic.Tool[],
  res: Response,
): Promise<{ apiMessages: Anthropic.MessageParam[]; state: GenericState }> {
  let msgs = [...apiMessages];
  let currentState = { ...state };

  sendEvent(res, EventType.RUN_STARTED, { runId: crypto.randomUUID() });

  while (true) {
    const messageId = crypto.randomUUID();
    let currentTextId: string | null = null;

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
      system: systemPrompt,
      tools,
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
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );

    msgs = [...msgs, { role: 'assistant', content: assistantContent }];

    const finalMessage = await stream.finalMessage();

    if (finalMessage.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) {
      break;
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of toolUseBlocks) {
      const input = block.input as Record<string, unknown>;
      let resultContent = '{"success":true}';

      if (block.name === 'execute_step') {
        const stepNumber = input.step_number as number;
        console.log(`[execute_step] completing step ${stepNumber}`);
        const newCompleted = [...new Set([...currentState.completedSteps, stepNumber])].sort(
          (a, b) => a - b,
        );
        currentState = { ...currentState, completedSteps: newCompleted };
        resultContent = JSON.stringify({ success: true, completed_step: stepNumber });
        sendEvent(res, EventType.TOOL_CALL_RESULT, { toolCallId: block.id, result: resultContent });
        sendEvent(res, EventType.STATE_SNAPSHOT, { snapshot: currentState });

      } else if (block.name === 'search') {
        // Return all mock data for any query (mock search)
        currentState = { ...currentState, lastResults: mockData };
        resultContent = JSON.stringify({ count: mockData.length, items: mockData });
        sendEvent(res, EventType.TOOL_CALL_RESULT, { toolCallId: block.id, result: resultContent });
        sendEvent(res, EventType.STATE_SNAPSHOT, { snapshot: currentState });

      } else if (block.name === 'query_anvil') {
        const query = input.query as string;
        console.log(`[query_anvil] querying Anvil MCP: "${query}"`);
        const docs = await searchAnvil(query);
        resultContent = JSON.stringify({ documentation: docs });
        sendEvent(res, EventType.TOOL_CALL_RESULT, { toolCallId: block.id, result: resultContent });

      } else if (block.name === 'render_ui') {
        const component = input.component as string;
        const uiProps = ((input.props ?? {}) as Record<string, unknown>);

        // For wizard use cases: rebuild step items with server-authoritative status badges.
        // A step is "Complete" if its number is in completedSteps, "Active" if it's the
        // next uncompleted step, and "Pending" otherwise.
        if (currentState.completedSteps.length > 0 || mockData.some((d) => d.id?.startsWith('step-'))) {
          const nextStep =
            currentState.completedSteps.length > 0
              ? Math.max(...currentState.completedSteps) + 1
              : 1;
          uiProps.items = mockData.map((item) => {
            const stepNum = parseInt(item.id.replace('step-', ''), 10);
            if (isNaN(stepNum)) return item;
            const isComplete = currentState.completedSteps.includes(stepNum);
            const isActive = stepNum === nextStep && !isComplete;
            return {
              ...item,
              badge: isComplete ? 'Complete' : isActive ? 'Active' : 'Pending',
            };
          });
        } else {
          // Search use case: inject last results
          uiProps.items = currentState.lastResults;
        }

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
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: resultContent,
      });
    }

    msgs = [...msgs, { role: 'user', content: toolResults }];
  }

  sendEvent(res, EventType.RUN_FINISHED, {});
  return { apiMessages: msgs, state: currentState };
}
