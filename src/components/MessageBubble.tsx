import { Card, Flex, Text } from '@servicetitan/anvil2';
import React from 'react';
import { ChatMessage } from '../types';

interface MessageBubbleProps {
  message: ChatMessage;
}

// Anvil2 semantic background tokens for chat bubbles
// User: primary action blue tint; Assistant: subtle neutral surface
const BUBBLE_STYLES: Record<'user' | 'assistant', React.CSSProperties> = {
  user:      { backgroundColor: '#E8F0FE', borderRadius: 12 },
  assistant: { backgroundColor: '#F5F5F5', borderRadius: 12 },
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <Flex
      direction="row"
      justifyContent={isUser ? 'flex-end' : 'flex-start'}
      style={{ width: '100%' }}
    >
      <div style={{ maxWidth: '75%', ...BUBBLE_STYLES[message.role] }}>
        <Card style={{ backgroundColor: 'transparent', boxShadow: 'none' }}>
          <Flex direction="column" gap="1">
            <Text variant="body" subdued>
              <em>{isUser ? 'You' : 'Assistant'}</em>
            </Text>
            <Text variant="body">{message.content}</Text>
          </Flex>
        </Card>
      </div>
    </Flex>
  );
}
