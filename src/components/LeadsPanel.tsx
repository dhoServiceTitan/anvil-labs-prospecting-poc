import { Card, Divider, Flex, Text } from '@servicetitan/anvil2';
import { Contact, ProspectingState } from '../types';

interface LeadsPanelProps {
  prospectingState: ProspectingState;
  allContacts: Contact[];
}

export function LeadsPanel({ prospectingState, allContacts }: LeadsPanelProps) {
  const { query, addedLeads } = prospectingState;

  const addedContacts = allContacts.filter((c) => addedLeads.includes(c.id));

  return (
    <Card>
      <Flex direction="column" gap="4">
        <Flex direction="column" gap="1">
          <Text variant="headline" el="h2">Leads Added</Text>
          <Text variant="body" subdued>
            {addedLeads.length === 0
              ? 'No leads added yet'
              : `${addedLeads.length} lead${addedLeads.length !== 1 ? 's' : ''} queued for CRM`}
          </Text>
        </Flex>

        {query && (
          <>
            <Divider />
            <Flex direction="column" gap="1">
              <Text variant="body" subdued>Last search</Text>
              <Text variant="body">{query}</Text>
            </Flex>
          </>
        )}

        {addedContacts.length > 0 && (
          <>
            <Divider />
            <Flex direction="column" gap="3">
              {addedContacts.map((contact) => (
                <Flex key={contact.id} direction="column" gap="1">
                  <Text variant="body"><strong>{contact.name}</strong></Text>
                  <Text variant="body" subdued>{contact.title}</Text>
                  <Text variant="body" subdued>{contact.company}</Text>
                </Flex>
              ))}
            </Flex>
          </>
        )}
      </Flex>
    </Card>
  );
}
