# Correções da tela Cartões

Concluídas em 18/10/2026, após o diagnóstico em ANALISE_TELA_CARTOES.md.

## Correções implementadas

- Todos os cartões usam a mesma competência de vencimento na visão consolidada. Navegação mensal e seleção direta em MM/AAAA.
- Fechamento e vencimento respeitam o último dia válido do mês. Status dos lançamentos baseado na fatura, não na data da compra; fatura vazia tem identificação própria.
- Valores brasileiros validados integralmente e cálculos de pagamento em centavos. Novos pagamentos e antecipações limitados ao saldo pendente selecionado; datas inválidas ou futuras recusadas.
- Créditos excedentes legados transportados para faturas seguintes do mesmo cartão. Consumo registrado na quitação para impedir reutilização.
- Saldos e Cartões compartilham o índice de faturas; projeções consultam o valor pendente efetivo.
- Pagamentos vinculam a movimentação da conta à fatura e registram a data efetiva. Bloqueio contra toques duplicados e diário de gravação para recuperação de escrita interrompida ou falha.
- Novos pagamentos vinculados podem ser estornados em Cartões. Pagamento parcial seguido de quitação exige estornar primeiro a quitação. Edição/exclusão avulsas dos registros vinculados são bloqueadas.
- Exclusão distingue lançamentos da fatura e famílias de parcelas/recorrências. Hífen no identificador não basta para inferir uma família.
- Opção de marcar como quitada sem movimentar conta explica seu efeito no formulário.
- Modais roláveis, tratamento de teclado, áreas seguras, alvos de toque e conteúdo adaptável à largura.
- Cartão, mês e filtros preservados entre abas; ocultação de valores compartilhada com Saldos.
- Lista virtualizada, linhas memorizadas e índice compartilhado reduzem varreduras repetidas. Indicadores incluem saldo pendente, crédito aplicado, parcelas futuras e limite disponível estimado.

## Validação

- TypeScript: aprovado, sem erros.
- Jest: **11 suítes e 74 testes aprovados**, incluindo faturas, pagamentos, concorrência, recuperação de gravação, estorno, exclusão e componentes.
- Backup privado: leitura e simulação em memória de pagamento, conferindo a redução da dívida contra a saída da conta. Original intacto e fora do repositório.
- Navegador: 320×640, 360×780, 412×915 e 780×360. Formulários roláveis e cancelamento acessível em tela estreita e horizontal. Em 412×915, os 22 elementos monetários inspecionados não apresentaram transbordamento horizontal.
- Confirmadas seleção direta de competência, preservação de mês ao trocar de aba e ocultação compartilhada de valores.
- Evidência visual com valores ocultos: `.agent-memory/cartoes-mobile-validacao.png`.
- `git diff --check`: aprovado.

## Limites

A inspeção visual foi feita na versão web. Teclado, gestos e fluidez nativa ainda precisam de conferência no S23 físico. Não houve medição de FPS, geração de APK ou atualização da versão instalada.

Estorno automático se aplica aos novos pagamentos vinculados. Vínculos ausentes em pagamentos legados não são inferidos. O limite disponível é estimado; não substitui o informado pelo banco. Nenhuma operação bancária foi realizada.

ESLint não estava instalado; essa verificação não foi executada. As demais verificações acima foram concluídas.

## Competência inicial

- A tela de cartões agora abre na próxima competência de vencimento. Por exemplo, em outubro ela inicia em novembro.
- A escolha já feita pelo usuário continua sendo preservada ao sair e voltar à aba.
- A virada de dezembro para janeiro também é coberta por teste.

## Cancelamento de pagamento

- Cada pagamento registrado na fatura agora apresenta o botão **Cancelar pagamento**.
- A confirmação explica que a ação reabre a fatura somente no Horizonte e não cancela uma operação já feita no banco.
