# Requirements Document

## Introduction

Funcionalidade de Metas de Economia para o app Horizonte. Permite ao usuário criar metas financeiras (ex: "Viagem - R$ 5.000"), acompanhar o progresso de cada meta com depósitos parciais, e visualizar quanto falta para atingir o objetivo. A funcionalidade se integra ao sistema existente de contas e transações, mantendo a experiência offline-first com AsyncStorage e a consistência visual do app.

## Glossary

- **Goals_Manager**: Módulo responsável por criar, editar, excluir e gerenciar o estado das metas de economia
- **Savings_Goal**: Entidade que representa uma meta financeira com nome, valor alvo, valor acumulado, prazo opcional e ícone/cor
- **Goal_Deposit**: Registro de um depósito (aporte) realizado em direção a uma meta específica
- **Goals_Screen**: Tela dedicada à listagem e visualização das metas de economia do usuário
- **Progress_Indicator**: Componente visual (barra de progresso) que exibe a porcentagem atingida de uma meta
- **StoreContext**: Contexto global do app que gerencia o estado de contas, transações e agora metas

## Requirements

### Requirement 1: Criação de Meta de Economia

**User Story:** Como usuário, quero criar uma meta de economia com nome, valor alvo e prazo opcional, para que eu possa definir objetivos financeiros claros.

#### Acceptance Criteria

1. WHEN the user taps the "Nova Meta" button, THE Goals_Manager SHALL display a form with fields: name (required, between 1 and 50 non-whitespace-only characters), target amount (required, between 0.01 and 999,999,999.99), deadline (optional date, must be today or a future date if provided), icon (optional, default "flag-outline"), and color (optional, default primary color from the current theme)
2. WHEN the user submits a valid form, THE Goals_Manager SHALL create a new Savings_Goal with a unique ID, zero accumulated amount, and creation date, and navigate the user to the Goals_Screen showing the newly created goal
3. IF the user submits a form with missing required fields, THEN THE Goals_Manager SHALL display inline validation errors below each invalid field indicating which fields are required, and SHALL NOT create the Savings_Goal
4. IF the user enters a target amount of zero or negative value, THEN THE Goals_Manager SHALL display a validation error "O valor da meta deve ser maior que zero"
5. WHEN a Savings_Goal is created, THE Goals_Manager SHALL persist the goal in AsyncStorage before displaying creation confirmation to the user
6. IF the user enters a name containing only whitespace characters, THEN THE Goals_Manager SHALL display a validation error indicating that the name must contain at least one visible character
7. IF AsyncStorage write fails during Savings_Goal creation, THEN THE Goals_Manager SHALL display an error message indicating the goal could not be saved and SHALL allow the user to retry the save operation without re-entering the form data
8. IF the user provides a deadline date that is in the past, THEN THE Goals_Manager SHALL display a validation error indicating that the deadline must be today or a future date

### Requirement 2: Listagem de Metas

**User Story:** Como usuário, quero ver todas as minhas metas de economia em uma tela dedicada, para que eu acompanhe meu progresso geral.

#### Acceptance Criteria

1. THE Goals_Screen SHALL display all Savings_Goal items sorted by creation date (most recent first)
2. THE Goals_Screen SHALL display for each Savings_Goal: name, icon, color, target amount formatted as currency, accumulated amount formatted as currency, and a Progress_Indicator
3. IF no Savings_Goal exists, THEN THE Goals_Screen SHALL display an empty state with icon "trophy-outline" and message "Nenhuma meta criada. Comece definindo seu primeiro objetivo!"
4. THE Progress_Indicator SHALL display the percentage as floor(accumulated / target * 100), capped at 100%, rendered as a progress bar showing the filled proportion
5. WHEN a Savings_Goal accumulated amount is greater than or equal to the target amount, THE Goals_Screen SHALL display a checkmark indicator marking the goal as completed
6. THE Goals_Screen SHALL display a "Nova Meta" button that allows the user to initiate goal creation from the listing screen

### Requirement 3: Depósitos em Metas

**User Story:** Como usuário, quero registrar depósitos parciais em uma meta, para que eu acompanhe quanto já economizei.

