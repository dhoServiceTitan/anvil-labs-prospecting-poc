import {
  Button,
  Dialog,
  Drawer,
  Flex,
  Popover,
  Text,
} from '@servicetitan/anvil2';
import React from 'react';
import { RenderUIPayload, TimeSlot } from '../types';

interface AgentUIOverlayProps {
  payload: RenderUIPayload | null;
  onClose: () => void;
  onSlotSelected: (slot: TimeSlot) => void;
}

// ─── Slot list content — shared between any component that shows slots ────────

function SlotList({ slots, onSelect }: { slots: TimeSlot[]; onSelect: (s: TimeSlot) => void }) {
  return (
    <Flex direction="column" gap="3">
      <Text variant="body" subdued>
        Choose an available appointment window. Your selection will be confirmed in the chat.
      </Text>
      {slots.map((slot) => (
        <Button
          key={`${slot.date}-${slot.slot}`}
          appearance="secondary"
          onClick={() => onSelect(slot)}
        >
          {slot.displayDate} · {slot.slot}
        </Button>
      ))}
    </Flex>
  );
}

// ─── Component registry — maps Anvil2 component name → renderer ───────────────
// The agent freely picks any component name; this registry handles it.
// Unknown components fall back gracefully to Dialog.

type RendererProps = {
  payload: RenderUIPayload;
  onClose: () => void;
  onSlotSelected: (slot: TimeSlot) => void;
};

function DrawerRenderer({ payload, onClose, onSlotSelected }: RendererProps) {
  const slots = payload.props.slots as TimeSlot[] | undefined;
  return (
    <Drawer open onClose={onClose} size="medium">
      <Drawer.Header>{payload.title}</Drawer.Header>
      <Drawer.Content>
        {slots ? (
          <SlotList
            slots={slots}
            onSelect={(s) => {
              onSlotSelected(s);
              onClose();
            }}
          />
        ) : (
          <Text variant="body">{payload.props.body as string}</Text>
        )}
      </Drawer.Content>
      <Drawer.Footer>
        <Button onClick={onClose}>Cancel</Button>
      </Drawer.Footer>
    </Drawer>
  );
}

function DialogRenderer({ payload, onClose, onSlotSelected }: RendererProps) {
  const slots = payload.props.slots as TimeSlot[] | undefined;
  const summary = payload.props.summary as string | undefined;
  return (
    <Dialog open onClose={onClose}>
      <Dialog.Header>{payload.title}</Dialog.Header>
      <Dialog.Content>
        {slots ? (
          <SlotList
            slots={slots}
            onSelect={(s) => {
              onSlotSelected(s);
              onClose();
            }}
          />
        ) : (
          <Text variant="body">{summary ?? (payload.props.body as string)}</Text>
        )}
      </Dialog.Content>
      {/* Only show footer action for confirmation content — slot selection closes on tap */}
      {!slots && (
        <Dialog.Footer>
          <Flex gap="3" justifyContent="flex-end">
            <Button appearance="primary" onClick={onClose}>
              Done
            </Button>
          </Flex>
        </Dialog.Footer>
      )}
    </Dialog>
  );
}

function PopoverRenderer({ payload, onClose, onSlotSelected }: RendererProps) {
  const slots = payload.props.slots as TimeSlot[] | undefined;
  const body = payload.props.body as string | undefined;
  const actionLabel = payload.props.actionLabel as string | undefined;
  return (
    // Popover wraps its trigger — we use a small inline button as the anchor.
    // open=true opens it immediately when the agent requests it.
    <Popover open placement="bottom-start" onClose={onClose}>
      <Popover.Button appearance="ghost" size="small">
        {payload.title ?? 'View'}
      </Popover.Button>
      <Popover.Content>
        <Flex direction="column" gap="3" style={{ maxWidth: 320 }}>
          {payload.title && (
            <Text variant="body">
              <strong>{payload.title}</strong>
            </Text>
          )}
          {slots ? (
            <SlotList
              slots={slots}
              onSelect={(s) => {
                onSlotSelected(s);
                onClose();
              }}
            />
          ) : (
            <Text variant="body">{body}</Text>
          )}
          <Flex gap="2">
            {actionLabel && (
              <Button appearance="primary" size="small" onClick={onClose}>
                {actionLabel}
              </Button>
            )}
            <Button appearance="ghost" size="small" onClick={onClose}>
              Dismiss
            </Button>
          </Flex>
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

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Agent-driven UI overlay.
 *
 * The agent calls render_ui() with a component name it discovered by querying
 * the live Anvil2 MCP documentation. This component resolves the name to a
 * renderer using case-insensitive matching. Unknown components fall back to Dialog.
 */
export function AgentUIOverlay({ payload, onClose, onSlotSelected }: AgentUIOverlayProps) {
  if (!payload) return null;

  const Renderer = resolveRenderer(payload.component);

  return (
    <Renderer
      payload={payload}
      onClose={onClose}
      onSlotSelected={onSlotSelected}
    />
  );
}
