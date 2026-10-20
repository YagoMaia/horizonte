# Correções da tela Menu

Data: 18 de outubro de 2026

## Mudanças realizadas

- A exportação CSV foi extraída para `lib/csvExport.ts`.
- Datas de lançamentos usam a data financeira local na exportação.
- Receita, despesa e transferência são exportadas com seus tipos corretos.
- Todas as células CSV são codificadas com aspas, preservando separadores, quebras de linha e aspas; conteúdos que poderiam virar fórmulas de planilha são tratados como texto.
- O Menu exibe o horário ativo de cada lembrete.
- Desativar um lembrete não pede permissão; a permissão é solicitada apenas para ativá-lo.
- O teste de notificação solicita permissão antes de agendar a notificação.
- Backup, restauração, exportação, sincronização, limpeza de ajustes, limpeza total e notificação de teste passam a exibir estado de processamento e bloqueiam toques repetidos enquanto a operação está ativa.
- A limpeza de ajustes passou a receber apresentação destrutiva, igual à limpeza total.
- Itens de Menu, interruptores, editores de horário, opções de tema, opções de cor e controles dos modais receberam rótulos e estados de acessibilidade.
- Os controles de edição e ajuste de horário receberam área de toque de 48 px, adequada a uso móvel.
- O texto de aparência foi simplificado de “Tema escuro” para “Tema”, pois também oferece Claro e Automático.

## Testes adicionados

- `__tests__/csvExport.test.ts`: proteção de CSV, fórmulas, aspas, separadores, data e transferência.
- `__tests__/menu.test.tsx`: navegação, modais, horários, interruptores, permissões e confirmações de manutenção.

## Validação

- TypeScript sem erros.
- 16 suítes e 93 testes aprovados.
- Backup privado usado apenas localmente nos testes.
- Verificação do diff aprovada.

## Limitação

O seletor de documentos, compartilhamento de arquivos, permissão do Android e entrega da notificação ainda precisam de confirmação final em um S23 físico.
