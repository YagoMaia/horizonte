# Mapa do Projeto — Horizonte

Este documento é o ponto de partida para navegar no código. Use-o junto de
`ARCHITECTURE.md` (decisões técnicas) e `DOMINIO_FINANCEIRO.md` (regras de
negócio).

## Visão rápida

O Horizonte é um app React Native/Expo offline-first. A UI chama hooks de
domínio, os hooks atualizam o estado exposto por contextos e persistem no
`AsyncStorage`. Não há API ou backend remoto.

```text
app/ e components/screens/
          │ interação do usuário
          ▼
context/StoreContext + context/ThemeContext
          │ hooks e ações de domínio
          ▼
hooks/ ─────────────────────────► AsyncStorage
          │
          ▼
constants/types.ts + lib/ (tipos, cálculos e utilitários puros)
```

## Por onde começar

| Objetivo | Arquivos principais |
|---|---|
| Entender inicialização, abas e modais globais | `app/_layout.tsx`, `app/index.tsx` |
| Alterar estado financeiro, contas ou transações | `context/StoreContext.tsx`, `hooks/useStore.ts`, `constants/types.ts` |
| Trabalhar com metas | `hooks/useSavingsGoals.ts`, `components/screens/GoalsScreen.tsx`, `components/screens/GoalDetailScreen.tsx` |
| Alterar telas e fluxo de lançamento | `components/AddTransactionModal.tsx`, `components/TransactionDetailModal.tsx`, `components/screens/SaldosScreen.tsx` |
| Alterar projeção financeira | `components/screens/HorizonteScreen.tsx`, `hooks/useStore.ts`, `lib/utils.ts` |
| Alterar faturas/cartões | `components/screens/CartaoScreen.tsx`, `hooks/useStore.ts`, `constants/types.ts` |
| Alterar relatórios | `components/screens/ReportsScreen.tsx`, `components/screens/reports/`, `hooks/useReportsData.ts` |
| Alterar orçamento | `components/screens/OrcamentoScreen.tsx`, `components/screens/orcamento/` |
| Alterar tema ou aparência global | `context/ThemeContext.tsx`, `constants/theme.ts`, `hooks/useTheme.ts` |
| Alterar busca ou exportação | `hooks/useTransactionSearch.ts`, `lib/searchUtils.ts`, `lib/exportUtils.ts` |
| Trabalhar com viagens (em desenvolvimento) | `hooks/useTrips.ts`, `components/screens/ViagensScreen.tsx`, `components/screens/TripDetailScreen.tsx`, `components/TripFormModal.tsx` |

## Módulos funcionais

| Módulo | Responsabilidade | Fonte de dados |
|---|---|---|
| Saldos | Extrato, filtros, conciliação e exportação | contas e transações |
| Horizonte | Projeção diária de fluxo de caixa | contas ativas, metas e transações |
| Cartões | Compras, ciclos, parcelamentos e pagamento de fatura | contas do tipo cartão e transações |
| Metas | Aportes, resgates, recorrências e progresso | metas sincronizadas com transações |
| Orçamento | Limites mensais por categoria | transações e orçamento por categoria |
| Relatórios | Agregações históricas e gráficos | transações e contas |
| Contas | Cadastro, saldos e ajustes auditáveis | contas e transações de ajuste |
| Menu | Tema, exportação e patrimônio consolidado | preferências e estado financeiro |
| Viagens | Planejamento e detalhe de viagens | módulo em desenvolvimento no diretório de trabalho |

## Fluxos críticos

### Criar ou editar uma transação

`AddTransactionModal` valida a entrada e dispara uma ação de `useStore` via
`StoreContext`. O hook atualiza contas/transações, serializa a persistência com
o write-lock e disponibiliza o novo estado para as telas. Relatórios,
orçamento, horizonte e faturas recalculam a partir desse estado.

### Meta de economia

Um aporte ou resgate é representado por transação de transferência. O
`useSavingsGoals` usa `syncWithTransactions` para refletir a movimentação no
histórico da meta com IDs determinísticos. Não crie uma mutação de meta que
ignore essa sincronização.

### Cartão de crédito

A compra no cartão compõe a fatura, mas não reduz de imediato a conta bancária.
O pagamento da fatura gera o débito correspondente e as telas analíticas
evitam somá-lo novamente às compras individuais. As regras completas estão em
`DOMINIO_FINANCEIRO.md`.

## Regras de alteração

1. Comece por `constants/types.ts` ao criar ou modificar uma entidade.
2. Mantenha mutações persistidas dentro do write-lock de `useStore` ou
   `useSavingsGoals`.
3. Prefira funções puras em `lib/` para cálculo, formatação e validação.
4. Preserve a regra anti-duplicidade entre compra no crédito e pagamento de
   fatura.
5. Ao adicionar uma tela, conecte a navegação em `app/index.tsx` e atualize
   este mapa e `ARCHITECTURE.md` se a nova área for estável.

## Testes e verificação

```bash
npm test
npx tsc --noEmit
```

Os testes atuais se concentram em utilitários. Para uma regra financeira nova,
adicione teste de unidade para o cálculo antes de integrar a tela.

## Artefatos de navegação gerados

`graphify-out/` contém o grafo gerado do repositório:

- `graph.html`: exploração visual das dependências;
- `GRAPH_REPORT.md`: relatório de comunidades e conexões;
- `graph.json`: dados brutos do grafo.

Esses arquivos podem ser regenerados quando a estrutura mudar.
