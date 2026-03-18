import { Divider, Flex, Text } from '@servicetitan/anvil2';
import { AgentUIOverlay } from './components/AgentUIOverlay';
import { BookingProgress } from './components/BookingProgress';
import { ChatWindow } from './components/ChatWindow';
import { useBookingAgent } from './hooks/useBookingAgent';
import { TimeSlot } from './types';

export function App() {
  const {
    messages,
    bookingState,
    isLoading,
    error,
    renderUIPayload,
    sendMessage,
    dismissUI,
    currentStep,
    isComplete,
  } = useBookingAgent();

  // When the user selects a slot from the Drawer, send it as a chat message
  const handleSlotSelected = (slot: TimeSlot) => {
    sendMessage(`I'd like the ${slot.displayDate} slot at ${slot.slot}.`);
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
          Book a Service Call
        </Text>
      </Flex>

      {/* Main content — two-column split, fills remaining height */}
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

        {/* Right: booking progress panel */}
        <aside
          style={{ flex: '1', minWidth: 280, padding: '16px', overflowY: 'auto' }}
          aria-label="Booking progress"
        >
          <BookingProgress
            bookingState={bookingState}
            currentStep={currentStep}
            isComplete={isComplete}
          />
        </aside>
      </Flex>

      {/* Agent-driven UI overlay (Drawer or Dialog — agent decides) */}
      <AgentUIOverlay
        payload={renderUIPayload}
        onClose={dismissUI}
        onSlotSelected={handleSlotSelected}
      />
    </Flex>
  );
}
