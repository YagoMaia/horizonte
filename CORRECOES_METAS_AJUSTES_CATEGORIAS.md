# Correções — Metas, Ajustes de Saldo e Categorias

## Metas

- A criação em sequência não perde mais metas: as gravações são serializadas e os identificadores são exclusivos.
- A exclusão agora desvincula os lançamentos na mesma alteração recuperável. Se o armazenamento falhar, a meta e os vínculos anteriores são restaurados.
- O formulário passou a validar valores, mostrar falhas de salvamento, bloquear envio repetido, lidar com teclado/áreas seguras e expor controles acessíveis.
- Os botões internos de editar e excluir não acionam mais, por acidente, a edição do cartão inteiro.

## Ajustes de saldo

- Edição e exclusão passaram a informar erro em vez de falhar silenciosamente.
- O editor funciona com teclado Android, fechamento pelo botão do sistema, áreas seguras e controles acessíveis.

## Categorias

- Criações, edições e exclusões rápidas são serializadas para não sobrescrever categorias.
- O formulário é limpo ao fechar, mostra falhas de validação/gravação e foi ajustado para teclado, área segura e acessibilidade.
- Excluir uma categoria preserva o texto já registrado nos lançamentos, portanto o histórico financeiro não é apagado.

## Validação

- Testes específicos verificam criação concorrente de metas e categorias, desvinculação de metas e rollback/recuperação de falhas de armazenamento.
- O backup local privado é usado somente nos testes e não foi alterado.