#### Acceptance Criteria

1. WHEN the user taps a Savings_Goal, THE Goals_Manager SHALL display the goal details with a "Depositar" button
2. WHEN the user taps "Depositar", THE Goals_Manager SHALL display a numeric input for the deposit amount accepting values from 0.01 to 999,999,999.99 with up to 2 decimal places
3. WHEN the user confirms a valid deposit, THE Goals_Manager SHALL add the deposit amount to the Savings_Goal accumulated value, create a Goal_Deposit record with amount, system-generated timestamp, and goal ID, and persist the updated data to AsyncStorage
4. IF the user enters a deposit amount of zero or negative value, THEN THE Goals_Manager SHALL display a validation error "O valor do depósito deve ser maior que zero"
5. IF the user enters a non-numeric value or a value exceeding 999,999,999.99, THEN THE Goals_Manager SHALL display a validation error indicating the deposit amount is invalid
6. WHEN a deposit causes the accumulated amount to reach or exceed the target amount, THE Goals_Manager SHALL display a congratulatory message "Parabéns! Você atingiu sua meta!"
7. THE Goals_Manager SHALL allow deposits that cause the accumulated amount to exceed the target amount without blocking the operation
8. IF AsyncStorage write fails during a deposit operation, THEN THE Goals_Manager SHALL not update the displayed accumulated value, SHALL display an error message indicating the deposit could not be saved, and SHALL allow the user to retry the operation

### Requirement 4: Edição e Exclusão de Metas

**User Story:** Como usuário, quero editar ou excluir metas existentes, para que eu possa ajustar meus objetivos conforme minha situação muda.

#### Acceptance Criteria

1. WHEN the user long-presses or taps the edit option on a Savings_Goal, THE Goals_Manager SHALL display the edit form pre-filled with the current goal data: name, target amount, deadline, icon, and color
2. WHEN the user submits the edit form with valid data, THE Goals_Manager SHALL apply the same validation rules as goal creation (name required with max 50 characters, target amount greater than zero), persist the changes in AsyncStorage, and update the Goals_Screen within the same render cycle
3. IF the user submits the edit form with invalid data, THEN THE Goals_Manager SHALL display inline validation errors and SHALL NOT persist any changes
4. WHEN the user requests deletion of a Savings_Goal, THE Goals_Manager SHALL display a confirmation dialog with the message "Excluir meta? Esta ação não pode ser desfeita." and options to confirm or cancel
5. IF the user cancels the deletion confirmation, THEN THE Goals_Manager SHALL dismiss the dialog and preserve the Savings_Goal unchanged
6. WHEN the user confirms deletion, THE Goals_Manager SHALL remove the Savings_Goal and all associated Goal_Deposit records from AsyncStorage and remove the goal from the Goals_Screen immediately
7. THE Goals_Manager SHALL allow editing the target amount even if the accumulated amount already exceeds the new target
8. IF AsyncStorage write fails during edit or deletion, THEN THE Goals_Manager SHALL display an error message indicating the operation failed and SHALL NOT modify the in-memory state

### Requirement 5: Visualização de Progresso Detalhado

**User Story:** Como usuário, quero ver o histórico de depósitos e detalhes de progresso de uma meta, para que eu entenda minha evolução ao longo do tempo.

#### Acceptance Criteria

1. WHEN the user taps a Savings_Goal, THE Goals_Manager SHALL display a detail screen with: goal name, target amount, accumulated amount, remaining amount (calculated as target minus accumulated, minimum 0), percentage completed (integer 0–100, calculated as accumulated divided by target times 100, capped at 100), deadline (if set), and list of Goal_Deposit records
2. THE Goals_Manager SHALL display Goal_Deposit records sorted by date (most recent first) with amount and date for each entry
3. IF no Goal_Deposit records exist for the Savings_Goal, THEN THE Goals_Manager SHALL display an empty state message "Nenhum depósito registrado ainda"
4. WHILE a deadline is set and the current date is before or equal to the deadline, THE Goals_Manager SHALL display the remaining calendar days until the deadline (inclusive of the deadline day)
5. IF the current date is after the deadline and the accumulated amount is less than the target amount, THEN THE Goals_Manager SHALL display a visual warning "Meta vencida" with the number of calendar days overdue

