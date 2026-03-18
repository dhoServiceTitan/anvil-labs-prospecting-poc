import { Button, Flex, TextField } from '@servicetitan/anvil2';
import { useState, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('');

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Flex direction="row" gap="2" alignItems="flex-end">
      <Flex grow="1">
        <TextField
          label="Your message"
          placeholder="Type a message and press Enter…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          errorAriaLive="assertive"
          style={{ width: '100%' }}
        />
      </Flex>
      <Button
        appearance="primary"
        onClick={handleSend}
        loading={disabled}
        aria-label="Send message"
      >
        Send
      </Button>
    </Flex>
  );
}
