# Use Case: Invoicing

## Task
Help billing admins build, review, and send invoices — tracking open
balances, overdue accounts, and payment status across customers.

## Entities
- Invoice: invoice_number, customer, amount, status, due_date, days_overdue
- Customer: name, total_outstanding, oldest_invoice_age, payment_terms
- LineItem: description, quantity, unit_price, subtotal, tax

## Sample Queries
- Show me all invoices overdue by more than 30 days
- Which customers have the highest outstanding balances?
- Build a summary of unpaid invoices for this month
- What invoices are due in the next 7 days?

## User Journey
1. Admin asks about invoice status or overdue accounts
2. Results appear in the panel — each row shows invoice or customer data
   with payment status badge (Paid / Overdue / Pending)
3. Admin selects invoices to send a payment reminder
4. After sending, panel updates with "Reminder Sent" status
5. Admin can also create a new invoice from the results panel
