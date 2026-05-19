# Implementation Plan: Reports Screen (Relatórios)

## Overview

Implement the Relatórios screen feature by creating the `useReportsData` hook with pure computation functions, the `ReportsScreen` component with charts and cards, and integrating the new tab into the existing navigation system. The approach prioritizes testable pure logic first, then UI components, then integration.

## Tasks

- [x] 1. Set up types and navigation integration
  - [x] 1.1 Update TabType and add navigation tab
    - Add `'relatorios'` to the `TabType` union in `constants/types.ts`
    - Add `{ id: 'relatorios', label: 'Relatórios', icon: 'stats-chart-outline' }` to `RIGHT_TABS` in `components/BottomNavigation.tsx`
    - Add `case 'relatorios': return <ReportsScreen />` to `renderScreen()` in `app/index.tsx`
    - Add the import for `ReportsScreen` in `app/index.tsx`
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Implement useReportsData hook with pure computation functions
  - [x] 2.1 Create the pure computation functions in `hooks/useReportsData.ts`
    - Implement `filterTransactions` — filters paid-only and excludes transfers
    - Implement `groupByMonth` — groups transactions by YYYY-MM from date field
    - Implement `computeMonthlyTotals` — computes income/expense/netBalance per month for selected period
    - Implement `computePercentageVariation` — returns percentage change, 0 if previous is 0
    - Implement `computeComparativeSummary` — compares current vs previous month
    - Implement `computeAverages` — averages last 3 months of data
    - Implement `getTopTransactions` — returns top N transactions of given type sorted descending
    - Export all pure functions for testing
    - Define and export all interfaces: `PeriodMonths`, `MonthlyData`, `ComparativeSummary`, `Averages`, `TopTransaction`, `ReportsData`
    - _Requirements: 3.5, 3.6, 3.7, 4.5, 4.6, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.4, 8.1, 8.2, 8.3_

  - [x] 2.2 Implement the `useReportsData` hook function
    - Consume `transactions` and `accounts` from `useStoreContext`
    - Apply `filterTransactions`, `groupByMonth`, `computeMonthlyTotals` pipeline
    - Compute comparative summary, averages, and top transactions
    - Memoize all computed values with `useMemo`
    - Return `ReportsData` object including `isEmpty` and `isLoading` flags
    - _Requirements: 10.1, 10.3, 8.1, 8.2, 8.3_

  - [ ]* 2.3 Write property test: Only paid transactions pass filter
    - **Property 1: Only paid transactions are included in calculations**
    - **Validates: Requirements 3.5, 4.5, 5.6, 6.4, 8.1**

  - [ ]* 2.4 Write property test: Transfers are excluded
    - **Property 2: Transfer transactions are excluded from income and expense totals**
    - **Validates: Requirements 3.6, 4.6, 5.7, 6.5, 7.4, 8.2**

  - [ ]* 2.5 Write property test: Date determines month grouping
    - **Property 3: Transaction date determines competence month grouping**
    - **Validates: Requirements 3.7, 8.3**

  - [ ]* 2.6 Write property test: Period selection filters correct time window
    - **Property 4: Period selection filters to the correct time window**
    - **Validates: Requirements 2.3**

  - [ ]* 2.7 Write property test: Monthly income/expense sums are correct
    - **Property 5: Monthly aggregation correctly sums income and expenses**
    - **Validates: Requirements 3.1, 5.1, 5.3**

  - [ ]* 2.8 Write property test: Net balance invariant
    - **Property 6: Net balance equals income minus expenses**
    - **Validates: Requirements 4.1, 5.5**

  - [ ]* 2.9 Write property test: Percentage variation formula
    - **Property 7: Percentage variation is correctly computed**
    - **Validates: Requirements 5.2, 5.4**

  - [ ]* 2.10 Write property test: Averages formula
    - **Property 8: Averages equal sum of monthly values divided by month count**
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [ ]* 2.11 Write property test: Top-N sorting and limiting
    - **Property 9: Top-N transactions are the N largest sorted descending**
    - **Validates: Requirements 7.1, 7.2**

- [x] 3. Checkpoint - Ensure hook logic and property tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement ReportsScreen UI components
  - [x] 4.1 Create the PeriodSelector component within ReportsScreen
    - Implement segmented control with 3, 6, 12 month options
    - Default to 6 months on initial render
    - Follow the existing segmented control pattern from TotaisScreen
    - Use `useTheme` for styling
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 4.2 Create the MonthlyEvolutionChart component
    - Use `react-native-chart-kit` `LineChart` to render two lines (income green, expense red)
    - X axis: abbreviated month labels (Jan, Fev, Mar...)
    - Y axis: values in R$ format
    - Adapt chart width to screen width using `Dimensions`
    - Handle tooltip display on data point touch
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 11.4_

  - [x] 4.3 Create the NetBalanceChart component
    - Use `react-native-chart-kit` `BarChart` to render one bar per month
    - Green bars for positive net balance, red for negative
    - Adapt chart width to screen width
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 11.4_

  - [x] 4.4 Create the ComparativeSummaryCard component
    - Display current vs previous month income, expenses, and net balance
    - Show percentage variation with up/down arrows
    - Use `useTheme` for colors
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 4.5 Create the AveragesCard component
    - Display average monthly income, expenses, and net balance (last 3 months)
    - Use `useTheme` for colors
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 4.6 Create the TopTransactionsSection component
    - Display top 5 expenses and top 5 incomes of the current month
    - Show transaction value, description, date, and account name
    - Handle fewer than 5 transactions gracefully
    - _Requirements: 7.1, 7.2, 7.3, 7.5_

- [x] 5. Assemble ReportsScreen and handle states
  - [x] 5.1 Create the main `ReportsScreen` component in `components/screens/ReportsScreen.tsx`
    - Compose all sub-components inside a `ScrollView`
    - Wire `PeriodSelector` state to `useReportsData` hook
    - Display loading skeleton while `isLoading` is true
    - Display empty state message "Adicione transações para ver seus relatórios" when `isEmpty` is true
    - Use `useTheme` and `StyleSheet` for all styling
    - Ensure responsive layout on different screen sizes
    - _Requirements: 9.1, 9.2, 9.3, 10.2, 11.1, 11.2, 11.3_

  - [ ]* 5.2 Write unit tests for ReportsScreen
    - Test empty state rendering
    - Test loading skeleton display
    - Test period selector default value (6 months)
    - Test that all sub-components render when data is available
    - _Requirements: 9.2, 10.2, 2.2_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All pure computation functions are exported from `hooks/useReportsData.ts` for direct testing
- The project uses `fast-check` for property-based testing and `jest` as the test runner
- `react-native-chart-kit` is already installed — no new dependencies needed

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8", "2.9", "2.10", "2.11"] },
    { "id": 3, "tasks": ["4.1", "4.2", "4.3", "4.4", "4.5", "4.6"] },
    { "id": 4, "tasks": ["5.1"] },
    { "id": 5, "tasks": ["5.2"] }
  ]
}
```
