# Correções — Gerenciar Projetos

## Problemas corrigidos

- A criação de dois projetos em sequência podia salvar apenas o último, pois cada ação usava uma cópia antiga da lista. As operações agora são enfileiradas e cada projeto recebe um identificador exclusivo.
- Ao excluir um projeto, a lista de projetos e os lançamentos vinculados eram gravados em momentos distintos. Uma falha entre as duas gravações poderia deixar um lançamento apontando para um projeto inexistente. A alteração agora é gravada com diário de recuperação e rollback.
- O diário de projeto é recuperado na abertura do aplicativo e removido na limpeza total dos dados.
- A tela vazia continha uma ação de teste que inseria dados fictícios na base pessoal. Ela foi substituída pela ação de criar o primeiro projeto.
- O formulário agora informa campos inválidos e falhas de salvamento, bloqueia novos envios enquanto grava, respeita teclado no Android, áreas seguras e leitura por acessibilidade.
- Os textos de valores nos cartões podem quebrar linha em telas estreitas, evitando corte no Galaxy S23 e em aparelhos menores.

## Validação

- Testes cobrem criação concorrente, desvinculação sem apagar o lançamento, rollback de falha de armazenamento e recuperação após interrupção.
- O backup local privado é usado apenas na verificação automatizada e não foi alterado.
