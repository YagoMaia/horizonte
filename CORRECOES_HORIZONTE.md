# Correções da tela Horizonte

Concluídas em 18/10/2026, a partir do diagnóstico em `ANALISE_TELA_HORIZONTE.md`.

## Motor de projeção

- O cálculo diário foi extraído para `lib/horizonProjection.ts`, tornando as regras testáveis e evitando que a tela concentre a lógica financeira.
- Faturas pendentes passam a entrar na data de vencimento real. Faturas vencidas entram em hoje; faturas que vencem no mês atual não são omitidas.
- O cálculo usa o mesmo construtor de faturas de Cartões, inclusive créditos e pagamentos já vinculados. Fatura quitada não é adicionada de novo à projeção.
- A seleção de contas controla todo o saldo de caixa projetado. Sem conta selecionada, não há saldo agregado para descontar faturas.
- A pessoa pode incluir ou excluir faturas de cartão conscientemente na configuração. Quando excluídas, a tela informa que elas estão fora da projeção.
- Lançamentos são indexados por dia antes do percurso mensal, reduzindo varreduras repetidas do histórico.

## Interface móvel

- A tela compartilha a ocultação de valores com Saldos e Cartões.
- Há seleção direta de mês em MM/AAAA, além da navegação pelos botões.
- Lista virtualizada, grade de três meses, valores compactos em milhões e alvos de toque de 48 px.
- Modais usam limite de altura, rolagem, área segura e tratamento de teclado no Android e iOS. O formulário de planejamento mantém o botão de salvar acessível em tela estreita.
- Preferências de contas são carregadas uma vez, normalizadas quando uma conta deixa de existir e persistidas sem recarregar a configuração a cada alteração de lançamento.
- O relógio diário compartilhado atualiza a projeção ao virar o dia ou ao retornar ao app.
- Orçamento aceita `1.234,56`, aceita zero para desativar a meta e rejeita valores negativos ou inválidos.

## Testes

- TypeScript aprovado sem erros.
- Jest: **13 suítes e 82 testes aprovados**, incluindo o backup privado em modo somente leitura.
- Novos testes unitários verificam vencimento atual, fatura vencida, seleção de contas, fatura quitada e orçamento brasileiro.
- Novos testes de componente verificam fatura no vencimento, privacidade, seleção direta de mês e configuração de orçamento/faturas.
- `git diff --check` aprovado.

## Limites

Não houve medição de FPS, geração de APK ou instalação no S23. A validação nativa de teclado, gestos e fluidez ainda depende de abrir esta versão no aparelho. ESLint continua indisponível porque o pacote não existe em `node_modules`.
