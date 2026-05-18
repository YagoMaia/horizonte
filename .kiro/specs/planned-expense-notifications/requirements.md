# Requirements Document

## Introduction

This feature adds payment confirmation notifications for planned expenses (non-credit-card transactions with `reminderEnabled: true`). When a planned expense reaches its due date without being marked as paid, the app sends a local notification asking the user to confirm whether the payment was made. This mirrors the existing credit card invoice payment confirmation flow, ensuring users never forget to track their planned expenses like IPVA, rent, or utility bills.

## Glossary

- **Notification_Scheduler**: The module responsible for scheduling and managing local push notifications via expo-notifications
- **Auto_Processor**: The logic in useStore that automatically marks overdue transactions as paid (skipped when `reminderEnabled` is true)
- **Planned_Expense**: A Transaction with `reminderEnabled: true` that is not yet paid and belongs to a non-credit-card account
- **Confirmation_Flow**: The UI flow that presents the user with options to mark a planned expense as paid or dismiss the reminder
- **Due_Date**: The `date` field of a Transaction, representing when the payment is expected

## Requirements

### Requirement 1: Schedule Notification on Due Date

**User Story:** As a user, I want to receive a notification on the due date of my planned expense, so that I am reminded to pay it.

#### Acceptance Criteria

1. WHEN a Planned_Expense is created with a future Due_Date, THE Notification_Scheduler SHALL schedule a local notification for 8:00 AM device-local time on the Due_Date
2. WHEN a Planned_Expense is created with today's date as Due_Date and the current time is before 8:00 AM, THE Notification_Scheduler SHALL schedule a notification for 8:00 AM device-local time on that day
3. WHEN a Planned_Expense is created with today's date as Due_Date and the current time is 8:00 AM or later, or with a past Due_Date, THE Notification_Scheduler SHALL schedule a notification for 60 seconds after creation
4. WHEN a Planned_Expense is updated with a new Due_Date that is in the future, THE Notification_Scheduler SHALL cancel the previous notification and schedule a new one for 8:00 AM device-local time on the new Due_Date
5. WHEN a Planned_Expense is updated with a new Due_Date that is today or in the past, THE Notification_Scheduler SHALL cancel the previous notification and schedule a new one for 60 seconds after the update
6. WHEN a Planned_Expense is marked as paid, THE Notification_Scheduler SHALL cancel the scheduled notification for that transaction
7. WHEN a Planned_Expense is deleted, THE Notification_Scheduler SHALL cancel the scheduled notification for that transaction
8. WHEN a Transaction has its reminderEnabled field changed from true to false, THE Notification_Scheduler SHALL cancel the scheduled notification for that transaction

### Requirement 2: Notification Content

**User Story:** As a user, I want the notification to clearly identify the expense and amount, so that I know exactly which payment is due.

#### Acceptance Criteria

1. WHEN the Notification_Scheduler builds a planned expense notification, THE Notification_Scheduler SHALL set the notification title to the text "Lembrete de Pagamento" followed by a colon and the transaction description, truncated to 50 characters with an ellipsis if exceeded
2. WHEN the Notification_Scheduler builds a planned expense notification, THE Notification_Scheduler SHALL set the notification body to include the transaction amount formatted using formatCurrency (pt-BR, BRL locale producing "R$" prefix) followed by a Portuguese-language prompt asking the user whether the payment has been made
3. THE Notification_Scheduler SHALL include the transaction ID in the notification data payload under the key "txId"
4. THE Notification_Scheduler SHALL compose all notification text in Portuguese (pt-BR)

### Requirement 3: Overdue Notification Repetition

**User Story:** As a user, I want to receive daily reminders for overdue planned expenses that I have not confirmed, so that I do not forget about them.

#### Acceptance Criteria

1. WHILE a Planned_Expense remains unpaid after its Due_Date, THE Notification_Scheduler SHALL schedule a follow-up notification for 8:00 AM on the next calendar day, up to a maximum of 30 consecutive daily reminders per transaction
2. WHEN the user opens the app and a Planned_Expense is overdue and unpaid, THE Notification_Scheduler SHALL cancel any existing reminder for that transaction and schedule a new notification for 8:00 AM on the next calendar day
3. IF the notification permission is not granted, THEN THE Notification_Scheduler SHALL skip scheduling and log no error
4. IF a Planned_Expense is marked as paid, deleted, or has `reminderEnabled` set to false, THEN THE Notification_Scheduler SHALL cancel any pending follow-up notification for that transaction and stop further reminders

### Requirement 4: Payment Confirmation Flow from Notification

**User Story:** As a user, I want to tap the notification and be taken to a confirmation screen, so that I can quickly mark the expense as paid or postpone it.

#### Acceptance Criteria

1. WHEN the user taps a planned expense notification, THE Confirmation_Flow SHALL display a modal within 2 seconds showing the transaction description, amount, due date, and associated account name
2. WHEN the user taps the "Pagar" button in the Confirmation_Flow, THE Auto_Processor SHALL mark the transaction as paid and subtract the amount from the associated account balance for expenses, or add the amount for income
3. WHEN the user taps the "Ainda não paguei" button in the Confirmation_Flow, THE Notification_Scheduler SHALL keep the transaction as unpaid and schedule a follow-up reminder for 24 hours later
4. THE Confirmation_Flow SHALL display a "Pagar" (Pay) button and a "Ainda não paguei" (Not yet paid) button
5. IF the user taps a notification whose referenced transaction no longer exists or is already marked as paid, THEN THE Confirmation_Flow SHALL close the modal and display a brief message indicating the transaction is no longer pending
6. IF the notification tap occurs while the app is in a killed state, THEN THE Confirmation_Flow SHALL launch the app and display the confirmation modal after the app finishes loading, within 3 seconds of the tap

### Requirement 5: In-App Overdue Indicator

**User Story:** As a user, I want to see which planned expenses are overdue when I open the app, so that I can take action without relying solely on notifications.

#### Acceptance Criteria

1. WHILE a transaction has `reminderEnabled` set to true, is unpaid, and has a date on or before the current date, THE app SHALL display a visual indicator on that transaction's row in the list view by applying the theme's `warning` color to the transaction icon background, distinguishing it from non-overdue transactions of the same type
2. WHEN the Saldos tab is displayed and at least one overdue transaction exists, THE app SHALL display a summary banner above the transaction list showing both the count of overdue transactions and their combined total amount formatted as currency
3. IF no overdue transactions exist, THEN THE app SHALL hide the summary banner entirely rather than displaying a zero-count state
4. WHEN the user taps an overdue transaction in the list, THE app SHALL open the TransactionDetailModal pre-populated with that transaction's data, providing access to the existing edit flow where the user can mark the transaction as paid

### Requirement 6: Notification Rescheduling on App Launch

**User Story:** As a user, I want the app to ensure all my pending reminders are properly scheduled when I open it, so that notifications remain reliable even after device restarts.

#### Acceptance Criteria

1. WHEN the app launches and loads stored data, THE Notification_Scheduler SHALL verify and reschedule notifications for all unpaid Planned_Expenses with `reminderEnabled` set to true
2. WHEN the app launches, THE Notification_Scheduler SHALL cancel stale notifications for transactions that have been paid or deleted since the last session
3. THE Notification_Scheduler SHALL avoid scheduling duplicate notifications for the same transaction by checking existing scheduled notifications before creating new ones
