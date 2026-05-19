# Implementation Plan: Transaction Search

## Overview

Implement a search feature for the SaldosScreen that allows users to find transactions by description or formatted amount across their entire history. The implementation follows the existing component architecture: a new `SearchBar` component, a `useTransactionSearch` custom hook, and a pure `filterTransactions` utility function. Search integrates with existing type/account filters and uses debounced input with paginated results.

## Tasks

- [x] 1. Set up testing infrastructure and create pure search utility
  - [x] 1.1 Set up testing framework (Jest + fast-check)
    - Install `jest`, `@types/jest`, `ts-jest`, `fast-check`, and `@testing-library/react-native` as dev dependencies
    - Create `jest.config.ts` with TypeScript support and module resolution matching `babel.config.js`
    - Add `"test": "jest --run"` script to `package.json`
    - _Requirements: 6.1, 6.2_

  - [x] 1.2 Implement `filterTransactions` pure function
    - Create `lib/searchUtils.ts`
    - Implement `filterTransactions(transactions, searchTerm, filters)` following the design interface
    - Normalize search term (trim, lowercase)
    - Match against `description.toLowerCase()` using `String.includes()`
    - Match against `formatCurrency(amount)` for numeric/formatted value matching
    - Apply type filter (`'todas'` means no filter) and account filter
    - Sort results by date descending
    - Guard against null/undefined descriptions with `(tx.description || '')`
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 4.1, 5.1_

  - [ ]* 1.3 Write property test: Search match completeness and soundness
    - **Property 1: Search match completeness and soundness**
    - Generate random transactions (random descriptions, amounts) and random search terms
    - Verify `filterTransactions` returns exactly those transactions where description (case-insensitive) contains the term OR formatted amount contains the term
    - **Validates: Requirements 2.1, 3.1, 3.2, 3.3**

  - [ ]* 1.4 Write property test: Cross-month search scope
    - **Property 2: Cross-month search scope**
    - Generate transactions with dates spread across multiple months
    - Verify search returns matches from all months, not limited to any single month
    - **Validates: Requirements 2.2**

  - [ ]* 1.5 Write property test: Results sorted by date descending
    - **Property 3: Results are sorted by date descending**
    - Generate random transactions and search terms that produce results
    - Verify for every consecutive pair (results[i], results[i+1]), date of results[i] >= date of results[i+1]
    - **Validates: Requirements 4.1**

  - [ ]* 1.6 Write property test: Filter composition
    - **Property 5: Filter composition (search AND filters)**
    - Generate random transactions, search terms, and filter combinations
    - Verify all results satisfy BOTH the search term match AND the active filter criteria
    - **Validates: Requirements 5.1**

- [x] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement SearchBar component
  - [x] 3.1 Create `SearchBar` component
    - Create `components/SearchBar.tsx`
    - Implement controlled `TextInput` with props: `value`, `onChangeText`, `onClear`, `placeholder`
    - Add search icon (Ionicons `search-outline`) on the left side
    - Add clear button (Ionicons `close-circle`) visible only when `value` is non-empty
    - Style using `useTheme()` colors to match the app's card-based design system
    - Set placeholder to "Buscar por descrição ou valor"
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 3.2 Write unit tests for SearchBar component
    - Test that search icon renders correctly
    - Test that clear button appears only when text is present
    - Test that `onClear` callback is invoked on clear button press
    - Test that `onChangeText` is called on text input
    - _Requirements: 1.1, 1.3_

- [x] 4. Implement useTransactionSearch hook
  - [x] 4.1 Create `useTransactionSearch` hook
    - Create `hooks/useTransactionSearch.ts`
    - Manage `searchTerm` state and debounced value (300ms debounce using `setTimeout`/`clearTimeout`)
    - Call `filterTransactions` with debounced term, full transaction list, and active filters
    - Implement pagination: expose `displayedResults` (batches of 20), `loadMore`, and `hasMore`
    - Expose `isSearchActive` (true when debounced term is non-empty)
    - Expose `clearSearch` to reset term and pagination
    - _Requirements: 4.4, 5.1, 5.2, 6.1, 6.3_

  - [ ]* 4.2 Write property test: Pagination invariant
    - **Property 4: Pagination invariant**
    - Generate result sets of varying sizes (0 to 200+ items)
    - Verify initial displayed results contain at most 20 items
    - Verify each `loadMore` increases displayed count by at most 20 until all results shown
    - **Validates: Requirements 4.4**

  - [ ]* 4.3 Write unit tests for useTransactionSearch hook
    - Test debounce delays filtering by 300ms
    - Test `clearSearch` resets search term and pagination
    - Test `isSearchActive` reflects debounced term state
    - Test `loadMore` increments displayed results correctly
    - _Requirements: 6.1, 4.4_

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Integrate search into SaldosScreen
  - [x] 6.1 Wire SearchBar and search hook into SaldosScreen
    - Import and render `SearchBar` at the top of the transaction section in `components/screens/SaldosScreen.tsx`
    - Initialize `useTransactionSearch` with transactions from `useStoreContext()` and current filter state
    - Connect `SearchBar` value/onChangeText/onClear to hook's `searchTerm`/`setSearchTerm`/`clearSearch`
    - _Requirements: 1.1, 1.2, 1.4_

  - [x] 6.2 Switch transaction list between monthly and search modes
    - When `isSearchActive` is true: render `displayedResults` from the hook instead of monthly transactions
    - When `isSearchActive` is true: hide month navigation controls and display "Resultados da busca" label
    - When `isSearchActive` is false: restore default monthly transaction view with existing filters
    - Reuse existing `renderItem` function for search results (same icons, colors, formatting)
    - _Requirements: 4.2, 4.3, 2.2_

  - [x] 6.3 Implement empty state and infinite scroll
    - When search results are empty, display "Nenhuma transação encontrada" message
    - Implement `onEndReached` on FlatList to call `loadMore` when `hasMore` is true
    - Ensure clearing search restores monthly view with previously active filters preserved
    - _Requirements: 2.3, 4.4, 5.2_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The project currently has no test framework; task 1.1 sets it up
- All code is TypeScript, matching the existing project conventions
- `fast-check` is used for property-based testing as specified in the design

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "3.1"] },
    { "id": 2, "tasks": ["1.3", "1.4", "1.5", "1.6", "3.2"] },
    { "id": 3, "tasks": ["4.1"] },
    { "id": 4, "tasks": ["4.2", "4.3"] },
    { "id": 5, "tasks": ["6.1"] },
    { "id": 6, "tasks": ["6.2", "6.3"] }
  ]
}
```