### Requirement 6: Retirada de Valores

**User Story:** Como usuário, quero poder retirar valores de uma meta, para que eu possa ajustar o saldo caso precise usar parte do dinheiro economizado.

#### Acceptance Criteria

1. WHEN the user taps "Retirar" on a Savings_Goal detail screen, THE Goals_Manager SHALL display a numeric input for the withdrawal amount with support for values between 0.01 and the current accumulated amount
2. IF the user enters a withdrawal amount greater than the current accumulated amount, THEN THE Goals_Manager SHALL display a validation error "O valor da retirada não pode ser maior que o saldo acumulado"
3. WHEN the user confirms a valid withdrawal, THE Goals_Manager SHALL subtract the amount from the Savings_Goal accumulated value, create a Goal_Deposit record with negative amount, date, and goal ID, persist the changes to AsyncStorage, and display a success confirmation message indicating the withdrawal was completed
4. IF the user enters a withdrawal amount of zero or negative value, THEN THE Goals_Manager SHALL display a validation error "O valor da retirada deve ser maior que zero"
5. WHEN a withdrawal causes the accumulated amount to drop below the target amount on a previously completed Savings_Goal, THE Goals_Manager SHALL remove the completed visual indicator and update the Progress_Indicator to reflect the new percentage

### Requirement 7: Persistência e Consistência de Dados

**User Story:** Como usuário, quero que minhas metas e depósitos sejam salvos localmente, para que eu não perca dados ao fechar o app.

#### Acceptance Criteria

1. THE Goals_Manager SHALL persist all Savings_Goal and Goal_Deposit data in AsyncStorage using a dedicated storage key "@horizonte:savings_goals" within 1 second of any create, update, or delete operation
2. WHEN the app is opened, THE Goals_Manager SHALL load all saved goals and deposits from AsyncStorage before rendering the Goals_Screen, completing the load within 3 seconds
3. THE Goals_Manager SHALL ensure that the accumulated amount of a Savings_Goal equals the sum of all associated Goal_Deposit amounts by recalculating the accumulated value from Goal_Deposit records on each load
4. IF AsyncStorage read fails or the load does not complete within 3 seconds, THEN THE Goals_Manager SHALL display an error message indicating that data could not be loaded and present a retry button to re-attempt loading
5. IF AsyncStorage write fails during a create, update, or delete operation, THEN THE Goals_Manager SHALL display an error message indicating that data could not be saved and revert the in-memory state to the last successfully persisted state
6. IF stored data is malformed or cannot be parsed, THEN THE Goals_Manager SHALL treat the storage as empty, display the Goals_Screen with no goals, and log the corruption event without deleting the corrupted data from storage

### Requirement 8: Integração Visual e Navegação

**User Story:** Como usuário, quero acessar as metas de economia facilmente a partir da navegação principal, para que a funcionalidade esteja integrada ao fluxo do app.

#### Acceptance Criteria

1. THE Goals_Screen SHALL be accessible via a new tab in the BottomNavigation component with icon "trophy-outline" and label "Metas", positioned in the RIGHT_TABS array before the "Menu" tab
2. THE Goals_Screen SHALL follow the existing theme system (dark/light mode) using the colors object provided by the useTheme hook for background, foreground, card, border, and mutedForeground values
3. THE Goals_Screen SHALL use the same visual patterns as the SaldosScreen: card borderRadius of 20, content padding of 16, gap of 16 between sections, StyleSheet.hairlineWidth for card borders, and the same typography scale (section titles at fontSize 16 fontWeight 600)
4. WHEN the user navigates to the Goals_Screen, THE Goals_Manager SHALL display an ActivityIndicator centered on screen while data is being loaded from AsyncStorage, for a maximum duration of 10 seconds
5. IF the AsyncStorage data load fails or exceeds 10 seconds, THEN THE Goals_Screen SHALL display an error state with a retry button allowing the user to re-attempt the data load
