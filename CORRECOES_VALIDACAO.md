# Correções e validação — 17/10/2026

Foram tratados os seis achados prioritários de ANALISE_SOFTWARE.md, em sequência. Para cada defeito foi criado um teste que falhou antes da correção e passou depois. A infraestrutura dos testes legados também foi corrigida para carregar o armazenamento simulado corretamente.

| Ordem | Correção | Validação |
|---|---|---|
| 1 | Vencimento não marca mais receitas e despesas como pagas | Pendências preservadas, saldo realizado e segunda abertura |
| 2 | Limpeza de ajustes recalcula e persiste os saldos imediatamente | Saldo antes/depois, conteúdo persistido e reabertura |
| 3 | Edição individual aceita a nova data | Data persistida, metadados de recorrência preservados e efeito no saldo |
| 4 | Remoção explícita de vínculos com projetos e metas | Remoção persistida e preservação dos campos omitidos |
| 5 | Metas excluem aportes pendentes/futuros e dividem valores compartilhados | Divisão em centavos sem duplicação e manutenção do saldo inicial da meta |
| 6 | Backup completo e restauração consistente | Exportação/restauração, arquivo inválido, formato antigo, falha parcial, recuperação interrompida e atualização sem reiniciar |

## Regras explicitadas

- Limpar ajustes remove também os lançamentos de saldo inicial. A confirmação agora explica que isso recalcula os saldos imediatamente.
- Vincular um lançamento a metas significa destiná-lo como aporte. Ele conta somente quando confirmado e com data até hoje. O valor é dividido igualmente entre as metas existentes vinculadas, com distribuição determinística dos centavos restantes. O formulário informa essa regra.
- Backup v2 contém contas, lançamentos, etiquetas, projetos, metas, orçamentos, preferências, layouts, configurações financeiras e tema.
- Backups antigos continuam aceitos, mas não podem recuperar cadastros que nunca foram exportados. Campos ausentes recebem padrões; vínculos órfãos de metas/projetos são removidos. A confirmação avisa sobre essa limitação.
- A restauração grava um diário com os valores anteriores. Se a escrita falhar, tenta desfazê-la; se o app for interrompido ou a recuperação falhar, o diário permite nova tentativa na inicialização.
- Os orçamentos usam meses de 00 a 11, como o restante do aplicativo. Um teste adicional cobre janeiro e dezembro.

## Testes existentes

O mock do AsyncStorage foi substituído pelo mock oficial, incluindo multiGet. Os testes aguardam a carga inicial. O teste de projetos agora verifica o contrato usado pelas telas: R$ 500 de gasto bruto, R$ 50 de receita e R$ -450 disponível. A regra de projetos não foi alterada para satisfazer o teste antigo.

## Limitações

Validação automatizada de regras e armazenamento simulado; não houve teste visual ou execução em dispositivo. Notificações nativas, seletor de arquivos e compartilhamento precisam de conferência em celular. Não foram alteradas as dependências nem realizada a refatoração ampla sugerida no relatório. O ESLint não está instalado nesta cópia.

## Resultado final

- Jest: 26 testes aprovados em 4 suítes.
- TypeScript: aprovado, sem erros.
- Verificação de diferenças: sem erros de whitespace.
- ESLint: não executou porque o executável não está instalado.
