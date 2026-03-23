import {
  Button,
  Dialog,
  Drawer,
  Flex,
  Popover,
  Text,
} from '@servicetitan/anvil2';
import React from 'react';
import { Contact, RenderUIPayload } from '../types';

interface AgentUIOverlayProps {
  payload: RenderUIPayload | null;
  onClose: () => void;
  onContactsSelected: (contacts: Contact[]) => void;
}

// ─── Contact list content — shared between any component that shows contacts ──

function ContactList({
  contacts,
  addedLeads,
  onAdd,
  onAddAll,
}: {
  contacts: Contact[];
  addedLeads: string[];
  onAdd: (contact: Contact) => void;
  onAddAll: () => void;
}) {
  return (
    <Flex direction="column" gap="3">
      <Flex justifyContent="space-between" alignItems="center">
        <Text variant="body" subdued>
          {contacts.length} contact{contacts.length !== 1 ? 's' : ''} found
        </Text>
        <Button appearance="primary" size="small" onClick={onAddAll}>
          Add All To Leads
        </Button>
      </Flex>

      {contacts.map((contact, i) => {
        const isAdded = addedLeads.includes(contact.id);
        return (
          <React.Fragment key={contact.id}>
            {i > 0 && <div style={{ borderTop: '1px solid var(--border-color)' }} />}
            <Flex justifyContent="space-between" alignItems="flex-start" gap="3">
              <Flex direction="column" gap="1">
                <Text variant="body"><strong>{contact.name}</strong></Text>
                <Text variant="body" subdued>{contact.title} at {contact.company}</Text>
                <Text variant="body" subdued>{contact.location}</Text>
                <Text variant="body" subdued>📞 {contact.phone}</Text>
                <Text variant="body" subdued>✉️ {contact.email}</Text>
              </Flex>
              <Button
                appearance={isAdded ? 'primary' : 'secondary'}
                size="small"
                onClick={() => !isAdded && onAdd(contact)}
              >
                {isAdded ? '✓' : '+'}
              </Button>
            </Flex>
          </React.Fragment>
        );
      })}
    </Flex>
  );
}

// ─── Component registry — maps Anvil2 component name → renderer ───────────────

type RendererProps = {
  payload: RenderUIPayload;
  onClose: () => void;
  onContactsSelected: (contacts: Contact[]) => void;
};

function DrawerRenderer({ payload, onClose, onContactsSelected }: RendererProps) {
  const contacts = (payload.props.contacts ?? []) as Contact[];
  const addedLeads = (payload.props.addedLeads ?? []) as string[];
  return (
    <Drawer open onClose={onClose} size="medium">
      <Drawer.Header>{payload.title ?? 'Contact Results'}</Drawer.Header>
      <Drawer.Content>
        <ContactList
          contacts={contacts}
          addedLeads={addedLeads}
          onAdd={(c) => onContactsSelected([c])}
          onAddAll={() => onContactsSelected(contacts.filter((c) => !addedLeads.includes(c.id)))}
        />
      </Drawer.Content>
      <Drawer.Footer>
        <Button onClick={onClose}>Close</Button>
      </Drawer.Footer>
    </Drawer>
  );
}

function DialogRenderer({ payload, onClose, onContactsSelected }: RendererProps) {
  const contacts = (payload.props.contacts ?? []) as Contact[];
  const addedLeads = (payload.props.addedLeads ?? []) as string[];
  return (
    <Dialog open onClose={onClose}>
      <Dialog.Header>{payload.title ?? 'Contact Results'}</Dialog.Header>
      <Dialog.Content>
        <ContactList
          contacts={contacts}
          addedLeads={addedLeads}
          onAdd={(c) => onContactsSelected([c])}
          onAddAll={() => onContactsSelected(contacts.filter((c) => !addedLeads.includes(c.id)))}
        />
      </Dialog.Content>
      <Dialog.Footer>
        <Flex gap="3" justifyContent="flex-end">
          <Button appearance="primary" onClick={onClose}>Done</Button>
        </Flex>
      </Dialog.Footer>
    </Dialog>
  );
}

function PopoverRenderer({ payload, onClose, onContactsSelected }: RendererProps) {
  const contacts = (payload.props.contacts ?? []) as Contact[];
  const addedLeads = (payload.props.addedLeads ?? []) as string[];
  return (
    <Popover open placement="bottom-start" onClose={onClose}>
      <Popover.Button appearance="ghost" size="small">
        {payload.title ?? 'View Contacts'}
      </Popover.Button>
      <Popover.Content>
        <Flex direction="column" gap="3" style={{ maxWidth: 400 }}>
          <ContactList
            contacts={contacts}
            addedLeads={addedLeads}
            onAdd={(c) => onContactsSelected([c])}
            onAddAll={() => onContactsSelected(contacts.filter((c) => !addedLeads.includes(c.id)))}
          />
          <Button appearance="ghost" size="small" onClick={onClose}>Dismiss</Button>
        </Flex>
      </Popover.Content>
    </Popover>
  );
}

// Registry: component name → renderer (case-insensitive lookup at runtime)
// The agent discovers component names from live Anvil2 MCP docs — casing may vary.
const COMPONENT_REGISTRY: Record<string, React.ComponentType<RendererProps>> = {
  drawer: DrawerRenderer,
  dialog: DialogRenderer,
  popover: PopoverRenderer,
};

function resolveRenderer(componentName: string): React.ComponentType<RendererProps> {
  const key = componentName.toLowerCase();
  return COMPONENT_REGISTRY[key] ?? DialogRenderer;
}

// ─── Panel renderer — inline, no chrome ──────────────────────────────────────
// Used when target="panel". The agent's chosen component name is noted but the
// content renders directly into the canvas — no Drawer/Dialog wrapper needed.

function PanelRenderer({ payload, onClose, onContactsSelected }: RendererProps) {
  const contacts = (payload.props.contacts ?? []) as Contact[];
  const addedLeads = (payload.props.addedLeads ?? []) as string[];
  return (
    <Flex direction="column" gap="4">
      {payload.title && (
        <Text variant="headline" el="h2">{payload.title}</Text>
      )}
      <ContactList
        contacts={contacts}
        addedLeads={addedLeads}
        onAdd={(c) => onContactsSelected([c])}
        onAddAll={() => onContactsSelected(contacts.filter((c) => !addedLeads.includes(c.id)))}
      />
    </Flex>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Agent-driven UI renderer.
 *
 * target="panel"  → renders inline (no chrome); component name from agent is informational
 * target="overlay" → resolves component name to a floating Drawer/Dialog/Popover renderer
 */
export function AgentUIOverlay({ payload, onClose, onContactsSelected }: AgentUIOverlayProps) {
  if (!payload) return null;

  if (payload.target === 'panel') {
    return (
      <PanelRenderer
        payload={payload}
        onClose={onClose}
        onContactsSelected={onContactsSelected}
      />
    );
  }

  const Renderer = resolveRenderer(payload.component);
  return (
    <Renderer
      payload={payload}
      onClose={onClose}
      onContactsSelected={onContactsSelected}
    />
  );
}
