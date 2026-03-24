import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ProspectingState,
  ChatMessage,
  RenderUIPayload,
  UseProspectingAgentReturn,
} from '../types';

const SESSION_ID = crypto.randomUUID();
const ASSISTANT_ID = new URLSearchParams(window.location.search).get('assistant') ?? 'commercial_prospecting_assistant';
const IS_PROSPECTING = ASSISTANT_ID === 'commercial_prospecting_assistant';

const INITIAL_STATE: ProspectingState = {
  query: null,
  contacts: null,
  addedLeads: [],
};

const PROSPECTING_GREETING: ChatMessage = {
  id: crypto.randomUUID(),
  role: 'assistant',
  content: "Hi! I can help you find contacts and add them as leads. Who are you looking for? For example: \"facilities managers at Boeing in Charleston\" or \"VP of Operations at manufacturing companies in South Carolina\".",
  timestamp: new Date(),
};

export function useBookingAgent(): UseProspectingAgentReturn {
  const [messages, setMessages] = useState<ChatMessage[]>(IS_PROSPECTING ? [PROSPECTING_GREETING] : []);
  const [prospectingState, setProspectingState] = useState<ProspectingState>(INITIAL_STATE);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renderUIPayload, setRenderUIPayload] = useState<RenderUIPayload | null>(null);

  const streamingTextRef = useRef<string>('');
  const streamingMsgIdRef = useRef<string | null>(null);

  const appendOrUpdateMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === msg.id);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = msg;
        return updated;
      }
      return [...prev, msg];
    });
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (isLoading) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setError(null);

      const apiUserMessage = { role: 'user' as const, content: text };

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: SESSION_ID,
            assistantId: ASSISTANT_ID,
            messages: [apiUserMessage],
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error(`Server error: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        streamingTextRef.current = '';
        streamingMsgIdRef.current = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (!raw) continue;

            let event: Record<string, unknown>;
            try {
              event = JSON.parse(raw);
            } catch {
              continue;
            }

            const type = event.type as string;

            if (type === 'TEXT_MESSAGE_START') {
              streamingMsgIdRef.current = event.messageId as string;
              streamingTextRef.current = '';
              appendOrUpdateMessage({
                id: streamingMsgIdRef.current,
                role: 'assistant',
                content: '',
                timestamp: new Date(),
              });
            } else if (type === 'TEXT_MESSAGE_CONTENT' && streamingMsgIdRef.current) {
              streamingTextRef.current += event.delta as string;
              appendOrUpdateMessage({
                id: streamingMsgIdRef.current,
                role: 'assistant',
                content: streamingTextRef.current,
                timestamp: new Date(),
              });
            } else if (type === 'TEXT_MESSAGE_END') {
              streamingMsgIdRef.current = null;
            } else if (type === 'STATE_SNAPSHOT') {
              const snapshot = event.snapshot as ProspectingState;
              setProspectingState(snapshot);
            } else if (type === 'CUSTOM') {
              const customEvent = event as { name: string; value: RenderUIPayload };
              if (customEvent.name === 'RENDER_UI') {
                setRenderUIPayload(customEvent.value);
              }
            } else if (type === 'RUN_ERROR') {
              setError(event.error as string);
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      } finally {
        setIsLoading(false);
        streamingMsgIdRef.current = null;
      }
    },
    [isLoading, appendOrUpdateMessage]
  );

  const dismissUI = useCallback(() => {
    setRenderUIPayload(null);
  }, []);

  // For non-prospecting assistants, silently trigger the agent on mount so it
  // immediately renders its initial UI (e.g. the wizard to-do list) without
  // showing a user message bubble.
  useEffect(() => {
    if (IS_PROSPECTING) return;
    setIsLoading(true);
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: SESSION_ID,
        assistantId: ASSISTANT_ID,
        messages: [{ role: 'user', content: 'start' }],
      }),
    }).then(async (response) => {
      if (!response.ok || !response.body) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      streamingTextRef.current = '';
      streamingMsgIdRef.current = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          let event: Record<string, unknown>;
          try { event = JSON.parse(raw); } catch { continue; }
          const type = event.type as string;
          if (type === 'TEXT_MESSAGE_START') {
            streamingMsgIdRef.current = event.messageId as string;
            streamingTextRef.current = '';
            appendOrUpdateMessage({ id: streamingMsgIdRef.current, role: 'assistant', content: '', timestamp: new Date() });
          } else if (type === 'TEXT_MESSAGE_CONTENT' && streamingMsgIdRef.current) {
            streamingTextRef.current += event.delta as string;
            appendOrUpdateMessage({ id: streamingMsgIdRef.current, role: 'assistant', content: streamingTextRef.current, timestamp: new Date() });
          } else if (type === 'TEXT_MESSAGE_END') {
            streamingMsgIdRef.current = null;
          } else if (type === 'CUSTOM') {
            const customEvent = event as { name: string; value: RenderUIPayload };
            if (customEvent.name === 'RENDER_UI') setRenderUIPayload(customEvent.value);
          }
        }
      }
    }).catch(() => {}).finally(() => {
      setIsLoading(false);
      streamingMsgIdRef.current = null;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    messages,
    prospectingState,
    isLoading,
    error,
    renderUIPayload,
    sendMessage,
    dismissUI,
  };
}
