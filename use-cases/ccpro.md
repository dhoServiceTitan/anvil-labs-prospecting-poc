# Use Case: CCPro

## Task
Help call center supervisors monitor agent performance, queue health,
and escalation trends across their team in real time.

## Entities
- Agent: name, status, calls_handled, avg_handle_time, csat_score
- Queue: name, wait_time, calls_waiting, service_level
- Escalation: reason, agent, timestamp, resolved, resolution_time

## Sample Queries
- Which agents have the highest call volumes today?
- Show me queues with wait times over 5 minutes
- What are the most common escalation reasons this week?

## User Journey
1. Supervisor asks about current performance or trends
2. Results appear in the panel — each row shows agent or queue data
   with performance indicators and status badges
3. Supervisor can drill into a row to see detailed history
4. Clicking an escalation row shows resolution notes
