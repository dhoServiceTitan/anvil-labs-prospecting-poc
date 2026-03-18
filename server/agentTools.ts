import Anthropic from '@anthropic-ai/sdk';

export interface TimeSlot {
  date: string;
  displayDate: string;
  slot: string;
}

export const TIME_SLOTS: TimeSlot[] = [
  { date: '2026-03-24', displayDate: 'Tuesday, March 24', slot: '9:00 AM – 11:00 AM' },
  { date: '2026-03-24', displayDate: 'Tuesday, March 24', slot: '1:00 PM – 3:00 PM' },
  { date: '2026-03-24', displayDate: 'Tuesday, March 24', slot: '4:00 PM – 6:00 PM' },
  { date: '2026-03-25', displayDate: 'Wednesday, March 25', slot: '8:00 AM – 10:00 AM' },
  { date: '2026-03-25', displayDate: 'Wednesday, March 25', slot: '12:00 PM – 2:00 PM' },
  { date: '2026-03-25', displayDate: 'Wednesday, March 25', slot: '3:00 PM – 5:00 PM' },
  { date: '2026-03-26', displayDate: 'Thursday, March 26', slot: '10:00 AM – 12:00 PM' },
  { date: '2026-03-26', displayDate: 'Thursday, March 26', slot: '2:00 PM – 4:00 PM' },
  { date: '2026-03-26', displayDate: 'Thursday, March 26', slot: '5:00 PM – 7:00 PM' },
];

export const TOOLS: Anthropic.Tool[] = [
  {
    name: 'set_service_intent',
    description:
      'Call this tool as soon as you have confidently classified the type of service the customer needs. This marks Step 1 as complete.',
    input_schema: {
      type: 'object' as const,
      properties: {
        service_type: {
          type: 'string',
          enum: ['plumbing', 'electrical', 'HVAC', 'appliance', 'general'],
          description: 'The category of home service required.',
        },
        description: {
          type: 'string',
          description: "A concise summary of the customer's stated problem.",
        },
      },
      required: ['service_type', 'description'],
    },
  },
  {
    name: 'collect_contact_details',
    description:
      "Call this tool once you have collected the customer's full name, phone number, and service address. Do not call this until all three fields have been provided. This marks Step 2 as complete.",
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: "Customer's full name." },
        phone: { type: 'string', description: "Customer's phone number." },
        address: { type: 'string', description: 'Full service address.' },
      },
      required: ['name', 'phone', 'address'],
    },
  },
  {
    name: 'query_anvil',
    description: `Query the Anvil2 design system documentation to discover the right component for a UI interaction.

Call this BEFORE render_ui whenever you need to present a richer UI interaction to the user.
Describe the interaction pattern you need — the tool returns real Anvil2 documentation including
component names, usage guidance, props, and code examples.

Examples of good queries:
- "component for browsing and selecting from a list of options"
- "blocking confirmation dialog that requires explicit user consent"
- "inline contextual tooltip with an action button"`,
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Describe the UI interaction pattern you need to implement.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'render_ui',
    description: `Render an Anvil2 component for the user to interact with.

ALWAYS call query_anvil first to determine the correct component name and understand its props.
Use the exact component name from the Anvil2 documentation (e.g., "Drawer", "Dialog", "Popover").
Do NOT call render_ui for simple conversational text collection — gather name, phone, address inline.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        component: {
          type: 'string',
          description:
            'Exact Anvil2 component name as returned by query_anvil (e.g., "Drawer", "Dialog").',
        },
        title: {
          type: 'string',
          description: 'Title shown in the component header.',
        },
        props: {
          type: 'object',
          description:
            'Component props payload. For slot selection the server will inject available time slots automatically.',
        },
      },
      required: ['component', 'props'],
    },
  },
  {
    name: 'schedule_call',
    description:
      'Call this tool once the customer has selected a specific date and time slot. This marks Step 3 as complete and finalizes the booking.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: { type: 'string', description: 'Appointment date in ISO 8601 format (YYYY-MM-DD).' },
        time_slot: { type: 'string', description: 'Selected time window exactly as presented.' },
      },
      required: ['date', 'time_slot'],
    },
  },
];

const slotsText = TIME_SLOTS.map((s) => `• ${s.displayDate}: ${s.slot}`).join('\n');

export const SYSTEM_PROMPT = `You are a friendly and efficient service booking assistant for a home services company. Your job is to guide the customer through a 3-step booking process in strict order.

## Step 1 – Understand the Service Need
Ask the customer to describe their problem. Based on their response, classify it into one of these categories: plumbing, electrical, HVAC, appliance, or general.
Once you are confident in the classification, call the \`set_service_intent\` tool. Then immediately continue to Step 2 WITHOUT waiting for another user message.

## Step 2 – Collect Contact Details
Ask for the customer's full name, phone number, and service address. Collect them conversationally — do NOT call render_ui for this step.
Once you have all three, call the \`collect_contact_details\` tool. Then immediately continue to Step 3 WITHOUT waiting for another user message.

## Step 3 – Schedule the Appointment
The user needs to select from a list of available time slots.
1. First call \`query_anvil\` to discover the right Anvil2 component for browsing and selecting from a list.
2. Based on the documentation returned, call \`render_ui\` with the component name from the docs.
3. Tell the customer a panel has opened for them to choose a slot. Do NOT list the slots in chat.
Once the user selects a slot (they will send their selection as a message), call \`schedule_call\`.

## Confirmation
After scheduling, call \`query_anvil\` to find the right Anvil2 component for a final booking confirmation that requires explicit user consent, then call \`render_ui\` with that component.

## Available Time Slots
${slotsText}

## Important Rules
- Always complete steps in order 1 → 2 → 3. Never skip a step.
- After calling a tool, continue the conversation naturally — do not go silent.
- Be conversational, warm, and concise.
- Never ask for information you have already collected.
- Always query_anvil before render_ui — never guess component names.`;
