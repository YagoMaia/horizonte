# Implementation Plan: Savings Goals

## Overview

Implement the Savings Goals feature for the Horizonte app. This adds a "Metas" tab to the BottomNavigation where users can create financial goals, track progress through deposits/withdrawals, and view detailed history. The implementation follows the existing patterns: `useSavingsGoals` hook for state/persistence (like `useStore`), screen components (like `SaldosScreen`), and modal components for user input. All data is persisted offline-first via AsyncStorage with a dedicated key.

## Tasks

- [x] 1. Define data models and types
  - [x] 1.1 Add SavingsGoal, GoalDeposit, CreateGoalInput, UpdateGoalInput interfaces and extend TabType in `constants/types.ts`
    - Add `'metas'` to the `TabType` union
    - Define `SavingsGoal` interface with id, name, targetAmount, accumulatedAmount, deadline, icon, color, createdAt, updatedAt
    - Define `GoalDeposit` interface with id, goalId, amount, date
    - Define `CreateGoalInput` and `UpdateGoalInput` interfaces
    - _Requirements: 1.1, 1.2, 3.3, 7.1_

- [x] 2. Implement validation and utility modules
  - [x] 2.1 Create `lib/goalValidation.ts` with validateGoalForm, validateDepositAmount, validateWithdrawalAmount
    - `validateGoalForm`: check name (1-50 chars, non-whitespace-only), targetAmount (0.01–999,999,999.99), deadline (today or future if provided)
    - `validateDepositAmount`: check amount > 0 and <= 999,999,999.99
    - `validateWithdrawalAmount`: check amount > 0 and <= accumulated
    - Return `{ valid: boolean, errors: Record<string, string> }` with Portuguese error messages
    - _Requirements: 1.3, 1.4, 1.6, 1.8, 3.4, 3.5, 6.2, 6.4_

  - [x] 2.2 Create `lib/goalUtils.ts` with calculateProgress, calculateRemainingDays, calculateOverdueDays, calculateRemainingAmount, recalculateAccumulated
    - `calculateProgress`: `Math.min(100, Math.floor(accumulated / target * 100))`
    - `calculateRemainingDays`: calendar days from today to deadline (inclusive), null if no deadline
    - `calculateOverdueDays`: days past deadline, null if not overdue
    - `calculateRemainingAmount`: `Math.max(0, target - accumulated)`
    - `recalculateAccumulated`: sum of all deposit amounts (negative for withdrawals)
    - _Requirements: 2.4, 5.1, 5.4, 5.5, 7.3_

  - [ ]* 2.3 Write property tests for goalValidation (Properties 1, 6)
    - **Property 1: Goal form validation rejects all invalid inputs**
    - **Property 6: Transaction amount validation**
    - **Validates: Requirements 1.3, 1.4, 1.6, 1.8, 3.4, 6.2, 6.4**

  - [ ]* 2.4 Write property tests for goalUtils (Properties 3, 10)
    - **Property 3: Progress percentage calculation**
    - **Property 10: Deadline calculations**
    - **Validates: Requirements 2.4, 5.1, 5.4, 5.5**

