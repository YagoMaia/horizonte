# Correções de Gerenciar Contas

Data: 20/10/2026

## Problemas corrigidos

- A exclusão de conta apagava lançamentos vinculados, apesar da mensagem afirmar o contrário. Agora a exclusão é bloqueada enquanto existirem lançamentos ligados à conta, preservando o histórico.
- A mudança de uma conta bancária para cartão, ou o inverso, com lançamentos existentes é bloqueada. Isso evita reinterpretar transações antigas e faturas.
- A criação de conta e do lançamento de saldo inicial passou a gravar contas e lançamentos como uma única operação recuperável.
- Valores brasileiros como `1.234,56` agora são lidos como R$ 1.234,56. Entradas inválidas, limites negativos e dias de cartão inválidos recebem mensagem clara.
- O formulário agora informa nome obrigatório, mantém aberto o modal quando a pessoa cancela a alteração de saldo e mostra erros de gravação.
- Contas de cartão não podem ser escolhidas como conta principal; o cadastro de lançamento prefere uma conta bancária como origem inicial.
- Foi removida a possibilidade de apagar a última conta.
- A tela ganhou estado vazio, ajuste para teclado e área segura, controles de salvar com estado de carregamento e rótulos de acessibilidade em ações, campos e seletores.
- A tela passou a descrever corretamente a exclusão: lançamentos vinculados devem ser tratados antes de apagar a conta.

## Verificações

- TypeScript: aprovado.
- Jest com backup privado local: 18 suítes e 104 testes aprovados.
- `git diff --check`: aprovado.
- Foram adicionados testes para leitura de valores brasileiros, validação de dias e proteção de lançamentos vinculados.

