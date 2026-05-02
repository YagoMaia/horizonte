# Horizonte — React Native (GEMINI.md)

Este documento contém as diretrizes fundamentais, convenções e arquitetura do projeto Horizonte para orientar o desenvolvimento e manutenção do código.

## Tech Stack
- **Framework:** Expo (React Native) com TypeScript.
- **Roteamento:** Expo Router (File-based).
- **Gerenciamento de Estado:** Context API (`StoreContext`) + Custom Hook (`useStore`).
- **Persistência:** `@react-native-async-storage/async-storage`.
- **Estilização:** `StyleSheet.create()` com tema dinâmico (Light/Dark).
- **Ícones:** `@expo/vector-icons` (Ionicons).

## Convenções de Código
- **Componentes:** Preferir componentes funcionais com Hooks.
- **Tipagem:** Manter interfaces e tipos centralizados em `constants/types.ts`.
- **Estilos:** Manter estilos no final do arquivo do componente para facilitar a leitura da lógica.
- **Internacionalização:** Atualmente focado em Português (BR) e moeda BRL (R$).
- **Surgical Updates:** Ao editar arquivos, realizar mudanças pontuais e preservar a lógica existente, a menos que solicitado o contrário.

## Arquitetura e Fluxo de Dados
- **Persistência Local:** O app é offline-first. Todos os dados (contas, transações, orçamentos) são salvos no dispositivo via AsyncStorage.
- **Centralização:** O hook `useStore.ts` em `hooks/` é o "cérebro" da aplicação, lidando com o cálculo de saldos, processamento de recorrências e persistência.
- **Layout:** O arquivo `app/index.tsx` atua como o orquestrador das abas principais (Saldos, Totais, Horizonte, Cartão, Menu).

## Instruções Específicas
- **Categorização:** O sistema de "Tags" foi removido. Não reintroduzir lógica de categorias ou tags sem solicitação explícita.
- **Transações de Cartão:** Seguem uma lógica específica de fatura baseada em dia de fechamento e vencimento (veja `CartaoScreen.tsx` e `useStore.ts`).
- **Projeções:** A lógica de fluxo de caixa (Horizonte) baseia-se em lançamentos futuros e recorrentes para prever o saldo nos próximos 30 dias.

## Diretrizes de UI/UX
- **Acessibilidade:** Seguir o esquema de cores definido em `constants/theme.ts`.
- **Plataformas:** Garantir compatibilidade com Android e iOS. Suporte para Web é secundário, mas deve ser preservado onde implementado (ex: exportação de arquivos).
