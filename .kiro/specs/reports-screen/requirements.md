# Requirements Document

## Introduction

The "Relatórios" (ReportsScreen) feature provides a retrospective analytical view of the user's finances in the Horizonte app. The screen presents historical data through charts, comparative summaries, averages, and top transactions, enabling users to understand spending and income patterns over time. The screen is accessible via BottomNavigation or Menu and does not use a category system.

## Glossary

- **Reports_Screen**: The new "Relatórios" screen that displays financial analytics and charts to the user.
- **Transaction**: A financial record with properties including id, description, amount, type, date, accountId, paid status, and paymentMethod.
- **Income_Transaction**: A Transaction where type equals "receita" and paid equals true.
- **Expense_Transaction**: A Transaction where type equals "despesa" and paid equals true.
- **Transfer_Transaction**: A Transaction where type equals "transferencia".
- **Net_Balance**: The result of subtracting total expenses from total income for a given period.
- **Period_Selector**: A segmented control allowing the user to choose between 3, 6, or 12 months of historical data.
- **Competence_Month**: The month derived from the Transaction date field, representing when the transaction applies financially.
- **useReportsData_Hook**: A dedicated React hook responsible for processing, filtering, and memoizing all report calculations.
- **Monthly_Evolution_Chart**: A line chart displaying income and expense trends over the selected period.
- **Net_Balance_Chart**: A bar chart displaying the net balance per month over the selected period.
- **Comparative_Summary_Card**: A card comparing current month financial metrics with the previous month.
- **Averages_Card**: A card displaying average income, expenses, and net balance over the last 3 months.
- **Top_Transactions_Section**: A section listing the 5 largest expenses and 5 largest incomes of the current month.

## Requirements

### Requirement 1: Navigation Integration

**User Story:** As a user, I want to access the Relatórios screen from the bottom navigation or menu, so that I can quickly view my financial reports.

#### Acceptance Criteria

1. THE Reports_Screen SHALL be accessible as a tab in the BottomNavigation component with the label "Relatórios" and an appropriate Ionicons icon.
2. WHEN the user taps the "Relatórios" tab, THE Reports_Screen SHALL render as the active screen content.
3. THE TabType type definition SHALL include a "relatorios" value to support the new navigation tab.

### Requirement 2: Period Selection

**User Story:** As a user, I want to select the time range for my reports, so that I can analyze my finances over different periods.

#### Acceptance Criteria

1. THE Reports_Screen SHALL display a Period_Selector at the top of the screen with options for 3, 6, and 12 months.
2. WHEN the screen first loads, THE Period_Selector SHALL default to 6 months.
3. WHEN the user selects a period option, THE Reports_Screen SHALL update all charts and calculations to reflect the selected period.
4. THE Period_Selector SHALL render as a segmented control following the existing app pattern used in TotaisScreen.

### Requirement 3: Monthly Evolution Line Chart

**User Story:** As a user, I want to see a line chart of my income and expenses over time, so that I can identify financial trends.

#### Acceptance Criteria

1. THE Monthly_Evolution_Chart SHALL display two lines: one for total income and one for total expenses per month over the selected period.
2. THE Monthly_Evolution_Chart SHALL label the X axis with abbreviated month names (e.g., Jan, Fev, Mar).
3. THE Monthly_Evolution_Chart SHALL label the Y axis with values in R$ format.
4. WHEN the user touches a data point on the Monthly_Evolution_Chart, THE Reports_Screen SHALL display a tooltip showing the exact monetary value for that point.
5. THE Monthly_Evolution_Chart SHALL include only transactions where paid equals true in its calculations.
6. THE Monthly_Evolution_Chart SHALL exclude Transfer_Transactions from both income and expense totals.
7. THE Monthly_Evolution_Chart SHALL use the Transaction date field to determine the Competence_Month.

### Requirement 4: Monthly Net Balance Bar Chart

**User Story:** As a user, I want to see a bar chart of my monthly net balance, so that I can quickly identify surplus and deficit months.

#### Acceptance Criteria

1. THE Net_Balance_Chart SHALL display one vertical bar per month representing the Net_Balance for that month.
2. WHEN a month has a positive Net_Balance, THE Net_Balance_Chart SHALL render that bar in green.
3. WHEN a month has a negative Net_Balance, THE Net_Balance_Chart SHALL render that bar in red.
4. THE Net_Balance_Chart SHALL display the same number of months as selected in the Period_Selector.
5. THE Net_Balance_Chart SHALL include only transactions where paid equals true in its calculations.
6. THE Net_Balance_Chart SHALL exclude Transfer_Transactions from both income and expense totals.

