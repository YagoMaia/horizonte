---
inclusion: auto
---

# Horizonte RN — Contexto do Projeto

## Visão Geral
App de gestão financeira pessoal em React Native (Expo SDK 52). Totalmente offline-first, sem backend. Dados persistidos localmente via AsyncStorage.

## Stack Técnica
- **Framework**: Expo ~52.0.0 + React Native 0.76.9
- **Linguagem**: TypeScript 5.3+ (strict mode)
- **Roteamento**: Expo Router 4 (file-based, mas navegação interna via tabs manuais)
- **Estado**: React Context API + hook customizado `useStore`
- **Persistência**: @react-native-async-storage/async-storage
- **Ícones**: @expo/vector-icons (Ionicons)
- **Animações**: react-native-reanimated ~3.16
- **Gráficos**: react-native-chart-kit + react-native-svg
- **Notificações**: expo-notifications (locais)
- **Datas**: date-fns ^4.1.0
- **Path aliases**: `@/*` → `./*`

## Estrutura de Diretórios
```
app/              → Expo Router (apenas _layout.tsx + index.tsx)
components/       → Componentes UI
  screens/        → Telas renderizadas por tab (não são rotas)
context/          → Providers (StoreContext, ThemeContext)
hooks/            → Hooks customizados (useStore, useTheme)
constants/        → types.ts, theme.ts
lib/              → utils.ts, notifications.ts
assets/           → Imagens e ícones
```

## Padrão de Navegação
- Expo Router usado apenas para layout raiz
- Navegação interna via `BottomNavigation` com estado `TabType`
- Tabs: `saldos`, `totais`, `horizonte`, `contas`, `cartao`, `menu`
- Telas renderizadas condicionalmente em `app/index.tsx`

## Gerenciamento de Estado
- `useStore.ts` é o Single Source of Truth
- Context API via `StoreContext` (evita prop drilling)
- Tema separado em `ThemeContext` (light/dark/system + cor primária customizável)
- Chaves AsyncStorage: `@horizonte:transactions`, `@horizonte:accounts`, `@horizonte:monthly_budgets`, `@horizonte:show_pending`

## Funcionalidades Existentes
- **Saldos**: Saldo total, cards de contas, lista de transações com filtros e swipe-to-delete
- **Totais**: Resumo receitas/despesas com filtro por período
- **Horizonte**: Projeção de fluxo de caixa 30 dias com gráfico de barras
- **Contas**: CRUD completo de contas bancárias
- **Cartão**: Gestão de cartão de crédito — faturas por mês, pagamento, antecipação, parcelas
- **Menu**: Configurações e resumo patrimonial
- **Notificações**: Lembretes de pagamento, fechamento e vencimento de fatura

## Convenções de Código
- Componentes funcionais com Hooks
- Estilos via `StyleSheet.create()` no final do arquivo
- PascalCase para componentes, camelCase para variáveis/funções
- Exportações nomeadas (não default, exceto páginas do Expo Router)
- Tema dinâmico via `useTheme()` retornando objeto `colors`

## Regras de Domínio Críticas
- **Tags foram removidas** — NÃO reintroduzir sistema de tags
- **Toda alteração de estado** deve persistir via AsyncStorage
- **Lógica de cartão de crédito** (closingDay/dueDay) é crítica — não alterar sem validação
- **Projeção de saldo** — não alterar lógica sem validar cálculo de saldo futuro
- **Famílias de transações** — recorrências/parcelas compartilham `groupId` com operações em lote
- **Auto-processamento** — transações vencidas são marcadas como pagas automaticamente (exceto se `reminderEnabled`)

## Tipos Principais
```typescript
type TabType = 'saldos' | 'totais' | 'horizonte' | 'contas' | 'menu' | 'cartao'
type TransactionType = 'receita' | 'despesa' | 'transferencia'
type RecurrenceType = 'unica' | 'diaria' | 'semanal' | 'mensal' | 'anual' | 'quinto_dia_util'

interface Account {
  id, name, balance, type, color, icon
  creditLimit?, closingDay?, dueDay?  // para cartão de crédito
}

interface Transaction {
  id, description, amount, type, date, accountId, recurrence, paid
  paymentMethod?, installmentNumber?, totalInstallments?
  groupId?, groupIndex?, reminderEnabled?
  // ... outros campos opcionais
}
```

## Dependências Principais
| Pacote | Versão |
|--------|--------|
| expo | ~52.0.0 |
| react-native | 0.76.9 |
| expo-router | ~4.0.0 |
| async-storage | 1.23.1 |
| date-fns | ^4.1.0 |
| expo-notifications | ~0.29.14 |
| react-native-reanimated | ~3.16.1 |
| react-native-chart-kit | ^6.12.2 |
