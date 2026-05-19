# Requirements Document

## Introduction

Funcionalidade de busca de transações para o app Horizonte. Permite ao usuário pesquisar transações por descrição e/ou valor, buscando em todo o histórico (não limitado ao mês atual). A busca se integra à tela SaldosScreen existente, mantendo a consistência visual e a experiência offline-first do app.

## Glossary

- **Search_Engine**: Módulo responsável por filtrar transações com base no termo de busca fornecido pelo usuário
- **Search_Bar**: Componente de input de texto exibido na SaldosScreen para o usuário digitar o termo de busca
- **Search_Term**: Texto digitado pelo usuário no campo de busca, usado para filtrar transações por descrição ou valor
- **Transaction_List**: Lista de transações exibida na SaldosScreen, que apresenta os resultados filtrados
- **SaldosScreen**: Tela principal do app que exibe saldo, contas e a lista mensal de transações

## Requirements

### Requirement 1: Exibição do Campo de Busca

**User Story:** Como usuário, quero ter um campo de busca visível na tela de saldos, para que eu possa iniciar uma pesquisa rapidamente.

#### Acceptance Criteria

1. THE SaldosScreen SHALL display a Search_Bar with a search icon (Ionicons "search-outline") and placeholder text "Buscar por descrição ou valor"
2. WHEN the user taps the Search_Bar, THE Search_Bar SHALL become focused and display the on-screen keyboard
3. WHEN the Search_Bar contains text, THE Search_Bar SHALL display a clear button (icon "close-circle") to reset the search term
4. WHEN the user taps the clear button, THE Search_Engine SHALL clear the Search_Term and restore the default monthly transaction view

### Requirement 2: Busca por Descrição

**User Story:** Como usuário, quero buscar transações pela descrição, para que eu encontre lançamentos específicos sem navegar mês a mês.

#### Acceptance Criteria

1. WHEN the user types a Search_Term, THE Search_Engine SHALL filter transactions whose description contains the Search_Term (case-insensitive partial match)
2. WHEN a Search_Term is active, THE Search_Engine SHALL search across all stored transactions regardless of the currently selected month
3. WHEN the Search_Term matches zero transactions, THE Transaction_List SHALL display an empty state message "Nenhuma transação encontrada"

### Requirement 3: Busca por Valor

**User Story:** Como usuário, quero buscar transações pelo valor, para que eu encontre lançamentos de um montante específico.

#### Acceptance Criteria

1. WHEN the user types a numeric Search_Term, THE Search_Engine SHALL also filter transactions whose formatted amount contains the numeric sequence
2. THE Search_Engine SHALL match numeric values using the formatted currency representation (e.g., "150" matches "R$ 150,00" and "R$ 1.500,00")
3. WHEN the Search_Term contains both text and numbers, THE Search_Engine SHALL match transactions where the description OR the formatted amount contains the Search_Term

### Requirement 4: Exibição dos Resultados

**User Story:** Como usuário, quero ver os resultados da busca de forma clara, para que eu identifique rapidamente a transação que procuro.

#### Acceptance Criteria

1. WHEN a Search_Term is active, THE Transaction_List SHALL display matching transactions sorted by date (most recent first)
2. WHEN a Search_Term is active, THE SaldosScreen SHALL hide the month navigation controls and display a label indicating search mode (e.g., "Resultados da busca")
3. WHEN a Search_Term is active, THE Transaction_List SHALL use the same visual layout (icons, colors, formatting) as the standard monthly transaction list
4. THE Transaction_List SHALL paginate search results in batches of 20 items, loading more on scroll

### Requirement 5: Interação com Filtros Existentes

**User Story:** Como usuário, quero que a busca funcione em conjunto com os filtros de tipo e conta, para que eu refine ainda mais os resultados.

#### Acceptance Criteria

1. WHEN a Search_Term is active AND filters (type or account) are applied, THE Search_Engine SHALL apply both the text search and the active filters simultaneously
2. WHEN the user clears the Search_Term, THE SaldosScreen SHALL restore the monthly view with any previously active filters still applied

### Requirement 6: Performance da Busca

**User Story:** Como usuário, quero que a busca responda rapidamente, para que eu não precise esperar ao digitar.

#### Acceptance Criteria

1. THE Search_Engine SHALL debounce the search input by 300 milliseconds to avoid excessive re-filtering during typing
2. THE Search_Engine SHALL produce filtered results within 100 milliseconds for datasets of up to 5000 transactions after the debounce period
3. WHILE the Search_Engine is processing results, THE Search_Bar SHALL remain responsive to continued user input
