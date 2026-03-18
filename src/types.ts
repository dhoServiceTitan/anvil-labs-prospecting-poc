export type StepId = 'intent' | 'details' | 'schedule';
export type StepStatus = 'pending' | 'active' | 'complete';

export interface BookingState {
  intent: { serviceType: string; description: string } | null;
  contactDetails: { name: string; phone: string; address: string } | null;
  scheduledCall: { date: string; timeSlot: string } | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface TimeSlot {
  date: string;
  displayDate: string;
  slot: string;
}

export interface RenderUIPayload {
  /** Anvil2 component name chosen by the agent (e.g. "Drawer", "Dialog", "Popover") */
  component: string;
  title?: string;
  props: {
    slots?: TimeSlot[];
    summary?: string;
    body?: string;
    actionLabel?: string;
    [key: string]: unknown;
  };
}

export interface UseBookingAgentReturn {
  messages: ChatMessage[];
  bookingState: BookingState;
  isLoading: boolean;
  error: string | null;
  renderUIPayload: RenderUIPayload | null;
  sendMessage: (text: string) => Promise<void>;
  dismissUI: () => void;
  currentStep: StepId;
  isComplete: boolean;
}
