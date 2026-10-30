# Horizonte — React Native

App de gestão financeira pessoal convertido de Next.js para React Native com Expo.

## Critérios de interface móvel

O aparelho de referência do usuário é um Galaxy S23. O layout deve usar largura lógica disponível, respeitar áreas seguras e escala de fonte, sem depender da resolução física de um modelo. Conferir 320, 360 e 412 pixels lógicos e orientação horizontal; testar fonte ampliada sem limitar a acessibilidade para fazer o texto caber. Preservar rolagem e acesso aos botões quando o conteúdo cresce. A simulação web não substitui testes Android de teclado, gestos, fonte e desempenho.

Para validar um backup privado, definir `HORIZONTE_TEST_BACKUP` com o caminho local e executar `npm test -- --runInBand`. Os testes opt-in leem o arquivo sem incluí-lo no repositório e usam armazenamento simulado. Não adicionar backups pessoais como fixtures versionadas. Consulte `VALIDACAO_MOBILE.md`.

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
│       ├── TotaisScreen.tsx     # Totais (despesas/receitas)
│       ├── HorizonteScreen.tsx  # Projeção de saldo 30 dias
│       ├── ContasScreen.tsx     # Gerenciar contas bancárias
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
- **Totais** — Resumo de despesas/receitas, filtro por semana/mês/ano
- **Horizonte** — Projeção diária de saldo nos próximos 30 dias com gráfico de barras
- **Contas** — CRUD completo de contas (cor, ícone, tipo, saldo inicial)
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

## Gerar APK para instalar no Android

O projeto possui o perfil `preview` em `eas.json`, configurado para gerar um APK assinado e instalável diretamente no celular. É necessário ter uma conta Expo.

```bash
# Entre na sua conta Expo (necessário apenas uma vez neste computador)
npx eas-cli@latest login

# Vincula o projeto à conta Expo e cria a configuração remota na primeira vez
npm run eas:configure

# Gera o APK; na primeira execução, escolha criar a chave Android quando solicitado
npm run build:apk
```

Ao final, o EAS mostrará um link para baixar o arquivo `.apk`. Abra-o no celular e permita a instalação a partir dessa origem. Para publicar na Google Play, use o perfil `production`, que gera um `.aab`.

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

Todos os dados são salvos localmente com `@react-native-async-storage/async-storage`. Ao primeiro acesso, são carregados dados de exemplo.

## Compras por notificações (Android)

Acesse cabeçalho → Importar (ao lado de Horizonte) no novo APK. Escolha o aplicativo do banco, ative a captura e configure crédito/débito independentemente. Conceda acesso às notificações na tela Android. O app captura em segundo plano e processa a fila ao reabrir; com ele aberto, verifica a cada 10 segundos. Consulte `IMPORTACAO_NOTIFICACOES.md` para regras, testes e limitações de validação nativa.

Associe os finais dos cartões aos destinos. Compras sem final ficam para revisão, a menos que você autorize usar o destino padrão nessa situação. Finais desconhecidos e possíveis duplicatas exigem revisão. É possível confirmar parcelas nessa tela, informando se o valor corresponde ao total ou a cada parcela.
