# Use Case: SalesPro

## Task
Help sales reps track their pipeline, review deal stages, and surface
accounts at risk of stalling across their book of business.

## Entities
- Deal: company, stage, value, close_date, owner, days_in_stage
- Account: company, industry, tier, last_contact_date, health_score
- Activity: type, subject, date, contact, outcome

## Sample Queries
- Show me deals stuck in proposal for more than 30 days
- Which accounts haven't been contacted in the last two weeks?
- What are my highest-value deals closing this quarter?
- Show me deals by stage

## User Journey
1. Rep asks about their pipeline or account health
2. Results appear in the panel — each row shows deal or account info
   with stage badge and risk indicators
3. Rep can click "Log Activity" to record an interaction
4. After logging, agent refreshes the panel with updated last-contact date
