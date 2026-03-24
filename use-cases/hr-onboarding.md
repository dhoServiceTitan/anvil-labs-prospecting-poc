# Use Case: HR Onboarding

## Task
Help HR coordinators track new hire onboarding progress, surface
incomplete tasks, and identify employees who need attention before
their first day or during their first 90 days.

## Entities
- NewHire: name, start_date, department, manager, onboarding_score, days_until_start
- OnboardingTask: title, category, due_date, assigned_to, status, blocking
- Equipment: type, assigned_to, status, request_date, eta

## Sample Queries
- Which new hires are starting next week and not fully onboarded?
- Show me blocking tasks that haven't been completed
- Which new hires are missing equipment orders?
- Show me the onboarding status for the engineering department

## User Journey
1. HR coordinator asks about onboarding status or gaps
2. Results appear in the panel — each row shows new hire or task data
   with completion badges (On Track / At Risk / Blocked)
3. Coordinator can click "Assign Task" on a blocking item
4. After assigning, agent refreshes the panel with updated ownership
