import { useState, useCallback, useRef } from 'react';
import {
  BookingState,
  ChatMessage,
  RenderUIPayload,
  StepId,
  UseBookingAgentReturn,
} from '../types';

const SESSION_ID = crypto.randomUUID();

const INITIAL_BOOKING_STATE: BookingState = {
  intent: null,
  contactDetails: null,
  scheduledCall: null,
};

const GREETING: ChatMessage = {
  id: crypto.randomUUID(),
  role: 'assistant',
  content:
    "Hi! I'm here to help you book a home service call. Could you start by describing the issue you're experiencing?",
  timestamp: new Date(),
};

function deriveCurrentStep(state: BookingState): StepId {
  if (!state.intent) return 'intent';
  if (!state.contactDetails) return 'details';
  return 'schedule';
}

export function useBookingAgent(): UseBookingAgentReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [bookingState, setBookingState] = useState<BookingState>(INITIAL_BOOKING_STATE);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renderUIPayload, setRenderUIPayload] = useState<RenderUIPayload | null>(null);

  // Accumulate the current streaming assistant message
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
              // Create placeholder message
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
              const snapshot = event.snapshot as BookingState;
              setBookingState(snapshot);
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

  const currentStep = deriveCurrentStep(bookingState);
  const isComplete = bookingState.scheduledCall !== null;

  return {
    messages,
    bookingState,
    isLoading,
    error,
    renderUIPayload,
    sendMessage,
    dismissUI,
    currentStep,
    isComplete,
  };
}
