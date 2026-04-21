# Horizonte — React Native

App de gestão financeira pessoal convertido de Next.js para React Native com Expo.

## Estrutura do Projeto

```
horizonte-rn/
├── app/
│   ├── _layout.tsx              # Root layout (Expo Router + providers)
│   └── index.tsx                # Tela principal com navegação
├── components/
│   ├── BottomNavigation.tsx     # Barra de navegação inferior
│   ├── AddTransactionModal.tsx  # Modal para adicionar lançamentos
│   ├── TransactionDetailModal.tsx # Modal de detalhes do lançamento
│   └── screens/
│       ├── SaldosScreen.tsx     # Saldo geral + lançamentos recentes
│       ├── TotaisScreen.tsx     # Totais por tag (despesas/receitas)
│       ├── HorizonteScreen.tsx  # Projeção de saldo 30 dias
│       ├── ContasScreen.tsx     # Gerenciar contas bancárias
│       ├── TagsScreen.tsx       # Gerenciar tags/categorias
│       └── MenuScreen.tsx       # Configurações e resumo
├── context/
│   └── StoreContext.tsx         # Context global (evita prop drilling)
├── constants/
│   ├── theme.ts                 # Paleta de cores light/dark
│   └── types.ts                 # Interfaces TypeScript
├── hooks/
│   ├── useTheme.ts              # Hook de tema (useColorScheme)
│   └── useStore.ts              # Estado global + AsyncStorage
└── lib/
    └── utils.ts                 # formatCurrency, formatDate, projeção
```

## Funcionalidades

- **Saldos** — Saldo total de todas as contas, cards de contas e lista de lançamentos com tap para detalhes
- **Totais** — Breakdown de despesas/receitas por tag com barra de progresso, filtro por semana/mês/ano
- **Horizonte** — Projeção diária de saldo nos próximos 30 dias com gráfico de barras
- **Contas** — CRUD completo de contas (cor, ícone, tipo, saldo inicial)
- **Tags** — CRUD de tags com paleta de cores
- **Menu** — Resumo de patrimônio e configurações

## Instalação

```bash
# 1. Entre na pasta
cd horizonte-rn

# 2. Instale as dependências
npm install

# 3. Instale o babel plugin para os path aliases
npm install --save-dev babel-plugin-module-resolver

# 4. Rode o projeto
npx expo start
```

### Pré-requisitos

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- Para iOS: Xcode + Simulator
- Para Android: Android Studio + Emulator ou dispositivo físico com Expo Go

## Diferenças para a versão Web

| Web (Next.js)           | Mobile (React Native)                   |
|-------------------------|-----------------------------------------|
| Tailwind CSS            | `StyleSheet.create()` + tema dinâmico   |
| CSS Variables           | `constants/theme.ts` + `useTheme()`     |
| Radix UI                | Primitivos nativos + `@expo/vector-icons`|
| localStorage            | `AsyncStorage` (persistência real)      |
| Recharts                | Barras customizadas com `View`          |
| next/font (Inter)       | Fonte do sistema (SF Pro / Roboto)      |
| CSS `prefers-color-scheme` | `useColorScheme()` do React Native   |
| URL routing             | `expo-router` file-based routing        |

## Tema

O app suporta dark mode automático via `useColorScheme()`. As cores são definidas em `constants/theme.ts` espelhando a paleta do `globals.css` original (primary laranja, success verde, destructive vermelho).

## Persistência

Todos os dados são salvos localmente com `@react-native-async-storage/async-storage`. Ao primeiro acesso, são carregados dados de exemplo (3 contas, 8 tags, 3 transações).
