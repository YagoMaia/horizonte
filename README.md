# 🌅 Horizonte — Gestão Financeira e Projeção de Fluxo de Caixa

![Version](https://img.shields.io/badge/version-1.0.10-blue.svg)
![React Native](https://img.shields.io/badge/React_Native-0.76-61DAFB?logo=react&logoColor=black)
![Expo](https://img.shields.io/badge/Expo-SDK_52-black?logo=expo&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white)

Aplicativo mobile de gestão financeira pessoal e projeção de fluxo de caixa diário, construído com **React Native**, **Expo SDK 52**, **TypeScript** e arquitetura **Offline-First**.

---

## 🎯 Proposta e Finalidade

Ao contrário de gerenciadores financeiros convencionais que apenas mostram o passado (onde seu dinheiro foi parar), o **Horizonte** foi projetado para antecipar o futuro:
- **Projeção Diária em 30 Dias**: Simula o saldo dia a dia considerando receitas esperadas, compras no débito, parcelas de faturas de cartão de crédito e meta de gasto diário.
- **Integração de Metas & Reserva**: Permite incluir metas de alta liquidez (como Reserva de Emergência) diretamente no saldo disponível do Horizonte sem distorcer o fluxo de caixa.
- **Ciclo Completo de Cartões**: Faturas calculadas dinamicamente com base em data de fechamento e vencimento, suporte a compras parceladas, antecipação e pagamento auditável.
- **Orçamento por Envelopes**: Acompanhamento de teto orçamentário por categorias de despesa.
- **Planejamento de Viagens**: Defina orçamentos específicos para viagens, monitore os gastos em tempo real e saiba se está dentro do limite programado.
- **Alta Performance e Acessibilidade**: Interface fluida baseada em indexação de transações, suporte a alto contraste, e navegação intuitiva otimizada para leitores de tela.
- **Totalmente Offline e Privado**: Seus dados financeiros pertencem apenas a você e nunca saem do seu dispositivo (`AsyncStorage`).

---

## 📱 Módulos e Telas do Aplicativo

| Aba / Tela | Descrição |
|---|---|
| 💳 **Saldos (Extrato)** | Saldo consolidado, resumo de entradas e saídas (com segregação Débito/Crédito), alerta inteligente de lançamentos atrasados, filtros avançados por mês/tipo/conta e exportação para CSV e JSON. |
| 📈 **Horizonte** | Motor de projeção financeira diária para o mês corrente ou futuro, gráfico de evolução, definição de meta diária de gastos, seletor de contas/metas ativas e alerta de saldo crítico. |
| 💳 **Cartões de Crédito** | Gestão de múltiplos cartões, cálculo automático de faturas atuais e futuras, parcelamentos, antecipações e conciliação de faturas. |
| 🎯 **Metas (Cofrinho)** | Criação de objetivos financeiros, prazos, acompanhamento visual de progresso, ordenação por urgência, histórico com busca em tempo real e aportes automáticos mensais. |
| 📊 **Orçamento** | Definição de limites mensais por categoria de gasto com barras visuais de consumo e indicador de sobregasto. |
| ✈️ **Viagens** | Planejador de viagens com definição de orçamento, rastreamento de gastos locais, acompanhamento de progresso e datas. |
| 📑 **Relatórios** | Visão analítica histórica com gráficos de evolução patrimonial, saldo líquido, médias de gastos por categoria e ranking das maiores transações. |
| 🏦 **Contas** | Cadastro e edição de contas bancárias, cartões e carteiras, com geração automática de transação de ajuste ao alterar saldos manualmente. |
| ⚙️ **Menu** | Resumo de patrimônio líquido consolidado, exportação completa de dados e alternância de temas (Claro / Escuro / Sistema). |

---

## 🛠️ Tecnologias e Bibliotecas

- **Framework**: [Expo](https://expo.dev/) (SDK 52) & React Native 0.76
- **Linguagem**: [TypeScript](https://www.typescriptlang.org/) (Tipagem estrita)
- **Roteamento**: [Expo Router](https://docs.expo.dev/router/introduction/) (File-based routing)
- **Persistência**: `@react-native-async-storage/async-storage` com Write-Lock serializado
- **Ícones e UI**: `@expo/vector-icons` (Ionicons) & `react-native-safe-area-context`
- **Gráficos**: `react-native-svg` & componentes customizados de barras e linhas
- **Exportação & Notificações**: `expo-file-system`, `expo-sharing` e `expo-notifications`
- **Testes**: [Jest](https://jestjs.io/) & [Fast-Check](https://github.com/dubzzz/fast-check) (Property-based testing)

---

## 📂 Estrutura do Projeto

```
horizonte-rn/
├── app/                        # Rotas do Expo Router e ponto de entrada
│   ├── _layout.tsx             # Root layout com ThemeProvider e StoreProvider
│   └── index.tsx               # Orquestrador de abas e modais globais
├── components/                 # Modais e componentes visuais reutilizáveis
│   ├── AddTransactionModal.tsx # Modal unificado de criação/edição de lançamentos
│   ├── TransactionDetailModal.tsx # Modal de detalhes do lançamento
│   ├── BottomNavigation.tsx    # Barra de navegação inferior
│   ├── ConfirmDeleteModal.tsx  # Diálogo de confirmação de exclusão
│   ├── RecurrenceActionModal.tsx # Gestão de recorrências (Esta / Futuras / Todas)
│   ├── GoalFormModal.tsx       # Criação e edição de metas
│   ├── GoalDepositModal.tsx    # Depósito manual em metas
│   ├── GoalWithdrawModal.tsx   # Resgate de metas
│   ├── GoalRecurrenceModal.tsx # Agendamento de aportes recorrentes
│   ├── TripFormModal.tsx       # Criação e edição de viagens e orçamentos
│   └── screens/                # Telas completas da aplicação
├── context/                    # Contextos React (StoreContext, ThemeContext)
├── constants/                  # Definições TypeScript (types.ts) e temas (theme.ts)
├── hooks/                      # Hooks de negócio (useStore, useSavingsGoals, useReportsData)
├── lib/                        # Utilitários de data, moeda, validação e busca
├── docs/                       # Documentação técnica e regras de domínio
│   ├── ARCHITECTURE.md         # Arquitetura de software e fluxo de dados
│   └── DOMINIO_FINANCEIRO.md   # Regras contábeis, projeção e ciclo de faturas
└── __tests__/                  # Testes automatizados com Jest
```

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 18 ou superior)
- [npm](https://www.npmjs.com/) ou [pnpm](https://pnpm.io/)
- Dispositivo com o app [Expo Go](https://expo.dev/go) instalado ou emulador configurado (Android Studio / Xcode)

### Passo a Passo

```bash
# 1. Clone ou acesse o diretório do projeto
cd horizonte-rn

# 2. Instale as dependências
npm install

# 3. Inicie o servidor Metro do Expo
npx expo start
```

Pressione `a` para abrir no emulador Android, `i` para o simulador iOS ou leia o QR Code com o aplicativo Expo Go no seu smartphone.

---

## 🧪 Testes Automatizados

O projeto conta com suíte de testes unitários e testes baseados em propriedades com Jest:

```bash
# Executar todos os testes
npm test

# Verificação estática de tipos TypeScript
npx tsc --noEmit
```

---

## 📖 Documentação Adicional

Para entender a fundo a implementação e as regras financeiras:
- [Mapa do Projeto (docs/MAPA_PROJETO.md)](docs/MAPA_PROJETO.md)
- [Documentação de Arquitetura Técnica (docs/ARCHITECTURE.md)](docs/ARCHITECTURE.md)
- [Manual de Regras de Domínio Financeiro (docs/DOMINIO_FINANCEIRO.md)](docs/DOMINIO_FINANCEIRO.md)
- [Manual Operacional de IA (GEMINI.md)](GEMINI.md)

---

Desenvolvido para proporcionar controle e tranquilidade financeira.
