# Use Case: Adaptive Capacity Onboarding

## Type
wizard

## Task
Guide the user through setting up Adaptive Capacity in 5 sequential steps.
Walk through each step one at a time. After each step completes, the to-do
list is refreshed with that step checked off and the next step's CTA activated.

## Steps
1. Scan Technician Shifts — Pull scheduled shifts to understand current team coverage
2. Scan Arrival Windows — Review arrival window settings across active job types
3. Define Calculation Defaults — Set the calculation parameters for capacity modeling
4. Exclude Technicians — Select any technicians to exclude from availability calculations
5. Get Availability Preferences — Configure how availability is surfaced to dispatchers

## User Journey
1. User opens the assistant — to-do list renders in the panel with Step 1 active and a "Begin" CTA
2. User clicks "Begin" on a step — agent immediately executes that step's action (no confirmation needed)
3. Step completes — agent refreshes the to-do list panel with that step checked off
4. Next step's CTA becomes active — user clicks "Begin" to proceed
5. After all 5 steps, panel shows completion summary
