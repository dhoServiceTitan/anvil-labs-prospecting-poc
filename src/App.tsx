import { Divider, Flex, Text } from '@servicetitan/anvil2';
import { AgentUIOverlay } from './components/AgentUIOverlay';
import { LeadsPanel } from './components/LeadsPanel';
import { ChatWindow } from './components/ChatWindow';
import { useBookingAgent } from './hooks/useBookingAgent';
import { Contact } from './types';

export function App() {
  const {
    messages,
    prospectingState,
    isLoading,
    error,
    renderUIPayload,
    sendMessage,
    dismissUI,
  } = useBookingAgent();

  // When the user selects contacts from the overlay, send a message to the agent
  const handleContactsSelected = (contacts: Contact[]) => {
    const names = contacts.map((c) => c.name).join(', ');
    sendMessage(`Please add ${names} to my leads.`);
  };

  return (
    <Flex direction="column" style={{ height: '100vh', overflow: 'hidden', backgroundColor: 'var(--background-color)' }}>
      {/* Page header */}
      <Flex
        direction="row"
        alignItems="center"
        gap="4"
        style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}
      >
        <Text variant="headline" el="h1">
          Atlas Prospecting
        </Text>
      </Flex>

      {/* Main content — two-column split */}
      <Flex direction="row" grow="1" style={{ minHeight: 0, overflow: 'hidden' }}>
        {/* Left: chat panel */}
        <main style={{ flex: '1.5', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <ChatWindow
            messages={messages}
            isLoading={isLoading}
            error={error}
            onSendMessage={sendMessage}
          />
        </main>

        <Divider vertical />

        {/* Right: canvas panel — shows agent-rendered UI when target="panel", else leads summary */}
        <aside
          style={{ flex: '1', minWidth: 280, padding: '16px', overflowY: 'auto' }}
          aria-label="Canvas panel"
        >
          {renderUIPayload?.target === 'panel' ? (
            <AgentUIOverlay
              payload={renderUIPayload}
              onClose={dismissUI}
              onContactsSelected={handleContactsSelected}
            />
          ) : (
            <LeadsPanel
              prospectingState={prospectingState}
              allContacts={prospectingState.contacts ?? []}
            />
          )}
        </aside>
      </Flex>

      {/* Floating overlay — only for target="overlay" (blocking confirmations, etc.) */}
      {renderUIPayload?.target === 'overlay' && (
        <AgentUIOverlay
          payload={renderUIPayload}
          onClose={dismissUI}
          onContactsSelected={handleContactsSelected}
        />
      )}
    </Flex>
  );
}
