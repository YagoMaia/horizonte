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

## Hoje e reserva de faturas — 27/10/2026

- A lista renderiza os dias até hoje na abertura e repete a rolagem caso os itens ainda não tenham sido medidos.
- A grade também abre na linha de hoje. Mês atual reposiciona o dia mesmo quando o mês já está selecionado.
- Removido o aviso de que as faturas estão fora da projeção; a configuração de inclusão permanece disponível.
- Com faturas incluídas, o saldo pendente das competências futuras é reservado no primeiro dia de cada mês. Não há novo desconto no vencimento. No mês atual, mantém-se vencimento/hoje para faturas vencidas.
- Os detalhes do dia 1 identificam cada reserva pelo nome do cartão. Antecipações, faturas quitadas e créditos continuam respeitando o cálculo central.
- Validação: TypeScript, git diff --check e 14 testes específicos aprovados. Sem validação física no S23 nesta etapa.

## Controle direto no Horizonte — 28/10/2026

- Adicionado controle Faturas no dia 1 na tela principal, visível tanto em lista quanto em grade.
- Ativado: reserva o saldo pendente das competências futuras no dia 1 e inclui cartões caso estivessem desativados no planejamento.
- Desativado: as faturas incluídas voltam a ser descontadas no vencimento; a alternância não remove a dívida das projeções.
- A escolha é salva no dispositivo e restaurada ao reabrir. Falhas ao salvar aparecem na tela e preservam o cálculo atual em memória.
- O mês atual continua usando o vencimento. Cada fatura é descontada uma única vez.
- Validação: TypeScript, git diff --check e 18 testes de Horizonte/projeção aprovados. Sem teste físico no S23 nesta etapa.
