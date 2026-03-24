# Use Case: Fleet Pro

## Task
Help fleet managers answer questions about vehicle maintenance —
costs, service history, and upcoming needs across their fleet.

## Entities
- Vehicle: make, model, year, mileage, license_plate, driver
- MaintenanceRecord: service_type, date, cost, technician, status
- UpcomingService: vehicle, service_type, due_date, estimated_cost

## Sample Queries
- Show me the average cost of oil changes across my fleet
- Which vehicles are due for maintenance next quarter?
- Which vehicles are overdue right now?

## User Journey
1. User asks a question about their fleet
2. Results appear in the panel — each row shows vehicle info +
   service details + a status badge (Overdue / Upcoming / Done)
3. User can click "Schedule" on an overdue item to book maintenance
4. After scheduling, agent re-renders the panel with updated status
