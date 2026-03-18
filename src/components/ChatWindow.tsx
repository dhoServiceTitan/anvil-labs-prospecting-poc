import { Flex, Spinner, Text } from '@servicetitan/anvil2';
import { useEffect, useRef } from 'react';
import { ChatMessage } from '../types';
import { ChatInput } from './ChatInput';
import { MessageBubble } from './MessageBubble';

interface ChatWindowProps {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  onSendMessage: (text: string) => Promise<void>;
}

export function ChatWindow({ messages, isLoading, error, onSendMessage }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <Flex direction="column" style={{ height: '100%' }}>
      {/* Message list — ARIA live region */}
      <Flex
        direction="column"
        gap="3"
        grow="1"
        role="log"
        aria-live="polite"
        aria-label="Booking conversation"
        aria-relevant="additions"
        style={{ overflowY: 'auto', padding: '16px' }}
      >
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isLoading && (
          <div role="status" aria-live="polite" aria-label="Agent is thinking">
            <Flex direction="row" alignItems="center" gap="2">
              <Spinner size="small" inherit />
              <Text variant="body" subdued>
                Agent is thinking…
              </Text>
            </Flex>
          </div>
        )}

        {error && (
          <Text variant="body" subdued>
            Error: {error}
          </Text>
        )}

        <div ref={bottomRef} />
      </Flex>

      {/* Chat input — pinned at bottom */}
      <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)' }}>
        <ChatInput onSend={onSendMessage} disabled={isLoading} />
      </div>
    </Flex>
  );
}
