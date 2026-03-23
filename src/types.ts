export interface Contact {
  id: string;
  name: string;
  title: string;
  company: string;
  location: string;
  phone: string;
  email: string;
}

export interface ProspectingState {
  query: string | null;
  contacts: Contact[] | null;
  addedLeads: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface RenderUIPayload {
  /** Anvil2 component name chosen by the agent (e.g. "Drawer", "Dialog", "Popover") */
  component: string;
  /** Where to render: "panel" = inline canvas, "overlay" = floating drawer/dialog */
  target: 'panel' | 'overlay';
  title?: string;
  props: {
    contacts?: Contact[];
    addedLeads?: string[];
    summary?: string;
    body?: string;
    actionLabel?: string;
    [key: string]: unknown;
  };
}

export interface UseProspectingAgentReturn {
  messages: ChatMessage[];
  prospectingState: ProspectingState;
  isLoading: boolean;
  error: string | null;
  renderUIPayload: RenderUIPayload | null;
  sendMessage: (text: string) => Promise<void>;
  dismissUI: () => void;
}