- [x] 3. Implement useSavingsGoals hook
  - [x] 3.1 Create `hooks/useSavingsGoals.ts` with full state management and AsyncStorage persistence
    - Load goals and deposits from `@horizonte:savings_goals` on mount
    - Implement `createGoal`, `updateGoal`, `deleteGoal`, `addDeposit`, `addWithdrawal`
    - Implement write-lock pattern to serialize async operations (same as useStore)
    - Recalculate accumulatedAmount from deposits on load
    - Handle malformed data gracefully (treat as empty, log error, don't delete)
    - Implement retry mechanism for load failures
    - Revert in-memory state on write failures
    - _Requirements: 1.2, 1.5, 1.7, 3.3, 3.8, 4.6, 4.8, 6.3, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ]* 3.2 Write property test for persistence round-trip (Property 2)
    - **Property 2: Persistence round-trip preserves goal data**
    - **Validates: Requirements 1.2, 1.5, 7.2**

  - [ ]* 3.3 Write property test for deposit/withdrawal operations (Properties 4, 5)
    - **Property 4: Deposit increases accumulated by exact amount**
    - **Property 5: Withdrawal decreases accumulated by exact amount**
    - **Validates: Requirements 3.3, 3.7, 6.3**

  - [ ]* 3.4 Write property test for accumulated consistency (Property 7)
    - **Property 7: Accumulated consistency invariant**
    - **Validates: Requirements 7.3**

  - [ ]* 3.5 Write property tests for completed status and sort order (Properties 8, 9)
    - **Property 8: Completed status reflects accumulated vs target**
    - **Property 9: Goals listing maintains sort order**
    - **Validates: Requirements 2.1, 2.5, 6.5**

  - [ ]* 3.6 Write property tests for deletion and malformed data (Properties 11, 12)
    - **Property 11: Deletion removes goal and all associated deposits**
    - **Property 12: Malformed data resilience**
    - **Validates: Requirements 4.6, 7.6**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement modal components
  - [x] 5.1 Create `components/GoalFormModal.tsx` for create/edit goal operations
    - Fields: name (TextInput), targetAmount (numeric TextInput), deadline (optional date picker), icon (selector), color (selector)
    - Pre-fill fields when `initialData` prop is provided (edit mode)
    - Display inline validation errors below each invalid field
    - Preserve form data on validation failure or save error
    - Use theme colors via `useTheme`, match existing modal patterns (borderTopLeftRadius 28, bottom sheet style)
    - _Requirements: 1.1, 1.3, 1.4, 1.6, 1.7, 1.8, 4.1, 4.2, 4.3_

  - [x] 5.2 Create `components/GoalDepositModal.tsx` for deposit operations
    - Numeric input accepting values 0.01–999,999,999.99 with up to 2 decimal places
    - Inline validation error display
    - Show congratulatory message "Parabéns! Você atingiu sua meta!" when deposit causes accumulated >= target
    - Use theme colors, match existing modal patterns
    - _Requirements: 3.2, 3.4, 3.5, 3.6, 3.7_

  - [x] 5.3 Create `components/GoalWithdrawModal.tsx` for withdrawal operations
    - Numeric input accepting values 0.01 to current accumulated amount
    - Validation error "O valor da retirada não pode ser maior que o saldo acumulado"
    - Display success confirmation message on valid withdrawal
    - Use theme colors, match existing modal patterns
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 6. Implement screen components
  - [x] 6.1 Create `components/screens/GoalsScreen.tsx` as the main goals listing screen
    - Display all goals sorted by createdAt descending (most recent first)
    - Each goal card shows: name, icon, color, target amount (formatted), accumulated amount (formatted), progress bar
    - Show checkmark indicator when accumulated >= target
    - Empty state with icon "trophy-outline" and message "Nenhuma meta criada. Comece definindo seu primeiro objetivo!"
    - "Nova Meta" button to open GoalFormModal
    - ActivityIndicator while loading, error state with retry button
    - Follow SaldosScreen visual patterns: borderRadius 20, padding 16, gap 16, StyleSheet.hairlineWidth borders, fontSize 16 fontWeight 600 for section titles
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 8.2, 8.3, 8.4, 8.5_

  - [x] 6.2 Create `components/screens/GoalDetailScreen.tsx` for individual goal details
    - Display: goal name, target amount, accumulated amount, remaining amount (max 0), percentage (0–100 capped), deadline info, deposit history
    - Deposit history sorted by date descending, each showing amount and date
    - Empty deposit state: "Nenhum depósito registrado ainda"
    - Show remaining days until deadline (inclusive) or "Meta vencida" warning with days overdue
    - Action buttons: Depositar, Retirar, Editar, Excluir
    - Deletion confirmation dialog: "Excluir meta? Esta ação não pode ser desfeita." with confirm/cancel
    - Use ConfirmDeleteModal pattern from existing codebase
    - Follow theme system and SaldosScreen visual patterns
    - _Requirements: 3.1, 4.1, 4.4, 4.5, 4.6, 4.7, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.5_

- [x] 7. Integrate into navigation
  - [x] 7.1 Add "Metas" tab to BottomNavigation in `components/BottomNavigation.tsx`
    - Add `{ id: 'metas', label: 'Metas', icon: 'trophy-outline' }` to RIGHT_TABS array, positioned before the "Menu" tab
    - _Requirements: 8.1_

  - [x] 7.2 Wire GoalsScreen into the main app layout to render when "metas" tab is active
    - Import and render GoalsScreen in the main app component where tab content is switched
    - Pass navigation state for GoalDetailScreen (can use internal state or simple stack within the tab)
    - _Requirements: 8.1, 8.4_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check (already in devDependencies)
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript throughout, matching the existing codebase
- All components use the `useTheme` hook for dark/light mode support
- AsyncStorage key: `@horizonte:savings_goals`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.2"] },
    { "id": 2, "tasks": ["2.3", "2.4", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4", "3.5", "3.6", "5.1", "5.2", "5.3"] },
    { "id": 4, "tasks": ["6.1", "6.2"] },
    { "id": 5, "tasks": ["7.1", "7.2"] }
  ]
}
```