### Requirement 5: Comparative Summary

**User Story:** As a user, I want to compare my current month's finances with the previous month, so that I can understand if my financial situation is improving or worsening.

#### Acceptance Criteria

1. THE Comparative_Summary_Card SHALL display the current month total income alongside the previous month total income.
2. THE Comparative_Summary_Card SHALL display the percentage variation of income between the current and previous month with an upward arrow for increase and a downward arrow for decrease.
3. THE Comparative_Summary_Card SHALL display the current month total expenses alongside the previous month total expenses.
4. THE Comparative_Summary_Card SHALL display the percentage variation of expenses between the current and previous month with an upward arrow for increase and a downward arrow for decrease.
5. THE Comparative_Summary_Card SHALL display the current month Net_Balance alongside the previous month Net_Balance.
6. THE Comparative_Summary_Card SHALL include only transactions where paid equals true.
7. THE Comparative_Summary_Card SHALL exclude Transfer_Transactions from calculations.

### Requirement 6: Averages

**User Story:** As a user, I want to see my average income, expenses, and net balance, so that I can understand my typical monthly financial performance.

#### Acceptance Criteria

1. THE Averages_Card SHALL display the average monthly income calculated over the last 3 months.
2. THE Averages_Card SHALL display the average monthly expenses calculated over the last 3 months.
3. THE Averages_Card SHALL display the average monthly Net_Balance calculated over the last 3 months.
4. THE Averages_Card SHALL include only transactions where paid equals true.
5. THE Averages_Card SHALL exclude Transfer_Transactions from calculations.

### Requirement 7: Top Transactions of the Month

**User Story:** As a user, I want to see my largest transactions of the current month, so that I can identify major income sources and spending.

#### Acceptance Criteria

1. THE Top_Transactions_Section SHALL display a list of the 5 largest Expense_Transactions of the current month sorted by amount in descending order.
2. THE Top_Transactions_Section SHALL display a list of the 5 largest Income_Transactions of the current month sorted by amount in descending order.
3. FOR EACH transaction in the Top_Transactions_Section, THE Reports_Screen SHALL display the transaction value, description, date, and associated account name.
4. THE Top_Transactions_Section SHALL exclude Transfer_Transactions from both lists.
5. IF fewer than 5 expense or income transactions exist for the current month, THEN THE Top_Transactions_Section SHALL display only the available transactions without error.

### Requirement 8: Data Filtering Rules

**User Story:** As a user, I want reports to reflect only confirmed financial activity, so that projections do not distort my historical analysis.

#### Acceptance Criteria

1. THE useReportsData_Hook SHALL include only transactions where paid equals true in all calculations.
2. THE useReportsData_Hook SHALL exclude Transfer_Transactions from income and expense totals across all report sections.
3. THE useReportsData_Hook SHALL use the Transaction date field to determine the Competence_Month for grouping transactions.

### Requirement 9: Insufficient Data Handling

**User Story:** As a user, I want the reports screen to gracefully handle periods with limited data, so that I am not confused by errors or empty charts.

#### Acceptance Criteria

1. IF the available transaction history covers fewer months than the selected period, THEN THE Reports_Screen SHALL display only the available months without showing an error.
2. IF no transactions exist, THEN THE Reports_Screen SHALL display a friendly empty state with the message "Adicione transações para ver seus relatórios".
3. THE Monthly_Evolution_Chart SHALL render without error when fewer data points than the selected period are available.

### Requirement 10: Performance and Data Processing

**User Story:** As a user, I want the reports screen to load quickly, so that I can view my analytics without noticeable delay.

#### Acceptance Criteria

1. THE useReportsData_Hook SHALL memoize all computed values to prevent unnecessary recalculations on re-renders.
2. THE Reports_Screen SHALL display a loading skeleton while the useReportsData_Hook processes transaction data.
3. THE useReportsData_Hook SHALL fetch transaction data from the existing store without requiring additional network requests.

### Requirement 11: Theming and Responsiveness

**User Story:** As a user, I want the reports screen to match the app's visual style and adapt to my theme preference, so that the experience is consistent.

#### Acceptance Criteria

1. THE Reports_Screen SHALL use the useTheme hook to apply colors consistent with the current light or dark theme.
2. THE Reports_Screen SHALL use StyleSheet for all styling following the existing app pattern.
3. THE Reports_Screen SHALL render correctly on different screen sizes by using responsive layout techniques.
4. THE Monthly_Evolution_Chart and Net_Balance_Chart SHALL adapt their width to the available screen width.
