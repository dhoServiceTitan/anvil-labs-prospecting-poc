import { Chip, Flex, Spinner, Text } from '@servicetitan/anvil2';
import { StepStatus } from '../types';

interface StepCardProps {
  stepNumber: 1 | 2 | 3;
  label: string;
  detail: string | null;
  status: StepStatus;
}

// Anvil2 semantic color hex values (Chip requires actual color values, not CSS vars)
const STATUS_COLORS: Record<StepStatus, string> = {
  pending: '#949596', // border-color-default
  active:  '#0265DC', // status-color-info
  complete:'#007A4D', // status-color-success
};

const STATUS_LABELS: Record<StepStatus, string> = {
  pending: 'Pending',
  active: 'In Progress',
  complete: 'Done',
};

export function StepCard({ stepNumber, label, detail, status }: StepCardProps) {
  return (
    <Flex direction="row" gap="3" alignItems="flex-start">
      {/* Step indicator */}
      <Flex direction="column" alignItems="center" gap="1" style={{ minWidth: 40 }}>
        {status === 'active' ? (
          <Spinner size="small" aria-label={`Step ${stepNumber} in progress`} />
        ) : (
          <Chip
            label={status === 'complete' ? '✓' : String(stepNumber)}
            color={STATUS_COLORS[status]}
          />
        )}
      </Flex>

      {/* Step content */}
      <Flex direction="column" gap="1" grow="1">
        <Flex direction="row" alignItems="center" gap="2">
          <Text variant="body">
            <strong>{label}</strong>
          </Text>
          <Chip
            label={STATUS_LABELS[status]}
            color={STATUS_COLORS[status]}
            size="small"
          />
        </Flex>
        {detail && (
          <Text variant="body" subdued>
            {detail}
          </Text>
        )}
      </Flex>
    </Flex>
  );
}
