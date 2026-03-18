import { Card, Divider, Flex, Text } from '@servicetitan/anvil2';
import { BookingState, StepId, StepStatus } from '../types';
import { StepCard } from './StepCard';

interface BookingProgressProps {
  bookingState: BookingState;
  currentStep: StepId;
  isComplete: boolean;
}

function getStepStatus(stepId: StepId, currentStep: StepId, bookingState: BookingState): StepStatus {
  if (stepId === 'intent') {
    if (bookingState.intent) return 'complete';
    if (currentStep === 'intent') return 'active';
    return 'pending';
  }
  if (stepId === 'details') {
    if (bookingState.contactDetails) return 'complete';
    if (currentStep === 'details') return 'active';
    return 'pending';
  }
  // schedule
  if (bookingState.scheduledCall) return 'complete';
  if (currentStep === 'schedule') return 'active';
  return 'pending';
}

function intentDetail(bookingState: BookingState): string | null {
  if (!bookingState.intent) return null;
  return `${bookingState.intent.serviceType} — ${bookingState.intent.description}`;
}

function detailsDetail(bookingState: BookingState): string | null {
  if (!bookingState.contactDetails) return null;
  return `${bookingState.contactDetails.name} · ${bookingState.contactDetails.phone}`;
}

function scheduleDetail(bookingState: BookingState): string | null {
  if (!bookingState.scheduledCall) return null;
  return `${bookingState.scheduledCall.date} · ${bookingState.scheduledCall.timeSlot}`;
}

const completedSteps = (state: BookingState): number =>
  [state.intent, state.contactDetails, state.scheduledCall].filter(Boolean).length;

export function BookingProgress({ bookingState, currentStep, isComplete }: BookingProgressProps) {
  const completed = completedSteps(bookingState);

  return (
    <Card>
      <Flex direction="column" gap="4">
        <Flex direction="column" gap="1">
          <Text variant="headline" el="h2">
            Your Booking
          </Text>
          {isComplete && (
            <Text variant="body" subdued>
              Booking confirmed!
            </Text>
          )}
        </Flex>

        {/* ARIA progressbar wraps the 3 steps */}
        <section aria-label="Booking steps">
          <div
            role="progressbar"
            aria-valuenow={completed}
            aria-valuemin={0}
            aria-valuemax={3}
            aria-label="Booking progress"
          >
            <Flex direction="column" gap="4">
              <StepCard
                stepNumber={1}
                label="Service Intent"
                detail={intentDetail(bookingState)}
                status={getStepStatus('intent', currentStep, bookingState)}
              />
              <Divider />
              <StepCard
                stepNumber={2}
                label="Contact Details"
                detail={detailsDetail(bookingState)}
                status={getStepStatus('details', currentStep, bookingState)}
              />
              <Divider />
              <StepCard
                stepNumber={3}
                label="Appointment"
                detail={scheduleDetail(bookingState)}
                status={getStepStatus('schedule', currentStep, bookingState)}
              />
            </Flex>
          </div>
        </section>
      </Flex>
    </Card>
  );
}
