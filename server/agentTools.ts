import Anthropic from '@anthropic-ai/sdk';

export interface Contact {
  id: string;
  name: string;
  title: string;
  company: string;
  location: string;
  phone: string;
  email: string;
}

// ─── Mock contact database ────────────────────────────────────────────────────

const MOCK_CONTACTS: Contact[] = [
  { id: 'c1',  name: 'Adam Bennett',      title: 'Facilities Coordinator',  company: 'Boeing Company',         location: 'Charleston, SC',       phone: '(843) 555-0101', email: 'a.bennett@boeing.com' },
  { id: 'c2',  name: 'Stephen Daniels',   title: 'Facilities Manager',      company: 'Boeing Company',         location: 'Charleston, SC',       phone: '(843) 555-0102', email: 's.daniels@boeing.com' },
  { id: 'c3',  name: 'John Frank',        title: 'Facilities Director',     company: 'Boeing Company',         location: 'North Charleston, SC', phone: '(843) 555-0103', email: 'j.frank@boeing.com' },
  { id: 'c4',  name: 'Jessica Nichols',   title: 'Facilities Coordinator',  company: 'Boeing Company',         location: 'North Charleston, SC', phone: '(843) 555-0104', email: 'j.nichols@boeing.com' },
  { id: 'c5',  name: 'Samuel Scott',      title: 'Project Manager',         company: 'Boeing Company',         location: 'Charleston, SC',       phone: '(843) 555-0105', email: 's.scott@boeing.com' },
  { id: 'c6',  name: 'Maria Chen',        title: 'VP of Operations',        company: 'Lockheed Martin',        location: 'Goose Creek, SC',      phone: '(843) 555-0201', email: 'm.chen@lmco.com' },
  { id: 'c7',  name: 'Robert Walsh',      title: 'Facilities Manager',      company: 'Lockheed Martin',        location: 'Goose Creek, SC',      phone: '(843) 555-0202', email: 'r.walsh@lmco.com' },
  { id: 'c8',  name: 'Angela Torres',     title: 'Director of Facilities',  company: 'Bosch Rexroth',          location: 'Charleston, SC',       phone: '(843) 555-0301', email: 'a.torres@boschrexroth.com' },
  { id: 'c9',  name: 'Derek Huang',       title: 'Facilities Coordinator',  company: 'Bosch Rexroth',          location: 'Charleston, SC',       phone: '(843) 555-0302', email: 'd.huang@boschrexroth.com' },
  { id: 'c10', name: 'Patricia Monroe',   title: 'Head of Facilities',      company: 'Volvo Cars',             location: 'Berkeley County, SC',  phone: '(843) 555-0401', email: 'p.monroe@volvocars.com' },
  { id: 'c11', name: 'Kevin Okafor',      title: 'Facilities Manager',      company: 'Volvo Cars',             location: 'Berkeley County, SC',  phone: '(843) 555-0402', email: 'k.okafor@volvocars.com' },
  { id: 'c12', name: 'Susan Park',        title: 'Project Manager',         company: 'Charleston Water System',location: 'Charleston, SC',       phone: '(843) 555-0501', email: 's.park@charlestonwater.com' },
  { id: 'c13', name: 'Thomas Rivera',     title: 'Facilities Director',     company: 'MUSC Health',            location: 'Charleston, SC',       phone: '(843) 555-0601', email: 't.rivera@musc.edu' },
  { id: 'c14', name: 'Laura Kim',         title: 'Operations Manager',      company: 'Port of Charleston',     location: 'Charleston, SC',       phone: '(843) 555-0701', email: 'l.kim@scspa.com' },
  { id: 'c15', name: 'Marcus Webb',       title: 'Facilities Coordinator',  company: 'Charleston County',      location: 'Charleston, SC',       phone: '(843) 555-0801', email: 'm.webb@charlestoncounty.org' },
];

export function searchContacts(query: string): Contact[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = MOCK_CONTACTS.map((c) => {
    const haystack = `${c.name} ${c.title} ${c.company} ${c.location}`.toLowerCase();
    const score = terms.filter((t) => haystack.includes(t)).length;
    // Add a small random jitter so repeated queries return varied ordering
    return { contact: c, score: score + Math.random() * 0.5 };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .map(({ contact }) => contact)
    .slice(0, 10);
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_contacts',
    description:
      'Search the contact database for prospects matching the user\'s criteria. Returns up to 15 contacts. Call this as soon as you understand who the user is looking for.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query — include role, company, location, or any combination the user mentioned.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'query_anvil',
    description: `Query the Anvil2 design system documentation to discover the right component for a UI interaction.

Call this BEFORE render_ui whenever you need to present a richer UI interaction to the user.
Describe the interaction pattern you need — the tool returns real Anvil2 documentation including
component names, usage guidance, props, and code examples.

Examples of good queries:
- "component for displaying a scrollable list of items with contact details and action buttons"
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
    description: `Render an Anvil2 component showing the contact results.

ALWAYS call query_anvil first to determine the correct component name and understand its props.
Use the exact component name from the Anvil2 documentation.
The server will automatically inject the contact list into the props — you do not need to include contacts yourself.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        component: {
          type: 'string',
          description: 'Exact Anvil2 component name as returned by query_anvil (e.g., "Drawer", "Dialog").',
        },
        target: {
          type: 'string',
          enum: ['panel', 'overlay'],
          description: 'Where to render: "panel" renders inline in the right-hand canvas panel; "overlay" opens a floating drawer or dialog. Always use "panel" unless the interaction requires blocking the user.',
        },
        title: {
          type: 'string',
          description: 'Title shown in the component header.',
        },
        props: {
          type: 'object',
          description: 'Additional component props. Do not include contacts — the server injects them.',
        },
      },
      required: ['component', 'target', 'props'],
    },
  },
  {
    name: 'add_to_leads',
    description:
      'Add one or more contacts to the CRM as leads. Call this once the user has indicated which contacts they want to add.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contact_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of contact IDs to add as leads.',
        },
      },
      required: ['contact_ids'],
    },
  },
];

// ─── System prompt ────────────────────────────────────────────────────────────

export const SYSTEM_PROMPT = `You are a sales prospecting assistant embedded in ServiceTitan. Your job is to help sales professionals find contacts and add them as leads to the CRM.

## Workflow

1. The user describes who they're looking for in natural language (role, company, location, etc.).
2. Call \`search_contacts\` with their query immediately — do not ask clarifying questions first.
3. Call \`query_anvil\` to discover the right Anvil2 component for displaying a list of contacts with add-to-leads actions.
4. Call \`render_ui\` with the component name from the docs. The server will inject the contact list automatically.
5. Tell the user how many contacts were found and that the panel is open for them to browse.
6. When the user says they want to add specific contacts (or "add all"), call \`add_to_leads\` with those contact IDs.
7. Confirm which contacts were added and ask if they'd like to search for more.

## Rules
- Call \`search_contacts\` first, before any other tool.
- Always call \`query_anvil\` before \`render_ui\` — never guess component names.
- Always set \`target: "panel"\` on \`render_ui\` — contact results render inline in the canvas panel, never as a floating overlay.
- After \`add_to_leads\` completes, call \`render_ui\` again with the same component and target to refresh the panel — this updates the lead status indicators without requiring a new search.
- Do not list contacts in the chat — the UI panel shows them.
- Be concise and professional.`;
